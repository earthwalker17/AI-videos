/**
 * The input hash: what a render's pixels are a function of. A resumed run must have the same
 * hash, or its finished chunks show another version of the video (the AI STACK chunk-reuse
 * bug). Definition (version 1), sha256 over these LF-joined lines:
 *
 *   aiv-input-hash v1
 *   adapter <engine name> <adapterVersion>
 *   lock <sha256 of pnpm-lock.yaml>           third-party versions (three, remotion, react…)
 *   settings <canonical JSON of RenderSettings>
 *   file <repo-relative path> <sha256>        one line per file, sorted by path
 *
 * The files are everything under the declared inputs: the target's src/, assets/ and media/
 * (large inputs, gitignored, listed in media/manifest.json) folders and its entry file, styles/
 * (shared looks), every packages/<name>/src that frame code can import
 * (all but the node-only @aiv/pipeline, see framePackages) and whatever the adapter declares
 * (its harness, its page runtime, a kit). Tests (*.test.*), Markdown (prose never shapes
 * pixels), node_modules and dot-files are skipped. An engine checks every file it loads with filesOutsideHash (the web engine reads
 * Vite's module graph, the Remotion engine webpack's), so a page can not pull in an unhashed file.
 *
 * Deliberately NOT included: the git commit (a docs-only commit must not invalidate a run),
 * video.json as a file (its pixel-relevant fields are in the settings; title or status edits
 * are not), the video's audio/ folder (the score has its own hash, audio/hash.ts), absolute
 * paths and timestamps (the same inputs anywhere hash the same).
 *
 * The runner writes the lines and per-file hashes next to render.json (inputs.json, see
 * PictureInputs): post reads the cue sheet's hash from it, and release recomputes the hash
 * against the tree it is about to tag.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { z } from 'zod';
import { canonicalJson, sha256 } from '../util/hash.ts';
import { fromRepo, repoRel } from '../util/paths.ts';
import type { EngineAdapter, FrameSpan } from './engine.ts';
import type { Profile } from './profiles.ts';
import type { Target } from './target.ts';

/** The normalised render settings: everything besides files that changes the frames or their chunking. */
export interface RenderSettings {
  engine: string;
  /** adapter choices that change pixels (web: the browser, pinned or system) */
  engineOptions: Record<string, string>;
  target: { slug: string; entry: string; composition: string | null };
  format: { width: number; height: number; fps: number };
  profile: string;
  width: number;
  height: number;
  fps: number;
  chunkFrames: number;
  /** explicit sub-range, or null for the whole composition */
  range: [number, number] | null;
}

export function renderSettings(target: Target, profile: Profile, size: { width: number; height: number }, range?: FrameSpan, engineOptions: Record<string, string> = {}): RenderSettings {
  const c = target.config;
  return {
    engine: c.engine,
    engineOptions: { ...engineOptions },
    target: { slug: target.slug, entry: c.entry, composition: c.composition ?? null },
    format: { width: c.format.width, height: c.format.height, fps: c.format.fps },
    profile: profile.name,
    width: size.width,
    height: size.height,
    fps: c.format.fps,
    chunkFrames: profile.chunkFrames,
    range: range ? [range[0], range[1]] : null,
  };
}

const SKIP_DIR = new Set(['node_modules', '.remotion', 'dist', '.vite', '.cache', 'out']);
const skipFile = (name: string) => name.startsWith('.') || /\.test\.[cm]?[jt]sx?$/.test(name) || /\.md$/i.test(name);

/** Whether the walk over these repo-relative roots hashes the repo-relative file (the walk's own skip rules). */
export function hashedBy(rel: string, roots: readonly string[]): boolean {
  return roots.some((r) => {
    // a file root (the entry) is hashed whatever its name
    if (rel === r) return true;
    if (!rel.startsWith(`${r}/`)) return false;
    const dirs = rel.slice(r.length + 1).split('/');
    const name = dirs.pop()!;
    return !skipFile(name) && dirs.every((d) => !SKIP_DIR.has(d) && !d.startsWith('.'));
  });
}

