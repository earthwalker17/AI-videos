// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2010-2026 three.js authors
// Adapted from https://github.com/mrdoob/three.js/blob/r186/examples/jsm/generators/TreeGenerator.js
/**
 * Gnarled dead trees as one indexed BufferGeometry: a skeleton of tapered tubes swept with a
 * parallel-transport frame (never twisting), forking by the pipe model with a golden-angle roll,
 * pulled toward the light, sagging with gravity (three.js's TreeGenerator, MIT), plus what a
 * storybook tree needs:
 *  - a hand-drawn skeleton where the silhouette matters: the trunk and the primary limbs can be
 *    given as control points, either a smooth spline or a polyline with angular elbows (corners
 *    rounded over a short distance), with a radius per control point (hard tapers, knobs where
 *    something is tied), so one massive trunk twists in S-curves and a hero limb passes exactly
 *    where the story needs it; the procedural branches and twigs then grow from those limbs;
 *  - limbs that zig-zag (elbows every third of their length), flattened twisting cross-sections
 *    (ribbons), and only some tips curling into hooks and spirals (Rackham), the rest tapering
 *    to points; short broken stubs on the trunk;
 *  - bark in the geometry on the thick parts: sinewy furrows running along the wood, wandering
 *    (domain-warped), some running deep and others fading out so the plates between them merge
 *    and split, broad smooth burls and lumps; the relief scales with the radius (thin wood stays
 *    smooth) and a tube's radius is clamped to its bend's radius, so no ring crosses its
 *    neighbour on the inside of a bend (no fins, no folds);
 *  - buttress roots that grip the ground: they follow a ground-height function, emerge from the
 *    flared base and dive under the soil at their tips, so nothing floats;
 *  - UVs in texture repeats (u around the wood, an integer count per tube so the seam closes;
 *    v along the wood, continuous from the base), a vertex colour that darkens crotches, the
 *    furrows' floors and everything near the ground (cheap ambient occlusion), its alpha the
 *    storybook rim's mask (thin twigs and far trees take no rim: dark silhouettes, no neon wire),
 *    and an `aWind` attribute (0 at a fine twig's base to 1 at its tip, 0 elsewhere).
 *
 * `growTree` returns the skeleton (so callers can find a named limb and points on its bark,
 * e.g. where ropes attach), `treeGeometry` builds the mesh from it, `buildTree` does both.
 * Deterministic: all randomness comes from @aiv/core's hashed `rand(seed, id, k)` through a
 * per-build counter, so the same parameters build the same vertices on every page.
 * Generic: no film imports (listed in video.json `reusable`).
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { fbm2Fast as fbm2 } from './field.ts';
import { Curve } from './spline.ts';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

export type V3 = [number, number, number];

/** A sphere (tree-local) that a limb's children keep out of (e.g. where something hangs). */
export interface Clear {
  at: V3;
  r: number;
}

export interface HeroLimb {
  /** fraction along the parent where it leaves */
  at: number;
  /** its initial direction (normalised by the builder); ignored with `path` */
  dir: V3;
  /** ignored with `path` (the path's arc length is used) */
  length: number;
  /** base radius as a fraction of the parent's radius at that point */
  radius: number;
  /** total curl of this limb (radians), toward its tip (procedural limbs only) */
  curl?: number;
  /** extra droop for this limb (gravity per unit length; procedural limbs only) */
  droop?: number;
  /** children along it (default: the level-1 count) */
  children?: number;
  /** hand-drawn: control points (tree-local); the first point is where it leaves the parent */
  path?: V3[];
  /** the limb it leaves: -1 / undefined for the trunk, else the index of an EARLIER hero limb */
  parent?: number;
  /** tip radius as a fraction of the base radius (hand-drawn limbs; default 0.08) */
  tip?: number;
  /** hand-drawn: the radius at each control point, as a fraction of the base radius (overrides `tip`) */
  radii?: number[];
  /** hand-drawn: angular elbows: the path is a polyline, its corners rounded over this distance (world units) */
  elbow?: number;
  /** broken stubs along it (spurs): count, length (world units), radius (a fraction of the limb's) */
  stubs?: { count: number; length: number; radius: number };
  /** hand-drawn: knobs (where a rope is tied, an old wound): the radius swells by `r` (a fraction) within about `w` of the tree-local point `at` */
  knobs?: { at: V3; r: number; w: number }[];
  /** elliptical cross-section: minor / major axis (1 round, 0.6 a flattened ribbon) */
  flat?: number;
  /** turns of that ellipse per unit of length (the wood's twist) */
  flatTwist?: number;
  /** no children leave inside these spheres, and none leave pointing down near them */
  clear?: Clear[];
  /** the level this limb counts as (default 1; 2 makes a hand-drawn secondary branch) */
  level?: number;
  /** its children's length (default: its length × lengthRatio) */
  childLength?: number;
  /** the stretch of it (fractions) where children leave (default: childStart … 1) */
  childRange?: [number, number];
  /** a name to find it in the skeleton */
  name?: string;
}

export interface BarkParams {
  /** furrows per unit of circumference */
  furrows: number;
  /** furrow depth as a fraction of the radius */
  depth: number;
  /** spiral grain: turns of the furrows per unit of length */
  twist: number;
  /** lumps, as a fraction of the radius */
  lumps: number;
  /** burls and knots: sparse broad swellings, as a fraction of the radius */
  burls?: number;
  /** how far the furrows wander sideways, in furrow spacings (default 0.4) */
  wander?: number;
  /** only tubes with a base radius at least this get bark in the geometry */
  minRadius: number;
}

