/**
 * Beat 3, "two easy fixes" (STORYBOARD 3.1–3.3, film f960–1399): the two grey-stock counterfactuals
 * either side of your act-one desk. Grey stock is the road not taken: a grey albedo that can lead
 * (lit at luma 117 and up), a paper shade, a rim, and torn or punched edges (never dashes: dashes
 * are vellum, proposed). The turn (desk/turn.ts, from f1400) takes both over from their f1399 state.
 *
 * - **Fix A** (west, lower left): one fat folder and one long tape. The tape runs down the feeders'
 *   east faces, raised clear of the heap, every feeder dropping onto it through a short chute of its
 *   own; it turns east south of the heap and goes in under the folder's cover, where it is taken up
 *   (it ends inside the folder, away from your notes loop). Slips, cards and task cards queue on it
 *   nose to tail; the grey copy of the request (1.3x a chat slip, its beetle cut out, never
 *   vermilion) drops out of the chat spout at the start of 3.1 behind a dozen of them. The queue
 *   moves one station (a sprocket pitch, A_PITCH) on every beat: the request waits. Each item that
 *   reaches the folder's mouth is lifted onto its pile, so the stack visibly grows, askew: one
 *   session's context, all of it mixed.
 * - **Fix B** (east): eight trays, one per event, scattered, none alike: each holds its own event
 *   (a chat slip, a punched card, an envelope, a calendar leaf) and its own small dossier, and fires
 *   its reply slip at your in-tray, where they jostle. A follow-up of tray 2's task lands in tray 6;
 *   the stub of tray 2's card, where the follow-up should have joined, tears off and stays in tray 2.
 *
 * World units as layout.ts. Every pose is a pure function of the film frame, hung off the cue sheet
 * (cues.ts FIX_A, FIX_B, BOTH_FIXES).
 */
import { clamp } from '@aiv/core';
import { Easing } from 'remotion';
import { BEAT, FIX_A, FIX_B } from '../cues.ts';
import { FOLDERS, MOUTH, YOU_SHIFT_A, requestOnTapeAt, type FeederId } from './actOne.ts';
import { segFp, type Footprint } from './footprints.ts';
import { FEEDERS, YOU, rectC, type BayId, type P2, type P3 } from './layout.ts';
import { SPRING, springAt } from './state.ts';
// types only: turn.ts reads this module's constants as it loads, so a value import back would be a cycle
import type { FixATurn, FixBTurn } from './turn.ts';

const MOVE = Easing.bezier(0.2, 0, 0, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));
const bump = (f: number, t0: number, n: number): number => (f <= t0 || f >= t0 + n ? 0 : Math.sin((Math.PI * (f - t0)) / n) ** 2);
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm3 = (a: P3): P3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** A seeded value in [0, 1) (integer hash; no Math.random). */
const hash = (i: number, k: number): number => ((Math.imul(i * 2654435761 + k * 40503 + 0x9e37, 2246822519) >>> 0) % 100003) / 100003;
/** Constant-speed transport with short ramps (linear in its middle, as tape runs), 0..1. */
function transport(t: number, ramp = 0.2): number {
  const x = clamp(t);
  const v = 1 / (1 - ramp);
  if (x < ramp) return (v * x * x) / (2 * ramp);
  if (x > 1 - ramp) return 1 - (v * (1 - x) * (1 - x)) / (2 * ramp);
  return v * (x - ramp / 2);
}

// ------------------------------------------------------------------------------------------------
// Fix A: the folder, the tape's path, the chutes

/**
 * The one session's folder: the fattest on the desk (over 200 px across at 1.2x, its stack taller than any act-one
 * folder's), its stack and the pile on it one session's whole context. North of the notes band, clear of your loop.
 */
export const FIX_A_FOLDER = { c: [-640, -92] as P2, w: 176, d: 172, rot: 0, sheets: 30 } as const;
/** The folder's stack (act one's sheet: 1.4 u) as Fix A arrives: its top sheet, which the pile lies on. */
export const A_FOLDER_TOP = 1.2 + FIX_A_FOLDER.sheets * 1.4;
/** Each item lifted onto the pile thickens the stack under it this much (the context grows), over A_GROW_FRAMES on the move curve once it lands. */
export const A_GROW = 4.5;
export const A_GROW_FRAMES = 8;
/** A pile piece's thickness (they lie on each other: one session's context, all of it mixed). */
const PILE_T = 0.8;
/** The tape: grey stock with punched sprocket holes (a station is A_PITCH: two holes). */
export const A_TAPE_W = 32;
/** The row the tape runs east along into the folder, and its bend up the feeders. */
const ROW_Y = -100;
const BEND = 30;
/** The raised run down the feeders' east faces: its centreline, height (clear of the heap), and the ramp down to the desk south of the heap. */
export const A_COLLECTOR = { x: -834, z: 19, ramp: [-70, -10] as P2, north: 900 } as const;
const F_EAST = FIX_A_FOLDER.c[0] + FIX_A_FOLDER.w / 2;
const F_WEST = FIX_A_FOLDER.c[0] - FIX_A_FOLDER.w / 2;
/** Where the tape comes out of the folder's east side (the turn pulls its lead out here). */
export const A_LIFT: P2 = [F_EAST, ROW_Y];

