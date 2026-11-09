/**
 * Beat 3, "two easy fixes" (STORYBOARD 3.1–3.3): the two grey-stock counterfactuals either side of
 * your act-one desk, as they stand when the turn begins (f1400, MT2). Grey stock is the road not
 * taken; the turn (desk/turn.ts) builds each half into the Register's world: Fix A's tape winds
 * onto the notes loop and becomes the reel's tape, Fix B's trays grow walls and become bays.
 *
 * - **Fix A** (west of your lamp): one folder, every feeder pouring onto one long tape threaded
 *   through it. Slips queue nose to tail on the tape, three task cards interleave among them, and a
 *   grey-stock copy of the request (its 1.3× size and beetle cut-out: the road not taken, so never
 *   vermilion) waits behind a dozen. The tape's lead end runs under the notes loop's west side.
 * - **Fix B** (east of your lamp): eight trays, one per event, each with its event card; each has
 *   fired its reply slip at your in-tray, where they jostle (the eighth is in flight at f1400). A
 *   follow-up in tray 6 belongs to the task in tray 2: a break mark lies between the two.
 *
 * World units as layout.ts. Pure numbers; the poses over time are the turn's.
 */
import { clamp } from '@aiv/core';
import { Easing } from 'remotion';
import { FIX_A, FIX_B } from '../cues.ts';
import { FOLDERS, MOUTH, YOU_SHIFT_A, type FeederId } from './actOne.ts';
import { segFp, type Footprint } from './footprints.ts';
import { YOU, rectC, type BayId, type P2, type P3 } from './layout.ts';
// types only: turn.ts reads this module's constants as it loads, so a value import back would be a cycle
import type { FixATurn, FixBTurn } from './turn.ts';

// ------------------------------------------------------------------------------------------------
// Fix A: one folder, one long tape

/** The one session's folder: the tape passes under its cover (threaded through it) down its long axis. */
export const FIX_A_FOLDER = { c: [-560, 60] as P2, w: 100, d: 110, rot: 0, sheets: 14 } as const;
/** The tape: as wide as the notes loop's, grey stock with sprocket ticks. */
export const A_TAPE_W = 24;
/** Where the tape leaves the desk (its lead end runs on under the loop's west side): the start of its path. */
export const A_LIFT: P2 = [-490, 136];

/** The tape's path on the desk from the lift-off back to its tail (off the frame's west edge): straight runs and two bends. */
const A_PATH_SPEC = {
  bend: 30,
  /** west from the lift-off, then south down the folder's axis, then west along the bottom row */
  turn1: -530,
  column: -560,
  row: -165,
  tail: -1240,
} as const;

function samplePath(): P2[] {
  const { bend: r, turn1, column, row, tail } = A_PATH_SPEC;
  const pts: P2[] = [A_LIFT, [turn1, A_LIFT[1]]];
  // west, turning south: centre (turn1, lift.y - r), from 90° to 180°
  for (let i = 1; i <= 8; i++) {
    const a = Math.PI / 2 + ((Math.PI / 2) * i) / 8;
    pts.push([turn1 + r * Math.cos(a), A_LIFT[1] - r + r * Math.sin(a)]);
  }
  // south down the column to the second bend, centre (column - r, row + r), from 0° to -90°
  pts.push([column, row + r]);
  for (let i = 1; i <= 8; i++) {
    const a = -((Math.PI / 2) * i) / 8;
    pts.push([column - r + r * Math.cos(a), row + r + r * Math.sin(a)]);
  }
  pts.push([tail, row]);
  return pts;
}

/** The path, lift-off first, with each point's distance along it. */
export const A_PATH: readonly P2[] = samplePath();
const A_CUM: readonly number[] = (() => {
  const c = [0];
  for (let i = 1; i < A_PATH.length; i++) c.push(c[i - 1] + Math.hypot(A_PATH[i][0] - A_PATH[i - 1][0], A_PATH[i][1] - A_PATH[i - 1][1]));
  return c;
})();
export const A_LEN = A_CUM[A_CUM.length - 1];

