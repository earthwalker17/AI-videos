/**
 * Section 4, second answer: follow-ups go straight to the Worker that is subscribed.
 *
 * First the stack is seen edge-on, so height reads. A request rises from its lane to the Router's
 * rail, the Router decides once (the section's only light on the rail) and the whole task drops
 * into a Worker's cell, which starts to work. A thin line then stands from that lane to the cell:
 * the subscription. Every later event on the lane (a person's comment: a coral ring) rises along
 * it and stops at the cell. The Router gets an unlit tick for each: seen, not decided.
 *
 * Then the camera tilts up over the rail, as in section 3: the ticks keep coming, the rail stays
 * dark, and under it the Worker's light turns at the pace it always had. Cheaper, not faster.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { SECTIONS, at, line } from '../cues.ts';
import type { Pose, Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { bump, prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { LANES, rest, rimArc } from './lift.ts';
import type { Anchor, Section } from './section.ts';
import { LEVEL, SLAB, blur, edgeOn, plan, strata } from './world.ts';

const R = LEVEL.router;
const W = LEVEL.workers;

/** The Worker that takes the task: the same cell as in section 3. */
const CELL = CELLS[3]!;
const CORNER = 28;
/** The lane the thread's events come up from: the one under that cell. */
const FOOT: Vec3 = [CELL.x, LEVEL.world, LANES[3]!];
/** Where an event stops in the cell, and the point of the rail directly above it. */
const SEAT: Vec3 = [CELL.x, W + 2, CELL.z];
const RAIL: Vec3 = [CELL.x, R + 2, 0];

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
const FROM = SECTIONS.threads;
const TO = SECTIONS.batch;
/** the request reaches the rail and the Router decides: one model call */
const ROUTED = at(34, 4);
/** the whole task is in the Worker's cell, which starts to work */
const LANDED = at(35, 1);
/** the subscription stands */
const SUBSCRIBED = at(35, 2);
/** follow-ups reach the cell: one every other beat, at one pace throughout (the claim under them is "not faster") */
const FOLLOW_UPS: readonly number[] = [at(35, 3), at(36, 1), at(36, 3), at(37, 1), at(37, 3), at(38, 1), at(38, 3), at(39, 1), at(39, 3)];
/** a follow-up shows on its lane this long before it reaches the cell, and has joined the task this long after */
const LEAD = 46;
const TAKEN = 26;
/** the Router's tick starts this long before the event stops, so that it stands on the beat */
const TICK_IN = 5;

// ── the camera ─────────────────────────────────────────────────────────────────────────────────
/** The whole stack edge-on, as on the title card: you on top, the lanes at the bottom. It closes in a little while it is read. */
const STACK: readonly [Pose, Pose] = [strata(1.2), strata(1.16)];
/** Down on the Router's rail above the cell, the Worker's plane showing through beneath it. It backs off a little. */
const OVER: readonly [Pose, Pose] = [plan(R, CELL.x - 455, -80, 0.78, 68), plan(R, CELL.x - 470, -82, 0.8, 68)];
/** the tilt from one to the other starts as the first block of type lets go, and has settled before the figure lands */
const TILT_FROM = at(37, 1) - 10;
const TILT_TO = at(37, 3);

// ── the marks ──────────────────────────────────────────────────────────────────────────────────
const DOT = 12;
const RING = 21;
/** a tick slides back along the rail into the Router's history, this many units a frame */
const DRIFT = 0.7;
/** half-size of the capsule round a whole task */
const TASK: readonly [number, number] = [74, 30];
/** the Worker's lit stretch turns this many radians a frame, from the first frame to the last */
const PACE = 0.075;

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Screen y of a slab's top near edge and of the bottom of its front face, at world x. */
const faceBand = (d: Draw, y: number, x: number): [number, number] => [d.cam.project([x, y, SLAB.halfD]).y, d.cam.project([x, y - SLAB.thick, SLAB.halfD]).y];

/**
 * How much of a mark at `p` shows when the stack is edge-on. The slabs are smoked glass: a mark
 * behind a front face is half hidden, one under a top is seen through it.
 */
