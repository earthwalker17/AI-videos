/**
 * The castle on its crag, behind the hill between the gates and the last house (LAND.crag), as in
 * the reference: a rocky table rising out of the hill and the mist, seamed cliffs on the left under
 * an overhanging lip with a dead tree on its tip, a broad moonlit shoulder sloping about 45° into the
 * hill at the front and right (where the hero eye sees it), its top crowded with a crooked thicket
 * of thin leaning towers: a tall keep with a jettied top, a hall with an overhanging timber upper
 * storey, a dormer, an oriel and a stair tower, a gabled middle block, thin spires with jettied
 * timber tops and hooked conical roofs, iron finials, a few pin-prick lit windows (warm, one cyan).
 * A pale road leaves the gate, runs off the rim and switchbacks down the shoulder's face, then round
 * the foot to the far house (LAND.farHouse): a small front-gabled house on its own knoll, clear of
 * the cliff, one warm window, its chimney smoking (camera-facing puffs drifting from the frame).
 *
 * All of it rides a parallax `offset` so it keeps its forced-perspective distance in moving shots
 * (the film passes (camera − HERO.pos) × [0.75, 0.45, 0]); its rock reaches well below the ground
 * and thin layered mist hides its foot, so the offset never shows a floating base. Dark, hazed and
 * silhouette-first with a moon rim. 10 draw calls.
 */
import { rand, smoothstep } from '@aiv/core';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Matrix4, MeshBasicMaterial, SRGBColorSpace, Vector3, type Camera } from 'three';
import { fbm2 } from '../kit/field.ts';
import { rockGeometry, type RockParams } from '../kit/rocks.ts';
import { Builder, finial, gablePlanes, ridgeCap, shingles, type Gable, type RGBA } from '../kit/roof.ts';
import { buildTree } from '../kit/tree.ts';
import { NIGHT, storybookMaterial } from '../look/materials.ts';
import { canvas } from '../look/paper.ts';
import { FLOOR, groundHeight, LAND } from './layout.ts';
import { beam } from './House.tsx';

const TAU = Math.PI * 2;
/** the castle's frame: its base on the ground at the crag, turned to face the hero view */
export const CRAG_YAW = -0.2;
const BASE = new Vector3(LAND.crag.x, FLOOR + groundHeight(LAND.crag.x, LAND.crag.z), LAND.crag.z);
/** castle-local → world (before the parallax offset) */
const FRAME = new Matrix4().makeRotationY(CRAG_YAW).setPosition(BASE);
const FRAME_INV = new Matrix4().copy(FRAME).invert();

/** the far house at the crag's foot (castle-local), raised on a knoll so it shows over the hill's crest */
const FAR = (() => {
  const p = new Vector3(LAND.farHouse.x, FLOOR + groundHeight(LAND.farHouse.x, LAND.farHouse.z), LAND.farHouse.z).applyMatrix4(FRAME_INV);
  return { x: p.x, y: p.y + 0.33, z: p.z };
})();
/** the chimney's top (castle-local): where the smoke leaves (up the far house's left slope, turned with it) */
const CHIMNEY = new Vector3(FAR.x - 0.1, FAR.y + 0.56, FAR.z - 0.08).sub(new Vector3(FAR.x, 0, FAR.z)).applyAxisAngle(new Vector3(0, 1, 0), 0.45).add(new Vector3(FAR.x, 0, FAR.z));
/** the ground's height (castle-local y) under a castle-local point */
function groundLocal(x: number, z: number): number {
  const w = new Vector3(x, 0, z).applyMatrix4(FRAME);
  return FLOOR + groundHeight(w.x, w.z) - BASE.y;
}
/** the plateau's top height (castle-local) where the buildings stand */
const TOP = 1.98;

// ---- the crag's table: a ragged outline, a top tilted toward the viewer, seamed cliffs ----------

const CRAG_C = { x: 0.0, z: 0.1 };
const gauss = (d: number, s: number) => Math.exp(-((d / s) ** 2));
const angDist = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return d > Math.PI ? TAU - d : d;
};
/** the rim's radius at angle th (0 is +x, π/2 the front) */
function rimR(th: number): number {
  const c = Math.cos(th);
  const sn = Math.sin(th);
  let r = 1 / Math.sqrt((c / 1.3) ** 2 + (sn / 0.8) ** 2);
  r += 0.42 * gauss(angDist(th, Math.PI + 0.08), 0.3);
  r += 0.14 * gauss(angDist(th, 0.1), 0.45);
  r -= 0.2 * gauss(angDist(th, 2.3), 0.24);
  // pulled back behind the far house, so it stands clear of the cliff on its own knoll
  r -= 0.4 * gauss(angDist(th, 2.75), 0.3);
  r *= 1 + 0.07 * fbm2(th * 2.6, 0.4, 901, 3) + 0.035 * fbm2(th * 11, 0.9, 906, 2) + 0.018 * Math.sin(th * 23 + 1.3);
  return r;
}
/** How much the crag's side at angle th is a sloping shoulder (the front and the right, where the hero eye sees it), 0 a cliff. */
function shoulder(th: number): number {
  return gauss(angDist(th, 1.05), 0.9);
}
/** the smooth part of the crag's radius at angle th and height y (the cliffs add seams and strata) */
function cliffR(th: number, y: number): number {
  const R = rimR(th);
  const yr = rimY(th);
  const t = clamp01((yr - y) / (yr - CLIFF_BOT));
  const lip = gauss(angDist(th, Math.PI + 0.08), 0.32);
  let r = R * (1 + 0.05 * t);
  // undercut only under the lip (the left), where the dead tree leans out
  r *= 1 - 0.3 * lip * smoothstep(0.0, 0.14, t) * (1 - 0.5 * smoothstep(0.4, 0.9, t));
  // the shoulder slopes out about 45° into the hill
  r += shoulder(th) * Math.max(0, yr - y) * 0.95 * smoothstep(0, 0.12, t);
  return r;
}
const CLIFF_BOT = -1.1;
/**
 * The crag's radius at angle th and height y as its mesh has it: the smooth radius (a sloping
 * shoulder right and front, the undercut lip left), then vertical seams and columns, ledges and
 * blocky steps where the strata break (strongest on the cliffs, softer on the shoulder).
 */
