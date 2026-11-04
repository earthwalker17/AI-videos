/**
 * The world's trees, all placed from world/layout.ts:
 *  - the GHOST TREE (LAND.ghostTree, front right): one massive trunk twisting in S-curves, a few
 *    thick limbs that zig-zag at angular elbows and taper to points, sparse twigs; its hero limb
 *    leaves the trunk high, arches left over the moon (seen from the hero view) and steps down
 *    over the path above LAND.ghosts, where three ropes tie on at knobs, staggered in height
 *    (GHOST_HOOKS, read off the built skeleton's bark);
 *  - the OLD TREE (LAND.oldTree, at the fence on the left): a leaning S-trunk that forks into
 *    zig-zag leaders ending in points, two lidded knot holes that read faintly as sleepy eyes;
 *  - background dead trees along the back of the hill (BACK_TREES), never in front of the last
 *    house or the crag as seen from the hero view;
 *  - tall ragged conifers: a dark pine wall at the back left that leaves the hero frame's top,
 *    and a few at the far right (CONIFERS).
 * One bark material (storybook 'bark' with a seeded canvas furrow map along the wood) and one
 * needle material; four meshes (the background trees and the conifers merged). The geometry's
 * vertex alpha masks the moon rim: thin twigs and far trees stay dark silhouettes. No branch
 * crosses the moon's disc or the ghosts' drop as seen from the hero view. The finest twigs sway
 * a hair from the frame (the material's wind, driven by the film time).
 */
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, Matrix4, RepeatWrapping, SRGBColorSpace, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand } from '@aiv/core';
import { FPS } from '../cues.ts';
import { buildConifer, type ConiferParams } from '../kit/conifer.ts';
import { fbm2 } from '../kit/field.ts';
import { findTube, growTree, surfacePoint, treeGeometry, type TreeParams, type TreeSkeleton, type V3 } from '../kit/tree.ts';
import { NIGHT, storybookMaterial } from '../look/materials.ts';
import { MOON_RADIUS } from '../look/SkyPortal.tsx';
import { FLOOR, groundHeight, HERO, LAND } from './layout.ts';

// ---- placement --------------------------------------------------------------------------------

type GroundFn = (x: number, z: number) => number;

/** The ground's height in a tree's local frame (base at the origin, turned by yaw). */
function localGround(base: V3, yaw: number): GroundFn {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (lx, lz) => {
    const wx = base[0] + lx * c + lz * s;
    const wz = base[2] - lx * s + lz * c;
    return FLOOR + groundHeight(wx, wz) - base[1];
  };
}

