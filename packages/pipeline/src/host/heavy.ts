// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/heavy.ts
/**
 * Heavy jobs, one at a time machine-wide. The order matters:
 *  1. memory guard WITHOUT the lock, so waiting for memory never blocks other agents;
 *  2. if memory is short and nobody holds the lock, the shortage may be ours (an orphaned
 *     browser of a killed render): take the lock, sweep our orphans (and opted-in background
 *     apps), re-check;
 *  3. lock → sweep our orphans (safe: no other heavy job can be running) → job → release.
 * Exit codes follow the protocol: AGAIN (75) when the lock is busy and the caller did not want
 * to wait, LOW_MEMORY (3) when memory stays short with nothing of ours left to free.
 *
 * runHeavy hands its slot to the command (AIV_HEAVY_SLOT): an aiv command run under
 * `aiv heavy` uses that slot as it is (no second guard, lock or sweep) instead of waiting for
 * its own parent.
 */
import { EXIT, type ExitCode } from '@aiv/core';
import { createLog, type Log } from '../util/log.ts';
import { killTree, spawnTool } from '../util/proc.ts';
import { repoRoot } from '../util/paths.ts';
import { onAbort } from './abort.ts';
import { keepAwake as holdAwake } from './keepAwake.ts';
import { readLocalConfig } from './localConfig.ts';
import { acquireLock, HEAVY_SLOT_ENV, inheritedSlot, lockPath, lockStatus, slotEnvValue, type LockInfo } from './lock.ts';
import { availableMB, fmtMem, sweepBackgroundApps, topConsumers, waitForMemory, type HostMemory } from './memory.ts';
import { sweepOrphans } from './orphans.ts';

export const DEFAULT_MIN_FREE_MB = 1500;

export interface HeavyOptions {
  label: string;
  /** default: AIV_MIN_FREE_MB, aiv.local.json minFreeMB, 1500 */
  minFreeMB?: number;
  minCommitMB?: number;
  /** false = never wait: a busy lock returns AGAIN at once (agent callers). Default true. */
  wait?: boolean;
  /** how long to wait for memory before the lock (default 3 min; 0 when wait is false) */
  memoryWaitMs?: number;
  /** how long to wait for the lock (default 60 min) */
  lockTimeoutMs?: number;
  root?: string;
  log?: Log;
  /** lock file override (tests) */
  lockFile?: string;
}

export type HeavySlot =
  | { ok: true; release: () => void; mem: HostMemory | null; lock: { path: string; info: LockInfo; inherited: boolean } }
  | { ok: false; exit: ExitCode; reason: string };

function minFree(o: HeavyOptions, root: string): number {
  const env = Number(process.env.AIV_MIN_FREE_MB);
  if (o.minFreeMB !== undefined) return o.minFreeMB;
  if (Number.isFinite(env) && env > 0) return env;
  return readLocalConfig(root).minFreeMB ?? DEFAULT_MIN_FREE_MB;
}

/**
 * Guard → lock → orphan sweep, for in-process heavy work (the render runner, post, qa).
 * On success the caller owns the slot until release().
 */
