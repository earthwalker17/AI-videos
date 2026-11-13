/**
 * The summary at the sign-off rest (film frames from SEAM_D, f5424; STORYBOARD 11.1, still (d) at f5520):
 * the whole system at 0.64×, the request's route traced once (vermilion out, green home through the
 * Register), the proposed parts east in vellum, the open problems in pencil. Pure: layout and state of
 * what the summary adds, as a function of the film frame and the cue sheet's events.
 */
import { clamp, easings } from '@aiv/core';
import { Curve, type CamPose } from '@aiv/remotion-kit';
import { cue } from '../cues.ts';
import { EASE_OUT_D, FRAMING_D, cameraAt, deskCamera, project, screenToDesk, type Angle } from './camera.ts';
import { BAYS, BELT, BENCH, CHUTE, DECK, DISPATCH_HOUSING, FEEDERS, FOLDER, FRESH, GATE, GROOVES, INDEX, LEG_STRUTS, RAMP, REEL, SPIKE, TAPE, TAPE_FLAT_X1, THROAT, WINDOW, YOU, rectC, type P2, type P3, type Pool } from './layout.ts';
import { DETENT, SPRING, STEP_FRAMES, deskStateAt, springAt, type DeskState, type FocusId } from './state.ts';
import { BEAT_11 } from '../cues.ts';
import { COLLAR, SETTLE, STEP_11, TAB_FLAT, cardNotchAt, hopperAt, nextReplies, plateLands, readLampAt, retireLiftOf } from './beat11.ts';
import { hopTargets } from './beat6.ts';
import { REPLY_0405 } from './beat10.ts';
import { endDesk } from './end.ts';

/**
 * Where the summary's world takes over from act two's (desk/film.ts SEGMENTS): inside bar 68's stillness, after the reply
 * has landed (cues.ts BEAT_10.replyLands, f5420) and before the stamp lifts (f5431), so the hand-over is never mid-motion.
 * beat5.ts E5.until and beat6.ts E6.until follow it (beat5.test, beat6.test hold them equal).
 */
export const SEAM_D = 5424;
/** The frames the summary's world is posed for (the sign-off, the rest, the idea labels). */
export const SPAN_D: readonly [number, number] = [SEAM_D, 5720];

/** The stamp touches the reply (cues.ts 'stamp', f5440: the contact frame, the score's thump). */
export const STAMP_F = cue('stamp').frame;
/**
 * The route draws once, out then home, from the frame after the stamp's contact (its cause) to the frame before
 * still (d): each leg's head runs at an even speed on screen (`traceProgress`), at most about 900 px/s at 1080p
 * through the camera's ease-out (summary.test.ts). The score's scratching drag follows these frames.
 */
export const TRACE_F = { out: [STAMP_F, STAMP_F + 46] as const, home: [STAMP_F + 46, STAMP_F + 78] as const } as const;

/**
 * The whole desk at 0.64× (camera.ts FRAMING_D) and bar 69's downbeat (the stamp): the camera eases out from the Register
 * at 0.85× (FRAMING_B, where bar 65 left it) to the whole desk, settled three beats later so the labels can land on a still
 * frame before still (d) (camera.ts EASE_OUT_D, one of CAMERA_MOVES: the summary poses through the film's one camera).
 */
export { EASE_OUT_D, FRAMING_D };
export const poseD = (f: number, angle: Angle): CamPose => cameraAt(f, angle);
/**
 * The labels round the ease-out (TREATMENT Camera: labels that would move more than 40 px exit and re-enter): the ones in
 * view fade out over the stamp's 6 f, and once the camera has settled each leader draws (6 f) and its label (still (d)'s
 * LABELS_D, desk/film.ts) wipes in (8 f), 2 f apart. The labels in view before the stamp are act two's (film.ts
 * summaryLabelsAt), so the seam (SEAM_D) changes none of them.
 */
export function summaryLabelAt(f: number, i: number): { opacity?: number; leader?: number; wipe?: number } | null {
  if (f < STAMP_F) return {};
  if (f < STAMP_F + 6) return { opacity: 1 - (f - STAMP_F) / 6 };
  const enter = EASE_OUT_D.to + 2 + 2 * i;
  if (f < enter) return null;
  const leader = clamp((f - enter) / 6);
  const wipe = clamp((f - enter - 6) / 8);
  return wipe >= 1 ? {} : { leader, wipe };
}

// ------------------------------------------------------------------------------------------------
// State: at the sign-off every bay has capped (its work light out) and steps down; the trace is the
// one thing that moves (STORYBOARD 11.1), and what it does not run through steps down with it

/** What steps down as the trace draws (from the stamp, over the step ramp): the reel's face, the lock, the Slow Path, the log, the plate, the feeders. */
export const TRACE_STEP: readonly FocusId[] = ['reel', 'lock', 'policy', 'gauge', 'plate', 'fanfold', 'intake'];
/** The focus pull leads the camera (TREATMENT Focus: by 4-6 f): what the route skips starts stepping down 5 f before the ease-out. */
export const FOCUS_LEAD = 5;

// ------------------------------------------------------------------------------------------------
// Your stamp (STORYBOARD 11.1, TREATMENT Relationships "Stamp"): act two's desk has none, so in the summary's world it
// waits in a pit in your desk under a shut hatch west of the in-tray, under your lamp's hood (its leaves your desk's own
// top, so the seam and the stillness before the stamp, f5420-5431, show nothing). For the sign-off the hatch's leaves part
// (3 f, the film's slate hatches' grammar: objects/Trace.tsx), the stamp comes up out of the pit knob first (3 f, `sunk`
// to `lift` over the desk: the hatch is open before anything of it crosses the desk's top) and is carried over the tray's
// rim to the reply (5 f), the leaves shutting behind it as it leaves the hole (2 f, each leaf's edge under the stamp's
// trailing edge: the pit never shows once it has gone, session 6's critic L4-02), and presses onto the reply on spring-dock
// (5 f): its pad touches the paper on the cue (the contact frame), the spring's overshoot taken up as a 4% squash of its
// rubber. Its green spreads from the contact over 6 f (a radial ink front, never a fade). Then it lifts off and is carried
// back to its rest on the shut hatch (8 f), landing on spring-dock. A rubber stamp of the hand's size (STAMP_BODY: its
// rubber face 96 x 58 u, about 61 x 37 px at 0.64x, a strip of it showing round a graphite mount, and a turned handle in a
// mid value on a steel ferrule), so it reads as one at the whole desk by its silhouette, never as a button (session 6's
// review, C-R6: an enamel knob and a paper label tied the stamped reply for the frame's top value beside the lamp).

/** The stamp's parts (u): the rubber pad (its face, wider than the mount so its edge shows), the mount block over it, the handle's neck (stem) and its turned bulb (knob), heights stacked from the pad's underside. */
export const STAMP_BODY = { pad: { w: 96, d: 58, h: 6 }, mount: { w: 88, d: 50, h: 12 }, stem: { r: 6, h: 12 }, knob: { r: 17, h: 22 } } as const;
/** Its whole height (the knob's top over the pad's underside). */
export const STAMP_H = STAMP_BODY.pad.h + STAMP_BODY.mount.h + STAMP_BODY.stem.h + STAMP_BODY.knob.h;
/** The green it prints (u): a framed tick, about a third of the reply (REPLY_0405 104 x 72 u) and more. */
export const STAMP_PRINT = { w: 72, d: 36 } as const;

