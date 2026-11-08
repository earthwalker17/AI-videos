/**
 * The world of the film: one route map of 3840 x 2160 world units (TREATMENT.md, World layout),
 * as numbers. Everything the picture draws stands somewhere in here, and nothing drawn moves
 * after the turn except tokens on their lines. Pure data and geometry (tested in world.test.ts):
 * components take positions from here, never invent their own.
 *
 * West to east:
 * - x 0-640, the channels: the chat spring (a pile of message pills, CI squares and envelopes)
 *   feeding the trunk from below, and your ring after the turn, south-east of the spring;
 * - x 580-1260, the act-one hub: eight session tiles round your ring, placed by hand (no grid: the
 *   world is improvised), which an interchange ring (the future Router) closes round at bar 10;
 * - x 860-1300, on the trunk: the railway points (the Fast Path) with a 45 degree siding up into
 *   a terminus, and the gate with its lamp (the Slow Path);
 * - x 1920, y 720: the Router. The flyover leaves the trunk at x 1392 and crosses over it on a
 *   bridge (a flying junction) to pass north of the Router;
 * - x 2112-2332: three Worker platforms in a column below the Router, on one stem that leaves the
 *   Router going straight down: "above" and "below" literally, so status dots climb;
 * - x 2736: the proposed machines, on short dashed tethers from the platforms (close to the
 *   Workers they would host: long tethers outweighed the stepped-down Workers and pushed the map
 *   past the 0.6x frame of beat 7), and the sketch "?" just east of them.
 * The timetable panel is the south band, y 1480-2040; the summary map at the rest frames the
 * route without it.
 *
 * Positions sit on the 48-unit base grid (tokens.ts BASE_GRID) where they can; the dot grid's
 * pitch is 96. Lines run at 0, 45 and 90 degrees.
 *
 * Still 2 must show your ring at its west edge and the Worker platforms at 0.85x: the frame is
 * 2259 world units wide there, so the platforms stand at x 2112-2332 rather than further east
 * (the treatment's "Workers 2500-3200" was a range, not a measured layout).
 */
import type { Camera, Pt } from '../kit/camera.tsx';
import { BAR, BEAT, at } from '../cues.ts';
import { STROKE, WORLD } from '../look/tokens.ts';

export { WORLD };

/** The base grid of positions, world units. */
export const GRID = 48;
/** Route corners, world units: 24 px on screen at 0.85x, the map's main framing. */
export const CORNER = 28;

// ---------------------------------------------------------------------------------------------
// Sizes (world units)

/** A message pill, the request, a reply (TREATMENT.md: 64 x 28). */
export const PILL = { w: 64, h: 28 } as const;
/** A CI square and an envelope among the pills. */
export const CI = { size: 28, r: 5 } as const;
export const ENVELOPE = { w: 40, h: 28, r: 4 } as const;
/** An act-one session tile's corner radius (each tile has its own size: TILES). */
export const TILE = { r: 18 } as const;
/** A Worker platform: 220 x 88 with a tool row and a step marker. */
export const PLATFORM = { w: 220, h: 88, r: 12, steps: 6 } as const;
/** Your ring: 40 across (STROKE.youRadius) and its laptop glyph. */
export const YOU_R = STROKE.youRadius;
/**
 * The Router's ring (160 across) and its memory track: a tally of ticks outside the ring, in groups
 * of `group` a `pitch` (turns) apart with `gap` pitches between groups, so that it reads as a count
 * rather than a dial, a gear or a burst of rays.
 */
export const ROUTER_R = STROKE.routerRadius;
export const MEMORY = { inner: 100, outer: 112, pitch: 1 / 60, group: 4, gap: 2.4 } as const;
/** A proposed machine: a dashed square with a daemon dot. */
export const MACHINE = { size: 96, r: 12, dot: 8 } as const;
/** Two routes drawn side by side on one line are this far apart (centre to centre). */
export const PARALLEL = 22;

// ---------------------------------------------------------------------------------------------
// Act one: the hub and the chat spring

/** The centre of the act-one hub: your ring until the turn, and the interchange ring's centre. */
export const HUB: Pt = [912, 768];

/** An act-one session tile: its centre and size. */
export interface Tile {
  at: Pt;
  w: number;
  h: number;
}

