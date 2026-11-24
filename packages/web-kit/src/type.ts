// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2): the style table is a parameter
// instead of the film's look.ts, and the shelf packing and the layout are pure functions of their own.
/**
 * Type: every glyph a film shows is rasterised once, at the size it is shown, on a CPU 2D canvas
 * (the one text path this repository has proven deterministic above 136 px), packed into one
 * atlas and drawn as quads by the stage. Layout is measured here too: there is no browser text
 * layout behind a WebGL canvas.
 *
 * The atlas is built at setup from the styles' declared character sets, never lazily, so its
 * contents do not depend on which frame was rendered first. The page must have loaded every
 * style's font before (fontSpecs lists them for the page contract's `fonts`).
 */
import type { AtlasImage } from './stage.ts';

export interface TypeStyle {
  /** a FontFace family the page registered (a name no system font has) */
  family: string;
  weight: number;
  /** font size in reference px */
  px: number;
  /** extra advance per glyph, in em */
  tracking: number;
  /** line height as a multiple of px */
  leading: number;
  /** outline only, with this stroke in reference px (hollow numerals) */
  hollow?: number;
  /** the characters the atlas holds for this style */
  chars: string;
}

export type StyleTable<S extends string> = Readonly<Record<S, TypeStyle>>;

export interface Glyph {
  /** atlas rectangle, 0..1 */
  uv: readonly [number, number, number, number];
  /** quad size and its offset from the pen position on the baseline, in reference px */
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** advance in reference px */
  adv: number;
}

export interface Placed {
  g: Glyph;
  /** pen x of this glyph from the line's left edge, reference px */
  x: number;
  line: number;
  /** index among the visible glyphs of the whole text (for staggered entrances) */
  k: number;
}

export interface Layout {
  style: TypeStyle;
  glyphs: Placed[];
  /** each line's width, and the widest */
  widths: number[];
  width: number;
  /** cap height and baseline-to-baseline distance, reference px */
  cap: number;
  lineStep: number;
  count: number;
}

/** Character sets for TypeStyle.chars. */
export const CHARS = {
  /** capitals, figures and the punctuation a headline uses */
  caps: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;?!\'’“”-–+%&×·~/()',
  /** printable ASCII and a few typographic marks */
  ascii: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’“”–×·→',
  /** figures and the signs around them (a style that needs unit letters adds them) */
  nums: '0123456789 .,~%×–-→+',
} as const;

const PAD = 3;
/** the arrow is drawn, not typeset: Latin subsets of fonts often do not carry it */
const ARROW = '→';

/** A rectangle to pack: its key and size in atlas pixels (0 x 0 for a blank glyph). */
export interface Cell {
  key: string;
  w: number;
  h: number;
}

/**
 * Shelf packing, tallest first, ties by key: a pure function of the cells. Positions are the
 * cells' top-left corners; blank cells get none. `height` is the atlas height (a power of two).
 */
