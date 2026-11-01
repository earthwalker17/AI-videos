// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/host.ts
/**
 * Orphaned capture browsers: a killed render can leave its browser running (Windows does not
 * kill children with their parent), holding hundreds of MB and the profile's singleton lock.
 *
 * Only this repo's browsers are touched; the user's own browser, other tools' browsers and
 * Remotion renders started outside aiv (Studio, `remotion render`) never match:
 *  - web engine: any process whose --user-data-dir lies under THIS repo's .cache/browser-profiles/;
 *  - Remotion engine: a process whose executable lies under THIS repo's node_modules/.remotion
 *    (the one Chrome Headless Shell Remotion downloads per repo) AND that is attributable:
 *    its temp profile (puppeteer_dev_chrome_profile-*, a prefix puppeteer and other tools share)
 *    carries the engine's owner marker for this repo; or this process launched it (an unmarked
 *    shell, such as a crash replacement, which the engine prevents); or its parent process is
 *    gone (an orphan nobody drives); or its parent is one of these (Chrome's children). A Studio
 *    render of this repo has a live parent and no marker, so it is left alone. Only the profiles
 *    of the shells killed here, and unused profiles carrying the marker, are deleted.
 * Call it only while holding the heavy-job lock, so it never kills another job's live capture.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Log } from '../util/log.ts';
import { exec, killTree, pidAlive, powershell } from '../util/proc.ts';
import { repoRoot } from '../util/paths.ts';

/** Where engines must put their browser profiles for the sweep to recognise them. */
export const browserProfilesDir = (root = repoRoot()): string => join(root, '.cache', 'browser-profiles');

/** Remotion's browser cache for this repo (it resolves it from the nearest package.json: the root). */
export const remotionBrowserDir = (root = repoRoot()): string => join(root, 'node_modules', '.remotion');

/** The temp-folder prefix of the profiles Remotion's openBrowser creates (mkdtemp). */
export const REMOTION_PROFILE_PREFIX = 'puppeteer_dev_chrome_profile-';

/** The file the Remotion engine writes into its browser's profile: the normalised repo root, so the sweep can attribute it. */
export const REMOTION_PROFILE_MARKER = 'aiv-remotion-owner.txt';

export interface OrphanProcess {
  pid: number;
  name: string;
  /** the --user-data-dir ('' when the command line carries none) */
  profile: string;
  /** which engine's browser it is */
  engine: 'web' | 'remotion';
}

const WIN = process.platform === 'win32';

const norm = (p: string) => {
  const r = resolve(p).replace(/[\\/]+$/, '');
  return WIN ? r.toLowerCase() : r;
};

/** `p` lies inside `dir` (not `dir` itself), case-insensitively on Windows. */
const inside = (p: string, dir: string) => (norm(p) + (WIN ? '\\' : sep)).startsWith(norm(dir) + (WIN ? '\\' : sep)) && norm(p) !== norm(dir);

/** The --user-data-dir of a command line (quoted or bare), or null. */
export function userDataDir(commandLine: string): string | null {
  const m = /--user-data-dir=(?:"([^"]+)"|(\S+))/.exec(commandLine);
  return m?.[1] ?? m?.[2] ?? null;
}

/** The owner-marker text the Remotion engine writes for `root` (the normalised root path). */
export const profileOwner = (root: string): string => norm(root);

/** The profile folder carries the Remotion engine's owner marker for this repo. */
export function ownedProfile(dir: string, root: string): boolean {
  try {
    return readFileSync(join(dir, REMOTION_PROFILE_MARKER), 'utf8').trim() === profileOwner(root);
  } catch {
    return false;
  }
}

export interface ProcRow {
  pid: number;
  name: string;
  cmd: string;
  /** executable path ('' when unknown) */
  exe: string;
  /** parent pid (undefined when unknown) */
  ppid?: number;
}

async function browserProcesses(): Promise<ProcRow[]> {
  if (WIN) {
    // headless-shell children may lack --user-data-dir: match them by executable name too
    const out = await powershell(
      `@(Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%--user-data-dir%' OR Name = 'chrome-headless-shell.exe' OR Name = 'headless_shell.exe'" | Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath) | ConvertTo-Json -Compress`,
      { timeoutMs: 30_000 },
    );
    if (!out) return [];
    type Row = { ProcessId: number; ParentProcessId?: number; Name: string; CommandLine: string | null; ExecutablePath: string | null };
    const rows = JSON.parse(out) as Row | Row[];
    return (Array.isArray(rows) ? rows : [rows]).map((r) => ({ pid: r.ProcessId, ppid: r.ParentProcessId, name: r.Name, cmd: r.CommandLine ?? '', exe: r.ExecutablePath ?? '' }));
  }
  const r = await exec('ps', ['-eo', 'pid=,ppid=,args='], { timeoutMs: 15_000 });
  if (r.code !== 0) return [];
  return r.stdout
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l))
    .filter((m) => m !== null && (m[3].includes('--user-data-dir') || m[3].includes('.remotion')))
    .map((m) => ({ pid: Number(m![1]), ppid: Number(m![2]), name: m![3].split(/\s/)[0], cmd: m![3], exe: m![3].split(/\s/)[0] }));
}

