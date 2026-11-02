/**
 * The audio stage (`aiv audio <slug>`): a video's score in, its tracks out.
 *
 *   videos/<slug>/audio/index.ts   the score (default export defineScore({ tracks }))
 *   videos/<slug>/src/cues.ts      the cue sheet it shares with the picture (export const cues)
 *   videos/<slug>/audio/library.json   pinned sample-library files, when it plays any
 *     ──▶ out/<slug>/audio/<name>.wav  one per track: 48 kHz stereo float 32, leader + film
 *         out/<slug>/audio/audio.json  AudioResult: input hash, per-file hashes, peaks, loudness, checks
 *
 * The score runs in a child process (runtime/child.ts under tsx) that records every module it
 * loads; a score that loaded a repo file outside the audio hash's roots is refused (exit 2),
 * because an edit to that file would change the bytes without changing the hash. --verify runs
 * the score twice in two fresh processes and requires byte-identical tracks. Intent checks on
 * the cue sheet (cuts on bars, text held long enough, card length) are written into audio.json;
 * a failed one makes the stage exit 1 after writing, so iteration goes on but the gate is seen.
 *
 * This file orchestrates and is not hashed (it may read the clock for timing); everything that
 * shapes a sample is in runtime/.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AudioResult, CueSheet, EXIT, ExitError, parseContract, type ExitCode } from '@aiv/core';
import { readLocalConfig } from '../host/localConfig.ts';
import { measureLoudness } from '../media/audio.ts';
import { resolveTarget } from '../runner/target.ts';
import { gitState } from '../util/git.ts';
import { sha256 } from '../util/hash.ts';
import { createLog, type Log } from '../util/log.ts';
import { outDir, repoRel, repoRoot, writeFileAtomic, writeJson } from '../util/paths.ts';
import { exec } from '../util/proc.ts';
import { ffmpegVersion } from '../util/toolchain.ts';
import { computeAudioHash, modulesOutsideAudioHash, sharedCodeMismatches } from './hash.ts';
import { failedChecks, intentChecks, type IntentCheck } from './intent.ts';
import { formatLibraryManifest, LibraryManifest } from './runtime/library.ts';
import { SAMPLE_RATE, type AudioJob, type AudioReport } from './runtime/types.ts';
import { readWav, samplePeak } from './runtime/wav.ts';
import { seedProblem } from './store.ts';

/** The peak recorded for digital silence (and the floor of every peak), dBFS. */
export const SILENCE_DB = -200;

export interface AudioStageOptions {
  slug: string;
  root?: string;
  /** render twice in fresh processes and require identical bytes */
  verify?: boolean;
  /** record every library file the score reads in audio/library.json */
  pin?: boolean;
  log?: Log;
  /** per child render (default 10 min) */
  timeoutMs?: number;
}

export interface AudioStageOutcome {
  /** 0, or 1 when an intent check failed (the tracks and audio.json are written either way) */
  exit: ExitCode;
  result: AudioResult;
  audioJsonPath: string;
  failed: IntentCheck[];
}

const CHILD = fileURLToPath(new URL('./runtime/child.ts', import.meta.url));
/** The tsx loader the repo runs TypeScript with (`node --import <tsx>`), resolved from this package. */
const tsxLoader = () => pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
/** The repository this code lives in (the runtime's own files are judged against it). */
const codeRoot = () => repoRoot(dirname(fileURLToPath(import.meta.url)));

/** The variables a Node process needs to start (system folders, temp, home), and nothing else. */
const CHILD_ENV = ['PATH', 'SystemRoot', 'windir', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE'] as const;

/**
 * The score process's environment: the few variables Node needs to start, none of the caller's
 * others. A value a score could read (process.env) or that changes what Node loads
 * (NODE_OPTIONS --import/--require) would change the bytes without changing the hash, and both
 * --verify renders would inherit it, so --verify could not catch it either. (On Windows, process
 * creation adds the few variables it requires, SYSTEMDRIVE, USERNAME and the like; the lint ban
 * on `process` in scores is the other half.)
 */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of CHILD_ENV) if (env[k] !== undefined) out[k] = env[k];
  return out;
}

/**
 * The seeds --pin may copy new files from: a librarySeeds checkout counts only when git confirms
 * it is at the library's pinned commit, unmodified (store.ts seedProblem). Otherwise its bytes
 * would be pinned under a commit that does not hold them, and `aiv doctor --fix` on another
 * machine would download different ones. A skipped seed is a warning; reads then need the store.
 */
async function usableSeeds(libraries: LibraryManifest | null, seeds: Record<string, string>, log: Log): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const l of libraries?.libraries ?? []) {
    const seed = seeds[l.id];
    if (!seed) continue;
    const why = await seedProblem(seed, l.commit);
    if (why) log.warn(`librarySeeds.${l.id} (aiv.local.json) is not used: ${why}`);
    else out[l.id] = seed;
  }
  return out;
}

