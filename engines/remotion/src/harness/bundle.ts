/**
 * Bundling a video's Remotion entry with @remotion/bundler (webpack), once per input state.
 *
 * Cache: .cache/remotion-bundles/<key>/, key = a hash of what shapes the bundle: the entry, every
 * file under the input roots and the lockfile (not the composition id, slug, format or profile:
 * one bundle holds every composition of an entry, and draft and final share it). A bundle is
 * written to <key>.tmp-<pid> and renamed into place only after its checks passed, so a
 * half-written folder is never served. The newest KEEP bundles stay; older ones are deleted.
 *
 * Served-file parity with the web engine: a plugin records the source files of every module
 * webpack built (its resource plus the files its loaders read), including the modules that
 * production mode folds into concatenated modules and those of child compilations. A file the
 * input hash does not cover fails the open, naming it: its edits would change pixels without
 * changing the hash, the bundle key or a resume check. The same plugin checks that react,
 * react-dom, three, R3F and remotion each come from exactly one package folder: two copies of a
 * module with module state (R3F's store, three's class identity, Remotion's contexts) break
 * silently.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { computeInputHash, filesOutsideHash, getProfile, pidAlive, renderSettings, repoRel, type Log, type Target } from '@aiv/pipeline';
import type { webpack, WebpackOverrideFn } from '@remotion/bundler';

/** Part of the cache key: bump when the bundle options or the bundle checks below change. */
const BUNDLE_VERSION = '2';
const KEEP = 6;
const MANIFEST = 'aiv-bundle.json';
const PLUGIN = 'aiv-collect-files';

/** Packages that must exist once in a bundle (module state, class identity, React contexts). */
export const SINGLE_INSTANCE = ['react', 'react-dom', 'three', '@react-three/fiber', 'remotion'] as const;

export const bundlesDir = (root: string): string => join(root, '.cache', 'remotion-bundles');

export interface BundleManifest {
  schemaVersion: 1;
  key: string;
  entry: string;
  createdAt: string;
  bundleMs: number;
  /** absolute paths of every bundled source file */
  files: string[];
}

export interface BundleResult {
  /** the bundle folder (Remotion's serveUrl) */
  serveUrl: string;
  key: string;
  cached: boolean;
  /** time spent in this call (bundling, or checking a cached bundle) */
  ms: number;
  files: number;
}

