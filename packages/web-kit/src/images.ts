// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2) with the kit; this file is new: the
// loader for the stage's image marks (real UI captures, video #5).
/**
 * Images for the stage's image marks: real UI captures (PNG, 2-3x density) shown as panes.
 *
 * Loading. A page may fetch only during `setup` (engines/web/ENGINE.md: no network while
 * rendering). `ImageBank.load` fetches every file's bytes then, as Blobs, and decodes each once to
 * check it and read its size. The compressed bytes stay in memory (a few hundred KB per capture);
 * decoded pixels do not.
 *
 * Decoding. `createImageBitmap(blob, DECODE)`, with:
 * - `colorSpaceConversion: 'none'`: the file's code values exactly as stored. An embedded ICC
 *   profile or gAMA chunk is ignored, so a tagged file and an untagged one with the same values
 *   give the same pixels, whatever the host's display profile. Captures are sRGB by contract.
 * - `premultiplyAlpha: 'none'`: straight alpha; the shader premultiplies after the sRGB decode, in
 *   linear light. (A capture with transparent edges can fringe slightly under filtering; UI
 *   captures are opaque.)
 * - `imageOrientation: 'from-image'`: rows as stored (a PNG has no orientation tag in practice).
 * WebGL ignores its UNPACK_FLIP_Y / PREMULTIPLY / COLORSPACE_CONVERSION settings for an
 * ImageBitmap source, so these flags alone decide the uploaded values.
 *
 * Residency. A frame names the images it shows (`need`); at most `cap` (<= 4) textures live on the
 * GPU. A texture needed and not resident is decoded and uploaded then, after evicting the resident
 * textures this frame does not need, least recently needed first (ties by key). A texture's
 * contents are a pure function of its file, so which textures happen to be resident changes only
 * the time a frame takes, never its pixels: a frame rendered first on a page and the same frame
 * rendered after any other give the same bytes.
 *
 * A frame's names belong to that frame. `need` called before the stage's beginFrame() names the
 * frame about to begin; called between beginFrame() and present(), the frame drawing. `get` refuses
 * a key the drawing frame did not name, even when it is resident and an earlier frame named it, so
 * a missing `need` (a key left out, or no call at all) fails on every page, not only on a page that
 * starts at that frame. A handle from `get` dies when its texture is evicted or disposed (`live`
 * turns false), and the stage refuses to draw a dead one: a handle kept past its frame fails loudly
 * instead of sampling whatever texture happens to be bound.
 *
 * GPU memory per texture: width x height x 4 bytes (SRGB8_ALPHA8) plus a third for the mip chain.
 * A 2560x1600 capture: 16.4 MB + mips = 21.8 MB. A 3840x2400 capture: 36.9 MB + mips = 49.2 MB;
 * four of them resident: about 197 MB. The upload also passes the decoded bitmap (the same size
 * again, CPU or GPU side, released right after).
 */
import type { StageTexture } from './stage.ts';

/** What Textures needs from the stage (a Stage is one): its context and which frame is drawing. */
export interface FrameClock {
  readonly gl: WebGL2RenderingContext;
  /** output frames begun so far */
  readonly frame: number;
  /** between beginFrame() and present() */
  readonly drawing: boolean;
}

/** The most textures a page keeps on the GPU at once. */
export const MAX_RESIDENT = 4;

/** createImageBitmap flags for captures (see the module comment). */
export const DECODE: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'from-image' };

