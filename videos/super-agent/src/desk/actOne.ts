/**
 * Act one, "the human router" (film frames before the turn's run-up, f1400; STORYBOARD beats 1–3):
 * the world before the Register exists. West, the feeders spill a heap of messages, the request
 * buried in it. Your desk stands further north and east than after the turn, ringed by the notes
 * loop (remember and switch), its lamp attending one folder at a time. North of it eight folders,
 * one per session, fan in a shallow arc, never round it: stack height is context, a pen at work is
 * working, a raised flag is waiting. No line runs from you to any folder.
 *
 * Everything here is a pure function of the film frame and the cue sheet's events (TREATMENT.md,
 * rule 6: an effect is a sum over the events that cause it). World units as layout.ts; the frames
 * from f1400 on (the turn, MT2) belong to the turn's schedule, which takes these poses over.
 *
 * - Beat 1 (the hook): the heap is already there at f0, older messages under the request; the
 *   feeders keep posting onto it on their rhythms (chat on eighths, cards on beats, mail on bars, a
 *   leaf every two bars), each piece out of its feeder's mouth and flown in, never from nowhere; the
 *   request turns vermilion on `request` (f20); from f100 newer pieces land on it, and by f150 it is
 *   half buried and creased, its east corner showing.
 * - Beat 2: three event slips fly in and a folder unfolds under each (5 → 8), its tab on the loop
 *   and its note on the tape arriving with it; the chores land as posts; the clip closes at `hub`.
 * - Beat 3 (desk/beat3.ts poses Fix A and Fix B): the focus steps down everything but the fix in play.
 *
 * Still A (lookdev/frames.ts, f915): C4 alone, the loop clipped shut since f880, the lamp settled on
 * F3, about four folders warm and four cold, flags up, one chat slip in mid-arc.
 */
import { clamp, easings, rand } from '@aiv/core';
import { Easing } from 'remotion';
import { ARRIVE, BEAT, BOTH_FIXES, FIX_A, FIX_B, LAMP_VISITS, WARMTH, cue } from '../cues.ts';
import { FOLDER_PRINT } from '../print.ts';
import { circleFp, rectFp, segFp, youFootprints, type Footprint } from './footprints.ts';
import { FEEDERS, FEEDER_H, LAMP, YOU, rectC, type P2, type P3, type Pool } from './layout.ts';
import { LIGHT_HEX, tint } from './pools.ts';
import { SPRING, STEP_FRAMES, springAt, type FocusId } from './state.ts';
import { CHORES, YOU_POSE_B, lampElbow, strutOnLid, type ChoreFlight, type YouPose } from './you.ts';

/** From here on the turn's schedule (MT2, f1400–1660) poses the world. */
export const ACT_ONE_END = 1400;

/** Your desk in act one: this far north and east of its place after the turn (it slides south-west at the turn). */
export const YOU_SHIFT_A: P2 = [392, 168];
/** The desk slab's centre in act one (world). */
export const YOU_C_A: P2 = [rectC(YOU.slab)[0] + YOU_SHIFT_A[0], rectC(YOU.slab)[1] + YOU_SHIFT_A[1]];

/** The synthesis's curves: move (.2, 0, 0, 1), enter (.05, .7, .1, 1), exit (.3, 0, .8, .15). */
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));
/** A one-off bump 0 → 1 → 0 over `n` frames from `t0` (a nudge, a squash): finite, so it is exactly 0 again afterwards. */
const bump = (f: number, t0: number, n: number): number => (f <= t0 || f >= t0 + n ? 0 : Math.sin((Math.PI * (f - t0)) / n) ** 2);

// ------------------------------------------------------------------------------------------------
// The eight folders: one per session, fanned in a shallow arc north of your desk

export type CardKind = 'chat' | 'ci';
export interface FolderLayout {
  /** F1..F8, west to east */
  n: number;
  /** centre (world) and turn (radians) */
  c: P2;
  rot: number;
  /** the cover's size (its sheets are inset) */
  w: number;
  d: number;
  /** context: sheets in the stack (SHEET u each) */
  sheets: number;
  /** the task card clipped to the stack: the message that started the session */
  card: CardKind;
  /** what the stack is made of: log sheets, punched cards or a chat thread's slips */
  contents: 'sheets' | 'cards' | 'slips';
  /** where the cover's tab stands along its north edge (0 west … 1 east) */
  tab: number;
}

/**
 * The arc: its middle bows north over the desk and its ends come down either side, so it fans
 * round the north of the loop without closing round you. Each folder turns a little with the arc;
 * sizes, stacks, tabs and contents differ by task. F8 stands clear of F7's lifted pen (still (a)'s
 * critic: they collided).
 */
export const FOLDERS: readonly FolderLayout[] = [
  { n: 1, c: [-598, 236], rot: 0.21, w: 116, d: 148, sheets: 20, card: 'chat', contents: 'slips', tab: 0.24 },
  { n: 2, c: [-448, 328], rot: 0.12, w: 112, d: 142, sheets: 9, card: 'ci', contents: 'cards', tab: 0.62 },
  { n: 3, c: [-320, 370], rot: 0.05, w: 128, d: 158, sheets: 15, card: 'ci', contents: 'sheets', tab: 0.4 },
  { n: 4, c: [-180, 390], rot: -0.03, w: 118, d: 150, sheets: 25, card: 'chat', contents: 'sheets', tab: 0.72 },
  { n: 5, c: [-40, 394], rot: -0.07, w: 122, d: 150, sheets: 12, card: 'ci', contents: 'cards', tab: 0.3 },
  { n: 6, c: [98, 388], rot: -0.11, w: 108, d: 140, sheets: 5, card: 'chat', contents: 'sheets', tab: 0.55 },
  { n: 7, c: [226, 330], rot: -0.21, w: 120, d: 150, sheets: 17, card: 'chat', contents: 'slips', tab: 0.2 },
  { n: 8, c: [384, 212], rot: -0.4, w: 114, d: 146, sheets: 13, card: 'ci', contents: 'sheets', tab: 0.66 },
];
/** The cover board under the stack, and the sheets' inset from its edge. */
export const COVER_Z = 1.2;
export const SHEET_INSET = 5;
/** A sheet's thickness in act one's stacks (exaggerated: at 15° a stack's height shows only as its south edge band, so 25 sheets against 5 must differ by 8 px or more). */
export const SHEET = 1.4;
export const stackTop = (fl: FolderLayout): number => COVER_Z + fl.sheets * SHEET;

/** A folder-local point (x east, y north of its centre, before its turn) in world coordinates. */
export function folderPoint(fl: FolderLayout, p: P2): P2 {
  const c = Math.cos(fl.rot);
  const s = Math.sin(fl.rot);
  return [fl.c[0] + c * p[0] - s * p[1], fl.c[1] + s * p[0] + c * p[1]];
}