export const STAMP = {
  /**
   * the pad's centre at rest, on your desk (z: its underside): west of the in-tray, north of the blotter (its hatch clear of
   * both and inside the slab), as far north as the hatch allows, so at the bookend's framing its south edge stays over C28's
   * line (summary.test); no farther west than its 5 f carry allows (at most 46 u a frame to the mark)
   */
  rest: [YOU.inTray.x0 - 80, YOU.slab.y1 - 32, YOU.top] as P3,
  /** where it prints: the reply's south half, under its ID (objects/Trace.tsx lays the reply there, turned `turn`) */
  mark: [REPLY_0405.rest[0] - 12, REPLY_0405.rest[1] - 16] as P2,
  turn: 0.06,
  /** the pad's underside on the reply (beat10.ts REPLY_0405: where #0405 lies on top in your in-tray), a hair over it */
  paperZ: REPLY_0405.rest[2] + 0.05,
  /** how high the pad rises over the desk: clear of the in-tray's rim (18 u) */
  lift: 30,
  liftFrames: 3,
  /** how far under its rest it waits in the pit (its knob's top 2 u under the desk's), and over how many frames it comes up out of it to the lift's height */
  sunk: STAMP_H + 2,
  riseFrames: 3,
  /** the carry across (sine), from the frame its pad has cleared the desk, ending on the contact; and the carry home */
  carryFrames: 5,
  homeFrames: 8,
  /** the press runs on spring-dock: it first reaches the paper on its 3rd frame (the contact), its overshoot is the squash */
  pressFrames: 5,
  squash: 0.04,
  /** the green spreads from the contact over 6 f (the contact frame its first) */
  spread: 6,
  /** after the contact: when it lifts off (its squash nearly spent), when the carry home starts */
  liftOff: 3,
  back: 4,
} as const;
/** The press's spring starts so that it first reaches the paper on the contact frame. */
const PRESS_F = STAMP_F - 3;
const CARRY_F = STAMP_F - STAMP.carryFrames;
/** It comes up out of the pit over (RISE_F, RISE_F + riseFrames], at the lift's height as the carry starts. */
const RISE_F = CARRY_F - STAMP.riseFrames;
const BACK_F = STAMP_F + STAMP.back;
/** The landing at rest: its spring starts so that it first meets the desk as the carry home ends. */
const LAND_F = BACK_F + STAMP.homeFrames - 3;
/** The spring-dock's largest overshoot over whole frames (its squash is 4% at that overshoot). */
const DOCK_OVER = Math.max(...Array.from({ length: 16 }, (_, i) => springAt(i + 1, 0, SPRING.dock) - 1));

export interface StampPose {
  /** the pad's centre and its underside's height */
  p: P3;
  /** its turn about z (radians: square to the reply on it) */
  turn: number;
  /** its rubber's squash (0..STAMP.squash) */
  squash: number;
}
/** Your stamp at film frame f: at rest, lifting, carried, pressing, on the paper, lifting off, carried home, landing. */
export function stampAt(f: number): StampPose {
  const { rest, mark, paperZ, lift } = STAMP;
  const top = rest[2] + lift;
  const sine = (a: number, b: number) => easings.inOutSine(clamp((f - a) / (b - a)));
  const over = (start: number) => Math.max(0, springAt(f, start, SPRING.dock) - 1) / DOCK_OVER;
  // across: out to the mark, then home
  const k = sine(CARRY_F, STAMP_F) * (1 - sine(BACK_F, BACK_F + STAMP.homeFrames));
  let z: number;
  let squash = 0;
  // (up out of the pit in your desk to the lift's height)
  if (f < PRESS_F) z = rest[2] - STAMP.sunk + (STAMP.sunk + lift) * sine(RISE_F, RISE_F + STAMP.riseFrames);
  else if (f < STAMP_F + STAMP.liftOff) {
    z = top - (top - paperZ) * Math.min(1, springAt(f, PRESS_F, SPRING.dock));
    squash = STAMP.squash * over(PRESS_F);
  } else if (f < LAND_F) {
    z = paperZ + (top - paperZ) * sine(STAMP_F + STAMP.liftOff, STAMP_F + STAMP.liftOff + STAMP.liftFrames);
    // the press's last overshoot frames run on while it lifts off: a hair, never a swap
    squash = STAMP.squash * over(PRESS_F);
  } else {
    z = top - lift * Math.min(1, springAt(f, LAND_F, SPRING.dock));
    squash = STAMP.squash * over(LAND_F);
  }
  return { p: [rest[0] + (mark[0] - rest[0]) * k, rest[1] + (mark[1] - rest[1]) * k, z], turn: STAMP.turn * k, squash };
}
/** How far the green has spread from the stamp's contact (0..1: a radial ink front from the mark's centre; 1/6 on the contact frame). */
export const inkAt = (f: number): number => clamp((f - STAMP_F + 1) / STAMP.spread);
/**
 * The hatch in your desk the stamp comes up out of (objects/Trace.tsx: a pit under its rest, two leaves of your desk's own
 * top parting from the middle and sliding under it): shut through the seam and the stillness (f5420-5431), its leaves
 * moving from f5432 (open over 3 f, the stamp rising in the open hatch from the frame after), shut again over 3 f once the
 * stamp's pad has cleared the desk's top; the stamp lands home on it shut. `depth`: the pit's floor under the desk's top.
 */
export const STAMP_SLOT = { w: Math.max(STAMP_BODY.pad.w, STAMP_BODY.mount.w) + 8, d: Math.max(STAMP_BODY.pad.d, STAMP_BODY.mount.d) + 4, depth: STAMP.sunk + 4, open: RISE_F - 1, shut: CARRY_F, frames: 3, shutFrames: 2 } as const;
export const stampSlotAt = (f: number): number => easings.inOutSine(clamp((f - STAMP_SLOT.open) / STAMP_SLOT.frames)) * (1 - easings.inOutSine(clamp((f - STAMP_SLOT.shut) / STAMP_SLOT.shutFrames))) + 0;

// ------------------------------------------------------------------------------------------------
// The trace's drawing: each leg's head runs at an even speed on screen, measured through still (d)'s camera (a
// climb the 15° camera sees end-on takes no time, a run across the desk its full share), on a ramp in and out

/** The leg's arc fraction at each screen fraction (still (d)'s camera, 15°): `n` + 1 cumulative screen lengths. */
function screenTable(leg: Curve<P3>, n = 2048): Float64Array {
  const pose = deskCamera(FRAMING_D, 15);
  const s = new Float64Array(n + 1);
  let prev = project(pose, legAt(leg, 0));
  for (let i = 1; i <= n; i++) {
    const q = project(pose, legAt(leg, i / n));
    s[i] = s[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return s;
}
/** The arc fraction where a leg's screen length reaches the fraction u of its whole (still (d)'s camera). */
function arcAtScreen(table: Float64Array, u: number): number {
  const n = table.length - 1;
  const target = clamp(u) * table[n];
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid] < target) lo = mid;
    else hi = mid;
  }
  const d = table[hi] - table[lo];
  return (lo + (d > 1e-9 ? (target - table[lo]) / d : 0)) / n;
}
/**
 * The head's progress in time: an even run on screen (constant-speed transport) with a soft start and stop, its
 * speed easing in and out (sine) over the first and last DRAW_RAMP of the leg's frames, so it never jumps. The speed
 * is even in the frame's own pixels: while the camera eases out the desk shrinks on screen, so the head covers more
 * of the leg per frame as it does (each frame's share weighted by 1 / zoom).
 */