function cragR(th: number, y: number): number {
  const shd = shoulder(th);
  const seam = 1 - Math.abs(fbm2(th * 9.5, y * 0.35, 904, 3));
  const strata = Math.round(y * 4.2 + fbm2(th * 3, 0.2, 907, 2) * 1.5) / 4.2 - y;
  return cliffR(th, y) * (1 + (1 - 0.6 * shd) * (0.1 * (seam - 0.6) + 0.035 * fbm2(th * 22, y * 1.6, 905, 2) + 0.03 * strata + 0.018 * Math.sin(y * 13 + th * 3)) + 0.012 * fbm2(th * 6, y * 2, 908, 2));
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** the rim's height at angle th */
function rimY(th: number): number {
  const R = rimR(th);
  return crTop0(CRAG_C.x + Math.cos(th) * R, CRAG_C.z + Math.sin(th) * R) - 0.05;
}

/**
 * The castle stands as built, then raised against the reference (2026-11-04 integration, measured
 * at 1080p on the hero view: the reference's spires reach the frame's top and its buildings end
 * near y 340 over a small outcrop): everything above LIFT_FROM (the crag, its road, the dead tree,
 * the buildings) lifted LIFT, the crag stretched taller from the same foot (the far house, its
 * knoll and the mist unchanged). BUILD_Y scales the buildings' height above the table (1: as built).
 */
const BUILD_Y = 1;
const LIFT = 0.5;
const LIFT_FROM = 0.2;
/** the lift at castle-local height y (0 at the foot, LIFT from the table's top up) */
const liftAt = (y: number) => LIFT * smoothstep(LIFT_FROM, TOP, y);

/** the table's top height at (x, z) as the castle stands (castle-local): for anything placed on it */
export function crTop(x: number, z: number): number {
  const y = crTop0(x, z);
  return y + liftAt(y);
}

/** the table's top height at (x, z) while it is built: tilted down toward the viewer and down the right shoulder */
function crTop0(x: number, z: number): number {
  return 2.04 - 0.46 * smoothstep(-0.5, 0.95, z) - 0.34 * smoothstep(0.55, 1.55, x) + 0.03 * fbm2(x * 3.1, z * 3.1, 902, 3);
}

/** The table and its cliffs into a builder: top rings, a rounded rim, cliff rows down into the ground. */
function cragTable(out: Builder): void {
  const NA = 132;
  const tops = [0, 0.22, 0.45, 0.66, 0.82, 0.93, 1];
  const NC = 20;
  const BOT = CLIFF_BOT;
  const P: Vector3[][] = [];
  const shade: number[][] = [];
  for (let i = 0; i <= NA; i++) {
    const th = (i / NA) * TAU;
    const R = rimR(th);
    const ring: Vector3[] = [];
    const sh: number[] = [];
    const cx = Math.cos(th);
    const cz = Math.sin(th);
    for (const f of tops) {
      const x = CRAG_C.x + cx * R * f;
      const z = CRAG_C.z + cz * R * f;
      // the rim rounds over a little
      const y = crTop0(x, z) - 0.05 * smoothstep(0.82, 1, f);
      ring.push(new Vector3(x, y, z));
      sh.push(1.05 + 0.15 * fbm2(x * 2.5, z * 2.5, 903, 2) - 0.12 * smoothstep(0.9, 1, f));
    }
    const yr = ring[ring.length - 1].y;
    const shd = shoulder(th);
    for (let k = 1; k <= NC; k++) {
      const t = Math.pow(k / NC, 1.25);
      const y = yr + (BOT - yr) * t;
      ring.push(new Vector3(CRAG_C.x + cx * cragR(th, y), y, CRAG_C.z + cz * cragR(th, y)));
      const seam = 1 - Math.abs(fbm2(th * 9.5, y * 0.35, 904, 3));
      const low = smoothstep(BOT, 1.4, y);
      // the shoulder's moonlit slope stays lighter (its top coat does the rest); the cliffs darken down
      sh.push((0.62 + 0.25 * seam) * (0.45 + 0.55 * low) * (1 - shd) + shd * (0.78 + 0.3 * seam));
    }
    P.push(ring);
    shade.push(sh);
  }
  const rows = P[0].length;
  for (let i = 0; i < NA; i++)
    for (let k = 0; k < rows - 1; k++) {
      const a = P[i][k];
      const b = P[i + 1][k];
      const c = P[i + 1][k + 1];
      const d = P[i][k + 1];
      const C = (ii: number, kk: number): RGBA => {
        const v = shade[ii][kk];
        return [v, v, v * 1.02, kk < tops.length ? 0.9 : 0.75];
      };
      // faces up on the top (rows run outward), out on the cliff (rows run down)
      out.quad(a, b, c, d, [C(i, k), C(i + 1, k), C(i + 1, k + 1), C(i, k + 1)]);
    }
}

// ---- the crag ----------------------------------------------------------------------------------

interface Piece {
  at: [number, number, number];
  size: [number, number, number];
  p: Partial<RockParams>;
  yaw?: number;
  tint?: number;
}

const CRAG: Piece[] = [
  // boulders and fallen blocks at the cliffs' foot, a hanging block under the lip
  { at: [-1.28, 1.6, 0.1], size: [0.14, 0.18, 0.14], p: { facets: 9, cut: 0.3, detail: 4 } },
];

function catmull(pts: [number, number, number][], n: number): Vector3[] {
  const P = pts.map((p) => new Vector3(...p));
  const out: Vector3[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        new Vector3()
          .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
          .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
          .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
          .addScaledVector(p3, 0.5 * t3 - 0.5 * t2),
      );
    }
  }
  out.push(P[P.length - 1].clone());
  return out;
}

// ---- castle parts ------------------------------------------------------------------------------

/** A tapered polygonal tower from y0 to y1, leaning; vertex colour darker at its foot (one standing on the crag sinks into its top). */
function tower(out: Builder, x: number, z: number, r0: number, r1: number, y0: number, y1: number, sides: number, lean: [number, number], turn = 0): void {
  if (y0 <= TOP) y0 = Math.min(y0, crTop0(x, z + r0) - 0.15, crTop0(x, z - r0) - 0.15);
  for (let i = 0; i < sides; i++) {
    const a0 = turn + (i / sides) * TAU;
    const a1 = turn + ((i + 1) / sides) * TAU;
    const P = (a: number, r: number, y: number) => {
      const t = (y - y0) / (y1 - y0);
      return new Vector3(x + Math.cos(a) * r + lean[0] * t * t, y, z + Math.sin(a) * r + lean[1] * t * t);
    };
    const v = 0.85 + 0.25 * rand(7, 'tw', i + x * 100);
    out.quad(P(a1, r0, y0), P(a1, r1, y1), P(a0, r1, y1), P(a0, r0, y0), [[v * 0.6, v * 0.6, v * 0.62, 1], [v, v, v, 1], [v, v, v, 1], [v * 0.6, v * 0.6, v * 0.62, 1]]);
  }
}

/** A flared conical roof (an eave lip, a concave sweep to the point), polygonal. */
function coneRoof(out: Builder, x: number, z: number, r: number, y0: number, h: number, sides: number, lean: [number, number] = [0, 0]): Vector3 {
  const prof: [number, number][] = [
    [r * 1.18, -0.02],
    [r * 1.12, 0.04],
    [r * 0.82, 0.18],
    [r * 0.5, 0.45],
    [r * 0.22, 0.75],
    [0, 1],
  ];
  const ring = (k: number) => {
    const [rr, t] = prof[k];
    return Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * TAU + 0.3;
      return new Vector3(x + Math.cos(a) * rr + lean[0] * t * t, y0 + t * h, z + Math.sin(a) * rr + lean[1] * t * t);
    });
  };
  for (let k = 0; k < prof.length - 1; k++) {
    const A = ring(k);
    const B = ring(k + 1);
    const v = 0.75 + 0.45 * (k / prof.length);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      out.quad(A[j], B[j], B[i], A[i], [v, v, v, 0.9]);
    }
  }
  // the underside of the eave lip
  const A = ring(0);
  const c = new Vector3(x, y0 - 0.02, z);
  for (let i = 0; i < sides; i++) out.tri(A[i], A[(i + 1) % sides], c, [0.4, 0.4, 0.42, 0.3]);
  return new Vector3(x + lean[0], y0 + h, z + lean[1]);
}