export interface TreeParams {
  seed: number;
  /** recursion depth: trunk, limbs, branches, twigs */
  levels: number;
  children: number[];
  /** degrees a child tilts off its parent, per level */
  branchAngle: number[];
  angleVariance: number;
  lengthRatio: number;
  lengthVariance: number;
  trunkLength: number;
  trunkRadius: number;
  taper: number;
  taperCurve: number;
  rootFlare: number;
  flareFrac: number;
  radiusExponent: number;
  minRadius: number;
  minLength: number;
  droop: number;
  upPull: number;
  /** per-level random wobble per section */
  gnarl: number[];
  /** per-level total curl toward the tip (radians); the Rackham spiral */
  curl: number[];
  radialSegments: number;
  sectionLength: number;
  childStart: number;
  trunkClear: number;
  /** the trunk's lean from vertical: [x, z] tilt (radians-ish, small) */
  lean: [number, number];
  /** buttress roots spreading from the base and diving into the ground */
  roots: { count: number; length: number; radius: number; forks?: number };
  hero: HeroLimb[];
  /** hand-drawn trunk: control points (tree-local, from below the ground up); overrides trunkLength/lean */
  trunkPath?: V3[];
  /** trunk tip radius as a fraction of trunkRadius (hand-drawn trunk; default 0.15) */
  trunkTip?: number;
  /** hand-drawn trunk: the radius at each control point, as a fraction of trunkRadius (overrides trunkTip) */
  trunkRadii?: number[];
  /** hand-drawn trunk: elliptical cross-section ratio (1 round) */
  trunkFlat?: number;
  /** hand-drawn trunk: a polyline with its corners rounded over this distance, instead of a spline */
  trunkElbow?: number;
  /** procedural limbs on a hand-drawn trunk (default 0: the hero limbs are the crown) */
  trunkChildren?: number;
  /** their length (default: the trunk's × lengthRatio) and the stretch of the trunk they leave from (fractions) */
  trunkChildLength?: number;
  trunkChildRange?: [number, number];
  /** short broken stubs on the trunk */
  stubs?: { count: number; length: number; radius: number };
  /** bark in the geometry on the thick tubes */
  bark?: BarkParams;
  /** the ground's height (tree-local y) under a tree-local (x, z): roots follow it, AO darkens near it */
  ground?: (x: number, z: number) => number;
  /** tubes at this level and finer get aWind 0..1 along them (default: the finest level) */
  windLevel?: number;
  /** radial segments per unit of radius on smooth tubes (0: the per-level radialSegments rule) */
  detail?: number;
  /** wobble of hand-drawn paths, as a fraction of the radius */
  pathGnarl?: number;
  /** section length of a hand-drawn trunk (finer for knots; default from its radius) */
  trunkSection?: number;
  /** lidded knot holes carved into the trunk (a pair reads as sleepy eyes) */
  knots?: Knot[];
  /** the share of procedural branches whose tips curl (default 1); the rest barely bend and end in points */
  curlShare?: number;
  /** procedural branches at level ≥ `from` (default 1) turn by ~`angle` degrees every `every` of their length: elbows, zig-zag */
  kink?: { every: number; angle: number; from?: number };
  /** procedural limbs and branches (levels 1–2): elliptical cross-sections of this ratio, randomly turned (1 round) */
  flat?: number;
  /** procedural branches (level ≥ 2) stop growing where they enter this region (tree-local); e.g. a view of the moon */
  keepOut?: (p: Vector3) => boolean;
  /** the floor of a tapering tip's radius (default minRadius × 0.6): sub-pixel tips alias */
  tipRadius?: number;
  /** this tree's rim (the vertex alpha): 1 full; far trees take less */
  rim?: number;
  /** tubes thinner than [0] take no rim, thicker than [1] the full rim (default [0.012, 0.04]) */
  rimRadius?: [number, number];
}

/** A knot hole carved into the trunk: an almond hollow under a heavy lid. */
export interface Knot {
  /** fraction along the trunk */
  at: number;
  /** tree-local direction it faces (projected onto the trunk's cross-section) */
  facing: V3;
  /** sideways offset around the trunk from `facing`, world units of arc */
  offset: number;
  /** width and height of the almond (world units) */
  w: number;
  h: number;
  /** depth of the hollow and height of the lid (world units) */
  depth: number;
  lid: number;
  /** tilt of the almond (radians; positive raises its outer corner) */
  tilt: number;
}

export const DEAD_TREE: TreeParams = {
  seed: 1,
  levels: 4,
  children: [4, 5, 4],
  branchAngle: [34, 46, 58],
  angleVariance: 16,
  lengthRatio: 0.6,
  lengthVariance: 0.3,
  trunkLength: 3.2,
  trunkRadius: 0.16,
  taper: 0.78,
  taperCurve: 0.8,
  rootFlare: 1.3,
  flareFrac: 0.16,
  radiusExponent: 2.2,
  minRadius: 0.006,
  minLength: 0.12,
  droop: 0.04,
  upPull: 0.12,
  gnarl: [0.1, 0.2, 0.28, 0.34],
  curl: [0.2, 0.7, 1.3, 1.8],
  radialSegments: 9,
  sectionLength: 0.12,
  childStart: 0.2,
  trunkClear: 0.38,
  lean: [0, 0],
  roots: { count: 5, length: 0.55, radius: 0.55 },
  hero: [],
};

export interface Ring {
  pos: Vector3;
  tangent: Vector3;
  normal: Vector3;
  radius: number;
  /** distance along this tube from its base */
  along: number;
}

export interface Tube {
  rings: Ring[];
  radial: number;
  level: number;
  /** distance from the tree's base to this tube's base (bark v continuity) */
  v0: number;
  /** index in the skeleton */
  id: number;
  name?: string;
  /** furrows around (0: smooth) */
  furrows: number;
  /** grows into the ground (roots): AO by height above the ground everywhere */
  root?: boolean;
  /** base radius (crotch occlusion scale) */
  base: number;
  /** cross-section: minor/major ratio (1 round), its turn at the base and its twist (turns per unit) */
  flat: number;
  flatPhase: number;
  flatTwist: number;
}

export interface TreeSkeleton {
  tubes: Tube[];
  params: TreeParams;
}

type Rand = () => number;

