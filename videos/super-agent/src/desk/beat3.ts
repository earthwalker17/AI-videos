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
import { FOLDERS, YOU_SHIFT_A } from './actOne.ts';
import { YOU, rectC, type P2 } from './layout.ts';

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
// Imprints: every act-one folder, and Fix A's, pressed into the desk at the turn (history at −2)

export const IMPRINTS: readonly { c: P2; w: number; d: number; rot: number }[] = [...FOLDERS.map((fl) => ({ c: fl.c, w: fl.w, d: fl.d, rot: fl.rot })), { c: FIX_A_FOLDER.c, w: FIX_A_FOLDER.w, d: FIX_A_FOLDER.d, rot: FIX_A_FOLDER.rot }];