/** The pen arm's pivot (folder-local, on the cover's east margin) and where its nib writes: the end of the newest line. */
export const penPivot = (fl: FolderLayout): P2 => [fl.w / 2 - 2, -fl.d * 0.36];
/**
 * The top sheet's print (folder-local): three lines of 16 u mono (advance 0.6 em) starting `x` in from
 * the sheet's west edge, the first baseline `first` of the sheet's depth down, then every `pitch`.
 */
export const SHEET_PRINT = { em: 16, adv: 9.6, x: 8, first: 0.5, pitch: 21 } as const;
/** The newest line's baseline (folder-local y): the same on every sheet. */
export const NEWEST_Y = -2 * SHEET_PRINT.pitch;
export const penNib = (fl: FolderLayout, stroke: number): P2 => [-fl.w / 2 + SHEET_INSET + SHEET_PRINT.x + SHEET_PRINT.adv * FOLDER_PRINT[fl.n - 1].lines[2].length + 3 + 4 * stroke, NEWEST_Y + 3];
/** Where each folder's task card is clipped: its north-east corner for these, north-west for the rest (no two neighbours alike in every way). */
export const cardEast = (fl: FolderLayout): boolean => [2, 3, 5, 8].includes(fl.n);
/** The flag's hinge (folder-local): the north corner the task card leaves free. */
export const flagHinge = (fl: FolderLayout): P2 => [(cardEast(fl) ? -1 : 1) * (fl.w / 2 - 6), fl.d / 2 - 6];
export const PEN = { post: 12, lift: 30, swing: 0.55 } as const;
export const FLAG = { staff: 36, lean: 0.32, plate: [34, 21] as const } as const;

/** Task card sizes (folder-local, u): a notched chat slip, a punched CI card with a clipped corner. */
export const CARD: Readonly<Record<CardKind, P2>> = { chat: [66, 28], ci: [58, 36] };
/** The sheet's size (the cover less its inset). */
export const sheetSize = (fl: FolderLayout): P2 => [fl.w - 2 * SHEET_INSET, fl.d - 2 * SHEET_INSET];
/** The task card's centre (folder-local) and its small turn on the stack. */
export function cardLocal(fl: FolderLayout): { c: P2; turn: number } {
  const [sw, sd] = sheetSize(fl);
  const [cw, cd] = CARD[fl.card];
  const east = cardEast(fl);
  return { c: [east ? sw / 2 - cw / 2 - 4 : -sw / 2 + cw / 2 + 4, sd / 2 - cd / 2 - 6], turn: (rand(0xc4d, fl.n, 0) * 2 - 1) * 0.06 };
}

// ------------------------------------------------------------------------------------------------
// The notes loop: a paper tape round your desk, one tab per folder, closed by an enamel clip at f880

export interface LoopPose {
  c: P2;
  /** semi-axes and squareness (a superellipse, exponent n) */
  a: number;
  b: number;
  n: number;
  /** height of the tape's underside; the tape is flat (it lies on the slate) */
  z: number;
  /** the tape's width */
  w: number;
  /** where the two ends overlap under the clip (parameter angle, radians) */
  clipAt: number;
  /** 0 open (the ends apart), 1 clipped shut */
  closed: number;
}
export const LOOP_A: LoopPose = { c: YOU_C_A, a: 262, b: 186, n: 2.8, z: 1.4, w: 24, clipAt: (205 * Math.PI) / 180, closed: 1 };
/** Before it tightens (f680) the loop lies slack, this much wider. */
export const LOOP_SLACK = 26;
export const TAB = { w: 26, l: 30 } as const;

/** A point of the loop at parameter angle t (world, on the desk plane). */
export function loopPoint(L: LoopPose, t: number): P2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const e = 2 / L.n;
  return [L.c[0] + L.a * Math.sign(c) * Math.abs(c) ** e, L.c[1] + L.b * Math.sign(s) * Math.abs(s) ** e];
}
/** The loop's outward unit normal at t. */
export function loopNormal(L: LoopPose, t: number): P2 {
  const h = 1e-3;
  const p0 = loopPoint(L, t - h);
  const p1 = loopPoint(L, t + h);
  const tx = p1[0] - p0[0];
  const ty = p1[1] - p0[1];
  const l = Math.hypot(tx, ty);
  return [ty / l, -tx / l];
}

/**
 * The tabs stand evenly along the loop's north run, west to east as their folders (each still turned
 * toward its own folder, so a tab and its folder always pair up), from this arc length round from the
 * clip (F1, north-west) down to this one (F8, north-east: the tape south of it stays bare where your label's leader
 * crosses it). The points facing each folder crowd F5–F8 into 50 u of tape at the loop's north-east corner, too tight
 * for a note beside each tab.
 */