/** An axis-aligned box with darker sides and foot (one standing on the crag sinks into its top). */
function box(out: Builder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, v = 1, a = 1): void {
  if (y0 <= TOP && Math.hypot((x0 + x1) / 2 - CRAG_C.x, (z0 + z1) / 2 - CRAG_C.z) < 1.4) y0 = Math.min(y0, crTop0(x0, z0) - 0.12, crTop0(x1, z0) - 0.12, crTop0(x0, z1) - 0.12, crTop0(x1, z1) - 0.12);
  const p = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const lo: RGBA = [v * 0.6, v * 0.6, v * 0.62, a];
  const hi: RGBA = [v, v, v, a];
  out.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), [lo, lo, hi, hi]);
  out.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), [lo, lo, hi, hi]);
  out.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), [lo, lo, hi, hi]);
  out.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), [lo, lo, hi, hi]);
  out.quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), hi);
}

/** A gable roof's two slabs and its gable-end triangles (no tiles: far away the paint carries it). */
function simpleGable(roof: Builder, walls: Builder, g: Gable, tiles = 0): void {
  const { planes, ridge } = gablePlanes(g);
  for (const pl of planes) {
    if (tiles > 0) {
      shingles(pl, { seed: Math.round(g.x0 * 100 + g.z0 * 37), tileW: tiles, exposure: tiles * 0.7, thickness: tiles * 0.12, kick: tiles * 0.08, alphaEdge: 0.3, value: 0.2 }, roof);
    }
    const o = new Vector3(...pl.origin);
    const A = new Vector3(...pl.along).multiplyScalar(pl.width);
    const U = new Vector3(...pl.up).multiplyScalar(pl.length);
    const n = new Vector3(...pl.along).cross(new Vector3(...pl.up)).normalize();
    const q = (a: number, b: number, h: number) => o.clone().addScaledVector(A, a).addScaledVector(U, b).addScaledVector(n, h);
    roof.quad(q(0, 0, 0), q(1, 0, 0), q(1, 1, 0), q(0, 1, 0), [[0.75, 0.75, 0.78, 0.9], [0.75, 0.75, 0.78, 0.9], [1.1, 1.1, 1.1, 0.9], [1.1, 1.1, 1.1, 0.9]]);
    roof.quad(q(0, 0, -0.03), q(0, 1, -0.03), q(1, 1, -0.03), q(1, 0, -0.03), [0.3, 0.3, 0.32, 0.2]);
    roof.quad(q(0, 0, -0.03), q(1, 0, -0.03), q(1, 0, 0), q(0, 0, 0), [0.5, 0.5, 0.52, 0.4]);
  }
  ridgeCap(ridge[0], ridge[1], { seed: Math.round(g.peak * 100), radius: 0.025, piece: 0.08 }, roof);
  // gable-end triangles
  if (g.ridge === 'z') {
    const xc = (g.x0 + g.x1) / 2;
    for (const [z, s] of [[g.z1, 1], [g.z0, -1]] as const) {
      const a = new Vector3(g.x0, g.eave, z);
      const b = new Vector3(g.x1, g.eave, z);
      const c = new Vector3(xc, g.peak, z);
      if (s > 0) walls.tri(a, b, c, [0.9, 0.9, 0.9, 1]);
      else walls.tri(b, a, c, [0.9, 0.9, 0.9, 1]);
    }
  } else {
    const zc = (g.z0 + g.z1) / 2;
    for (const [x, s] of [[g.x1, 1], [g.x0, -1]] as const) {
      const a = new Vector3(x, g.eave, g.z1);
      const b = new Vector3(x, g.eave, g.z0);
      const c = new Vector3(x, g.peak, zc);
      if (s > 0) walls.tri(a, b, c, [0.9, 0.9, 0.9, 1]);
      else walls.tri(b, a, c, [0.9, 0.9, 0.9, 1]);
    }
  }
}

