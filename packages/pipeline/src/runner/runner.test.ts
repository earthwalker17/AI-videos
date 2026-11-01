import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXIT } from '@aiv/core';
import { probe } from '../media/probe.ts';
import { allFrameHashes } from '../qa/frames.ts';
import { fakeAdapter, syntheticFrame, tempRepo, type TempRepo } from '../testing.ts';
import { sha256 } from '../util/hash.ts';
import { silentLog } from '../util/log.ts';
import { PROFILES, type Profile } from './profiles.ts';
import { runRender, type RunOptions } from './runner.ts';
import { resolveTarget } from './target.ts';

// 160x90 renders keep every ffmpeg call in the tens of milliseconds
const profile: Profile = { ...PROFILES.draft, chunkFrames: 10 };
let repo: TempRepo;

function setup() {
  repo = tempRepo();
  const target = resolveTarget('demo', repo.root);
  return { target, base: { target, profile, log: silentLog(), keepAwake: false, minDiskMB: 1 } satisfies Partial<RunOptions> };
}

afterEach(() => repo?.cleanup());

const hashesOf = (dir: string) => readFileSync(join(dir, 'frames.sha256'), 'utf8').trim().split('\n');

describe('runRender', () => {
  it('renders all chunks, assembles a verified mezzanine and render.json, then reports up to date', async () => {
    const { base } = setup();
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runRender({ ...base, adapter });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(r.chunksDone).toBe(4);
    const rj = r.renderJson!;
    expect(rj.frames).toEqual({ start: 0, end: 40, count: 40 });
    expect([rj.width, rj.height]).toEqual([160, 90]);
    expect(rj.mezzanine.path).toBe('out/demo/render/draft/mezzanine.mkv');
    expect(rj.mezzanine.codec).toBe('ffv1');
    expect(rj.color).toEqual({ space: 'rgb', range: 'pc' });
    expect(rj.toolchain.browser).toBe('fake-browser 1');
    expect(JSON.stringify(rj)).not.toContain(repo.root.replace(/\\/g, '/'));
    expect(hashesOf(r.dir)).toHaveLength(40);
    // chunk media are dropped after a verified assembly; their JSON (hashes) stays
    expect(readdirSync(join(r.dir, 'chunks')).filter((f) => f.endsWith('.mkv'))).toEqual([]);

    // FFV1 is lossless: decoded mezzanine pixels equal the frames the engine produced
    const decoded = await allFrameHashes(join(repo.root, ...rj.mezzanine.path.split('/')));
    const rgb = (i: number) => {
      const rgba = syntheticFrame(i, 160, 90, false);
      const out = new Uint8Array(160 * 90 * 3);
      for (let p = 0, q = 0; p < rgba.length; p += 4, q += 3) out.set(rgba.subarray(p, p + 3), q);
      return sha256(out);
    };
    expect(decoded).toEqual(Array.from({ length: 40 }, (_, i) => rgb(i)));
    // and the stream says what it is to any other tool (ffmpeg 8 needs the frame tags for this)
    const v = (await probe(join(repo.root, ...rj.mezzanine.path.split('/')))).video!;
    expect([v.colorSpace, v.colorPrimaries, v.colorTransfer, v.colorRange]).toEqual(['gbr', 'bt709', 'iec61966-2-1', 'pc']);
    expect(rj.composition).toEqual({ durationFrames: 40 });

    const again = await runRender({ ...base, adapter });
    expect(again.exit).toBe(EXIT.OK);
    expect(again.message).toMatch(/up to date/);
    expect(adapter.opened).toBe(1);
  });

  it('stops at the budget with 75 and resumes to the same frames', async () => {
    const { base } = setup();
    const clock = { t: 0 };
    const adapter = fakeAdapter({ frames: 40, clock, frameMs: 1000 });
    const opts = { ...base, adapter, clock: () => clock.t, budgetS: 40 };
    const first = await runRender(opts);
    expect(first.exit, first.message).toBe(EXIT.AGAIN);
    expect(first.chunksDone).toBe(3);
    const second = await runRender(opts);
    expect(second.exit, second.message).toBe(EXIT.OK);
    expect(adapter.rendered).toHaveLength(40);

    const ref = tempRepo();
    try {
      const whole = await runRender({ ...base, target: resolveTarget('demo', ref.root), adapter: fakeAdapter({ frames: 40 }) });
      expect(hashesOf(second.dir)).toEqual(hashesOf(whole.dir));
    } finally {
      ref.cleanup();
    }
  });

  it('a budgeted --force call repeated as printed resumes instead of restarting; --fresh restarts', async () => {
    const { base } = setup();
    const clock = { t: 0 };
    const adapter = fakeAdapter({ frames: 40, clock, frameMs: 1000 });
    // 10 s chunks, 30 s per call: two chunks per call
    const opts = { ...base, adapter, clock: () => clock.t, budgetS: 30, force: true };
    const first = await runRender(opts);
    expect(first.exit, first.message).toBe(EXIT.AGAIN);
    expect(first.chunksDone).toBe(2);
    // the same options again: the unchanged run continues where it stopped
    const second = await runRender(opts);
    expect(second.exit, second.message).toBe(EXIT.OK);
    expect(adapter.rendered).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect((await runRender(opts)).message).toMatch(/up to date/);

    const fresh = fakeAdapter({ frames: 40 });
    const again = await runRender({ ...base, adapter: fresh, fresh: true });
    expect(again.exit, again.message).toBe(EXIT.OK);
    expect(fresh.rendered).toHaveLength(40);
  });

  it('a forced restart deletes the old run only once the engine opened', async () => {
    const { base } = setup();
    const done = await runRender({ ...base, adapter: fakeAdapter({ frames: 40 }) });
    expect(done.exit).toBe(EXIT.OK);
    repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n');
    const failed = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failOpen: true }), force: true });
    expect(failed.exit).toBe(EXIT.ERROR);
    expect(failed.message).toMatch(/simulated open failure/);
    // the finished render is still there
    expect(existsSync(join(done.dir, 'render.json'))).toBe(true);
    expect(existsSync(join(done.dir, 'mezzanine.mkv'))).toBe(true);
    const fresh = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failOpen: true }), fresh: true });
    expect(fresh.exit).toBe(EXIT.ERROR);
    expect(existsSync(join(done.dir, 'mezzanine.mkv'))).toBe(true);
  });

  it('a different engine setting (the browser) is a different run, never "up to date"', async () => {
    const { base } = setup();
    expect((await runRender({ ...base, adapter: fakeAdapter({ frames: 40, settings: { browser: 'pinned' } }) })).exit).toBe(EXIT.OK);
    const system = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, settings: { browser: 'system' } }) });
    expect(system.exit).toBe(EXIT.REFUSED);
    expect(system.message).toMatch(/settings changed: engineOptions/);
  });

  it('a truncated chunk JSON (crash mid-write) re-renders that chunk instead of wedging the run', async () => {
    const { base } = setup();
    const crash = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failAt: 25 }) });
    expect(crash.chunksDone).toBe(2);
    writeFileSync(join(crash.dir, 'chunks', 'c0001.json'), '{"chunk":1,"range":[10,');
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runRender({ ...base, adapter });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(adapter.rendered).toEqual(Array.from({ length: 30 }, (_, k) => 10 + k));
  });

  it('assembly fails when the mezzanine does not decode to the hashed frames', async () => {
    const { base } = setup();
    const crash = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failAt: 35 }) });
    expect(crash.chunksDone).toBe(3);
    // what a lossy or broken encode looks like from here: the decoded frame is not the delivered one
    const file = join(crash.dir, 'chunks', 'c0002.json');
    const j = JSON.parse(readFileSync(file, 'utf8'));
    j.frames[0].sha256 = 'f'.repeat(64);
    writeFileSync(file, JSON.stringify(j));
    const r = await runRender({ ...base, adapter: fakeAdapter({ frames: 40 }) });
    expect(r.exit).toBe(EXIT.ERROR);
    expect(r.message).toMatch(/mezzanine frame 20 decodes to other pixels/);
    expect(existsSync(join(r.dir, 'render.json'))).toBe(false);
  });

  it('discards a chunk that overruns the budget', async () => {
    const { base } = setup();
    const clock = { t: 0 };
    // the first chunk is fast, so the second one is underestimated and runs long
    const adapter = fakeAdapter({ frames: 40, clock, frameMs: (i) => (i < 10 ? 100 : 3000) });
    const r = await runRender({ ...base, adapter, clock: () => clock.t, budgetS: 20, overrunS: 0 });
    expect(r.exit).toBe(EXIT.AGAIN);
    expect(r.message).toMatch(/discarded/);
    expect(r.chunksDone).toBe(1);
    expect(readdirSync(join(r.dir, 'partial'))).toEqual(expect.not.arrayContaining([expect.stringMatching(/\.mkv$/)]));
  });

  it('keeps finished chunks after a crash and resumes only the rest', async () => {
    const { base } = setup();
    const crash = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failAt: 25 }) });
    expect(crash.exit).toBe(EXIT.ERROR);
    expect(crash.message).toMatch(/simulated crash/);
    expect(crash.chunksDone).toBe(2);
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runRender({ ...base, adapter });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(adapter.rendered).toEqual(Array.from({ length: 20 }, (_, k) => 20 + k));
  });

  it('refuses to resume against changed inputs, settings or engine host; force starts fresh', async () => {
    const { base, target } = setup();
    const first = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failAt: 15 }) });
    expect(first.chunksDone).toBe(1);

    repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n');
    const changed = await runRender({ ...base, adapter: fakeAdapter({ frames: 40 }) });
    expect(changed.exit).toBe(EXIT.REFUSED);
    expect(changed.message).toMatch(/input files changed/);

    const resized = await runRender({ ...base, profile: { ...profile, chunkFrames: 20 }, adapter: fakeAdapter({ frames: 40 }) });
    expect(resized.exit).toBe(EXIT.REFUSED);
    expect(resized.message).toMatch(/settings changed: .*chunkFrames/);

    repo.write('videos/demo/src/index.ts', 'export const scene = 1;\n');
    const otherBrowser = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, info: { browser: 'fake-browser 2' } }) });
    expect(otherBrowser.exit).toBe(EXIT.REFUSED);
    expect(otherBrowser.message).toMatch(/engine host/);

    repo.write('videos/demo/src/index.ts', 'export const scene = 3;\n');
    const adapter = fakeAdapter({ frames: 40 });
    const forced = await runRender({ ...base, target, adapter, force: true });
    expect(forced.exit, forced.message).toBe(EXIT.OK);
    expect(adapter.rendered).toHaveLength(40);
  });

  it('never resumes chunks left without a run.json', async () => {
    const { base } = setup();
    const first = await runRender({ ...base, adapter: fakeAdapter({ frames: 40, failAt: 25 }) });
    expect(first.chunksDone).toBe(2);
    rmSync(join(first.dir, 'run.json'));
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runRender({ ...base, adapter });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(adapter.rendered).toHaveLength(40);
  });

  it('stops with LOW_MEMORY before a chunk when free RAM is under the abort threshold', async () => {
    const { base } = setup();
    const r = await runRender({ ...base, adapter: fakeAdapter({ frames: 40 }), abortFreeMB: 10_000_000 });
    expect(r.exit).toBe(EXIT.LOW_MEMORY);
    expect(r.chunksDone).toBe(0);
  });

  it('runs a file-producing engine through the same runner', async () => {
    const { base } = setup();
    const r = await runRender({ ...base, adapter: fakeAdapter({ frames: 25, style: 'file' }) });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(r.chunksTotal).toBe(3);
    expect(r.renderJson!.frames.count).toBe(25);
    expect(hashesOf(r.dir)).toHaveLength(25);
    expect(existsSync(join(r.dir, 'render.json'))).toBe(true);
  });

  it('renders a sub-range and rejects an impossible one', async () => {
    const { base } = setup();
    const r = await runRender({ ...base, adapter: fakeAdapter({ frames: 40 }), range: [5, 17] });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(r.renderJson!.frames).toEqual({ start: 5, end: 17, count: 12 });
    expect(r.chunksTotal).toBe(2);
    repo.cleanup();
    const s = setup();
    const bad = await runRender({ ...s.base, adapter: fakeAdapter({ frames: 40 }), range: [30, 50] });
    expect(bad.exit).toBe(EXIT.USAGE);
  });
});
