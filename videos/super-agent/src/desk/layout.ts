/**
 * The Register Desk's world (TREATMENT.md, Art direction v2): where every object stands, how big it
 * is and how tall, in world units. One unit is one screen pixel at camera zoom 1.0 (camera.ts), x
 * runs east, y north, z up; the desk is the plane z = 0. The origin is the centre of style frame
 * (b) ("Workers report up. Only the Router talks to you.", camera 0.85×), so at that framing a
 * point (x, y) on the desk lands near screen (960 + 0.85 x, 540 − 0.85 y).
 *
 * The planes (synthesis §2, Depth): pressed history −2, the desk 0, paper 1–20, the bays up to 80
 * (always clearly under the deck), the Register's deck 120, flights up to ~190, the Thread cord ~200.
 *
 * The bays stand just south of the deck, so the deck's footprint shadow lands on their floors and
 * wall tops (two levels as real height). The report's whole path is compact in the deck's
 * south-west: the test tower, the mouth under the newest window cell, the print head, the index arm,
 * the chute down to your in-tray.
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
/**
 * Legs: four splayed struts, from under each corner of the rails out and down to a foot, so they
 * read as legs at 15° (a vertical post is seen end-on there) and in plan.
 */
export const LEG_STRUTS: readonly { top: P3; foot: P2 }[] = [
  { top: [DECK.x0 + 12, DECK.y0 + 12, DECK.railZ0], foot: [DECK.x0 - 40, DECK.y0 - 34] },
  { top: [DECK.x1 - 12, DECK.y0 + 12, DECK.railZ0], foot: [DECK.x1 + 40, DECK.y0 - 34] },
  { top: [DECK.x0 + 12, DECK.y1 - 12, DECK.railZ0], foot: [DECK.x0 - 40, DECK.y1 + 34] },
  { top: [DECK.x1 - 12, DECK.y1 - 12, DECK.railZ0], foot: [DECK.x1 + 40, DECK.y1 + 34] },
];
export const LEG_R = 8;
/** Cross members inside the rails (same height as the rails). */
export const CROSS: readonly Rect[] = [
  // north-south, under the reel frame's west member
  { x0: -12, x1: 6, y0: DECK.y0 + DECK.rail, y1: DECK.y1 - DECK.rail },
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

/** The tape from the print head (west) to where it winds onto the reel's south side (east). */
export const TAPE = { x0: -296, x1: REEL.x, y0: 193, y1: 257, z: 122.6 } as const;
/** Where the flat run of the tape ends and it rises onto the reel's pack. */
export const TAPE_FLAT_X1 = TAPE.x1 - 24;
/** The reading window over the tape: the Router's context, five inline cells. */
export const WINDOW = { frame: { x0: -300, x1: 26, y0: 183, y1: 267 } as Rect, z: [122, 133] as const, bar: 8 } as const;
/**
 * The five inline cells, 58 u each along the tape. The print head is at the west end and the tape
 * runs east onto the reel, so the newest cell is the west-most (index 0), right by the print head.
 */
export const CELLS_X: readonly [number, number][] = [0, 1, 2, 3, 4].map((i) => [-292 + 62 * i, -292 + 62 * i + 58] as [number, number]);

/**
 * The Continuous plate (trait 连续), docked at the turn (cues.ts 'trait-continuous', f1640): a
 * narrow enamel apron along the deck's front, its words texture-size now that they have been read.
 */
export const TRAIT_PLATE = { box: { x0: -150, x1: 86, y0: 90, y1: 122 } as Rect, z: [114, 119] as const } as const;
/** The hooded reading lamp: a base on the deck's cross member, a bent arm, a hood over the newest cells (a pool, never bloom). */
export const READ_LAMP = { base: [-30, 300] as P2, hood: { x0: -296, x1: -150, y: 276, z: 178, r: 19 } } as const;

/** The print head at the throat (the sequence point) and its enamel cap. */
export const PRINT_HEAD = { box: { x0: -342, x1: -300, y0: 178, y1: 272 } as Rect, z: [122, 180] as const } as const;
/** The throat: the intake's mouth on the deck's west end. */
export const THROAT = { box: { x0: -394, x1: -342, y0: 193, y1: 257 } as Rect, z: [96, 126] as const } as const;
/** The neck-collar gauge on the throat (its needle low: the queue is short). */
export const GAUGE = { x: -372, y: 172, r: 15, z: 127 } as const;
/** The policy card pinned under the loupe, and the loupe on its swing arm. */
export const POLICY_CARD = { box: { x0: -356, x1: -282, y0: 310, y1: 396 } as Rect, z: 126 } as const;
export const LOUPE = { x: -319, y: 336, z: 160, r: 28, pivot: [-338, 440] as P2 } as const;

/** The index arm on its detent plate: it turns to face whom the Register addresses. */
export const INDEX = { pivot: [-318, 150] as P2, z: 126, length: 140, plateR: 46, plateA: [-176, -4] as const } as const;

/**
 * The mouth where Workers' report cards dock: a funnel off the deck's south rail, right under the
 * newest window cell, so docking, stamping in and the lit cell read as one event.
 */
export const MOUTH = { box: { x0: -260, x1: -176, y0: 62, y1: 126 } as Rect, z: [104, 124] as const, land: [-218, 90, 116] as P3 } as const;
/** The spill drawer, pulled out under the south rail; folded bodies drop in here. */
export const DRAWER = { box: { x0: 120, x1: 220, y0: 92, y1: 150 } as Rect, z: [80, 108] as const } as const;
/** The sealed restricted-shell key in its lock plate on the north-east corner (FACTS: the Router keeps a shell). */
export const LOCK = { box: { x0: 240, x1: 298, y0: 436, y1: 500 } as Rect, z: [122, 156] as const, key: { x0: 298, x1: 330, y: 468, z: 145, bowR: 13 } } as const;
/** The pilot jewel on the south rail: lit, never blooming. */
export const JEWEL = { x: 240, y: 129, z: 122, r: 7 } as const;

/** The fanfold under the deck: older log, folded away (paper, 0.8 u a sheet), seen whole through the open frame. */
export const FANFOLD = { box: { x0: -270, x1: -100, y0: 372, y1: 452 } as Rect, sheets: 36 } as const;
export const SHEET = 0.8;

/** The dispatch ramp: a quarter-pipe off the deck's east rail down to the desk, where the grooves begin. */
export const RAMP = { y0: 170, y1: 250, top: 120, lip: 70, x: DECK.x1, foot: DECK.x1 + 70 } as const;

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
// The Workers: one class of walled bay, each with its own superstructure, all under 80

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
  tests: {
    id: 'tests',
    box: { x0: -320, x1: -100, y0: -170, y1: 92 },
    wallH: 40,
    wall: 10,
    southWall: 26,
    door: [-240, -180],
    slot: { x0: -306, x1: -250, y0: 46, y1: 76 },
    dossier: { x0: -306, x1: -228, y0: -140, y1: -80 },
    sheets: 22,
    rack: { x0: -212, x1: -112, y0: -142, y1: -76 },
  },
  docs: {
    id: 'docs',
    box: { x0: -40, x1: 300, y0: -120, y1: 92 },
    wallH: 30,
    wall: 10,
    southWall: 26,
    door: [200, 260],
    slot: { x0: 236, x1: 288, y0: 44, y1: 76 },
    dossier: { x0: -26, x1: 52, y0: -90, y1: -32 },
    sheets: 26,
    rack: { x0: 180, x1: 288, y0: -92, y1: -30 },
  },
  bug: {
    id: 'bug',
    box: { x0: 470, x1: 690, y0: -190, y1: 90 },
    wallH: 40,
    wall: 10,
    southWall: 26,
    door: [500, 560],
    slot: { x0: 568, x1: 678, y0: 42, y1: 76 },
    dossier: { x0: 484, x1: 566, y0: -160, y1: -110 },
    sheets: 40,
    rack: { x0: 580, x1: 680, y0: -162, y1: -106 },
  },
};
/** The bay floor plate's top. */
export const BAY_FLOOR = 6;