/** A steep four-sided pointed roof over a box, with a little flare at its eaves. */
function pyramidRoof(out: Builder, x0: number, x1: number, z0: number, z1: number, y0: number, h: number, oh: number): Vector3 {
  const c = new Vector3((x0 + x1) / 2, y0 + h, (z0 + z1) / 2);
  const e = [new Vector3(x0 - oh, y0 - 0.02, z1 + oh), new Vector3(x1 + oh, y0 - 0.02, z1 + oh), new Vector3(x1 + oh, y0 - 0.02, z0 - oh), new Vector3(x0 - oh, y0 - 0.02, z0 - oh)];
  const m = e.map((p) => p.clone().lerp(c, 0.22).add(new Vector3(0, -0.03, 0)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out.quad(e[i], e[j], m[j], m[i], [0.7, 0.7, 0.72, 0.9]);
    out.tri(m[i], m[j], c, [[0.85, 0.85, 0.88, 0.9], [0.85, 0.85, 0.88, 0.9], [1.15, 1.15, 1.15, 0.9]]);
  }
  return c;
}

interface CastleGeos {
  rock: BufferGeometry;
  walls: BufferGeometry;
  roofs: BufferGeometry;
  timber: BufferGeometry;
  iron: BufferGeometry;
  warm: BufferGeometry;
  cyan: BufferGeometry;
  road: BufferGeometry;
  stats: Record<string, number>;
}

function buildCastle(): CastleGeos {
  const rock = new Builder();
  const walls = new Builder();
  const roofs = new Builder();
  const timber = new Builder();
  const iron = new Builder();
  const warm = new Builder();
  const cyan = new Builder();
  const road = new Builder();

  // the crag: the table with its cliffs, and chiselled pieces, darker low down
  cragTable(rock);
  CRAG.forEach((pc, i) => {
    const g = rockGeometry({ seed: 500 + i, detail: 6, facets: 12, cut: 0.25, noise: 0.05, crease: 32, bevel: 0.03, grit: 0.015, gritFreq: 7, ...pc.p, size: [1, 1, 1], base: pc.p.base ?? -0.8 });
    const m = new Matrix4().makeTranslation(...pc.at).multiply(new Matrix4().makeRotationY(pc.yaw ?? (i * 0.7) % 1)).multiply(new Matrix4().makeScale(...pc.size));
    const t = pc.tint ?? 1;
    rock.add(g, m, (p) => {
      const low = smoothstep(-0.2, 1.2, p.y);
      const v = t * (0.55 + 0.5 * low);
      return [v, v, v * 1.02, 0.6 + 0.4 * low];
    });
    g.dispose();
  });
  // the dead tree on the lip's tip
  {
    const tree = buildTree({ seed: 77, trunkLength: 0.42, trunkRadius: 0.028, levels: 3, lean: [-0.25, 0.05], roots: { count: 0, length: 0, radius: 0 }, minRadius: 0.004, tipRadius: 0.004, rim: 0.4 });
    timber.add(tree, new Matrix4().makeTranslation(-1.55, crTop0(-1.55, 0.06) - 0.06, 0.06).multiply(new Matrix4().makeRotationY(0.6)), [0.9, 0.9, 0.9, 1]);
    tree.dispose();
  }

  // (where the buildings start in each builder: they are squashed toward the table after)
  const bodies = [walls, roofs, timber, iron, warm, cyan];
  const marks = bodies.map((b) => b.count);

  // the keep: tall, tapered, leaning, a jettied timber top on corbels, a tall hooked cone, a finial
  const keep = { x: 0.05, z: -0.18 };
  const kl: [number, number] = [-0.14, 0.02];
  tower(walls, keep.x, keep.z, 0.2, 0.16, TOP - 0.15, 3.9, 8, kl, 0.2);
  const kx = keep.x + kl[0] - 0.03;
  const kz = keep.z + kl[1];
  tower(walls, kx, kz, 0.25, 0.26, 3.9, 4.28, 8, [0, 0], 0.2);
  for (let i = 0; i < 8; i++) {
    const a = 0.2 + ((i + 0.5) / 8) * TAU;
    const p0 = new Vector3(kx + Math.cos(a) * 0.15, 3.72, kz + Math.sin(a) * 0.15);
    const p1 = new Vector3(kx + Math.cos(a) * 0.245, 3.9, kz + Math.sin(a) * 0.245);
    beam(timber, p0, p1, 0.035, 0.035, new Vector3(-Math.sin(a), 0, Math.cos(a)), [0.9, 0.9, 0.9, 0.6]);
  }
  const tips: Vector3[] = [coneRoof(roofs, kx, kz, 0.29, 4.28, 0.95, 10, [-0.16, 0.03])];
  // the hall at the left: stone below, a jettied timber storey, a steep pointed roof, a dormer, an oriel
  const hall = { x0: -0.88, x1: -0.3, z0: -0.25, z1: 0.24 };
  box(walls, hall.x0, hall.x1, TOP - 0.15, 2.55, hall.z0, hall.z1, 0.95);
  box(walls, hall.x0 - 0.07, hall.x1 + 0.04, 2.55, 3.0, hall.z0 - 0.04, hall.z1 + 0.07, 1.0);
  {
    const z = hall.z1 + 0.075;
    const col: RGBA = [0.95, 0.95, 0.95, 0.55];
    const up = new Vector3(0, 0, 1);
    beam(timber, new Vector3(hall.x0 - 0.08, 2.56, z), new Vector3(hall.x1 + 0.05, 2.56, z), 0.03, 0.02, up, col);
    beam(timber, new Vector3(hall.x0 - 0.08, 2.98, z), new Vector3(hall.x1 + 0.05, 2.98, z), 0.03, 0.02, up, col);
    for (const t of [0, 0.27, 0.6, 1]) {
      const x = hall.x0 - 0.06 + t * (hall.x1 - hall.x0 + 0.08);
      beam(timber, new Vector3(x, 2.56, z), new Vector3(x, 2.98, z), 0.026, 0.02, new Vector3(0, 0, 1), col);
    }
    beam(timber, new Vector3(hall.x0 - 0.04, 2.58, z), new Vector3(hall.x0 + 0.12, 2.96, z), 0.022, 0.02, up, col);
    beam(timber, new Vector3(hall.x1 + 0.02, 2.58, z), new Vector3(hall.x1 - 0.16, 2.96, z), 0.022, 0.02, up, col);
    for (const t of [0.1, 0.5, 0.9]) {
      const x = hall.x0 + t * (hall.x1 - hall.x0);
      beam(timber, new Vector3(x, 2.42, hall.z1), new Vector3(x, 2.55, hall.z1 + 0.065), 0.03, 0.03, new Vector3(1, 0, 0), col);
    }
  }
  tips.push(pyramidRoof(roofs, hall.x0 - 0.07, hall.x1 + 0.04, hall.z0 - 0.04, hall.z1 + 0.07, 3.0, 0.86, 0.05));
  // a gabled dormer on the hall's roof, its front toward us
  box(walls, -0.66, -0.48, 3.0, 3.28, 0.02, 0.24, 0.95);
  simpleGable(roofs, walls, { x0: -0.66, x1: -0.48, z0: 0.02, z1: 0.24, eave: 3.28, peak: 3.48, ridge: 'z', overhang: 0.03, verge: 0.03 });
  // an oriel hung on the hall's front (a jettied bay on a corbelled cone)
  {
    const ox = -0.42;
    const oz = hall.z1 + 0.1;
    box(walls, ox - 0.08, ox + 0.08, 2.2, 2.45, oz - 0.08, oz + 0.06, 1.0);
    for (let i = 0; i < 4; i++) walls.tri(new Vector3(ox - 0.08 + i * 0.053, 2.2, oz + 0.06), new Vector3(ox - 0.08 + (i + 1) * 0.053, 2.2, oz + 0.06), new Vector3(ox, 2.06, oz - 0.03), [0.6, 0.6, 0.62, 0.6]);
    tips.push(pyramidRoof(roofs, ox - 0.08, ox + 0.08, oz - 0.08, oz + 0.06, 2.45, 0.22, 0.02));
  }
  // a round stair tower against the hall's front left, breaking its broad wall
  tower(walls, hall.x0 + 0.1, hall.z1 + 0.06, 0.075, 0.068, TOP - 0.1, 2.92, 8, [-0.05, 0.01]);
  tips.push(coneRoof(roofs, hall.x0 + 0.05, hall.z1 + 0.07, 0.095, 2.92, 0.4, 8, [-0.08, 0]));
  // an annex jutting over the lip
  box(walls, -1.2, -0.88, TOP - 0.1, 2.35, -0.12, 0.16, 0.9);
  simpleGable(roofs, walls, { x0: -1.2, x1: -0.88, z0: -0.12, z1: 0.16, eave: 2.35, peak: 2.66, ridge: 'x', overhang: 0.05, verge: 0.04 });

  // the middle block: tall, gabled, its front toward us, a jettied timber upper storey
  box(walls, 0.24, 0.62, TOP - 0.15, 3.0, -0.12, 0.22, 0.92);
  simpleGable(roofs, walls, { x0: 0.18, x1: 0.68, z0: -0.16, z1: 0.27, eave: 3.0, peak: 3.5, ridge: 'z', overhang: 0.05, verge: 0.05 });
  box(walls, 0.62, 0.92, TOP - 0.15, 2.45, -0.05, 0.25, 0.88);
  simpleGable(roofs, walls, { x0: 0.62, x1: 0.92, z0: -0.05, z1: 0.25, eave: 2.45, peak: 2.72, ridge: 'x', overhang: 0.05, verge: 0.04 });
  {
    box(walls, 0.2, 0.66, 2.62, 3.0, -0.16, 0.27, 1.05);
    const col: RGBA = [0.95, 0.95, 0.95, 0.5];
    const up = new Vector3(0, 0, 1);
    const z = 0.275;
    for (const t of [0, 0.36, 0.7, 1]) beam(timber, new Vector3(0.2 + t * 0.46, 2.62, z), new Vector3(0.2 + t * 0.46, 3.0, z), 0.022, 0.016, up, col);
    beam(timber, new Vector3(0.19, 2.63, z), new Vector3(0.67, 2.63, z), 0.024, 0.016, up, col);
    beam(timber, new Vector3(0.19, 2.99, z), new Vector3(0.67, 2.99, z), 0.024, 0.016, up, col);
    beam(timber, new Vector3(0.21, 2.65, z), new Vector3(0.36, 2.97, z), 0.018, 0.016, up, col);
    beam(timber, new Vector3(0.65, 2.65, z), new Vector3(0.5, 2.97, z), 0.018, 0.016, up, col);
    for (const x of [0.26, 0.43, 0.6]) beam(timber, new Vector3(x, 2.5, 0.22), new Vector3(x, 2.62, 0.27), 0.024, 0.024, new Vector3(1, 0, 0), col);
  }
  // the right shoulder's lower house, by the road
  {
    const y0 = crTop0(1.2, 0.1) - 0.12;
    box(walls, 1.04, 1.34, y0, y0 + 0.34, -0.05, 0.2, 0.85);
    simpleGable(roofs, walls, { x0: 1.04, x1: 1.34, z0: -0.05, z1: 0.2, eave: y0 + 0.34, peak: y0 + 0.62, ridge: 'x', overhang: 0.04, verge: 0.03 });
  }
  // a curtain wall along the plateau's front with a covered walk, and the gatehouse
  box(walls, -0.25, 0.24, TOP - 0.12, 2.3, 0.28, 0.36, 0.85);
  box(walls, 0.62, 1.0, TOP - 0.12, 2.22, 0.36, 0.43, 0.85);
  {
    const col: RGBA = [0.9, 0.9, 0.9, 0.5];
    for (const x of [-0.22, -0.06, 0.08, 0.22]) beam(timber, new Vector3(x, 2.3, 0.34), new Vector3(x, 2.46, 0.34), 0.02, 0.02, new Vector3(0, 0, 1), col);
    simpleGable(roofs, walls, { x0: -0.27, x1: 0.26, z0: 0.18, z1: 0.42, eave: 2.42, peak: 2.6, ridge: 'x', overhang: 0.04, verge: 0.03 });
    box(walls, 0.6, 0.78, TOP - 0.1, 2.5, 0.3, 0.48, 0.95);
    tips.push(pyramidRoof(roofs, 0.6, 0.78, 0.3, 0.48, 2.5, 0.42, 0.03));
    timber.quad(new Vector3(0.65, crTop0(0.69, 0.5) - 0.02, 0.485), new Vector3(0.73, crTop0(0.69, 0.5) - 0.02, 0.485), new Vector3(0.73, 2.16, 0.485), new Vector3(0.65, 2.16, 0.485), [0.35, 0.35, 0.35, 0.2]);
  }

  // the spires: a crooked thicket of thin towers at staggered heights, leaning every which way,
  // some with a jettied timber top, every cone hooked at its tip
  const spires: { x: number; z: number; r: number; y0: number; y1: number; h: number; lean: [number, number]; hook: [number, number]; jetty: boolean }[] = [
    { x: -0.2, z: -0.05, r: 0.068, y0: 3.0, y1: 4.4, h: 0.58, lean: [-0.2, 0], hook: [-0.14, 0.02], jetty: false },
    { x: 0.34, z: -0.42, r: 0.05, y0: 3.0, y1: 4.62, h: 0.52, lean: [0.18, 0], hook: [0.12, 0], jetty: false },
    { x: 0.82, z: -0.28, r: 0.1, y0: TOP - 0.1, y1: 3.92, h: 0.74, lean: [0.2, 0], hook: [0.14, 0.02], jetty: true },
    { x: 1.04, z: 0.0, r: 0.072, y0: 1.7, y1: 3.38, h: 0.56, lean: [0.24, 0.02], hook: [0.16, 0], jetty: true },
    { x: 0.56, z: -0.46, r: 0.068, y0: 2.6, y1: 4.3, h: 0.58, lean: [-0.15, 0], hook: [-0.12, 0], jetty: false },
    { x: -0.6, z: -0.3, r: 0.06, y0: 2.4, y1: 3.98, h: 0.55, lean: [-0.26, 0], hook: [-0.16, 0.02], jetty: true },
    { x: 0.7, z: 0.06, r: 0.052, y0: 2.3, y1: 3.56, h: 0.44, lean: [0.1, 0.02], hook: [0.12, 0], jetty: false },
    { x: 1.26, z: -0.32, r: 0.058, y0: 1.9, y1: 3.66, h: 0.5, lean: [-0.12, 0], hook: [-0.14, 0], jetty: false },
    { x: -0.02, z: 0.14, r: 0.05, y0: 2.2, y1: 3.24, h: 0.4, lean: [-0.1, 0], hook: [0.1, 0], jetty: false },
    { x: 0.27, z: 0.1, r: 0.075, y0: TOP - 0.1, y1: 3.22, h: 0.36, lean: [0.06, 0], hook: [0.1, 0], jetty: true },
  ];
  spires.forEach((s, i) => {
    tower(walls, s.x, s.z, s.r, s.r * 0.9, Math.min(s.y0, crTop0(s.x, s.z) - 0.15), s.y1, 8, s.lean, i);
    const tx = s.x + s.lean[0];
    const tz = s.z + s.lean[1];
    let top = s.y1;
    if (s.jetty) {
      // an overhanging timber top on corbels
      tower(walls, tx, tz, s.r * 1.45, s.r * 1.5, s.y1, s.y1 + s.r * 2.6, 8, [0, 0], i);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + i;
        beam(timber, new Vector3(tx + Math.cos(a) * s.r * 0.85, s.y1 - s.r * 1.3, tz + Math.sin(a) * s.r * 0.85), new Vector3(tx + Math.cos(a) * s.r * 1.42, s.y1 + 0.005, tz + Math.sin(a) * s.r * 1.42), 0.018, 0.018, new Vector3(-Math.sin(a), 0, Math.cos(a)), [0.9, 0.9, 0.9, 0.5]);
      }
      top += s.r * 2.6;
    }
    tips.push(coneRoof(roofs, tx, tz, s.r * (s.jetty ? 1.75 : 1.3), top, s.h, 10, s.hook));
  });
  // a stair turret on the keep's right, and buttresses down the hall
  tower(walls, keep.x + 0.22, keep.z + 0.12, 0.075, 0.07, TOP - 0.1, 3.25, 8, [0.08, 0]);
  tips.push(coneRoof(roofs, keep.x + 0.3, keep.z + 0.12, 0.09, 3.25, 0.34, 8, [0.08, 0]));
  for (const x of [hall.x0 + 0.06, hall.x1 - 0.06]) {
    const b0 = crTop0(x, hall.z1 + 0.08) - 0.1;
    walls.quad(new Vector3(x - 0.035, b0, hall.z1 + 0.13), new Vector3(x + 0.035, b0, hall.z1 + 0.13), new Vector3(x + 0.035, 2.4, hall.z1 + 0.005), new Vector3(x - 0.035, 2.4, hall.z1 + 0.005), [0.8, 0.8, 0.82, 0.7]);
  }
  // dark window recesses (unlit) scattered on the fronts
  for (const [x, y, z] of [
    [-0.6, 2.25, hall.z1 + 0.006],
    [-0.36, 2.12, hall.z1 + 0.006],
    [0.3, 2.2, 0.226],
    [0.52, 2.4, 0.226],
    [keep.x - 0.02, 2.9, keep.z + 0.2],
    [keep.x - 0.1, 3.55, keep.z + 0.19],
    [0.86, 2.8, -0.28 + 0.126],
    [1.08, 2.3, -0.02 + 0.1],
  ] as [number, number, number][])
    timber.quad(new Vector3(x - 0.012, y, z), new Vector3(x + 0.012, y, z), new Vector3(x + 0.012, y + 0.036, z), new Vector3(x - 0.012, y + 0.036, z), [0.25, 0.25, 0.27, 0.1]);

  // lit windows: a few tiny panes (pin-pricks, mostly warm, one cyan), as in the reference
  const win = (x: number, y: number, z: number, w: number, h: number, kind: 'warm' | 'cyan', yaw = 0) => {
    const b = kind === 'warm' ? warm : cyan;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (dx: number, dy: number) => new Vector3(x + dx * c, y + dy, z - dx * s);
    b.tri(P(-w / 2, 0), P(w / 2, 0), P(w / 2, h * 0.75), [1, 1, 1, 0]);
    b.tri(P(-w / 2, 0), P(w / 2, h * 0.75), P(-w / 2, h * 0.75), [1, 1, 1, 0]);
    b.tri(P(-w / 2, h * 0.75), P(w / 2, h * 0.75), P(0, h), [1, 1, 1, 0]);
  };
  win(keep.x - 0.06, 3.3, keep.z + 0.19 + 0.004, 0.016, 0.027, 'warm');
  win(kx - 0.05, 4.03, kz + 0.262, 0.016, 0.027, 'cyan');
  win(-0.48, 2.72, hall.z1 + 0.08, 0.018, 0.033, 'warm');
  win(-1.05, 2.12, 0.165, 0.015, 0.026, 'warm');
  win(0.38, 2.4, 0.225, 0.016, 0.028, 'warm');
  win(0.86, 3.4, -0.28 + 0.112, 0.015, 0.025, 'warm');
  win(-0.42, 2.3, hall.z1 + 0.165, 0.015, 0.026, 'warm');
  // bartizans: little turrets hung on corners, on corbelled cones
  const bartizan = (x: number, y: number, z: number, r: number, h: number, hook: [number, number]) => {
    tower(walls, x, z, r, r, y, y + h, 8, [0, 0]);
    tips.push(coneRoof(roofs, x, z, r * 1.25, y + h, h * 1.2, 8, hook));
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU;
      const a1 = ((i + 1) / 8) * TAU;
      walls.tri(new Vector3(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r), new Vector3(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r), new Vector3(x, y - h * 0.9, z), [0.6, 0.6, 0.62, 0.6]);
    }
  };
  bartizan(hall.x0 - 0.09, 2.62, hall.z1 + 0.08, 0.055, 0.2, [-0.05, 0]);
  bartizan(0.18, 2.7, 0.27, 0.05, 0.18, [0.04, 0]);
  bartizan(keep.x + 0.22, 3.55, keep.z + 0.1, 0.045, 0.16, [0.05, 0]);
  // chimneys on the hall's roof and the middle block
  box(walls, -0.5, -0.44, 3.05, 3.42, -0.05, 0.01, 0.8);
  box(walls, 0.52, 0.57, 3.3, 3.62, 0.0, 0.05, 0.8);

  // iron finials on the points
  tips.forEach((t, i) => finial({ seed: 600 + i, height: 0.15 + 0.08 * rand(5, 'tip', i), radius: 0.011, scrolls: 0 }, iron, new Matrix4().makeTranslation(t.x, t.y - 0.01, t.z)));

  // the road: a pale ribbon from the gate along the plateau's front, off the rim and down the
  // shoulder's moonlit slope in switchbacks, then round the foot to the far house's door
  {
    const onSlope = (th: number, y: number, out = 0.06) => {
      const r = cragR(th, y) + out;
      return new Vector3(CRAG_C.x + Math.cos(th) * r, y, CRAG_C.z + Math.sin(th) * r);
    };
    const thRim = 0.95;
    const top = catmull(
      [
        [0.69, 0, 0.52],
        [0.62, 0, 0.66],
        [CRAG_C.x + Math.cos(thRim) * rimR(thRim) * 0.94, 0, CRAG_C.z + Math.sin(thRim) * rimR(thRim) * 0.94],
      ],
      6,
    ).map((p) => new Vector3(p.x, crTop0(p.x, p.z) + 0.014, p.z));
    // switchbacks down the shoulder's face, in (angle, height)
    const legs: [number, number][] = [
      [thRim, rimY(thRim) - 0.06],
      [1.72, 1.36],
      [0.95, 1.1],
      [1.8, 0.84],
      [1.1, 0.62],
      [1.9, 0.44],
    ];
    const slope: Vector3[] = [];
    for (let i = 0; i < legs.length - 1; i++) {
      const [a0, y0] = legs[i];
      const [a1, y1] = legs[i + 1];
      const n = 10;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const e = t * t * (3 - 2 * t);
        slope.push(onSlope(a0 + (a1 - a0) * t, y0 + (y1 - y0) * e));
      }
    }
    slope.push(onSlope(...legs[legs.length - 1]));
    // round the foot on the ground to the far house's door
    const foot: Vector3[] = [];
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const th = 1.9 + (2.62 - 1.9) * t;
      const p = onSlope(th, 0.42, 0.18 + 0.1 * Math.sin(t * Math.PI));
      p.y = groundLocal(p.x, p.z) + 0.03;
      foot.push(p);
    }
    foot.push(new Vector3(FAR.x + 0.1, FAR.y - 0.04, FAR.z + 0.22));
    const pts = [...top, ...slope.slice(1), ...foot];
    const half = 0.085;
    let prevA: Vector3 | null = null;
    let prevB: Vector3 | null = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dir = b.clone().sub(a).normalize();
      // across the road: in the surface, perpendicular to its direction (the surface's normal is
      // up on the plateau and the ground, outward-and-up on the slope)
      const th = Math.atan2(p.z - CRAG_C.z, p.x - CRAG_C.x);
      const radial = new Vector3(Math.cos(th), 0, Math.sin(th));
      const onFace = i >= top.length && i < top.length + slope.length - 1;
      const n = onFace ? radial.clone().multiplyScalar(0.72).add(new Vector3(0, 0.7, 0)).normalize() : new Vector3(0, 1, 0);
      const across = new Vector3().crossVectors(n, dir).normalize();
      const wob = 1 + 0.2 * Math.sin(i * 1.3);
      const A = p.clone().addScaledVector(across, half * wob);
      const Bp = p.clone().addScaledVector(across, -half * wob);
      if (prevA && prevB) {
        const v = 0.95 + 0.12 * Math.sin(i * 0.7);
        const col: RGBA = [v, v, v, 0.5];
        // wind the quad so it faces out of the surface
        const fn = new Vector3().subVectors(prevB, prevA).cross(new Vector3().subVectors(Bp, prevA));
        if (fn.dot(n) > 0) road.quad(prevA, prevB, Bp, A, col);
        else road.quad(prevA, A, Bp, prevB, col);
      }
      prevA = A;
      prevB = Bp;
    }
  }

  // the buildings squashed toward the table under them, then the crag, its road, the dead tree and
  // the buildings lifted (BUILD_Y, LIFT: see crTop)
  bodies.forEach((b, i) =>
    b.warp((p) => {
      const g = crTop0(p.x, p.z);
      p.y = g + (p.y - g) * BUILD_Y;
    }, marks[i]),
  );
  for (const b of [rock, road, ...bodies]) b.warp((p) => void (p.y += liftAt(p.y)));

  // the far house on its knoll at the crag's foot, clear of the cliff: a steep front gable in tiles,
  // a chimney up its left slope, one warm window and a door; the knoll a mound rising out of the hill
  {
    const g = groundLocal(FAR.x, FAR.z);
    // the knoll: a low dome of rock and turf from the ground up to the house's floor
    {
      const n = 14;
      const rings = 5;
      const R = 0.52;
      const P = (i: number, k: number) => {
        const a = (i / n) * TAU;
        const t = k / rings;
        const rr = R * (1 - t * 0.78) * (1 + 0.08 * Math.sin(a * 3 + 1));
        const x = FAR.x + Math.cos(a) * rr;
        const z = FAR.z + Math.sin(a) * rr * 0.85;
        const y = g - 0.06 + (FAR.y - 0.01 - g + 0.06) * Math.sin((t * Math.PI) / 2);
        return new Vector3(x, y, z);
      };
      for (let k = 0; k < rings; k++)
        for (let i = 0; i < n; i++) {
          const v0 = 0.8 + 0.2 * (k / rings);
          rock.quad(P(i, k), P(i + 1, k), P(i + 1, k + 1), P(i, k + 1), [v0, v0, v0, 0.6]);
        }
      // the top: a flat cap under the house
      const ctr = new Vector3(FAR.x, FAR.y - 0.01, FAR.z);
      for (let i = 0; i < n; i++) rock.tri(P(i, rings), P(i + 1, rings), ctr, [1, 1, 1, 0.6]);
    }
    // the house, turned a little toward the hero eye: a steep front gable (its triangle against the
    // crag's haze), one warm window in the gable end, a door, the chimney up its left slope
    const hx = FAR.x;
    const hz = FAR.z;
    const turn = new Matrix4().makeTranslation(hx, 0, hz).multiply(new Matrix4().makeRotationY(0.45)).multiply(new Matrix4().makeTranslation(-hx, 0, -hz));
    const from = { w: walls.count, r: roofs.count, t: timber.count, a: warm.count };
    const fx0 = hx - 0.17;
    const fx1 = hx + 0.17;
    const fz0 = hz - 0.2;
    const fz1 = hz + 0.16;
    const fe = FAR.y + 0.2;
    box(walls, fx0, fx1, FAR.y - 0.12, fe, fz0, fz1, 0.95);
    simpleGable(roofs, walls, { x0: fx0, x1: fx1, z0: fz0, z1: fz1, eave: fe, peak: FAR.y + 0.5, ridge: 'z', overhang: 0.045, verge: 0.045 }, 0.055);
    // (built unturned: the turn below carries it to CHIMNEY)
    box(walls, hx - 0.1 - 0.032, hx - 0.1 + 0.032, FAR.y + 0.25, CHIMNEY.y, hz - 0.08 - 0.032, hz - 0.08 + 0.032, 0.9);
    win(hx + 0.06, FAR.y + 0.05, fz1 + 0.004, 0.075, 0.12, 'warm');
    // its mullion and transom, dark across the glow
    timber.quad(new Vector3(hx + 0.054, FAR.y + 0.05, fz1 + 0.007), new Vector3(hx + 0.066, FAR.y + 0.05, fz1 + 0.007), new Vector3(hx + 0.066, FAR.y + 0.165, fz1 + 0.007), new Vector3(hx + 0.054, FAR.y + 0.165, fz1 + 0.007), [0.5, 0.5, 0.5, 0.2]);
    timber.quad(new Vector3(hx + 0.022, FAR.y + 0.1, fz1 + 0.007), new Vector3(hx + 0.098, FAR.y + 0.1, fz1 + 0.007), new Vector3(hx + 0.098, FAR.y + 0.112, fz1 + 0.007), new Vector3(hx + 0.022, FAR.y + 0.112, fz1 + 0.007), [0.5, 0.5, 0.5, 0.2]);
    timber.quad(new Vector3(hx - 0.11, FAR.y, fz1 + 0.003), new Vector3(hx - 0.04, FAR.y, fz1 + 0.003), new Vector3(hx - 0.04, FAR.y + 0.15, fz1 + 0.003), new Vector3(hx - 0.11, FAR.y + 0.15, fz1 + 0.003), [0.7, 0.7, 0.7, 0.4]);
    walls.warp((p) => p.applyMatrix4(turn), from.w);
    roofs.warp((p) => p.applyMatrix4(turn), from.r);
    timber.warp((p) => p.applyMatrix4(turn), from.t);
    warm.warp((p) => p.applyMatrix4(turn), from.a);
  }

  const out: Record<string, BufferGeometry> = {};
  const stats: Record<string, number> = {};
  for (const [k, b] of Object.entries({ rock, walls, roofs, timber, iron, warm, cyan, road })) {
    out[k] = b.geometry();
    stats[k] = b.triangles;
  }
  return { ...(out as unknown as Omit<CastleGeos, 'stats'>), stats };
}