/** A tree's base: the ground at its centre (the trunk starts below it and the roots grip it). */
function baseAt(x: number, z: number): V3 {
  return [x, FLOOR + groundHeight(x, z), z];
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * The hero view must see the moon clear: no twig in front of its disc (with a margin for the
 * glow). A test on a tree-local point of a tree based at `base`.
 */
function moonKeepOut(base: V3, margin = 1.9): (p: Vector3) => boolean {
  const cam = new Vector3(...HERO.pos);
  const moon = NIGHT.uSbMoonDir.value;
  const lim = Math.cos(MOON_RADIUS * margin);
  const q = new Vector3();
  return (p) => {
    q.set(p.x + base[0] - cam.x, p.y + base[1] - cam.y, p.z + base[2] - cam.z).normalize();
    return q.dot(moon) > lim;
  };
}

// ---- the ghost tree ---------------------------------------------------------------------------

export const GHOST_BASE = baseAt(LAND.ghostTree.x, LAND.ghostTree.z);

/** The ghosts' line: from LAND.ghosts toward the trunk (plan), and points on it (k along, y above FLOOR, side). */
const GHOST_U = (() => {
  const ux = GHOST_BASE[0] - LAND.ghosts.x;
  const uz = GHOST_BASE[2] - LAND.ghosts.z;
  const l = Math.hypot(ux, uz);
  return [ux / l, uz / l] as const;
})();
function ghostLine(k: number, y: number, side = 0): V3 {
  const [ux, uz] = GHOST_U;
  return [LAND.ghosts.x + ux * k - uz * side, FLOOR + y, LAND.ghosts.z + uz * k + ux * side];
}
const toGhostLocal = (w: V3): V3 => [w[0] - GHOST_BASE[0], w[1] - GHOST_BASE[1], w[2] - GHOST_BASE[2]];

/**
 * Where the three ropes tie on, along the ghosts' line (k from LAND.ghosts toward the trunk):
 * unevenly spaced (0.9, 1.46), each on a short level knob of the stepping limb; the first two
 * either side of the moon (in the hero view their hooks are at x ≈ 1713 and 1471, the moon at
 * 1628, as the reference's ghosts frame it, its disc left clear for the witch), the last LAND.peek's.
 */
const HOOK_K = [1.9, 1.0, -0.46] as const;

/**
 * The hero limb's elbows on the ghosts' line: [k, y above FLOOR, side]. The first is replaced by
 * the trunk's axis. Straight runs between them: up from the trunk, level over the moon, then down
 * in three runs of different slopes (the hooks sit on the second and third), and up to a point.
 */
const HERO_LIMB: V3[] = [
  [2.22, 3.1, 0],
  [1.74, 3.22, 0],
  [1.0, 3.3, 0.06],
  [0.56, 3.4, 0],
  [-0.06, 3.16, -0.05],
  [-0.62, 3.0, 0.03],
  [-0.88, 3.18, 0],
  [-0.97, 3.38, -0.02],
];

/** The limb axis's height above FLOOR on the ghosts' line at k (the polyline, without the corner rounding). */
function heroLimbY(k: number): number {
  for (let i = 0; i < HERO_LIMB.length - 1; i++) {
    const [ka, ya] = HERO_LIMB[i];
    const [kb, yb] = HERO_LIMB[i + 1];
    if ((k <= ka && k >= kb) || (k >= ka && k <= kb)) return ya + ((k - ka) / (kb - ka)) * (yb - ya);
  }
  return HERO_LIMB[HERO_LIMB.length - 1][1];
}

/** The ghosts' drop below the hooks (tree-local): no twig grows into it. */
function ghostKeepOut(): (p: Vector3) => boolean {
  // a column under each hook, up to the limb's axis there (spurs may rise from the limb's top)
  const drops = HOOK_K.map((k) => toGhostLocal(ghostLine(k, heroLimbY(k))));
  return (p) => {
    for (const d of drops) {
      if (Math.hypot(p.x - d[0], p.z - d[2]) < 0.34 && p.y < d[1] - 0.02 && p.y > -0.5) return true;
    }
    return false;
  };
}

function ghostParams(): Partial<TreeParams> & { seed: number } {
  const B = GHOST_BASE;
  const L = (k: number, y: number, side = 0) => toGhostLocal(ghostLine(k, y, side));
  const moon = moonKeepOut(B);
  const drop = ghostKeepOut();
  return {
    seed: 7,
    levels: 5,
    children: [0, 3, 2, 2],
    branchAngle: [30, 38, 46, 54],
    angleVariance: 14,
    lengthRatio: 0.55,
    lengthVariance: 0.3,
    trunkRadius: 0.42,
    trunkTip: 0.3,
    // one massive trunk: it keeps its girth high up, where the hero limb leaves
    trunkRadii: [1, 1, 0.94, 0.9, 0.86, 0.82, 0.76, 0.68, 0.58, 0.48, 0.38],
    trunkFlat: 0.8,
    taperCurve: 0.85,
    rootFlare: 0.55,
    flareFrac: 0.09,
    radiusExponent: 2.0,
    minRadius: 0.0045,
    tipRadius: 0.0036,
    minLength: 0.1,
    droop: 0.03,
    upPull: 0.16,
    gnarl: [0.06, 0.1, 0.14, 0.18, 0.22],
    curl: [0.3, 0.9, 1.7, 2.4, 3.0],
    curlShare: 0.25,
    kink: { every: 0.3, angle: 30, from: 2 },
    flat: 0.65,
    sectionLength: 0.06,
    trunkSection: 0.045,
    childStart: 0.25,
    detail: 70,
    pathGnarl: 0.22,
    bark: { furrows: 3.8, depth: 0.13, twist: 0.08, lumps: 0.08, burls: 0.14, wander: 0.45, minRadius: 0.05 },
    roots: { count: 8, length: 1.05, radius: 0.5, forks: 1 },
    stubs: { count: 3, length: 0.14, radius: 0.04 },
    ground: localGround(B, 0),
    keepOut: (p) => moon(p) || drop(p),
    trunkPath: [
      [0, -0.35, 0],
      [0.03, 0.15, 0],
      [-0.16, 0.7, 0.05],
      [-0.06, 1.2, 0.0],
      [-0.32, 1.7, -0.05],
      [-0.42, 2.15, -0.1],
      [-0.3, 2.6, -0.15],
      [-0.36, 3.1, -0.2],
      [-0.55, 3.6, -0.26],
      [-0.5, 4.1, -0.3],
      [-0.38, 4.5, -0.28],
    ],
    hero: [
      {
        // leaves the trunk high, rises and runs over the moon, then comes down toward the
        // ghosts' line in long straight runs broken at angular elbows; the ropes tie on at knobs
        // on the runs (each lower than the last), and the tip turns up into a point
        name: 'hero',
        at: 0.66,
        dir: [-1, 0, 0],
        length: 0,
        radius: 0.62,
        elbow: 0.06,
        flat: 0.66,
        flatTwist: 0.12,
        path: HERO_LIMB.map(([k, y, s]) => L(k, y, s)),
        radii: [1, 0.84, 0.7, 0.6, 0.5, 0.42, 0.26, 0.07],
        knobs: HOOK_K.map((k) => ({ at: L(k, heroLimbY(k)), r: 0.32, w: 0.07 })),
        // short gnarled spurs and broken stubs along it, rather than long branches (the frame's top is near)
        stubs: { count: 6, length: 0.1, radius: 0.42 },
        children: 8,
        childLength: 0.45,
        childRange: [0.06, 0.92],
      },
      {
        // the leader: up and left out of the frame's top, zig-zagging
        name: 'up',
        at: 0.8,
        dir: [0, 1, 0],
        length: 0,
        radius: 0.7,
        elbow: 0.09,
        flat: 0.7,
        path: [
          [0, 0, 0],
          [-0.42, 3.55, -0.42],
          [-0.52, 3.95, -0.62],
          [-0.88, 4.25, -0.75],
          [-0.98, 4.62, -0.7],
          [-1.3, 4.82, -0.62],
          [-1.42, 5.1, -0.55],
        ],
        radii: [1, 0.85, 0.7, 0.55, 0.42, 0.25, 0.08],
        childLength: 0.7,
      },
      {
        // off to the right edge, side-on to the close views (not end-on)
        name: 'right',
        at: 0.42,
        dir: [1, 0, 0],
        length: 0,
        radius: 0.5,
        elbow: 0.08,
        flat: 0.65,
        path: [
          [0, 0, 0],
          [0.42, 1.92, 0.18],
          [0.86, 2.12, 0.36],
          [1.12, 2.58, 0.44],
          [1.42, 2.72, 0.4],
          [1.52, 3.08, 0.32],
          [1.44, 3.3, 0.26],
        ],
        radii: [1, 0.82, 0.7, 0.55, 0.44, 0.28, 0.09],
        childLength: 0.6,
      },
      {
        // low over the path's right side: it frames the ghosts from below the moon
        name: 'low',
        at: 0.32,
        dir: [-1, 0, 1],
        length: 0,
        radius: 0.42,
        elbow: 0.07,
        flat: 0.62,
        path: [
          [0, 0, 0],
          [-0.46, 1.38, 0.24],
          [-0.82, 1.34, 0.46],
          [-1.04, 1.56, 0.58],
          [-1.36, 1.52, 0.66],
          [-1.62, 1.62, 0.66],
        ],
        radii: [1, 0.78, 0.64, 0.5, 0.32, 0.08],
        children: 2,
        childLength: 0.5,
      },
      {
        name: 'back',
        at: 0.72,
        dir: [-1, 0, -1],
        length: 0,
        radius: 0.42,
        elbow: 0.08,
        flat: 0.66,
        path: [
          [0, 0, 0],
          [-0.55, 3.05, -0.5],
          [-0.95, 3.18, -1.0],
          [-1.08, 3.5, -1.35],
          [-1.45, 3.62, -1.72],
          [-1.52, 3.92, -1.9],
        ],
        radii: [1, 0.8, 0.62, 0.46, 0.3, 0.08],
        childLength: 0.6,
      },
    ],
  };
}

// ---- the old tree -----------------------------------------------------------------------------

/** Where the old tree stands: LAND.oldTree (a lookdev may preview another spot). */
export interface Spot2 {
  x: number;
  z: number;
}

function oldParams(base: V3): Partial<TreeParams> & { seed: number } {
  return {
    seed: 12,
    levels: 5,
    children: [0, 4, 2, 2],
    branchAngle: [30, 38, 46, 54],
    angleVariance: 14,
    lengthRatio: 0.55,
    lengthVariance: 0.3,
    trunkRadius: 0.3,
    trunkTip: 0.1,
    trunkRadii: [1, 1, 0.9, 0.84, 0.76, 0.7, 0.46, 0.34, 0.22, 0.13, 0.05],
    trunkFlat: 0.82,
    trunkElbow: 0.09,
    // side branches up the leader (the trunk goes on as the left leader above the fork)
    trunkChildren: 4,
    trunkChildLength: 0.7,
    trunkChildRange: [0.55, 0.95],
    taperCurve: 0.9,
    rootFlare: 0.65,
    flareFrac: 0.08,
    radiusExponent: 2.0,
    minRadius: 0.005,
    tipRadius: 0.004,
    minLength: 0.1,
    droop: 0.03,
    upPull: 0.16,
    gnarl: [0.06, 0.1, 0.14, 0.18, 0.22],
    curl: [0.3, 1.0, 1.8, 2.4, 3.0],
    curlShare: 0.25,
    kink: { every: 0.3, angle: 32, from: 2 },
    flat: 0.65,
    sectionLength: 0.06,
    childStart: 0.25,
    detail: 70,
    pathGnarl: 0.25,
    bark: { furrows: 4.6, depth: 0.13, twist: 0.1, lumps: 0.08, burls: 0.14, wander: 0.45, minRadius: 0.05 },
    trunkSection: 0.025,
    // two lidded knot holes facing the path, clear of the trunk's bulge: an old tree, half asleep
    knots: [
      { at: 0.3, facing: [0.45, 0, 0.89], offset: -0.11, w: 0.19, h: 0.11, depth: 0.09, lid: 0.05, tilt: 0.25 },
      { at: 0.307, facing: [0.45, 0, 0.89], offset: 0.11, w: 0.19, h: 0.11, depth: 0.09, lid: 0.05, tilt: -0.25 },
    ],
    roots: { count: 7, length: 0.9, radius: 0.52, forks: 1 },
    stubs: { count: 5, length: 0.14, radius: 0.03 },
    ground: localGround(base, 0),
    keepOut: moonKeepOut(base),
    // the S-trunk leans right, forks at two-thirds and goes on as the left leader, zig-zagging
    // up to a point (no crook)
    trunkPath: [
      [0, -0.35, 0],
      [0.02, 0.25, 0],
      [0.24, 0.78, 0.03],
      [0.1, 1.25, 0.0],
      [0.42, 1.7, -0.05],
      [0.5, 2.0, -0.08],
      [0.22, 2.44, -0.12],
      [0.36, 2.8, -0.14],
      [0.06, 3.1, -0.16],
      [0.14, 3.42, -0.16],
      [-0.06, 3.64, -0.15],
    ],
    hero: [
      {
        // the right leader from the fork: up and right in elbows, toward the gates
        name: 'right',
        at: 0.55,
        dir: [1, 0, 0],
        length: 0,
        radius: 0.78,
        elbow: 0.08,
        flat: 0.68,
        path: [
          [0, 0, 0],
          [0.82, 2.32, -0.1],
          [1.02, 2.62, -0.16],
          [1.46, 2.72, -0.22],
          [1.62, 3.02, -0.2],
          [1.98, 3.1, -0.16],
          [2.1, 3.3, -0.14],
        ],
        radii: [1, 0.8, 0.68, 0.52, 0.4, 0.24, 0.08],
        childLength: 0.75,
      },
      {
        // a long low limb to the left, nearly level, kinking
        name: 'left',
        at: 0.36,
        dir: [-1, 0, 0],
        length: 0,
        radius: 0.55,
        elbow: 0.07,
        flat: 0.64,
        path: [
          [0, 0, 0],
          [-0.42, 1.62, 0.12],
          [-0.82, 1.58, 0.2],
          [-1.08, 1.86, 0.22],
          [-1.46, 1.84, 0.18],
          [-1.68, 2.08, 0.12],
          [-1.86, 2.1, 0.08],
        ],
        radii: [1, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08],
        childLength: 0.7,
      },
      {
        name: 'back',
        at: 0.5,
        dir: [0, 1, -1],
        length: 0,
        radius: 0.45,
        elbow: 0.08,
        flat: 0.66,
        path: [
          [0, 0, 0],
          [0.72, 2.3, -0.5],
          [0.9, 2.66, -0.86],
          [0.7, 3.0, -1.1],
          [0.86, 3.28, -1.22],
        ],
        radii: [1, 0.72, 0.52, 0.32, 0.08],
        childLength: 0.55,
      },
    ],
  };
}

// ---- background dead trees --------------------------------------------------------------------

/** Background dead trees on the hill: x, z, yaw, height, seed (left of the far house, right of the house). */
export const BACK_TREES: { x: number; z: number; yaw: number; h: number; seed: number }[] = [
  { x: -3.4, z: -3.4, yaw: 0.4, h: 1.9, seed: 31 },
  { x: -5.6, z: -4.3, yaw: 1.9, h: 2.0, seed: 32 },
  { x: -0.4, z: -4.5, yaw: -0.6, h: 1.4, seed: 33 },
  { x: -2.0, z: -4.8, yaw: 2.6, h: 1.2, seed: 34 },
  { x: 6.6, z: -2.5, yaw: -1.2, h: 1.45, seed: 35 },
];

function backParams(b: (typeof BACK_TREES)[number]): Partial<TreeParams> & { seed: number } {
  const r = (k: number) => rand(b.seed, 'back-tree', k) * 2 - 1;
  const h = b.h;
  const base = baseAt(b.x, b.z);
  // an S-curved trunk and three zig-zag limbs from the seed
  const trunk: V3[] = [
    [0, -0.25, 0],
    [0.02, 0.1 * h, 0],
    [0.08 * h * r(1), 0.35 * h, 0.05 * h * r(2)],
    [-0.06 * h * r(1), 0.6 * h, 0.06 * h * r(3)],
    [0.1 * h * r(4), 0.85 * h, 0.04 * h * r(5)],
    [0.05 * h * r(4) + 0.06 * h, 1.0 * h, 0.03 * h * r(6)],
  ];
  const limbs = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + r(10 + i) * 0.8;
    const len = h * (0.4 + 0.12 * r(20 + i));
    const y = 0.55 + 0.12 * i;
    return {
      at: y,
      dir: [Math.cos(a), 0.7 + 0.3 * r(30 + i), Math.sin(a)] as V3,
      length: len,
      radius: 0.62 - 0.08 * i,
      curl: 0.5 * r(40 + i),
      droop: 0.05,
    };
  });
  return {
    seed: b.seed,
    levels: 4,
    children: [0, 2, 2],
    branchAngle: [32, 40, 50],
    angleVariance: 15,
    lengthRatio: 0.55,
    lengthVariance: 0.3,
    trunkRadius: 0.075 * h,
    trunkTip: 0.2,
    rootFlare: 1.0,
    flareFrac: 0.1,
    minRadius: 0.008,
    tipRadius: 0.007,
    minLength: 0.12,
    droop: 0.04,
    upPull: 0.15,
    gnarl: [0.06, 0.1, 0.14, 0.18],
    curl: [0.3, 1.0, 1.6, 2.2],
    curlShare: 0.25,
    kink: { every: 0.33, angle: 30, from: 1 },
    sectionLength: 0.1,
    detail: 40,
    roots: { count: 4, length: 0.25 * h, radius: 0.55 },
    trunkPath: trunk,
    trunkChildren: 0,
    hero: limbs,
    ground: localGround(base, b.yaw),
    // far trees: the haze flattens them; a faint rim only
    rim: 0.22,
  };
}

