/**
 * The film's voices, built from the shared score kit (@aiv/pipeline/audio/kit). Each is a pure
 * function of its arguments and, where it uses noise, a seed, so the score renders to the same
 * bytes every time.
 *
 * The palette is small and clean, like the picture's paper on ink:
 * - music: a muted kick, a soft sub and an offbeat bass, ticks, a shaker, a rim and a clap; a pad
 *   of detuned triangles; a soft FM electric piano; a muted plucked string; and the glass bell
 *   that carries the teal dot's motif (a modal bank with a glass's inharmonic partials);
 * - sound design, one sound per thing the picture does: the Enter key, the low "denied", UI
 *   ticks, a soft slide, a whoosh, a receipt printer, the sandbox's bolt, mouse clicks, a pip,
 *   noise swells (forwards as risers, backwards into a hit), an air shimmer, a deep boom and the
 *   pitched stamps of the runtime's callbacks.
 * Every sound that lands on a hit starts with a short, bright contact on its first sample, so the
 * ear (and QA's onset finder) places it on its frame.
 *
 * The pad, the offbeat bass, the clap and the tick are this film's presets of the kit's shared
 * voices (detunedPad, filteredBass, noiseClap, noiseHat), which film #4's score had first and
 * which moved to the kit when this score needed them (decision 29). The rest are this film's own.
 */
import {
  Biquad,
  ModalBank,
  SR,
  Svf,
  TAU,
  adsr,
  centsRatio,
  clamp,
  dbToGain,
  detunedPad,
  filteredBass,
  loudness,
  midiHz,
  noiseClap,
  noiseHat,
  norm,
  panGains,
  pluck,
  scale,
  sec,
  seedOf,
  smooth,
  uni,
  whiteNoise,
  type Mode,
  type PadLayer,
  type StereoClip,
} from '@aiv/pipeline/audio/kit';

/**
 * Soft-clip a one-shot to lower its crest: levelled to a peak of 1, through tanh(drive·x). Its
 * body comes up against its first spike, so a short sound reads at a lower peak (the master's
 * limiter then leaves it, and the music under it, alone).
 */
function soften(x: Float32Array, drive: number): Float32Array {
  norm(x, 0, 0);
  const g = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(drive * x[i]) * g;
  return x;
}

// ── drums ─────────────────────────────────────────────────────────────────────────────────────

/** The muted kick: a sine falling from about 120 Hz to 47 Hz, short, with a soft knock a laptop can play. */
export function kick(seed: number): Float32Array {
  const n = sec(0.36);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const knockLp = new Biquad('lowpass', 1700, 0.7);
  const tame = new Biquad('lowpass', 3400, 0.6);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (47 + 73 * Math.exp(-t / 0.024))) / SR;
    const body = Math.exp(-t / 0.1) * Math.min(1, t / 0.0008) * Math.sin(ph);
    const knock = knockLp.tick(nz()) * Math.exp(-t / 0.005);
    out[i] = tame.tick(Math.tanh(1.5 * body + 0.6 * knock));
  }
  return norm(out, -1, 0.03);
}

/** A light tick: the kit's noise hat, lower, with a hair of ring at 9.5 kHz; `len` seconds to fall away. */
export function tick(seed: number, len = 0.03): Float32Array {
  return noiseHat(seed, { decay: len * 0.35, length: len * 2.5 + 0.005, highpass: 6200, ring: { f: 9500, q: 1.4, gainDb: 4 }, lowpass: 14000, endFade: 0.004 });
}

/** A shaker: band-passed noise with a softer start than the tick. */
export function shaker(seed: number): Float32Array {
  const n = sec(0.12);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const bp = new Biquad('bandpass', 7400, 0.9);
  const hp = new Biquad('highpass', 3800, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = hp.tick(bp.tick(nz())) * Math.min(1, t / 0.006) * Math.exp(-t / 0.028);
  }
  return norm(out, -1, 0.01);
}

