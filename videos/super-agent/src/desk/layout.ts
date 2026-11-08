/**
 * The Register Desk's world (TREATMENT.md, Art direction v2): where every object stands, how big it
 * is and how tall, in world units. One unit is one screen pixel at camera zoom 1.0 (camera.ts), x
 * runs east, y north, z up; the desk is the plane z = 0. The origin is the centre of style frame
 * (b) ("Workers report up. Only the Router talks to you.", camera 0.85×), so at that framing a
 * point (x, y) on the desk lands near screen (960 + 0.85 x, 540 − 0.85 y).
 *
 * The planes (synthesis §2, Depth): pressed history −2, the desk 0, paper 1–20, the bays 40–140,
 * the Register's deck 120, flights up to ~190, the Thread cords ~200.
 *
 * Pure numbers only: the objects (objects/*.tsx) build their geometry from these, and
 * footprints.ts derives the analytic shadows from the same numbers.
 */

export type P2 = readonly [number, number];
export type P3 = readonly [number, number, number];

/** An axis-aligned box on the desk plane. */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const rectW = (r: Rect): number => r.x1 - r.x0;
export const rectD = (r: Rect): number => r.y1 - r.y0;
export const rectC = (r: Rect): P2 => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];

/** The key light's direction (towards the light, unnormalised as the synthesis gives it). */
export const KEY: P3 = [-0.55, 0.45, 0.7];
/** Shadows fall this way on the desk (unit, xy): away from the key. */
export const SHADOW_DIR: P2 = (() => {
  const l = Math.hypot(KEY[0], KEY[1]);
  return [-KEY[0] / l, -KEY[1] / l] as const;
})();
/** A shadow is offset this far per unit of height (synthesis §2: 0.84·h). */
export const SHADOW_K = 0.84;
/** Penumbra width of a shadow cast from height h above its receiver (4 + 0.35·h px). */
export const penumbra = (h: number): number => 4 + 0.35 * h;
/** Where the shadow of a point at height h above the receiver lands, relative to the point. */
export const shadowOffset = (h: number): P2 => [SHADOW_DIR[0] * SHADOW_K * h, SHADOW_DIR[1] * SHADOW_K * h];

// ------------------------------------------------------------------------------------------------
// The Register ("the Router"): a raised, skeletal graphite deck one level above the bays

/** The deck's outline and its levels: rails from z 104 to the deck top at 122. */
export const DECK = { x0: -360, x1: 280, y0: 120, y1: 480, railZ0: 104, top: 122, rail: 18 } as const;
/** Legs: 18 u square posts from the desk up to the rails (four corners and the middle of each long side). */
export const LEGS: readonly P2[] = [
  [DECK.x0 + 9, DECK.y0 + 9],
  [-40, DECK.y0 + 9],
  [DECK.x1 - 9, DECK.y0 + 9],
  [DECK.x0 + 9, DECK.y1 - 9],
  [-40, DECK.y1 - 9],
  [DECK.x1 - 9, DECK.y1 - 9],
];
export const LEG = 18;
/** Cross members inside the rails (same height as the rails). */
export const CROSS: readonly Rect[] = [
  // north-south, under the reel frame's west member
  { x0: -12, x1: 6, y0: DECK.y0 + DECK.rail, y1: DECK.y1 - DECK.rail },
  // east-west, under the trait plate
  { x0: DECK.x0 + DECK.rail, x1: -12, y0: 380, y1: 392 },
  // east-west, under the reel's bearing
  { x0: 6, x1: DECK.x1 - DECK.rail, y0: 330, y1: 344 },
];
/** The one solid plate of the deck: under the print head, the tape and the reading window. */
export const DECK_PLATE: Rect = { x0: DECK.x0 + DECK.rail, x1: -12, y0: DECK.y0 + DECK.rail, y1: 276 };

/** The wound-tape reel: tape thickness is the log. */
export const REEL = { x: 135, y: 337, r: 125, flangeZ: [122, 127], packR: 112, packZ: [127, 150], hubR: 22, hubZ: [127, 162] } as const;
/** The rectangular frame round the reel, open to the south where the tape comes in (enamel caps on graphite). */
export const REEL_FRAME: readonly Rect[] = [
  { x0: -12, x1: 4, y0: 274, y1: 482 },
  { x0: -12, x1: 280, y0: 466, y1: 482 },
  { x0: 264, x1: 280, y0: 242, y1: 482 },
];
export const REEL_FRAME_Z: readonly [number, number] = [122, 142];

