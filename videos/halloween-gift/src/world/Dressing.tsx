/**
 * The ground's dressing: everything that lies on or grows out of the turf and the track.
 *  - Rocks (kit/rocks.ts): chiselled, faceted, bedded and cracked boulders under and in front of the giant
 *    jack-o'-lantern (a low seat under it, SEAT_HEIGHT; an upright hero slab at its front left,
 *    a low wedge under its grin, chunks behind), more at the big cross and the root mass, stones
 *    along the track's edges and at the fence bases, a few sunk flat stones and broken slabs in
 *    the track (only their caps show), cracked rock ledges along its front run, clustered pebbles; a soft dark contact shadow on the
 *    ground under every stone. Three merged meshes.
 *  - The root mass in the front-right corner (LAND.roots): a broad, gnarled, hollow stump and its
 *    roots grown with kit/tree.ts (its bark: a few shallow furrows wandering far, big burls and
 *    lumps, never a ribbed column), its broken top rolled over into rounded, lumpy shoulders, the
 *    roots' radius swelling and knuckled along them, two roots climbing down from high on the
 *    stump, crawling roots that kink and arch over the ground, buttresses creeping back over the
 *    turf toward the RIP stone; plum bark held up by a warm wrap fill, nearly black in its
 *    hollows; tiny almond eyes (warm amber) in its dark gaps, where a ray from the hero camera
 *    sees them, blinking now and then from the frame number. Straw and tall grass grow on its
 *    roots (`rootGrass`, used by world/Grass.tsx).
 *  - Cobwebs (kit/cobweb.ts): old torn webs with long sagging tethers, between the roots, the
 *    rocks and the big cross, faintly warm, glinting where silk lies across the light.
 *  - Fallen leaves and twigs along the track's edges and round the door yard's trodden middle.
 * Everything stands at layout positions and sits in the ground: bases sink below the lowest
 * ground under their footprint (Terrain's surfaceHeight), vertex colour darkens them near it.
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Euler, Matrix4, PerspectiveCamera, Quaternion, Shape, ShapeGeometry, Vector3, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { orbWeb, threadRibbons, type Thread } from '../kit/cobweb.ts';
import { mergeRocks, rockGeometry, type PlacedRock, type RockParams } from '../kit/rocks.ts';
import { growTree, surfacePoint, treeGeometry, type TreeSkeleton, type Tube, type V3 } from '../kit/tree.ts';
import { NIGHT, storybookMaterial } from '../look/materials.ts';
import { bigCrossFrame } from './Graveyard.tsx';
import { FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, HERO, LAND, PATH, pathHalfWidth } from './layout.ts';
import { APRON, dirtHalf, fbm, groundShading, PLUM, surfaceHeight, trackAt, yardCentre, yardMask } from './Terrain.tsx';

/** The hero camera (layout's HERO): webs face it, and the eyes are placed where it sees them. */
const HERO_EYE = new Vector3(...HERO.pos);
const HERO_CAM = new PerspectiveCamera(HERO.fov, 16 / 9, 0.05, 80);
HERO_CAM.position.copy(HERO_EYE);
HERO_CAM.lookAt(...HERO.look);
HERO_CAM.updateMatrixWorld();
const Y0 = FLOOR + 0.004;
const gy = (x: number, z: number) => Y0 + surfaceHeight(x, z);

/** The warm fill and the plum shade every dressing surface takes (Terrain's groundShading). */
const WARM_WRAP: [string, number] = ['#e8c8c0', 0.26];
const PLUM_SHADE: [string, number] = [PLUM, 0.75];

// ---- the big boulders (data shared with the grass) -------------------------------------------

export interface Boulder {
  x: number;
  z: number;
  /** half extents */
  size: [number, number, number];
  yaw: number;
  seed: number;
  /** how deep its base sinks (fraction of its half height) */
  sink: number;
  /** footprint radius (grass stays out) */
  r: number;
  /** its shape (rockGeometry parameters) */
  shape: Partial<RockParams>;
}

/** Upright chiselled slabs, chunky blocks and small stones: rockGeometry presets. */
// (bedded into ledges, cracked, sharp-edged: a smooth faceted blob read as soap)
// (sharper: deeper flat cuts, more facets, hard creases, a hairline bevel; a soft bevel read as river stones)
const SLAB: Partial<RockParams> = { detail: 22, facets: 14, cut: 0.6, noise: 0.035, freq: 1.4, boxy: 3, bevel: 0.006, grit: 0.018, gritFreq: 13, cracks: 4, chips: 10, topTilt: 0.5, ao: 0.65, crease: 40, strata: 3, strataDepth: 0.09, strataTilt: 0.2 };
const CHUNK: Partial<RockParams> = { detail: 12, facets: 14, cut: 0.55, noise: 0.04, freq: 1.3, boxy: 2.8, bevel: 0.008, grit: 0.018, gritFreq: 12, cracks: 3, chips: 8, ao: 0.65, crease: 40, strata: 3, strataDepth: 0.075, strataTilt: 0.25 };
const SMALL: Partial<RockParams> = { detail: 7, facets: 9, cut: 0.38, noise: 0.05, boxy: 2.6, bevel: 0.04, chips: 2, ao: 0.55, crease: 30 };

const P = LAND.bigPumpkin;
const B = (x: number, z: number, size: [number, number, number], yaw: number, seed: number, sink: number, shape: Partial<RockParams>): Boulder => ({ x, z, size, yaw, seed, sink, r: Math.max(size[0], size[2]), shape });
/** The yaw that turns a slab's broad face (local +z) toward the hero camera. */
const facing = (x: number, z: number, turn = 0) => Math.atan2(HERO_EYE.x - x, HERO_EYE.z - z) + turn;

/** Big boulders: the jack-o'-lantern's pile, the big cross's foot, the root mass's foot. */
export const BOULDERS: Boulder[] = [
  // the seat under the giant pumpkin: low and flat-topped, mostly hidden under it
  B(P.x - 0.04, P.z - 0.04, [0.5, 0.32, 0.44], 0.4, 1, 0.12, { ...CHUNK, topTilt: 0.08 }),
  // the hero slab at its front left: upright, chiselled, a sloped top, its broad face to the viewer
  B(P.x - 0.32, P.z + 0.5, [0.27, 0.46, 0.16], facing(P.x - 0.32, P.z + 0.5, 0.25), 2, 0.12, SLAB),
  // a low wedge under its grin (clear of the pop-up spot)
  B(P.x + 0.1, P.z + 0.6, [0.22, 0.24, 0.15], facing(P.x + 0.1, P.z + 0.6, -0.4), 3, 0.12, { ...SLAB, topTilt: 0.75, detail: 18 }),
  // behind, left and right: big chunks
  B(P.x - 0.8, P.z - 0.1, [0.36, 0.38, 0.3], 2.4, 4, 0.15, CHUNK),
  B(P.x + 0.42, P.z - 0.36, [0.26, 0.28, 0.24], 1.7, 5, 0.15, CHUNK),
  // small ones at the pile's foot
  B(P.x - 0.12, P.z + 0.9, [0.11, 0.09, 0.1], 0.2, 6, 0.25, SMALL),
  B(P.x + 0.72, P.z - 0.02, [0.14, 0.12, 0.12], 1.1, 7, 0.22, SMALL),
  B(P.x - 0.95, P.z + 0.42, [0.22, 0.28, 0.17], facing(P.x - 0.95, P.z + 0.42, 0.5), 8, 0.15, { ...SLAB, detail: 16, topTilt: 0.35 }),
  // the big cross's foot
  B(LAND.bigCross.x + 0.32, LAND.bigCross.z + 0.2, [0.24, 0.24, 0.22], 0.6, 9, 0.15, CHUNK),
  B(LAND.bigCross.x - 0.3, LAND.bigCross.z - 0.28, [0.3, 0.27, 0.28], 2.0, 10, 0.15, CHUNK),
  // at the root mass's foot, on the apron's edge
  B(LAND.roots.x - 0.62, LAND.roots.z - 0.22, [0.17, 0.15, 0.16], 0.3, 11, 0.2, SMALL),
  B(LAND.roots.x - 0.3, LAND.roots.z - 0.62, [0.14, 0.12, 0.13], 1.3, 12, 0.2, SMALL),
];
/** The height above the ground where the giant jack-o'-lantern can sit on its boulder (world units). */
export const SEAT_HEIGHT = 0.44;

/** The root mass's stump: centre and footprint (grass stays out). */
const ROOT_C = { x: LAND.roots.x + 0.22, z: LAND.roots.z - 0.06 };
export const ROOTS_FOOTPRINT = { x: ROOT_C.x, z: ROOT_C.z, r: 0.62 };

// ---- rocks ------------------------------------------------------------------------------------