/** A soft rim: a short woody body (three modes) under a band of noise. */
export function rim(seed: number): Float32Array {
  const n = sec(0.14);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const body = new ModalBank([
    { f: 1720, decay: 0.022, gain: 1 },
    { f: 2630, decay: 0.013, gain: 0.55 },
    { f: 520, decay: 0.035, gain: 0.45 },
  ]);
  const bp = new Biquad('bandpass', 2300, 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = i < 40 ? nz() * (1 - i / 40) : 0;
    out[i] = 0.5 * body.tick(x) + 0.5 * bp.tick(nz()) * Math.exp(-t / 0.016);
  }
  return norm(out, -1, 0.01);
}

/** A soft clap: the kit's, four close bursts of noise through a low and a high band, then a short tail. */
export function clap(seed: number): Float32Array {
  return noiseClap(seed, {
    len: 0.28,
    bursts: [0, 0.009, 0.017, 0.026],
    burstFall: 0.0042,
    tailAt: 0.03,
    tailLevel: 0.75,
    tailFall: 0.07,
    bands: [
      { f: 1150, q: 1.1, gain: 0.7 },
      { f: 2400, q: 1.4, gain: 0.5 },
    ],
    highpass: 420,
  });
}

// ── bass ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The sub: a sine with a little of its octave and twelfth, what a laptop's speaker can play of it.
 * It rises in 12 ms (the kick on the same downbeat speaks first), or in `attack` s.
 */
export function sub(m: number, hold: number, release = 0.22, attack = 0.012): Float32Array {
  const env = adsr({ attack, decay: 0.35, sustain: 0.7, release, curve: 2 }, hold);
  const n = env.length;
  const w = (TAU * midiHz(m)) / SR;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ph = w * i;
    out[i] = Math.tanh(1.1 * (Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * env[i]);
  }
  return out;
}

/** The offbeat bass: a short note, the kit's filtered bass with a narrow pulse through the closing low-pass. */
export function bass(m: number, hold: number): Float32Array {
  return filteredBass(m, hold, {
    shape: 'pulse',
    width: 0.32,
    drive: 1,
    tone: 0.55,
    sub: 0.8,
    sat: 1.2,
    cutoff: 180,
    cutoffRange: 1100,
    q: 0.9,
    env: { attack: 0.003, decay: 0.14, sustain: 0.45, release: 0.06, curve: 3 },
  });
}

// ── harmony ───────────────────────────────────────────────────────────────────────────────────

export interface PadOptions {
  seed: number;
  /** seconds to rise and to fall away */
  attack?: number;
  release?: number;
  /** 0 dark .. 1 open */
  bright?: number;
  /** cents of slow, seeded pitch drift per voice (an uneasy pad), 0 for none */
  drift?: number;
}

/** Per note: two triangles 5 cents either side, one towards each side (they wander apart when the pad drifts), and a narrow pulse. */
const PAD_LAYERS: readonly PadLayer[] = [
  { shape: 'triangle', cents: -5, l: 0.6, r: 0.15, drift: 1 },
  { shape: 'triangle', cents: 5, l: 0.15, r: 0.6, drift: -1, driftAt: 3.7 },
  { shape: 'pulse', width: 0.3, l: 0.2, r: 0.2 },
];

/** The pad: the kit's detuned pad on soft triangles, more open than film #4's, its corner breathing on slow noise. */
export function pad(notes: readonly number[], hold: number, o: PadOptions): StereoClip {
  return detunedPad(notes, hold, {
    seed: o.seed,
    layers: PAD_LAYERS,
    attack: o.attack ?? 0.6,
    decay: 0.8,
    sustain: 0.85,
    release: o.release ?? 1.4,
    curve: 1.5,
    bright: o.bright,
    cutoff: 1100,
    cutoffRange: 3600,
    q: 0.65,
    spread: 1.05,
    envFloor: 0.5,
    envTrack: 0.5,
    breath: { shape: 'noise', rate: 0.35, depth: 0.15 },
    drift: o.drift,
  });
}

/** A soft electric piano: a two-operator FM voice whose brightness falls quickly, with a tine's ping on top. */
export function ep(m: number, len: number, bright = 0.5): Float32Array {
  const f = midiHz(m);
  const n = sec(len);
  const out = new Float32Array(n);
  // lower notes ring longer
  const tau = 0.55 + 0.9 * clamp((72 - m) / 24);
  const wc = (TAU * f) / SR;
  const wt = (TAU * Math.min(f * 14, 12000)) / SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const idx = (0.25 + 1.4 * bright) * Math.exp(-t / 0.18);
    const tine = 0.06 * bright * Math.exp(-t / 0.012) * Math.sin(wt * i);
    out[i] = Math.min(1, t / 0.002) * (Math.exp(-t / tau) * Math.sin(wc * i + idx * Math.sin(wc * i)) + tine);
  }
  return norm(out, -1, 0.06);
}

