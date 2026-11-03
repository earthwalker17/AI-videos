/**
 * Scalar fields for procedural geometry, on the CPU: fractal value noise and ridges built on
 * @aiv/core's hashed `valueNoise` (stateless: a value depends only on its coordinates and seed),
 * so terrain heights, scatter densities and bark wobble are the same on every chunk page.
 * Generic: no film imports (listed in video.json `reusable`).
 */
import { valueNoise } from '@aiv/core';

/** Fractal value noise in [-1, 1] (roughly), `octaves` doublings from `freq`. */
export function fbm2(x: number, z: number, seed: number, octaves = 4, freq = 1, gain = 0.5): number {
  let s = 0;
  let a = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    // rotate each octave a little so the lattice never lines up
    const c = Math.cos(o * 1.7);
    const sn = Math.sin(o * 1.7);
    const u = (x * c - z * sn) * f + o * 17.3;
    const v = (x * sn + z * c) * f - o * 9.1;
    s += a * (valueNoise(u, v, seed + o * 101) * 2 - 1);
    norm += a;
    a *= gain;
    f *= 2.03;
  }
  return s / norm;
}

/** Ridged noise in [0, 1]: sharp crests where fbm crosses zero (rock seams, roots, cracks). */
export function ridge2(x: number, z: number, seed: number, octaves = 3, freq = 1): number {
  return 1 - Math.abs(fbm2(x, z, seed, octaves, freq));
}

/** Smooth bump in [0, 1]: 1 at the centre, 0 beyond radius r (a cosine falloff). */
export function bump(x: number, z: number, cx: number, cz: number, r: number): number {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}