/** Run one render of the score in a fresh Node process and parse its report. */
async function renderInChild(job: AudioJob, timeoutMs: number, log: Log): Promise<AudioReport> {
  const jobFile = join(job.outDir, 'job.json');
  writeFileSync(jobFile, JSON.stringify(job));
  const r = await exec(process.execPath, ['--import', tsxLoader(), CHILD, jobFile], { cwd: job.root, timeoutMs, env: childEnv() });
  const last = r.stdout.trim().split(/\r?\n/).at(-1) ?? '';
  let report: AudioReport;
  try {
    report = JSON.parse(last) as AudioReport;
  } catch {
    const err = r.stderr.trim();
    throw new ExitError(EXIT.ERROR, `the score's process exited ${r.code} without a report (it is stopped after ${Math.round(timeoutMs / 60_000)} min)${err ? `:\n${err.slice(-3000)}` : ''}`);
  }
  for (const line of r.stderr.split(/\r?\n/)) if (line.trim()) log.info(`score: ${line}`);
  return report;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export async function runAudioStage(o: AudioStageOptions): Promise<AudioStageOutcome> {
  const root = o.root ?? repoRoot();
  const log = o.log ?? createLog('audio');
  const target = resolveTarget(o.slug, root);
  const rel = (f: string) => repoRel(f, root);
  const scoreFile = join(target.dir, 'audio', 'index.ts');
  const cuesFile = join(target.dir, 'src', 'cues.ts');
  if (!existsSync(scoreFile)) throw new ExitError(EXIT.ERROR, `${rel(scoreFile)} is missing: a video's score default-exports defineScore({ tracks }) (from @aiv/pipeline/audio)`);
  if (!existsSync(cuesFile)) throw new ExitError(EXIT.ERROR, `${rel(cuesFile)} is missing: it exports \`cues\`, the cue sheet the picture and the score share`);
  const libFile = join(target.dir, 'audio', 'library.json');
  const libraries = existsSync(libFile) ? parseContract(LibraryManifest, JSON.parse(readFileSync(libFile, 'utf8')), rel(libFile)) : null;

  const startedAt = new Date();
  const before = computeAudioHash(target);
  const dir = outDir(target.slug, 'audio', null, root);
  mkdirSync(dir, { recursive: true });
  // seeds only fill the store while pinning; a plain render reads the store alone
  const seeds = o.pin ? await usableSeeds(libraries, readLocalConfig(root).librarySeeds ?? {}, log) : {};
  const code = codeRoot();
  // a refusal names files repo-relative (the target's repo, else the code's), else as they are
  const show = (f: string) => {
    for (const base of [root, code]) {
      const r = relative(base, f);
      if (r && !r.startsWith('..') && !isAbsolute(r)) return r.split(sep).join('/');
    }
    return f;
  };
  const runCount = o.verify ? 2 : 1;
  const tmps: string[] = [];
  const runs: { dir: string; report: AudioReport; sums: Map<string, string> }[] = [];
  try {
    for (let k = 1; k <= runCount; k++) {
      const tmp = join(dir, `.render-${k}`);
      tmps.push(tmp);
      rmSync(tmp, { recursive: true, force: true });
      mkdirSync(tmp, { recursive: true });
      log.info(`render ${k}/${runCount}: ${rel(scoreFile)} in a fresh process${o.pin ? ' (pinning library reads)' : ''}`);
      const job: AudioJob = { root, slug: target.slug, fps: target.config.format.fps, cuesFile, scoreFile, outDir: tmp, libraries, pin: !!o.pin, seeds };
      const report = await renderInChild(job, o.timeoutMs ?? 10 * 60_000, log);
      if (!report.ok) throw new ExitError(EXIT.ERROR, `the score failed: ${report.error ?? 'no reason given'}`);
      const outside = modulesOutsideAudioHash(report.modules, root, before.roots, code);
      if (outside.length)
        throw new ExitError(
          EXIT.REFUSED,
          `the score loaded ${outside.length} file(s) the audio input hash does not cover: ${outside.map(show).join(', ')}. A score may load only its own audio/ folder, src/cues.ts, @aiv/core and @aiv/pipeline/audio: move what it needs into audio/`,
        );
      // the child itself was loaded before its hook: it is checked as a loaded file too
      const differ = sharedCodeMismatches([...report.modules, CHILD], root, code, before.inputs);
      if (differ.length)
        throw new ExitError(
          EXIT.REFUSED,
          `the score ran on another checkout's runtime than the one the audio input hash covers: ${differ.join(', ')} differ from the target repository's copies. Run aiv audio from the target's own checkout`,
        );
      runs.push({ dir: tmp, report, sums: new Map(report.tracks.map((t) => [t.name, sha256(readFileSync(join(tmp, `${t.name}.wav`)))])) });
    }
    if (o.verify) {
      const [a, b] = runs;
      const names = [...new Set([...a.sums.keys(), ...b.sums.keys()])].sort();
      const differ = names.filter((n) => a.sums.get(n) !== b.sums.get(n));
      if (differ.length)
        throw new ExitError(EXIT.ERROR, `not deterministic: ${differ.map((n) => `${n} (${a.sums.get(n)?.slice(0, 12) ?? 'missing'} ≠ ${b.sums.get(n)?.slice(0, 12) ?? 'missing'})`).join(', ')} differ between two fresh renders. Look for module state, Math.random or iteration over unordered data`);
      if (JSON.stringify(a.report.reads) !== JSON.stringify(b.report.reads)) throw new ExitError(EXIT.ERROR, 'not deterministic: the two renders read different library files');
      log.info(`verified: ${names.length} track(s) byte-identical across two fresh renders`);
    }
    const first = runs[0];
    if (o.pin && libraries) {
      const reads = new Map(first.report.reads.map((r) => [r.id, r.files]));
      const pinned = { schemaVersion: 1 as const, libraries: libraries.libraries.map((l) => ({ ...l, files: reads.get(l.id) ?? [] })) };
      writeFileAtomic(libFile, formatLibraryManifest(parseContract(LibraryManifest, pinned, rel(libFile))));
      log.info(`pinned ${first.report.reads.reduce((s, r) => s + r.files.length, 0)} library file(s) in ${rel(libFile)}`);
    }
    // audio.json goes first: a crash must never leave new tracks described by an old audio.json
    rmSync(join(dir, 'audio.json'), { force: true });
    for (const f of readdirSync(dir)) if (f.endsWith('.wav')) rmSync(join(dir, f), { force: true });
    for (const t of first.report.tracks) renameSync(join(first.dir, `${t.name}.wav`), join(dir, `${t.name}.wav`));
  } finally {
    for (const t of tmps) rmSync(t, { recursive: true, force: true });
  }

  const report = runs[0].report;
  const hash = o.pin ? computeAudioHash(target) : before;
  const sheet = parseContract(CueSheet, report.sheet, 'the cue sheet the score saw');
  const cuesRel = rel(cuesFile);
  const warnings: string[] = [];
  const tracks: AudioResult['tracks'] = [];
  for (const t of report.tracks) {
    const file = join(dir, `${t.name}.wav`);
    const bytes = readFileSync(file);
    const wav = readWav(bytes);
    const peak = samplePeak(wav.channels);
    if (peak === 0) warnings.push(`track '${t.name}' is digital silence`);
    const loud = (await measureLoudness(file)).measure;
    tracks.push({
      name: t.name,
      path: rel(file),
      bytes: bytes.length,
      sha256: runs[0].sums.get(t.name)!,
      samples: t.samples,
      channels: wav.channels.length,
      peakDb: peak > 0 ? Math.max(SILENCE_DB, round2(20 * Math.log10(peak))) : SILENCE_DB,
      loudness: loud ? { i: loud.i, tp: loud.tp, lra: loud.lra } : null,
    });
  }
  const checks = intentChecks(sheet);
  const ff = await ffmpegVersion();
  const endedAt = new Date();
  const result = parseContract(
    AudioResult,
    {
      schemaVersion: 1,
      slug: target.slug,
      inputHash: hash.hash,
      inputs: hash.inputs,
      settings: hash.settings,
      cues: { path: cuesRel, sha256: hash.inputs.find((f) => f.path === cuesRel)?.sha256 ?? sha256(readFileSync(cuesFile)), sheet },
      sampleRate: SAMPLE_RATE,
      tracks,
      libraries: report.reads.map((r) => ({ id: r.id, commit: r.commit, files: r.files.length })),
      verified: !!o.verify,
      checks,
      git: await gitState(root, [...hash.roots, 'pnpm-lock.yaml']),
      toolchain: { node: process.version, ffmpeg: ff.version, os: process.platform, arch: process.arch },
      timing: { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), wallS: round2((endedAt.getTime() - startedAt.getTime()) / 1000) },
      warnings,
    },
    'audio.json',
  );
  const audioJsonPath = audioJsonFile(target.slug, root);
  writeJson(audioJsonPath, result);
  const failed = failedChecks(checks);
  return { exit: failed.length ? EXIT.ERROR : EXIT.OK, result, audioJsonPath, failed };
}

/** The audio.json of a target (absolute), wherever post and release look for it. */
export const audioJsonFile = (slug: string, root?: string): string => join(outDir(slug, 'audio', null, root), 'audio.json');
