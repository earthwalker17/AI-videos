/**
 * The film's sound effects, all synthesised from seeded noise, impulses and resonators: thunder,
 * wind, gravel steps, wooden and muffled knocks, door and gate creaks, the gate's clang, an owl,
 * bats, whooshes, the wand's sparkle, paper (riffle, page turn, pop-up snap, slide, swish), the
 * wax seal, slippers, candy, the pail's relight, a laptop powering down, the stamp, the pumpkins
 * guttering out, the door flap and the notification ding. Each returns a clip that starts at its
 * onset; the caller places it on a bus.
 */
import { Biquad, OnePole, Resonator, SR, Svf, TAU, brownNoise, centsRatio, clamp, gaussNoise, midiHz, panGains, seedOf, slowNoise, smooth, uni, whiteNoise } from './dsp.ts';
import { fmBell } from './synth.ts';
import type { Stereo } from './sampler.ts';

const n = (s: number) => Math.max(1, Math.ceil(s * SR));
const stereo = (len: number): Stereo => ({ l: new Float32Array(len), r: new Float32Array(len) });

/** Add a mono clip into a stereo one at a sample offset with an equal-power pan. */
function addPanned(dst: Stereo, src: Float32Array, at: number, pan: number, gain = 1): void {
  const [gl, gr] = panGains(pan);
  for (let i = 0; i < src.length; i++) {
    const j = at + i;
    if (j < 0) continue;
    if (j >= dst.l.length) break;
    dst.l[j] += src[i] * gl * gain;
    dst.r[j] += src[i] * gr * gain;
  }
}

/** A bank of decaying modes excited by `x` (mono in, mono out). */
function modes(x: Float32Array, bank: readonly (readonly [number, number, number])[]): Float32Array {
  const rs = bank.map(([f, tau, g]) => new Resonator(f, tau, g));
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let y = 0;
    for (const r of rs) y += r.tick(x[i]);
    out[i] = y;
  }
  return out;
}

/** A short burst of noise (a contact): `ms` long, linear decay. */
function burst(s: number, len: number, ms: number, at = 0, amp = 1): Float32Array {
  const out = new Float32Array(len);
  const w = whiteNoise(s);
  const m = Math.max(1, Math.round((ms / 1000) * SR));
  for (let i = 0; i < m && at + i < len; i++) out[at + i] += amp * w() * (1 - i / m);
  return out;
}

// --- weather -------------------------------------------------------------------------------------------

/** Thunder: a crack, a spray of crackles, then a rolling brown-noise rumble (each part levelled on its own). */
export function thunder(s: number, o: { len: number; crack?: number; rumble?: number; rolls?: number }): Stereo {
  const len = n(o.len);
  const out = stereo(len);
  const crackAmp = o.crack ?? 1;
  const rumbleAmp = o.rumble ?? 1;
  const rolls = o.rolls ?? 4;
  const peaks = Array.from({ length: rolls }, (_, j) => ({ t: 0.25 + (j + uni(s, 50 + j) * 0.8) * (o.len / (rolls + 1.5)), a: 0.55 + 0.45 * uni(s, 80 + j), w: 0.25 + 0.35 * uni(s, 90 + j) }));
  const crack: Float32Array[] = [];
  const rumble: Float32Array[] = [];
  for (let c = 0; c < 2; c++) {
    const cs = seedOf(s, 'thunder', c);
    // the crack: a broadband burst, then crackles thinning out over 0.7 s
    const ck = new Float32Array(len);
    const w = whiteNoise(cs);
    const hp = new Biquad('highpass', 300, 0.7);
    const crackLp = new Biquad('lowpass', 8000, 0.7);
    for (let i = 0; i < n(0.3); i++) {
      const t = i / SR;
      ck[i] += crackLp.tick(hp.tick(w())) * Math.exp(-t / 0.03) * (t < 0.001 ? t / 0.001 : 1);
    }
    let t = 0.012;
    let k = 0;
    while (t < 0.75) {
      const at = Math.round(t * SR);
      const amp = 0.5 * (1 - t / 0.8) * (0.4 + 0.6 * uni(cs, 1000 + k));
      const ms = 0.6 + 3 * uni(cs, 2000 + k);
      const b = burst(seedOf(cs, 'crackle', k), Math.round(0.006 * SR), ms, 0, amp);
      const bp = new Biquad('highpass', 1200 + 2500 * uni(cs, 3000 + k), 0.8);
      for (let i = 0; i < b.length && at + i < len; i++) ck[at + i] += bp.tick(b[i]);
      t += 0.004 + 0.05 * uni(cs, 4000 + k) * (0.3 + t);
      k++;
    }
    crack.push(ck);
    // the rumble: brown noise, low-passed, rolling in a few seeded swells after the crack
    const rm = new Float32Array(len);
    const br = brownNoise(seedOf(cs, 'rumble'), len, 0.9985);
    const lp1 = new Biquad('lowpass', 170, 0.7);
    const lp2 = new Biquad('lowpass', 220, 0.6);
    const mid = new Biquad('bandpass', 420, 0.9);
    const midNoise = gaussNoise(seedOf(cs, 'roll'));
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let env = 0.3 * smooth(tt / 0.12) * Math.exp(-tt / (o.len * 0.45));
      for (const p of peaks) env += p.a * Math.exp(-(((tt - p.t) / p.w) ** 2)) * Math.exp(-tt / (o.len * 0.6));
      const fadeEnd = tt > o.len - 0.4 ? clamp((o.len - tt) / 0.4) : 1;
      rm[i] = env * fadeEnd * (lp2.tick(lp1.tick(br[i])) * 2.4 + mid.tick(midNoise()) * 0.12 * Math.exp(-tt / 0.6));
    }
    rumble.push(rm);
  }
  const pk = (xs: Float32Array[]) => Math.max(...xs.map((x) => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; }));
  const gc = crackAmp / Math.max(1e-9, pk(crack));
  const gr = (0.5 * rumbleAmp) / Math.max(1e-9, pk(rumble));
  for (let i = 0; i < len; i++) {
    out.l[i] = crack[0][i] * gc + rumble[0][i] * gr;
    out.r[i] = crack[1][i] * gc + rumble[1][i] * gr;
  }
  return out;
}

