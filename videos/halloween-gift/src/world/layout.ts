/**
 * The world's map: one continuous storybook diorama standing on the open book's first page.
 * Every landmark's place, the one path Clawd hops along, the ground's height everywhere and the
 * last house's local frame live here, so the terrain, the props, the blocking, the camera and the
 * DOM overlay all agree. Pure data and pure functions of position.
 *
 * Coordinates: world units; the page's centre is x = z = 0 at height FLOOR; +x to the right, +z
 * toward the viewer at the front edge, the spine (and the standing cover, the sky) at the back.
 * Every shot looks roughly toward −z: beyond the other edges of the page is the room, not the sky.
 *
 * The plan, front to back: the fenced graveyard fills the front half (the giant pumpkin at its
 * front left, the ghost tree at its right); the gates are its exit on the right; beyond them a
 * lantern lane climbs the hill to the last house; the castle's crag and the far house stand at the
 * back against the sky. The door spread's camera stands in the gateway, looking up the lane.
 *
 * Walk budget (audio/timeline.ts WALKS, one hop per beat, ≤ 0.55 units a hop): 3 + 5 + 5 + 8 hops
 * from the pop-up spot to the door ≈ 7.2 units of path (small hops, 0.3–0.45); screen directions as the score pans them:
 * valley and graveyard left → right (+x), the lane receding (−z) to the door, the exit rightward.
 */
import { smoothstep } from '@aiv/core';
import { Matrix4, Vector3 } from 'three';
import { bump, fbm2 } from '../kit/field.ts';
import { Curve, distanceToPolyline, type P2 } from '../kit/spline.ts';

/** The book, closed: 16 wide (x), 11 deep (z), 1.5 thick; open, the page top is the stage floor. */
export const BOOK = { w: 16, d: 11, t: 1.5 } as const;
export const FLOOR = BOOK.t;
/** the printed page the world grows from (inside the page margins) */
export const PAGE = { w: BOOK.w - 0.5, d: BOOK.d - 0.4 } as const;

/** Clawd's path across the page (x, z), from beside the giant pumpkin to the last house's door. */
export const PATH_POINTS: P2[] = [
  [-1.05, 3.05],
  [-0.55, 2.85],
  [0.05, 2.62],
  [0.75, 2.32],
  [1.35, 2.0],
  [1.95, 1.55],
  [2.45, 1.05],
  [3.0, 0.15],
  [3.65, -0.75],
  [4.1, -1.45],
];
export const PATH = new Curve(PATH_POINTS);
const PATH_LINE = PATH.polyline(200);

/** Arc lengths (along PATH) where each walk stops: the pop-up spot, the ghost tree, the gates, the door. */
export const STOPS = {
  pop: 0,
  valleyEnd: 0.9,
  shoo: 3.1,
  gates: 4.4,
  knock: PATH.length,
} as const;

/** A point on the path (x, z) at arc length s. */
export function pathXZ(s: number): [number, number] {
  const p = PATH.pointAt(s);
  return [p[0], p[1]];
}
/** The path's heading at arc length s: the yaw that faces along it (0 faces +z). */
export function pathYaw(s: number): number {
  const t = PATH.tangentAt(s);
  return Math.atan2(t[0], t[1]);
}

// ---- landmarks ---------------------------------------------------------------------------------

export interface Spot {
  x: number;
  z: number;
  /** turn about y, radians (0 faces +z, the viewer) */
  yaw?: number;
  scale?: number;
}

const at = (s: number, side = 0, ahead = 0): Spot => {
  const [x, z] = pathXZ(s + ahead);
  const t = PATH.tangentAt(s);
  // side > 0 is to the path's right (walking along it)
  return { x: x - t[1] * side, z: z + t[0] * side, yaw: pathYaw(s) };
};

const gate = at(STOPS.gates, 0, 0.32);
const door = at(STOPS.knock, 0, 0);

