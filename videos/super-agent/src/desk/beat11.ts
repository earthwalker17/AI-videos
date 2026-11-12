/**
 * Beat 11 (STORYBOARD 11.1-11.4, film f5440-5999; cues.ts BEAT_11): sign-off, old ideas, meaning, in the summary's world
 * (summary.ts: the stamp, the trace and still (d); summaryDeskState composes this module's state into the desk's). What
 * the beat adds, as a pure function of the film frame and the cue sheet's events:
 *
 * - The seam's settling (summary side, f5424-5519): the summary's world starts on act two's last frame (summary.ts holds
 *   its parts) and settles into still (d)'s under the stamp and the ease-out, each part with a cause: the Register's
 *   hooded reading lamp dims on the stamp (the one lit paper is the slip your stamp signed) and recall's reading thread is
 *   wound back in by its shuttle, its "№" tabs folding down flat as it passes them (`SETTLE`); as the route's red passes
 *   the gate the worded Proactive plate lifts, turns over in flight to its pictogram face and docks beside the key
 *   (`SETTLE.proactive`), and once the red is in the request's bay the worded Productive plate does the same onto the job
 *   rail (`SETTLE.productive`). What act two built and left lasts (the Thread's gate open on the bay's north wall: the
 *   full-duplex door the 11.2 label names; the job rail and its glass, the window's log, the spike's pile, the 7.4 reply).
 * - 11.1: your lamp brightens a step on the stamp (LAMP_11). From f5530 the three built trait plates retire into the
 *   emptied chore tray, landing on `BEAT_11.plates.lands`, each flying east of your in-tray and your lamp (never over the
 *   stamped reply) and in over the tray from its east end: the Proactive pictogram plate (the starter key) turns north-south
 *   and lies over the key's recess, the Productive one (the sand-glass) over the glass's; Continuous lifts straight up off
 *   its brackets (clear over the print head and the reading lamp's hood), turns over in flight to its pictogram face (the
 *   tape it became), shrinking to the tray's plate size, and lies across the tray's head on the two. The strut's recess
 *   stays empty: Persistent is printed in the vellum loop's sheet, proposed, so its chore is not off your desk yet (no
 *   fourth flight; its land, 5566, is unused).
 * - 11.2: six idea labels settle one per beat on their parts (`TAGS_11`: TagSpecs on the 'ideas' cue, EN over zh as beat
 *   7's tags are, Fast / Slow Path drawn once; film.ts SUMMARY_TAGS); the map key after them: a dark legend plate slides
 *   in over the slate from beyond the frame's top edge carrying its three samples (an enamel block, a vellum swatch with
 *   the proposed parts' dashed edge, a grained pencil "?"), settled before the key's words wipe in beside them (objects/
 *   Beat11.tsx Beat11Text: dead still while they are read); the words fade out, then the bare plate slides back out
 *   before bar 76's move.
 * - 11.3: the act-one grey-stock card rises in from the west, rests a full beat and slides away west (no strike), the world a
 *   notch down under it;
 *   the neck-collar gauge unclips from the Register's throat, flies to your lamp's neck, docks with a squash and rides it,
 *   its needle swinging high up its scale (your attention is the limit).
 * - 11.4: everything but your desk, your lamp and the stamped reply steps down (summary.ts summaryStep); the next replies
 *   come down the chute and queue in it (`NEXT_REPLIES`: unstamped decisions waiting for you), and your lamp turns to the
 *   next one on each of `lampTurns` (its aim on spring-heavy; its pool follows the aim).
 *
 * Beat 11 ends at f6000 held and stepped, the state bar 76's move starts from. Import rule as beat7.ts's: module-level
 * tables from leaf modules only (cues.ts, layout.ts, springs.ts, fpKit.ts, you.ts, camera.ts).
 */
import { clamp, easings } from '@aiv/core';
import { Easing } from 'remotion';
import { BEAT_11, WORDS } from '../cues.ts';
import type { CardState, CardSpot, CardUp } from './beat4.ts';
import { FRAMING_D, deskCamera, project, screenToDesk } from './camera.ts';
import { carrierSpan, rectFp, type Footprint } from './fpKit.ts';
import { BAYS, CHUTE, CORDS, DECK, GATE, PROACTIVE_PLATE, THROAT, TRAIT_PLATE, WINDOW, YOU, rectC, type P2, type P3, type Pool, type Rect } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import { SPRING, springAt } from './springs.ts';
import { REPLY_LEAD, replyPose, type DeskState, type FocusId, type LampStep, type ReplyState, type SlipRide } from './state.ts';
import { CHORES, YOU_POSE_B, type YouPose } from './you.ts';

/** Whether beat 11 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames after still (d)'s sign-off). */
export const BUILT = true;

const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: P3, b: P3, t: number): P3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The stamp's contact (cues.ts 'stamp'; summary.ts STAMP_F). */
export const STAMP_11 = BEAT_11.stamp;
/** Still (d)'s frame (lookdev/frames.ts ROUND2.stillD): the plates sit still in their docks there. */
export const STILL_D = 5520;

// ------------------------------------------------------------------------------------------------
// The seam's settling, summary side (f5424-5519): act two's last frame settles into still (d)'s under the stamp and the
// ease-out (camera.ts EASE_OUT_D, f5440-5500). Film 5420-5439 is the stillness: nothing here moves before the stamp.

