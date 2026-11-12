/**
 * Beats 12 and 13 (STORYBOARD 12.1-13.3, film f6000-6719; cues.ts END): the bookend and the end card, in the summary's
 * world (summary.ts summaryDeskState composes this module's step), then the end's own light world from the card's
 * landing (film.ts SEGMENTS 'end', desk/EndFrame.tsx). What the end adds to the desk, as a pure function of the film
 * frame and the cue sheet's events:
 *
 * - 12.1, bar 76: the camera returns to the hook's framing (camera.ts TO_BOOKEND, 6000-6080: C28's line is the move).
 *   The parts the bookend shows step back up as the camera sets off for them (`STEP_UP`): the feeders (the intake), the
 *   gate with its key, and the belt, on their own ramp (`E_END.stepUp`, from the move's first frame: the focus leads the
 *   camera); the rest stays as beat 11 left it (stepped, the bays capped, your lamp on the next reply waiting in the
 *   chute). During the move the old heap, pressed flat as history in beat 4, presses on into the slate and is gone
 *   (`HEAP_GONE`: its tone goes to the slate's, then what is left of its print fades), so the bookend shows the hook's
 *   desk with no heap. From bar 76's downbeat the feeders tick once a beat (`END.ticks`, the frame-0 rhythm): the card
 *   feeder pushes its fed card out a notch on each beat; once the chat drum's slip has gone, its ticker feeds the next
 *   one out of the spout a third at a time, so by the last tick the drum shows the frame it showed before (`ciFeedAt`,
 *   `nextSlipAt`).
 * - On the held frame, as act one's request did at f20, the slip lying in the chat drum's spout turns vermilion
 *   (`END.bookend.turn`, its ink on spring-effects from the frame before); this time it goes: it lifts a hair and
 *   draws back (3 f), is posted over the gate onto the belt (MT1's post), landing past the gate's bar (beat 5's KEEP_LAND) on
 *   `END.bookend.gate` (the gate passes it), rides the belt up to its crest, hops into the Register's throat and is fed
 *   wholly under the print head on `END.bookend.out`, out of sight in the Register (`bookendSlipAt`); the print head stamps
 *   it in on the last tick (`E_END.stamp`: the hammer's stroke and the head's dip, the Register's receipt). Your lamp
 *   does not move (`LAMP_END` is empty, `youEnd` the identity).
 * `endDesk` applies all of it to the summary's state (summary.ts summaryDeskState): the identity before f6000.
 * - 13.1: the world dissolves to the bare desk over `END.dissolve`, never to black (`veilAt`: a veil of the desk itself
 *   over everything, objects/End.tsx), complete on the dissolve's last frame before the card lands.
 * - 13.2, 13.3: the end card and the end key (desk/endCard.ts): the card posted in as part of the dissolve's incoming
 *   layer (gl/veil.ts), then in the end's light world, which draws only the bare desk, the card and the key.
 *
 * Import rule as beat7.ts's: module-level tables from leaf modules only (cues.ts, layout.ts, springs.ts, fpKit.ts,
 * you.ts, camera.ts); values from beat5.ts and beat4.ts (hammerStroke) inside functions only.
 */
