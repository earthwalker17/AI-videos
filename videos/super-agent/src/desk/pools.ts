/**
 * Light pools: light is attention or work (synthesis §2). A pool is an analytic patch of light on
 * the receivers between two heights (the desk, the deck top, a bay floor), computed in the desk
 * shader and in every lit material. No punctual lights: three keys its programs on light counts,
 * and a fixed light set keeps the program cache warm (gl/light.ts).
 *
 * Colours are the synthesis's light colours (chroma ≤ 0.03, never amber), in linear RGB relative
 * to the albedo. Pure.
 */
import { BAYS, CELLS_X, FRESH, TAPE, rectC, type Pool, type P3 } from './layout.ts';
import { CARD_AT, cardIn, cardPose } from './beat4.ts';
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

export const tint = (hex: string, k: number): P3 => {
  // the light's colour normalised to unit luminance, times k
  const [r, g, b] = linearOf(hex);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(r / y) * k, (g / y) * k, (b / y) * k];
};

/** The synthesis's light colours. */
/** The emitters' levels (HDR: above 1.0 blooms); objects/*.tsx draw with them (kit.tsx). */
export const EMIT = { slot: 9, slotDocs: 0.9, transit: 7, bulbMax: 1.1, jewel: 0.85 } as const;

export const LIGHT_HEX = { yours: '#FFF1E0', reading: '#F4F5F2', work: '#EEF3F0' } as const;

/** Still (c): the reading pool's centre on the inline record, and its strength: capped so the record's paper peaks at lit paper (#E4DFD3, Y about 208), its warmth and fibre kept. */
const CACHE_POOL_X = -200;
const CACHE_POOL_K = 1.35;

export function poolsAt(s: DeskState): Pool[] {
  const cellY = (TAPE.y0 + TAPE.y1) / 2;
  const newest = (CELLS_X[0][0] + CELLS_X[0][1]) / 2;
  const slot = BAYS.bug.slot;
  const pools: Pool[] = [
    // the Register's hooded reading lamp, on the window (it never blooms: a pool only); in still (c) its light
    // gathers on the inline record (the hood is over the newest cells), so the stubs east of it sit a step below
    s.cache ? { c: [CACHE_POOL_X, cellY], z: [118, 170], sigma: [96, 40], rgb: tint(LIGHT_HEX.reading, CACHE_POOL_K * s.cache.lamp) } : { c: [newest + 70, cellY], z: [118, 170], sigma: [130, 40], rgb: tint(LIGHT_HEX.reading, 2.4) },
    // the stamp-in: the newest cell lights as the report's header prints into it
    { c: [newest, cellY], z: [118, 140], sigma: [40, 30], rgb: tint(LIGHT_HEX.reading, s.cache ? 0 : 1.05 * Math.max(s.cellLit, s.b4.cellLit)) },
    // your lamp on your in-tray, where the reply lands: its maximum on the tray, a step brighter once it has
    { c: LAMP_AIM, z: [0, 140], sigma: [74, 66], rgb: tint(LIGHT_HEX.yours, 3.6 * s.lamp) },
    // the bug bay's work slot: cast forward (south) from the slot onto its bench, no halo round the walls
    { c: [rectC(slot)[0], slot.y0 - 34], z: [30, 70], sigma: [56, 34], rgb: tint(LIGHT_HEX.work, 1.0 * s.bugLight) },
    // the test tower's work light, dimming as it finishes
    { c: [rectC(BAYS.tests.slot)[0] + 20, rectC(BAYS.tests.slot)[1] - 30], z: [0, 60], sigma: [56, 44], rgb: tint(LIGHT_HEX.work, 0.6 * s.testsLight) },
    // MT1: the fresh bay's work light, ignited once the folder is in (dark before, so its pool adds nothing)
    { c: [rectC(FRESH.slot)[0], FRESH.slot.y0 - 34], z: [-60, 70], sigma: [52, 34], rgb: tint(LIGHT_HEX.work, 1.0 * s.next.light) },
    // beat 4: a counterfactual card while it is up, the beat's focus: the reading light on it alone (its heights only), riding in and out with it
    cardPool(s),
  ];
  if (pools.length > MAX_POOLS) throw new Error(`desk: ${pools.length} pools, over ${MAX_POOLS}`);
  return pools;
}

/** The light on a counterfactual card while it is up (desk/beat4.ts cardPose): at its centre, on its heights only; dark while none is. */
function cardPool(s: DeskState): Pool {
  const { split, ghost } = s.b4.cards;
  const which = split ? 'split' : 'ghost';
  const c = split ?? ghost;
  const k = cardIn(c);
  const at = c ? cardPose(c, which).c : CARD_AT.split.at;
  return { c: [at[0], at[1]], z: [205, 290], sigma: [180, 120], rgb: tint(LIGHT_HEX.reading, CARD_LIGHT * k) };
}
/** The card's light: its stock lit to a light grey stock, the frame's brightest paper while the rest is stepped down. */
const CARD_LIGHT = 1.35;

/** Three vec4 per pool, for `uniform vec4 uPool[3 * MAX_POOLS]`: (cx, cy, zmin, zmax), (sx, sy, 0, 0), (r, g, b, 0). */
export function packPools(pools: readonly Pool[], out: Float32Array = new Float32Array(MAX_POOLS * 12)): Float32Array {
  out.fill(0);
  pools.forEach((p, i) => out.set([p.c[0], p.c[1], p.z[0], p.z[1], p.sigma[0], p.sigma[1], 0, 0, p.rgb[0], p.rgb[1], p.rgb[2], 0], i * 12));
  return out;
}