export const LAND = {
  /** the giant jack-o'-lantern, front left of the hero view, its grin to the path */
  bigPumpkin: { x: -1.55, z: 2.75, yaw: 0.5, scale: 1 } as Spot,
  /** the big leaning cross stone at the far left edge */
  bigCross: { x: -2.35, z: 3.75, yaw: 0.35, scale: 1 } as Spot,
  /** roots and rocks with cobwebs, front right */
  roots: { x: 2.55, z: 4.35, yaw: -0.4 } as Spot,
  /** the ghost tree, front right: its hero limb arches left over the path at the shoo stop */
  ghostTree: { x: 4.3, z: 2.9, yaw: 0 } as Spot,
  /** where the hero limb's ghosts hang (above the path at the shoo stop) */
  ghosts: at(STOPS.shoo, 0.1, 0.1),
  /** a second gnarled tree inside the fence, back left */
  oldTree: { x: -2.9, z: 1.25, yaw: 0.8 } as Spot,
  /** the gates where the path leaves the graveyard, opening onto the lane */
  gates: gate,
  /** the big RIP IN PEACE stone and the cauldron beside the path, before the gates */
  ripStone: at(3.35, -0.6),
  cauldron: at(3.0, 0.65),
  /** the last house, right of centre: its door at the path's end, turned a little toward the lane */
  house: { x: door.x + 0.2, z: door.z - 0.6, yaw: -0.3 } as Spot,
  /** the castle on its crag, behind the hill between the gates and the house (multiplane) */
  crag: { x: 3.0, z: -4.7 } as Spot,
  /** the far house at the crag's foot */
  farHouse: { x: 0.6, z: -4.25, yaw: 0.35 } as Spot,
  /** a far window down the hill that flips cold at the end (seen past Clawd's exit, right) */
  farWindow: { x: 6.1, z: -3.6, yaw: -0.5 } as Spot,
} as const;

/** The fence along the hill above the graveyard (x, z); the gates' opening is left out around LAND.gates. */
export const FENCE_LINE: P2[] = [
  [-7.3, 2.1],
  [-5.3, 1.55],
  [-3.1, 1.2],
  [-0.9, 1.15],
  [1.1, 1.25],
  [gate.x - 0.62, gate.z + 0.12],
];
/** Right of the gates the fence turns back along the lane's left side, leaving the garden open. */
export const FENCE_LINE_RIGHT: P2[] = [
  [gate.x + 0.6, gate.z - 0.1],
  [3.35, 0.55],
  [3.7, 1.6],
  [3.6, 2.4],
];

/** Tombstones inside the fence: kind, place, height, lean. The big RIP stone is LAND.ripStone. */
export const STONES: { kind: 'round' | 'cross' | 'obelisk' | 'gothic' | 'slab' | 'broken'; x: number; z: number; h: number; yaw: number; lean: number }[] = [
  { kind: 'round', x: -0.4, z: 2.0, h: 0.5, yaw: 0.2, lean: -0.12 },
  { kind: 'cross', x: 0.4, z: 1.65, h: 0.66, yaw: -0.1, lean: 0.1 },
  { kind: 'slab', x: 0.6, z: 3.35, h: 0.38, yaw: 0.4, lean: 0.18 },
  { kind: 'gothic', x: -1.0, z: 1.55, h: 0.6, yaw: 0.05, lean: -0.06 },
  { kind: 'round', x: 1.7, z: 2.75, h: 0.46, yaw: -0.3, lean: 0.14 },
  { kind: 'obelisk', x: -2.2, z: 1.7, h: 0.92, yaw: 0.3, lean: -0.05 },
  { kind: 'broken', x: 1.15, z: 1.45, h: 0.34, yaw: 0.6, lean: -0.2 },
  { kind: 'round', x: -3.6, z: 2.3, h: 0.58, yaw: -0.2, lean: 0.08 },
  { kind: 'cross', x: -1.6, z: 2.3, h: 0.56, yaw: 0.25, lean: -0.15 },
  { kind: 'round', x: 2.6, z: 2.5, h: 0.44, yaw: -0.5, lean: 0.1 },
  { kind: 'gothic', x: -2.8, z: 2.9, h: 0.52, yaw: -0.15, lean: 0.07 },
  { kind: 'slab', x: -0.2, z: 3.7, h: 0.34, yaw: -0.3, lean: -0.12 },
];

/** Lamp posts with cyan glass along the lane, and small pumpkins stacked by it. */
export const LAMPS: Spot[] = [at(4.3, 0.6), at(5.6, -0.55), at(6.8, 0.55)];
export const SMALL_PUMPKINS: (Spot & { lit: boolean })[] = [
  { ...at(4.9, 0.55), scale: 0.26, lit: true },
  { ...at(5.0, 0.8), scale: 0.21, lit: true },
  { ...at(4.95, 0.68), scale: 0.17, lit: false },
  { ...at(6.1, -0.55), scale: 0.2, lit: true },
  { ...at(6.9, -0.7), scale: 0.22, lit: true },
];

