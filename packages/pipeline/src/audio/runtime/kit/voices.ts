/**
 * Voices two scores share (decision 29, the rule of two): a pad of detuned oscillators, a bass of
 * a filtered oscillator over a sine, a clap of close noise bursts and a noise hat. Each is the
 * skeleton of a voice; what makes it one film's (its oscillators, levels, filters, envelope) is
 * an option, and the preset stays in that video's audio/.
 *
 * From the score of "Who Routes the Agents?" (videos/super-agent/audio/voices.ts, frozen: it
 * keeps its own copies and is rebuilt from its tag). With default options each voice gives the
 * same samples as that film's. Video #5 ("MiniDSH 2.0") is the second score to play them.
 */
import { adsr, type Adsr } from './adsr.ts';
import { Biquad, SR, Svf, TAU, centsRatio, midiHz, norm, seedOf, slowNoise, uni, whiteNoise, type StereoClip } from './dsp.ts';
import { osc, type Shape } from './osc.ts';

/** `s` seconds in samples (at least one). */
export const sec = (s: number): number => Math.max(1, Math.round(s * SR));

// ── the pad ─────────────────────────────────────────────────────────────────────────────────

/** One oscillator of each of the pad's notes. */
export interface PadLayer {
  shape: Shape;
  /** detune, cents (default 0) */
  cents?: number;
  /** pulse width, 0..1 */
  width?: number;
  /** its level in the left and the right channel */
  l: number;
  r: number;
  /** how it follows the pad's drift: 1, -1 (the other way) or 0 (steady, the default) */
  drift?: number;
  /** where in its note's drift it reads, s (default 0): two layers apart in time wander apart */
  driftAt?: number;
}

/** The default layers: two saws, -6 and +7 cents, one towards each side, and a triangle in the middle. */
export const PAD_LAYERS: readonly PadLayer[] = [
  { shape: 'saw', cents: -6, l: 0.4, r: 0.1 },
  { shape: 'saw', cents: 7, l: 0.1, r: 0.4 },
  { shape: 'triangle', l: 0.35, r: 0.35 },
];

export interface PadOptions {
  seed: number;
  /** the oscillators of each note (default PAD_LAYERS) */
  layers?: readonly PadLayer[];
  /** the envelope (adsr.ts): seconds to rise, to fall to the sustain and to fall away; the bend */
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  curve?: number;
  /** 0 dark .. 1 open (default 0.4) */
  bright?: number;
  /** the low-pass's corner at `bright` 0, and what `bright` 1 adds, Hz (default 520 and 1500) */
  cutoff?: number;
  cutoffRange?: number;
  /** the low-pass's Q (default 0.7), and the right corner over the left one (default 1.04) */
  q?: number;
  spread?: number;
  /** the corner follows the envelope: × (envFloor + envTrack · env) (default 0.55 and 0.45) */
  envFloor?: number;
  envTrack?: number;
  /**
   * The corner breathes: × (1 + depth · b(t)), b a sine at `rate` Hz (its phase the seed, in
   * radians) or seeded slow noise at `rate` lattice points a second (default a sine, 0.09 Hz, 0.22).
   */
  breath?: { shape: 'sine' | 'noise'; rate: number; depth: number };
  /** cents of slow, seeded pitch drift (an uneasy pad; default 0, none), its noise at `driftRate` points a second (default 0.8) */
  drift?: number;
  driftRate?: number;
}

/**
 * A pad: per note one oscillator per layer (each with its own seeded phase), summed into left
 * and right, through a low-pass per side whose corner opens with the envelope and breathes
 * slowly, levelled by 1/√notes.
 */
export function detunedPad(notes: readonly number[], hold: number, o: PadOptions): StereoClip {
  const env = adsr({ attack: o.attack ?? 0.5, decay: o.decay ?? 0.5, sustain: o.sustain ?? 0.85, release: o.release ?? 1.3, curve: o.curve ?? 0 }, hold);
  const n = env.length;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const layers = o.layers ?? PAD_LAYERS;
  const drift = o.drift ?? 0;
  notes.forEach((m, k) => {
    const f = midiHz(m);
    const wob = slowNoise(seedOf(o.seed, 'drift', k), o.driftRate ?? 0.8);
    const bufs = layers.map((y, j) => {
      const c = y.cents ?? 0;
      const d = drift * (y.drift ?? 0);
      const at = y.driftAt ?? 0;
      const freq = d ? (t: number) => f * centsRatio(c + d * wob(t + at)) : f * centsRatio(c);
      return osc(y.shape, freq, n, { phase: uni(o.seed, k * layers.length + j), width: y.width });
    });
    for (let i = 0; i < n; i++) {
      let sl = 0;
      let sr = 0;
      for (let j = 0; j < layers.length; j++) {
        sl += layers[j].l * bufs[j][i];
        sr += layers[j].r * bufs[j][i];
      }
      l[i] += sl;
      r[i] += sr;
    }
  });
  const fl = new Svf();
  const fr = new Svf();
  const g = 1 / Math.sqrt(Math.max(1, notes.length));
  const base = (o.cutoff ?? 520) + (o.cutoffRange ?? 1500) * (o.bright ?? 0.4);
  const q = o.q ?? 0.7;
  const spread = o.spread ?? 1.04;
  const floor = o.envFloor ?? 0.55;
  const track = o.envTrack ?? 0.45;
  const br = o.breath ?? { shape: 'sine', rate: 0.09, depth: 0.22 };
  const noise = br.shape === 'noise' ? slowNoise(seedOf(o.seed, 'breath'), br.rate) : null;
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const t = i / SR;
      const b = noise ? noise(t) : Math.sin(TAU * br.rate * t + o.seed);
      const fc = base * (1 + br.depth * b) * (floor + track * env[i]);
      fl.set(fc, q);
      fr.set(fc * spread, q);
    }
    fl.tick(l[i]);
    fr.tick(r[i]);
    l[i] = fl.lp * env[i] * g;
    r[i] = fr.lp * env[i] * g;
  }
  return { l, r };
}

