/**
 * The voices of "Who Routes the Agents?" (TREATMENT.md, Sound design: Instruments), built from
 * the shared kit's primitives: all synthesis, no samples. Pitches are MIDI numbers (A4 = 69).
 * A voice returns a mono clip whose sample peak is `vel` (0..1), so a placement's gain in dB is
 * its level, except the bowed pad's notes, which keep one fixed scale so the chords of the pad
 * stay level with each other.
 *
 *   fmMallet     sine carrier, 1:4 modulator, fast decay         messages and the request motif
 *   marimba      a modal bar: four inharmonic partials           the session tiles, then Workers
 *   feltPiano    additive, two strings, soft hammer, low-pass    you
 *   sineBass     a sine through light saturation                 the Router's pulse
 *   bowedNote    an additive partial stack, slow bow, vibrato    continuity (the pad)
 *   woodTick     Karplus–Strong, short and dull                  message pills, the Router's memory
 *   brightPluck  Karplus–Strong, bright                          sketch B's stubs, the rest's plucks
 *   smear        a soft triangle gliding in from a semitone off  sketch A's muddle
 *   chirp        a short rising sine                             sketch B's replies
 *   fallTone     a short falling, closing tone                   a session tile fading
 *   hum          a low held tone, two beating strings, low-passed the lid strut: keep it running
 *   softPulse    a short, round sine blip                        beat 5's sixteenth pulse (listening)
 *   loupeBell    an FM bell, inharmonic 1:3.5, soft              a slip the loupe judges (the model)
 *
 * Deterministic: float64 phases and filter state, randomness only from the film seed through
 * the kit's seeded noise (@aiv/core's hash).
 */
import { Biquad, ModalBank, Osc, SR, Svf, TAU, centsRatio, clamp, fmBell, gainToDb, midiHz, norm, pluck, seedOf, slowNoise, smooth, whiteNoise } from '@aiv/pipeline/audio/kit';

/** a clip's peak for a velocity, dBFS */
const peakDb = (vel: number): number => gainToDb(clamp(vel, 0.01, 1));

/** keep a growing phase (radians) small, so a long note keeps its pitch exactly */
const wrap = (p: number): number => (p > 1e4 ? p - TAU * Math.floor(p / TAU) : p);

// --- FM mallet ----------------------------------------------------------------------------------

export interface MalletOptions {
  /** 0..1: level and brightness (default 0.8) */
  vel?: number;
  /** the amplitude's time constant, s (default from the pitch: longer low) */
  tau?: number;
  /** clip length, s (default 7 time constants, at most 3 s) */
  len?: number;
  /** a fall in pitch over the note, cents (the hook's unfinished F) */
  droop?: number;
  /** how long the fall takes, s (default 0.5) */
  droopTime?: number;
}

/** A sine carrier with a modulator at four times its frequency; the index falls faster than the level. */
export function fmMallet(midi: number, o: MalletOptions = {}): Float32Array {
  const f0 = midiHz(midi);
  const vel = clamp(o.vel ?? 0.8, 0.05, 1);
  const tau = o.tau ?? clamp(0.5 * (440 / f0) ** 0.35, 0.22, 0.9);
  const n = Math.ceil((o.len ?? Math.min(3, tau * 7)) * SR);
  const out = new Float32Array(n);
  const index = 0.7 + 1.5 * vel;
  const att = Math.round(0.0015 * SR);
  const droopTime = o.droopTime ?? 0.5;
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = o.droop ? f0 * centsRatio(-o.droop * smooth(t / droopTime)) : f0;
    const a = Math.exp(-t / tau) * (i < att ? i / att : 1);
    out[i] = a * Math.sin(pc + index * Math.exp(-t / (tau * 0.3)) * Math.sin(pm));
    pc = wrap(pc + (TAU * f) / SR);
    pm = wrap(pm + (TAU * 4 * f) / SR);
  }
  return norm(out, peakDb(vel));
}

// --- modal marimba ------------------------------------------------------------------------------

/** a tuned bar's modes: [frequency ratio, gain, decay relative to the fundamental's] */
const BAR_MODES: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [3.93, 0.3, 0.3],
  [9.24, 0.11, 0.13],
  [15.6, 0.04, 0.07],
];

export interface MarimbaOptions {
  seed: number;
  /** names the note (its contact noise) */
  k: number;
  /** 0..1 (default 0.7) */
  vel?: number;
  /** detune, cents */
  cents?: number;
  /** 0..1: a harder mallet, stronger upper modes (default 0.5) */
  bright?: number;
  /** the fundamental's time constant, s (default from the pitch) */
  tau?: number;
}