export interface Howl {
  /** s from the clip start */
  t: number;
  dur: number;
  f0: number;
  f1: number;
  amp: number;
}

/** Wind: two bands of noise whose centres and loudness drift slowly (gusts), plus a few howls. */
export function wind(s: number, o: { len: number; level: (t: number) => number; howls: readonly Howl[] }): Stereo {
  const len = n(o.len);
  const out = stereo(len);
  for (let c = 0; c < 2; c++) {
    const dst = c === 0 ? out.l : out.r;
    const cs = seedOf(s, 'wind', c);
    const w = whiteNoise(cs);
    const pink = new OnePole(1 / (2 * Math.PI * 1500));
    const b1 = new Svf();
    const b2 = new Svf();
    const fc1 = slowNoise(seedOf(cs, 'fc1'), 0.18);
    const fc2 = slowNoise(seedOf(cs, 'fc2'), 0.25);
    const gust = slowNoise(seedOf(cs, 'gust'), 0.35);
    const howls = o.howls.map((h, j) => ({ ...h, f: new Svf(), dt: c * 0.06 * (uni(s, 700 + j) - 0.3) }));
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      if ((i & 15) === 0) {
        b1.set(330 * 2 ** (0.9 * fc1(t)), 0.9);
        b2.set(1100 * 2 ** (0.6 * fc2(t)), 1.6);
        for (const h of howls) {
          const u = clamp((t - h.t - h.dt) / h.dur);
          const f = h.f0 * (h.f1 / h.f0) ** Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.6)) * (1 - 0.18 * smooth((u - 0.6) / 0.4));
          h.f.set(f, 14);
        }
      }
      const x = pink.tick(w()) * 4;
      const g = o.level(t) * (0.62 + 0.38 * gust(t));
      let y = (b1.tick(x) * 1.0 + b2.tick(x) * 0.35) * g;
      for (const h of howls) {
        const u = (t - h.t - h.dt) / h.dur;
        h.f.tick(x);
        if (u > 0 && u < 1) y += h.f.bpn * 0.22 * h.amp * Math.sin(Math.PI * u) ** 1.5;
      }
      dst[i] = y;
    }
  }
  return out;
}

// --- feet, knocks, doors -------------------------------------------------------------------------

/** A small paper foot on gravel: a scatter of grit grains and a soft thump. */
export function gravelStep(s: number, weight = 1): Float32Array {
  const len = n(0.13);
  const out = new Float32Array(len);
  const grains = 16 + Math.floor(12 * uni(s, 0));
  for (let g = 0; g < grains; g++) {
    const at = Math.round(0.075 * uni(s, 10 + g) ** 1.7 * SR);
    const amp = (0.25 + 0.75 * uni(s, 40 + g)) * (1 - at / len) * 0.5;
    const b = burst(seedOf(s, 'grain', g), Math.round(0.008 * SR), 0.4 + 2.5 * uni(s, 70 + g), 0, amp);
    const bp = new Biquad('bandpass', 1500 + 4500 * uni(s, 100 + g), 1.4);
    for (let i = 0; i < b.length && at + i < len; i++) out[at + i] += bp.tick(b[i]);
  }
  const w = whiteNoise(seedOf(s, 'thump'));
  const lp = new Biquad('lowpass', 260, 0.8);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const e = (t < 0.004 ? t / 0.004 : 1) * Math.exp(-t / 0.028);
    out[i] += weight * e * (0.5 * lp.tick(w()) * 3 + 0.25 * Math.sin(ph));
    ph += (TAU * (95 - 30 * t * 10)) / SR;
  }
  return out;
}

