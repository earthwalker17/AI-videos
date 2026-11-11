/**
 * Where part two's objects stand across the frame (bars 44-84): the pans of beats 7-13.
 *
 * The score may not import src/desk, and most of part two's picture is built while the score is written (session
 * 5). So the layout a pan reads is copied here from the desk modules that hold it (layout.ts, beat6.ts, turn.ts,
 * summary.ts; score.test.ts holds every copy equal to its source), and the camera is the director's plan of
 * 2026-11-12 (CAMERA_PLAN: bar 50 trucks east to the evidence sheet at 0.7x, bar 58 eases out to still (d)'s
 * framing, bar 65 dollies in to FRAMING_B, bar 69 is summary.ts EASE_OUT_D, bar 76 returns to the hook's framing),
 * eased as camera.ts eases a move. An object the picture has not placed yet takes the storyboard's screen position
 * (SCREEN, from the session's beat maps). Every pan of an unbuilt object is to be re-checked when the picture lands.
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

/** camera.ts FRAMING_B and FRAMING_HOOK, summary.ts FRAMING_D, and the evidence sheet's framing (beat 8, map option C: aim (650, 40) at 0.7x). */
export const FRAMING_B: Framing = { x: -200, zoom: 0.85 };
export const FRAMING_D: Framing = { x: 85, zoom: 0.64 };
export const FRAMING_HOOK: Framing = { x: -600, zoom: 1.6 };
export const FRAMING_SHEET: Framing = { x: 650, zoom: 0.7 };

/** Part two's camera, held at FRAMING_B from bar 43's ease-out until the first move. */
export const CAMERA_PLAN: readonly Move[] = [
  { from: at(50), to: at(51), a: FRAMING_B, b: FRAMING_SHEET },
  { from: at(58), to: at(59), a: FRAMING_SHEET, b: FRAMING_D },
  { from: at(65), to: at(66), a: FRAMING_D, b: FRAMING_B },
  // summary.ts EASE_OUT_D: the stamp, then three beats
  { from: BEAT_11.stamp, to: BEAT_11.stamp + 60, a: FRAMING_B, b: FRAMING_D },
  { from: END.move[0], to: END.move[1], a: FRAMING_D, b: FRAMING_HOOK },
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
  flag: 676,
  /** the graphite machines, north to south (summary.ts MACHINES) */
  machines: [1250, 1280, 1240] as readonly number[],
  /** the vellum: the plan of the deck, the state cabinet, the loop's sheet (its centre), the tethers (from the loop's east edge to the clips' mean) */
  plan: 930,
  cabinet: 900,
  loop: 875,
  tethers: 1075,
  /** the Watchdog's station (summary.ts WATCHDOG.c) */
  watchdog: 790,
  /** the pencil "?" beside the tethers, the handle outline on the docs bay (summary.ts QUERIES[0], HANDLE.c) */
  query: 1078,
  handle: -6,
} as const;

/**
 * Screen x (px) of what the picture has not placed yet, from the session's beat maps (map-beat8.md option C, map-beats11-13.md
 * section 4's label feet at 0.64x, the storyboard's end card "lower-left").
 */
export const SCREEN = {
  /** beat 7, at FRAMING_B: the oval side rail on the bay floor's south-east edge (map-beat7.md section 6) */
  sideRail: 1560,
  /** beat 8, at the sheet's framing: the lanes and their strips, the bracket and notches, the token column; the tick row's ends (world x) */
  lanes: 900,
  stacks: 1180,
  rowFrom: 200,
  rowTo: 1100,
  /** beat 11's six idea labels in order (gate and loupe, throat, window, the bay's door, the state cabinet, the Watchdog) and the map key */
  ideas: [623, 665, 815, 1099, 1490, 1425] as readonly number[],
  keyMap: 1590,
  /** the act-one card (it rises west of the system) and the end card (lower left) */
  actOneCard: 700,
  endCard: 640,
} as const;
