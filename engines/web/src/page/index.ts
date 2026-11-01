// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/src/render/capture.ts
/**
 * The web engine's page contract: the in-page runtime a page installs so the harness can capture
 * it frame by frame. Browser-only; frame code (the determinism lint applies).
 *
 *   window.__aiv = { version: 1, ready, meta, info(), renderFrame(i) }
 *
 * - ready resolves after the page's own setup, its fonts (loaded AND in use), and a throwaway
 *   warm-up render + readback of a few frames: lazily created GPU resources (programs, render
 *   targets, glyph atlases) must not make the first captured frame differ from a re-render.
 *   It then re-renders one frame after another and requires identical pixels (purity probe).
 * - renderFrame(i) renders frame i, reads back tightly packed RGBA rows top-down, hashes them and
 *   POSTs the bytes to the harness (/__aiv/frame). The harness answers only after the frame is in
 *   the encoder, so a fast page can never run ahead of ffmpeg (end-to-end backpressure).
 *
 * The frame size comes from the URL (?w=&h=&fps=, see pageParams) so profiles can scale it: draw
 * everything relative to meta.width/height. A frame must be a pure function of its index.
 *
 * HyperFrames compatibility (documented, not tested): HyperFrames seeks raw canvas/WebGL pages
 * with a CustomEvent 'hf-seek' whose detail is { time, waitUntil }. A page that wants to run there
 * too can forward it to its own frame function:
 *
 *   window.addEventListener('hf-seek', (e) => {
 *     const { time, waitUntil } = (e as CustomEvent<{ time: number; waitUntil(p: Promise<unknown>): void }>).detail;
 *     waitUntil(Promise.resolve(drawFrame(Math.round(time * fps))));
 *   });
 */
import { collectGpuInfo, type GpuInfo } from './gpuInfo.ts';

export { collectGpuInfo, type GpuInfo, type WebGpuAdapterInfo } from './gpuInfo.ts';

/** Which GPU API draws the frames: the harness refuses a software implementation of it. */
export type GpuApi = 'webgl' | 'webgpu' | 'none';

export interface CaptureOptions {
  fps: number;
  durationFrames: number;
  /** render size: use pageParams() so the harness can scale it */
  width: number;
  height: number;
  /** draw frame i; must depend on i alone */
  renderFrame(i: number): void | Promise<void>;
  /**
   * the canvas holding the finished frame: a 2D canvas (getImageData) or a WebGL canvas
   * (readPixels + row flip; create it with preserveDrawingBuffer: true unless renderFrame draws
   * synchronously). Give either canvas or readPixels.
   */
  canvas?: HTMLCanvasElement;
  /** custom readback (e.g. a WebGPU render target, see unpadRows): tight RGBA rows, top-down */
  readPixels?: () => Promise<Uint8Array>;
  /** CSS font shorthands that must be loaded and in use before ready, e.g. '600 64px "AIV Inter"' */
  fonts?: string[];
  /** the page's own boot work (assets, FontFace loading); a rejection fails ready with its message */
  setup?: Promise<unknown>;
  /** default 'webgl' */
  gpu?: GpuApi;
  /** frames rendered + read back once before ready (default: middle, last, first) */
  warmupFrames?: number[];
  /**
   * frames [start, end) that show the @aiv/core swatch strip; the harness requires video.json
   * qa.swatchFrames to be the same, so QA measures the strip and not other content
   */
  swatchFrames?: readonly [number, number];
}

export interface FrameResult {
  i: number;
  sha256: string;
  /** render + readback time, ms (diagnostics only) */
  ms: number;
}

export interface PageMeta {
  fps: number;
  durationFrames: number;
  width: number;
  height: number;
  gpu: GpuApi;
  swatchFrames: [number, number] | null;
}

export interface AivPage {
  version: 1;
  ready: Promise<void>;
  meta: PageMeta;
  info(): Promise<GpuInfo>;
  renderFrame(i: number): Promise<FrameResult>;
}

declare global {
  interface Window {
    __aiv?: AivPage;
  }
}

/** The sink the harness serves next to the page. */
export const FRAME_SINK = '/__aiv/frame';

/**
 * Frame size and rate from the URL (?w=&h=&fps=, set by the harness), else the defaults, so the
 * same page also opens in a normal browser.
 */
