/**
 * Section 3, "Two levels". On the Router's plane: one long-lived rail that every channel runs
 * into; a model runs briefly at each arrival (a pulse of light) and the whole task goes down,
 * unsplit. On the Workers' plane: a cell closes round the task and works on it alone.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { SECTIONS, at } from '../cues.ts';
import type { Pose, Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { bump, lineState, prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { idleCells, routerRail, worldLanes } from './lift.ts';
import { LEVEL, SLAB, blur, plan, slab } from './world.ts';

const R = LEVEL.router;
const W = LEVEL.workers;

/** The session that takes the request: the roomiest one. */
const HOME = 3;
const CELL = CELLS[HOME]!;

/** Channels: where people and tools reach the Router. Each runs into the rail from the near side. */
const CHANNELS: ReadonlyArray<{ x: number; line: string }> = [
  { x: CELL.x - 330, line: 'ch.chat' },
  { x: CELL.x, line: 'ch.review' },
  { x: CELL.x + 330, line: 'ch.mail' },
];

interface Arrival {
  /** reaches the rail at this frame, down this channel */
  t: number;
  ch: number;
  /** a person sent it */
  person: boolean;
}

const ARRIVALS: readonly Arrival[] = [
  { t: at(14, 1), ch: 0, person: false },
  { t: at(14, 2.5), ch: 2, person: false },
  { t: at(14, 4), ch: 1, person: true },
  { t: at(15, 2), ch: 0, person: true },
  { t: at(15, 3.5), ch: 2, person: false },
];

/** The request the film follows down: it arrives, is routed, and goes to a Worker whole. */
export const REQUEST = { t: at(16, 1), ch: 1, drop: at(16, 3), landed: at(17, 3) } as const;

/** The camera's two looks in this section: down on the rail, then down on the cell that got the task. */
export const ROUTER_VIEW: Pose = plan(R, CELL.x - 150, -70, 0.74, 62);
export const WORKER_VIEW: Pose = plan(W, CELL.x - 300, CELL.z - 100, 0.6, 70);

const TRAVEL = 40;
/** the camera leaves the Worker here; by the next section the stack is at rest */
const DONE = at(24, 3);
/** sessions that would lie under the headline in the Worker's view */
const UNDER_WORDS: readonly number[] = [4, 5];

/** The rail, its channels, and what has come down them. */
function routerPlane(d: Draw, f: number, focus: number): void {
  const p = d.pal;
  // looking down on the Workers' plane, the Router is overhead and out of the picture
  const seen = clamp(1 - (R - focus) / 120);
  if (seen <= 0) return;
  const b = blur(R, focus);
  const dim = seen / (1 + 0.9 * b);
  slab(d, R, focus, seen);

  // the channels: each one runs into the rail
  const open = prog(f, at(13, 3), at(14, 1), easings.outCubic);
  for (const ch of CHANNELS) {
    d.line([[ch.x, R + 1, 14], [ch.x, R + 1, 14 + (SLAB.halfD - 14) * open]], 2.2, mix(p.ash, p.bone, 0.45), { alpha: 0.7 * dim, feather: b * 3 });
    const s = lineState(ch.line, f);
    if (s.on) {
      // the name stands to the left of its channel, clear of the frame's edge and of the next one
      const q = d.cam.project([ch.x, R, 170]);
      d.text('label', s.l.text, q.x - 24, q.y, { align: 'right', enter: s.enter, exit: s.exit });
    }
  }
  routerRail(d, focus, seen);

  const all: Arrival[] = [...ARRIVALS, { t: REQUEST.t, ch: REQUEST.ch, person: true }];
  for (const a of all) {
    const dt = f - a.t;
    if (dt < -TRAVEL) continue;
    const isRequest = a.t === REQUEST.t;
    const x0 = CHANNELS[a.ch]!.x;
    const land = prog(f, a.t - TRAVEL, a.t, easings.outCubic);
    // handled, an ordinary arrival slides back along the rail into its history and fades
    const age = Math.max(0, dt);
    const gone = isRequest ? prog(f, REQUEST.t + 12, REQUEST.t + 30) : prog(age, 170, 330);
    const o: Vec3 = [x0 - (isRequest ? 0 : age * 0.7), R + 2, lerp(SLAB.halfD * 0.8, 0, land)];
    const alpha = clamp((dt + TRAVEL) / 10) * (1 - gone) * dim;
    if (alpha > 0) {
      d.dot(o, 12, dt >= 0 ? mix(p.bone, p.ash, clamp(age / 220)) : p.bone, { alpha, feather: b * 4 });
      if (a.person) d.dot(o, 22, p.you, { stroke: 3, alpha: alpha * 0.95, feather: b * 4 });
    }
    // the model runs on it: a short pulse of light along the rail
    const run = bump(f, a.t - 2, a.t + 10, a.t + (isRequest ? 56 : 42));
    if (run > 0) {
      d.pool([x0, R, 0], [190, 40], 100, p.think, 0.2 * run * dim);
      d.flat([x0, R + 2, 0], [210, 8], 8, scale(p.think, 3.2), { alpha: run * dim, add: 0.8, feather: b * 4 });
    }
  }
}