/** The point at distance d from the lift-off along the path (clamped), and the unit direction toward the tail. */
export function aPathAt(d: number): { p: P2; dir: P2 } {
  const x = Math.min(Math.max(d, 0), A_LEN);
  let i = 1;
  while (i < A_CUM.length - 1 && A_CUM[i] < x) i++;
  const a = A_PATH[i - 1];
  const b = A_PATH[i];
  const l = A_CUM[i] - A_CUM[i - 1];
  const t = l > 0 ? (x - A_CUM[i - 1]) / l : 0;
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / (l || 1), (b[1] - a[1]) / (l || 1)] };
}

/** Distance along the path to the folder's south edge (where the queue begins) and its north edge. */
export const A_FOLDER_IN = A_CUM[1] + (Math.PI / 2) * A_PATH_SPEC.bend + (A_LIFT[1] - A_PATH_SPEC.bend - (FIX_A_FOLDER.c[1] - FIX_A_FOLDER.d / 2));

export type AItemKind = 'chat' | 'ci' | 'task' | 'request';
export interface AItem {
  kind: AItemKind;
  /** its length along the tape and its width across it */
  l: number;
  w: number;
  /** its centre's distance along the path at f1400 (from the lift-off) */
  d: number;
  /** which printed variant */
  v: number;
}
/** Item sizes: a notched chat slip, a CI card with a clipped corner, a task card (a pictogram), the request (1.3× a chat slip). */
export const A_SIZE: Record<AItemKind, P2> = { chat: [38, 22], ci: [36, 23], task: [44, 24], request: [50, 24] };
/** The gap between neighbours: nose to tail. */
export const A_GAP = 5;
/** The queue, nearest the folder first: a dozen ahead of the request (three of them task cards), a few more behind it. */
const A_ORDER: readonly AItemKind[] = ['chat', 'ci', 'chat', 'task', 'chat', 'chat', 'ci', 'task', 'chat', 'ci', 'chat', 'task', 'request', 'chat', 'ci', 'chat', 'chat'];
export const A_ITEMS: readonly AItem[] = (() => {
  const out: AItem[] = [];
  let d = A_FOLDER_IN + 4;
  A_ORDER.forEach((kind, i) => {
    const [l, w] = A_SIZE[kind];
    out.push({ kind, l, w, d: d + l / 2, v: i % 4 });
    d += l + A_GAP;
  });
  return out;
})();
/** One station: the queue advances this far on the beat at f1400 (the slip at the head goes in under the folder). */
export const A_PITCH = A_SIZE.chat[0] + A_GAP;

// ------------------------------------------------------------------------------------------------
// Fix B: eight trays, one per event, firing their replies at your in-tray

export interface Tray {
  /** 0..7, west to east, north row first */
  i: number;
  c: P2;
  w: number;
  d: number;
  /** the height its walls grow to, and where its door stands in the north wall (offset from the middle) */
  wall: number;
  door: number;
}
/**
 * Two rows of four east of your act-one desk (clear of the deck's south-east foot after the turn). One per event, so
 * no two alike: each its own size, wall height and door (instances of one role are never drawn identically).
 */
