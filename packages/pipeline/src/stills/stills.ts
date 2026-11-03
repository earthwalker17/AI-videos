/**
 * Stills: chosen frames of a video as full-size PNGs, in their own folder
 * out/<slug>/stills/<label>/ (f<NNNNN>.png per frame + stills.json). Lookdev needs quick stills
 * at the real size; rendering them as `aiv render --frames` replaced that profile's run (on
 * the third film the review run became a 1-frame run). This never reads or writes
 * out/<slug>/render/**, except that --check reads one finished run.
 *
 * One engine session for all frames (one boot), but one renderFrames([i, i + 1]) call per
 * frame. What that call is depends on the engine (stillsRendering): the Remotion engine opens a
 * fresh page per call, so every still is a chunk start; the web engine renders every call on the
 * one page the session loaded, so each still follows the stills before it (out of the run's
 * order). Either way, that is the point of --check: frames.sha256 of a finished run holds most
 * frames rendered after the frames before them in the run; a still of the same frame must hash
 * the same (sha256 of the delivered RGBA, exactly as the runner hashes it), or the picture
 * depends on what was rendered before it (state carried between frames, a warm-up effect,
 * randomness): on Remotion, on where a chunk began. The default --check frames are frames that
 * are not chunk starts of that run (on Remotion, those were fresh pages there too).
 *
 * The input hash is the runner's (computeInputHash with the settings a full render of this
 * profile would have), so it compares with run.json / inputs.json; --check refuses a run whose
 * hash or render size differs, because its frame hashes then describe other pixels.
 *
 * --entry / --composition render another entry file / composition of the same video (lookdev
 * entries): the adapter gets a shallow copy of the target with those config fields replaced.
 * The engine still checks the composition against video.json's format; the input hash still
 * covers the video's src/, and its settings name the entry and composition actually rendered.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { EXIT, ExitError, exitOf, type ExitCode, type GitState, type Toolchain } from '@aiv/core';
import { onAbort } from '../host/abort.ts';
import { readLocalConfig } from '../host/localConfig.ts';
import { availableMB } from '../host/memory.ts';
import { ffmpeg } from '../media/bin.ts';
import { decodedFrameHashes } from '../qa/frames.ts';
import type { EngineAdapter, EngineInfo, EngineSession, FrameSpan } from '../runner/engine.ts';
import { computeInputHash, describeFileChanges, PictureInputs, renderSettings, type InputHash, type RenderSettings } from '../runner/inputHash.ts';
import { renderSize, type Profile } from '../runner/profiles.ts';
import { chunkList } from '../runner/runner.ts';
import type { Target } from '../runner/target.ts';
import { gitState } from '../util/git.ts';
import { sha256, sha256File } from '../util/hash.ts';
import { createLog, type Log } from '../util/log.ts';
import { outDir, partPath, repoRel, writeJson } from '../util/paths.ts';
import { toolchain } from '../util/toolchain.ts';
import { ANALYSIS_SIZE, compareSheet, compareStats, coverCrop, decodeRgb, imageSize, imageStats, METRICS, type ImageCrop, type ImageStats } from './compare.ts';

/** At most this many stills per call: stills are for looking at; a range is a render. */
export const MAX_STILLS = 120;
/** How many frames --check picks when --frames is not given. */
export const CHECK_FRAMES = 12;

const usage = (msg: string): never => {
  throw new ExitError(EXIT.USAGE, msg);
};

/**
 * "40,240,300-303" → [40, 240, 300, 301, 302, 303]: comma-separated frame indices and inclusive
 * ranges, sorted and deduplicated. Throws a usage error for anything else.
 */
export function parseFrameList(spec: string): number[] {
  const out = new Set<number>();
  for (const raw of spec.split(',')) {
    const part = raw.trim();
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) usage(`--frames takes frame indices and ranges like 40,240,300-303 (got '${part || spec}')`);
    const a = Number(m![1]);
    const b = m![2] === undefined ? a : Number(m![2]);
    if (b < a) usage(`--frames range ${part} runs backwards`);
    if (b - a + 1 + out.size > MAX_STILLS) usage(`--frames asks for more than ${MAX_STILLS} stills: stills are for looking at, render a range with aiv render`);
    for (let i = a; i <= b; i++) out.add(i);
  }
  return [...out].sort((x, y) => x - y);
}