export const SETTLE = {
  /** the Register's hooded reading lamp dims to idle (1 -> 0.25) on spring-effects from the frame after the stamp */
  readLamp: STAMP_11 + 1,
  /** the Register's hopper, folded out of the record's way in beat 6, swings back up on spring-heavy for the next report once the reply is signed */
  hopper: STAMP_11 + 14,
  /** recall's reading thread is wound back in by its shuttle over `frames`, its "№" tabs folding down flat as it passes them */
  thread: { from: STAMP_11 + 4, frames: 26, fold: 6, sink: 3 },
  /** the worded plates turn over to their pictogram plates in flight: Proactive as the red passes the gate, Productive once it is in the bay */
  proactive: { lift: STAMP_11 + 10 },
  productive: { lift: STAMP_11 + 46 },
} as const;
/** How flat a folded "№" tab lies (its turn's share left: it lies on the body it landed on, never drawn edge-on into it). */
export const TAB_FLAT = 0.012;
/** The reading lamp at f (act two's 1 before the stamp; still (d)'s 0.25 settled). */
export const readLampAt = (f: number): number => 1 - 0.75 * springAt(f, SETTLE.readLamp, SPRING.effects);
/** The hopper's fold at f from act two's (): back up from SETTLE.hopper (its spring's overshoot swings it a hair past upright). */
export const hopperAt = (f: number, fold: number): number => fold * (1 - springAt(f, SETTLE.hopper, SPRING.heavy));

// ------------------------------------------------------------------------------------------------
// The trait plates: the worded plates (act two's bodies) and still (d)'s pictogram plates, posed

/** Still (d)'s pictogram plate (objects/Trace.tsx drew them until wave 2): 96 x 30, 5 thick, its engraved face 92 x 26. */
export const MINI = { l: 96, w: 30, t: 5 } as const;
/** still (d)'s docks (summary.ts DOCKED: the key's dock + 62 east; the glass's dock - 112 west, on the job rail's top, z 5) */
const DOCKED_KEY: P3 = [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2];
const DOCKED_GLASS: P3 = [rectC(BAYS.bug.box)[0] + 54, BAYS.bug.box.y0 - 52, 5];
export const MINI_DOCK = { proactive: [DOCKED_KEY[0] + 62, DOCKED_KEY[1], 0] as P3, productive: [DOCKED_GLASS[0] - 112, DOCKED_GLASS[1], 5] as P3 } as const;
/** The worded plates as act two docked them (layout.ts PROACTIVE_PLATE, beat7.ts PRODUCTIVE_PLATE, layout.ts TRAIT_PLATE): their boxes and their undersides. */
const PRODUCTIVE_BOX: Rect = { x0: -94, x1: 250, y0: -348, y1: -284 };
export const WORDED = {
  proactive: { box: PROACTIVE_PLATE.box, z: PROACTIVE_PLATE.z[0], t: PROACTIVE_PLATE.z[1] - PROACTIVE_PLATE.z[0] },
  productive: { box: PRODUCTIVE_BOX, z: 0, t: 4 },
  continuous: { box: TRAIT_PLATE.box, z: TRAIT_PLATE.z[0], t: TRAIT_PLATE.z[1] - TRAIT_PLATE.z[0] },
} as const;
export type PlateId = keyof typeof WORDED;
const sizeOf = (b: Rect): P2 => [b.x1 - b.x0, b.y1 - b.y0];

/** The chore tray's top (you.ts TRAY_Z.plate). */
export const TRAY_TOP = YOU.top + 7;
/** The pictogram plates turn north-south in flight to lie over their chores' recesses (the key's bow north, as its recess has it). */
const NS = -Math.PI / 2;
/**
 * Where each plate comes to lie in the chore tray (its centre at mid-thickness, its turn about z): the Proactive plate (the
 * starter key) over the key's recess and the Productive (the sand-glass) over the glass's, each north-south the tray's
 * depth, flat on the board; Continuous last, east-west across the tray's head on the two of them. The strut's recess is
 * left empty (Persistent is proposed).
 */
export const TRAY_DOCK: Record<PlateId, { c: P3; yaw: number }> = {
  proactive: { c: [CHORES.key.c[0], rectC(YOU.tray)[1], TRAY_TOP + MINI.t / 2], yaw: NS },
  productive: { c: [CHORES.glass.c[0], rectC(YOU.tray)[1], TRAY_TOP + MINI.t / 2], yaw: NS },
  continuous: { c: [(CHORES.key.c[0] + CHORES.glass.c[0]) / 2, YOU.tray.y1 - 2 - MINI.w / 2, TRAY_TOP + MINI.t + MINI.t / 2], yaw: 0 },
};
/** The order they land in (BEAT_11.plates.lands): the two that lie on the board first, Continuous across them last. */
export const TRAY_ORDER: readonly PlateId[] = ['proactive', 'productive', 'continuous'];

/** A plate's flight: 4 f of anticipation (it lifts a hair and draws back from where it goes), then `travel` frames along its path to its dock, landing on the contact frame. */
export const FLY = { antic: 4, back: 4, up: 3, squash: 0.03 } as const;
/**
 * The turnover in flight: about its long axis over 8 f; the bodies swap where it is edge-on to the 15° camera (75°), and
 * the turn's phase puts a frame there (`from` is fractional: its 6th travel frame lands on 75° exactly), so the swap is
 * never seen face-on.
 */
export const TURN = { frames: 8, swap: (75 * Math.PI) / 180, from: 6 - (8 * Math.acos(1 - (2 * 75) / 180)) / Math.PI } as const;

/**
 * The retirement (11.1): each plate lifts so it lands on its frame (BEAT_11.plates.lands, in TRAY_ORDER; the first lifts
 * on BEAT_11.plates.from), never before f5521 (still (d) keeps them in place). The three built plates retire; Persistent,
 * proposed, stays in vellum and the strut's recess is left empty. Each flies a cubic path through `via` (absolute desk points) clear of the parts
 * it passes: east of your in-tray, your lamp and your stamp (on screen too: never over the stamped reply), in over the
 * tray from its east end; Continuous first straight up off its brackets, high over the print head and the reading lamp's
 * hood (objects/Register.tsx), then down the same way.
 */