const TRAY_VARY: readonly { dw: number; dd: number; wall: number; door: number; dx: number; dy: number }[] = [
  { dw: -10, dd: 4, wall: 38, door: -14, dx: -4, dy: 2 },
  { dw: 6, dd: -6, wall: 44, door: 10, dx: 2, dy: -3 },
  { dw: -2, dd: 2, wall: 34, door: 0, dx: 0, dy: 3 },
  { dw: 10, dd: -2, wall: 40, door: -16, dx: 6, dy: 0 },
  { dw: 4, dd: -4, wall: 42, door: 12, dx: -2, dy: -2 },
  { dw: -8, dd: 6, wall: 36, door: -8, dx: 3, dy: 1 },
  { dw: 10, dd: -2, wall: 46, door: 16, dx: 4, dy: -4 },
  { dw: -4, dd: 4, wall: 38, door: -4, dx: -3, dy: 2 },
];
export const TRAYS: readonly Tray[] = [20, -100].flatMap((y, row) =>
  [100, 210, 320, 430].map((x, k) => {
    const v = TRAY_VARY[row * 4 + k];
    return { i: row * 4 + k, c: [x + v.dx, y + v.dy] as P2, w: 96 + v.dw, d: 74 + v.dd, wall: v.wall, door: v.door };
  }),
);
/** The tray's floor and rim (grey stock), and the walls they grow at the turn (the bay family's height). */
export const TRAY_Z = { floor: 1.6, rim: 7, wall: 40, wallT: 7, southWall: 16 } as const;
/** Each tray's event card (as the folders' task cards), lying in its west half. */
export const TRAY_CARD = { w: 40, d: 26, dx: -18, dy: 6 } as const;
/** A reply slip (grey stock, the reply chute's slip at ~0.7×). */
export const B_SLIP = { w: 30, l: 62 } as const;
/** The follow-up in tray 6 whose task is in tray 2: the break mark between them (two stubs that do not meet). */
export const BREAK = { from: 2, to: 6 } as const;
/**
 * At the turn eight event trays become three task bays: the three whose replies come home first wall up into
 * (b)'s bays (each nearest its bay's place south of the deck); the other five are pressed flat into the desk.
 */
export const BAY_TRAYS: readonly { k: number; id: BayId }[] = [
  { k: 4, id: 'tests' },
  { k: 5, id: 'docs' },
  { k: 6, id: 'bug' },
];
export const PRESS_TRAYS: readonly number[] = [0, 1, 2, 3, 7];

/** Your in-tray in act one (world): YOU.inTray at the act-one shift. */
export const IN_TRAY_A_C: P2 = [rectC(YOU.inTray)[0] + YOU_SHIFT_A[0], rectC(YOU.inTray)[1] + YOU_SHIFT_A[1]];
/** The replies jostling in your in-tray (desk coordinates, offsets from the in-tray's centre), oldest first: slip k came from tray k. */
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
// Imprints: every act-one folder, Fix A's and the five pressed trays, pressed into the desk at the turn (history at −2)

export const IMPRINTS: readonly { c: P2; w: number; d: number; rot: number }[] = [
  ...FOLDERS.map((fl) => ({ c: fl.c, w: fl.w, d: fl.d, rot: fl.rot })),
  { c: FIX_A_FOLDER.c, w: FIX_A_FOLDER.w, d: FIX_A_FOLDER.d, rot: FIX_A_FOLDER.rot },
  ...PRESS_TRAYS.map((k) => ({ c: TRAYS[k].c, w: TRAYS[k].w, d: TRAYS[k].d, rot: 0 })),
];

// ------------------------------------------------------------------------------------------------
// Beat 3 over time (f960–1399): Fix A rises and runs, Fix B rises and fires, both handed to the turn at f1400
// exactly as turn.ts fixATurnAt / fixBTurnAt pose them (beat3.test.ts holds the two equal there).

const MOVE = Easing.bezier(0.2, 0, 0, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));
const bump = (f: number, t0: number, n: number): number => (f <= t0 || f >= t0 + n ? 0 : Math.sin((Math.PI * (f - t0)) / n) ** 2);
const norm3 = (a: P3): P3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The tape's material ahead of its lead end before any of it winds (turn.ts A_SPAN0: the queue's places count from there). */
export const A_LEAD = 15;
/** Fix A slides up into the frame from the south on the move curve (the counterfactual rising into the scene), before C5 wipes in. */
export const A_RISE = { from: FIX_A.in, frames: 28, dy: 500 } as const;
/** Fix B's trays slide in from the east edge, the same way. */
export const B_RISE = { from: FIX_B.in, frames: 24, dx: 520 } as const;
export const aRiseAt = (f: number): number => A_RISE.dy * (1 - MOVE(span01(f, A_RISE.from, A_RISE.from + A_RISE.frames)));
export const bRiseAt = (f: number): number => B_RISE.dx * (1 - MOVE(span01(f, B_RISE.from, B_RISE.from + B_RISE.frames)));

