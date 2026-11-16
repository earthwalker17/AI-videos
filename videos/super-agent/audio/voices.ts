/**
 * The film's voices, built from the shared score kit. Every voice is a pure function of its
 * arguments (and a seed where it uses noise), so the score renders to the same bytes each time.
 *
 * The palette is small on purpose, like the picture's: a round kick and a low thud, noise for hats
 * and a clap, one bass, one pad, a plucked string, an FM bell, a dry tick and a noise riser.
 */
import { Biquad, SR, Svf, TAU, adsr, centsRatio, fmBell, midiHz, norm, osc, pluck, uni, whiteNoise, type StereoClip } from '@aiv/pipeline/audio/kit';

const sec = (s: number): number => Math.max(1, Math.round(s * SR));

/** A round kick: a sine falling from about 165 Hz to 46 Hz, softly saturated. */
export function kick(): Float32Array {
  const n = sec(0.42);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (46 + 120 * Math.exp(-t / 0.028))) / SR;
    out[i] = Math.tanh(1.6 * Math.exp(-t / 0.15) * Math.min(1, t / 0.0012) * Math.sin(ph));
  }
  return norm(out, -1);
}

/** A low thud with a soft knock on top: the weight under a line that lands. */
export function thud(seed: number): Float32Array {
  const n = sec(0.9);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const lp = new Biquad('lowpass', 900, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (40 + 70 * Math.exp(-t / 0.045))) / SR;
    const body = Math.exp(-t / 0.3) * Math.min(1, t / 0.001) * Math.sin(ph);
    const knock = lp.tick(nz()) * Math.exp(-t / 0.012);
    out[i] = Math.tanh(1.3 * body + 0.5 * knock);
  }
  return norm(out, -1, 0.05);
}

/** A hat: high-passed noise, `len` seconds to fall away. */
export function hat(seed: number, len = 0.045): Float32Array {
  const n = sec(len * 3 + 0.01);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const hp = new Biquad('highpass', 7600, 0.8);
  const tame = new Biquad('lowpass', 13000, 0.7);
  for (let i = 0; i < n; i++) out[i] = tame.tick(hp.tick(nz())) * Math.exp(-i / SR / (len * 0.45));
  return norm(out, -1, 0.008);
}

/** A soft clap: three close bursts of band-passed noise, then a short tail. */
export function clap(seed: number): Float32Array {
  const n = sec(0.24);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const bp = new Biquad('bandpass', 1450, 1.0);
  const hp = new Biquad('highpass', 500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (const d of [0, 0.011, 0.021]) if (t >= d) e = Math.max(e, Math.exp(-(t - d) / 0.005));
    if (t >= 0.028) e = Math.max(e, 0.8 * Math.exp(-(t - 0.028) / 0.06));
    out[i] = hp.tick(bp.tick(nz())) * e;
  }
  return norm(out, -1);
}

/** The bass: a saw through a low-pass that closes as the note decays, over a sine an octave's weight. */
export function bass(m: number, hold: number): Float32Array {
  const env = adsr({ attack: 0.004, decay: 0.16, sustain: 0.6, release: 0.06, curve: 3 }, hold);
  const n = env.length;
  const f = midiHz(m);
  const saw = osc('saw', f, n);
  const sub = osc('sine', f, n);
  const lp = new Svf();
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) lp.set(150 + 950 * env[i] * env[i], 1.1);
    lp.tick(0.6 * saw[i]);
    out[i] = Math.tanh(1.3 * (lp.lp + 0.85 * sub[i]) * env[i]);
  }
  return out;
}

export interface PadOptions {
  seed: number;
  /** seconds to rise and to fall away */
  attack?: number;
  release?: number;
  /** 0 dark .. 1 open */
  bright?: number;
}

/** The pad: per note two detuned saws (one towards each side) and a triangle, low-passed, slowly breathing. */
export function pad(notes: readonly number[], hold: number, o: PadOptions): StereoClip {
  const env = adsr({ attack: o.attack ?? 0.5, decay: 0.5, sustain: 0.85, release: o.release ?? 1.3 }, hold);
  const n = env.length;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  notes.forEach((m, k) => {
    const f = midiHz(m);
    const a = osc('saw', f * centsRatio(-6), n, { phase: uni(o.seed, k * 3) });
    const b = osc('saw', f * centsRatio(7), n, { phase: uni(o.seed, k * 3 + 1) });
    const c = osc('triangle', f, n, { phase: uni(o.seed, k * 3 + 2) });
    for (let i = 0; i < n; i++) {
      l[i] += 0.4 * a[i] + 0.1 * b[i] + 0.35 * c[i];
      r[i] += 0.1 * a[i] + 0.4 * b[i] + 0.35 * c[i];
    }
  });
  const fl = new Svf();
  const fr = new Svf();
  const g = 1 / Math.sqrt(Math.max(1, notes.length));
  const base = 520 + 1500 * (o.bright ?? 0.4);
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const fc = base * (1 + 0.22 * Math.sin(TAU * 0.09 * (i / SR) + o.seed)) * (0.55 + 0.45 * env[i]);
      fl.set(fc, 0.7);
      fr.set(fc * 1.04, 0.7);
    }
    fl.tick(l[i]);
    fr.tick(r[i]);
    l[i] = fl.lp * env[i] * g;
    r[i] = fr.lp * env[i] * g;
  }
  return { l, r };
}

/** A plucked string. */
export function string(m: number, len: number, seed: number, bright = 0.55, t60 = 1.1): Float32Array {
  return norm(pluck(midiHz(m), { seed, id: `s${m}`, len, t60, bright }), -1, 0.03);
}

/** A round FM bell. */
export function bell(m: number, len = 1.6, tau = 0.45): Float32Array {
  return norm(fmBell(midiHz(m), { ratio: 2, index: 1.5, tau, len, attack: 0.0015 }), -1, 0.05);
}

/** A dry tick: plain code checking one event. No pitch to speak of. */
export function tick(seed: number, k: number): Float32Array {
  return norm(pluck(1500 + 900 * uni(seed, k), { seed, id: `t${k % 5}`, len: 0.05, t60: 0.03, bright: 1 }), -1, 0.01);
}

/** A riser: band-passed noise sweeping up and growing, `len` seconds, ending at its loudest. */
export function riser(len: number, seed: number): StereoClip {
  const n = sec(len);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const nl = whiteNoise(seed);
  const nr = whiteNoise(seed + 1);
  const fl = new Svf();
  const fr = new Svf();
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 31) === 0) {
      const fc = 260 * (18 ** u);
      fl.set(fc, 1.6);
      fr.set(fc * 1.07, 1.6);
    }
    const e = u * u * Math.min(1, (n - i) / (0.004 * SR));
    l[i] = fl.tick(nl()) * e;
    r[i] = fr.tick(nr()) * e;
  }
  return norm({ l, r }, -1, 0.004);
}
