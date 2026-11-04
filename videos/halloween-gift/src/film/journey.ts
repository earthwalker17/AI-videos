/**
 * The V2 camera: one continuous journey, no hard cuts the eye can see. From the desk it orbits
 * the closed book, cranes up as the cover bursts open and the world grows, settles into the hero
 * view (the reference's composition), pushes in as Clawd springs up beside the pumpkin, trucks
 * alongside him through the graveyard (following a centred moving average of his path, so his
 * hops never shake the frame), rises to the gates as the mist parts, dollies through them up the
 * lane and arrives on the knock at V1's door two-shot. The door spread is V1's approved camera,
 * carried onto the house (fromV1Door, DOOR_SCALE; focus distances scaled too). Clawd's exit is a
 * follow; the closing cover sweeps across the lens, and while its inside fills the frame the
 * camera changes to the desk for the slam (the one cut, hidden).
 *
 * Every pose is a pure function of the film frame: CamPath (centripetal Catmull-Rom through the
 * keys, a monotone C1 time warp, zero velocity only at holds).
 */
import { lerp } from '@aiv/core';
import { at, BAR, BEAT, FILM_FRAMES } from '../cues.ts';
import { DOOR_SCALE, FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, fromV1Door, GATE_POSTS, groundHeight, HERO, LAMPS, LAND, STONES } from '../world/layout.ts';
import { clawdAt, ROUTE, routeAt } from './blocking.ts';
import { CamPath, type CamKey, type CamPose } from './campath.ts';
import type { V3 } from './timeline.ts';

type K = Omit<CamKey, 'f'>;
const add = (a: V3, b: V3): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Clawd's position averaged over ±half frames (on the ground: the hop lift left out). */
function smoothed(f: number, half = 10): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (let k = -half; k <= half; k++) {
    const { pose, hop } = clawdAt(f + k);
    if (!pose.visible) continue;
    x += pose.pos[0];
    y += pose.pos[1] - (hop?.lift ?? 0);
    z += pose.pos[2];
    n++;
  }
  return n ? [x / n, y / n, z / n] : [0, FLOOR, 0];
}

