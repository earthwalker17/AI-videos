// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageBank, Textures, type FrameClock, type ResidentTexture } from './images.ts';
import { Stage, checkFinish, type ImageMark } from './stage.ts';

/** Just enough of WebGL2 for Textures: textures are tokens, deletions are recorded. */
function fakeGl() {
  const deleted = new Set<object>();
  const gl = {
    NO_ERROR: 0,
    createTexture: () => ({}),
    deleteTexture: (t: object) => void deleted.add(t),
    activeTexture: () => {},
    bindTexture: () => {},
    texStorage2D: () => {},
    texSubImage2D: () => {},
    generateMipmap: () => {},
    texParameteri: () => {},
    getParameter: () => 16384,
    getError: () => 0,
  };
  return { gl: gl as unknown as WebGL2RenderingContext, deleted };
}

/** A stand-in for the stage's frame count: begin() and end() bracket a frame like beginFrame/present. */
function clock(gl: WebGL2RenderingContext) {
  const c = { gl, frame: 0, drawing: false };
  return {
    c: c as FrameClock,
    begin: () => {
      c.frame++;
      c.drawing = true;
    },
    end: () => {
      c.drawing = false;
    },
  };
}

const FILES = { web: 'web.png', approval: 'approval.png' };

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, status: 200, statusText: 'OK', blob: async () => new Blob([url]) }));
  vi.stubGlobal('createImageBitmap', async () => ({ width: 8, height: 4, close: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Textures: a frame names its own images', () => {
  it('gives a texture to the frame that named it, before or after beginFrame', async () => {
    const { gl } = fakeGl();
    const k = clock(gl);
    const t = new Textures(k.c, await ImageBank.load(FILES));
    // named before the frame begins: for the frame about to begin
    await t.need(['web']);
    k.begin();
    expect(t.get('web').key).toBe('web');
    k.end();
    // named while drawing: for that frame
    k.begin();
    await t.need(['approval']);
    expect(t.get('approval').key).toBe('approval');
    k.end();
  });

  it('refuses a frame that never calls need(), even right after a frame that named the key', async () => {
    const { gl } = fakeGl();
    const k = clock(gl);
    const t = new Textures(k.c, await ImageBank.load(FILES));
    await t.need(['web']);
    k.begin();
    t.get('web');
    k.end();
    // the next frame skips need(): resident, and named one frame ago, but not by this frame
    k.begin();
    expect(() => t.get('web')).toThrow(/did not call need/);
    k.end();
  });

  it('refuses a key the frame left out, and a get outside a frame', async () => {
    const { gl } = fakeGl();
    const k = clock(gl);
    const t = new Textures(k.c, await ImageBank.load(FILES));
    await t.need(['web', 'approval']);
    k.begin();
    k.end();
    await t.need(['web']);
    k.begin();
    // approval is still resident (cap 4) but this frame did not name it
    expect(t.resident).toContain('approval');
    expect(() => t.get('approval')).toThrow(/not named/);
    k.end();
    expect(() => t.get('web')).toThrow(/outside a frame/);
  });
});

describe('Textures: a handle dies with its texture', () => {
  it('marks an evicted texture dead, and the stage refuses to draw it', async () => {
    const { gl, deleted } = fakeGl();
    const k = clock(gl);
    const t = new Textures(k.c, await ImageBank.load(FILES), { cap: 1 });
    await t.need(['web']);
    k.begin();
    const kept: ResidentTexture = t.get('web');
    expect(kept.live).toBe(true);
    k.end();
    // the next frame evicts web for approval
    await t.need(['approval']);
    expect(kept.live).toBe(false);
    expect(deleted.has(kept.texture)).toBe(true);
    const mark: ImageMark = { tex: kept, o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], half: [10, 10] };
    // image() refuses a dead texture before it touches GL (a Stage needs a WebGL context to build)
    const stage = Object.create(Stage.prototype) as Stage;
    expect(() => stage.image(mark)).toThrow(/deleted texture/);
    // re-uploaded, web is a new, live handle
    await t.need(['web']);
    k.begin();
    expect(t.get('web').live).toBe(true);
    expect(t.get('web')).not.toBe(kept);
    k.end();
    expect(t.uploads).toBe(3);
  });

  it('kills every handle on dispose', async () => {
    const { gl } = fakeGl();
    const k = clock(gl);
    const t = new Textures(k.c, await ImageBank.load(FILES));
    await t.need(['web', 'approval']);
    k.begin();
    const a = t.get('web');
    const b = t.get('approval');
    k.end();
    t.dispose();
    expect([a.live, b.live]).toEqual([false, false]);
    expect(t.bytes).toBe(0);
  });
});

describe('checkFinish', () => {
  const look = { bloomThreshold: 1, bloomStrength: 0.46, shoulder: 0.78, vignette: 0.42, grain: 1.6 };
  it('fills in displayGrain and keeps the film numbers', () => {
    expect(checkFinish(look)).toEqual({ ...look, displayGrain: 0 });
    expect(checkFinish({ ...look, displayGrain: 0.5 }).displayGrain).toBe(0.5);
  });
  it('refuses numbers the shaders cannot take', () => {
    expect(() => checkFinish({ ...look, shoulder: 1 })).toThrow(/below 1/);
    expect(() => checkFinish({ ...look, grain: Number.NaN })).toThrow(/finite/);
    expect(() => checkFinish({ ...look, vignette: -0.1 })).toThrow(/>= 0/);
    expect(() => checkFinish({ ...look, displayGrain: 2 })).toThrow(/0\.\.1/);
  });
});