/** The whole task on its way down: a bone outline round the request, never split. */
function task(d: Draw, f: number, focus: number): void {
  const p = d.pal;
  const made = prog(f, REQUEST.t + 12, REQUEST.t + 34, easings.outCubic);
  if (made <= 0) return;
  const fall = prog(f, REQUEST.drop, REQUEST.landed, easings.inOutCubic);
  const y = lerp(R + 2, W + 2, fall);
  const o: Vec3 = [CHANNELS[REQUEST.ch]!.x, y, lerp(0, CELL.z, fall)];
  const b = blur(y, focus);
  const alpha = (made * (1 - prog(f, DONE, SECTIONS.spine))) / (1 + 0.5 * b);
  // a capsule: one whole task
  d.flat(o, [74 * (0.7 + 0.3 * made), 30], 30, p.ground[1], { alpha: 0.85 * alpha, feather: b * 4 });
  d.flat(o, [74 * (0.7 + 0.3 * made), 30], 30, p.bone, { stroke: 4, alpha, feather: b * 4 });
  d.dot(o, 11, p.bone, { alpha, feather: b * 4 });
  d.dot(o, 20, p.you, { stroke: 3, alpha: alpha * 0.95, feather: b * 4 });
}

/** The Workers' cells: the one with the task thinks, alone; the others are idle. */
function workerPlane(d: Draw, f: number, focus: number): void {
  const p = d.pal;
  const b = blur(W, focus);
  const dim = 1 / (1 + 1.2 * b);
  slab(d, W, focus);
  // close on the Worker, the two sessions that would sit under the words step out; they are back for the stack
  const close = prog(f, at(20, 1), at(20, 4)) * (1 - prog(f, DONE, SECTIONS.spine));
  idleCells(d, focus, 1, (k) => (k === HOME ? 0 : UNDER_WORDS.includes(k) ? 1 - close : 1));
  const o: Vec3 = [CELL.x, W + 1, CELL.z];
  // the section ends with the stack at rest: the Worker's light goes out as the camera leaves
  const works = prog(f, REQUEST.landed - 6, REQUEST.landed + 30, easings.outCubic) * (1 - prog(f, DONE, SECTIONS.spine));
  d.flat(o, [CELL.hw, CELL.hd], 28, mix(p.ash, p.bone, 0.35 + 0.5 * works), { stroke: 3.6, alpha: (0.62 + 0.3 * works) * dim, feather: b * 6 });
  if (works > 0) {
    // the Worker's model runs: light under it, and a lit stretch going round its edge
    d.pool(o, [CELL.hw * 0.55, CELL.hd * 0.45], 96, p.think, 0.14 * works * dim);
    d.flat(o, [CELL.hw, CELL.hd], 28, scale(p.think, 1.5), { stroke: 3.6, alpha: 0.5 * works * dim, add: 0.4, feather: b * 6 });
    const ang = ((f * 0.075) % (2 * Math.PI)) - Math.PI;
    d.flat(o, [CELL.hw, CELL.hd], 28, scale(p.think, 3.4), { stroke: 4.6, alpha: works * dim, add: 0.7, arc: [ang, 0.8], feather: b * 6 });
  }
}

export function levels(d: Draw, f: number): void {
  const focus = d.cam.pose.target[1];
  worldLanes(d, f, focus, 1);
  workerPlane(d, f, focus);
  routerPlane(d, f, focus);
  task(d, f, focus);
}
