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
 * Still A (lookdev/frames.ts, f915): C4 alone, the loop clipped shut since f880, the lamp settled on
 * F3, about four folders warm and four cold, flags up.
 */
import { clamp, easings, rand } from '@aiv/core';
import { BEAT, cue } from '../cues.ts';
import { FOLDER_PRINT } from '../print.ts';
import { circleFp, rectFp, segFp, youFootprints, type Footprint } from './footprints.ts';
import { FEEDERS, FEEDER_H, LAMP, YOU, rectC, type P2, type P3, type Pool } from './layout.ts';
import { LIGHT_HEX, tint } from './pools.ts';
import { SPRING, STEP_FRAMES, springAt, type FocusId } from './state.ts';
import { YOU_POSE_B, lampElbow, type YouPose } from './you.ts';

/** From here on the turn's schedule (MT2, f1400–1660) poses the world. */
export const ACT_ONE_END = 1400;

/** Your desk in act one: this far north and east of its place after the turn (it slides south-west at the turn). */
export const YOU_SHIFT_A: P2 = [392, 168];
/** The desk slab's centre in act one (world). */
export const YOU_C_A: P2 = [rectC(YOU.slab)[0] + YOU_SHIFT_A[0], rectC(YOU.slab)[1] + YOU_SHIFT_A[1]];

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
 * sizes, stacks, tabs and contents differ by task.
 */
export const FOLDERS: readonly FolderLayout[] = [
  { n: 1, c: [-598, 236], rot: 0.21, w: 116, d: 148, sheets: 20, card: 'chat', contents: 'slips', tab: 0.24 },
  { n: 2, c: [-448, 328], rot: 0.12, w: 112, d: 142, sheets: 9, card: 'ci', contents: 'cards', tab: 0.62 },
  { n: 3, c: [-320, 370], rot: 0.05, w: 128, d: 158, sheets: 15, card: 'ci', contents: 'sheets', tab: 0.4 },
  { n: 4, c: [-180, 390], rot: -0.03, w: 118, d: 150, sheets: 25, card: 'chat', contents: 'sheets', tab: 0.72 },
  { n: 5, c: [-40, 394], rot: -0.07, w: 122, d: 150, sheets: 12, card: 'ci', contents: 'cards', tab: 0.3 },
  { n: 6, c: [98, 388], rot: -0.11, w: 108, d: 140, sheets: 5, card: 'chat', contents: 'sheets', tab: 0.55 },
  { n: 7, c: [238, 322], rot: -0.21, w: 120, d: 150, sheets: 17, card: 'chat', contents: 'slips', tab: 0.2 },
  { n: 8, c: [344, 214], rot: -0.36, w: 114, d: 146, sheets: 13, card: 'ci', contents: 'sheets', tab: 0.66 },
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
/** The parameter angle where each folder's tab sits: the loop's point facing that folder. */
export const tabAt = (L: LoopPose, fl: FolderLayout): number => Math.atan2((fl.c[1] - L.c[1]) / L.b, (fl.c[0] - L.c[0]) / L.a);

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
  leaf: { c: [FEEDERS.calendar.x1 + 40, rectC(FEEDERS.calendar)[1] - 10] as P2, w: 80, d: 54, rot: 0.32 },
} as const;

// ------------------------------------------------------------------------------------------------
// The heap: messages spilled east of the feeders, the request buried in it

export interface HeapPiece {
  kind: CardKind;
  c: P2;
  rot: number;
  /** its underside's height (it lies on the pieces under it) */
  z: number;
  /** which printed variant */
  v: number;
  /** a darker or lighter stock (0..1) */
  tone: number;
}
/** A chat slip and a punched CI card, as from the feeders (texture sizes in gl/text.ts PRINT_SIZE). */
export const PIECE = { chat: [96, 40] as P2, ci: [84, 50] as P2 } as const;
const HEAP_SEED = 0x5a01;
/** The heap's spine: from the feeders' mouths, spilling south-east toward you (its newest slips against the loop's west flank, clear of Fix A's folder and of your act-two desk). */
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
/** The request: 1.3× a chat slip (layout.ts REQUEST), creased, its south-east corner showing. */
export const REQUEST_A = { c: [-762, 150] as P2, rot: 0.38, z: 0.9, l: 114, w: 52, crease: 38, lift: 0.22 } as const;