export const DRAW_RAMP = 0.09;
const drawSpeed = (x: number): number => {
  const a = DRAW_RAMP;
  const e = Math.min(x, 1 - x);
  return e >= a ? 1 : Math.sin((Math.PI * Math.max(0, e)) / (2 * a)) ** 2;
};
/** A leg's drawn screen fraction at each whole frame of its span (`n` frames), weighted by the camera's zoom. */
function drawTable(span: readonly [number, number]): Float64Array {
  const n = span[1] - span[0];
  const out = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) out[i + 1] = out[i] + drawSpeed((i + 0.5) / n) / zoomD(span[0] + i + 0.5);
  for (let i = 1; i <= n; i++) out[i] /= out[n];
  return out;
}
/** The camera's zoom at film frame f (the ease-out's, then still (d)'s). */
const zoomD = (f: number): number => FRAMING_D.zoom * (deskCamera(FRAMING_D, 15).focus / poseD(f, 15).focus);
/** A leg's drawn screen fraction at film frame f. */
function drawnAt(table: Float64Array, span: readonly [number, number], f: number): number {
  if (f <= span[0]) return 0;
  if (f >= span[1]) return 1;
  const x = f - span[0];
  const i = Math.floor(x);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

export interface SummaryState {
  f: number;
  /** how much of each leg of the route is drawn (its arc fraction, 0..1) */
  out: number;
  home: number;
  /** each leg's ink bead at its head: 1 while it draws, sinking into the bed over BEAD_FRAMES once it stops */
  bead: { out: number; home: number };
  /** your stamp, and the green's spread on the reply (0..1) */
  stamp: StampPose;
  ink: number;
}

export function summaryAt(f: number): SummaryState {
  const leg = (k: 'out' | 'home') => {
    const [a, b] = TRACE_F[k];
    return f <= a ? 0 : f >= b ? 1 : arcAtScreen(SCREEN[k], drawnAt(DRAWN[k], TRACE_F[k], f));
  };
  const bead = (k: 'out' | 'home') => 1 - easings.inOutSine(clamp((f - TRACE_F[k][1]) / BEAD_FRAMES));
  return { f, out: leg('out'), home: leg('home'), bead: { out: bead('out'), home: bead('home') }, stamp: stampAt(f), ink: inkAt(f) };
}

/** The bays (W-10 too) and the Thread cord: stepped down from the seam. */
const BAYS_CORD: readonly FocusId[] = ['docsBay', 'bugBay', 'freshBay', 'cord'];
/**
 * When the summary's step hands its held parts to the late set (exactly 1 there, as on the sets they leave: no part moves),
 * so its main set can carry beat 11's own ramps: after still (d), before the first trait plate lifts.
 */
export const RESTEP_F = 5521;
/**
 * The summary's step (continuous per part, its own ramps; desk.test holds every part's frame-to-frame change):
 * - from the seam: the bays and the cord stepped (the main set at 1); the trace's set (TRACE_STEP) on the own set, ramping
 *   in as the route draws (5 f ahead of the ease-out);
 * - from RESTEP_F: those held on the late set (the intake, which draws 'late' with the main set, keeps the own set at 1),
 *   and the main set carries beat 11's ramps, one at a time, each part handed from the late set to it at the full step:
 *   the Continuous plate ('plate') stepping up as it leaves the Register for your tray, the neck-collar gauge ('gauge') as it
 *   leaves the throat for your lamp, then 11.4's step-down of everything but your desk, your lamp and the stamped reply
 *   (beat11.ts STEP_11); between them, while the act-one card is up (11.3), the same parts a notch down (beat11.ts
 *   cardNotchAt: the card is the beat's action).
 */
export function summaryStep(f: number): DeskState['step'] {
  const ownIn = easings.inOutSine(clamp((f - (EASE_OUT_D.from - FOCUS_LEAD)) / STEP_FRAMES));
  if (f < RESTEP_F) return { amount: 1, ids: BAYS_CORD, own: { amount: ownIn, ids: TRACE_STEP } };
  const lift = retireLiftOf('continuous');
  const land = plateLands('continuous')[0]!;
  // each leaves the late set as its own ramp takes it (and is not stepped once it has landed on your desk)
  const gone = (x: FocusId): boolean => (x === 'gauge' && f >= COLLAR.from) || (x === 'plate' && f > lift);
  const late = [...BAYS_CORD, ...TRACE_STEP.filter((x) => x !== 'intake' && !gone(x))];
  const own = { amount: 1, ids: ['intake'] as FocusId[] };
  let main: { amount: number; ids: readonly FocusId[] } = { amount: 0, ids: [] };
  if (f > lift && f < land) main = { amount: 1 - easings.inOutSine((f - lift) / (land - lift)), ids: ['plate'] };
  else if (cardNotchAt(f) > 0) main = { amount: cardNotchAt(f), ids: STEP_11 };
  else if (f >= COLLAR.from && f < COLLAR.to) main = { amount: 1 - easings.inOutSine((f - COLLAR.from) / (COLLAR.to - COLLAR.from)), ids: ['gauge'] };
  else if (f >= BEAT_11.stepDown) main = { amount: easings.inOutSine(clamp((f - BEAT_11.stepDown) / STEP_FRAMES)), ids: STEP_11 };
  return { ...main, own, late };
}

/** Act two's last two frames (the seam's other side), computed once. */
let actTwoLast: [DeskState, DeskState] | null = null;
const lastOfActTwo = (): [DeskState, DeskState] => (actTwoLast ??= [deskStateAt(SEAM_D - 1), deskStateAt(SEAM_D - 2)]);

/**
 * Recall's reading thread wound back in (beat11.ts SETTLE.thread): its head runs back along it at an even pace, the shuttle
 * at the head, each hop's "№" tab folding down flat as the head passes it; the shuttle sinks into the new row once it is home.
 */
export function threadWoundAt(f: number, t: NonNullable<DeskState['e6']['thread']> | null): DeskState['e6']['thread'] {
  const W = SETTLE.thread;
  if (!t || f <= W.from) return t;
  const seg = t.pts.slice(1).map((p, i) => Math.hypot(p[0] - t.pts[i]![0], p[1] - t.pts[i]![1], p[2] - t.pts[i]![2]));
  const at = [0, ...seg.map((_, i) => seg.slice(0, i + 1).reduce((a, b) => a + b, 0))];
  const L = at[at.length - 1]!;
  const head = L * (1 - easings.inOutSine(clamp((f - W.from) / W.frames)));
  // each tab sits where its hop landed (beat6.ts hopTargets 1-3): the head passes back over the thread's point nearest it
  const ends = hopTargets()
    .slice(1)
    .map((q) => {
      let best = 0;
      t.pts.forEach((p, i) => {
        if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < Math.hypot(t.pts[best]![0] - q[0], t.pts[best]![1] - q[1], t.pts[best]![2] - q[2])) best = i;
      });
      return at[best]!;
    });
  const passed = (d: number): number => {
    // the frame the head passes arc length d (inverse of the ramp, by search)
    for (let g = W.from; g <= W.from + W.frames; g++) if (L * (1 - easings.inOutSine(clamp((g - W.from) / W.frames))) <= d) return g;
    return W.from + W.frames;
  };
  // each tab folds down flat onto the body it landed on (a read mark: it lies there, beat11.ts TAB_FLAT), never edge-on into it
  const tabs = t.tabs.map((k, i) => (k <= TAB_FLAT ? k : TAB_FLAT + (k - TAB_FLAT) * (1 - easings.inOutSine(clamp((f - passed(ends[i]! - 1)) / W.fold)))));
  const home = W.from + W.frames;
  if (f >= home + W.sink) return { pts: [t.pts[0]!], shuttle: null, tabs };
  const pts: P3[] = [];
  for (let i = 0; i < t.pts.length; i++) {
    if (at[i]! < head) pts.push(t.pts[i]!);
    else {
      const a = t.pts[Math.max(0, i - 1)]!;
      const b = t.pts[i]!;
      const k = at[i]! - at[Math.max(0, i - 1)]! > 1e-9 ? (head - at[Math.max(0, i - 1)]!) / (at[i]! - at[Math.max(0, i - 1)]!) : 0;
      pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
      break;
    }
  }
  const tip = pts[pts.length - 1]!;
  // it comes up out of what the head lies on as the winding starts, and sinks into the new row once it is home
  const sunk = 1 - clamp((f - W.from) / W.sink) + clamp((f - home) / W.sink);
  return { pts: pts.length >= 2 ? pts : [pts[0]!, pts[0]!], shuttle: [tip[0], tip[1], tip[2] - 4 * sunk], tabs };
}