/** Beat 3's own advances (the turn takes f1400's): one station on each beat, 10 f on the move curve, as turn.ts TURN.advance. */
export const A_STEPS: readonly number[] = FIX_A.steps.filter((s) => s < 1400);
export const A_STEP_FRAMES = 10;
/** The tape wound so far: negative before the turn (the queue lies further back by every station still to come). */
export function aWoundAt(f: number): number {
  let w = 0;
  for (const s of A_STEPS) w -= A_PITCH * (1 - MOVE(span01(f, s, s + A_STEP_FRAMES)));
  return w;
}

/**
 * The queue ahead of A_ITEMS: the slips, cards and task cards that go in under the folder during beat 3, one station
 * per beat, laid nose to tail in front of A_ITEMS[0] (a stream of messages: mostly chat, cards between, three task
 * cards). Two more FixA instances draw them (objects/Turn.tsx draws A_ITEMS' kinds by index), so each takes a slot of
 * its own kind there; the request's slot (12) is never used, so the grey request stays one.
 */
const EXTRA_KINDS: readonly AItemKind[] = ['chat', 'ci', 'chat', 'task', 'chat', 'chat', 'ci', 'chat', 'task', 'chat', 'ci', 'chat', 'chat', 'ci', 'task', 'chat', 'chat', 'ci', 'chat', 'chat', 'ci'];
export interface QueueItem {
  kind: AItemKind;
  l: number;
  w: number;
  /** its material place on the tape (from the lead end, as turn.ts counts it: A_ITEMS' d + A_LEAD) */
  u: number;
  /** which FixA instance draws it (0: the turn's own, A_ITEMS; 1, 2: the extras) and at which index */
  inst: 0 | 1 | 2;
  slot: number;
}
export const A_QUEUE: readonly QueueItem[] = (() => {
  const extras: QueueItem[] = [];
  let front = A_ITEMS[0].d + A_LEAD - A_ITEMS[0].l / 2 - A_GAP;
  const used: Record<1 | 2, Set<number>> = { 1: new Set(), 2: new Set() };
  const slotFor = (kind: AItemKind): { inst: 1 | 2; slot: number } => {
    for (const inst of [1, 2] as const)
      for (let i = 0; i < A_ITEMS.length; i++)
        if (A_ITEMS[i].kind === kind && !used[inst].has(i)) {
          used[inst].add(i);
          return { inst, slot: i };
        }
    throw new Error(`beat3: no free ${kind} slot for the queue`);
  };
  for (let j = EXTRA_KINDS.length - 1; j >= 0; j--) {
    const kind = EXTRA_KINDS[j];
    const [l, w] = A_SIZE[kind];
    extras.unshift({ kind, l, w, u: front - l / 2, ...slotFor(kind) });
    front -= l + A_GAP;
  }
  return [...extras, ...A_ITEMS.map((it, i) => ({ kind: it.kind, l: it.l, w: it.w, u: it.d + A_LEAD, inst: 0 as const, slot: i }))];
})();
/** The items that ride in with the tape as it rises (the head of the queue); every other one in frame is poured on. */
export const A_LOADED = 3;
/** The last item that is poured on: the grey request, landing at the frame's west edge (the four behind it ride in from beyond the edge as the queue advances). */
export const A_LAST_POUR = A_QUEUE.findIndex((q) => q.kind === 'request');
/** The feeder each kind pours from: chat and the request from the chat spout, cards from the hopper, task cards from the mail slot and the pad in turn. */
const pourFeeder = (q: QueueItem, task: number): FeederId => (q.kind === 'chat' || q.kind === 'request' ? 'chat' : q.kind === 'ci' ? 'ci' : task % 2 ? 'mail' : 'calendar');
/** The rhythm each pours on (frames): chat on eighths, cards and task cards on beats. */
const pourGrid = (q: QueueItem): number => (q.kind === 'chat' || q.kind === 'request' ? 10 : 20);
export interface Pour {
  q: number;
  from: FeederId;
  /** the frame it lands on the tape, and its arc */
  lands: number;
  arc: number;
}
/** Every pour, in landing order: from the first after Fix A has risen until the tail reaches the frame's west edge just before the turn. */
export const A_POURS: readonly Pour[] = (() => {
  const out: Pour[] = [];
  const first = A_RISE.from + A_RISE.frames + 22;
  // the last lands on the tape before the last beat-3 advance has finished (the queue then holds still for the turn)
  const last = 1370;
  let prev = -Infinity;
  let tasks = 0;
  for (let q = A_LOADED; q <= A_LAST_POUR; q++) {
    const it = A_QUEUE[q];
    const target = first + ((last - first) * (q - A_LOADED)) / (A_LAST_POUR - A_LOADED);
    const g = pourGrid(it);
    let lands = Math.ceil(target / g) * g;
    if (lands <= prev) lands = Math.ceil((prev + 1) / 10) * 10;
    lands = Math.min(lands, 1386);
    prev = lands;
    out.push({ q, from: pourFeeder(it, it.kind === 'task' ? tasks++ : tasks), lands, arc: 16 });
  }
  return out;
})();

