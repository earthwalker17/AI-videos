/**
 * Motion tests for lookdev (docs/ARCHITECTURE.md, decision 31): what `aiv still --span` adds to
 * the stills of a span. Stills cannot show whether the motion is elegant, so:
 *  - --encode turns the span's PNGs into what a render run would give, all in the stills folder
 *    (never in out/<slug>/render or qa): span.mkv, a lossless FFV1 RGB clip with the mezzanine's
 *    settings (it must decode to the span's frame hashes); span.mp4, a preview through the
 *    profile's delivery preset (the one BT.709 conversion and its tags, as aiv post); contact.png
 *    (aiv qa's contact sheet) and motion QA (aiv qa's motion.png, motion.json and strips/). The
 *    sheet, the strips and the measure read span.mkv, the exact pixels; span.mp4 is for playing;
 *  - --inner picks frames strictly inside the span to render again, each in its own call: the
 *    chunk-start check for lookdev entries, which have no run for --check to compare with.
 */
import { rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg } from '../media/bin.ts';
import { commitPart } from '../media/encoder.ts';
import { encodeDelivery } from '../media/mux.ts';
import { MEZZANINE_COLOR, mezzanineArgs } from '../media/presets.ts';
import { probe } from '../media/probe.ts';
import { allFrameHashes } from '../qa/frames.ts';
import { MOTION_THRESHOLDS, motionQa } from '../qa/motion.ts';
import { contactSheet } from '../qa/qa.ts';
import type { Profile } from '../runner/profiles.ts';
import type { Log } from '../util/log.ts';
import { partPath, repoRel } from '../util/paths.ts';

/** At most this many frames in one --span call: 8 s at 30 fps, a motion test, not a render. */
export const MAX_SPAN = 240;
/** --encode needs at least one motion window (the cadence measure's frames). */
export const MIN_ENCODE_FRAMES = MOTION_THRESHOLDS.window;

/**
 * The `n` frames --inner renders again, inside the span of `count` frames from `first`: never
 * the span's first frame (its call opened the page there too), spread evenly over the rest (the
 * centres of `n` equal parts of first+1 .. first+count-1), sorted and distinct. Needs
 * 1 <= n < count.
 */
export function innerFrames(first: number, count: number, n: number): number[] {
  const m = count - 1;
  if (!Number.isInteger(n) || n < 1 || n > m) throw new Error(`innerFrames: ${n} frames do not fit inside a span of ${count}`);
  // consecutive centres are m/n >= 1 apart, so the floors are distinct and stay in 1..m
  return Array.from({ length: n }, (_, k) => first + 1 + Math.floor(((k + 0.5) * m) / n));
}

/**
 * ffmpeg arguments for span.mkv: the mezzanine's own arguments (mezzanineArgs: FFV1 level 3,
 * bgr0, intra-only, its colour tags, bit-exact Matroska) with the PNG sequence as the input
 * instead of raw RGBA on stdin. `dir` is the folder of the f<NNNNN>.png stills.
 */
export function spanMkvArgs(o: { width: number; height: number; fps: number; dir: string; first: number; frames: number; out: string }): string[] {
  const m = mezzanineArgs({ width: o.width, height: o.height, fps: o.fps, out: o.out });
  const a = m.indexOf('-f');
  const b = m.indexOf('pipe:0');
  if (m[a + 1] !== 'rawvideo' || m[b - 1] !== '-i') throw new Error('mezzanineArgs changed its input arguments: update spanMkvArgs');
  // image2 reads '%%' as a literal '%' (a folder may hold one); f%05d.png is stillName's pattern
  const pattern = join(o.dir.replace(/%/g, '%%'), 'f%05d.png');
  return [...m.slice(0, a), '-f', 'image2', '-framerate', String(o.fps), '-start_number', String(o.first), '-i', pattern, '-frames:v', String(o.frames), ...m.slice(b + 1)];
}