/**
 * The docs galley at f (its own motion, one line every 160 f): act two's 5423 value through the stillness if act two holds
 * it there, then back onto its own clock by still (d)'s frame, never a jump (a speed change under the ease-out).
 */
function galleyAt(f: number, last: number, prev: number, own: number): number {
  const held = last === prev;
  if (!held) return own;
  if (f < STAMP_F) return last;
  const at = (g: number) => ((((g - 2000) % 160) + 160) % 160) / 160;
  let off = last - at(STAMP_F);
  off -= Math.round(off);
  const v = at(f) + off * (1 - easings.inOutSine(clamp((f - STAMP_F) / (STILL_D_F - 1 - STAMP_F))));
  return v - Math.floor(v);
}
/** Still (d)'s frame (lookdev/frames.ts ROUND2.stillD). */
const STILL_D_F = 5520;

/**
 * The desk's state from the seam: act two's last frame where what act two built lasts (the window and its tape as beat 6
 * left them, #0408's tab filed in the drawer, the hopper folded, the starter key, the spike and its pile, beat 7's parts at
 * rest; the 7.4 chat reply in your in-tray), settling into still (d)'s under the stamp (beat11.ts SETTLE: the reading lamp
 * dims, the reading thread is wound in, the worded plates turn over into their pictogram plates); every bay capped and
 * stepped down, their work lights out, the index arm at your detent; then beat 11 (beat11.ts beat11At).
 */
export function summaryDeskState(f: number): DeskState {
  const s = deskStateAt(f);
  const [a, a2] = lastOfActTwo();
  const e11 = s.e11;
  // the 7.4 chat reply lies on in your in-tray (beat 7's own list ends at the seam)
  const lasting = a.replies.filter((r) => r.id === '7-chat' && !s.replies.some((x) => x.id === r.id));
  // from bar 76 the end acts on it (end.ts endDesk: the bookend's step-up, the heap pressed away, the head's stamp; the
  // very same state before f6000)
  return endDesk(f, {
    ...s,
    // bar 68's reply came down the chute to you: the arm rests at your detent
    arm: DETENT.you,
    testsLight: 0,
    testsStep: 1,
    bugLight: 0,
    // the request's bay finished in bar 68: every pin passed, dead still
    pins: s.pins.map(() => 1),
    next: { ...s.next, light: 0 },
    // the next replies come down the chute in 11.4 and wait queued in it (beat11.ts NEXT_REPLIES)
    replies: [...s.replies, ...lasting, ...nextReplies(f)],
    galley: galleyAt(f, a.galley, a2.galley, s.galley),
    step: summaryStep(f),
    // the window, its tape and the drawer as act two left them; the Register's hooded lamp dims on the stamp (the one lit
    // paper is the slip your stamp signed) and its hopper swings back up for the next report
    cache: a.cache ? { ...a.cache, lamp: readLampAt(f), hopper: hopperAt(f, a.cache.hopper) } : s.cache ? { ...s.cache, lamp: readLampAt(f) } : null,
    // the starter key, the spike and its pile where beat 5 left them; the worded Proactive plate until it lifts (beat 11 flies it)
    e5: { ...s.e5, key: a.e5.key, spike: a.e5.spike, slips: a.e5.slips, pile: a.e5.pile, plate: e11?.plates.proactive ? null : a.e5.plate },
    // the tape's advance and rewind and the Thread's row as beat 6 left them; recall's reading thread wound back in
    e6: { ...s.e6, advance: a.e6.advance, rewind: a.e6.rewind, threadRow: a.e6.threadRow, thread: threadWoundAt(f, a.e6.thread) },
    // beat 7's parts at rest as act two left them (the cord, the Thread's gate open on the bay's north wall: the full-duplex
    // door 11.2 names, the job rail and its glass, the notices on the tape); the worded Productive plate until it lifts
    e7: a.e7 ? { ...a.e7, plate: e11?.plates.productive ? null : a.e7.plate } : null,
  });
}

// ------------------------------------------------------------------------------------------------
// The route, as the request took it: inked into the beds of the channels it used (world points just
// above each bed), never across print, each leg one continuous path. Out (vermilion): the feed, under
// the gate's fingers and up the intake belt, across the throat's floor into the print head (hidden in
// it), out along the window's north bar, round the reel's rim where the tape winds on, over the dispatch
// housing, down the ramp's north lane and the groove's east lane, over the bay's door and the bench to
// the request's folder. Home (green): from the folder over the bench and the door, up the groove's west
// lane and the ramp's south lane, along the deck's east and south rails, across the deck plate onto the
// window's south bar, through the print head, over the index arm's boss and out along the arm into the
// reply chute, down onto the slip your stamp signed. The two run side by side down the ramp, the groove
// and through the door, red on the outside of every turn they share, so they never cross.
//
// Each leg is one kit Curve (centripetal Catmull-Rom: no overshoot between unevenly spaced points)
// through its waypoints, drawn by arc length (objects/Trace.tsx). No two consecutive 16 u steps of it turn
// more than 60° (in plan, and on screen as still (d) sees it), every drop off a wall or an edge is ramped
// (DROP_SLOPE), and it never runs under a leg strut, so it has no right-angle steps, Z-jogs or dark wedges
// (summary.test.ts).

/** Every drop (or climb) off a wall or an edge is ramped: at least 12 u of plan per 35 u of fall. */
export const DROP_SLOPE = 35 / 12;
/** The trace's width, thick where the leg set out to thin where it arrived (u; about 7.5 to 3 px at 0.64×). */
export const TRACE_W = [12, 4.6] as const;
/** The width at arc fraction t of a leg. */
export const traceWidthAt = (t: number): number => TRACE_W[0] + (TRACE_W[1] - TRACE_W[0]) * t;

/** A point on a circle round c at radius r and angle deg (degrees from +x), at height z. */
const onArc = (c: P2, r: number, deg: number, z: number): P3 => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180), z];
const req = BAYS.bug;
/** The window's north and south bars (their tops). */
const BAR_N_Y = WINDOW.frame.y1 - WINDOW.bar / 2;
const BAR_S_Y = WINDOW.frame.y0 + WINDOW.bar / 2;
const BAR_Z = WINDOW.z[1] + 1;
const RAIL_Z = DECK.top + 1.5;
/** The south rail's middle. */
const RAIL_S_Y = DECK.y0 + DECK.rail / 2;
/**
 * The groove's two lanes (offsets from its engraved line, + east of the way down): red outside. Each is a hair
 * nearer the line by the ramp's foot (where the green's arc onto the ramp needs the room) than by the door.
 */