function through(d: Draw, p: Vec3): number {
  const e = edgeOn(d);
  if (e <= 0) return 1;
  const q = d.cam.project(p);
  let v = 1;
  for (const y of [W, R]) {
    const [top, bottom] = faceBand(d, y, p[0]);
    const face = clamp((bottom - q.y) / 8) * clamp((q.y - top) / 8);
    const under = clamp((y - p[1]) / 10) * clamp((top - q.y) / 8);
    v *= 1 - e * (0.42 * face + 0.2 * under);
  }
  return v;
}

/** One event: a bone dot. A person sent it, so it wears a coral ring. */
function event(d: Draw, p: Vec3, alpha: number, speed = 0, ring = 1): void {
  if (alpha <= 0) return;
  const b = blur(p[1], d.cam.pose.target[1]);
  // away from the focus plane it is soft and dim, and it sharpens as it comes up
  const a = (alpha * through(d, p)) / (1 + 0.5 * b * b);
  // a fast one stretches into its own motion
  const soft = b * 4 + Math.min(9, speed * 0.16);
  d.dot(p, DOT, d.pal.bone, { alpha: a, feather: soft });
  d.dot(p, lerp(DOT, RING, ring), d.pal.you, { stroke: 3.2, alpha: a * 0.95 * clamp(ring * 2), feather: soft });
}

/** The request: up from its lane to the rail, then down to the cell inside its capsule. */
function requestAt(f: number): Vec3 {
  const up = prog(f, FROM + 4, ROUTED, easings.inOutSine);
  const down = prog(f, ROUTED + 8, LANDED, easings.inQuad);
  return down > 0 ? lerp3(RAIL, SEAT, down) : lerp3(FOOT, RAIL, up);
}

/** A follow-up that reaches the cell at `t`: it comes along the lane, then up the subscription. */
function followUpAt(f: number, t: number): Vec3 {
  const slide = prog(f, t - LEAD, t - 32, easings.outCubic);
  const up = prog(f, t - 30, t, easings.inOutCubic);
  const p = lerp3(FOOT, SEAT, up);
  return [p[0] - 40 * (1 - slide), p[1], p[2]];
}

/** The Router's rail above the cell: one decision (light), then a tick for every event it only saw. */
function rail(d: Draw, f: number, clear: number): void {
  const p = d.pal;
  const e = edgeOn(d);
  const b = blur(R, d.cam.pose.target[1]);
  const dim = 1 / (1 + 0.9 * b);

  // the model runs on the request: a pulse of light along the rail. It is still lit when the view has settled
  // and the headline is up, and goes out as the first follow-up's unlit tick lands beside it: decided once, then only seen
  const run = prog(f, ROUTED - 2, ROUTED + 10, easings.outCubic) * (1 - prog(f, FOLLOW_UPS[0]! - TICK_IN - 4, FOLLOW_UPS[0]! + 4));
  if (run > 0) {
    const reach = lerp(110, 210, prog(f, ROUTED - 2, ROUTED + 16, easings.outCubic));
    d.pool([RAIL[0], R, 0], [reach * 0.9, 40], 100, p.think, 0.2 * run * dim);
    d.flat([RAIL[0], R + 2, 0], [reach, 8], 8, scale(p.think, 3.2), { alpha: run * dim, add: 0.8, feather: b * 4 });
    if (e > 0) {
      // edge-on the rail has no depth to show: the pulse keeps a body, and its light a height
      const ends: Vec3[] = [[RAIL[0] - reach, R + 2, 0], [RAIL[0] + reach, R + 2, 0]];
      d.line(ends, 34, p.think, { alpha: 0.2 * run * e, add: 1, feather: 18 });
      d.line(ends, 5, scale(p.think, 3.2), { alpha: run * e, add: 0.8, feather: 1.2 });
    }
  }

  // seen, not decided: an unlit tick under the rail, which then slides back with the rail's history
  for (const t of FOLLOW_UPS) {
    if (f <= t - TICK_IN) continue;
    const age = Math.max(0, f - t);
    // it lands on the beat, as the event stops in the cell: a little long at first, then its own length
    const grow = prog(f, t - TICK_IN, t + 4, easings.outCubic) * (1 + 0.3 * bump(f, t - TICK_IN, t + 2, t + 20));
    const q = d.cam.project([RAIL[0] - age * DRIFT, R + 1, 0]);
    const rgb = mix(p.bone, p.ash, 0.4 * clamp(age / 420));
    d.path([[q.x, q.y - 7 * q.s], [q.x, q.y + (4 + 38 * grow) * q.s]], Math.max(6, 9 * q.s), rgb, { alpha: 0.94 * (1 - clear) * clamp(grow * 4), feather: 0.4 + b * 1.2 });
  }
}