/** An item lying on the tape at tape place p (from the lead end), as turn.ts poses it: up the lead span to the loop, or on the desk. */
function onTape(span: FixATurn['span'], p: number): { p: P3; x: P3; y: P3; paper: number } {
  if (p <= span.len) {
    const pos = lerp3(span.b, span.a, p / span.len);
    const w = norm3(lerp3(span.wb, span.wa, p / span.len));
    return { p: [pos[0], pos[1], pos[2] + 0.8], x: norm3([span.b[0] - span.a[0], span.b[1] - span.a[1], span.b[2] - span.a[2]]), y: w, paper: clamp((span.len - p) / 40) };
  }
  const { p: q, dir } = aPathAt(p - span.len);
  return { p: [q[0], q[1], 1.1], x: [-dir[0], -dir[1], 0], y: [dir[1], -dir[0], 0], paper: 0 };
}
/** Where an item has gone wholly in under Fix A's folder (its south end past the stack's south face): it is hidden there. */
const SWALLOWED = A_FOLDER_IN - 5;

/** A pour in the air: out of its feeder's mouth (3 f anticipation), then an arc onto the tape where its place is as it lands. */
function pourPose(span: FixATurn['span'], P: Pour, q: QueueItem, f: number): { p: P3; x: P3; y: P3; paper: number } | null {
  const t0 = P.lands - P.arc - 3;
  if (f < t0) return null;
  const M = MOUTH[P.from];
  if (f < t0 + 3) {
    const e = MOVE(span01(f, t0, t0 + 3));
    return { p: lerp3(M.in, M.out, e), x: [1, 0, 0], y: [0, 1, 0], paper: 0 };
  }
  const land = onTape(span, q.u - aWoundAt(P.lands));
  const u = (f - t0 - 3) / P.arc;
  const l = lerp3(M.out, land.p, u);
  const p: P3 = [l[0], l[1], l[2] + 4 * 60 * u * (1 - u)];
  // its heading turns from the feeder's (east) to the tape's; a chat slip flutters about its length on the way
  const ang = Math.atan2(land.x[1], land.x[0]) * u;
  const x: P3 = [Math.cos(ang), Math.sin(ang), 0];
  const tilt = q.kind === 'chat' || q.kind === 'request' ? 0.35 * Math.sin(u * Math.PI * 2) : 0.15 * Math.sin(u * Math.PI);
  const y: P3 = [-Math.sin(ang) * Math.cos(tilt), Math.cos(ang) * Math.cos(tilt), Math.sin(tilt)];
  return { p, x, y, paper: 0 };
}

