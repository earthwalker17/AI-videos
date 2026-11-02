/**
 * The audio input hash: what the bytes of a video's tracks are a function of. Post and release
 * refuse tracks whose hash went stale, exactly as a resumed render refuses changed inputs.
 * Definition (version 1), sha256 over these LF-joined lines (the walk, skip rules and file line
 * format are the picture hash's, runner/inputHash.ts):
 *
 *   aiv-audio-hash v1
 *   node <process.version>                    float maths and the module loader
 *   lock <sha256 of pnpm-lock.yaml>           tsx, zod and every other third-party pin
 *   settings <canonical JSON {channels, sampleRate, slug}>
 *   library <sha256 of audio/library.json, or none>   the pinned sample files (verified on read)
 *   file <repo-relative path> <sha256>        one line per file, sorted by path
 *
 * over the roots videos/<slug>/audio (the score), videos/<slug>/src/cues.ts (the one timeline
 * the picture shares), packages/core/src and packages/pipeline/src/audio/runtime (the synthesis
 * code that runs in the child). The stage's orchestration (stage.ts) and ffmpeg (used only to
 * measure) are deliberately outside: they never shape a sample.
 *
 * The picture hash does not cover videos/<slug>/audio, so a score edit never invalidates a
 * render; both cover src/cues.ts, so a timing edit invalidates both.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { describeFileChanges, filesOutsideHash, hashedBy, hashFiles, hashLines, lockSha, type FileHash } from '../runner/inputHash.ts';
import type { Target } from '../runner/target.ts';
import { canonicalJson, sha256 } from '../util/hash.ts';
import { SAMPLE_RATE } from './runtime/types.ts';

export const AUDIO_HASH_VERSION = 'aiv-audio-hash v1';

/** The code every score runs on, wherever the video is: covered by every video's audio hash. */
export const SHARED_AUDIO_ROOTS = ['packages/core/src', 'packages/pipeline/src/audio/runtime'] as const;

/** The repo-relative roots of a video's audio hash. */
export const audioRoots = (relDir: string): string[] => [`${relDir}/audio`, `${relDir}/src/cues.ts`, ...SHARED_AUDIO_ROOTS].sort();

export interface AudioHash {
  hash: string;
  roots: string[];
  /** the non-file lines, by name (audio.json settings) */
  settings: Record<string, string>;
  /** the hashed files (audio.json inputs) */
  inputs: FileHash[];
}

export function computeAudioHash(target: Pick<Target, 'root' | 'slug' | 'relDir'>): AudioHash {
  const root = target.root;
  const roots = audioRoots(target.relDir);
  const lib = join(root, ...target.relDir.split('/'), 'audio', 'library.json');
  const settings = {
    node: process.version,
    lock: lockSha(root),
    settings: canonicalJson({ slug: target.slug, sampleRate: SAMPLE_RATE, channels: 2 }),
    library: existsSync(lib) ? sha256(readFileSync(lib)) : 'none',
  };
  const header = [AUDIO_HASH_VERSION, `node ${settings.node}`, `lock ${settings.lock}`, `settings ${settings.settings}`, `library ${settings.library}`];
  const inputs = hashFiles(root, roots);
  return { hash: hashLines(header, inputs), roots, settings, inputs };
}

/** What differs between a recorded audio hash (audio.json) and now, for a refusal message. */
export function describeAudioChanges(recorded: { settings: Record<string, string>; inputs: readonly FileHash[] }, now: AudioHash): string {
  const what: Record<string, string> = { node: 'the Node version', lock: 'pnpm-lock.yaml', settings: 'the stage settings', library: 'audio/library.json' };
  const settings = Object.keys(now.settings)
    .filter((k) => recorded.settings[k] !== now.settings[k])
    .map((k) => `${what[k] ?? k} changed`);
  return [...settings, describeFileChanges(recorded.inputs, now.inputs)].filter(Boolean).join('; ') || 'the hash differs';
}

/**
 * Module files a score's process loaded (absolute paths) that its audio hash does not cover.
 * Third-party files in node_modules are pinned by the lockfile line. When the stage runs
 * against another repository than its own code (AIV_ROOT, a scratch repo in tests), the
 * runtime and @aiv/core are loaded from the code's repository: there they must lie in the
 * shared roots.
 */
export function modulesOutsideAudioHash(files: readonly string[], root: string, roots: readonly string[], codeRoot: string): string[] {
  const outside = filesOutsideHash(files, root, roots);
  return relative(root, codeRoot) === '' ? outside : filesOutsideHash(outside, codeRoot, SHARED_AUDIO_ROOTS);
}

/**
 * The shared-root files (runtime, @aiv/core) the score's process loaded from the code's
 * repository that are not byte-identical to the target's copy the hash covers (`inputs`), as
 * repo-relative paths. Only when the two repositories differ (AIV_ROOT: a scratch repo, a tag
 * worktree): the code that ran must be the code that was hashed, or the hash would describe
 * tracks another runtime made.
 */
export function sharedCodeMismatches(files: readonly string[], root: string, codeRoot: string, inputs: readonly FileHash[]): string[] {
  if (relative(root, codeRoot) === '') return [];
  const hashed = new Map(inputs.map((f) => [f.path, f.sha256]));
  const out = new Set<string>();
  for (const f of files) {
    const r = relative(codeRoot, f);
    if (!r || r.startsWith('..') || isAbsolute(r)) continue;
    const rel = r.split(sep).join('/');
    if (hashedBy(rel, SHARED_AUDIO_ROOTS) && hashed.get(rel) !== sha256(readFileSync(f))) out.add(rel);
  }
  return [...out].sort();
}