/**
 * The heap, oldest first: each piece lies on whatever landed before it under its outline, so the
 * pile is a pure function of the list. Three pieces lie across the request's west part.
 */
export const HEAP: readonly HeapPiece[] = (() => {
  const raw: Omit<HeapPiece, 'z'>[] = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const old = i < N * 0.55;
    // the oldest lie near the feeders, the newest toward you
    const s = old ? 0.62 * rand(HEAP_SEED, i, 0) : 0.4 + 0.6 * rand(HEAP_SEED, i, 0);
    const { p, n } = spineAt(s);
    const spread = 34 + 46 * s;
    const lat = (rand(HEAP_SEED, i, 1) * 2 - 1) * spread;
    const kind: CardKind = rand(HEAP_SEED, i, 2) < 0.58 ? 'chat' : 'ci';
    raw.push({ kind, c: [p[0] + n[0] * lat, p[1] + n[1] * lat], rot: (rand(HEAP_SEED, i, 3) * 2 - 1) * 0.75 + (kind === 'ci' ? 0.25 : -0.1), v: Math.floor(rand(HEAP_SEED, i, 4) * 6), tone: rand(HEAP_SEED, i, 5) });
  }
  // over the request: three later pieces leave its south-east corner clear
  const R = REQUEST_A;
  const cover: Omit<HeapPiece, 'z'>[] = [
    { kind: 'chat', c: [R.c[0] - 30, R.c[1] + 22], rot: 0.95, v: 2, tone: 0.6 },
    { kind: 'ci', c: [R.c[0] - 24, R.c[1] - 12], rot: -0.2, v: 4, tone: 0.3 },
    { kind: 'chat', c: [R.c[0] - 14, R.c[1] + 44], rot: 0.18, v: 5, tone: 0.8 },
    { kind: 'ci', c: [R.c[0] - 58, R.c[1] - 22], rot: -0.55, v: 1, tone: 0.2 },
  ];
  // later pieces keep off the request's creased corner, so it shows (at least 40 px)
  const flap: P2 = [R.c[0] + Math.cos(R.rot) * (R.l / 2 - R.crease / 2), R.c[1] + Math.sin(R.rot) * (R.l / 2 - R.crease / 2)];
  const clear = (p: Omit<HeapPiece, 'z'>): Omit<HeapPiece, 'z'> => {
    const d: P2 = [p.c[0] - flap[0], p.c[1] - flap[1]];
    const l = Math.hypot(d[0], d[1]);
    return l >= 84 ? p : { ...p, c: [flap[0] + (d[0] / (l || 1)) * 84, flap[1] + (d[1] / (l || 1)) * 84] };
  };
  const all = [...raw.slice(0, 9).map(clear), ...cover, ...raw.slice(9).map(clear)];
  const out: HeapPiece[] = [];
  const radius = (k: CardKind) => Math.hypot(...PIECE[k]) / 2;
  for (const p of all) {
    let z = 0.4;
    for (const q of out) if (Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) < 0.8 * (radius(p.kind) + radius(q.kind))) z = Math.max(z, q.z + 1.5);
    if (Math.hypot(p.c[0] - R.c[0], p.c[1] - R.c[1]) < 0.8 * (radius(p.kind) + R.l / 2)) z = Math.max(z, R.z + 1.8);
    out.push({ ...p, z });
  }
  return out;
})();