export interface FixABeat3 {
  /** the turn's own FixA (A_ITEMS, the tape and the folder), as turn.ts poses it at f1400 */
  main: FixATurn;
  /** the two queue-only instances (no tape, no folder): the items that go in under the folder during beat 3 */
  extras: [FixATurn, FixATurn];
  /** how far south the whole of Fix A still is as it rises (u) */
  rise: number;
}

/**
 * Fix A at film frame f of beat 3 (f < 1400), from the turn's own state at f1400 (`atTurn`: turn.ts
 * fixATurnAt(1400, loopTurnAt(1400)), which the caller passes so this module never imports turn.ts' values): the same
 * lead span, the queue further back by every station still to come, the pours in the air.
 */
export function fixAAt(f: number, atTurn: FixATurn): FixABeat3 {
  const span = atTurn.span;
  const wound = aWoundAt(f);
  const pours = new Map(A_POURS.map((P) => [P.q, P]));
  const items: FixATurn['items'][] = [A_ITEMS.map(() => null), A_ITEMS.map(() => null), A_ITEMS.map(() => null)];
  A_QUEUE.forEach((q, i) => {
    const P = pours.get(i);
    let pose: FixATurn['items'][number];
    if (P && f < P.lands) pose = pourPose(span, P, q, f);
    else {
      const p = q.u - wound;
      // in under the folder (beat 3 only: by f1400 every extra has gone in and A_ITEMS[0] waits at the folder's mouth)
      if (q.inst !== 0 && p - span.len + q.l / 2 < SWALLOWED) pose = null;
      else if (p < q.l / 2) pose = null;
      else pose = onTape(span, p);
    }
    items[q.inst][q.slot] = pose;
  });
  const tail = A_LEN + A_LEAD - wound;
  const main: FixATurn = { ...atTurn, wound, deskLen: Math.max(0, tail - span.len), spanLen: clamp(tail, 0, span.len), items: items[0] };
  const none: FixATurn = { ...atTurn, wound, deskLen: 0, spanLen: 0, items: [] };
  return { main, extras: [{ ...none, items: items[1] }, { ...none, items: items[2] }], rise: aRiseAt(f) };
}

/**
 * Fix A's footprints in beat 3, cast as turn.ts turnFootprints casts them at f1400 (so no shadow changes at the cut):
 * the folder, the tape on the desk as 8 chords, the lead span, A_ITEMS 0–14 on the desk; and the items ahead of them
 * (beat 3's own) while they are in frame.
 */
export function fixAFootprints(A: FixABeat3, inFrame: (p: P3) => boolean): Footprint[] {
  const dy = -A.rise;
  const fp: Footprint[] = [];
  const F = FIX_A_FOLDER;
  fp.push({ kind: 'rect', c: [F.c[0], F.c[1] + dy], h: [F.w / 2, F.d / 2], r: 3, rot: F.rot, z0: 0, z1: 1.2 + F.sheets * 0.8, contact: 0.8 });
  const len = A.main.deskLen;
  if (len > 0)
    for (let i = 0; i < 8; i++) {
      const p = aPathAt((len * i) / 8).p;
      const q = aPathAt((len * (i + 1)) / 8).p;
      fp.push(segFp([p[0], p[1] + dy, 0.4], [q[0], q[1] + dy, 0.4], A_TAPE_W / 2 - 2));
    }
  fp.push(segFp([A.main.span.b[0], A.main.span.b[1] + dy, A.main.span.b[2]], [A.main.span.a[0], A.main.span.a[1] + dy, A.main.span.a[2]], A_TAPE_W / 2 - 2));
  [A.main, ...A.extras].forEach((inst, k) =>
    inst.items.forEach((it, i) => {
      if (!it || it.p[2] > 3 || (k === 0 && i > 14) || !inFrame([it.p[0], it.p[1] + dy, it.p[2]])) return;
      const [l, w] = [A_ITEMS[i].l, A_ITEMS[i].w];
      fp.push({ kind: 'rect', c: [it.p[0], it.p[1] + dy], h: [l / 2, w / 2], r: 2, rot: Math.atan2(it.x[1], it.x[0]), z0: it.p[2] - 0.4, z1: it.p[2] + 0.4, contact: 0.4 });
    }),
  );
  return fp;
}

