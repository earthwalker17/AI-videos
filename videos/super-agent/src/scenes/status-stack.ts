/**
 * The resting stack, opened up: the same marks as `rest` (lift.ts), with what the evidence and
 * status sections need on top of it. The camera may leave the stack (its names then go with their
 * marks instead of waiting at the frame's edge), and the structure may be cut: a gap in the
 * Router's rail, a slice through the Router's slab, a window in the Workers' front face.
 *
 * Cuts are given in screen x. Seen edge-on the stack reads as a section, so a cut is plumb on the
 * screen: every edge it crosses is broken at the same place.
 *
 * With nothing cut and the stack in frame it IS `rest`, so a section that uses it still begins and
 * ends on the resting stack.
 */
import { clamp } from '@aiv/core';
import { LABELS } from '../cues.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale, type Rgb } from '../kit/look.ts';
import { IDLE, WORLD_NAME, YOU_HOME, idleCells, rest, routerRail, worldLanes, you } from './lift.ts';
import { LEVEL, NAME, SLAB, blur, edgeOn, namesOn, slab, slabNameY, spineLabel, strata } from './world.ts';

/** The stack edge-on, as on the title card: the view both sections rest on. */
export const STACK_VIEW = strata(1.2);

/** a span of screen x, reference px */
export type Span = readonly [number, number];

export interface StackOptions {
  /** a gap in the Router's rail */
  railGap?: Span;
  /** a slice through the Router's slab and its rail */
  routerCut?: Span;
  /** a window in the Workers' front face */
  workersCut?: Span;
  /** your light (default: idle, you only watch) */
  you?: number;
}

/** a name beside a stratum goes when its mark has left the bottom of the frame */
const inFrame = (y: number): number => clamp((1060 - y) / 50);

/** The lit ground as film.ts draws it (its endSub call): what shows where the structure is cut away. */
const GROUND = { centre: [960, 500], radius: [1050, 620] } as const;
function ground(d: Draw, x: number, y: number): Rgb {
  const px = (x - GROUND.centre[0]) / GROUND.radius[0];
  const py = (y - GROUND.centre[1]) / GROUND.radius[1];
  return mix(d.pal.ground[0], d.pal.ground[1], Math.exp(-(px * px + py * py)));
}

/** The world-x stretches of a full-width mark at height `y`, depth `z`, that are left when `cuts` (screen x) are taken out. */
function left(d: Draw, y: number, z: number, cuts: readonly Span[]): Array<[number, number]> {
  const q = d.cam.project([0, y, z]);
  const out: Array<[number, number]> = [];
  let from = -SLAB.halfW;
  for (const [a, b] of [...cuts].sort((m, n) => m[0] - n[0])) {
    const to = (a - q.x) / q.s;
    if (to > from) out.push([from, to]);
    from = Math.max(from, (b - q.x) / q.s);
  }
  if (SLAB.halfW > from) out.push([from, SLAB.halfW]);
  return out;
}

