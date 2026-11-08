/**
 * The film's soft UI sounds (TREATMENT.md, Sound design: UI sound palette): paper and ink, all
 * synthesised from filtered noise and small modal bodies. Each returns a clip whose sample peak
 * is 0 dBFS (a placement's gain is its level); the arrangement sets them 12-18 dB under the bed,
 * with no whoosh risers, beat drops or sub hits.
 *
 *   woodblockHop   your ring hopping between session tiles (act one)
 *   sketchScratch  a pencil stroke on paper; dry: the ink strike-through
 *   inkClick       a status dot setting
 *   paperThump     the title cartouche landing
 *   woodKnock      a new Worker platform
 *   inkSwell       the ink arriving at the turn: a soft noise swell that spreads (not a riser)
 *
 * Deterministic: every noise stream is seeded from the film seed (the kit's seedOf, @aiv/core's hash).
 */
import { Biquad, ModalBank, SR, Svf, TAU, norm, seedOf, slowNoise, smooth, uni, whiteNoise, type Mode, type StereoClip } from '@aiv/pipeline/audio/kit';

/** A strike: a Hann pulse `ms` long, roughened with a little seeded noise. */
function strike(s: number, ms: number, grit: number): Float32Array {
  const w = Math.max(4, Math.round(ms * 0.001 * SR));
  const out = new Float32Array(w + 1);
  const noise = whiteNoise(s);
  for (let i = 0; i <= w; i++) out[i] = 0.5 - 0.5 * Math.cos((TAU * i) / w) + grit * noise() * (1 - i / w);
  return out;
}

/** A small body: modes [Hz, decay s, gain] rung by a strike, then low-passed. */
function body(s: number, modes: readonly (readonly [number, number, number])[], o: { ms: number; grit: number; len: number; lowpass: number }): Float32Array {
  const bank = new ModalBank(modes.map(([f, decay, gain]): Mode => ({ f, decay, gain })));
  const y = bank.render(strike(s, o.ms, o.grit), Math.ceil(o.len * SR));
  new Biquad('lowpass', o.lowpass, 0.7).run(y);
  return norm(y, 0);
}

/** A soft woodblock: three short wooden modes near `pitch` Hz (seeded within ±3 %). */
export function woodblockHop(seed: number, k: number, pitch = 820): Float32Array {
  const f = pitch * (0.97 + 0.06 * uni(seedOf(seed, 'hop-pitch'), k));
  return body(
    seedOf(seed, 'hop', k),
    [
      [f, 0.04, 1],
      [f * 2.37, 0.022, 0.45],
      [f * 4.1, 0.01, 0.2],
    ],
    { ms: 1.3, grit: 0.12, len: 0.16, lowpass: 4500 },
  );
}

/**
 * A pencil (or pen) stroke on paper: band-passed noise whose centre moves along the stroke, its
 * level grained by the paper's tooth and the hand's pressure. `dry` is shorter-grained and
 * brighter, one quick stroke: the ink strike-through.
 */
export function sketchScratch(seed: number, o: { len: number; k?: number; dry?: boolean }): Float32Array {
  const k = o.k ?? 0;
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'scratch', k));
  const tooth = slowNoise(seedOf(seed, 'scratch-tooth', k), o.dry ? 140 : 80);
  const hand = slowNoise(seedOf(seed, 'scratch-hand', k), 7);
  const bp = new Svf();
  const hp = new Biquad('highpass', 900, 0.7);
  const [c0, c1] = o.dry ? [3000, 4400] : [2300, 3300];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) bp.set(c0 + (c1 - c0) * (t / o.len), o.dry ? 1.4 : 1.0);
    bp.tick(noise());
    const env = smooth(t / (o.dry ? 0.012 : 0.025)) * smooth((o.len - t) / (o.dry ? 0.04 : 0.07)) * (0.75 + 0.25 * hand(t));
    out[i] = hp.tick(bp.bpn) * env * (0.5 + 0.5 * Math.abs(tooth(t)));
  }
  return norm(out, 0);
}

/** A small, high ink click with a little body under it. */
export function inkClick(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'ink-click', k),
    [
      [2600, 0.006, 1],
      [5100, 0.003, 0.4],
      [700, 0.012, 0.35],
    ],
    { ms: 0.4, grit: 0.3, len: 0.07, lowpass: 7000 },
  );
}

/** Paper landing on paper: a low-passed breath of noise over a soft, low body (no sub). */
export function paperThump(seed: number, k = 0): Float32Array {
  const s = seedOf(seed, 'paper-thump', k);
  const len = 0.45;
  const n = Math.ceil(len * SR);
  const y = body(
    s,
    [
      [92, 0.09, 1],
      [176, 0.05, 0.5],
      [310, 0.025, 0.25],
    ],
    { ms: 4, grit: 0.2, len, lowpass: 900 },
  );
  const noise = whiteNoise(seedOf(s, 'air'));
  const lp = new Biquad('lowpass', 320, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] = 0.7 * y[i] + 0.9 * lp.tick(noise()) * smooth(t / 0.003) * Math.exp(-t / 0.05);
  }
  return norm(y, 0);
}

/** A low wooden knock: four wooden modes from 168 Hz, a short soft strike. */
export function woodKnock(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'wood-knock', k),
    [
      [168, 0.1, 1],
      [395, 0.055, 0.55],
      [655, 0.03, 0.3],
      [1120, 0.014, 0.18],
    ],
    { ms: 1.8, grit: 0.2, len: 0.5, lowpass: 3200 },
  );
}

/**
 * The ink spreading: two decorrelated noise streams through band-passes that open (Q 5 → 0.7)
 * and rise (450 → 1500 Hz) while the image widens from the centre; the level swells over 60 % of
 * the clip and falls away. A spread, not a riser: no pitch sweep to a climax.
 */
export function inkSwell(seed: number, o: { len: number }): StereoClip {
  const n = Math.ceil(o.len * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const mid = whiteNoise(seedOf(seed, 'ink-swell', 0));
  const side = whiteNoise(seedOf(seed, 'ink-swell', 1));
  const fl = new Svf();
  const fr = new Svf();
  const tilt = [new Biquad('lowpass', 4000, 0.7), new Biquad('lowpass', 4000, 0.7)];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 31) === 0) {
      const f = 450 * (1500 / 450) ** smooth(u);
      const q = 5 * (0.7 / 5) ** smooth(u / 0.8);
      fl.set(f, q);
      fr.set(f * 1.06, q);
    }
    const width = 0.15 + 0.85 * smooth(u / 0.7);
    const m = mid();
    const sd = side();
    fl.tick(m + width * sd);
    fr.tick(m - width * sd);
    const env = u < 0.6 ? smooth(u / 0.6) : smooth((1 - u) / 0.4);
    l[i] = tilt[0].tick(fl.bpn) * env;
    r[i] = tilt[1].tick(fr.bpn) * env;
  }
  return norm({ l, r }, 0);
}
