/**
 * Section 7, the close. The film opened flat, on you hopping between sessions under the question
 * "who routes the agents?". Here the camera comes up to you, on top of the stack, and the question
 * returns over the same look-down, two levels higher: you are alone up here, and still.
 *
 * A result comes up from the stack: one finished whole task, from the first session's cell, by way
 * of the Router's rail (its model runs once, the section's only light, as "NOT YOU." lands) and up
 * to your level. It waits beside you, not yet at rest. On the sign-off you reach over and touch it
 * once: your ring closes round it, it turns matte and lies still. That is all you do.
 *
 * Then the camera backs off, still above you: the signed result at rest beside you, and over the
 * clear ground the four counted answers stand once more, as one list: the recap. (Over the stack
 * its edges would run through the words.) Last, the camera drops back to the stack's own view,
 * raised: you over the Router, and the end card in the clear ground above you. The whole stack cannot stand under
 * four lines of type without its edges running through them, so the card gets the sky and the
 * picture keeps the two strata the title asks about. Under the card the stack keeps working: the
 * Router's model runs now and then, and nothing asks for you.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { FILM_FRAMES, SECTIONS, at, line } from '../cues.ts';
import { Camera, type Pose, type Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { STYLES, mix, scale } from '../kit/look.ts';
import { TEXT_IN, TEXT_OUT, bump, lineState, prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { YOU_HOME, rest } from './lift.ts';
import { DIM, type Anchor, type Section } from './section.ts';
import { stack } from './status-stack.ts';
import { LEVEL, blur, edgeOn } from './world.ts';

const R = LEVEL.router;
const W = LEVEL.workers;
const TOP = LEVEL.you;

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
const FROM = SECTIONS.close;
const TO = FILM_FRAMES;
/** the camera is over you as the question becomes readable, and has closed in on you a bar later */
const LANDED = line('q2').frame;
const CLOSE_BY = at(72, 1);
/** the result leaves its Worker; it is at the Router's rail, whose model runs, as "NOT YOU." lands */
const LEFT = at(71, 2);
const ROUTED = line('notyou').frame;
/** it leaves the rail, and is at your level */
const HANDED = ROUTED + 22;
const ARRIVED = at(73, 3);
/** you lean towards it as the words land, and touch it on the sign-off */
const DECIDE = at(74, 1);
const SIGN = at(74, 3);
const STRIKE = SIGN - 20;
const HOME_BY = at(75, 1) - 6;
/** the words let go and the camera backs off above you: the recap stands over the clear ground */
const LEAVE = line('decide').out;
const RECAP = line('recap.1').frame;
const RECAP_OUT = at(79, 3);
/** the view rises for the end card: it is readable from here, and held from here */
const CARD = line('end.t').frame;
const HELD = at(81, 3);
/** under the card the Router's model still runs now and then: [film frame, x along the rail] */
const AFTER: ReadonlyArray<readonly [number, number]> = [[at(81, 3), 330], [at(82, 4), -180], [at(83, 3), 640]];

// ── the camera ─────────────────────────────────────────────────────────────────────────────────
/** the first session's cell: the result comes up from it, and stops beside you */
const CELL = CELLS[0]!;
const SEAT: Vec3 = [CELL.x, W + 2, CELL.z];
const RAIL: Vec3 = [CELL.x, R + 2, 0];
const DESK: Vec3 = [CELL.x, TOP, 0];
/** the row you and the result share on the screen: under the words, over the Router's rail */
const ROW = 762;
/** a look-down on your level that keeps the top of the frame for the words */
const over = (dist: number): Pose => ({ target: [(YOU_HOME[0] + DESK[0]) / 2 + 20, TOP, 0], tilt: 74, yaw: 0, dist, centre: [960, ROW] });
const HIGH = over(0.6);
const NEAR = over(0.46);
const NEARER = over(0.42);
/** the recap's view: you and the signed result at the frame's foot, the ground above them clear for the list */
const RECAP_ROW = 912;
const RECAP_VIEW: Pose = { ...over(0.52), centre: [960, RECAP_ROW] };

