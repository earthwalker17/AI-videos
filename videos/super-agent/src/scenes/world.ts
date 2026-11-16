/**
 * The world every scene shares: the stack's heights, its slabs, the camera's two attitudes and the
 * names on its spine. Height is distance from the work: events happen at the bottom, the two slabs
 * are the article's two levels, and you are on top.
 */
import { clamp } from '@aiv/core';
import type { Pose, Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';

/** heights of the four strata, world units */
export const LEVEL = { world: 0, workers: 300, router: 600, you: 900 } as const;
export type LevelName = keyof typeof LEVEL;

/**
 * A slab is full-bleed and has a body: it leaves the frame on both sides, it is deep enough that
 * a look-down never shows its edges behind the words, and it is thick enough to carry its name on
 * its front face when the stack is seen edge-on.
 */
export const SLAB = { halfW: 3400, halfD: 600, thick: 96 } as const;

/** Plan: a steep look-down on one plane, which then fills the frame. */
export const plan = (y: number, x = 0, z = 0, dist = 1, tilt = 74): Pose => ({ target: [x, y, z], tilt, yaw: 0, dist });

/** Strata: the stack seen nearly edge-on, each slab a band with a face. */
export const strata = (dist = 1.2, y = 400): Pose => ({ target: [0, y, 0], tilt: 10, yaw: 0, dist });

/** How far out of focus a height is: 0 on the focus plane, 1 one level away. */
export const blur = (y: number, focus: number): number => Math.abs(y - focus) / 300;

/** 1 when the stack is seen edge-on, 0 in a look-down. */
export const edgeOn = (d: Draw): number => clamp((34 - d.cam.pose.tilt) / 16);

/**
 * A slab: smoked glass with a lit top edge and a front face. `focus` is the height in focus; a
 * slab away from it is softer and dimmer. `lit` in 0..1 scales the whole slab (for one that is
 * forming). Its name is set on its face.
 */
export function slab(d: Draw, y: number, focus: number, lit = 1, name = ''): void {
  if (lit <= 0) return;
  const b = blur(y, focus);
  const soft = b * 5;
  const dim = 1 / (1 + 1.1 * b);
  const p = d.pal;
  const e = edgeOn(d);
  // the top: a faint lift of the ground, so planes beneath read through it
  d.flat([0, y, 0], [SLAB.halfW, SLAB.halfD], 0, mix(p.ground[1], p.bone, 0.06), { alpha: (0.2 + 0.2 * e) * lit * dim, feather: soft * 4 });
  if (e > 0) {
    // the front face, seen when the stack is edge-on: the slab's body
    d.face([0, y - SLAB.thick / 2, SLAB.halfD], [SLAB.halfW, SLAB.thick / 2], mix(p.ground[0], p.ground[1], 0.75), { alpha: 0.92 * lit * e });
    d.line([[-SLAB.halfW, y - SLAB.thick, SLAB.halfD], [SLAB.halfW, y - SLAB.thick, SLAB.halfD]], 1.6, p.bone, { alpha: 0.16 * lit * e });
    const far: Vec3[] = [[-SLAB.halfW, y, -SLAB.halfD], [SLAB.halfW, y, -SLAB.halfD]];
    d.line(far, 1.6, p.bone, { alpha: 0.2 * lit * e, feather: soft });
    // the top's near edge catches the light
    const near: Vec3[] = [[-SLAB.halfW, y, SLAB.halfD], [SLAB.halfW, y, SLAB.halfD]];
    d.line(near, 3, scale(p.bone, 1.15), { alpha: 0.8 * lit * e });
    if (name) {
      const q = d.cam.project([0, y - SLAB.thick / 2, SLAB.halfD]);
      d.text('label', name, 132, q.y + 19, { alpha: lit * e });
    }
  }
}

/** A name beside a stratum that has no slab (you, the world's events). */
export function spineLabel(d: Draw, text: string, at: Vec3, alpha: number, rgb = d.pal.bone, x = 132): void {
  if (alpha <= 0) return;
  const q = d.cam.project(at);
  d.text('label', text, x, clamp(q.y, 96, 1000) + 19, { rgb, alpha });
}