const LANE = { grooveOut: [6.5, 7], grooveHome: [-5.5, -3.5] } as const;
/** The bug bay's groove (as the desk engraves it, ramp foot to door) offset to one side: + is east of the way down; [by the door, by the ramp]. */
function grooveLane(lane: readonly [number, number]): P3[] {
  const line = new Curve(GROOVES.bug.map((p) => [p[0], p[1]])).polyline(12);
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // the left normal of the way down (south, then south-west): east of it
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    const k = clamp((p[1] - 130) / 30);
    const off = lane[0] + (lane[1] - lane[0]) * k * k * (3 - 2 * k);
    return [p[0] + nx * off, p[1] + ny * off, 1.4] as P3;
  });
}
/**
 * Over the bay's shut door. The deck's south-east leg strut lands on the door (layout.ts LEG_STRUTS: its
 * foot at (320, 86)), so the groove's last stretch passes under its slanted run: a lane low there is
 * hidden by it (the dark wedge the critic saw on (d)). Both lanes climb over it instead, cross the door at
 * that height (well above its wall) and ease down from there to the bench, never dipping.
 */
const OVER_DOOR_Z = 64;
/** A groove lane from below y `from` to its door end, ramped up over its last 50 u (in plan) to OVER_DOOR_Z, held over its last 10. */
function laneToDoor(lane: readonly [number, number], from: number): P3[] {
  const pts = grooveLane(lane).filter((p) => p[1] < from);
  const CLIMB = 40;
  const HOLD = 10;
  let d = 0;
  const left = pts.map((_, i) => {
    if (i > 0) d += Math.hypot(pts[pts.length - i][0] - pts[pts.length - 1 - i][0], pts[pts.length - i][1] - pts[pts.length - 1 - i][1]);
    return d;
  });
  return pts.map((p, i) => {
    const k = clamp(1 - (left[pts.length - 1 - i] - HOLD) / CLIMB);
    return [p[0], p[1], p[2] + (OVER_DOOR_Z - p[2]) * k * k * (3 - 2 * k)];
  });
}
/** The bench's top and the folder's, where the trace lies on them. */
const BENCH_Z = BENCH.z[1] + 0.9;
const FOLDER_Z = FOLDER.z[1] + 0.9;

/** The belt's line 8 u north of its middle: between the gate's fingers, and into the throat clear of its south cheek. */
const BELT_L = Math.hypot(BELT.to[0] - BELT.from[0], BELT.to[1] - BELT.from[1]);
const BELT_D: P2 = [(BELT.to[0] - BELT.from[0]) / BELT_L, (BELT.to[1] - BELT.from[1]) / BELT_L];
const beltLine = (s: number, z: number): P3 => [BELT.from[0] + BELT_D[0] * s - BELT_D[1] * 8, BELT.from[1] + BELT_D[1] * s + BELT_D[0] * 8, z];
/** The throat's floor between its cheeks (objects/Register.tsx: its block's top, 8 under the throat's top), a hair above. */
const THROAT_FLOOR_Z = THROAT.z[1] - 8 + 1.2;
/**
 * The reel's rim (its flange outside the pack, r 112 to 125) at radius 118, and the tape's rise onto the
 * pack across it (objects/Register.tsx tapeRise: the trace rides over the rise where it covers the rim).
 */
const RIM_R = 118;
const RIM_Z = REEL.flangeZ[1] + 0.6;
const TAPE_RISE = new Curve<P3>([
  [TAPE_FLAT_X1 - 2, (TAPE.y0 + TAPE.y1) / 2, TAPE.z],
  [TAPE.x1 - 6, (TAPE.y0 + TAPE.y1) / 2, TAPE.z + 6],
  [TAPE.x1 + 8, (TAPE.y0 + TAPE.y1) / 2 + 3, REEL.packZ[1] - 8],
]).polyline(24);
const rimAt = (deg: number): P3 => {
  const p = onArc([REEL.x, REEL.y], RIM_R, deg, RIM_Z);
  const x0 = TAPE_RISE[0][0];
  const x1 = TAPE_RISE[TAPE_RISE.length - 1][0];
  if (p[0] < x0 || p[0] > x1) return p;
  const i = TAPE_RISE.findIndex((q) => q[0] >= p[0]);
  const a = TAPE_RISE[Math.max(0, i - 1)];
  const b = TAPE_RISE[i];
  const z = a[2] + ((b[2] - a[2]) * (p[0] - a[0])) / Math.max(1e-6, b[0] - a[0]);
  // (the rise is swept in 8 straight steps: its chords sit a hair above the curve)
  return [p[0], p[1], Math.max(RIM_Z, z + 1.5)];
};
/** Off the north bar onto the rim: a right-hand arc of radius 30 tangent to the bar and to the rim. */
const BAR_TO_RIM = (() => {
  const r = 30;
  const c: P2 = [REEL.x - Math.sqrt((RIM_R + r) ** 2 - (REEL.y - (BAR_N_Y - r)) ** 2), BAR_N_Y - r];
  const meet = (Math.atan2(REEL.y - c[1], REEL.x - c[0]) * 180) / Math.PI;
  return { c, r, meet, rim: meet - 180 };
})();
// ------------------------------------------------------------------------------------------------
// The ramp, as still (d) sees it. Its quarter pipe drops from a vertical face the camera never sees (its top
// edge hides the face and the pipe's steep first units), so a lane inked into the pipe at one plan line would
// break at the edge into a jog. Both legs' ramp sections are therefore designed on still (d)'s screen, as
// straight runs joined by circular fillets (`filleted`, radii in px), and each sample is laid onto the first
// surface its pixel's ray meets (`onBed`): the rail and housing tops, the gusset, the pipe, the desk. Where the
// ray grazes the ramp's top edge the leg passes from the rail onto the pipe along that ray, unseen.

/** Still (d)'s settled camera, on whose screen the ramp sections are designed. */
const POSE_STILL_D = deskCamera(FRAMING_D, 15);
/** The ink's height over the bed it lies in. */
const TRACE_LIFT = 1.5;
/** The quarter pipe's surface height u out from the rail (0..lip). */
const pipeZ = (u: number): number => RAMP.lip - Math.sqrt(Math.max(0, RAMP.lip ** 2 - (clamp(u, 0, RAMP.lip) - RAMP.lip) ** 2));
/** The enamel gusset on the rails' south-east corner (objects/Register.tsx: 22 u square, 2.5 u proud). */
const GUSSET = { x0: LEG_STRUTS[1].top[0] - 11, x1: LEG_STRUTS[1].top[0] + 11, y0: LEG_STRUTS[1].top[1] - 11, y1: LEG_STRUTS[1].top[1] + 11, z: DECK.top + 2.5 } as const;
/** The cheeks stand 3 u over the pipe, 6 u wide on its north and south edges. */
const CHEEK = { w: 6, h: 3 } as const;
/** The top of what lies at (x, y) round the ramp: the gusset, the east and south rails, the pipe and its cheeks, the dispatch housing, else the desk. */
export function bedAt(x: number, y: number): number {
  if (x >= GUSSET.x0 && x <= GUSSET.x1 && y >= GUSSET.y0 && y <= GUSSET.y1) return GUSSET.z;
  const onE = x >= DECK.x1 - DECK.rail && x <= DECK.x1 && y >= DECK.y0 && y <= DECK.y1;
  const onS = y >= DECK.y0 && y <= DECK.y0 + DECK.rail && x >= DECK.x0 && x <= DECK.x1;
  if (onE || onS) return DECK.top;
  const u = x - RAMP.x;
  if (u > 0 && u <= RAMP.lip && y >= RAMP.y0 && y <= RAMP.y1) return pipeZ(u) + (y < RAMP.y0 + CHEEK.w || y > RAMP.y1 - CHEEK.w ? CHEEK.h : 0);
  const H = DISPATCH_HOUSING;
  if (x >= H.box.x0 && x <= H.box.x1 - 4.2 && y >= H.box.y0 && y <= H.box.y1) return H.z[1];
  return 0;
}
/** The point a screen point (CSS px) shows of the bed round the ramp through still (d)'s camera, the ink's lift over it. */
export function onBed(s: P2): P3 {
  const at = (z: number) => screenToDesk(POSE_STILL_D, s, z);
  const below = (z: number) => {
    const p = at(z);
    return z <= bedAt(p[0], p[1]) + TRACE_LIFT;
  };
  // march down the ray from above everything here to the first surface it meets, then close in on it
  let hi = DECK.top + 8;
  let lo = hi;
  while (!below(lo)) {
    hi = lo;
    lo -= 0.25;
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (below(mid)) lo = mid;
    else hi = mid;
  }
  // the point just above the surface: on a step's edge, the top of the step
  return at(hi);
}
/**
 * A screen path through `pts` (CSS px): straight runs, each interior corner rounded by a circular arc of radius
 * `radii[i - 1]` px tangent to both runs, sampled about every `step` px (its corners' tangent points included).
 */