/** The tape from the print head to where it winds onto the reel's south side. */
export const TAPE = { x0: -296, x1: REEL.x, y0: 193, y1: 257, z: 122.6 } as const;
/** Where the flat run of the tape ends and it rises onto the reel's pack. */
export const TAPE_FLAT_X1 = TAPE.x1 - 24;
/** The reading window over the tape: the Router's context, five inline cells. */
export const WINDOW = { frame: { x0: -300, x1: 26, y0: 183, y1: 267 } as Rect, z: [122, 133] as const, bar: 8 } as const;
/** The five inline cells (oldest west), each 58 u along the tape. */
export const CELLS_X: readonly [number, number][] = [0, 1, 2, 3, 4].map((i) => [-292 + 62 * i, -292 + 62 * i + 58] as [number, number]);

/** The Continuous plate (trait 连续), docked on the deck at the turn (cues.ts 'trait-continuous', f1640): the notes loop became the Register's tape. */
export const TRAIT_PLATE = { box: { x0: -330, x1: -16, y0: 380, y1: 476 } as Rect, z: [122, 126] as const } as const;
/** The hooded reading lamp just north of the window: a low bar hood on two arms; its pool lies on the cells. */
export const READ_LAMP = { x0: -290, x1: 14, y: 290, z: 166, r: 12, posts: [-262, -30] as const, postY: 271 } as const;

/** The print head at the throat (the sequence point) and its enamel cap. */
export const PRINT_HEAD = { box: { x0: -342, x1: -300, y0: 178, y1: 272 } as Rect, z: [122, 180] as const } as const;
/** The throat: the intake's mouth on the deck's west end. */
export const THROAT = { box: { x0: -394, x1: -342, y0: 193, y1: 257 } as Rect, z: [96, 126] as const } as const;
/** The neck-collar gauge on the throat (its needle low: the queue is short). */
export const GAUGE = { x: -372, y: 172, r: 15, z: 127 } as const;
/** The policy card pinned under the loupe, and the loupe on its swing arm. */
export const POLICY_CARD = { box: { x0: -356, x1: -282, y0: 290, y1: 376 } as Rect, z: 126 } as const;
export const LOUPE = { x: -319, y: 333, z: 160, r: 34, pivot: [-338, 428] as P2 } as const;

/** The index arm on its detent plate: it turns to face whom the Register addresses. */
export const INDEX = { pivot: [-318, 150] as P2, z: 126, length: 140, plateR: 62, plateA: [-176, -4] as const } as const;

/** The spill drawer, pulled out under the south rail; folded bodies drop in here. */
export const DRAWER = { box: { x0: 30, x1: 130, y0: 92, y1: 150 } as Rect, z: [80, 108] as const } as const;
/** The hopper where Workers' report cards land. */
export const HOPPER = { box: { x0: 212, x1: 274, y0: 150, y1: 236 } as Rect, z: [122, 134] as const, land: [243, 196, 136] as P3 } as const;
/** The sealed restricted-shell key in its lock plate on the north-east leg (FACTS: the Router keeps a shell). */
export const LOCK = { box: { x0: 250, x1: 292, y0: 446, y1: 494 } as Rect, z: [122, 152] as const, key: { x0: 292, x1: 318, y: 470, z: 141, bowR: 10 } } as const;
/** The pilot jewel on the south rail: lit, never blooming. */
export const JEWEL = { x: -210, y: 129, z: 122, r: 7 } as const;

/** The fanfold under the deck: older log, folded away (paper, 0.8 u a sheet). */
export const FANFOLD = { box: { x0: -300, x1: -130, y0: 280, y1: 430 } as Rect, sheets: 36 } as const;
export const SHEET = 0.8;

/** The dispatch ramp: a quarter-pipe from the deck's south rail down to the desk, where the grooves begin. */
export const RAMP = { x0: 150, x1: 240, top: 120, lip: 90, foot: 30 } as const;

/** Act-one folder imprints pressed into the desk under the deck (history, at −2). */
export const IMPRINTS: readonly { c: P2; w: number; d: number; rot: number }[] = [
  { c: [-260, 360], w: 130, d: 96, rot: 0.06 },
  { c: [-110, 412], w: 136, d: 100, rot: -0.03 },
  { c: [60, 430], w: 128, d: 94, rot: 0.05 },
  { c: [215, 400], w: 132, d: 98, rot: -0.07 },
  { c: [-190, 205], w: 126, d: 92, rot: -0.04 },
  { c: [150, 230], w: 134, d: 96, rot: 0.03 },
];

// ------------------------------------------------------------------------------------------------
// The Workers: one class of walled bay, each with its own superstructure