/** The lowest ground under a footprint (centre and a ring at `r`). */
function lowestGround(x: number, z: number, r: number): number {
  let m = gy(x, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m = Math.min(m, gy(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return m;
}

/** A rock's placement: its base sunk `sink` of its half height below the lowest ground under it, tilted a little with the slope. */
function seat(x: number, z: number, size: [number, number, number], yaw: number, sink: number, base = -0.55, lean: [number, number] = [0, 0]): Matrix4 {
  const fr = Math.max(size[0], size[2]) * 0.8;
  const g = lowestGround(x, z, fr);
  const y = g - sink * size[1] - base * size[1];
  const e = 0.05;
  const nx = (gy(x - e, z) - gy(x + e, z)) / (2 * e);
  const nz = (gy(x, z - e) - gy(x, z + e)) / (2 * e);
  const q = new Quaternion().setFromEuler(new Euler(nz * 0.6 + lean[0], yaw, -nx * 0.6 + lean[1], 'YXZ'));
  return new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1));
}

/** A stone's soft contact shadow on the ground: centre, radius, darkness. */
interface Contact {
  x: number;
  z: number;
  r: number;
  a: number;
}

/** Power-law sizes (many small, few large): s in [min, min × ratio]. */
function powerSize(u: number, min: number, ratio: number, a = 2.4): number {
  const k = a - 1;
  return min * (1 - u * (1 - ratio ** -k)) ** (-1 / k);
}

function rockSets() {
  const big: PlacedRock[] = [];
  const small: PlacedRock[] = [];
  const contacts: Contact[] = [];
  const geos: BufferGeometry[] = [];
  const keep = (g: BufferGeometry) => (geos.push(g), g);
  // plum-tinted near the lens (the reference's warm darks), slate further back
  const tintOf = (k: number, dark: number, near = 0) => new Color().setScalar(dark).lerp(new Color('#a87584'), 0.12 * rand(30, k, 0) + 0.35 * near);
  BOULDERS.forEach((b, i) => {
    const g = keep(rockGeometry({ seed: 100 + b.seed, size: b.size, base: -0.55, ...b.shape }));
    big.push({ geometry: g, matrix: seat(b.x, b.z, b.size, b.yaw, b.sink), tint: tintOf(i, 0.8 + 0.3 * rand(31, i, 0), smoothstep(2.2, 3.8, b.z)) });
    contacts.push({ x: b.x, z: b.z, r: b.r * 1.45, a: 0.6 });
  });
  // a few shapes reused for the many small ones
  const shapes = Array.from({ length: 8 }, (_, i) => keep(rockGeometry({ seed: 300 + i, detail: i < 4 ? 2 : 1, facets: 10, cut: 0.38, noise: 0.06, size: [1, 0.7, 0.85], base: -0.4, ao: 0.5, crease: 28, boxy: 2.8, bevel: 0.05, chips: 2 })));
  const flats = Array.from({ length: 4 }, (_, i) => keep(rockGeometry({ seed: 400 + i, detail: 2, facets: 8, cut: 0.3, noise: 0.05, size: [1, 0.3, 0.78], base: -0.3, ao: 0.35, crease: 28, boxy: 2.6, bevel: 0.06 })));
  // broken slabs: angular, flat, a corner raised
  const brokens = Array.from({ length: 4 }, (_, i) => keep(rockGeometry({ seed: 450 + i, detail: 4, facets: 9, cut: 0.46, noise: 0.03, size: [1, 0.26, 0.72], base: -0.2, ao: 0.4, crease: 26, boxy: 3.2, bevel: 0.035, chips: 4, cracks: 1, topTilt: 0.12 })));
  const pebbles = Array.from({ length: 8 }, (_, i) => keep(rockGeometry({ seed: 500 + i, detail: i < 3 ? 1 : 0, facets: 4, cut: 0.25, noise: 0.12, size: [1, 0.65, 0.85], base: -0.4, ao: 0.4, crease: 0, bevel: 0.08 })));
  const clear = (x: number, z: number, r: number) => {
    if (yardMask(x, z, 0.1) > 0) return false;
    for (const b of BOULDERS) if (Math.hypot(x - b.x, z - b.z) < b.r + r) return false;
    return Math.hypot(x - ROOT_C.x, z - ROOT_C.z) > ROOTS_FOOTPRINT.r + 0.2 + r;
  };
  // stones along the track's edges (both sides of the path, and of the apron): half sunk in the bank
  let n = 0;
  const edgeStone = (x: number, z: number, s: number, k: number) => {
    if (!clear(x, z, s)) return;
    const size: [number, number, number] = [s, s * (0.55 + 0.3 * rand(32, k, 1)), s * (0.7 + 0.3 * rand(32, k, 2))];
    small.push({ geometry: shapes[k % shapes.length], matrix: seat(x, z, size, rand(32, k, 3) * 6.28, 0.45, -0.28).multiply(new Matrix4().makeScale(...size)), tint: tintOf(k, 0.62 + 0.3 * rand(32, k, 4)) });
    contacts.push({ x, z, r: s * 1.6, a: 0.5 });
  };
  for (let s = 0.2; s < PATH.length - 0.2; s += 0.16) {
    for (const side of [-1, 1]) {
      const k = n++;
      if (rand(33, k, 0) < 0.6) continue;
      const p = PATH.pointAt(s);
      const t = PATH.tangentAt(s);
      const u = side * (dirtHalf(s) + 0.02 + 0.06 * (rand(33, k, 1) - 0.3));
      const x = p[0] - t[1] * u;
      const z = p[1] + t[0] * u;
      if (trackAt(x, z).apron > 0.3) continue;
      edgeStone(x, z, powerSize(rand(33, k, 2), 0.03, 4), k);
    }
  }
  for (let s = 0.3; s < APRON.length - 0.6; s += 0.14) {
    for (const side of [-1, 1]) {
      const k = n++;
      if (rand(34, k, 0) < 0.55) continue;
      const p = APRON.pointAt(s);
      const t = APRON.tangentAt(s);
      const tr0 = trackAt(p[0], p[1]);
      // out from the apron's centre to its edge here
      let u = 0;
      for (let q = 0; q < 24 && trackAt(p[0] - t[1] * u * side, p[1] + t[0] * u * side).edge < 0; q++) u += 0.05;
      if (tr0.m < 0.5) continue;
      u += 0.03 + 0.06 * (rand(34, k, 1) - 0.3);
      edgeStone(p[0] - t[1] * u * side, p[1] + t[0] * u * side, powerSize(rand(34, k, 2), 0.035, 4), k);
    }
  }
  // stones at the fence bases
  for (const line of [FENCE_LINE, FENCE_LINE_RIGHT])
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1];
      const [bx, bz] = line[i];
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 0.1; d < len; d += 0.22) {
        const k = n++;
        if (rand(35, k, 0) < 0.55) continue;
        const t = d / len;
        const off = (rand(35, k, 1) - 0.5) * 0.12;
        edgeStone(ax + (bx - ax) * t - ((bz - az) / len) * off, az + (bz - az) * t + ((bx - ax) / len) * off, 0.03 + 0.06 * rand(35, k, 2), k);
      }
    }
  // flat stones and broken slabs sunk in the track: sparse, in clusters, only their caps show
  const onTrack = (k: number, seedK: number, apronShare: number, spread: number): [number, number] => {
    if (rand(seedK, k, 0) < apronShare) {
      const s = 0.2 + rand(seedK, k, 1) * (APRON.length - 0.6);
      const p = APRON.pointAt(s);
      const t = APRON.tangentAt(s);
      const u = (rand(seedK, k, 2) * 2 - 1) * 0.7 * spread;
      return [p[0] - t[1] * u, p[1] + t[0] * u];
    }
    const s = rand(seedK, k, 1) ** 1.4 * PATH.length;
    const p = PATH.pointAt(s);
    const t = PATH.tangentAt(s);
    const u = (rand(seedK, k, 2) * 2 - 1) * dirtHalf(s) * 0.85 * spread;
    return [p[0] - t[1] * u, p[1] + t[0] * u];
  };
  for (let k = 0, placed = 0; k < 900 && placed < 22; k++) {
    const [x, z] = onTrack(k, 36, 0.4, 1);
    const tr = trackAt(x, z);
    if (tr.m < 0.85) continue;
    if (fbm(x, z, 37, 2, 1.8) < 0.05 + 0.25 * rand(36, k, 3)) continue;
    const s = powerSize(rand(36, k, 4), 0.05, 3.2);
    if (!clear(x, z, s)) continue;
    const broken = rand(36, k, 11) < 0.35;
    const size: [number, number, number] = [s, s, s * (0.7 + 0.3 * rand(36, k, 5))];
    const g = lowestGround(x, z, s * 0.7);
    // sunk: a flat stone's top is at about 0.24 of its size, a broken slab's at 0.2; a third to a fifth of it shows
    const y = g - (broken ? 0.12 : 0.15) * s + 0.004 * rand(36, k, 6);
    const tiltA = broken ? 0.18 : 0.06;
    const q = new Quaternion().setFromEuler(new Euler((rand(36, k, 7) - 0.5) * tiltA * 2, rand(36, k, 8) * 6.28, (rand(36, k, 9) - 0.5) * tiltA * 2, 'YXZ'));
    const m = new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(...size));
    small.push({ geometry: broken ? brokens[k % brokens.length] : flats[k % flats.length], matrix: m, tint: new Color().setScalar(0.9 + 0.35 * rand(36, k, 10)) });
    contacts.push({ x, z, r: s * 1.35, a: 0.45 });
    placed++;
  }
  // cracked rock ledges along the track's front run (the reference's slabs at the bottom of the
  // frame): broad, flat, bedded and cracked, sharp-edged, a corner or an edge lifted out of the dirt
  const ledges = Array.from({ length: 3 }, (_, i) => keep(rockGeometry({ seed: 470 + i, detail: 12, facets: 10, cut: 0.44, noise: 0.03, freq: 1.6, size: [1, 0.3, 0.7], base: -0.25, ao: 0.6, crease: 26, boxy: 3.4, bevel: 0.012, grit: 0.018, gritFreq: 14, chips: 6, cracks: 3, topTilt: 0.1, strata: 2, strataDepth: 0.1, strataTilt: 0.15 })));
  // (the hero view's foot, rows 840-1080, sees the apron's first metre, z ≈ 2.2 to 3.3; only on
  // the apron: Clawd's walk keeps to the path)
  for (let k = 0, placed = 0; k < 600 && placed < 6; k++) {
    const sa = 0.1 + rand(39, k, 0) * 1.1;
    const p = APRON.pointAt(sa);
    const t = APRON.tangentAt(sa);
    const u = (rand(39, k, 1) * 2 - 1) * 0.6;
    const x = p[0] - t[1] * u;
    const z = p[1] + t[0] * u;
    const s = 0.16 + 0.14 * rand(39, k, 2);
    const trL = trackAt(x, z);
    if (!clear(x, z, s * 0.8) || trL.m < 0.85 || trL.apron < 0.6) continue;
    if (small.some((r) => Math.hypot(r.matrix.elements[12] - x, r.matrix.elements[14] - z) < s + 0.08)) continue;
    const size: [number, number, number] = [s, s * (0.75 + 0.3 * rand(39, k, 3)), s * (0.6 + 0.3 * rand(39, k, 8))];
    const g = lowestGround(x, z, s * 0.6);
    const q = new Quaternion().setFromEuler(new Euler((rand(39, k, 4) - 0.5) * 0.3, rand(39, k, 5) * 6.28, (rand(39, k, 6) - 0.5) * 0.3, 'YXZ'));
    // sunk: only the ledge's top and its lifted edge stand out of the dirt
    const m = new Matrix4().compose(new Vector3(x, g - 0.06 * s, z), q, new Vector3(...size));
    small.push({ geometry: ledges[k % ledges.length], matrix: m, tint: new Color('#b49aa6').multiplyScalar(0.85 + 0.25 * rand(39, k, 7)) });
    contacts.push({ x, z, r: s * 1.25, a: 0.5 });
    placed++;
  }
  // pebbles: about eighty, in clusters along the ruts' edges and the banks, a power-law of sizes, half sunk
  for (let k = 0, placed = 0; k < 6000 && placed < 80; k++) {
    const x = -2.6 + rand(38, k, 0) * 7.2;
    const z = -1.6 + rand(38, k, 1) * 6.0;
    const tr = trackAt(x, z);
    if (tr.m < 0.3) continue;
    if (fbm(x, z, 40, 2, 2.6) < 0.2) continue;
    const bank = 1 - Math.min(1, Math.abs(tr.edge + 0.07) / 0.14);
    const rutEdge = Math.exp(-(((Math.abs(tr.apron > 0.5 ? tr.ua : tr.u) - 0.22) / 0.06) ** 2));
    if (rand(38, k, 2) > 0.12 + 0.6 * Math.max(bank, rutEdge)) continue;
    const s = powerSize(rand(38, k, 3), 0.006, 8);
    const g = gy(x, z);
    const m = new Matrix4().compose(new Vector3(x, g - s * 0.25, z), new Quaternion().setFromEuler(new Euler(rand(38, k, 4) * 0.5, rand(38, k, 5) * 6.28, rand(38, k, 6) * 0.5)), new Vector3(s, s, s));
    small.push({ geometry: pebbles[k % pebbles.length], matrix: m, tint: new Color().setScalar(0.65 + 0.5 * rand(38, k, 7)) });
    if (s > 0.014) contacts.push({ x, z, r: s * 1.8, a: 0.4 });
    placed++;
  }
  const ground = (x: number, z: number) => gy(x, z);
  const bigGeo = mergeRocks(big, { ground, contact: 0.12, contactDark: 0.7 });
  const smallGeo = mergeRocks(small, { ground, contact: 0.03, contactDark: 0.6 });
  geos.forEach((g) => g.dispose());
  return { bigGeo, smallGeo, contacts };
}

