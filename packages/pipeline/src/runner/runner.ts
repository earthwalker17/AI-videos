// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/film.ts
/**
 * The chunked, resumable render runner shared by every engine.
 *
 * A run lives in out/<slug>/render/<profile>/:
 *   run.json                frozen at the start: input hash, settings, frame range, engine info
 *   partial/cNNNN.<ext>     the chunk being encoded (never trusted)
 *   chunks/cNNNN.<ext>      moved here only after ffprobe confirms its frame count
 *   chunks/cNNNN.json       per frame {i, sha256, ms}, written atomically after the move (= chunk done)
 *   mezzanine.<ext>         concat (stream copy) of all chunks, frame count verified, and a
 *                           sample of its decoded frames (each chunk's first, the last) checked
 *                           against the frame hashes
 *   frames.sha256           "<frame> <sha256>" per line
 *   render.json             the engine-boundary contract (RenderResult)
 *   inputs.json             the input hash's lines and per-file hashes (PictureInputs): post reads
 *                           the cue sheet the picture saw, release recomputes the hash
 *
 * Chunk i holds frames [i·chunkFrames, (i+1)·chunkFrames) ∩ the range. A call renders chunks
 * until done (exit 0) or until the next chunk's estimate would not fit the per-call budget
 * (exit 75: call again; finished chunks are kept). Resume REFUSES (exit 2) when the input hash,
 * the settings, the frame range or the engine's browser/GPU differ from run.json. `force`
 * replaces such a run instead (an unchanged run just resumes, so a budgeted call with --force
 * still makes progress when repeated); `fresh` always starts over (determinism checks). The
 * old run is deleted only once the engine opened, so a failed start never costs a finished
 * render. Low memory mid-chunk stops with exit 3.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, ExitError, exitOf, parseContract, RenderResult, type ColorInfo, type ExitCode } from '@aiv/core';
import { onAbort } from '../host/abort.ts';
import { keepAwake as holdAwake } from '../host/keepAwake.ts';
import { readLocalConfig } from '../host/localConfig.ts';
import { availableMB } from '../host/memory.ts';
import { ChunkEncoder, commitPart, concatCopy } from '../media/encoder.ts';
import { MEZZANINE_COLOR } from '../media/presets.ts';
import { countFrames, probe } from '../media/probe.ts';
import { allFrameHashes, decodedFrameHashes } from '../qa/frames.ts';
import { gitState } from '../util/git.ts';
import { sha256, sha256File } from '../util/hash.ts';
import { createLog, type Log } from '../util/log.ts';
import { outDir, partPath, repoRel, writeFileAtomic, writeJson } from '../util/paths.ts';
import { toolchain } from '../util/toolchain.ts';
import type { EngineAdapter, EngineInfo, EngineSession, FrameSpan } from './engine.ts';
import { computeInputHash, pictureInputsOf, renderSettings, type InputHash, type RenderSettings } from './inputHash.ts';
import { renderSize, type Profile } from './profiles.ts';
import type { Target } from './target.ts';

export interface RunOptions {
  adapter: EngineAdapter;
  target: Target;
  profile: Profile;
  /** run folder (default out/<slug>/render/<profile>) */
  dir?: string;
  /** render only [start, end) (default: the whole composition) */
  range?: FrameSpan;
  /** seconds per call, boot included; 0 = no budget (default 0) */
  budgetS?: number;
  /** a chunk still running this long past the budget is discarded (default 50 s) */
  overrunS?: number;
  /** replace an existing run whose inputs, settings, frames or engine host differ (an unchanged one resumes) */
  force?: boolean;
  /** always discard an existing run and start over (determinism checks) */
  fresh?: boolean;
  /** stop (exit 3) below this much free RAM, MB (default aiv.local.json abortFreeMB or 500) */
  abortFreeMB?: number;
  /** stop before a chunk with less free disk than this, MB (default 2048) */
  minDiskMB?: number;
  /** keep chunk media after assembly (default false: the mezzanine holds the same frames) */
  keepChunks?: boolean;
  /** hold a keep-awake request while rendering (default true) */
  keepAwake?: boolean;
  /** seconds per frame assumed before anything was measured (default 1) */
  defaultFrameS?: number;
  log?: Log;
  /** ms clock (tests) */
  clock?: () => number;
}

export interface RunOutcome {
  exit: ExitCode;
  message: string;
  dir: string;
  chunksDone: number;
  chunksTotal: number;
  renderJson?: RenderResult;
  renderJsonPath?: string;
}

