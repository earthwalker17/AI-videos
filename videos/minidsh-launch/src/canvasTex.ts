/**
 * Textures drawn by this film on a CPU canvas (the cursor, the terminal pane), uploaded the way
 * the kit uploads captures: SRGB8_ALPHA8 with a full mip chain, straight alpha, no colour-space
 * conversion. A CPU canvas rasterises the same pixels every time (decision 34), so a texture is a
 * pure function of what was drawn into it.
 */
import type { StageTexture } from '@aiv/web-kit';

export interface CanvasTexture extends StageTexture {
  dispose(): void;
}

export function canvasTexture(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement | OffscreenCanvas): CanvasTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas as TexImageSource);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`canvasTexture: upload failed (GL error 0x${err.toString(16)})`);
  let live = true;
  return {
    texture,
    width: canvas.width,
    height: canvas.height,
    get live() {
      return live;
    },
    dispose() {
      if (!live) return;
      live = false;
      gl.deleteTexture(texture);
    },
  };
}

/**
 * Keeps at most `cap` canvas textures, keyed by a value the drawing is a pure function of (a paint
 * index). Eviction is least recently used, but a texture is the same whichever frame made it, so
 * the cache changes timing only.
 */
export class CanvasTextures<K extends string | number> {
  private readonly live = new Map<K, CanvasTexture>();
  private readonly order: K[] = [];
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly draw: (key: K) => HTMLCanvasElement | OffscreenCanvas,
    private readonly cap = 3,
  ) {}

  get(key: K): CanvasTexture {
    let t = this.live.get(key);
    if (t) {
      this.order.splice(this.order.indexOf(key), 1);
      this.order.push(key);
      return t;
    }
    while (this.order.length >= this.cap) {
      const old = this.order.shift()!;
      this.live.get(old)!.dispose();
      this.live.delete(old);
    }
    t = canvasTexture(this.gl, this.draw(key));
    this.live.set(key, t);
    this.order.push(key);
    return t;
  }
}

/** The film's pointer: a plain arrow, white with a dark outline, drawn at `scale` px per unit. */
export function drawCursor(scale = 4): HTMLCanvasElement {
  const c = document.createElement('canvas');
  // the arrow is 14 x 21 units with a margin for its outline
  c.width = Math.round(18 * scale);
  c.height = Math.round(25 * scale);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.scale(scale, scale);
  g.translate(2, 2);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 17.5);
  g.lineTo(4.3, 13.6);
  g.lineTo(7.2, 20.2);
  g.lineTo(10.1, 18.9);
  g.lineTo(7.3, 12.4);
  g.lineTo(13, 12.4);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 1.6;
  g.strokeStyle = '#111317';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fill();
  return c;
}
