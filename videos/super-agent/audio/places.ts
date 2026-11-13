/**
 * Where part two's objects stand across the frame (bars 44-84): the pans of beats 7-13.
 *
 * The score may not import src/desk, and most of part two's picture is built while the score is written (session
 * 5). So the layout a pan reads is copied here from the desk modules that hold it (layout.ts, beat6.ts, turn.ts,
 * summary.ts; score.test.ts holds every copy equal to its source), and the camera is the director's plan of
 * 2026-11-12 (CAMERA_PLAN: bar 50 trucks east to the evidence sheet at 0.7x, bar 58 eases out to still (d)'s
 * framing, bar 65 dollies in to FRAMING_B, bar 69 is summary.ts EASE_OUT_D, bar 76 returns to the hook's framing),
 * eased as camera.ts eases a move. A few things are placed by the picture on the screen itself, or have no single world
 * point (SCREEN). Every entry was checked against the built picture in session 5 wave 4: each sounding object projected
 * through camera.ts cameraAt(f, 15) at its contact frame (score.test.ts holds the copies, and the projections it can).
 *
 * A pan is where the object stands across the frame at that film frame, narrowed to 0.9 as act one's folders are:
 * 0.9 x (x - the frame's centre x) x zoom / 960, within ±0.9.
 */
import { clamp } from '@aiv/pipeline/audio/kit';
import { BEAT_11, END, at } from '../src/cues.ts';
import { cameraEase } from './actOne.ts';

/** A framing as the pans need it: the centre x (world u) and the zoom (camera.ts Framing, without y). */
export interface Framing {
  x: number;
  zoom: number;
}
export interface Move {
  from: number;
  to: number;
  a: Framing;
  b: Framing;
}

/** camera.ts FRAMING_B and FRAMING_HOOK, FRAMING_D, and the evidence sheet's framing (beat 8, map option C: aim (650, 40) at 0.7x). */
export const FRAMING_B: Framing = { x: -200, zoom: 0.85 };
export const FRAMING_D: Framing = { x: 85, zoom: 0.64 };
export const FRAMING_HOOK: Framing = { x: -600, zoom: 1.6 };
export const FRAMING_SHEET: Framing = { x: 650, zoom: 0.7 };
/** camera.ts FRAMING_BOOKEND: the hook's framing 40 u east, so bar 76's one-bar move keeps under 700 px/s. */
export const FRAMING_BOOKEND: Framing = { x: -560, zoom: 1.6 };

/** Part two's camera, held at FRAMING_B from bar 43's ease-out until the first move. */
export const CAMERA_PLAN: readonly Move[] = [
  { from: at(50), to: at(51), a: FRAMING_B, b: FRAMING_SHEET },
  { from: at(58), to: at(59), a: FRAMING_SHEET, b: FRAMING_D },
  { from: at(65), to: at(66), a: FRAMING_D, b: FRAMING_B },
  // summary.ts EASE_OUT_D: the stamp, then three beats
  { from: BEAT_11.stamp, to: BEAT_11.stamp + 60, a: FRAMING_B, b: FRAMING_D },
  { from: END.move[0], to: END.move[1], a: FRAMING_D, b: FRAMING_BOOKEND },
];

/** A move's framing at eased progress u: the zoom even in log scale, the centre trucking with 1/zoom (camera.ts moveFraming). */
export function moveAt(m: Move, u: number): Framing {
  const r = m.b.zoom / m.a.zoom;
  const w = Math.abs(r - 1) < 1e-6 ? u : (1 - r ** -u) / (1 - 1 / r);
  return { x: m.a.x + (m.b.x - m.a.x) * w, zoom: m.a.zoom * r ** u };
}

/** The planned framing at film frame f (fractional allowed), from bar 44 on. */
export function framingAt(f: number): Framing {
  let fr = FRAMING_B;
  for (const m of CAMERA_PLAN) {
    if (f <= m.from) return fr;
    if (f < m.to) return moveAt(m, cameraEase((f - m.from) / (m.to - m.from)));
    fr = m.b;
  }
  return fr;
}

/** Where world x stands across the frame at film frame f, as a pan. */
export const panAt = (x: number, f: number): number => {
  const fr = framingAt(f);
  return clamp((0.9 * (x - fr.x) * fr.zoom) / 960, -0.9, 0.9);
};

/** A pan from a storyboard screen x (px of 1920). */
export const screenPan = (px: number): number => clamp((0.9 * (px - 960)) / 960, -0.9, 0.9);

/**
 * World x of the parts part two's sounds come from (u), copied from the desk modules (score.test.ts holds each equal
 * to its source).
 */