export function pageParams(defaults: { width: number; height: number; fps: number }): { width: number; height: number; fps: number } {
  const q = new URLSearchParams(location.search);
  const num = (k: string, d: number, int: boolean) => {
    const v = q.get(k);
    if (v === null) return d;
    const n = Number(v);
    if (!(n > 0) || (int && !Number.isInteger(n))) throw new Error(`page: ?${k}=${v} is not a positive ${int ? 'integer' : 'number'}`);
    return n;
  };
  return { width: num('w', defaults.width, true), height: num('h', defaults.height, true), fps: num('fps', defaults.fps, false) };
}

/** Flip bottom-up rows (WebGL readPixels) to top-down, in place. */
export function flipRows(px: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const tmp = new Uint8Array(stride);
  for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
    const a = top * stride;
    const b = bottom * stride;
    tmp.set(px.subarray(a, a + stride));
    px.copyWithin(a, b, b + stride);
    px.set(tmp, b);
  }
  return px;
}

/**
 * Tight RGBA rows from a padded readback. WebGPU copies (and three's readRenderTargetPixelsAsync
 * on WebGPU) align each row to 256 bytes; hashing or encoding the padded buffer would be wrong at
 * any width that is not a multiple of 64.
 */
export function unpadRows(raw: Uint8Array, width: number, height: number, bytesPerRow = Math.ceil((width * 4) / 256) * 256): Uint8Array {
  const row = width * 4;
  if (bytesPerRow === row) return raw.length === row * height ? raw : raw.subarray(0, row * height);
  const out = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) out.set(raw.subarray(y * bytesPerRow, y * bytesPerRow + row), y * row);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;

