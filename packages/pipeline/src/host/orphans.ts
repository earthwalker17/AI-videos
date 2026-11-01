// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/host.ts
/**
 * Orphaned capture browsers: a killed render can leave its browser running (Windows does not
 * kill children with their parent), holding hundreds of MB and the profile's singleton lock.
 *
 * Only browsers whose --user-data-dir lies under THIS repo's .cache/browser-profiles/ are
 * touched; the user's own browser and other tools' browsers never match. Call it only while
 * holding the heavy-job lock, so it never kills another job's live capture.
 */
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Log } from '../util/log.ts';
import { exec, killTree, powershell } from '../util/proc.ts';
import { repoRoot } from '../util/paths.ts';

/** Where engines must put their browser profiles for the sweep to recognise them. */
export const browserProfilesDir = (root = repoRoot()): string => join(root, '.cache', 'browser-profiles');

export interface OrphanProcess {
  pid: number;
  name: string;
  profile: string;
}

const norm = (p: string) => {
  const r = resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? r.toLowerCase() : r;
};

/** The --user-data-dir of a command line (quoted or bare), or null. */
export function userDataDir(commandLine: string): string | null {
  const m = /--user-data-dir=(?:"([^"]+)"|(\S+))/.exec(commandLine);
  return m?.[1] ?? m?.[2] ?? null;
}

async function processesWithProfile(): Promise<{ pid: number; name: string; cmd: string }[]> {
  if (process.platform === 'win32') {
    const out = await powershell(
      `@(Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%--user-data-dir%'" | Select-Object ProcessId,Name,CommandLine) | ConvertTo-Json -Compress`,
      { timeoutMs: 30_000 },
    );
    if (!out) return [];
    const rows = JSON.parse(out) as { ProcessId: number; Name: string; CommandLine: string | null } | { ProcessId: number; Name: string; CommandLine: string | null }[];
    return (Array.isArray(rows) ? rows : [rows]).map((r) => ({ pid: r.ProcessId, name: r.Name, cmd: r.CommandLine ?? '' }));
  }
  const r = await exec('ps', ['-eo', 'pid=,args='], { timeoutMs: 15_000 });
  if (r.code !== 0) return [];
  return r.stdout
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(.*)$/.exec(l))
    .filter((m) => m !== null && m[2].includes('--user-data-dir'))
    .map((m) => ({ pid: Number(m![1]), name: m![2].split(/\s/)[0], cmd: m![2] }));
}

/** Browser processes (any name) running on a profile under .cache/browser-profiles/. */
export async function findOrphanBrowsers(root = repoRoot()): Promise<OrphanProcess[]> {
  const base = norm(browserProfilesDir(root)) + (process.platform === 'win32' ? '\\' : sep);
  const out: OrphanProcess[] = [];
  for (const p of await processesWithProfile()) {
    if (p.pid === process.pid) continue;
    const dir = userDataDir(p.cmd);
    if (dir && (norm(dir) + (process.platform === 'win32' ? '\\' : sep)).startsWith(base)) out.push({ pid: p.pid, name: p.name, profile: dir });
  }
  return out;
}

const SINGLETON_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];

/** Kill our orphaned browsers and clear their profiles' singleton locks. */
export async function sweepOrphans(opts: { root?: string; log?: Log } = {}): Promise<{ killed: number; cleaned: number }> {
  const root = opts.root ?? repoRoot();
  const orphans = await findOrphanBrowsers(root);
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
  return { killed: orphans.length, cleaned };
}
