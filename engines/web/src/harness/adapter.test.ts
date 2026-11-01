/**
 * The web adapter end to end through the shared runner, on tiny fixture pages: real browser,
 * real Vite server, real FFV1 mezzanine. Decoding the mezzanine checks values and orientation
 * of both readback paths (2D getImageData, WebGL readPixels + flip). Skipped when the pinned
 * browser is not installed (pnpm aiv doctor --fix) or another heavy job holds the machine.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, type VideoConfig } from '@aiv/core';
import { acquireHeavy, execBuffer, ffmpegBin, findOrphanBrowsers, repoRoot, runRender, silentLog, type HeavySlot, type Profile, type Target } from '@aiv/pipeline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { webAdapter } from './adapter.ts';
import { pinnedBrowser } from './browser.ts';
import { bottomColor, FIXTURE_FRAMES, topColor } from '../fixtures/src/fixtures.ts';

const root = repoRoot();
const W = 64;
const H = 36;
const PROFILE: Profile = { name: 'review', scale: 1, encode: 'youtube', archive: false, chunkFrames: 5 };
const OUT = join(root, 'out', '_test-engine-web');

function fixture(name: string): Target {
  // laid out like a video folder (pages in src/), so the input hash covers them
  const relDir = 'engines/web/src/fixtures';
  const config: VideoConfig = { slug: `test-web-${name}`, title: name, engine: 'web', entry: `src/${name}.html`, format: { width: W, height: H, fps: 10 } };
  return { spec: `fixture:${name}`, kind: 'template', slug: `_test-web-${name}`, dir: join(root, ...relDir.split('/')), relDir, configPath: '', config, root };
}

/** Decoded RGB of frame i of a file. */
async function decode(file: string, i: number): Promise<Uint8Array> {
  const r = await execBuffer(ffmpegBin(), ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${i})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  expect(r.code, r.stderr).toBe(0);
  return new Uint8Array(r.stdout);
}
const px = (rgb: Uint8Array, x: number, y: number) => Array.from(rgb.subarray((y * W + x) * 3, (y * W + x) * 3 + 3));

let slot: HeavySlot | null = null;
const skipWhy = (): string | null => (!pinnedBrowser(root).installed ? 'pinned browser not installed' : slot?.ok ? null : `heavy slot unavailable: ${slot && !slot.ok ? slot.reason : '?'}`);

beforeAll(async () => {
  if (pinnedBrowser(root).installed) slot = await acquireHeavy({ label: 'engine-web tests', wait: false, log: silentLog() });
});
afterAll(() => {
  if (slot?.ok) slot.release();
  rmSync(OUT, { recursive: true, force: true });
});

describe('web adapter through the runner', () => {
  for (const name of ['2d', 'gl'] as const) {
    it(`captures a ${name} page: every frame, right values, right way up`, async (ctx) => {
      if (skipWhy()) return ctx.skip(skipWhy()!);
      const dir = join(OUT, name);
      const r = await runRender({ adapter: webAdapter(), target: fixture(name), profile: PROFILE, dir, keepAwake: false, log: silentLog() });
      expect(r.exit, r.message).toBe(EXIT.OK);
      expect(r.chunksTotal).toBe(3);
      const rj = r.renderJson!;
      expect(rj.frames.count).toBe(FIXTURE_FRAMES);
      expect([rj.width, rj.height]).toEqual([W, H]);
      expect(rj.toolchain.browser).toMatch(/^chrome-for-testing \d+\./);
      for (const i of [0, 7, 11]) {
        const rgb = await decode(join(dir, 'mezzanine.mkv'), i);
        expect(rgb.length).toBe(W * H * 3);
        expect(px(rgb, 5, 3), `frame ${i} top`).toEqual(topColor(i));
        expect(px(rgb, 60, 32), `frame ${i} bottom`).toEqual(bottomColor(i));
      }
    });
  }

  it('fails fast with the page error and leaves no browser behind', async (ctx) => {
    if (skipWhy()) return ctx.skip(skipWhy()!);
    const r = await runRender({ adapter: webAdapter(), target: fixture('broken'), profile: PROFILE, dir: join(OUT, 'broken'), keepAwake: false, log: silentLog() });
    expect(r.exit).toBe(EXIT.ERROR);
    expect(r.message).toContain('fixture: frame 7 is broken');
    // chunk 0 (frames 0-4) finished before the failure and is kept for a resume
    expect(r.chunksDone).toBe(1);
    expect(await findOrphanBrowsers(root)).toEqual([]);
  });

  it('refuses a page that loads a file the input hash does not cover', async (ctx) => {
    if (skipWhy()) return ctx.skip(skipWhy()!);
    const r = await runRender({ adapter: webAdapter(), target: fixture('leak'), profile: PROFILE, dir: join(OUT, 'leak'), keepAwake: false, log: silentLog() });
    expect(r.exit).toBe(EXIT.ERROR);
    expect(r.message).toMatch(/input hash does not cover: engines\/web\/package\.json/);
    expect(r.chunksDone).toBe(0);
    expect(await findOrphanBrowsers(root)).toEqual([]);
  });

  it('renders at the profile scale: the page follows ?w=&h=', async (ctx) => {
    if (skipWhy()) return ctx.skip(skipWhy()!);
    const t = fixture('2d');
    const half = await runRender({ adapter: webAdapter(), target: t, profile: { ...PROFILE, scale: 0.5 }, dir: join(OUT, 'half'), keepAwake: false, log: silentLog() });
    expect(half.exit, half.message).toBe(EXIT.OK);
    expect([half.renderJson!.width, half.renderJson!.height]).toEqual([32, 18]);
  });
});