// ---- Fix B

/** Where a reply rests in its tray (turn.ts TRAY_REST) and the in-tray's floor (turn.ts IN_TRAY_Z). */
const TRAY_REST_B: P3 = [16, -6, TRAY_Z.floor + 0.6];
const IN_TRAY_FLOOR = YOU.top + 3;
/** A reply in its tray before it fires (turn.ts poses reply 7 there, at this turn, until it is posted at f1394). */
const REST_ROT = 0.2;
/** Reply 7 is the turn's: posted at f1394, a 14 f arc (turn.ts TURN.bPost, TURN.bArc). */
export const REPLY_7 = { post: 1394, arc: 14 } as const;
/** Replies 0–6 post as the turn's do: 3 f anticipation, a 14 f arc (apex 60); the earlier ones jostle as each lands. */
export const B_ARC = 14;
const JOSTLE = { frames: 8, u: 2.4, rot: 0.05 } as const;
const trayRestB = (k: number, dx: number): P3 => [TRAYS[k].c[0] + TRAY_REST_B[0] + dx, TRAYS[k].c[1] + TRAY_REST_B[1], TRAY_REST_B[2]];
const inTraySlotA = (k: number): P3 => [IN_TRAY_A_C[0] + IN_TRAY_PILE[k].o[0], IN_TRAY_A_C[1] + IN_TRAY_PILE[k].o[1], IN_TRAY_FLOOR + 0.9 * k];
const landsB = (k: number): number => FIX_B.replies[k] + 3 + B_ARC;

/** The follow-up (FIX_B.followUp): an event of tray 2's task that lands in tray 6 instead, flown in from the east edge as the trays came. */
export const FOLLOW_UP = { lands: FIX_B.followUp, arc: 16, from: [640, -40, 70] as P3, rest: [-18, 6, TRAY_Z.floor + 0.9] as P3, rot: 0.04 } as const;
export function followUpAt(f: number): { p: P3; rot: number; tilt: number } | null {
  const t0 = FOLLOW_UP.lands - FOLLOW_UP.arc - 3;
  if (f < t0) return null;
  const tr = TRAYS[BREAK.to];
  const rest: P3 = [tr.c[0] + FOLLOW_UP.rest[0], tr.c[1] + FOLLOW_UP.rest[1], FOLLOW_UP.rest[2]];
  if (f >= FOLLOW_UP.lands) return { p: rest, rot: FOLLOW_UP.rot, tilt: 0 };
  const u = clamp((f - t0 - 3) / FOLLOW_UP.arc);
  const l = lerp3(FOLLOW_UP.from, rest, u);
  const p: P3 = [l[0], l[1], l[2] + 4 * 40 * u * (1 - u)];
  return { p, rot: FOLLOW_UP.rot + 0.4 * (1 - u), tilt: 0.2 * Math.sin(u * Math.PI) };
}

export interface FixBBeat3 {
  b: FixBTurn;
  /** how far east the trays still are as they slide in (u) */
  rise: number;
  followUp: { p: P3; rot: number; tilt: number } | null;
}

/**
 * Fix B at film frame f of beat 3 (f < 1400), from the turn's own state at f1400 (`atTurn`: turn.ts
 * fixBTurnAt(1400, shiftAt), passed in as for fixAAt). The trays and the replies in them are posed where they come to
 * rest: while they slide in (`rise`, before any reply leaves) the frame
 * draws the whole of Fix B that far east, and its footprints follow.
 */