/**
 * The stack's own view with the Router in focus, set so that you stand at screen height `youY`:
 * the sky above you is the card's. It is a little flatter than the resting view, so that the
 * Router's name stays clear of the frame's foot while the frame ends on the Workers' cells, short of
 * their level's near edge.
 */
function under(dist: number, youY: number): Pose {
  const pose: Pose = { target: [0, R, 0], tilt: 8, yaw: 0, dist };
  return { ...pose, centre: [960, 540 + youY - new Camera(pose).project(YOU_HOME).y] };
}
/** it is still easing back as the card's lines land, and at rest for the hold */
const END: readonly [Pose, Pose] = [under(1.52, 600), under(1.55, 598)];

// ── the marks ──────────────────────────────────────────────────────────────────────────────────
/** half-size of the capsule round a whole task, and the request inside it (levels.ts) */
const TASK: readonly [number, number] = [74, 30];
const DOT = 11;
const RING = 20;
/** you (lift.ts) */
const ME = 15;
/** your ring round the result stands this far off its outline */
const SIGNED = 12;
/** where your dot stops against the result: on its outline */
const TOUCH = DESK[0] - TASK[0] - ME + 5;
/** how far the scene steps back behind an h1 */
const H1_DIM = DIM.h1;
const HEADS: ReadonlyArray<readonly [string, number]> = [['q2', H1_DIM], ['notyou', H1_DIM], ['decide', H1_DIM], ['recap.1', DIM.verdict]];

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** How much of the scene the typesetter lets through behind this section's headlines. */
function passed(f: number): number {
  let t = 1;
  for (const [id, dim] of HEADS) {
    const s = lineState(id, f);
    t *= 1 - dim * s.enter * (1 - s.exit);
  }
  return t;
}

/** Where the result is: up from its cell to the rail, a moment there, then up to your level. */
function resultAt(f: number): Vec3 {
  if (f < ROUTED) return lerp3(SEAT, RAIL, prog(f, LEFT, ROUTED, easings.inOutSine));
  const o = lerp3(RAIL, DESK, prog(f, HANDED, ARRIVED, easings.inOutCubic));
  // beside you it is not at rest yet: it drifts a little, until you touch it
  const waits = prog(f, ARRIVED - 20, ARRIVED + 20) * (1 - prog(f, SIGN - 10, SIGN, easings.outCubic));
  const sway = Math.sin(((f - ARRIVED) / 75) * 2 * Math.PI);
  // your touch moves it a hair, and it comes back to stay
  const pushed = 7 * bump(f, SIGN - 1, SIGN + 4, SIGN + 30);
  return [o[0] + pushed, o[1], o[2] + 5 * sway * waits];
}

/** Where you are: at home, leaning towards the result, on it, and home again. */
function youAt(f: number): Vec3 {
  const lean = 0.1 * prog(f, DECIDE, STRIKE, easings.inOutSine);
  const strike = (1 - lean) * prog(f, STRIKE, SIGN, easings.inCubic);
  const back = prog(f, SIGN + 4, HOME_BY, easings.inOutCubic);
  return [lerp(YOU_HOME[0], TOUCH, (lean + strike) * (1 - back)), YOU_HOME[1], YOU_HOME[2]];
}

/** The Router's model runs: one short pulse of light along the rail, at `x`, from frame `t`. */
function pulse(d: Draw, f: number, t: number, x: number, gain: number): void {
  const run = bump(f, t - 2, t + 10, t + 56);
  if (run <= 0) return;
  const p = d.pal;
  const b = blur(R, d.cam.pose.target[1]);
  const dim = 1 / (1 + 0.9 * b);
  const reach = lerp(110, 210, prog(f, t - 2, t + 16, easings.outCubic));
  d.pool([x, R, 0], [reach * 0.9, 40], 100, scale(p.think, gain), 0.2 * run * dim);
  d.flat([x, R + 2, 0], [reach, 8], 8, scale(p.think, 3.2 * gain), { alpha: run * dim, add: 0.8, feather: b * 4 });
  // edge-on the lit stretch has no depth to show: there it is a line of light
  const e = edgeOn(d);
  if (e > 0) d.line([[x - reach, R + 2, 0], [x + reach, R + 2, 0]], 4, scale(p.think, 3.2 * gain), { alpha: run * dim * e });
}