const under = (f: string, dir: string) => {
  const rel = relative(dir, f);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** The package folder a file belongs to (the innermost node_modules/<name> or node_modules/@scope/<name>), or null. */
export function packageRoot(file: string): { name: string; dir: string } | null {
  const parts = file.split(/[\\/]/);
  const i = parts.lastIndexOf('node_modules');
  if (i < 0 || i + 1 >= parts.length) return null;
  const scoped = parts[i + 1].startsWith('@');
  if (scoped && i + 2 >= parts.length) return null;
  const n = scoped ? 3 : 2;
  return { name: parts.slice(i + 1, i + n).join('/'), dir: parts.slice(0, i + n).join('/') };
}

/** Packages of SINGLE_INSTANCE bundled from more than one folder: name → folders. */
export function duplicatePackages(files: readonly string[], names: readonly string[] = SINGLE_INSTANCE): Map<string, string[]> {
  const seen = new Map<string, Set<string>>();
  for (const f of files) {
    const p = packageRoot(f);
    if (!p || !names.includes(p.name)) continue;
    const key = process.platform === 'win32' ? p.dir.toLowerCase() : p.dir;
    if (!seen.has(p.name)) seen.set(p.name, new Set());
    seen.get(p.name)!.add(key);
  }
  return new Map([...seen].filter(([, dirs]) => dirs.size > 1).map(([n, dirs]) => [n, [...dirs]]));
}

/** Fail with a readable message when the bundle pulled in unhashed files or duplicate packages. */
export function assertBundleFiles(files: readonly string[], root: string, roots: readonly string[], relDir: string): void {
  const bad = filesOutsideHash(files, root, roots);
  if (bad.length) {
    const list = bad.slice(0, 5).map((f) => (relative(root, f).startsWith('..') ? f : relative(root, f).split(sep).join('/')));
    throw new Error(
      `the bundle contains ${bad.length} file(s) the input hash does not cover: ${list.join(', ')}${bad.length > 5 ? ', …' : ''}. Keep composition code under ${relDir}/src or assets (shared code under packages/<name>/src or styles/; no dot-folders, dist/, out/ or *.test.* files), or a resume could mix two versions of the video.`,
    );
  }
  const dup = duplicatePackages(files);
  if (dup.size) {
    const what = [...dup].map(([n, dirs]) => `${n} from ${dirs.map((d) => (under(d, root) ? relative(root, d).split(sep).join('/') : d)).join(' and ')}`).join('; ');
    throw new Error(`the bundle holds two copies of ${what}: hooks, contexts and instanceof checks break across copies. Import these packages only through the root's pinned versions.`);
  }
}

/** The parts of a webpack module that name source files (NormalModule, ConcatenatedModule). */
export interface ModuleLike {
  resource?: string;
  buildInfo?: { fileDependencies?: Iterable<string> };
  /** a ConcatenatedModule's root and inner modules */
  modules?: Iterable<ModuleLike>;
}

/** The source files of these modules: each one's resource and the files its loaders read, inner modules of concatenations included. */
export function moduleFiles(modules: Iterable<ModuleLike>, into = new Set<string>()): Set<string> {
  for (const m of modules) {
    if (m.resource) into.add(m.resource.split('?')[0]);
    for (const f of m.buildInfo?.fileDependencies ?? []) into.add(String(f));
    // concatenation removes its root module from compilation.modules and has no resource itself
    if (m.modules) moduleFiles(m.modules, into);
  }
  return into;
}

type Plugin = NonNullable<Parameters<WebpackOverrideFn>[0]['plugins']>[number];

/** A webpack plugin that hands over every bundled source file once the compilation is done. */
function collectFiles(sink: (files: string[]) => void): Plugin {
  return {
    apply(compiler: webpack.Compiler) {
      const files = new Set<string>();
      // every module as built, before optimisation folds any; child compilers (workers) copy this tap
      compiler.hooks.compilation.tap(PLUGIN, (c) => c.hooks.finishModules.tap(PLUGIN, (mods) => void moduleFiles(mods as Iterable<ModuleLike>, files)));
      compiler.hooks.done.tap(PLUGIN, (stats) => {
        const walk = (c: webpack.Compilation): void => {
          moduleFiles(c.modules as Iterable<ModuleLike>, files);
          for (const child of c.children) walk(child);
        };
        walk(stats.compilation);
        sink([...files].map((f) => resolve(f)));
      });
    },
  };
}

/** The bundle cache key: the entry, the files under the input roots and the lockfile; nothing per composition, profile or frame range. */
export function bundleKey(target: Target, inputs: (t: Target) => string[]): string {
  const neutral: Target = { ...target, slug: 'bundle', config: { ...target.config, composition: undefined, format: { width: 2, height: 2, fps: 1 } } };
  const settings = renderSettings(neutral, getProfile('review'), { width: 2, height: 2 });
  return computeInputHash({ target: neutral, adapter: { name: 'remotion-bundle', adapterVersion: BUNDLE_VERSION, inputs }, settings }).hash.slice(0, 24);
}

/** The manifest of a finished bundle, or null. */
export function readBundleManifest(root: string, key: string): BundleManifest | null {
  try {
    return JSON.parse(readFileSync(join(bundlesDir(root), key, MANIFEST), 'utf8')) as BundleManifest;
  } catch {
    return null;
  }
}

function prune(dir: string, keep: string): void {
  if (!existsSync(dir)) return;
  const done: { name: string; t: number }[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const tmp = /\.tmp-(\d+)$/.exec(name);
    if (tmp) {
      if (!pidAlive(Number(tmp[1]))) rmSync(p, { recursive: true, force: true });
      continue;
    }
    try {
      done.push({ name, t: statSync(join(p, MANIFEST)).mtimeMs });
    } catch {
      rmSync(p, { recursive: true, force: true });
    }
  }
  done.sort((a, b) => b.t - a.t);
  for (const d of done.slice(KEEP)) if (d.name !== keep) rmSync(join(dir, d.name), { recursive: true, force: true });
}

export interface BundleOptions {
  target: Target;
  /** repo-relative roots the run's input hash covers */
  inputRoots: readonly string[];
  /** the adapter's extra input roots (part of the cache key) */
  inputs: (t: Target) => string[];
  log: Log;
}

/** Bundle the target's entry, or reuse the bundle of the same inputs. */
export async function bundleTarget(o: BundleOptions): Promise<BundleResult> {
  const { target, log } = o;
  const root = target.root;
  const t0 = Date.now();
  const key = bundleKey(target, o.inputs);
  const base = bundlesDir(root);
  const out = join(base, key);
  const manifestFile = join(out, MANIFEST);
  const cached = readBundleManifest(root, key);
  if (cached?.key === key && existsSync(join(out, 'index.html'))) {
    // the roots are those of the same inputs, but a cached bundle is still checked like a fresh one
    assertBundleFiles(cached.files, root, o.inputRoots, target.relDir);
    writeFileSync(manifestFile, `${JSON.stringify(cached, null, 2)}\n`); // mtime = last use, for pruning
    const ms = Date.now() - t0;
    log.info(`bundle ${repoRel(out, root)} reused (bundled in ${(cached.bundleMs / 1000).toFixed(1)} s, ${cached.files.length} files)`);
    return { serveUrl: out, key, cached: true, ms, files: cached.files.length };
  }

  const entry = join(target.dir, ...target.config.entry.split('/'));
  if (!existsSync(entry)) throw new Error(`remotion engine: ${target.relDir}/${target.config.entry} does not exist`);
  mkdirSync(base, { recursive: true });
  const tmp = `${out}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  let files: string[] | null = null;
  const { bundle } = await import('@remotion/bundler');
  log.info(`bundling ${target.relDir}/${target.config.entry} (webpack)…`);
  try {
    await bundle({
      entryPoint: entry,
      // the repo root: one toolchain at HEAD, the webpack cache in node_modules/.cache
      rootDir: root,
      outDir: tmp,
      // staticFile() serves the video's assets/ (hashed); never a stray public/ folder
      publicDir: join(target.dir, 'assets'),
      enableCaching: true,
      onProgress: () => {},
      webpackOverride: (config) => ({ ...config, plugins: [...(config.plugins ?? []), collectFiles((f) => (files = f))] }),
    });
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`bundling ${target.relDir}/${target.config.entry} failed: ${(e as Error).message.split('\n').slice(0, 6).join('\n')}`, { cause: e });
  }
  const bundled = files as string[] | null;
  if (!bundled || !bundled.length) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error('the bundler finished without reporting its modules');
  }
  try {
    // the entry itself must be among them, or the collector missed modules
    const same = (f: string) => (process.platform === 'win32' ? resolve(f).toLowerCase() === resolve(entry).toLowerCase() : resolve(f) === resolve(entry));
    if (!bundled.some(same)) throw new Error(`internal: the bundle's module list lacks the entry ${target.relDir}/${target.config.entry}`);
    assertBundleFiles(bundled, root, o.inputRoots, target.relDir);
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  const bundleMs = Date.now() - t0;
  const manifest: BundleManifest = { schemaVersion: 1, key, entry: target.config.entry, createdAt: new Date().toISOString(), bundleMs, files: bundled.sort() };
  writeFileSync(join(tmp, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(out, { recursive: true, force: true });
  renameSync(tmp, out);
  prune(base, key);
  log.info(`bundled ${bundled.length} files in ${(bundleMs / 1000).toFixed(1)} s → ${repoRel(out, root)}`);
  return { serveUrl: out, key, cached: false, ms: bundleMs, files: bundled.length };
}
