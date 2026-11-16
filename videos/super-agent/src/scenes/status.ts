/**
 * Section 6, status: what is proposed (dashed) and what is open (a gap). One view of the stack,
 * edge-on, and each sentence of the two support lines set at the mark it names.
 *
 * Proposed. Running in the cloud: a dashed copy of the Router's line lifts off its slab and runs
 * out of the frame, somewhere else. A check for stuck Workers: a dashed session stands in front of
 * the Workers' level, outside the stack's planes. Neither is in the public prototype.
 *
 * Open. Each question is a piece of the structure taken away. Stepping in mid-task: your reach
 * down to a Worker that is working breaks off under you. Long memory: a stretch of the Router's
 * line, back along its history, is missing. More Routers: a slice through the Router's slab.
 * Security: a window in the Workers' front face, with the world's events showing through.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { SECTIONS, at, line } from '../cues.ts';
import { Camera, type Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { TEXT_IN, TEXT_OUT, lineState, prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { YOU_HOME } from './lift.ts';
import type { Anchor, Section } from './section.ts';
import { STACK_VIEW, stack, type Span, type StackOptions } from './status-stack.ts';
import { LEVEL, SLAB, blur, strata } from './world.ts';

const R = LEVEL.router;
const W = LEVEL.workers;

/** The two support lines, a sentence at a time: each is set at its own mark. */
const sentences = (id: string): string[] => line(id).text.split('. ').map((s, k, all) => (k < all.length - 1 ? `${s}.` : s));
const [CLOUD = '', WATCH = ''] = sentences('proposed.t');
const [MEMORY = '', SECURITY = '', STEP_IN = '', ROUTERS = ''] = sentences('open.t');

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
const FROM = SECTIONS.status;
const TO = SECTIONS.close;
/** the camera is back on the stack, and the dashed line has left the Router's rail as it settled */
const LANDED = at(66, 4);
/** the check is named, and its outline closes a beat later */
const WATCH_NAMED = at(67, 1);
const WATCHED = at(67, 2);
/** each gap opens on its own beat; the rail parts first, as the sentence that stands in its gap arrives */
const GAP = { memory: at(68, 3), step: at(68, 4.5), routers: at(69, 2), security: at(69, 3.5) } as const;
/** the structure is whole again by the section's end; the sentences at the gaps leave just before it closes */
const HEAL = TO - 16;
const SENTENCES_OFF = TO - 24;

// ── the camera ─────────────────────────────────────────────────────────────────────────────────
/** the view closes in a little while the frame is read, and holds to the section's last frame */
const CLOSER = strata(1.17);

// ── the page: where things stand in the resting view ──────────────────────────────────────────
const VIEW = new Camera(STACK_VIEW);
/** the status word stands at the top right, clear of you and of what it is said about */
const HEAD: Anchor = { x: 1770, y: 226, align: 'right' };
/** half the x-height of a support line: a sentence is centred on its mark */
const HALF_X = 16;
/** where the Router's rail runs on the screen */
const railLine = (d: Draw): number => d.cam.project([0, R + 1, 0]).y;
/** the baseline a slab's name stands on, on its front face */
const faceLine = (d: Draw, y: number): number => d.cam.project([0, y - SLAB.thick / 2, SLAB.halfD]).y + 19;