/** Soft dark discs on the ground under the stones (contact shadows), conforming to the ground; rgba. */
function contactGeometry(contacts: Contact[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const RINGS = 2;
  const SEG = 11;
  for (const c of contacts) {
    const base = pos.length / 3;
    pos.push(c.x, gy(c.x, c.z) + 0.003, c.z);
    col.push(0, 0, 0, c.a);
    for (let r = 1; r <= RINGS; r++) {
      const rr = (c.r * r) / RINGS;
      const a = c.a * (1 - r / RINGS) ** 1.6;
      for (let s = 0; s < SEG; s++) {
        const t = (s / SEG) * Math.PI * 2;
        const x = c.x + Math.cos(t) * rr;
        const z = c.z + Math.sin(t) * rr;
        pos.push(x, gy(x, z) + 0.003, z);
        col.push(0, 0, 0, a);
      }
    }
    for (let s = 0; s < SEG; s++) idx.push(base, base + 1 + ((s + 1) % SEG), base + 1 + s);
    for (let r = 1; r < RINGS; r++)
      for (let s = 0; s < SEG; s++) {
        const a = base + 1 + (r - 1) * SEG + s;
        const b = base + 1 + (r - 1) * SEG + ((s + 1) % SEG);
        idx.push(a, b, a + SEG, b, b + SEG, a + SEG);
      }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function Rocks() {
  const { bigGeo, smallGeo, shadowGeo, bigMat, smallMat, shadowMat } = useMemo(() => {
    const { bigGeo, smallGeo, contacts } = rockSets();
    // dark plum slate boulders, moss and moonlit lichen on their tops
    const bigMat = groundShading(storybookMaterial({ kind: 'stone', vertexColors: true, color: '#3b3240', color2: '#4b6064', breakup: 0.4, scale: 0.09, bump: 1.6, topCoat: 0.4, rim: 1.7, roughness: 0.82 }), { wrap: WARM_WRAP, shade: PLUM_SHADE, grain: [0.012, 0.5] });
    // the track's stones: a little paler, dusty
    const smallMat = groundShading(storybookMaterial({ kind: 'stone', vertexColors: true, color: '#4f4a54', color2: '#666d72', breakup: 0.35, scale: 0.05, bump: 1.3, topCoat: 0.25, rim: 1.3, roughness: 0.85 }), { wrap: WARM_WRAP, shade: PLUM_SHADE });
    const shadowGeo = contactGeometry(contacts);
    const shadowMat = storybookMaterial({ color: '#000000', vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, rim: 0, breakup: 0 });
    return { bigGeo, smallGeo, shadowGeo, bigMat, smallMat, shadowMat };
  }, []);
  useLayoutEffect(() => () => (bigGeo.dispose(), smallGeo.dispose(), shadowGeo.dispose(), bigMat.dispose(), smallMat.dispose(), shadowMat.dispose()), [bigGeo, smallGeo, shadowGeo, bigMat, smallMat, shadowMat]);
  return (
    <>
      <mesh geometry={bigGeo} material={bigMat} castShadow receiveShadow />
      <mesh geometry={smallGeo} material={smallMat} receiveShadow />
      <mesh geometry={shadowGeo} material={shadowMat} renderOrder={1} />
    </>
  );
}

// ---- the root mass ------------------------------------------------------------------------------

/** World angle (atan2(z, x)) from the stump toward the hero camera: its folds and eyes face it. */
const CAM_A = Math.atan2(HERO_EYE.z - ROOT_C.z, HERO_EYE.x - ROOT_C.x);
/** The stump's base (world y): the lowest ground under it, sunk a little. */
let rootBaseY: number | null = null;
const baseY = () => (rootBaseY ??= lowestGround(ROOT_C.x, ROOT_C.z, 0.5) - 0.04);
/** The ground's height in the root mass's local frame (origin at the stump's base). */
const localGround = (x: number, z: number) => gy(ROOT_C.x + x, ROOT_C.z + z) - baseY();
const dirOf = (a: number) => [Math.cos(a), Math.sin(a)] as const;

/** A point out from the stump: world angle, distance, height above the local ground (or above the base with `abs`). */
function rp(a: number, d: number, h: number, abs = false): V3 {
  const [cx, cz] = dirOf(a);
  const x = cx * d;
  const z = cz * d;
  return [x, abs ? h : localGround(x, z) + h, z];
}

const STUMP_R = 0.5;
/** The stump's height: a low, broad, gnarled mass (a tall one read as a ribbed column from above). */
const STUMP_H = 1.42;
/** heights on the stump scale with it (the plans were drawn for a 1.5 tall stump) */
const SH = STUMP_H / 1.5;

interface RootPlan {
  /** fraction up the stump where it leaves, radius (fraction of the stump's there), tip */
  at: number;
  radius: number;
  tip: number;
  /** control points (local) */
  path: V3[];
  /** its cross-section's minor / major ratio (old roots are flattened, never round hoses) */
  flat?: number;
  /** angular kinks: its path a polyline, the corners rounded over this distance */
  elbow?: number;
}

/**
 * A buttress root creeping away over the ground from the stump's foot (world angle `a`, length
 * `len`): it leaves the stump's flank in a broad knuckle, arches over the turf in two or three
 * humps (gaps under them: the eyes' hollows), its run kinking left and right, and dives in.
 */
function buttress(a: number, len: number, hump: number, k: number): V3[] {
  const R = STUMP_R;
  const n = 7;
  const pts: V3[] = [[0, 0, 0], rp(a, R * 0.85, 0.34 * SH + 0.08 * rand(84, k, 0), true)];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const wob = (rand(84, k, i) - 0.5) * 0.16 * (1 - t * 0.5);
    // humps: high near the stump, a lower arch farther out, then down into the ground
    const h = hump * (0.9 * Math.exp(-(((t - 0.12) / 0.16) ** 2)) + 0.55 * Math.exp(-(((t - 0.52) / 0.14) ** 2)) + 0.3 * Math.exp(-(((t - 0.8) / 0.1) ** 2))) + 0.02 - 0.12 * t ** 4;
    pts.push(rp(a + wob, R + len * t, h));
  }
  return pts;
}

/** The roots: two climbing down from high on the stump, crawling ones that kink and arch (the eyes' gaps), buttresses creeping back toward the RIP stone. */
function rootPlans(): RootPlan[] {
  const A = CAM_A;
  const R = STUMP_R;
  // (old roots: flattened sections, angular kinks, tapering to a quarter of their base)
  return [
    // climbing roots: from high on the stump down to the ground toward the viewer's left (the reference's sloping mass)
    { at: 0.62, radius: 0.33, tip: 0.24, flat: 0.66, elbow: 0.1, path: [[0, 0, 0], rp(A + 0.72, R * 0.95, 0.98 * SH, true), rp(A + 0.8, R + 0.28, 0.62 * SH, true), rp(A + 0.86, R + 0.62, 0.2), rp(A + 0.9, R + 0.95, 0.06), rp(A + 0.95, R + 1.3, -0.1)] },
    { at: 0.5, radius: 0.3, tip: 0.24, flat: 0.66, elbow: 0.1, path: [[0, 0, 0], rp(A + 0.1, R * 0.95, 0.78 * SH, true), rp(A + 0.14, R + 0.22, 0.48 * SH, true), rp(A + 0.2, R + 0.5, 0.12), rp(A + 0.24, R + 0.78, 0.05), rp(A + 0.3, R + 1.0, -0.1)] },
    // crawling roots toward the viewer and the track: humped, kinked at an elbow, diving under
    { at: 0.06, radius: 0.3, tip: 0.22, flat: 0.6, elbow: 0.07, path: [[0, 0, 0], rp(A + 0.42, R * 0.9, 0.3, true), rp(A + 0.44, R + 0.14, 0.14), rp(A + 0.5, R + 0.34, 0.17), rp(A + 0.47, R + 0.46, 0.05), rp(A + 0.53, R + 0.62, 0.11), rp(A + 0.58, R + 0.86, -0.09)] },
    { at: 0.05, radius: 0.29, tip: 0.22, flat: 0.6, elbow: 0.07, path: [[0, 0, 0], rp(A + 1.2, R * 0.9, 0.28, true), rp(A + 1.24, R + 0.16, 0.1), rp(A + 1.32, R + 0.38, 0.15), rp(A + 1.28, R + 0.55, 0.04), rp(A + 1.36, R + 0.78, 0.07), rp(A + 1.42, R + 1.02, -0.08)] },
    { at: 0.05, radius: 0.28, tip: 0.22, flat: 0.6, elbow: 0.07, path: [[0, 0, 0], rp(A - 0.4, R * 0.9, 0.26, true), rp(A - 0.42, R + 0.12, 0.09), rp(A - 0.36, R + 0.3, 0.13), rp(A - 0.44, R + 0.46, 0.03), rp(A - 0.4, R + 0.66, -0.08)] },
    { at: 0.06, radius: 0.28, tip: 0.22, flat: 0.6, elbow: 0.07, path: [[0, 0, 0], rp(A + 1.85, R * 0.9, 0.3, true), rp(A + 1.9, R + 0.14, 0.1), rp(A + 1.95, R + 0.4, 0.07), rp(A + 2.02, R + 0.7, -0.08)] },
    // thinner roots between them, twisting over and under each other
    { at: 0.1, radius: 0.18, tip: 0.25, flat: 0.7, elbow: 0.05, path: [[0, 0, 0], rp(A + 0.22, R * 0.9, 0.36, true), rp(A + 0.28, R + 0.1, 0.12), rp(A + 0.18, R + 0.3, 0.1), rp(A + 0.26, R + 0.5, 0.02), rp(A + 0.2, R + 0.72, 0.06), rp(A + 0.24, R + 0.95, -0.06)] },
    { at: 0.08, radius: 0.16, tip: 0.25, flat: 0.7, elbow: 0.05, path: [[0, 0, 0], rp(A + 0.85, R * 0.9, 0.32, true), rp(A + 0.8, R + 0.12, 0.13), rp(A + 0.9, R + 0.32, 0.06), rp(A + 0.84, R + 0.52, 0.1), rp(A + 0.92, R + 0.8, -0.06)] },
    { at: 0.07, radius: 0.16, tip: 0.25, flat: 0.7, elbow: 0.05, path: [[0, 0, 0], rp(A - 0.15, R * 0.9, 0.3, true), rp(A - 0.1, R + 0.12, 0.1), rp(A - 0.2, R + 0.3, 0.12), rp(A - 0.12, R + 0.5, 0.03), rp(A - 0.18, R + 0.7, -0.06)] },
    // buttresses creeping back over the turf toward the RIP stone (the reference's roots along its foot, left of the mass): low and broad
    { at: 0.08, radius: 0.32, tip: 0.2, flat: 0.55, elbow: 0.09, path: buttress(-1.62, 2.1, 0.24, 0) },
    { at: 0.07, radius: 0.28, tip: 0.2, flat: 0.55, elbow: 0.09, path: buttress(-1.92, 1.75, 0.2, 1) },
    { at: 0.06, radius: 0.25, tip: 0.22, flat: 0.55, elbow: 0.08, path: buttress(-2.2, 1.15, 0.17, 2) },
    { at: 0.07, radius: 0.25, tip: 0.22, flat: 0.55, elbow: 0.08, path: buttress(-1.32, 1.6, 0.18, 3) },
    // strangler tendrils: thin roots running down the stump's face from high up, over the climbing
    // roots, into the ground (the reference's knotted lattice; they break the big masses)
    { at: 0.8, radius: 0.2, tip: 0.3, flat: 0.7, elbow: 0.05, path: [[0, 0, 0], rp(A + 0.38, R * 1.05, 1.18 * SH, true), rp(A + 0.5, R * 1.2, 0.92 * SH, true), rp(A + 0.4, R * 1.26, 0.66 * SH, true), rp(A + 0.56, R * 1.3, 0.4 * SH, true), rp(A + 0.62, R + 0.28, 0.08), rp(A + 0.7, R + 0.55, 0.12), rp(A + 0.76, R + 0.8, -0.06)] },
    { at: 0.68, radius: 0.18, tip: 0.3, flat: 0.7, elbow: 0.05, path: [[0, 0, 0], rp(A - 0.22, R * 1.05, 1.0 * SH, true), rp(A - 0.1, R * 1.2, 0.78 * SH, true), rp(A - 0.26, R * 1.26, 0.52 * SH, true), rp(A - 0.12, R * 1.3, 0.28 * SH, true), rp(A - 0.2, R + 0.3, 0.06), rp(A - 0.3, R + 0.58, -0.05)] },
    { at: 0.9, radius: 0.17, tip: 0.3, flat: 0.7, elbow: 0.04, path: [[0, 0, 0], rp(A + 0.95, R * 1.02, 1.3 * SH, true), rp(A + 1.05, R * 1.18, 1.08 * SH, true), rp(A + 0.92, R * 1.24, 0.86 * SH, true), rp(A + 1.0, R * 1.28, 0.62 * SH, true), rp(A + 1.12, R + 0.24, 0.3 * SH, true), rp(A + 1.2, R + 0.5, 0.04), rp(A + 1.28, R + 0.8, -0.05)] },
    // and thin roots crawling left over the turf behind (toward the RIP stone), over and between the buttresses
    { at: 0.12, radius: 0.17, tip: 0.25, flat: 0.62, elbow: 0.06, path: [[0, 0, 0], rp(A + 2.02, R * 0.95, 0.28, true), rp(A + 2.1, R + 0.3, 0.1), rp(A + 2.2, R + 0.65, 0.13), rp(A + 2.14, R + 1.0, 0.04), rp(A + 2.26, R + 1.35, 0.09), rp(A + 2.3, R + 1.75, -0.05)] },
    { at: 0.1, radius: 0.16, tip: 0.25, flat: 0.62, elbow: 0.06, path: [[0, 0, 0], rp(A + 2.42, R * 0.95, 0.24, true), rp(A + 2.36, R + 0.35, 0.12), rp(A + 2.5, R + 0.75, 0.05), rp(A + 2.44, R + 1.15, 0.1), rp(A + 2.52, R + 1.6, 0.03), rp(A + 2.48, R + 2.0, -0.05)] },
  ];
}

let rootSkel: TreeSkeleton | null = null;
/** The root mass's skeleton (local: origin at the stump's base), its roots' radii swollen and knuckled. */
function rootSkeleton(): TreeSkeleton {
  if (rootSkel) return rootSkel;
  // the stump's axis: an S, leaning away from the viewer
  const away = dirOf(CAM_A + Math.PI);
  const side = [-away[1], away[0]];
  const ax = (h: number, a: number, s: number) => [away[0] * a + side[0] * s, h, away[1] * a + side[1] * s] as V3;
  const skel = growTree({
    seed: 77,
    levels: 2,
    trunkPath: [ax(-0.25, 0, 0), ax(0.2 * SH, 0.02, 0.03), ax(0.62 * SH, -0.05, -0.04), ax(1.0 * SH, 0.05, -0.08), ax(1.3 * SH, 0.12, 0.0), ax(STUMP_H, 0.15, 0.06)],
    trunkRadius: STUMP_R,
    trunkTip: 0.86,
    trunkSection: 0.045,
    taperCurve: 0.9,
    rootFlare: 0.75,
    flareFrac: 0.3,
    pathGnarl: 0.9,
    // old, gnarled wood: deep fibrous furrows along the grain (they catch the key on their ridges),
    // burls and lumps; the fibres between them are painted per fragment (rootBark)
    bark: { furrows: 4.4, depth: 0.17, twist: 0.12, lumps: 0.2, burls: 0.3, wander: 0.8, minRadius: 0.03 },
    roots: { count: 6, length: 0.85, radius: 0.4, forks: 1 },
    ground: localGround,
    hero: rootPlans().map((r) => ({ at: r.at, dir: [1, 0, 0] as V3, length: 1, radius: r.radius, tip: r.tip, path: r.path, children: 0, flat: r.flat, flatTwist: 0.22, elbow: r.elbow })),
    windLevel: 99,
  });
  // roots: the radius swells and thins along them (±22 %) with knuckles every 0.3-0.5 m, and
  // tapers hard over its last third (a tendril's point, never a rounded sausage end)
  skel.tubes.forEach((t: Tube, ti: number) => {
    if (t.level === 0) return;
    const period = 0.3 + 0.2 * rand(78, ti, 0);
    const ph = rand(78, ti, 1);
    const len = t.rings[t.rings.length - 1].along;
    for (const ring of t.rings) {
      const w = 1 + 0.22 * fbm(ring.along * 2.6, ti * 1.7, 79, 2, 1);
      const f = (ring.along / period + ph) % 1;
      const knuckle = 1 + 0.14 * Math.exp(-(((f - 0.5) / 0.1) ** 2));
      const tipT = smoothstep(0.62, 1, ring.along / Math.max(1e-3, len));
      ring.radius *= w * knuckle * (1 - 0.55 * tipT);
    }
  });
  rootSkel = skel;
  return skel;
}

/** The pale, weathered heartwood of the stump's broken top (a vertex colour over the bark's plum: about (150, 128, 118) lit). */
const CUT_WOOD: [number, number, number] = [2.3, 2.6, 2.1];

/**
 * The stump's broken top: the old wood snapped off in splinters of uneven height and width (a few
 * tall spikes at the back, short ones at the front, never a regular crown), a pale weathered cut
 * ring inside them (the heartwood, with dark cracks across it), and a dark hollow inside that.
 */
function stumpCap(skel: TreeSkeleton): BufferGeometry {
  const trunk = skel.tubes[0];
  const len = trunk.rings[trunk.rings.length - 1].along;
  const top = trunk.rings[trunk.rings.length - 1];
  const NA = 144;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const R = top.radius;
  // splinters: world angle (from the camera direction), half width (rad), height (m); a lumpy rim between them
  const SPLINTERS: [number, number, number][] = [
    [2.75, 0.14, 0.24],
    [2.52, 0.07, 0.15],
    [2.3, 0.1, 0.11],
    [3.3, 0.18, 0.2],
    [-2.6, 0.11, 0.14],
    [1.75, 0.08, 0.1],
    [-1.9, 0.16, 0.12],
    [1.1, 0.07, 0.07],
    [-1.25, 0.1, 0.08],
    [0.45, 0.07, 0.05],
  ];
  const jag = (a: number) => {
    let h = 0.03 * fbm(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 230, 3, 1) + 0.022 * fbm(Math.cos(a) * 6, Math.sin(a) * 6, 231, 2, 1);
    for (const [sa, sw, sh] of SPLINTERS) {
      const d = Math.abs(Math.atan2(Math.sin(a - (CAM_A + sa)), Math.cos(a - (CAM_A + sa))));
      const t = Math.max(0, 1 - d / sw);
      // a sharp spike: concave flanks up to a point
      h = Math.max(h, sh * t ** 1.7);
    }
    return Math.max(0, h);
  };
  // the cut's pale ring and cracks: colour by inset (0 the bark .. 1 the hollow)
  const PALE = (a: number, k: number): [number, number, number] => {
    const crack = smoothstep(0.86, 0.97, Math.abs(Math.sin(a * 7 + 1.3 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 232, 2, 1))));
    const m = k * (1 - 0.75 * crack) * (0.82 + 0.3 * fbm(Math.cos(a) * 9, Math.sin(a) * 9, 233, 2, 1));
    return [1 + (CUT_WOOD[0] - 1) * m, 1 + (CUT_WOOD[1] - 1) * m, 1 + (CUT_WOOD[2] - 1) * m];
  };
  // rings: the bark at the top ring, the splinters' outer face and tips, their inner face, the cut
  // ring (pale), its inner lip, the hollow's wall and floor; (inset, height over the top ring + jag share, AO, pale)
  const ROLL: [number, number, number, number, number][] = [
    [0.0, 0.0, 0.0, 0.9, 0],
    [0.02, 0.015, 0.55, 0.92, 0],
    [0.06, 0.02, 1.0, 1.0, 0.05],
    [0.12, 0.01, 0.9, 0.95, 0.45],
    [0.2, 0.0, 0.25, 1.0, 1],
    [0.34, -0.01, 0.12, 0.95, 1],
    [0.44, -0.025, 0.05, 0.7, 0.55],
  ];
  const rings: ((a: number, d: Vector3) => [Vector3, number, [number, number, number]])[] = [
    ...ROLL.map(
      ([inset, up, js, ao, pale]) =>
        (a: number, d: Vector3): [Vector3, number, [number, number, number]] => {
          // (in from the bark's own surface there, so the cut follows its lumps and burls)
          const base = surfacePoint(skel, trunk, len, d).lerp(top.pos, inset);
          return [base.addScaledVector(top.tangent, up * R + jag(a) * js), ao, PALE(a, pale)];
        },
    ),
    (a, d) => [surfacePoint(skel, trunk, len, d).lerp(top.pos, 0.55).addScaledVector(top.tangent, -0.08), 0.25, PALE(a, 0.15)],
    (_a, d) => [top.pos.clone().addScaledVector(d, R * 0.26).addScaledVector(top.tangent, -0.3), 0.08, [1, 1, 1]],
    (_a, d) => [top.pos.clone().addScaledVector(d, 0.001).addScaledVector(top.tangent, -0.36), 0.05, [1, 1, 1]],
  ];
  const b = new Vector3().crossVectors(top.tangent, top.normal);
  for (const ring of rings)
    for (let i = 0; i <= NA; i++) {
      const t = (i / NA) * Math.PI * 2;
      const d = top.normal.clone().multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t));
      // the world angle of this direction (splinters are placed by world angle)
      const a = Math.atan2(d.z, d.x);
      const [p, ao, pc] = ring(a, d);
      pos.push(p.x, p.y, p.z);
      col.push(ao * pc[0], ao * pc[1], ao * pc[2]);
    }
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < NA; i++) {
      const a = k * (NA + 1) + i;
      const c = a + NA + 1;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setAttribute('aWind', new BufferAttribute(new Float32Array(pos.length / 3), 1));
  // the fibres' coordinates (rootBark): on the cut, rings of growth round its centre (w 1)
  const rm = new Float32Array((pos.length / 3) * 4);
  const P = new Vector3();
  for (let i = 0; i < pos.length / 3; i++) {
    P.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(top.pos);
    const rho = P.addScaledVector(top.tangent, -P.dot(top.tangent)).length();
    rm.set([P.x / FIBRE, P.z / FIBRE, rho / 0.018, 1], i * 4);
  }
  g.setAttribute('aRm', new BufferAttribute(rm, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Give `g` every attribute of `like`, with the same item size (zeros; a colour's extra alpha 1), so the two merge. */
function matchAttributes(g: BufferGeometry, like: BufferGeometry): BufferGeometry {
  const n = g.attributes.position.count;
  for (const [name, attr] of Object.entries(like.attributes)) {
    const own = g.attributes[name] as BufferAttribute | undefined;
    if (own && own.itemSize === attr.itemSize) continue;
    const arr = new Float32Array(n * attr.itemSize);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < attr.itemSize; c++) arr[i * attr.itemSize + c] = own && c < own.itemSize ? own.array[i * own.itemSize + c] : name === 'color' ? 1 : 0;
    g.setAttribute(name, new BufferAttribute(arr, attr.itemSize));
  }
  for (const name of Object.keys(g.attributes)) if (!like.attributes[name]) g.deleteAttribute(name);
  return g;
}

/**
 * Deepen the bark's relief in the vertex colour: a vertex lower than its ring neighbours (a
 * furrow's floor) darkens, one proud of them (a plate, a burl) lightens a little, so the bark
 * reads under the flat light the camera side gets (the moon is behind). Reads treeGeometry's
 * layout (per tube, rings × (radial + 1) vertices); skipped if the counts do not match.
 */
function cavity(g: BufferGeometry, skel: TreeSkeleton): void {
  const pos = g.attributes.position as BufferAttribute;
  const col = g.attributes.color as BufferAttribute;
  let total = 0;
  for (const t of skel.tubes) total += t.rings.length * (t.radial + 1);
  if (total !== pos.count) return;
  const P = new Vector3();
  let vo = 0;
  for (const t of skel.tubes) {
    const R = t.radial;
    const rr = new Float32Array(R + 1);
    t.rings.forEach((ring, ri) => {
      const base = vo + ri * (R + 1);
      for (let j = 0; j <= R; j++) rr[j] = P.fromBufferAttribute(pos, base + j).sub(ring.pos).length();
      for (let j = 0; j <= R; j++) {
        let m = 0;
        for (let q = -3; q <= 3; q++) m += rr[(((j + q) % R) + R) % R];
        const c = (rr[j] - m / 7) / Math.max(1e-3, ring.radius);
        const k = Math.max(0.32, Math.min(1.55, 1 + 6 * c));
        col.setXYZ(base + j, col.getX(base + j) * k, col.getY(base + j) * k, col.getZ(base + j) * k);
      }
    });
    vo += t.rings.length * (R + 1);
  }
}

/** Fibre spacing across the wood and their length along it (world units). */
const FIBRE = 0.022;
const FIBRE_LEN = 0.12;

/**
 * The bark fibres' coordinates (rootBark): a seamless 3D point per vertex, around the wood by
 * (cos, sin) × radius / FIBRE and along it by distance / FIBRE_LEN (each tube its own offset); w 0
 * on the bark. Reads treeGeometry's layout; zeros if the counts do not match.
 */
function fibreCoords(g: BufferGeometry, skel: TreeSkeleton): void {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 4);
  let total = 0;
  for (const t of skel.tubes) total += t.rings.length * (t.radial + 1);
  if (total === n) {
    let vo = 0;
    skel.tubes.forEach((t, ti) => {
      const k = t.rings[Math.floor((t.rings.length - 1) * 0.33)].radius / FIBRE;
      t.rings.forEach((ring, ri) => {
        for (let j = 0; j <= t.radial; j++) {
          const a = (j / t.radial) * Math.PI * 2;
          arr.set([Math.cos(a) * k, Math.sin(a) * k, ring.along / FIBRE_LEN + ti * 17.3, 0], (vo + ri * (t.radial + 1) + j) * 4);
        }
      });
      vo += t.rings.length * (t.radial + 1);
    });
  }
  g.setAttribute('aRm', new BufferAttribute(arr, 4));
}

/** The stump and its roots, merged, in world space (one draw call). */
function massGeometry(): BufferGeometry {
  const skel = rootSkeleton();
  const tree = treeGeometry(skel);
  cavity(tree, skel);
  fibreCoords(tree, skel);
  const cap = matchAttributes(stumpCap(skel), tree);
  // the furrows' floors and the undersides near the ground darker still (the folds go nearly black)
  const geo = mergeGeometries([tree, cap], false);
  tree.dispose();
  cap.dispose();
  geo.translate(ROOT_C.x, baseY(), ROOT_C.z);
  const pos = geo.attributes.position as BufferAttribute;
  const nor = geo.attributes.normal as BufferAttribute;
  const col = geo.attributes.color as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const above = pos.getY(i) - gy(pos.getX(i), pos.getZ(i));
    const down = smoothstep(0.2, -0.7, nor.getY(i));
    const a = (0.35 + 0.65 * smoothstep(-0.02, 0.18, above)) * (1 - 0.45 * down);
    col.setXYZ(i, col.getX(i) * a, col.getY(i) * a, col.getZ(i) * a);
  }
  geo.computeBoundingSphere();
  return geo;
}

/** Points on top of the roots (world) where straw and tall grass grow: x, y, z and a scale. */
let rootGrassMemo: { x: number; y: number; z: number; s: number }[] | null = null;
export function rootGrass(): { x: number; y: number; z: number; s: number }[] {
  if (rootGrassMemo) return rootGrassMemo;
  const skel = rootSkeleton();
  const out: { x: number; y: number; z: number; s: number }[] = [];
  skel.tubes.forEach((t, ti) => {
    if (t.level === 0) return;
    let next = 0.15 + 0.1 * rand(81, ti, 0);
    t.rings.forEach((ring, ri) => {
      if (ring.along < next) return;
      next = ring.along + 0.1 + 0.14 * rand(81, ti, ri + 1);
      const x = ROOT_C.x + ring.pos.x;
      const z = ROOT_C.z + ring.pos.z;
      const y = baseY() + ring.pos.y + ring.radius * 0.92;
      // only where the root's top is clear of the ground and not too steep, and a gap now and then
      if (y - gy(x, z) < 0.04 || Math.abs(ring.tangent.y) > 0.75 || rand(82, ti, ri) < 0.3) return;
      out.push({ x, y, z, s: 0.7 + 0.5 * rand(83, ti, ri) });
    });
  });
  rootGrassMemo = out;
  return out;
}

interface EyeSpot {
  p: Vector3;
  dir: Vector3;
  s: number;
  glow: number;
}

/**
 * Eye pairs in the root mass's dark gaps, as the hero camera sees it: the mass is rasterised
 * into a small depth image of the lower right of the frame; a gap is a spot that lies well
 * behind the surfaces to its left, its right and above it (under an arch, between two roots, a
 * hollow at the stump's foot). Each eye pair sits just inside the gap's opening, so the camera
 * sees it by construction; the deepest few gaps, well apart, are kept (the first three brighter).
 */
function eyeSpots(mass: BufferGeometry): EyeSpot[] {
  const W = 168;
  const H = 136;
  const X0 = 0.38;
  const X1 = 0.95;
  const Ylo = -0.95;
  const Yhi = -0.1;
  const depth = new Float32Array(W * H).fill(99);
  const pos = mass.attributes.position as BufferAttribute;
  const n = pos.count;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const sd = new Float32Array(n);
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    sd[i] = v.distanceTo(HERO_EYE);
    v.project(HERO_CAM);
    sx[i] = ((v.x - X0) / (X1 - X0)) * W;
    sy[i] = ((v.y - Ylo) / (Yhi - Ylo)) * H;
  }
  const index = mass.index!;
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
    if (minX > maxX || minY > maxY) continue;
    const den = (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const wa = ((sy[b] - sy[c]) * (px - sx[c]) + (sx[c] - sx[b]) * (py - sy[c])) / den;
        const wb = ((sy[c] - sy[a]) * (px - sx[c]) + (sx[a] - sx[c]) * (py - sy[c])) / den;
        const wc = 1 - wa - wb;
        if (wa < -0.02 || wb < -0.02 || wc < -0.02) continue;
        const d = wa * sd[a] + wb * sd[b] + wc * sd[c];
        const k = y * W + x;
        if (d < depth[k]) depth[k] = d;
      }
  }
  // a gap: behind its surroundings to the left, the right and above, by at least 4 cm (the deepest first)
  const R = 5;
  const cands: { x: number; y: number; open: number; score: number }[] = [];
  for (let y = 2; y < H - R - 1; y++)
    for (let x = R + 1; x < W - R - 1; x++) {
      const d = depth[y * W + x];
      let l = 99;
      let r = 99;
      let u = 99;
      for (let q = 2; q <= R; q++) {
        l = Math.min(l, depth[y * W + x - q]);
        r = Math.min(r, depth[y * W + x + q]);
        u = Math.min(u, depth[(y + q) * W + x]);
      }
      const open = Math.max(l, r, u);
      if (open > 50) continue;
      const gap = Math.min(d, open + 0.6) - open;
      // the pair needs the cells beside it open too
      if (gap < 0.04 || depth[y * W + x - 1] < open + 0.03 || depth[y * W + x + 1] < open + 0.03) continue;
      // (the reference's eyes sit in the mass's mid-height hollows, about rows 800-880 of the hero frame)
      const row = 540 * (1 - (Ylo + ((y + 0.5) / H) * (Yhi - Ylo)));
      cands.push({ x, y, open, score: Math.min(gap, 0.3) + 0.12 * Math.exp(-(((row - 840) / 70) ** 2)) });
    }
  cands.sort((p, q) => q.score - p.score);
  const ray = (x: number, y: number) => new Vector3(X0 + ((x + 0.5) / W) * (X1 - X0), Ylo + ((y + 0.5) / H) * (Yhi - Ylo), 0.5).unproject(HERO_CAM).sub(HERO_EYE).normalize();
  const picked: { p: Vector3 }[] = [];
  for (const c of cands) {
    if (picked.length >= 6) break;
    const p = HERO_EYE.clone().addScaledVector(ray(c.x, c.y), c.open + 0.035);
    // above the ground, and well apart from the others
    if (p.y < gy(p.x, p.z) + 0.012 || !picked.every((q) => q.p.distanceTo(p) > 0.16)) continue;
    picked.push({ p });
  }
  return picked.map((c, i) => ({ p: c.p, dir: HERO_EYE.clone().sub(c.p).normalize(), s: i < 3 ? [1, 0.9, 0.8][i] : 0.72, glow: i < 3 ? 1 : 0.45 }));
}