// ---- conifers -------------------------------------------------------------------------------

/**
 * Tall dark conifers: a wall of tall pines at the back left that leaves the hero frame's top
 * (the reference's dark left side), smaller ones behind them, and two at the far right edge.
 */
export const CONIFERS: { x: number; z: number; h: number; r: number; seed: number }[] = [
  { x: -5.9, z: -0.5, h: 6.6, r: 1.05, seed: 51 },
  { x: -4.7, z: -1.5, h: 6.0, r: 0.95, seed: 57 },
  { x: -3.7, z: -2.6, h: 5.0, r: 0.82, seed: 58 },
  { x: -6.6, z: -2.2, h: 5.4, r: 0.9, seed: 52 },
  { x: -5.4, z: -3.6, h: 3.8, r: 0.66, seed: 53 },
  { x: -2.6, z: -4.4, h: 2.8, r: 0.52, seed: 54 },
  { x: 6.2, z: -4.4, h: 1.8, r: 0.42, seed: 55 },
  { x: 7.0, z: -4.6, h: 1.4, r: 0.36, seed: 56 },
];

function coniferParams(c: (typeof CONIFERS)[number]): Partial<ConiferParams> & { seed: number } {
  const tall = c.h > 4.5;
  return {
    seed: c.seed,
    height: c.h,
    radius: c.r,
    trunkRadius: 0.016 * c.h,
    tiers: Math.round(14 + c.h * 2.6),
    branches: tall ? 10 : 9,
    droop: 0.75,
    ragged: 0.62,
    clumps: tall ? 15 : 17,
    spike: 0.07 + c.r * 0.11,
    spikes: tall ? 6 : 6,
    base: tall ? 0.06 : 0.09,
    lean: [(rand(c.seed, 'lean', 0) - 0.5) * 0.05, (rand(c.seed, 'lean', 1) - 0.5) * 0.05],
    // every shot looks roughly toward -z: the needles' soft normals lean to +z, so the far side
    // of the crown seen through its gaps is not lit as a rim
    facing: [0, 0, 0.6],
    ground: localGround(baseAt(c.x, c.z), 0),
  };
}