/** A struck bar: a Hann-pulse mallet (shorter when harder) into a bank of four decaying modes. */
export function marimba(midi: number, o: MarimbaOptions): Float32Array {
  const f0 = midiHz(midi) * centsRatio(o.cents ?? 0);
  const vel = clamp(o.vel ?? 0.7, 0.05, 1);
  const bright = clamp(o.bright ?? 0.5);
  const tau = o.tau ?? clamp(0.55 * Math.sqrt(220 / f0), 0.12, 1.1);
  const n = Math.ceil(tau * 6.5 * SR);
  const bank = new ModalBank(BAR_MODES.map(([r, g, d]) => ({ f: f0 * r, decay: tau * d, gain: r === 1 ? g : g * (0.4 + bright) })));
  const w = Math.max(8, Math.round((0.0034 - 0.0022 * bright * vel) * SR));
  const exc = new Float32Array(w + 1);
  for (let i = 0; i <= w; i++) exc[i] = 0.5 - 0.5 * Math.cos((TAU * i) / w);
  const contact = whiteNoise(seedOf(o.seed, 'marimba-contact', o.k));
  for (let i = 0; i < Math.min(24, exc.length); i++) exc[i] += 0.05 * bright * contact();
  return norm(bank.render(exc, n), peakDb(vel));
}

// --- felt piano ---------------------------------------------------------------------------------

export interface PianoOptions {
  seed: number;
  k: number;
  /** 0..1 (default 0.7): level, and how far the felt lets the upper partials through */
  vel?: number;
  /** the damper falls this long after the onset, s (default: the note rings out) */
  hold?: number;
  /** the damper's time constant, s (default 0.12) */
  damp?: number;
  /** clip length when the note rings out, s (default from the pitch, at most 6 s) */
  len?: number;
}

/**
 * Additive felt piano: slightly stretched partials (inharmonicity), each a pair of strings a
 * cent apart (a slow beat), a two-stage decay (prompt sound, then aftersound), a felt low-pass on
 * the partials and a soft, low hammer noise.
 */
export function feltPiano(midi: number, o: PianoOptions): Float32Array {
  const f0 = midiHz(midi);
  const vel = clamp(o.vel ?? 0.7, 0.05, 1);
  const tau1 = clamp(1.2 * (130 / f0) ** 0.6, 0.25, 2.5);
  const ring = o.len ?? Math.min(6, tau1 * 4);
  const damp = o.damp ?? 0.12;
  const len = o.hold !== undefined ? Math.min(ring, o.hold + damp * 6) : ring;
  const n = Math.ceil(len * SR);
  const out = new Float64Array(n);
  const fc = 450 + 1400 * vel;
  const B = 0.00025;
  const P = Math.max(1, Math.min(14, Math.floor(7000 / f0)));
  for (let p = 1; p <= P; p++) {
    const fp = p * f0 * Math.sqrt(1 + B * p * p);
    if (fp > SR * 0.45) break;
    const amp = (1 / p ** 1.15) * (1 / (1 + (fp / fc) ** 2));
    const t1 = tau1 / (1 + 0.15 * (p - 1));
    const t2 = t1 * 3.5;
    const d1 = (TAU * fp) / SR;
    const d2 = (TAU * fp * centsRatio(0.9)) / SR;
    let a1 = 0;
    let a2 = 0.6 * p;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] += amp * (0.72 * Math.exp(-t / t1) + 0.28 * Math.exp(-t / t2)) * 0.5 * (Math.sin(a1) + Math.sin(a2));
      a1 = wrap(a1 + d1);
      a2 = wrap(a2 + d2);
    }
  }
  const hammer = whiteNoise(seedOf(o.seed, 'felt-hammer', o.k));
  const hlp = new Biquad('lowpass', 900, 0.7);
  const hn = Math.round(0.006 * SR);
  for (let i = 0; i < hn; i++) out[i] += 0.05 * vel * hlp.tick(hammer()) * (1 - i / hn);
  const att = Math.round(0.004 * SR);
  for (let i = 0; i < Math.min(att, n); i++) out[i] *= smooth(i / att);
  if (o.hold !== undefined) {
    const h = Math.round(o.hold * SR);
    for (let i = Math.max(0, h); i < n; i++) out[i] *= Math.exp(-(i - h) / (damp * SR));
  }
  const lp = new Biquad('lowpass', clamp(fc * 2.5, 1200, 5000), 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = lp.tick(out[i]);
  return norm(y, peakDb(vel));
}

// --- sine bass ----------------------------------------------------------------------------------

