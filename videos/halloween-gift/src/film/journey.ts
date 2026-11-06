/**
 * The V2 camera: one continuous journey, no hard cuts the eye can see. From the desk it drifts
 * round the closed book, pushes in over it as the cover bursts open and the world grows, settles
 * into the hero view (the reference's composition) before the first caption, pushes in as Clawd
 * springs up beside the pumpkin, trucks alongside him through the graveyard (following a centred
 * moving average of his path, so his hops never shake the frame), swings round behind him and
 * rises as he climbs to the gates while the mist parts, follows him through the gateway and along
 * the lane, and arrives on the knock at V1's door two-shot. The door spread is V1's approved camera,
 * carried onto the house (fromV1Door, DOOR_SCALE; focus distances scaled too). As Clawd trots off
 * the camera swings up round him and backs away out of the book onto the desk, where the whole
 * open book shows with its cover standing; the cover swings down (the world folding flat under it)
 * and slams, and the camera eases in on the closed book for the end card: one path, no cut at all.
 *
 * Every pose is a pure function of the film frame: CamPath (centripetal Catmull-Rom through the
 * keys, a monotone C1 time warp, zero velocity only at holds).
 */
import { lerp, smoothstep } from '@aiv/core';
import { at, BEAT, FILM_FRAMES } from '../cues.ts';
import { DOOR_SCALE, FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, fromHouse, fromV1Door, GATE_POSTS, groundHeight, HERO, LAMPS, LAND, STONES } from '../world/layout.ts';
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
/**
 * A ghost hanging in the air from the ghost tree's limb (world/Ghosts.tsx on world/Trees.tsx
 * GHOST_HOOKS), its hook at (x, z), its cloth between y0 and y1 above FLOOR (the peek ghost let
 * down to Clawd's hat only while it peeks): journey.test checks these against the built ghosts.
 */
const hanging = (name: string, x: number, z: number, y0: number, y1: number, r = 0.45) => ({ name, x, z, r, y0: y0 - groundHeight(x, z), h: y1 - groundHeight(x, z) });

/** the frames the peek ghost hangs let down (film/beats.ts ghostLowerAt above 0) */
const PEEKING = [at(10, 3), at(11, 2) + 14] as const;

export interface CameraObstacle {
  name: string;
  x: number;
  z: number;
  r: number;
  /** its top above the ground at (x, z) */
  h: number;
  /** its bottom above the ground, for what hangs in the air (default: the ground) */
  y0?: number;
  /** only over these film frames (default: always) */
  when?: readonly [number, number];
}
export const obstacleAt = (o: CameraObstacle, f: number | undefined): boolean => !o.when || f === undefined || (f >= o.when[0] && f <= o.when[1]);