export const RETIRE = {
  lands: BEAT_11.plates.lands as readonly number[],
  // (the first, Proactive, travels a frame longer: its first move, the frame after its lift, lands on BEAT_11.plates.from;
  // Continuous, the longest way, over the print head and down the desk, takes 24 f: lifting on 5532, never a flick)
  travel: { proactive: 17, productive: 16, continuous: 24 } as Record<PlateId, number>,
  via: {
    proactive: [
      [-380, 150, 120],
      [-300, -330, 70],
    ],
    productive: [
      [140, -262, 90],
      [-360, -262, 80],
    ],
    continuous: [
      [-60, 430, 400],
      [-150, -280, 150],
    ],
  } as Record<PlateId, readonly [P3, P3]>,
} as const;
/** The frame a plate lifts for its retirement. */
export const retireLiftOf = (id: PlateId): number => RETIRE.lands[TRAY_ORDER.indexOf(id)]! - RETIRE.travel[id] - FLY.antic;

/** A plate at a frame: which body draws it, its centre (mid-thickness), its turn about its long axis (0 face up), its scale in plan, its squash. */
export interface PlatePose {
  body: 'worded' | 'mini';
  c: P3;
  /** the turn about its long axis (radians, the worded body's top going north-away; the mini body's face up at 0) */
  roll: number;
  /** its turn about z (0: east-west as act two laid it) */
  yaw: number;
  /** its plan size scale (x along it, y across it) */
  sx: number;
  sy: number;
  /** its landing squash (0..0.03) */
  squash: number;
  /** in the air (a carrier's footprint, no contact) */
  flying: boolean;
}

interface Leg {
  lift: number;
  travel: number;
  from: P3;
  to: P3;
  /** a cubic path's inner control points (absolute), else an arc `apex` high */
  via?: readonly [P3, P3];
  apex: number;
  /** the size it starts at and lands at (plan, u) */
  size0: P2;
  size1: P2;
  /** worded at its start (it turns over to the mini body in flight) */
  worded: boolean;
  /** its turn about z at the landing */
  yaw: number;
}
const bez = (a: P3, b: P3, c: P3, d: P3, u: number): P3 => {
  const v = 1 - u;
  const k0 = v * v * v;
  const k1 = 3 * v * v * u;
  const k2 = 3 * v * u * u;
  const k3 = u * u * u;
  return [k0 * a[0] + k1 * b[0] + k2 * c[0] + k3 * d[0], k0 * a[1] + k1 * b[1] + k2 * c[1] + k3 * d[1], k0 * a[2] + k1 * b[2] + k2 * c[2] + k3 * d[2]];
};
/** A plate along one leg at f: at rest before the lift, anticipating, travelling (turning over if worded), landed. */
function legAt(f: number, L: Leg): PlatePose {
  const land = L.lift + FLY.antic + L.travel;
  const s1: [number, number] = [L.size1[0] / L.size0[0], L.size1[1] / L.size0[1]];
  // it draws back from where it first heads
  const head = L.via ? L.via[0] : L.to;
  const d = Math.hypot(head[0] - L.from[0], head[1] - L.from[1]) || 1;
  const back: P3 = [(-(head[0] - L.from[0]) / d) * FLY.back, (-(head[1] - L.from[1]) / d) * FLY.back, FLY.up];
  const still = { roll: 0, yaw: 0, sx: 1, sy: 1, squash: 0 };
  if (f <= L.lift) return { body: L.worded ? 'worded' : 'mini', c: L.from, ...still, flying: false };
  if (f < L.lift + FLY.antic) {
    // it lifts a hair and draws back, away from where it goes
    const t = sine((f - L.lift) / FLY.antic);
    return { body: L.worded ? 'worded' : 'mini', c: [L.from[0] + back[0] * t, L.from[1] + back[1] * t, L.from[2] + back[2] * t], ...still, flying: true };
  }
  if (f < land) {
    const a: P3 = [L.from[0] + back[0], L.from[1] + back[1], L.from[2] + back[2]];
    const x = (f - L.lift - FLY.antic) / L.travel;
    const u = sine(x);
    const c: P3 = L.via ? bez(a, L.via[0], L.via[1], L.to, u) : [lerp(a[0], L.to[0], u), lerp(a[1], L.to[1], u), lerp(a[2], L.to[2], u) + 4 * L.apex * x * (1 - x)];
    const sx = lerp(1, s1[0], u);
    const sy = lerp(1, s1[1], u);
    const yaw = L.yaw * u;
    if (!L.worded) return { body: 'mini', c, roll: 0, yaw, sx, sy, squash: 0, flying: true };
    const th = Math.PI * sine((f - L.lift - FLY.antic - TURN.from) / TURN.frames);
    // edge-on to the camera at the swap: the worded body turned th (its top north-away), then the mini body turned th - pi
    // (its face coming up); the mini's plan size at the swap is the worded's there, so the silhouette never jumps
    return th < TURN.swap - 1e-6 ? { body: 'worded', c, roll: th, yaw, sx, sy, squash: 0, flying: true } : { body: 'mini', c, roll: th - Math.PI, yaw, sx: (sx * L.size0[0]) / L.size1[0], sy: (sy * L.size0[1]) / L.size1[1], squash: 0, flying: true };
  }
  return { body: 'mini', c: L.to, roll: 0, yaw: L.yaw, sx: 1, sy: 1, squash: FLY.squash * Math.max(0, 1 - (f - land) / 4), flying: false };
}
/** A worded plate's centre at rest (its box's centre, mid-thickness). */
const wordedC = (id: PlateId): P3 => {
  const w = WORDED[id];
  return [rectC(w.box)[0], rectC(w.box)[1], w.z + w.t / 2];
};
/** A pictogram plate's centre at its still-(d) dock (mid-thickness). */
const miniC = (id: 'proactive' | 'productive'): P3 => [MINI_DOCK[id][0], MINI_DOCK[id][1], MINI_DOCK[id][2] + MINI.t / 2];
/** The seam's flight's travel (worded to pictogram, at the docks). */
const SEAM_TRAVEL = 14;