/** A muted plucked string (Karplus–Strong, darkened). */
export function mutedPluck(m: number, seed: number, len = 0.5, bright = 0.42): Float32Array {
  const raw = pluck(midiHz(m), { seed, id: `p${m}`, len, t60: 0.45, bright });
  new Biquad('lowpass', 2600, 0.6).run(raw);
  // the burst is about 20 dB over the tone: bring the tone up under it
  return norm(soften(raw, 4), -1, 0.04);
}

export interface GlassOptions {
  seed: number;
  /** seconds */
  len?: number;
  /** 0..1: the share of the upper (inharmonic) partials */
  bright?: number;
  /** 0..1: harmonic warmth (an octave and a twelfth), the amber card's bell */
  warm?: number;
}

/**
 * The glass bell: a struck glass as a modal bank (partials at 1, 2.32, 4.25 and 6.63 times the
 * note, the higher ones dying sooner) with a twin of the fundamental a hair sharp, so the note
 * shimmers slowly as it rings. The mallet is a 0.2 ms pulse with a breath of noise.
 */
export function glass(m: number, o: GlassOptions): Float32Array {
  const f = midiHz(m);
  const len = o.len ?? 2.4;
  const b = o.bright ?? 0.7;
  const w = o.warm ?? 0;
  const modes: Mode[] = [
    { f, decay: len * 0.22, gain: 1 },
    { f: f * 1.0013, decay: len * 0.2, gain: 0.32 },
    { f: f * 2.32, decay: len * 0.09, gain: 0.3 * b },
    { f: f * 4.25, decay: len * 0.045, gain: 0.14 * b },
    { f: f * 6.63, decay: len * 0.025, gain: 0.06 * b },
  ];
  if (w > 0) modes.push({ f: f * 2, decay: len * 0.12, gain: 0.28 * w }, { f: f * 3, decay: len * 0.06, gain: 0.1 * w });
  const bank = new ModalBank(modes);
  const nz = whiteNoise(o.seed);
  const hp = new Biquad('highpass', 180, 0.7);
  const n = sec(len);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i < 10 ? (0.5 - 0.5 * Math.cos((TAU * i) / 10)) * (1 + 0.25 * nz()) : 0;
    out[i] = hp.tick(bank.tick(x)) * Math.min(1, i / (0.0012 * SR));
  }
  return norm(out, -1, 0.05);
}

// ── sound design ──────────────────────────────────────────────────────────────────────────────

/** The Enter key: a contact click, the key's short body, and its quieter return 72 ms later. */
export function keyPress(seed: number): Float32Array {
  const n = sec(0.2);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const down = new ModalBank([
    { f: 380, decay: 0.022, gain: 1 },
    { f: 1180, decay: 0.012, gain: 0.55 },
    { f: 2750, decay: 0.006, gain: 0.35 },
  ]);
  const up = new ModalBank([
    { f: 520, decay: 0.012, gain: 0.6 },
    { f: 1650, decay: 0.008, gain: 0.4 },
  ]);
  const hp = new Biquad('highpass', 3500, 0.7);
  const rel = sec(0.072);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const press = i < 96 ? nz() * (1 - i / 96) : 0;
    const back = i >= rel && i < rel + 64 ? nz() * (1 - (i - rel) / 64) * 0.35 : 0;
    const click = hp.tick(nz()) * Math.exp(-t / 0.0011);
    out[i] = 0.6 * down.tick(press) + 0.5 * up.tick(back) + 0.45 * click;
  }
  return norm(soften(out, 2.5), -1, 0.02);
}

/**
 * "Denied": a short, low, dull accent. Two FM tones a semitone apart (A2 and B♭2, a pair that
 * does not settle) sag 60 cents as they die, over a 55 Hz thump and a soft knock.
 */
