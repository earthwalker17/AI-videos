/**
 * The sample-library store (.cache/libraries/<id>@<commit>/, see runtime/library.ts): which
 * files the videos pin, whether the store holds them, and filling it. `aiv doctor` checks every
 * pinned file (bytes + sha256); `aiv doctor --fix` fills missing or wrong ones from the seed (a
 * local checkout named in aiv.local.json librarySeeds, whose root maps 1:1 onto the library's
 * upstream paths; copied only when its sha256 matches the pin) or else downloads the file at the
 * pinned commit from GitHub, following a Git LFS pointer to the media host. `aiv audio` never
 * fetches, and neither does CI: the doctor's section turns downloads off there (CI runs no score;
 * the tests use synthetic fixtures), so a missing store file is a warning on CI, not a failure.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { sha256 } from '../util/hash.ts';
import { writeFileAtomic } from '../util/paths.ts';
import { exec } from '../util/proc.ts';
import { libraryDir, libraryFilePath, LibraryManifest, type LibraryEntry, type LibraryFile } from './runtime/library.ts';

export interface PinnedLibrary {
  id: string;
  commit: string;
  repo: string;
  /** repo-relative library.json files that pin it */
  pinnedBy: string[];
  /** every pinned file, union over the videos, sorted by path */
  files: LibraryFile[];
}

export interface PinScan {
  libraries: PinnedLibrary[];
  /** unreadable or invalid library.json files, and contradicting pins of one path */
  errors: string[];
}

