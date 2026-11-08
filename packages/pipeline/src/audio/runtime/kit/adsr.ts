/**
 * The ADSR envelope of a note, as a pure function of time: a rise to 1 over `attack`, a fall to
 * `sustain` over `decay`, held while the gate is open (`hold` seconds from the onset), then a
 * fall from wherever it was to 0 over `release`. Each stage lands exactly on its target at its
 * end; `curve` bends the decay and release (0 straight, larger values faster at first, like a
 * struck or damped string).
 */
import { SR } from './dsp.ts';

export interface Adsr {
  /** seconds */
  attack: number;
  decay: number;
  /** level, 0..1 */
  sustain: number;
  release: number;
  /** the decay's and release's bend: 0 linear (default 0); k > 0 follows (e^(-k·u) - e^(-k)) / (1 - e^(-k)) */
  curve?: number;
}

/** 1 → 0 over u in [0, 1], bent by k */
function fall(u: number, k: number): number {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  if (!(k > 0)) return 1 - u;
  const e = Math.exp(-k);
  return (Math.exp(-k * u) - e) / (1 - e);
}

/** The level before the release starts, at time t (s) from the onset, the gate still open. */
function held(o: Adsr, t: number): number {
  if (t < 0) return 0;
  if (t < o.attack) return t / o.attack;
  const d = t - o.attack;
  if (d < o.decay) return o.sustain + (1 - o.sustain) * fall(d / o.decay, o.curve ?? 0);
  return o.sustain;
}

/** The envelope at time t (s) from the onset of a note whose gate closes at `hold` (s). */
export function adsrAt(o: Adsr, hold: number, t: number): number {
  if (t < hold) return held(o, t);
  const from = held(o, hold);
  if (o.release <= 0) return 0;
  return from * fall((t - hold) / o.release, o.curve ?? 0);
}

/** The envelope of a note held `hold` s, sampled: round((hold + release) · SR) samples, the last one 0. */
export function adsr(o: Adsr, hold: number): Float32Array {
  const n = Math.max(1, Math.round((hold + o.release) * SR));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = adsrAt(o, hold, i / SR);
  out[n - 1] = 0;
  return out;
}