/**
 * The eight session tiles round the hub, placed by hand: about where a ring of eight would put
 * them, each pushed off it by 20-60 units and sized 0.9-1.13 of 120 x 96, so the hub reads
 * improvised, not gridded. Order: top-left, top, top-right, left, right, bottom-left, bottom,
 * bottom-right.
 */
export const TILES: readonly Tile[] = [
  { at: [676, 580], w: 132, h: 100 },
  { at: [946, 556], w: 112, h: 90 },
  { at: [1172, 602], w: 136, h: 102 },
  { at: [650, 808], w: 118, h: 94 },
  { at: [1198, 820], w: 114, h: 104 },
  { at: [724, 998], w: 130, h: 90 },
  { at: [984, 1012], w: 118, h: 94 },
  { at: [1186, 996], w: 108, h: 88 },
];

/** A tile's box. */
export const tileBox = (t: Tile) => ({ x: t.at[0] - t.w / 2, y: t.at[1] - t.h / 2, w: t.w, h: t.h });

/** The chat spring: a pile of message pills rising from `bottom` towards the trunk's west end. */
export const SPRING = { x: 420, top: 528, bottom: 1032, pitch: 36 } as const;

/** One event in the spring's pile. */
export interface SpringItem {
  id: string;
  kind: 'pill' | 'ci' | 'mail' | 'request';
  x: number;
  y: number;
}

/** How far the spring's stream sways either side of its axis, and how fast, per row (world units, radians). */
const SPRING_SWAY = { amp: 28, perRow: 0.62 } as const;
/** Rows in the spring's pile. */
const SPRING_ROWS = Math.round((SPRING.bottom - SPRING.top) / SPRING.pitch) + 1;
/** The sway's phase: the top row stands on the axis, under the trunk's feeder. */
const SPRING_PHASE = 3 * Math.PI - (SPRING_ROWS - 1) * SPRING_SWAY.perRow;
/** Which rows (from the bottom) hold a CI square or an envelope; the request lies in the second row from the top. */
const SPRING_KINDS: Readonly<Record<number, SpringItem['kind']>> = { 2: 'ci', 5: 'mail', 9: 'ci', 11: 'mail' };

/**
 * The chat spring's pile at the hook's end (f150 on), bottom row first: one event per row on the
 * pitch, rising from `bottom`; the oldest at the top. The request lies in the second row from the
 * top and a newer pill lies over its right half ("half buried", TREATMENT.md beat 1). The stream
 * sways in one smooth meander as it rises (on whole units), not by chance.
 */
export function springPile(): SpringItem[] {
  const items: SpringItem[] = [];
  for (let r = 0; r < SPRING_ROWS; r++) {
    const y = SPRING.bottom - r * SPRING.pitch;
    const x = SPRING.x + Math.round(SPRING_SWAY.amp * Math.sin(r * SPRING_SWAY.perRow + SPRING_PHASE));
    const kind = r === SPRING_ROWS - 2 ? 'request' : (SPRING_KINDS[r] ?? 'pill');
    items.push({ id: kind === 'request' ? 'request' : `spring-${r}`, kind, x, y });
  }
  const req = items.find((it) => it.kind === 'request')!;
  // the newer pill that half buries the request, drawn after (over) it
  items.push({ id: 'spring-over', kind: 'pill', x: req.x + PILL.w / 2 + 4, y: req.y + 10 });
  return items;
}

/** Where the request lay in the spring: its route on the summary map starts here. */
export const REQUEST_HOME: Pt = (() => {
  const r = springPile().find((it) => it.kind === 'request')!;
  return [r.x, r.y];
})();

// ---------------------------------------------------------------------------------------------
// The map after the turn

export const ROUTER: Pt = [1920, 720];
/** Your ring after the turn: at the west edge among the channels, south-east of the spring. It never moves again. */
export const YOU: Pt = [576, 1152];