// ---- mist and smoke: camera-facing soft cards, one draw each ------------------------------------

/** A soft blob (alpha), drawn once: a few overlapping radial puffs. */
function puffCanvas(seed: number, wispy: boolean): HTMLCanvasElement {
  const W = 128;
  const H = wispy ? 64 : 128;
  const { c, g } = canvas(W, H);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const x = W * (0.25 + 0.5 * rand(seed, 'px', i));
    const y = H * (0.4 + 0.2 * rand(seed, 'py', i));
    const r = Math.min(W, H) * (0.18 + 0.2 * rand(seed, 'pr', i));
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${wispy ? 0.2 : 0.34})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${wispy ? 0.08 : 0.14})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }
  return c;
}

interface Card {
  at: Vector3;
  w: number;
  h: number;
  alpha: number;
  color: Color;
}

/** Fill a quad list geometry with camera-facing cards (positions, uvs, rgba). */
function writeCards(g: BufferGeometry, cards: Card[], camera: Camera, frame: Matrix4): void {
  const pos = g.attributes.position as BufferAttribute;
  const col = g.attributes.color as BufferAttribute;
  // the camera's right and up, in castle-local space (the frame has a yaw only)
  const inv = new Matrix4().copy(frame).invert();
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion).transformDirection(inv);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(inv);
  const P = new Vector3();
  cards.forEach((c, i) => {
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    corners.forEach(([sx, sy], k) => {
      P.copy(c.at)
        .addScaledVector(right, (sx * c.w) / 2)
        .addScaledVector(up, (sy * c.h) / 2);
      pos.setXYZ(i * 4 + k, P.x, P.y, P.z);
      col.setXYZW(i * 4 + k, c.color.r, c.color.g, c.color.b, c.alpha);
    });
  });
  pos.needsUpdate = true;
  col.needsUpdate = true;
  g.computeBoundingSphere();
}

