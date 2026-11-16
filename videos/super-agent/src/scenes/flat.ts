/**
 * Section 1, "Flat": one plane, sessions as cells, and you hopping between them. A session thinks
 * (phosphor light) for a while after you visit, then stalls and waits for you (a coral ring). As
 * sessions multiply, the light goes out faster than you can relight it, and your trail knots.
 *
 * This module also owns the trail, because the lift (section 2) pulls that same line taut into
 * the Router.
 */
import { clamp, easings, rand } from '@aiv/core';
import { at, BEAT } from '../cues.ts';
import type { Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { gate, lineState, prog } from '../kit/time.ts';
import { LEVEL } from './world.ts';

const SEED = 4201;
const FLOOR = LEVEL.workers;

export interface Cell {
  x: number;
  z: number;
  hw: number;
  hd: number;
  /** the frame the session appears */
  born: number;
}

/** The sessions, in the order they appear: irregular stops, never a grid. */
export const CELLS: readonly Cell[] = [
  { x: -330, z: 250, hw: 124, hd: 80, born: at(1, 1) },
  { x: 250, z: 292, hw: 108, hd: 70, born: at(2, 1) },
  { x: -660, z: 30, hw: 116, hd: 76, born: at(3, 1) },
  { x: 650, z: 64, hw: 130, hd: 84, born: at(3, 3) },
  { x: -70, z: -30, hw: 104, hd: 68, born: at(4, 1) },
  { x: 380, z: -190, hw: 112, hd: 72, born: at(5, 1) },
  { x: -400, z: -186, hw: 96, hd: 62, born: at(5, 3) },
];

/** Your visits: [beat (from 0), cell]. They speed up, then stop: you cannot keep up. */
const VISITS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [5, 1], [7, 0], [9, 2], [11, 3], [12.5, 1], [13.5, 4], [15, 0], [16, 2], [17, 5], [18, 3], [19, 6],
  [20, 1], [20.75, 4], [21.5, 0], [22.25, 5], [23, 2], [23.75, 6], [24.5, 3], [25.5, 4], [26.75, 1],
];
/** you stop moving here: the stall */
export const FREEZE = at(7, 4);

const HOP = 16;
const cellPoint = (c: Cell, k: number): [number, number] => [c.x + (rand(SEED, k, 1) - 0.5) * c.hw * 0.7, c.z + (rand(SEED, k, 2) - 0.5) * c.hd * 0.7];

interface Hop {
  from: [number, number];
  to: [number, number];
  ctrl: [number, number];
  /** frames: leaves `t0`, arrives `t1` */
  t0: number;
  t1: number;
}

const HOPS: Hop[] = [];
{
  let here = cellPoint(CELLS[VISITS[0]![1]]!, 0);
  for (let k = 1; k < VISITS.length; k++) {
    const [beat, c] = VISITS[k]!;
    const to = cellPoint(CELLS[c]!, k);
    const t1 = Math.round(beat * BEAT);
    const t0 = t1 - Math.min(HOP, Math.round((beat - VISITS[k - 1]![0]) * BEAT * 0.7));
    // an arc, bulging to one side: hops read as hops, and the trail knots
    const mx = (here[0] + to[0]) / 2;
    const mz = (here[1] + to[1]) / 2;
    const dx = to[0] - here[0];
    const dz = to[1] - here[1];
    const bulge = (rand(SEED, k, 3) - 0.5) * 0.9;
    HOPS.push({ from: here, to, ctrl: [mx - dz * bulge, mz + dx * bulge], t0, t1 });
    here = to;
  }
}
const START = cellPoint(CELLS[VISITS[0]![1]]!, 0);

const bez = (h: Hop, t: number): [number, number] => {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * h.from[0] + b * h.ctrl[0] + c * h.to[0], a * h.from[1] + b * h.ctrl[1] + c * h.to[1]];
};

/** Where you are on the floor at frame `f`. */
export function youAt(f: number): [number, number] {
  let p = START;
  for (const h of HOPS) {
    if (f >= h.t1) p = h.to;
    else if (f > h.t0) return bez(h, easings.inOutCubic((f - h.t0) / (h.t1 - h.t0)));
    else break;
  }
  return p;
}

const SAMPLES = 14;
/** Your trail up to frame `f`, as floor points (x, z): every hop so far, the current one in part. */
export function trail(f: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [START];
  for (const h of HOPS) {
    if (f <= h.t0) break;
    const end = f >= h.t1 ? 1 : easings.inOutCubic((f - h.t0) / (h.t1 - h.t0));
    for (let s = 1; s <= SAMPLES; s++) pts.push(bez(h, (end * s) / SAMPLES));
  }
  return pts;
}

/** How brightly session `c` is thinking at `f`: lit after each visit, then it stalls. */
function thinking(c: number, f: number): number {
  let v = 0;
  for (let k = 0; k < VISITS.length; k++) {
    if (VISITS[k]![1] !== c) continue;
    const t = f - VISITS[k]![0] * BEAT;
    if (t < 0) break;
    // a session works for a while on what you gave it; later visits buy less (you are in a hurry)
    const works = 190 - Math.min(k, 14) * 5;
    v = Math.max(v, clamp(t / 10) * clamp((works - t) / 36));
  }
  return v;
}

