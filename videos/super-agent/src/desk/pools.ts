/**
 * Light pools: light is attention or work (synthesis §2). A pool is an analytic patch of light on
 * the receivers between two heights (the desk, the deck top, a bay floor), computed in the desk
 * shader and in every lit material. No punctual lights: three keys its programs on light counts,
 * and a fixed light set keeps the program cache warm (gl/light.ts).
 *
 * Colours are the synthesis's light colours (chroma ≤ 0.03, never amber), in linear RGB relative
 * to the albedo. Pure.
 */
import { BAYS, BENCH, CELLS_X, GALLEY_TRAY, TAPE, rectC, type Pool, type P3 } from './layout.ts';
import { LAMP_AIM, type DeskState } from './state.ts';

/** At most this many pools (the uniform array's size). */
export const MAX_POOLS = 8;

/** sRGB hex to linear RGB. */
export function linearOf(hex: string): P3 {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

const tint = (hex: string, k: number): P3 => {
  // the light's colour normalised to unit luminance, times k
  const [r, g, b] = linearOf(hex);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(r / y) * k, (g / y) * k, (b / y) * k];
};

/** The synthesis's light colours. */
export const LIGHT_HEX = { yours: '#FFF1E0', reading: '#F4F5F2', work: '#EEF3F0' } as const;

export function poolsAt(s: DeskState): Pool[] {
  const cellY = (TAPE.y0 + TAPE.y1) / 2;
  const newest = (CELLS_X[0][0] + CELLS_X[0][1]) / 2;
  const pools: Pool[] = [
    // the Register's hooded reading lamp, on the newest cells (it never blooms: a pool only)
    { c: [newest + 40, cellY], z: [118, 170], sigma: [96, 38], rgb: tint(LIGHT_HEX.reading, 1.55) },
    // the stamp-in: the newest cell lights as the report's header goes inline
    { c: [newest, cellY], z: [118, 140], sigma: [30, 26], rgb: tint(LIGHT_HEX.reading, 0.9 * s.cellLit) },
    // your lamp on your in-tray, where the reply lands: one step dimmer until it has
    { c: LAMP_AIM, z: [0, 140], sigma: [92, 82], rgb: tint(LIGHT_HEX.yours, 2.3 * s.lamp) },
    // the bug bay's work slot lights its own bench, folder and floor
    { c: [rectC(BENCH.top)[0] + 10, rectC(BENCH.top)[1] + 10], z: [0, 90], sigma: [110, 86], rgb: tint(LIGHT_HEX.work, 1.25 * s.bugLight) },
    // the test tower's work light, dimming as it finishes
    { c: [rectC(BAYS.tests.slot)[0] + 30, rectC(BAYS.tests.slot)[1] - 34], z: [0, 60], sigma: [70, 56], rgb: tint(LIGHT_HEX.work, 0.75 * s.testsLight) },
    // the docs galley's clamped work light (stepped down with its bay in C12)
    { c: [rectC(GALLEY_TRAY.box)[0], rectC(GALLEY_TRAY.box)[1]], z: [0, 50], sigma: [120, 54], rgb: tint(LIGHT_HEX.work, 0.32) },
  ];
  if (pools.length > MAX_POOLS) throw new Error(`desk: ${pools.length} pools, over ${MAX_POOLS}`);
  return pools;
}

/** Three vec4 per pool, for `uniform vec4 uPool[3 * MAX_POOLS]`: (cx, cy, zmin, zmax), (sx, sy, 0, 0), (r, g, b, 0). */
export function packPools(pools: readonly Pool[], out: Float32Array = new Float32Array(MAX_POOLS * 12)): Float32Array {
  out.fill(0);
  pools.forEach((p, i) => out.set([p.c[0], p.c[1], p.z[0], p.z[1], p.sigma[0], p.sigma[1], 0, 0, p.rgb[0], p.rgb[1], p.rgb[2], 0], i * 12));
  return out;
}