/** The route's direction near a world point (x, z): its tangent at the nearest arc length. */
function tangentNear(p: V3): [number, number] {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i <= 200; i++) {
    const s = (ROUTE.length * i) / 200;
    const q = routeAt(s);
    const d = (q[0] - p[0]) ** 2 + (q[2] - p[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  const t = ROUTE.tangentAt(Math.min(Math.max(best, 0.02), ROUTE.length - 0.02));
  return [t[0], t[1]];
}

/**
 * A truck alongside Clawd: the camera stands `side` to the camera's side of his path, `up` above
 * it, and looks at him with a small lead in his direction of travel. The camera's side is the
 * path normal toward the front right (+x +z): the path runs right along the front and then back
 * up the slope, and that normal turns with it without ever flipping (the path never heads front
 * right or back left), so the truck swings round to his right as he climbs to the gates.
 */
const CAMERA_SIDE: readonly [number, number] = [0.6, 0.8];

/**
 * What the camera must never pass through, in plan: circles (x, z, radius) up to a height above
 * the ground. The stones, the landmarks with bulk, the lamp posts, the gate posts; the root mass
 * is ROOTS_FOOTPRINT (world/Dressing.tsx) with its crawling roots.
 */
export const CAMERA_OBSTACLES: readonly { name: string; x: number; z: number; r: number; h: number }[] = [
  ...STONES.map((s, i) => ({ name: `stone ${i} (${s.kind})`, x: s.x, z: s.z, r: 0.28, h: s.h + 0.1 })),
  { name: 'big cross', x: LAND.bigCross.x, z: LAND.bigCross.z, r: 0.45, h: 1.8 },
  { name: 'big pumpkin', x: LAND.bigPumpkin.x, z: LAND.bigPumpkin.z, r: 0.85, h: 1.5 },
  { name: 'ghost tree', x: LAND.ghostTree.x, z: LAND.ghostTree.z, r: 0.75, h: 9 },
  { name: 'old tree', x: LAND.oldTree.x, z: LAND.oldTree.z, r: 0.5, h: 9 },
  // the root mass: its hollow stump, and the roots crawling round it (low: a camera may pass over)
  { name: 'root stump', x: LAND.roots.x + 0.22, z: LAND.roots.z - 0.06, r: 0.6, h: 1.8 },
  { name: 'roots', x: LAND.roots.x + 0.22, z: LAND.roots.z - 0.06, r: 1.15, h: 0.4 },
  { name: 'RIP stone', x: LAND.ripStone.x, z: LAND.ripStone.z, r: 0.45, h: 1.0 },
  { name: 'cauldron', x: LAND.cauldron.x, z: LAND.cauldron.z, r: 0.35, h: 0.55 },
  ...LAMPS.map((l, i) => ({ name: `lamp ${i}`, x: l.x, z: l.z, r: 0.12, h: 1.35 })),
  ...GATE_POSTS.map((p, i) => ({ name: `gate post ${i}`, x: p[0], z: p[1], r: 0.1, h: 1.95 })),
];
/** the fence, below this height above the ground */
const FENCE_H = 0.85;
const MARGIN = 0.3;

/**
 * A camera position kept out of every obstacle (and off the fence), in plan. The push is soft: a
 * point closer than need + SOFT is moved out along the obstacle's normal by a C1 ramp, so a
 * camera path evaluated through it frame by frame stays smooth (no kink where the push starts).
 */
const SOFT = 0.25;
const ramp = (d: number, need: number) => {
  const t = (d - need) / SOFT;
  return t >= 1 ? d : need + SOFT * (t <= -1 ? 0 : ((t + 1) * (t + 1)) / 4);
};
function clear(p: V3): [number, number, number] {
  const y = p[1];
  let [x, , z] = p;
  for (let pass = 0; pass < 3; pass++) {
    for (const o of CAMERA_OBSTACLES) {
      if (y > FLOOR + groundHeight(o.x, o.z) + o.h + 0.15) continue;
      const dx = x - o.x;
      const dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const need = o.r + MARGIN;
      if (d < need + SOFT && d > 1e-6) {
        const k = ramp(d, need) / d;
        x = o.x + dx * k;
        z = o.z + dz * k;
      }
    }
    if (y < FLOOR + groundHeight(x, z) + FENCE_H)
      for (const line of [FENCE_LINE, FENCE_LINE_RIGHT]) {
        const { d, px, pz } = nearestOn(line, x, z);
        if (d < MARGIN + SOFT && d > 1e-6) {
          const k = ramp(d, MARGIN) / d;
          x = px + (x - px) * k;
          z = pz + (z - pz) * k;
        }
      }
  }
  return [x, y, z];
}

/** The nearest point of a polyline to (x, z), and the distance. */
function nearestOn(line: readonly (readonly [number, number])[], x: number, z: number): { d: number; px: number; pz: number } {
  let best = { d: Infinity, px: x, pz: z };
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const vx = bx - ax;
    const vz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    const px = ax + vx * t;
    const pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, px, pz };
  }
  return best;
}