/** The trunk's level. */
export const TRUNK_Y = 432;
/** Where the trunk rises out of the spring: just above its top pill. */
export const FEEDER_FOOT: Pt = [SPRING.x, SPRING.top - PILL.h / 2 - 12];
/** The trunk: up out of the spring, east, then 45 degrees down into the Router. */
export const TRUNK: readonly Pt[] = [FEEDER_FOOT, [SPRING.x, TRUNK_Y], [ROUTER[0] - (ROUTER[1] - TRUNK_Y), TRUNK_Y], ROUTER];
/** The railway points on the trunk, and their siding: 45 degrees up into a terminus, clear of the old hub. */
export const POINTS: Pt = [960, TRUNK_Y];
export const SIDING: readonly Pt[] = [[864, TRUNK_Y], POINTS, [1056, TRUNK_Y - 96], [1152, TRUNK_Y - 96]];
/** The gate on the trunk (the Slow Path): a bar across the line, its lamp beside the bar (south-east of it, never above). */
export const GATE: Pt = [1248, TRUNK_Y];
export const GATE_SIZE = { bar: 84, lamp: 13, lampAt: [32, 30] as Pt } as const;

/** The Workers' doors, top to bottom: a column below and east of the Router. */
export const WORKER_DOORS: readonly Pt[] = [
  [2112, 912],
  [2112, 1056],
  [2112, 1200],
];
/** The platform box of a Worker, from its door. */
export const platformBox = (door: Pt) => ({ x: door[0], y: door[1] - PLATFORM.h / 2, w: PLATFORM.w, h: PLATFORM.h });
/** The branches, from the Router's centre (its ring covers the start): down the one stem, then east at each Worker's level. */
export const BRANCHES: readonly (readonly Pt[])[] = WORKER_DOORS.map((door) => [ROUTER, [ROUTER[0], door[1]] as Pt, door]);
/** The reply line: from the Router 45 degrees down to your level, then west to your ring. */
export const REPLY: readonly Pt[] = [ROUTER, [ROUTER[0] - (YOU[1] - ROUTER[1]), YOU[1]], YOU];
/** Your path after the sign-off: one short stroke west of your ring, where stamped replies rest. */
export const STAMP_STUB: readonly Pt[] = [YOU, [360, YOU[1]]];
/** Where the stamped replies rest on it, west of your ring. */
export const STAMPED: readonly Pt[] = [
  [496, YOU[1]],
  [416, YOU[1]],
];

/**
 * The flyover (Thread pass-through): it leaves the trunk past the gate, drops 45 degrees, runs
 * east and crosses over the trunk's last run on a bridge (a flying junction), passes north of the
 * Router and drops straight into the first Worker's platform from above.
 */
export const FLYOVER_Y = 552;
export const FLYOVER: readonly Pt[] = [
  [1392, TRUNK_Y],
  [1392 + (FLYOVER_Y - TRUNK_Y), FLYOVER_Y],
  [2272, FLYOVER_Y],
  [2272, WORKER_DOORS[0][1] - PLATFORM.h / 2],
];
/** Where the flyover crosses the trunk (on the trunk's 45 degree run into the Router), and its bridge either side. */
export const CROSSING: Pt = [TRUNK[2][0] + (FLYOVER_Y - TRUNK_Y), FLYOVER_Y];
export const BRIDGE: readonly Pt[] = [
  [CROSSING[0] - 40, FLYOVER_Y],
  [CROSSING[0] + 40, FLYOVER_Y],
];

// --- proposed (dashed): the machines, their tethers, the state depot; the open "?"
/** The machines: one per Worker, at its level, a short tether east of its platform. */
export const MACHINES: readonly Pt[] = WORKER_DOORS.map(([, y]) => [2736, y] as Pt);
/** Proposed tethers start clear of a platform's east end (and of the cap a done platform gets). */
export const TETHER_GAP = 32;
export const TETHERS: readonly (readonly Pt[])[] = WORKER_DOORS.map((door, i) => [
  [door[0] + PLATFORM.w + TETHER_GAP, door[1]],
  [MACHINES[i][0] - MACHINE.size / 2, MACHINES[i][1]],
]);
/**
 * The state depot: three equal stacked rules east of the Router (a store, not a falling bar
 * chart), on a short dashed tether from its 3 o'clock. The stack stands half a pitch below the
 * tether's level, so the tether points into the gap under its top rule: level with a rule, the
 * two dashed lines would read as one. Each rule holds 3 whole proposed dashes at the map's far
 * framings, beat 7 and the rest at 0.6x (14 on, 10 off: 62 px).
 */
export const DEPOT = { x: 2088, y: ROUTER[1] - 14, w: [104, 104, 104], pitch: 28, rules: 3 } as const;
export const DEPOT_TETHER: readonly Pt[] = [
  [ROUTER[0] + MEMORY.outer + 8, ROUTER[1]],
  [DEPOT.x - 16, ROUTER[1]],
];
/**
 * The sketch "?" left by the intrusion, beside the machines it put at risk: just east of their
 * column, level with the middle one (the glyph's hook reaches 30 units west of this point and 64
 * up, its dot about 60 down).
 */