export const TAB_ARC = { first: 1330, last: 760 } as const;
/** The loop's arc length from the clip (counter-clockwise, as the tape runs) at parameter angle t, by integration on the pose. */
function arcTo(L: LoopPose, t: number): number {
  const N = 720;
  let acc = 0;
  let prev = loopPoint(L, L.clipAt);
  for (let i = 1; i <= N; i++) {
    const ti = L.clipAt + ((t - L.clipAt) * i) / N;
    const p = loopPoint(L, ti);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return acc;
}
/** The parameter angle at arc length s from the clip (bisection on the pose's arc). */
function paramAtArc(L: LoopPose, s: number): number {
  let lo = L.clipAt;
  let hi = L.clipAt + Math.PI * 2;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (arcTo(L, mid) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Each folder's share of the loop's length at its tab (the slack loop is the tight one scaled, so a share holds for both). */
export const TAB_SHARE: readonly number[] = (() => {
  const len = arcTo(LOOP_A, LOOP_A.clipAt + Math.PI * 2);
  return FOLDERS.map((_, i) => (TAB_ARC.first + ((TAB_ARC.last - TAB_ARC.first) * i) / (FOLDERS.length - 1)) / len);
})();
const TAB_T: readonly number[] = TAB_SHARE.map((k) => paramAtArc(LOOP_A, k * arcTo(LOOP_A, LOOP_A.clipAt + Math.PI * 2)));
/** The parameter angle where each folder's tab sits on the loop (the same angle on the slack and the tight loop). */
export const tabAt = (L: LoopPose, fl: FolderLayout): number => {
  void L;
  return TAB_T[fl.n - 1];
};

// ------------------------------------------------------------------------------------------------
// Mail and calendar in act one: generic graphite feeders (they turn to vellum drawings at the turn,
// STORYBOARD 4.2, because the prototype's sources are chat and GitHub)

const MAIL_C = rectC(FEEDERS.mail);
/** The letter box (its slot on top, its mouth east with an envelope in it) and the tear-off pad (a binding north, a torn leaf east). */
export const GENERIC_FEEDERS = {
  mailBox: { x0: FEEDERS.mail.x0, x1: FEEDERS.mail.x1 - 22, y0: FEEDERS.mail.y0, y1: FEEDERS.mail.y1 },
  mailH: 30,
  envelope: { c: [FEEDERS.mail.x1 + 18, MAIL_C[1] - 3] as P2, w: 72, d: 46, rot: -0.08, z: 10 },
  pad: FEEDERS.calendar,
  padH: 18,
  /** the torn leaf beside the pad, kept north of the hook's notes band */
  leaf: { c: [FEEDERS.calendar.x1 + 40, rectC(FEEDERS.calendar)[1] - 2] as P2, w: 80, d: 54, rot: 0.32 },
} as const;

// ------------------------------------------------------------------------------------------------
// The heap: messages spilled east of the feeders, the request in it; the feeders keep posting onto it

export type PieceKind = 'chat' | 'ci' | 'mail' | 'leaf';
/** A chat slip, a punched CI card, an envelope and a calendar leaf, as from their feeders (u). */
export const PIECE: Readonly<Record<PieceKind, P2>> = { chat: [96, 40], ci: [84, 50], mail: [72, 46], leaf: [84, 50] };
export type FeederId = 'chat' | 'ci' | 'mail' | 'calendar';
/** Which feeder a kind of message comes out of. */
export const FEEDER_OF: Readonly<Record<PieceKind, FeederId>> = { chat: 'chat', ci: 'ci', mail: 'mail', leaf: 'calendar' };

const CHAT_C = rectC(FEEDERS.chat);
const CHAT_R = (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2;
const CI_C = rectC(FEEDERS.ci);
/** The chat spout's mouth (where a posted slip leaves it). */
export const SPOUT: P3 = [CHAT_C[0] + CHAT_R + 40, CHAT_C[1] - 4, 16];
/**
 * Where a posted piece starts inside each feeder (hidden by it: the spout, the hopper's top card, the
 * letter box's hood, the pad's own top leaf) and where its 3 f anticipation pushes it to, out of the mouth.
 */
export const MOUTH: Readonly<Record<FeederId, { in: P3; out: P3 }>> = {
  chat: { in: [CHAT_C[0] + CHAT_R + 8, CHAT_C[1] - 4, 8], out: SPOUT },
  ci: { in: [FEEDERS.ci.x1 - 26, CI_C[1], 28], out: [FEEDERS.ci.x1 + 16, CI_C[1] - 2, 18] },
  mail: { in: [FEEDERS.mail.x1 - 30, MAIL_C[1] - 3, 13], out: [FEEDERS.mail.x1 + 6, MAIL_C[1] - 3, 15] },
  calendar: { in: [rectC(FEEDERS.calendar)[0], rectC(FEEDERS.calendar)[1] - 6, 18.9], out: [rectC(FEEDERS.calendar)[0] + 10, rectC(FEEDERS.calendar)[1] - 8, 30] },
};
/** How each kind travels (TREATMENT element sheet): chat flutters, a card clacks down on a short low arc, mail glides, a leaf flips over. */
export const FLIGHT_OF: Readonly<Record<PieceKind, { arc: number; apex: number }>> = {
  chat: { arc: 14, apex: 50 },
  ci: { arc: 12, apex: 30 },
  mail: { arc: 20, apex: 20 },
  leaf: { arc: 16, apex: 44 },
};

export interface HeapPiece {
  kind: PieceKind;
  c: P2;
  rot: number;
  /** its underside's height (it lies on the pieces under it) */
  z: number;
  /** which printed variant */
  v: number;
  /** a darker or lighter stock (0..1) */
  tone: number;
  /** the film frame it lands (−Infinity: it was there before the film began) */
  lands: number;
  /** its arc's length and apex when it is posted (FLIGHT_OF's by default) */
  arc: number;
  apex: number;
}
/** The request: 1.3× a chat slip (layout.ts REQUEST), creased, its south-east corner showing. */
export const REQUEST_A = { c: [-762, 150] as P2, rot: 0.38, l: 114, w: 52, crease: 38, lift: 0.22 } as const;
/** The request turns vermilion on its cue (f20), over spring-effects: the request motif. */
export const REQUEST_INK = cue('request').frame;
/** The pieces that land on the request's west half (f100–150), creasing it: its east flap lifts a quarter of the way with each. */
const COVER_FRAMES = [100, 110, 130, 150] as const;

const HEAP_SEED = 0x5a01;
/** The heap's spine: from the feeders' mouths, spilling south-east toward you (its newest pieces against the loop's west flank, clear of Fix A's folder and of your act-two desk). */
const HEAP_SPINE: readonly P2[] = [
  [-842, 380],
  [-812, 290],
  [-778, 206],
  [-738, 124],
  [-690, 52],
];
const spineAt = (s: number): { p: P2; n: P2 } => {
  const k = Math.min(Math.floor(s * (HEAP_SPINE.length - 1)), HEAP_SPINE.length - 2);
  const t = s * (HEAP_SPINE.length - 1) - k;
  const a = HEAP_SPINE[k];
  const b = HEAP_SPINE[k + 1];
  const d: P2 = [b[0] - a[0], b[1] - a[1]];
  const l = Math.hypot(d[0], d[1]);
  return { p: [a[0] + d[0] * t, a[1] + d[1] * t], n: [d[1] / l, -d[0] / l] };
};

/** The pieces posted in the film, in landing order: [frame, kind, centre, turn] (chat on eighths, cards on beats, mail on bars, a leaf on bar 2's last beat). */
const POSTED: readonly (readonly [number, PieceKind, P2, number])[] = [
  // in flight at frame 0 (posted at f-7): the hook opens on a working intake
  [10, 'chat', [-806, 262], -0.3],
  [40, 'ci', [-842, 316], 0.5],
  [60, 'chat', [-748, 236], 0.22],
  [80, 'mail', [-796, 76], -0.15],
  // f100–150: four land across the request's west half; its east corner stays clear
  [COVER_FRAMES[0], 'ci', [REQUEST_A.c[0] - 24, REQUEST_A.c[1] - 12], -0.2],
  [COVER_FRAMES[1], 'chat', [REQUEST_A.c[0] - 30, REQUEST_A.c[1] + 22], 0.95],
  [COVER_FRAMES[2], 'chat', [REQUEST_A.c[0] - 14, REQUEST_A.c[1] + 44], 0.18],
  [COVER_FRAMES[3], 'leaf', [REQUEST_A.c[0] - 58, REQUEST_A.c[1] - 22], -0.55],
  // under the title's camera move, north of the card
  [240, 'chat', [-724, 268], -0.42],
  // beat 2 (the intake stepped down): a card, then still (a)'s chat slip in mid-arc
  [640, 'ci', [-690, 214], 0.34],
];
/** Still (a)'s chat slip, posted on a sixteenth (3 f anticipation, a 12 f arc) at the heap's newest end, over open slate so its mid-arc shadow lies apart from it. */
export const FLIGHT = { from: SPOUT, to: [-664, 120, 3] as P3, posted: 905, apex: 44 } as const;

/**
 * The heap, in landing order: the pieces there before the film (oldest first, nearest the feeders),
 * the request on them, then every posted piece as it lands. Each lies on whatever landed before it
 * under its outline, so the pile is a pure function of the list.
 */
const HEAP_BUILT: { heap: readonly HeapPiece[]; reqZ: number } = (() => {
  type Raw = Omit<HeapPiece, 'z'> & { request?: boolean };
  const old: Raw[] = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const s = 0.04 + 0.58 * rand(HEAP_SEED, i, 0);
    const { p, n } = spineAt(s);
    const spread = 30 + 40 * s;
    const lat = (rand(HEAP_SEED, i, 1) * 2 - 1) * spread;
    // older mail and leaves lie toward the heap's south end, by their feeders
    const kind: PieceKind = i === 3 ? 'mail' : i === 7 ? 'leaf' : rand(HEAP_SEED, i, 2) < 0.58 ? 'chat' : 'ci';
    const c: P2 = kind === 'mail' ? [-818, 104] : kind === 'leaf' ? [-836, 30] : [p[0] + n[0] * lat, p[1] + n[1] * lat];
    old.push({ kind, c, rot: (rand(HEAP_SEED, i, 3) * 2 - 1) * 0.75 + (kind === 'ci' ? 0.25 : -0.1), v: Math.floor(rand(HEAP_SEED, i, 4) * 6), tone: rand(HEAP_SEED, i, 5), lands: -Infinity, ...FLIGHT_OF[kind] });
  }
  const R = REQUEST_A;
  // the old pieces keep off the request's place, so it lies on top of them, whole, at f0
  const flap: P2 = [R.c[0] + Math.cos(R.rot) * (R.l / 2 - R.crease / 2), R.c[1] + Math.sin(R.rot) * (R.l / 2 - R.crease / 2)];
  const clear = (p: Raw): Raw => {
    const d: P2 = [p.c[0] - flap[0], p.c[1] - flap[1]];
    const l = Math.hypot(d[0], d[1]);
    return l >= 84 ? p : { ...p, c: [flap[0] + (d[0] / (l || 1)) * 84, flap[1] + (d[1] / (l || 1)) * 84] };
  };
  const posted: Raw[] = POSTED.map(([lands, kind, c, rot], i) => ({ kind, c, rot, v: (i * 5 + 1) % 6, tone: rand(HEAP_SEED, 40 + i, 5), lands, ...FLIGHT_OF[kind] }));
  posted.push({ kind: 'chat', c: [FLIGHT.to[0], FLIGHT.to[1]], rot: -0.5, v: 3, tone: 0.7, lands: FLIGHT.posted + 15, arc: 12, apex: FLIGHT.apex });
  const radius = (k: PieceKind) => Math.hypot(...PIECE[k]) / 2;
  const out: HeapPiece[] = [];
  let reqZ = 0.4;
  for (const p of old.map(clear)) {
    let z = 0.4;
    for (const q of out) if (Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) < 0.8 * (radius(p.kind) + radius(q.kind))) z = Math.max(z, q.z + 1.5);
    out.push({ ...p, z });
  }
  for (const q of out) if (Math.hypot(R.c[0] - q.c[0], R.c[1] - q.c[1]) < 0.8 * (R.l / 2 + radius(q.kind))) reqZ = Math.max(reqZ, q.z + 1.5);
  for (const p of posted) {
    let z = 0.4;
    for (const q of out) if (Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) < 0.8 * (radius(p.kind) + radius(q.kind))) z = Math.max(z, q.z + 1.5);
    if (Math.hypot(p.c[0] - R.c[0], p.c[1] - R.c[1]) < 0.8 * (radius(p.kind) + R.l / 2)) z = Math.max(z, reqZ + 1.8);
    out.push({ ...p, z });
  }
  return { heap: out, reqZ };
})();
export const HEAP: readonly HeapPiece[] = HEAP_BUILT.heap;
/** The request's underside: on the old pieces under it. */
export const requestZ = (): number => HEAP_BUILT.reqZ;

/** A posted piece in the air: its centre, heading, the tilt of its flutter or bank, its flip (a leaf turning over), how far along. */
export interface PostPose {
  /** index into HEAP */
  i: number;
  p: P3;
  rot: number;
  tilt: number;
  flip: number;
  u: number;
}
/** When a piece leaves its feeder: 3 f of anticipation (pushed out of the mouth) before its arc. */
export const postedAt = (h: HeapPiece): number => h.lands - h.arc - 3;
/** A posted piece's pose at f while it is out of its feeder and not yet on the heap (null otherwise). */
export function postPose(h: HeapPiece, i: number, f: number): PostPose | null {
  const t0 = postedAt(h);
  if (!(f >= t0 && f < h.lands)) return null;
  const M = MOUTH[FEEDER_OF[h.kind]];
  const from = M.out;
  if (f < t0 + 3) {
    const e = MOVE(span01(f, t0, t0 + 3));
    return { i, p: [M.in[0] + (from[0] - M.in[0]) * e, M.in[1] + (from[1] - M.in[1]) * e, M.in[2] + (from[2] - M.in[2]) * e], rot: 0, tilt: 0, flip: 0, u: 0 };
  }
  const u = (f - t0 - 3) / h.arc;
  // mail glides (eased out, a long flat arc), the rest travel at an even pace along a parabola
  const e = h.kind === 'mail' ? MOVE(u) : u;
  const to: P3 = [h.c[0], h.c[1], h.z];
  const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e + 4 * h.apex * u * (1 - u)];
  const rot = h.rot * e;
  const tilt = h.kind === 'chat' ? 0.35 * Math.sin(u * Math.PI * 2) : h.kind === 'mail' ? 0.16 * Math.sin(u * Math.PI) : h.kind === 'ci' ? -0.12 * Math.sin(u * Math.PI) : 0;
  const flip = h.kind === 'leaf' ? Math.PI * 2 * MOVE(u) : 0;
  return { i, p, rot, tilt, flip, u };
}