/** How an engine renders a still, and so what a --check MISMATCH means (stillsRendering). */
export interface StillsRendering {
  /** every renderFrames call opens a fresh page: every still is a chunk start, as in a run */
  freshPage: boolean;
  /** stills.json `rendering` */
  rendering: string;
  /** why a --check MISMATCH happens */
  mismatch: string;
}

const HASHED = 'sha256 over the delivered RGBA as in frames.sha256';

/**
 * By engine name, because the adapter interface does not say it. Verified 2026-11-04: Remotion
 * 4.0.539's renderFrames makes its own page pool for each call and closes the pages it opened
 * (dist/render-frames.js), so a still there is a chunk start; the web adapter renders every call
 * on the page open() loaded (engines/web/src/harness/adapter.ts), so the first still is the
 * page's first frame and each later one follows the stills before it; a web run's chunk starts
 * are no fresh pages either (only its first frame and a resume are). Any other engine is
 * described by what holds for all: one session, the stills in the order given.
 */
export function stillsRendering(engine: string): StillsRendering {
  if (engine === 'remotion')
    return {
      freshPage: true,
      rendering: `one engine session; each still in its own renderFrames([i, i+1]) call, which opens a fresh page (Remotion), so each is a chunk start; ${HASHED}`,
      mismatch: 'those frames depend on where a chunk began (state carried between frames, a warm-up effect, randomness)',
    };
  if (engine === 'web')
    return {
      freshPage: false,
      rendering: `one engine session; each still in its own renderFrames([i, i+1]) call on the one page the session loaded, in the order given: the first right after the page loaded, each later one after the stills before it, out of the run's order (no chunk start); ${HASHED}`,
      mismatch: 'those frames depend on the frames rendered before them on the page (state carried between frames, a warm-up effect, randomness)',
    };
  return {
    freshPage: false,
    rendering: `one engine session; each still in its own renderFrames([i, i+1]) call, in the order given; ${HASHED}`,
    mismatch: 'those frames depend on what the engine rendered before them (state carried between frames, a warm-up effect, randomness)',
  };
}

/** The frames a run of `frames` with chunks of `chunkFrames` starts a chunk (and, on Remotion, a page) on. */
export function chunkStarts(frames: FrameSpan, chunkFrames: number): Set<number> {
  return new Set(chunkList(frames, chunkFrames).map((c) => c.k0));
}

/**
 * The frames --check renders by default: `count` frames spread evenly over the run (the
 * centres of `count` equal parts), each nudged off the run's chunk starts (+7 first, then the
 * nearest free frame), so every pick was rendered mid-chunk there. Fewer when the run is short.
 */
export function defaultCheckFrames(frames: FrameSpan, chunkFrames: number, count: number = CHECK_FRAMES): number[] {
  const [a, b] = frames;
  const starts = chunkStarts(frames, chunkFrames);
  const picked = new Set<number>();
  const offsets = [0, 7, -7, ...Array.from({ length: chunkFrames }, (_, d) => [d + 1, -(d + 1)]).flat()];
  for (let k = 0; k < count; k++) {
    const base = a + Math.floor(((k + 0.5) * (b - a)) / count);
    const f = offsets.map((d) => base + d).find((x) => x >= a && x < b && !starts.has(x) && !picked.has(x));
    if (f !== undefined) picked.add(f);
  }
  return [...picked].sort((x, y) => x - y);
}

/** frames.sha256 ("<frame> <sha256>" per line) as frame → sha256. Throws on a malformed line. */
export function parseFrameHashes(text: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const [n, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const m = /^(\d+) ([0-9a-f]{64})$/.exec(line.trim());
    if (!m) throw new Error(`frames.sha256 line ${n + 1} is not '<frame> <sha256>': ${line.slice(0, 80)}`);
    out.set(Number(m[1]), m[2]);
  }
  return out;
}

export interface HashCheck {
  i: number;
  sha256: string;
  /** the run's hash for that frame, null when the run has none */
  expected: string | null;
  match: boolean;
}

/** Each still's sha256 against the run's line for that frame. */
export function compareFrameHashes(stills: readonly { i: number; sha256: string }[], expected: ReadonlyMap<number, string>): HashCheck[] {
  return stills.map((s) => {
    const e = expected.get(s.i) ?? null;
    return { i: s.i, sha256: s.sha256, expected: e, match: e === s.sha256 };
  });
}