/** The floor's cells, your dot and your trail. `show` fades the whole scene. */
export function flat(d: Draw, f: number, show = 1): void {
  const p = d.pal;
  const fz = Math.min(f, FREEZE);
  const stall = prog(f, at(7, 1), FREEZE, easings.outCubic);

  for (let c = 0; c < CELLS.length; c++) {
    const cell = CELLS[c]!;
    const born = prog(f, cell.born, cell.born + 22, easings.outCubic);
    if (born <= 0) continue;
    const think = thinking(c, fz);
    const waiting = clamp(1 - think * 1.6) * clamp((f - cell.born - 40) / 30);
    const o: Vec3 = [cell.x, FLOOR, cell.z];
    const half: [number, number] = [cell.hw * (0.9 + 0.1 * born), cell.hd * (0.9 + 0.1 * born)];
    // the session's context: a closed outline, dim when nothing runs in it
    d.flat(o, half, 28, mix(p.ash, p.bone, 0.3 + 0.45 * think), { stroke: 3.2, alpha: born * show * (0.62 + 0.3 * think) });
    if (think > 0) {
      // a model is running here: light on the floor, in the cell, and a lit stretch going round its edge
      d.pool(o, [cell.hw * 0.5, cell.hd * 0.4], 86, p.think, 0.085 * think * show);
      d.flat(o, [half[0] - 4, half[1] - 4], 26, p.think, { alpha: 0.03 * think * show, feather: 26 });
      d.flat(o, half, 28, scale(p.think, 1.5), { stroke: 3.2, alpha: 0.5 * think * show, add: 0.4 });
      const ang = ((fz * 0.075 + c * 1.9) % (2 * Math.PI)) - Math.PI;
      d.flat(o, half, 28, scale(p.think, 3.4), { stroke: 4.2, alpha: think * show, add: 0.7, arc: [ang, 0.8] });
    }
    // stalled: it calls for you, a ring opening from it every other beat
    if (waiting > 0) {
      const ph = (((fz - cell.born) / (BEAT * 2)) % 1 + 1) % 1;
      const r = 22 + (Math.max(cell.hw, cell.hd) * 0.8 - 22) * easings.outCubic(ph);
      d.flat(o, [r, r], r, scale(p.you, 1.2), { stroke: 2.6, alpha: waiting * show * 0.5 * (1 - ph) ** 1.8 * (1 - 0.3 * stall) });
      d.flat(o, half, 28, p.you, { stroke: 3.2, alpha: waiting * show * 0.22 });
    }
  }

  // your trail: where you have been (a line is only ever history)
  const pts = trail(fz);
  if (pts.length > 1) {
    const world: Vec3[] = pts.map(([x, z]) => [x, FLOOR, z]);
    d.line(world, 2.6, mix(p.you, p.bone, 0.25), { alpha: 0.5 * show });
    // the freshest stretch glows: it is where your attention just was
    const recent = world.slice(-SAMPLES * 2);
    if (recent.length > 1) d.line(recent, 3.6, scale(p.you, 1.8), { alpha: 0.75 * show * (1 - stall), add: 0.5 });
  }

  // the count: one more session to follow. It sits above the trail, on a patch of ground
  for (let k = 0; k < CELLS.length; k++) {
    const cell = CELLS[k]!;
    const count = gate(f, cell.born + 6, at(8, 1), 14, 16) * show;
    if (count <= 0) continue;
    const q = d.cam.project([cell.x - cell.hw, FLOOR, cell.z]);
    const lay = d.type.layout('count', String(k + 1));
    const x = q.x - 22;
    const y = q.y + lay.cap / 2;
    d.box([x - lay.width / 2, y - lay.cap / 2], [lay.width / 2 + 4, lay.cap / 2 + 2], 20, p.ground[1], { alpha: 0.6 * count, feather: 22 });
    d.text('count', String(k + 1), x, y, { align: 'right', rgb: mix(p.bone, p.ash, clamp((k - 3) / 3)), alpha: count });
  }

  // a name for the thing, once: the first cell is a session
  const sess = lineState('sess', f);
  if (sess.on) {
    const c0 = CELLS[0]!;
    const q = d.cam.project([c0.x - c0.hw, FLOOR, c0.z + c0.hd]);
    d.text('label', sess.l.text, q.x, q.y + 62, { enter: sess.enter, exit: sess.exit });
  }

  // you
  const [yx, yz] = youAt(fz);
  const here: Vec3 = [yx, FLOOR + 2, yz];
  const appear = prog(f, 0, 24, easings.outCubic) * show;
  // a hop is fast: the dot stretches into its own motion instead of strobing
  const [px, pz] = youAt(fz - 1);
  const speed = Math.hypot(yx - px, yz - pz);
  d.halo(here, 14, 46, scale(p.you, 1.2), 0.5 * appear);
  d.dot(here, 15, scale(p.you, 2.6), { alpha: appear, add: 0.35, feather: Math.min(9, speed * 0.16) });
}