// ---- skeletons (module-level, deterministic) and the rope hooks -------------------------------

let ghostSkel: TreeSkeleton | null = null;
/** The ghost tree's skeleton (tree-local; add GHOST_BASE for world). */
export function ghostTreeSkeleton(): TreeSkeleton {
  if (!ghostSkel) ghostSkel = growTree(ghostParams());
  return ghostSkel;
}

function hooks(): V3[] {
  const skel = ghostTreeSkeleton();
  const limb = findTube(skel, 'hero')!;
  const down = new Vector3(0, -1, 0);
  return HOOK_K.map((k) => {
    // the arc length on the limb nearest (in plan) to the hook's place on the ghosts' line
    const g = toGhostLocal(ghostLine(k, 0));
    let best = Infinity;
    let s0 = 0;
    for (const ring of limb.rings) {
      const d = Math.hypot(ring.pos.x - g[0], ring.pos.z - g[2]);
      if (d < best) {
        best = d;
        s0 = ring.along;
      }
    }
    const p = surfacePoint(skel, limb, s0, down);
    return add([p.x, p.y, p.z], GHOST_BASE);
  });
}

/**
 * Where the three ghosts' ropes tie on: world points on the underside of the ghost tree's hero
 * limb, at its knobs, read off the built bark. From the trunk outward (right to left in the hero
 * view): the highest first, then lower; spaced ~0.38 and ~0.55 apart.
 */
