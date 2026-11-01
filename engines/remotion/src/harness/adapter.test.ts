/**
 * The Remotion adapter end to end through the shared runner, on tiny fixture compositions: a real
 * bundle, the real headless shell with --gl=angle (swangle on CI), real FFV1 mezzanines. Decoding
 * the mezzanine checks values and orientation; the GL fixture checks that every chunk's first
 * frame is drawn through the synchronous post chain. Skipped (not failed) when the headless shell
 * is missing (pnpm aiv doctor --fix) or another heavy job holds the machine.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, ExitError, type VideoConfig } from '@aiv/core';
import { acquireHeavy, execBuffer, ffmpegBin, findOrphanBrowsers, killTree, repoRoot, runRender, sha256, silentLog, type EngineSession, type FrameSpan, type HeavySlot, type Profile, type Target } from '@aiv/pipeline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bottomColor, FIXTURE_FPS, FIXTURE_FRAMES, glColor, H, topColor, W } from '../fixtures/src/fixtures.ts';
import { ENGINE_INPUTS, remotionAdapter } from './adapter.ts';
import { headlessShell } from './browser.ts';
import { bundleKey, readBundleManifest } from './bundle.ts';

const root = repoRoot();
const PROFILE: Profile = { name: 'review', scale: 1, encode: 'youtube', archive: false, chunkFrames: 5 };
const OUT = join(root, 'out', '_test-engine-remotion');
// the first bundle of a fresh checkout is a cold webpack build
const SLOW = 300_000;

function fixture(composition: string, entry = 'src/index.ts'): Target {
  // laid out like a video folder (compositions in src/), so the input hash covers them
  const relDir = 'engines/remotion/src/fixtures';
  const config: VideoConfig = { slug: 'test-remotion', title: composition, engine: 'remotion', entry, composition, format: { width: W, height: H, fps: FIXTURE_FPS } };
  return { spec: `fixture:${composition}`, kind: 'template', slug: `_test-remotion-${composition}`, dir: join(root, ...relDir.split('/')), relDir, configPath: '', config, root };
}

async function decode(file: string, i: number): Promise<Uint8Array> {
  const r = await execBuffer(ffmpegBin(), ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${i})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  expect(r.code, r.stderr).toBe(0);
  return new Uint8Array(r.stdout);
}
const px = (rgb: Uint8Array, x: number, y: number) => Array.from(rgb.subarray((y * W + x) * 3, (y * W + x) * 3 + 3));
const near = (a: number[], b: readonly number[], tol: number) => a.every((v, k) => Math.abs(v - b[k]) <= tol);

let slot: HeavySlot | null = null;
const skipWhy = (): string | null => (!headlessShell(root).ok ? 'headless shell not installed (pnpm aiv doctor --fix)' : slot?.ok ? null : `heavy slot unavailable: ${slot && !slot.ok ? slot.reason : '?'}`);
const run = (composition: string, entry?: string) =>
  runRender({ adapter: remotionAdapter(), target: fixture(composition, entry), profile: PROFILE, dir: join(OUT, entry ? `${composition}-${entry.replace(/\W/g, '_')}` : composition), keepAwake: false, log: silentLog() });
const FIXTURE_ROOTS = ['engines/remotion/src/fixtures/src', 'engines/remotion/src/harness', 'packages/core/src', 'packages/remotion-kit/src'];
const open = (composition: string, dir: string) =>
  remotionAdapter().open({ target: fixture(composition), profile: PROFILE, width: W, height: H, fps: FIXTURE_FPS, runDir: join(OUT, dir), root, inputRoots: FIXTURE_ROOTS, log: silentLog() });
/** sha256 of each delivered frame's RGBA, by frame index */
async function hashes(session: EngineSession, span: FrameSpan): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  await session.renderFrames!(span, async (i, rgba) => {
    out.set(i, sha256(rgba));
  });
  return out;
}

