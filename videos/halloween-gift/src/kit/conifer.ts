/**
 * Tall, ragged, drooping conifers as one low-poly BufferGeometry: a thin, slightly bent trunk
 * and stacked tiers of drooping branches whose needles are jagged clumps of spikes that hang
 * down and out, so the silhouette is a ragged spire of sagging skirts (the reference's dark
 * pines), not a cone. Every spike is two back-to-back triangles that share one soft "foliage"
 * normal (out from the trunk and a little up), so lighting and the moon rim read on the whole
 * mass instead of flickering per needle, with a front-side-only material. Vertex colour darkens
 * the inside of the crown and the lower tiers (ambient occlusion); its alpha masks the storybook
 * rim: the foliage's outer tips take it, the trunk and the inner needles never (no pale spine
 * through the crown's gaps).
 *
 * Deterministic: all randomness from @aiv/core's hashed `rand(seed, id, k)` through a per-build
 * counter. Generic: no film imports.
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

export interface ConiferParams {
  seed: number;
  /** total height (local y of the leader's tip) */
  height: number;
  /** the longest branch (the lower tiers) */
  radius: number;
  trunkRadius: number;
  /** tiers (whorls) of branches */
  tiers: number;
  /** branches per tier, on average */
  branches: number;
  /** how far a branch's tip sags, as a fraction of its length */
  droop: number;
  /** 0..1: branches missing, uneven lengths, gaps between tiers */
  ragged: number;
  /** needle clumps per unit of branch length */
  clumps: number;
  /** needle spike length (world units) */
  spike: number;
  /** spikes per clump */
  spikes: number;
  /** fraction of the height where the lowest tier is */
  base: number;
  /** the trunk's lean: [x, z] per unit of height */
  lean: [number, number];
  /** the ground's local height under (x, z) (trunk AO, a buried base) */
  ground?: (x: number, z: number) => number;
  /** the foliage normals lean toward this direction (the side the cameras look from), 0..1 by its length */
  facing?: [number, number, number];
}

