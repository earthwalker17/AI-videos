/**
 * Section 2, "The lift": on the drop, your knotted trail leaves the floor, pulls taut and becomes
 * the Router: one long-lived line on a slab of its own. The sessions stay below as the Workers'
 * level, the world's events appear underneath, and you rise to the top.
 *
 * It also holds the parts of the stack every later section draws: the Router's rail, the world's
 * lanes, the idle cells and you.
 */
import { clamp, easings, lerp, rand } from '@aiv/core';
import { at, LABELS } from '../cues.ts';
import type { Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { bump, prog } from '../kit/time.ts';
import { CELLS, FREEZE, trail, youAt } from './flat.ts';
import { LEVEL, SLAB, blur, edgeOn, slab, spineLabel } from './world.ts';

export const DROP = at(9, 1);
/** the trail has left the floor and is a straight line by here */
export const TAUT = at(9, 4);
/** the stack stands by here */
export const STOOD = at(10, 1);

/** where you rest on top of the stack */
export const YOU_HOME: Vec3 = [-610, LEVEL.you, 0];

const SEED = 4202;
/** lanes of the world: each is one stream of events */
export const LANES: readonly number[] = [-330, -200, -70, 60, 190, 320];

/** The Router's line at frame `f` during the lift: the trail's points on their way to one straight line. */
function taut(f: number): Vec3[] {
  const pts = trail(FREEZE);
  const n = pts.length;
  const rise = prog(f, DROP, TAUT, easings.inOutCubic);
  const pull = prog(f, DROP + 8, TAUT + 10, easings.inOutCubic);
  // cumulative length along the trail: the line keeps the order in which you drew it
  const len: number[] = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = len[n - 1]! || 1;
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const u = len[i]! / total;
    const x = lerp(pts[i]![0], lerp(-SLAB.halfW, SLAB.halfW, u), pull);
    const z = lerp(pts[i]![1], 0, pull);
    out.push([x, lerp(LEVEL.workers, LEVEL.router, rise) + 1, z]);
  }
  return out;
}

/** The Router's long-lived line: a rail from edge to edge. */
export function routerRail(d: Draw, focus: number, alpha = 1): void {
  const p = d.pal;
  const b = blur(LEVEL.router, focus);
  const dim = 1 / (1 + 0.9 * b);
  d.flat([0, LEVEL.router + 1, 0], [SLAB.halfW, 7], 7, p.bone, { alpha: 0.9 * alpha * dim, feather: b * 4 });
}

/** The world's events: quiet dots drifting along their lanes. */
export function worldLanes(d: Draw, f: number, focus: number, alpha: number): void {
  if (alpha <= 0) return;
  const p = d.pal;
  const b = blur(LEVEL.world, focus);
  const dim = 1 / (1 + 0.9 * b);
  for (let l = 0; l < LANES.length; l++) {
    const z = LANES[l]!;
    d.line([[-SLAB.halfW, LEVEL.world, z], [SLAB.halfW, LEVEL.world, z]], 1.4, p.ash, { alpha: 0.42 * alpha * dim, feather: b * 2 });
    for (let k = 0; k < 9; k++) {
      const speed = 0.9 + 0.8 * rand(SEED, l * 31 + k, 1);
      const x = ((rand(SEED, l * 31 + k, 2) * 2400 + f * speed) % 2400) - 1200;
      d.dot([x, LEVEL.world, z], 7, mix(p.ash, p.bone, 0.6), { alpha: 0.75 * alpha * dim * dim, feather: b * 5 });
    }
  }
}

/** The sessions as they are after the lift: the Workers' cells, idle. Seen edge-on they are tiles. */
export function idleCells(d: Draw, focus: number, alpha: number, skip = -1): void {
  const p = d.pal;
  const b = blur(LEVEL.workers, focus);
  const e = edgeOn(d);
  for (let k = 0; k < CELLS.length; k++) {
    if (k === skip) continue;
    const c = CELLS[k]!;
    const o: Vec3 = [c.x, LEVEL.workers + 1, c.z];
    if (e > 0) d.flat(o, [c.hw, c.hd], 28, mix(p.ash, p.bone, 0.25), { alpha: 0.3 * alpha * e });
    d.flat(o, [c.hw, c.hd], 28, mix(p.ash, p.bone, 0.35), { stroke: 3.2, alpha: (0.62 * alpha) / (1 + 1.3 * b), feather: b * 7 });
  }
}

/** You, at rest on top: one attention. */
export function you(d: Draw, at3: Vec3, alpha = 1, ring = 1): void {
  if (alpha <= 0) return;
  const p = d.pal;
  d.halo(at3, 14, 52, scale(p.you, 1.1), 0.45 * alpha);
  d.dot(at3, 15, scale(p.you, 2.2), { alpha, add: 0.3 });
  if (ring > 0) d.dot(at3, 44, p.you, { stroke: 2.2, alpha: 0.5 * alpha * ring });
}

/** The names of the strata that have no slab: you above, the world's events below. */
export function strataNames(d: Draw, alpha: number): void {
  const e = edgeOn(d) * alpha;
  if (e <= 0) return;
  spineLabel(d, LABELS.you, YOU_HOME, e, d.pal.you);
  spineLabel(d, LABELS.world, [0, LEVEL.world, LANES[LANES.length - 1]! + 110], e, mix(d.pal.bone, d.pal.ash, 0.3));
}

export function lift(d: Draw, f: number): void {
  const p = d.pal;
  const rise = prog(f, DROP, TAUT, easings.inOutCubic);
  const stood = prog(f, TAUT - 20, STOOD + 20, easings.outCubic);
  const focus = lerp(LEVEL.workers, 452, rise);

  // the world appears underneath
  worldLanes(d, f, focus, stood);

  // the floor stays, as the Workers' level
  slab(d, LEVEL.workers, focus, 1, LABELS.workers);
  idleCells(d, focus, 1);

  // the Router's slab forms around the line as it arrives
  slab(d, LEVEL.router, focus, stood, LABELS.router);

  // the trail, pulled taut, thickens into the rail; a pulse runs down it once as it wakes
  const pts = taut(f);
  const rail = prog(f, TAUT, STOOD + 10);
  const colour = mix(mix(p.you, p.bone, 0.25), p.bone, prog(f, DROP, TAUT));
  d.line(pts, lerp(2.6, 4, rise), colour, { alpha: lerp(0.5, 0.9, rise) * (1 - rail) });
  routerRail(d, LEVEL.router, rail);
  const wake = bump(f, TAUT, TAUT + 26, TAUT + 90);
  if (wake > 0) {
    const x = lerp(-900, 900, prog(f, TAUT, TAUT + 80, easings.outCubic));
    d.flat([x - 130, LEVEL.router + 2, 0], [150, 8], 8, scale(p.think, 3), { alpha: wake, add: 0.8 });
    d.pool([x - 130, LEVEL.router + 2, 0], [200, 60], 110, p.think, 0.2 * wake);
  }

  // you rise to the top and rest
  const [yx, yz] = youAt(FREEZE);
  const up = prog(f, DROP + 6, STOOD + 10, easings.inOutCubic);
  const here: Vec3 = [lerp(yx, YOU_HOME[0], up), lerp(LEVEL.workers + 2, YOU_HOME[1], up), lerp(yz, YOU_HOME[2], up)];
  you(d, here, 1, clamp(up * 2 - 1));
  strataNames(d, prog(f, STOOD - 10, STOOD + 30, easings.outCubic));
}
