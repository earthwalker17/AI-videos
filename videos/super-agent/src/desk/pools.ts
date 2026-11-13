/**
 * Light pools: light is attention or work (synthesis §2). A pool is an analytic patch of light on
 * the receivers between two heights (the desk, the deck top, a bay floor), computed in the desk
 * shader and in every lit material. No punctual lights: three keys its programs on light counts,
 * and a fixed light set keeps the program cache warm (gl/light.ts).
 *
 * Colours are the synthesis's light colours (chroma ≤ 0.03, never amber), in linear RGB relative
 * to the albedo. Pure.
 */
import { BAYS, CELLS_X, FRESH, TAPE, rectC, type P2, type P3, type Pool } from './layout.ts';
import { ACT_ONE_END, youPoseAt } from './actOne.ts';
import { CARD_AT, cardIn, cardPose, type CardSpot, type CardState } from './beat4.ts';
import { pools7 } from './beat7.ts';
import { pools8 } from './beat8.ts';
import { pools9, readingStep9 } from './beat9.ts';
import { pools10 } from './beat10.ts';
import { pools11 } from './beat11.ts';
import { poolsEnd } from './end.ts';
import { LIGHT_HEX, tint } from './fpKit.ts';
import { part2Cards } from './footprints.ts';
import { LAMP_AIM, type DeskState } from './state.ts';

/** At most this many pools (the uniform array's size, gl/light.ts). */
export const MAX_POOLS = 10;

// the light colours live in the leaf fpKit.ts (a beat module builds its own pools from there)
export { EMIT, LIGHT_HEX, linearOf, tint } from './fpKit.ts';

/** Still (c): the reading pool's centre on the inline record, and its strength: capped so the record's paper peaks at lit paper (#E4DFD3, Y about 208), its warmth and fibre kept. */
const CACHE_POOL_X = -200;
const CACHE_POOL_K = 1.35;

export function poolsAt(s: DeskState): Pool[] {
  const cellY = (TAPE.y0 + TAPE.y1) / 2;
  const newest = (CELLS_X[0][0] + CELLS_X[0][1]) / 2;
  const slot = BAYS.bug.slot;
  const pools: Pool[] = [
    // the Register's hooded reading lamp, on the window (it never blooms: a pool only); in still (c) its light
    // gathers on the inline record (the hood is over the newest cells) as the record prints (beat 6: CacheState.gather,
    // never a jump), so the stubs east of it sit a step below
    readingPool(newest, cellY, s.cache ? s.cache.gather : 0, s.cache?.lamp ?? 1, readingStep9(s.f)),
    // the stamp-in: the newest cell lights as the report's header prints into it; it dims with the other cells as the record stamps in
    { c: [newest, cellY], z: [118, 140], sigma: [40, 30], rgb: tint(LIGHT_HEX.reading, 1.05 * Math.max(s.cellLit, s.b4.cellLit) * (1 - (s.cache?.dim ?? 0))) },
    // your lamp on your in-tray, where the reply lands: its maximum on the tray, a step brighter once it has; from the turn
    // on centred on where your desk's pose aims the lamp (actOne.ts youPoseAt: LAMP_AIM unless a beat turns it)
    { c: lampAimAt(s.f), z: [0, 140], sigma: [74, 66], rgb: tint(LIGHT_HEX.yours, 3.6 * s.lamp) },
    // the bug bay's work slot: cast forward (south) from the slot onto its bench, no halo round the walls
    { c: [rectC(slot)[0], slot.y0 - 34], z: [30, 70], sigma: [56, 34], rgb: tint(LIGHT_HEX.work, 1.0 * s.bugLight) },
    // the test tower's work light, dimming as it finishes
    { c: [rectC(BAYS.tests.slot)[0] + 20, rectC(BAYS.tests.slot)[1] - 30], z: [0, 60], sigma: [56, 44], rgb: tint(LIGHT_HEX.work, 0.6 * s.testsLight) },
    // MT1: the fresh bay's work light, ignited once the folder is in (dark before, so its pool adds nothing)
    { c: [rectC(FRESH.slot)[0], FRESH.slot.y0 - 34], z: [-60, 70], sigma: [52, 34], rgb: tint(LIGHT_HEX.work, 1.0 * s.next.light) },
    // beat 4: a counterfactual card while it is up, the beat's focus: the reading light on it alone (its heights only), riding in and out with it
    cardPool(s),
    // part 2's beats: every counterfactual card one has up, lit as beat 4's are, and each module's own pools
    ...part2Cards(s).map((x) => cardPoolOf(x.card, x.spot)),
    ...pools7(s),
    ...pools8(s),
    ...pools9(s),
    ...pools10(s),
    ...pools11(s),
    ...poolsEnd(s),
  ];
  if (pools.length > MAX_POOLS) throw new Error(`desk: ${pools.length} pools, over ${MAX_POOLS}`);
  return pools;
}

/** Where your lamp's pool lies: on its aim (desk coordinates; from the turn on as your desk's pose aims it). */
const lampAimAt = (f: number): P2 => {
  if (f < ACT_ONE_END) return LAMP_AIM;
  const a = youPoseAt(f).lamp.aim;
  return [a[0], a[1]];
};

/** The reading lamp's pool: on the window (k 0), gathered onto still (c)'s record (k 1), every term between them in step; `step`: turned down with a beat's hold (beat9.ts readingStep9). */
function readingPool(newest: number, cellY: number, k: number, lamp: number, step = 1): Pool {
  const mix = (a: number, b: number) => a + (b - a) * k;
  return { c: [mix(newest + 70, CACHE_POOL_X), cellY], z: [118, 170], sigma: [mix(130, 96), 40], rgb: tint(LIGHT_HEX.reading, mix(2.4, CACHE_POOL_K * lamp) * step) };
}

/** Beat 4's card light: on the card up (desk/beat4.ts cardPose), dark at the split card's spot while none is. */
function cardPool(s: DeskState): Pool {
  const { split, ghost } = s.b4.cards;
  const which = split ? 'split' : 'ghost';
  const c = split ?? ghost;
  return c ? cardPoolOf(c, which) : cardLight(CARD_AT.split.at, 0);
}
/**
 * The light on a counterfactual card while it is up (beat4.ts cardPose, at its spot): at its centre, on its heights only
 * (the card hovers 240 u up: a card at another height brings its own pool), riding in and out with it (beat4.ts cardIn).
 */
export function cardPoolOf(c: CardState, which: 'split' | 'ghost' | CardSpot): Pool {
  return cardLight(cardPose(c, which).c, cardIn(c));
}
const cardLight = (at: P3, k: number): Pool => ({ c: [at[0], at[1]], z: [205, 290], sigma: [180, 120], rgb: tint(LIGHT_HEX.reading, CARD_LIGHT * k) });
/** The card's light: its stock lit to a light grey stock, the frame's brightest paper while the rest is stepped down. */
const CARD_LIGHT = 1.55;

/** Three vec4 per pool, for `uniform vec4 uPool[3 * MAX_POOLS]`: (cx, cy, zmin, zmax), (sx, sy, 0, 0), (r, g, b, 0). */
export function packPools(pools: readonly Pool[], out: Float32Array = new Float32Array(MAX_POOLS * 12)): Float32Array {
  out.fill(0);
  pools.forEach((p, i) => out.set([p.c[0], p.c[1], p.z[0], p.z[1], p.sigma[0], p.sigma[1], 0, 0, p.rgb[0], p.rgb[1], p.rgb[2], 0], i * 12));
  return out;
}