function cardGeometry(n: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 12), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(n * 16), 4));
  const uv = new Float32Array(n * 8);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** the mist banks at the crag's foot and round the far house (castle-local) */
const MIST: { at: [number, number, number]; w: number; h: number; a: number }[] = [
  // low banks at the foot, two or three thin overlapping layers each (translucent haze)
  { at: [-1.6, 0.42, 1.1], w: 1.9, h: 0.45, a: 0.36 },
  { at: [-1.0, 0.6, 1.3], w: 1.3, h: 0.34, a: 0.26 },
  { at: [-0.2, 0.45, 1.25], w: 2.1, h: 0.5, a: 0.38 },
  { at: [0.4, 0.58, 1.4], w: 1.6, h: 0.42, a: 0.28 },
  { at: [1.2, 0.5, 1.5], w: 1.9, h: 0.5, a: 0.38 },
  { at: [2.1, 0.6, 1.2], w: 1.6, h: 0.6, a: 0.34 },
  { at: [-2.3, 0.6, 0.6], w: 1.7, h: 0.65, a: 0.38 },
  { at: [-0.7, 0.92, 1.05], w: 1.2, h: 0.32, a: 0.2 },
  { at: [1.8, 1.3, 1.0], w: 1.0, h: 0.3, a: 0.16 },
];
const PUFFS = 7;
const MIST_CYAN = new Color('#3fb6d2');