export function filleted(pts: readonly P2[], radii: readonly number[], step = 2): P2[] {
  const dir = (a: P2, b: P2): P2 => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  // each corner's tangent points and arc
  const arcs = radii.map((r, k) => {
    const [a, b, c] = [pts[k], pts[k + 1], pts[k + 2]];
    const d0 = dir(a, b);
    const d1 = dir(b, c);
    const turn = Math.acos(clamp(d0[0] * d1[0] + d0[1] * d1[1], -1, 1));
    const t = r * Math.tan(turn / 2);
    if (t > Math.hypot(b[0] - a[0], b[1] - a[1]) + 1e-6 || t > Math.hypot(c[0] - b[0], c[1] - b[1]) + 1e-6) throw new Error(`filleted: corner ${k + 1}'s arc (${t.toFixed(1)} px each way) overruns its runs (${[a, b, c].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')})`);
    const side = Math.sign(d0[0] * d1[1] - d0[1] * d1[0]) || 1;
    const t0: P2 = [b[0] - d0[0] * t, b[1] - d0[1] * t];
    const centre: P2 = [t0[0] - d0[1] * r * side, t0[1] + d0[0] * r * side];
    return { t0, t1: [b[0] + d1[0] * t, b[1] + d1[1] * t] as P2, centre, r, turn, side };
  });
  for (let k = 1; k < arcs.length; k++) {
    const run = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
    const used = Math.hypot(arcs[k - 1].t1[0] - pts[k][0], arcs[k - 1].t1[1] - pts[k][1]) + Math.hypot(pts[k + 1][0] - arcs[k].t0[0], pts[k + 1][1] - arcs[k].t0[1]);
    if (used > run + 1e-6) throw new Error(`filleted: corners ${k} and ${k + 1} overlap`);
  }
  const out: P2[] = [];
  const line = (a: P2, b: P2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = out.length ? 1 : 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  };
  let from = pts[0];
  for (const a of arcs) {
    line(from, a.t0);
    const a0 = Math.atan2(a.t0[1] - a.centre[1], a.t0[0] - a.centre[0]);
    const n = Math.max(2, Math.ceil((a.r * a.turn) / step));
    for (let i = 1; i <= n; i++) {
      const ang = a0 + a.side * a.turn * (i / n);
      out.push([a.centre[0] + a.r * Math.cos(ang), a.centre[1] + a.r * Math.sin(ang)]);
    }
    from = a.t1;
  }
  line(from, pts[pts.length - 1]);
  return out;
}
/**
 * A ribbon edge's height where its leg lies on the ramp's pipe: on the pipe itself at the edge's x (a flat
 * ribbon across the pipe's slope would half sink into it). Undefined off the pipe (the ribbon stays flat there).
 */
export function rampEdgeZ(p: P3, x: number): number | undefined {
  const u = p[0] - RAMP.x;
  if (u < 3 || u > RAMP.lip || p[1] < RAMP.y0 + CHEEK.w || p[1] > RAMP.y1 - CHEEK.w) return undefined;
  if (Math.abs(p[2] - pipeZ(u) - TRACE_LIFT) > 0.75) return undefined;
  return pipeZ(Math.max(3, x - RAMP.x)) + TRACE_LIFT;
}

/** A point's place on still (d)'s screen. */
const onD = (p: P3): P2 => project(POSE_STILL_D, p);
/** Where two screen lines meet: one through a along da, one through b along db. */
function meet(a: P2, da: P2, b: P2, db: P2): P2 {
  const den = da[0] * db[1] - da[1] * db[0];
  const t = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / den;
  return [a[0] + da[0] * t, a[1] + da[1] * t];
}
const unit = (a: P2, b: P2): P2 => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
/**
 * The ramp sections on still (d)'s screen (RAMP_D). The green leaves the groove's west lane in one arc of
 * `home` px that carries it up onto the pipe south of the pipe's middle, over the apex and on down-left over
 * the ramp's top edge onto the east rail (about 170°: no hairpin); it runs down the rail at `slant` (on screen) onto
 * the gusset and bends onto the south rail in an arc of `corner` px (75°: no right-angle elbow). The red comes in over the housing and the
 * rail, tangent to the circle `out` px round the same centre, down the pipe north of its middle and round into
 * the groove's east lane outside the green. The beds round the ramp's south-east corner leave no wider arcs:
 * the rails are 18 u wide and the gusset reaches 5 u past their inner corner.
 */
export const RAMP_D = { home: 22, corner: 17, out: 29, apexY: 453, slant: (75 * Math.PI) / 180, homeFrom: 164, outFrom: 162 } as const;
/** The groove's lanes where the ramp sections meet them (the red leaves the ramp onto its east lane, the green leaves its west lane onto the ramp). */
const OUT_GROOVE = laneToDoor(LANE.grooveOut, RAMP_D.outFrom);
const HOME_GROOVE = laneToDoor(LANE.grooveHome, RAMP_D.homeFrom).reverse();
/**
 * The green's big arc on still (d)'s screen: it leaves the groove's straight run (its engraved line up from the
 * bend at the ramp's foot) at g0, crosses the apex line at a1, and its centre, which the red's arc shares.
 */
const GREEN_ARC = (() => {
  const g0 = onD(HOME_GROOVE[HOME_GROOVE.length - 1]);
  const up = unit(onD([...GROOVES.bug[1], 0]), onD([...GROOVES.bug[0], 0]));
  const a1 = meet(g0, up, [0, RAMP_D.apexY], [-1, 0]);
  const t1 = RAMP_D.home * Math.tan(Math.acos(-up[0]) / 2);
  return { g0, a1, t1, centre: [a1[0] - t1, RAMP_D.apexY + RAMP_D.home] as P2 };
})();
const RAMP_HOME: P3[] = (() => {
  const R = RAMP_D.home;
  const { g0, a1, t1 } = GREEN_ARC;
  const end = onD([200, RAIL_S_Y - 3, RAIL_Z]);
  const slant: P2 = [-Math.cos(RAMP_D.slant), Math.sin(RAMP_D.slant)];
  // up the groove; along the apex (left); down-left at the slant; along the south rail (left). The two corners at
  // the apex share one arc (their tangent runs meet), so the green turns in one arc from the groove to the slant
  const a2: P2 = [a1[0] - t1 - R * Math.tan(RAMP_D.slant / 2), RAMP_D.apexY];
  const b = meet(a2, slant, end, [-1, 0]);
  return filleted([g0, a1, a2, b, end], [R, R, RAMP_D.corner]).slice(1).map(onBed);
})();
const RAMP_OUT: P3[] = (() => {
  const r0: P3 = [205, 226, 120.8];
  const s0 = onD(r0);
  const e = onD(OUT_GROOVE[0]);
  const lane = unit(onD([...GROOVES.bug[0], 0]), onD([...GROOVES.bug[1], 0]));
  // from the housing, tangent to the circle round the green's arc's centre (passing over it)
  const c = GREEN_ARC.centre;
  const heading = Math.atan2(c[1] - s0[1], c[0] - s0[0]) - Math.asin(RAMP_D.out / Math.hypot(c[0] - s0[0], c[1] - s0[1]));
  const k = meet(s0, [Math.cos(heading), Math.sin(heading)], e, lane);
  return [r0, ...filleted([s0, k, e], [RAMP_D.out]).slice(1, -1).map(onBed)];
})();