export const GHOST_HOOKS: V3[] = hooks();

// ---- bark texture -----------------------------------------------------------------------------

let barkTex: { map: CanvasTexture; bump: CanvasTexture } | null = null;

/**
 * A tileable bark patch (one repeat ≈ 0.25 around × 0.5 along): fine furrows running along the
 * wood with a wander, plates broken by cross cracks. The same height serves as the bump map and,
 * remapped, as the albedo map (dark furrow floors, paler plate tops).
 */
function barkTextures(): { map: CanvasTexture; bump: CanvasTexture } {
  if (barkTex) return barkTex;
  const W = 256;
  const H = 512;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const cb = mk();
  const cm = mk();
  const gb = cb.getContext('2d')!;
  const gm = cm.getContext('2d')!;
  const ib = gb.createImageData(W, H);
  const im = gm.createImageData(W, H);
  const N = 4; // furrows per repeat
  // periodic noise: sample fbm on a torus (cos/sin of both coordinates) so the tile wraps
  const pn = (u: number, v: number, seed: number, fu: number, fv: number) => {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 2;
    return fbm2(Math.cos(a) * fu + Math.cos(b) * fv * 0.37, Math.sin(a) * fu + Math.sin(b) * fv, seed, 3, 1) * 0.6 + fbm2(Math.cos(b) * fv + 11.3, Math.sin(b) * fv - Math.sin(a) * fu * 0.5, seed + 9, 3, 1) * 0.4;
  };
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // long fibrous furrows along the wood, wandering; strands swell and thin
      const wander = 0.3 * pn(u, v, 61, 0.6, 1.3) + 0.08 * pn(u, v, 63, 2.0, 5.0);
      const ph = u * N + wander;
      const strand = Math.pow(Math.abs(Math.sin(Math.PI * ph)), 0.6);
      // fine fibres inside the strands
      const fibre = 0.5 + 0.5 * Math.sin(Math.PI * (u * N * 4 + 1.7 * wander + 0.6 * pn(u, v, 65, 1.0, 3.0)));
      // irregular breaks across a strand (not a grid): where a slow noise peaks; a few run deep
      const strandId = (((Math.floor(ph) % N) + N) % N) * 0.137;
      const brk = Math.max(0, pn(u, v + strandId, 67, 1.2, 6.0) - 0.3) * 2.6;
      const grain = 0.5 + 0.5 * pn(u * 3, v * 0.25, 71, 3.0, 4.0);
      const h = Math.max(0, Math.min(1, strand * (0.85 + 0.15 * fibre) * (1 - Math.min(0.8, brk)) * (0.85 + 0.15 * grain)));
      const o = (y * W + x) * 4;
      const hb = Math.round(h * 255);
      ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = hb;
      ib.data[o + 3] = 255;
      // albedo: furrow floors darker and warmer, plate tops paler and greyer; a cool lichen now and then
      const lichen = Math.max(0, pn(u, v, 73, 1.6, 2.2) - 0.25) * 1.4;
      const m = (0.55 + 0.45 * Math.pow(h, 0.8)) * (0.92 + 0.08 * grain);
      im.data[o] = Math.round(255 * m * (1 - 0.1 * lichen));
      im.data[o + 1] = Math.round(255 * m * (0.97 - 0.05 * (1 - h)) * (1 - 0.02 * lichen));
      im.data[o + 2] = Math.round(255 * m * (0.97 + 0.03 * lichen));
      im.data[o + 3] = 255;
    }
  }
  gb.putImageData(ib, 0, 0);
  gm.putImageData(im, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  barkTex = { map: tex(cm, true), bump: tex(cb, false) };
  return barkTex;
}