/** A plate's retirement leg: from where it lies to its dock in the tray. */
const retireLeg = (id: PlateId, from: P3, worded: boolean, size0: P2): Leg => ({ lift: retireLiftOf(id), travel: RETIRE.travel[id], from, to: TRAY_DOCK[id].c, via: RETIRE.via[id], apex: 0, size0, size1: [MINI.l, MINI.w], worded, yaw: TRAY_DOCK[id].yaw });
/** The seam's flight (worded to pictogram) of the Proactive and Productive plates, then their retirement (11.1); Continuous's retirement. */
const LEGS = {
  proactive: [
    { lift: SETTLE.proactive.lift, travel: SEAM_TRAVEL, from: wordedC('proactive'), to: miniC('proactive'), apex: 72, size0: sizeOf(WORDED.proactive.box), size1: [MINI.l, MINI.w], worded: true, yaw: 0 },
    retireLeg('proactive', miniC('proactive'), false, [MINI.l, MINI.w]),
  ],
  productive: [
    { lift: SETTLE.productive.lift, travel: SEAM_TRAVEL, from: wordedC('productive'), to: miniC('productive'), apex: 56, size0: sizeOf(WORDED.productive.box), size1: [MINI.l, MINI.w], worded: true, yaw: 0 },
    retireLeg('productive', miniC('productive'), false, [MINI.l, MINI.w]),
  ],
  continuous: [retireLeg('continuous', wordedC('continuous'), true, sizeOf(WORDED.continuous.box))],
} as const satisfies Record<PlateId, readonly Leg[]>;

/**
 * A trait plate at film frame f in the summary's world: null where an act-two body still draws it at rest (the worded
 * Proactive plate, objects/Filter.tsx, until its lift; the Productive, objects/Beat7.tsx; Continuous, objects/Register.tsx).
 */
export function plateAt(f: number, id: PlateId): PlatePose | null {
  const legs: readonly Leg[] = LEGS[id];
  if (f <= legs[0]!.lift) return null;
  const leg = [...legs].reverse().find((l) => f > l.lift) ?? legs[0]!;
  return legAt(f, leg);
}
/** Every plate this module draws at f (from its first lift on). */
export const platesAt = (f: number): Record<PlateId, PlatePose | null> => ({ proactive: plateAt(f, 'proactive'), productive: plateAt(f, 'productive'), continuous: plateAt(f, 'continuous') });
/** The landing frame of each leg (the tests, the score's marks). */
export const plateLands = (id: PlateId): number[] => LEGS[id].map((l) => l.lift + FLY.antic + l.travel);
/** The lift frame of each leg. */
export const plateLifts = (id: PlateId): number[] => LEGS[id].map((l) => l.lift);

// ------------------------------------------------------------------------------------------------
// 11.2: the idea labels and the map key

/** A tag's lines: EN over zh, as beat 7's tags are (a name the same in both languages, Fast / Slow Path, drawn once). */
const twoLines = (w: { en: string; 'zh-Hans': string }): TagSpec['lines'] => ({ en: [w.en], zh: [w.en === w['zh-Hans'] ? '' : w['zh-Hans']] });
/** The Watchdog's station's east edge at its middle (summary.ts WATCHDOG, restated: the import rule; beat11.test holds it). */
export const WATCH_EAST: P3 = [605 + 190 / 2, -356, 1];
/** The Thread's gate's east post, on the request's bay's north wall where the cord comes in (beat7.ts GATE: its post's top). */
const GATE_POST: P3 = [CORDS.vermilion[CORDS.vermilion.length - 1]![0] - 5, BAYS.bug.box.y1 - BAYS.bug.wall / 2, BAYS.bug.wallH + 20];
/**
 * The six idea labels (STORYBOARD 11.2), one per beat on BEAT_11.ideas: TagSpecs on the 'ideas' cue, each its own id and
 * its own reveal from its beat (Overlay.tsx TagSpec.reveal 'leader': its leader's foot on the beat, the leader drawn over
 * 6 f, then its text wiped in over 8 f), all fading with the cue (down before the collar flies); EN over zh (Fast / Slow Path, the same in both, drawn once), placed
 * for still (d)'s framing (0.64x), every line inside title-safe and the diagram band, each leader short and onto a named
 * part, no two feet in one place: Fast / Slow Path on the loupe over the Slow Path's card, its label north in the clear
 * band over the Register; cache on the window's north bar (never across its log or the record's print), north beside it;
 * batching on the throat, set south in the clear slate between your desk and the first bay (its leader the gap between
 * them); full-duplex on the Thread's gate standing open on the request's bay's north wall (the bay's open door), set in
 * the clear slate north-east of it between the cord and the vellum; the compute–state split on the vellum state
 * cabinet, set right of it (EN broken between its words, zh under it); the control loop on the Watchdog's station, set
 * east of it in the clear slate under the cabinet (its leader short and level onto the station's east edge).
 */
