/**
 * Scalar fields for procedural geometry, on the CPU: fractal value noise and ridges built on
 * @aiv/core's hashed `valueNoise` (stateless: a value depends only on its coordinates and seed),
 * so terrain heights, scatter densities and bark wobble are the same on every chunk page.
 * Generic: no film imports (listed in video.json `reusable`).
 */
import { mix32, valueNoise } from '@aiv/core';

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

// ---- the same noise, faster ------------------------------------------------------------------
// @aiv/core's valueNoise hashes each lattice corner with hash32(seed, x, z) (rest arguments, an
// integer check per value, three mixes per value); the four corners share the seed's and the
// columns' mixes. These replicas inline the hash and share them: bit-identical results (checked
// against the originals when this module loads; on any mismatch they are the originals).

const HK = 0x632be5ab;
/** hash32's quantisation of one value (integers as they are, floats to 1e-6) */
const q32 = (v: number) => (Number.isInteger(v) ? v | 0 : Math.round(v * 1e6) | 0);

/** = @aiv/core valueNoise (bit-identical, a few times faster). */
function valueNoiseExact(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  // hash32(seed, a, b) = mix32(mix32(mix32(H0 ^ m(seed)) ^ m(a)) ^ m(b)), m(v) = mix32(q32(v) + HK);
  // a floor (or a floor + 1) is an integer, NaN or ±Infinity, which q32 maps as `| 0` does
  const hs = mix32(0x9e3779b9 ^ mix32(q32(seed) + HK));
  const h0 = mix32(hs ^ mix32((xi | 0) + HK));
  const h1 = mix32(hs ^ mix32(((xi + 1) | 0) + HK));
  const m0 = mix32((zi | 0) + HK);
  const m1 = mix32(((zi + 1) | 0) + HK);
  const h00 = mix32(h0 ^ m0) / 4294967296;
  const h10 = mix32(h1 ^ m0) / 4294967296;
  const h01 = mix32(h0 ^ m1) / 4294967296;
  const h11 = mix32(h1 ^ m1) / 4294967296;
  const a = h00 + (h10 - h00) * u;
  const b = h01 + (h11 - h01) * u;
  return a + (b - a) * v;
}

const OCT_C = Array.from({ length: 16 }, (_, o) => Math.cos(o * 1.7));
const OCT_S = Array.from({ length: 16 }, (_, o) => Math.sin(o * 1.7));

/** = fbm2 (bit-identical, a few times faster): for the hot loops (textures, per-vertex bark). */
function fbm2Exact(x: number, z: number, seed: number, octaves = 4, freq = 1, gain = 0.5): number {
  if (octaves > OCT_C.length) return fbm2(x, z, seed, octaves, freq, gain);
  let s = 0;
  let a = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    const c = OCT_C[o];
    const sn = OCT_S[o];
    const u = (x * c - z * sn) * f + o * 17.3;
    const v = (x * sn + z * c) * f - o * 9.1;
    s += a * (valueNoiseExact(u, v, seed + o * 101) * 2 - 1);
    norm += a;
    a *= gain;
    f *= 2.03;
  }
  return s / norm;
}

/** The replicas agree with the originals (integer and fractional seeds, cells either side of 0, huge and odd inputs). */
const EXACT = (() => {
  const probe = [0, -0, 0.5, -0.5, 1e-9, -1e-9, 3.7, -12.25, 1e6 + 0.3, -2.5e9, 3e10, NaN, Infinity, -Infinity];
  for (let k = 0; k < 160; k++) {
    const x = k < probe.length ? probe[k] : ((k * 0.6180339887) % 1) * 40 - 20;
    const z = k < probe.length ? probe[(k * 5) % probe.length] : ((k * 0.7548776662) % 1) * 40 - 20;
    const seed = [7, 61, 0, -3, 2.5, 911.25, 1e7][k % 7];
    if (!Object.is(valueNoiseExact(x, z, seed), valueNoise(x, z, seed))) return false;
    if (!Object.is(fbm2Exact(x, z, seed, 1 + (k % 5), 1 + (k % 3) * 0.7, 0.5 + (k % 2) * 0.1), fbm2(x, z, seed, 1 + (k % 5), 1 + (k % 3) * 0.7, 0.5 + (k % 2) * 0.1))) return false;
  }
  return true;
})();

/** fbm2, bit-identical and faster (the same function where the replica could not be checked). */
export const fbm2Fast: typeof fbm2 = EXACT ? fbm2Exact : fbm2;
