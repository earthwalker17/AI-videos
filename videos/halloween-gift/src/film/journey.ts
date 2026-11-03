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
import { DOOR_SCALE, FLOOR, fromV1Door, HERO, LAND } from '../world/layout.ts';
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
 * A truck alongside Clawd: the camera stands `side` to the camera's side of his path (+z), `up`
 * above it, and looks at him with a small lead in his direction of travel.
 */
function truckKey(f: number, side: number, up: number, fov: number, lookUp = 0.18, lead = 0.35): CamKey {
  const c = smoothed(f);
  const [tx, tz] = tangentNear(c);
  // the side of the path that faces the camera: the normal with +z
  let nx = -tz;
  let nz = tx;
  if (nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const pos = add(c, [nx * side - tx * 0.4, up, nz * side - tz * 0.4]);
  const look = add(c, [tx * lead, lookUp, tz * lead]);
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

/** The ghost tree's limb, where the ghost lowers to peek (bars 10–11). */
const GHOST_AT: V3 = [LAND.ghosts.x, FLOOR + 1.6, LAND.ghosts.z];

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
  for (const f of truckFrames(at(8, 2), at(11, 1), BEAT)) keys.push(truckKey(f, 1.9, 0.62, 34));
  {
    const k = truckKey(at(11, 2), 1.7, 0.5, 34);
    k.look = [lerp(k.look[0], GHOST_AT[0], 0.35), lerp(k.look[1], GHOST_AT[1], 0.35), lerp(k.look[2], GHOST_AT[2], 0.35)];
    keys.push({ ...k, hold: true });
  }
  for (const f of truckFrames(at(11, 3) + 6, at(13) + 16, BEAT)) keys.push(truckKey(f, 1.9, 0.62, 34));
  // the mist parts: up and round behind him to the tall gates, held for the creak and the clang
  const gate = LAND.gates;
  keys.push({ f: at(14), pos: [gate.x - 0.9, FLOOR + 1.0, gate.z + 2.3], look: [gate.x + 0.1, FLOOR + 0.85, gate.z - 0.2], fov: 34, focus: 2.5, hold: true });
  // through the gates and up the lane behind him
  for (const f of truckFrames(at(15), at(16, 3), BEAT * 2)) {
    const c = smoothed(f);
    const [tx, tz] = tangentNear(c);
    keys.push({ f, pos: add(c, [-tx * 1.5 + 0.35, 0.75, -tz * 1.5 + 0.2]), look: add(c, [tx * 1.2, 0.45, tz * 1.2]), fov: 34, focus: 1.9 });
  }
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
const RISE: K = { pos: [3.4, FLOOR + 3.2, 3.6], look: [3.6, FLOOR + 1.2, -1.6], fov: 40, focus: 4 };

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
  return f >= HIDDEN_CUT ? DESK_END.at(f) : WORLD.at(f);
}