/** Two small almond eyes, inner corners tilted down (a scowl), facing `dir`. */
function eyePairGeometry(dir: Vector3, s: number): BufferGeometry {
  const W = 0.017 * s;
  const H = 0.0085 * s;
  const parts = [-1, 1].map((k) => {
    const sh = new Shape();
    sh.moveTo(-W / 2, 0);
    sh.quadraticCurveTo(0, H, W / 2, 0);
    sh.quadraticCurveTo(0, -H * 0.75, -W / 2, 0);
    const g = new ShapeGeometry(sh, 6);
    // the inner corner (toward the other eye) lower: −15° on the left eye, +15° on the right
    g.rotateZ(k * 0.26);
    g.translate(k * 0.015 * s, 0, 0);
    g.applyMatrix4(new Matrix4().lookAt(new Vector3(), dir.clone().negate(), new Vector3(0, 1, 0)));
    g.deleteAttribute('uv');
    return g;
  });
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** A soft dark hollow behind each pair of eyes (vertex alpha: dark in the middle, clear at the edge), merged. */
function socketGeometry(eyes: EyeSpot[]): BufferGeometry {
  const parts = eyes.map((e) => {
    const g = new ShapeGeometry(new Shape().absellipse(0, 0, 0.055 * e.s, 0.03 * e.s, 0, Math.PI * 2, false, 0), 16);
    g.applyMatrix4(new Matrix4().lookAt(new Vector3(), e.dir.clone().negate(), new Vector3(0, 1, 0)));
    g.translate(e.p.x - e.dir.x * 0.012, e.p.y - e.dir.y * 0.012 - 0.002, e.p.z - e.dir.z * 0.012);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 4);
    const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(pos.getX(i) - (e.p.x - e.dir.x * 0.012), pos.getY(i) - (e.p.y - e.dir.y * 0.012 - 0.002), pos.getZ(i) - (e.p.z - e.dir.z * 0.012)) / (0.055 * e.s);
      col.set([0, 0, 0, 0.85 * (1 - Math.min(1, d)) ** 1.2], i * 4);
    }
    g.setAttribute('color', new BufferAttribute(col, 4));
    g.deleteAttribute('uv');
    return g;
  });
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** When a pair of eyes blinks (closed: 0..1 squash), from the frame number; each pair its own phase. */
function blink(f: number, k: number): number {
  const period = 60 + Math.floor(rand(60, k, 0) * 70);
  const t = (f + Math.floor(rand(60, k, 1) * period)) % period;
  return t < 3 ? 0.12 : t < 4 ? 0.5 : 1;
}