// ------------------------------------------------------------------------------------------------
// The schedule (film frames)

/** The lamp's visits, the warmth constants and the arrivals live in the cue sheet (src/cues.ts), which the score reads too. */
export { ARRIVE, LAMP_VISITS };
export const WARM_TAU = WARMTH.tau;
/** A pen works while its folder is warmer than this; under FLAG_UP its flag stands up. */
export const PEN_ON = WARMTH.penOn;
export const FLAG_UP = WARMTH.flagUp;
/** The film opens mid-swing: the lamp left this folder this many frames before frame 0. */
export const PRE_SWING = { from: 5, frames: 8 } as const;
/** The lamp's bulb while it attends (HDR: above 1.0 it blooms) and how far it stands out of the hood. */
export const BULB_A = { level: 3, out: 46 } as const;
/**
 * The lamp head inside the loop: on the line from the loop's centre to the folder it attends, this far out (so only
 * its light crosses the tape), at this height. Its elbow bends up and west-north-west, over the lamp's own base: seen from
 * the camera the arm is a Λ standing clear of the laptop's screen (still (a)'s critic: it lay across it), its apex short
 * of the loop's tape.
 */
export const HEAD_A = { k: 0.25, z: 116, pole: [-0.6, 0.1, 0.79] as P3 } as const;