/** A knuckle on a wooden door: a hard contact into five wood modes. Muffled: inside a book. */
export function knock(s: number, o: { muffled?: boolean; force?: number } = {}): Float32Array {
  const len = n(0.4);
  const force = o.force ?? 1;
  const x = new Float32Array(len);
  // the knuckle: a raised-cosine pulse plus a little contact noise
  const pw = Math.round(0.0007 * SR);
  for (let i = 0; i < pw; i++) x[i] += force * (0.5 - 0.5 * Math.cos((TAU * i) / pw));
  const b = burst(seedOf(s, 'knuckle'), len, 2, 0, 0.3 * force);
  for (let i = 0; i < len; i++) x[i] += b[i];
  const jitter = (k: number) => 1 + 0.03 * (uni(s, k) - 0.5);
  if (!o.muffled) {
    return modes(x, [
      [192 * jitter(1), 0.055, 1.0],
      [418 * jitter(2), 0.04, 0.8],
      [786 * jitter(3), 0.026, 0.55],
      [1315 * jitter(4), 0.016, 0.35],
      [2180 * jitter(5), 0.009, 0.22],
    ]);
  }
  // inside the closed book: a boomy cloth-bound body, everything above ~500 Hz swallowed
  const y = modes(x, [
    [118 * jitter(1), 0.07, 1.2],
    [236 * jitter(2), 0.05, 0.8],
    [410 * jitter(3), 0.03, 0.4],
    [690 * jitter(4), 0.018, 0.2],
  ]);
  const lp1 = new Biquad('lowpass', 520, 0.7);
  const lp2 = new Biquad('lowpass', 650, 0.6);
  const front = new Biquad('lowpass', 1100, 0.7);
  let py = 0;
  for (let i = 0; i < len; i++) py = Math.max(py, Math.abs((y[i] = lp2.tick(lp1.tick(y[i])))));
  // the thump's front: the knuckle itself, dulled, so the knock starts on its frame
  let px = 0;
  const fx = new Float32Array(len);
  for (let i = 0; i < len; i++) px = Math.max(px, Math.abs((fx[i] = front.tick(x[i]))));
  for (let i = 0; i < len; i++) y[i] = y[i] / py + (0.6 * fx[i]) / px;
  return y;
}

/**
 * Stick-slip friction into a resonator bank: each slip is an impulse; the slip rate (Hz) follows
 * `rate`, jittered, so a slow rate crackles and a fast one sings. Doors, gates, hinges.
 */
export function creak(s: number, o: { len: number; rate: (t: number) => number; amp: (t: number) => number; bank: readonly (readonly [number, number, number])[]; jitter?: number; grit?: number }): Float32Array {
  const len = n(o.len);
  const x = new Float32Array(len);
  const jit = o.jitter ?? 0.25;
  const grit = whiteNoise(seedOf(s, 'grit'));
  let t = 0;
  let k = 0;
  while (t < o.len) {
    const i = Math.round(t * SR);
    if (i >= len) break;
    const a = o.amp(t) * (0.55 + 0.45 * uni(s, k));
    x[i] += a;
    if (i + 1 < len) x[i + 1] -= a * 0.6;
    const r = Math.max(4, o.rate(t));
    t += (1 / r) * (1 + jit * (uni(s, 100000 + k) - 0.5));
    k++;
  }
  for (let i = 0; i < len; i++) x[i] += grit() * 0.02 * (o.grit ?? 1) * o.amp(i / SR);
  return modes(x, o.bank);
}

/** The long comic door creak (a stick-slip whose pitch rises, falls and squeals). */
export function doorCreak(s: number, len = 1.35): Float32Array {
  const rate = (t: number) => {
    const u = t / len;
    // eee-errr-EEEK-err
    return 28 + 120 * smooth(u / 0.22) - 70 * smooth((u - 0.25) / 0.2) + 150 * smooth((u - 0.5) / 0.15) - 170 * smooth((u - 0.7) / 0.3);
  };
  const amp = (t: number) => {
    const u = t / len;
    return smooth(u / 0.02) * (1 - smooth((u - 0.85) / 0.15)) * (0.7 + 0.3 * Math.sin(TAU * 3.1 * t));
  };
  const y = creak(s, {
    len,
    rate,
    amp,
    bank: [
      [520, 0.035, 0.9],
      [1170, 0.028, 0.7],
      [1840, 0.02, 0.5],
      [2630, 0.012, 0.35],
      [3450, 0.008, 0.2],
    ],
  });
  const hp = new Biquad('highpass', 250, 0.7);
  hp.run(y);
  // the flap unlatching: a small wooden tok on the frame
  const tok = knock(seedOf(s, 'tok'), { force: 0.8 });
  let py = 0;
  let pt = 0;
  for (let i = 0; i < y.length; i++) py = Math.max(py, Math.abs(y[i]));
  for (let i = 0; i < tok.length; i++) pt = Math.max(pt, Math.abs(tok[i]));
  for (let i = 0; i < tok.length && i < y.length; i++) y[i] = y[i] / py + (0.7 * tok[i]) / pt;
  for (let i = tok.length; i < y.length; i++) y[i] /= py;
  return y;
}