export function denied(seed: number): Float32Array {
  const n = sec(0.5);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const knockLp = new Biquad('lowpass', 900, 0.7);
  const tame = new Biquad('lowpass', 2400, 0.6);
  const fs = [midiHz(45), midiHz(46)];
  const pc = [0, 0];
  let pt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bend = centsRatio(-60 * Math.min(1, t / 0.3));
    const e = Math.min(1, t / 0.0005) * Math.exp(-t / 0.11);
    const idx = 0.6 + 2 * Math.exp(-t / 0.035);
    let tone = 0;
    for (let k = 0; k < 2; k++) {
      tone += Math.sin(pc[k] + idx * Math.sin(pc[k]));
      pc[k] += (TAU * fs[k] * bend) / SR;
    }
    pt += (TAU * 55 * bend) / SR;
    const thump = Math.sin(pt) * Math.exp(-t / 0.07) * Math.min(1, t / 0.001);
    const knock = knockLp.tick(nz()) * Math.exp(-t / 0.006);
    out[i] = tame.tick(Math.tanh(0.55 * tone * e + 0.7 * thump + 0.9 * knock));
  }
  return norm(out, -1, 0.03);
}

/** A small UI tick at `f` Hz: a tiny struck body and a breath of contact noise. */
export function uiTick(f: number, seed: number): Float32Array {
  const n = sec(0.08);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const body = new ModalBank([
    { f, decay: 0.011, gain: 1 },
    { f: f * 2.71, decay: 0.005, gain: 0.3 },
  ]);
  const hp = new Biquad('highpass', 4000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = body.tick(i < 12 ? 1 - i / 12 : 0) + 0.3 * hp.tick(nz()) * Math.exp(-t / 0.0008);
  }
  return norm(soften(out, 2), -1, 0.01);
}

/** A soft slide: a band of noise rising a little as it moves from left to right, with a light contact at its start. */
export function slide(seed: number, len = 0.42): StereoClip {
  const n = sec(len);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const nl = whiteNoise(seedOf(seed, 'l'));
  const nr = whiteNoise(seedOf(seed, 'r'));
  const fl = new Svf();
  const fr = new Svf();
  const contact = uiTick(2100, seedOf(seed, 'contact'));
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 15) === 0) {
      const fc = 1500 * 2 ** (1.1 * u);
      fl.set(fc, 1.1);
      fr.set(fc * 1.06, 1.1);
    }
    fl.tick(nl());
    fr.tick(nr());
    const e = Math.min(1, i / (0.008 * SR)) * (1 - u) ** 1.5;
    const [gl, gr] = panGains(-0.6 + 1.2 * smooth(u));
    const c = i < contact.length ? 0.8 * contact[i] : 0;
    l[i] = fl.bpn * e * gl + c * 0.8;
    r[i] = fr.bpn * e * gr + c * 0.6;
  }
  return norm({ l, r }, -1, 0.02);
}

/**
 * A tight whoosh: noise swept up to its peak `pre` s in and down after, moving from `pan0` to
 * `pan1`, with a short bright contact at the peak. The peak is `pre` s from the clip's start.
 * The pre-roll stays low until the last moment and breaks off 5 ms before the peak (a 4 ms fade,
 * as the kit's swells leave a gap before what they lead into), so the contact lands as the onset.
 */
export function whoosh(seed: number, pre: number, post: number, pan0: number, pan1: number): StereoClip {
  const k = sec(pre);
  const n = k + sec(post);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const nl = whiteNoise(seedOf(seed, 'l'));
  const nr = whiteNoise(seedOf(seed, 'r'));
  const nc = whiteNoise(seedOf(seed, 'c'));
  const fl = new Svf();
  const fr = new Svf();
  const hp = new Biquad('highpass', 3000, 0.7);
  for (let i = 0; i < n; i++) {
    const before = i < k;
    const u = before ? i / k : (i - k) / (n - k);
    if ((i & 15) === 0) {
      const fc = before ? 450 * (3200 / 450) ** u : 3200 * (1400 / 3200) ** u;
      fl.set(fc, 1.2);
      fr.set(fc * 1.07, 1.2);
    }
    fl.tick(nl());
    fr.tick(nr());
    // the pre-roll stays low until the last moment, then breaks off just before the peak
    const gap = clamp((k - sec(0.001) - i) / sec(0.004));
    const e = before ? u ** 5 * (0.5 - 0.5 * Math.cos(Math.PI * gap)) : Math.exp(-(i - k) / (0.07 * SR));
    const bright = hp.tick(nc());
    const contact = i >= k ? bright * Math.exp(-(i - k) / (0.0015 * SR)) * 1.2 : 0;
    const [gl, gr] = panGains(pan0 + (pan1 - pan0) * smooth(i / n));
    l[i] = (fl.bpn * e + contact) * gl;
    r[i] = (fr.bpn * e + contact) * gr;
  }
  return norm({ l, r }, -1, 0.02);
}