/** Grow a tree's skeleton; `params` override the dead-tree defaults. */
export function growTree(params: Partial<TreeParams> & { seed: number }): TreeSkeleton {
  const p: TreeParams = { ...DEAD_TREE, ...params };
  let k = 0;
  const random = () => rand(p.seed, 'tree', k++);
  const tubes: Tube[] = [];
  let trunk: Tube;
  if (p.trunkPath) {
    trunk = sweep(tubes, p.trunkPath, p.trunkRadius, p.trunkRadius * (p.trunkTip ?? 0.15), 0, 0, p, random, {
      flare: true,
      name: 'trunk',
      section: p.trunkSection,
      radii: p.trunkRadii,
      flat: p.trunkFlat,
      elbow: p.trunkElbow,
    });
    const n = p.trunkChildren ?? 0;
    if (n > 0) branchOut(tubes, trunk, n, p, random, [], { length: p.trunkChildLength, range: p.trunkChildRange });
  } else {
    const dir = new Vector3(p.lean[0], 1, p.lean[1]).normalize();
    trunk = grow(tubes, new Vector3(), dir, p.trunkLength, p.trunkRadius, 0, 0, p, random, p.curl[0]);
  }
  const limbs: Tube[] = [];
  for (const h of p.hero) {
    const parent = h.parent !== undefined && h.parent >= 0 ? limbs[h.parent] : trunk;
    const ring = ringAt(parent, h.at);
    const level = h.level ?? 1;
    const r0 = Math.max(p.minRadius, ring.radius * h.radius);
    let tube: Tube;
    if (h.path) {
      const pts = h.path.map((q) => [...q] as V3);
      // the first point leaves from the parent's axis, so the limb grows out of the wood
      pts[0] = [ring.pos.x, ring.pos.y, ring.pos.z];
      tube = sweep(tubes, pts, r0, r0 * (h.tip ?? 0.08), level, parent.v0 + ring.along, p, random, {
        collar: 0.35,
        name: h.name,
        radii: h.radii,
        elbow: h.elbow,
        flat: h.flat,
        flatTwist: h.flatTwist,
        knobs: h.knobs,
      });
      branchOut(tubes, tube, h.children ?? p.children[Math.min(level, p.children.length - 1)], p, random, h.clear ?? [], { length: h.childLength, range: h.childRange });
    } else {
      const d = new Vector3(...h.dir).normalize();
      const q: TreeParams = { ...p, droop: h.droop ?? p.droop, children: h.children ? [p.children[0], h.children, ...p.children.slice(2)] : p.children };
      tube = grow(tubes, ring.pos, d, h.length, r0, level, parent.v0 + ring.along, q, random, h.curl ?? p.curl[1]);
    }
    if (h.name) tube.name = h.name;
    limbs.push(tube);
    if (h.stubs) for (let i = 0; i < h.stubs.count; i++) stub(tubes, tube, 0.12 + random() * 0.78, h.stubs.length, h.stubs.radius, p, random, true);
  }
  if (p.stubs) {
    for (let i = 0; i < p.stubs.count; i++) {
      let t = 0.25 + random() * 0.55;
      // never beside a knot hole (a stub there reads as a nose, not an old wound)
      if (p.knots?.some((kn) => Math.abs(kn.at - t) < 0.08)) t = Math.min(0.92, t + 0.16);
      stub(tubes, trunk, t, p.stubs.length, p.stubs.radius, p, random, false);
    }
  }
  for (let i = 0; i < p.roots.count; i++) {
    const a = (i / p.roots.count) * TAU + (random() - 0.5) * 0.9;
    const len = p.roots.length * (0.7 + random() * 0.6);
    const r = p.trunkRadius * p.roots.radius * (0.7 + random() * 0.5);
    growRoot(tubes, a, len, r, p, random, p.roots.forks ?? 0);
  }
  tubes.forEach((t, i) => (t.id = i));
  return { tubes, params: p };
}

/**
 * A short broken stub out of a tube at fraction `t`: blunt (little taper), no curl. With
 * `relative` its radius is a fraction of the tube's there (else world units) and it points up
 * or sideways, never down (a limb's spurs).
 */
function stub(tubes: Tube[], tube: Tube, t: number, length: number, radius: number, p: TreeParams, random: Rand, relative: boolean) {
  const ring = ringAt(tube, t);
  let a = random() * TAU;
  const b = new Vector3().crossVectors(ring.tangent, ring.normal);
  const outAt = (ang: number) => ring.normal.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
  let out = outAt(a);
  if (relative && out.y < -0.2) {
    a += Math.PI;
    out = outAt(a);
  }
  const d = out.multiplyScalar(0.8).addScaledVector(ring.tangent, 0.35 + random() * 0.3).normalize();
  const len = length * (0.6 + random() * 0.8);
  const r = (relative ? ring.radius * radius : radius) * (0.7 + random() * 0.6);
  grow(tubes, ring.pos, d, len + ring.radius, r, Math.max(1, p.levels - 2), tube.v0 + ring.along, { ...p, levels: 0, taper: 0.45, kink: undefined }, random, 0);
}

/** Build a tree; `params` override the dead-tree defaults. Returns geometry with position, normal, uv, color (rgba), aWind. */
export function buildTree(params: Partial<TreeParams> & { seed: number }): BufferGeometry {
  return treeGeometry(growTree(params));
}

/** The tube with this name (a hero limb's `name`, or 'trunk' for a hand-drawn trunk). */
export function findTube(skel: TreeSkeleton, name: string): Tube | undefined {
  return skel.tubes.find((t) => t.name === name);
}