export const TAGS_11: readonly TagSpec[] = [
  { cue: 'ideas', reveal: 'leader', id: 'idea-fastslow', from: BEAT_11.ideas[0]!, words: WORDS.ideaFastSlow, lines: twoLines(WORDS.ideaFastSlow), at: [705, 166], anchor: 'end', foot: [-319, 341, 157] },
  { cue: 'ideas', reveal: 'leader', id: 'idea-batching', from: BEAT_11.ideas[1]!, words: WORDS.ideaBatching, lines: twoLines(WORDS.ideaBatching), gap: 48, at: [650, 750], anchor: 'start', foot: [THROAT.box.x0 + 14, THROAT.box.y0 + 2, THROAT.z[1]] },
  { cue: 'ideas', reveal: 'leader', id: 'idea-cache', from: BEAT_11.ideas[2]!, words: WORDS.ideaCache, lines: twoLines(WORDS.ideaCache), gap: 46, at: [790, 124], anchor: 'start', foot: [-137, WINDOW.frame.y1 - WINDOW.bar / 2, WINDOW.z[1] + 1] },
  { cue: 'ideas', reveal: 'leader', id: 'idea-duplex', from: BEAT_11.ideas[3]!, words: WORDS.ideaDuplex, lines: twoLines(WORDS.ideaDuplex), gap: 46, at: [1216, 392], anchor: 'start', foot: GATE_POST },
  { cue: 'ideas', reveal: 'leader', id: 'idea-split', from: BEAT_11.ideas[4]!, words: WORDS.ideaSplit, lines: { en: ['compute–state', 'split'], zh: [WORDS.ideaSplit['zh-Hans']] }, gap: 42, at: [1824, 676], anchor: 'end', foot: [986, -230, 1] },
  { cue: 'ideas', reveal: 'leader', id: 'idea-control', from: BEAT_11.ideas[5]!, words: WORDS.ideaControl, lines: twoLines(WORDS.ideaControl), gap: 42, at: [1416, 818], anchor: 'start', foot: WATCH_EAST },
];

/**
 * The map key (11.2): a dark legend plate slides in over the slate from beyond the frame's top edge in the upper right of
 * still (d)'s frame once the six labels have landed, its three samples on it north to south (an enamel block, a vellum
 * swatch with the proposed parts' dashed edge, a grained pencil "?", drawn as objects/Proposed.tsx draws them), settled
 * before the key's words wipe in beside them on the cue (objects/Beat11.tsx Beat11Text, a column of EN and one of zh,
 * dead still while they are read); the words fade out (6 f), then the bare plate slides back out before bar 76's move.
 */
const POSE_D = deskCamera(FRAMING_D, 15);
/** Where the samples sit on screen (their column's x, each row's y) and the words' columns (left aligned) at still (d): the zh column ends inside title-safe. */
export const KEY_SCREEN = { x: 1233, ys: [104, 160, 216] as const, en: 1281, zh: 1608 } as const;
/** The plate's top over the slate (u) and its margin round the samples (a narrow legend board under the samples' column). */
export const KEY_PLATE = { top: 6, margin: { x: 48, y: 40 } } as const;
export const KEY_SAMPLES: readonly P3[] = KEY_SCREEN.ys.map((y) => screenToDesk(POSE_D, [KEY_SCREEN.x, y], KEY_PLATE.top));
/** The plate under the samples (the words lie beside it on the slate, as the labels do). */
export const KEY_BOX: Rect = (() => {
  const xs = KEY_SAMPLES.map((p) => p[0]);
  const ys = KEY_SAMPLES.map((p) => p[1]);
  const m = KEY_PLATE.margin;
  return { x0: Math.min(...xs) - m.x, x1: Math.max(...xs) + m.x, y0: Math.min(...ys) - m.y, y1: Math.max(...ys) + m.y };
})();
export const KEY_WORDS = [WORDS.keySolid, WORDS.keyDashed, WORDS.keySketch] as const;
/** How far north of its place the plate starts and ends (beyond the frame's top edge at 0.64x, its shadow with it). */
export const KEY_OFF = 500;
/**
 * Its slide in (spring-settle from `in`, held dead still from `in + settle`, the key-map cue's frame, so its words never
 * move under them), its words' fade out (`fade` frames, ending on `out`: the key-map cue's own fade, its window ending on
 * 5988), and its slide out (sine over `outFrames` from `out`, beyond the edge on its last drawn frame, gone before f6000).
 */
export const KEY_MOVE = { in: BEAT_11.keyMap - 16, settle: 16, fade: 6, out: 5988, outFrames: 11 } as const;
/** The plate's offset north of its place at f (u; null: not drawn). */
export function keyAt(f: number): { dy: number } | null {
  const M = KEY_MOVE;
  if (f <= M.in || f >= M.out + M.outFrames) return null;
  const inK = f >= M.in + M.settle ? 1 : springAt(f, M.in, SPRING.settle);
  const outK = sine((f - M.out) / (M.outFrames - 1));
  return { dy: KEY_OFF * (1 - inK) + KEY_OFF * outK };
}
/** The key's words' opacity at f against the cue's own (they fade out before the plate leaves, never riding it). */
export const keyWordsAt = (f: number): number => 1 - clamp((f - (KEY_MOVE.out - KEY_MOVE.fade)) / KEY_MOVE.fade);

// ------------------------------------------------------------------------------------------------
// 11.3: the act-one card and the collar