interface RunJson {
  schemaVersion: 1;
  createdAt: string;
  inputHash: string;
  settings: RenderSettings;
  engine: { name: string; version: string; adapterVersion: string };
  frames: [number, number];
  /** the composition's length when the run started */
  durationFrames: number;
  info: EngineInfo;
  output: { style: 'stream' | 'file'; ext: string; color: ColorInfo };
}

interface ChunkJson {
  chunk: number;
  range: [number, number];
  file: string;
  bytes: number;
  wallS: number;
  renderedAt: string;
  /** where the frame hashes came from: the streamed RGBA, a decode of the chunk, or the engine */
  hashes?: 'stream' | 'decoded' | 'engine';
  frames: { i: number; sha256: string; ms: number }[];
}

interface Chunk {
  i: number;
  k0: number;
  k1: number;
}

const ESTIMATE_SAFETY = 1.25;
const pad = (i: number) => String(i).padStart(4, '0');
/** A JSON file, or null when it is missing or unreadable (a crash mid-write must not wedge the run). */
const readJson = <T>(file: string): T | null => {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
  } catch {
    return null;
  }
};
const FORMAT_OF: Record<string, string> = { '.mkv': 'matroska', '.mov': 'mov', '.mp4': 'mp4' };

export function chunkList(frames: readonly [number, number], chunkFrames: number): Chunk[] {
  const out: Chunk[] = [];
  const [a, b] = frames;
  for (let i = Math.floor(a / chunkFrames); i * chunkFrames < b; i++) out.push({ i, k0: Math.max(a, i * chunkFrames), k1: Math.min(b, (i + 1) * chunkFrames) });
  return out;
}

function chunkFiles(dir: string, run: RunJson, c: Chunk) {
  return { media: join(dir, 'chunks', `c${pad(c.i)}${run.output.ext}`), json: join(dir, 'chunks', `c${pad(c.i)}.json`), part: join(dir, 'partial', `c${pad(c.i)}${run.output.ext}`) };
}

function chunkDone(dir: string, run: RunJson, c: Chunk): ChunkJson | null {
  const f = chunkFiles(dir, run, c);
  if (!existsSync(f.media)) return null;
  const j = readJson<ChunkJson>(f.json);
  const ok = j && Array.isArray(j.frames) && j.range?.[0] === c.k0 && j.range[1] === c.k1 && j.frames.length === c.k1 - c.k0 && j.frames[0]?.i === c.k0 && j.frames.at(-1)?.i === c.k1 - 1;
  return ok ? j : null;
}

// the display driver counts too: a driver update can change pixels between chunks
const infoKey = (info: EngineInfo) => JSON.stringify({ browser: info.browser ?? null, gpu: info.gpu ?? null, driver: info.driver ?? null });

/** Why an existing run cannot be resumed with these inputs (empty = it can). */
function runDiffs(run: RunJson, hash: string, settings: RenderSettings, adapter: EngineAdapter): string[] {
  const diffs: string[] = [];
  if (!Number.isInteger(run.durationFrames) || !run.output) diffs.push('run.json was written by an older runner');
  if (run.engine.name !== adapter.name || run.engine.adapterVersion !== adapter.adapterVersion)
    diffs.push(`engine ${run.engine.name}@${run.engine.adapterVersion} → ${adapter.name}@${adapter.adapterVersion}`);
  const a = run.settings as unknown as Record<string, unknown>;
  const b = settings as unknown as Record<string, unknown>;
  const changed = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (changed.length) diffs.push(`settings changed: ${changed.join(', ')}`);
  if (!changed.length && run.inputHash !== hash) diffs.push(`input files changed (input hash ${run.inputHash.slice(0, 12)} → ${hash.slice(0, 12)})`);
  return diffs;
}

function wipeRun(dir: string): void {
  for (const name of ['run.json', 'render.json', 'inputs.json', 'frames.sha256', 'chunks', 'partial']) rmSync(join(dir, name), { recursive: true, force: true });
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (/^mezzanine(\.part)?\.\w+$/.test(f)) rmSync(join(dir, f), { force: true });
}

function freeDiskMB(dir: string): number {
  try {
    const s = statfsSync(dir);
    return Math.round((Number(s.bavail) * Number(s.bsize)) / 2 ** 20);
  } catch {
    return Infinity;
  }
}