/** The bark's surface point (tree-local) at arc length `s` along a tube, in direction `dir` from its axis. */
export function surfacePoint(skel: TreeSkeleton, tube: Tube, s: number, dir: Vector3): Vector3 {
  const len = tube.rings[tube.rings.length - 1].along;
  const ring = ringAt(tube, Math.max(0, Math.min(1, s / len)));
  const b = new Vector3().crossVectors(ring.tangent, ring.normal);
  const d = dir.clone().addScaledVector(ring.tangent, -dir.dot(ring.tangent));
  const a = Math.atan2(d.dot(b), d.dot(ring.normal));
  const r = ring.radius * sectionAt(tube, a, ring.along) * (1 + barkAt(skel.params, tube, a, ring.along, ring.radius));
  return ring.pos.clone().addScaledVector(ring.normal, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
}

// ---- growth ---------------------------------------------------------------------------------

function grow(tubes: Tube[], base: Vector3, dir: Vector3, length: number, baseRadius: number, level: number, v0: number, p: TreeParams, random: Rand, curl: number): Tube {
  const minSections = 3 + Math.min(6, Math.round(Math.abs(curl) * 2.2));
  const sections = Math.max(minSections, Math.min(48, Math.round(length / p.sectionLength)));
  const step = length / sections;
  const gnarl = p.gnarl[Math.min(level, p.gnarl.length - 1)];
  let tangent = dir.clone().normalize();
  const normal = perpendicular(tangent);
  // the curl turns about a fixed axis chosen per branch, harder toward the tip (t^e: tighter hooks for larger e)
  const curlAxis = perpendicular(tangent).applyAxisAngle(tangent, random() * TAU);
  const curlExp = 2.6 + random() * 2.6;
  // elbows: the direction turns abruptly a few times along the branch, alternating sides (zig-zag)
  const kk = p.kink && level >= (p.kink.from ?? 1) ? p.kink : null;
  const kinks = new Map<number, number>();
  let kinkRoll = random() * TAU;
  if (kk) {
    const segs = Math.max(2, Math.round(1 / kk.every));
    for (let i = 1; i < segs; i++) {
      const at = Math.max(1, Math.min(sections - 2, Math.round(sections * ((i + (random() - 0.5) * 0.45) / segs))));
      kinks.set(at, kk.angle * DEG * (0.7 + 0.6 * random()));
    }
  }
  let pendingKink: { axis: Vector3; angle: number } | null = null;
  const tip = p.tipRadius ?? p.minRadius * 0.6;
  const rings: Ring[] = [];
  const pos = base.clone();
  for (let s = 0; s <= sections; s++) {
    const t = s / sections;
    let radius = baseRadius * (1 - p.taper + p.taper * Math.pow(1 - t, p.taperCurve));
    if (level === 0 && p.rootFlare > 0) {
      const flare = Math.max(0, (p.flareFrac - t) / p.flareFrac);
      radius *= 1 + p.rootFlare * flare * flare * flare;
    }
    rings.push({ pos: pos.clone(), tangent: tangent.clone(), normal: normal.clone(), radius: Math.max(radius, tip), along: t * length });
    // a branch that grows into the keep-out region stops there, in a point
    if (p.keepOut && level >= 2 && s > 0 && p.keepOut(pos)) {
      rings[rings.length - 1].radius = tip;
      break;
    }
    if (s < sections) {
      const next = tangent.clone();
      next.x += (random() * 2 - 1) * gnarl;
      next.y += (random() * 2 - 1) * gnarl * 0.7;
      next.z += (random() * 2 - 1) * gnarl;
      if (level > 0) next.y -= p.droop * step;
      next.normalize();
      const dt = 1 / sections;
      const share = curl * (Math.pow(t + dt, curlExp) - Math.pow(t, curlExp));
      next.applyAxisAngle(curlAxis, share).normalize();
      // an elbow is turned over two steps, so the rings at the corner do not shear
      if (pendingKink) {
        next.applyAxisAngle(pendingKink.axis, pendingKink.angle).normalize();
        pendingKink = null;
      }
      const ka = kinks.get(s + 1);
      if (ka !== undefined) {
        kinkRoll += Math.PI * (0.65 + 0.7 * random());
        const axis = perpendicular(next).applyAxisAngle(next, kinkRoll);
        next.applyAxisAngle(axis, ka * 0.5).normalize();
        pendingKink = { axis, angle: ka * 0.5 };
      }
      transport(tangent, next, normal);
      pos.addScaledVector(next, step);
      tangent = next;
    }
  }
  if (rings.length < 3) return makeTube(rings.length >= 2 ? rings : [rings[0], { ...rings[0], along: 1e-3 }], level, v0, p, baseRadius);
  // a blunt end (a broken stub) closes over its last section, so its open end never shows
  if (p.taper < 0.6) rings[rings.length - 1].radius = Math.max(tip, baseRadius * 0.12);
  const tube = makeTube(rings, level, v0, p, baseRadius);
  if (level >= 1 && level <= 2 && p.flat !== undefined && p.flat < 1) {
    tube.flat = p.flat + (1 - p.flat) * 0.4 * random();
    tube.flatPhase = random() * Math.PI;
    tube.flatTwist = (random() - 0.5) * 0.5;
  }
  tubes.push(tube);
  const grown = rings[rings.length - 1].along;
  if (level >= p.levels - 1 || grown < p.minLength) return tube;
  branchOut(tubes, tube, p.children[Math.min(level, p.children.length - 1)], p, random, []);
  return tube;
}

/** Children along a tube: the pipe model's radii, a golden-angle roll, the light's pull, curls. */
function branchOut(tubes: Tube[], tube: Tube, n: number, p: TreeParams, random: Rand, clear: Clear[], o: { length?: number; range?: [number, number] } = {}) {
  const level = tube.level;
  if (level >= p.levels - 1 || n <= 0) return;
  const length = tube.rings[tube.rings.length - 1].along;
  const baseRadius = tube.base;
  const start = o.range ? o.range[0] : level === 0 ? p.trunkClear : p.childStart;
  const end = o.range ? o.range[1] : 1;
  const angle = p.branchAngle[Math.min(level, p.branchAngle.length - 1)];
  const pipeDrop = Math.pow(1 / n, 1 / p.radiusExponent);
  const curlShare = p.curlShare ?? 1;
  for (let i = 0; i < n; i++) {
    const t = start + ((i + 0.5 + (random() - 0.5) * 0.7) / n) * (end - start);
    const ring = ringAt(tube, t);
    const tilt = (angle + (random() * 2 - 1) * p.angleVariance) * DEG;
    const roll = i * GOLDEN_ANGLE + (random() * 2 - 1) * 0.5;
    const childDir = ring.tangent.clone().applyAxisAngle(ring.normal, tilt).applyAxisAngle(ring.tangent, roll);
    if (p.upPull > 0) childDir.lerp(UP, p.upPull).normalize();
    const childBase = Math.max(p.minRadius, Math.min(baseRadius * pipeDrop, ring.radius * 0.92));
    let childLength = o.length ?? Math.max(length * p.lengthRatio, p.minLength * 1.2);
    if (p.lengthVariance > 0) childLength *= 1 + (random() * 2 - 1) * p.lengthVariance;
    // only some tips curl (each its own tightness); the rest end in points
    const curly = random() < curlShare;
    const c = p.curl[Math.min(level + 1, p.curl.length - 1)] * (curly ? 0.5 + random() : 0.12 * random()) * (random() < 0.5 ? -1 : 1);
    // keep clear spheres free: no child leaves inside one, none leaves downward near one
    let blocked = false;
    for (const cl of clear) {
      const d = Math.hypot(ring.pos.x - cl.at[0], ring.pos.y - cl.at[1], ring.pos.z - cl.at[2]);
      if (d < cl.r || (d < cl.r * 1.8 && childDir.y < 0.25)) blocked = true;
    }
    if (blocked) continue;
    if (p.keepOut && level + 1 >= 2 && p.keepOut(ring.pos)) continue;
    grow(tubes, ring.pos, childDir, childLength, childBase, level + 1, tube.v0 + ring.along, p, random, c);
  }
}

/** A path through control points: a smooth centripetal spline, or a polyline whose corners are rounded over `elbow`. */
function pathSampler(points: V3[], elbow?: number): { length: number; pointAt(s: number): Vector3 } {
  if (!elbow || points.length < 3) {
    const curve = new Curve<V3>(points, 64);
    return {
      length: curve.length,
      pointAt: (s) => {
        const q = curve.pointAt(s);
        return new Vector3(q[0], q[1], q[2]);
      },
    };
  }
  const P = points.map((q) => new Vector3(...q));
  const dense: Vector3[] = [P[0].clone()];
  const push = (v: Vector3) => {
    if (v.distanceToSquared(dense[dense.length - 1]) > 1e-10) dense.push(v);
  };
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const inD = new Vector3().subVectors(b, a);
    const outD = new Vector3().subVectors(c, b);
    const cut = Math.min(elbow, inD.length() * 0.45, outD.length() * 0.45);
    const q0 = b.clone().addScaledVector(inD.normalize(), -cut);
    const q1 = b.clone().addScaledVector(outD.normalize(), cut);
    // the straight run up to the corner, then a quadratic arc q0 → b → q1
    const run = q0.distanceTo(dense[dense.length - 1]);
    const nRun = Math.max(1, Math.ceil(run / 0.02));
    const from = dense[dense.length - 1].clone();
    for (let k = 1; k <= nRun; k++) push(from.clone().lerp(q0, k / nRun));
    const nArc = 12;
    for (let k = 1; k <= nArc; k++) {
      const t = k / nArc;
      const u = 1 - t;
      push(new Vector3().addScaledVector(q0, u * u).addScaledVector(b, 2 * u * t).addScaledVector(q1, t * t));
    }
  }
  {
    const last = P[P.length - 1];
    const from = dense[dense.length - 1].clone();
    const nRun = Math.max(1, Math.ceil(from.distanceTo(last) / 0.02));
    for (let k = 1; k <= nRun; k++) push(from.clone().lerp(last, k / nRun));
  }
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const length = cum[cum.length - 1];
  return {
    length,
    pointAt: (s) => {
      const x = Math.max(0, Math.min(length, s));
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < x) lo = mid;
        else hi = mid;
      }
      const f = (x - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
      return dense[lo].clone().lerp(dense[hi], f);
    },
  };
}