export type BayId = 'bug' | 'tests' | 'docs';

export interface BayLayout {
  id: BayId;
  box: Rect;
  wallH: number;
  wall: number;
  /** the south wall is thicker: its top carries the enamel nameplate band */
  southWall: number;
  /** the door's gap in the north wall (facing the deck) */
  door: [number, number];
  /** the work slot's block at the back, and its glowing slit on top */
  slot: Rect;
  dossier: Rect;
  /** sheets in the dossier: context is paper */
  sheets: number;
  rack: Rect;
}

export const BAYS: Record<BayId, BayLayout> = {
  bug: {
    id: 'bug',
    box: { x0: 0, x1: 240, y0: -340, y1: -30 },
    wallH: 56,
    wall: 10,
    southWall: 26,
    door: [92, 168],
    slot: { x0: 16, x1: 80, y0: -76, y1: -42 },
    dossier: { x0: 14, x1: 104, y0: -306, y1: -236 },
    sheets: 40,
    rack: { x0: 118, x1: 226, y0: -308, y1: -236 },
  },
  tests: {
    id: 'tests',
    box: { x0: 330, x1: 580, y0: -300, y1: -40 },
    wallH: 56,
    wall: 10,
    southWall: 26,
    door: [360, 436],
    slot: { x0: 512, x1: 566, y0: -86, y1: -52 },
    dossier: { x0: 344, x1: 434, y0: -266, y1: -196 },
    sheets: 22,
    rack: { x0: 462, x1: 570, y0: -268, y1: -196 },
  },
  docs: {
    id: 'docs',
    box: { x0: 660, x1: 1010, y0: -384, y1: -104 },
    wallH: 40,
    wall: 10,
    southWall: 26,
    door: [690, 766],
    slot: { x0: 940, x1: 996, y0: -148, y1: -116 },
    dossier: { x0: 674, x1: 764, y0: -350, y1: -280 },
    sheets: 26,
    rack: { x0: 890, x1: 998, y0: -352, y1: -280 },
  },
};
/** The bay floor plate's top. */
export const BAY_FLOOR = 6;

/** The bug bay's tall bench, its six test pins and the docked vermilion folder with the request on it. */
export const BENCH = { top: { x0: 30, x1: 210, y0: -230, y1: -96 } as Rect, z: [92, 102] as const, leg: 12 } as const;
export const PINS = { x0: 52, dx: 27, y: -110, h: 28, n: 6 } as const;
export const FOLDER = { box: { x0: 60, x1: 196, y0: -218, y1: -132 } as Rect, z: [102, 110] as const } as const;
/** The request: a vermilion chat slip 1.3× the others (40 × 88), with a beetle cut-out. */
export const REQUEST = { c: [128, -175] as P2, w: 52, l: 114, rot: 1.42, z: 110.6 } as const;

/** The test tower: stacked test lamps, the card slot on its cap. */
export const TOWER = { x: 466, y: -150, r: 42, drum: 22, gap: 3, n: 5, base: BAY_FLOOR } as const;
export const towerTop = (): number => TOWER.base + TOWER.n * (TOWER.drum + TOWER.gap) + 5;

/** The docs galley: a wide tray of type lines being set, under a clamped work light. */
export const GALLEY_TRAY = { box: { x0: 690, x1: 980, y0: -276, y1: -150 } as Rect, z: [BAY_FLOOR, 22] as const } as const;
export const GALLEY_LAMP = { x0: 724, x1: 946, y: -132, z: 112, posts: [716, 954] as const } as const;

// ------------------------------------------------------------------------------------------------
// You: a small desk with a bent-arm lamp (the film's only Λ), a laptop, the chore tray, the in-tray

export const YOU = {
  slab: { x0: -880, x1: -540, y0: -340, y1: -84 } as Rect,
  top: 28,
  blotter: { x0: -864, x1: -690, y0: -322, y1: -164 } as Rect,
  laptop: { x0: -820, x1: -690, y0: -300, y1: -212 } as Rect,
  lidH: 96,
  /** how far past upright the lid leans back (radians) */
  lidLean: 0.27,
  tray: { x0: -668, x1: -556, y0: -330, y1: -262 } as Rect,
  inTray: { x0: -646, x1: -556, y0: -226, y1: -120 } as Rect,
} as const;

/** The lamp: base, elbow, head (the hood aims down at the in-tray). */
export const LAMP = { base: [-842, -150, YOU.top] as P3, elbow: [-770, -108, 214] as P3, head: [-670, -146, 150] as P3, aim: [-600, -172, YOU.top] as P3, baseR: 28, hoodR: 28, hoodL: 44 } as const;