export async function runRender(o: RunOptions): Promise<RunOutcome> {
  const root = o.target.root;
  const log = o.log ?? createLog('render');
  const now = o.clock ?? Date.now;
  const t0 = now();
  const elapsed = () => (now() - t0) / 1000;
  const dir = o.dir ?? outDir(o.target.slug, 'render', o.profile.name, root);
  const size = renderSize(o.target.config.format, o.profile);
  const fps = o.target.config.format.fps;
  const settings = renderSettings(o.target, o.profile, size, o.range, o.adapter.settings);
  const ih = computeInputHash({ target: o.target, adapter: o.adapter, settings });
  const budget = o.budgetS ?? 0;
  const overrunS = o.overrunS ?? 50;
  const abortFreeMB = o.abortFreeMB ?? readLocalConfig(root).abortFreeMB ?? 500;
  const runFile = join(dir, 'run.json');
  const renderFile = join(dir, 'render.json');
  let chunksDone = 0;
  let chunksTotal = 0;
  const outcome = (exit: ExitCode, message: string, extra: Partial<RunOutcome> = {}): RunOutcome => ({ exit, message, dir, chunksDone, chunksTotal, ...extra });

  let run = readJson<RunJson>(runFile);
  // why the existing run gets replaced; it is deleted only once the engine is open
  let discard: string | null = null;
  if (run) {
    const diffs = runDiffs(run, ih.hash, settings, o.adapter);
    if (o.fresh) discard = `fresh run requested${diffs.length ? `; ${diffs.join('; ')}` : ''}`;
    else if (diffs.length) {
      if (!o.force) return outcome(EXIT.REFUSED, `run ${repoRel(dir, root)} differs: ${diffs.join('; ')}. Replace it with --force.`);
      discard = diffs.join('; ');
    }
  }

  if (run && !discard) {
    const existing = readJson<RenderResult>(renderFile);
    const mezz = existing ? join(root, ...existing.mezzanine.path.split('/')) : null;
    if (existing && existing.inputHash === ih.hash && mezz && existsSync(mezz) && statSync(mezz).size === existing.mezzanine.bytes) {
      chunksDone = chunksTotal = chunkList(run.frames, run.settings.chunkFrames).length;
      // a render finished by an older runner gets its inputs.json now: the hash is the same
      if (!existsSync(join(dir, 'inputs.json'))) writeJson(join(dir, 'inputs.json'), pictureInputsOf(ih));
      return outcome(EXIT.OK, `up to date: ${repoRel(renderFile, root)}`, { renderJson: existing, renderJsonPath: renderFile });
    }
    const chunks = chunkList(run.frames, run.settings.chunkFrames);
    if (chunks.every((c) => chunkDone(dir, run!, c))) {
      chunksDone = chunksTotal = chunks.length;
      try {
        const rj = await assemble(dir, run, o, ih, log, elapsed);
        return outcome(EXIT.OK, `assembled ${repoRel(renderFile, root)}`, { renderJson: rj, renderJsonPath: renderFile });
      } catch (e) {
        return outcome(EXIT.ERROR, `render failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  mkdirSync(dir, { recursive: true });
  const awake = o.keepAwake === false ? () => {} : holdAwake(log);
  let session: EngineSession | null = null;
  let encoder: ChunkEncoder | null = null;
  const unregister = onAbort(async () => {
    await encoder?.abort();
    await session?.close();
  });
  try {
    session = await o.adapter.open({ target: o.target, profile: o.profile, width: size.width, height: size.height, fps, runDir: dir, root, inputRoots: ih.roots, log });
    const style = session.renderFrames ? 'stream' : session.renderChunkFile ? 'file' : null;
    if (!style) throw new Error(`engine ${o.adapter.name} implements neither renderFrames nor renderChunkFile`);
    const [k0, k1] = o.range ?? [0, session.durationFrames];
    if (!(Number.isInteger(k0) && Number.isInteger(k1) && k0 >= 0 && k1 > k0 && k1 <= session.durationFrames))
      throw new ExitError(EXIT.USAGE, `frame range [${k0}, ${k1}) is outside the composition's ${session.durationFrames} frames`);

    if (run && !discard) {
      const why =
        run.frames[1] !== k1 || run.frames[0] !== k0
          ? `frames [${run.frames}] → [${k0},${k1}]`
          : run.durationFrames !== session.durationFrames
            ? `composition length ${run.durationFrames} → ${session.durationFrames} frames`
            : infoKey(run.info) !== infoKey(session.info)
              ? `engine host ${infoKey(run.info)} → ${infoKey(session.info)}`
              : null;
      if (why && !o.force) return outcome(EXIT.REFUSED, `run ${repoRel(dir, root)} differs: ${why}. Replace it with --force.`);
      discard = why;
    }
    if (!run || discard) {
      if (discard) log.info(`discarding the previous run (${discard})`);
      // leftovers without a run.json (deleted by hand, older layout) must never be resumed either
      wipeRun(dir);
      run = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        inputHash: ih.hash,
        settings,
        engine: { name: o.adapter.name, version: o.adapter.version, adapterVersion: o.adapter.adapterVersion },
        frames: [k0, k1],
        durationFrames: session.durationFrames,
        info: session.info,
        output: { style, ext: session.output?.ext ?? '.mkv', color: session.output?.color ?? MEZZANINE_COLOR },
      };
      mkdirSync(join(dir, 'chunks'), { recursive: true });
      writeJson(runFile, run);
      log.info(`new run ${repoRel(dir, root)}: frames ${k0}-${k1 - 1} at ${size.width}x${size.height} ${fps} fps, chunks of ${o.profile.chunkFrames} (${ih.files} input files)`);
    }
    const r = run;
    rmSync(join(dir, 'partial'), { recursive: true, force: true });
    mkdirSync(join(dir, 'partial'), { recursive: true });
    mkdirSync(join(dir, 'chunks'), { recursive: true });
    const chunks = chunkList(r.frames, r.settings.chunkFrames);
    chunksTotal = chunks.length;
    const finished = chunks.map((c) => chunkDone(dir, r, c));
    chunksDone = finished.filter(Boolean).length;
    const todo = chunks.filter((_, k) => !finished[k]);
    log.info(`${chunksDone}/${chunksTotal} chunks done · ${session.info.browser ?? o.adapter.name}${session.info.gpu ? ` · ${session.info.gpu}` : ''}`);

    // seconds per frame for the budget estimate: this call's measurements, else the last finished chunk's
    const lastDone = finished.filter((j): j is ChunkJson => j !== null).pop();
    let perFrameS = lastDone ? lastDone.wallS / lastDone.frames.length : (o.defaultFrameS ?? 1);
    let renderedThisCall = 0;

    for (const c of todo) {
      const n = c.k1 - c.k0;
      const est = n * perFrameS * ESTIMATE_SAFETY + 4;
      if (budget > 0 && renderedThisCall > 0 && elapsed() + est > budget) {
        return outcome(EXIT.AGAIN, `budget: ${elapsed().toFixed(0)} s used + next chunk ≈ ${est.toFixed(0)} s > ${budget} s: run again to continue (${chunksDone}/${chunksTotal} chunks done)`);
      }
      const disk = freeDiskMB(dir);
      if (disk < (o.minDiskMB ?? 2048)) throw new Error(`only ${disk} MB free on disk (need ${o.minDiskMB ?? 2048} MB): stopping`);
      const freeMB = await availableMB();
      if (freeMB < abortFreeMB) return outcome(EXIT.LOW_MEMORY, `host memory low (${freeMB} MB available < ${abortFreeMB} MB) before chunk ${c.i}: ${chunksDone}/${chunksTotal} chunks done, run again when memory is back`);
      const f = chunkFiles(dir, r, c);
      rmSync(f.part, { force: true });
      const ct0 = now();
      const frames: ChunkJson['frames'] = [];
      let hashes: NonNullable<ChunkJson['hashes']> = 'stream';

      if (style === 'stream') {
        const enc = new ChunkEncoder({ width: size.width, height: size.height, fps, out: f.part, logFile: join(dir, 'partial', `c${pad(c.i)}.log`) });
        encoder = enc;
        let next = c.k0;
        let prev = now();
        try {
          await session.renderFrames!([c.k0, c.k1], async (i, rgba, meta) => {
            if (i !== next) throw new Error(`engine delivered frame ${i}, expected ${next}`);
            // the first chunk of a call always finishes: discarding it would never make progress
            if (budget > 0 && renderedThisCall > 0 && elapsed() > budget + overrunS) throw new ExitError(EXIT.AGAIN, `budget: chunk ${c.i} ran past ${budget + overrunS} s; discarded, run again to continue`);
            const t = now();
            frames.push({ i, sha256: sha256(rgba), ms: Math.round(meta?.ms ?? t - prev) });
            await enc.write(rgba);
            prev = now();
            next++;
            if ((i - c.k0) % 24 === 23) {
              const mb = await availableMB();
              if (mb < abortFreeMB) throw new ExitError(EXIT.LOW_MEMORY, `host memory low (${mb} MB available < ${abortFreeMB} MB): stopped in chunk ${c.i}`);
            }
          });
          if (next !== c.k1) throw new Error(`engine delivered ${next - c.k0} of ${n} frames for chunk ${c.i}`);
          await enc.finish();
        } catch (e) {
          await enc.abort();
          throw e;
        } finally {
          encoder = null;
        }
      } else {
        const metas = (await session.renderChunkFile!([c.k0, c.k1], f.part)) ?? [];
        const got = await countFrames(f.part, 'packets');
        if (got !== n) throw new Error(`engine wrote ${got ?? 'no'} frames for chunk ${c.i}, expected ${n}`);
        const byI = new Map(metas.map((m) => [m.i, m]));
        const needHash = Array.from({ length: n }, (_, k) => c.k0 + k).some((i) => !byI.get(i)?.sha256);
        // one source per chunk: all decoded (RGBA, like the streaming path) unless the engine hashed every frame
        const decoded = needHash ? await allFrameHashes(f.part, 'rgba') : [];
        hashes = needHash ? 'decoded' : 'engine';
        const each = Math.round(((now() - ct0) / n) * 1000) / 1000;
        for (let k = 0; k < n; k++) {
          const i = c.k0 + k;
          frames.push({ i, sha256: needHash ? decoded[k] : byI.get(i)!.sha256!, ms: Math.round(byI.get(i)?.ms ?? each) });
        }
      }

      await commitPart(f.part, f.media, n);
      const wallS = (now() - ct0) / 1000;
      const cj: ChunkJson = { chunk: c.i, range: [c.k0, c.k1], file: `c${pad(c.i)}${r.output.ext}`, bytes: statSync(f.media).size, wallS, renderedAt: new Date().toISOString(), hashes, frames };
      writeFileAtomic(f.json, `${JSON.stringify(cj)}\n`);
      chunksDone++;
      renderedThisCall++;
      perFrameS = wallS / n;
      log.info(`chunk ${c.i} (frames ${c.k0}-${c.k1 - 1}): ${wallS.toFixed(1)} s, ${(wallS / n).toFixed(3)} s/frame · ${chunksDone}/${chunksTotal} · ${await availableMB()} MB available`);
    }

    await session.close();
    session = null;
    const rj = await assemble(dir, r, o, ih, log, elapsed);
    return outcome(EXIT.OK, `render complete: ${repoRel(renderFile, root)}`, { renderJson: rj, renderJsonPath: renderFile });
  } catch (e) {
    const exit = exitOf(e);
    const msg = e instanceof Error ? e.message : String(e);
    return outcome(exit, exit === EXIT.ERROR ? `render failed: ${msg}` : msg);
  } finally {
    unregister();
    if (session) await session.close().catch(() => {});
    awake();
  }
}

/** At most this many frames are decoded back from the mezzanine (one select expression). */
const VERIFY_MAX = 48;

/**
 * The mezzanine must decode to the frames that were hashed: packet counts alone miss a corrupt
 * packet or an encoder that changes pixels. Decodes each chunk's first frame and the last one
 * (evenly thinned beyond VERIFY_MAX) as RGBA (bgr0 → rgba gives alpha 255, matching the opaque
 * frames pages must deliver) and compares sha256. Chunks hashed by the engine itself (a lossy
 * file-style output) cannot be compared and are skipped.
 */
async function verifyMezzanine(mezz: string, run: RunJson, chunks: Chunk[], jsons: ChunkJson[], log: Log): Promise<void> {
  const comparable = chunks.filter((_, k) => (jsons[k].hashes ?? (run.output.style === 'stream' ? 'stream' : 'engine')) !== 'engine');
  if (!comparable.length) return;
  const step = Math.max(1, Math.ceil(comparable.length / (VERIFY_MAX - 1)));
  const picks = comparable.filter((_, k) => k % step === 0).map((c) => c.k0);
  const lastChunk = comparable.at(-1)!;
  picks.push(lastChunk.k1 - 1);
  const expected = new Map(jsons.flatMap((j) => j.frames).map((f) => [f.i, f.sha256]));
  // decode order counts from the mezzanine's first frame, which is frame run.frames[0]
  const got = await decodedFrameHashes(mezz, picks.map((i) => i - run.frames[0]), 'rgba');
  if (got.length !== new Set(picks).size) throw new Error(`mezzanine check: decoded ${got.length} of ${new Set(picks).size} sample frames`);
  for (const g of got) {
    const i = g.i + run.frames[0];
    if (g.sha256 !== expected.get(i)) throw new Error(`mezzanine frame ${i} decodes to other pixels (sha256 ${g.sha256.slice(0, 12)}) than the engine delivered (${expected.get(i)?.slice(0, 12)}): the mezzanine is not lossless or a chunk is corrupt`);
  }
  log.info(`mezzanine check: ${got.length} decoded frames match their hashes`);
}

/**
 * Concat the finished chunks into the mezzanine and write frames.sha256, inputs.json and
 * render.json. `ih` is this call's input hash, which equals run.inputHash: a run whose inputs
 * changed was refused or replaced before any of its chunks was trusted.
 */
async function assemble(dir: string, run: RunJson, o: RunOptions, ih: InputHash, log: Log, elapsed: () => number): Promise<RenderResult> {
  const root = o.target.root;
  const roots = ih.roots;
  if (ih.hash !== run.inputHash) throw new Error(`input hash ${ih.hash.slice(0, 12)} ≠ the run's ${run.inputHash.slice(0, 12)}: refusing to assemble`);
  const a0 = elapsed();
  const chunks = chunkList(run.frames, run.settings.chunkFrames);
  const jsons = chunks.map((c) => chunkDone(dir, run, c));
  const missing = chunks.filter((_, k) => !jsons[k]);
  if (missing.length) throw new Error(`${missing.length} chunks missing (first: ${missing[0].i})`);
  const total = run.frames[1] - run.frames[0];
  const mezz = join(dir, `mezzanine${run.output.ext}`);
  const part = partPath(mezz);
  rmSync(part, { force: true });
  await concatCopy(
    chunks.map((c) => chunkFiles(dir, run, c).media),
    part,
    join(dir, 'concat.txt'),
    FORMAT_OF[run.output.ext] ?? 'matroska',
  );
  await commitPart(part, mezz, total);

  const hashes = jsons.flatMap((j) => j!.frames);
  await verifyMezzanine(mezz, run, chunks, jsons as ChunkJson[], log);
  const hashFile = join(dir, 'frames.sha256');
  writeFileSync(hashFile, hashes.map((h) => `${h.i} ${h.sha256}`).join('\n') + '\n');

  const [p, sum, git, tc] = await Promise.all([probe(mezz), sha256File(mezz), gitState(root, [...roots, 'pnpm-lock.yaml']), toolchain({ browser: run.info.browser, gpu: run.info.gpu })]);
  const warnings: string[] = [];
  if (git.dirty) warnings.push('rendered from uncommitted inputs (git status shows changes under the input paths)');
  const wallS = jsons.reduce((s, j) => s + j!.wallS, 0) + (elapsed() - a0);
  const rj = parseContract(
    RenderResult,
    {
      schemaVersion: 1,
      engine: run.engine,
      target: { slug: o.target.slug, entry: o.target.config.entry, ...(o.target.config.composition ? { composition: o.target.config.composition } : {}) },
      profile: o.profile.name,
      frames: { start: run.frames[0], end: run.frames[1], count: total },
      composition: { durationFrames: run.durationFrames },
      fps: run.settings.fps,
      width: run.settings.width,
      height: run.settings.height,
      color: run.output.color,
      mezzanine: { path: repoRel(mezz, root), codec: p.video?.codec ?? 'unknown', pixFmt: p.video?.pixFmt ?? 'unknown', bytes: statSync(mezz).size, sha256: sum },
      inputHash: run.inputHash,
      git,
      toolchain: tc,
      timing: { startedAt: run.createdAt, endedAt: new Date().toISOString(), wallS: Math.round(wallS * 100) / 100 },
      frameHashes: repoRel(hashFile, root),
      warnings,
    },
    'render.json',
  );
  writeJson(join(dir, 'inputs.json'), pictureInputsOf(ih));
  writeJson(join(dir, 'render.json'), rj);
  if (!o.keepChunks) for (const c of chunks) rmSync(chunkFiles(dir, run, c).media, { force: true });
  rmSync(join(dir, 'partial'), { recursive: true, force: true });
  log.info(`mezzanine ${repoRel(mezz, root)}: ${total} frames, ${(rj.mezzanine.bytes / 2 ** 20).toFixed(1)} MB`);
  return rj;
}