/** This repo's browser processes: web profiles under .cache/browser-profiles/, attributable Remotion headless shells (see the header). */
export async function findOrphanBrowsers(root = repoRoot()): Promise<OrphanProcess[]> {
  return classify(await browserProcesses(), root);
}

export interface ClassifyOptions {
  /** this process (default process.pid): shells it launched are ours */
  self?: number;
  /** is a pid alive (default: a signal-0 probe; pid 1 counts as gone, POSIX reparents orphans to it) */
  alive?: (pid: number) => boolean;
  /** does a profile carry our owner marker (default: read the marker file) */
  owned?: (profile: string) => boolean;
}

/** Which of these processes are this repo's browsers (exported for tests). */
export function classify(rows: readonly ProcRow[], root: string, o: ClassifyOptions = {}): OrphanProcess[] {
  const self = o.self ?? process.pid;
  const alive = o.alive ?? ((pid: number) => pid > 1 && pidAlive(pid));
  const owned = o.owned ?? ((dir: string) => ownedProfile(dir, root));
  const shells = rows.filter((p) => p.pid !== self && p.exe && inside(p.exe, remotionBrowserDir(root)));
  const shellPids = new Set(shells.map((p) => p.pid));
  const ours = new Set<number>();
  for (const p of shells) {
    const dir = userDataDir(p.cmd);
    const orphaned = p.ppid !== undefined && !shellPids.has(p.ppid) && !alive(p.ppid);
    if ((dir && owned(dir)) || p.ppid === self || orphaned) ours.add(p.pid);
  }
  // Chrome's children follow their browser process
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of shells) {
      if (!ours.has(p.pid) && p.ppid !== undefined && ours.has(p.ppid)) {
        ours.add(p.pid);
        grew = true;
      }
    }
  }
  const out: OrphanProcess[] = [];
  for (const p of rows) {
    if (p.pid === self) continue;
    const dir = userDataDir(p.cmd);
    if (shellPids.has(p.pid)) {
      if (ours.has(p.pid)) out.push({ pid: p.pid, name: p.name, profile: dir ?? '', engine: 'remotion' });
    } else if (dir && inside(dir, browserProfilesDir(root))) out.push({ pid: p.pid, name: p.name, profile: dir, engine: 'web' });
  }
  return out;
}

/**
 * Remotion profiles in the temp folder that are safely ours and no longer used: the profile of
 * a headless shell just killed, or one carrying our owner marker for this repo that no live
 * process uses. Never a bare puppeteer_dev_chrome_profile-* of another tool.
 */
export function staleRemotionProfiles(root: string, o: { tmp?: string; killed?: readonly string[]; busy?: readonly string[] } = {}): string[] {
  const tmp = o.tmp ?? tmpdir();
  if (!existsSync(tmp)) return [];
  const killed = new Set((o.killed ?? []).filter(Boolean).map(norm));
  const busy = new Set((o.busy ?? []).filter(Boolean).map(norm));
  const out: string[] = [];
  for (const name of readdirSync(tmp)) {
    if (!name.startsWith(REMOTION_PROFILE_PREFIX)) continue;
    const dir = join(tmp, name);
    if (busy.has(norm(dir))) continue;
    if (killed.has(norm(dir)) || ownedProfile(dir, root)) out.push(dir);
  }
  return out;
}

const SINGLETON_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];

/** Kill our orphaned browsers, clear the web profiles' singleton locks and delete Remotion's stale temp profiles. */
export async function sweepOrphans(opts: { root?: string; log?: Log } = {}): Promise<{ killed: number; cleaned: number }> {
  const root = opts.root ?? repoRoot();
  const rows = await browserProcesses();
  const orphans = classify(rows, root);
  for (const o of orphans) killTree(o.pid);
  if (orphans.length) opts.log?.info(`killed ${orphans.length} orphaned capture browser process(es)`);
  let cleaned = 0;
  const dir = browserProfilesDir(root);
  if (existsSync(dir)) {
    for (const profile of readdirSync(dir)) {
      for (const f of SINGLETON_FILES) {
        const p = join(dir, profile, f);
        try {
          // lstat, not exists: SingletonLock is a (dangling) symlink on Linux
          lstatSync(p);
        } catch {
          continue;
        }
        try {
          rmSync(p, { force: true });
          cleaned++;
        } catch {
          /* held by a live process: leave it */
        }
      }
    }
  }
  const killedPids = new Set(orphans.map((o) => o.pid));
  const busy = rows.filter((r) => !killedPids.has(r.pid)).map((r) => userDataDir(r.cmd) ?? '');
  const killedProfiles = orphans.filter((o) => o.engine === 'remotion').map((o) => o.profile);
  for (const p of staleRemotionProfiles(root, { killed: killedProfiles, busy })) {
    try {
      // a just-killed Chrome releases its files a moment later on Windows
      rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      cleaned++;
    } catch {
      /* still held: the next sweep gets it */
    }
  }
  return { killed: orphans.length, cleaned };
}