/** A rusty iron gate leaf turning on its hinge: metal modes 1 : 2.76 : 5.4 : 8.93. */
export function gateCreak(s: number, len = 1.0): Float32Array {
  const base = 690;
  const rate = (t: number) => {
    const u = t / len;
    return 14 + 70 * smooth(u / 0.35) - 30 * smooth((u - 0.45) / 0.3) + 45 * smooth((u - 0.75) / 0.2);
  };
  const amp = (t: number) => {
    const u = t / len;
    return smooth(u / 0.08) * (1 - smooth((u - 0.8) / 0.2));
  };
  const y = creak(s, {
    len,
    rate,
    amp,
    jitter: 0.4,
    bank: [
      [base, 0.12, 0.8],
      [base * 2.76, 0.09, 0.6],
      [base * 5.4, 0.05, 0.35],
      [base * 8.93, 0.03, 0.2],
    ],
  });
  const hp = new Biquad('highpass', 350, 0.7);
  hp.run(y);
  // the latch lifting: a short iron clack on the frame
  const lx = burst(seedOf(s, 'latch'), y.length, 1.5, 0, 1);
  const latch = modes(lx, [
    [base * 1.9, 0.03, 1],
    [base * 1.9 * 2.76, 0.02, 0.6],
    [base * 1.9 * 5.4, 0.012, 0.35],
  ]);
  let py = 0;
  let pl = 0;
  for (let i = 0; i < y.length; i++) {
    py = Math.max(py, Math.abs(y[i]));
    pl = Math.max(pl, Math.abs(latch[i]));
  }
  // the creak eases in under the clack, so the clack is the onset
  for (let i = 0; i < y.length; i++) y[i] = (y[i] / py) * smooth(i / (0.4 * SR)) + (1.6 * latch[i]) / pl;
  return y;
}

/**
 * The gate swinging shut against its post: two struck iron bars (1 : 2.76 : 5.4 : 8.93) and the
 * latch, `seconds` long (the caller fades the end).
 */
export function gateClang(s: number, base = 155.56, seconds = 2.6): Float32Array {
  const len = n(seconds);
  const x = new Float32Array(len);
  const hits: [number, number, number][] = [
    [0, 1, 1],
    [0.034, 0.55, 1.071],
    [0.09, 0.18, 1],
    [0.135, 0.1, 1.071],
  ];
  const out = new Float32Array(len);
  hits.forEach(([t, a, detune], h) => {
    x.fill(0);
    const at = Math.round(t * SR);
    const b = burst(seedOf(s, 'strike', h), len, 4, at, a);
    for (let i = 0; i < len; i++) x[i] = b[i];
    const pw = Math.round(0.0005 * SR);
    for (let i = 0; i < pw; i++) x[at + i] += a * 2 * (0.5 - 0.5 * Math.cos((TAU * i) / pw));
    const f = base * detune;
    const y = modes(x, [
      [f, 1.3, 1.0],
      [f * 2.76, 0.85, 0.7],
      [f * 5.4, 0.5, 0.45],
      [f * 8.93, 0.3, 0.3],
      [f * 13.3, 0.12, 0.12],
    ]);
    for (let i = 0; i < len; i++) out[i] += y[i];
  });
  return out;
}

/** The door flap falling shut: a soft wooden thud, a puff of air, the latch. */
export function doorFlap(s: number): Float32Array {
  const len = n(0.6);
  const x = burst(seedOf(s, 'flap'), len, 6, 0, 0.6);
  const pw = Math.round(0.003 * SR);
  for (let i = 0; i < pw; i++) x[i] += 0.8 * (0.5 - 0.5 * Math.cos((TAU * i) / pw));
  const latch = Math.round(0.07 * SR);
  const lb = burst(seedOf(s, 'latch'), len, 1, latch, 0.25);
  const y = modes(x, [
    [138, 0.07, 1],
    [305, 0.045, 0.6],
    [622, 0.02, 0.3],
  ]);
  const l = modes(lb, [
    [2300, 0.01, 0.6],
    [3700, 0.006, 0.4],
  ]);
  const puff = whiteNoise(seedOf(s, 'puff'));
  const lp = new Biquad('lowpass', 380, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    y[i] += l[i] + lp.tick(puff()) * 0.5 * (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.06));
  }
  return y;
}

/** A slipper shuffling on floorboards. */
export function slipper(s: number, len = 0.28): Float32Array {
  const m = n(len);
  const out = new Float32Array(m);
  const w = whiteNoise(s);
  const bp = new Biquad('bandpass', 1700 + 600 * uni(s, 1), 0.6);
  const lp = new Biquad('lowpass', 240, 0.7);
  for (let i = 0; i < m; i++) {
    const t = i / SR;
    const e = smooth(t / 0.035) * Math.exp(-Math.max(0, t - 0.035) / (len * 0.35));
    const pat = t < 0.02 ? 1 - t / 0.02 : 0;
    const x = w();
    out[i] = bp.tick(x) * e * 0.8 + lp.tick(x) * pat * 1.2;
  }
  return out;
}