export const X = {
  /** the cord leaves the chat spool, rides over the mast, ends at its terminal by the bug bay (layout.ts CORDS.vermilion first, MAST, last) */
  spool: -778,
  mast: 352,
  terminal: 438,
  /** the Register: its throat (layout.ts THROAT's centre), the print head over the tape (PRINT_HEAD's centre), the tape's middle (TAPE), the reel (REEL.x) */
  throat: -368,
  printHead: -321,
  tape: -80.5,
  reel: 135,
  /** the index arm's pivot (INDEX.pivot) */
  index: -318,
  /** the bug bay (BAYS.bug.box's centre) and its door (BAYS.bug.door's centre) */
  bugBay: 360,
  bugDoor: 298,
  /** the capsule's oval side rail (beat7.ts OVAL, its middle): on the bay floor's south edge, under the bay on screen */
  sideRail: 360,
  /** the sand-glass docked on the job rail (summary.ts DOCKED.glass) */
  glassDocked: 414,
  /** your desk: the in-tray's centre, the laptop's centre, your lamp's head (YOU, LAMP.head) */
  inTray: -520,
  laptop: -731,
  lampHead: -606,
  /** the chat feeder's centre (FEEDERS.chat) and the card feeder's mouth, the repo port (beat6.ts CI_MOUTH.to) */
  chatFeeder: -942,
  repoPort: -860,
  /** the stuck bay (FRESH.box's centre) and the pencil flag on it (summary.ts FLAG) */
  stuckBay: 611,
  flag: 695,
  /** the graphite machines, north to south (summary.ts MACHINES) */
  machines: [1250, 1280, 1240] as readonly number[],
  /** the vellum: the plan of the deck, the state cabinet, the loop's sheet (its centre), the tethers (from the loop's east edge to the clips' mean) */
  plan: 930,
  cabinet: 900,
  loop: 875,
  tethers: 1075,
  /** the Watchdog's station (summary.ts WATCHDOG.c) */
  watchdog: 605,
  /** the pencil "?" beside the tethers, the handle outline on the docs bay (summary.ts QUERIES[0], HANDLE.c) */
  query: 1078,
  handle: -6,
  /** the bookend slip lying out of the chat drum's spout (end.ts SPOUT_SLIP) */
  spoutSlip: -813,
} as const;

/**
 * Beat 8's printed test sheet (beat8.ts SHEET8 and onSheet; score.test.ts holds each equal to its source): the world x of
 * what sounds on it. The sheet lies east of the bays, so at its framing (0.7x) all of it is right of centre.
 */
export const SHEET_X = {
  /** the tick row's first and last tick (SHEET8.x0 + tickU(0) and tickU(n - 1)) */
  row: [791, 1807.6] as readonly number[],
  /** the caveat stamp's middle (CAVEAT) */
  caveat: 1330,
  /** each lane's strip, its middle once slid out (ORIGIN_U + stripLength / 2) */
  strips: [1052.25, 1048.5, 948.75] as readonly number[],
  /** the hero stamps' middles, ~½, ~10% and 2–4× (STAMPS8: u + em x adv / 2), in evidence.ts STAMPS' order */
  stamps: [1742.14, 1573.4, 1570.6] as readonly number[],
  /** the bracket's bar, between the two holes it joins (BRACKET) */
  bracket: 1027.5,
  /** the told-to-delegate strip's five notch places (ORIGIN_U + NOTCH.s) */
  notches: [852, 895, 938, 981, 1024] as readonly number[],
  /** the long run's band, its middle (BAND) */
  longRun: 1114,
  /** each token stack's middle (CLAMP.u1 + its extent / 2) */
  stacks: [882.74, 925.69, 1039] as readonly number[],
} as const;

/**
 * Screen x (px of 1920) of what is placed on the screen, or has no single world point, as built (session 5 wave 4).
 */
export const SCREEN = {
  /**
   * beat 11's six idea labels in order (gate and loupe, throat, window, the bay's door, the state cabinet, the Watchdog):
   * where each leader's foot lands on its part at still (d)'s framing (beat11.ts TAGS_11 foot, projected), as its click
   * sounds when the foot touches
   */
  ideas: [697, 657, 816, 1185, 1546, 1363] as readonly number[],
  /** the map key's block, its plate's west edge to its east end: its middle (beat11.ts KEY_SCREEN; measured on the built frame f5730, and kept when the zh column went, 2026-11-14) */
  keyMap: 1512,
  /** the act-one card at rest, west of the Register over the feeders (beat11.ts CARD_SCREEN): it comes in from and leaves by the frame's west edge */
  actOneCard: 300,
  /** the end card's middle (endCard.ts: its corners at rest about x 101-1358) */
  endCard: 730,
} as const;
