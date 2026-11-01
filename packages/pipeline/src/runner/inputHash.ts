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
 * The files are everything under the declared inputs: the target's src/ and assets/ folders and
 * its entry file, styles/ (shared looks), every packages/<name>/src that frame code can import
 * (all but the node-only @aiv/pipeline, see framePackages) and whatever the adapter declares
 * (its harness, its page runtime, a kit). Tests (*.test.*), node_modules and dot-files are
 * skipped. An engine that serves files to a page checks that every served file lies under these
 * roots (the web engine reads Vite's module graph), so a page can not pull in an unhashed file.
 *
 * Deliberately NOT included: the git commit (a docs-only commit must not invalidate a run),
 * video.json as a file (its pixel-relevant fields are in the settings; title or status edits
 * are not), absolute paths and timestamps (the same inputs anywhere hash the same).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
const skipFile = (name: string) => name.startsWith('.') || /\.test\.[cm]?[jt]sx?$/.test(name);

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

/** The repo-relative input roots of a target + adapter (existing ones only), for hashing and git status. */
export function inputRoots(target: Target, adapter: Pick<EngineAdapter, 'inputs'>): string[] {
  const own = [`${target.relDir}/src`, `${target.relDir}/assets`, `${target.relDir}/${target.config.entry}`];
  const roots = [...own, 'styles', ...framePackages(target.root), ...(adapter.inputs?.(target) ?? [])];
  return [...new Set(roots.map((r) => r.replace(/\\/g, '/').replace(/\/+$/, '')))].filter((r) => existsSync(fromRepo(r, target.root))).sort();
}

export interface InputHash {
  hash: string;
  /** repo-relative input roots that were hashed */
  roots: string[];
  files: number;
}

export function computeInputHash(o: { target: Target; adapter: Pick<EngineAdapter, 'name' | 'adapterVersion' | 'inputs'>; settings: RenderSettings }): InputHash {
  const root = o.target.root;
  const roots = inputRoots(o.target, o.adapter);
  const files: string[] = [];
  for (const r of roots) walk(fromRepo(r, root), files);
  const rels = [...new Set(files.map((f) => repoRel(f, root)))].sort();
  const lockFile = join(root, 'pnpm-lock.yaml');
  const lines = [
    'aiv-input-hash v1',
    `adapter ${o.adapter.name} ${o.adapter.adapterVersion}`,
    `lock ${existsSync(lockFile) ? sha256(readFileSync(lockFile)) : 'none'}`,
    `settings ${canonicalJson(o.settings)}`,
    ...rels.map((rel) => `file ${rel} ${sha256(readFileSync(fromRepo(rel, root)))}`),
  ];
  return { hash: sha256(lines.join('\n')), roots, files: rels.length };
}