/** Where no camera may stand: a plan circle from the ground (or from y0 above it) up to h. */
export const CAMERA_OBSTACLES: readonly CameraObstacle[] = [
  hanging('ghost 0', 3.54, 2.56, 1.62, 3.3),
  hanging('ghost 1', 2.81, 2.18, 2.35, 3.6),
  // the peek ghost gathered up under the limb at rest (world/Ghosts.tsx GATHER_MIN), let down only
  // while it peeks: it leans out toward Clawd and comes down beside his hat
  hanging('ghost 2 (the peek)', 1.5, 1.56, 2.5, 3.3),
  { ...hanging('ghost 2 (let down)', 1.56, 1.28, -0.02, 3.3, 1.0), when: PEEKING },
  // the high ghost above the moon, tied on above the frame's top edge
  hanging('ghost 3', 3.16, 2.42, 2.75, 4.1),
  ...STONES.map((s, i) => ({ name: `stone ${i} (${s.kind})`, x: s.x, z: s.z, r: 0.28, h: s.h + 0.1 })),
  // world/Graveyard.tsx's cross is 2.3 tall and its leaning arm reaches 1.02 in plan
  { name: 'big cross', x: LAND.bigCross.x, z: LAND.bigCross.z, r: 1.05 * (LAND.bigCross.scale ?? 1), h: 2.4 * (LAND.bigCross.scale ?? 1) },
  { name: 'big pumpkin', x: LAND.bigPumpkin.x, z: LAND.bigPumpkin.z, r: 0.85, h: 1.5 },
  { name: 'ghost tree', x: LAND.ghostTree.x, z: LAND.ghostTree.z, r: 0.75, h: 9 },
  { name: 'old tree', x: LAND.oldTree.x, z: LAND.oldTree.z, r: 0.5, h: 9 },
  // the root mass: its hollow stump, and the roots crawling round it (low: a camera may pass over)
  { name: 'root stump', x: LAND.roots.x + 0.22, z: LAND.roots.z - 0.06, r: 0.6, h: 1.8 },
  { name: 'roots', x: LAND.roots.x + 0.22, z: LAND.roots.z - 0.06, r: 1.15, h: 0.4 },
  { name: 'RIP stone', x: LAND.ripStone.x, z: LAND.ripStone.z, r: 0.45, h: 1.0 },
  { name: 'cauldron', x: LAND.cauldron.x, z: LAND.cauldron.z, r: 0.35, h: 0.55 },
  // world/Props2.tsx COFFIN_FOOTPRINT (the coffin, its planks, the mound, the shovel's grip); world/Pumpkins.tsx MID_PUMPKIN
  { name: 'coffin', x: LAND.coffin.x - 0.05, z: LAND.coffin.z + 0.01, r: 0.46, h: 0.45 },
  { name: 'mid pumpkin', x: LAND.midPumpkin.x, z: LAND.midPumpkin.z, r: 0.28, h: 0.4 },
  ...LAMPS.map((l, i) => ({ name: `lamp ${i}`, x: l.x, z: l.z, r: 0.17, h: 1.35 })),
  ...GATE_POSTS.map((p, i) => ({ name: `gate post ${i}`, x: p[0], z: p[1], r: 0.1, h: 1.95 })),
  // world/House.tsx: the door gable and the tall wing (house-local), its wall lantern; the far-window house
  ...([[0, -0.6, 0.95], [1.3, -0.75, 1.0]] as const).map(([lx, lz, r], i) => {
    const [x, , z] = fromHouse([lx, 0, lz]);
    return { name: `house ${i}`, x, z, r, h: 3.4 };
  }),
  (() => {
    const [x, , z] = fromHouse([-0.9, 0, 0.08]);
    return { name: 'wall lantern', x, z, r: 0.2, h: 1.2 };
  })(),
  { name: 'far-window house', x: LAND.farWindow.x, z: LAND.farWindow.z, r: 0.6, h: 1.4 },
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
function clear(p: V3, f?: number): [number, number, number] {
  const y = p[1];
  let [x, , z] = p;
  for (let pass = 0; pass < 3; pass++) {
    for (const o of CAMERA_OBSTACLES) {
      if (!obstacleAt(o, f)) continue;
      if (y > FLOOR + groundHeight(o.x, o.z) + o.h + 0.15) continue;
      if (o.y0 !== undefined && y < FLOOR + groundHeight(o.x, o.z) + o.y0 - 0.15) continue;
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
  // ahead of him and to his side: a three-quarter front on his face (his eyes) as he hops along
  const pos = clear(add(c, [nx * side + tx * 1.0, up, nz * side + tz * 1.0]), f);
  const look = add(c, [tx * lead, lookUp, tz * lead]);
  return { f, pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
}

/**
 * A key at a set place (x, z), `up` above the ground there, looking ahead of Clawd: for the lane,
 * where trailing along the route would swing the camera across the gate's sharp turn.
 */
function placeKey(f: number, x: number, z: number, up: number, fov = 38, lead = 1.0, lookUp = 0.35): CamKey {
  const c = smoothed(f);
  const pos = clear([x, FLOOR + groundHeight(x, z) + up, z], f);
  const [lx, lz] = tangentNear(c);
  const look = add(c, [lx * lead, lookUp, lz * lead]);
  return { f, pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
}

// ---- the desk, the opening and the world ------------------------------------------------------

/** The closed book on the desk, the opening's framing (the book is 16 wide at the origin). */
const DESK_A: K = { pos: [12.6, 9.6, 16.8], look: [0, 1.3, 0], fov: 30, focus: 22 };
const DESK_B: K = { pos: [9.4, 10.4, 17.6], look: [0, 1.5, 0.2], fov: 30, focus: 21 };
/** Over the opening book, pushing in: the world grows out of the page below (not high above it: the crane down must stay gentle); left of the ghost tree's line to the cottage, so its trunk does not hide it */
const OVER: K = { pos: [1.45, 8.6, 12.6], look: [0.8, FLOOR + 0.4, 0.3], fov: 35, focus: 13.6 };
/** a three-quarter close on the pop-up spot beside the giant pumpkin: its face right of caption 1 (top left), its stem in frame */
const POP: K = { pos: [0.08, FLOOR + 0.94, 5.15], look: [-1.38, FLOOR + 0.56, 2.9], fov: 44, focus: 2.65 };

const truckFrames = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let f = from; f < to; f += step) out.push(f);
  out.push(to);
  return out;
};

/**
 * The peek (bars 10–11): the camera settles on the shoo stop from its front right as the ghost
 * comes down on its rope (world/Ghosts.tsx PEEK_EYES), swung round (azimuth about 66°) so the
 * cauldron falls right of the ghost instead of between it and the lens, and holds close enough
 * that Clawd stays a quarter of the frame tall: Clawd left, the ghost peering down at him in the
 * middle, the cauldron right; `u` 0..1 from Clawd's own framing to the peek's (looking between
 * Clawd and the ghost's face).
 */
const PEEK_LOOK: V3 = [lerp(LAND.peek.x, 1.24, 0.5), FLOOR + 0.5, lerp(LAND.peek.z, 1.67, 0.5)];
function peekKey(f: number, dist: number, up: number, fov: number, u: number, azDeg = 66): CamKey {
  const c = smoothed(f);
  const a = (azDeg * Math.PI) / 180;
  const pos = clear([c[0] + Math.cos(a) * dist, c[1] + up, c[2] + Math.sin(a) * dist], f);
  const look: V3 = [lerp(c[0], PEEK_LOOK[0], u), lerp(c[1] + 0.18, PEEK_LOOK[1], u), lerp(c[2], PEEK_LOOK[2], u)];
  return { f, pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
}

/** The gates beat's framing (at(14)): from the graveyard's left, back and up, the gateway left of centre, the cottage right of it. */
const GATE_CAM = { pos: [-0.45, 0, 3.0] as V3, up: 1.5, look: [1.95, FLOOR + 1.42, -1.0] as V3, fov: 42 };

function worldKeys(): CamKey[] {
  const keys: CamKey[] = [
    { f: 0, ...DESK_A, hold: true },
    { f: at(4) - 6, ...DESK_B },
    { f: at(4) + 22, ...OVER },
    // the hero view, arrived before the first caption and held while the witch crosses the moon
    { f: at(5, 2), ...HERO, hold: true },
    { f: at(6, 3), pos: [HERO.pos[0] - 0.15, HERO.pos[1] - 0.1, HERO.pos[2] - 0.25], look: HERO.look, fov: HERO.fov, focus: HERO.focus },
    { f: at(7) + 16, ...POP, hold: true },
    // held while he peeks into his pail, then off with him
    // (not a hold: the camera is already easing toward the truck's side as he sets off)
    { f: at(8, 1), pos: [POP.pos[0] + 0.04, POP.pos[1] + 0.01, POP.pos[2] - 0.06], look: POP.look, fov: POP.fov, focus: POP.focus },
  ];
  // the truck: valley walk, graveyard; the peek (the camera draws back and widens as the ghost
  // comes down, so both share the frame for the shoo), on to the gates
  // (the peek framing reached as the ghost starts down, then held through the lowering and the
  // stare until the ember flick: film/beats.ts ghostLowerAt)
  for (const f of truckFrames(at(8, 2) + 6, at(10, 1), BEAT)) keys.push(truckKey(f, 1.6, 0.42, 34, 0.3));
  keys.push({ ...peekKey(at(10, 3), 2.35, 0.48, 40, 0.45, 52) });
  keys.push({ ...peekKey(at(11, 2), 2.3, 0.45, 40, 1, 66), hold: true });
  // up the slope: from the peek's side the camera swings round behind him to his left and draws
  // back and up as he climbs away from it, so the mist parts on the whole gateway ahead of him and
  // the lit cottage comes into view beyond, right of the gates
  const c0 = at(11, 3) + 18;
  const c1 = at(14);
  for (const f of truckFrames(c0, c1 - BEAT, BEAT)) {
    const u = smoothstep(c0 - 12, c1, f);
    const c = smoothed(f);
    const near: V3 = [c[0] + 1.4, 0, c[2] + 1.05];
    const x = lerp(near[0], GATE_CAM.pos[0], u);
    const z = lerp(near[2], GATE_CAM.pos[2], u);
    const up = lerp(1.0, GATE_CAM.up, u);
    const pos = clear([x, FLOOR + groundHeight(x, z) + up, z], f);
    const [lx, lz] = tangentNear(c);
    const ahead: V3 = add(c, [lx * 0.55, 0.12, lz * 0.55]);
    const look: V3 = [lerp(ahead[0], GATE_CAM.look[0], u * u), lerp(ahead[1], GATE_CAM.look[1], u * u), lerp(ahead[2], GATE_CAM.look[2], u * u)];
    keys.push({ f, pos, look, fov: lerp(34, GATE_CAM.fov, u), focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) });
  }
  // while he waits: Clawd small in the gateway as it creaks open, a lamp either side of it, the
  // lit cottage beyond in the right third (caption 2: the last house was still awake)
  {
    const { x, z } = { x: GATE_CAM.pos[0], z: GATE_CAM.pos[2] };
    const pos: V3 = [x, FLOOR + groundHeight(x, z) + GATE_CAM.up, z];
    keys.push({ f: c1, pos, look: GATE_CAM.look, fov: GATE_CAM.fov, focus: Math.hypot(pos[0] - GATE_CAM.look[0], pos[1] - GATE_CAM.look[1], pos[2] - GATE_CAM.look[2]), hold: true });
  }
  // on the clang it rises over the fence (never through the gateway: the swung leaves would
  // brush the lens) and moves steadily along the graveyard's side of the fence, above it, as he
  // walks the lane behind it; past the fence's end it comes down into the yard onto V1's door
  // two-shot without a whip
  keys.push(placeKey(at(15), 1.2, 1.2, 1.7, 40, 0.7, 0.4));
  // (back from his path, aimed just ahead of him: he walks across the frame's middle, not under
  // the lens and out at its bottom-left corner, and the swung right leaf stays well off the lens)
  keys.push(placeKey(at(15, 2), 1.9, 0.75, 1.5, 38, 0.3, 0.3));
  // (looking just ahead of him, not at the door: he stays in frame as he nears it)
  keys.push(placeKey(at(16), 2.6, 0.55, 1.3, 38, 0.25, 0.2));
  keys.push(placeKey(at(16, 2), 3.25, 0.45, 0.95, 37, 0.35, 0.25));
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
  // (aimed a little low: the card sits higher in the frame and Clawd's eyes clear the bottom edge)
  { f: at(25) + BEAT, pos: [-0.05, V1F + 1.1, 3.41], look: [-0.05, V1F + 1.03, -0.15], fov: 30, focus: 3.56, hold: true },
  { f: at(29), pos: [-0.03, V1F + 1.11, 3.37], look: [-0.05, V1F + 1.03, -0.15], fov: 30, focus: 3.52, hold: true },
  { f: at(30), pos: [0.7, V1F + 0.7, 4.6], look: [-0.15, V1F + 1.3, -1.0], fov: 36, focus: 5.0, hold: true },
  { f: at(31, 3), pos: [0.68, V1F + 0.7, 4.5], look: [-0.15, V1F + 1.3, -1.0], fov: 36, focus: 5.0, hold: true },
  { f: at(32), pos: [0.85, V1F + 0.5, 2.6], look: [0.8, V1F + 0.45, 0.4], fov: 30, focus: 2.2, hold: true },
  { f: at(33), pos: [0.9, V1F + 0.55, 2.7], look: [0.9, V1F + 0.5, 0.4], fov: 30, focus: 2.3, hold: true },
];

/** the door spread's last hold (V1's at(33) key, carried onto the house): the pull-out starts from it */
const DOOR_LAST: K = (() => {
  const k = V1_DOOR[V1_DOOR.length - 1];
  return { pos: fromV1Door(k.pos), look: fromV1Door(k.look), fov: k.fov, focus: k.focus * DOOR_SCALE };
})();

function doorKeys(): CamKey[] {
  return V1_DOOR.map((k) => ({ f: k.f, pos: fromV1Door(k.pos), look: fromV1Door(k.look), fov: k.fov, focus: k.focus * DOOR_SCALE, ...(k.hold ? { hold: true } : {}) }));
}

/**
 * Out of the book (no cut): from the door's last hold the camera trucks right alongside Clawd as
 * he trots off (the far window flips cold behind him), clear of the ghost tree on its right; then
 * it pulls straight back and up out of the story onto the desk, mostly along its own line of sight
 * (the world shrinks away rather than sliding across the frame); the immersion fades as it goes
 * (film/beats.ts immersionAt: the dome, the fog and the foot band go and the room comes back).
 * Its first frame, and the slam.
 */
export const OUT_OF_BOOK: readonly [number, number] = [at(33) + 6, at(35)];
/** The cover comes down from the score's close riffle on at(34, 2) to the slam on 'book-slam' (film/beats.ts coverAt). */
export const COVER_CLOSE: readonly [number, number] = [at(34, 2), at(35)];
/**
 * The crane out of the book. The camera leads Clawd as he trots off toward it, rises and pulls
 * back past the ghost tree's far side (the tree stays out of the lens's way), and arrives on the
 * desk well back, where the whole open book shows with its cover still standing behind the world.
 * From there the cover is seen swinging down (film/beats.ts coverAt: from the riffle on at(34, 2),
 * accelerating into the slam) while the world folds flat under it. After the slam the camera eases
 * in on the closed book for the end card.
 */
const SLAM_WIDE: K = { pos: [14.4, 11.6, 16.4], look: [0.4, 3.4, -0.3], fov: 38, focus: 23.3 };
/** where the camera has crept in to by the slam (tilted down with the falling cover, so the shut book's title sits clear above the end card's words) */
const SLAM: K = { pos: [13.9, 11.3, 15.9], look: [0.4, 1.55, -0.25], fov: 38, focus: 22.5 };
/** the end card: the closed book nearer, its title in the frame's middle, above the end card's words */
const END: K = { pos: [8.4, 12.2, 18.6], look: [0.2, 0.95, -0.2], fov: 34, focus: 21.2 };

/**
 * The pull-out's shape (outKeys): from the door's last hold it orbits up round Clawd to his right
 * (ORBIT: the ghost tree's low limbs reach to x 5.4 only, so the camera leaves on its right) and
 * then backs away along a line toward SLAM_WIDE, its distance from what it looks at growing by a
 * steady factor each frame (the world shrinks evenly instead of sliding across the frame), its aim
 * moving from Clawd onto the book late, when everything is far away.
 */
const ORBIT = { az: (25 * Math.PI) / 180, el: (26 * Math.PI) / 180, d: 2.6 };
const RISE = (24 * Math.PI) / 180;
function outKeys(): CamKey[] {
  const f0 = at(33);
  const f1 = COVER_CLOSE[0] + 10;
  const start = DOOR_LAST;
  const sw = SLAM_WIDE.pos;
  const swl = SLAM_WIDE.look;
  const d1 = Math.hypot(sw[0] - swl[0], sw[1] - swl[1], sw[2] - swl[2]);
  const dir1: V3 = [(sw[0] - swl[0]) / d1, (sw[1] - swl[1]) / d1, (sw[2] - swl[2]) / d1];
  const az1 = Math.atan2(dir1[2], dir1[0]);
  const el1 = Math.asin(dir1[1]);
  const keys: CamKey[] = [];
  for (let f = f0 + 4; f < f1; f += 3) {
    const t = (f - f0) / (f1 - f0);
    const c = smoothed(f, 6);
    const aim: V3 = [c[0], c[1] + 0.22, c[2]];
    // 0..1: the orbit (the first third), then the back-away
    const o = smoothstep(0, 0.6, t);
    const b = smoothstep(0.2, 1, t);
    const w = smoothstep(0.68, 1, t);
    // from the door's aim onto Clawd, then onto the book
    const a = smoothstep(0, 0.3, t);
    const on: V3 = [lerp(start.look[0], aim[0], a), lerp(start.look[1], aim[1], a), lerp(start.look[2], aim[2], a)];
    const look: V3 = [lerp(on[0], swl[0], w), lerp(on[1], swl[1], w), lerp(on[2], swl[2], w)];
    // the start's own offset from Clawd, orbited round to ORBIT, then toward SLAM_WIDE's
    const s0: V3 = [start.pos[0] - on[0], start.pos[1] - on[1], start.pos[2] - on[2]];
    const d0 = Math.hypot(...s0);
    const az0 = Math.atan2(s0[2], s0[0]);
    const el0 = Math.asin(s0[1] / d0);
    const az = lerp(lerp(az0, ORBIT.az, o), az1, b);
    // rising over the ghost tree on the way (it stands between the house and the desk view): seen from above, not trunk-on
    const el = lerp(lerp(el0, ORBIT.el, o), el1, b) + RISE * Math.sin(Math.PI * b);
    const d = lerp(d0, ORBIT.d, o) * (d1 / ORBIT.d) ** b;
    const pos: V3 = [look[0] + Math.cos(el) * Math.cos(az) * d, look[1] + Math.sin(el) * d, look[2] + Math.cos(el) * Math.sin(az) * d];
    keys.push({ f, pos, look, fov: lerp(start.fov, SLAM_WIDE.fov, smoothstep(0.1, 0.9, t)), focus: d });
  }
  return [...keys, { f: f1, ...SLAM_WIDE, hold: true }, { f: OUT_OF_BOOK[1], ...SLAM, hold: true }];
}

/** One path from the desk at the start to the desk at the end: no cut anywhere. */
const JOURNEY = new CamPath([
  ...worldKeys(),
  ...doorKeys(),
  ...outKeys(),
  // on the desk for the end card: easing in on the closed book
  { f: FILM_FRAMES, ...END, hold: true },
]);

export function journeyAt(f: number): CamPose {
  return JOURNEY.at(f);
}
