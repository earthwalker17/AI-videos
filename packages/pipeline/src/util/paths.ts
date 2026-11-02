import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedRoot: string | null = null;

/**
 * The repository root: the nearest folder holding pnpm-workspace.yaml, searched upwards from
 * `start` (default: AIV_ROOT if set — tests point the CLI at a scratch repo — else this
 * module, which always lives inside the repo or a worktree of it).
 */
export function repoRoot(start?: string): string {
  if (!start && process.env.AIV_ROOT) return resolve(process.env.AIV_ROOT);
  if (!start && cachedRoot) return cachedRoot;
  let dir = resolve(start ?? dirname(fileURLToPath(import.meta.url)));
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      if (!start) cachedRoot = dir;
      return dir;
    }
    const up = dirname(dir);
    if (up === dir) throw new Error(`no pnpm-workspace.yaml above ${start ?? 'the pipeline package'}`);
    dir = up;
  }
}

export type OutKind = 'render' | 'post' | 'qa' | 'release' | 'audio';

/**
 * out/<slug>/<kind>/<profile> (absolute). Generated output only; never committed. The audio
 * stage's tracks have no profile (every profile mixes the same tracks): out/<slug>/audio, and
 * its `profile` argument must be null.
 */
export function outDir(slug: string, kind: OutKind, profile: string | null, root = repoRoot()): string {
  if (kind === 'audio') return join(root, 'out', slug, 'audio');
  if (!profile) throw new Error(`out/${slug}/${kind} needs a profile`);
  return join(root, 'out', slug, kind, profile);
}

/**
 * A repo-relative POSIX path for anything that gets recorded (render.json, manifests): committed
 * files must not carry absolute or user paths. Throws for paths outside the repo.
 */
export function repoRel(abs: string, root = repoRoot()): string {
  const rel = relative(root, resolve(abs));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`path is outside the repository: ${abs}`);
  return rel.split(sep).join('/');
}

/** Absolute path from a repo-relative one. */
export const fromRepo = (rel: string, root = repoRoot()): string => resolve(root, ...rel.split('/'));

/** "<dir>/<name>.part.<ext>": written first, renamed into place only once verified. */
export function partPath(file: string): string {
  const ext = extname(file);
  return `${file.slice(0, file.length - ext.length)}.part${ext}`;
}

/** Write a file atomically enough for our purposes: temp file + rename. */
export function writeFileAtomic(file: string, data: string | Uint8Array): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  try {
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** JSON with two-space indent, LF and a final newline (repo convention). */
export const writeJson = (file: string, value: unknown): void => writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
