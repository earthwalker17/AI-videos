// The CLI over a scratch repo: post → qa → release → release verify, plus usage handling.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT } from '@aiv/core';
import { fakeAdapter, PROFILES, resolveTarget, runRender, silentLog, tempRepo, type TempRepo } from '@aiv/pipeline';
import { main } from './cli.ts';

let repo: TempRepo;
const saved = { ...process.env };

beforeAll(async () => {
  repo = tempRepo({
    audio: { tracks: [{ source: 'lavfi:sine=f=330:r=48000' }] },
    qa: { swatchFrames: [5, 15], loudness: { integrated: -14, tolerance: 1, truePeakMax: -1 } },
  });
  // the scratch repo, a private lock and no memory guard: the test must not touch the machine-wide state
  process.env.AIV_ROOT = repo.root;
  process.env.AIV_HEAVY_LOCK = join(repo.root, 'heavy.lock');
  process.env.AIV_MEM_GUARD = '0';
  process.env.AIV_QUIET = '1';
  const target = resolveTarget('demo', repo.root);
  const r = await runRender({ target, profile: { ...PROFILES.final, chunkFrames: 20 }, adapter: fakeAdapter({ frames: 45, swatchFrames: [5, 15] }), log: silentLog(), keepAwake: false, minDiskMB: 1 });
  expect(r.exit, r.message).toBe(EXIT.OK);
});

afterAll(() => {
  process.env = saved;
  repo?.cleanup();
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

describe('aiv cli', () => {
  it('lists commands and maps usage errors to 64', async () => {
    const h = await run('--help');
    expect(h.code).toBe(EXIT.OK);
    for (const c of ['doctor', 'post', 'qa', 'release', 'heavy']) expect(h.out).toContain(c);
    expect((await run()).code).toBe(EXIT.USAGE);
    expect((await run('nope')).code).toBe(EXIT.USAGE);
    expect((await run('post')).code).toBe(EXIT.USAGE);
    expect((await run('post', 'demo', '--bogus')).code).toBe(EXIT.USAGE);
    expect((await run('post', 'demo', '--profile', 'ultra')).code).toBe(EXIT.USAGE);
    expect((await run('qa', '--help')).out).toMatch(/usage: aiv qa/);
  });

  it('post → qa → release → verify on the final profile', async () => {
    const post = await run('post', 'demo', '--profile', 'final');
    expect(post.code, post.out).toBe(EXIT.OK);
    expect(existsSync(join(repo.root, 'out/demo/post/final/demo.mp4'))).toBe(true);
    expect(existsSync(join(repo.root, 'out/demo/post/final/archive.mkv'))).toBe(true);

    const qa = await run('qa', 'demo', '--profile', 'final');
    expect(qa.code, qa.out).toBe(EXIT.OK);
    expect(qa.out).toMatch(/PASS\s+swatches/);
    // the delivery and the archive master, each with its own report
    expect(qa.out.match(/QA PASSED/g)).toHaveLength(2);
    expect(qa.out).toMatch(/pcm_s24le 48000 Hz 2 ch/);
    expect(existsSync(join(repo.root, 'out/demo/qa/final/report-archive.json'))).toBe(true);

    // a scratch repo is no git repository: its render is "uncommitted"
    const refused = await run('release', 'demo');
    expect(refused.code).toBe(EXIT.REFUSED);
    const rel = await run('release', 'demo', '--allow-dirty');
    expect(rel.code, rel.out).toBe(EXIT.OK);
    const manifest = JSON.parse(readFileSync(join(repo.root, 'videos/demo/release/v1.json'), 'utf8'));
    expect(manifest.files.map((f: { name: string }) => f.name)).toEqual(['demo-v1.mp4', 'demo-v1-archive.mkv']);
    expect(existsSync(join(repo.root, 'out/demo/release/v1/demo-v1.mp4'))).toBe(true);

    const v = await run('release', 'verify', 'demo');
    expect(v.code, v.out).toBe(EXIT.OK);
    expect(v.out).toContain('RELEASE VERIFIED');

    // the next release is v2; v1 can never be rewritten
    expect((await run('release', 'demo', '--allow-dirty', '--version', '1')).code).toBe(EXIT.REFUSED);

    // re-rendered after post: qa and release refuse the old deliverables
    repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n');
    const target = resolveTarget('demo', repo.root);
    const r = await runRender({ target, profile: { ...PROFILES.final, chunkFrames: 20 }, adapter: fakeAdapter({ frames: 45, swatchFrames: [5, 15] }), log: silentLog(), keepAwake: false, minDiskMB: 1, force: true });
    expect(r.exit, r.message).toBe(EXIT.OK);
    const stale = await run('qa', 'demo', '--profile', 'final');
    expect(stale.code, stale.out).toBe(EXIT.REFUSED);
    expect(stale.out).toMatch(/another render/);
    expect((await run('release', 'demo', '--allow-dirty')).code).toBe(EXIT.REFUSED);
  });

  it('heavy wraps a command and passes its exit code through', async () => {
    const r = await run('heavy', 'cli-test', '--', process.execPath, '-e', 'process.exit(5)');
    expect(r.code).toBe(5);
    expect((await run('heavy', 'cli-test')).code).toBe(EXIT.USAGE);
  });

  it('an aiv command under aiv heavy runs in its parent slot instead of waiting for it', async () => {
    // a second aiv process (tsx), as an agent starts it: heavy → heavy --no-wait → node
    const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
    const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
    const r = await run('heavy', 'outer', '--', process.execPath, '--import', tsx, cli, 'heavy', 'inner', '--no-wait', '--', process.execPath, '-e', 'process.exit(0)');
    expect(r.code, r.out).toBe(EXIT.OK);
    expect(existsSync(process.env.AIV_HEAVY_LOCK!)).toBe(false);
  }, 60_000);
});
