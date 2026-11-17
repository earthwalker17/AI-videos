/**
 * Section 3, "Two levels". On the Router's plane: one long-lived rail that every channel runs
 * into; a model runs briefly at each arrival (a pulse of light) and the whole task goes down,
 * unsplit. On the Workers' plane: a cell closes round the task and works on it alone.
 *
 * Then the stack is seen edge-on again, you on top, and one answer travels. A report leaves the
 * working cell for the Router's rail, the Router's model runs on it, and one dot goes on up to
 * you. Nothing goes from the Worker straight to you: the way it takes is the claim.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { LABELS, SECTIONS, at } from '../cues.ts';
import { Camera, type Pose, type Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { bump, lineState, prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { YOU_HOME, idleCells, rimArc, routerRail, worldLanes } from './lift.ts';
import type { Anchor } from './section.ts';
import { LEVEL, NAME, SLAB, blur, edgeOn, plan, slab, strata } from './world.ts';

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

/**
 * The answer the film follows up. The camera leaves the Worker's plane as its words let go
 * (`leave`) and has all but stopped on the edge-on stack as the sentence becomes readable; it is
 * at rest by `stood`. The Router's slab forms again under the sentence (`forms` to `formed`). A
 * report leaves the cell (`sent`) and is at the rail on `routed`, where the Router's model runs;
 * one dot leaves the rail (`out`) and is with you on `heard`. From `done` the cell goes back to
 * rest: by the next section the stack is as it began.
 */
export const ANSWER = {
  leave: at(22, 4) - 4,
  stood: at(23, 1) + 14,
  forms: at(23, 1) + 4,
  formed: at(23, 1) + 22,
  sent: at(23, 2),
  routed: at(23, 3),
  out: at(23, 3.5),
  heard: at(24, 1),
  done: at(24, 3),
} as const;

/** The camera's looks in this section: the stack edge-on, down on the rail, down on the cell that got the task, and the stack again. */
export const STACK_VIEW: Pose = strata(1.16);
export const ROUTER_VIEW: Pose = plan(R, CELL.x - 150, -70, 0.74, 62);
export const WORKER_VIEW: Pose = plan(W, CELL.x - 300, CELL.z - 100, 0.6, 70);

/**
 * Where the answer's sentence stands: on the Router's front face, under its name, clear of the
 * report's way up. It is set once from the settled pose, so it never rides the camera.
 */
export const ANSWERS_AT: Anchor = { x: NAME.x, y: Math.round(new Camera(STACK_VIEW).project([0, R - SLAB.thick / 2, SLAB.halfD]).y + NAME.drop), align: 'left' };

const TRAVEL = 40;
/** the working cell and its task go back to rest from here; by the next section the stack is at rest */
const DONE = ANSWER.done;
/** sessions that would lie under the headline in the Worker's view */
const UNDER_WORDS: readonly number[] = [4, 5];
const CORNER = 28;
/** the Worker's lit stretch turns this many radians a frame */
const PACE = 0.075;

/**
 * The report starts in the cell beside its task (on the side away from the sentence, so it never
 * reads as a mark after the words) and rises to the point of the rail above it; the answer goes
 * from there to you.
 */
const SENT_FROM: Vec3 = [CELL.x + 102, W + 2, CELL.z];
const RAIL: Vec3 = [SENT_FROM[0], R + 2, 0];
const DOT = 12;

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** 0..1: the answer has reached you, and you take it in, once. The film raises your ring and your light by it. */
export const heard = (f: number): number => bump(f, ANSWER.heard - 5, ANSWER.heard + 5, ANSWER.heard + 46);

