/**
 * The Register Desk's world (TREATMENT.md, Art direction v2): where every object stands, how big it
 * is and how tall, in world units. One unit is one screen pixel at camera zoom 1.0 (camera.ts), x
 * runs east, y north, z up; the desk is the plane z = 0. The origin is the centre of style frame
 * (b) ("Workers report up. Only the Router answers you.", camera 0.85×), so at that framing a
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
/**
 * Penumbra width of a shadow cast from height h above its receiver: 4 + k·h. The synthesis gives
 * k = 0.35; at 0.22 the deck's shadow keeps a readable cast edge on the bays (critic round 2).
 */
export const PENUMBRA_K = 0.22;
export const penumbra = (h: number): number => 4 + PENUMBRA_K * h;
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
 * runs east onto the reel, so the newest cell is the west-most (index 0), right by the print head;
 * it is wider, to carry its report's ID at ≥ 24 px.
 */
export const CELLS_X: readonly [number, number][] = [
  [-292, -194],
  [-190, -141],
  [-137, -88],
  [-84, -35],
  [-31, 18],
];

/**
 * The Continuous plate (trait 连续), turned face up at the turn (cues.ts 'trait-continuous', f1640): an
 * enamel plate carrying its words, Continuous · 连续, at about 36 px at 0.85× (gl/plate.ts), on two
 * brackets off the deck's north rail behind the reel it names: clear of the lock, inside the diagram
 * band at 0.85×, and outside the close shot of (c) (it would sit on the cache tag there).
 */
export const TRAIT_PLATE = { box: { x0: -232, x1: 152, y0: 490, y1: 554 } as Rect, z: [122, 126] as const, brackets: [-150, 72] as const } as const;
/** The hooded reading lamp: a base on the deck's cross member, a bent arm, a hood over the newest cells (a pool, never bloom). */
export const READ_LAMP = { base: [-30, 300] as P2, hood: { x0: -296, x1: -150, y: 276, z: 178, r: 19 } } as const;

/** The print head at the throat (the sequence point) and its enamel cap. */
export const PRINT_HEAD = { box: { x0: -342, x1: -300, y0: 178, y1: 272 } as Rect, z: [122, 180] as const } as const;
/** The throat: the intake's mouth on the deck's west end. */
export const THROAT = { box: { x0: -394, x1: -342, y0: 193, y1: 257 } as Rect, z: [96, 126] as const } as const;
/** The policy card pinned under the loupe, and the loupe on its swing arm. */
export const POLICY_CARD = { box: { x0: -356, x1: -282, y0: 310, y1: 396 } as Rect, z: 126 } as const;
export const LOUPE = { x: -319, y: 320, z: 156, r: 21, pivot: [-352, 320] as P2 } as const;

/** The index arm on its detent plate: it turns to face whom the Register addresses. */
export const INDEX = { pivot: [-318, 150] as P2, z: 126, length: 74, plateR: 46, plateA: [-176, -4] as const } as const;

/**
 * The mouth where Workers' report cards dock: a funnel off the deck's south rail, right under the
 * newest window cell, so docking, stamping in and the lit cell read as one event.
 */
export const MOUTH = { box: { x0: -260, x1: -176, y0: 62, y1: 126 } as Rect, z: [104, 124] as const, land: [-218, 90, 116] as P3 } as const;
/** The spill drawer, pulled out under the south rail beside the mouth: a report's folded body drops in here (Inline & Spill). */
export const DRAWER = { box: { x0: -168, x1: -74, y0: 92, y1: 150 } as Rect, z: [80, 108] as const } as const;
/** The sealed restricted-shell key in its lock plate on the north-east corner (FACTS: the Router keeps a shell). */
export const LOCK = { box: { x0: 240, x1: 298, y0: 436, y1: 500 } as Rect, z: [122, 156] as const, key: { x0: 298, x1: 330, y: 468, z: 145, bowR: 13 } } as const;
/** The pilot jewel on the south rail: lit, never blooming. */
export const JEWEL = { x: 240, y: 129, z: 122, r: 7 } as const;

/** The fanfold under the deck: older log, folded away (paper, 0.8 u a sheet), seen whole through the open frame. */
export const FANFOLD = { box: { x0: -270, x1: -100, y0: 372, y1: 452 } as Rect, sheets: 36 } as const;
export const SHEET = 0.8;

/** The dispatch ramp: a quarter-pipe off the deck's east rail down to the desk, where the grooves begin. */
export const RAMP = { y0: 170, y1: 250, top: 120, lip: 70, x: DECK.x1, foot: DECK.x1 + 70 } as const;

// ------------------------------------------------------------------------------------------------
// The Workers: one class of walled bay, each with its own superstructure, all under 80