// ---- the bark's fibres and its painter's key (the root mass's own shader terms) -----------------

/** The painter's key on the bark's ridges: from the upper left in front (the moon is behind), a cool lilac grey. */
const RM_UNIFORMS = {
  uRmKey: { value: new Vector3(-0.62, 0.62, 0.48).normalize() },
  uRmKeyCol: { value: new Color('#aea0aa').multiplyScalar(0.58) },
};
const RM_VERT = /* glsl */ `
attribute vec4 aRm;
varying vec4 vRm;
void main() {
  vRm = aRm;`;
const RM_FRAG_PARS = /* glsl */ `
varying vec4 vRm;
uniform vec3 uRmKey;
uniform vec3 uRmKeyCol;
void main() {
  float rmRidge = 0.5;`;
// after the ground's grain: fibres along the wood (dark cracks between light, raised strands; they
// fade before they are a pixel wide), and on the cut its growth rings and dry cracks
const RM_FRAG_FIBRE = /* glsl */ `
{
  vec3 q = vRm.xyz;
  float fw = length(fwidth(q));
  float det = 1.0 - smoothstep(0.45, 1.1, fw);
  float det2 = 1.0 - smoothstep(0.25, 0.6, fw);
  float f1 = aivNoise3(q);
  float f2 = aivNoise3(q * vec3(2.3, 2.3, 1.6) + 5.3);
  float fib = 0.5 + ((f1 - 0.5) * 0.7 + (f2 - 0.5) * 0.45 * det2) * det;
  float cut = vRm.w;
  if (cut > 0.5) {
    // the cut: concentric growth rings (darker lines), a few dry radial cracks
    float ring = abs(fract(q.z + 0.35 * (f1 - 0.5)) - 0.5) * 2.0;
    float rl = smoothstep(0.25, 0.0, ring) * (1.0 - smoothstep(0.5, 1.2, fwidth(q.z)));
    float ang = atan(q.y, q.x);
    float cr = smoothstep(0.94, 0.995, abs(sin(ang * 5.0 + 2.0 * f1))) * smoothstep(1.5, 5.0, q.z);
    diffuseColor.rgb *= (1.0 - 0.28 * rl) * (1.0 - 0.7 * cr);
    rmRidge = 0.7 * (1.0 - cr);
  } else {
    // bark plates: broad patches, some raised and pale, split by the fibres' cracks
    float plate = aivNoise3(q * vec3(0.32, 0.32, 0.55) + 11.0);
    float crack = smoothstep(0.42, 0.22, fib) * det;
    float strand = smoothstep(0.54, 0.76, fib) * det * (0.55 + 0.9 * smoothstep(0.4, 0.7, plate));
    rmRidge = strand;
    // the raised strands weathered silver-grey (the old wood under the plum), the cracks near black
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
    diffuseColor.rgb *= (1.0 - 0.75 * crack) * (0.8 + 0.4 * plate);
    diffuseColor.rgb = mix(diffuseColor.rgb, lum * vec3(1.25, 1.2, 1.38), 0.75 * strand);
    vec2 dh = vec2(dFdx(fib), dFdy(fib)) * 2.0;
    normal = grPerturb(-vViewPosition, normal, dh, faceDirection);
  }
}
#include <emissivemap_fragment>`;
// after every light: the painter's key on what faces it, strongest on the raised strands
const RM_FRAG_KEY = /* glsl */ `
{
  vec3 rmK = normalize((viewMatrix * vec4(uRmKey, 0.0)).xyz);
  float k = clamp(dot(normal, rmK), 0.0, 1.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uRmKeyCol * k * k * (0.2 + 2.0 * rmRidge);
}
#include <aomap_fragment>`;