// ---- the event slips that spawn F6–F8 (beat 2, 5 → 8)

/** An event slip lands on the desk where its folder's task card will lie, 2 f before the folder unfolds under it (ARRIVE, on a beat). */
export const EVENT_LEAD = 2;
/** Its flight from the feeder: 3 f anticipation, a long arc over the heap and the arc of folders. */
export const EVENT_ARC = { arc: 28, apex: 110 } as const;
/** The folder unfolds out from under its card on spring-heavy: from the card's own outline to the whole cover and stack. */
export const UNFOLD_FRAMES = 16;
/** The task card's world pose on a folder (its centre and turn). */
export function cardWorld(fl: FolderLayout): { c: P2; rot: number } {
  const k = cardLocal(fl);
  return { c: folderPoint(fl, k.c), rot: fl.rot + k.turn };
}
export interface EventSlip {
  n: number;
  p: P3;
  rot: number;
  tilt: number;
}
/** The event slip for folder n while it flies in (null before it is posted and once its folder has taken it up as its card). */
export function eventSlipAt(n: number, f: number): EventSlip | null {
  const arrive = ARRIVE[n];
  if (arrive === undefined) return null;
  const fl = FOLDERS[n - 1];
  const lands = arrive - EVENT_LEAD;
  const t0 = lands - EVENT_ARC.arc - 3;
  if (f < t0 || f >= arrive) return null;
  const M = MOUTH[fl.card === 'chat' ? 'chat' : 'ci'];
  const to = cardWorld(fl);
  if (f < t0 + 3) {
    const e = MOVE(span01(f, t0, t0 + 3));
    return { n, p: [M.in[0] + (M.out[0] - M.in[0]) * e, M.in[1] + (M.out[1] - M.in[1]) * e, M.in[2] + (M.out[2] - M.in[2]) * e], rot: 0, tilt: 0 };
  }
  const u = clamp((f - t0 - 3) / EVENT_ARC.arc);
  const z1 = 0.4;
  const p: P3 = [M.out[0] + (to.c[0] - M.out[0]) * u, M.out[1] + (to.c[1] - M.out[1]) * u, M.out[2] + (z1 - M.out[2]) * u + 4 * EVENT_ARC.apex * u * (1 - u)];
  return { n, p, rot: to.rot * u, tilt: fl.card === 'chat' ? 0.3 * Math.sin(u * Math.PI * 2) : -0.1 * Math.sin(u * Math.PI) };
}

// ---- the chores: posts onto your desk (STORYBOARD 2.2)

/**
 * Each chore is thrown in over the folders from beyond the frame's top edge (desk coordinates, high), lands on its
 * cue (the score's hit is the landing) and rests: 3 f anticipation, a 12 f arc, a 3% squash, the tray nudging 2 f later.
 */
export const CHORE_POSTS = {
  key: { lands: cue('chore-prompt').frame, from: [CHORES.key.c[0] + 60, 330, 300] as P3, apex: 60 },
  glass: { lands: cue('chore-wait').frame, from: [CHORES.glass.c[0] - 20, 340, 300] as P3, apex: 60 },
  // the strut's arc rides higher: it comes down onto the lid past your lamp's hood
  strut: { lands: cue('chore-keep').frame, from: [-520, 330, 300] as P3, apex: 130 },
} as const;
export const CHORE_ARC = { arc: 12, squash: 0.03, squashFrames: 6, nudgeAfter: 2, nudgeFrames: 6, nudge: 1.6 } as const;
/** Where each chore rests (desk coordinates): the tray's recesses, the strut on the lid. */
const choreRest = (id: keyof typeof CHORE_POSTS): P3 => {
  if (id === 'strut') {
    const s = strutOnLid();
    return s.a;
  }
  return [CHORES[id].c[0], CHORES[id].c[1], 0];
};
/** A chore's flight at f (null once it has landed or before it is thrown), as an offset from its rest. */
export function choreFlightAt(id: keyof typeof CHORE_POSTS, f: number): ChoreFlight | null {
  const P = CHORE_POSTS[id];
  const t0 = P.lands - CHORE_ARC.arc - 3;
  if (f < t0) return null;
  if (f >= P.lands) {
    const sq = CHORE_ARC.squash * bump(f, P.lands, CHORE_ARC.squashFrames);
    return sq > 0 ? { off: [0, 0, 0], yaw: 0, tilt: 0, squash: sq } : null;
  }
  const rest = choreRest(id);
  const from: P3 = [P.from[0] - rest[0], P.from[1] - rest[1], P.from[2] - rest[2]];
  // the anticipation: a 4 u lift at the throw (off the top edge); then the arc
  if (f < t0 + 3) return { off: [from[0], from[1], from[2] + 4 * MOVE(span01(f, t0, t0 + 3))], yaw: 0.7, tilt: 0, squash: 0 };
  const u = (f - t0 - 3) / CHORE_ARC.arc;
  const k = 1 - u;
  return { off: [from[0] * k, from[1] * k, (from[2] + 4) * k + 4 * P.apex * u * (1 - u)], yaw: 0.7 * k, tilt: 0.45 * Math.sin(u * Math.PI), squash: 0 };
}
/** The chore tray's nudge (u, south) 2 f after each chore lands in it. */
export const trayNudgeAt = (f: number): number => CHORE_ARC.nudge * (['key', 'glass'] as const).reduce((s, id) => s + bump(f, CHORE_POSTS[id].lands + CHORE_ARC.nudgeAfter, CHORE_ARC.nudgeFrames), 0);

// ---- focus

/**
 * The focus ramps of act one (STEP_FRAMES each way). The kit steps three sets on their own amounts:
 * - `stepped` (the beat's amount): the intake and its heap, from beat 2 (the folders and you are the action; the
 *   strangers asked why the props on the left were there) until both fixes stand at full contrast;
 * - `own`: everything but Fix A in 3.1 and 3.2 (your desk, the folders, the loop); the heap goes with the intake;
 * - `late`: Fix A itself in 3.2, when the focus moves to Fix B.
 * Everything is back at full contrast before the turn (f1400), whose own focus pull starts at f1436.
 */
export const FOCUS_A = {
  intake: { from: 400, to: BOTH_FIXES, ids: ['intake'] as readonly FocusId[] },
  rest: { from: FIX_A.in, to: BOTH_FIXES, ids: ['folders', 'loop', 'you'] as readonly FocusId[] },
  fixA: { from: FIX_B.in + 10, to: BOTH_FIXES, ids: ['fixA'] as readonly FocusId[] },
} as const;
const ramp = (f: number, r: { from: number; to: number }): number => Math.min(easings.inOutSine(span01(f, r.from, r.from + STEP_FRAMES)), 1 - easings.inOutSine(span01(f, r.to, r.to + STEP_FRAMES)));