/** The fields of a run.json that --check reads. */
export interface CheckRunJson {
  inputHash: string;
  settings: RenderSettings;
  frames: [number, number];
  durationFrames: number;
  info: EngineInfo;
}

/**
 * Why a finished run's frame hashes cannot be compared with stills of this tree (empty = they
 * can): another render size, other settings, or other input files (named from its inputs.json).
 */
export function checkRefusals(run: CheckRunJson, size: { width: number; height: number }, ih: Pick<InputHash, 'hash' | 'header' | 'inputs'>, settings: RenderSettings, inputs: PictureInputs | null): string[] {
  const out: string[] = [];
  if (run.settings.width !== size.width || run.settings.height !== size.height) out.push(`its render size is ${run.settings.width}x${run.settings.height}, these stills are ${size.width}x${size.height}`);
  if (run.inputHash === ih.hash) return out;
  out.push(`its input hash ${run.inputHash.slice(0, 12)} differs from this tree's ${ih.hash.slice(0, 12)}`);
  const a = run.settings as unknown as Record<string, unknown>;
  const b = settings as unknown as Record<string, unknown>;
  const changed = Object.keys({ ...a, ...b }).filter((k) => k !== 'width' && k !== 'height' && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (changed.length) out.push(`settings differ: ${changed.map((k) => `${k} ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`).join(', ')}`);
  if (inputs) {
    const line = (h: readonly string[], key: string) => h.find((l) => l.startsWith(`${key} `));
    if (line(inputs.header, 'adapter') !== line(ih.header, 'adapter')) out.push(`engine adapter ${line(inputs.header, 'adapter')?.slice(8)} → ${line(ih.header, 'adapter')?.slice(8)}`);
    if (line(inputs.header, 'lock') !== line(ih.header, 'lock')) out.push('pnpm-lock.yaml changed');
    const files = describeFileChanges(inputs.files, ih.inputs, 8);
    if (files) out.push(`input files since that run: ${files}`);
  }
  return out;
}

/** out/<slug>/stills/<label> (absolute): beside the profile render folders, never inside one. */
export const stillsDir = (slug: string, label: string, root: string): string => join(root, 'out', slug, 'stills', label);
const pad5 = (i: number) => String(i).padStart(5, '0');
export const stillName = (i: number): string => `f${pad5(i)}.png`;
export const compareName = (i: number): string => `compare-${pad5(i)}.png`;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The target with another entry file and/or composition (lookdev entries). The entry must be a
 * path inside the video folder. A different composition is not the film, so video.json's
 * qa.swatchFrames (the leader's swatch strip that QA measures) is dropped from the copy: the
 * engine would otherwise refuse a lookdev composition that does not draw the strip there.
 */
export function withEntry(target: Target, entry?: string, composition?: string): Target {
  if (entry === undefined && composition === undefined) return target;
  const config = { ...target.config };
  if (entry !== undefined) {
    const e = entry.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!e || isAbsolute(entry) || /^[a-z]:/i.test(e) || e.split('/').some((s) => s === '' || s === '.' || s === '..'))
      usage(`--entry takes a path inside the video folder, e.g. src/lookdev/trees.tsx (got '${entry}')`);
    if (!existsSync(join(target.dir, ...e.split('/')))) usage(`--entry: ${target.relDir}/${e} does not exist`);
    config.entry = e;
  }
  if (composition !== undefined) {
    if (!/^[^\s/\\]{1,64}$/.test(composition)) usage(`--composition takes a composition id (got '${composition}')`);
    config.composition = composition;
  }
  const same = config.entry === target.config.entry && (config.composition ?? null) === (target.config.composition ?? null);
  if (same) return target;
  if (config.qa?.swatchFrames) {
    const { swatchFrames: _drop, ...qa } = config.qa;
    config.qa = qa;
  }
  return { ...target, config };
}

export interface StillsOptions {
  adapter: EngineAdapter;
  target: Target;
  profile: Profile;
  /** composition frames (sorted, unique); may be omitted with `check` (default check frames) */
  frames?: readonly number[];
  /** the folder under out/<slug>/stills/ (default: the profile name) */
  label?: string;
  /** another entry file of the video (repo convention: a path inside the video folder) */
  entry?: string;
  /** another composition id */
  composition?: string;
  /** absolute path of a reference image to compare every still with */
  ref?: string;
  /** compare each still's sha256 with this profile's finished run (must be `profile`) */
  check?: Profile;
  /** stop (exit 3) below this much free RAM, MB (default aiv.local.json abortFreeMB or 500) */
  abortFreeMB?: number;
  log?: Log;
  /** ms clock (tests) */
  clock?: () => number;
}

export interface StillCompareJson {
  file: string;
  valueGridMAE: number;
  paletteDeltaE: number;
  palette: { hex: string; share: number }[];
  /** for each still colour (in palette order), the reference colour it was matched with and their ΔE00 */
  matched: { hex: string; refHex: string; deltaE: number }[];
  valueGrid: number[];
}

export interface StillFrameJson {
  i: number;
  sha256: string;
  /** the engine's render time of the frame, or without one (Remotion) the wall time from asking for it to receiving it, its fresh page included, ms */
  ms: number;
  file: string;
  compare?: StillCompareJson;
  check?: { expected: string | null; match: boolean; chunkStartInRun: boolean };
}

export interface StillsJson {
  schemaVersion: 1;
  slug: string;
  profile: string;
  label: string;
  entry: string;
  composition: string | null;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  inputHash: string;
  engine: { name: string; version: string; adapterVersion: string; settings: Record<string, string> };
  info: EngineInfo;
  toolchain: Toolchain;
  git: GitState;
  rendering: string;
  timing: { bootS: number; wallS: number };
  frames: StillFrameJson[];
  reference?: {
    file: string;
    sha256: string;
    width: number;
    height: number;
    crop: ImageCrop;
    palette: { hex: string; share: number }[];
    valueGrid: number[];
    metrics: typeof METRICS;
  };
  check?: { profile: string; run: string; inputHash: string; frames: [number, number]; matched: number; mismatched: number };
  createdAt: string;
}

export interface StillsOutcome {
  exit: ExitCode;
  message: string;
  dir: string;
  json?: StillsJson;
}

interface CheckRun {
  dir: string;
  run: CheckRunJson;
  inputs: PictureInputs | null;
  hashes: Map<number, string>;
}

function readCheckRun(target: Target, profile: Profile): CheckRun {
  const dir = outDir(target.slug, 'render', profile.name, target.root);
  const rel = repoRel(dir, target.root);
  const runFile = join(dir, 'run.json');
  const hashFile = join(dir, 'frames.sha256');
  const again = `render it first: pnpm aiv render ${target.spec} --profile ${profile.name}`;
  if (!existsSync(runFile)) throw new ExitError(EXIT.REFUSED, `--check ${profile.name}: there is no run in ${rel} (${again})`);
  if (!existsSync(hashFile)) throw new ExitError(EXIT.REFUSED, `--check ${profile.name}: the run in ${rel} is not finished (no frames.sha256; ${again})`);
  let run: CheckRunJson;
  try {
    run = JSON.parse(readFileSync(runFile, 'utf8')) as CheckRunJson;
  } catch (e) {
    throw new ExitError(EXIT.REFUSED, `--check ${profile.name}: ${rel}/run.json is unreadable (${(e as Error).message})`);
  }
  if (!run?.settings || !Array.isArray(run.frames) || typeof run.inputHash !== 'string') throw new ExitError(EXIT.REFUSED, `--check ${profile.name}: ${rel}/run.json was written by an older runner`);
  const inputsFile = join(dir, 'inputs.json');
  let inputs: PictureInputs | null = null;
  if (existsSync(inputsFile)) {
    const p = PictureInputs.safeParse(JSON.parse(readFileSync(inputsFile, 'utf8')));
    inputs = p.success && p.data.inputHash === run.inputHash ? p.data : null;
  }
  return { dir, run, inputs, hashes: parseFrameHashes(readFileSync(hashFile, 'utf8')) };
}

/** The display host of a session, as the runner compares it on resume. */
const hostKey = (info: EngineInfo) => JSON.stringify({ browser: info.browser ?? null, gpu: info.gpu ?? null, driver: info.driver ?? null });

/** f*.png, compare-*.png and stills.json of an earlier call (nothing else in the folder). */
function wipeStills(dir: string): void {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) if (/^(f\d+|compare-\d+)(\.part)?\.png$/.test(f) || f === 'stills.json') rmSync(join(dir, f), { force: true });
}

