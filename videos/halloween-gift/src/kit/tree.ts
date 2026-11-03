// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2010-2026 three.js authors
// Adapted from https://github.com/mrdoob/three.js/blob/r186/examples/jsm/generators/TreeGenerator.js
/**
 * Gnarled dead trees as one indexed BufferGeometry: a skeleton of tapered tubes swept with a
 * parallel-transport frame (never twisting), forking by the pipe model with a golden-angle roll,
 * pulled toward the light, sagging with gravity (three.js's TreeGenerator, MIT), plus what a
 * storybook tree needs: branch tips that curl into spirals (Rackham), a lean, buttress roots
 * that grip the ground, "hero" limbs placed by hand (the branch the ghosts hang from), UVs
 * (around × along, for bark) and a vertex colour that darkens crotches and the base (cheap
 * ambient occlusion) and records each vertex's level in alpha.
 *
 * Deterministic: all randomness comes from @aiv/core's hashed `rand(seed, id, k)` through a
 * per-build counter, so the same parameters build the same vertices on every page.
 * Generic: no film imports (listed in video.json `reusable`).
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

export interface HeroLimb {
  /** fraction up the trunk where it leaves */
  at: number;
  /** its initial direction (normalised by the builder) */
  dir: [number, number, number];
  length: number;
  /** base radius as a fraction of the trunk radius at that height */
  radius: number;
  /** total curl of this limb (radians), toward its tip */
  curl?: number;
  /** extra droop for this limb (gravity per unit length) */
  droop?: number;
  /** children along it (default: the level-1 count) */
  children?: number;
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
  roots: { count: number; length: number; radius: number };
  hero: HeroLimb[];
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

interface Ring {
  pos: Vector3;
  tangent: Vector3;
  normal: Vector3;
  radius: number;
  /** distance along this tube from its base */
  along: number;
}
interface Tube {
  rings: Ring[];
  radial: number;
  level: number;
  /** distance from the tree's base to this tube's base (bark v continuity) */
  v0: number;
}

/** Build a tree; `params` override the dead-tree defaults. Returns geometry with position, normal, uv, color. */
export function buildTree(params: Partial<TreeParams> & { seed: number }): BufferGeometry {
  const p: TreeParams = { ...DEAD_TREE, ...params };
  let k = 0;
  const random = () => rand(p.seed, 'tree', k++);
  const tubes: Tube[] = [];
  const dir = new Vector3(p.lean[0], 1, p.lean[1]).normalize();
  const trunk = grow(tubes, new Vector3(), dir, p.trunkLength, p.trunkRadius, 0, 0, p, random, p.curl[0]);
  for (const h of p.hero) {
    const ring = ringAt(trunk, h.at);
    const d = new Vector3(...h.dir).normalize();
    grow(tubes, ring.pos, d, h.length, Math.max(p.minRadius, ring.radius * h.radius), 1, ring.along, { ...p, droop: h.droop ?? p.droop, children: h.children ? [p.children[0], h.children, ...p.children.slice(2)] : p.children }, random, h.curl ?? p.curl[1]);
  }
  for (let i = 0; i < p.roots.count; i++) {
    const a = (i / p.roots.count) * TAU + (random() - 0.5) * 0.9;
    const d = new Vector3(Math.cos(a), -0.35 - random() * 0.3, Math.sin(a)).normalize();
    const base = new Vector3(Math.cos(a) * p.trunkRadius * 0.6, p.trunkRadius * 0.9, Math.sin(a) * p.trunkRadius * 0.6);
    growRoot(tubes, base, d, p.roots.length * (0.7 + random() * 0.6), p.trunkRadius * p.roots.radius * (0.7 + random() * 0.5), p, random);
  }
  return geometryOf(tubes);
}