export function fixBAt(f: number, atTurn: FixBTurn): FixBBeat3 {
  const dx = bRiseAt(f);
  const slips = IN_TRAY_PILE.map((pile, k): FixBTurn['slips'][number] => {
    if (k === 7) {
      // the turn's reply: in its tray until it is posted, then its 3 f anticipation (turn.ts fixBTurnAt)
      const u = clamp((f - REPLY_7.post - 3) / REPLY_7.arc);
      const from = trayRestB(7, 0);
      const to = inTraySlotA(7);
      const e = Math.sin((u * Math.PI) / 2) ** 2;
      const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e + 4 * 60 * u * (1 - u) + (f < REPLY_7.post + 3 ? 3 * clamp((f - REPLY_7.post) / 3) : 0)];
      return { p, rot: 0.2 + (pile.rot - 0.2) * e, tilt: 0.3 * Math.sin(u * Math.PI), paper: 0 };
    }
    const leave = FIX_B.replies[k];
    if (f < leave) return { p: trayRestB(k, 0), rot: REST_ROT, tilt: 0, paper: 0 };
    const from = trayRestB(k, 0);
    const to = inTraySlotA(k);
    if (f < leave + 3) return { p: [from[0], from[1], from[2] + 4 * MOVE((f - leave) / 3)], rot: REST_ROT, tilt: 0, paper: 0 };
    const lands = landsB(k);
    if (f < lands) {
      const u = (f - leave - 3) / B_ARC;
      const e = Math.sin((u * Math.PI) / 2) ** 2;
      const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + 4 + (to[2] - from[2] - 4) * e + 4 * 60 * u * (1 - u)];
      return { p, rot: REST_ROT + (pile.rot - REST_ROT) * e, tilt: 0.25 * Math.sin(u * Math.PI), paper: 0 };
    }
    // in your in-tray: nudged a little by each later reply landing on the pile
    let jx = 0;
    let jy = 0;
    let jr = 0;
    for (let m = k + 1; m < 7; m++) {
      const b = bump(f, landsB(m), JOSTLE.frames);
      if (b <= 0) continue;
      const d = [pile.o[0] - IN_TRAY_PILE[m].o[0], pile.o[1] - IN_TRAY_PILE[m].o[1]];
      const l = Math.hypot(d[0], d[1]) || 1;
      jx += (d[0] / l) * JOSTLE.u * b;
      jy += (d[1] / l) * JOSTLE.u * b;
      jr += JOSTLE.rot * b * (m % 2 ? 1 : -1);
    }
    return { p: jx || jy ? [to[0] + jx, to[1] + jy, to[2]] : to, rot: pile.rot + jr, tilt: 0, paper: 0 };
  });
  // the trays are as the turn finds them (none pressed, none walled up yet)
  return { b: { ...atTurn, slips }, rise: dx, followUp: followUpAt(f) };
}

/** Fix B's footprints in beat 3: the trays as they slide in, the replies (in their trays, in the air, in your in-tray), the follow-up. */
export function fixBFootprints(B: FixBBeat3): Footprint[] {
  // the trays the turn presses cast as its pressed bodies do (turn.ts pressedFp); the three it walls up, solid here
  const fp: Footprint[] = TRAYS.map((tr, k): Footprint => ({ kind: 'rect', c: [tr.c[0] + B.rise, tr.c[1]], h: [tr.w / 2, tr.d / 2], r: 3, rot: 0, z0: 0, z1: TRAY_Z.rim, contact: PRESS_TRAYS.includes(k) ? 0.8 : 1 }));
  for (const s of B.b.slips) fp.push({ kind: 'rect', c: [s.p[0] + B.rise, s.p[1]], h: [B_SLIP.l / 2, B_SLIP.w / 2], r: 2, rot: s.rot, z0: s.p[2] - 0.4, z1: s.p[2] + 0.4, contact: s.p[2] < YOU.top + 8 ? 0.4 : 0 });
  if (B.followUp) fp.push({ kind: 'rect', c: [B.followUp.p[0], B.followUp.p[1]], h: [TRAY_CARD.w / 2, TRAY_CARD.d / 2], r: 2, rot: B.followUp.rot, z0: B.followUp.p[2] - 0.4, z1: B.followUp.p[2] + 0.4, contact: B.followUp.p[2] < 4 ? 0.4 : 0 });
  return fp;
}