/** RGBA from the engine → an RGB PNG (alpha is opaque by the engine contract), written atomically. */
async function writePng(rgba: Uint8Array, width: number, height: number, file: string): Promise<void> {
  const part = partPath(file);
  rmSync(part, { force: true });
  await ffmpeg(['-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-i', '-', '-frames:v', '1', '-pix_fmt', 'rgb24', '-update', '1', part], 'still PNG', { timeoutMs: 120_000, input: rgba });
  renameSync(part, file);
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const relOrName = (file: string, root: string) => {
  try {
    return repoRel(file, root);
  } catch {
    // outside the repository: no personal paths in output files
    return basename(file);
  }
};

export async function runStills(o: StillsOptions): Promise<StillsOutcome> {
  const root = o.target.root;
  const log = o.log ?? createLog('still');
  const now = o.clock ?? Date.now;
  const t0 = now();
  const label = o.label ?? o.profile.name;
  const dir = stillsDir(o.target.slug, label, root);
  const outcome = (exit: ExitCode, message: string, json?: StillsJson): StillsOutcome => ({ exit, message, dir, json });
  let session: EngineSession | null = null;
  let createdDir = false;
  const unregister = onAbort(async () => {
    await session?.close();
  });
  try {
    if (!LABEL.test(label)) usage(`--label is a folder name of letters, digits, '.', '_' and '-' (got '${label}')`);
    const target = withEntry(o.target, o.entry, o.composition);
    const size = renderSize(target.config.format, o.profile);
    const fps = target.config.format.fps;
    const settings = renderSettings(target, o.profile, size, undefined, o.adapter.settings);
    const ih = computeInputHash({ target, adapter: o.adapter, settings });
    const how = stillsRendering(o.adapter.name);

    // --check: the run is read and judged before the engine boots
    if (o.check && o.check.name !== o.profile.name) usage(`--check ${o.check.name} compares with that profile's run: render the stills with --profile ${o.check.name} (or leave --profile out)`);
    const check: CheckRun | null = o.check ? readCheckRun(o.target, o.check) : null;
    if (o.check && check) {
      // a partial run (aiv render --frames) hashed its range into the settings: compare like for like
      const range = check.run.settings.range;
      const cmpSettings = range ? renderSettings(target, o.profile, size, range, o.adapter.settings) : settings;
      const cmp = range ? computeInputHash({ target, adapter: o.adapter, settings: cmpSettings }) : ih;
      const reasons = checkRefusals(check.run, size, cmp, cmpSettings, check.inputs);
      if (reasons.length)
        return outcome(
          EXIT.REFUSED,
          `refused: the ${o.check.name} run in ${repoRel(check.dir, root)} was rendered from other inputs, so its frame hashes describe other pixels: ${reasons.join('; ')}. Re-render it from this tree (pnpm aiv render ${o.target.spec} --profile ${o.check.name} --force), then check again.`,
        );
    }
    const frames = o.frames?.length ? [...o.frames] : check ? defaultCheckFrames(check.run.frames, check.run.settings.chunkFrames) : usage('--frames is required (without --check)');
    if (!frames.length) usage(`the ${o.check!.name} run (frames ${check!.run.frames[0]}-${check!.run.frames[1] - 1}) has no frame that is not a chunk start: name the frames with --frames`);
    let runStarts = new Set<number>();
    if (check) {
      const missing = frames.filter((i) => !check.hashes.has(i));
      if (missing.length) usage(`frames ${missing.join(', ')} are not in the ${check.run.settings.profile} run (frames ${check.run.frames[0]}-${check.run.frames[1] - 1})`);
      runStarts = chunkStarts(check.run.frames, check.run.settings.chunkFrames);
      // only where a chunk start is a fresh page does a still there test nothing
      const starts = how.freshPage ? frames.filter((i) => runStarts.has(i)) : [];
      if (starts.length) log.warn(`frames ${starts.join(', ')} are chunk starts in that run too: a MATCH there says nothing about chunk-start determinism`);
    }
    if (o.ref && !existsSync(o.ref)) usage(`--ref: ${o.ref} does not exist`);
    const abortFreeMB = o.abortFreeMB ?? readLocalConfig(root).abortFreeMB ?? 500;
    const mem0 = await availableMB();
    if (mem0 < abortFreeMB) return outcome(EXIT.LOW_MEMORY, `host memory low (${mem0} MB available < ${abortFreeMB} MB): nothing rendered, run again when memory is back`);

    // engines may keep files in their run folder; a failed start removes the folder it created
    createdDir = !existsSync(dir);
    mkdirSync(dir, { recursive: true });
    const tOpen = now();
    session = await o.adapter.open({ target, profile: o.profile, width: size.width, height: size.height, fps, runDir: dir, root, inputRoots: ih.roots, log });
    const bootS = (now() - tOpen) / 1000;
    const s = session;
    if (!s.renderFrames) throw new Error(`engine ${o.adapter.name} writes chunk files only: stills need a streaming engine (renderFrames)`);
    const outside = frames.filter((i) => i >= s.durationFrames);
    if (outside.length) usage(`frames ${outside.join(', ')} are outside the composition's ${s.durationFrames} frames (0-${s.durationFrames - 1})`);
    if (check && hostKey(check.run.info) !== hostKey(s.info))
      log.warn(`the engine host differs from that run's (${hostKey(check.run.info)} → ${hostKey(s.info)}): a MISMATCH may come from the host, not from what was rendered before the frame`);
    // the folder holds one call's stills: the earlier ones go once the engine is open
    wipeStills(dir);

    let ref: { stats: ImageStats; crop: ImageCrop; size: { width: number; height: number }; name: string } | null = null;
    if (o.ref) {
      const rs = await imageSize(o.ref);
      const crop = coverCrop(rs.width, rs.height, size.width, size.height);
      const stats = imageStats(await decodeRgb(o.ref, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height, crop));
      ref = { stats, crop, size: rs, name: basename(o.ref) };
      log.info(`reference ${relOrName(o.ref, root)} ${rs.width}x${rs.height}, centre crop ${crop.w}x${crop.h}: palette ${stats.palette.map((c) => c.hex).join(' ')}`);
    }

    const results: StillFrameJson[] = [];
    for (const i of frames) {
      const mb = await availableMB();
      if (mb < abortFreeMB) return outcome(EXIT.LOW_MEMORY, `host memory low (${mb} MB available < ${abortFreeMB} MB) before frame ${i}: ${results.length}/${frames.length} stills written (no stills.json), run again when memory is back`);
      const name = stillName(i);
      const file = join(dir, name);
      const got: { sha256?: string; ms?: number } = {};
      const ft0 = now();
      await s.renderFrames([i, i + 1], async (k, rgba, meta) => {
        if (k !== i) throw new Error(`engine delivered frame ${k}, expected ${i}`);
        if (got.sha256) throw new Error(`engine delivered frame ${i} twice`);
        // exactly the runner's frame hash: sha256 of the delivered RGBA bytes
        got.sha256 = sha256(rgba);
        got.ms = Math.round(meta?.ms ?? now() - ft0);
        await writePng(rgba, size.width, size.height, file);
      });
      if (!got.sha256) throw new Error(`engine delivered no frame for ${i}`);
      // the PNG must hold exactly the hashed pixels (decoded as RGBA, alpha 255)
      const [back] = await decodedFrameHashes(file, [0], 'rgba');
      if (back?.sha256 !== got.sha256) throw new Error(`${name} decodes to other pixels (${back?.sha256.slice(0, 12)}) than the engine delivered (${got.sha256.slice(0, 12)})`);
      const entry: StillFrameJson = { i, sha256: got.sha256, ms: got.ms ?? 0, file: name };
      const parts = [`frame ${i}`, `${entry.ms} ms`, `sha256 ${entry.sha256.slice(0, 12)}`, name];
      if (ref && o.ref) {
        const stats = imageStats(await decodeRgb(file, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height));
        const c = compareStats(stats, ref.stats);
        const sheet = compareName(i);
        const variant = target === o.target ? '' : `  ${target.config.entry}${target.config.composition ? ` ${target.config.composition}` : ''}`;
        await compareSheet({
          still: file,
          ref: o.ref,
          crop: ref.crop,
          stillStats: stats,
          refStats: ref.stats,
          comparison: c,
          stillLabel: `still frame ${i}  (${size.width}x${size.height} ${o.profile.name}${variant})`,
          refLabel: `reference ${ref.name}  (centre crop)`,
          out: join(dir, sheet),
          log,
        });
        entry.compare = {
          file: sheet,
          valueGridMAE: round(c.valueGridMAE, 5),
          paletteDeltaE: round(c.paletteDeltaE, 3),
          palette: stats.palette.map((p) => ({ hex: p.hex, share: round(p.share, 4) })),
          matched: c.match.pairs.map((p) => ({ hex: stats.palette[p.a].hex, refHex: ref!.stats.palette[p.b].hex, deltaE: round(p.deltaE, 3) })),
          valueGrid: stats.grid.map((v) => round(v, 4)),
        };
        parts.push(`valueGridMAE ${c.valueGridMAE.toFixed(4)}`, `paletteDeltaE ${c.paletteDeltaE.toFixed(2)}`, `palette ${stats.palette.map((p) => p.hex).join(' ')}`, sheet);
      }
      if (check) {
        const [h] = compareFrameHashes([entry], check.hashes);
        entry.check = { expected: h.expected, match: h.match, chunkStartInRun: runStarts.has(i) };
        parts.push(h.match ? 'MATCH' : `MISMATCH (run ${h.expected?.slice(0, 12) ?? 'none'})`);
      }
      log.info(parts.join(' · '));
      results.push(entry);
    }
    await s.close();
    session = null;

    const [git, tc, refSha] = await Promise.all([gitState(root, [...ih.roots, 'pnpm-lock.yaml']), toolchain({ browser: s.info.browser, gpu: s.info.gpu }), ref && o.ref ? sha256File(o.ref) : Promise.resolve('')]);
    const mismatched = results.filter((r) => r.check && !r.check.match).length;
    const json: StillsJson = {
      schemaVersion: 1,
      slug: o.target.slug,
      profile: o.profile.name,
      label,
      entry: target.config.entry,
      composition: target.config.composition ?? null,
      width: size.width,
      height: size.height,
      fps,
      durationFrames: s.durationFrames,
      inputHash: ih.hash,
      engine: { name: o.adapter.name, version: o.adapter.version, adapterVersion: o.adapter.adapterVersion, settings: { ...(o.adapter.settings ?? {}) } },
      info: s.info,
      toolchain: tc,
      git,
      rendering: how.rendering,
      timing: { bootS: round(bootS, 2), wallS: round((now() - t0) / 1000, 2) },
      frames: results,
      ...(ref && o.ref
        ? {
            reference: {
              file: relOrName(o.ref, root),
              sha256: refSha,
              width: ref.size.width,
              height: ref.size.height,
              crop: ref.crop,
              palette: ref.stats.palette.map((p) => ({ hex: p.hex, share: round(p.share, 4) })),
              valueGrid: ref.stats.grid.map((v) => round(v, 4)),
              metrics: METRICS,
            },
          }
        : {}),
      ...(check ? { check: { profile: check.run.settings.profile, run: repoRel(check.dir, root), inputHash: check.run.inputHash, frames: check.run.frames, matched: results.length - mismatched, mismatched } } : {}),
      createdAt: new Date().toISOString(),
    };
    writeJson(join(dir, 'stills.json'), json);
    const perFrame = results.reduce((a, r) => a + r.ms, 0) / results.length / 1000;
    const head = `${results.length} stills ${size.width}x${size.height} in ${repoRel(dir, root)} · boot ${bootS.toFixed(1)} s, ${perFrame.toFixed(1)} s/still · input hash ${ih.hash.slice(0, 12)}`;
    const refPart = ref ? ` · mean valueGridMAE ${(results.reduce((a, r) => a + r.compare!.valueGridMAE, 0) / results.length).toFixed(4)}, mean paletteDeltaE ${(results.reduce((a, r) => a + r.compare!.paletteDeltaE, 0) / results.length).toFixed(2)} (reported, not gating)` : '';
    if (!check) return outcome(EXIT.OK, head + refPart, json);
    const verdict = mismatched
      ? `check vs ${check.run.settings.profile}: ${mismatched} of ${results.length} MISMATCH (frames ${results.filter((r) => r.check && !r.check.match).map((r) => r.i).join(', ')}): ${how.mismatch}`
      : `check vs ${check.run.settings.profile}: all ${results.length} MATCH`;
    return outcome(mismatched ? EXIT.ERROR : EXIT.OK, `${head}${refPart} · ${verdict}`, json);
  } catch (e) {
    const exit = exitOf(e);
    const msg = e instanceof Error ? e.message : String(e);
    return outcome(exit, exit === EXIT.ERROR ? `stills failed: ${msg}` : msg);
  } finally {
    unregister();
    if (session) await session.close().catch(() => {});
    // a call that wrote nothing leaves no empty folder behind (a refused composition, a crash at boot)
    if (createdDir && existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  }
}