/** The card's curves: in on an even sine over 12 f (beat 4's move curve would carry it in from beyond the top edge faster than 2410 px/s), out on TREATMENT's exit curve over 8 f. */
const RISE = (t: number): number => sine(t);
const EXIT = Easing.bezier(0.3, 0, 0.8, 0.15);
/** The act-one card: grey stock (beat4.ts's counterfactual card, larger), up once C26 has settled, at rest a full beat; no strike. */
export const CARD_11 = { rise: BEAT_11.actOneCard.rise, exit: BEAT_11.actOneCard.exit, riseFrames: 12, exitFrames: 8 } as const;
/** Its size (u: about 354 x 217 px at 0.64x) and where its centre sits on still (d)'s screen: west of the Register, north of your desk, over the feeders and the noise act one was. */
const CARD_W = 540;
const CARD_H = 332;
const CARD_SCREEN: P2 = [300, 318];
/**
 * Where it plays: 240 u up, in from just beyond the frame's west edge and back off it (its east edge 12 px beyond the
 * frame's west edge at `off`), level with where it rests, so its whole entry and exit show in frame and cross no label
 * (the idea labels along the top, "Fast / Slow Path" over it, are still fading as it leaves).
 */
export const CARD_SPOT_11: CardSpot = (() => {
  const at = screenToDesk(POSE_D, CARD_SCREEN, 240);
  const edge = screenToDesk(POSE_D, [-12, CARD_SCREEN[1]], 240);
  return { at: [at[0], at[1], 240], off: [edge[0] - CARD_W / 2, at[1], 240], w: CARD_W, h: CARD_H, tilt: 0.3 };
})();
/**
 * The card at f (beat4.ts's CardState, its strike never drawn: it is no road not taken, it is the theme returning): in
 * from the frame before its rise cue (its first move on the cue), settled 12 f later, held, off from its exit cue (its
 * first move on the cue) over 8 f, wholly beyond the frame's west edge on its last drawn frame.
 */
export function actOneCardAt(f: number): CardState | null {
  const C = CARD_11;
  const start = C.rise - 1;
  const leave = C.exit - 1;
  if (f <= start || f >= leave + C.exitFrames + 1) return null;
  return { rise: RISE((f - start) / C.riseFrames), strike: 0, exit: EXIT(clamp((f - leave) / C.exitFrames)), play: f - start - C.riseFrames };
}
/**
 * The world a notch down while the card is up (the card is the beat's action, as beat 10.2's are): in over 12 f as it rises
 * (from 2 f before its rise cue), out over 10 f as it leaves (from its first move, the frame after its exit cue's eve), back
 * to 0 before the collar's frame (summary.ts summaryStep hands the main set to the collar's gauge there).
 */
export const CARD_NOTCH = { amount: 0.5, frames: 12, outFrames: 10 } as const;
export const cardNotchAt = (f: number): number => CARD_NOTCH.amount * (sine((f - (CARD_11.rise - 2)) / CARD_NOTCH.frames) - sine((f - (CARD_11.exit - 1)) / CARD_NOTCH.outFrames));

/** The neck-collar gauge: at rest on the deck by the throat (objects/Register.tsx), its centre at its disc's mid-height. */
export const GAUGE_C: P3 = [THROAT.box.x0 + 8, THROAT.box.y0 - 34, DECK.top + 0.5];
/**
 * Its flight: it unclips off the throat (4 f: a hop up, tipping, drawing back), flies to your lamp's neck in an arc and
 * docks there on collar.to with a squash (its rubber gasket taking the clamp), at its own size, tipped toward the camera;
 * then it rides your lamp, its needle swinging high up its scale on spring-heavy (the gauge's scale runs over the top from
 * 160° low, west, to 20° high, east: gl/text.ts; a swing up is a negative turn, as beat 6's).
 */
export const COLLAR = { from: BEAT_11.collar.from, to: BEAT_11.collar.to, antic: 4, apex: 70, scale: 1, tilt: 0.55, neck: 0.22, lift: 9, needle: -2.1, needleFrom: BEAT_11.collar.to + 2, hop: 6, tip: 0.22, squash: 0.08, squashFrames: 5 } as const;
export interface CollarPose {
  /** its centre, its turn about z, its tilt (about its own x), its scale */
  c: P3;
  yaw: number;
  tilt: number;
  scale: number;
  /** its dock's squash (0..COLLAR.squash) */
  squash: number;
  /** its needle's swing (radians added to beat 4's): high once it rides your lamp */
  needle: number;
  flying: boolean;
}
/** Where the collar sits on your lamp's neck at a pose of your lamp. */
export function collarDock(pose: YouPose): { c: P3; yaw: number } {
  const { head, elbow } = pose.lamp;
  const t = COLLAR.neck;
  const c: P3 = [lerp(head[0], elbow[0], t), lerp(head[1], elbow[1], t), lerp(head[2], elbow[2], t) + COLLAR.lift];
  return { c, yaw: Math.atan2(head[1] - elbow[1], head[0] - elbow[0]) - Math.PI / 2 };
}
/** The collar at f (null before it lifts: the Register draws it at rest); `pose`: your desk's pose at f (it rides your lamp). */
export function collarAt(f: number, pose: YouPose): CollarPose | null {
  const C = COLLAR;
  if (f <= C.from) return null;
  const dock = collarDock(pose);
  const needle = C.needle * springAt(f, C.needleFrom, SPRING.heavy);
  if (f >= C.to) return { c: dock.c, yaw: dock.yaw, tilt: C.tilt, scale: C.scale, squash: C.squash * Math.max(0, 1 - (f - C.to) / C.squashFrames), needle, flying: false };
  const d = Math.hypot(dock.c[0] - GAUGE_C[0], dock.c[1] - GAUGE_C[1]) || 1;
  const a: P3 = [GAUGE_C[0] - ((dock.c[0] - GAUGE_C[0]) / d) * 3, GAUGE_C[1] - ((dock.c[1] - GAUGE_C[1]) / d) * 3, GAUGE_C[2] + C.hop];
  if (f < C.from + C.antic) {
    // it unclips: a hop up off the deck, tipping back on its clip, drawing back from where it goes
    const t = sine((f - C.from) / C.antic);
    return { c: lerp3(GAUGE_C, a, t), yaw: 0, tilt: -C.tip * Math.sin(Math.PI * t), scale: 1, squash: 0, needle: 0, flying: true };
  }
  const x = (f - C.from - C.antic) / (C.to - C.from - C.antic);
  const u = sine(x);
  const l = lerp3(a, dock.c, u);
  const c: P3 = [l[0], l[1], l[2] + 4 * C.apex * x * (1 - x)];
  return { c, yaw: dock.yaw * u, tilt: C.tilt * u, scale: lerp(1, C.scale, u), squash: 0, needle: 0, flying: true };
}