/** The root mass's injection: the ground's (storybook + ground terms, kept in userData), then the fibres and the key. */
function rootInject(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer): void {
  (this.userData.rmBase as (this: MeshStandardMaterial, s: WebGLProgramParametersWithUniforms, r: WebGLRenderer) => void).call(this, shader, renderer);
  Object.assign(shader.uniforms, RM_UNIFORMS);
  shader.vertexShader = shader.vertexShader.replace('void main() {', RM_VERT);
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', RM_FRAG_PARS).replace('#include <emissivemap_fragment>', RM_FRAG_FIBRE).replace('#include <aomap_fragment>', RM_FRAG_KEY);
}

/** Give a ground-shaded material the bark's fibres (needs the aRm attribute) and the painter's key. */
function rootBark<M extends MeshStandardMaterial>(m: M): M {
  m.userData.rmBase = m.onBeforeCompile;
  const key = m.customProgramCacheKey();
  m.onBeforeCompile = rootInject;
  m.customProgramCacheKey = () => `${key}:rm`;
  return m;
}

function RootMass({ f }: { f: number }) {
  const { geo, mat, eyes, warm, dim, sockets, socketMat } = useMemo(() => {
    const geo = massGeometry();
    // plum bark, lichen on its tops; a warm wrap fill so the faces toward the viewer hold their value
    // (a low rim: on bark ridges a strong one breaks into scattered white flecks); its fibres and a
    // painter's key on their ridges (rootBark)
    const mat = rootBark(groundShading(storybookMaterial({ kind: 'stone', vertexColors: true, color: '#645652', color2: '#7a8088', breakup: 0.4, scale: 0.1, bump: 1.4, rim: 0.85, topCoat: 0.45, roughness: 0.9, ambient: 0.62 }), { wrap: ['#c8b8c0', 0.34], shade: PLUM_SHADE, grain: [0.02, 0.4] }));
    const spots = eyeSpots(geo);
    const eyes = spots.map((e) => ({ geo: eyePairGeometry(e.dir, e.s), p: e.p, glow: e.glow }));
    const sockets = socketGeometry(spots);
    const socketMat = storybookMaterial({ color: '#000000', vertexColors: true, transparent: true, depthWrite: false, rim: 0, fog: 0.3, breakup: 0, side: DoubleSide });
    const warm = storybookMaterial({ color: '#000000', emissive: '#ffa53a', emissiveIntensity: 2.4, fog: 0.4, rim: 0, breakup: 0, side: DoubleSide });
    const dim = storybookMaterial({ color: '#000000', emissive: '#ff9a30', emissiveIntensity: 1.1, fog: 0.4, rim: 0, breakup: 0, side: DoubleSide });
    return { geo, mat, eyes, warm, dim, sockets, socketMat };
  }, []);
  useLayoutEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      eyes.forEach((e) => e.geo.dispose());
      warm.dispose();
      dim.dispose();
      sockets.dispose();
      socketMat.dispose();
    },
    [geo, mat, eyes, warm, dim, sockets, socketMat],
  );
  return (
    <>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <mesh geometry={sockets} material={socketMat} renderOrder={1} />
      {eyes.map((e, i) => (
        <mesh key={i} geometry={e.geo} material={e.glow > 0.5 ? warm : dim} position={e.p} scale-y={blink(f, i)} />
      ))}
    </>
  );
}