/**
 * A receipt printing: seven quick ticks of a print head, 10.5 ms apart, over a short rasp of
 * paper. The first is the head's heavy strike (a 1.5 ms burst, the others 0.5 ms), and the whole
 * is soft-clipped hard: at the same peak its first 5 ms carry 3.4 dB more than a 0.5 ms tick did
 * (and the print 3 dB more in 2-8 kHz), every later 5 ms at least 9.8 dB under them, so the print
 * reads over the groove and its first block is the rise QA's onset finder reads.
 */
export function printer(seed: number): Float32Array {
  const n = sec(0.22);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const head = new ModalBank([
    { f: 3300, decay: 0.0035, gain: 1 },
    { f: 5200, decay: 0.002, gain: 0.5 },
    { f: 1250, decay: 0.006, gain: 0.35 },
  ]);
  const paper = new Biquad('bandpass', 2600, 0.8);
  const step = sec(0.0105);
  const amp = (j: number) => (j === 0 ? 1 : 0.36 - 0.03 * j) * (0.85 + 0.3 * uni(seed, j));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const j = Math.floor(i / step);
    const p = i - j * step;
    const len = j === 0 ? 72 : 24;
    const x = j < 7 && p < len ? nz() * (1 - p / len) * amp(j) : 0;
    const band = paper.tick(nz());
    const rasp = t >= 0.015 ? band * Math.min(1, (t - 0.015) / 0.006) * Math.exp(-(t - 0.015) / 0.05) * 0.22 : 0;
    out[i] = head.tick(x) + rasp;
  }
  return norm(soften(out, 2.5), -1, 0.02);
}

/** The sandbox's bolt: a muted low knock, a door that does not open. */
export function bolt(seed: number): Float32Array {
  const n = sec(0.35);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const body = new ModalBank([
    { f: 178, decay: 0.085, gain: 1 },
    { f: 437, decay: 0.045, gain: 0.6 },
    { f: 912, decay: 0.022, gain: 0.35 },
    { f: 2380, decay: 0.006, gain: 0.25 },
  ]);
  const lp = new Biquad('lowpass', 2500, 0.7);
  const hp = new Biquad('highpass', 3000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = i < 144 ? lp.tick(nz()) * (1 - i / 144) : lp.tick(0);
    out[i] = Math.tanh(1.2 * body.tick(x) + 0.3 * hp.tick(nz()) * Math.exp(-t / 0.0009));
  }
  return norm(out, -1, 0.02);
}

/** A mouse click: the press (bright, or soft for the desktop's own buttons) and its release 62 ms later. */
export function click(seed: number, soft = false): Float32Array {
  const n = sec(0.13);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const f = soft ? 2100 : 2900;
  const press = new ModalBank([
    { f, decay: 0.005, gain: 1 },
    { f: soft ? 760 : 980, decay: 0.009, gain: 0.6 },
    { f: 5200, decay: 0.002, gain: soft ? 0.12 : 0.3 },
  ]);
  const release = new ModalBank([
    { f: f * 1.12, decay: 0.004, gain: 0.2 },
    { f: (soft ? 760 : 980) * 1.1, decay: 0.006, gain: 0.12 },
  ]);
  const hp = new Biquad('highpass', 4500, 0.7);
  const rel = sec(0.062);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = i < 8 ? nz() * (1 - i / 8) : 0;
    const b = i >= rel && i < rel + 8 ? nz() * (1 - (i - rel) / 8) : 0;
    out[i] = press.tick(a) + release.tick(b) + (soft ? 0.15 : 0.35) * hp.tick(nz()) * Math.exp(-t / 0.0006);
  }
  return norm(soften(out, 1.8), -1, 0.02);
}