/** Every library file the videos pin (videos/*\/audio/library.json), grouped by id@commit. */
export function pinnedLibraries(root: string): PinScan {
  const errors: string[] = [];
  type Acc = PinnedLibrary & { paths: Map<string, LibraryFile> };
  const byKey = new Map<string, Acc>();
  const videos = join(root, 'videos');
  const slugs = existsSync(videos) ? readdirSync(videos, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort() : [];
  for (const slug of slugs) {
    const rel = `videos/${slug}/audio/library.json`;
    const file = join(root, 'videos', slug, 'audio', 'library.json');
    if (!existsSync(file)) continue;
    let m: LibraryManifest;
    try {
      const r = LibraryManifest.safeParse(JSON.parse(readFileSync(file, 'utf8')));
      if (!r.success) {
        errors.push(`${rel}: ${r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
        continue;
      }
      m = r.data;
    } catch (e) {
      errors.push(`${rel}: not valid JSON: ${(e as Error).message}`);
      continue;
    }
    for (const l of m.libraries) {
      const key = `${l.id}@${l.commit}`;
      const lib: Acc = byKey.get(key) ?? { id: l.id, commit: l.commit, repo: l.repo, pinnedBy: [], files: [], paths: new Map() };
      byKey.set(key, lib);
      lib.pinnedBy.push(rel);
      for (const f of l.files) {
        const prev = lib.paths.get(f.path);
        if (prev && (prev.sha256 !== f.sha256 || prev.bytes !== f.bytes)) errors.push(`${key} ${f.path}: ${rel} pins another file than ${lib.pinnedBy[0]}`);
        else lib.paths.set(f.path, f);
      }
    }
  }
  const libraries = [...byKey.keys()].sort().map((k) => {
    const { paths, ...lib } = byKey.get(k)!;
    return { ...lib, files: [...paths.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) };
  });
  return { libraries, errors };
}

export type StoreState = 'ok' | 'missing' | 'mismatch';

/** Whether the store holds exactly the pinned file. */
export function storeFileState(root: string, lib: Pick<LibraryEntry, 'id' | 'commit'>, f: LibraryFile): StoreState {
  const file = libraryFilePath(libraryDir(root, lib.id, lib.commit), f.path);
  if (!existsSync(file)) return 'missing';
  if (statSync(file).size !== f.bytes) return 'mismatch';
  return sha256(readFileSync(file)) === f.sha256 ? 'ok' : 'mismatch';
}

/** Raw-content URLs of a file at a commit of a GitHub repository (null for other hosts). */
export function githubUrls(repo: string, commit: string, path: string): { raw: string; lfs: string } | null {
  const m = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(repo);
  if (!m) return null;
  const p = path.split('/').map(encodeURIComponent).join('/');
  return { raw: `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${commit}/${p}`, lfs: `https://media.githubusercontent.com/media/${m[1]}/${m[2]}/${commit}/${p}` };
}

const LFS_POINTER = 'version https://git-lfs';

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface FillResult {
  ok: boolean;
  /** where the bytes came from, or why it failed */
  detail: string;
  from?: 'seed' | 'download';
}

/**
 * Put one pinned file into the store: from the seed when its copy has the pinned sha256, else
 * (unless `download` is false) downloaded at the pinned commit (an LFS pointer is followed to the
 * media URL). The bytes are verified before they are written; a wrong file is never stored.
 */
export async function fillStoreFile(o: { root: string; lib: Pick<LibraryEntry, 'id' | 'commit' | 'repo'>; file: LibraryFile; seed?: string; fetch?: Fetcher; download?: boolean }): Promise<FillResult> {
  const dest = libraryFilePath(libraryDir(o.root, o.lib.id, o.lib.commit), o.file.path);
  const matches = (b: Uint8Array) => b.length === o.file.bytes && sha256(b) === o.file.sha256;
  let seedNote = 'no seed';
  if (o.seed) {
    const from = libraryFilePath(o.seed, o.file.path);
    if (!existsSync(from)) seedNote = 'not in the seed';
    else {
      const b = readFileSync(from);
      if (matches(b)) {
        writeFileAtomic(dest, b);
        return { ok: true, from: 'seed', detail: 'copied from the seed' };
      }
      seedNote = "the seed's copy has another sha256";
    }
  }
  if (o.download === false) return { ok: false, detail: `${seedNote}, and downloads are off` };
  const urls = githubUrls(o.lib.repo, o.lib.commit, o.file.path);
  if (!urls) return { ok: false, detail: `${seedNote}, and ${o.lib.repo} is not a GitHub repository to download from` };
  const get = o.fetch ?? (fetch as Fetcher);
  try {
    let res = await get(urls.raw);
    if (!res.ok) return { ok: false, detail: `${seedNote}; download failed (HTTP ${res.status})` };
    let body = new Uint8Array(await res.arrayBuffer());
    if (new TextDecoder().decode(body.subarray(0, LFS_POINTER.length)) === LFS_POINTER) {
      res = await get(urls.lfs);
      if (!res.ok) return { ok: false, detail: `${seedNote}; LFS download failed (HTTP ${res.status})` };
      body = new Uint8Array(await res.arrayBuffer());
    }
    if (!matches(body)) return { ok: false, detail: `${seedNote}; the downloaded file is not the pinned one (${body.length} bytes, sha256 ${sha256(body).slice(0, 12)})` };
    writeFileAtomic(dest, body);
    return { ok: true, from: 'download', detail: 'downloaded' };
  } catch (e) {
    return { ok: false, detail: `${seedNote}; download failed: ${(e as Error).message}` };
  }
}

/**
 * Why a seed checkout cannot stand in for a library at `commit`, or null when it can: git must
 * confirm that the folder is the root of a checkout whose HEAD is that commit, with no modified
 * tracked file (a sparse checkout is fine). Only then are its bytes the upstream bytes the pin
 * will name; a folder git cannot vouch for is never pinned from. Read-only git.
 */
export async function seedProblem(seed: string, commit: string): Promise<string | null> {
  if (!existsSync(seed)) return 'the folder does not exist';
  const git = (args: string[]) => exec('git', args, { cwd: seed, timeoutMs: 60_000 }).catch(() => null);
  const rev = await git(['rev-parse', '--show-toplevel', 'HEAD']);
  const [top, head] = rev?.code === 0 ? rev.stdout.trim().split(/\r?\n/) : [];
  if (!top || !head) return 'it is not a git checkout, so its commit cannot be confirmed';
  if (relative(resolve(seed), resolve(top)) !== '') return 'it is a subfolder of a git checkout, not the root of the library';
  if (head !== commit) return `it is at commit ${head.slice(0, 12)}, the library is pinned at ${commit.slice(0, 12)}`;
  const status = await git(['status', '--porcelain', '--untracked-files=no']);
  if (status?.code !== 0) return 'git status failed in it';
  if (status.stdout.trim()) return 'it has modified tracked files';
  return null;
}