/** Where the red's nib comes to rest: on the folder's north margin, just north of the request (never across its print). */
const NIB_OUT: P3 = [336, 1.5, FOLDER_Z];

export const ROUTE_OUT: readonly P3[] = [
  // from the chat spout's mouth along the feed (south of its slip's bubble mark, never across print), south of the
  // spike's dropped noise, onto the belt's line
  [rectC(FEEDERS.chat)[0] + 70, rectC(FEEDERS.chat)[1] - 20, 4],
  [-795, 395, 3],
  [-712, 368, 3],
  [-645, 343, 3],
  // under the gate's fingers, through its bar, up the belt's bed
  beltLine(-36, 3),
  beltLine(0, BELT.from[2] + 2),
  beltLine(BELT_L / 2, (BELT.from[2] + BELT.to[2]) / 2 + 4),
  beltLine(BELT_L - 16, BELT.to[2] + 2 - (16 * (BELT.to[2] - BELT.from[2])) / BELT_L),
  // lifting off the belt's top into the throat's mouth at its floor's height (the belt runs on under it), across the
  // floor (under the neck collar), into the print head (hidden in it), out onto the north bar
  beltLine(BELT_L, THROAT_FLOOR_Z),
  [-374, 212.5, THROAT_FLOOR_Z + 0.4],
  [-358, 213, THROAT_FLOOR_Z + 1],
  [-343, 218, 121.8],
  [-330, 228, 126],
  [-319, 242, 130],
  [-309, 254, 133],
  [-299, 261, 134],
  [-285, BAR_N_Y + 0.2, BAR_Z],
  [-262, BAR_N_Y, BAR_Z],
  [-150, BAR_N_Y, BAR_Z],
  [-40, BAR_N_Y, BAR_Z],
  // off the window's corner onto the reel's rim (north of the stub on the tape), round it where the tape winds on
  onArc(BAR_TO_RIM.c, BAR_TO_RIM.r, 90, BAR_Z - 1),
  onArc(BAR_TO_RIM.c, BAR_TO_RIM.r, 67.5, (BAR_Z - 1 + RIM_Z) / 2),
  rimAt(BAR_TO_RIM.rim),
  ...[-120, -105, -97, -90, -87, -75].map(rimAt),
  // off the rim onto the dispatch housing's top (south of the flange), over the east rail and down the ramp's
  // pipe north of its middle, round into the groove's east lane (the outside of the turn): RAMP_OUT
  [185, 225.5, RIM_Z],
  ...RAMP_OUT,
  // down the groove's east lane, up over the leg strut's foot, bearing left over the door's east half, easing
  // down over the floor to the bench, between pins 2 and 3, onto the folder
  ...OUT_GROOVE.slice(0, -1),
  [305.5, 90, OVER_DOOR_Z],
  [307.5, 82, OVER_DOOR_Z - 0.2],
  [311, 72, OVER_DOOR_Z - 1],
  [316, 58, OVER_DOOR_Z - 2.4],
  [322.5, 38, BENCH_Z + 1.2],
  [325.5, 30, BENCH_Z],
  [329, 20, BENCH_Z],
  [332, 10.5, BENCH_Z + 0.3],
  [334, 5, FOLDER_Z],
  NIB_OUT,
];
/**
 * Where the report sets out home (the green's tail): the request's folder, on its north margin west of
 * the red's nib and clear of the request's print. (Not the work slot: it is east of the door, so a green
 * from there would have to cross the red to leave through the door's west half.)
 */
export const REPORT_PORT: P3 = [FOLDER.box.x0 + 7.5, FOLDER.box.y1 - 4.5, FOLDER_Z];
/** The index arm's tip at your detent (the arm's top). */
const ARM_TIP: P3 = [INDEX.pivot[0] + (INDEX.length - 6) * Math.cos(DETENT.you), INDEX.pivot[1] + (INDEX.length - 6) * Math.sin(DETENT.you), INDEX.z + 6.5];
/** A point on the index arm's axis at your detent, t out from the pivot, on its top. */
const onArm = (t: number, z = INDEX.z + 6.6): P3 => [INDEX.pivot[0] + t * Math.cos(DETENT.you), INDEX.pivot[1] + t * Math.sin(DETENT.you), z];
/** The reply chute's bed under the trace (its trough's floor is 3 u above the path). */
const CHUTE_BED = 7;
/**
 * The signed slip in your in-tray (objects/Trace.tsx: 104 x 72 at (-520, -64)): the reply ends on its north
 * margin (between the slip's edge at y about -28 and its ID's cap line at about -39), clear of the ID.
 */
export const REPLY_END: P3 = [-522, -32, YOU.top + 7.95];
export const ROUTE_HOME: readonly P3[] = [
  REPORT_PORT,
  // north off the folder and the bench between pins 1 and 2, rising gently over the floor and the door's west half
  [299.3, 8.5, (FOLDER_Z + BENCH_Z) / 2],
  [299, 15, BENCH_Z],
  [299, 24, BENCH_Z],
  [298.5, 33, BENCH_Z],
  [297, 52, BENCH_Z + 1.5],
  [295, 72, OVER_DOOR_Z - 1],
  [293.6, 80, OVER_DOOR_Z - 0.2],
  [293, 88, OVER_DOOR_Z],
  // over the leg strut's foot, down into the groove's west lane, up it; then one arc left onto the ramp's pipe
  // south of its middle, over its top edge onto the east rail, and one arc right over the gusset onto the south
  // rail (the inside of the turn): RAMP_HOME
  ...HOME_GROOVE,
  ...RAMP_HOME,
  [150, RAIL_S_Y, RAIL_Z],
  [40, RAIL_S_Y, RAIL_Z],
  // one shallow S across the deck plate, up onto the window's south bar
  [-12, RAIL_S_Y + 2.5, RAIL_Z],
  [-45, 150, DECK.top + 2],
  [-82, 176, BAR_Z - 3.5],
  [-118, BAR_S_Y, BAR_Z],
  // west along the south bar into the print head (hidden in it), out of its south face over the index arm's boss
  [-200, BAR_S_Y, BAR_Z],
  [-282, BAR_S_Y, BAR_Z],
  [-298, BAR_S_Y - 0.5, BAR_Z],
  [-307, BAR_S_Y - 3.5, BAR_Z + 0.5],
  [-313.5, 176, BAR_Z + 2],
  [-325, 158, INDEX.z + 11.5],
  // out along the arm to its tip, off it over the chute's north lip into its bed
  onArm(18.2, INDEX.z + 7),
  onArm(33),
  onArm(48.5),
  ARM_TIP,
  [-403, 120, 122],
  [-427, 95, 108],
  // down the chute's bed, off its mouth onto the signed slip's north margin
  ...CHUTE.slice(2).map((p): P3 => [p[0], p[1], p[2] + CHUTE_BED]),
  REPLY_END,
];

