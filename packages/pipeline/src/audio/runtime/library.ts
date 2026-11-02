/**
 * Sample libraries: pinned upstream files (CC0 or CC BY only, docs/LICENSING.md) that a score
 * plays. The files never enter git; a video pins the ones it reads in audio/library.json (path,
 * bytes, sha256 per file at one upstream commit), and the bytes live in the local store
 *
 *   .cache/libraries/<id>@<commit>/<path>      commit = the full 40-hex upstream commit
 *
 * where `aiv doctor --fix` puts them (from a local checkout named in aiv.local.json
 * librarySeeds, else downloaded at the pinned commit). Every read is verified against the pin,
 * so the audio input hash (which covers library.json) covers the samples too.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { z } from 'zod';
import { readWav } from './wav.ts';
import type { Library } from './types.ts';

const SHA256 = /^[0-9a-f]{64}$/;

/** A POSIX path relative to a library's root: no '..', '.', empty segments, ':' or backslashes. */
export function isLibraryPath(p: string): boolean {
  // eslint-disable-next-line no-control-regex
  return p.length > 0 && !/[\\:\u0000-\u001f]/.test(p) && !p.startsWith('/') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

/** Code-unit order, the order library.json lists files and libraries in. */
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const sortedUnique = (xs: readonly string[]) => xs.every((x, i) => i === 0 || byString(xs[i - 1], x) < 0);

export const LibraryFile = z.strictObject({
  path: z.string().refine(isLibraryPath, 'expected a POSIX path relative to the library root (no .., no :, no backslash)'),
  bytes: z.int().nonnegative(),
  sha256: z.string().regex(SHA256, 'expected a lowercase hex sha256'),
});
export type LibraryFile = z.infer<typeof LibraryFile>;

export const LibraryEntry = z
  .strictObject({
    /** lowercase-kebab, e.g. 'vsco2-ce' */
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected a lowercase-kebab id'),
    /** the upstream repository, e.g. https://github.com/sgossner/VSCO-2-CE */
    repo: z.string().regex(/^https:\/\/[^\s/]+\/\S+$/, 'expected an https URL'),
    /** the full upstream commit the files are pinned at */
    commit: z.string().regex(/^[0-9a-f]{40}$/, 'expected a full 40-hex commit'),
    /** SPDX id: CC0-1.0 or CC-BY-<version> (no NC/ND/SA terms) */
    license: z.string().regex(/^(?:CC0-1\.0|CC-BY-\d+\.\d+)$/, 'expected CC0-1.0 or CC-BY-<version>'),
    files: z.array(LibraryFile),
  })
  .refine((l) => sortedUnique(l.files.map((f) => f.path)), { message: 'files must be sorted by path, without duplicates', path: ['files'] });
export type LibraryEntry = z.infer<typeof LibraryEntry>;

/** videos/<slug>/audio/library.json: the sample files a score reads, pinned by hash. */
export const LibraryManifest = z
  .strictObject({
    schemaVersion: z.literal(1),
    libraries: z.array(LibraryEntry),
  })
  .refine((m) => sortedUnique(m.libraries.map((l) => l.id)), { message: 'libraries must be sorted by id, without duplicates', path: ['libraries'] });
export type LibraryManifest = z.infer<typeof LibraryManifest>;

/** Stable JSON for library.json: libraries by id, files by path, 2-space indent, final newline. */
export function formatLibraryManifest(m: LibraryManifest): string {
  // keys in a fixed order too, so a re-pin of the same reads rewrites the same bytes
  const libraries = [...m.libraries]
    .sort((a, b) => byString(a.id, b.id))
    .map((l) => ({
      id: l.id,
      repo: l.repo,
      commit: l.commit,
      license: l.license,
      files: [...l.files].sort((a, b) => byString(a.path, b.path)).map((f) => ({ path: f.path, bytes: f.bytes, sha256: f.sha256 })),
    }));
  return `${JSON.stringify({ schemaVersion: 1, libraries }, null, 2)}\n`;
}

/** The store folder of one library at one commit (absolute). */
export const libraryDir = (root: string, id: string, commit: string): string => join(root, '.cache', 'libraries', `${id}@${commit}`);

/** The absolute store path of a library file, or an error for a path outside the library. */
export function libraryFilePath(dir: string, path: string): string {
  if (!isLibraryPath(path)) throw new Error(`'${path}' is outside the library: expected a POSIX path relative to its root (no '..', ':' or '\\')`);
  const abs = join(dir, ...path.split('/'));
  const rel = relative(dir, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`'${path}' is outside the library`);
  return abs;
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/**
 * The path as it is spelled on disk under `dir`, when that differs from `path` only in letter
 * case; else null (equal, or not there). NTFS and APFS open `harp/c4.wav` for `Harp/C4.wav`, but
 * the upstream repository, a Linux host and the download URLs do not: a pin must name the file
 * exactly. `list` reads a folder's entries (cached by the caller).
 */
export function caseMismatch(dir: string, path: string, list: (folder: string) => string[]): string | null {
  const spelled: string[] = [];
  let at = dir;
  let differs = false;
  for (const seg of path.split('/')) {
    const names = list(at);
    const real = names.includes(seg) ? seg : names.find((n) => n.toLowerCase() === seg.toLowerCase());
    if (real === undefined) return null;
    differs ||= real !== seg;
    spelled.push(real);
    at = join(at, real);
  }
  return differs ? spelled.join('/') : null;
}

/** A folder's entry names, or [] when it cannot be read. */
const entries = (folder: string): string[] => {
  try {
    return readdirSync(folder);
  } catch {
    return [];
  }
};

export interface OpenLibraryOptions {
  root: string;
  slug: string;
  entry: LibraryEntry;
  /** record unpinned reads instead of refusing them */
  pin: boolean;
  /** a local checkout of the library at entry.commit (librarySeeds): fills a missing store file in pin mode */
  seed?: string;
}

/** A library whose reads are verified (or, pinning, recorded); reads() lists what was read. */
export function openLibrary(o: OpenLibraryOptions): Library & { reads(): LibraryFile[] } {
  const { id, commit } = o.entry;
  const dir = libraryDir(o.root, id, commit);
  const pinned = new Map(o.entry.files.map((f) => [f.path, f]));
  const reads = new Map<string, LibraryFile>();
  const where = `library ${id}@${commit.slice(0, 12)}`;
  const listed = new Map<string, string[]>();
  const list = (folder: string) => {
    let names = listed.get(folder);
    if (!names) listed.set(folder, (names = entries(folder)));
    return names;
  };
  const exactCase = (base: string, path: string, what: string) => {
    const spelled = caseMismatch(base, path, list);
    if (spelled) throw new Error(`${where}: ${path} is spelled ${spelled} in ${what}: library paths are case-sensitive (upstream, Linux, the download URLs), name the file exactly`);
  };
  const read = (path: string): Uint8Array => {
    let file: string;
    try {
      file = libraryFilePath(dir, path);
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message}`, { cause: e });
    }
    const pin = pinned.get(path);
    if (!pin && !o.pin) throw new Error(`${where}: ${path} is not pinned in audio/library.json: run aiv audio ${o.slug} --pin`);
    if (!existsSync(file) && o.pin && o.seed) {
      const from = libraryFilePath(o.seed, path);
      if (existsSync(from)) {
        exactCase(o.seed, path, 'the seed');
        mkdirSync(dirname(file), { recursive: true });
        copyFileSync(from, file);
        listed.clear();
      }
    }
    if (!existsSync(file)) {
      const fix = pin ? 'run aiv doctor --fix' : `set librarySeeds.${id} in aiv.local.json to a checkout at ${commit.slice(0, 12)}, or put the file there`;
      throw new Error(`${where}: ${path} is not in the store (.cache/libraries/${id}@${commit}): ${fix}`);
    }
    exactCase(dir, path, 'the store');
    const bytes = readFileSync(file);
    const sum = sha256(bytes);
    if (pin && (bytes.length !== pin.bytes || sum !== pin.sha256))
      throw new Error(`${where}: ${path} is not the pinned file (${bytes.length} bytes, sha256 ${sum.slice(0, 12)} ≠ ${pin.bytes} bytes, ${pin.sha256.slice(0, 12)}): run aiv doctor --fix`);
    reads.set(path, { path, bytes: bytes.length, sha256: sum });
    return bytes;
  };
  return {
    id,
    commit,
    readWav: (path) => {
      const bytes = read(path);
      try {
        return readWav(bytes);
      } catch (e) {
        throw new Error(`${where}: ${path}: ${(e as Error).message}`, { cause: e });
      }
    },
    readText: (path) => new TextDecoder('utf-8', { fatal: true }).decode(read(path)),
    reads: () => [...reads.values()].sort((a, b) => byString(a.path, b.path)),
  };
}