export interface FolderState {
  /** 1 while the lamp attends it, decaying after */
  warmth: number;
  /** the pen: 0 down on the sheet … 1 lifted and parked */
  pen: number;
  /** how far along its line the pen has written (0..1, on eighths) */
  stroke: number;
  /** the flag: 0 tucked … 1 up */
  flag: number;
  /** 0 not yet there … 1 unfolded (F6–F8 unfold out from under their event slips) */
  present: number;
  /** its tab on the loop (0 not yet out from under the tape … 1 out) and its note on the tape (0 … 1 wiped in) */
  tab: number;
  note: number;
}

export interface ActOneState {
  f: number;
  /** the folder the lamp attends (n) and its aim point (world, eased between visits) */
  lamp: { n: number; aim: P3; bulb: number };
  folders: FolderState[];
  loop: LoopPose;
  /** the chores: 0 not yet landed … 1 landed (the notes loop's tightening, the key, the sand-glass, the strut) */
  chores: { loop: number; key: number; glass: number; strut: number };
  /** the chat slip in flight at still (a), if any (the turn holds act one with none) */
  flight: { u: number; pos: P3; tilt: number } | null;
  /** the heap: how many of HEAP have landed, and the posted pieces in the air */
  landed: number;
  posts: PostPose[];
  /** the request: its vermilion (0 a paper slip … 1 vermilion) and its crease's lift (radians) */
  request: { ink: number; lift: number };
  /** the event slips in the air or lying where their folders will unfold */
  events: EventSlip[];
  step: { amount: number; ids: readonly FocusId[]; own?: { amount: number; ids: readonly FocusId[] } };
  /** Fix A's own step (the kit's late set), as the focus moves to Fix B */
  stepA: number;
}

const folderN = (n: number): FolderLayout => FOLDERS[n - 1];
/** Where the lamp aims for a folder: its top sheet's centre. */
export const aimOf = (n: number): P3 => {
  const fl = folderN(n);
  return [fl.c[0], fl.c[1] - 6, stackTop(fl)];
};

/** The focus step-down at f: the intake's on the beat's amount, the rest of act one on its own ramp (state.ts DeskState['step']). */
export function actOneStep(f: number): ActOneState['step'] {
  const amount = ramp(f, FOCUS_A.intake);
  const own = ramp(f, FOCUS_A.rest);
  return { amount, ids: amount > 0 ? FOCUS_A.intake.ids : [], own: { amount: own, ids: own > 0 ? FOCUS_A.rest.ids : [] } };
}
export const actOneStepA = (f: number): number => ramp(f, FOCUS_A.fixA);

/** How far F6–F8 have unfolded (1 for the first five). */
export function presentAt(fl: FolderLayout, f: number): number {
  const arrive = ARRIVE[fl.n];
  if (arrive === undefined) return 1;
  return f <= arrive ? 0 : Math.min(1, springAt(f, arrive, SPRING.heavy));
}
/** A tab slides out from under the tape 2 f after its folder starts to unfold; its note is written as it settles (a 6 f wipe). */
export const tabAt01 = (fl: FolderLayout, f: number): number => {
  const arrive = ARRIVE[fl.n];
  return arrive === undefined ? 1 : springAt(f, arrive + 2, SPRING.settle);
};
export const noteAt01 = (fl: FolderLayout, f: number): number => {
  const arrive = ARRIVE[fl.n];
  return arrive === undefined ? 1 : span01(f, arrive + 10, arrive + 16);
};

/** The state of act one at film frame f (pure). */
export function actOneAt(f: number): ActOneState {
  // the lamp: the current visit and the one before it; the head swings on spring-heavy
  let k = 0;
  while (k + 1 < LAMP_VISITS.length && LAMP_VISITS[k + 1][0] <= f) k++;
  // frame 0 is already moving: the first swing began just before the film, from the folder the cycle visits last
  const [v0, n] = LAMP_VISITS[k];
  const t0 = k === 0 ? v0 - PRE_SWING.frames : v0;
  const prev = k > 0 ? LAMP_VISITS[k - 1][1] : PRE_SWING.from;
  const sw = springAt(f, t0, SPRING.heavy);
  const a0 = aimOf(prev);
  const a1 = aimOf(n);
  const aim: P3 = [a0[0] + (a1[0] - a0[0]) * sw, a0[1] + (a1[1] - a0[1]) * sw, a0[2] + (a1[2] - a0[2]) * sw];

  const folders = FOLDERS.map((fl): FolderState => {
    const present = presentAt(fl, f);
    let warmth: number;
    // the lamp has just come back to a cold folder: its pen settles back onto the sheet and its flag folds down over 4 f
    // (never in one frame), from how cold it had grown when the visit began
    let settle = 0;
    let settleFlag = 0;
    if (n === fl.n && f >= t0) {
      warmth = 1;
      let left = -Infinity;
      for (let i = 0; i < k; i++) if (LAMP_VISITS[i][1] === fl.n) left = LAMP_VISITS[i + 1][0];
      const before = left === -Infinity ? 0 : Math.exp(-(v0 - left) / WARM_TAU);
      const down = 1 - clamp((f - v0) / 4);
      if (before < PEN_ON) settle = down;
      if (before < FLAG_UP && present >= 1) settleFlag = down;
    } else {
      // when the lamp last left this folder: the start of the visit after its last visit
      let left = -Infinity;
      for (let i = 0; i <= k; i++) if (LAMP_VISITS[i][1] === fl.n && i + 1 <= k) left = LAMP_VISITS[i + 1][0];
      warmth = left === -Infinity ? 0 : Math.exp(-(f - left) / WARM_TAU);
    }
    // the pen lifts and the flag snaps up (4 f) when the warmth falls through their thresholds; a pen strokes on eighths
    const below = (th: number) => {
      if (warmth >= th) return 0;
      const since = warmth <= 0 ? Infinity : WARM_TAU * Math.log(th / warmth);
      return clamp(since / 4);
    };
    const pen = Math.max(below(PEN_ON), settle);
    const flag = present < 1 ? 0 : Math.max(below(FLAG_UP), settleFlag);
    const stroke = ((Math.floor(f / (BEAT / 2)) + fl.n * 3) % 8) / 7;
    return { warmth, pen, stroke, flag, present, tab: tabAt01(fl, f), note: noteAt01(fl, f) };
  });

  const loopTight = springAt(f, cue('chore-switch').frame, SPRING.settle);
  const closed = springAt(f, cue('hub').frame, SPRING.detent);
  const loop: LoopPose = { ...LOOP_A, a: LOOP_A.a + LOOP_SLACK * (1 - loopTight), b: LOOP_A.b + LOOP_SLACK * (1 - loopTight), closed };
  const chores = { loop: loopTight, key: f >= CHORE_POSTS.key.lands ? 1 : 0, glass: f >= CHORE_POSTS.glass.lands ? 1 : 0, strut: f >= CHORE_POSTS.strut.lands ? 1 : 0 };

  // the heap: what has landed and what is in the air
  let landed = 0;
  while (landed < HEAP.length && HEAP[landed].lands <= f) landed++;
  const posts: PostPose[] = [];
  for (let i = landed; i < HEAP.length; i++) {
    const q = postPose(HEAP[i], i, f);
    if (q) posts.push(q);
  }
  const still = posts.find((q) => HEAP[q.i].lands === FLIGHT.posted + 15 && q.u > 0);
  const flight = still ? { u: still.u, pos: still.p, tilt: still.tilt } : null;
  const lift = REQUEST_A.lift * COVER_FRAMES.reduce((s, c) => s + springAt(f, c, SPRING.settle), 0) / COVER_FRAMES.length;
  const request = { ink: springAt(f, REQUEST_INK, SPRING.effects), lift };
  const events = [6, 7, 8].map((m) => eventSlipAt(m, f)).filter((e): e is EventSlip => e !== null);

  return { f, lamp: { n, aim, bulb: BULB_A.level }, folders, loop, chores, flight, landed, posts, request, events, step: actOneStep(f), stepA: actOneStepA(f) };
}