/** The bug bay's bench, its six test pins standing above the walls, and the docked vermilion folder with the request on it. */
export const BENCH = { top: { x0: 494, x1: 666, y0: -98, y1: 22 } as Rect, z: [52, 60] as const, leg: 10 } as const;
export const PINS = { x0: 508, dx: 28, y: 10, h: 24, n: 6 } as const;
export const FOLDER = { box: { x0: 512, x1: 648, y0: -88, y1: -4 } as Rect, z: [60, 67] as const } as const;
/** The request: a vermilion chat slip 1.3× the others (40 × 88), with a beetle cut-out. */
export const REQUEST = { c: [582, -48] as P2, w: 52, l: 114, rot: Math.PI / 2 - 0.06, z: 67.6 } as const;

/** The test tower: a stack light of test lamps on a short post, taller than its walls, a dome on top. */
export const TOWER = { x: -170, y: -40, r: 12, seg: 16, gap: 3, n: 3, base: BAY_FLOOR, post: 10, dome: 8 } as const;
export const towerTop = (): number => TOWER.base + TOWER.post + TOWER.n * TOWER.seg + (TOWER.n - 1) * TOWER.gap;

/** The docs galley: a wide, low tray of type set in lines (ink on enamel). */
export const GALLEY_TRAY = { box: { x0: -24, x1: 220, y0: -24, y1: 74 } as Rect, z: [BAY_FLOOR, 16] as const } as const;

