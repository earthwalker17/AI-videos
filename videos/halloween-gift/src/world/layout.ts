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
 * The plan, front to back, as in the reference: the graveyard fills the front and the slope (the
 * giant pumpkin at its front left, the ghost tree at its right edge); the path winds right along
 * the front, under the ghost tree's hero limb, then turns back up the slope to the tall gates,
 * centre left on the fence that runs across the hill; beyond them a lantern lane runs right
 * behind the fence to the last house, right of centre; the castle's crag and the far house stand
 * at the back against the sky.
 *
 * Walk budget (audio/timeline.ts WALKS, one hop per beat, at most 0.55 units a hop): 3 + 5 + 5 + 8
 * hops from the pop-up spot to the door, so at most about 1.2 + 2.24 + 2.38 + 3.68 units of path
 * for the four walks (film/blocking.test.ts checks every hop).
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
  [-0.45, 2.86],
  [0.2, 2.6],
  [0.82, 2.22],
  // the shoo (STOPS.shoo), under the ghost tree's hero limb; then up the slope
  [1.22, 1.72],
  [1.32, 1.22],
  [1.22, 0.55],
  [1.08, -0.15],
  // the gates
  [1.0, -0.85],
  // the lantern lane, behind the fence, to the door
  [1.58, -1.1],
  [2.5, -1.22],
  [3.42, -1.16],
  [4.1, -1.45],
];
export const PATH = new Curve(PATH_POINTS);
const PATH_LINE = PATH.polyline(400);
/** the arc length on PATH nearest a point */
const sAt = (x: number, z: number) => distanceToPolyline(x, z, PATH_LINE).s;
/** the gate's centre is this far past the gates stop, where Clawd waits for it to open */
const GATE_AHEAD = 0.32;

/** Arc lengths (along PATH) where each walk stops: the pop-up spot, the ghost tree, the gates, the door. */
export const STOPS = {
  pop: 0,
  valleyEnd: 0.9,
  shoo: 2.75,
  gates: sAt(1.0, -0.85) - GATE_AHEAD,
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

const gate = at(STOPS.gates, 0, GATE_AHEAD);
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
  /** the ghosts' line: world/Trees.tsx builds the hero limb along it, from here toward the trunk */
  ghosts: { x: 1.87, z: 1.74 } as Spot,
  /**
   * the ghost that lowers to peek at Clawd (bars 10 to 11): the ground point under the
   * world/Trees.tsx GHOST_HOOKS hook nearest the shoo stop (layout may not import the trees; a
   * test checks they agree)
   */
  peek: { x: 1.513, z: 1.556 } as Spot,
  /** a second gnarled tree behind the fence, back left, its twisted trunk clear against the haze */
  oldTree: { x: -1.9, z: -1.5, yaw: 0.8 } as Spot,
  /** the gates where the path leaves the graveyard, opening onto the lane */
  gates: gate,
  /** the cauldron under the ghosts, right of the shoo stop, and the big RIP IN PEACE stone beside it */
  cauldron: { x: 1.98, z: 1.72, yaw: -0.3 } as Spot,
  ripStone: { x: 2.72, z: 1.22, yaw: -0.45 } as Spot,
  /** the last house, right of centre: its door at the path's end, turned a little toward the lane */
  house: { x: door.x + 0.2, z: door.z - 0.6, yaw: -0.3 } as Spot,
  /** the castle on its crag, behind the hill between the gates and the house (multiplane) */
  crag: { x: 3.0, z: -4.7 } as Spot,
  /** the far house at the crag's foot, right of the gates as the hero view sees them */
  farHouse: { x: 1.9, z: -4.4, yaw: 0.35 } as Spot,
  /** a far window down the hill that flips cold at the end (seen past Clawd's exit, right) */
  farWindow: { x: 6.1, z: -3.6, yaw: -0.5 } as Spot,
} as const;

/** The gateway's posts, either side of the gate across the path: [left, right] walking through. */
const GATE_HALF = 0.42;
export const GATE_POSTS: readonly [P2, P2] = (() => {
  const t = PATH.tangentAt(STOPS.gates + GATE_AHEAD);
  // the path's left, walking along it
  const lx = t[1];
  const lz = -t[0];
  return [
    [gate.x + lx * GATE_HALF, gate.z + lz * GATE_HALF],
    [gate.x - lx * GATE_HALF, gate.z - lz * GATE_HALF],
  ];
})();