beforeAll(async () => {
  if (headlessShell(root).ok) slot = await acquireHeavy({ label: 'engine-remotion tests', wait: false, log: silentLog() });
});
afterAll(() => {
  if (slot?.ok) slot.release();
  rmSync(OUT, { recursive: true, force: true });
});

describe('remotion adapter through the runner', () => {
  it(
    'renders a DOM composition: every frame, right values, right way up',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const r = await run('Main');
      expect(r.exit, r.message).toBe(EXIT.OK);
      expect(r.chunksTotal).toBe(3);
      const rj = r.renderJson!;
      expect(rj.frames.count).toBe(FIXTURE_FRAMES);
      expect([rj.width, rj.height]).toEqual([W, H]);
      expect(rj.engine).toMatchObject({ name: 'remotion', adapterVersion: '1' });
      expect(rj.toolchain.browser).toMatch(/^chrome-headless-shell \d+\./);
      expect(rj.toolchain.gpu).toMatch(/^ANGLE \(/);
      for (const i of [0, 5, 7, 11]) {
        const rgb = await decode(join(OUT, 'Main', 'mezzanine.mkv'), i);
        expect(rgb.length).toBe(W * H * 3);
        expect(px(rgb, 5, 3), `frame ${i} top`).toEqual(topColor(i));
        expect(px(rgb, 60, 32), `frame ${i} bottom`).toEqual(bottomColor(i));
      }
      expect(await findOrphanBrowsers(root)).toEqual([]);
      // the module list the bundle check reads holds the entry (a concatenation root in production mode)
      const files = readBundleManifest(root, bundleKey(fixture('Main'), () => ENGINE_INPUTS))?.files ?? [];
      expect(files.map((f) => f.replace(/\\/g, '/'))).toContain(join(root, 'engines/remotion/src/fixtures/src/index.ts').replace(/\\/g, '/'));
    },
    SLOW,
  );

  it(
    'renders a frame the same whichever frame its page started at (instances, PMREM, shadows, bloom)',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const session = await open('Anim', 'anim');
      try {
        // one page for all 12 frames, then fresh pages that start at 3 and at 8
        const full = await hashes(session, [0, 12]);
        const from3 = await hashes(session, [3, 12]);
        const from8 = await hashes(session, [8, 12]);
        expect(full.size).toBe(12);
        // it animates: no two consecutive frames are alike
        for (let i = 1; i < 12; i++) expect(full.get(i), `frame ${i}`).not.toBe(full.get(i - 1));
        for (let i = 3; i < 12; i++) expect(from3.get(i), `frame ${i} from a page started at 3`).toBe(full.get(i));
        for (let i = 8; i < 12; i++) expect(from8.get(i), `frame ${i} from a page started at 8`).toBe(full.get(i));
      } finally {
        await session.close();
      }
      expect(await findOrphanBrowsers(root)).toEqual([]);
    },
    SLOW,
  );

  it(
    'stops at once and rejects with the consumer’s own error when onFrame throws mid-chunk',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const session = await open('Main', 'sink');
      const seen: number[] = [];
      // what the runner throws from onFrame when a chunk runs past its budget
      const stop = new ExitError(EXIT.AGAIN, 'budget: chunk ran past its budget');
      let got: unknown = null;
      try {
        await session.renderFrames!([2, 10], async (i) => {
          seen.push(i);
          if (i === 5) throw stop;
        });
      } catch (e) {
        got = e;
      }
      // nothing arrives after the throw, not even late
      await new Promise((r) => setTimeout(r, 500));
      expect(got).toBe(stop);
      expect(seen).toEqual([2, 3, 4, 5]);
      await session.close();
      expect(await findOrphanBrowsers(root)).toEqual([]);
    },
    SLOW,
  );

  it(
    'draws every chunk’s first frame through the synchronous post chain (no blank start)',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const r = await run('Gl');
      expect(r.exit, r.message).toBe(EXIT.OK);
      // frames 0, 5 and 10 are each the first frame of a fresh page
      for (const i of [0, 4, 5, 10, 11]) {
        const rgb = await decode(join(OUT, 'Gl', 'mezzanine.mkv'), i);
        expect(near(px(rgb, 32, 18), glColor(i), 2), `frame ${i}: ${px(rgb, 32, 18)} vs ${glColor(i)}`).toBe(true);
      }
    },
    SLOW,
  );

  it(
    'delivers frames in order and waits for each (backpressure)',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const session = await open('Main', 'bp');
      const seen: number[] = [];
      let inside = 0;
      let maxInside = 0;
      try {
        await session.renderFrames!([3, 9], async (i) => {
          inside++;
          maxInside = Math.max(maxInside, inside);
          seen.push(i);
          // a slow consumer: Remotion must not seek the next frame meanwhile
          await new Promise((res) => setTimeout(res, 40));
          inside--;
        });
      } finally {
        await session.close();
        await session.close(); // idempotent
      }
      expect(seen).toEqual([3, 4, 5, 6, 7, 8]);
      expect(maxInside).toBe(1);
    },
    SLOW,
  );

  it(
    'fails the chunk when the headless shell dies mid-chunk, and leaves no shell behind',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const session = await open('Main', 'crash');
      const seen: number[] = [];
      let got: unknown = null;
      try {
        await session.renderFrames!([0, 12], async (i) => {
          seen.push(i);
          if (i !== 3) return;
          // the session's browser process: the shell this process launched with a profile
          const main = (await findOrphanBrowsers(root)).find((o) => o.engine === 'remotion' && o.profile);
          if (!main) throw new Error('no headless shell found');
          killTree(main.pid);
        });
      } catch (e) {
        got = e;
      }
      // only onReplace sets this error: Remotion went for its crash replacement and was stopped
      expect(String(got)).toMatch(/headless shell or its page crashed/);
      // no frame after the crash was accepted, and the session stays failed
      expect(seen).toEqual([0, 1, 2, 3]);
      await expect(session.renderFrames!([0, 2], async () => {})).rejects.toThrow(/crashed/);
      await session.close();
      // a replacement would start in the background after renderFrames rejected (Linux CI saw one
      // appear after close()): give it time, then expect none
      await new Promise((r) => setTimeout(r, 3000));
      expect(await findOrphanBrowsers(root)).toEqual([]);
    },
    SLOW,
  );

  it(
    'refuses (exit 2) a composition whose fps differs from video.json, and an unknown one',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const wrong = await run('WrongFps');
      expect(wrong.exit, wrong.message).toBe(EXIT.REFUSED);
      expect(wrong.message).toMatch(/composition 'WrongFps' is 64x36 at 12 fps, video\.json format says 64x36 at 10 fps/);
      const none = await run('Nope');
      expect(none.exit, none.message).toBe(EXIT.REFUSED);
      expect(none.message).toMatch(/registers no composition 'Nope'/);
      expect(await findOrphanBrowsers(root)).toEqual([]);
    },
    SLOW,
  );

  it(
    'fails on transparent frames (the mezzanine has no alpha)',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const r = await run('Clear');
      expect(r.exit).toBe(EXIT.ERROR);
      expect(r.message).toMatch(/frame 0 has transparent pixels/);
      expect(r.chunksDone).toBe(0);
    },
    SLOW,
  );

  it(
    'refuses a bundle that contains a file the input hash does not cover',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const r = await run('Main', 'src/leak.ts');
      expect(r.exit).toBe(EXIT.ERROR);
      expect(r.message).toMatch(/input hash does not cover: engines\/remotion\/package\.json/);
      expect(r.chunksDone).toBe(0);
      expect(await findOrphanBrowsers(root)).toEqual([]);
    },
    SLOW,
  );

  it(
    'refuses a lazily imported file outside the roots that webpack folded into a concatenated module',
    async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const r = await run('Main', 'src/lazy.ts');
      expect(r.exit).toBe(EXIT.ERROR);
      expect(r.message).toMatch(/input hash does not cover: .*engines\/remotion\/src\/fixtures\/outside\/Lazy\.tsx/);
      expect(r.chunksDone).toBe(0);
    },
    SLOW,
  );
});
