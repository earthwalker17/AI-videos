/**
 * Draw: what a scene calls. It turns marks with a meaning (a dot, a cell, a line, a line of type)
 * into the stage's three primitives. A Draw is made per sub-frame and holds that sub-frame's
 * camera, palette and time, so a scene is a pure function of `f`.
 */
import { clamp, easings } from '@aiv/core';
import type { Camera, Vec2, Vec3 } from './camera.ts';
import type { Palette, Rgb, StyleId } from './look.ts';
import type { Stage } from './stage.ts';
import type { Type } from './type.ts';

const X: Vec3 = [1, 0, 0];
const Y_DOWN: Vec3 = [0, 1, 0];
/** in a plane, local y runs towards the viewer (down the screen in plan view), like screen y */
const Z: Vec3 = [0, 0, 1];
/** on an upright face, local y runs down the face */
const DOWN: Vec3 = [0, -1, 0];
const FULL: Vec2 = [0, 4];
const NO_DASH: readonly [number, number, number] = [0, 0, 0];

export interface MarkOptions {
  alpha?: number;
  /** edge softness: reference px on screen, world units in the world */
  feather?: number;
  /** 1 adds light instead of covering (emission) */
  add?: number;
  /** outline width; 0 fills */
  stroke?: number;
  /** [centre angle, half-width] in radians: draw only that part of a ring */
  arc?: Vec2;
  /** [period in radians, duty 0..1, phase]: a dashed ring */
  dash?: readonly [number, number, number];
}

export interface LineOptions {
  alpha?: number;
  feather?: number;
  add?: number;
  /** draw only this part of the line, as fractions of its length */
  trim?: Vec2;
  /** [period px, duty, phase px] */
  dash?: readonly [number, number, number];
}

export type Align = 'left' | 'centre' | 'right';

export interface TextOptions {
  align?: Align;
  rgb?: Rgb;
  alpha?: number;
  /** entrance progress 0..1 (glyphs rise through the baseline, one after another) */
  enter?: number;
  /** exit progress 0..1 (glyphs sink back into the baseline) */
  exit?: number;
  /** uniform scale about the anchor */
  scale?: number;
  add?: number;
  /** a colour for some glyphs, by their index among the visible glyphs (a word that names its mark) */
  tint?: (k: number) => Rgb | undefined;
}

export class Draw {
  constructor(
    readonly stage: Stage,
    readonly type: Type,
    readonly cam: Camera,
    readonly pal: Palette,
    /** film frame, fractional inside a sub-frame */
    readonly f: number,
  ) {}

  // ── the world ──────────────────────────────────────────────────────────────────────────────

  /** A disc that faces the camera (an event, a person). `r` in world units. */
  dot(p: Vec3, r: number, rgb: Rgb, o: MarkOptions = {}): void {
    this.stage.space(true);
    this.stage.shape(p, this.cam.right, [-this.cam.up[0], -this.cam.up[1], -this.cam.up[2]], [r, r], r, o.stroke ?? 0, o.feather ?? 0, 0, rgb, o.alpha ?? 1, o.add ?? 0, o.arc ?? FULL, o.dash ?? NO_DASH);
  }

  /** A halo around a point: light that falls off over `reach` world units. Always additive. */
  halo(p: Vec3, r: number, reach: number, rgb: Rgb, alpha = 1): void {
    this.stage.space(true);
    this.stage.shape(p, this.cam.right, [-this.cam.up[0], -this.cam.up[1], -this.cam.up[2]], [r, r], r, 0, 0, reach, rgb, alpha, 1);
  }

  /** A rounded box lying in its plane (a cell, a slab, a capsule). `half` = half width, half depth. */
  flat(p: Vec3, half: Vec2, radius: number, rgb: Rgb, o: MarkOptions = {}): void {
    this.stage.space(true);
    this.stage.shape(p, X, Z, half, radius, o.stroke ?? 0, o.feather ?? 0, 0, rgb, o.alpha ?? 1, o.add ?? 0, o.arc ?? FULL, o.dash ?? NO_DASH);
  }

  /** A rectangle standing upright and facing the viewer (a slab's front face). `half` = half width, half height. */
  face(p: Vec3, half: Vec2, rgb: Rgb, o: MarkOptions = {}): void {
    this.stage.space(true);
    this.stage.shape(p, X, DOWN, half, 0, o.stroke ?? 0, o.feather ?? 0, 0, rgb, o.alpha ?? 1, o.add ?? 0);
  }