/** The subscription: a thin line from the lane up to the cell. A line is only ever history or a subscription. */
function subscription(d: Draw, f: number, clear: number): void {
  const grow = prog(f, LANDED + 6, SUBSCRIBED, easings.inOutCubic);
  if (grow <= 0 || clear >= 1) return;
  const e = edgeOn(d);
  const y0 = d.cam.project(FOOT).y;
  const y1 = d.cam.project(SEAT).y;
  const [top, bottom] = faceBand(d, W, CELL.x);
  // along the line, 0 at the lane and 1 at the cell: where it passes behind the slab's face, and under its top
  const u = (y: number): number => clamp((y0 - y) / (y0 - y1));
  // it reaches down from the cell to the lane
  const from = 1 - grow;
  const focus = d.cam.pose.target[1];
  const parts: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, u(bottom), 1, blur(40, focus)],
    [u(bottom), u(top), 1 - 0.55 * e, blur(140, focus)],
    [u(top), 1, 1 - 0.25 * e, blur(250, focus)],
  ];
  for (const [a, z, k, b] of parts) {
    const lo = Math.max(a, from);
    if (z <= lo) continue;
    d.line([FOOT, SEAT], 3.2, d.pal.bone, { alpha: (0.85 * k * (1 - clear)) / (1 + 0.5 * b), trim: [lo, z], feather: 0.5 + b * 1.6 });
  }
}


/** The Worker: its cell is lit while its model runs, at one steady pace. */
function worker(d: Draw, f: number, works: number): void {
  if (works <= 0) return;
  const p = d.pal;
  const e = edgeOn(d);
  const b = blur(W, d.cam.pose.target[1]);
  const dim = 1 / (1 + 1.2 * b);
  const o: Vec3 = [CELL.x, W + 1, CELL.z];
  const half: [number, number] = [CELL.hw, CELL.hd];
  // the first moment of work is a little brighter: the task has just landed
  const attack = bump(f, LANDED - 2, LANDED + 4, LANDED + 34);
  d.pool(o, [CELL.hw * 0.55, CELL.hd * 0.45], 96, p.think, (0.14 + 0.1 * e + 0.1 * attack) * works * dim);
  d.flat(o, [CELL.hw - 4, CELL.hd - 4], 26, p.think, { alpha: (0.03 + 0.17 * e) * works * dim, feather: 20 - 10 * e, add: 1 });
  d.flat(o, half, CORNER, mix(p.ash, p.bone, 0.85), { stroke: 3.6, alpha: 0.5 * works * dim, feather: b * 6 });
  d.flat(o, half, CORNER, scale(p.think, 1.5), { stroke: 3.6, alpha: (0.5 + 0.4 * attack) * works * dim, add: 0.4, feather: b * 6 });
  // a lit stretch goes round its edge: the same speed from the first frame to the last
  const ang = ((f * PACE) % (2 * Math.PI)) - Math.PI;
  d.flat(o, half, CORNER, scale(p.think, 3.4), { stroke: 4.6, alpha: works * dim, add: 0.7, arc: [ang, 0.8], feather: b * 6 });
  if (e > 0) {
    // edge-on, an outline lying in the plane is thinner than a pixel: the same outline and stretch, with a body
    d.line(rimArc(CELL, -Math.PI, Math.PI, 56), 2.2, scale(p.think, 1.5), { alpha: (0.6 + 0.4 * attack) * works * dim * e, add: 0.4, feather: 0.4 + b });
    d.line(rimArc(CELL, ang - 0.8, ang + 0.8, 16), 3.6, scale(p.think, 3.4), { alpha: works * dim * e, add: 0.7, feather: 0.4 + b });
  }
}