/** The reply chute: the only path down to you, from the deck's south-west corner to the in-tray. */
export const CHUTE: readonly P3[] = [
  [-350, 112, 110],
  [-420, 92, 100],
  [-496, 52, 86],
  [-556, -10, 70],
  [-588, -84, 58],
  [-600, -150, 50],
];
export const CHUTE_W = 42;
export const CHUTE_POSTS: readonly P2[] = [
  [-436, 86],
  [-562, -24],
];

// ------------------------------------------------------------------------------------------------
// Intake: the feeders (west), the fast gate, the belt up to the throat

export const SPOOL = { x: -776, y: 435, z: [62, 110] as const, r: 30 } as const;
export const FEEDERS = {
  chat: { x0: -1000, x1: -884, y0: 372, y1: 470 } as Rect,
  ci: { x0: -1000, x1: -890, y0: 214, y1: 312 } as Rect,
  mail: { x0: -1010, x1: -880, y0: 70, y1: 140 } as Rect,
  calendar: { x0: -1004, x1: -900, y0: -60, y1: 30 } as Rect,
} as const;
export const FEEDER_H = { chat: 64, ci: 52 } as const;

export const GATE = { bar: { x0: -568, x1: -552, y0: 246, y1: 352 } as Rect, h: 36, fingers: 7, fingerL: 44 } as const;
export const SPIKE = { x: -646, y: 384, h: 84, baseR: 22 } as const;
/** The intake belt from the gate up to the throat. */
export const BELT = { from: [-548, 300, 22] as P3, to: [-394, 210, 104] as P3, w: 62 } as const;

/**
 * The Thread cords: overhead twisted cords from the conversation spool, arching north of the reel at
 * about h 190 over a mast north-east of the deck, then down to the bay that holds each Thread (the
 * vermilion one, the request's Thread, to the bug bay; it passes over the Register's east end
 * without touching it: pass-through). Smooth curves through these points (centripetal Catmull-Rom);
 * kept inside the diagram band (screen y ≥ 72) at the 15° pitch.
 */
export const MAST = { x: 330, y: 486, h: 190 } as const;
export const CORDS: { readonly vermilion: readonly P3[]; readonly graphite: readonly P3[] } = {
  vermilion: [
    [SPOOL.x + 8, SPOOL.y + 6, 100],
    [-700, 458, 160],
    [-480, 478, 178],
    [-150, 484, 182],
    [150, 482, 184],
    [MAST.x, MAST.y - 6, MAST.h],
    [318, 380, 180],
    [300, 200, 150],
    [268, 56, 108],
    [232, -36, 72],
  ],
  graphite: [
    [SPOOL.x - 4, SPOOL.y + 16, 104],
    [-700, 470, 162],
    [-480, 490, 180],
    [-150, 496, 184],
    [150, 494, 186],
    [MAST.x, MAST.y + 8, MAST.h],
    [440, 400, 186],
    [630, 180, 158],
    [770, 0, 114],
    [806, -108, 62],
  ],
};

/** The report card's flight from the test tower's cap up to the Register's hopper (apex 54 over the line). */
export const CARD = { w: 75, d: 52, apex: 54 } as const;
/** The reply slip (40 × 88) with its enamel stop tab. */
export const SLIP = { w: 40, l: 88 } as const;

// ------------------------------------------------------------------------------------------------
// Grooves engraved in the desk from the ramp's foot to each bay's door (whole hand-overs)

const doorOf = (b: BayLayout): P2 => [(b.door[0] + b.door[1]) / 2, b.box.y1 + 4];
export const GROOVE_START: P2 = [(RAMP.x0 + RAMP.x1) / 2, RAMP.foot];
export const GROOVES: Record<BayId, readonly P2[]> = {
  bug: [GROOVE_START, [184, 14], [150, -6], doorOf(BAYS.bug)],
  tests: [GROOVE_START, [252, 14], [338, 2], doorOf(BAYS.tests)],
  docs: [GROOVE_START, [282, 22], [520, 0], [668, -60], doorOf(BAYS.docs)],
};
export const GROOVE_HALF_W = 13;

// ------------------------------------------------------------------------------------------------
// Light pools (analytic, in the desk and every lit material; at most 8)

export interface Pool {
  c: P2;
  /** receivers between these heights get the pool */
  z: readonly [number, number];
  sigma: P2;
  /** linear RGB, relative to the albedo: 0.6 lifts a surface by 60% at the centre */
  rgb: P3;
}