// ---- the component ----------------------------------------------------------------------------

function placed(g: BufferGeometry, base: V3, yaw: number): BufferGeometry {
  return g.applyMatrix4(new Matrix4().makeRotationY(yaw).setPosition(base[0], base[1], base[2]));
}

/** Triangle count of the built trees (lookdev budget report). */
export function treeStats(geos: BufferGeometry[]): number {
  return geos.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
}

/** The old tree's base for a spot (default LAND.oldTree). */
export function oldBase(spot: Spot2 = LAND.oldTree): V3 {
  return baseAt(spot.x, spot.z);
}

export function buildTrees(oldSpot: Spot2 = LAND.oldTree): { ghost: BufferGeometry; old: BufferGeometry; back: BufferGeometry; conifers: BufferGeometry } {
  const ghost = treeGeometry(ghostTreeSkeleton());
  const old = treeGeometry(growTree(oldParams(oldBase(oldSpot))));
  const back = mergeGeometries(BACK_TREES.map((b) => placed(treeGeometry(growTree(backParams(b))), baseAt(b.x, b.z), b.yaw)));
  const conifers = mergeGeometries(CONIFERS.map((c) => placed(buildConifer(coniferParams(c)), baseAt(c.x, c.z), 0)));
  return { ghost, old, back, conifers };
}