/** The whole task: a bone outline round the request, never split. It faces the viewer on its way down, then lies in the cell. */
function capsule(d: Draw, f: number, held: number): void {
  const p = d.pal;
  const made = prog(f, ROUTED + 2, ROUTED + 14, easings.outCubic);
  if (made <= 0) return;
  const o = requestAt(f);
  const settled = prog(f, LANDED - 3, LANDED + 5);
  if (settled < 1) {
    const lay = prog(f, LANDED - 8, LANDED + 2);
    const q = d.cam.project(o);
    const hw = TASK[0] * (0.6 + 0.4 * made) * q.s;
    const flatH = Math.abs(d.cam.project([o[0], o[1], o[2] + TASK[1]]).y - d.cam.project([o[0], o[1], o[2] - TASK[1]]).y) / 2;
    const hh = lerp(TASK[1] * q.s, flatH, lay);
    const a = made * (1 - settled) * through(d, o);
    d.box([q.x, q.y], [hw, hh], hh, p.ground[1], { alpha: 0.85 * a });
    d.box([q.x, q.y], [hw, hh], hh, p.bone, { stroke: Math.min(4 * q.s, hh), alpha: a });
  }
  if (settled > 0) {
    const b = blur(W, d.cam.pose.target[1]);
    const a = (settled * held) / (1 + 0.5 * b);
    d.flat(SEAT, TASK, TASK[1], p.ground[1], { alpha: 0.85 * a, feather: b * 4 });
    d.flat(SEAT, TASK, TASK[1], p.bone, { stroke: 4, alpha: a, feather: b * 4 });
  }
}

function draw(d: Draw, f: number): void {
  rest(d, f);
  if (f <= FROM || f >= TO) return;
  // under the verdict the scene clears, back to the resting stack: first the rail's ticks, then the Worker
  const clear = prog(f, TO - 76, TO - 22);
  const held = 1 - prog(f, TO - 58, TO - 4);
  const works = prog(f, LANDED - 3, LANDED + 16, easings.outCubic) * held;

  subscription(d, f, clear);
  worker(d, f, works);
  capsule(d, f, held);
  rail(d, f, clear);

  // the request: it rises to the Router, is routed, and then sits in the cell as the task's first event
  const here = requestAt(f);
  event(d, here, prog(f, FROM, FROM + 8) * held, dist3(here, requestAt(f - 1)));

  // follow-ups: each comes along the lane, rises along the subscription and stops at the cell
  for (const t of FOLLOW_UPS) {
    if (f < t - LEAD || f > t + TAKEN) continue;
    const at2 = followUpAt(f, t);
    const taken = prog(f, t + 4, t + TAKEN - 2);
    event(d, at2, prog(f, t - LEAD, t - LEAD + 10) * (1 - taken), dist3(at2, followUpAt(f - 1, t)), 1 - taken);
  }
}

// ── the type ───────────────────────────────────────────────────────────────────────────────────
/** clear of you, who rests at the top left of the edge-on stack */
const TYPE_X = 456;
/** edge-on, a headline stands on the far edge of the Router's slab */
const edge = (d: Draw): number => d.cam.project([0, R, -SLAB.halfD]).y - 28;
/** the middle of the Router's front face, as a baseline shared with the slab's name */
const faceLine = (d: Draw): number => d.cam.project([0, R - SLAB.thick / 2, SLAB.halfD]).y + 19;
/** the second block is set once and stays while the camera tilts: a headline over a figure and what it counts */
const HEAD_Y = 226;
const figure = (d: Draw) => d.type.layout('num', line('cheaper.n').text);
const figureY = (d: Draw): number => HEAD_Y + 40 + figure(d).cap;
const besideFigure = (d: Draw): number => TYPE_X + figure(d).width + 26;
/** the stamp sits flush right under the line it qualifies, as a source does */
const counted = (d: Draw) => d.type.layout('sup', line('cheaper.of').text);

export const threads: Section = {
  from: FROM,
  to: TO,
  keys: [[at(35, 1), STACK[0]], [TILT_FROM, STACK[1]], [TILT_TO, OVER[0]], [at(41, 1), OVER[1]]],
  place: {
    follow: (d): Anchor => ({ x: TYPE_X, y: edge(d), align: 'left' }),
    cheaper: { x: TYPE_X, y: HEAD_Y, align: 'left' },
  },
  linePlace: {
    'follow.seen': (d) => ({ x: TYPE_X, y: faceLine(d), align: 'left' }),
    'cheaper.n': (d) => ({ x: TYPE_X, y: figureY(d), align: 'left' }),
    'cheaper.of': (d) => ({ x: besideFigure(d), y: figureY(d) - 112, align: 'left' }),
    'cheaper.by': (d) => ({ x: besideFigure(d) + counted(d).width, y: figureY(d) - 34, align: 'right' }),
  },
  draw,
};