/** A sine pulse through a light tanh saturation (a little third harmonic, so it reads on small speakers). */
export function sineBass(midi: number, o: { len: number; vel?: number; drive?: number }): Float32Array {
  const f = midiHz(midi);
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const drive = o.drive ?? 1.8;
  const k = 1 / Math.tanh(drive);
  const tail = 0.12;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = smooth(t / 0.006) * (0.5 + 0.5 * Math.exp(-t / 0.14)) * smooth((o.len - t) / tail);
    out[i] = k * Math.tanh(drive * env * Math.sin(p));
    p = wrap(p + (TAU * f) / SR);
  }
  return norm(out, peakDb(o.vel ?? 0.9));
}

// --- bowed pad ----------------------------------------------------------------------------------

export interface BowOptions {
  seed: number;
  k: number;
  /** clip length, s: the release ends here */
  len: number;
  /** raised-cosine attack and release, s */
  attack: number;
  release: number;
  /** level over the note (t in s from its onset), 0..1 (default 1) */
  amp?: (t: number) => number;
  /** vibrato depth, cents (default 5) */
  vibrato?: number;
}

/**
 * One bowed note: harmonics falling as 1/n^1.25 (no detuned saws), each with its own slow bow
 * pressure, a gentle vibrato that fades in after the attack, a soft low-pass. Fixed scale: a
 * note peaks near 1 at amp 1, whatever its pitch.
 */
export function bowedNote(midi: number, o: BowOptions): Float32Array {
  const f0 = midiHz(midi);
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const P = Math.max(1, Math.min(8, Math.floor(4500 / f0)));
  const amps = Array.from({ length: P }, (_, p) => 1 / (p + 1) ** 1.25);
  const scale = 1 / amps.reduce((a, b) => a + b, 0);
  const bow = amps.map((_, p) => slowNoise(seedOf(o.seed, 'bow-pressure', o.k * 16 + p), 0.45 + 0.11 * p));
  const wander = slowNoise(seedOf(o.seed, 'bow-vibrato', o.k), 0.3);
  const phase0 = (seedOf(o.seed, 'bow-phase', o.k) / 4294967296) * TAU;
  const depth = o.vibrato ?? 5;
  const ph = new Float64Array(P);
  const lvl = new Float64Array(P);
  const lp = new Biquad('lowpass', 2800, 0.7);
  const releaseAt = o.len - o.release;
  let vibPh = phase0;
  let cents = 0;
  let env = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // control rate: every 32 samples (1.5 kHz) for the bow, the vibrato and the envelope
    if ((i & 31) === 0) {
      for (let p = 0; p < P; p++) lvl[p] = amps[p] * (1 + 0.2 * bow[p](t));
      cents = depth * smooth((t - o.attack * 0.6) / 1.2) * Math.sin(vibPh) * (1 + 0.25 * wander(t));
      env = smooth(t / o.attack) * (t > releaseAt ? smooth((o.len - t) / o.release) : 1) * (o.amp ? o.amp(t) : 1);
    }
    vibPh = wrap(vibPh + (TAU * 4.7) / SR);
    const f = f0 * centsRatio(cents);
    let y = 0;
    for (let p = 0; p < P; p++) {
      y += lvl[p] * Math.sin(ph[p]);
      ph[p] = wrap(ph[p] + (TAU * (p + 1) * f) / SR);
    }
    out[i] = lp.tick(y * scale * env);
  }
  return out;
}

// --- plucks and ticks ---------------------------------------------------------------------------

/** A wooden tick: a short, dull Karplus–Strong pluck. */
export function woodTick(f: number, o: { seed: number; k: number; vel?: number }): Float32Array {
  return norm(pluck(f, { seed: seedOf(o.seed, 'wood-tick', o.k), len: 0.14, t60: 0.07, bright: 0.45 }), peakDb(o.vel ?? 0.7), 0.01);
}

/**
 * A bright Karplus–Strong pluck, its white-noise attack low-passed at 9.5 kHz: bright, not fizzy,
 * and without the near-Nyquist content whose inter-sample peaks the AAC encode raises.
 */
export function brightPluck(midi: number, o: { seed: number; k: number; vel?: number; t60?: number; bright?: number }): Float32Array {
  const t60 = o.t60 ?? 0.9;
  const y = pluck(midiHz(midi), { seed: seedOf(o.seed, 'bright-pluck', o.k), len: t60 * 1.1, t60, bright: o.bright ?? 0.9 });
  new Biquad('lowpass', 9500, Math.SQRT1_2).run(y);
  return norm(y, peakDb(o.vel ?? 0.7));
}

// --- the act-one colours ------------------------------------------------------------------------

/**
 * A soft triangle that starts `from` and glides into `to` over `glide` s, landing 14 cents sharp
 * (never quite in tune): a second line smearing into the plodding one. `attack` and `release`
 * (s, default 0.07 and 0.18) are its raised-cosine ends: long ones make it a held, smeared voice
 * (the ghost Router's backlog).
 */