/** A tube swept along hand-drawn control points, tapering r0 → r1 (or by `radii`), with a little wobble. */
function sweep(
  tubes: Tube[],
  points: V3[],
  r0: number,
  r1: number,
  level: number,
  v0: number,
  p: TreeParams,
  random: Rand,
  o: { flare?: boolean; collar?: number; name?: string; section?: number; radii?: number[]; elbow?: number; flat?: number; flatTwist?: number; knobs?: { at: V3; r: number; w: number }[] },
): Tube {
  const path = pathSampler(points, o.elbow);
  const length = path.length;
  const sec = o.section ?? Math.min(p.sectionLength, Math.max(0.03, 0.025 + r0 * 0.12));
  const sections = Math.max(6, Math.min(300, Math.round(length / sec)));
  const seed = random() * 1000;
  // the wobble is capped in absolute size: a thick trunk bends, it must not fold over itself
  const amp = (p.pathGnarl ?? 0.25) * Math.min(r0, 0.11);
  const flareH = p.flareFrac * length;
  const pts: Vector3[] = [];
  for (let s = 0; s <= sections; s++) pts.push(path.pointAt((s / sections) * length));
  // the control points' arc lengths (nearest sample), for a radius per control point
  let radiusAt: ((along: number) => number) | null = null;
  if (o.radii && o.radii.length === points.length) {
    const ss = points.map((q, i) => {
      if (i === 0) return 0;
      if (i === points.length - 1) return length;
      let best = Infinity;
      let bs = 0;
      for (let s = 0; s <= sections; s++) {
        const d = pts[s].distanceToSquared(new Vector3(...q));
        if (d < best) {
          best = d;
          bs = (s / sections) * length;
        }
      }
      return bs;
    });
    for (let i = 1; i < ss.length; i++) ss[i] = Math.max(ss[i], ss[i - 1] + 1e-4);
    const rr = o.radii;
    radiusAt = (along) => {
      let i = 0;
      while (i < ss.length - 2 && along > ss[i + 1]) i++;
      const f = smoothstep01((along - ss[i]) / Math.max(1e-6, ss[i + 1] - ss[i]));
      return r0 * (rr[i] + (rr[i + 1] - rr[i]) * f);
    };
  }
  const rings: Ring[] = [];
  const tan0 = new Vector3();
  let normal = perpendicular(new Vector3().subVectors(pts[1], pts[0]).normalize());
  for (let s = 0; s <= sections; s++) {
    const t = s / sections;
    const along = t * length;
    const a = pts[Math.max(0, s - 1)];
    const b = pts[Math.min(sections, s + 1)];
    const tangent = new Vector3().subVectors(b, a).normalize();
    if (s > 0) transport(tan0, tangent, normal);
    else normal = perpendicular(tangent);
    tan0.copy(tangent);
    let radius = radiusAt ? radiusAt(along) : r1 + (r0 - r1) * Math.pow(1 - t, p.taperCurve);
    if (o.flare && p.rootFlare > 0) {
      const f = Math.min(1, Math.max(0, 1 - pts[s].y / Math.max(1e-3, flareH)));
      radius *= 1 + p.rootFlare * f * f * f;
    }
    if (o.collar) radius *= 1 + o.collar * Math.exp(-along / (r0 * 1.6));
    if (o.knobs) for (const k of o.knobs) radius *= 1 + k.r * Math.exp(-pts[s].distanceToSquared(new Vector3(...k.at)) / (k.w * k.w));
    const binormal = new Vector3().crossVectors(tangent, normal);
    const fade = Math.min(1, along / (r0 * 3 + 1e-3));
    // two frequencies: slow bends and short kinks
    const w1 = (fbm2(along * 2.2, seed, 911, 2, 1) + 0.45 * fbm2(along * 6.5, seed + 3, 915, 2, 1)) * amp * fade;
    const w2 = (fbm2(seed, along * 2.2, 913, 2, 1) + 0.45 * fbm2(seed - 3, along * 6.5, 917, 2, 1)) * amp * fade;
    const pos = pts[s].clone().addScaledVector(normal, w1).addScaledVector(binormal, w2);
    rings.push({ pos, tangent, normal: normal.clone(), radius, along });
  }
  const tube = makeTube(rings, level, v0, p, r0);
  tube.name = o.name;
  if (o.flat !== undefined && o.flat < 1) {
    tube.flat = o.flat;
    tube.flatPhase = random() * Math.PI;
    tube.flatTwist = o.flatTwist ?? 0.15;
  }
  tubes.push(tube);
  return tube;
}

/**
 * A buttress root: emerges from the flared base, runs out over the ground (following
 * `p.ground`), its top above the soil at first and buried by its tip; it may fork once.
 */