export const QUESTION: Pt = [MACHINES[1][0] + MACHINE.size / 2 + 96, MACHINES[1][1]];

/** The timetable panel: the south band, ending inside title-safe at 0.5x (tall enough for its 40 px lane names at the chart's zoom). */
export const PANEL = { x: 480, y: 1480, w: 2880, h: 560, r: 24 } as const;

// --- the request's route, as Still 3 traces it: out in vermilion along the lines themselves,
// from where it lay in the spring up the feeder, along the trunk, down the stem and the first
// branch; back in cased green beside the first branch, then along the reply line itself
export const REQUEST_OUT: readonly Pt[] = [[SPRING.x, REQUEST_HOME[1]], ...TRUNK.slice(1), ...BRANCHES[0].slice(1)];
export const REQUEST_BACK_BRANCH: readonly Pt[] = [...BRANCHES[0]].reverse();

// ---------------------------------------------------------------------------------------------
// The Router's memory track

/**
 * Where lines meet the Router (turns: 0 = 12 o'clock, clockwise) and how far either side the
 * memory track leaves clear, so no tick touches a line or a route beside it (or the label).
 */
export const ROUTER_PORTS: readonly { at: number; clear: number }[] = [
  { at: 7 / 8, clear: 1 / 30 }, // the trunk (the request's route runs on it)
  { at: 1 / 2, clear: 1 / 18 }, // the stem, the green return beside it
  { at: 5 / 8, clear: 1 / 30 }, // the reply line, cased
  { at: 1 / 4, clear: 1 / 30 }, // the depot's tether
  { at: 3 / 4 + 1 / 24, clear: 1 / 16 }, // not a line: the Router's label, west of the ring and a little above it, which no tick crowds
];

/** One slot of the memory track: where its tick stands and the way it points (turns, 0 = 12 o'clock, clockwise). */
export interface MemorySlot {
  /** where the tick stands round the ring */
  at: number;
  /** its direction: the middle of its group, so that a group's ticks stand parallel (a tally, not rays) */
  dir: number;
}

/** Where a stretch of the track (turns, a..b) is first clear of the port it comes within, or null if it is clear of all. */
function pastPort(a: number, b: number): number | null {
  let past: number | null = null;
  for (const p of ROUTER_PORTS) {
    // the port's clear arc, unwrapped next to a..b
    const c = p.at + Math.round((a + b) / 2 - p.at);
    if (b > c - p.clear && a < c + p.clear) past = Math.max(past ?? -Infinity, c + p.clear);
  }
  return past;
}

/**
 * The memory track's tick slots, in the order they fill: a tally clockwise from 12 o'clock, in
 * whole groups of MEMORY.group ticks a pitch apart, MEMORY.gap pitches between groups. A group
 * never straddles a port: where one would, it starts past the port instead. The last group leaves
 * a whole gap before the first. Pure.
 */
export function memorySlots(): MemorySlot[] {
  const { pitch, group, gap } = MEMORY;
  const span = (group - 1) * pitch;
  const out: MemorySlot[] = [];
  let t = 0;
  while (t + span + gap * pitch <= 1 + 1e-9) {
    const past = pastPort(t, t + span);
    if (past !== null) {
      // the group starts just past the port in its way
      t = past;
      continue;
    }
    for (let k = 0; k < group; k++) out.push({ at: t + k * pitch, dir: t + span / 2 });
    t += span + gap * pitch;
  }
  return out;
}

/** The turn: the Router is born at the bar-17 downbeat. */
export const TURN = at(17);
/**
 * How many ticks the memory track holds at film frame `f`: one every two bars from the turn (the
 * events the Router keeps), never cleared, at most every slot. A stand-in until the build ties it
 * to the event schedule; at this rate the tally runs about two thirds round the ring by the rest,
 * never a full ring of teeth.
 */
export function memoryTicks(f: number): number {
  if (f < TURN) return 0;
  return Math.min(memorySlots().length, Math.floor((f - TURN) / (2 * BAR)) + 1);
}