const smooth = (t: number): number => t * t * (3 - 2 * t);
/** The path from the folder's east edge (d 0, inside the folder) west along the row, round the bend, up the ramp and north along the feeders. */
function samplePath(): P3[] {
  const C = A_COLLECTOR;
  const pts: P3[] = [
    [F_EAST, ROW_Y, 0.6],
    [C.x + BEND, ROW_Y, 0.6],
  ];
  for (let i = 1; i <= 8; i++) {
    const a = -Math.PI / 2 - ((Math.PI / 2) * i) / 8;
    pts.push([C.x + BEND + BEND * Math.cos(a), ROW_Y + BEND + BEND * Math.sin(a), 0.6]);
  }
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    pts.push([C.x, C.ramp[0] + (C.ramp[1] - C.ramp[0]) * t, 0.6 + (C.z - 0.6) * smooth(t)]);
  }
  pts.push([C.x, C.north, C.z]);
  return pts;
}
const A_PATH3: readonly P3[] = samplePath();
const A_CUM: readonly number[] = (() => {
  const c = [0];
  for (let i = 1; i < A_PATH3.length; i++) {
    const a = A_PATH3[i - 1];
    const b = A_PATH3[i];
    c.push(c[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return c;
})();
/** The path on the desk (plan), folder first. */
export const A_PATH: readonly P2[] = A_PATH3.map((p) => [p[0], p[1]]);
export const A_LEN = A_CUM[A_CUM.length - 1];

/** The point at distance d along the path (clamped), its height, and the unit direction away from the folder (plan and 3D). */
export function aPathAt(d: number): { p: P2; dir: P2; z: number; dir3: P3 } {
  const x = Math.min(Math.max(d, 0), A_LEN);
  let i = 1;
  while (i < A_CUM.length - 1 && A_CUM[i] < x) i++;
  const a = A_PATH3[i - 1];
  const b = A_PATH3[i];
  const l = A_CUM[i] - A_CUM[i - 1];
  const t = l > 0 ? (x - A_CUM[i - 1]) / l : 0;
  const dir3 = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const pl = Math.hypot(dir3[0], dir3[1]) || 1;
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], z: a[2] + (b[2] - a[2]) * t, dir: [dir3[0] / pl, dir3[1] / pl], dir3 };
}
/** Distance along the path to where the collector passes y (bisection; the path rises monotonically north of the bend). */
function dAtY(y: number): number {
  let lo = A_CUM[1];
  let hi = A_LEN;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (aPathAt(mid).p[1] < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Distance along the path to the folder's west edge, its mouth (where the queue goes in). */
export const A_FOLDER_IN = F_EAST - F_WEST;

/** Each feeder's chute: from its mouth (or face) to the tape's centreline, at its height; where it meets the tape (path distance). */
export interface Chute {
  from: FeederId;
  x0: number;
  x1: number;
  y: number;
  w: number;
  z0: number;
  z1: number;
  /** path distance of the junction */
  d: number;
}
export const A_CHUTES: readonly Chute[] = (() => {
  const x1 = A_COLLECTOR.x - 2;
  const spec: readonly [FeederId, number, number, number][] = [
    ['chat', MOUTH.chat.out[0] - 6, MOUTH.chat.out[1], MOUTH.chat.out[2]],
    ['ci', FEEDERS.ci.x1, MOUTH.ci.out[1], MOUTH.ci.out[2]],
    ['mail', FEEDERS.mail.x1, MOUTH.mail.out[1], MOUTH.mail.out[2]],
    ['calendar', FEEDERS.calendar.x1, -24, 19],
  ];
  return spec.map(([from, x0, y, z0]) => {
    const d = dAtY(y);
    return { from, x0, x1, y, w: 30, z0, z1: aPathAt(d).z + 0.7, d };
  });
})();
export const A_JUNCTION = Object.fromEntries(A_CHUTES.map((c) => [c.from, c.d])) as Record<FeederId, number>;

// ---- the queue

export type AItemKind = 'chat' | 'ci' | 'task' | 'request';
/** Item sizes (along the tape, across it): a notched chat slip, a CI card, a task card (a pictogram of at least 48 px), the request (1.3x a chat slip). */
export const A_SIZE: Record<AItemKind, P2> = { chat: [36, 24], ci: [34, 26], task: [42, 30], request: [62, 30] };
/** Nose to tail. */
export const A_GAP = 4;
/** One station: the queue moves this far on each beat (two sprocket holes). */
export const A_PITCH = 16;
/** Beat 3's own advances (the turn takes f1400's): one station on each beat, 10 f on the move curve. */
export const A_STEPS: readonly number[] = FIX_A.steps.filter((s) => s < 1400);
export const A_STEP_FRAMES = 10;
/** Fix A arrives on its cue: the folder slides up from beyond the frame's south edge as its tape runs in from beyond the north edge, carrying the queue. */
export const A_RISE = { from: FIX_A.in, frames: 24, dy: 380 } as const;
export const A_RIDE = { from: FIX_A.in, frames: 20, len: 820 } as const;
/** The chutes slide out of the feeders' mouths (from a slot, 4 f each, 2 f apart: chat, ci, mail, calendar), as the tape's run brakes. */
export const A_CHUTE_OUT = { from: FIX_A.in + 6, frames: 4, stagger: 2 } as const;

/** How far upstream (toward the feeders) the queue still lies at f: every station still to come, and the run-in before the first. */
export function aBackAt(f: number): number {
  let b = A_RIDE.len * (1 - transport(span01(f, A_RIDE.from, A_RIDE.from + A_RIDE.frames)));
  for (const s of A_STEPS) b += A_PITCH * (1 - MOVE(span01(f, s, s + A_STEP_FRAMES)));
  return b;
}
const BACK_AT_STEPS = A_STEPS.length * A_PITCH;
export const aRiseAt = (f: number): number => A_RISE.dy * (1 - MOVE(span01(f, A_RISE.from, A_RISE.from + A_RISE.frames)));
export const aChuteAt = (k: number, f: number): number => MOVE(span01(f, A_CHUTE_OUT.from + A_CHUTE_OUT.stagger * k, A_CHUTE_OUT.from + A_CHUTE_OUT.stagger * k + A_CHUTE_OUT.frames));

/** A place on the tape: its kind and size, its centre's path distance at f1399, and how it got there. */
export interface QueueItem {
  kind: AItemKind;
  l: number;
  w: number;
  /** its centre's path distance at f1399 (at f, aBackAt(f) further upstream) */
  d: number;
  /** printed variant */
  v: number;
  /** dropped onto the tape during beat 3: from which feeder, landing on which frame, over which arc */
  pour?: { from: FeederId; lands: number; arc: number; apex: number };
  /** lifted onto the folder's pile: the frame it starts up, and its place in the pile */
  swallow?: { at: number; m: number };
}
/** Kinds ahead of the request, nearest it first (three task cards among them; the poured places marked with their feeder). */
const AHEAD: readonly (readonly [AItemKind, FeederId | null])[] = [
  ['chat', null],
  ['ci', null],
  ['task', null],
  ['chat', null],
  ['chat', null],
  ['task', 'mail'],
  ['ci', null],
  ['chat', null],
  ['task', 'calendar'],
  ['chat', null],
  ['ci', null],
  ['chat', null],
  ['chat', null],
  ['ci', null],
  ['chat', null],
  ['task', null],
];
/** Kinds behind it, nearest first: all dropped on during beat 3 as the empty tape passes their feeders. */
const BEHIND: readonly AItemKind[] = ['chat', 'ci', 'chat', 'chat', 'ci', 'chat', 'chat'];
/** The flights (TREATMENT element sheet): chat flutters, a card clacks down low, an envelope glides, a leaf flips. */
const POUR_ARC: Record<FeederId, { arc: number; apex: number }> = { chat: { arc: 10, apex: 16 }, ci: { arc: 8, apex: 10 }, mail: { arc: 10, apex: 8 }, calendar: { arc: 10, apex: 18 } };
/** Nothing new is launched after this (the stillness before the turn): later pours are never made, their places stay empty. */
export const A_LAST_LAUNCH = 1372;
/** An item is lifted onto the pile once its centre is this close to the folder's mouth (its nose at the cover's lip: nothing goes in under it). */
const SWALLOW_AT = A_FOLDER_IN + 20;
/** The pile's pieces already on the folder when Fix A arrives (one session's history). */
const PILE0: readonly AItemKind[] = ['chat', 'ci', 'task', 'chat', 'ci', 'chat'];
/** The request's place at f1399: as the run-in ends (f980) its place lies just upstream of the chat spout's chute, which drops it there as the first station's move ends (f990). */
const D_REQUEST = A_JUNCTION.chat + 2 - (BACK_AT_STEPS - A_PITCH);

/** Which station-step a place reaches the band ±tol about a junction in (index into A_STEPS, after that step), or -1 before the first step. */
function stepAtJunction(d: number, junction: number, tol: number): number | null {
  for (let j = -1; j < A_STEPS.length; j++) {
    const back = A_PITCH * (A_STEPS.length - 1 - j);
    if (Math.abs(d + back - junction) <= tol) return j;
  }
  return null;
}

export const A_QUEUE: readonly QueueItem[] = (() => {
  const places: { kind: AItemKind; from: FeederId | null }[] = [...[...AHEAD].reverse().map(([kind, from]) => ({ kind, from })), { kind: 'request', from: 'chat' as FeederId }, ...BEHIND.map((kind) => ({ kind, from: (kind === 'chat' ? 'chat' : 'ci') as FeederId }))];
  // nose to tail about the request's place
  const ri = AHEAD.length;
  const d: number[] = new Array(places.length).fill(0);
  d[ri] = D_REQUEST;
  for (let i = ri - 1; i >= 0; i--) d[i] = d[i + 1] - (A_SIZE[places[i + 1].kind][0] / 2 + A_GAP + A_SIZE[places[i].kind][0] / 2);
  for (let i = ri + 1; i < places.length; i++) d[i] = d[i - 1] + (A_SIZE[places[i - 1].kind][0] / 2 + A_GAP + A_SIZE[places[i].kind][0] / 2);
  const out: QueueItem[] = [];
  let m = PILE0.length;
  places.forEach((pl, i) => {
    // a place already at the mouth when the run-in ends went in before beat 3 (the pile holds its history)
    if (d[i] + BACK_AT_STEPS <= SWALLOW_AT) return;
    const [l, w] = A_SIZE[pl.kind];
    const it: QueueItem = { kind: pl.kind, l, w, d: d[i], v: i % 4 };
    if (pl.from) {
      const j = stepAtJunction(d[i], A_JUNCTION[pl.from], A_PITCH / 2);
      if (j !== null) {
        const s = j < 0 ? A_STEPS[0] - A_STEP_FRAMES : A_STEPS[j];
        // a chat slip lands as the station's move ends (an eighth); a card, an envelope or a leaf on the next beat
        const lands = pl.kind === 'chat' || pl.kind === 'request' ? s + A_STEP_FRAMES : s + 20;
        const { arc, apex } = POUR_ARC[pl.from];
        if (lands - arc - 3 <= A_LAST_LAUNCH - 3) it.pour = { from: pl.from, lands, arc, apex };
        else if (i > ri) return; // never dropped on: an empty place
      } else if (i > ri) return;
    }
    // lifted onto the pile at the end of the advance that brings its centre to the mouth
    for (let j = 0; j < A_STEPS.length; j++) {
      const before = d[i] + A_PITCH * (A_STEPS.length - j);
      const after = before - A_PITCH;
      // (one that would reach it on the last station waits at the lip: nothing is launched in the stillness before the turn)
      if (before > SWALLOW_AT && after <= SWALLOW_AT) {
        if (A_STEPS[j] + A_STEP_FRAMES <= A_LAST_LAUNCH) it.swallow = { at: A_STEPS[j] + A_STEP_FRAMES, m: m++ };
        break;
      }
    }
    out.push(it);
  });
  return out;
})();
/** The request's index in A_QUEUE. */
export const A_REQUEST = A_QUEUE.findIndex((q) => q.kind === 'request');
/** Every pour, in landing order. */
export const A_POURS: readonly { q: number; from: FeederId; lands: number; arc: number; apex: number }[] = A_QUEUE.flatMap((q, i) => (q.pour ? [{ q: i, ...q.pour }] : [])).sort((a, b) => a.lands - b.lands);

/** The folder's stack top once every swallow has thickened it (as the turn takes it over). */
export const A_STACK_END = A_FOLDER_TOP + A_GROW * A_QUEUE.filter((q) => q.swallow).length;
/** The pile on the folder: PILE0, then each swallowed item in order (its kind, its seeded place and turn on the top sheet). */
export const A_PILE: readonly { kind: AItemKind; v: number; o: P2; rot: number; z: number; q: number | null }[] = (() => {
  const list: { kind: AItemKind; v: number; q: number | null }[] = PILE0.map((kind, i) => ({ kind, v: (i + 1) % 4, q: null }));
  A_QUEUE.forEach((q, i) => {
    if (q.swallow) list[q.swallow.m] = { kind: q.kind, v: q.v, q: i };
  });
  return list.map((p, m) => {
    // stacked one on another, every one a little further off square than the last: the pile grows tall and untidy
    // (z: its place once every swallow has thickened the stack, as the turn finds it; beat 3 lowers it by the growth to come)
    const spread = 3 + 0.9 * m;
    return { ...p, o: [12 + (hash(m, 1) * 2 - 1) * spread, 10 + (hash(m, 2) * 2 - 1) * spread] as P2, rot: (hash(m, 3) * 2 - 1) * (0.14 + 0.025 * m) + (m % 2 ? 0.22 : -0.08), z: A_STACK_END + 0.5 + PILE_T * m };
  });
})();
/** The swallow: from the mouth, up and over onto the pile, in 8 f (move curve, a small arc). */
export const A_SWALLOW_FRAMES = 8;
/** The frames the swallowed items land on the pile (each thickens the stack from then on). */
const A_LANDS: readonly number[] = A_QUEUE.flatMap((q) => (q.swallow ? [q.swallow.at + A_SWALLOW_FRAMES] : []));
/** The folder's stack top at f: its sheets, thickened by each item swallowed so far (from its landing, exactly at rest after). */
export const aStackTopAt = (f: number): number => A_FOLDER_TOP + A_GROW * A_LANDS.reduce((s, t) => s + MOVE(span01(f, t, t + A_GROW_FRAMES)), 0);

/** The places on the tape at f1400 (for the turn): their kind, size, path distance and variant, from the folder back. */
export interface AItem {
  kind: AItemKind;
  l: number;
  w: number;
  d: number;
  v: number;
}
export const A_ITEMS: readonly AItem[] = A_QUEUE.filter((q) => !q.swallow).map((q) => ({ kind: q.kind, l: q.l, w: q.w, d: q.d, v: q.v }));

/** The tape's lead end (taken up inside the folder) and its tail (by the chat spout at the end of beat 3), as path distances at f1399. */
export const A_TAPE = { lead: A_FOLDER_IN - 20 - BACK_AT_STEPS, tail: A_JUNCTION.chat + 34 } as const;

/** An item's pose: its centre, its axes (x along it, y across), and how far it has turned to paper (the turn's). */
export interface AItemPose {
  p: P3;
  x: P3;
  y: P3;
  paper: number;
  kind?: AItemKind;
  v?: number;
  /** in the air (a pour): its shadow lies apart from it */
  air?: boolean;
}
const onTape = (d: number): AItemPose => {
  const { p, z, dir3 } = aPathAt(d);
  // the item lies along the tape, its nose toward the folder (x points down the path toward d 0)
  const x: P3 = [-dir3[0], -dir3[1], -dir3[2]];
  const pl = Math.hypot(dir3[0], dir3[1]) || 1;
  const y: P3 = [dir3[1] / pl, -dir3[0] / pl, 0];
  return { p: [p[0], p[1], z + 0.7], x, y, paper: 0 };
};
const flat = (c: P3, rot: number): Pick<AItemPose, 'p' | 'x' | 'y'> => ({ p: c, x: [Math.cos(rot), Math.sin(rot), 0], y: [-Math.sin(rot), Math.cos(rot), 0] });

/** A pour in the air: out of its feeder's mouth (3 f anticipation), then over its chute onto its place as it lands. */
function pourPose(q: QueueItem, f: number): AItemPose | null {
  const P = q.pour!;
  const t0 = P.lands - P.arc - 3;
  if (f < t0) return null;
  const M = MOUTH[P.from];
  if (f < t0 + 3) {
    const e = MOVE(span01(f, t0, t0 + 3));
    return { ...flat(lerp3(M.in, M.out, e), 0), paper: 0, air: true };
  }
  const land = onTape(q.d + aBackAt(P.lands));
  const u = (f - t0 - 3) / P.arc;
  const l = lerp3(M.out, land.p, u);
  const p: P3 = [l[0], l[1], l[2] + 4 * P.apex * u * (1 - u)];
  // its heading turns from the feeder's (east) to the tape's; a chat slip flutters, a leaf flips over its length
  const a1 = Math.atan2(land.x[1], land.x[0]);
  const ang = a1 * MOVE(u);
  const tilt = P.from === 'chat' ? 0.35 * Math.sin(u * Math.PI * 2) : P.from === 'calendar' ? 0.55 * Math.sin(u * Math.PI) : 0.12 * Math.sin(u * Math.PI);
  const x: P3 = [Math.cos(ang), Math.sin(ang), 0];
  const y: P3 = [-Math.sin(ang) * Math.cos(tilt), Math.cos(ang) * Math.cos(tilt), Math.sin(tilt)];
  return { p, x, y, paper: 0, air: true };
}

/** Beat 3's Fix A: the turn's shape (FixATurn) plus what only beat 3 draws: the tape's drawn stretch, the pile, the chutes, the folder's slide. */
export interface FixAView extends Omit<FixATurn, 'items'> {
  items: (AItemPose | null)[];
  /** the tape drawn from path distance d0 to d1; u0: the print's material place at d0 */
  tape?: { d0: number; d1: number; u0: number };
  /** the folder's pile, each piece on the top sheet or on its way up */
  pile?: AItemPose[];
  /** each chute's length out of its feeder (A_CHUTES order), 0..1 */
  chutes?: number[];
  /** how far south the folder (and its pile) still is as it slides in (u) */
  folderDy?: number;
  /** its stack's top (it thickens with each swallow; the turn's: A_STACK_END) */
  stackTop?: number;
  /** the request's copy in the request's own vermilion (0 grey stock … 1), while Fix A holds the focus */
  requestInk?: number;
}

/**
 * One request on screen in 3.1: the copy on the tape carries the request's vermilion while Fix A holds the focus (from
 * its pour out of the chat spout until the focus moves to Fix B) and the heap's request drains to its paper meanwhile
 * (actOne.ts actOneAt); both over spring-effects, crossing in the same frames. From 3.2 on the heap's is the request again.
 */
export const aRequestInkAt = (f: number): number => requestOnTapeAt(f);

/** A pile piece's pose in world, on the stack as thick as it is at this point (`top`). */
const pileWorld = (k: number, dy: number, top: number): AItemPose => {
  const P = A_PILE[k];
  const F = FIX_A_FOLDER;
  return { ...flat([F.c[0] + P.o[0], F.c[1] + P.o[1] - dy, P.z - (A_STACK_END - top)], P.rot), paper: 0, kind: P.kind, v: P.v };
};

/** Fix A at film frame f of beat 3 (pure). */
export function fixAAt(f: number): FixAView {
  const back = aBackAt(f);
  const dy = aRiseAt(f);
  const items: (AItemPose | null)[] = A_QUEUE.map((q) => {
    if (q.pour && f < q.pour.lands) {
      const pp = pourPose(q, f);
      return pp && { ...pp, kind: q.kind, v: q.v };
    }
    if (q.swallow && f >= q.swallow.at) return null;
    const d = q.d + back;
    if (d > A_LEN - q.l) return null;
    return { ...onTape(d), kind: q.kind, v: q.v };
  });
  const top = aStackTopAt(f);
  const pile: AItemPose[] = [];
  A_PILE.forEach((P, m) => {
    const rest = pileWorld(m, dy, top);
    if (P.q === null) return void pile.push(rest);
    const q = A_QUEUE[P.q];
    const at = q.swallow!.at;
    if (f < at) return;
    if (f >= at + A_SWALLOW_FRAMES) return void pile.push(rest);
    // up out of the mouth and over onto the pile (it never leaves the tape before it is lifted: the same pose at `at`)
    const from = onTape(q.d + aBackAt(at));
    const u = MOVE(span01(f, at, at + A_SWALLOW_FRAMES));
    const c = lerp3(from.p, rest.p, u);
    const a0 = Math.atan2(from.x[1], from.x[0]);
    let a1 = P.rot;
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    while (a0 - a1 > Math.PI) a1 += Math.PI * 2;
    pile.push({ ...flat([c[0], c[1], c[2] + 10 * Math.sin(Math.PI * u)], a0 + (a1 - a0) * u), paper: 0, kind: P.kind, v: P.v });
  });
  const lead = A_TAPE.lead + back;
  const tail = A_TAPE.tail + back;
  const d0 = Math.max(lead, A_FOLDER_IN - 14);
  const d1 = Math.min(tail, A_LEN);
  const none = { a: [A_LIFT[0], A_LIFT[1], 0.5] as P3, b: [A_LIFT[0], A_LIFT[1], 0.5] as P3, wa: [0, 1, 0] as P3, wb: [0, 1, 0] as P3, len: 0 };
  return {
    wound: -back,
    span: none,
    deskLen: Math.max(0, d1 - d0),
    spanLen: 0,
    items,
    tape: d1 > d0 ? { d0, d1, u0: d0 - lead } : undefined,
    pile,
    chutes: A_CHUTES.map((_, k) => aChuteAt(k, f)),
    folderDy: dy,
    stackTop: top,
    requestInk: aRequestInkAt(f),
  };
}

/**
 * Fix A's footprints: the folder with its pile (sliding in), the tape (its row on the desk, the ramp, the raised run as
 * a bar over the heap), each chute while it is out, and each item in the air (its shadow apart from it). Items lying on
 * the tape and the pile cast nothing of their own (they lie on it: their contact is the tape's).
 */
export function fixAFootprints(A: FixAView): Footprint[] {
  const fp: Footprint[] = [];
  const F = FIX_A_FOLDER;
  const dy = A.folderDy ?? 0;
  // the folder's body up to its top sheet, thickening with the stack (just under the pile's lowest piece, so it never
  // shades the pile; a piece in the air on its way up is not part of it)
  fp.push({ kind: 'rect', c: [F.c[0], F.c[1] - dy], h: [F.w / 2, F.d / 2], r: 3, rot: F.rot, z0: 0, z1: (A.stackTop ?? A_STACK_END) + 0.4, contact: 0.8 });
  if (A.tape) {
    const { d0, d1 } = A.tape;
    const cuts = [d0, A_CUM[1], A_CUM[9], (A_CUM[9] + A_CUM[19]) / 2, A_CUM[19], A_CUM[19] + 240, A_CUM[19] + 480, d1];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = Math.max(cuts[i], d0);
      const b = Math.min(cuts[i + 1], d1);
      if (b - a < 2) continue;
      const pa = aPathAt(a);
      const pb = aPathAt(b);
      fp.push(segFp([pa.p[0], pa.p[1], pa.z - 0.2], [pb.p[0], pb.p[1], pb.z - 0.2], A_TAPE_W / 2 - 2));
    }
  }
  A_CHUTES.forEach((c, k) => {
    const e = A.chutes?.[k] ?? 1;
    if (e < 0.05) return;
    const x1 = c.x0 + (c.x1 - c.x0) * e;
    fp.push(segFp([c.x0, c.y, c.z0], [x1, c.y, c.z0 + (c.z1 - c.z0) * e], c.w / 2 - 2));
  });
  A.items.forEach((it, i) => {
    if (!it?.air) return;
    const q = A_QUEUE[i];
    fp.push({ kind: 'rect', c: [it.p[0], it.p[1]], h: [q.l / 2, q.w / 2], r: 2, rot: Math.atan2(it.x[1], it.x[0]), z0: it.p[2] - 0.4, z1: it.p[2] + 0.4, contact: 0 });
  });
  return fp;
}

// ------------------------------------------------------------------------------------------------
// Fix B: eight trays, one per event, firing their replies at your in-tray

export interface Tray {
  /** 0..7: the north row west to east, the middle row, then the south row */
  i: number;
  c: P2;
  w: number;
  d: number;
  /** the height its walls grow to at the turn, and where its door stands in the north wall (offset from the middle) */
  wall: number;
  door: number;
}
/**
 * Eight trays east of your desk in three loose rows (3, 3, 2), inside title-safe, north of the notes band and clear of
 * F8; each its own size (none alike: TREATMENT BANNED, identical parallel modules), 120–187 px across at 1.2x.
 */
const TRAY_SPEC: readonly [number, number, number, number, number, number][] = [
  // cx, cy, w, d, wall, door
  [118, 90, 108, 92, 38, -14],
  [236, 86, 104, 100, 44, 10],
  [354, 66, 108, 88, 34, 0],
  [124, -22, 120, 88, 40, -12],
  [246, -30, 100, 94, 42, 12],
  [354, -37, 100, 90, 36, -8],
  [150, -136, 156, 84, 46, 14],
  [322, -138, 146, 88, 38, -4],
];
export const TRAYS: readonly Tray[] = TRAY_SPEC.map(([x, y, w, d, wall, door], i) => ({ i, c: [x, y] as P2, w, d, wall, door }));
/** The tray's floor and rim (grey stock, its top edge torn and punched), and the walls they grow at the turn (the bay family's height). */
export const TRAY_Z = { floor: 1.6, rim: 7, wall: 40, wallT: 5, southWall: 16 } as const;
/** Each tray's event card (the turn's single card size; beat 3 draws each tray's own event, TRAY_STUFF). */
export const TRAY_CARD = { w: 38, d: 24, dx: -16, dy: 8 } as const;
/** A reply slip (grey stock, notched like the reply chute's slips). */
export const B_SLIP = { w: 22, l: 46 } as const;

export type EventKind = 'chat' | 'ci' | 'mail' | 'leaf';
/** An event card's size per family (u): a notched chat slip, a punched card, an envelope, a calendar leaf (48 px and more at 1.2x). */
export const EVENT_SIZE: Record<EventKind, P2> = { chat: [48, 22], ci: [44, 30], mail: [44, 30], leaf: [40, 34] };
/** What lies in each tray (tray-local): its event, its dossier (a little stack: its own context), and where its reply rests before it fires. */
export interface TrayStuff {
  event: { kind: EventKind; o: P2; rot: number };
  dossier: { o: P2; rot: number; w: number; d: number; sheets: number };
  reply: { o: P2; rot: number };
}
const STUFF_SPEC: readonly [EventKind, number, number, number][] = [
  // the event's family, the dossier's sheets and size (w, d)
  ['chat', 3, 28, 34],
  ['ci', 6, 30, 38],
  ['ci', 2, 26, 32],
  ['leaf', 4, 28, 34],
  ['mail', 7, 32, 36],
  ['chat', 5, 28, 38],
  ['leaf', 3, 26, 32],
  ['mail', 2, 24, 30],
];
/** The event against the tray's west wall to the north, its dossier against the east wall, its reply along the south (each nudged and turned its own way). */
export const TRAY_STUFF: readonly TrayStuff[] = TRAYS.map((tr, k) => {
  const [kind, sheets, dw, dd] = STUFF_SPEC[k];
  const [ew, ed] = EVENT_SIZE[kind];
  const j = (n: number, a: number) => (hash(k, n) * 2 - 1) * a;
  return {
    event: { kind, o: [-tr.w / 2 + 9 + ew / 2 + j(1, 2), tr.d / 2 - 9 - ed / 2 + j(2, 2)] as P2, rot: j(3, 0.12) },
    dossier: { o: [tr.w / 2 - 10 - dw / 2 + j(4, 2), tr.d / 2 - 10 - dd / 2 + j(5, 3)] as P2, rot: j(6, 0.14), w: dw, d: dd, sheets },
    reply: { o: [j(7, 6) - 4, -tr.d / 2 + 9 + B_SLIP.w / 2 + 2] as P2, rot: j(8, 0.2) },
  };
});
/** Tray 2's task card tears in two on the break mark; its follow-up (the same family, the same punches) has landed in tray 6. */
export const BREAK = { from: 2, to: 6 } as const;
/** The follow-up: the same family as tray 2's card at its size, posted from beyond the east edge into tray 6, between its event and its dossier. */
export const FOLLOW_UP = { lands: FIX_B.followUp, arc: 16, from: [640, -30, 70] as P3, o: [4, 16] as P2, rot: -0.1, w: EVENT_SIZE.ci[0], d: EVENT_SIZE.ci[1] } as const;
/**
 * The break: on the cue, tray 2's card (where its follow-up should have joined it) tears across its middle and its east
 * half twists and slides off on spring-settle, both halves left lying in tray 2. `STUB` is the half that moves.
 */
export const TEAR = { at: FIX_B.breakMark, slide: [12, -10] as P2, rot: 0.38 } as const;
export const STUB = { w: EVENT_SIZE.ci[0] / 2, d: EVENT_SIZE.ci[1] } as const;

/**
 * At the turn eight event trays become three task bays (desk/turn.ts): the two that already stand where a bay will
 * (tray 5 inside the bug bay's box, tray 3 inside the docs galley's) wall up in place, and tray 6 slides west along the
 * clear south row to the test tower's place and walls up there; the other five are posted back out beyond the east
 * edge the way they came in (lifted over the trays that stay), so nothing is pressed away or vanishes.
 */
export const BAY_TRAYS: readonly { k: number; id: BayId }[] = [
  { k: 5, id: 'bug' },
  { k: 3, id: 'docs' },
  { k: 6, id: 'tests' },
];
export const RETIRE_TRAYS: readonly number[] = [0, 1, 2, 4, 7];

/** Your in-tray in act one (world): YOU.inTray at the act-one shift. */
export const IN_TRAY_A_C: P2 = [rectC(YOU.inTray)[0] + YOU_SHIFT_A[0], rectC(YOU.inTray)[1] + YOU_SHIFT_A[1]];
/** The replies jostling in your in-tray (offsets from its centre), oldest first: slip k came from tray k. */
export const IN_TRAY_PILE: readonly { o: P2; rot: number }[] = [
  { o: [-30, 26], rot: 0.12 },
  { o: [26, -24], rot: -0.18 },
  { o: [-24, -28], rot: 0.3 },
  { o: [30, 30], rot: -0.08 },
  { o: [-36, 0], rot: -0.26 },
  { o: [12, 4], rot: 0.22 },
  { o: [-6, 34], rot: -0.34 },
  { o: [20, -6], rot: 0.06 },
];

// ------------------------------------------------------------------------------------------------
// Imprints: every act-one folder and Fix A's, pressed into the desk at the turn (history at −2)

export const IMPRINTS: readonly { c: P2; w: number; d: number; rot: number }[] = [
  ...FOLDERS.map((fl) => ({ c: fl.c, w: fl.w, d: fl.d, rot: fl.rot })),
  { c: FIX_A_FOLDER.c, w: FIX_A_FOLDER.w, d: FIX_A_FOLDER.d, rot: FIX_A_FOLDER.rot },
];

// ---- Fix B over time

/**
 * Fix B's trays are posted in one by one from beyond the east edge, in tray order (the north row west to east first),
 * 2 f apart (never one block): each a 3 f anticipation (a 4 u lift where it leaves), a 12 f low arc that comes down onto
 * its place, and a 3% squash as it lands (the Post relationship).
 */
export const B_POST = { from: FIX_B.in, stagger: 2, antic: 3, arc: 12, apex: 22, z0: 40, squash: 0.03, squashFrames: 6 } as const;
/** Where every tray is thrown from: its west edge just past the frame's east edge at 1.2x. */
const B_SOURCE_X = 540;
export const trayThrownB = (k: number): number => B_POST.from + B_POST.stagger * k;
export const trayLandsB = (k: number): number => trayThrownB(k) + B_POST.antic + B_POST.arc;
/** A tray on its post: its offset from its place (u) and its landing squash (0 at rest). */
export interface TrayPost {
  off: P3;
  squash: number;
}
export function trayPostAt(k: number, f: number): TrayPost {
  const tr = TRAYS[k];
  const t0 = trayThrownB(k);
  const lands = trayLandsB(k);
  const from: P3 = [B_SOURCE_X - (tr.c[0] - tr.w / 2), -16, B_POST.z0];
  if (f < t0 + B_POST.antic) return { off: [from[0], from[1], from[2] + 4 * MOVE(span01(f, t0, t0 + B_POST.antic))], squash: 0 };
  if (f < lands) {
    // decelerating across, its height coming straight down onto its place at the end (its shadow tightening)
    const u = (f - t0 - B_POST.antic) / B_POST.arc;
    const k2 = (1 - u) * (1 - u);
    return { off: [from[0] * k2, from[1] * k2, (from[2] + 4) * k2 + 4 * B_POST.apex * u * (1 - u) * (1 - u)], squash: 0 };
  }
  return { off: [0, 0, 0], squash: B_POST.squash * bump(f, lands, B_POST.squashFrames) };
}

/** A reply resting in its tray (world). */
export const trayRestB = (k: number): P3 => [TRAYS[k].c[0] + TRAY_STUFF[k].reply.o[0], TRAYS[k].c[1] + TRAY_STUFF[k].reply.o[1], TRAY_Z.floor + 0.6];
const IN_TRAY_FLOOR = YOU.top + 3;
const inTraySlotA = (k: number): P3 => [IN_TRAY_A_C[0] + IN_TRAY_PILE[k].o[0], IN_TRAY_A_C[1] + IN_TRAY_PILE[k].o[1], IN_TRAY_FLOOR + 0.9 * k];
/** Reply 7, the last, is posted on the cue sheet's `FIX_B.reply7` (f1300, bar 17 beat 2: in 3.3, so nothing launches in the rest before the turn), a 14 f arc. */
export const REPLY_7 = { post: FIX_B.reply7, arc: 14 } as const;
/** Replies post with 3 f anticipation (a 4 u lift) and a 14 f arc (apex 60); the earlier ones jostle as each lands. */
export const B_ARC = 14;
const JOSTLE = { frames: 8, u: 2.4, rot: 0.05 } as const;
export const replyPostedB = (k: number): number => (k === 7 ? REPLY_7.post : FIX_B.replies[k]);
export const replyLandsB = (k: number): number => replyPostedB(k) + 3 + B_ARC;

/**
 * The trays work in place, in parallel (3.2–3.3): on eighths one tray or another riffles its dossier, the top sheet's
 * free edge lifting off the stack and falling back (8 f), each tray every fourth eighth; nothing is launched. The last
 * riffle is back down by RIFFLE.until, so every tray is in its rest pose before the turn.
 */
export const RIFFLE = { from: 1150, until: 1390, every: 4, frames: 8, lift: 0.95 } as const;
const RIFFLE_PHASE: readonly number[] = [0, 2, 1, 3, 1, 3, 0, 2];
export function riffleAt(k: number, f: number): number {
  const e = Math.floor((f - RIFFLE.from) / (BEAT / 2));
  let out = 0;
  // the riffle under way at f started on this eighth or the one before
  for (const j of [e, e - 1]) {
    if (j < 0 || (j - RIFFLE_PHASE[k]) % RIFFLE.every !== 0) continue;
    const t0 = RIFFLE.from + j * (BEAT / 2);
    if (t0 + RIFFLE.frames > RIFFLE.until) continue;
    out = Math.max(out, RIFFLE.lift * bump(f, t0, RIFFLE.frames));
  }
  return out;
}

/** The follow-up: posted from beyond the east edge (as the trays came), landing in tray 6. */
export function followUpAt(f: number): { p: P3; rot: number; tilt: number } | null {
  const t0 = FOLLOW_UP.lands - FOLLOW_UP.arc - 3;
  if (f < t0) return null;
  const tr = TRAYS[BREAK.to];
  const rest: P3 = [tr.c[0] + FOLLOW_UP.o[0], tr.c[1] + FOLLOW_UP.o[1], TRAY_Z.floor + 0.9];
  if (f >= FOLLOW_UP.lands) return { p: rest, rot: FOLLOW_UP.rot, tilt: 0 };
  if (f < t0 + 3) return { p: [FOLLOW_UP.from[0], FOLLOW_UP.from[1], FOLLOW_UP.from[2] + 4 * MOVE(span01(f, t0, t0 + 3))], rot: FOLLOW_UP.rot + 0.4, tilt: 0 };
  const u = clamp((f - t0 - 3) / FOLLOW_UP.arc);
  const e = MOVE(u);
  const l = lerp3([FOLLOW_UP.from[0], FOLLOW_UP.from[1], FOLLOW_UP.from[2] + 4], rest, e);
  return { p: [l[0], l[1], l[2] + 4 * 30 * u * (1 - u) * (1 - u)], rot: FOLLOW_UP.rot + 0.4 * (1 - e), tilt: 0.2 * Math.sin(u * Math.PI) };
}
/** The tear: 0 whole … 1 its east half twisted off and lying apart (spring-settle from TEAR.at). */
export const tearAt = (f: number): number => springAt(f, TEAR.at, SPRING.settle);

export interface FixBBeat3 {
  b: FixBTurn;
  /** each tray on its post (offset and squash) */
  posts: TrayPost[];
  /** each tray's dossier riffling (0 at rest) */
  riffle: number[];
  followUp: { p: P3; rot: number; tilt: number } | null;
  tear: number;
}

/** A reply's pose at f (k 0..7): in its tray, its 3 f anticipation, its arc, in your in-tray (nudged by each later landing). */
function replyAt(k: number, f: number): FixBTurn['slips'][number] {
  const pile = IN_TRAY_PILE[k];
  const rest = TRAY_STUFF[k].reply.rot;
  const leave = replyPostedB(k);
  const from = trayRestB(k);
  const to = inTraySlotA(k);
  if (f < leave) return { p: from, rot: rest, tilt: 0, paper: 0 };
  if (f < leave + 3) return { p: [from[0], from[1], from[2] + 4 * MOVE((f - leave) / 3)], rot: rest, tilt: 0, paper: 0 };
  const lands = leave + 3 + B_ARC;
  if (f < lands) {
    const u = (f - leave - 3) / B_ARC;
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    // the arc starts from the anticipation's height (never a dip back down)
    const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + 4 + (to[2] - from[2] - 4) * e + 4 * 60 * u * (1 - u)];
    return { p, rot: rest + (pile.rot - rest) * e, tilt: 0.25 * Math.sin(u * Math.PI), paper: 0 };
  }
  let jx = 0;
  let jy = 0;
  let jr = 0;
  for (let m = k + 1; m < 8; m++) {
    const b = bump(f, replyLandsB(m), JOSTLE.frames);
    if (b <= 0) continue;
    const d = [pile.o[0] - IN_TRAY_PILE[m].o[0], pile.o[1] - IN_TRAY_PILE[m].o[1]];
    const l = Math.hypot(d[0], d[1]) || 1;
    jx += (d[0] / l) * JOSTLE.u * b;
    jy += (d[1] / l) * JOSTLE.u * b;
    jr += JOSTLE.rot * b * (m % 2 ? 1 : -1);
  }
  return { p: jx || jy ? [to[0] + jx, to[1] + jy, to[2]] : to, rot: pile.rot + jr, tilt: 0, paper: 0 };
}

/** Fix B at film frame f of beat 3 (pure): the trays on their posts (none pressed, none walled up yet), the replies, the riffles, the follow-up and the tear. */
export function fixBAt(f: number): FixBBeat3 {
  const none = { slide: 0, grow: 0, built: 0, morph: 0, lid: 0, leaves: 0, fall: 0, hole: false, done: false };
  const b: FixBTurn = {
    slips: TRAYS.map((_, k) => replyAt(k, f)),
    retire: TRAYS.map((_, k) => (RETIRE_TRAYS.includes(k) ? { off: [0, 0, 0] as P3, gone: false } : null)),
    bays: BAY_TRAYS.map(({ id }) => ({ id, ...none })),
  };
  return { b, posts: TRAYS.map((_, k) => trayPostAt(k, f)), riffle: TRAYS.map((_, k) => riffleAt(k, f)), followUp: followUpAt(f), tear: tearAt(f) };
}

/** Fix B's footprints: each tray on its post (its contact once down), each reply in the air or in your in-tray, the follow-up in the air. */
export function fixBFootprints(B: FixBBeat3): Footprint[] {
  const fp: Footprint[] = TRAYS.map((tr, k): Footprint => {
    const o = B.posts[k].off;
    return { kind: 'rect', c: [tr.c[0] + o[0], tr.c[1] + o[1]], h: [tr.w / 2, tr.d / 2], r: 3, rot: 0, z0: o[2], z1: o[2] + TRAY_Z.rim, contact: o[2] < 0.5 ? 0.8 : 0 };
  });
  B.b.slips.forEach((s, k) => {
    const inTray = s.p[2] < TRAY_Z.floor + 4 && Math.hypot(s.p[0] - trayRestB(k)[0], s.p[1] - trayRestB(k)[1]) < 1;
    if (inTray) return;
    fp.push({ kind: 'rect', c: [s.p[0], s.p[1]], h: [B_SLIP.l / 2, B_SLIP.w / 2], r: 2, rot: s.rot, z0: s.p[2] - 0.4, z1: s.p[2] + 0.4, contact: s.p[2] < YOU.top + 12 ? 0.4 : 0 });
  });
  if (B.followUp && B.followUp.p[2] > TRAY_Z.floor + 2) fp.push({ kind: 'rect', c: [B.followUp.p[0], B.followUp.p[1]], h: [FOLLOW_UP.w / 2, FOLLOW_UP.d / 2], r: 2, rot: B.followUp.rot, z0: B.followUp.p[2] - 0.4, z1: B.followUp.p[2] + 0.4, contact: 0 });
  return fp;
}