const under = (f: string, dir: string) => {
  const rel = relative(dir, f);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/**
 * Files an engine loaded (absolute paths) that the input hash over `roots` does not cover:
 * outside every root, or inside one but skipped by the walk (dot-folders, dist/, out/,
 * *.test.*). Third-party files (node_modules) are pinned by the lockfile line instead, unless
 * they lie inside an input root (no lockfile entry, and the walk skips them). Engines refuse
 * to render with such files: an edit to one would change pixels without changing the hash.
 */
export function filesOutsideHash(files: readonly string[], root: string, roots: readonly string[]): string[] {
  return files.filter((f) => {
    const rel = under(f, root) ? relative(root, f).split(sep).join('/') : null;
    if (rel !== null && hashedBy(rel, roots)) return false;
    const inRoot = rel !== null && roots.some((r) => rel.startsWith(`${r}/`));
    return inRoot || !f.split(/[\\/]/).includes('node_modules');
  });
}

function walk(abs: string, out: string[]): void {
  const st = statSync(abs);
  if (st.isFile()) {
    out.push(abs);
    return;
  }
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name) && !e.name.startsWith('.')) walk(join(abs, e.name), out);
    } else if (e.isFile() && !skipFile(e.name)) out.push(join(abs, e.name));
  }
}

const NODE_ONLY_PACKAGES = new Set(['pipeline']);

/**
 * Packages whose src frame code may import. @aiv/pipeline is node-only (ffmpeg, the runner, QA):
 * no page can load it, and its one pixel path (the lossless mezzanine encode) is checked by
 * decoding the mezzanine against the frame hashes, so editing it must not invalidate every run.
 */
function framePackages(root: string): string[] {
  const dir = join(root, 'packages');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NODE_ONLY_PACKAGES.has(e.name))
    .map((e) => `packages/${e.name}/src`);
}

/** Every root a target + adapter declares, whether it exists yet or not (sorted, POSIX). */
function declaredRoots(target: Target, adapter: Pick<EngineAdapter, 'inputs'>): string[] {
  const own = [`${target.relDir}/src`, `${target.relDir}/assets`, `${target.relDir}/media`, `${target.relDir}/${target.config.entry}`];
  const roots = [...own, 'styles', ...framePackages(target.root), ...(adapter.inputs?.(target) ?? [])];
  return [...new Set(roots.map((r) => r.replace(/\\/g, '/').replace(/\/+$/, '')))].sort();
}

/** The repo-relative input roots of a target + adapter (existing ones only), for hashing and git status. */
export function inputRoots(target: Target, adapter: Pick<EngineAdapter, 'inputs'>): string[] {
  return declaredRoots(target, adapter).filter((r) => existsSync(fromRepo(r, target.root)));
}

/** One hashed input file. */
export interface FileHash {
  /** repo-relative POSIX path */
  path: string;
  sha256: string;
}

/**
 * The walk both input hashes share (the picture's here, the score's in audio/hash.ts): every
 * file under the repo-relative roots that exist, with the skip rules above, deduplicated and
 * sorted by path, with its sha256.
 */
export function hashFiles(root: string, roots: readonly string[]): FileHash[] {
  const files: string[] = [];
  for (const r of roots) {
    const abs = fromRepo(r, root);
    if (existsSync(abs)) walk(abs, files);
  }
  const rels = [...new Set(files.map((f) => repoRel(f, root)))].sort();
  return rels.map((path) => ({ path, sha256: sha256(readFileSync(fromRepo(path, root))) }));
}

/** sha256 of pnpm-lock.yaml (the third-party pins), or 'none' outside a pnpm repo. */
export function lockSha(root: string): string {
  const lockFile = join(root, 'pnpm-lock.yaml');
  return existsSync(lockFile) ? sha256(readFileSync(lockFile)) : 'none';
}

/** The hash over the header lines and one `file <path> <sha256>` line per file (LF-joined). */
export const hashLines = (header: readonly string[], files: readonly FileHash[]): string => sha256([...header, ...files.map((f) => `file ${f.path} ${f.sha256}`)].join('\n'));

/**
 * What changed between two hashed file lists, as one readable clause ('changed a, b; added c;
 * removed d'), or '' when they are equal. Refusals name the files so a person knows what to undo
 * or what to re-render for.
 */