// --- creatures ----------------------------------------------------------------------------------------

/** An owl far off: hoo … hoo-hoooo (sines with a breathy edge and a falling tail). */
export function owl(s: number): Float32Array {
  const hoots: [number, number, number][] = [
    [0, 0.34, 1],
    [0.62, 0.15, 0.7],
    [0.84, 0.55, 0.9],
  ];
  const len = n(1.6);
  const out = new Float32Array(len);
  const breath = whiteNoise(seedOf(s, 'owl-breath'));
  for (const [t0, d, a] of hoots) {
    const at = Math.round(t0 * SR);
    const m = n(d + 0.12);
    let ph = 0;
    const bp = new Biquad('bandpass', 400, 6);
    for (let i = 0; i < m && at + i < len; i++) {
      const t = i / SR;
      const u = t / d;
      const f = 352 + 22 * smooth(u / 0.3) - 40 * smooth((u - 0.7) / 0.5) + (d > 0.4 ? 6 * Math.sin(TAU * 7 * t) * smooth((u - 0.4) / 0.3) : 0);
      const e = smooth(t / 0.05) * (1 - smooth((t - d) / 0.12));
      const y = Math.sin(ph) + 0.08 * Math.sin(2 * ph);
      out[at + i] += a * e * (0.8 * y + 0.9 * bp.tick(breath()));
      ph += (TAU * f) / SR;
    }
  }
  return out;
}

/** Bat chirps: a few tiny downward sweeps (stylised into hearing range). */
export function batChirps(s: number, count = 3): Float32Array {
  const len = n(0.08 * count + 0.05);
  const out = new Float32Array(len);
  let t = 0;
  for (let c = 0; c < count; c++) {
    const at = Math.round(t * SR);
    const d = 0.007 + 0.006 * uni(s, c);
    const f0 = 6800 + 1500 * uni(s, 10 + c);
    const f1 = 3200 + 800 * uni(s, 20 + c);
    const m = n(d);
    let ph = 0;
    for (let i = 0; i < m && at + i < len; i++) {
      const u = i / m;
      out[at + i] += (0.6 + 0.4 * uni(s, 30 + c)) * Math.sin(Math.PI * u) ** 2 * Math.sin(ph);
      ph += (TAU * (f0 + (f1 - f0) * u)) / SR;
    }
    t += 0.04 + 0.035 * uni(s, 40 + c);
  }
  return out;
}

/** Leathery wings flapping past. */
export function wingFlutter(s: number, len = 0.6, rate = 13): Float32Array {
  const m = n(len);
  const out = new Float32Array(m);
  const w = whiteNoise(s);
  const bp = new Biquad('bandpass', 900, 0.7);
  const lp = new Biquad('lowpass', 350, 0.7);
  const ph0 = uni(s, 1);
  for (let i = 0; i < m; i++) {
    const t = i / SR;
    const flap = Math.abs(Math.sin(Math.PI * (rate * t + ph0))) ** 4;
    const e = Math.sin((Math.PI * t) / len);
    const x = w();
    out[i] = e * flap * (bp.tick(x) * 0.9 + lp.tick(x) * 1.6);
  }
  return out;
}

// --- air and magic ------------------------------------------------------------------------------------

/** A whoosh: band-passed noise whose centre sweeps f0 → f1, panning from → to. */
export function whoosh(s: number, o: { len: number; f0: number; f1: number; q?: number; panFrom?: number; panTo?: number; peak?: number }): Stereo {
  const len = n(o.len);
  const out = stereo(len);
  const w = whiteNoise(s);
  const f = new Svf();
  const body = new Biquad('lowpass', 500, 0.7);
  const peak = o.peak ?? 0.55;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if ((i & 15) === 0) f.set(o.f0 * (o.f1 / o.f0) ** smooth(u), o.q ?? 1.3);
    const e = u < peak ? smooth(u / peak) : 1 - smooth((u - peak) / (1 - peak));
    const x = w();
    f.tick(x);
    const y = e * (f.bpn * 0.9 + body.tick(x) * 0.3);
    const [gl, gr] = panGains((o.panFrom ?? 0) + ((o.panTo ?? 0) - (o.panFrom ?? 0)) * u);
    out.l[i] = y * gl;
    out.r[i] = y * gr;
  }
  return out;
}

/**
 * The wand's sparkle: a rising cascade of round, warm FM bells (ratio 1, low index: embers, not
 * glass) over a soft shimmer and a few ember crackles.
 */