/** A Worker's task: it takes it at `start` and is done at `end` (film frames). */
export interface WorkerTask {
  start: number;
  end: number;
}

/**
 * Each Worker's tasks, one after another. The first Worker's one task is the request's: it enters
 * its fresh platform as C11 begins and is done at bar 50 (STORYBOARD.md 4.4, 8.1). The other two
 * were busy from the turn and take new tasks as they finish (stand-ins until the build schedules
 * them from the event schedule).
 */
export const WORKER_TASKS: readonly (readonly WorkerTask[])[] = [
  [{ start: at(21, 4), end: at(50) }],
  [
    { start: at(17, 2), end: at(31) },
    { start: at(32), end: at(46) },
    { start: at(47), end: at(61) },
  ],
  [
    { start: at(18), end: at(26) },
    { start: at(27), end: at(40) },
    { start: at(41), end: at(56) },
  ],
];

/** The task a Worker is on (or finished last) at film frame `f`, or null before its first. */
export function taskAt(f: number, tasks: readonly WorkerTask[]): WorkerTask | null {
  let current: WorkerTask | null = null;
  for (const t of tasks) if (f >= t.start) current = t;
  return current;
}

/**
 * The stop of a Worker's step marker at film frame `f`: the task's progress over `steps` stops,
 * moving only on a beat (it advances on the grid, never between beats), at the last stop once done.
 */
export function workerStep(f: number, task: WorkerTask, steps: number = PLATFORM.steps): number {
  if (f <= task.start) return 0;
  if (f >= task.end) return steps - 1;
  const onBeat = task.start + Math.floor((f - task.start) / BEAT) * BEAT;
  return Math.min(steps - 1, Math.floor(((onBeat - task.start) / (task.end - task.start)) * (steps - 1)));
}

/** Whether a Worker's task is done at film frame `f` (its platform gets the cap line). */
export const workerDone = (f: number, task: WorkerTask): boolean => f >= task.end;

/** A Worker's state at film frame `f`: its step marker's stop, and whether it is done (its last task finished). */
export function workerState(f: number, tasks: readonly WorkerTask[]): { step: number; done: boolean; busy: boolean } {
  const t = taskAt(f, tasks);
  if (!t) return { step: 0, done: false, busy: false };
  const done = workerDone(f, t);
  return { step: workerStep(f, t), done, busy: !done };
}

/** The bar a frame falls in (1-based), for the beat-locked states. */
export const barOf = (f: number): number => Math.floor(f / BAR) + 1;

// ---------------------------------------------------------------------------------------------
// The lookdev stills' framings (TREATMENT.md, Lookdev stills)

/**
 * The camera of each still: a world point at the frame's centre and a scale.
 * - Still 1, f750: 1.3x on the act-one hub: the chat spring and the hub together centred across the
 *   frame (the hub a little right of centre, the spring over the notes block's start), so the left
 *   of the frame is not left empty.
 * - Still 2, f1880: 0.85x, the spring and your ring at the west edge (clear of it by about as much
 *   as the Workers are of the east edge), the Router on the right third, the Workers right of it;
 *   the tag check (f1750, the built tag) shares it.
 * - Still 3, f4130: 0.6x, beat 7's scale, the summary map: the request's whole route and
 *   everything built round it, centred in the frame (the timetable panel is not part of it). Close
 *   enough that the Workers keep their tool rows and step markers (style.ts detailOpacity), so the
 *   rest stays alive. It holds through C26 and C27, so the map stays in the diagram band above
 *   the notes.
 */
export const FRAMINGS = {
  still1: { x: 808, y: 840, scale: 1.3 },
  still2: { x: 1350, y: 938, scale: 0.85 },
  still3: { x: 1635, y: 824, scale: 0.6 },
  /** a check of the timetable panel's words: the panel inside title-safe, its tags above it */
  chart: { x: WORLD.width / 2, y: 1764, scale: 0.58 },
  /** a check of the built tag (f1750) on the two levels, in the map framing */
  tag: { x: 1350, y: 938, scale: 0.85 },
} as const satisfies Record<string, Camera>;

/**
 * The film frame of each still; `stepDown` is a check of C27's step-down (f4400), in the rest's
 * framing (the camera does not move after the rest).
 */
export const STILL_FRAMES = { still1: 750, still2: 1880, still3: 4130, stepDown: 4400, chart: 3500, tag: 1750 } as const;