// ---- cobwebs ------------------------------------------------------------------------------------

/**
 * A point on world/Graveyard.tsx's big cross, in its own units: u across (1 = the stem's right edge,
 * or with `arm` the arm's right end), v up (metres from the base), w through (1 = the carved front).
 */
const CROSS = bigCrossFrame();
function crossPoint(u: number, v: number, w: number, arm = false): Vector3 {
  return new Vector3(u * (arm ? CROSS.armHalfSpan : CROSS.stemHalf), v, w * CROSS.halfThickness).applyMatrix4(CROSS.m);
}
/** the underside and the top of the cross's arm (metres from the base) */
const ARM_LO = CROSS.armAt - CROSS.armHalfHeight;
const ARM_HI = CROSS.armAt + CROSS.armHalfHeight;

function webThreads(): Thread[] {
  const out: Thread[] = [];
  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const skel = rootSkeleton();
  const W = new Vector3(ROOT_C.x, baseY(), ROOT_C.z);
  const hero = skel.tubes.filter((t) => t.level === 1 && !t.root);
  // a point on a root's bark (world): fraction along it, direction from its axis
  const on = (t: Tube, f: number, d: Vector3) => surfacePoint(skel, t, f * t.rings[t.rings.length - 1].along, d).add(W);
  const trunk = skel.tubes[0];
  const stumpAt = (a: number, h: number) => {
    const s = trunk.rings.findIndex((r) => r.pos.y > h);
    return surfacePoint(skel, trunk, trunk.rings[Math.max(0, s)].along, V(Math.cos(a), 0, Math.sin(a))).add(W);
  };
  const grassTop = (x: number, z: number) => V(x, gy(x, z) + 0.06, z);
  const toCam = (p: Vector3) => HERO_EYE.clone().sub(p).setY(0).normalize();
  // the hero limbs are the root plans in order (the buttress roots come after them)
  const climbA = hero[0];
  const climbB = hero[1];
  const crawl = hero[2];
  // under the first climbing root, between it and the stump's wall
  if (climbA) {
    const a = rootAngle(0);
    const r1 = on(climbA, 0.22, V(0, -1, 0).add(toCam(on(climbA, 0.22, V(0, -1, 0))).multiplyScalar(0.5)).normalize());
    const r2 = on(climbA, 0.5, V(0, -1, 0));
    const s1 = stumpAt(a - 0.35, 0.9);
    const s2 = stumpAt(a - 0.4, 0.3);
    const g = grassTop((r2.x + s2.x) / 2, (r2.z + s2.z) / 2);
    const hub = r1.clone().add(r2).add(s1).add(s2).add(g).multiplyScalar(0.2);
    out.push(...orbWeb({ seed: 1, hub, anchors: [r1, r2, g, s2, s1], radials: 12, rings: 7, torn: 0.38, tethers: [grassTop(r2.x - 0.25, r2.z + 0.2), on(climbA, 0.75, V(0, 1, 0))] }));
  }
  // low, between the second climbing root and a crawling root (by the eyes)
  if (climbB && crawl) {
    const a1 = on(climbB, 0.35, toCam(on(climbB, 0.35, V(0, 1, 0))));
    const a2 = on(climbB, 0.62, V(0, 1, 0));
    const c1 = on(crawl, 0.5, V(0, 1, 0));
    const c2 = on(crawl, 0.25, V(0, 1, 0));
    const hub = a1.clone().add(a2).add(c1).add(c2).multiplyScalar(0.25).add(V(0, 0.02, 0));
    const g = grassTop(hub.x, hub.z);
    out.push(...orbWeb({ seed: 2, hub, anchors: [a1, a2, c1, g, c2], radials: 10, rings: 6, torn: 0.45, broken: 0.2, tethers: [grassTop(c1.x - 0.3, c1.z + 0.15)] }));
  }
  // low between the first two buttresses, over the turf by the eyes (the reference's torn web across the roots)
  const bt1 = hero[9];
  const bt2 = hero[10];
  if (bt1 && bt2) {
    const p1 = on(bt1, 0.16, V(0, 1, 0));
    const p2 = on(bt1, 0.4, V(0, 1, 0));
    const q1 = on(bt2, 0.18, V(0, 1, 0));
    const q2 = on(bt2, 0.44, V(0, 1, 0));
    const g = grassTop((p2.x + q2.x) / 2, (p2.z + q2.z) / 2);
    const hub = p1.clone().add(p2).add(q1).add(q2).add(g).multiplyScalar(0.2).add(V(0, 0.04, 0));
    out.push(...orbWeb({ seed: 6, hub, anchors: [p1, p2, g, q2, q1], radials: 11, rings: 6, torn: 0.42, broken: 0.15, tethers: [stumpAt(rootAngle(9) + 0.2, 0.45), grassTop(q2.x + 0.2, q2.z - 0.1)] }));
  }
  // across the stump's face toward the camera, between the strangler tendrils (the reference's big web over the mass, by its eyes)
  const st1 = hero[13];
  const st2 = hero[14];
  if (st1 && st2) {
    const out1 = (t: Tube, f: number) => on(t, f, toCam(on(t, f, V(0, 1, 0))));
    const a1 = out1(st1, 0.28);
    const a2 = out1(st1, 0.56);
    const b1 = out1(st2, 0.3);
    const b2 = out1(st2, 0.62);
    const s1 = stumpAt(CAM_A + 0.12, 0.52);
    const hub = a1.clone().add(a2).add(b1).add(b2).add(s1).multiplyScalar(0.2);
    hub.add(toCam(hub).multiplyScalar(0.07));
    out.push(...orbWeb({ seed: 7, hub, anchors: [a1, a2, s1, b2, b1], radials: 13, rings: 8, torn: 0.34, broken: 0.12, tethers: [out1(climbB ?? st2, 0.3), stumpAt(CAM_A - 0.5, 0.95)] }));
  }
  // low on the right flank, from the second climbing root to the stump (the reference's lower right web)
  if (climbB && st2) {
    const p1 = on(climbB, 0.18, toCam(on(climbB, 0.18, V(0, 1, 0))));
    const p2 = on(climbB, 0.45, V(0, 1, 0));
    const q1 = stumpAt(CAM_A - 0.75, 0.75);
    const q2 = stumpAt(CAM_A - 0.85, 0.35);
    const hub = p1.clone().add(p2).add(q1).add(q2).multiplyScalar(0.25);
    hub.add(toCam(hub).multiplyScalar(0.05));
    out.push(...orbWeb({ seed: 8, hub, anchors: [p1, q1, q2, p2], radials: 10, rings: 6, torn: 0.4, broken: 0.15, tethers: [on(st2, 0.75, V(0, 1, 0))] }));
  }
  // the RIP stone's right shoulder down to the grass at its foot (the reference's web in its corner)
  {
    const R = LAND.ripStone;
    const yaw = R.yaw ?? 0;
    const right = V(Math.cos(yaw), 0, -Math.sin(yaw));
    const front = V(Math.sin(yaw), 0, Math.cos(yaw));
    const at = (u: number, h: number, w = 0.12) => V(R.x, gy(R.x, R.z) + h, R.z).addScaledVector(right, u).addScaledVector(front, w);
    const sh = at(0.27, 0.74);
    const side = at(0.31, 0.38, 0.06);
    const g1 = grassTop(R.x + right.x * 0.62 + front.x * 0.22, R.z + right.z * 0.62 + front.z * 0.22);
    const g2 = grassTop(R.x + right.x * 0.36 + front.x * 0.42, R.z + right.z * 0.36 + front.z * 0.42);
    const hub = sh.clone().add(side).add(g1).add(g2).multiplyScalar(0.25).addScaledVector(front, 0.05);
    out.push(...orbWeb({ seed: 11, hub, anchors: [sh, side, g2, g1], radials: 10, rings: 6, torn: 0.36, broken: 0.12, tethers: [at(0.1, 0.86)] }));
  }
  // the big cross's foot: from its stem's right edge down to the boulders and the grass (the reference's lower-left web)
  {
    const b0 = BOULDERS[8];
    const stemLo = crossPoint(1, 0.36 * ARM_LO, 0.9);
    const stemHi = crossPoint(1, 0.92 * ARM_LO, 0.9);
    const arm = crossPoint(0.8, ARM_LO, 0.9, true);
    const top0 = V(b0.x, gy(b0.x, b0.z) + b0.size[1] * 0.85, b0.z);
    const low = grassTop(LAND.bigCross.x + 0.5, LAND.bigCross.z + 0.35);
    const hub = stemLo.clone().add(stemHi).add(top0).add(low).add(arm).multiplyScalar(0.2).add(V(0.05, 0, 0.04));
    out.push(...orbWeb({ seed: 4, hub, anchors: [arm, stemHi, stemLo, top0, low], radials: 12, rings: 7, torn: 0.4, tethers: [grassTop(LAND.bigCross.x + 0.85, LAND.bigCross.z + 0.15), crossPoint(1, ARM_HI - 0.04, 0, true)] }));
  }
  // between the pumpkin's hero slab and the wedge under its grin
  {
    const b1 = BOULDERS[1];
    const b2 = BOULDERS[2];
    const a = V(b1.x + b1.size[0] * 0.55, gy(b1.x, b1.z) + b1.size[1] * 0.95, b1.z + 0.06);
    const b = V(b2.x - b2.size[0] * 0.4, gy(b2.x, b2.z) + b2.size[1] * 0.9, b2.z);
    const c = grassTop((b1.x + b2.x) / 2, (b1.z + b2.z) / 2 + 0.14);
    const hub = a.clone().add(b).add(c).multiplyScalar(1 / 3).add(V(0, 0.03, 0));
    out.push(...orbWeb({ seed: 5, hub, anchors: [a, b, c], radials: 9, rings: 5, torn: 0.42, tethers: [grassTop(c.x + 0.2, c.z + 0.2)] }));
  }
  return out;
}