/** stills.json `encode`: what --encode wrote (names in the stills folder) and how long it took. */
export interface StillsEncodeJson {
  /** the composition frame of each clip's first frame: contact.png, motion.json and the strips count frames from it */
  firstFrame: number;
  frames: number;
  fps: number;
  files: { clip: string; preview: string; contact: string; motionSheet: string; motionJson: string; strips: string[] };
  /** span.mkv: lossless, and verified to decode to the span's frame hashes */
  clip: { bytes: number; decodedMatch: true };
  /** span.mp4: the profile's delivery preset and the colour it was tagged with (probed) */
  preview: { preset: string; encoder: string; bytes: number; pixFmt: string | null; color: { space: string | null; primaries: string | null; transfer: string | null; range: string | null } };
  /** the motion QA's information checks; measured on span.mkv without a cue sheet (a flash or pop meant as a hit is listed too) */
  motion: { source: string; checks: { id: string; detail: string }[] };
  timing: { clipS: number; previewS: number; contactS: number; motionS: number; totalS: number };
}

/** stills.json `inner`: the frames rendered again, each against the span's hash of that frame. */
export interface StillsInnerJson {
  rendering: string;
  frames: { i: number; sha256: string; expected: string; match: boolean; ms: number; file?: string }[];
  matched: number;
  mismatched: number;
}

export interface EncodeSpanOptions {
  /** the stills folder holding f<NNNNN>.png for every frame of the span */
  dir: string;
  root: string;
  first: number;
  /** the span's sha256 per frame, in order (sha256 of the delivered RGBA) */
  hashes: readonly string[];
  width: number;
  height: number;
  fps: number;
  profile: Profile;
  log?: Log;
  /** ms clock (tests) */
  now: () => number;
}

const secs = (ms: number) => Math.round(ms / 10) / 100;

/** --encode: span.mkv, span.mp4, contact.png and the motion QA files, in the stills folder. */
export async function encodeSpan(o: EncodeSpanOptions): Promise<StillsEncodeJson> {
  const frames = o.hashes.length;
  const at = (name: string) => join(o.dir, name);
  const t0 = o.now();

  const clip = at('span.mkv');
  const part = partPath(clip);
  rmSync(part, { force: true });
  await ffmpeg(spanMkvArgs({ width: o.width, height: o.height, fps: o.fps, dir: o.dir, first: o.first, frames, out: part }), 'span clip', { timeoutMs: 30 * 60_000 });
  await commitPart(part, clip, frames);
  // the clip must hold exactly the pixels the engine delivered (decoded as RGBA, alpha 255)
  const back = await allFrameHashes(clip, 'rgba');
  const bad = o.hashes.findIndex((h, k) => back[k] !== h);
  if (back.length !== frames || bad >= 0)
    throw new Error(`span.mkv decodes to other pixels than the engine delivered (${back.length} of ${frames} frames${bad >= 0 ? `, first difference at frame ${o.first + bad}` : ''})`);
  const t1 = o.now();

  const preview = await encodeDelivery({ video: clip, audio: null, out: at('span.mp4'), preset: o.profile.encode, fps: o.fps, frames, source: MEZZANINE_COLOR, log: o.log });
  const v = (await probe(preview.file)).video;
  const t2 = o.now();

  await contactSheet(clip, { frames, fps: o.fps, out: at('contact.png'), count: 12, cols: 4, tileWidth: Math.min(320, o.width), log: o.log });
  const t3 = o.now();

  const source = repoRel(clip, o.root);
  const m = await motionQa({ delivery: clip, source: clip, lossy: false, frames, width: o.width, height: o.height, fps: o.fps, cues: [], outDir: o.dir, sourceLabel: source, log: o.log });
  const t4 = o.now();

  const name = (f: string) => repoRel(f, o.dir);
  return {
    firstFrame: o.first,
    frames,
    fps: o.fps,
    files: { clip: 'span.mkv', preview: 'span.mp4', contact: 'contact.png', motionSheet: name(m.files.sheet), motionJson: name(m.files.json), strips: m.files.strips.map(name) },
    clip: { bytes: statSync(clip).size, decodedMatch: true },
    preview: { preset: o.profile.encode, encoder: preview.encoder, bytes: preview.bytes, pixFmt: v?.pixFmt ?? null, color: { space: v?.colorSpace ?? null, primaries: v?.colorPrimaries ?? null, transfer: v?.colorTransfer ?? null, range: v?.colorRange ?? null } },
    motion: { source, checks: m.checks.map((c) => ({ id: c.id, detail: c.detail })) },
    timing: { clipS: secs(t1 - t0), previewS: secs(t2 - t1), contactS: secs(t3 - t2), motionS: secs(t4 - t3), totalS: secs(t4 - t0) },
  };
}
