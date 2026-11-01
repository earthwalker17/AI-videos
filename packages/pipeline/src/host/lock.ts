// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/gpuLock.ts
/**
 * One heavy-job queue for the whole machine: renders, encodes and other heavy work take this
 * lock first, so parallel agents can code concurrently but run heavy jobs one at a time (the
 * reference host has 7.6 GB RAM shared with its iGPU).
 *
 * The lock is a file created with O_EXCL holding {pid, owner, since}. The holder refreshes its
 * mtime every 15 s; a lock whose holder is dead or whose heartbeat is older than 2 min is
 * reclaimed. The file format matches MAP's gpu.lock, so aiv.local.json can point lockPath at
 * that file and the two repos never run heavy jobs at once.
 *
 * Ownership is {pid, since}: a reclaim renames the file away first (only one reclaimer can win)
 * and gives back a lock that turned out to be fresh; a holder whose heartbeat finds another
 * owner in the file stops (exit 75) instead of running next to it. A child of `aiv heavy`
 * gets AIV_HEAVY_SLOT and runs inside its parent's slot instead of waiting for it.
 */
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { EXIT } from '@aiv/core';
import type { Log } from '../util/log.ts';
import { pidAlive } from '../util/proc.ts';
import { abortProcess, onAbort } from './abort.ts';
import { readLocalConfig } from './localConfig.ts';

export const HEARTBEAT_MS = 15_000;
export const STALE_MS = 2 * 60_000;
/** Set by `aiv heavy` for its command: "<lock path>|<pid>|<since>" of the slot it holds. */
export const HEAVY_SLOT_ENV = 'AIV_HEAVY_SLOT';

export interface LockInfo {
  pid: number;
  owner: string;
  since: string;
}

/** Machine-wide default (shared by every checkout and worktree, never inside a repo). */
export function defaultLockPath(): string {
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'ai-videos', 'heavy.lock');
  if (process.platform === 'linux' && process.env.XDG_RUNTIME_DIR) return join(process.env.XDG_RUNTIME_DIR, 'ai-videos', 'heavy.lock');
  return join(tmpdir(), 'ai-videos', 'heavy.lock');
}

/** ~, %VAR% and ${VAR} expanded, so a config can name a lock without a personal absolute path. */
export function expandPath(p: string): string {
  return p
    .replace(/^~(?=$|[\\/])/, homedir())
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, k: string) => process.env[k] ?? m)
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k: string) => process.env[k] ?? m);
}

/** AIV_HEAVY_LOCK, else aiv.local.json lockPath, else the platform default. */
export function lockPath(root?: string): string {
  if (process.env.AIV_HEAVY_LOCK) return resolve(expandPath(process.env.AIV_HEAVY_LOCK));
  try {
    const cfg = readLocalConfig(root);
    if (cfg.lockPath) return resolve(expandPath(cfg.lockPath));
  } catch {
    /* an invalid local config is reported by doctor; fall back to the default here */
  }
  return defaultLockPath();
}

export interface LockStatus {
  path: string;
  held: boolean;
  /** null when free, or when the file is unreadable (being written) */
  info: LockInfo | null;
  heartbeatAgeS: number | null;
  /** held, but dead or silent past the stale limit: the next acquire reclaims it */
  stale: boolean;
}

function readInfo(path: string): LockInfo | null {
  try {
    const j = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockInfo>;
    return typeof j.pid === 'number' ? { pid: j.pid, owner: String(j.owner ?? '?'), since: String(j.since ?? '') } : null;
  } catch {
    return null;
  }
}

const sameOwner = (a: LockInfo | null, b: LockInfo | null) => !!a && !!b && a.pid === b.pid && a.since === b.since;
const samePath = (a: string, b: string) => (process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b));

export function lockStatus(path = lockPath(), staleMs = STALE_MS): LockStatus {
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return { path, held: false, info: null, heartbeatAgeS: null, stale: false };
  }
  const info = readInfo(path);
  const age = Date.now() - mtime;
  const dead = info ? info.pid !== process.pid && !pidAlive(info.pid) : false;
  return { path, held: true, info, heartbeatAgeS: Math.round(age / 1000), stale: dead || age > staleMs };
}

/** The AIV_HEAVY_SLOT value a heavy job hands to its command. */
export const slotEnvValue = (path: string, info: LockInfo): string => `${resolve(path)}|${info.pid}|${info.since}`;

/**
 * The slot this process inherited from its `aiv heavy` parent: AIV_HEAVY_SLOT names this lock,
 * and the lock still holds that parent's {pid, since} with the parent alive. Else null.
 */
export function inheritedSlot(path: string, env: NodeJS.ProcessEnv = process.env): LockInfo | null {
  const v = env[HEAVY_SLOT_ENV];
  if (!v) return null;
  const b = v.lastIndexOf('|');
  const a = v.lastIndexOf('|', b - 1);
  if (a <= 0) return null;
  const claimed = { pid: Number(v.slice(a + 1, b)), owner: '', since: v.slice(b + 1) };
  if (!samePath(v.slice(0, a), path) || !Number.isInteger(claimed.pid)) return null;
  const info = readInfo(path);
  return info && sameOwner(info, claimed) && pidAlive(info.pid) ? info : null;
}

/**
 * Remove a lock judged stale (`observed`) without racing another reclaimer: rename it to a
 * private name first (one renamer wins, the others get ENOENT), then check that it is the lock
 * that was judged. A fresh lock taken in between is given back; link() refuses to overwrite a
 * newer one, whose holder's heartbeat then sees the loss. True when the stale lock is gone.
 */