export const CONIFER: ConiferParams = {
  seed: 1,
  height: 3.6,
  radius: 0.7,
  trunkRadius: 0.06,
  tiers: 18,
  branches: 6,
  droop: 0.45,
  ragged: 0.45,
  clumps: 14,
  spike: 0.16,
  spikes: 5,
  base: 0.12,
  lean: [0, 0],
};

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Build a conifer; geometry with position, normal, color (rgba: AO and the rim's mask). */
export function buildConifer(params: Partial<ConiferParams> & { seed: number }): BufferGeometry {
  const p: ConiferParams = { ...CONIFER, ...params };
  let k = 0;
  const r = () => rand(p.seed, 'conifer', k++);
  const ground = p.ground ?? (() => 0);
  const facing = new Vector3(...(p.facing ?? [0, 0, 0]));
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  // the trunk's axis: a gentle bend and a lean
  const bendA = r() * TAU;
  const bend = 0.04 + r() * 0.06;
  const axis = (y: number) => {
    const t = y / p.height;
    const b = Math.sin(t * Math.PI) * bend * p.height;
    return new Vector3(p.lean[0] * y + Math.cos(bendA) * b, y, p.lean[1] * y + Math.sin(bendA) * b);
  };

  // ---- the trunk: a tapered 6-sided tube from below the ground into the crown, dark, no rim
  const radial = 6;
  const rings = 12;
  const y0 = -0.2;
  const y1 = p.height * 0.8;
  const v0 = pos.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = y0 + (y1 - y0) * t;
    const c = axis(y);
    const rr = p.trunkRadius * Math.pow(1 - t, 1.3) * (1 + (0.6 * Math.max(0, 0.12 - t)) / 0.12) + 0.002;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const x = c.x + nx * rr;
      const z = c.z + nz * rr;
      pos.push(x, y, z);
      const tn = new Vector3(nx, 0, nz).add(facing).normalize();
      nrm.push(tn.x, tn.y, tn.z);
      const h = y - ground(x, z);
      const ao = 0.25 + 0.2 * Math.min(1, Math.max(0, (h + 0.05) / 0.6));
      col.push(ao, ao * 0.9, ao * 0.95, 0);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < radial; j++) {
      const a = v0 + i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }

  // ---- one needle spike: two back-to-back triangles sharing the foliage normal
  const side = new Vector3();
  const tmp = new Vector3();
  const spike = (c: Vector3, d: Vector3, len: number, width: number, fn: Vector3, shade: number, rim: number) => {
    tmp.set(r() - 0.5, r() - 0.5, r() - 0.5);
    side.crossVectors(d, tmp).normalize().multiplyScalar(width);
    const base = pos.length / 3;
    const tip = c.clone().addScaledVector(d, len);
    for (const v of [c.clone().sub(side), c.clone().add(side), tip]) pos.push(v.x, v.y, v.z);
    for (let i = 0; i < 3; i++) nrm.push(fn.x, fn.y, fn.z);
    const s0 = shade;
    const s1 = Math.min(1, shade * 1.25);
    col.push(s0, s0, s0, rim * 0.5, s0, s0, s0, rim * 0.5, s1, s1, s1, rim);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 1);
  };

  // ---- tiers of drooping branches
  const down = new Vector3(0, -1, 0);
  const fn = new Vector3();
  let roll = r() * TAU;
  for (let ti = 0; ti < p.tiers; ti++) {
    const tt = ti / (p.tiers - 1);
    // tiers crowd toward the top; ragged gaps
    const h = p.height * (p.base + (0.95 - p.base) * Math.pow(tt, 0.92)) + (r() - 0.5) * p.ragged * 0.12;
    const c0 = axis(h);
    // the crown's outline: widest low, a long narrow spire, ragged (a tier now and then sticks out)
    const env = Math.pow(1 - tt, 0.85) * (0.35 + 0.65 * Math.min(1, (1 - tt) * 1.6)) * (r() < p.ragged * 0.25 ? 1.25 : 1);
    const n = Math.max(2, Math.round(p.branches * (0.6 + 0.6 * (1 - tt)) + (r() - 0.5) * 2));
    for (let bi = 0; bi < n; bi++) {
      if (r() < p.ragged * 0.3) continue; // a missing branch
      roll += GOLDEN + (r() - 0.5) * 0.6;
      const L = p.radius * env * (0.55 + 0.75 * r() * (0.6 + p.ragged * 0.4)) + 0.05;
      const dir = new Vector3(Math.cos(roll), 0, Math.sin(roll));
      const rise = 0.22 - 0.22 * (1 - tt) + (r() - 0.5) * 0.15;
      const sag = p.droop * (0.6 + 0.8 * r()) * (0.5 + 0.5 * (1 - tt));
      const at = (t: number) => c0.clone().addScaledVector(dir, L * t).add(new Vector3(0, L * (rise * t - sag * t * t), 0));
      const clumps = Math.max(2, Math.round(L * p.clumps));
      // the branch's own normal: out from the trunk and a little up, toward the cameras
      fn.copy(dir).multiplyScalar(0.85).add(new Vector3(0, 0.35, 0)).add(facing).normalize();
      for (let ci = 0; ci < clumps; ci++) {
        const t = 0.15 + 0.85 * ((ci + 0.3 + r() * 0.4) / clumps);
        const c = at(t);
        const shade = (0.38 + 0.52 * t) * (0.7 + 0.3 * tt);
        // the rim only on the outer half of a branch (the crown's silhouette)
        const rim = Math.max(0, Math.min(1, (t - 0.45) / 0.4));
        const m = Math.max(3, Math.round(p.spikes * (0.7 + r() * 0.6)));
        // a hairy tuft: jagged spikes spread round the twig, most hanging down and out, a few up
        const lat = new Vector3(-dir.z, 0, dir.x);
        for (let si = 0; si < m; si++) {
          const up = r() < 0.16;
          const sideK = (r() * 2 - 1) * 0.9;
          const d = new Vector3()
            .addScaledVector(dir, 0.3 + r() * 0.6)
            .addScaledVector(lat, sideK)
            .addScaledVector(up ? new Vector3(0, 1, 0) : down, up ? 0.25 + r() * 0.3 : 0.4 + 0.6 * t + r() * 0.45)
            .add(new Vector3((r() - 0.5) * 0.3, (r() - 0.5) * 0.2, (r() - 0.5) * 0.3))
            .normalize();
          const len = p.spike * (0.5 + r() * 0.9) * (0.7 + 0.5 * (1 - tt)) * (up ? 0.6 : 1);
          const c1 = c.clone().addScaledVector(lat, sideK * 0.03).add(new Vector3(0, (r() - 0.5) * 0.03, 0));
          spike(c1, d, len, len * (0.1 + r() * 0.1), fn, shade * (0.8 + r() * 0.35), rim);
        }
      }
      // the drooping tip
      const tip = at(1);
      const td = new Vector3().addScaledVector(dir, 0.7).addScaledVector(down, 0.5 + sag).normalize();
      spike(tip, td, p.spike * 1.1, p.spike * 0.14, fn, 0.9, 1);
    }
  }
  // ---- the leader: a ragged spike at the top
  const top = axis(p.height * 0.94);
  const lean = new Vector3(p.lean[0] + (r() - 0.5) * 0.25, 1, p.lean[1] + (r() - 0.5) * 0.25).normalize();
  for (let i = 0; i < 3; i++) spike(top, lean.clone().add(new Vector3((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2)).normalize(), p.height * 0.07 * (0.6 + r() * 0.5), p.spike * 0.1, new Vector3(0, 1, 0), 0.8, 1);

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