export function smear(from: number, to: number, o: { len: number; glide: number; vel?: number; attack?: number; release?: number }): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const v = new Osc('triangle');
  const lp = new Biquad('lowpass', 1100, 0.7);
  const f0 = midiHz(from);
  const f1 = midiHz(to) * centsRatio(14);
  const attack = o.attack ?? 0.07;
  const release = o.release ?? 0.18;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (f1 / f0) ** smooth(t / o.glide);
    out[i] = lp.tick(v.tick(f)) * smooth(t / attack) * smooth((o.len - t) / release);
  }
  return norm(out, peakDb(o.vel ?? 0.7));
}

/** A reply chirp: a sine rising from f0 to f1 Hz (exponentially) over `len` s, with a little octave. */
export function chirp(o: { f0: number; f1: number; len: number; vel?: number }): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    out[i] = Math.sin(Math.PI * u) ** 1.5 * (Math.sin(p) + 0.18 * Math.sin(2 * p));
    p = wrap(p + (TAU * o.f0 * (o.f1 / o.f0) ** u) / SR);
  }
  return norm(out, peakDb(o.vel ?? 0.6));
}

/** A tile fading: a short triangle falling `drop` semitones while a low-pass closes over it. */
export function fallTone(midi: number, o: { len?: number; drop?: number; vel?: number } = {}): Float32Array {
  const len = o.len ?? 0.42;
  const n = Math.ceil(len * SR);
  const out = new Float32Array(n);
  const v = new Osc('triangle');
  const svf = new Svf();
  const f0 = midiHz(midi);
  const drop = o.drop ?? 5;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = t / len;
    if ((i & 31) === 0) svf.set(2400 * (500 / 2400) ** u, 0.8);
    svf.tick(v.tick(f0 * centsRatio(-100 * drop * smooth(u))));
    out[i] = svf.lp * smooth(t / 0.005) * Math.exp(-t / (len / 3)) * smooth((len - t) / 0.03);
  }
  return norm(out, peakDb(o.vel ?? 0.6));
}

// --- the build's colours (session 4) --------------------------------------------------------------

/**
 * A low held hum: the fundamental and two harmonics (so a small speaker hears it), each on two
 * strings 0.45 Hz apart (a slow beat), under a 420 Hz low-pass; raised-cosine ends. Not a sub hit:
 * it swells in over `attack` and is held.
 */
export function hum(midi: number, o: { len: number; attack?: number; release?: number; vel?: number }): Float32Array {
  const f0 = midiHz(midi);
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const attack = o.attack ?? 0.18;
  const release = o.release ?? 0.12;
  const parts: readonly (readonly [number, number])[] = [
    [1, 1],
    [2, 0.55],
    [3, 0.22],
  ];
  const ph = new Float64Array(parts.length * 2);
  const lp = new Biquad('lowpass', 420, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let y = 0;
    parts.forEach(([h, g], p) => {
      y += g * (Math.sin(ph[2 * p]) + Math.sin(ph[2 * p + 1]));
      ph[2 * p] = wrap(ph[2 * p] + (TAU * h * f0) / SR);
      ph[2 * p + 1] = wrap(ph[2 * p + 1] + (TAU * (h * f0 + 0.45)) / SR);
    });
    out[i] = lp.tick(y) * smooth(t / attack) * smooth((o.len - t) / release);
  }
  return norm(out, peakDb(o.vel ?? 0.7));
}

/** A short round blip: a sine with a little octave, a 3 ms attack and a fast decay (`tau`, default 45 ms). */
export function softPulse(midi: number, o: { vel?: number; tau?: number } = {}): Float32Array {
  const f0 = midiHz(midi);
  const tau = o.tau ?? 0.045;
  const n = Math.ceil(Math.min(0.4, tau * 6) * SR);
  const out = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = smooth(t / 0.003) * Math.exp(-t / tau) * (Math.sin(p) + 0.2 * Math.sin(2 * p));
    p = wrap(p + (TAU * f0) / SR);
  }
  new Biquad('lowpass', 2400, 0.7).run(out);
  return norm(out, peakDb(o.vel ?? 0.6));
}

/** A soft bell (the kit's FM bell, 1:3.5, index 1.1, a 0.7 s decay) under a 6 kHz low-pass. */
export function loupeBell(midi: number, o: { vel?: number; tau?: number } = {}): Float32Array {
  const tau = o.tau ?? 0.7;
  const y = fmBell(midiHz(midi), { ratio: 3.5, index: 1.1, tau, len: tau * 5, attack: 0.003 });
  new Biquad('lowpass', 6000, 0.7).run(y);
  return norm(y, peakDb(o.vel ?? 0.6));
}