// ------------------------------------------------------------------------------------------------
// 11.4: the step-down, the next replies and your lamp's turns

/**
 * What steps down on BEAT_11.stepDown (everything but your desk, your lamp and the stamped reply): the parts not already
 * stepped (summary.ts holds the bays, the cord and the trace's set stepped), each object's own id (kit.tsx isStepped):
 * the Register's deck and its parts, the gate, the belt, the spike, the folders' feeders, beat 7's job rail, the route's
 * inks and the bay's cap (objects/Trace.tsx 'b11-trace'), the vellum parts (objects/Proposed.tsx 'b11-proposed').
 */
export const STEP_11: readonly FocusId[] = ['gate', 'belt', 'head', 'index', 'mouth', 'deck', 'chute', 'proactive', 'spike', 'jaws', 'bosses', 'testsBay', 'folders', 'stress', 'b7-rail', 'b7-plate', 'b11-trace', 'b11-proposed'];

/**
 * The next replies (11.4): unstamped slips that come down the chute from under the deck, each before a lamp turn, and wait
 * queued in it (the first part-way down the trough, clear over your in-tray so the stamped reply's ID stays in view, the next behind it at the chute's head): decisions waiting for you. Each rides on the replies'
 * path (state.ts replyPose: out from under the deck, down the trough) over `frames`, easing in and to its stop.
 */
export const NEXT_REPLIES = [
  { id: 'b11-next-1', leave: BEAT_11.lampTurns[0]! - 24, frames: 20, stop: 0.68 },
  { id: 'b11-next-2', leave: BEAT_11.lampTurns[1]! - 24, frames: 20, stop: 0.2 },
] as const;
/** The chute's own length (its bed, as state.ts measures the replies' run). */
const CHUTE_LEN = CHUTE.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - CHUTE[i]![0], q[1] - CHUTE[i]![1], q[2] - CHUTE[i]![2]), 0);
/** A run's share at t (0..1): gathering speed over its first quarter, a constant pace, slowing to its stop over its last quarter. */
const run = (t: number): number => {
  const x = clamp(t);
  const a = 0.25;
  const v = 1 / (1 - a);
  return x < a ? (v * x * x) / (2 * a) : x < 1 - a ? v * (x - a / 2) : 1 - (v * (1 - x) ** 2) / (2 * a);
};
/** A next reply's ride at f (null before it leaves): on the path to its stop in the trough, then waiting there. */
export function nextRideAt(f: number, n: (typeof NEXT_REPLIES)[number]): SlipRide | null {
  if (f <= n.leave) return null;
  const d = run((f - n.leave) / n.frames) * (REPLY_LEAD + CHUTE_LEN * n.stop);
  return { emerge: clamp(d / REPLY_LEAD), s: Math.min(n.stop, clamp((d - REPLY_LEAD) / CHUTE_LEN)), arc: 0, squash: 0, settle: 0 };
}
/** The next replies at f (DeskState.replies: footprints.ts casts them in the trough; objects/Beat11.tsx draws them). */
export const nextReplies = (f: number): ReplyState[] =>
  NEXT_REPLIES.flatMap((n) => {
    const ride = nextRideAt(f, n);
    return ride ? [{ id: n.id, ride, rest: [0, 0, 0] as P3 }] : [];
  });
/** Where your lamp turns on each of BEAT_11.lampTurns: the next reply waiting in the chute (its face's centre). */
let aims: P3[] | null = null;
export const lampAims = (): readonly P3[] =>
  (aims ??= NEXT_REPLIES.map((n) => {
    const p = replyPose(nextRideAt(n.leave + n.frames, n)!).p;
    return [p[0], p[1], p[2] + 1] as P3;
  }));
/** The lamp turns about its base's swivel (the whole arm yaws) as its hood comes round onto the next reply. */
export function lampTurnAt(f: number, pose: YouPose): YouPose {
  if (f <= BEAT_11.lampTurns[0]!) return pose;
  let aim: P3 = pose.lamp.aim;
  const to = lampAims();
  BEAT_11.lampTurns.forEach((at, i) => {
    const k = springAt(f, at, SPRING.heavy);
    const t = to[i]!;
    aim = [aim[0] + (t[0] - aim[0]) * k, aim[1] + (t[1] - aim[1]) * k, aim[2] + (t[2] - aim[2]) * k];
  });
  // the arm yaws about the base by the aim's turn round it, the head carried with it
  const b = pose.lamp.base;
  const a0 = Math.atan2(pose.lamp.aim[1] - b[1], pose.lamp.aim[0] - b[0]);
  const a1 = Math.atan2(aim[1] - b[1], aim[0] - b[0]);
  const d = a1 - a0;
  const rot = (p: P3): P3 => [b[0] + (p[0] - b[0]) * Math.cos(d) - (p[1] - b[1]) * Math.sin(d), b[1] + (p[0] - b[0]) * Math.sin(d) + (p[1] - b[1]) * Math.cos(d), p[2]];
  return { ...pose, lamp: { ...pose.lamp, head: rot(pose.lamp.head), elbow: rot(pose.lamp.elbow), aim } };
}