export type BayId = 'bug' | 'tests' | 'docs';
/** Every Worker: the three bays of C11 and the fresh bay MT1 dispatches to (`FRESH`). */
export type WorkerId = BayId | 'fresh';

export interface BayLayout {
  id: WorkerId;
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
    box: { x0: -330, x1: -120, y0: -130, y1: 139 },
    wallH: 40,
    wall: 10,
    southWall: 34,
    door: [-262, -204],
    slot: { x0: -318, x1: -262, y0: 92, y1: 124 },
    dossier: { x0: -318, x1: -228, y0: -94, y1: -34 },
    sheets: 22,
    rack: { x0: -220, x1: -132, y0: -94, y1: -18 },
  },
  docs: {
    id: 'docs',
    box: { x0: -80, x1: 210, y0: -84, y1: 139 },
    wallH: 30,
    wall: 10,
    southWall: 34,
    door: [122, 178],
    slot: { x0: 140, x1: 198, y0: 94, y1: 126 },
    dossier: { x0: -70, x1: 20, y0: -44, y1: 14 },
    sheets: 26,
    rack: { x0: 104, x1: 198, y0: -44, y1: 30 },
  },
  bug: {
    id: 'bug',
    box: { x0: 250, x1: 470, y0: -200, y1: 90 },
    wallH: 40,
    wall: 10,
    southWall: 34,
    door: [270, 326],
    slot: { x0: 344, x1: 460, y0: 42, y1: 78 },
    dossier: { x0: 262, x1: 352, y0: -168, y1: -108 },
    sheets: 40,
    rack: { x0: 366, x1: 458, y0: -168, y1: -86 },
  },
};
/** The bay floor plate's top. */
export const BAY_FLOOR = 6;

/** The bug bay's bench, its six test pins standing above the walls, and the docked vermilion folder with the request on it. */
export const BENCH = { top: { x0: 270, x1: 450, y0: -80, y1: 32 } as Rect, z: [50, 58] as const, leg: 10 } as const;
export const PINS = { x0: 284, dx: 30, y: 22, h: 26, n: 6 } as const;
export const FOLDER = { box: { x0: 292, x1: 428, y0: -72, y1: 6 } as Rect, z: [58, 65] as const } as const;
/** The request: a vermilion chat slip 1.3× the others (40 × 88), with a beetle cut-out. */
export const REQUEST = { c: [360, -33] as P2, w: 52, l: 114, rot: Math.PI / 2 - 0.06, z: 65.6 } as const;

/** The test tower: a capped stack of three test lamps, taller than its walls, concentric lenses on top. */
export const TOWER = { x: -188, y: 62, r: 52, seg: 20, gap: 3, n: 3, base: BAY_FLOOR, post: 4, dome: 4 } as const;
export const towerTop = (): number => TOWER.base + TOWER.post + TOWER.n * TOWER.seg + (TOWER.n - 1) * TOWER.gap;

/** The docs galley: a wide, low tray of type set in lines (ink on enamel). */
export const GALLEY_TRAY = { box: { x0: -64, x1: 124, y0: 20, y1: 116 } as Rect, z: [BAY_FLOOR, 16] as const } as const;

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
  tray: { x0: -650, x1: -462, y0: -272, y1: -176 } as Rect,
  inTray: { x0: -590, x1: -450, y0: -136, y1: -20 } as Rect,
} as const;

/** The lamp: base, elbow, head; the hood aims at the in-tray, where the reply lands. */
export const LAMP = { base: [-796, -46, YOU.top] as P3, elbow: [-716, -10, 196] as P3, head: [-606, -48, 136] as P3, aim: [-520, -60, YOU.top] as P3, baseR: 26, hoodR: 26, hoodL: 42 } as const;