/** A single pip: a pure tone with a breath of its octave, struck and gone. */
export function pip(m: number): Float32Array {
  const n = sec(0.32);
  const out = new Float32Array(n);
  const w = (TAU * midiHz(m)) / SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(w * i) + 0.12 * Math.sin(2 * w * i)) * Math.min(1, t / 0.0007) * Math.exp(-t / 0.055);
  }
  return norm(out, -1, 0.02);
}

export interface SwellOptions {
  /** the filter's corner at the start and at the peak, Hz */
  f0: number;
  f1: number;
  /** growth: larger is flatter for longer, then steeper (default 4) */
  curve?: number;
  /** a band-pass of this Q instead of a low-pass */
  q?: number;
  /** quiet left at the end of the clip, s (default 12 ms): what the swell leads into starts clean */
  gap?: number;
  pan0?: number;
  pan1?: number;
}

/**
 * A swell of noise whose filter opens as it grows, loudest at its end: a riser, or (short, with a
 * steep curve) a reverse swoosh. It stops `gap` s before the clip ends, with a 6 ms fade, so a
 * hit placed at the clip's end has a clean onset.
 */
export function swell(seed: number, len: number, o: SwellOptions): StereoClip {
  const n = sec(len);
  const m = n - sec(o.gap ?? 0.012);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const nl = whiteNoise(seedOf(seed, 'l'));
  const nr = whiteNoise(seedOf(seed, 'r'));
  const fl = new Svf();
  const fr = new Svf();
  const k = o.curve ?? 4;
  const tail = sec(0.006);
  for (let i = 0; i < m; i++) {
    const u = i / m;
    if ((i & 15) === 0) {
      const fc = o.f0 * (o.f1 / o.f0) ** u;
      fl.set(fc, o.q ?? 0.7);
      fr.set(fc * 1.06, o.q ?? 0.7);
    }
    fl.tick(nl());
    fr.tick(nr());
    const e = ((Math.exp(k * u) - 1) / (Math.exp(k) - 1)) * Math.min(1, (m - i) / tail);
    const [gl, gr] = panGains((o.pan0 ?? -0.2) + ((o.pan1 ?? 0.2) - (o.pan0 ?? -0.2)) * u);
    l[i] = (o.q ? fl.bpn : fl.lp) * e * gl;
    r[i] = (o.q ? fr.bpn : fr.lp) * e * gr;
  }
  return norm({ l, r }, -1, 0);
}

/** Air: high, wide noise that opens at once and falls away over `len` s (a soft cymbal without the metal). */
export function shimmer(seed: number, len = 2): StereoClip {
  const n = sec(len);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const nl = whiteNoise(seedOf(seed, 'l'));
  const nr = whiteNoise(seedOf(seed, 'r'));
  const hl = new Biquad('highpass', 5200, 0.7);
  const hr = new Biquad('highpass', 5200, 0.7);
  const tl = new Biquad('lowpass', 13000, 0.7);
  const tr = new Biquad('lowpass', 13000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.003) * Math.exp(-t / (len * 0.25));
    l[i] = tl.tick(hl.tick(nl())) * e;
    r[i] = tr.tick(hr.tick(nr())) * e;
  }
  return norm({ l, r }, -1, 0.05);
}

export interface BoomOptions {
  /** how hard the body is driven into its soft clip (default 1.6) */
  drive?: number;
  /** the body after the first 5 ms against them, dB (default 0: one envelope) */
  bodyDb?: number;
}

/**
 * A deep, soft boom: a sine falling to 38 Hz, saturated just enough to be heard on small speakers
 * (`drive`), with a low knock. Driven harder (2.5 and over) its body is near square while it is
 * loud, so its power does not dip twice a cycle as a sine's does; with its body under its first
 * 5 ms (`bodyDb`), those 5 ms are the rise QA's onset finder reads, not a later one.
 */