import { clamp, easings } from '@aiv/core';
import { BEAT, END } from '../cues.ts';
import { hammerStroke, type CardUp, type HeapState } from './beat4.ts';
import { BELT_HEADING, BELT_SLOPE, CREST, KEEP_LAND, UNDER_HEAD } from './beat5.ts';
import { carrierSpan, type Footprint } from './fpKit.ts';
import { FEEDERS, NEXT_SLIP, rectC, type P3, type Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import { SPRING, STEP_FRAMES, springAt } from './springs.ts';
import type { DeskState, FocusId, LampStep } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beats 12-13 are built (false: the animatic's slate shows their cues' words and the "animatic" mark over their frames). */
export const BUILT = true;

const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The beats the feeders tick on (bar 76's downbeat to bar 77's last beat, inclusive). */
export const TICKS: readonly number[] = Array.from({ length: (END.ticks.to - END.ticks.from) / BEAT + 1 }, (_, i) => END.ticks.from + i * BEAT);

/** The end's own frames (film frames), hung off the cue sheet's. */
export const E_END = {
  /** the end's life starts with bar 76's move */
  from: END.move[0],
  /** the bookend's parts step back up over this ramp (STEP_FRAMES, inOutSine) as the camera sets off for them */
  stepUp: END.move[0],
  /** the slip's ink starts the frame before its cue, so the cue frame already shows it turning (act one's REQUEST_INK) */
  ink: END.bookend.turn - 1,
  /** it lifts a hair and draws back (its anticipation), then it is posted over the gate */
  antic: END.bookend.turn + 4,
  post: END.bookend.turn + 7,
  /** it lands on the belt's foot past the gate's fingers (a contact frame: the gate passes it) */
  gate: END.bookend.gate,
  /** up the belt to its crest, the hop into the throat, then fed under the print head */
  crest: END.bookend.gate + 10,
  throat: END.bookend.gate + 20,
  feed: END.bookend.out - 5,
  /** wholly under the print head (a contact frame: out of sight in the Register); not drawn after it */
  out: END.bookend.out,
  /** the print head stamps it in, its hammer down on this frame (beat4.ts hammerStroke): the last tick */
  stamp: END.bookend.out + 10,
  /** the dissolve: complete on its last frame before the card lands (6199), so that frame is the bare desk */
  dissolve: [END.dissolve[0], END.dissolve[1] - 1] as const,
} as const;

/** The parts the bookend shows, stepped back up as the camera arrives (the intake is already on the own set from beat 11). */
export const STEP_UP: readonly FocusId[] = ['intake', 'gate', 'belt'];

/**
 * The summary's step from bar 76 on (summaryDeskState applies it to summary.ts summaryStep; before f6000 it returns the
 * step it is given). Beat 11 holds the step at f6000 with everything but your desk on the main set at a full step and
 * the intake on the own set at 1: the gate and the belt move from the main set to the own set at the same full step (no
 * part changes), and the own set ramps up (1 to 0) over `E_END.stepUp`'s 14 f.
 */
export function stepEnd(f: number, st: DeskState['step']): DeskState['step'] {
  if (f < E_END.from) return st;
  const moved = STEP_UP.filter((x) => x !== 'intake' && st.ids.includes(x));
  const own = st.own?.ids ?? [];
  return {
    amount: st.amount,
    ids: st.ids.filter((x) => !moved.includes(x)),
    own: { amount: 1 - sine((f - E_END.stepUp) / STEP_FRAMES), ids: [...own, ...moved.filter((x) => !own.includes(x))] },
    ...(st.late ? { late: st.late } : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// The feeders' ticks

/**
 * How far the card feeder pushes its fed card out on each tick (u: about 6 px at the hook's 1.6x), over `frames`: over
 * the eight ticks its west edge (12 u inside the mouth's 34 u slab) moves 32 u, so it stays 2 u inside the mouth.
 */
export const CI_TICK = { step: 4, frames: 3 } as const;
/**
 * The fed card's offset east of its place (u) at f: a notch a beat from the first tick, each moving over CI_TICK.frames
 * from the frame before its beat, so the beat's frame already shows it moving (the tick sounds on it).
 */
export const ciFeedAt = (f: number): number => (f < E_END.from ? 0 : CI_TICK.step * TICKS.reduce((s, t) => s + sine((f - t + 1) / CI_TICK.frames), 0));

/** The chat drum's spout and the slip lying out of it (objects/Intake.tsx useFeederGeometry: the slip's west end in the spout's mouth). */
const CHAT_C = rectC(FEEDERS.chat);
const CHAT_R = (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2;
/** The slip lying out of the spout (its centre at mid-thickness; Intake.tsx's slip piece is 0.8 thick, lying on the desk). */
export const SPOUT_SLIP: P3 = [CHAT_C[0] + CHAT_R + 80, CHAT_C[1] - 4, 0.4];
/** The slip's size (the spout's: NEXT_SLIP's, 96 x 40). */
export const SLIP_SIZE = { l: NEXT_SLIP.l, w: NEXT_SLIP.w, t: 0.8 } as const;
/** The ticks that feed the next slip out of the spout (those after the slip has gone), a third of it on each, over `frames`. */
export const NEXT_TICK = { frames: 4 } as const;
const NEXT_TICKS = (): readonly number[] => TICKS.filter((t) => t >= END.bookend.gate);
/** How far the next slip is out of the spout's mouth (u, 0..its length) at f. */
export function nextSlipAt(f: number): number {
  const ticks = NEXT_TICKS();
  return (SLIP_SIZE.l / ticks.length) * ticks.reduce((s, t) => s + sine((f - t + 1) / NEXT_TICK.frames), 0);
}

// ------------------------------------------------------------------------------------------------
// The bookend slip

/** A slip's pose: its centre (mid-thickness), heading about z, slope (nose up), roll, landing squash; in the air (a carrier's footprint). */
export interface SlipPose {
  p: P3;
  heading: number;
  slope: number;
  roll: number;
  squash: number;
  flying: boolean;
  /** lying in the chat drum's spout (it draws with the intake, stepped as the intake is; it casts no footprint, as the spout's slip never did) */
  lying: boolean;
}

/** The post's arc over the chord (MT1's: it clears the gate bar's cap, 42 u, as it passes over it) and the anticipation's draw-back and lift. */
export const POST = { apex: NEXT_SLIP.apex, back: 3, lift: 2 } as const;
/** The hop over the throat's west face (beat 5's), and the feed's curve (in-quad: it gathers speed into the head). */
export const HOP = { apex: 40 } as const;

/** The bookend slip at f (null before the end and once it is under the print head), and its vermilion. */
export function bookendSlipAt(f: number): { pose: SlipPose; ink: number } | null {
  if (f < E_END.from || f > E_END.out) return null;
  const E = E_END;
  const ink = springAt(f, E.ink, SPRING.effects);
  const rest: SlipPose = { p: SPOUT_SLIP, heading: 0, slope: 0, roll: 0, squash: 0, flying: false, lying: true };
  if (f <= E.antic) return { pose: rest, ink };
  // the post's start: lifted a hair and drawn back west, toward the spout
  const a: P3 = [SPOUT_SLIP[0] - POST.back, SPOUT_SLIP[1], SPOUT_SLIP[2] + POST.lift];
  if (f < E.post) {
    const t = sine((f - E.antic) / (E.post - E.antic));
    return { pose: { p: [lerp(SPOUT_SLIP[0], a[0], t), SPOUT_SLIP[1], lerp(SPOUT_SLIP[2], a[2], t)], heading: 0, slope: 0.04 * t, roll: 0, squash: 0, flying: true, lying: false }, ink };
  }
  // beat5.ts's belt and head, read inside functions only (the import rule)
  const B = beltLine();
  if (f < E.gate) {
    // posted over the gate (MT1's arc), turning into the belt's pose as it comes down onto it, landing on the gate frame
    // where beat 5's kept asks land (KEEP_LAND: the whole slip past the gate's bar)
    const x = (f - E.post) / (E.gate - E.post);
    const u = sine(x);
    const b = KEEP_LAND;
    const p: P3 = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + 4 * POST.apex * u * (1 - u)];
    return { pose: { p, heading: B.heading * u, slope: B.slope * u, roll: 0.12 * Math.sin(Math.PI * u), squash: 0, flying: true, lying: false }, ink };
  }
  const squash = Math.max(0, 1 - (f - E.gate) / 3);
  if (f < E.crest) {
    // up the belt: the belt takes it from the landing (gathering speed over the first quarter), to the crest
    const x = clamp((f - E.gate) / (E.crest - E.gate));
    const k = 0.25;
    const s = x < k ? (x * x) / (2 * k) / (1 - k / 2) : (x - k / 2) / (1 - k / 2);
    return { pose: { p: B.at(B.crestRun * s), heading: B.heading, slope: B.slope, roll: 0, squash, flying: false, lying: false }, ink };
  }
  const T = NEXT_SLIP.throat;
  if (f < E.throat) {
    // the hop over the throat's west face (beat 5's: up off the belt's top, across, down between the cheeks), at the
    // belt's pace, turning to lie along the throat over its first 70%
    const u = (f - E.crest) / (E.throat - E.crest);
    const e = sine(u / 0.7);
    const c = B.at(B.crestRun);
    return { pose: { p: [lerp(c[0], T[0], u), lerp(c[1], T[1], u), lerp(c[2], T[2], u) + 4 * HOP.apex * u * (1 - u)], heading: B.heading * (1 - e), slope: B.slope * (1 - e), roll: 0, squash: 0, flying: true, lying: false }, ink };
  }
  // in the throat, then fed wholly under the print head (beat5.ts UNDER_HEAD), gathering speed
  const under = underHead();
  const t = easings.inQuad(clamp((f - E.feed) / (E.out - E.feed)));
  return { pose: { p: [lerp(T[0], under[0], t), lerp(T[1], under[1], t), lerp(T[2], under[2], t)], heading: 0, slope: 0, roll: 0, squash: Math.max(0, 1 - (f - E.throat) / 3), flying: false, lying: false }, ink };
}

/** The belt's line as a slip rides it (beat5.ts: from beat 5's landing past the gate up to its crest), computed on first use (the import rule). */
let beltCache: { heading: number; slope: number; crestRun: number; at: (s: number) => P3 } | null = null;
function beltLine(): NonNullable<typeof beltCache> {
  if (beltCache) return beltCache;
  const A = KEEP_LAND;
  const C = CREST;
  const L = Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
  beltCache = { heading: BELT_HEADING, slope: BELT_SLOPE, crestRun: L, at: (s: number): P3 => [A[0] + ((C[0] - A[0]) * s) / L, A[1] + ((C[1] - A[1]) * s) / L, A[2] + ((C[2] - A[2]) * s) / L] };
  return beltCache;
}
/** Where a slip is fed to: wholly under the print head (beat5.ts UNDER_HEAD). */
const underHead = (): P3 => UNDER_HEAD;

// ------------------------------------------------------------------------------------------------
// The old heap, pressed into the slate (STORYBOARD 12.1: "no heap")

/**
 * The old heap's last press (film frames, during the move, done well before the camera lands): beat 4 pressed it flat as
 * history (its tone a step and a half down, objects/Turn.tsx HEAP_HISTORY); now its tone goes on down to the slate's own
 * (`tone`, inOutSine), and once it is all but the slate, what is left of its print fades (`fade`, inOutSine), so the
 * pieces are gone into the slate with nothing left over (no imprints: eighteen overlapping outlines would read as the
 * heap's ghost).
 */
export const HEAP_GONE = { tone: [END.move[0] + 16, END.move[0] + 44], fade: [END.move[0] + 36, END.move[0] + 56] } as const;
/** How far the heap has gone into the slate at f: its tone (0..1) and its fade (0..1); null before the end. */
export function heapGoneAt(f: number): NonNullable<HeapState['gone']> | null {
  if (f < E_END.from) return null;
  const G = HEAP_GONE;
  return { tone: sine((f - G.tone[0]) / (G.tone[1] - G.tone[0])), fade: sine((f - G.fade[0]) / (G.fade[1] - G.fade[0])) };
}

// ------------------------------------------------------------------------------------------------
// The dissolve

/** How far the world has dissolved to the bare desk at f (0..1, inOutSine; 1 from the dissolve's last frame before the card lands). */
export const veilAt = (f: number): number => (f < E_END.dissolve[0] ? 0 : sine((f - E_END.dissolve[0]) / (E_END.dissolve[1] - E_END.dissolve[0])));

// ------------------------------------------------------------------------------------------------
// The state and the hooks

/** The end's state at a film frame. */
export interface EndState {
  f: number;
  /** the bookend slip (null once it is under the print head) and its vermilion (0..1) */
  slip: SlipPose | null;
  ink: number;
  /** how far the next slip is out of the chat drum's spout (u) */
  next: number;
  /** the card feeder's fed card, pushed out east (u) */
  ci: number;
  /** the dissolve to the bare desk (0..1) */
  veil: number;
}
/** DeskState.end: from bar 76's downbeat (f6000) on; null before it. */
export function endAt(f: number): EndState | null {
  if (f < E_END.from) return null;
  const s = bookendSlipAt(f);
  return { f, slip: s?.pose ?? null, ink: s?.ink ?? 0, next: nextSlipAt(f), ci: ciFeedAt(f), veil: veilAt(f) };
}

/** Your lamp does not move (STORYBOARD 12.1). */
export const LAMP_END: readonly LampStep[] = [];
export function cardsEnd(_s: DeskState): CardUp[] {
  return [];
}
/** The bookend slip's footprint while it is off the desk (in the air, on the belt, in the throat: a carrier's, no contact). */
export function footprintsEnd(s: DeskState): Footprint[] {
  const p = s.end?.slip;
  if (!p || p.lying) return [];
  return [{ kind: 'rect', c: [p.p[0], p.p[1]], h: [SLIP_SIZE.l / 2, SLIP_SIZE.w / 2], r: 3, rot: p.heading, ...carrierSpan({ p: p.p, slope: p.slope }, SLIP_SIZE.l / 2, 0.4), contact: 0 }];
}
export function poolsEnd(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_END: readonly TagSpec[] = [];
/** Your desk's pose: unchanged (your lamp stays on the next reply waiting in the chute). */
export function youEnd(_f: number, pose: YouPose): YouPose {
  return pose;
}

/**
 * The summary's state from bar 76 (summary.ts summaryDeskState hands its state through this; before f6000 it returns the
 * very object it is given): the step (`stepEnd`), the old heap going into the slate (`heapGoneAt`), and the print head's
 * stamp for the bookend slip (`E_END.stamp`: the hammer's stroke, its head dipping with it, state.ts headDipAt).
 */
export function endDesk(f: number, s: DeskState): DeskState {
  if (f < E_END.from) return s;
  const gone = heapGoneAt(f)!;
  return {
    ...s,
    step: stepEnd(f, s.step),
    b4: { ...s.b4, heap: { ...s.b4.heap, gone } },
    e6: { ...s.e6, hammer: Math.max(s.e6.hammer, hammerStroke(f, E_END.stamp)) },
  };
}