export function sparkle(s: number, o: { notes: readonly number[]; gap: number; pan?: number; spread?: number }): Stereo {
  const len = n(o.notes.length * o.gap + 1.2);
  const out = stereo(len);
  o.notes.forEach((m, k) => {
    const at = Math.round((k * o.gap + o.gap * 0.25 * (uni(s, k) - 0.5)) * SR);
    const f = midiHz(m) * centsRatio(6 * (uni(s, 50 + k) - 0.5));
    const bell = fmBell(f, { ratio: 1, index: 1.1, tau: 0.32, len: 1.0, attack: 0.003 });
    const oct = fmBell(f * 2, { ratio: 1, index: 0.4, tau: 0.12, len: 0.5, attack: 0.002 });
    for (let i = 0; i < oct.length; i++) bell[i] += 0.18 * oct[i];
    const pan = (o.pan ?? 0) + (o.spread ?? 0.5) * (k % 2 ? 1 : -1) * (0.4 + 0.6 * uni(s, 100 + k));
    addPanned(out, bell, at, pan, 0.55 * (0.8 + 0.2 * (k / o.notes.length)));
  });
  // shimmer and embers
  const w = whiteNoise(seedOf(s, 'shimmer'));
  const hp = new Biquad('bandpass', 7000, 1.1);
  const shim = new Float32Array(len);
  const total = o.notes.length * o.gap + 0.6;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    shim[i] = hp.tick(w()) * 0.05 * smooth(t / 0.08) * (1 - smooth((t - total * 0.5) / (total * 0.6)));
  }
  addPanned(out, shim, 0, o.pan ?? 0);
  for (let k = 0; k < 9; k++) {
    const at = Math.round((0.05 + total * 0.8 * uni(s, 200 + k)) * SR);
    const c = burst(seedOf(s, 'ember', k), Math.round(0.004 * SR), 0.5, 0, 0.12 * uni(s, 300 + k) + 0.05);
    const lp = new Biquad('lowpass', 4500, 0.7);
    lp.run(c);
    addPanned(out, c, at, (o.pan ?? 0) + (uni(s, 400 + k) - 0.5));
  }
  return out;
}

/** The pail's candle catching again: a quick upward-swept 'fwip' and a warm puff. */
export function fwip(s: number): Float32Array {
  const len = n(0.3);
  const out = new Float32Array(len);
  const w = whiteNoise(s);
  const f = new Svf();
  const lp = new Biquad('lowpass', 260, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if ((i & 7) === 0) f.set(600 * (4500 / 600) ** smooth(t / 0.09), 1.8);
    const x = w();
    f.tick(x);
    const e = smooth(t / 0.008) * Math.exp(-Math.max(0, t - 0.008) / 0.045);
    const puff = smooth(t / 0.02) * Math.exp(-Math.max(0, t - 0.02) / 0.08);
    out[i] = f.bpn * e * 0.9 + lp.tick(x) * puff * 1.3;
  }
  return out;
}

/** A softer, slower ignition (the giant pumpkin lighting). */
export function ignite(s: number): Float32Array {
  const len = n(0.9);
  const out = new Float32Array(len);
  const w = whiteNoise(s);
  const f = new Svf();
  const lp = new Biquad('lowpass', 220, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if ((i & 15) === 0) f.set(280 * (1600 / 280) ** smooth(t / 0.35), 1.1);
    const x = w();
    f.tick(x);
    const e = smooth(t / 0.12) * (1 - smooth((t - 0.3) / 0.55));
    out[i] = (f.bpn * 0.6 + lp.tick(x) * 1.4) * e;
  }
  return out;
}

/** The pumpkins guttering out: down-swept low-passed noise per pumpkin, staggered across the world. */
export function fwoomps(s: number, count = 5): Stereo {
  const len = n(1.6);
  const out = stereo(len);
  for (let k = 0; k < count; k++) {
    const at = Math.round((k === 0 ? 0 : 0.05 + 0.09 * k + 0.05 * uni(s, k)) * SR);
    const m = n(0.8);
    const y = new Float32Array(m);
    const w = whiteNoise(seedOf(s, 'fwoomp', k));
    const f = new Svf();
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      if ((i & 15) === 0) f.set(2600 * (110 / 2600) ** smooth(t / 0.55), 1.4);
      f.tick(w());
      const e = smooth(t / 0.012) * (1 - smooth((t - 0.15) / 0.6));
      y[i] = f.lp * e * 1.6;
    }
    const pan = k === 0 ? 0 : (k % 2 ? -1 : 1) * (0.3 + 0.5 * uni(s, 20 + k));
    addPanned(out, y, at, pan, k === 0 ? 1 : 0.55 / Math.sqrt(k));
  }
  return out;
}

// --- paper -----------------------------------------------------------------------------------------

/** One paper flick: a few ms of band-passed noise. */
function flick(s: number, amp: number): Float32Array {
  const len = Math.round(0.016 * SR);
  const ms = 3 + 8 * uni(s, 0);
  const b = burst(s, len, ms, 0, amp);
  const bp = new Biquad('bandpass', 1200 + 3200 * uni(s, 1), 1.2);
  bp.run(b);
  return b;
}