export function reclaimStale(path: string, observed: LockInfo | null): boolean {
  const mine = `${path}.reclaim-${process.pid}`;
  try {
    renameSync(path, mine);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
  const got = readInfo(mine);
  if (observed ? sameOwner(got, observed) : got === null) {
    rmSync(mine, { force: true });
    return true;
  }
  try {
    linkSync(mine, path);
  } catch (e) {
    // no hard links on this file system: put it back unless a newer lock exists
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST' && !existsLock(path)) {
      renameSync(mine, path);
      return false;
    }
  }
  rmSync(mine, { force: true });
  return false;
}

export type LockResult =
  | { acquired: true; path: string; info: LockInfo; release: () => void; /** running inside the slot of an `aiv heavy` parent */ inherited?: boolean }
  | { acquired: false; path: string; exit: typeof EXIT.AGAIN; holder: LockInfo | null };

export interface AcquireOptions {
  owner: string;
  /** false: return AGAIN at once when the lock is held (agent callers) */
  wait: boolean;
  /** give up waiting after this long (default 60 min) and return AGAIN */
  timeoutMs?: number;
  path?: string;
  log?: Log;
  pollMs?: number;
  heartbeatMs?: number;
  staleMs?: number;
  /** another job took the lock while we held it (default: log and stop this process with exit 75) */
  onLost?: (holder: LockInfo | null) => void;
}

// a process that already holds a lock path takes it again without deadlocking on itself
const holds = new Map<string, { count: number; info: LockInfo; release: () => void }>();

export async function acquireLock(o: AcquireOptions): Promise<LockResult> {
  const path = o.path ?? lockPath();
  const own = holds.get(path);
  if (own) {
    own.count++;
    let done = false;
    return {
      acquired: true,
      path,
      info: own.info,
      release: () => {
        if (done) return;
        done = true;
        if (--own.count === 0) own.release();
      },
    };
  }
  const parent = inheritedSlot(path);
  if (parent) {
    o.log?.info(`inside the heavy job ${parent.owner} (pid ${parent.pid}): using its slot`);
    // the parent keeps the heartbeat and removes the file when it ends
    return { acquired: true, path, info: parent, inherited: true, release: () => {} };
  }
  mkdirSync(dirname(path), { recursive: true });
  const start = Date.now();
  let announced = false;
  for (;;) {
    let fd: number | null = null;
    try {
      fd = openSync(path, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    if (fd !== null) {
      const info: LockInfo = { pid: process.pid, owner: o.owner, since: new Date().toISOString() };
      writeSync(fd, JSON.stringify(info));
      closeSync(fd);
      const onLost =
        o.onLost ??
        ((holder: LockInfo | null) => {
          o.log?.error(`the heavy-job lock was taken over by ${holder ? `${holder.owner} (pid ${holder.pid})` : 'another job'} while ${o.owner} held it: stopping, run again later`);
          abortProcess('heavy-job lock lost', EXIT.AGAIN);
        });
      return { acquired: true, path, info, release: holdLock(path, info, o.heartbeatMs ?? HEARTBEAT_MS, onLost, o.log) };
    }
    const st = lockStatus(path, o.staleMs ?? STALE_MS);
    if (st.held && st.stale) {
      if (reclaimStale(path, st.info)) o.log?.info(`reclaimed the stale heavy-job lock of ${st.info?.owner ?? 'unknown'} (pid ${st.info?.pid ?? '?'}, heartbeat ${st.heartbeatAgeS} s old)`);
      else o.log?.info('another job reclaimed the stale heavy-job lock first: trying again');
      continue;
    }
    if (!o.wait || Date.now() - start > (o.timeoutMs ?? 60 * 60_000)) return { acquired: false, path, exit: EXIT.AGAIN, holder: st.info };
    if (!announced) {
      o.log?.info(`waiting for the heavy-job lock held by ${st.info?.owner ?? 'another job'} (pid ${st.info?.pid ?? '?'})…`);
      announced = true;
    }
    await new Promise((r) => setTimeout(r, o.pollMs ?? 1500));
  }
}

function holdLock(path: string, info: LockInfo, heartbeatMs: number, onLost: (holder: LockInfo | null) => void, log?: Log): () => void {
  const beat = setInterval(() => {
    const now = readInfo(path);
    if (!sameOwner(now, info)) {
      // vanished (deleted by hand): take it back if nobody else did; otherwise we lost it
      if (now === null && !existsLock(path)) {
        try {
          const fd = openSync(path, 'wx');
          writeSync(fd, JSON.stringify(info));
          closeSync(fd);
          log?.warn('the heavy-job lock file vanished while held: re-created it');
          return;
        } catch {
          /* someone else was faster */
        }
      }
      clearInterval(beat);
      holds.delete(path);
      onLost(readInfo(path));
      return;
    }
    try {
      const t = new Date();
      utimesSync(path, t, t);
    } catch {
      /* removed underneath us: the next beat notices */
    }
  }, heartbeatMs);
  beat.unref();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(beat);
    if (holds.get(path)?.release === release) holds.delete(path);
    unregister();
    process.off('exit', release);
    // only remove the file if it is still ours (it may have been reclaimed after a long stall)
    if (sameOwner(readInfo(path), info)) rmSync(path, { force: true });
  };
  const unregister = onAbort(release);
  process.once('exit', release);
  const entry = { count: 1, info, release };
  holds.set(path, entry);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--entry.count === 0) release();
  };
}

function existsLock(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