// ---- the ground ---------------------------------------------------------------------------------

/** 0 at the page margin, 1 a little inside it: the world grows out of the printed page. */
export function pageMask(x: number, z: number): number {
  const ex = PAGE.w / 2 - Math.abs(x);
  const ez = PAGE.d / 2 - Math.abs(z);
  return smoothstep(0, 1.1, Math.min(ex, ez));
}

/** Distance from (x, z) to the path's centre line, and the arc length there. */
export function pathDistance(x: number, z: number): { d: number; s: number } {
  return distanceToPolyline(x, z, PATH_LINE);
}

/** The path's half width (it widens a little at the gates and the door). */
export function pathHalfWidth(s: number): number {
  return 0.3 + 0.08 * bump(s, 0, STOPS.gates + 0.3, 0, 0.9) + 0.14 * bump(s, 0, PATH.length, 0, 1.2);
}

/** The ground's height above FLOOR (before the path): the hill, mounds, lumps. */
function rawHeight(x: number, z: number): number {
  // the hill: from the graveyard's floor up to the house's crest at the back
  const hill = 0.05 + 0.75 * smoothstep(1.4, -3.4, z) + 0.2 * bump(x, z, LAND.house.x, LAND.house.z, 2.6);
  // the crag's foot rises at the back left; the foreground corners swell into the dark frame
  const back = 0.35 * bump(x, z, LAND.crag.x, LAND.crag.z + 0.4, 2.8);
  const mounds = 0.2 * bump(x, z, LAND.ghostTree.x, LAND.ghostTree.z, 1.5) + 0.2 * bump(x, z, -5.0, 3.7, 2.3) + 0.26 * bump(x, z, 5.8, 3.9, 2.4) - 0.06 * bump(x, z, -0.6, 2.2, 1.8);
  const lumps = 0.055 * fbm2(x, z, 31, 4, 0.55) + 0.018 * fbm2(x, z, 32, 3, 2.4);
  return hill + back + mounds + lumps;
}

/** Ground height above FLOOR at (x, z): path carved in, the page margin flattened to the paper. */
export function groundHeight(x: number, z: number): number {
  const h = rawHeight(x, z);
  const { d, s } = pathDistance(x, z);
  const w = pathHalfWidth(s);
  const p = PATH.pointAt(s);
  const along = rawHeight(p[0], p[1]) - 0.03;
  const t = smoothstep(w * 1.7, w * 0.7, d);
  return (h * (1 - t) + along * t) * pageMask(x, z);
}

/** How much a point is path (1 on it, 0 off): dirt and cobbles, no grass. */
export function pathMask(x: number, z: number): number {
  const { d, s } = pathDistance(x, z);
  return smoothstep(pathHalfWidth(s) * 1.25, pathHalfWidth(s) * 0.75, d);
}

/** A world point standing on the ground (x, FLOOR + height, z). */
export function onGround(x: number, z: number, lift = 0): [number, number, number] {
  return [x, FLOOR + groundHeight(x, z) + lift, z];
}

// ---- the last house's local frame -------------------------------------------------------------

/**
 * V1 blocked the door spread (bars 17–34) around a door at x −0.25 on a house front at z −1.5,
 * on a floor at y 1.2. This frame carries V1's local coordinates onto the last house's door, so
 * the approved blocking and camera keys of the door beats keep their framing.
 */
export const V1_ORIGIN = new Vector3(-0.25, 1.2, -1.5);

export function houseFrame(): Matrix4 {
  const h = LAND.house;
  const yaw = h.yaw ?? 0;
  // the door stands 0.62 in front of the house's centre, along its facing
  const dx = h.x + Math.sin(yaw) * 0.62;
  const dz = h.z + Math.cos(yaw) * 0.62;
  const y = FLOOR + groundHeight(dx + Math.sin(yaw) * 0.6, dz + Math.cos(yaw) * 0.6);
  return new Matrix4().makeRotationY(yaw).setPosition(dx, y, dz);
}
const HF = houseFrame();

/** A V1 door-spread point in today's world. */
export function fromV1Door(p: readonly [number, number, number]): [number, number, number] {
  const v = new Vector3(p[0], p[1], p[2]).sub(V1_ORIGIN).applyMatrix4(HF);
  return [v.x, v.y, v.z];
}

/** The floor height at the house's door, where the door spread's actors stand. */
export const DOOR_FLOOR = HF.elements[13];