/** Running in the cloud: the sentence, and the dashed line that runs on from it */
const CLOUD_AT = { x: 596, y: 286 } as const;
/** the height above the Router's rail at which a line stands on that sentence's row */
const CLOUD_H = ((): number => {
  let lo: number = R;
  let hi: number = R + 400;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (VIEW.project([0, mid, 0]).y > CLOUD_AT.y - HALF_X) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** the check for stuck Workers: a session's outline, upright in front of the Workers' level, astride its edge */
const LOOP = { x: 585, y: W + 10, z: SLAB.halfD + 30, hw: 120, hh: 68, r: 30 } as const;
const WATCH_X = 596;

/** the Worker that is mid-task: the one under you */
const CELL = CELLS[2]!;
const CORNER = 28;
const SEAT: Vec3 = [CELL.x, W + 2, CELL.z];
/** your reach breaks off beside its sentence, in the clear ground above the Router */
const STEP_AT = { x: 484, y: 270 } as const;
const REACH_GAP: Span = [STEP_AT.y - HALF_X - 40, STEP_AT.y - HALF_X + 40];
/** the sentence that stands in the rail's gap */
const MEMORY_X = 640;
/** the slice through the Router's slab; its sentence stands left of it on the slab's face */
const SLICE: Span = [1640, 1700];
/** the window in the Workers' face; its sentence stands right of it */
const WINDOW: Span = [1000, 1060];

/** A span opened by `k` (0..1) about its middle. */
const opened = (s: Span, k: number): Span => [lerp((s[0] + s[1]) / 2, s[0], k), lerp((s[0] + s[1]) / 2, s[1], k)];

// ── proposed: dashed ───────────────────────────────────────────────────────────────────────────

/** Running in the cloud: the Router's line, dashed, lifted off its slab and running out of the frame. */
function cloud(d: Draw, f: number, show: number): void {
  const lift = prog(f, LANDED - 26, LANDED, easings.outCubic);
  if (lift <= 0 || show <= 0) return;
  const h = lerp(R + 2, CLOUD_H, lift);
  const from = (CLOUD_AT.x + d.type.layout('sup', CLOUD).width + 34 - 960) / VIEW.project([0, CLOUD_H, 0]).s;
  d.line([[from, h, 0], [SLAB.halfW, h, 0]], 3.6, d.pal.bone, { alpha: 0.9 * show * clamp(lift * 5), dash: [30, 0.56, 0] });
}

/** The loop's outline, from the middle of its left side, over the top and round. */
const LOOP_PATH: readonly Vec3[] = ((): Vec3[] => {
  const { x, y, z, hw, hh, r } = LOOP;
  const pts: Vec3[] = [[x - hw, y, z]];
  // corner centres, and the angle each arc starts at (up the left side, then right along the top)
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [x - hw + r, y + hh - r, Math.PI],
    [x + hw - r, y + hh - r, Math.PI / 2],
    [x + hw - r, y - hh + r, 0],
    [x - hw + r, y - hh + r, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= 8; k++) {
      const a = a0 - (k / 8) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  }
  pts.push([x - hw, y, z]);
  return pts;
})();

/** A check for stuck Workers: a dashed session that stands outside the stack's planes, in front of them. */
function watch(d: Draw, f: number, show: number): void {
  const drawn = prog(f, WATCH_NAMED - 20, WATCHED, easings.inOutCubic);
  if (drawn <= 0 || show <= 0) return;
  const p = d.pal;
  // it stands in front: what is behind it steps back
  const c = d.cam.project([LOOP.x, LOOP.y, LOOP.z]);
  const top = d.cam.project([LOOP.x, LOOP.y + LOOP.hh, LOOP.z]);
  d.box([c.x, c.y], [LOOP.hw * c.s, c.y - top.y], LOOP.r * c.s, mix(p.ground[0], p.ground[1], 0.4), { alpha: 0.78 * show * drawn });
  // whole dashes all the way round
  let length = 0;
  let prev = d.cam.project(LOOP_PATH[0]!);
  for (const pt of LOOP_PATH) {
    const q = d.cam.project(pt);
    length += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  const period = length / Math.max(1, Math.round(length / 30));
  d.line(LOOP_PATH, 3.4, p.bone, { alpha: 0.9 * show, trim: [0, drawn], dash: [period, 0.56, period * 0.22] });
}

// ── open: gaps ─────────────────────────────────────────────────────────────────────────────────

/** A point on the working cell's outline, in the direction `ang` from its centre (the angle the kit's arcs use). */
function rim(ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  let lo = 0;
  let hi = Math.hypot(CELL.hw, CELL.hd);
  for (let k = 0; k < 14; k++) {
    const t = (lo + hi) / 2;
    const qx = Math.abs(t * c) - (CELL.hw - CORNER);
    const qz = Math.abs(t * s) - (CELL.hd - CORNER);
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - CORNER;
    if (sd < 0) lo = t;
    else hi = t;
  }
  return [CELL.x + lo * c, W + 1, CELL.z + lo * s];
}
const rimArc = (from: number, to: number, n: number): Vec3[] => Array.from({ length: n + 1 }, (_, k) => rim(lerp(from, to, k / n)));

/** A Worker mid-task: its cell is lit while its model runs (the look of threads.ts, edge-on). */
function working(d: Draw, f: number, works: number): void {
  if (works <= 0) return;
  const p = d.pal;
  const b = blur(W, d.cam.pose.target[1]);
  const dim = 1 / (1 + 1.2 * b);
  const o: Vec3 = [CELL.x, W + 1, CELL.z];
  d.pool(o, [CELL.hw * 0.55, CELL.hd * 0.45], 96, p.think, 0.24 * works * dim);
  d.flat(o, [CELL.hw - 4, CELL.hd - 4], 26, p.think, { alpha: 0.2 * works * dim, feather: 10, add: 1 });
  d.flat(o, [CELL.hw, CELL.hd], CORNER, mix(p.ash, p.bone, 0.85), { stroke: 3.6, alpha: 0.5 * works * dim, feather: b * 6 });
  const ang = ((f * 0.075) % (2 * Math.PI)) - Math.PI;
  d.line(rimArc(-Math.PI, Math.PI, 56), 2.2, scale(p.think, 1.5), { alpha: 0.6 * works * dim, add: 0.4, feather: 0.4 + b });
  d.line(rimArc(ang - 0.8, ang + 0.8, 16), 3.6, scale(p.think, 3.4), { alpha: works * dim, add: 0.7, feather: 0.4 + b });
}

/** Stepping in mid-task: your reach down to the working cell, with a stretch of it missing under you. */
function reach(d: Draw, f: number, heal: number): void {
  const head = prog(f, GAP.step - 18, GAP.step, easings.inOutCubic) * (1 - heal);
  if (head <= 0.01) return;
  const a = d.cam.project(YOU_HOME);
  const b = d.cam.project(SEAT);
  const along = (y: number): number => clamp((y - a.y) / (b.y - a.y));
  // it leaves you under your ring
  const start = along(a.y + 44 * a.s + 12);
  const to = lerp(start, 1, head);
  const rgb = mix(d.pal.you, d.pal.bone, 0.12);
  for (const [from, till] of [[start, Math.min(to, along(REACH_GAP[0]))], [along(REACH_GAP[1]), to]] as const) {
    if (till > from) d.line([YOU_HOME, SEAT], 3.4, rgb, { alpha: 0.92 * clamp(head * 12), trim: [from, till] });
  }
}

function draw(d: Draw, f: number): void {
  if (f <= FROM || f >= TO) {
    stack(d, f);
    return;
  }
  const heal = prog(f, HEAL, TO - 1);
  const open = (t: number, lead = 14): number => prog(f, t - lead, t, easings.outCubic) * (1 - heal);

  // the structure, with what is open taken out of it
  const cuts: StackOptions = {};
  const memoryGap: Span = [MEMORY_X - 36, MEMORY_X + d.type.layout('sup', MEMORY).width + 40];
  const memory = open(GAP.memory, 18);
  if (memory > 0.02) cuts.railGap = opened(memoryGap, memory);
  const slice = open(GAP.routers);
  if (slice > 0.02) cuts.routerCut = opened(SLICE, slice);
  const breach = open(GAP.security);
  if (breach > 0.02) cuts.workersCut = opened(WINDOW, breach);
  stack(d, f, cuts);

  // a Worker is mid-task
  working(d, f, prog(f, GAP.step - 60, GAP.step - 30, easings.outCubic) * (1 - prog(f, TO - 28, TO - 3)));

  // proposed: the two dashed marks, each with its sentence
  const said = lineState('proposed.t', f);
  const proposed = 1 - prog(f, said.l.out, said.l.out + 16);
  cloud(d, f, proposed);
  watch(d, f, proposed);
  if (said.on) {
    d.text('sup', CLOUD, CLOUD_AT.x, CLOUD_AT.y, { enter: said.enter, exit: said.exit });
    // the second sentence comes with its mark, once the stack is back under it
    d.text('sup', WATCH, WATCH_X, faceLine(d, W), { enter: clamp((f - (WATCH_NAMED - TEXT_IN)) / TEXT_IN), exit: said.exit });
  }

  // open: your reach, and a sentence at each gap (it waits, dim, until its gap opens)
  reach(d, f, heal);
  const o = lineState('open.t', f);
  if (o.on) {
    const exit = Math.max(o.exit, clamp((f - SENTENCES_OFF) / TEXT_OUT));
    const say = (text: string, x: number, y: number, since: number, align: 'left' | 'right' = 'left'): void => {
      d.text('sup', text, x, y, { align, enter: o.enter, exit, alpha: lerp(0.4, 1, prog(f, since - 12, since)) });
    };
    say(MEMORY, MEMORY_X, railLine(d) + HALF_X, GAP.memory);
    say(STEP_IN, STEP_AT.x, STEP_AT.y, GAP.step);
    say(ROUTERS, SLICE[0] - 30, faceLine(d, R), GAP.routers, 'right');
    say(SECURITY, WINDOW[1] + 30, faceLine(d, W), GAP.security);
  }
}

export const status: Section = {
  from: FROM,
  to: TO,
  keys: [[LANDED, STACK_VIEW], [TO - 1, CLOSER]],
  place: { proposed: HEAD, open: HEAD },
  own: ['proposed.t', 'open.t'],
  draw,
};