// ── the bass ────────────────────────────────────────────────────────────────────────────────

export interface BassOptions {
  /** the oscillator under the low-pass (default a saw), and its pulse width */
  shape?: Shape;
  width?: number;
  /** its level into the low-pass (default 0.6), and the low-pass's level out (default 1) */
  drive?: number;
  tone?: number;
  /** the sine's level (default 0.85) */
  sub?: number;
  /** the saturation: tanh(sat · (tone · lp + sub · sine) · env) (default 1.3) */
  sat?: number;
  /** the corner at rest, and what the squared envelope adds, Hz (default 150 and 950); the Q (default 1.1) */
  cutoff?: number;
  cutoffRange?: number;
  q?: number;
  /** the envelope (default a 4 ms rise, 0.16 s to 0.6, a 60 ms release, bent by 3) */
  env?: Adsr;
}

/** A bass note held `hold` s: an oscillator through a low-pass that closes as the note decays, over a sine for its weight, softly saturated. */
export function filteredBass(m: number, hold: number, o: BassOptions = {}): Float32Array {
  const env = adsr(o.env ?? { attack: 0.004, decay: 0.16, sustain: 0.6, release: 0.06, curve: 3 }, hold);
  const n = env.length;
  const f = midiHz(m);
  const x = osc(o.shape ?? 'saw', f, n, { width: o.width });
  const s = osc('sine', f, n);
  const lp = new Svf();
  const drive = o.drive ?? 0.6;
  const tone = o.tone ?? 1;
  const sub = o.sub ?? 0.85;
  const sat = o.sat ?? 1.3;
  const c0 = o.cutoff ?? 150;
  const c1 = o.cutoffRange ?? 950;
  const q = o.q ?? 1.1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) lp.set(c0 + c1 * env[i] * env[i], q);
    lp.tick(drive * x[i]);
    out[i] = Math.tanh(sat * (tone * lp.lp + sub * s[i]) * env[i]);
  }
  return out;
}

// ── drums ───────────────────────────────────────────────────────────────────────────────────

export interface ClapOptions {
  /** clip length, s (default 0.24) */
  len?: number;
  /** the bursts' onsets, s (default 0, 11 and 21 ms), and each one's fall, s (default 5 ms) */
  bursts?: readonly number[];
  burstFall?: number;
  /** the tail: its onset, s (default 28 ms), its level (default 0.8) and its fall, s (default 60 ms) */
  tailAt?: number;
  tailLevel?: number;
  tailFall?: number;
  /** the band-passes the one noise runs through, summed (default one at 1450 Hz, Q 1) */
  bands?: readonly { f: number; q: number; gain: number }[];
  /** the high-pass after them, Hz (default 500) */
  highpass?: number;
}

/** A clap: close bursts of band-passed noise, then a short tail, levelled to -1 dB. */
export function noiseClap(seed: number, o: ClapOptions = {}): Float32Array {
  const n = sec(o.len ?? 0.24);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const bands = (o.bands ?? [{ f: 1450, q: 1.0, gain: 1 }]).map((b) => ({ bq: new Biquad('bandpass', b.f, b.q), gain: b.gain }));
  const hp = new Biquad('highpass', o.highpass ?? 500, 0.7);
  const bursts = o.bursts ?? [0, 0.011, 0.021];
  const fall = o.burstFall ?? 0.005;
  const tailAt = o.tailAt ?? 0.028;
  const tailLevel = o.tailLevel ?? 0.8;
  const tailFall = o.tailFall ?? 0.06;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (const d of bursts) if (t >= d) e = Math.max(e, Math.exp(-(t - d) / fall));
    if (t >= tailAt) e = Math.max(e, tailLevel * Math.exp(-(t - tailAt) / tailFall));
    const x = nz();
    let y = 0;
    for (const b of bands) y += b.gain * b.bq.tick(x);
    out[i] = hp.tick(y) * e;
  }
  return norm(out, -1);
}

export interface HatOptions {
  /** `len` seconds to fall away (default 45 ms): the fall's time constant is 0.45 · len and the clip 3 · len + 10 ms, unless given */
  len?: number;
  decay?: number;
  length?: number;
  /** the high-pass, Hz (default 7600, Q 0.8) */
  highpass?: number;
  /** a peak filter after it: a hair of ring (default none) */
  ring?: { f: number; q: number; gainDb: number };
  /** the low-pass that tames the top, Hz (default 13000) */
  lowpass?: number;
  /** the fade at the clip's end, s (default 8 ms) */
  endFade?: number;
}

/** A hat: high-passed noise falling away exponentially, levelled to -1 dB. */
export function noiseHat(seed: number, o: HatOptions = {}): Float32Array {
  const len = o.len ?? 0.045;
  const decay = o.decay ?? len * 0.45;
  const n = sec(o.length ?? len * 3 + 0.01);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const hp = new Biquad('highpass', o.highpass ?? 7600, 0.8);
  const ring = o.ring ? new Biquad('peak', o.ring.f, o.ring.q, o.ring.gainDb) : null;
  const tame = new Biquad('lowpass', o.lowpass ?? 13000, 0.7);
  for (let i = 0; i < n; i++) {
    const x = hp.tick(nz());
    out[i] = tame.tick(ring ? ring.tick(x) : x) * Math.exp(-i / SR / decay);
  }
  return norm(out, -1, o.endFade ?? 0.008);
}