export interface TreesProps {
  /** the film frame (the finest twigs' sway) */
  f: number;
  /** lookdev only: preview the old tree on another spot (the film uses LAND.oldTree) */
  oldTree?: Spot2;
}

export function Trees({ f, oldTree }: TreesProps) {
  const ox = oldTree?.x ?? LAND.oldTree.x;
  const oz = oldTree?.z ?? LAND.oldTree.z;
  const built = useMemo(() => {
    const geos = buildTrees({ x: ox, z: oz });
    const tex = barkTextures();
    // dark plum-brown wood (the reference's trunks), cooler on the moon side through the rim
    const bark = storybookMaterial({
      kind: 'bark',
      color: '#837074',
      color2: '#5c5862',
      vertexColors: true,
      roughness: 0.95,
      breakup: 0.35,
      scale: 0.2,
      bump: 0.5,
      rim: 1.15,
      topCoat: 0.14,
      wind: 0.012,
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 1.6,
      // the trees stand in the night's haze more than the ground does (the reference's mid-ground
      // trunks fall toward the sky's value): a heavier share of the storybook fog
      fog: 1.3,
      // each near tree rises out of the page whole, its limbs with its trunk
      growX: 'origin',
    });
    // the background trees: the same wood, further into the haze, no sway
    const barkFar = storybookMaterial({ kind: 'bark', color: '#837074', color2: '#5c5862', vertexColors: true, roughness: 0.95, breakup: 0.35, scale: 0.2, bump: 0.5, rim: 1.5, map: tex.map, bumpMap: tex.bump, bumpScale: 1.6, fog: 1.6 });
    // the pines: very dark plum, a faint rim only
    const needles = storybookMaterial({ kind: 'plain', color: '#2a1f2c', color2: '#150f18', vertexColors: true, roughness: 1, breakup: 0.3, scale: 0.35, rim: 0.1, fog: 0.9 });
    return { geos, bark, barkFar, needles, oldAt: oldBase({ x: ox, z: oz }) };
  }, [ox, oz]);
  useLayoutEffect(
    () => () => {
      Object.values(built.geos).forEach((g) => g.dispose());
      built.bark.dispose();
      built.barkFar.dispose();
      built.needles.dispose();
    },
    [built],
  );
  // a slow gust on the twigs' sway amplitude, from the frame
  useLayoutEffect(() => {
    const sb = built.bark.userData.sb as { uSbWind: { value: number } };
    sb.uSbWind.value = 0.012 * (0.7 + 0.3 * Math.sin((f / FPS) * 0.45));
  }, [built, f]);
  return (
    <>
      <mesh geometry={built.geos.ghost} material={built.bark} position={GHOST_BASE} castShadow receiveShadow />
      <mesh geometry={built.geos.old} material={built.bark} position={built.oldAt} castShadow receiveShadow />
      <mesh geometry={built.geos.back} material={built.barkFar} castShadow />
      <mesh geometry={built.geos.conifers} material={built.needles} castShadow />
    </>
  );
}