/** World angle of a root plan's first control point (for the webs' anchors on the stump). */
function rootAngle(i: number): number {
  const p = rootPlans()[i].path[1];
  return Math.atan2(p[2], p[0]);
}

function Webs() {
  const { geo, mat } = useMemo(() => {
    const geo = threadRibbons(webThreads(), { eye: HERO_EYE, px: 1.6, glint: 0.6, sheen: 0.7, light: NIGHT.uSbMoonDir.value.clone(), seed: 9 });
    // faintly warm silk (the jack-o'-lantern's light in it), drawn additive
    const mat = storybookMaterial({ color: '#000000', emissive: '#c8a4ac', emissiveIntensity: 1.05, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, rim: 0, fog: 0, breakup: 0 });
    return { geo, mat };
  }, []);
  useLayoutEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} renderOrder={2} />;
}

// ---- fallen leaves and twigs --------------------------------------------------------------------

/**
 * A fallen leaf: an oval blade with a few lobes along its edge (16 points round a midrib), its
 * sides curled up, the tip lifted, a short petiole at its base (normals come from the curl:
 * computed over the merged leaves).
 */
function leafGeometry(seed: number, len: number): { pos: number[]; idx: number[] } {
  const w = len * (0.28 + 0.14 * rand(seed, 0, 0));
  const curl = len * (0.12 + 0.22 * rand(seed, 0, 1));
  const lobes = 2 + Math.floor(rand(seed, 0, 2) * 3);
  const T = [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.9, 1];
  const pos: number[] = [];
  const idx: number[] = [];
  // the petiole: a thin strip back from the base
  const pl = len * 0.22;
  pos.push(-0.002, 0.001, -pl, 0.002, 0.001, -pl);
  for (const t of T) {
    const half = w * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.75 * (1 + 0.16 * Math.sin(t * Math.PI * lobes * 2 + seed));
    const z = len * t;
    const lift = curl * 0.35 * t * t;
    pos.push(-half, curl * 0.6 + lift, z, 0, lift * 0.6, z, half, curl * 0.6 + lift, z);
  }
  // petiole to the base, then the blade in strips (left and right of the midrib)
  idx.push(0, 1, 3, 0, 3, 2, 1, 4, 3);
  for (let i = 0; i < T.length - 1; i++) {
    const a = 2 + i * 3;
    const b = a + 3;
    idx.push(a, a + 1, b + 1, a, b + 1, b, a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
  }
  return { pos, idx };
}

/** Dry ochre, rust and brown (sRGB): warm and lighter than the turf, so they read as leaves, not holes. */
const LEAF_COLS = ['#8a5a2a', '#a06a30', '#7a4424', '#6e5a2c', '#94502a', '#5e3a22'].map((c) => new Color(c));

function leavesGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const m = new Matrix4();
  const v = new Vector3();
  const q = new Quaternion();
  let placed = 0;
  for (let k = 0; k < 12000 && placed < 640; k++) {
    const x = -2.8 + rand(70, k, 0) * 7.5;
    const z = -1.6 + rand(70, k, 1) * 6.2;
    const tr = trackAt(x, z);
    // along the track's ragged edges (both sides of the line), some blown onto the dirt
    const edgeBand = 1 - Math.min(1, Math.abs(tr.edge + 0.02) / 0.16);
    const onDirt = tr.m > 0.5 ? 0.12 : 0;
    // (in drifts: clustered along the edges and against the stones, bare stretches between)
    const drift = smoothstep(0.35, 0.8, 0.5 + 0.5 * fbm(x, z, 71, 2, 2.2)) * 1.6;
    const yardM = yardMask(x, z, 0.3) * 0.55;
    if (rand(70, k, 2) > (edgeBand * 0.8 + onDirt) * drift * (0.35 + 0.65 * smoothstep(0.4, 3.6, z)) + yardM * drift) continue;
    // (in the door yard only round its trodden middle, where the actors stand)
    if (Math.hypot(x - ROOT_C.x, z - ROOT_C.z) < ROOTS_FOOTPRINT.r * 0.8 || (yardMask(x, z) > 0.3 && yardCentre(x, z) > 0.3)) continue;
    if (Math.abs(tr.u) < pathHalfWidth(tr.s) * 0.35 && tr.apron < 0.5) continue;
    const isTwig = rand(70, k, 3) < 0.14;
    const len = isTwig ? 0.06 + 0.1 * rand(70, k, 4) : 0.035 + 0.03 * rand(70, k, 4);
    const base = pos.length / 3;
    if (isTwig) {
      // a thin bent stick: two segments of a three-sided prism
      const r = 0.0035 + 0.003 * rand(70, k, 5);
      const bendY = len * 0.12 * rand(70, k, 6);
      const cs = [0, 0.5, 1].map((t) => [0, bendY * 4 * t * (1 - t) + r, len * t] as const);
      for (const c of cs)
        for (let j = 0; j < 3; j++) {
          const a = (j / 3) * Math.PI * 2;
          pos.push(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]);
        }
      for (let s = 0; s < 2; s++)
        for (let j = 0; j < 3; j++) {
          const a = base + s * 3 + j;
          const b = base + s * 3 + ((j + 1) % 3);
          idx.push(a, b, a + 3, b, b + 3, a + 3);
        }
    } else {
      const lg = leafGeometry(70 + k, len);
      pos.push(...lg.pos);
      idx.push(...lg.idx.map((i) => i + base));
    }
    const count = pos.length / 3 - base;
    const g = gy(x, z);
    q.setFromEuler(new Euler((rand(70, k, 7) - 0.5) * 0.35, rand(70, k, 8) * 6.283, (rand(70, k, 9) - 0.5) * 0.35, 'YXZ'));
    m.compose(new Vector3(x, g + 0.002, z), q, new Vector3(1, 1, 1));
    const c = isTwig ? new Color('#3a2e28') : LEAF_COLS[Math.floor(rand(70, k, 10) * LEAF_COLS.length)].clone();
    c.multiplyScalar(0.8 + 0.4 * rand(70, k, 11));
    for (let i = base; i < base + count; i++) {
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(m);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      col.push(c.r, c.g, c.b);
    }
    placed++;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  // (normals from the curl; each leaf's own vertices only, so they never smooth across leaves)
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function Leaves() {
  const { geo, mat } = useMemo(() => ({ geo: leavesGeometry(), mat: groundShading(storybookMaterial({ kind: 'plain', vertexColors: true, side: DoubleSide, breakup: 0.2, scale: 0.05, rim: 0.8, roughness: 0.85 }), { shade: PLUM_SHADE }) }), []);
  useLayoutEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

// ---- all of it ----------------------------------------------------------------------------------

/** The ground's dressing: rocks, the root mass (with eyes that blink on frame `f`), cobwebs, leaves. */
export function Dressing({ f = 0, grow = 1 }: { f?: number; grow?: number }) {
  return (
    <group visible={grow > 0.98}>
      <Rocks />
      <RootMass f={f} />
      <Webs />
      <Leaves />
    </group>
  );
}

/** Diagnostics: triangles per part (builds everything once; disposes it). */
export function dressingStats(): Record<string, number> {
  const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const out: Record<string, number> = {};
  const { bigGeo, smallGeo, contacts } = rockSets();
  out.boulders = tris(bigGeo);
  out.stones = tris(smallGeo);
  const shadows = contactGeometry(contacts);
  out.contacts = tris(shadows);
  const mass = massGeometry();
  out.roots = tris(mass);
  const web = threadRibbons(webThreads(), { eye: HERO_EYE });
  out.webs = tris(web);
  out.eyes = eyeSpots(mass).length;
  out.rootGrass = rootGrass().length;
  const leaves = leavesGeometry();
  out.leaves = tris(leaves);
  [bigGeo, smallGeo, shadows, web, leaves, mass].forEach((g) => g.dispose());
  return out;
}