/** Pages riffling: `count` flicks spread over `len` s (dense in the middle), on a breath of air. */
export function riffle(s: number, o: { len: number; count: number; pan?: number; air?: number }): Stereo {
  const len = n(o.len + 0.05);
  const out = stereo(len);
  for (let k = 0; k < o.count; k++) {
    const u = (k + 0.5 * uni(s, k)) / o.count;
    const t = o.len * u;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.6;
    addPanned(out, flick(seedOf(s, 'flick', k), (0.4 + 0.6 * uni(s, 500 + k)) * env), Math.round(t * SR), (o.pan ?? 0) + 0.5 * (uni(s, 900 + k) - 0.5));
  }
  const air = whoosh(seedOf(s, 'air'), { len: o.len, f0: 500, f1: 1500, q: 0.7, panFrom: (o.pan ?? 0) - 0.2, panTo: (o.pan ?? 0) + 0.2 });
  for (let i = 0; i < air.l.length && i < len; i++) {
    out.l[i] += air.l[i] * (o.air ?? 0.35);
    out.r[i] += air.r[i] * (o.air ?? 0.35);
  }
  return out;
}

/** A page turning: the sweep of air, crinkle along the edge, and the page landing. */
export function pageTurn(s: number, len = 0.55): Stereo {
  const out = whoosh(seedOf(s, 'sweep'), { len, f0: 380, f1: 2000, q: 0.9, panFrom: 0.5, panTo: -0.5, peak: 0.45 });
  const cr = riffle(seedOf(s, 'crinkle'), { len: len * 0.8, count: 14, air: 0 });
  for (let i = 0; i < cr.l.length && i < out.l.length; i++) {
    out.l[i] += cr.l[i] * 0.7;
    out.r[i] += cr.r[i] * 0.7;
  }
  const land = Math.round(len * 0.85 * SR);
  const flap = doorFlap(seedOf(s, 'land'));
  const lp = new Biquad('lowpass', 900, 0.7);
  lp.run(flap);
  const res = stereo(out.l.length + flap.length);
  res.l.set(out.l);
  res.r.set(out.r);
  addPanned(res, flap, land, -0.3, 0.35);
  return res;
}

/** A pop-up flat snapping upright: a stiff card's crack and a little flutter. */
export function popSnap(s: number, amp = 1): Float32Array {
  const len = n(0.25);
  const x = burst(seedOf(s, 'snap'), len, 1.2, 0, amp);
  const y = modes(x, [
    [640, 0.02, 0.6],
    [1490, 0.012, 0.5],
    [2950, 0.006, 0.4],
  ]);
  const hp = new Biquad('highpass', 400, 0.7);
  for (let i = 0; i < len; i++) y[i] = hp.tick(y[i] + x[i] * 0.4);
  const fl = flick(seedOf(s, 'flutter'), amp * 0.3);
  for (let i = 0; i < fl.length; i++) y[Math.round(0.03 * SR) + i] += fl[i];
  return y;
}

/** Paper flats sliding away: friction noise with a grainy flutter. */
export function paperSlide(s: number, len = 0.7, f = 2600): Float32Array {
  const m = n(len);
  const out = new Float32Array(m);
  const w = whiteNoise(s);
  const bp = new Biquad('bandpass', f, 0.7);
  const grain = slowNoise(seedOf(s, 'grain'), 40);
  for (let i = 0; i < m; i++) {
    const t = i / SR;
    const e = smooth(t / 0.08) * (1 - smooth((t - len * 0.6) / (len * 0.4)));
    out[i] = bp.tick(w()) * e * (0.6 + 0.4 * grain(t));
  }
  return out;
}

/** The wax seal cracking: brittle clicks and a crunchy tail. */
export function waxCrack(s: number): Float32Array {
  const len = n(0.18);
  const out = new Float32Array(len);
  const clicks = 4 + Math.floor(2 * uni(s, 0));
  for (let c = 0; c < clicks; c++) {
    const at = Math.round(((0.026 * c) / clicks + 0.003 * uni(s, 10 + c)) * SR);
    const x = burst(seedOf(s, 'click', c), Math.round(0.012 * SR), 0.3 + 0.4 * uni(s, 20 + c), 0, c === 0 ? 1 : 0.4 + 0.5 * uni(s, 30 + c));
    const y = modes(x, [
      [3100 + 900 * uni(s, 40 + c), 0.003, 0.8],
      [5200, 0.002, 0.5],
    ]);
    for (let i = 0; i < y.length && at + i < len; i++) out[at + i] += y[i] + x[i] * 0.5;
  }
  const w = whiteNoise(seedOf(s, 'crunch'));
  const bp = new Biquad('bandpass', 2800, 0.8);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const dens = uni(s, 1000 + i) < 0.08 * Math.exp(-t / 0.05) ? 1 : 0;
    out[i] += bp.tick(w() * dens) * 0.9;
  }
  return out;
}

// --- objects -------------------------------------------------------------------------------------