/** Your desk's pose in act one: shifted north-east, the lamp reaching up to the folder it attends, each chore posted in on its cue. */
export function youPoseA(a: ActOneState): YouPose {
  const [sx, sy] = YOU_SHIFT_A;
  const aimL: P3 = [a.lamp.aim[0] - sx, a.lamp.aim[1] - sy, a.lamp.aim[2]];
  const base = LAMP.base;
  const c: P2 = [LOOP_A.c[0] - sx, LOOP_A.c[1] - sy];
  const head: P3 = [c[0] + (aimL[0] - c[0]) * HEAD_A.k, c[1] + (aimL[1] - c[1]) * HEAD_A.k, HEAD_A.z];
  const flights = { key: choreFlightAt('key', a.f), glass: choreFlightAt('glass', a.f), strut: choreFlightAt('strut', a.f) };
  const post = flights.key || flights.glass || flights.strut ? flights : undefined;
  const nudge = trayNudgeAt(a.f);
  // the in-tray stands empty in act one (nobody answers you yet: Fix B's replies land there in beat 3)
  return {
    shift: YOU_SHIFT_A,
    lamp: { base, elbow: lampElbow(base, head, HEAD_A.pole), head, aim: aimL },
    bulb: a.lamp.bulb,
    bulbOut: BULB_A.out,
    strut: 'lid',
    held: { key: a.chores.key, glass: a.chores.glass, strut: a.chores.strut },
    inTray: true,
    inTraySlip: false,
    ...(post ? { post } : {}),
    ...(nudge > 0 ? { trayNudge: nudge } : {}),
  };
}

/** Beat 9's downbeat: your laptop's lid shuts for the night (STORYBOARD 9.1). */
export const LID_SHUTS = 4560;

/** Your desk's pose at a film frame: act one's before the turn's run-up, then the act-two pose (the turn, MT2, will ease between them), its tray emptying as the chores are handed over. */
export function youPoseAt(f: number): YouPose {
  if (f < ACT_ONE_END) return youPoseA(actOneAt(f));
  // after the turn each chore leaves the tray when it is handed over (the Proactive, Productive, Persistent plates)
  const gone = (id: string) => f >= cue(id).frame;
  // beat 9 (f4560, STORYBOARD 9.1): the laptop's lid shuts for the night, over 12 f, before the strut lifts off
  const lidShut = springAt(f, LID_SHUTS, SPRING.settle);
  if (!gone('trait-proactive')) return lidShut > 0 ? { ...YOU_POSE_B, lidShut } : YOU_POSE_B;
  return { ...YOU_POSE_B, held: { key: 0, glass: gone('trait-productive') ? 0 : 1, strut: gone('trait-persistent') ? 0 : 1 }, lidShut };
}

// ------------------------------------------------------------------------------------------------
// The "you" label: it enters in beat 2, once the camera has settled (it never rides the move)

/** Its leader draws over 6 f, then the label wipes in over 8 f (TREATMENT Type, labels). */
export const YOU_LABEL_FROM = 402;
export function youLabelAt(f: number): { leader: number; wipe: number } | null {
  if (f < YOU_LABEL_FROM) return null;
  const leader = clamp((f - YOU_LABEL_FROM) / 6);
  const wipe = clamp((f - YOU_LABEL_FROM - 6) / 8);
  return { leader, wipe };
}

// ------------------------------------------------------------------------------------------------
// Light: footprints and pools

/** The loop's footprints: 16 chords of its tape (as the turn casts it, so the shadow does not change at f1400) and its clip. */
export function loopFootprints(L: LoopPose): Footprint[] {
  const fp: Footprint[] = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const p = loopPoint(L, (i / N) * Math.PI * 2);
    const q = loopPoint(L, ((i + 1) / N) * Math.PI * 2);
    fp.push(segFp([p[0], p[1], L.z], [q[0], q[1], L.z], 12));
  }
  const cp = loopPoint(L, L.clipAt);
  fp.push(circleFp(cp, 26, 0, 7.8 + 3 * (1 - L.closed), 0.9));
  return fp;
}

/** A folder's footprints: its cover and stack (scaled about its card while it unfolds), its pen arm, a raised flag's pennant. */
export function folderFootprints(fl: FolderLayout, s: FolderState): Footprint[] {
  if (s.present <= 0) return [];
  const fp: Footprint[] = [];
  const card = cardWorld(fl).c;
  const k = s.present;
  const c: P2 = [card[0] + (fl.c[0] - card[0]) * k, card[1] + (fl.c[1] - card[1]) * k];
  fp.push({ kind: 'rect', c, h: [(fl.w / 2) * Math.max(k, 0.3), (fl.d / 2) * Math.max(k, 0.2)], r: 3, rot: fl.rot, z0: 0, z1: Math.max(0.6, stackTop(fl) * k - 0.1), contact: 0.8 });
  if (k < 1) return fp;
  const pv = folderPoint(fl, penPivot(fl));
  const nib = penWorld(fl, s);
  fp.push(segFp([pv[0], pv[1], stackTop(fl) + PEN.post], nib, 2.6));
  if (s.flag > 0.05) {
    const top = flagTop(fl, s.flag);
    fp.push(segFp(top, [top[0] - FLAG.plate[0] * Math.sin(fl.rot), top[1] + FLAG.plate[0] * Math.cos(fl.rot), top[2] - 2], FLAG.plate[1] / 2));
  }
  return fp;
}