export function describeFileChanges(before: readonly FileHash[], after: readonly FileHash[], max = 12): string {
  const a = new Map(before.map((f) => [f.path, f.sha256]));
  const b = new Map(after.map((f) => [f.path, f.sha256]));
  const changed = [...b].filter(([p, s]) => a.has(p) && a.get(p) !== s).map(([p]) => p);
  const added = [...b.keys()].filter((p) => !a.has(p));
  const removed = [...a.keys()].filter((p) => !b.has(p));
  const list = (xs: string[]) => (xs.length > max ? `${xs.slice(0, max).join(', ')} and ${xs.length - max} more` : xs.join(', '));
  return [changed.length && `changed ${list(changed)}`, added.length && `added ${list(added)}`, removed.length && `removed ${list(removed)}`].filter(Boolean).join('; ');
}

export interface InputHash {
  hash: string;
  /** repo-relative input roots that were hashed */
  roots: string[];
  /** every declared root, existing or not (a root created later still counts when release recomputes) */
  declaredRoots: string[];
  files: number;
  /** the lines before the file lines */
  header: string[];
  /** the hashed files, sorted by path */
  inputs: FileHash[];
}

export function computeInputHash(o: { target: Target; adapter: Pick<EngineAdapter, 'name' | 'adapterVersion' | 'inputs'>; settings: RenderSettings }): InputHash {
  const root = o.target.root;
  const declared = declaredRoots(o.target, o.adapter);
  const roots = declared.filter((r) => existsSync(fromRepo(r, root)));
  const inputs = hashFiles(root, roots);
  const header = ['aiv-input-hash v1', `adapter ${o.adapter.name} ${o.adapter.adapterVersion}`, `lock ${lockSha(root)}`, `settings ${canonicalJson(o.settings)}`];
  return { hash: hashLines(header, inputs), roots, declaredRoots: declared, files: inputs.length, header, inputs };
}

/**
 * inputs.json (working file, next to render.json): the picture hash's lines, roots and per-file
 * hashes. render.json v1 is frozen and carries only the hash; this file lets post read the cue
 * sheet the picture saw and lets release recompute the hash with the render's own settings
 * (never the environment's) against the tree it is about to tag. No absolute paths.
 */
export const PictureInputs = z.object({
  schemaVersion: z.literal(1),
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  /** the hash lines before the file lines: version, adapter, lock, settings */
  header: z.array(z.string()),
  /** every declared root, existing or not */
  roots: z.array(z.string()),
  files: z.array(z.object({ path: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })),
});
export type PictureInputs = z.infer<typeof PictureInputs>;

export const pictureInputsOf = (ih: InputHash): PictureInputs => ({ schemaVersion: 1, inputHash: ih.hash, header: ih.header, roots: ih.declaredRoots, files: ih.inputs });

/**
 * The render settings that come from video.json (engine, entry and composition, format) whose
 * recorded value (the settings line in inputs.json) differs from the video.json in the tree now,
 * by field name. Release recomputes the hash with the recorded settings, so without this an
 * edit to video.json after the render would pass, although the tag would rebuild another
 * picture. The profile's fields (size, chunking, range, engine options) stay as recorded.
 */
export function videoSettingsChanges(header: readonly string[], target: Pick<Target, 'slug' | 'config'>): string[] {
  const line = header.find((l) => l.startsWith('settings '));
  if (!line) return ['settings'];
  const recorded = JSON.parse(line.slice('settings '.length)) as Partial<Record<keyof RenderSettings, unknown>>;
  const c = target.config;
  const now = {
    engine: c.engine,
    target: { slug: target.slug, entry: c.entry, composition: c.composition ?? null },
    format: { width: c.format.width, height: c.format.height, fps: c.format.fps },
    fps: c.format.fps,
  };
  return (Object.keys(now) as (keyof typeof now)[]).filter((k) => canonicalJson(recorded[k] ?? null) !== canonicalJson(now[k]));
}

/**
 * The picture hash recomputed from inputs.json against the current tree: the recorded header
 * (adapter, settings) with today's lockfile line, over the recorded roots. Returns the new hash
 * and what differs ('' when nothing does).
 */
export function recomputePictureHash(root: string, recorded: PictureInputs): { hash: string; changes: string } {
  const header = recorded.header.map((l) => (l.startsWith('lock ') ? `lock ${lockSha(root)}` : l));
  const files = hashFiles(root, recorded.roots);
  const lock = header.join('\n') !== recorded.header.join('\n') ? 'pnpm-lock.yaml changed' : '';
  return { hash: hashLines(header, files), changes: [lock, describeFileChanges(recorded.files, files)].filter(Boolean).join('; ') };
}