export function packShelves(cells: readonly Cell[], width: number): { pos: Map<string, [number, number]>; height: number } {
  const order = cells.filter((c) => c.w > 0).sort((a, b) => b.h - a.h || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const pos = new Map<string, [number, number]>();
  let x = 1;
  let y = 1;
  let shelf = 0;
  for (const c of order) {
    if (c.w + 2 > width) throw new Error(`type: glyph '${c.key}' is ${c.w} px wide; the atlas is ${width}`);
    if (x + c.w + 1 > width) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    pos.set(c.key, [x, y]);
    x += c.w + 1;
    shelf = Math.max(shelf, c.h);
  }
  return { pos, height: 2 ** Math.ceil(Math.log2(y + shelf + 2)) };
}

/**
 * Lay `text` out in `style` ('\n' breaks lines), from glyph metrics and a kerning function: a pure
 * function of its arguments. A blank glyph (a space) advances the pen and is not placed.
 */
export function layoutText(text: string, style: TypeStyle, cap: number, glyph: (ch: string) => Glyph | undefined, kern: (a: string, b: string) => number): Layout {
  const glyphs: Placed[] = [];
  const widths: number[] = [];
  let k = 0;
  text.split('\n').forEach((row, line) => {
    let x = 0;
    let prev = '';
    let end = 0;
    for (const ch of row) {
      const g = glyph(ch);
      if (!g) throw new Error(`type: the style has no glyph for '${ch}' (in "${text}")`);
      if (prev) x += kern(prev, ch);
      if (g.w > 0) {
        glyphs.push({ g, x, line, k });
        k++;
        end = x + g.adv;
      }
      x += g.adv + style.tracking * style.px;
      prev = ch;
    }
    widths.push(end);
  });
  return { style, glyphs, widths, width: Math.max(0, ...widths), cap, lineStep: style.leading * style.px, count: k };
}

export class Type<S extends string = string> {
  private readonly glyphs = new Map<string, Glyph>();
  private readonly kerns = new Map<string, number>();
  private readonly layouts = new Map<string, Layout>();
  private readonly caps = new Map<S, number>();
  private readonly ctx: CanvasRenderingContext2D;
  readonly image: AtlasImage;

  /** `u` is device pixels per reference pixel: glyphs are rasterised at the size they are drawn. */
  constructor(
    readonly styles: StyleTable<S>,
    private readonly u: number,
  ) {
    const width = u > 0.75 ? 4096 : 2048;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 16;
    // a CPU canvas: text rasterises the same way every time (willReadFrequently)
    const measure = canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx = measure;

    interface Sized extends Cell {
      style: TypeStyle;
      ch: string;
      left: number;
      asc: number;
      adv: number;
    }
    const cells: Sized[] = [];
    for (const id of Object.keys(styles) as S[]) {
      const style = styles[id];
      this.font(style);
      const grow = style.hollow ? Math.ceil((style.hollow * u) / 2) + 1 : 0;
      for (const ch of new Set(style.chars + ARROW)) {
        const key = `${id}|${ch}`;
        if (ch === ARROW) {
          const size = style.px * u;
          cells.push({ key, style, ch, w: Math.ceil(size * 0.62) + 2 * PAD, h: Math.ceil(size * 0.42) + 2 * PAD, left: 0, asc: size * 0.56, adv: size * 0.66 });
          continue;
        }
        const m = measure.measureText(ch);
        const left = Math.ceil(m.actualBoundingBoxLeft) + grow;
        const right = Math.ceil(m.actualBoundingBoxRight) + grow;
        const asc = Math.ceil(m.actualBoundingBoxAscent) + grow;
        const desc = Math.ceil(m.actualBoundingBoxDescent) + grow;
        const blank = ch === ' ' || left + right <= 0 || asc + desc <= 0;
        cells.push({ key, style, ch, w: blank ? 0 : left + right + 2 * PAD, h: blank ? 0 : asc + desc + 2 * PAD, left, asc, adv: m.width });
      }
      const capM = measure.measureText('H');
      this.caps.set(id, capM.actualBoundingBoxAscent / u);
    }

    const { pos, height } = packShelves(cells, width);
    if (height > 8192) throw new Error(`type: the atlas needs ${height} rows; trim the styles`);

    const sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = height;
    const ctx = sheet.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const c of cells) {
      const g: Glyph = { uv: [0, 0, 0, 0], w: 0, h: 0, ox: 0, oy: 0, adv: c.adv / u };
      const at = pos.get(c.key);
      if (at) {
        const [cx, cy] = at;
        ctx.font = `${c.style.weight} ${c.style.px * u}px "${c.style.family}"`;
        if (c.ch === ARROW) this.arrow(ctx, cx + PAD, cy + PAD, c.w - 2 * PAD, c.h - 2 * PAD, c.style);
        else if (c.style.hollow) {
          ctx.lineWidth = c.style.hollow * u;
          ctx.strokeText(c.ch, cx + PAD + c.left, cy + PAD + c.asc);
        } else ctx.fillText(c.ch, cx + PAD + c.left, cy + PAD + c.asc);
        g.uv = [cx / width, cy / height, (cx + c.w) / width, (cy + c.h) / height];
        g.w = c.w / u;
        g.h = c.h / u;
        g.ox = -(c.left + PAD) / u;
        g.oy = -(c.asc + PAD) / u;
      }
      this.glyphs.set(c.key, g);
    }
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3]!;
    this.image = { data, width, height };
  }

  private font(style: TypeStyle): void {
    this.ctx.font = `${style.weight} ${style.px * this.u}px "${style.family}"`;
  }

  /** A drawn arrow, as heavy as the style's strokes, sitting at the middle of the cap height. */
  private arrow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: TypeStyle): void {
    const t = style.hollow ? style.hollow * this.u * 1.3 : style.px * this.u * (style.weight >= 700 ? 0.085 : 0.06);
    const my = y + h / 2;
    ctx.save();
    ctx.lineWidth = t;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + t, my);
    ctx.lineTo(x + w - t, my);
    ctx.moveTo(x + w - t - h * 0.42, my - h * 0.42 + t / 2);
    ctx.lineTo(x + w - t, my);
    ctx.lineTo(x + w - t - h * 0.42, my + h * 0.42 - t / 2);
    ctx.stroke();
    ctx.restore();
  }

  private kern(id: S, a: string, b: string): number {
    if (a === ARROW || b === ARROW || a === ' ' || b === ' ') return 0;
    const key = `${id}|${a}${b}`;
    let k = this.kerns.get(key);
    if (k === undefined) {
      this.font(this.styles[id]);
      const m = this.ctx;
      k = (m.measureText(a + b).width - m.measureText(a).width - m.measureText(b).width) / this.u;
      this.kerns.set(key, k);
    }
    return k;
  }

  /** Lay `text` out in a style ('\n' breaks lines). A pure function of its arguments, memoised. */
  layout(id: S, text: string): Layout {
    const key = `${id}|${text}`;
    const hit = this.layouts.get(key);
    if (hit) return hit;
    const style = this.styles[id];
    if (!style) throw new Error(`type: no style '${id}'`);
    const out = layoutText(
      text,
      style,
      this.caps.get(id)!,
      (ch) => this.glyphs.get(`${id}|${ch}`),
      (a, b) => this.kern(id, a, b),
    );
    this.layouts.set(key, out);
    return out;
  }
}

/** The CSS font shorthands the page must have loaded before the atlas is built. */
export function fontSpecs(styles: StyleTable<string>): string[] {
  const seen = new Set<string>();
  for (const s of Object.values(styles)) seen.add(`${s.weight} ${s.px}px "${s.family}"`);
  return [...seen];
}