export function boom(seed: number, o: BoomOptions = {}): Float32Array {
  const n = sec(1.8);
  const out = new Float32Array(n);
  const nz = whiteNoise(seed);
  const lp = new Biquad('lowpass', 700, 0.7);
  const drive = o.drive ?? 1.6;
  const bodyGain = dbToGain(o.bodyDb ?? 0);
  const a = sec(0.005);
  const turn = sec(0.003);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (38 + 34 * Math.exp(-t / 0.09))) / SR;
    const body = Math.sin(ph) * Math.exp(-t / 0.45) * Math.min(1, t / 0.0015);
    const knock = lp.tick(nz()) * Math.exp(-t / 0.012);
    const w = i < a ? 1 : i < a + turn ? 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / turn) : 0;
    out[i] = (w + (1 - w) * bodyGain) * Math.tanh(drive * body + 0.4 * knock);
  }
  return norm(out, -1, 0.08);
}

/** How loud every stamp is, alone (its loudest 400 ms, LUFS; its peak, its strike's, then -2.7 to -1.1 dBFS, as before the strike): its level in the mix is set where it is placed. */
const STAMP_LUFS = -11.5;
/**
 * The stamp's strike: its first 5 ms driven harder (denser at the same peak), the body after it
 * 4.5 dB lower (a 3 ms turn). Flat from its first block, the stamp let any low note under it
 * (the G2 sub against D3 beats at 49 Hz) push a later 5 ms block over its first in QA's onset
 * finder; now its first block stands 4 to 6 dB clear of what follows it.
 */
const STRIKE = { s: 0.005, turn: 0.003, drive: 2, bodyDb: -4.5 } as const;

/**
 * A stamp: a pitched, dense hit (a tuned body at `m` with its fifth and octave, driven into a
 * soft clip; a pitch-dropping thwack) and the slap of paper on top, its strike sharper than its
 * body (STRIKE). Each callback of the runtime gets its own note. A 1.5 ms strike of seeded noise
 * excites a low mode by the burst's sum, which the seed sets, so the body is levelled (by its
 * first 30 ms) before the clip, and the stamp by its loudness after it: levelled by their peaks,
 * the four came out up to 3.3 LU apart.
 */
export function stamp(m: number, seed: number): Float32Array {
  const f = midiHz(m);
  const n = sec(0.6);
  const out = new Float32Array(n);
  // a short body: a stamp is a strike, not a note
  const body = new ModalBank([
    { f, decay: 0.09, gain: 1 },
    { f: f * 1.5, decay: 0.05, gain: 0.45 },
    { f: f * 2, decay: 0.045, gain: 0.3 },
    { f: f * 2.9, decay: 0.03, gain: 0.18 },
  ]);
  // a 1.5 ms strike: the stamp is loudest at once, not 20 ms in
  const strike = whiteNoise(seedOf(seed, 'strike'));
  const lp = new Biquad('lowpass', 3000, 0.7);
  const ex = new Float32Array(n);
  for (let i = 0; i < n; i++) ex[i] = i < 72 ? lp.tick(strike()) * (1 - i / 72) : lp.tick(0);
  const ring = body.render(ex, n);
  let e = 0;
  for (let i = 0; i < sec(0.03); i++) e += ring[i] * ring[i];
  // the body's level, as a sine's peak, over its first 30 ms
  const level = Math.sqrt((2 * e) / sec(0.03));
  const nz = whiteNoise(seedOf(seed, 'paper'));
  const paper = new Biquad('bandpass', 2300, 0.9);
  const a = sec(STRIKE.s);
  const turn = sec(STRIKE.turn);
  const bodyGain = dbToGain(STRIKE.bodyDb);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * f * (1 + 0.7 * Math.exp(-t / 0.006))) / SR;
    const thwack = Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.0005);
    const slap = paper.tick(nz()) * Math.exp(-t / 0.006);
    // 1 in the strike, 0 in the body, a half cosine between
    const w = i < a ? 1 : i < a + turn ? 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / turn) : 0;
    const drive = 1 + (STRIKE.drive - 1) * w;
    out[i] = (w + (1 - w) * bodyGain) * Math.tanh(drive * ((2.6 * ring[i]) / level + 0.9 * thwack + 0.7 * slap));
  }
  norm(out, -1, 0.04);
  scale(out, dbToGain(STAMP_LUFS - loudness(out, out).maxMomentary));
  return out;
}