/** One chat slip in flight from the spout to the heap: posted on a sixteenth (3 f anticipation, a 12 f arc). */
const SPOUT: P3 = [rectC(FEEDERS.chat)[0] + (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2 + 40, rectC(FEEDERS.chat)[1] - 4, 16];
/** It lands at the heap's newest end, toward you (the heap grows your way), at mid-arc over open slate so its shadow lies apart from it. */
export const FLIGHT = { from: SPOUT, to: [-626, 112, 3] as P3, posted: 905, apex: 44 } as const;

// ------------------------------------------------------------------------------------------------
// The schedule (film frames)

/** The lamp's visits: [frame the swing starts, folder n]. Quarters, then eighths and sixteenths among the four you can follow; it stops dead on F3. */
export const LAMP_VISITS: readonly (readonly [number, number])[] = (() => {
  const v: [number, number][] = [];
  const cycleAll = [1, 3, 2, 5, 4, 1, 3, 5];
  for (let f = 0, k = 0; f < 400; f += BEAT, k++) v.push([f, cycleAll[k % cycleAll.length]]);
  const all8 = [6, 1, 7, 3, 8, 2, 5, 4];
  for (let f = 400, k = 0; f < 560; f += BEAT, k++) v.push([f, all8[k % all8.length]]);
  // from here only the four you can still follow
  const four = [5, 1, 7, 3];
  for (let f = 560, k = 0; f < 640; f += BEAT, k++) v.push([f, four[k % 4]]);
  for (let f = 640, k = 0; f < 800; f += BEAT / 2, k++) v.push([f, four[k % 4]]);
  for (let f = 800, k = 0; f < 870; f += BEAT / 4, k++) v.push([f, four[k % 4]]);
  v.push([870, 3]);
  return v;
})();
/** Warmth decays with this time constant once the lamp leaves (synthesis §2). */
export const WARM_TAU = 120;
/** A pen works while its folder is warmer than this; under FLAG_UP its flag stands up. */
export const PEN_ON = 0.35;
export const FLAG_UP = 0.3;
/** Folders F6–F8 arrive in beat 2 (5 → 8), each on a downbeat's beat. */
export const ARRIVE: Readonly<Record<number, number>> = { 6: 420, 7: 460, 8: 500 };
/** The lamp's bulb while it attends (HDR: above 1.0 it blooms) and how far it stands out of the hood. */
export const BULB_A = { level: 3, out: 46 } as const;
/**
 * The lamp head inside the loop: on the line from the loop's centre to the folder it attends, this far out (so only
 * its light crosses the tape), at this height; its elbow bends up and south, over the desk (no arm reaches a folder).
 */
export const HEAD_A = { k: 0.25, z: 116, pole: [0.12, -0.6, 0.79] as P3 } as const;

/** Per-beat focus in act one: during C4 the intake and its heap step down (the request keeps its vermilion). */
export const FOCUS_A: readonly { id: string; from: number; to: number; step: readonly FocusId[] }[] = [{ id: 'c4', from: cue('c4').frame - 6, to: cue('c4').end! + 6, step: ['intake'] }];

export interface FolderState {
  /** 1 while the lamp attends it, decaying after */
  warmth: number;
  /** the pen: 0 down on the sheet … 1 lifted and parked */
  pen: number;
  /** how far along its line the pen has written (0..1, on eighths) */
  stroke: number;
  /** the flag: 0 tucked … 1 up */
  flag: number;
  /** 0 not yet there … 1 landed */
  present: number;
}

export interface ActOneState {
  f: number;
  /** the folder the lamp attends (n) and its aim point (world, eased between visits) */
  lamp: { n: number; aim: P3; bulb: number };
  folders: FolderState[];
  loop: LoopPose;
  /** the chores: 0 not yet landed … 1 landed (the notes loop's tightening, the key, the sand-glass, the strut) */
  chores: { loop: number; key: number; glass: number; strut: number };
  /** the chat slip in flight, if any */
  flight: { u: number; pos: P3; tilt: number } | null;
  step: { amount: number; ids: readonly FocusId[] };
}

const folderN = (n: number): FolderLayout => FOLDERS[n - 1];
/** Where the lamp aims for a folder: its top sheet's centre. */
export const aimOf = (n: number): P3 => {
  const fl = folderN(n);
  return [fl.c[0], fl.c[1] - 6, stackTop(fl)];
};

/** The focus step-down at f (as state.ts stepAt, over act one's beats). */
export function actOneStep(f: number): ActOneState['step'] {
  for (const b of FOCUS_A) {
    if (f < b.from || f >= b.to + STEP_FRAMES) continue;
    const amount = Math.min(easings.inOutSine(clamp((f - b.from) / STEP_FRAMES)), 1 - easings.inOutSine(clamp((f - b.to) / STEP_FRAMES)));
    return { amount, ids: b.step };
  }
  return { amount: 0, ids: [] };
}

/** The state of act one at film frame f (pure). */
export function actOneAt(f: number): ActOneState {
  // the lamp: the current visit and the one before it; the head swings on spring-heavy
  let k = 0;
  while (k + 1 < LAMP_VISITS.length && LAMP_VISITS[k + 1][0] <= f) k++;
  const [t0, n] = LAMP_VISITS[k];
  const prev = k > 0 ? LAMP_VISITS[k - 1][1] : n;
  const sw = springAt(f, t0, SPRING.heavy);
  const a0 = aimOf(prev);
  const a1 = aimOf(n);
  const aim: P3 = [a0[0] + (a1[0] - a0[0]) * sw, a0[1] + (a1[1] - a0[1]) * sw, a0[2] + (a1[2] - a0[2]) * sw];

  const folders = FOLDERS.map((fl): FolderState => {
    const arrive = ARRIVE[fl.n] ?? -Infinity;
    const present = f < arrive ? 0 : arrive === -Infinity ? 1 : springAt(f, arrive, SPRING.heavy);
    let warmth: number;
    if (n === fl.n && f >= t0) warmth = 1;
    else {
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
    const pen = below(PEN_ON);
    const flag = present < 1 ? 0 : below(FLAG_UP);
    const stroke = ((Math.floor(f / (BEAT / 2)) + fl.n * 3) % 8) / 7;
    return { warmth, pen, stroke, flag, present };
  });

  const loopTight = springAt(f, cue('chore-switch').frame, SPRING.settle);
  const closed = springAt(f, cue('hub').frame, SPRING.detent);
  const loop: LoopPose = { ...LOOP_A, a: LOOP_A.a + LOOP_SLACK * (1 - loopTight), b: LOOP_A.b + LOOP_SLACK * (1 - loopTight), closed };
  const chores = {
    loop: loopTight,
    key: springAt(f, cue('chore-prompt').frame, SPRING.dock),
    glass: springAt(f, cue('chore-wait').frame, SPRING.dock),
    strut: springAt(f, cue('chore-keep').frame, SPRING.dock),
  };

  // the chat slip in flight: 3 f anticipation, a 12 f arc
  const u = (f - FLIGHT.posted - 3) / 12;
  const flight =
    u > 0 && u < 1
      ? {
          u,
          pos: [FLIGHT.from[0] + (FLIGHT.to[0] - FLIGHT.from[0]) * u, FLIGHT.from[1] + (FLIGHT.to[1] - FLIGHT.from[1]) * u, FLIGHT.from[2] + (FLIGHT.to[2] - FLIGHT.from[2]) * u + 4 * FLIGHT.apex * u * (1 - u)] as P3,
          tilt: 0.35 * Math.sin(u * Math.PI * 2),
        }
      : null;

  return { f, lamp: { n, aim, bulb: BULB_A.level }, folders, loop, chores, flight, step: actOneStep(f) };
}

/** Your desk's pose in act one: shifted north-east, the lamp reaching up to the folder it attends. */
export function youPoseA(a: ActOneState): YouPose {
  const [sx, sy] = YOU_SHIFT_A;
  const aimL: P3 = [a.lamp.aim[0] - sx, a.lamp.aim[1] - sy, a.lamp.aim[2]];
  const base = LAMP.base;
  const c: P2 = [LOOP_A.c[0] - sx, LOOP_A.c[1] - sy];
  const head: P3 = [c[0] + (aimL[0] - c[0]) * HEAD_A.k, c[1] + (aimL[1] - c[1]) * HEAD_A.k, HEAD_A.z];
  // the in-tray stands empty in act one (nobody answers you yet: replies land there from beat 3 on)
  return { shift: YOU_SHIFT_A, lamp: { base, elbow: lampElbow(base, head, HEAD_A.pole), head, aim: aimL }, bulb: a.lamp.bulb, bulbOut: BULB_A.out, strut: 'lid', held: { key: a.chores.key, glass: a.chores.glass, strut: a.chores.strut }, inTray: true, inTraySlip: false };
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
// Light: footprints and pools

/** Every footprint of act one at a state. */
export function actOneFootprints(a: ActOneState): Footprint[] {
  const fp: Footprint[] = [...youFootprints(youPoseA(a))];
  // the loop: chords of its tape (paper just off the slate) and the clip
  const L = a.loop;
  const N = 24;
  for (let i = 0; i < N; i++) {
    const p = loopPoint(L, (i / N) * Math.PI * 2);
    const q = loopPoint(L, ((i + 1) / N) * Math.PI * 2);
    fp.push(segFp([p[0], p[1], L.z], [q[0], q[1], L.z], L.w / 2 - 1));
  }
  const cp = loopPoint(L, L.clipAt);
  fp.push(circleFp(cp, 26, 0, 7.8, 0.9));
  // the folders: cover and stack, the pen arm, a raised flag
  FOLDERS.forEach((fl, i) => {
    const s = a.folders[i];
    if (s.present <= 0) return;
    fp.push({ kind: 'rect', c: fl.c, h: [fl.w / 2, fl.d / 2], r: 3, rot: fl.rot, z0: 0, z1: stackTop(fl) - 0.1, contact: 0.8 });
    const pv = folderPoint(fl, penPivot(fl));
    const nib = penWorld(fl, s);
    fp.push(segFp([pv[0], pv[1], stackTop(fl) + PEN.post], nib, 2.6));
    if (s.flag > 0.05) {
      const h = folderPoint(fl, flagHinge(fl));
      const top = flagTop(fl, s.flag);
      fp.push(segFp([h[0], h[1], stackTop(fl) + 1], top, 1.6));
      fp.push(segFp(top, [top[0] - FLAG.plate[0] * Math.sin(fl.rot), top[1] + FLAG.plate[0] * Math.cos(fl.rot), top[2] - 2], FLAG.plate[1] / 2));
    }
  });
  // the feeders that exist in act one (the Thread's spool comes later)
  fp.push(circleFp(rectC(FEEDERS.chat), (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2, 0, FEEDER_H.chat, 1));
  fp.push(...ciHopperFootprints());
  const G = GENERIC_FEEDERS;
  fp.push(rectFp(G.mailBox, 0, G.mailH, 1, 6));
  fp.push({ kind: 'rect', c: G.envelope.c, h: [G.envelope.w / 2, G.envelope.d / 2], r: 2, rot: G.envelope.rot, z0: G.envelope.z - 0.3, z1: G.envelope.z + 0.6, contact: 0 });
  fp.push(rectFp(G.pad, 0, G.padH, 1, 6));
  fp.push({ kind: 'rect', c: G.leaf.c, h: [G.leaf.w / 2, G.leaf.d / 2], r: 2, rot: G.leaf.rot, z0: 0.1, z1: 0.9, contact: 0.3 });
  // the heap and the request
  for (const p of HEAP) {
    const [w, d] = PIECE[p.kind];
    fp.push({ kind: 'rect', c: p.c, h: [w / 2, d / 2], r: 2, rot: p.rot, z0: p.z - 0.3, z1: p.z + 0.5, contact: 0.45 });
  }
  const R = REQUEST_A;
  fp.push({ kind: 'rect', c: R.c, h: [R.l / 2, R.w / 2], r: 2, rot: R.rot, z0: R.z - 0.3, z1: R.z + 0.5, contact: 0.45 });
  if (a.flight) {
    const [w, d] = PIECE.chat;
    fp.push({ kind: 'rect', c: [a.flight.pos[0], a.flight.pos[1]], h: [w / 2, d / 2], r: 3, rot: -0.5, z0: a.flight.pos[2] - 1, z1: a.flight.pos[2] + 1, contact: 0 });
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