function truckKey(f: number, side: number, up: number, fov: number, lookUp = 0.18, lead = 0.35): CamKey {
  const c = smoothed(f);
  const [tx, tz] = tangentNear(c);
  let nx = -tz;
  let nz = tx;
  if (nx * CAMERA_SIDE[0] + nz * CAMERA_SIDE[1] < 0) {
    nx = -nx;
    nz = -nz;
  }
  const pos = clear(add(c, [nx * side - tx * 0.4, up, nz * side - tz * 0.4]));
  const look = add(c, [tx * lead, lookUp, tz * lead]);
  return { f, pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
}

/** Clawd's arc length on ROUTE near a world point. */
function routeS(p: V3): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i <= 400; i++) {
    const s = (ROUTE.length * i) / 400;
    const q = routeAt(s);
    const d = (q[0] - p[0]) ** 2 + (q[2] - p[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/**
 * A follow from behind: the camera trails `back` along the path itself (which no prop stands on:
 * world/layout.test.ts), `right` to the path's right there and `up` above it, and looks at Clawd
 * with a lead along his way. Through the gateway it passes down the middle.
 */
function trailKey(f: number, back: number, right: number, up: number, fov = 34, lead = 1.0, lookUp = 0.4): CamKey {
  const c = smoothed(f);
  const s = Math.max(0, routeS(c) - back);
  const q = routeAt(s);
  const [tx, tz] = ROUTE.tangentAt(Math.min(Math.max(s, 0.02), ROUTE.length - 0.02));
  const pos = clear([q[0] - tz * right, c[1] + up, q[2] + tx * right]);
  const [lx, lz] = tangentNear(c);
  const look = add(c, [lx * lead, lookUp, lz * lead]);
  return { f, pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
}

// ---- the desk, the opening and the world ------------------------------------------------------

/** The closed book on the desk, the opening's framing (the book is 16 wide at the origin). */
const DESK_A: K = { pos: [12.6, 9.6, 16.8], look: [0, 1.3, 0], fov: 30, focus: 22 };
const DESK_B: K = { pos: [9.4, 10.4, 17.6], look: [0, 1.5, 0.2], fov: 30, focus: 21 };
/** High over the opening book: the world grows out of the page below */
const OVER: K = { pos: [2.2, 15.5, 13.5], look: [0.6, FLOOR, 0.6], fov: 36, focus: 15 };
/** a three-quarter close on the pop-up spot beside the giant pumpkin */
const POP: K = { pos: [0.15, FLOOR + 0.95, 5.3], look: [-0.95, FLOOR + 0.42, 3.05], fov: 36, focus: 2.6 };

const truckFrames = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let f = from; f < to; f += step) out.push(f);
  out.push(to);
  return out;
};

/** Where the ghost lowers to peek (bars 10–11). */
const GHOST_AT: V3 = [LAND.peek.x, FLOOR + 1.6, LAND.peek.z];

function worldKeys(): CamKey[] {
  const keys: CamKey[] = [
    { f: 0, ...DESK_A, hold: true },
    { f: at(4) - 6, ...DESK_B },
    { f: at(4) + 26, ...OVER },
    // the hero view, held while the pumpkin lights and the witch crosses the moon
    { f: at(5, 3), ...HERO, hold: true },
    { f: at(6, 3), pos: [HERO.pos[0] - 0.15, HERO.pos[1] - 0.1, HERO.pos[2] - 0.25], look: HERO.look, fov: HERO.fov, focus: HERO.focus },
    { f: at(7) + 8, ...POP, hold: true },
    // held while he peeks into his pail, then off with him
    { f: at(8, 1) + 4, pos: [POP.pos[0] + 0.05, POP.pos[1] + 0.02, POP.pos[2] - 0.08], look: POP.look, fov: POP.fov, focus: POP.focus, hold: true },
  ];
  // the truck: valley walk, graveyard, the shoo (the camera settles, looks up at the ghost), on to the gates
  for (const f of truckFrames(at(8, 2), at(11, 1), BEAT)) keys.push(truckKey(f, 1.6, 0.66, 34));
  {
    const k = truckKey(at(11, 2), 1.5, 0.74, 34);
    k.look = [lerp(k.look[0], GHOST_AT[0], 0.35), lerp(k.look[1], GHOST_AT[1], 0.35), lerp(k.look[2], GHOST_AT[2], 0.35)];
    keys.push({ ...k, hold: true });
  }
  // up the slope: the camera swings round behind him and rises as it follows, so the mist parts on
  // the gates ahead of him
  for (const f of truckFrames(at(11, 3) + 18, at(13) + 16, BEAT)) {
    const u = (f - at(11, 3)) / (at(13) + 16 - at(11, 3));
    keys.push(trailKey(f, lerp(1.3, 1.6, u), lerp(0.45, 0.25, u), lerp(0.88, 1.08, u)));
  }
  // held behind his right shoulder for the creak and the clang
  keys.push({ ...trailKey(at(14), 1.5, 0.3, 0.85, 34, 0.9, 0.55), hold: true });
  // through the gateway (down the middle: the open leaves line it) and along the lane behind
  // him; on the last bar the camera swings round to his right (the door yard's side) so it
  // arrives on V1's door two-shot without a whip
  keys.push(trailKey(at(15), 1.5, 0, 0.75));
  keys.push(trailKey(at(15, 2), 1.45, 0, 0.72));
  keys.push(trailKey(at(16), 1.25, 0.35, 0.72));
  keys.push(trailKey(at(16, 2), 0.75, 1.0, 0.72));
  return keys;
}

// ---- the door: V1's approved camera, carried onto the house -------------------------------------

/** V1's door keys (V1 world: floor 1.2); `hold` where V1 locked off or settled. */
const V1F = 1.2;
const V1_DOOR: { f: number; pos: V3; look: V3; fov: number; focus: number; hold?: boolean }[] = [
  { f: at(17), pos: [1.2, V1F + 0.55, 3.0], look: [0.0, V1F + 1.2, -1.3], fov: 36, focus: 4.1 },
  { f: at(20), pos: [0.95, V1F + 0.5, 3.6], look: [-0.15, V1F + 1.3, -1.2], fov: 36, focus: 4.7 },
  { f: at(21), pos: [0.7, V1F + 0.7, 4.4], look: [-0.15, V1F + 1.35, -1.0], fov: 36, focus: 5.3, hold: true },
  { f: at(24, 3) - 6, pos: [0.35, V1F + 0.9, 4.1], look: [-0.1, V1F + 1.2, -0.4], fov: 34, focus: 4.3, hold: true },
  // the push onto the letter lands on ding-2 (softened: 18 frames, eased both ends)
  { f: at(25) + BEAT, pos: [-0.05, V1F + 1.15, 3.41], look: [-0.05, V1F + 1.15, -0.15], fov: 30, focus: 3.56, hold: true },
  { f: at(29), pos: [-0.03, V1F + 1.16, 3.37], look: [-0.05, V1F + 1.15, -0.15], fov: 30, focus: 3.52, hold: true },
  { f: at(30), pos: [0.7, V1F + 0.7, 4.6], look: [-0.15, V1F + 1.3, -1.0], fov: 36, focus: 5.0, hold: true },
  { f: at(31, 3), pos: [0.68, V1F + 0.7, 4.5], look: [-0.15, V1F + 1.3, -1.0], fov: 36, focus: 5.0, hold: true },
  { f: at(32), pos: [0.85, V1F + 0.5, 2.6], look: [0.8, V1F + 0.45, 0.4], fov: 30, focus: 2.2, hold: true },
  { f: at(33), pos: [0.9, V1F + 0.55, 2.7], look: [0.9, V1F + 0.5, 0.4], fov: 30, focus: 2.3, hold: true },
];

function doorKeys(): CamKey[] {
  return V1_DOOR.map((k) => ({ f: k.f, pos: fromV1Door(k.pos), look: fromV1Door(k.look), fov: k.fov, focus: k.focus * DOOR_SCALE, ...(k.hold ? { hold: true } : {}) }));
}

/** Clawd's exit: the camera trucks with him toward the far window (V1's follow offsets, scaled and turned). */
function exitKeys(): CamKey[] {
  const yaw = LAND.house.yaw ?? 0;
  const turn = (x: number, z: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
  const keys: CamKey[] = [];
  for (const f of truckFrames(at(33, 2) + 6, at(34, 2), 8)) {
    const c = smoothed(f, 6);
    const [lx, lz] = turn(0.9 * DOOR_SCALE, -2.0 * DOOR_SCALE);
    const [px, pz] = turn(-1.1 * DOOR_SCALE, 2.8 * DOOR_SCALE);
    keys.push({ f, pos: [c[0] + px, c[1] + 0.8 * DOOR_SCALE, c[2] + pz], look: [c[0] + lx, c[1] + 0.85 * DOOR_SCALE, c[2] + lz], fov: 34, focus: 3.0 * DOOR_SCALE });
  }
  return keys;
}

/**
 * The cover comes down (it closes from at(34, 2) to the slam on 'book-slam'); the camera rises
 * and backs off as it does, so the cover's inside sweeps across the lens before the slam.
 */
export const COVER_CLOSE: readonly [number, number] = [at(34, 2), at(35)];
const RISE: K = { pos: [2.2, FLOOR + 3.1, 4.4], look: [3.6, FLOOR + 1.2, -1.6], fov: 40, focus: 4 };

const WORLD = new CamPath([...worldKeys(), ...doorKeys(), ...exitKeys(), { f: COVER_CLOSE[1] + 4, ...RISE }]);

/** The frame the camera changes to the desk, while the closing cover fills the frame. */
export const HIDDEN_CUT = at(35) - 3;

/** Back on the desk for the slam and the end card: a slow drift. */
const DESK_END = new CamPath([
  { f: HIDDEN_CUT, pos: [7.4, 6.4, 13.8], look: [0, 1.1, 0.4], fov: 30, focus: 15 },
  { f: at(35) + BAR, pos: [7.9, 7.0, 14.6], look: [0, 1.1, 0.3], fov: 30, focus: 15.5 },
  { f: FILM_FRAMES, pos: [8.3, 7.3, 15.2], look: [0, 1.1, 0.3], fov: 30, focus: 16, hold: true },
]);

export function journeyAt(f: number): CamPose {
  if (f >= HIDDEN_CUT) return DESK_END.at(f);
  return WORLD.at(f);
}