/** It runs on the result as it passes, as "NOT YOU." lands. */
function routed(d: Draw, f: number, gain: number): void {
  pulse(d, f, ROUTED, RAIL[0], gain);
}

/** The result: one whole task in its capsule, the request a person sent still inside it. */
function result(d: Draw, f: number, gain: number): void {
  // signed, it stays beside you to the end
  const show = prog(f, LEFT, LEFT + 30);
  if (show <= 0) return;
  const p = d.pal;
  const o = resultAt(f);
  const before = resultAt(f - 1);
  const speed = Math.hypot(o[0] - before[0], o[1] - before[1], o[2] - before[2]);
  const b = blur(o[1], d.cam.pose.target[1]);
  // deep in the stack it is soft and dim, and it steps out from behind the words' shade as it reaches the rail
  const k = lerp(1, gain, prog(o[1], W + 60, R));
  const a = show / (1 + 0.6 * b);
  const soft = b * 9 + Math.min(7, speed * 0.16);
  const signed = prog(f, SIGN, SIGN + 18, easings.outCubic);
  const matte = prog(f, SIGN, SIGN + 24);
  // pressed for a moment by your touch
  const press = 1 - 0.05 * bump(f, SIGN - 1, SIGN + 3, SIGN + 22);
  const half: [number, number] = [TASK[0] * press, TASK[1] * press];
  // lying in your plane it is a sliver when the stack is seen edge-on: there it faces the viewer
  const e = edgeOn(d);
  const lying = a * (1 - e);
  const out: [number, number] = [half[0] + SIGNED, half[1] + SIGNED];
  if (lying > 0) {
    d.flat(o, half, half[1], scale(mix(p.ground[1], p.bone, 0.12 * matte), k), { alpha: lerp(0.85, 1, matte) * lying, feather: soft });
    d.flat(o, half, half[1], scale(p.bone, k), { stroke: 4, alpha: lying, feather: soft });
    // signed off: your ring closes round it, from where you touched it
    if (signed > 0) d.flat(o, out, out[1], scale(p.you, k), { stroke: 3.6, alpha: lying, arc: [Math.PI, Math.PI * signed + 0.001] });
  }
  if (e > 0) {
    const q = d.cam.project(o);
    const hh = half[1] * q.s;
    d.box([q.x, q.y], [half[0] * q.s, hh], hh, scale(mix(p.ground[1], p.bone, 0.12 * matte), k), { alpha: a * e });
    d.box([q.x, q.y], [half[0] * q.s, hh], hh, scale(p.bone, k), { stroke: Math.max(2, 4 * q.s), alpha: a * e });
    if (signed > 0) d.box([q.x, q.y], [out[0] * q.s, out[1] * q.s], out[1] * q.s, scale(p.you, k), { stroke: Math.max(2, 3.6 * q.s), alpha: a * e * signed });
  }
  d.dot(o, DOT, scale(p.bone, k), { alpha: a, feather: soft });
  d.dot(o, RING, scale(p.you, k), { stroke: 3, alpha: 0.95 * a, feather: soft });
}