export interface CastleProps {
  f: number;
  /** the parallax offset (world units): the film passes (camera − HERO.pos) × [0.75, 0.45, 0] */
  offset?: [number, number, number];
  /** frames per second (the smoke's drift); default 24 */
  fps?: number;
}

export function Castle({ f, offset = [0, 0, 0], fps = 24 }: CastleProps) {
  const camera = useThree((s) => s.camera);
  const geos = useMemo(buildCastle, []);
  const cards = useMemo(() => ({ mist: cardGeometry(MIST.length), smoke: cardGeometry(PUFFS) }), []);
  const tex = useMemo(() => {
    const mist = new CanvasTexture(puffCanvas(3, true));
    const smoke = new CanvasTexture(puffCanvas(9, false));
    mist.colorSpace = SRGBColorSpace;
    smoke.colorSpace = SRGBColorSpace;
    return { mist, smoke };
  }, []);
  const mats = useMemo(
    () => ({
      // the crag's moonlit shoulder glows through the haze as in the reference (more of the fog's light)
      rock: storybookMaterial({ kind: 'stone', color: '#4f7884', color2: '#7fd3df', breakup: 0.36, scale: 0.28, bump: 1.1, topCoat: 0.62, vertexColors: true, rim: 1.2, fog: 1.4 }),
      walls: storybookMaterial({ kind: 'stone', color: '#526474', color2: '#3a4652', breakup: 0.32, scale: 0.1, bump: 0.6, vertexColors: true, rim: 1.1 }),
      roofs: storybookMaterial({ kind: 'stone', color: '#5d6e80', color2: '#93adb5', breakup: 0.25, scale: 0.05, bump: 0.4, topCoat: 0.55, vertexColors: true, rim: 1.2 }),
      timber: storybookMaterial({ kind: 'wood', color: '#2a2428', color2: '#1a1618', breakup: 0.2, scale: 0.08, vertexColors: true, rim: 0.8 }),
      iron: storybookMaterial({ kind: 'iron', color: '#1b1d22', metalness: 0.4, roughness: 0.5, breakup: 0.1, scale: 0.04, vertexColors: true, rim: 1.0 }),
      warm: storybookMaterial({ color: '#000000', emissive: '#ffb35c', emissiveIntensity: 1.45, fog: 0.6, rim: 0, ambient: 0, breakup: 0, side: DoubleSide }),
      cyan: storybookMaterial({ color: '#000000', emissive: '#7be8f6', emissiveIntensity: 1.45, fog: 0.6, rim: 0, ambient: 0, breakup: 0, side: DoubleSide }),
      road: storybookMaterial({ kind: 'stone', color: '#d2e2de', color2: '#eef8f2', breakup: 0.2, scale: 0.08, bump: 0.3, topCoat: 0.7, vertexColors: true, rim: 0.6, fog: 0.9 }),
      mist: new MeshBasicMaterial({ map: tex.mist, vertexColors: true, transparent: true, depthWrite: false, fog: false }),
      smoke: new MeshBasicMaterial({ map: tex.smoke, vertexColors: true, transparent: true, depthWrite: false, fog: false }),
    }),
    [tex],
  );
  useLayoutEffect(
    () => () => {
      Object.values(geos).forEach((g) => (g instanceof BufferGeometry ? g.dispose() : null));
      Object.values(cards).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      tex.mist.dispose();
      tex.smoke.dispose();
    },
    [geos, cards, mats, tex],
  );
  const t = f / fps;
  // mist and smoke: colours from the night's fog (so they follow the rig), facing the camera
  useLayoutEffect(() => {
    const mid = NIGHT.uSbFogMid.value as Color;
    const far = NIGHT.uSbFogFar.value as Color;
    const glow = NIGHT.uSbMoonGlow.value as Color;
    // toward the reference's luminous cyan banks (about sRGB 37 145 171 under the castle)
    const mistColor = mid.clone().lerp(far, 0.6).lerp(glow, 0.25).lerp(MIST_CYAN, 0.55);
    const mist: Card[] = MIST.map((m, i) => ({
      at: new Vector3(m.at[0] + 0.12 * Math.sin(t * 0.08 + i * 1.7), m.at[1] + 0.02 * Math.sin(t * 0.13 + i), m.at[2]),
      w: m.w,
      h: m.h,
      alpha: Math.min(0.6, m.a * 1.3),
      color: mistColor,
    }));
    const smokeColor = mid.clone().lerp(glow, 0.4).lerp(new Color('#9aa6ac'), 0.3);
    const smoke: Card[] = Array.from({ length: PUFFS }, (_, i) => {
      const age = (((t * 0.11 + i / PUFFS) % 1) + 1) % 1;
      const rise = age * 0.75;
      return {
        at: new Vector3(CHIMNEY.x + age * 0.32 + 0.04 * Math.sin(t * 0.7 + i * 2.1), CHIMNEY.y + 0.05 + rise, CHIMNEY.z + 0.02),
        w: 0.12 + age * 0.5,
        h: 0.1 + age * 0.38,
        alpha: 0.7 * smoothstep(0, 0.1, age) * (1 - smoothstep(0.5, 1, age)),
        color: smokeColor,
      };
    });
    writeCards(cards.mist, mist, camera, FRAME);
    writeCards(cards.smoke, smoke, camera, FRAME);
  }, [cards, camera, t]);
  const pos: [number, number, number] = [BASE.x + offset[0], BASE.y + offset[1], BASE.z + offset[2]];
  return (
    <group position={pos} rotation-y={CRAG_YAW}>
      <mesh geometry={geos.rock} material={mats.rock} castShadow receiveShadow />
      <mesh geometry={geos.walls} material={mats.walls} castShadow receiveShadow />
      <mesh geometry={geos.roofs} material={mats.roofs} castShadow receiveShadow />
      <mesh geometry={geos.timber} material={mats.timber} castShadow />
      <mesh geometry={geos.iron} material={mats.iron} />
      <mesh geometry={geos.warm} material={mats.warm} />
      <mesh geometry={geos.cyan} material={mats.cyan} />
      <mesh geometry={geos.road} material={mats.road} receiveShadow />
      <mesh geometry={cards.mist} material={mats.mist} frustumCulled={false} renderOrder={2} />
      <mesh geometry={cards.smoke} material={mats.smoke} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

/** Triangle counts per part (for the budget). */
export function castleStats(): Record<string, number> {
  const g = buildCastle();
  Object.values(g).forEach((x) => (x instanceof BufferGeometry ? x.dispose() : null));
  return g.stats;
}