/** A hard candy dropping into a plastic pail: a few bounces of a bright click on a hollow body. */
export function candyPlink(s: number): Float32Array {
  const len = n(0.45);
  const x = new Float32Array(len);
  const bounces: [number, number][] = [
    [0, 1],
    [0.085, 0.45],
    [0.142, 0.25],
    [0.178, 0.12],
    [0.2, 0.06],
  ];
  for (const [t, a] of bounces) {
    const at = Math.round(t * SR);
    x[at] += a;
    x[at + 1] -= a * 0.5;
  }
  const hard = modes(x, [
    [2380 * (1 + 0.02 * uni(s, 1)), 0.022, 0.6],
    [3920, 0.014, 0.45],
    [5610, 0.008, 0.3],
  ]);
  const body = modes(x, [
    [790, 0.035, 0.5],
    [1260, 0.02, 0.35],
  ]);
  for (let i = 0; i < len; i++) hard[i] += body[i];
  return hard;
}

/** A laptop powering down: a falling whine, its fan spinning down, a last relay click. */
export function laptopDown(s: number, len = 1.4): Float32Array {
  const m = n(len + 0.1);
  const out = new Float32Array(m);
  const w = whiteNoise(s);
  const fan = new Svf();
  let ph = 0;
  for (let i = 0; i < m; i++) {
    const t = i / SR;
    const u = clamp(t / len);
    const f = 1500 * (55 / 1500) ** u;
    const e = smooth(t / 0.03) * (1 - smooth((u - 0.55) / 0.45));
    if ((i & 15) === 0) fan.set(900 * (140 / 900) ** u, 0.9);
    fan.tick(w());
    out[i] = e * (0.5 * Math.sin(ph) + 0.12 * Math.sin(2 * ph)) + fan.bpn * 0.18 * (1 - u) * smooth(t / 0.05);
    ph += (TAU * f) / SR;
  }
  const click = burst(seedOf(s, 'relay'), m, 1, Math.round(len * SR), 0.5);
  const y = modes(click, [
    [1900, 0.008, 0.6],
    [3300, 0.004, 0.3],
  ]);
  for (let i = 0; i < m; i++) out[i] += y[i];
  return out;
}

/** The rubber stamp coming down: a heavy thud with a falling pitch, a wooden knock, the paper. */
export function stampThunk(s: number, weight = 1): Float32Array {
  const len = n(0.7);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 42 + 70 * Math.exp(-t / 0.035);
    const e = (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t / 0.13);
    out[i] = weight * e * Math.sin(ph) * 1.1;
    ph += (TAU * f) / SR;
  }
  const x = burst(seedOf(s, 'contact'), len, 3, 0, 0.9);
  const k = modes(x, [
    [255, 0.045, 1],
    [612, 0.025, 0.6],
    [1180, 0.012, 0.3],
  ]);
  const paper = burst(seedOf(s, 'paper'), len, 14, 0, 0.35);
  const lp = new Biquad('lowpass', 3200, 0.7);
  lp.run(paper);
  for (let i = 0; i < len; i++) out[i] += k[i] * 0.8 + paper[i];
  return out;
}

/** The book slamming shut: a big low clap of boards, cloth and air. */
export function bookSlam(s: number): Float32Array {
  const len = n(1.2);
  const out = stampThunk(seedOf(s, 'thunk'), 1.3);
  const res = new Float32Array(len);
  res.set(out);
  const x = burst(seedOf(s, 'boards'), len, 5, 0, 1);
  const k = modes(x, [
    [96, 0.09, 1.2],
    [180, 0.07, 0.9],
    [340, 0.04, 0.6],
    [720, 0.02, 0.35],
  ]);
  const air = whiteNoise(seedOf(s, 'air'));
  const lp = new Biquad('lowpass', 600, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    res[i] += k[i] * 0.9 + lp.tick(air()) * 0.8 * Math.exp(-t / 0.07);
  }
  return res;
}

/** A spring 'boing': a twangy partial set whose pitch wobbles fast and settles. */
export function boing(s: number, f = 250): Float32Array {
  const len = n(0.9);
  const out = new Float32Array(len);
  let ph = 0;
  const p0 = uni(s, 0) * TAU;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const wob = 4 * Math.exp(-t / 0.22) * Math.sin(TAU * 13 * t + p0);
    const ff = f * 2 ** ((wob + 3 * (1 - Math.exp(-t / 0.05))) / 12);
    const e = (t < 0.003 ? t / 0.003 : 1) * Math.exp(-t / 0.28);
    out[i] = e * (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph));
    ph += (TAU * ff) / SR;
  }
  return out;
}

/**
 * The notification ding (this film's own, not any app's): a sine with a 2.76× partial about
 * 18 dB down, a 2 ms attack and a ~0.6 s decay.
 */
export function ding(midi: number): Float32Array {
  const len = n(1.1);
  const out = new Float32Array(len);
  const f = midiHz(midi);
  const p2 = 10 ** (-18 / 20);
  let a = 0;
  let b = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const att = t < 0.002 ? smooth(t / 0.002) : 1;
    out[i] = att * (Math.exp(-t / 0.13) * Math.sin(a) + p2 * Math.exp(-t / 0.07) * Math.sin(b));
    a += (TAU * f) / SR;
    b += (TAU * f * 2.76) / SR;
  }
  return out;
}