/** The reply chute: the only path down to you, from the deck's south-west corner to the in-tray. */
export const CHUTE: readonly P3[] = [
  [-350, 112, 110],
  [-402, 92, 101],
  [-452, 54, 88],
  [-488, 4, 72],
  [-514, -6, 60],
  [-518, -18, 56],
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
/** Each gate finger's y (south to north) and its root on the bar's west face, the N-S axis it flips about (beat5.ts). */
export const FINGER_Y: readonly number[] = Array.from({ length: GATE.fingers }, (_, i) => GATE.bar.y0 + 10 + ((GATE.bar.y1 - GATE.bar.y0 - 20) * i) / (GATE.fingers - 1));
export const FINGER_ROOT = { x: GATE.bar.x0 + 2, z: GATE.h - 10 } as const;
/**
 * Beat 5 (STORYBOARD 5.1-5.2; desk/beat5.ts). The starter key docks lying flat just north-east of the gate's bar, where the
 * summary (summary.ts DOCKED.key, still (d)) keeps it; the Proactive plate (trait 主动), slid out of your desk with its
 * chore, lies flat on the slate on the intake, right under the gate's fingers and the belt's foot (its north-east corner
 * clear of the raised belt's south rail; its east edge clear west of the chute's west post's foot, which it slides past
 * on its way out of your desk), its words at about 36 px at 0.85x (gl/plate.ts; still (d)'s pictogram plate beside the
 * key is too small for them); the spike stands up out of a slate hatch at SPIKE.
 */
export const KEY_DOCK: P3 = [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2];
export const PROACTIVE_PLATE = { box: { x0: -818, x1: -500, y0: 160, y1: 224 } as Rect, z: [0, 4] as const } as const;
/** The intake belt from the gate up to the throat. */
export const BELT = { from: [-548, 300, 22] as P3, to: [-394, 210, 104] as P3, w: 62 } as const;

/**
 * The request's Thread cord: one arch from the chat spool, rising north of the reel and of the Continuous
 * plate on its brackets (68 u over its north edge, so seen from the camera it passes clear of the plate) over the
 * deck's pulley (its touch is the notice: the Router hears of the Thread without deciding), then
 * falling east of the deck to the bug bay. Kept inside the diagram band (screen y ≥ 72) at 15°.
 */
export const MAST = { arm: [DECK.x1, 430] as P2, x: 352, y: 430, h: 192 } as const;
export const CORDS: { readonly vermilion: readonly P3[] } = {
  vermilion: [
    [SPOOL.x + 8, SPOOL.y + 6, 100],
    [-640, 498, 150],
    [-430, 540, 178],
    [-250, 547, 188],
    [-50, 548, 192],
    [160, 548, 194],
    [295, 502, 194],
    [MAST.x, MAST.y, MAST.h],
    [430, 330, 172],
    [450, 220, 132],
    [446, 130, 84],
    [438, 82, 52],
  ],
};

/** The report card (a punched card: its width fits the spill drawer once folded) flies from the slot in the tower's cap up into the mouth (apex 70 over the line). */
export const CARD = { w: 88, d: 68, apex: 70 } as const;
/** The reply slip (44 × 100: its report's ID at ≥ 24 px) with its enamel stop tab. */
export const SLIP = { w: 44, l: 100 } as const;

// ------------------------------------------------------------------------------------------------
// Grooves engraved in the desk from the ramp's foot to each bay's door (whole hand-overs)

const doorOf = (b: BayLayout): P2 => [(b.door[0] + b.door[1]) / 2, b.box.y1 + 4];
export const GROOVE_START: P2 = [RAMP.foot + 4, (RAMP.y0 + RAMP.y1) / 2];
export const GROOVES: Record<BayId, readonly P2[]> = {
  bug: [GROOVE_START, [346, 160], [312, 116], doorOf(BAYS.bug)],
  docs: [GROOVE_START, [300, 172], [220, 156], doorOf(BAYS.docs)],
  tests: [GROOVE_START, [300, 176], [100, 160], [-100, 152], doorOf(BAYS.tests)],
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

// ------------------------------------------------------------------------------------------------
// MT1, the next dispatch (film f2226-2340, TREATMENT Lookdev MT1, STORYBOARD 4.6): the next chat
// slip is judged at the throat and dispatched down a fresh groove to a fresh bay that rises from its
// floor hatch east of the bug bay (one Worker per task, so never the busy docs galley)

/** The next chat slip (the spout's size): out of the spout, posted over the gate onto the belt, up into the throat and the head. */
export const NEXT_SLIP = {
  l: 96,
  w: 40,
  /** inside the spout's mouth, where it starts */
  spout: [-890, 417, 26] as P3,
  /** just past the gate's fingers, on the belt's foot (the post lands here) */
  gate: [-540, 297, 30] as P3,
  /** on the throat's floor, between its cheeks, its east end at the head */
  throat: [-392, 225, 118.8] as P3,
  /** fed into the print head (hidden in the deck plate under it) */
  head: [-322, 225, 118.8] as P3,
  apex: 72,
} as const;
/** The punch in the throat's north cheek that notches an accepted slip (the Slow Path's mark): it rises out of the cheek, drops on the slip's edge, sinks back. */
export const PUNCH = { x: -378, y: 247, r: 4.5, h: 14, hidden: 114, out: 22, drop: 15 } as const;

/** The fresh bay: one family with the others (the shared base), its own task's superstructure (a rotary card file). */
export const FRESH: BayLayout = {
  id: 'fresh',
  box: { x0: 522, x1: 700, y0: -150, y1: 96 },
  wallH: 40,
  wall: 10,
  southWall: 34,
  door: [528, 600],
  slot: { x0: 618, x1: 690, y0: 52, y1: 82 },
  dossier: { x0: 536, x1: 610, y0: -110, y1: -64 },
  sheets: 8,
  rack: { x0: 616, x1: 690, y0: -110, y1: -46 },
};
/** How deep the fresh bay waits in its hatch's pit (deeper than its card file stands, so nothing of it shows before it rises), and how deep a finished bay sinks (TREATMENT element sheet: done sinks 40 u). */
export const HATCH_DEPTH = 94;
export const SINK = 40;
/** The fresh bay's rotary card file: a drum of cards between two enamel cheeks, its axle along x. */
export const CARD_FILE = { x0: 552, x1: 668, y: -30, z: 44, r: 32, core: 11, cards: 28, cheekR: 38, cheek: 6 } as const;
/** The dispatch folder (the task handed over whole, a tabbed paper folder at about 72 px) and where it docks inside the fresh bay, past its door. */
export const DISPATCH = { w: 86, d: 58, dock: [564, 42, 7.6] as P3 } as const;
/**
 * The dispatch housing under the deck's east end, behind the ramp's face: the folder waits in it and is
 * pushed out through the slit in the ramp's face onto the quarter pipe. Its top is just under the rails. It is long
 * enough to hold the request whole (114 u) before it is pushed out (beat 4's bug dispatch), so nothing of it shows early.
 */
export const DISPATCH_HOUSING = { box: { x0: 160, x1: RAMP.x, y0: 174, y1: 246 } as Rect, z: [62, 119] as const, slit: { y0: 178, y1: 242, z0: 69, z1: 79 } } as const;
/** Where the folder waits (in the housing, its leading edge at the slit), and the slit it is pushed out through. */
export const FOLDER_SLOT: P3 = [RAMP.x - DISPATCH.w / 2 - 1, (RAMP.y0 + RAMP.y1) / 2, 73];
export const FOLDER_OUT: readonly P3[] = [[RAMP.x + 1, (RAMP.y0 + RAMP.y1) / 2, 72.5]];
/** The fresh groove: from the ramp's foot round the bug bay's north to the fresh bay's door. */
export const GROOVE_FRESH: readonly P2[] = [[RAMP.foot + 4, (RAMP.y0 + RAMP.y1) / 2], [430, 194], [520, 166], [(FRESH.door[0] + FRESH.door[1]) / 2, FRESH.box.y1 + 4]];

// ------------------------------------------------------------------------------------------------
// Still (c), context as a cache (film f3150, STORYBOARD 6.3): the request's report at the window

/**
 * The report card of the request's bay (one family with the test card), and where it leaves the bay.
 * Its header strip (the top half) carries the record's header and its three summary lines; the body
 * (the bottom half) is the rest, which folds along its middle into an 80 x 18 u pointer tab.
 */
export const CARD_C = { w: 80, d: 72, header: 0.5, from: [404, 66, 40] as P3, apex: 60 } as const;
/** The folded pointer tab: the card's width, a quarter of its depth (the body folded once along its middle). */
export const TAB_C = { w: CARD_C.w, d: (CARD_C.d * (1 - CARD_C.header)) / 2 } as const;
/**
 * The older pointer tabs filed in the spill drawer (front to back): folded tabs of the same family,
 * each standing on its crease and leaning back on the one behind at its own angle, each with the
 * mark of what it points to (no numbers). y: the crease line; lean: radians from the drawer floor;
 * turn: about z; dx: off the drawer's centre line; mark at the tab's west or east end.
 */
export const FILED_TABS: readonly { kind: 'ci' | 'chat' | 'test' | 'docs'; y: number; lean: number; turn: number; dx: number; w: number; end: 'w' | 'e' }[] = [
  { kind: 'test', y: 109, lean: 0.95, turn: 0.035, dx: -2, w: 78, end: 'e' },
  { kind: 'chat', y: 116, lean: 1.04, turn: -0.05, dx: 3, w: 76, end: 'w' },
  { kind: 'docs', y: 123, lean: 0.9, turn: 0.07, dx: -3, w: 79, end: 'e' },
  { kind: 'ci', y: 130, lean: 1.0, turn: -0.025, dx: 2, w: 77, end: 'w' },
];
/** Still (c): how far the spill drawer pulls open to take the request's tab (the test bay has sunk by then, so it clears the tower). */
export const DRAWER_OPEN_C = 22;
/**
 * The window in the close shot: the request's inline record (its header and a three-line summary)
 * fills the newest cell, widened as the older cards shrink to 18 u stubs and pack east; a fifth
 * stub leaves the window onto the tape run.
 */
export const CACHE_WINDOW = {
  record: [-292, -72] as const,
  stub: 18,
  bar: 3,
  /** the stubs' west edges after the shrink, newest first */
  stubX0: [-69, -48, -27, -6, 30] as const,
  /** the window bars' west edges after the shrink: each rides its stub's east edge */
  barX0: [-50.5, -29.5, -8.5, 12.5] as const,
} as const;