/** The feeders that exist in act one (the Thread's spool comes later). */
export function feederFootprints(): Footprint[] {
  const fp: Footprint[] = [circleFp(rectC(FEEDERS.chat), CHAT_R, 0, FEEDER_H.chat, 1), ...ciHopperFootprints()];
  const G = GENERIC_FEEDERS;
  fp.push(rectFp(G.mailBox, 0, G.mailH, 1, 6));
  fp.push({ kind: 'rect', c: G.envelope.c, h: [G.envelope.w / 2, G.envelope.d / 2], r: 2, rot: G.envelope.rot, z0: G.envelope.z - 0.3, z1: G.envelope.z + 0.6, contact: 0 });
  fp.push(rectFp(G.pad, 0, G.padH, 1, 6));
  fp.push({ kind: 'rect', c: G.leaf.c, h: [G.leaf.w / 2, G.leaf.d / 2], r: 2, rot: G.leaf.rot, z0: 0.1, z1: 0.9, contact: 0.3 });
  return fp;
}

/**
 * The heap's footprints at a state: every landed piece and the request, and each posted piece in the air (its shadow
 * apart from it). A piece that a later one has landed squarely on (its centre within 0.3 of its diagonal) casts nothing
 * more: its shadow lies under the piece on top, and the shaders' 128 are needed for beat 3's fixes.
 */
export function heapFootprints(a: ActOneState): Footprint[] {
  const fp: Footprint[] = [];
  for (let i = 0; i < a.landed; i++) {
    const p = HEAP[i];
    const diag = Math.hypot(...PIECE[p.kind]);
    let under = false;
    for (let j = i + 1; j < a.landed && !under; j++) under = Math.hypot(HEAP[j].c[0] - p.c[0], HEAP[j].c[1] - p.c[1]) < 0.3 * diag;
    if (under) continue;
    const [w, d] = PIECE[p.kind];
    fp.push({ kind: 'rect', c: p.c, h: [w / 2, d / 2], r: 2, rot: p.rot, z0: p.z - 0.3, z1: p.z + 0.5, contact: 0.45 });
  }
  const R = REQUEST_A;
  fp.push({ kind: 'rect', c: R.c, h: [R.l / 2, R.w / 2], r: 2, rot: R.rot, z0: requestZ() - 0.3, z1: requestZ() + 0.5 + 6 * a.request.lift, contact: 0.45 });
  for (const q of a.posts) {
    if (q.u <= 0) continue;
    const [w, d] = PIECE[HEAP[q.i].kind];
    fp.push({ kind: 'rect', c: [q.p[0], q.p[1]], h: [w / 2, d / 2], r: 3, rot: q.rot, z0: q.p[2] - 1, z1: q.p[2] + 1, contact: 0 });
  }
  return fp;
}

/** Every footprint of act one at a state (beat 3's fixes add their own: desk/beat3.ts). */
export function actOneFootprints(a: ActOneState): Footprint[] {
  const fp: Footprint[] = [...youFootprints(youPoseA(a)), ...loopFootprints(a.loop)];
  FOLDERS.forEach((fl, i) => fp.push(...folderFootprints(fl, a.folders[i])));
  fp.push(...feederFootprints());
  fp.push(...heapFootprints(a));
  for (const e of a.events) {
    const fl = FOLDERS[e.n - 1];
    const [w, d] = CARD[fl.card];
    fp.push({ kind: 'rect', c: [e.p[0], e.p[1]], h: [w / 2, d / 2], r: 2, rot: e.rot, z0: e.p[2] - 0.3, z1: e.p[2] + 0.5, contact: e.p[2] < 2 ? 0.4 : 0 });
  }
  return fp;
}

/** The CI hopper's footprints: its base, its back wall and its two cheeks (an open hopper: its deck of cards is not in its own shadow). */
export function ciHopperFootprints(): Footprint[] {
  const F = FEEDERS.ci;
  return [
    rectFp(F, 0, 8, 1, 6),
    rectFp({ x0: F.x0, x1: F.x0 + 10, y0: F.y0, y1: F.y1 }, 8, FEEDER_H.ci, 1, 2),
    rectFp({ x0: F.x0, x1: F.x1 - 8, y0: F.y0, y1: F.y0 + 8 }, 8, FEEDER_H.ci - 10, 1, 2),
    rectFp({ x0: F.x0, x1: F.x1 - 8, y0: F.y1 - 8, y1: F.y1 }, 8, FEEDER_H.ci - 10, 1, 2),
    rectFp({ x0: F.x0 + 14, x1: F.x1 - 8, y0: F.y0 + 13, y1: F.y1 - 13 }, 8, 8 + 6 * 4.2, 0.6, 3),
  ];
}

/** The pen's nib (folder-local, 3D): on the sheet at the end of the newest line, or lifted and swung off it. */
export function penLocal(fl: FolderLayout, s: FolderState): P3 {
  const pv = penPivot(fl);
  const nib = penNib(fl, s.stroke);
  const ang = PEN.swing * s.pen;
  const dx = nib[0] - pv[0];
  const dy = nib[1] - pv[1];
  return [pv[0] + dx * Math.cos(ang) - dy * Math.sin(ang), pv[1] + dx * Math.sin(ang) + dy * Math.cos(ang), stackTop(fl) + 1.2 + PEN.lift * s.pen];
}
export function penWorld(fl: FolderLayout, s: FolderState): P3 {
  const p = penLocal(fl, s);
  const w = folderPoint(fl, [p[0], p[1]]);
  return [w[0], w[1], p[2]];
}

/** The top of the flag's staff (folder-local): tucked flat along the north edge (0) or standing, leaning toward you (1). */
export function flagLocal(fl: FolderLayout, up: number): P3 {
  const h = flagHinge(fl);
  const ang = up * (Math.PI / 2 - FLAG.lean);
  return [h[0] - Math.sign(h[0]) * FLAG.staff * Math.cos(ang), h[1] - FLAG.staff * 0.25 * Math.sin(ang), stackTop(fl) + 1 + FLAG.staff * Math.sin(ang)];
}
export function flagTop(fl: FolderLayout, up: number): P3 {
  const p = flagLocal(fl, up);
  const w = folderPoint(fl, [p[0], p[1]]);
  return [w[0], w[1], p[2]];
}

/**
 * Act one's one pool: your lamp on the folder it attends (light is attention), its centre a little toward the lamp
 * so the folder falls off to its far edge; narrow across, so the neighbours' near edges stay cold.
 */
export const POOL_A = { back: 46, sigma: [50, 92] as P2, k: 1.05 } as const;
export function actOnePools(a: ActOneState): Pool[] {
  const c = LOOP_A.c;
  const d: P2 = [a.lamp.aim[0] - c[0], a.lamp.aim[1] - c[1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  return [{ c: [a.lamp.aim[0] - (d[0] / l) * POOL_A.back, a.lamp.aim[1] - (d[1] / l) * POOL_A.back], z: [0, 60], sigma: POOL_A.sigma, rgb: tint(LIGHT_HEX.yours, POOL_A.k) }];
}