/** You, in the look-down: the dot of lift.ts, stretched into its own motion when it is fast. */
function me(d: Draw, f: number, gain: number): void {
  const show = 1 - edgeOn(d);
  if (show <= 0) return;
  const p = d.pal;
  const here = youAt(f);
  const speed = Math.abs(here[0] - youAt(f - 1)[0]);
  d.halo(here, 14, 52, scale(p.you, 1.1 * gain), 0.45 * show);
  d.dot(here, ME, scale(p.you, 2.2 * gain), { alpha: show, add: 0.3, feather: Math.min(9, speed * 0.16) });
  // the touch: your light on the result, once
  const touch = bump(f, SIGN - 2, SIGN + 1, SIGN + 24);
  if (touch > 0) d.halo([TOUCH + ME, TOP, 0], 8, 36, scale(p.you, 1.3 * gain), 0.5 * touch * show);
}

// ── the type ───────────────────────────────────────────────────────────────────────────────────
/** the question stands as it stood in bar 1, a few px lower (its caps reach the title-safe line); its answers take its rows */
const ASKED: Anchor = { x: 960, y: 336, align: 'centre' };
const SECOND_ROW = ASKED.y + STYLES.h1.px * STYLES.h1.leading;
/** the stamp stays under the answer, and under the two lines that follow it */
const STAMP_Y = SECOND_ROW + 90;
const STAMP_IN = 7;
/** the recap: the first answer's baseline; the four stand as one list, their numerals in a column */
const RECAP_AT: Anchor = { x: 262, y: 262, align: 'left' };
/** the card: the title's baseline, and the three lines under it */
const TITLE_Y = 271;
const CARD_ROWS = [TITLE_Y + 82, TITLE_Y + 158, TITLE_Y + 234] as const;

function draw(d: Draw, f: number): void {
  if (f <= FROM || f >= TO) {
    rest(d, f);
    return;
  }
  stack(d, f);
  // one shade behind the three headlines: it does not lift between them
  const through = passed(f);
  const shade = 1 - H1_DIM * clamp((f - (LANDED - TEXT_IN)) / TEXT_IN) * (1 - clamp((f - LEAVE) / TEXT_OUT));
  d.box([960, 540], [960, 540], 0, d.pal.ground[0], { alpha: clamp(1 - shade / through) });
  // what the words are about stays in the light
  const gain = 1 / through;
  routed(d, f, gain);
  for (const [t, x] of AFTER) pulse(d, f, t, x, 1);
  result(d, f, gain);
  me(d, f, gain);
  // under the card the stack runs on below the frame: its foot goes into the ground, not off a cut
  const card = prog(f, RECAP_OUT, CARD);
  if (card > 0) d.box([960, 1100], [1100, 150], 0, d.pal.ground[0], { alpha: 0.9 * card, feather: 150 });
  // the stamp outlasts its headline: it is set here, so that the next headline's shade does not fall on it.
  // It comes in last, on its cue, once the headline's glyphs have risen past its row
  const stamp = lineState('bydesign', f);
  if (stamp.on) {
    const enter = clamp((f - (stamp.l.frame - STAMP_IN)) / STAMP_IN);
    d.text('stamp', stamp.l.text, 960, STAMP_Y, { align: 'centre', enter, exit: stamp.exit, rgb: scale(mix(d.pal.bone, d.pal.ash, 0.35), gain) });
  }
}

export const close: Section = {
  from: FROM,
  to: TO,
  keys: [[LANDED, HIGH], [CLOSE_BY, NEAR], [LEAVE - 6, NEARER], [RECAP, RECAP_VIEW], [RECAP_OUT, RECAP_VIEW], [CARD, END[0]], [HELD, END[1]], [TO, END[1]]],
  place: {
    q2: ASKED,
    notyou: { x: 960, y: SECOND_ROW, align: 'centre' },
    decide: ASKED,
    recap: RECAP_AT,
    end: { x: 960, y: TITLE_Y, align: 'centre' },
  },
  linePlace: {
    'end.src': () => ({ x: 960, y: CARD_ROWS[0], align: 'centre' }),
    'end.by': () => ({ x: 960, y: CARD_ROWS[1], align: 'centre' }),
    'end.ind': () => ({ x: 960, y: CARD_ROWS[2], align: 'centre' }),
  },
  own: ['bydesign'],
  draw,
};
