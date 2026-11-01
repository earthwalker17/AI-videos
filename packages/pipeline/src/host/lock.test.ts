import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EXIT } from '@aiv/core';
import { acquireLock, expandPath, HEAVY_SLOT_ENV, inheritedSlot, lockStatus, reclaimStale, slotEnvValue } from './lock.ts';

const dir = mkdtempSync(join(tmpdir(), 'aiv-lock-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const fresh = () => join(dir, `heavy-${n++}.lock`);
const foreign = (path: string, pid: number) => writeFileSync(path, JSON.stringify({ pid, owner: 'other job', since: new Date().toISOString() }));
/** a pid that existed and is gone now */
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid!;

describe('heavy-job lock', () => {
  it('acquires with {pid, owner, since} and releases', async () => {
    const path = fresh();
    const r = await acquireLock({ owner: 'test', wait: false, path });
    expect(r.acquired).toBe(true);
    const info = JSON.parse(readFileSync(path, 'utf8'));
    expect(info).toMatchObject({ pid: process.pid, owner: 'test' });
    expect(Object.keys(info).sort()).toEqual(['owner', 'pid', 'since']);
    expect(lockStatus(path)).toMatchObject({ held: true, stale: false });
    if (r.acquired) r.release();
    expect(existsSync(path)).toBe(false);
  });

  it('non-blocking mode returns AGAIN while a live process holds it', async () => {
    const path = fresh();
    foreign(path, process.ppid);
    const r = await acquireLock({ owner: 'test', wait: false, path });
    expect(r).toMatchObject({ acquired: false, exit: EXIT.AGAIN, holder: { owner: 'other job', pid: process.ppid } });
    expect(existsSync(path)).toBe(true);
  });

  it('waiting mode gives up after its timeout with AGAIN', async () => {
    const path = fresh();
    foreign(path, process.ppid);
    const t = Date.now();
    const r = await acquireLock({ owner: 'test', wait: true, timeoutMs: 300, pollMs: 50, path });
    expect(r.acquired).toBe(false);
    expect(Date.now() - t).toBeGreaterThanOrEqual(300);
  });

  it('reclaims a lock of a dead process or with a stale heartbeat', async () => {
    const dead = fresh();
    foreign(dead, deadPid());
    expect(lockStatus(dead).stale).toBe(true);
    const a = await acquireLock({ owner: 'test', wait: false, path: dead });
    expect(a.acquired).toBe(true);
    if (a.acquired) a.release();

    const silent = fresh();
    foreign(silent, process.ppid);
    const old = new Date(Date.now() - 10 * 60_000);
    utimesSync(silent, old, old);
    const b = await acquireLock({ owner: 'test', wait: false, path: silent });
    expect(b.acquired).toBe(true);
    if (b.acquired) b.release();
  });

  it('expands ~, %VAR% and ${VAR} in configured lock paths', () => {
    process.env.AIV_TEST_DIR = 'X';
    try {
      expect(expandPath('%AIV_TEST_DIR%/a.lock')).toBe('X/a.lock');
      expect(expandPath('${AIV_TEST_DIR}/a.lock')).toBe('X/a.lock');
      expect(expandPath('~/a.lock')).toBe(`${homedir()}/a.lock`);
      expect(expandPath('%AIV_UNSET_VAR_XYZ%/a')).toBe('%AIV_UNSET_VAR_XYZ%/a');
    } finally {
      delete process.env.AIV_TEST_DIR;
    }
  });

  it('two reclaimers of one stale lock never delete the fresh lock the first one took', async () => {
    const path = fresh();
    foreign(path, deadPid());
    // both waiters judged the same lock stale; A reclaims first and takes a fresh lock
    const observed = lockStatus(path).info;
    expect(reclaimStale(path, observed)).toBe(true);
    const a = await acquireLock({ owner: 'A', wait: false, path });
    expect(a.acquired).toBe(true);
    // B acts on its stale observation now: it must put A's lock back, not remove it
    expect(reclaimStale(path, observed)).toBe(false);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ owner: 'A', pid: process.pid });
    expect(readdirSync(dir).filter((f) => f.includes('.reclaim-'))).toEqual([]);
    // a reclaim of a lock someone else already removed is a no-op
    if (a.acquired) a.release();
    expect(reclaimStale(path, observed)).toBe(false);
  });

  it('a holder whose lock was taken over notices it on the next heartbeat', async () => {
    const path = fresh();
    const lost: unknown[] = [];
    const r = await acquireLock({ owner: 'stalled', wait: false, path, heartbeatMs: 30, onLost: (h) => lost.push(h) });
    expect(r.acquired).toBe(true);
    // what a reclaimer does after our heartbeat went silent for 2 min: a new lock in its name
    foreign(path, process.ppid);
    await new Promise((res) => setTimeout(res, 120));
    expect(lost).toEqual([expect.objectContaining({ owner: 'other job', pid: process.ppid })]);
    if (r.acquired) r.release();
    // release leaves the new owner's lock alone
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ owner: 'other job' });
  });

  it('a child of a heavy job uses the slot AIV_HEAVY_SLOT names, and only while it is held', async () => {
    const path = fresh();
    const outer = await acquireLock({ owner: 'outer', wait: false, path });
    if (!outer.acquired) throw new Error('outer lock not acquired');
    const env = { [HEAVY_SLOT_ENV]: slotEnvValue(path, outer.info) };
    expect(inheritedSlot(path, env)).toMatchObject({ owner: 'outer', pid: process.pid });
    // another lock file, another since, or no env: not inherited
    expect(inheritedSlot(fresh(), env)).toBeNull();
    expect(inheritedSlot(path, { [HEAVY_SLOT_ENV]: slotEnvValue(path, { ...outer.info, since: '2000-01-01T00:00:00.000Z' }) })).toBeNull();
    expect(inheritedSlot(path, {})).toBeNull();
    outer.release();
    expect(inheritedSlot(path, env)).toBeNull();
  });

  it('is re-entrant within one process', async () => {
    const path = fresh();
    const outer = await acquireLock({ owner: 'outer', wait: false, path });
    const inner = await acquireLock({ owner: 'inner', wait: false, path });
    expect(outer.acquired && inner.acquired).toBe(true);
    if (inner.acquired) inner.release();
    expect(existsSync(path)).toBe(true);
    if (outer.acquired) outer.release();
    expect(existsSync(path)).toBe(false);
  });
});