function readGl(gl: GL, width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  // read the default framebuffer without disturbing the app's state cache (three tracks bindings)
  const gl2 = 'READ_FRAMEBUFFER' in gl ? (gl as WebGL2RenderingContext) : null;
  const target = gl2 ? gl2.READ_FRAMEBUFFER : gl.FRAMEBUFFER;
  const prevFb = gl.getParameter(gl2 ? gl2.READ_FRAMEBUFFER_BINDING : gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  const prevPbo = gl2 ? (gl2.getParameter(gl2.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null) : null;
  const prevAlign = gl.getParameter(gl.PACK_ALIGNMENT) as number;
  gl.bindFramebuffer(target, null);
  if (gl2 && prevPbo) gl2.bindBuffer(gl2.PIXEL_PACK_BUFFER, null);
  gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.pixelStorei(gl.PACK_ALIGNMENT, prevAlign);
  if (gl2 && prevPbo) gl2.bindBuffer(gl2.PIXEL_PACK_BUFFER, prevPbo);
  gl.bindFramebuffer(target, prevFb);
  return flipRows(px, width, height);
}

/** The readback of a page canvas, by its context type (known only once the page has drawn). */
function canvasReader(canvas: HTMLCanvasElement, width: number, height: number): () => Promise<Uint8Array> {
  let warned = false;
  return async () => {
    if (canvas.width !== width || canvas.height !== height) throw new Error(`capture canvas is ${canvas.width}x${canvas.height}, the frame is ${width}x${height}`);
    // getContext returns the existing context of a canvas, or null for another type
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) return new Uint8Array(ctx2d.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data.buffer);
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as GL | null;
    if (!gl) throw new Error('capture canvas has neither a 2D nor a WebGL context');
    if (!warned && !gl.getContextAttributes()?.preserveDrawingBuffer) {
      warned = true;
      console.warn('[aiv] WebGL capture canvas without preserveDrawingBuffer: renderFrame must draw synchronously');
    }
    return readGl(gl, width, height);
  };
}

/** An opaque frame, or a loud error: the mezzanine drops alpha, so a transparent pixel's colour would be undefined. */
function assertOpaque(px: Uint8Array, i: number): void {
  let n = 0;
  for (let k = 3; k < px.length; k += 4) if (px[k] !== 255) n++;
  if (n) throw new Error(`frame ${i} is not opaque (${n} pixels with alpha < 255): draw an opaque background`);
}

/** The font is in use when text measured with it ignores the fallback (monospace vs serif). */
async function verifyFont(spec: string): Promise<void> {
  const faces = await document.fonts.load(spec);
  if (!faces.length) throw new Error(`font '${spec}': no matching font face is registered`);
  if (!document.fonts.check(spec)) throw new Error(`font '${spec}' is not loaded`);
  const c = document.createElement('canvas').getContext('2d')!;
  const width = (font: string) => {
    c.font = '1px serif';
    c.font = font;
    // an invalid shorthand is ignored silently and would compare the default font with itself
    if (c.font === '1px serif') throw new Error(`font '${spec}' is not a valid CSS font shorthand`);
    return c.measureText('AIV wmQ@ 0123456789 fiffl').width;
  };
  if (width(`${spec}, monospace`) !== width(`${spec}, serif`)) throw new Error(`font '${spec}' is registered but text falls back to another font`);
}

/** Install window.__aiv. Call once, as early as possible (the harness waits for it). */
export function installCapture(o: CaptureOptions): AivPage {
  const { width, height, fps, durationFrames } = o;
  if (!(Number.isInteger(durationFrames) && durationFrames > 0)) throw new Error(`installCapture: durationFrames ${durationFrames} is not a positive integer`);
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0)) throw new Error(`installCapture: size ${width}x${height} is not positive integers`);
  if (!o.canvas === !o.readPixels) throw new Error('installCapture: give exactly one of canvas or readPixels');
  const sw = o.swatchFrames;
  if (sw && !(Number.isInteger(sw[0]) && Number.isInteger(sw[1]) && sw[0] >= 0 && sw[1] > sw[0] && sw[1] <= durationFrames))
    throw new Error(`installCapture: swatchFrames [${sw.join(', ')}) is not a frame range inside [0, ${durationFrames})`);
  const read = o.readPixels ?? canvasReader(o.canvas!, width, height);

  const draw = async (i: number): Promise<Uint8Array> => {
    await o.renderFrame(i);
    const px = await read();
    if (px.length !== width * height * 4) throw new Error(`readback of frame ${i} has ${px.length} bytes, expected ${width * height * 4} (${width}x${height} RGBA)`);
    assertOpaque(px, i);
    return px;
  };

  const ready = (async () => {
    await o.setup;
    await document.fonts.ready;
    for (const spec of o.fonts ?? []) await verifyFont(spec);
    const last = durationFrames - 1;
    const mid = Math.floor(last / 2);
    const warm = o.warmupFrames ?? [mid, last, 0];
    let probe = 0;
    let first = '';
    for (const i of warm) {
      if (!(Number.isInteger(i) && i >= 0 && i <= last)) throw new Error(`warm-up frame ${i} is outside [0, ${durationFrames})`);
      first = await sha256Hex(await draw(i));
      probe = i;
    }
    // purity probe: the last warm-up frame again, after a different frame
    await draw(probe === mid ? last : mid);
    const again = await sha256Hex(await draw(probe));
    if (again !== first) throw new Error(`frame ${probe} rendered twice gave different pixels: the page keeps state between frames (a frame must be a pure function of its index)`);
  })();
  // surfaced through window.__aiv.ready; avoid an unhandled-rejection report on top
  ready.catch(() => {});

  const renderOne = async (i: number): Promise<FrameResult> => {
    await ready;
    if (!(Number.isInteger(i) && i >= 0 && i < durationFrames)) throw new Error(`frame ${i} is outside [0, ${durationFrames})`);
    // diagnostics only: the duration is reported, it never reaches the pixels
    // eslint-disable-next-line no-restricted-syntax
    const t0 = performance.now();
    const px = await draw(i);
    // eslint-disable-next-line no-restricted-syntax
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    const sha256 = await sha256Hex(px);
    // a Blob body keeps the frame out of the DevTools protocol's request events (Playwright keeps
    // the post data of recent requests in the harness process)
    const res = await fetch(`${FRAME_SINK}?i=${i}&w=${width}&h=${height}&ms=${ms}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([px as BlobPart]),
    });
    if (!res.ok) throw new Error(`frame sink rejected frame ${i}: ${res.status} ${await res.text()}`);
    return { i, sha256, ms };
  };

  // one frame at a time, whatever the caller does
  let queue: Promise<unknown> = Promise.resolve();
  const page: AivPage = {
    version: 1,
    ready,
    meta: { fps, durationFrames, width, height, gpu: o.gpu ?? 'webgl', swatchFrames: sw ? [sw[0], sw[1]] : null },
    info: collectGpuInfo,
    renderFrame(i) {
      const p = queue.then(() => renderOne(i));
      queue = p.catch(() => {});
      return p;
    },
  };
  window.__aiv = page;
  return page;
}
