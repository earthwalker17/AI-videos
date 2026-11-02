/**
 * Rendering a score: the context its tracks get, the fixed order they run in, the length and
 * value checks on what they return, and the WAV each becomes. Runs inside the stage's child
 * process (child.ts), so it is the code the audio input hash covers: no clocks, no unseeded
 * randomness, no reads besides the cue sheet, the score's own modules and verified library files.
 *
 * Every track file is the whole composition: frameToSample(leaderFrames) samples of silence
 * under the test-card leader, then the film, so post can mix it at offset 0 and the delivery
 * has exactly round(durationFrames · 48000 / fps) samples.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AUDIO_NAME, CueSheet, hashString } from '@aiv/core';
import { z } from 'zod';
import { openLibrary } from './library.ts';
import { SAMPLE_RATE, type AudioJob, type AudioReport, type Library, type Score, type ScoreContext, type Stereo } from './types.ts';
import { encodeWav } from './wav.ts';

/** The first sample of frame `frame` at `fps` (any frame count, film or composition). */
export const frameSample = (frame: number, fps: number): number => Math.round((frame * SAMPLE_RATE) / fps);

/**
 * Leader and film lengths in samples. The film is the rest of the composition after the
 * leader, so leader + film is always round(compositionFrames · 48000 / fps), the length post
 * requires, even at a rate whose frames are not a whole number of samples.
 */
export function sampleLengths(sheet: Pick<CueSheet, 'fps' | 'leaderFrames' | 'filmFrames'>): { leaderSamples: number; filmSamples: number } {
  const leaderSamples = frameSample(sheet.leaderFrames, sheet.fps);
  return { leaderSamples, filmSamples: frameSample(sheet.leaderFrames + sheet.filmFrames, sheet.fps) - leaderSamples };
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

/** The context every track gets. The sheet is frozen: one track cannot change another's cues. */
export function scoreContext(o: { sheet: CueSheet; slug: string; library: (id: string) => Library }): ScoreContext {
  const sheet = deepFreeze(structuredClone(o.sheet));
  const fps = sheet.fps;
  return Object.freeze({
    sampleRate: SAMPLE_RATE,
    cues: sheet,
    fps,
    filmSamples: sampleLengths(sheet).filmSamples,
    frameToSample: (filmFrame: number) => {
      if (!Number.isFinite(filmFrame)) throw new Error(`frameToSample(${filmFrame}): expected a finite frame`);
      return frameSample(filmFrame, fps);
    },
    library: o.library,
    seed: hashString(o.slug),
  });
}

/** Why a value is not a Stereo of `n` finite samples per channel, or null when it is one. */
function stereoProblem(v: unknown, n: number): string | null {
  if (!Array.isArray(v) || v.length !== 2) return 'expected [left, right] (two Float32Arrays)';
  for (const [k, c] of (v as unknown[]).entries()) {
    const side = k === 0 ? 'left' : 'right';
    if (!(c instanceof Float32Array)) return `${side} is not a Float32Array`;
    if (c.length !== n) return `${side} has ${c.length} samples, expected ctx.filmSamples = ${n}`;
    for (let i = 0; i < n; i++) if (!Number.isFinite(c[i])) return `${side}[${i}] is ${c[i]} (every sample must be finite)`;
  }
  return null;
}

/** A score module's default export, checked: an object with named track functions. */
export function checkScore(v: unknown): Score {
  const tracks = (v as { tracks?: unknown } | null)?.tracks;
  if (!tracks || typeof tracks !== 'object') throw new Error('audio/index.ts must default-export defineScore({ tracks: { <name>: (ctx) => [left, right] } })');
  const names = Object.keys(tracks);
  if (!names.length) throw new Error('the score has no tracks');
  for (const name of names) {
    if (!AUDIO_NAME.test(name)) throw new Error(`track name '${name}' is not lowercase-kebab ASCII`);
    if (typeof (tracks as Record<string, unknown>)[name] !== 'function') throw new Error(`track '${name}' is not a function`);
  }
  return v as Score;
}

/**
 * Run every track in name order (one at a time: a track's memory is free before the next
 * starts), check its length and values, prepend the leader's silence and write <name>.wav as
 * float 32 into outDir.
 */
export async function renderScore(score: Score, ctx: ScoreContext, leaderSamples: number, outDir: string): Promise<{ name: string; samples: number }[]> {
  const out: { name: string; samples: number }[] = [];
  for (const name of Object.keys(score.tracks).sort()) {
    let st: Stereo;
    try {
      st = await score.tracks[name](ctx);
    } catch (e) {
      throw new Error(`track '${name}' failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`, { cause: e });
    }
    const bad = stereoProblem(st, ctx.filmSamples);
    if (bad) throw new Error(`track '${name}': ${bad}`);
    const total = leaderSamples + ctx.filmSamples;
    const channels = st.map((c) => {
      const full = new Float32Array(total);
      full.set(c, leaderSamples);
      return full;
    });
    writeFileSync(join(outDir, `${name}.wav`), encodeWav(channels, SAMPLE_RATE, 'f32'));
    out.push({ name, samples: total });
  }
  return out;
}

/** Everything the child does besides module tracking: cues, score, libraries, tracks. */
export async function runJob(job: AudioJob): Promise<Omit<AudioReport, 'modules' | 'ok'>> {
  const cuesModule = (await import(pathToFileURL(job.cuesFile).href)) as { cues?: unknown };
  if (cuesModule.cues === undefined) throw new Error('src/cues.ts must export `cues` (a CueSheet)');
  const parsed = CueSheet.safeParse(cuesModule.cues);
  if (!parsed.success) throw new Error(`src/cues.ts: the cue sheet does not match its contract:\n${z.prettifyError(parsed.error)}`);
  const sheet = parsed.data;
  if (sheet.fps !== job.fps) throw new Error(`src/cues.ts has fps ${sheet.fps}, video.json format.fps is ${job.fps}: they must agree`);
  const score = checkScore(((await import(pathToFileURL(job.scoreFile).href)) as { default?: unknown }).default);

  const open = new Map<string, ReturnType<typeof openLibrary>>();
  const library = (id: string): Library => {
    let lib = open.get(id);
    if (!lib) {
      const entry = job.libraries?.libraries.find((l) => l.id === id);
      if (!entry) throw new Error(`library '${id}' is not in audio/library.json: add { "id": "${id}", "repo", "commit", "license", "files": [] } and run aiv audio ${job.slug} --pin`);
      lib = openLibrary({ root: job.root, slug: job.slug, entry, pin: job.pin, seed: job.seeds[id] });
      open.set(id, lib);
    }
    return lib;
  };
  const ctx = scoreContext({ sheet, slug: job.slug, library });
  const tracks = await renderScore(score, ctx, sampleLengths(sheet).leaderSamples, job.outDir);
  const reads = [...open.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map((l) => ({ id: l.id, commit: l.commit, files: l.reads() }));
  return { sheet, tracks, reads };
}