/** A slab (world.ts) with a span cut out: through all of it, or only out of its front face and that face's edges. */
function cutSlab(d: Draw, y: number, focus: number, lit: number, name: string, cut: Span, through: boolean): void {
  if (lit <= 0) return;
  const b = blur(y, focus);
  const soft = b * 5;
  const dim = 1 / (1 + 1.1 * b);
  const p = d.pal;
  const e = edgeOn(d);
  const cuts = [cut];
  d.flat([0, y, 0], [SLAB.halfW, SLAB.halfD], 0, mix(p.ground[1], p.bone, 0.06), { alpha: (0.2 + 0.2 * e) * lit * dim, feather: soft * 4 });
  if (e <= 0) return;
  if (through) {
    // the top is taken back to the ground between its two edges
    const top = d.cam.project([0, y, -SLAB.halfD]).y - 3;
    const bottom = d.cam.project([0, y, SLAB.halfD]).y;
    const rows = 3;
    for (let k = 0; k < rows; k++) {
      const y0 = top + ((bottom - top) * k) / rows;
      const y1 = top + ((bottom - top) * (k + 1)) / rows;
      d.box([(cut[0] + cut[1]) / 2, (y0 + y1) / 2], [(cut[1] - cut[0]) / 2, (y1 - y0) / 2 + 0.5], 0, ground(d, (cut[0] + cut[1]) / 2, (y0 + y1) / 2), { alpha: e });
    }
  }
  for (const [a, z] of left(d, y - SLAB.thick / 2, SLAB.halfD, cuts)) {
    d.face([(a + z) / 2, y - SLAB.thick / 2, SLAB.halfD], [(z - a) / 2, SLAB.thick / 2], mix(p.ground[0], p.ground[1], 0.75), { alpha: lit * e });
  }
  for (const [a, z] of left(d, y - SLAB.thick, SLAB.halfD, cuts)) {
    d.line([[a, y - SLAB.thick, SLAB.halfD], [z, y - SLAB.thick, SLAB.halfD]], 1.6, p.bone, { alpha: 0.16 * lit * e });
  }
  for (const [a, z] of left(d, y, -SLAB.halfD, through ? cuts : [])) {
    d.line([[a, y, -SLAB.halfD], [z, y, -SLAB.halfD]], 1.6, p.bone, { alpha: 0.2 * lit * e, feather: soft });
  }
  for (const [a, z] of left(d, y, SLAB.halfD, cuts)) {
    d.line([[a, y, SLAB.halfD], [z, y, SLAB.halfD]], 3, scale(p.bone, 1.15), { alpha: 0.8 * lit * e });
  }
  // the cut's own edges catch the light like the slab's others: it is a cut, made on purpose, not a hole in the picture
  if (cut[1] - cut[0] > 6) {
    const top = d.cam.project([0, y, through ? -SLAB.halfD : SLAB.halfD]).y;
    const bottom = d.cam.project([0, y - SLAB.thick, SLAB.halfD]).y;
    const open = clamp((cut[1] - cut[0] - 6) / 30);
    for (const x of cut) d.path([[x, top], [x, bottom]], 2.4, scale(p.bone, 1.15), { alpha: 0.7 * lit * e * open });
  }
  d.text('label', name, NAME.x, slabNameY(d, y), { alpha: lit * namesOn(d) * clamp((1046 - slabNameY(d, y)) / 40) });
}

/** The Router's rail (lift.ts, routerRail) in the stretches that are left of it. */
function cutRail(d: Draw, focus: number, alpha: number, cuts: readonly Span[]): void {
  const b = blur(LEVEL.router, focus);
  const dim = 1 / (1 + 0.9 * b);
  for (const [a, z] of left(d, LEVEL.router + 1, 0, cuts)) {
    if (z - a < 14) continue;
    const e = edgeOn(d);
    if (e < 1) d.flat([(a + z) / 2, LEVEL.router + 1, 0], [(z - a) / 2, 7], 7, d.pal.bone, { alpha: 0.9 * alpha * dim * (1 - e), feather: b * 4 });
    if (e > 0) d.line([[a, LEVEL.router + 1, 0], [z, LEVEL.router + 1, 0]], 2.4, d.pal.bone, { alpha: 0.9 * alpha * dim * e });
  }
}

export function stack(d: Draw, f: number, o: StackOptions = {}): void {
  const e = edgeOn(d);
  const youY = d.cam.project(YOU_HOME).y;
  const youName = inFrame(youY);
  const worldName = inFrame(d.cam.project(WORLD_NAME).y);
  const railCuts = [o.railGap, o.routerCut].filter((c): c is Span => c !== undefined);
  if (railCuts.length === 0 && !o.workersCut && youName >= 1 && worldName >= 1) {
    rest(d, f, o.you === undefined ? {} : { you: o.you });
    return;
  }

  // `rest`, part for part
  const focus = d.cam.pose.target[1];
  const seen = (y: number): number => 1 - clamp((y - focus) / 120) * (1 - e);
  worldLanes(d, f, focus, 1);
  const w = seen(LEVEL.workers);
  if (w > 0) {
    if (o.workersCut) cutSlab(d, LEVEL.workers, focus, w, LABELS.workers, o.workersCut, false);
    else slab(d, LEVEL.workers, focus, w, LABELS.workers);
    idleCells(d, focus, w);
  }
  const r = seen(LEVEL.router);
  if (r > 0) {
    if (o.routerCut) cutSlab(d, LEVEL.router, focus, r, LABELS.router, o.routerCut, true);
    else slab(d, LEVEL.router, focus, r, LABELS.router);
    if (railCuts.length === 0) routerRail(d, focus, r);
    else cutRail(d, focus, r, railCuts);
  }
  // far below the frame, your light would still spill into it
  you(d, YOU_HOME, e * clamp((1260 - youY) / 100), e, o.you ?? IDLE);
  const n = namesOn(d);
  if (n > 0) {
    spineLabel(d, LABELS.you, YOU_HOME, n * youName, d.pal.you);
    spineLabel(d, LABELS.world, WORLD_NAME, n * worldName, mix(d.pal.bone, d.pal.ash, 0.3));
  }
}