function growRoot(tubes: Tube[], angle: number, length: number, radius: number, p: TreeParams, random: Rand, forks: number, from?: { pos: Vector3; along: number }) {
  const ground = p.ground ?? (() => 0);
  const sec = Math.max(0.025, Math.min(0.05, radius * 0.4));
  const sections = Math.max(8, Math.round(length / sec));
  const step = length / sections;
  const pts: Vector3[] = [];
  const radii: number[] = [];
  let heading = angle;
  const turn = (random() - 0.5) * 0.8;
  // a root starts inside the flared base, so its open first ring never shows; it leaves the
  // trunk in a long gentle sweep (a tight bend would fold the tube on its inside)
  const start = from ? from.pos.clone() : new Vector3(Math.cos(angle) * p.trunkRadius * 0.3, p.trunkRadius * 0.85, Math.sin(angle) * p.trunkRadius * 0.3);
  let x = start.x;
  let z = start.z;
  for (let s = 0; s <= sections; s++) {
    const t = s / sections;
    const knuckle = 1 + 0.12 * Math.max(0, Math.sin(t * 13 + angle * 5));
    // a root keeps its body until it dives: no thin flat sliver at the surface
    // (a fork swells out of its parent root, so its first ring stays inside the parent's wood)
    const r = radius * (1 - 0.68 * Math.pow(t, 1.8)) * knuckle * (from ? 0.55 + 0.45 * smoothstep01(t / 0.25) : 0.75 + 0.25 * smoothstep01(t / 0.2));
    // the centre's height above the ground: a proud hump for most of its run, then a decided dive
    // under the soil (a root that runs out just above the ground shows as a thin flat sliver)
    const g = ground(x, z);
    const lie = g + r * (0.45 - 2.1 * Math.pow(t, 2.5));
    const emerge = from ? 1 : smoothstep01(t / 0.45);
    const y = start.y * (1 - emerge) + lie * emerge;
    pts.push(new Vector3(x, y, z));
    radii.push(r);
    heading += turn / sections + (random() - 0.5) * 0.12;
    x += Math.cos(heading) * step;
    z += Math.sin(heading) * step;
  }
  const rings: Ring[] = [];
  const tan0 = new Vector3();
  let normal = new Vector3();
  for (let s = 0; s <= sections; s++) {
    const a = pts[Math.max(0, s - 1)];
    const b = pts[Math.min(sections, s + 1)];
    const tangent = new Vector3().subVectors(b, a).normalize();
    if (s === 0) normal = perpendicular(tangent);
    else transport(tan0, tangent, normal);
    tan0.copy(tangent);
    rings.push({ pos: pts[s], tangent, normal: normal.clone(), radius: radii[s], along: (s / sections) * length });
  }
  const tube = makeTube(rings, 1, 0, p, radius, 0.5, true);
  tube.root = true;
  // roots are a little flattened, wider than tall, lying on the ground: the ellipse's long axis
  // (the frame's normal at phase 0) turned to the horizontal side of the root's run
  {
    const mid = rings[Math.floor(rings.length * 0.4)];
    const sideV = new Vector3().crossVectors(mid.tangent, UP);
    if (sideV.lengthSq() > 1e-8) {
      sideV.normalize();
      const bn = new Vector3().crossVectors(mid.tangent, mid.normal);
      tube.flatPhase = Math.atan2(sideV.dot(bn), sideV.dot(mid.normal));
    }
    tube.flat = 0.85;
    tube.flatTwist = 0;
  }
  tubes.push(tube);
  if (forks > 0) {
    const s = Math.round(sections * (0.3 + random() * 0.25));
    const side = random() < 0.5 ? -1 : 1;
    growRoot(tubes, angle + side * (0.5 + random() * 0.5), length * (0.45 + random() * 0.2), radii[s] * 0.75, p, random, forks - 1, { pos: pts[s], along: 0 });
  }
}

function makeTube(rings: Ring[], level: number, v0: number, p: TreeParams, base: number, furrowScale = 1, root = false): Tube {
  smoothFrames(rings);
  clampToBend(rings, p.bark ? 1 + 0.4 * (p.bark.burls ?? 0) + p.bark.lumps : 1.1);
  const bark = p.bark;
  const barked = bark && base >= bark.minRadius;
  // furrows around: from the radius a third of the way along (a flared base would overcount)
  const rRef = rings[Math.floor((rings.length - 1) * 0.33)].radius;
  const furrows = barked ? Math.max(4, Math.round(TAU * rRef * bark.furrows * furrowScale)) : 0;
  let radial: number;
  if (furrows > 0) radial = Math.min(104, Math.max(level <= 1 && !root ? 48 : 16, furrows * 6));
  else if (p.detail) radial = Math.max(3, Math.min(24, Math.round(3 + p.detail * base)));
  else radial = Math.max(3, p.radialSegments - level * 2);
  return { rings, radial, level, v0, id: 0, furrows, base, root, flat: 1, flatPhase: 0, flatTwist: 0 };
}

/**
 * A thick tube's rings follow its axis's direction averaged over about its own girth, not the
 * direction at a point: on a bend tighter than the tube is thick, perpendicular rings would
 * cross on the inside of the bend; averaged ones lean into it (the wood compresses there, as
 * in a real crook) and stay apart. Normals are re-projected so the frames stay continuous.
 */
function smoothFrames(rings: Ring[]) {
  const n = rings.length;
  if (n < 3) return;
  const tangents = rings.map((r) => r.tangent.clone());
  for (let i = 0; i < n; i++) {
    const w = rings[i].radius * 1.3;
    if (w < 0.02) continue;
    const t = new Vector3();
    for (let k = i; k >= 0 && rings[i].along - rings[k].along <= w; k--) t.addScaledVector(tangents[k], 1 - (rings[i].along - rings[k].along) / (w * 1.05));
    for (let k = i + 1; k < n && rings[k].along - rings[i].along <= w; k++) t.addScaledVector(tangents[k], 1 - (rings[k].along - rings[i].along) / (w * 1.05));
    if (t.lengthSq() < 1e-12) continue;
    t.normalize();
    rings[i].tangent.copy(t);
    const nn = rings[i].normal;
    nn.addScaledVector(t, -nn.dot(t));
    if (nn.lengthSq() > 1e-12) nn.normalize();
    else nn.copy(perpendicular(t));
  }
}

/**
 * A ring must not reach past the centre of its bend, or it crosses its neighbours on the inside
 * of the bend (a fin, a fold): clamp each radius to a share of the local radius of curvature,
 * then let the clamp ease in and out over a few rings. A safety net behind smoothFrames.
 */
function clampToBend(rings: Ring[], swell: number) {
  const n = rings.length;
  if (n < 3) return;
  const cap = rings.map((r) => r.radius);
  for (let i = 1; i < n - 1; i++) {
    const t0 = rings[i - 1].tangent;
    const t1 = rings[i + 1].tangent;
    const th = Math.acos(Math.max(-1, Math.min(1, t0.dot(t1))));
    if (th < 1e-3) continue;
    const ds = rings[i + 1].along - rings[i - 1].along;
    const R = ds / th;
    cap[i] = Math.min(cap[i], (0.95 * R) / swell);
  }
  // spread each clamp to its neighbours (a min filter), then ease it
  const lim = cap.slice();
  for (let i = 0; i < n; i++) for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < n) lim[i] = Math.min(lim[i], cap[i + k] + Math.abs(k) * 0.15 * cap[i + k]);
  for (let i = 0; i < n; i++) rings[i].radius = Math.min(rings[i].radius, lim[i]);
}

function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function smoothstep(a: number, b: number, x: number): number {
  return smoothstep01((x - a) / (b - a));
}