// ------------------------------------------------------------------------------------------------
// The state and the hooks

export interface Beat11State {
  f: number;
  /** the trait plates this module draws (null: an act-two body draws it at rest) */
  plates: Record<PlateId, PlatePose | null>;
  /** the map key's legend plate (its offset north of its place) */
  key: { dy: number } | null;
  /** the act-one card */
  card: CardState | null;
  /** the neck-collar gauge, once it has lifted off the throat */
  collar: CollarPose | null;
}
/** DeskState.e11: from the seam (SEAM_D, f5424) on; null before it. */
export function beat11At(f: number): Beat11State | null {
  if (f < 5424) return null;
  // the collar rides your lamp: its pose at f from the desk's pose after the turn and the lamp's turns (objects/Beat11.tsx poses
  // the drawn collar on actOne.ts youPoseAt, the pose YourDesk draws; the two agree in the summary: beat11.test)
  return { f, plates: platesAt(f), key: keyAt(f), card: actOneCardAt(f), collar: collarAt(f, lampTurnAt(f, YOU_POSE_B)) };
}

/** Your lamp's steps: a step brighter on the stamp (STORYBOARD 11.1: it is in still (d)). */
export const LAMP_11: readonly LampStep[] = [{ at: STAMP_11, steps: 1 }];

export function cards11(s: DeskState): CardUp[] {
  const c = s.e11?.card;
  return c ? [{ card: c, spot: CARD_SPOT_11 }] : [];
}

/** A plate's footprint: lying (contact), or in the air (a carrier's: no contact), its plan size scaled with it. */
function plateFp(p: PlatePose, worded: { box: Rect; t: number } | null, ground: readonly number[], grow = 1): Footprint {
  const size = p.body === 'worded' && worded ? sizeOf(worded.box) : [MINI.l, MINI.w];
  const hl = Math.max(1, ((size[0] * p.sx) / 2) * grow);
  const hw = Math.max(1, ((size[1] * p.sy) / 2) * Math.abs(Math.cos(p.roll)) * grow);
  const t = (p.body === 'worded' && worded ? worded.t : MINI.t) / 2;
  if (!p.flying) return { kind: 'rect', c: [p.c[0], p.c[1]], h: [hl, hw], r: 3, rot: p.yaw, z0: p.c[2] - t, z1: p.c[2] + t - 0.3, contact: 0.8 };
  // its contact opens as it lifts off what it lay on and closes as it comes down onto where it lands (never a one-frame swap)
  const near = Math.min(...ground.map((z) => Math.abs(p.c[2] - t - z)));
  return { kind: 'rect', c: [p.c[0], p.c[1]], h: [hl, hw], r: 3, rot: p.yaw, ...carrierSpan({ p: p.c, slope: 0 }, hl, t), contact: 0.8 * clamp(1 - near / 4) };
}
/** Beat 11's footprints: the plates (in flight, docked, in the tray), the collar in flight, the key's legend plate while it is in. */
export function footprints11(s: DeskState): Footprint[] {
  const e = s.e11;
  if (!e) return [];
  const fp: Footprint[] = [];
  for (const id of ['proactive', 'productive'] as const) {
    const p = e.plates[id];
    // what it lifted off and what it lands on (their tops): the slate or the job rail, then the tray
    if (p) fp.push(plateFp(p, WORDED[id], [WORDED[id].z, MINI_DOCK[id][2], TRAY_TOP]));
  }
  // Continuous on its brackets casts none (objects/Register.tsx): in the air its shadow grows in as it comes down onto the two in the tray
  const cp = e.plates.continuous;
  const cLand = plateLands('continuous')[0]!;
  if (cp && s.f > cLand - 10) fp.push(plateFp(cp, WORDED.continuous, [TRAY_TOP + MINI.t], cp.flying ? sine((s.f - (cLand - 10)) / 8) : 1));
  const c = e.collar;
  // the collar in the air: its shadow grows in as it lifts and closes up as it docks on your lamp (it casts none at rest on either)
  if (c?.flying) fp.push({ kind: 'circle', c: [c.c[0], c.c[1]], r: Math.max(1, 28 * c.scale * Math.min(1, (s.f - COLLAR.from) / 4, (COLLAR.to - s.f) / 4)), z0: c.c[2] - 2.5, z1: c.c[2] + 2.5, contact: 0 });
  const k = e.key;
  if (k) fp.push(rectFp({ ...KEY_BOX, y0: KEY_BOX.y0 + k.dy, y1: KEY_BOX.y1 + k.dy }, 0, KEY_PLATE.top, 0.8, 4));
  return fp;
}

/** Beat 11's pools: none of its own (the card's light is pools.ts cardPoolOf; your lamp's pool follows its aim). */
export function pools11(_s: DeskState): Pool[] {
  return [];
}
/** Your desk's pose refined by beat 11: your lamp's turns (11.4); pools.ts's lamp pool follows the pose's aim. */
export function you11(f: number, pose: YouPose): YouPose {
  return lampTurnAt(f, pose);
}

/** Screen point of a world point at still (d)'s framing (tests, layout). */
export const onD = (p: P3): [number, number] => project(POSE_D, p);