/**
 * The fence across the slope behind the graves (x, z), from off the left of the hero view to the
 * gateway's left post, bowing toward the viewer at the far left as in the reference.
 */
export const FENCE_LINE: P2[] = [[-7.3, 0.95], [-6.0, 0.25], [-4.4, -0.35], [-2.6, -0.78], [-0.9, -0.98], GATE_POSTS[0]];
/**
 * Right of the gates the fence runs a short way in front of the lane and stops well short of the
 * last house: the ground in front of the door is the door yard where the door spread's cameras
 * stand (V1's door keys at DOOR_SCALE sit 2.2 to 3 in front of the door, around x 3.5 to 4.3).
 */
export const FENCE_LINE_RIGHT: P2[] = [GATE_POSTS[1], [2.0, -0.6], [2.65, -0.72]];

/** Tombstones inside the fence: kind, place, height, lean. The big RIP stone is LAND.ripStone. */
export const STONES: { kind: 'round' | 'cross' | 'obelisk' | 'gothic' | 'slab' | 'broken'; x: number; z: number; h: number; yaw: number; lean: number }[] = [
  // the front, along the path's first run
  { kind: 'round', x: -0.4, z: 2.0, h: 0.5, yaw: 0.2, lean: -0.12 },
  { kind: 'cross', x: 0.4, z: 1.65, h: 0.66, yaw: -0.1, lean: 0.1 },
  { kind: 'slab', x: 0.6, z: 3.35, h: 0.38, yaw: 0.4, lean: 0.18 },
  { kind: 'gothic', x: -1.0, z: 1.55, h: 0.6, yaw: 0.05, lean: -0.06 },
  { kind: 'round', x: 1.7, z: 2.75, h: 0.46, yaw: -0.3, lean: 0.14 },
  { kind: 'obelisk', x: -2.2, z: 1.7, h: 0.92, yaw: 0.3, lean: -0.05 },
  { kind: 'round', x: -3.6, z: 2.3, h: 0.58, yaw: -0.2, lean: 0.08 },
  { kind: 'cross', x: -1.6, z: 2.3, h: 0.56, yaw: 0.25, lean: -0.15 },
  { kind: 'round', x: 3.0, z: 2.05, h: 0.44, yaw: -0.5, lean: 0.1 },
  { kind: 'gothic', x: -2.8, z: 2.9, h: 0.52, yaw: -0.15, lean: 0.07 },
  { kind: 'slab', x: -0.2, z: 3.7, h: 0.34, yaw: -0.3, lean: -0.12 },
  // the slope, either side of the path up to the gates, in front of the fence
  { kind: 'broken', x: 2.05, z: 0.9, h: 0.34, yaw: 0.6, lean: -0.2 },
  { kind: 'round', x: 0.2, z: 0.55, h: 0.48, yaw: 0.15, lean: 0.1 },
  { kind: 'gothic', x: -0.7, z: 0.15, h: 0.55, yaw: -0.1, lean: -0.08 },
  { kind: 'cross', x: 0.42, z: -0.42, h: 0.6, yaw: 0.2, lean: 0.12 },
  { kind: 'round', x: -1.65, z: 0.65, h: 0.45, yaw: 0.3, lean: -0.14 },
  { kind: 'slab', x: 1.95, z: 0.05, h: 0.36, yaw: -0.25, lean: 0.16 },
  { kind: 'round', x: 2.35, z: -0.3, h: 0.42, yaw: -0.4, lean: -0.1 },
  { kind: 'broken', x: -0.25, z: -0.55, h: 0.3, yaw: 0.5, lean: 0.18 },
  { kind: 'cross', x: -2.6, z: 0.15, h: 0.62, yaw: 0.1, lean: -0.1 },
  { kind: 'round', x: -3.5, z: 0.85, h: 0.5, yaw: -0.25, lean: 0.12 },
  { kind: 'gothic', x: 2.75, z: 0.55, h: 0.5, yaw: -0.35, lean: 0.06 },
];

