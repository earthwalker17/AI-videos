// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/host.ts
/**
 * Free memory and the guard that runs before a heavy job. On Windows the commit headroom
 * (commit limit − committed) matters as much as free RAM: a browser plus an encoder can fail
 * to allocate with "free" RAM left when the page file is nearly exhausted.
 *
 * "Available" = what new allocations get without swapping: Windows available memory (free +
 * standby), Linux MemAvailable, macOS free + inactive + speculative + purgeable pages. That is
 * os.freemem() on Windows, but on macOS os.freemem() counts free pages only (often under
 * 1.5 GB on a healthy Mac), so the guard and the in-run checks read vm_stat there.
 */
import { readFileSync } from 'node:fs';
import { freemem, totalmem } from 'node:os';
import type { Log } from '../util/log.ts';
import { exec, powershell } from '../util/proc.ts';

const MB = 1024 * 1024;

export interface HostMemory {
  /** memory available to new allocations (free + reclaimable cache), MB */
  availMB: number;
  totalMB: number;
  /** commit limit − committed, MB; null where it is not a constraint or not measurable */
  commitFreeMB: number | null;
}

/** Available MB from `vm_stat` output (page size from its header); null when it does not parse. */
export function parseVmStat(text: string): number | null {
  const page = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
  if (!(page > 0)) return null;
  const pages = (name: string) => Number(new RegExp(`^Pages ${name}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? NaN);
  const [free, inactive, speculative, purgeable] = ['free', 'inactive', 'speculative', 'purgeable'].map(pages);
  if (!Number.isFinite(free) || !Number.isFinite(inactive)) return null;
  const sum = free + inactive + (Number.isFinite(speculative) ? speculative : 0) + (Number.isFinite(purgeable) ? purgeable : 0);
  return Math.round((sum * page) / MB);
}

function linuxMeminfo(): Map<string, number> {
  return new Map(
    readFileSync('/proc/meminfo', 'utf8')
      .split('\n')
      .map((l) => /^(\w+):\s+(\d+)/.exec(l))
      .filter((m) => m !== null)
      .map((m) => [m[1], Number(m[2]) / 1024] as const),
  );
}

/**
 * Available memory, MB: the same measure as hostMemory().availMB, cheap enough for a check
 * every few frames (hostMemory runs a CIM query on Windows).
 */
export async function availableMB(): Promise<number> {
  const fallback = Math.round(freemem() / MB);
  if (process.platform === 'darwin') {
    const r = await exec('vm_stat', [], { timeoutMs: 10_000 }).catch(() => null);
    const mb = r?.code === 0 ? parseVmStat(r.stdout) : null;
    return mb === null ? fallback : Math.min(mb, Math.round(totalmem() / MB));
  }
  if (process.platform === 'linux') {
    try {
      return Math.round(linuxMeminfo().get('MemAvailable') ?? fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Current host memory. Windows: one CIM query; Linux: /proc/meminfo; macOS: vm_stat. */
export async function hostMemory(): Promise<HostMemory> {
  const fallback: HostMemory = { availMB: Math.round(freemem() / MB), totalMB: Math.round(totalmem() / MB), commitFreeMB: null };
  if (process.platform === 'win32') {
    const out = await powershell('$o = Get-CimInstance Win32_OperatingSystem; "$($o.FreePhysicalMemory) $($o.FreeVirtualMemory) $($o.TotalVisibleMemorySize)"', { timeoutMs: 20_000 });
    const [free, virt, total] = (out ?? '').split(/\s+/).map(Number);
    if (!(free > 0 && virt > 0 && total > 0)) return fallback;
    return { availMB: Math.round(free / 1024), totalMB: Math.round(total / 1024), commitFreeMB: Math.round(virt / 1024) };
  }
  if (process.platform === 'linux') {
    try {
      const kv = linuxMeminfo();
      // commit accounting only binds under strict overcommit (vm.overcommit_memory = 2)
      const strict = readFileSync('/proc/sys/vm/overcommit_memory', 'utf8').trim() === '2';
      return {
        availMB: Math.round(kv.get('MemAvailable') ?? fallback.availMB),
        totalMB: Math.round(kv.get('MemTotal') ?? fallback.totalMB),
        commitFreeMB: strict ? Math.round((kv.get('CommitLimit') ?? 0) - (kv.get('Committed_AS') ?? 0)) : null,
      };
    } catch {
      return fallback;
    }
  }
  // macOS has no commit limit to run into (it compresses and swaps instead)
  if (process.platform === 'darwin') return { ...fallback, availMB: await availableMB() };
  return fallback;
}

export const fmtMem = (m: HostMemory): string => `${m.availMB} MB available of ${m.totalMB} MB${m.commitFreeMB !== null ? `, ${m.commitFreeMB} MB commit headroom` : ''}`;

export interface GuardOptions {
  minFreeMB: number;
  /** default: minFreeMB */
  minCommitMB?: number;
  /** how long to wait for memory before giving up (0 = check once) */
  waitMs?: number;
  pollMs?: number;
  label?: string;
  log?: Log;
}

/** Wait (bounded) until free RAM and commit headroom clear the thresholds. Never throws. */
export async function waitForMemory(o: GuardOptions): Promise<{ ok: boolean; mem: HostMemory }> {
  const minCommit = o.minCommitMB ?? o.minFreeMB;
  const low = (m: HostMemory) => m.availMB < o.minFreeMB || (m.commitFreeMB !== null && m.commitFreeMB < minCommit);
  const start = Date.now();
  let lastLog = 0;
  let mem = await hostMemory();
  while (low(mem)) {
    if (Date.now() - start >= (o.waitMs ?? 0)) return { ok: false, mem };
    if (Date.now() - lastLog > 15_000) {
      o.log?.info(`waiting for memory${o.label ? ` before ${o.label}` : ''}: ${fmtMem(mem)} (need ${o.minFreeMB} MB${mem.commitFreeMB !== null ? ` / ${minCommit} MB commit` : ''})`);
      lastLog = Date.now();
    }
    await new Promise((r) => setTimeout(r, o.pollMs ?? 5000));
    mem = await hostMemory();
  }
  return { ok: true, mem };
}

/**
 * Stop the opted-in background apps (aiv.local.json sweepApps) that have no open window; an app
 * with a window is in use and is left alone. Windows only. Names arrive through an environment
 * variable, never spliced into the script.
 */
export async function sweepBackgroundApps(names: readonly string[]): Promise<{ stopped: string[]; skipped: string[] }> {
  if (process.platform !== 'win32' || !names.length) return { stopped: [], skipped: [] };
  const script =
    "$r = @(); foreach ($n in ($env:AIV_SWEEP -split '\\|')) { if (-not $n) { continue }; $ps = @(Get-Process -Name $n -ErrorAction SilentlyContinue); if (-not $ps.Count) { continue }; " +
    'if (@($ps | Where-Object { $_.MainWindowHandle -ne 0 }).Count) { $r += "skip:$n" } else { $ps | Stop-Process -Force -ErrorAction SilentlyContinue; $r += "stop:$n x$($ps.Count)" } }; $r -join \'|\'';
  const out = (await powershell(script, { timeoutMs: 30_000, env: { ...process.env, AIV_SWEEP: names.join('|') } })) ?? '';
  const parts = out ? out.split('|') : [];
  return { stopped: parts.filter((p) => p.startsWith('stop:')).map((p) => p.slice(5)), skipped: parts.filter((p) => p.startsWith('skip:')).map((p) => p.slice(5)) };
}

/** The largest processes by private memory, for an actionable low-memory message (Windows; [] elsewhere). */
export async function topConsumers(n = 6): Promise<string[]> {
  const out = await powershell(
    `Get-Process | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{ N=$_.Name; C=$_.Count; P=[math]::Round(($_.Group | Measure-Object PrivateMemorySize64 -Sum).Sum/1MB) } } | Sort-Object P -Descending | Select-Object -First ${Math.floor(n)} | ForEach-Object { "$($_.N) x$($_.C) $($_.P) MB" }`,
  );
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}