/** The rail, its channels, and what has come down them. */
function routerPlane(d: Draw, f: number, focus: number): void {
  const p = d.pal;
  // looking down on the Workers' plane, the Router is overhead and out of the picture; edge-on it is always there
  let seen = 1 - clamp((R - focus) / 120) * (1 - edgeOn(d));
  // coming back up for the answer, its slab would sweep its lit edge and its name through the sentence that
  // stands on its face. It stays out until it is in place, then forms round the words, before the report leaves
  if (f > ANSWER.leave) seen *= prog(f, ANSWER.forms, ANSWER.formed);
  if (seen <= 0) return;
  const b = blur(R, focus);
  const dim = seen / (1 + 0.9 * b);
  slab(d, R, focus, seen, LABELS.router);

  // the channels: each one runs into the rail. They belong to this view: they have gone when the camera comes back up
  const open = prog(f, at(13, 3), at(14, 1), easings.outCubic);
  const shown = 1 - prog(f, at(20, 1), at(21, 1));
  for (const ch of CHANNELS) {
    if (shown > 0) d.line([[ch.x, R + 1, 14], [ch.x, R + 1, 14 + (SLAB.halfD - 14) * open]], 2.2, mix(p.ash, p.bone, 0.45), { alpha: 0.7 * dim * shown, feather: b * 3 });
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
  const alpha = (made * (1 - prog(f, DONE, SECTIONS.spine - 12))) / (1 + 0.5 * b);
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
  slab(d, W, focus, 1, LABELS.workers);
  // the section begins and ends with the stack at rest: the Worker's cell is one of the idle ones until the task
  // is on its way down to it, and again once the answer has been read
  const back = prog(f, DONE, SECTIONS.spine - 12);
  const idle = Math.max(back, 1 - prog(f, REQUEST.drop, REQUEST.landed - 6));
  // close on the Worker, the two sessions that would sit under the words step out; they are back for the stack
  const close = prog(f, at(20, 1), at(20, 4)) * (1 - prog(f, ANSWER.leave + 16, ANSWER.stood - 10));
  idleCells(d, focus, 1, (k) => (k === HOME ? idle : UNDER_WORDS.includes(k) ? 1 - close : 1));
  const o: Vec3 = [CELL.x, W + 1, CELL.z];
  const half: [number, number] = [CELL.hw, CELL.hd];
  const e = edgeOn(d);
  const works = prog(f, REQUEST.landed - 6, REQUEST.landed + 30, easings.outCubic) * (1 - back);
  d.flat(o, half, CORNER, mix(p.ash, p.bone, 0.35 + 0.5 * works), { stroke: 3.6, alpha: (0.62 + 0.3 * works) * dim * (1 - idle), feather: b * 6 });
  if (works > 0) {
    // the Worker's model runs: light under it, and a lit stretch going round its edge
    d.pool(o, [CELL.hw * 0.55, CELL.hd * 0.45], 96, p.think, (0.14 + 0.1 * e) * works * dim);
    d.flat(o, half, CORNER, scale(p.think, 1.5), { stroke: 3.6, alpha: 0.5 * works * dim, add: 0.4, feather: b * 6 });
    const ang = ((f * PACE) % (2 * Math.PI)) - Math.PI;
    d.flat(o, half, CORNER, scale(p.think, 3.4), { stroke: 4.6, alpha: works * dim, add: 0.7, arc: [ang, 0.8], feather: b * 6 });
    if (e > 0) {
      // edge-on, an outline lying in the plane is thinner than a pixel: the cell is a lit tile, and the
      // same outline and stretch get a body (as in threads.ts)
      d.flat(o, [CELL.hw - 4, CELL.hd - 4], CORNER - 2, p.think, { alpha: 0.17 * e * works * dim, feather: 20 - 10 * e, add: 1 });
      d.line(rimArc(CELL, -Math.PI, Math.PI, 56), 2.2, scale(p.think, 1.5), { alpha: 0.6 * works * dim * e, add: 0.4, feather: 0.4 + b });
      d.line(rimArc(CELL, ang - 0.8, ang + 0.8, 16), 3.6, scale(p.think, 3.4), { alpha: works * dim * e, add: 0.7, feather: 0.4 + b });
    }
  }
}


/**
 * How much of a mark at `p` shows when the stack is edge-on. The Router's slab is smoked glass in
 * front of the report's way up: behind its front face a mark is half hidden, under its top it is
 * seen through it (as in threads.ts).
 */
function through(d: Draw, p: Vec3): number {
  const e = edgeOn(d);
  if (e <= 0) return 1;
  const q = d.cam.project(p);
  const top = d.cam.project([p[0], R, SLAB.halfD]).y;
  const bottom = d.cam.project([p[0], R - SLAB.thick, SLAB.halfD]).y;
  const face = clamp((bottom - q.y) / 8) * clamp((q.y - top) / 8);
  const under = clamp((R - p[1]) / 10) * clamp((top - q.y) / 8);
  return 1 - e * (0.42 * face + 0.2 * under);
}

/** Where the answer is: up from the cell to the rail, a moment there while the Router's model runs, then up to you. */
function answerAt(f: number): Vec3 {
  if (f < ANSWER.out) return lerp3(SENT_FROM, RAIL, prog(f, ANSWER.sent, ANSWER.routed, easings.inOutSine));
  return lerp3(RAIL, YOU_HOME, prog(f, ANSWER.out, ANSWER.heard, easings.inOutSine));
}

/** The answer: one bone dot, an event with no ring (no person sent it), and the Router's light where it stops on the rail. */
function answer(d: Draw, f: number, focus: number): void {
  const e = edgeOn(d);
  if (e <= 0 || f <= ANSWER.sent - 12) return;
  const p = d.pal;
  // the Router's model runs on the report: a short pulse of light along the rail
  const run = bump(f, ANSWER.routed - 2, ANSWER.routed + 10, ANSWER.routed + 56);
  if (run > 0) {
    const b = blur(R, focus);
    const dim = 1 / (1 + 0.9 * b);
    const reach = lerp(110, 210, prog(f, ANSWER.routed - 2, ANSWER.routed + 16, easings.outCubic));
    d.pool([RAIL[0], R, 0], [reach * 0.9, 40], 100, p.think, 0.2 * run * dim * e);
    // edge-on the rail has no depth to show: the pulse keeps a body, and its light a height
    const ends: Vec3[] = [[RAIL[0] - reach, R + 2, 0], [RAIL[0] + reach, R + 2, 0]];
    d.line(ends, 34, p.think, { alpha: 0.2 * run * e, add: 1, feather: 18 });
    d.line(ends, 5, scale(p.think, 3.2), { alpha: run * e, add: 0.8, feather: 1.2 });
  }
  const here = answerAt(f);
  const before = answerAt(f - 1);
  // a fast one stretches into its own motion
  const speed = Math.hypot(here[0] - before[0], here[1] - before[1], here[2] - before[2]);
  // it forms in the cell, and you take it in
  const alpha = prog(f, ANSWER.sent - 10, ANSWER.sent - 2) * (1 - prog(f, ANSWER.heard - 4, ANSWER.heard + 2)) * through(d, here) * e;
  if (alpha > 0) d.dot(here, DOT, p.bone, { alpha, feather: Math.min(9, speed * 0.16) });
}

export function levels(d: Draw, f: number): void {
  const focus = d.cam.pose.target[1];
  worldLanes(d, f, focus, 1);
  workerPlane(d, f, focus);
  routerPlane(d, f, focus);
  task(d, f, focus);
  answer(d, f, focus);
}