/** Lamp posts with cyan glass by the gates and along the lane, and small pumpkins stacked by the gates. */
const G = STOPS.gates + GATE_AHEAD;
export const LAMPS: Spot[] = [at(G - 0.45, -0.62), at(G + 1.15, 0.5), at(G + 2.3, -0.5), at(G + 3.15, 0.5)];
export const SMALL_PUMPKINS: (Spot & { lit: boolean })[] = [
  { ...at(G - 0.25, 0.75), scale: 0.26, lit: true },
  { ...at(G - 0.2, 0.98), scale: 0.21, lit: true },
  { ...at(G - 0.24, 0.86), scale: 0.17, lit: false },
  { ...at(G + 1.9, 0.45), scale: 0.2, lit: true },
  { ...at(G + 2.85, -0.5), scale: 0.22, lit: true },
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
  return 0.3 + 0.08 * bump(s, 0, STOPS.gates + GATE_AHEAD, 0, 0.9) + 0.14 * bump(s, 0, PATH.length, 0, 1.2);
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
 * on a floor at y 1.2, at a scale where the door is 2.35 tall and Clawd's body 0.65 × 0.40. This
 * frame carries V1's local coordinates onto the last house's door, scaled by DOOR_SCALE: the
 * door, the neighbour, the letter, the porch, Clawd (the same size all through the film) and
 * V1's door cameras all scale together about the door, so every approved door shot frames the
 * same picture (similar triangles); only world-unit effects (focus distance, fog, light
 * falloff) take the factor. Why 0.5: at V1's scale the cottage would fill three quarters of the
 * hero view, where the reference's cottage is a quarter of the frame on the hill.
 */
export const V1_ORIGIN = new Vector3(-0.25, 1.2, -1.5);
/** V1 world units → today's (the door spread and Clawd); see houseFrame */
export const DOOR_SCALE = 0.5;

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

/** A V1 door-spread point in today's world (scaled about V1's door by DOOR_SCALE). */
export function fromV1Door(p: readonly [number, number, number]): [number, number, number] {
  const v = new Vector3(p[0], p[1], p[2]).sub(V1_ORIGIN).multiplyScalar(DOOR_SCALE).applyMatrix4(HF);
  return [v.x, v.y, v.z];
}

/** A house-local point (x along the front, y up from the door's floor, z out of the front) in the world. */
export function fromHouse(p: readonly [number, number, number]): [number, number, number] {
  const v = new Vector3(p[0], p[1], p[2]).applyMatrix4(HF);
  return [v.x, v.y, v.z];
}

/**
 * The door front in house-local units (V1's door spread × DOOR_SCALE): the door opening, the
 * couplets either side, the 横批 above, the lanterns under the porch eave, the porch pumpkins,
 * the room behind, where Clawd knocks and waits and where the letter rises.
 */
export const DOOR_FRONT = {
  door: { w: 1.3 * DOOR_SCALE, h: 2.35 * DOOR_SCALE },
  couplet: { x: (1.3 / 2 + 0.22) * DOOR_SCALE, y: 1.2 * DOOR_SCALE, w: 0.26 * DOOR_SCALE, h: 1.85 * DOOR_SCALE },
  hengpi: { y: (2.35 + 0.24) * DOOR_SCALE, w: 1.05 * DOOR_SCALE, h: 0.26 * DOOR_SCALE },
  fu: { y: 2.35 * 0.58 * DOOR_SCALE, size: 0.46 * DOOR_SCALE },
  lanterns: [-1, 1].map((sx) => [sx * 1.15 * DOOR_SCALE, 2.55 * DOOR_SCALE, 0.45 * DOOR_SCALE] as const),
  porchPumpkins: [-1, 1].map((sx) => [sx * 1.0 * DOOR_SCALE, 0, 0.55 * DOOR_SCALE] as const),
  room: { z: -1.0 * DOOR_SCALE, w: 3.2 * DOOR_SCALE, h: 2.6 * DOOR_SCALE },
  /** the yard in front of the door the door beats need flat and clear (house-local x, z ranges) */
  yard: { x: [-1.6 * DOOR_SCALE, 2.4 * DOOR_SCALE] as const, z: [0, 3.2 * DOOR_SCALE] as const },
} as const;

/** The floor height at the house's door, where the door spread's actors stand. */
export const DOOR_FLOOR = HF.elements[13];

/** The hero view of the valley (bars 5–8): the reference's composition (camera pose, degrees, world units). */
export const HERO = { pos: [0.3, 3.45, 7.6] as [number, number, number], look: [1.0, 2.4, -4.0] as [number, number, number], fov: 44, focus: 7.0 };
