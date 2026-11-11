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
import { FOLDER_PRINT, LOOP_NOTES } from '../print.ts';
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
/**
 * The clip sits on the loop's west side (187°), above the notes band at the hook's 1.6x, so C1's line never runs into it
 * (the hook's critic: at 205° it sat in the band beside "You can't.").
 */
export const LOOP_A: LoopPose = { c: YOU_C_A, a: 262, b: 186, n: 2.8, z: 1.4, w: 24, clipAt: (187 * Math.PI) / 180, closed: 1 };
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
 * The tabs stand along the loop's north run, west to east as their folders (each still turned toward its own folder, so
 * a tab and its folder always pair up), from this arc length round from TAB_ARC.from (F1, north-west: its note whole on
 * the tape even while the loop lies open, its end short of the open end) down to this one (F8, north-east: the tape
 * south of it stays bare where your label's leader crosses it). The points facing each folder crowd F5–F8 into 50 u of
 * tape at the loop's north-east corner, too tight for a note beside each tab. Each tab's note is centred on it, so the
 * tabs are spaced by their notes' widths (a long note next to a long one stands further off), never two notes touching.
 */
export const TAB_ARC = { first: 1268, last: 760, from: (205 * Math.PI) / 180 } as const;
/** The loop's arc length (counter-clockwise, as the tape runs) from parameter angle `from` (default: the clip) to t, by integration on the pose. */
function arcTo(L: LoopPose, t: number, from: number = L.clipAt): number {
  const N = 720;
  let acc = 0;
  let prev = loopPoint(L, from);
  for (let i = 1; i <= N; i++) {
    const ti = from + ((t - from) * i) / N;
    const p = loopPoint(L, ti);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return acc;
}
/** The parameter angle at arc length s from `from` (bisection on the pose's arc). */
function paramAtArc(L: LoopPose, s: number, from: number): number {
  let lo = from;
  let hi = from + Math.PI * 2;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (arcTo(L, mid, from) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Where each tab stands (parameter angle): its arc length is measured from TAB_ARC.from, so the tabs keep still (a)'s places wherever the clip is. */
/** A note's width on the tape (u: 15 u mono, its advance 9 u, a 2 u margin each side; objects/ActOne.tsx prints it). */
export const loopNoteWidth = (s: string): number => s.length * 9 + 4;
const TAB_GAPS: readonly number[] = FOLDERS.slice(1).map((_, i) => (loopNoteWidth(LOOP_NOTES[i]) + loopNoteWidth(LOOP_NOTES[i + 1])) / 2 + 6);
const TAB_S: readonly number[] = (() => {
  const total = TAB_GAPS.reduce((a, b) => a + b, 0);
  const out: number[] = [TAB_ARC.first];
  TAB_GAPS.forEach((g) => out.push(out[out.length - 1] - ((TAB_ARC.first - TAB_ARC.last) * g) / total));
  return out;
})();
const TAB_T: readonly number[] = TAB_S.map((s) => paramAtArc(LOOP_A, s, TAB_ARC.from));
/**
 * Each folder's share of the tape's length at its tab, from the clip (where the tape and its print start): its note is
 * printed at this share of the tape (the slack loop is the tight one scaled, so a share holds for both).
 */
export const TAB_SHARE: readonly number[] = (() => {
  const len = arcTo(LOOP_A, LOOP_A.clipAt + Math.PI * 2);
  return TAB_T.map((t) => arcTo(LOOP_A, t < LOOP_A.clipAt ? t + Math.PI * 2 : t) / len);
})();
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
export const REQUEST_A = { c: [-762, 150] as P2, rot: 0.38, l: 114, w: 52, crease: 38, lift: 0.12 } as const;
/** The request turns vermilion on its cue (f20), over spring-effects: the request motif. Its spring starts the frame before, so the cue frame already shows it turning. */
export const REQUEST_INK = cue('request').frame;
/**
 * In 3.1 the request is on Fix A's tape: its grey copy (desk/beat3.ts) drops out of the chat spout with the request's
 * vermilion as the first station's move ends (its 3 f anticipation from FIX_A.steps[0] - 3; beat3.test.ts holds this to
 * the pour) and keeps it while Fix A holds the focus; the heap's request drains to its paper meanwhile (one request on
 * screen), and both swap back as the focus moves to Fix B (FOCUS_A.fixA).
 */
export const REQUEST_ON_TAPE = { from: FIX_A.steps[0] - 3, to: FIX_B.in + 10 } as const;
export const requestOnTapeAt = (f: number): number => clamp(springAt(f, REQUEST_ON_TAPE.from, SPRING.effects) - springAt(f, REQUEST_ON_TAPE.to, SPRING.effects));
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
  // beat 2 (the intake stepped down): a card on the heap's north end (clear of F1 and of the request's corner), then
  // still (a)'s chat slip in mid-arc
  [640, 'ci', [-776, 352], 0.5],
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

/**
 * F6–F8 arrive as posts (STORYBOARD 2.1, 5 → 8). The folder's board, at full scale, is thrown in from beyond the
 * frame's top edge (3 f anticipation, a 14 f arc coming down from h 60 over its place, so its shadow tightens) and lands
 * on its cue (ARRIVE, on a beat) with a 3% squash. The event slip that spawned it, posted from its feeder before the board
 * was thrown, lands on the board's stack EVENT_AFTER frames later as its task card; the clip riding open on the board's
 * north edge then slides onto the card and snaps shut on spring-dock (CLIP_AFTER).
 */
export const BOARD_POST = { arc: 14, apex: 60, from: [40, 440, 160] as P3, squash: 0.03, squashFrames: 6 } as const;
/** The event slip lands on the board this many frames after the board (its task card from then on). */
export const EVENT_AFTER = 2;
/** The clip starts to slide onto the card this many frames after the board lands, over this far (u, from the north). */
export const CLIP_AFTER = 4;
export const CLIP_TRAVEL = 14;
/** The event slip's flight from the feeder: 3 f anticipation, a long arc over the heap and the arc of folders. */
export const EVENT_ARC = { arc: 28, apex: 110 } as const;
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
/** The frame folder n's event slip lands on its board (its card from then on). */
export const eventLands = (n: number): number => ARRIVE[n] + EVENT_AFTER;
/**
 * The event slip for folder n while it flies in: from its feeder's mouth to where the task card lies on the board's stack,
 * through the frame before it lands (null before it is posted, and from its landing frame on, when the folder draws it as
 * its card in this same pose: never a frame without one or the other).
 */
export function eventSlipAt(n: number, f: number): EventSlip | null {
  const arrive = ARRIVE[n];
  if (arrive === undefined) return null;
  const fl = FOLDERS[n - 1];
  const lands = eventLands(n);
  const t0 = lands - EVENT_ARC.arc - 3;
  if (f < t0 || f >= lands) return null;
  const M = MOUTH[fl.card === 'chat' ? 'chat' : 'ci'];
  const to = cardWorld(fl);
  if (f < t0 + 3) {
    const e = MOVE(span01(f, t0, t0 + 3));
    return { n, p: [M.in[0] + (M.out[0] - M.in[0]) * e, M.in[1] + (M.out[1] - M.in[1]) * e, M.in[2] + (M.out[2] - M.in[2]) * e], rot: 0, tilt: 0 };
  }
  const u = clamp((f - t0 - 3) / EVENT_ARC.arc);
  const z1 = stackTop(fl) + 0.2;
  // it slows as it comes over its board (ease out across, the arc's fall straight down onto the stack)
  const e = 1 - (1 - u) * (1 - u);
  const p: P3 = [M.out[0] + (to.c[0] - M.out[0]) * e, M.out[1] + (to.c[1] - M.out[1]) * e, M.out[2] + (z1 - M.out[2]) * u + 4 * EVENT_ARC.apex * u * (1 - u)];
  return { n, p, rot: to.rot * e, tilt: fl.card === 'chat' ? 0.3 * Math.sin(u * Math.PI * 2) : -0.1 * Math.sin(u * Math.PI) };
}

/** A new folder's board in the air on its post, or squashing as it lands: its offset from its place, its tilt, its squash (null at rest, or before it is thrown). */
export interface BoardPose {
  off: P3;
  tilt: number;
  squash: number;
}
/** When folder n's board is thrown (its 3 f anticipation starts, off the frame's top edge). */
export const boardThrown = (n: number): number => ARRIVE[n] - BOARD_POST.arc - 3;
export function boardAt(fl: FolderLayout, f: number): BoardPose | null {
  const arrive = ARRIVE[fl.n];
  if (arrive === undefined) return null;
  const t0 = boardThrown(fl.n);
  if (f < t0) return null;
  const from = BOARD_POST.from;
  if (f < t0 + 3) return { off: [from[0], from[1], from[2] + 4 * MOVE(span01(f, t0, t0 + 3))], tilt: -0.2, squash: 0 };
  if (f < arrive) {
    const u = (f - t0 - 3) / BOARD_POST.arc;
    const k = 1 - u;
    // a parabola from the throw down onto its place: its last stretch comes straight down from about h 60 (the shadow tightens)
    const z = (from[2] + 4) * k * k + 4 * BOARD_POST.apex * u * (1 - u) * k;
    return { off: [from[0] * k * k, from[1] * k * k, z], tilt: -0.2 * k, squash: 0 };
  }
  const sq = BOARD_POST.squash * bump(f, arrive, BOARD_POST.squashFrames);
  return sq > 0 ? { off: [0, 0, 0], tilt: 0, squash: sq } : null;
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
  // the intake (the feeders, the heap, the request) stays down into the turn, whose own pull holds it there (turn.ts stepIn)
  intake: { from: 400, to: 1e6, ids: ['intake'] as readonly FocusId[] },
  // 6 f after Fix A starts to rise: your lamp's swing to it (FIX_LAMP.a) leads the step-down by 5 f
  rest: { from: FIX_A.in + 6, to: BOTH_FIXES, ids: ['folders', 'loop', 'you'] as readonly FocusId[] },
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
  /** 0 not yet there … 1 there (F6–F8: from the frame their board is thrown in) */
  present: number;
  /** how lit its top sheet is: the lamp has arrived over it (0 … 1, ramped over a few frames, never in one) */
  lit: number;
  /** F6–F8: the board in the air on its post, or squashing as it lands (absent: at rest) */
  board?: BoardPose;
  /** F6–F8: the task card is on its stack (the event slip has landed) and the clip has slid onto it and shut (0 … 1) */
  card: boolean;
  clip: number;
  /** its tab on the loop (0 not yet out from under the tape … 1 out) and its note on the tape (0 … 1 wiped in) */
  tab: number;
  note: number;
}

export interface ActOneState {
  f: number;
  /**
   * What the lamp attends (n: a folder 1..8; in beat 3 -1 Fix A, -2 Fix B, -3 between them), its aim point (world, eased
   * between visits), its bulb, and its pool's spread (u, across and along) and how far it sits back toward you.
   */
  lamp: { n: number; aim: P3; bulb: number; sigma: P2; back: number; head: P2; pole: P3 };
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
/**
 * Beat 3 (STORYBOARD 3.1–3.3): your lamp leaves the folders. It turns to Fix A as Fix A rises, to Fix B as its trays come
 * in, and for 3.3 settles between the two over your own desk (its bulb blooms while it attends: the emission rule). Each
 * swing hangs off its cue (FIX_A.in, FIX_B.in, BOTH_FIXES): the fix is mostly in before the light reaches it. The aims are
 * the fixes' own centres (desk/beat3.ts FIX_A_FOLDER, TRAYS; beat3.test.ts holds them equal); the pool spreads over the
 * whole fix (Fix B's trays are a wide block).
 */
export const FIX_LAMP = {
  // each swing starts 5 f before the step-down it leads (FOCUS_A: the rest at FIX_A.in + 6, Fix A at FIX_B.in + 10)
  // (its elbow bends up north-east, where it stands for F3, so only the upper arm and the hood turn west to Fix A: the
  // elbow never rests on F1's corner)
  a: { n: -1, from: FIX_A.in + 1, aim: [-650, -76, 30] as P3, sigma: [150, 150] as P2, head: [-424, 70] as P2, pole: [0.6, 0.4, 0.7] as P3 },
  b: { n: -2, from: FIX_B.in + 5, aim: [236, -22, 8] as P3, sigma: [176, 120] as P2, head: [-176, 100] as P2, pole: HEAD_A.pole },
  // 3.3: over your desk, the pool wide enough to light both fixes either side of it (4 f before both come back up)
  both: { n: -3, from: BOTH_FIXES - 4, aim: [-236, -50, 36] as P3, sigma: [430, 150] as P2, head: [-268, 112] as P2, pole: HEAD_A.pole },
} as const;
/** On a swing to or from a fix the head leads and its light follows this many frames later (the pool follows the head). */
export const AIM_LAG = 3;
/** Every visit of the lamp in act one: the cue sheet's (folders) and beat 3's (the fixes). */
export const VISITS: readonly (readonly [number, number])[] = [...LAMP_VISITS, ...Object.values(FIX_LAMP).map((v) => [v.from, v.n] as const)];
/** Where the lamp aims for a folder (its top sheet's centre) or a fix. */
export const aimOf = (n: number): P3 => {
  if (n < 0) return Object.values(FIX_LAMP).find((v) => v.n === n)!.aim;
  const fl = folderN(n);
  return [fl.c[0], fl.c[1] - 6, stackTop(fl)];
};
/**
 * Where the lamp's head stands for a target (world, plan): a quarter of the way from the loop's centre toward a folder
 * (the Λ of still (a)); for a fix, its own place over your desk's north edge (west of it for Fix A, east for Fix B), so
 * the arm never folds down over the laptop: only the light reaches out to the fix.
 */
const headOf = (n: number): P2 => {
  if (n < 0) return Object.values(FIX_LAMP).find((v) => v.n === n)!.head;
  const a = aimOf(n);
  return [YOU_C_A[0] + (a[0] - YOU_C_A[0]) * HEAD_A.k, YOU_C_A[1] + (a[1] - YOU_C_A[1]) * HEAD_A.k];
};
/**
 * Act one's one pool: your lamp on the folder it attends (light is attention), its centre a little toward the lamp
 * so the folder falls off to its far edge; narrow across, so the neighbours' near edges stay cold.
 */
export const POOL_A = { back: 46, sigma: [50, 92] as P2, k: 1.05 } as const;
/** The pool's spread for a target, and how far back toward you it sits (a folder falls off to its far edge; a fix is lit whole). */
const poolOf = (n: number): { sigma: P2; back: number } => (n < 0 ? { sigma: Object.values(FIX_LAMP).find((v) => v.n === n)!.sigma, back: 0 } : { sigma: POOL_A.sigma, back: POOL_A.back });
/** A folder lights up as the lamp arrives over it: within about this distance of its aim (u), over this many frames. */
export const LIT = { reach: 46, frames: 4 } as const;

/** The focus step-down at f: the intake's on the beat's amount, the rest of act one on its own ramp (state.ts DeskState['step']). */
export function actOneStep(f: number): ActOneState['step'] {
  const amount = ramp(f, FOCUS_A.intake);
  const own = ramp(f, FOCUS_A.rest);
  return { amount, ids: amount > 0 ? FOCUS_A.intake.ids : [], own: { amount: own, ids: own > 0 ? FOCUS_A.rest.ids : [] } };
}
export const actOneStepA = (f: number): number => ramp(f, FOCUS_A.fixA);

/** Whether a folder is in the world (F6–F8 from the frame their board is thrown in; the first five always). */
export function presentAt(fl: FolderLayout, f: number): number {
  return ARRIVE[fl.n] === undefined || f >= boardThrown(fl.n) ? 1 : 0;
}
/** A tab slides out from under the tape 2 f after its folder lands; its note is written as it settles (a 6 f wipe). */
export const tabAt01 = (fl: FolderLayout, f: number): number => {
  const arrive = ARRIVE[fl.n];
  return arrive === undefined ? 1 : springAt(f, arrive + 2, SPRING.settle);
};
export const noteAt01 = (fl: FolderLayout, f: number): number => {
  const arrive = ARRIVE[fl.n];
  return arrive === undefined ? 1 : span01(f, arrive + 10, arrive + 16);
};

/** The lamp's visit at f (index into VISITS), the frame its swing starts, what it attends now and before. */
function visitAt(f: number): { k: number; v0: number; t0: number; n: number; prev: number } {
  let k = 0;
  while (k + 1 < VISITS.length && VISITS[k + 1][0] <= f) k++;
  // frame 0 is already moving: the first swing began just before the film, from the folder the cycle visits last
  const [v0, n] = VISITS[k];
  return { k, v0, t0: k === 0 ? v0 - PRE_SWING.frames : v0, n, prev: k > 0 ? VISITS[k - 1][1] : PRE_SWING.from };
}
/**
 * The lamp's swings. Every swing starts from where the lamp actually is on its first frame (a swing cut short by the next,
 * as on bar 11's sixteenths, hands its pose on: never back to the last target), so its head and its light never jump.
 * The head swings on spring-heavy from its swing's start; its light (the aim, the pool's spread and pull) on its own
 * clock, AIM_LAG frames later on a swing to or from a fix. A swing to or from a fix is routed round the lamp's base: the
 * head turns about the base's foot (angle and reach, never through it) and the light turns about the head (the hood
 * rotates; the pool sweeps an arc), so the bulb never flips across the hood in a frame or two.
 */
const LAMP_FOOT: P2 = [LAMP.base[0] + YOU_SHIFT_A[0], LAMP.base[1] + YOU_SHIFT_A[1]];
const fixSwing = (k: number): boolean => VISITS[k][1] < 0 || (k > 0 && VISITS[k - 1][1] < 0);
const headStart = (k: number): number => (k === 0 ? VISITS[0][0] - PRE_SWING.frames : VISITS[k][0]);
const aimStart = (k: number): number => headStart(k) + (fixSwing(k) ? AIM_LAG : 0);
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** From a to b about c: the angle the short way round and the reach, each in proportion. */
function aboutC(c: P2, a: P2, b: P2, t: number): P2 {
  const ra = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const rb = Math.hypot(b[0] - c[0], b[1] - c[1]);
  const aa = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let ab = Math.atan2(b[1] - c[1], b[0] - c[0]);
  while (ab - aa > Math.PI) ab -= Math.PI * 2;
  while (aa - ab > Math.PI) ab += Math.PI * 2;
  const ang = aa + (ab - aa) * t;
  const r = ra + (rb - ra) * t;
  return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)];
}
/** The light's pose apart from the head: the aim's offset from the head (plan), its height, the pool's spread and pull. */
interface LightPose {
  rel: P2;
  z: number;
  sigma: P2;
  back: number;
}
const lightOf = (n: number): LightPose => {
  const a = aimOf(n);
  const h = headOf(n);
  const p = poolOf(n);
  return { rel: [a[0] - h[0], a[1] - h[1]], z: a[2], sigma: p.sigma, back: p.back };
};
/** The head (world plan) and the direction its elbow bends (the arm's pole). */
interface HeadPose {
  head: P2;
  pole: P3;
}
const poleOf = (n: number): P3 => (n < 0 ? Object.values(FIX_LAMP).find((v) => v.n === n)!.pole : HEAD_A.pole);
const headSwing = (k: number, from: HeadPose, f: number): HeadPose => {
  const sw = springAt(f, headStart(k), SPRING.heavy);
  const n = VISITS[k][1];
  const to = poleOf(n);
  return {
    head: fixSwing(k) ? aboutC(LAMP_FOOT, from.head, headOf(n), sw) : lerp2(from.head, headOf(n), sw),
    pole: [from.pole[0] + (to[0] - from.pole[0]) * sw, from.pole[1] + (to[1] - from.pole[1]) * sw, from.pole[2] + (to[2] - from.pole[2]) * sw],
  };
};
const lightSwing = (k: number, from: LightPose, f: number): LightPose => {
  const sw = springAt(f, aimStart(k), SPRING.heavy);
  const to = lightOf(VISITS[k][1]);
  return {
    rel: fixSwing(k) ? aboutC([0, 0], from.rel, to.rel, sw) : lerp2(from.rel, to.rel, sw),
    z: from.z + (to.z - from.z) * sw,
    sigma: lerp2(from.sigma, to.sigma, sw),
    back: from.back + (to.back - from.back) * sw,
  };
};
/** Each swing's starting pose: the pose the swing before it had reached on its first frame (index-keyed, built once). */
const HEAD_FROM: readonly HeadPose[] = (() => {
  const out: HeadPose[] = [{ head: headOf(PRE_SWING.from), pole: HEAD_A.pole }];
  for (let k = 1; k < VISITS.length; k++) out.push(headSwing(k - 1, out[k - 1], headStart(k)));
  return out;
})();
const LIGHT_FROM: readonly LightPose[] = (() => {
  const out: LightPose[] = [lightOf(PRE_SWING.from)];
  for (let k = 1; k < VISITS.length; k++) out.push(lightSwing(k - 1, out[k - 1], aimStart(k)));
  return out;
})();
/** The swing in force at f on a clock (the last whose start is at or before f; the first before the film). */
const swingAt = (f: number, start: (k: number) => number): number => {
  let k = 0;
  while (k + 1 < VISITS.length && start(k + 1) <= f) k++;
  return k;
};
/** The lamp's aim at f, its pool's spread and its pull back toward you, its head (world plan) and its elbow's pole. */
export function lampAimAt(f: number): { aim: P3; sigma: P2; back: number; head: P2; pole: P3 } {
  const kh = swingAt(f, headStart);
  const { head, pole } = headSwing(kh, HEAD_FROM[kh], f);
  const ka = swingAt(f, aimStart);
  const L = lightSwing(ka, LIGHT_FROM[ka], f);
  return { aim: [head[0] + L.rel[0], head[1] + L.rel[1], L.z], sigma: L.sigma, back: L.back, head, pole };
}

/** The state of act one at film frame f (pure). */
export function actOneAt(f: number): ActOneState {
  const { k, v0, t0, n } = visitAt(f);
  const { aim, sigma, back, head, pole } = lampAimAt(f);
  // how lit each folder's top sheet is: the light near it and the head still (a folder the light only sweeps across never
  // lights up), averaged over the last LIT.frames frames, so it comes up and goes down over 4 f, never in one
  const aims = Array.from({ length: LIT.frames + 1 }, (_, k) => (k === 0 ? aim : lampAimAt(f - k).aim));
  const litOf = (fa: P3): number => {
    let sum = 0;
    for (let k = 0; k < LIT.frames; k++) {
      const a0 = aims[k];
      const a1 = aims[k + 1];
      const steady = Math.exp(-((Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) / 6) ** 2));
      sum += Math.exp(-((Math.hypot(a0[0] - fa[0], a0[1] - fa[1]) / LIT.reach) ** 2)) * steady;
    }
    return sum / LIT.frames;
  };

  const folders = FOLDERS.map((fl): FolderState => {
    const present = presentAt(fl, f);
    const arrive = ARRIVE[fl.n];
    const landed = arrive === undefined || f >= arrive;
    let warmth: number;
    // the lamp has just come back to a cold folder: its pen settles back onto the sheet and its flag folds down over 4 f
    // (never in one frame), from how cold it had grown when the visit began
    let settle = 0;
    let settleFlag = 0;
    // how far a pen is lifted or a flag is up at a warmth, on the decay since the lamp left (4 f from the crossing)
    const liftAt = (w: number, th: number): number => (w >= th ? 0 : clamp((w <= 0 ? Infinity : WARM_TAU * Math.log(th / w)) / 4));
    const attended = n === fl.n && f >= t0;
    if (attended) {
      let left = -Infinity;
      for (let i = 0; i < k; i++) if (VISITS[i][1] === fl.n) left = VISITS[i + 1][0];
      const before = left === -Infinity ? 0 : Math.exp(-(v0 - left) / WARM_TAU);
      // it warms over 4 f from where it had cooled to (never in one frame: the hook's judder and bar 11's strobe)
      warmth = before + (1 - before) * clamp((f - v0) / 4);
      const down = 1 - clamp((f - v0) / 4);
      settle = liftAt(before, PEN_ON) * down;
      settleFlag = landed ? liftAt(before, FLAG_UP) * down : 0;
    } else {
      // when the lamp last left this folder: the start of the visit after its last visit
      let left = -Infinity;
      for (let i = 0; i <= k; i++) if (VISITS[i][1] === fl.n && i + 1 <= k) left = VISITS[i + 1][0];
      warmth = left === -Infinity ? 0 : Math.exp(-(f - left) / WARM_TAU);
    }
    // the pen lifts and the flag snaps up (4 f) when the warmth falls through their thresholds; a pen strokes on eighths
    // (while the lamp attends it, only the settle: its warmth rising through a threshold never snaps them)
    const pen = attended ? settle : liftAt(warmth, PEN_ON);
    const flag = !landed ? 0 : attended ? settleFlag : liftAt(warmth, FLAG_UP);
    const stroke = ((Math.floor(f / (BEAT / 2)) + fl.n * 3) % 8) / 7;
    const fa = aimOf(fl.n);
    const lit = litOf(fa);
    const board = boardAt(fl, f);
    const card = arrive === undefined || f >= eventLands(fl.n);
    const clip = arrive === undefined ? 1 : springAt(f, arrive + CLIP_AFTER, SPRING.dock);
    return { warmth, pen, stroke, flag, present, lit, ...(board ? { board } : {}), card, clip, tab: tabAt01(fl, f), note: noteAt01(fl, f) };
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
  const request = { ink: springAt(f, REQUEST_INK - 1, SPRING.effects) * (1 - requestOnTapeAt(f)), lift };
  const events = [6, 7, 8].map((m) => eventSlipAt(m, f)).filter((e): e is EventSlip => e !== null);

  return { f, lamp: { n, aim, bulb: BULB_A.level, sigma, back, head, pole }, folders, loop, chores, flight, landed, posts, request, events, step: actOneStep(f), stepA: actOneStepA(f) };
}

/** Your desk's pose in act one: shifted north-east, the lamp reaching up to the folder it attends, each chore posted in on its cue. */
export function youPoseA(a: ActOneState): YouPose {
  const [sx, sy] = YOU_SHIFT_A;
  const aimL: P3 = [a.lamp.aim[0] - sx, a.lamp.aim[1] - sy, a.lamp.aim[2]];
  const base = LAMP.base;
  const c: P2 = [LOOP_A.c[0] - sx, LOOP_A.c[1] - sy];
  // the head stands where the visit puts it (actOne.ts headOf: a quarter of the way toward a folder, a fix's own place)
  void c;
  const head: P3 = [a.lamp.head[0] - sx, a.lamp.head[1] - sy, HEAD_A.z];
  const flights = { key: choreFlightAt('key', a.f), glass: choreFlightAt('glass', a.f), strut: choreFlightAt('strut', a.f) };
  const post = flights.key || flights.glass || flights.strut ? flights : undefined;
  const nudge = trayNudgeAt(a.f);
  // the in-tray stands empty in act one (nobody answers you yet: Fix B's replies land there in beat 3)
  return {
    shift: YOU_SHIFT_A,
    lamp: { base, elbow: lampElbow(base, head, a.lamp.pole), head, aim: aimL },
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
/** It leaves as beat 3 begins (the focus goes to the fixes, and Fix B's trays take the ground it stands on): a 6 f fade, never a slide. */
export const YOU_LABEL_OUT = FIX_A.in;
export function youLabelAt(f: number): { leader: number; wipe: number } | { opacity: number } | null {
  if (f < YOU_LABEL_FROM || f >= YOU_LABEL_OUT + 6) return null;
  if (f >= YOU_LABEL_OUT) return { opacity: 1 - (f - YOU_LABEL_OUT) / 6 };
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

/**
 * A folder's footprints: its cover and stack (in the air while a new one is posted in: its shadow apart from it, tightening
 * as it comes down), its pen arm, a raised flag's staff and pennant. The pennant is a plate standing on edge, so its
 * shadow is a thin bar along it, cast from its own height (a soft blob read as dirt on the folder below).
 */
export function folderFootprints(fl: FolderLayout, s: FolderState): Footprint[] {
  if (s.present <= 0) return [];
  const fp: Footprint[] = [];
  const off = s.board?.off ?? [0, 0, 0];
  const air = off[2] > 0.5;
  fp.push({ kind: 'rect', c: [fl.c[0] + off[0], fl.c[1] + off[1]], h: [fl.w / 2, fl.d / 2], r: 3, rot: fl.rot, z0: off[2], z1: off[2] + stackTop(fl) - 0.1, contact: air ? 0 : 0.8 });
  if (air) return fp;
  const pv = folderPoint(fl, penPivot(fl));
  const nib = penWorld(fl, s);
  fp.push(segFp([pv[0], pv[1], stackTop(fl) + PEN.post], nib, 2.6));
  if (s.flag > 0.05) {
    const top = flagTop(fl, s.flag);
    const hinge = folderPoint(fl, flagHinge(fl));
    fp.push(segFp([hinge[0], hinge[1], stackTop(fl) + 1 - flagSink(fl, s.flag)], top, 1.4));
    const mid = top[2] - 2;
    fp.push(segFp([top[0], top[1], mid], [top[0] - FLAG.plate[0] * Math.sin(fl.rot), top[1] + FLAG.plate[0] * Math.cos(fl.rot), mid], 2.2));
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

/** The four corners of a heap piece (world). */
const pieceCorners = (p: { kind: PieceKind; c: P2; rot: number }): P2[] => {
  const [w, d] = PIECE[p.kind];
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => [p.c[0] + (c * x * w) / 2 - (s * y * d) / 2, p.c[1] + (s * x * w) / 2 + (c * y * d) / 2]);
};
/** Whether a point lies inside a heap piece's rectangle, `margin` u in from its edges. */
const insidePiece = (q: P2, p: { kind: PieceKind; c: P2; rot: number }, margin: number): boolean => {
  const [w, d] = PIECE[p.kind];
  const dx = q[0] - p.c[0];
  const dy = q[1] - p.c[1];
  const c = Math.cos(-p.rot);
  const s = Math.sin(-p.rot);
  return Math.abs(c * dx - s * dy) <= w / 2 - margin && Math.abs(s * dx + c * dy) <= d / 2 - margin;
};
/** Whether heap piece i lies wholly under one that landed after it (by frame f): then its shadow is hidden under that piece. */
export const heapCovered = (i: number, landed: number): boolean => {
  const corners = pieceCorners(HEAP[i]);
  for (let j = i + 1; j < landed; j++) if (corners.every((q) => insidePiece(q, HEAP[j], 2))) return true;
  return false;
};

/**
 * The heap's footprints at a state: every landed piece and the request, and each posted piece in the air (its shadow
 * apart from it). A piece wholly covered by one that landed later (all four corners inside it) casts nothing more: its
 * shadow lies under the piece on top, so no exposed edge ever loses its contact shadow when a piece lands.
 */
export function heapFootprints(a: ActOneState): Footprint[] {
  const fp: Footprint[] = [];
  for (let i = 0; i < a.landed; i++) {
    const p = HEAP[i];
    if (heapCovered(i, a.landed)) continue;
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
    fp.push({ kind: 'rect', c: [e.p[0], e.p[1]], h: [w / 2, d / 2], r: 2, rot: e.rot, z0: e.p[2] - 0.3, z1: e.p[2] + 0.5, contact: e.p[2] < stackTop(fl) + 2 ? 0.4 : 0 });
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

/**
 * How far the flag has sunk into its slot in the folder's north edge (u): it folds down into the folder as it tucks and
 * rises out of it as it snaps up, so it never vanishes or appears in the air (at 0 it is wholly under the desk's top).
 */
export const flagSink = (fl: FolderLayout, up: number): number => (1 - clamp(up)) ** 2 * (stackTop(fl) + FLAG.plate[1] + 4);
/** The top of the flag's staff (folder-local): tucked into its slot along the north edge (0) or standing, leaning toward you (1). */
export function flagLocal(fl: FolderLayout, up: number): P3 {
  const h = flagHinge(fl);
  const ang = up * (Math.PI / 2 - FLAG.lean);
  return [h[0] - Math.sign(h[0]) * FLAG.staff * Math.cos(ang), h[1] - FLAG.staff * 0.25 * Math.sin(ang), stackTop(fl) + 1 + FLAG.staff * Math.sin(ang) - flagSink(fl, up)];
}
export function flagTop(fl: FolderLayout, up: number): P3 {
  const p = flagLocal(fl, up);
  const w = folderPoint(fl, [p[0], p[1]]);
  return [w[0], w[1], p[2]];
}

/** Act one's one pool (POOL_A, defined with the lamp's swings, which read it as the module loads). */
export function actOnePools(a: ActOneState): Pool[] {
  const c = LOOP_A.c;
  const d: P2 = [a.lamp.aim[0] - c[0], a.lamp.aim[1] - c[1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  const back = a.lamp.back;
  return [{ c: [a.lamp.aim[0] - (d[0] / l) * back, a.lamp.aim[1] - (d[1] / l) * back], z: [0, 60], sigma: a.lamp.sigma, rgb: tint(LIGHT_HEX.yours, POOL_A.k) }];
}