// ------------------------------------------------------------------------------------------------
// You: a small desk with a bent-arm lamp (the film's only Λ), a laptop, the chore tray, the in-tray

export const YOU = {
  slab: { x0: -820, x1: -440, y0: -280, y1: -10 } as Rect,
  top: 28,
  blotter: { x0: -808, x1: -652, y0: -230, y1: -84 } as Rect,
  laptop: { x0: -796, x1: -666, y0: -206, y1: -118 } as Rect,
  lidH: 88,
  /** how far past upright the lid leans back (radians) */
  lidLean: 0.27,
  tray: { x0: -640, x1: -452, y0: -270, y1: -178 } as Rect,
  inTray: { x0: -562, x1: -458, y0: -118, y1: -24 } as Rect,
} as const;

/** The lamp: base, elbow, head; the hood aims at the in-tray, where the reply lands. */
export const LAMP = { base: [-796, -46, YOU.top] as P3, elbow: [-716, -10, 196] as P3, head: [-606, -48, 136] as P3, aim: [-510, -71, YOU.top] as P3, baseR: 26, hoodR: 26, hoodL: 42 } as const;

/** The reply chute: the only path down to you, from the deck's south-west corner to the in-tray. */
export const CHUTE: readonly P3[] = [
  [-350, 112, 110],
  [-402, 92, 101],
  [-452, 54, 88],
  [-488, 4, 72],
  [-506, -40, 58],
  [-510, -66, 50],
];
export const CHUTE_W = 60;
export const CHUTE_POSTS: readonly P2[] = [
  [-426, 76],
  [-484, 12],
];

// ------------------------------------------------------------------------------------------------
// Intake: the feeders (west), the fast gate, the belt up to the throat

export const SPOOL = { x: -786, y: 480, z: [62, 110] as const, r: 30 } as const;
export const FEEDERS = {
  chat: { x0: -1000, x1: -884, y0: 372, y1: 470 } as Rect,
  ci: { x0: -1000, x1: -890, y0: 214, y1: 312 } as Rect,
  mail: { x0: -1004, x1: -880, y0: 70, y1: 150 } as Rect,
  calendar: { x0: -1004, x1: -880, y0: -60, y1: 20 } as Rect,
} as const;
export const FEEDER_H = { chat: 60, ci: 46 } as const;

export const GATE = { bar: { x0: -568, x1: -552, y0: 246, y1: 352 } as Rect, h: 36, fingers: 7, fingerL: 44 } as const;
export const SPIKE = { x: -646, y: 384, h: 84, baseR: 22 } as const;
/** The intake belt from the gate up to the throat. */
export const BELT = { from: [-548, 300, 22] as P3, to: [-394, 210, 104] as P3, w: 62 } as const;

/**
 * The request's Thread cord: one arch from the chat spool, rising north of the reel over the
 * deck's pulley (its touch is the notice: the Router hears of the Thread without deciding), then
 * falling east of the deck to the bug bay. Kept inside the diagram band (screen y ≥ 72) at 15°.
 */
export const MAST = { arm: [DECK.x1, 430] as P2, x: 352, y: 430, h: 192 } as const;
export const CORDS: { readonly vermilion: readonly P3[] } = {
  vermilion: [
    [SPOOL.x + 8, SPOOL.y + 6, 100],
    [-640, 478, 150],
    [-420, 500, 178],
    [-120, 508, 190],
    [150, 506, 194],
    [300, 476, 194],
    [MAST.x, MAST.y, MAST.h],
    [430, 330, 172],
    [520, 220, 132],
    [566, 120, 82],
    [576, 82, 52],
  ],
};

/** The report card (1.3× its old size) flies from the tower's dome up into the mouth (apex 70 over the line). */
export const CARD = { w: 98, d: 68, apex: 70 } as const;
/** The reply slip (40 × 88) with its enamel stop tab. */
export const SLIP = { w: 40, l: 88 } as const;

// ------------------------------------------------------------------------------------------------
// Grooves engraved in the desk from the ramp's foot to each bay's door (whole hand-overs)

const doorOf = (b: BayLayout): P2 => [(b.door[0] + b.door[1]) / 2, b.box.y1 + 4];
export const GROOVE_START: P2 = [RAMP.foot + 4, (RAMP.y0 + RAMP.y1) / 2];
export const GROOVES: Record<BayId, readonly P2[]> = {
  bug: [GROOVE_START, [420, 184], [492, 140], doorOf(BAYS.bug)],
  docs: [GROOVE_START, [316, 176], [256, 136], doorOf(BAYS.docs)],
  tests: [GROOVE_START, [318, 150], [200, 108], [-40, 106], [-170, 104], doorOf(BAYS.tests)],
};
export const GROOVE_HALF_W = 11;

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
