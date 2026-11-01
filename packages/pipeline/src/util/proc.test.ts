import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { exec, resolveSpawn, which } from './proc.ts';

const WIN = process.platform === 'win32';
const dir = mkdtempSync(join(tmpdir(), 'aiv proc '));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// arguments that break naive quoting in cmd.exe and in the MSVCRT parser
const HOSTILE = ['plain', 'a b', 'x&y', 'pipe|x', 'q"uote', '"', '(paren)', 'trail\\', 'back\\"slash', 'semi;colon', '<in>', '^caret', '50%', 'comma,x', 'star*', ''];

describe('proc', () => {
  it('which resolves executables on PATH', () => {
    expect(which('node')).toMatch(/node(\.exe)?$/i);
    expect(which('aiv-no-such-command-xyz')).toBeNull();
  });

  it('passes arguments verbatim to a plain executable', async () => {
    const r = await exec(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', ...HOSTILE]);
    expect(JSON.parse(r.stdout)).toEqual(HOSTILE);
  });

  it.runIf(WIN)('passes arguments verbatim through a .cmd shim (cmd.exe /d /s /c)', async () => {
    writeFileSync(join(dir, 'args.cjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)))');
    // the shape of npm/pnpm shims: forward %* to node
    writeFileSync(join(dir, 'echo-args.cmd'), '@node "%~dp0args.cjs" %*\r\n');
    const shim = join(dir, 'echo-args.cmd');
    expect(resolveSpawn(shim, ['x']).file).toMatch(/cmd(\.exe)?$/i);
    const r = await exec(shim, HOSTILE);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(HOSTILE);
  });
});