export async function acquireHeavy(o: HeavyOptions): Promise<HeavySlot> {
  const root = o.root ?? repoRoot();
  const log = o.log ?? createLog('heavy');
  const wait = o.wait ?? true;
  const path = o.lockFile ?? lockPath(root);
  const parent = inheritedSlot(path);
  if (parent) {
    log.info(`${o.label}: inside the heavy job ${parent.owner} (pid ${parent.pid}), using its slot`);
    return { ok: true, release: () => {}, mem: null, lock: { path, info: parent, inherited: true } };
  }
  const guardOff = process.env.AIV_MEM_GUARD === '0';
  const need = { minFreeMB: minFree(o, root), minCommitMB: o.minCommitMB, label: o.label, log };
  const recheck = () => waitForMemory({ ...need, waitMs: wait ? 30_000 : 0 });
  const lowMemory = async (mem: HostMemory): Promise<HeavySlot> => {
    const top = await topConsumers();
    return {
      ok: false,
      exit: EXIT.LOW_MEMORY,
      reason: `not enough memory for ${o.label}: ${fmtMem(mem)} (need ${need.minFreeMB} MB)${top.length ? `. Largest: ${top.join('; ')}` : ''}. Close unused apps, or lower minFreeMB deliberately.`,
    };
  };

  let guard = guardOff ? { ok: true, mem: null as HostMemory | null } : await waitForMemory({ ...need, waitMs: wait ? (o.memoryWaitMs ?? 3 * 60_000) : 0 });
  let release: (() => void) | null = null;
  let info: LockInfo | null = null;

  if (!guard.ok) {
    const st = lockStatus(path);
    if (st.held && !st.stale && !wait) return { ok: false, exit: EXIT.AGAIN, reason: `memory is short and ${st.info?.owner ?? 'another job'} holds the heavy-job lock: run again later` };
    if (!st.held || st.stale) {
      // nobody is running: anything of ours still holding memory is an orphan
      const lock = await acquireLock({ owner: o.label, wait: false, path, log });
      if (!lock.acquired) return { ok: false, exit: EXIT.AGAIN, reason: 'the heavy-job lock was taken meanwhile: run again' };
      release = lock.release;
      info = lock.info;
      await sweepOrphans({ root, log });
      const apps = readLocalConfig(root).sweepApps ?? [];
      if (apps.length) {
        const r = await sweepBackgroundApps(apps);
        if (r.stopped.length) log.info(`stopped opted-in background apps: ${r.stopped.join(', ')}`);
        if (r.skipped.length) log.info(`left running (open windows): ${r.skipped.join(', ')}`);
      }
      guard = await recheck();
      if (!guard.ok) {
        release();
        return lowMemory(guard.mem!);
      }
    }
  }

  if (!release) {
    const lock = await acquireLock({ owner: o.label, wait, timeoutMs: o.lockTimeoutMs, path, log });
    if (!lock.acquired) return { ok: false, exit: EXIT.AGAIN, reason: `the heavy-job lock is held by ${lock.holder?.owner ?? 'another job'} (pid ${lock.holder?.pid ?? '?'}): run again later` };
    release = lock.release;
    info = lock.info;
    await sweepOrphans({ root, log });
    if (!guard.ok) {
      // we waited behind another job: its memory should be back now
      guard = await recheck();
      if (!guard.ok) {
        release();
        return lowMemory(guard.mem!);
      }
    }
  }
  return { ok: true, release, mem: guard.mem, lock: { path, info: info!, inherited: false } };
}

export interface RunHeavyOptions extends HeavyOptions {
  cmd: string;
  args: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** hold a keep-awake request while the command runs (default true) */
  keepAwake?: boolean;
  /** kill the job (exit 3) when free RAM drops below this, MB (default: aiv.local.json abortFreeMB; off when unset) */
  abortFreeMB?: number;
}

/** Run an external command as a heavy job. Returns the command's own exit code, or the protocol code when it never ran. */
export async function runHeavy(o: RunHeavyOptions): Promise<number> {
  const root = o.root ?? repoRoot();
  const log = o.log ?? createLog('heavy');
  const slot = await acquireHeavy({ ...o, root, log });
  if (!slot.ok) {
    log.error(slot.reason);
    return slot.exit;
  }
  const awake = o.keepAwake === false ? () => {} : holdAwake(log);
  const abortFreeMB = o.abortFreeMB ?? readLocalConfig(root).abortFreeMB;
  log.info(`${o.label}: ${slot.mem ? fmtMem(slot.mem) : 'memory guard off'} · running ${o.cmd} ${o.args.join(' ')}`);
  try {
    // POSIX: own process group, so killTree can take the whole job down
    const env = { ...(o.env ?? process.env), [HEAVY_SLOT_ENV]: slotEnvValue(slot.lock.path, slot.lock.info) };
    const child = spawnTool(o.cmd, o.args, { stdio: 'inherit', cwd: o.cwd, env, detached: process.platform !== 'win32' });
    const unregister = onAbort(() => killTree(child.pid));
    let lowMem = false;
    const watchdog = abortFreeMB
      ? setInterval(async () => {
          const mb = await availableMB();
          if (mb < abortFreeMB && !lowMem) {
            lowMem = true;
            log.error(`free memory ${mb} MB < ${abortFreeMB} MB: stopping ${o.label}`);
            killTree(child.pid);
          }
        }, 5000)
      : null;
    const code = await new Promise<number>((resolve) => {
      child.on('error', (e) => {
        log.error(`could not start ${o.cmd}: ${e.message}`);
        resolve(EXIT.ERROR);
      });
      child.on('close', (c, sig) => resolve(c ?? (sig ? EXIT.ERROR : EXIT.OK)));
    });
    if (watchdog) clearInterval(watchdog);
    unregister();
    return lowMem ? EXIT.LOW_MEMORY : code;
  } finally {
    awake();
    slot.release();
  }
}
