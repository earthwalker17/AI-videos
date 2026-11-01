import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EXIT } from '@aiv/core';
import { tempRepo } from '../testing.ts';
import { silentLog } from '../util/log.ts';
import { runHeavy } from './heavy.ts';

const dir = mkdtempSync(join(tmpdir(), 'aiv-heavy-'));
const repo = tempRepo();
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  repo.cleanup();
});

const base = { root: repo.root, minFreeMB: 1, keepAwake: false, log: silentLog() };

describe('runHeavy', () => {
  it('runs the command under the lock and passes its exit code through', async () => {
    const lockFile = join(dir, 'a.lock');
    const marker = join(dir, 'ran.txt');
    const code = await runHeavy({ ...base, lockFile, label: 'test', cmd: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, String(require('fs').existsSync(${JSON.stringify(lockFile)})));process.exit(7)`] });
    expect(code).toBe(7);
    // the child saw the lock held; it is gone after
    expect(readFileSync(marker, 'utf8')).toBe('true');
    expect(existsSync(lockFile)).toBe(false);
  });

  it('returns AGAIN without running anything when the lock is busy and waiting is off', async () => {
    const lockFile = join(dir, 'b.lock');
    writeFileSync(lockFile, JSON.stringify({ pid: process.ppid, owner: 'other job', since: new Date().toISOString() }));
    const marker = join(dir, 'never.txt');
    const code = await runHeavy({ ...base, lockFile, wait: false, label: 'test', cmd: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`] });
    expect(code).toBe(EXIT.AGAIN);
    expect(existsSync(marker)).toBe(false);
  });

  it('returns LOW_MEMORY when memory stays short and nothing of ours can be freed', async () => {
    const lockFile = join(dir, 'c.lock');
    const code = await runHeavy({ ...base, lockFile, wait: false, minFreeMB: 10_000_000, label: 'test', cmd: process.execPath, args: ['-e', '0'] });
    expect(code).toBe(EXIT.LOW_MEMORY);
    expect(existsSync(lockFile)).toBe(false);
  });

  it('reports a command that cannot start', async () => {
    const code = await runHeavy({ ...base, lockFile: join(dir, 'd.lock'), label: 'test', cmd: 'aiv-no-such-command-xyz', args: [] });
    expect(code).toBe(EXIT.ERROR);
  });
});