/** Bytes of GPU memory a w x h SRGB8_ALPHA8 texture with a full mip chain takes. */
export function textureBytes(width: number, height: number): number {
  let total = 0;
  let w = width;
  let h = height;
  for (;;) {
    total += w * h * 4;
    if (w === 1 && h === 1) return total;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
}

/** Mip levels of a full chain for a w x h texture. */
export const mipLevels = (width: number, height: number): number => Math.floor(Math.log2(Math.max(width, height))) + 1;

export interface ResidencyPlan {
  /** resident keys to delete, in order */
  evict: string[];
  /** keys to decode and upload, in the order needed */
  load: string[];
  /** resident keys after the frame, least recently needed first */
  order: string[];
}

/**
 * Which textures to evict and which to load so a frame that needs `needed` can draw. `resident` is
 * in least-recently-needed order. Evicts only what the frame does not need, least recent first.
 * A pure function of its arguments.
 */
export function planResidency(resident: readonly string[], needed: readonly string[], cap: number): ResidencyPlan {
  const want = [...new Set(needed)];
  if (want.length > cap) throw new Error(`images: a frame needs ${want.length} textures (${want.join(', ')}); at most ${cap} can be resident`);
  const have = new Set(resident);
  const load = want.filter((k) => !have.has(k));
  const over = Math.max(0, resident.length + load.length - cap);
  const wanted = new Set(want);
  const evict = resident.filter((k) => !wanted.has(k)).slice(0, over);
  const gone = new Set(evict);
  // the frame's own keys move to the most recent end, in the order it named them
  const order = [...resident.filter((k) => !gone.has(k) && !wanted.has(k)), ...want];
  return { evict, load, order };
}

interface Entry {
  key: string;
  url: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Every image a page shows, fetched during setup: compressed bytes, keyed by name, one per file. */
export class ImageBank {
  private constructor(private readonly entries: ReadonlyMap<string, Entry>) {}

  /** Fetch and check every file. Call it in the page's setup (before `ready`). */
  static async load(files: Readonly<Record<string, string>>): Promise<ImageBank> {
    const urls = new Map<string, string>();
    for (const [key, url] of Object.entries(files)) {
      const other = urls.get(url);
      if (other !== undefined) throw new Error(`images: '${key}' and '${other}' are the same file (${url}): one key per file`);
      urls.set(url, key);
    }
    const loaded = await Promise.all(
      Object.entries(files).map(async ([key, url]): Promise<Entry> => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`images: '${key}' (${url}): ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob, DECODE);
        const { width, height } = bmp;
        bmp.close();
        if (!(width > 0 && height > 0)) throw new Error(`images: '${key}' (${url}) decoded to ${width}x${height}`);
        return { key, url, blob, width, height };
      }),
    );
    return new ImageBank(new Map(loaded.map((e) => [e.key, e])));
  }

  get keys(): string[] {
    return [...this.entries.keys()];
  }

  /** A file's entry: its key, URL, size and bytes. */
  entry(key: string): Readonly<Entry> {
    const e = this.entries.get(key);
    if (!e) throw new Error(`images: no image '${key}' (have: ${this.keys.join(', ')})`);
    return e;
  }

  size(key: string): { width: number; height: number } {
    const e = this.entry(key);
    return { width: e.width, height: e.height };
  }
}

export interface ResidentTexture extends StageTexture {
  readonly key: string;
  /** GPU bytes, mips included */
  readonly bytes: number;
}

/** The handle `get` returns; `live` turns false when the texture is deleted. */
class Resident implements ResidentTexture {
  live = true;
  constructor(
    readonly key: string,
    readonly texture: WebGLTexture,
    readonly width: number,
    readonly height: number,
    readonly bytes: number,
  ) {}
}

export interface TexturesOptions {
  /** textures kept on the GPU at once, 1..MAX_RESIDENT (default MAX_RESIDENT) */
  cap?: number;
}

/** The GPU side: at most `cap` textures resident, chosen per frame by `need`. */
export class Textures {
  readonly cap: number;
  private readonly gl: WebGL2RenderingContext;
  private readonly live = new Map<string, Resident>();
  /** resident keys, least recently needed first */
  private order: string[] = [];
  /** the keys the last need() named, and the frame (FrameClock.frame) they are for */
  private current = new Set<string>();
  private namedFor = -1;
  /** uploads so far (diagnostics: how often eviction made a texture come back) */
  uploads = 0;

  constructor(
    private readonly clock: FrameClock,
    private readonly bank: ImageBank,
    options: TexturesOptions = {},
  ) {
    const cap = options.cap ?? MAX_RESIDENT;
    if (!(Number.isInteger(cap) && cap >= 1 && cap <= MAX_RESIDENT)) throw new Error(`images: cap ${cap} is not an integer in 1..${MAX_RESIDENT}`);
    this.cap = cap;
    this.gl = clock.gl;
  }

  /**
   * Make a frame's images resident and name them for it: the frame about to begin (called before
   * the stage's beginFrame) or the frame drawing (called after it). Await it before drawing them.
   */
  async need(keys: readonly string[]): Promise<void> {
    // nothing is named while this runs, nor after it fails
    this.current = new Set();
    this.namedFor = -1;
    const frame = this.clock.drawing ? this.clock.frame : this.clock.frame + 1;
    for (const k of keys) this.bank.entry(k);
    const plan = planResidency(this.order, keys, this.cap);
    for (const k of plan.evict) this.delete(k);
    // what is resident at every step, should an upload fail
    this.order = this.order.filter((k) => this.live.has(k));
    for (const k of plan.load) {
      this.live.set(k, await this.upload(k));
      this.order.push(k);
    }
    this.order = plan.order;
    this.current = new Set(keys);
    this.namedFor = frame;
  }

  /** A texture the drawing frame named in its `need`. The handle is for this frame only. */
  get(key: string): ResidentTexture {
    if (!this.clock.drawing) throw new Error(`images: get('${key}') outside a frame: call it between the stage's beginFrame() and present()`);
    if (this.namedFor !== this.clock.frame) throw new Error(`images: get('${key}') in a frame that did not call need(): every frame names its own images`);
    if (!this.current.has(key)) throw new Error(`images: '${key}' was not named in this frame's need() (named: ${[...this.current].join(', ') || 'none'})`);
    return this.live.get(key)!;
  }

  /** Keys on the GPU now, least recently needed first. */
  get resident(): string[] {
    return [...this.order];
  }

  /** GPU bytes held now. */
  get bytes(): number {
    let n = 0;
    for (const t of this.live.values()) n += t.bytes;
    return n;
  }

  private async upload(key: string): Promise<Resident> {
    const gl = this.gl;
    const e = this.bank.entry(key);
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (e.width > max || e.height > max) throw new Error(`images: '${key}' is ${e.width}x${e.height}; this GPU's textures stop at ${max}`);
    const bmp = await createImageBitmap(e.blob, DECODE);
    if (bmp.width !== e.width || bmp.height !== e.height) throw new Error(`images: '${key}' decoded to ${bmp.width}x${bmp.height}, not ${e.width}x${e.height}`);
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // sRGB storage: sampling returns linear light, filtered after the decode
    gl.texStorage2D(gl.TEXTURE_2D, mipLevels(e.width, e.height), gl.SRGB8_ALPHA8, e.width, e.height);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, e.width, e.height, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    bmp.close();
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) throw new Error(`images: uploading '${key}' failed (GL error 0x${err.toString(16)})`);
    this.uploads++;
    return new Resident(key, texture, e.width, e.height, textureBytes(e.width, e.height));
  }

  private delete(key: string): void {
    const t = this.live.get(key)!;
    t.live = false;
    this.gl.deleteTexture(t.texture);
    this.live.delete(key);
  }

  /** Free every texture (every handle dies). */
  dispose(): void {
    for (const k of [...this.live.keys()]) this.delete(k);
    this.order = [];
    this.current = new Set();
    this.namedFor = -1;
  }
}
