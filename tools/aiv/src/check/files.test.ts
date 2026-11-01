// File-level checks. Leak-shaped fixtures are assembled at runtime so this file itself stays clean.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { exec } from '@aiv/pipeline';
import { docs, hygiene, MAX_FILE_BYTES, privacy, provenance, stagedSource } from './files.ts';

const root = mkdtempSync(join(tmpdir(), 'aiv-files-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (rel: string, content: string | Buffer) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), content);
  return rel;
};

describe('hygiene', () => {
  it('flags big files, reserved names, case twins, odd endings and env files', () => {
    const files = [
      put('big.bin', Buffer.alloc(MAX_FILE_BYTES + 1)),
      put('docs/aux.md', 'x'),
      put('A.md', 'x'),
      put('sub/trailing./x.md', 'x'),
      put('.env.local', 'x'),
      put('.env.example', 'x'),
      put('ok/fine.ts', 'x'),
    ];
    const msgs = hygiene(root, files).map((i) => `${i.file}: ${i.message}`);
    expect(msgs.some((m) => m.startsWith('big.bin') && /over the 2 MiB/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('docs/aux.md') && /reserved/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('sub/trailing./x.md') && /breaks on Windows/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('.env.local') && /never committed/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('.env.example') || m.startsWith('ok/fine.ts'))).toBe(false);
  });

  it('flags paths that differ only in case', () => {
    // both names must exist on a case-sensitive file system (on Windows and macOS they are one file)
    put('Case.md', 'x');
    put('case.md', 'x');
    expect(hygiene(root, ['Case.md', 'case.md']).some((i) => /only in case/.test(i.message))).toBe(true);
  });
});

describe('privacy', () => {
  const user = ['C:', 'Users', 'jdoe', 'x'].join('/');
  const home = ['', 'home', 'jdoe', 'x'].join('/');
  const aws = `AKIA${'Q'.repeat(16)}`;
  const gh = `ghp_${'a1'.repeat(18)}`;
  const anthropic = `sk-ant-${'x'.repeat(24)}`;
  const mail = ['someone', 'gmail.com'].join('@');

  it('finds user paths, keys and e-mail addresses; allows placeholders and the allow marker', () => {
    const f = put(
      'leaky.ts',
      [
        `const a = '${user}';`,
        `const b = '${home}';`,
        `const k = '${aws}';`,
        `const t = '${gh}';`,
        `const s = '${anthropic}';`,
        `// ${mail}`,
        `const fine = '${['C:', 'Users', 'someone', 'x'].join('/')}'; // placeholder user`,
        `const ok = '${user}'; // aiv:allow-private`,
        '// noreply@anthropic.com and git@github.com are fine',
      ].join('\n'),
    );
    const found = privacy(root, [f]).map((i) => `${i.line} ${i.message.split(':')[0]}`);
    expect(found).toEqual(['1 a user profile path', '2 a home folder path', '3 an AWS access key', '4 a GitHub token', '5 an Anthropic API key', '6 an e-mail address']);
  });

  it('finds one-letter profiles, Git Bash and WSL paths and Claude project folders', () => {
    const shapes = [
      ['C:', 'Users', 'A', 'AppData'].join('\\'),
      ['', 'c', 'Users', 'jdoe', 'x'].join('/'),
      ['', 'mnt', 'c', 'Users', 'jdoe', 'x'].join('/'),
      ['C-', 'Users', 'jdoe', 'Desktop'].join('-'),
    ];
    expect(privacy(root, [put('shapes.md', shapes.map((s) => `\`${s}\``).join('\n'))]).map((i) => i.line)).toEqual([1, 2, 3, 4]);
    const fine = [['C:', 'Users', 'x', 'y'].join('/'), ['', 'c', 'Users', 'someone'].join('/')];
    expect(privacy(root, [put('fine.md', fine.join('\n'))])).toEqual([]);
  });

  it('skips binary files', () => {
    expect(privacy(root, [put('img.png', `${user}\0`)])).toEqual([]);
  });

  it('reads the staged blob, not the working copy', async () => {
    expect((await exec('git', ['init', '-q'], { cwd: root })).code).toBe(0);
    put('staged.md', `\`${user}\``);
    expect((await exec('git', ['add', 'staged.md'], { cwd: root })).code).toBe(0);
    put('staged.md', 'clean now, but the index still holds the path');
    const src = await stagedSource(root, ['staged.md']);
    expect(privacy(root, ['staged.md'], src)).toHaveLength(1);
    expect(privacy(root, ['staged.md'])).toHaveLength(0);
  });
});

// REUSE-IgnoreStart: fixtures with SPDX tags
describe('provenance', () => {
  it('needs an SPDX header and a NOTICE entry by full path; NOTICE paths must exist', () => {
    put('NOTICE.md', '| `packages/x/src/listed.ts` | up |\n| `packages/x/src/gone.ts` | up |\n');
    const listed = put('packages/x/src/listed.ts', '// SPDX-License-Identifier: MIT\n// Adapted from https://example.org/a.ts\n');
    const unlisted = put('packages/x/src/unlisted.ts', '// Adapted from https://example.org/b.ts\n');
    const msgs = provenance(root, [listed, unlisted], [listed, unlisted]).map((i) => `${i.file}: ${i.message}`);
    expect(msgs).toEqual([
      'packages/x/src/unlisted.ts: adapted file without an SPDX-License-Identifier header',
      'packages/x/src/unlisted.ts: adapted file not listed (by full path) in NOTICE.md',
      'NOTICE.md: lists packages/x/src/gone.ts, which does not exist',
    ]);
  });
});

// REUSE-IgnoreEnd

describe('docs', () => {
  it('flags unknown aiv commands in code and broken relative links, not external ones', () => {
    put('docs/target.md', '# t');
    const f = put('docs/page.md', ['Run `pnpm aiv render x` and `aiv frobnicate`.', '', 'See [t](target.md#a), [gone](missing.md), [web](https://example.org) and [top](#x).'].join('\n'));
    expect(docs(root, [f], ['render']).map((i) => i.message)).toEqual(['names `aiv frobnicate`, which is not a command (aiv --help)', 'links to missing.md, which does not exist']);
  });
});