/** Each leg as one curve, drawn by arc length (objects/Trace.tsx). */
export const LEGS = { out: new Curve<P3>(ROUTE_OUT), home: new Curve<P3>(ROUTE_HOME) } as const;
/** The point of a leg at arc fraction t (0..1). */
export const legAt = (leg: Curve<P3>, t: number): P3 => {
  const p = leg.pointAt(clamp(t) * leg.length);
  return [p[0], p[1], p[2]];
};
/** Each leg's screen length along it (still (d)'s camera), which the drawing head runs along evenly (`summaryAt`). */
const SCREEN = { out: screenTable(LEGS.out), home: screenTable(LEGS.home) } as const;
const DRAWN = { out: drawTable(TRACE_F.out), home: drawTable(TRACE_F.home) } as const;
/** The ink's bead at a leg's head sinks into the bed over 2 f once the leg is drawn. */
export const BEAD_FRAMES = 2;

/** The inks' albedos: lit on the desk they land on the palette's vermilion base (Y 121) and between the green's base and light (Y 182-205). */
export const TRACE_INK = { out: '#F26D4D', home: '#B6ECCB' } as const;
/**
 * The light an up-facing bed takes from the key (intensity `key` along `dir`) and the hemisphere fill
 * alone, as three's Lambert lights it (irradiance over π): about 0.74 with DeskWorld's LIGHTS.
 */
export const inkLight = (key: number, fill: number, dir: P3): number => ((key * dir[2]) / Math.hypot(dir[0], dir[1], dir[2]) + fill) / Math.PI;
/**
 * How much of its albedo the ink keeps at a point, so that a light pool lifts it at most INK_HOLD over its
 * value lit by the key and fill alone (your lamp would otherwise wash the green home to white where it
 * lands). `k`: that key-and-fill light (inkLight); the pools add on top, as the lit materials add them
 * (gl/light.ts dskPool, gl/materials.ts), by luminance.
 */
export const INK_HOLD = 1.2;
export function poolLift(p: P3, pools: readonly Pool[]): number {
  let s = 0;
  for (const q of pools) {
    if (p[2] < q.z[0] || p[2] > q.z[1]) continue;
    const dx = (p[0] - q.c[0]) / q.sigma[0];
    const dy = (p[1] - q.c[1]) / q.sigma[1];
    s += (0.2126 * q.rgb[0] + 0.7152 * q.rgb[1] + 0.0722 * q.rgb[2]) * Math.exp(-0.5 * (dx * dx + dy * dy));
  }
  return s;
}
export const inkHold = (p: P3, pools: readonly Pool[], k: number): number => Math.min(1, (INK_HOLD * k) / (k + poolLift(p, pools)));

// ------------------------------------------------------------------------------------------------
// East of the system, in vellum (proposed: STORYBOARD 9.1, 9.2) beside built graphite machines

/**
 * The graphite machines a cloud loop would keep running (built), north to south in one column, each its
 * own silhouette and at its own distance: a rack server (slot lines), a tower workstation (its vent
 * column), a closed laptop (its hinge). Each has its own daemon clip (vellum) on its west side.
 */
export const MACHINES: readonly { kind: 'server' | 'workstation' | 'laptop'; c: P2; w: number; d: number; h: number }[] = [
  { kind: 'server', c: [1250, 222], w: 150, d: 92, h: 44 },
  { kind: 'workstation', c: [1280, 92], w: 64, d: 118, h: 112 },
  { kind: 'laptop', c: [1240, -44], w: 150, d: 100, h: 13 },
];
/** Each clip's centre: 36 u west of its machine's west face. */
export const CLIP_GAP = 36;
export const clipC = (m: (typeof MACHINES)[number]): P2 => [m.c[0] - m.w / 2 - CLIP_GAP, m.c[1]];
/**
 * The vellum sheets laid flat: the plan of the deck, the state cabinet, and the cloud loop's sheet (its
 * loop and the docked lid strut drawn inside it), from whose east edge the tethers run as parallel strips,
 * one to each clip.
 */
export const VELLUM = {
  plan: { c: [930, 470] as P2, w: 240, d: 160 },
  cabinet: { c: [900, -230] as P2, w: 180, d: 140 },
  loop: { x0: 760, x1: 990, y0: -86, y1: 286 },
} as const;
/** A tether strip's width. */
export const TETHER_W = 16;
/**
 * The Watchdog: a vellum plan of an inspection station outside the system, south of the stuck bay (the fresh bay, W-10),
 * its scope and sightline aimed up at the bay and the pencil flag pinned on it. Placed for FRAMING_D so all of it stays
 * inside the diagram band while a note is up (TREATMENT, Layout: its lowest line about y 864, the notes' first ascender
 * about y 900), west of the state cabinet and east of the request's bay's job rail ("Worker" is set west of that bay, far from it:
 * film.ts LABELS_D). At FRAMING_B (10.2-10.3, after bar 65's dolly) its static sheet lies in the frame's lower-right corner,
 * partly below the band, about 140 px east of the notes' line ends (N9, N10): never on a word.
 */
/**
 * The pencil flag's foot, where the sightline pins it: on the stuck bay's south-east corner, in the nameplate band where it
 * meets the east wall (session 6: it stood 24 u further west, its pennant flying west over the bay's tool rack, where it read
 * as the bay's clutter), so its staff stands up the east wall's top, clear of the bay body, and its pennant flies east over
 * the bare slate between the bay and the loop's sheet (objects/Proposed.tsx flagSheet).
 */
export const FLAG: P3 = [FRESH.box.x1 - FRESH.wall / 2, FRESH.box.y0 + 8, FRESH.wallH + 0.6];
/** The flag's staff (u, north from its foot), its pennant (u: east from the staff's top, down the staff) and how far its foot's staff runs over the nameplate band (u), objects/Proposed.tsx flagSheet. */
export const FLAG_SHAPE = { staff: 104, pennant: [52, 44] as const, band: FRESH.southWall - 8 } as const;
export const WATCHDOG = { c: [605, -356] as P2, w: 190, d: 150, look: [FLAG[0], FLAG[1]] as P2 } as const;
/** Pencil "?" marks (open problems: STORYBOARD 10.1–10.3), at least 64 px on screen (about 100 u of glyph at 0.64×). */
export const QUERY_SIZE = 136;
export const QUERIES: readonly { at: P3; size: number }[] = [
  // beside the vellum tethers (a hijacked loop could reach every machine)
  { at: [1078, 318, 1], size: QUERY_SIZE },
  // beside the handle outline on the docs bay (stepping in mid-task), off its nameplate
  { at: [BAYS.docs.box.x0 + 150, BAYS.docs.box.y0 + 76, 34], size: QUERY_SIZE },
];
/** The pencil handle outline a running bay lacks (stepping in), on the docs bay's south wall, west of its nameplate's centre. */
export const HANDLE = { c: [BAYS.docs.box.x0 + 74, BAYS.docs.box.y0 + 17] as P2, w: 66, d: 28 } as const;
/** Where the chores docked as they were handed over: the key on the intake's gate, the sand-glass on the bug bay's job rail, the strut on the loop's sheet. */
export const DOCKED = {
  key: [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2] as P3,
  glass: [rectC(req.box)[0] + 54, req.box.y0 - 52, 5] as P3,
  spike: [SPIKE.x, SPIKE.y] as P2,
} as const;
/** The bug bay's job rail: a low graphite shelf along its south wall, with a back lip, that the sand-glass and its plate rest on. */
export const JOB_RAIL = { x0: req.box.x0 + 14, x1: req.box.x1 - 14, y0: DOCKED.glass[1] - 34, y1: DOCKED.glass[1] + 38, z: 5, lip: 11 } as const;
