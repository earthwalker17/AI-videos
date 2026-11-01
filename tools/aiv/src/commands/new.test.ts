// aiv new → aiv check --fix → aiv check on a scratch repository: a new video is a clean slot.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT } from '@aiv/core';
import { exec } from '@aiv/pipeline';
import { main } from '../cli.ts';
import { STUB_MARKER } from '../slot/gates.ts';

const realRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'aiv-new-'));
const saved = { ...process.env };
const put = (rel: string, text: string) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

beforeAll(async () => {
  put('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\ncatalog:\n  zod: 4.6.7\n");
  put('pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
  put('package.json', '{ "engines": { "node": ">=24.11" }, "packageManager": "pnpm@11.1.3" }\n');
  put('tsconfig.json', '{\n  "extends": "./tsconfig.base.json"\n}\n');
  put('README.md', '# R\n\n<!-- aiv:generated catalog -->\n<!-- /aiv:generated -->\n');
  for (const d of ['CLAUDE.md', 'docs/ROADMAP.md', 'docs/ARCHITECTURE.md', 'docs/LICENSING.md', 'knowledge/README.md']) put(d, '# Doc\n');
  put('docs/PRODUCTION.md', '# P\n\n<!-- aiv:generated gates -->\n<!-- /aiv:generated -->\n');
  put('docs/ENVIRONMENT.md', '# E\n\n<!-- aiv:generated versions -->\n<!-- /aiv:generated -->\n');
  put('engines/web/ENGINE.md', '# Web engine\n\nCaptures pages.\n');
  put('templates/web/video.json', JSON.stringify({ slug: 'template-web', title: 'Web template', engine: 'web', entry: 'src/index.html', format: { width: 640, height: 360, fps: 30 } }));
  put('templates/web/README.md', '# Web template\n');
  put('templates/web/src/index.html', '<canvas></canvas>\n');
  cpSync(join(realRoot, 'templates/_video'), join(root, 'templates/_video'), { recursive: true });
  put('series/concept-viz/series.json', JSON.stringify({ schemaVersion: 1, id: 'concept-viz', title: 'Concepts', summary: 'Ideas made visible.', status: 'active', factsRequired: true, defaults: { languages: ['en', 'zh-Hans'] } }));
  put('series/concept-viz/SERIES.md', '# Concepts\n\nIdeas made visible.\n');
  expect((await exec('git', ['init', '-q'], { cwd: root })).code).toBe(0);
  process.env.AIV_ROOT = root;
});

afterAll(() => {
  process.env = saved;
  rmSync(root, { recursive: true, force: true });
});

const run = async (...argv: string[]) => {
  const out: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')));
  const err = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')));
  try {
    return { code: await main(argv), out: out.join('\n') };
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
};

describe('aiv new', () => {
  it('creates a slot from the template, the stage stubs and the series defaults, without touching the lockfile', async () => {
    const lock = read('pnpm-lock.yaml');
    const r = await run('new', 'first-light', '--engine', 'web', '--series', 'concept-viz', '--title', 'First Light');
    expect(r.code, r.out).toBe(EXIT.OK);
    const v = JSON.parse(read('videos/first-light/video.json'));
    expect(v).toMatchObject({ $schema: '../../schemas/video.v1.json', number: 1, slug: 'first-light', title: 'First Light', series: 'concept-viz', status: 'idea', engine: 'web', entry: 'src/index.html', languages: ['en', 'zh-Hans'] });
    expect(existsSync(join(root, 'videos/first-light/src/index.html'))).toBe(true);
    expect(read('videos/first-light/README.md')).toContain(STUB_MARKER);
    expect(read('videos/first-light/README.md')).toContain('# First Light');
    expect(read('videos/first-light/BRIEF.md')).toContain('# Brief: First Light');
    expect(existsSync(join(root, 'videos/first-light/sources.jsonl'))).toBe(true);
    expect(read('pnpm-lock.yaml')).toBe(lock);
  });

  it('numbers videos in sequence', async () => {
    expect((await run('new', 'second-one', '--engine', 'web')).code).toBe(EXIT.OK);
    expect(JSON.parse(read('videos/second-one/video.json'))).toMatchObject({ number: 2, series: null, languages: ['en'] });
  });

  it('refuses taken, malformed or reserved slugs and unknown engines or series', async () => {
    for (const argv of [
      ['first-light', '--engine', 'web'],
      ['Bad_Slug', '--engine', 'web'],
      ['nul', '--engine', 'web'],
      ['third', '--engine', 'manim'],
      ['third', '--engine', 'web', '--series', 'nope'],
      ['third'],
    ])
      expect((await run('new', ...argv)).code, argv.join(' ')).toBe(EXIT.USAGE);
  });

  it('a fresh slot passes aiv check once the generated files are regenerated', async () => {
    expect((await run('check')).code).toBe(EXIT.ERROR);
    expect((await run('check', '--fix')).code).toBe(EXIT.OK);
    const r = await run('check');
    expect(r.code, r.out).toBe(EXIT.OK);
    expect(read('README.md')).toContain('[First Light](videos/first-light/README.md)');
    expect(JSON.parse(read('catalog.json')).videos.map((x: { slug: string }) => x.slug)).toEqual(['first-light', 'second-one']);
  });

  it('--staged checks the staged copy of generated files, not only the working tree', async () => {
    expect((await exec('git', ['add', '-A'], { cwd: root })).code).toBe(0);
    expect((await run('check', '--staged')).code).toBe(EXIT.OK);
    expect((await run('new', 'third-one', '--engine', 'web')).code).toBe(EXIT.OK);
    expect((await run('check', '--fix')).code).toBe(EXIT.OK);
    const r = await run('check', '--staged');
    expect(r.code).toBe(EXIT.ERROR);
    expect(r.out).toMatch(/catalog.json is regenerated but not staged/);
    expect((await exec('git', ['add', '-A'], { cwd: root })).code).toBe(0);
    expect((await run('check', '--staged')).code).toBe(EXIT.OK);
  });

  it('a claimed status must meet its gates', async () => {
    const file = 'videos/second-one/video.json';
    writeFileSync(join(root, file), read(file).replace('"status": "idea"', '"status": "brief"'));
    const r = await run('check');
    expect(r.code).toBe(EXIT.ERROR);
    expect(r.out).toMatch(/status 'brief' needs: BRIEF.md is still the stub/);
  });
});
