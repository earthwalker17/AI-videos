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
 * a look-down never shows its edges behind the words, and it is thick enough to show a front face
 * when the stack is seen edge-on.
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
 * How much of the names on the stack's spine shows. They go before the stack has turned far and
 * come back once it has nearly settled, so in a dive or a rise no name meets another, or its mark.
 */
export const namesOn = (d: Draw): number => clamp((24 - d.cam.pose.tilt) / 8);

/**
 * Where the spine's names start, how far below a mark's middle a name's baseline sits, the least a
 * level's name stands above its slab's lit edge, and how far in from that edge the Workers' name
 * stands (world units: near their cells, clear of the nearest one).
 */
export const NAME = { x: 132, drop: 19, rise: 13, inset: 150, top: 96, bottom: 1000 } as const;

/**
 * The baseline of a level's name: on its slab's top, in the band of what it names. (Set under the
 * lit edge, on the front face, a name reads as the heading of the level below.) The Router's name
 * stands midway between its rail, which runs down the slab's middle, and the lit edge.
 */
export const slabNameY = (d: Draw, y: number): number => {
  if (y !== LEVEL.router) return d.cam.project([0, y, SLAB.halfD - NAME.inset]).y;
  const edge = d.cam.project([0, y, SLAB.halfD]).y;
  const room = edge - d.cam.project([0, y, 0]).y - d.type.layout('label', 'R').cap;
  return edge - Math.max(NAME.rise, room / 2);
};

/** The baseline of a line set on a slab's front face, under its lit edge. */
export const slabFaceY = (d: Draw, y: number): number => d.cam.project([0, y - SLAB.thick / 2, SLAB.halfD]).y + NAME.drop;

/** The baseline of a name beside a stratum that has no slab: it waits at the frame's edge while its mark is out of frame. */
export const spineNameY = (d: Draw, at: Vec3): number => clamp(d.cam.project(at).y, NAME.top, NAME.bottom) + NAME.drop;

/**
 * A slab: smoked glass with a lit top edge and a front face. `focus` is the height in focus; a
 * slab away from it is softer and dimmer. `lit` in 0..1 scales the whole slab (for one that is
 * forming). Its name stands on its top, at the near edge.
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
    // it is opaque: the far lanes of the level below do not ghost through it
    d.face([0, y - SLAB.thick / 2, SLAB.halfD], [SLAB.halfW, SLAB.thick / 2], mix(p.ground[0], p.ground[1], 0.75), { alpha: lit * e });
    d.line([[-SLAB.halfW, y - SLAB.thick, SLAB.halfD], [SLAB.halfW, y - SLAB.thick, SLAB.halfD]], 1.6, p.bone, { alpha: 0.16 * lit * e });
    const far: Vec3[] = [[-SLAB.halfW, y, -SLAB.halfD], [SLAB.halfW, y, -SLAB.halfD]];
    d.line(far, 1.6, p.bone, { alpha: 0.2 * lit * e, feather: soft });
    // the top's near edge catches the light
    const near: Vec3[] = [[-SLAB.halfW, y, SLAB.halfD], [SLAB.halfW, y, SLAB.halfD]];
    d.line(near, 3, scale(p.bone, 1.15), { alpha: 0.8 * lit * e });
    // a name never stands on the frame's foot: it goes before its slab's edge leaves the frame
    if (name) d.text('label', name, NAME.x, slabNameY(d, y), { alpha: lit * namesOn(d) * clamp((1046 - slabNameY(d, y)) / 40) });
  }
}

/** A name beside a stratum that has no slab (you, the world's events). */
export function spineLabel(d: Draw, text: string, at: Vec3, alpha: number, rgb = d.pal.bone): void {
  if (alpha <= 0) return;
  d.text('label', text, NAME.x, spineNameY(d, at), { rgb, alpha });
}