function perpendicular(v: Vector3): Vector3 {
  const a = Math.abs(v.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  return new Vector3().crossVectors(v, a).normalize();
}

const _axis = new Vector3();
function transport(t0: Vector3, t1: Vector3, n: Vector3) {
  _axis.crossVectors(t0, t1);
  const sin = _axis.length();
  if (sin < 1e-6) return;
  _axis.divideScalar(sin);
  n.applyAxisAngle(_axis, Math.atan2(sin, t0.dot(t1)));
}

function ringAt(tube: Tube, t: number): Ring {
  const rings = tube.rings;
  const f = Math.max(0, Math.min(0.999, t)) * (rings.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  const a = rings[i];
  const b = rings[Math.min(rings.length - 1, i + 1)];
  return {
    pos: a.pos.clone().lerp(b.pos, frac),
    tangent: a.tangent.clone().lerp(b.tangent, frac).normalize(),
    normal: a.normal.clone().lerp(b.normal, frac).normalize(),
    radius: a.radius + (b.radius - a.radius) * frac,
    along: a.along + (b.along - a.along) * frac,
  };
}

// ---- bark -----------------------------------------------------------------------------------

/** The cross-section's radial factor at angle `a`: an area-keeping ellipse of ratio `flat`, turned along the wood. */
function sectionAt(tube: Tube, a: number, along: number): number {
  if (tube.flat >= 0.999) return 1;
  const ph = tube.flatPhase + along * tube.flatTwist * TAU;
  const ca = Math.cos(a - ph);
  const sa = Math.sin(a - ph);
  const k = tube.flat;
  // semi-axes 1/√k and √k: x²k + y²/k = 1 in polar form
  return 1 / Math.sqrt(ca * ca * k + (sa * sa) / k);
}

/**
 * The furrows at angle `a` and `along`: `groove` 1 in a furrow's floor and 0 on the plates, the
 * furrow's depth factor (0..2: some run deep, some fade out and the plates merge), and the
 * strand's swell. The furrows wander by a warp that closes around the tube.
 */
/**
 * A furrow's depth and width, and a strand's swell, depend only on its index and the ring (`along`):
 * a ring's vertices share them. Remembered for the last ring asked about (the same values).
 */
const furrowMemo = { p: null as TreeParams | null, tube: null as Tube | null, along: NaN, deep: new Map<number, [number, number]>(), swell: new Map<number, number>() };

function furrowAt(p: TreeParams, tube: Tube, a: number, along: number): { groove: number; deep: number; swell: number } {
  const bark = p.bark;
  const n = tube.furrows;
  if (!bark || n === 0) return { groove: 0, deep: 0, swell: 0 };
  const seed = 300 + tube.id * 7;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = Math.max(0.7, n / 7);
  const wan = bark.wander ?? 0.4;
  const warp = wan * fbm2(c * k + along * 0.45, s * k + along * 0.8, seed, 2, 1) + wan * 0.5 * fbm2(c * k * 2.1 - along * 0.3, s * k * 2.1 + along * 1.9 + 4.7, seed + 9, 2, 1);
  const u = (a / TAU + along * bark.twist) * n + warp;
  const i = Math.round(u);
  const d = Math.abs(u - i);
  const fi = ((i % n) + n) % n;
  const memo = furrowMemo;
  if (memo.p !== p || memo.tube !== tube || !Object.is(memo.along, along)) {
    memo.p = p;
    memo.tube = tube;
    memo.along = along;
    memo.deep.clear();
    memo.swell.clear();
  }
  let dw = memo.deep.get(fi);
  if (!dw) {
    dw = [Math.max(0, Math.min(2.3, 1 + 1.3 * fbm2(fi * 7.31 + 0.5, along * 0.85, seed + 2, 2, 1))), 0.13 + 0.06 * fbm2(fi * 3.7 + 1.3, along * 1.6, seed + 3, 2, 1)];
    memo.deep.set(fi, dw);
  }
  const [deep, w] = dw;
  const groove = Math.exp(-(d * d) / (w * w));
  const sid = ((Math.floor(u) % n) + n) % n;
  let swell = memo.swell.get(sid);
  if (swell === undefined) {
    swell = 0.5 + 0.5 * fbm2(sid * 3.7 + 0.5, along * 1.3, seed + 1, 2, 1);
    memo.swell.set(sid, swell);
  }
  return { groove, deep, swell };
}

/** Radial displacement (fraction of the radius) of the bark at angle `a`, `along`, on a ring of `radius` (`fu`: furrowAt there, when known). */
function barkAt(p: TreeParams, tube: Tube, a: number, along: number, radius: number, fu?: { groove: number; deep: number; swell: number } | null): number {
  const bark = p.bark;
  if (!bark || tube.furrows === 0) return 0;
  const seed = 500 + tube.id * 11;
  const f = fu ?? furrowAt(p, tube, a, along);
  const depth = bark.depth * (tube.root ? 0.6 : 1);
  const ridge = -depth * f.groove * f.deep + depth * 0.3 * (1 - f.groove) * f.swell;
  // lumps and burls: functions of (cos a, sin a, along), so they close around the tube; broad and smooth
  const c = Math.cos(a);
  const s = Math.sin(a);
  const lump = 0.5 * fbm2(c * 0.8 + along * 0.25, along * 1.3 + s * 0.6, seed, 3, 1) + 0.5 * fbm2(s * 0.8 - along * 0.2, along * 1.3 - c * 0.6 + 7.1, seed + 1, 3, 1);
  const knot = tube.root ? 0 : smoothstep(0.2, 0.75, fbm2(c * 0.75 + 3.3 + along * 0.3, s * 0.75 + along * 1.15, seed + 2, 2, 1));
  const disp = ridge + bark.lumps * lump + (bark.burls ?? 0) * knot * knot;
  // thin wood stays smooth: the relief fades out below a few centimetres of radius
  return disp * smoothstep(0.02, 0.08, radius);
}

/** A knot's carving at a trunk vertex: radial offset (world units) and occlusion. */
function knotAt(knots: Knot[], tube: Tube, ringIndex: number, a: number, along: number, radius: number): { h: number; ao: number; smooth: number } | null {
  let h = 0;
  let ao = 1;
  let smooth = 0;
  let hit = false;
  const ring = tube.rings[ringIndex];
  const len = tube.rings[tube.rings.length - 1].along;
  const b = new Vector3().crossVectors(ring.tangent, ring.normal);
  for (const k of knots) {
    const s0 = k.at * len;
    const dy = along - s0;
    if (Math.abs(dy) > k.h * 2) continue;
    const f = new Vector3(...k.facing);
    f.addScaledVector(ring.tangent, -f.dot(ring.tangent));
    const a0 = Math.atan2(f.dot(b), f.dot(ring.normal)) + k.offset / Math.max(1e-3, radius);
    let da = a - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const dx = da * radius;
    // the almond's frame: tilted, unit at its edge
    const c = Math.cos(k.tilt);
    const s = Math.sin(k.tilt);
    const ex = (dx * c + dy * s) / (k.w * 0.5);
    const ey = (-dx * s + dy * c) / (k.h * 0.5);
    // almond: pinched at the corners
    const pinch = 1 - 0.55 * ex * ex;
    const rho = Math.hypot(ex, ey / Math.max(0.25, pinch));
    if (rho > 1.6) continue;
    hit = true;
    // the hollow, a soft rim around it, and the heavy upper lid that half closes it
    const inside = Math.max(0, 1 - rho * rho);
    // the lid's edge sits a little below the middle: half closed, sleepy
    const lidCover = smoothstep01((ey + 0.05) / 0.22);
    const rim = k.lid * 0.4 * Math.exp(-((rho - 1) * (rho - 1)) / 0.04);
    h += -k.depth * inside * (1 - lidCover) + k.lid * Math.sqrt(inside) * lidCover + rim;
    if (rho < 1) ao *= 0.1 + 0.9 * (1 - Math.sqrt(1 - rho * rho) * (1 - lidCover));
    smooth = Math.max(smooth, smoothstep01((1.5 - rho) / 0.5));
  }
  return hit ? { h, ao, smooth } : null;
}

// ---- geometry -------------------------------------------------------------------------------

/** The mesh of a skeleton: displaced bark, smooth normals over the displaced grid, UVs, AO + rim mask (rgba), aWind. */
export function treeGeometry(skel: TreeSkeleton): BufferGeometry {
  const { tubes, params: p } = skel;
  const ground = p.ground;
  const windLevel = p.windLevel ?? p.levels - 1;
  const rimTree = p.rim ?? 1;
  const [rimA, rimB] = p.rimRadius ?? [0.012, 0.04];
  let vertexCount = 0;
  let indexCount = 0;
  for (const { rings, radial } of tubes) {
    vertexCount += rings.length * (radial + 1);
    indexCount += (rings.length - 1) * radial * 6;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 4);
  const wind = new Float32Array(vertexCount);
  const indices = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount);
  const binormal = new Vector3();
  const grid: Vector3[] = [];
  const e1 = new Vector3();
  const e2 = new Vector3();
  const nrm = new Vector3();
  let vo = 0;
  let io = 0;
  for (const tube of tubes) {
    const { rings, radial, level, v0, base } = tube;
    const nr = rings.length;
    const length = rings[nr - 1].along;
    // texture repeats around: an integer, so the seam closes (one repeat ≈ 0.25 units of bark)
    const rRef = rings[Math.floor((nr - 1) * 0.33)].radius;
    const uRep = Math.max(1, Math.round((TAU * rRef) / 0.25));
    grid.length = 0;
    const ao: number[] = [];
    const rimV: number[] = [];
    for (let r = 0; r < nr; r++) {
      const { pos, tangent, normal, radius, along } = rings[r];
      binormal.crossVectors(tangent, normal);
      // occlusion where a branch leaves its parent
      const crotch = level === 0 || tube.root ? 1 : Math.min(1, along / (base * 5 + 1e-3));
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const kn = tube.name === 'trunk' && p.knots ? knotAt(p.knots, tube, r, a, along, radius) : null;
        // (the furrows here, for the bark and the occlusion both)
        const fu = tube.furrows > 0 ? furrowAt(p, tube, a, along) : null;
        // inside a knot the bark is smoothed so the carving reads
        const rr = radius * sectionAt(tube, a, along) * (1 + barkAt(p, tube, a, along, radius, fu) * (kn ? 1 - 0.8 * kn.smooth : 1)) + (kn ? kn.h : 0);
        const v = new Vector3(pos.x + (c * normal.x + s * binormal.x) * rr, pos.y + (c * normal.y + s * binormal.y) * rr, pos.z + (c * normal.z + s * binormal.z) * rr);
        grid.push(v);
        let o = (0.6 + 0.4 * crotch) * (fu ? 1 - 0.42 * fu.groove * Math.min(1, fu.deep) : 1) * (kn ? kn.ao : 1);
        // the rim's mask: none on thin twigs (they would read as neon wire), this tree's share
        // elsewhere; little near the ground and on the roots (the moon is behind the hill there)
        let rm = rimTree * smoothstep(rimA, rimB, radius) * (tube.root ? 0.45 : 1);
        if (ground && v.y < 1.2) {
          const h = v.y - ground(v.x, v.z);
          o *= 0.42 + 0.58 * smoothstep01((h + 0.03) / 0.5);
          rm *= 0.3 + 0.7 * smoothstep(0.05, 0.9, h);
        }
        ao.push(o);
        rimV.push(rm);
      }
    }
    for (let r = 0; r < nr; r++) {
      const along = rings[r].along;
      const ra = Math.max(0, r - 1);
      const rb = Math.min(nr - 1, r + 1);
      for (let j = 0; j <= radial; j++) {
        const jj = j % radial;
        const P = grid[r * radial + jj];
        // the normal of the displaced surface: around × along, wrapping around the tube
        e1.subVectors(grid[r * radial + ((jj + 1) % radial)], grid[r * radial + ((jj + radial - 1) % radial)]);
        e2.subVectors(grid[rb * radial + jj], grid[ra * radial + jj]);
        nrm.crossVectors(e1, e2);
        if (nrm.lengthSq() < 1e-14) nrm.subVectors(P, rings[r].pos);
        nrm.normalize();
        const o = vo + r * (radial + 1) + j;
        positions[o * 3] = P.x;
        positions[o * 3 + 1] = P.y;
        positions[o * 3 + 2] = P.z;
        normals[o * 3] = nrm.x;
        normals[o * 3 + 1] = nrm.y;
        normals[o * 3 + 2] = nrm.z;
        uvs[o * 2] = (j / radial) * uRep;
        uvs[o * 2 + 1] = (v0 + along) / 0.5;
        const c = ao[r * radial + jj];
        colors[o * 4] = c;
        colors[o * 4 + 1] = c;
        colors[o * 4 + 2] = c;
        colors[o * 4 + 3] = rimV[r * radial + jj];
        wind[o] = level >= windLevel && !tube.root ? along / Math.max(1e-4, length) : 0;
      }
    }
    for (let r = 0; r < nr - 1; r++) {
      const a = vo + r * (radial + 1);
      const b = a + radial + 1;
      for (let j = 0; j < radial; j++) {
        indices[io++] = a + j;
        indices[io++] = b + j + 1;
        indices[io++] = b + j;
        indices[io++] = a + j;
        indices[io++] = a + j + 1;
        indices[io++] = b + j + 1;
      }
    }
    vo += nr * (radial + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setAttribute('color', new BufferAttribute(colors, 4));
  g.setAttribute('aWind', new BufferAttribute(wind, 1));
  g.setIndex(new BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}