  /** Light pooled on a plane under a lit mark. */
  pool(p: Vec3, half: Vec2, reach: number, rgb: Rgb, alpha = 1): void {
    this.stage.space(true);
    this.stage.shape(p, X, Z, half, Math.min(half[0], half[1]), 0, 0, reach, rgb, alpha, 1);
  }

  /** A line through world points, `width` reference px wide at the reference distance. */
  line(pts: readonly Vec3[], width: number, rgb: Rgb, o: LineOptions = {}): void {
    if (pts.length < 2) return;
    const px: Array<[number, number]> = [];
    let s = 0;
    for (const p of pts) {
      const q = this.cam.project(p);
      px.push([q.x, q.y]);
      s += q.s;
    }
    this.path(px, width * (s / pts.length), rgb, o);
  }

  // ── the screen (reference px) ──────────────────────────────────────────────────────────────

  /** A rounded box on the screen. */
  box(c: Vec2, half: Vec2, radius: number, rgb: Rgb, o: MarkOptions = {}): void {
    this.stage.space(false);
    this.stage.shape([c[0], c[1], 0], X, Y_DOWN, half, radius, o.stroke ?? 0, o.feather ?? 0, 0, rgb, o.alpha ?? 1, o.add ?? 0, o.arc ?? FULL, o.dash ?? NO_DASH);
  }

  /** A line through screen points. */
  path(pts: ReadonlyArray<readonly [number, number]>, width: number, rgb: Rgb, o: LineOptions = {}): void {
    let trim: Vec2 | undefined;
    if (o.trim) {
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
      trim = [o.trim[0] * total, o.trim[1] * total];
    }
    this.stage.ribbon(pts, width, o.feather ?? 0, rgb, o.alpha ?? 1, o.add ?? 0, trim, o.dash ?? NO_DASH);
  }

  /**
   * Type. `x` is the left edge, the centre or the right edge by `align`; `y` is the first line's
   * baseline. Glyphs enter by rising through their baseline, staggered, and leave by sinking back.
   * Returns the layout, so a scene can place marks against the words.
   */
  text(style: StyleId, str: string, x: number, y: number, o: TextOptions = {}) {
    const lay = this.type.layout(style, str);
    const enter = o.enter ?? 1;
    const exit = o.exit ?? 0;
    const alpha = o.alpha ?? 1;
    if (alpha <= 0 || enter <= 0 || exit >= 1) return lay;
    const rgb = o.rgb ?? this.pal.bone;
    const k = o.scale ?? 1;
    const align = o.align ?? 'left';
    const n = Math.max(1, lay.count);
    // each glyph takes `own` of the entrance, and the last one starts at 1 - own
    const own = n === 1 ? 1 : 0.42;
    const step = n === 1 ? 0 : (1 - own) / (n - 1);
    const rise = lay.cap * 1.12 * k;
    for (const pg of lay.glyphs) {
      const lw = lay.widths[pg.line]!;
      const left = align === 'left' ? x : align === 'centre' ? x - (lw * k) / 2 : x - lw * k;
      const base = y + pg.line * lay.lineStep * k;
      const pin = easings.outExpo(clamp((enter - pg.k * step) / own));
      const stepOut = step * 0.5;
      const pout = easings.inCubic(clamp((exit - pg.k * stepOut) / (1 - (n - 1) * stepOut)));
      const dy = (1 - pin) * rise + pout * rise;
      const gx = left + (pg.x + pg.g.ox) * k;
      const gy = base + pg.g.oy * k + dy;
      const gh = pg.g.h * k;
      // nothing shows below the baseline's floor: the glyph rises out of the plane's edge
      const floor = base + lay.cap * 0.44 * k;
      const cut = clamp((floor - gy) / gh, 0, 1);
      if (cut <= 0) continue;
      const a = alpha * clamp(pin * 3) * (1 - clamp(pout * 1.4));
      this.stage.glyph(gx, gy, pg.g.w * k, gh, pg.g.uv, o.tint?.(pg.k) ?? rgb, a, o.add ?? 0, [-1, -1, 2, cut < 1 ? cut : 2], cut < 1 ? 0.012 : 0);
    }
    return lay;
  }
}