function grow(tubes: Tube[], base: Vector3, dir: Vector3, length: number, baseRadius: number, level: number, v0: number, p: TreeParams, random: () => number, curl: number): Tube {
  const sections = Math.max(3, Math.min(40, Math.round(length / p.sectionLength)));
  const radial = Math.max(3, p.radialSegments - level * 2);
  const step = length / sections;
  const gnarl = p.gnarl[Math.min(level, p.gnarl.length - 1)];
  const start = level === 0 ? p.trunkClear : p.childStart;
  let tangent = dir.clone().normalize();
  const normal = perpendicular(tangent);
  // the curl turns about a fixed axis chosen per branch, harder toward the tip
  const curlAxis = perpendicular(tangent).applyAxisAngle(tangent, random() * TAU);
  const rings: Ring[] = [];
  const pos = base.clone();
  for (let s = 0; s <= sections; s++) {
    const t = s / sections;
    let radius = baseRadius * (1 - p.taper + p.taper * Math.pow(1 - t, p.taperCurve));
    if (level === 0 && p.rootFlare > 0) {
      const flare = Math.max(0, (p.flareFrac - t) / p.flareFrac);
      radius *= 1 + p.rootFlare * flare * flare * flare;
    }
    rings.push({ pos: pos.clone(), tangent: tangent.clone(), normal: normal.clone(), radius: Math.max(radius, p.minRadius * 0.6), along: t * length });
    if (s < sections) {
      const next = tangent.clone();
      next.x += (random() * 2 - 1) * gnarl;
      next.y += (random() * 2 - 1) * gnarl * 0.7;
      next.z += (random() * 2 - 1) * gnarl;
      if (level > 0) next.y -= p.droop * step;
      next.normalize();
      // the curl's share of this step: total `curl`, distributed as 4t^3 (tight at the tip)
      const dt = 1 / sections;
      const share = curl * (Math.pow(t + dt, 4) - Math.pow(t, 4));
      next.applyAxisAngle(curlAxis, share).normalize();
      transport(tangent, next, normal);
      pos.addScaledVector(next, step);
      tangent = next;
    }
  }
  const tube: Tube = { rings, radial, level, v0 };
  tubes.push(tube);
  if (level >= p.levels - 1 || length < p.minLength) return tube;
  const n = p.children[Math.min(level, p.children.length - 1)];
  const angle = p.branchAngle[Math.min(level, p.branchAngle.length - 1)];
  const pipeDrop = Math.pow(1 / n, 1 / p.radiusExponent);
  for (let i = 0; i < n; i++) {
    const t = start + ((i + 0.5 + (random() - 0.5) * 0.7) / n) * (1 - start);
    const ring = ringAt(tube, t);
    const tilt = (angle + (random() * 2 - 1) * p.angleVariance) * DEG;
    const roll = i * GOLDEN_ANGLE + (random() * 2 - 1) * 0.5;
    const childDir = ring.tangent.clone().applyAxisAngle(ring.normal, tilt).applyAxisAngle(ring.tangent, roll);
    if (p.upPull > 0) childDir.lerp(UP, p.upPull).normalize();
    const childBase = Math.max(p.minRadius, Math.min(baseRadius * pipeDrop, ring.radius * 0.92));
    let childLength = length * p.lengthRatio;
    if (p.lengthVariance > 0) childLength *= 1 + (random() * 2 - 1) * p.lengthVariance;
    const c = p.curl[Math.min(level + 1, p.curl.length - 1)] * (0.6 + random() * 0.8) * (random() < 0.5 ? -1 : 1);
    grow(tubes, ring.pos, childDir, childLength, childBase, level + 1, v0 + ring.along, p, random, c);
  }
  return tube;
}

/** A buttress root: thick, short, diving into the ground with a little wander. */
function growRoot(tubes: Tube[], base: Vector3, dir: Vector3, length: number, radius: number, p: TreeParams, random: () => number) {
  const sections = Math.max(4, Math.round(length / (p.sectionLength * 0.7)));
  const step = length / sections;
  let tangent = dir.clone();
  const normal = perpendicular(tangent);
  const rings: Ring[] = [];
  const pos = base.clone();
  for (let s = 0; s <= sections; s++) {
    const t = s / sections;
    rings.push({ pos: pos.clone(), tangent: tangent.clone(), normal: normal.clone(), radius: radius * (1 - 0.85 * Math.pow(t, 0.8)), along: t * length });
    if (s < sections) {
      const next = tangent.clone();
      next.x += (random() * 2 - 1) * 0.25;
      next.z += (random() * 2 - 1) * 0.25;
      next.y -= 0.18 * step * (1 + t);
      next.normalize();
      transport(tangent, next, normal);
      pos.addScaledVector(next, step);
      tangent = next;
    }
  }
  tubes.push({ rings, radial: Math.max(4, p.radialSegments - 2), level: 1, v0: 0 });
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
  const b = rings[i + 1];
  return {
    pos: a.pos.clone().lerp(b.pos, frac),
    tangent: a.tangent.clone().lerp(b.tangent, frac).normalize(),
    normal: a.normal.clone().lerp(b.normal, frac).normalize(),
    radius: a.radius + (b.radius - a.radius) * frac,
    along: a.along + (b.along - a.along) * frac,
  };
}

function geometryOf(tubes: Tube[]): BufferGeometry {
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
  const indices = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount);
  const binormal = new Vector3();
  let vo = 0;
  let io = 0;
  for (const { rings, radial, level, v0 } of tubes) {
    let o = vo;
    const base = rings[0].radius;
    for (let r = 0; r < rings.length; r++) {
      const { pos, tangent, normal, radius, along } = rings[r];
      binormal.crossVectors(tangent, normal);
      // occlusion: dark where a branch leaves its parent and at the trunk's foot
      const crotch = level === 0 ? Math.min(1, pos.y / 0.6) : Math.min(1, along / (base * 6 + 1e-3));
      const ao = 0.55 + 0.45 * crotch;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const nx = c * normal.x + s * binormal.x;
        const ny = c * normal.y + s * binormal.y;
        const nz = c * normal.z + s * binormal.z;
        positions[o * 3] = pos.x + nx * radius;
        positions[o * 3 + 1] = pos.y + ny * radius;
        positions[o * 3 + 2] = pos.z + nz * radius;
        normals[o * 3] = nx;
        normals[o * 3 + 1] = ny;
        normals[o * 3 + 2] = nz;
        // bark coordinates in world units: around the circumference, along the wood
        uvs[o * 2] = (j / radial) * Math.max(0.05, TAU * radius);
        uvs[o * 2 + 1] = v0 + along;
        colors[o * 4] = ao;
        colors[o * 4 + 1] = ao;
        colors[o * 4 + 2] = ao;
        colors[o * 4 + 3] = level / 4;
        o++;
      }
    }
    for (let r = 0; r < rings.length - 1; r++) {
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
    vo += rings.length * (radial + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setAttribute('color', new BufferAttribute(colors, 4));
  g.setIndex(new BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}
