/**
 * The V2 blocking: where Clawd and the neighbour are and what they do, per film frame, in the
 * one continuous world (world/layout.ts). Everything on ones.
 *
 * Clawd travels one route: the path from the pop-up spot beside the giant pumpkin, through the
 * graveyard (a stop to shoo the ghost), through the gates and up the lane, bending at its end to
 * V1's knock spot in front of the door. His five walks are the score's (WALK_FRAMES repeats
 * audio/timeline.ts WALKS: picture and score may not import each other; blocking.test.ts checks
 * they agree, footfall for footfall), each a hop gait (film/gait.ts) between consecutive stops, so a
 * walk always starts where the last one ended. The door spread (bars 17–34) is V1's approved
 * blocking carried onto the last house by fromV1Door (scaled by DOOR_SCALE), headings turned by
 * the house's yaw, on ones instead of twos; the back-off from the door and the exit trot become
 * hops too (no abs(sin) bob).
 */
import { clamp, easings, lerp, progress } from '@aiv/core';
import { Curve, type P2 } from '../kit/spline.ts';
import { DOOR_SCALE, FLOOR, fromV1Door, groundHeight, LAND, PATH, PATH_POINTS, STOPS } from '../world/layout.ts';
import { at, BEAT, KNOCKS } from '../cues.ts';
import type { ClawdPose, UserPose } from './actors.ts';
import { hopAt, type HopState, type Walk } from './gait.ts';
import type { V3 } from './timeline.ts';

/** V1 door-spread spots (V1 world units), carried into today's world. */
const V1 = (x: number, z: number) => fromV1Door([x, 1.2, z]);
export const KNOCK_SPOT: V3 = V1(0.2, -0.95);
export const WAIT_SPOT: V3 = V1(1.25, -0.15);
/** V1's exit target: Clawd trots off toward the far window, screen right */
const EXIT_SPOT: V3 = V1(2.9, 0.7);

/** The house's yaw: V1 headings turn with it. */
const YAW = LAND.house.yaw ?? 0;

/**
 * Clawd's route: the path's points up to just short of the door, then V1's knock spot (the path
 * ends at the door's threshold; he knocks a little in front of it and to its right).
 */
const ROUTE_POINTS: P2[] = [...PATH_POINTS.slice(0, -1), [KNOCK_SPOT[0], KNOCK_SPOT[2]]];
export const ROUTE = new Curve(ROUTE_POINTS);

/** The arc length on ROUTE nearest an arc length on PATH (both start together). */
function onRoute(sPath: number): number {
  const [x, z] = PATH.pointAt(sPath);
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i <= 400; i++) {
    const s = (ROUTE.length * i) / 400;
    const p = ROUTE.pointAt(s);
    const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** The stops on the route: pop-up, end of the valley walk, the shoo, the gates, the knock. */
export const ROUTE_STOPS = {
  pop: 0,
  valleyEnd: onRoute(STOPS.valleyEnd),
  shoo: onRoute(STOPS.shoo),
  gates: onRoute(STOPS.gates),
  knock: ROUTE.length,
} as const;

/** The walks' frames [start, arrival]: the score's WALKS (audio/timeline.ts), repeated here. */
export const WALK_FRAMES: readonly (readonly [number, number])[] = [
  [at(8, 2), at(9) + 8],
  [at(9) + 18, at(11, 1)],
  [at(11, 3) + 6, at(13) + 16],
  [at(14) + 8, at(16, 3)],
  [at(33, 2), at(34, 3)],
];
const [W_VALLEY, W_GRAVE1, W_GRAVE2, W_LANE, W_EXIT] = WALK_FRAMES;
/** The five walks as hop gaits: the first four along ROUTE; the exit's s runs from WAIT_SPOT to EXIT_SPOT. */
export const WALK_TABLE: Walk[] = [
  { from: W_VALLEY[0], to: W_VALLEY[1], s0: ROUTE_STOPS.pop, s1: ROUTE_STOPS.valleyEnd },
  { from: W_GRAVE1[0], to: W_GRAVE1[1], s0: ROUTE_STOPS.valleyEnd, s1: ROUTE_STOPS.shoo },
  { from: W_GRAVE2[0], to: W_GRAVE2[1], s0: ROUTE_STOPS.shoo, s1: ROUTE_STOPS.gates },
  { from: W_LANE[0], to: W_LANE[1], s0: ROUTE_STOPS.gates, s1: ROUTE_STOPS.knock },
  { from: W_EXIT[0], to: W_EXIT[1], s0: 0, s1: Math.hypot(EXIT_SPOT[0] - WAIT_SPOT[0], EXIT_SPOT[2] - WAIT_SPOT[2]) },
];

/** The back-off from the door to the wait spot (bar 19.2 → 20): two small hops, no footfalls in the score. */
const BACK: Walk = { from: at(19, 2), to: at(20) - 2, s0: 0, s1: Math.hypot(WAIT_SPOT[0] - KNOCK_SPOT[0], WAIT_SPOT[2] - KNOCK_SPOT[2]) };

const ground = (x: number, z: number): V3 => [x, FLOOR + groundHeight(x, z), z];

/** A point on ROUTE at arc length s, on the ground. */
export function routeAt(s: number): V3 {
  const [x, z] = ROUTE.pointAt(s);
  return ground(x, z);
}

/** Heading (about y; 0 faces +z) along ROUTE at s. */
export function routeHeading(s: number): number {
  const [tx, tz] = ROUTE.tangentAt(s);
  return Math.atan2(tx, tz);
}

const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** frames a turn takes */
const TURN = 8;

/** A heading that holds each key and, from its frame, turns to it over turnFrames (shortest way round). */
function headingAt(f: number, keys: [number, number][]): number {
  let h = keys[0][1];
  for (const [k, target] of keys) {
    if (f < k) break;
    const d = Math.atan2(Math.sin(target - h), Math.cos(target - h));
    h += d * easings.inOutSine(clamp((f - k) / turnFrames(d)));
  }
  return h;
}

/** The route's heading at s (clamped inside the route). */
const along = (s: number) => routeHeading(Math.min(Math.max(s, 0.02), ROUTE.length - 0.02));

/** Frames a turn of `d` radians takes: 7 a radian, 6..16 (a half turn reads as a turn, not a snap; inOutSine peaks at π/2 × the mean speed). */
const turnFrames = (d: number) => Math.min(16, Math.max(6, Math.abs(d) * 7));

/** A turn from heading a to b that ends at frame `end` (eased, the shortest way round). */
function turnBy(f: number, end: number, a: number, b: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const n = turnFrames(d);
  return a + d * easings.inOutSine(clamp((f - (end - n)) / n));
}

/** The wand on the five knocks: wound up before each, forward on the knock, then back (smooth). */
function knockWand(f: number): number {
  let w = 0;
  for (const k of KNOCKS) {
    const d = f - k;
    // wind up over 4 frames, strike over 2, return over 5
    if (d >= -4 && d < 0) w = Math.max(w, 0.3 + 0.15 * easings.inOutSine((d + 4) / 4));
    else if (d >= 0 && d < 2) w = Math.max(w, lerp(0.45, 1, easings.outCubic(d / 2)));
    else if (d >= 2 && d < 7) w = Math.max(w, lerp(1, 0.3, easings.inOutSine((d - 2) / 5)));
  }
  const on = progress(f, KNOCKS[0] - 10, KNOCKS[0] - 4, 'inOutSine') * (1 - progress(f, KNOCKS[KNOCKS.length - 1] + 6, KNOCKS[KNOCKS.length - 1] + 12, 'inOutSine'));
  return Math.max(w * on, 0.3 * on);
}

/** Clawd's pose and hop at film frame f. */
export interface ClawdState {
  pose: ClawdPose;
  hop: HopState | null;
}

const BASE: ClawdPose = { pos: [0, FLOOR, 0], heading: 0, walk: null, rise: 1, arms: 'down', eyes: 'open', wand: 0, pailLit: 1, envelope: 0, hatTip: 0, hop: 0, visible: false };

function pose(p: Partial<ClawdPose>, hop: HopState | null, f: number): ClawdState {
  const pail = f >= at(26) && f < at(31, 2) ? 0 : 1;
  return { pose: { ...BASE, pailLit: pail, visible: true, ...p }, hop };
}

/** A hop state placed on the route: the pose's position and the lift. */
function onRouteHop(w: Walk, f: number): { pos: V3; hop: HopState } {
  const h = hopAt(w, f);
  const g = routeAt(h.s);
  return { pos: [g[0], g[1] + h.lift, g[2]], hop: h };
}

export function clawdAt(f: number): ClawdState {
  const [wV, wG1, wG2, wL, wX] = WALK_TABLE;
  // valley: springs up beside the giant pumpkin on bar 7, peeks into the pail, sets off (bar 8.2)
  if (f >= at(7) - 2 && f < wG1.from) {
    const { pos, hop } = onRouteHop(wV, f);
    // facing the camera as he springs up, then he turns onto the path just before setting off
    const heading = turnBy(f, wV.from + 2, 0, along(hop.s));
    return pose({ pos, heading, rise: rise(f, at(7), 12), eyes: f >= at(7, 3) && f < at(8) ? 'closed' : 'open' }, hop, f);
  }
  // graveyard: hops on to the ghost tree, stops to shoo the ghost, hops on to the gates and waits
  const gateFlick = at(14) - 8;
  if (f >= wG1.from && f < gateFlick) {
    const stop0 = wG1.to;
    const stop1 = wG2.from;
    const w = f < stop0 + 6 ? wG1 : wG2;
    const { pos, hop } = onRouteHop(w, f);
    const shoo = f >= stop0 && f < stop1;
    // the ghost hangs at LAND.ghosts: he turns toward it to flick the ember, then back to the path
    const toGhost = Math.atan2(LAND.ghosts.x - pos[0], LAND.ghosts.z - pos[2]);
    const back = turnFrames(toGhost - along(ROUTE_STOPS.shoo));
    const heading =
      f < stop0 ? along(hop.s) : f < stop1 - back ? turnBy(f, stop0 + 2 + back, along(ROUTE_STOPS.shoo), toGhost) : turnBy(f, stop1, toGhost, along(hop.s));
    const flick = shoo ? progress(f, at(11, 2) - 6, at(11, 2), 'outCubic') * (1 - progress(f, stop1 - 8, stop1 - 2, 'inCubic')) : 0;
    return pose({ pos, heading, eyes: f >= stop0 && f < stop0 + BEAT ? 'left' : 'open', wand: flick, arms: shoo && flick > 0.05 ? 'one-up' : 'down' }, hop, f);
  }
  // the gates: an ember flick creaks them open (bar 14), then up the lane to the knock spot, where
  // he turns to face the door before the knocks begin
  const toDoor = Math.PI + 0.25 + YAW;
  if (f >= gateFlick && f < at(17)) {
    const { pos, hop } = onRouteHop(wL, f);
    const flick = progress(f, at(14) - 6, at(14), 'outCubic') * (1 - progress(f, at(14) + 4, at(14) + 10, 'inCubic'));
    const heading = turnBy(f, Math.min(wL.to + 10, at(17)), along(hop.s), toDoor);
    return pose({ pos, heading, wand: flick, arms: flick > 0.2 ? 'one-up' : 'down' }, hop, f);
  }
  // the door (V1's blocking, carried onto the house)
  if (f >= at(17) && f < at(35)) {
    let pos: V3 = KNOCK_SPOT;
    let hop: HopState | null = null;
    if (f >= BACK.from - 4 && f < wX.from) {
      const h = hopAt(BACK, f);
      const p = lerpV(KNOCK_SPOT, WAIT_SPOT, BACK.s1 > 0 ? h.s / BACK.s1 : 1);
      pos = [p[0], FLOOR + groundHeight(p[0], p[2]) + h.lift, p[2]];
      hop = h;
    }
    if (f >= wX.from) {
      const h = hopAt(wX, f);
      const p = lerpV(WAIT_SPOT, EXIT_SPOT, wX.s1 > 0 ? h.s / wX.s1 : 1);
      pos = [p[0], FLOOR + groundHeight(p[0], p[2]) + h.lift, p[2]];
      hop = h;
    } else if (f < BACK.from - 4) {
      pos = [KNOCK_SPOT[0], FLOOR + groundHeight(KNOCK_SPOT[0], KNOCK_SPOT[2]), KNOCK_SPOT[2]];
    }
    // V1's headings (V1 world), turned by the house's yaw
    const toUser = Math.PI + 0.75 + YAW;
    const exitDir = Math.atan2(EXIT_SPOT[0] - WAIT_SPOT[0], EXIT_SPOT[2] - WAIT_SPOT[2]);
    const heading = headingAt(f, [
      [0, toDoor],
      [at(18, 3), 0.3 + YAW], // the glance at the lens in the silence
      [at(19, 2) - 2, toUser],
      [at(25, 3), -0.35 + YAW], // deadpan to us, arms up, as the seal lands
      [at(29), toUser - 0.3],
      [at(31, 3), 0.25 + YAW], // to camera for the wink and the hat tip
      [wX.from - TURN, exitDir],
    ]);
    const tadaUp = progress(f, at(22) - 6, at(22), 'outCubic') * (1 - progress(f, at(23), at(23) + 6, 'inCubic'));
    const proud = progress(f, at(26) - 4, at(26), 'outCubic') * (1 - progress(f, at(29) - 6, at(29), 'inCubic'));
    return pose(
      {
        pos,
        heading,
        wand: f < at(19) ? knockWand(f) : 0,
        arms: tadaUp > 0.3 || proud > 0.3 ? 'up' : 'down',
        envelope: tadaUp,
        eyes: f >= at(32) && f < at(32, 3) ? 'wink' : (f >= at(21) && f < at(21, 2)) || (f >= at(31) && f < at(31, 2)) ? 'closed' : f >= at(29) && f < at(30) ? 'left' : 'open',
        hatTip: progress(f, at(32, 2) - 4, at(32, 2), 'outCubic') * (1 - progress(f, at(32, 3), at(32, 3) + 6, 'inCubic')),
      },
      hop,
      f,
    );
  }
  return { pose: BASE, hop: null };
}

/** A pop-up's rise, 0 flat .. 1 standing, from `from`: eased in, a small overshoot, settled (on ones). */
export function rise(f: number, from: number, dur = 14): number {
  const t = progress(f, from, from + dur, 'linear');
  if (t <= 0) return 0;
  const c = 1.3;
  const x = t - 1;
  return clamp(1 + (c + 1) * x * x * x + c * x * x, 0, 1.1);
}

/** Where Clawd's pail hangs (for the candy that drops into it): V1's offset × DOOR_SCALE, turned with him. */
export function pailWorld(p: ClawdPose): V3 {
  const [x, y, z] = [-9.8 * 0.05 * DOOR_SCALE, 0.12 * DOOR_SCALE, 0.05 * DOOR_SCALE];
  const c = Math.cos(p.heading);
  const s = Math.sin(p.heading);
  return [p.pos[0] + x * c + z * s, p.pos[1] + y, p.pos[2] - x * s + z * c];
}

/** The neighbour in the bedsheet (V1's blocking on ones, carried onto the house). */
export function userAt(f: number): UserPose {
  const out = progress(f, at(20) + 2, at(20) + 14, 'outCubic') * (1 - progress(f, at(32, 3), at(33) - 2, 'inOutSine'));
  const visible = f >= at(20) && f < at(33) + 10;
  const hop = f >= at(20, 3) && f < at(21) ? Math.sin(((f - at(20, 3)) / BEAT) * Math.PI) * 0.18 * DOOR_SCALE : 0;
  const sag = progress(f, at(29), at(30), 'inOutCubic') * (1 - progress(f, at(32, 2), at(33), 'linear'));
  return {
    visible,
    pos: fromV1Door([-0.25, 1.2, lerp(-1.75, -1.05, out)]),
    stand: 1 - 0.32 * sag,
    ghosted: progress(f, at(26), at(26) + 4, 'linear') * (1 - progress(f, at(33), at(33) + 6, 'linear')),
    hop,
    tilt: progress(f, at(30, 1), at(30, 2), 'inOutSine') * (1 - progress(f, at(31), at(31) + 8, 'inOutSine')),
  };
}
