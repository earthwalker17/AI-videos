/**
 * The score's synthesised instruments, each note a fresh mono (or stereo) clip that starts at its
 * onset: an FM celesta, a creepy music box, a theremin, a formant ghost choir, a soft organ pad
 * and a sub. Phases accumulate in float64; detune, wow and vibrato phases are seeded.
 */
import { Biquad, OnePole, Resonator, SR, TAU, centsRatio, clamp, midiHz, seedOf, slowNoise, smooth, uni, whiteNoise } from './dsp.ts';
import type { Stereo } from './sampler.ts';

// --- celesta ---------------------------------------------------------------------------------------

export interface CelestaOptions {
  vel?: number;
  /** seconds before the damper falls; omitted: rings out */
  dur?: number;
  seed: number;
  /** a per-note id (seeds the hammer noise) */
  k: number;
  /** 0..1, how much FM bite the attack has */
  bright?: number;
}

/**
 * FM celesta: a ratio-1 modulator whose index falls fast (a bright strike melting into a nearly
 * pure tone), a soft octave partial, a fleeting inharmonic tine and a felt-hammer tick.
 */
export function celesta(midi: number, o: CelestaOptions): Float32Array {
  const f = midiHz(midi);
  const vel = clamp((o.vel ?? 90) / 127, 0.05, 1);
  const t60 = clamp(2.6 * (523 / f) ** 0.35, 0.9, 4);
  const damp = o.dur;
  const len = Math.ceil((damp !== undefined ? Math.min(t60, damp + 0.5) : t60) * SR);
  const out = new Float32Array(len);
  const tau1 = t60 / 6.91;
  const bright = o.bright ?? 0.7;
  const i0 = (0.6 + 1.1 * bright) * (0.5 + 0.5 * vel);
  const noise = whiteNoise(seedOf(o.seed, 'celesta-hammer', o.k));
  const hammer = new Biquad('bandpass', clamp(f * 5, 1800, 6000), 1.2);
  const attack = 0.0012 * SR;
  let pc = 0;
  let pm = 0;
  let p2 = 0;
  let p3 = 0;
  const dc = (TAU * f) / SR;
  const d2 = (TAU * f * 2.0) / SR;
  const d3 = (TAU * f * 5.37) / SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const idx = i0 * Math.exp(-t / 0.08) + 0.25 * Math.exp(-t / 0.7);
    let a = 0.72 * Math.exp(-t / tau1) + 0.28 * Math.exp(-t / 0.22);
    if (i < attack) a *= smooth(i / attack);
    if (damp !== undefined && t > damp) a *= Math.exp(-(t - damp) / 0.09);
    const main = Math.sin(pc + idx * Math.sin(pm));
    const oct = 0.13 * Math.exp(-t / 0.45) * Math.sin(p2);
    const tine = 0.05 * vel * Math.exp(-t / 0.05) * Math.sin(p3);
    const tick = i < 0.004 * SR ? hammer.tick(noise() * (1 - i / (0.004 * SR))) * 0.25 : 0;
    out[i] = vel * (a * (main + oct) + tine) + tick * vel;
    pc += dc;
    pm += dc;
    p2 += d2;
    p3 += d3;
    if (pc > 1e4) {
      pc -= TAU * Math.floor(pc / TAU);
      pm -= TAU * Math.floor(pm / TAU);
      p2 -= TAU * Math.floor(p2 / TAU);
      p3 -= TAU * Math.floor(p3 / TAU);
    }
  }
  return out;
}

// --- music box -------------------------------------------------------------------------------------

export interface MusicBoxOptions {
  vel?: number;
  seed: number;
  /** a per-note id: seeds its detune (±10..25 cents) and its click */
  k: number;
  /** extra pitch in cents over the note's own time (wow, a wind-down sag) */
  pitch?: (t: number) => number;
  /** no seeded detune (a box in tune) */
  inTune?: boolean;
  /** the pin's mechanical click */
  click?: boolean;
}

/**
 * A comb tine: the fundamental, a faint octave, the bright cantilever partial near 5.9× and a
 * glassy one near 11.7×, each decaying faster than the last; a seeded detune per note (a box
 * that has been in an attic too long), and the pin's click.
 */
export function musicBox(midi: number, o: MusicBoxOptions): Float32Array {
  const vel = clamp((o.vel ?? 90) / 127, 0.05, 1);
  const u = uni(seedOf(o.seed, 'musicbox-detune', o.k), 0);
  const sign = uni(seedOf(o.seed, 'musicbox-detune', o.k), 1) < 0.5 ? -1 : 1;
  const detune = o.inTune ? 0 : sign * (10 + 15 * u);
  const f = midiHz(midi) * centsRatio(detune);
  const t60 = clamp(1.9 * (880 / f) ** 0.3, 0.8, 3);
  const len = Math.ceil(t60 * SR);
  const out = new Float32Array(len);
  const partials = [
    { r: 1, a: 1, tau: t60 / 6.91 },
    { r: 2.0, a: 0.08, tau: 0.35 },
    { r: 5.93, a: 0.32, tau: 0.09 },
    { r: 11.7, a: 0.07, tau: 0.03 },
  ].filter((p) => f * p.r < SR * 0.45);
  const ph = partials.map(() => 0);
  const pitch = o.pitch;
  let ratio = pitch ? centsRatio(pitch(0)) : 1;
  const attack = 0.0006 * SR;
  for (let i = 0; i < len; i++) {
    if (pitch && (i & 31) === 0) ratio = centsRatio(pitch(i / SR));
    const t = i / SR;
    let y = 0;
    for (let p = 0; p < partials.length; p++) {
      const q = partials[p];
      y += q.a * Math.exp(-t / q.tau) * Math.sin(ph[p]);
      ph[p] += (TAU * f * q.r * ratio) / SR;
    }
    if (i < attack) y *= i / attack;
    out[i] = y * vel * 0.8;
  }
  if (o.click !== false) {
    const c = pinClick(seedOf(o.seed, 'musicbox-click', o.k), 0.12 * vel);
    for (let i = 0; i < c.length && i < len; i++) out[i] += c[i];
  }
  return out;
}

/** The pin lifting a tooth: a tiny metallic tick plus the soft knock of the cylinder. */
export function pinClick(s: number, amp: number): Float32Array {
  const n = Math.round(0.03 * SR);
  const out = new Float32Array(n);
  const w = whiteNoise(s);
  const r1 = new Resonator(4300, 0.004, 1);
  const r2 = new Resonator(7100, 0.002, 0.6);
  const r3 = new Resonator(1250, 0.007, 0.5);
  for (let i = 0; i < n; i++) {
    const x = i < 0.0015 * SR ? w() * (1 - i / (0.0015 * SR)) : 0;
    out[i] = amp * (0.5 * r1.tick(x) + 0.4 * r2.tick(x) + 0.5 * r3.tick(x));
  }
  return out;
}

/** The key winding the spring: ratchet clicks. */
export function windUp(s: number, clicks: number, gap: number): Float32Array {
  const n = Math.round((clicks * gap + 0.05) * SR);
  const out = new Float32Array(n);
  for (let c = 0; c < clicks; c++) {
    const at = Math.max(0, Math.round((c * gap + gap * 0.15 * (uni(s, c) - 0.5)) * SR));
    const k = pinClick(seedOf(s, 'ratchet', c), 0.9 * (0.75 + 0.25 * uni(s, 100 + c)));
    const body = new Resonator(780, 0.012, 0.35);
    for (let i = 0; i < k.length && at + i < n; i++) out[at + i] += k[i] + body.tick(i < 40 ? k[i] : 0);
  }
  return out;
}

// --- theremin --------------------------------------------------------------------------------------

export interface GlidePoint {
  /** s from the clip start: the glide towards `midi` starts here */
  t: number;
  midi: number;
  /** glide time, s (80..200 ms is a hand moving) */
  glide?: number;
}

export interface ThereminOptions {
  seed: number;
  id: string;
  /** clip length, s */
  len: number;
  /** loudness over time (0..1) */
  amp: (t: number) => number;
  /** vibrato onset after each arrival, s */
  vibDelay?: number;
  /** vibrato rate, Hz */
  vibRate?: number;
  /** vibrato depth, ± cents */
  vibDepth?: number;
}

/** The pitch (MIDI, fractional) along a glide path at time t. */
export function glidePitch(points: readonly GlidePoint[], t: number): { midi: number; since: number } {
  let m = points[0].midi;
  let since = t - points[0].t;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (t < p.t) break;
    const g = p.glide ?? 0.14;
    const prev = m;
    if (t < p.t + g) {
      return { midi: prev + (p.midi - prev) * smooth((t - p.t) / g), since: -1 };
    }
    m = p.midi;
    since = t - (p.t + g);
  }
  return { midi: m, since };
}

/** A theremin: a sine with a breath of odd harmonics, portamento, a vibrato that blooms late. */
export function theremin(points: readonly GlidePoint[], o: ThereminOptions): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const rate = o.vibRate ?? 5.6;
  const depth = o.vibDepth ?? 30;
  const delay = o.vibDelay ?? 0.28;
  const drift = slowNoise(seedOf(o.seed, `${o.id}-drift`), 0.7);
  const vibWobble = slowNoise(seedOf(o.seed, `${o.id}-vib`), 0.5);
  const ampS = new OnePole(0.012);
  const depthS = new OnePole(0.12);
  let ph = 0;
  let vph = uni(seedOf(o.seed, o.id), 0) * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = glidePitch(points, t);
    const want = g.since < 0 ? 0.25 : smooth((g.since - delay) / 0.35);
    const d = depthS.tick(want);
    const vib = depth * d * Math.sin(vph) + 4 * drift(t);
    const f = midiHz(g.midi) * centsRatio(vib);
    const a = ampS.tick(o.amp(t));
    out[i] = a * (0.86 * Math.sin(ph) + 0.05 * Math.sin(2 * ph) - 0.075 * Math.sin(3 * ph) + 0.022 * Math.sin(5 * ph));
    ph += (TAU * f) / SR;
    vph += (TAU * (rate + 0.35 * vibWobble(t))) / SR;
    if (ph > 1e4) ph -= TAU * Math.floor(ph / TAU);
  }
  return out;
}

// --- ghost choir -------------------------------------------------------------------------------------

export type Vowel = 'oo' | 'ah';

/** formant centre (Hz), bandwidth (Hz) and level (dB): alto 'oo', soprano 'ah' */
const FORMANTS: Record<Vowel, [number, number, number][]> = {
  oo: [
    [325, 50, 0],
    [700, 60, -12],
    [2530, 170, -30],
    [3500, 180, -40],
  ],
  ah: [
    [800, 80, 0],
    [1150, 90, -6],
    [2900, 120, -32],
    [3900, 130, -20],
  ],
};

export interface ChoirChord {
  /** s from the clip start */
  t0: number;
  t1: number;
  notes: number[];
  vowel: Vowel;
  gain?: number;
}

export interface ChoirOptions {
  seed: number;
  id: string;
  len: number;
  voices?: number;
  attack?: number;
  release?: number;
}

/** PolyBLEP residual for a saw at phase t (0..1) with increment dt. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * A ghost choir: per note several detuned band-limited saw voices with their own slow vibrato,
 * spread across the stereo field, through a bank of formant band-passes, with a little breath.
 */
export function choir(chords: readonly ChoirChord[], o: ChoirOptions): Stereo {
  const n = Math.ceil(o.len * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const voices = o.voices ?? 4;
  const attack = o.attack ?? 0.45;
  const release = o.release ?? 0.6;
  chords.forEach((ch, ci) => {
    const a = Math.max(0, Math.floor(ch.t0 * SR));
    const b = Math.min(n, Math.ceil((ch.t1 + release) * SR));
    const m = b - a;
    if (m <= 0) return;
    const srcL = new Float64Array(m);
    const srcR = new Float64Array(m);
    ch.notes.forEach((note, ni) => {
      for (let v = 0; v < voices; v++) {
        const s = seedOf(o.seed, `${o.id}-voice`, ci * 1000 + ni * 50 + v);
        const det = (uni(s, 0) * 2 - 1) * 11;
        const vRate = 4.6 + 0.9 * uni(s, 1);
        const vDepth = 12 + 10 * uni(s, 2);
        let vph = uni(s, 3) * TAU;
        let ph = uni(s, 4);
        const pan = voices > 1 ? -0.8 + (1.6 * v) / (voices - 1) : 0;
        const gl = Math.cos(((pan + 1) * Math.PI) / 4);
        const gr = Math.sin(((pan + 1) * Math.PI) / 4);
        const drift = slowNoise(seedOf(s, 'drift'), 0.6);
        const f0 = midiHz(note);
        for (let i = 0; i < m; i++) {
          const t = (a + i) / SR;
          const local = t - ch.t0;
          let env = local < attack ? smooth(local / attack) : 1;
          if (t > ch.t1) env *= 1 - smooth((t - ch.t1) / release);
          const f = f0 * centsRatio(det + vDepth * Math.sin(vph) + 5 * drift(t));
          const dt = f / SR;
          ph += dt;
          if (ph >= 1) ph -= 1;
          const y = (2 * ph - 1 - blep(ph, dt)) * env;
          srcL[i] += y * gl;
          srcR[i] += y * gr;
          vph += (TAU * vRate) / SR;
        }
      }
    });
    // breath: a little noise through the same formants
    const breath = whiteNoise(seedOf(o.seed, `${o.id}-breath`, ci));
    for (let i = 0; i < m; i++) {
      const t = (a + i) / SR;
      const local = t - ch.t0;
      let env = local < attack ? smooth(local / attack) : 1;
      if (t > ch.t1) env *= 1 - smooth((t - ch.t1) / release);
      const bn = breath() * 0.35 * env;
      srcL[i] += bn;
      srcR[i] += breath() * 0.35 * env;
    }
    const g = (ch.gain ?? 1) / Math.sqrt(voices * ch.notes.length);
    for (const [src, dst] of [
      [srcL, l],
      [srcR, r],
    ] as const) {
      const bank = FORMANTS[ch.vowel].map(([fc, bw, db]) => ({ f: new Biquad('bandpass', fc, fc / bw), g: 10 ** (db / 20) }));
      const hp = new Biquad('highpass', 140, 0.7);
      const lp = new Biquad('lowpass', 4200, 0.7);
      for (let i = 0; i < m; i++) {
        const x = src[i];
        let y = 0;
        for (const fb of bank) y += fb.g * fb.f.tick(x);
        dst[a + i] += lp.tick(hp.tick(y)) * g * 2.2;
      }
    }
  });
  return { l, r };
}

// --- pads ---------------------------------------------------------------------------------------------

/** A soft organ pad: drawbar-ish additive partials, two slightly detuned ranks spread left/right. */
export function organ(notes: readonly number[], o: { len: number; attack: number; release: number; hold: number; seed: number; tremolo?: number }): Stereo {
  const n = Math.ceil(o.len * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const bars: [number, number][] = [
    [0.5, 0.22],
    [1, 1],
    [2, 0.38],
    [3, 0.12],
    [4, 0.07],
  ];
  const trem = o.tremolo ?? 0;
  for (const note of notes) {
    for (const [side, det] of [
      [0, -3],
      [1, 3],
    ] as const) {
      const f = midiHz(note) * centsRatio(det);
      const ph = bars.map((_, k) => uni(seedOf(o.seed, 'organ', note * 10 + k), side) * TAU);
      const dst = side === 0 ? l : r;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        let env = t < o.attack ? smooth(t / o.attack) : 1;
        if (t > o.hold) env *= 1 - smooth((t - o.hold) / o.release);
        if (env <= 0 && t > o.hold) break;
        const tm = 1 - trem * (0.5 + 0.5 * Math.sin(TAU * 0.27 * t + side));
        let y = 0;
        for (let k = 0; k < bars.length; k++) {
          y += bars[k][1] * Math.sin(ph[k]);
          ph[k] += (TAU * f * bars[k][0]) / SR;
        }
        dst[i] += y * env * tm * 0.25;
      }
    }
  }
  return { l, r };
}

/** A sub: sine plus a little second harmonic (so small speakers hint at it). */
export function sub(midi: number, o: { len: number; attack: number; release: number; hold: number }): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const f = midiHz(midi);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = t < o.attack ? smooth(t / o.attack) : 1;
    if (t > o.hold) env *= 1 - smooth((t - o.hold) / o.release);
    out[i] = env * (Math.sin(ph) + 0.18 * Math.sin(2 * ph));
    ph += (TAU * f) / SR;
  }
  return out;
}

/** An FM bell: carrier and modulator at a ratio, index falling with the amplitude (round, warm). */
export function fmBell(f: number, o: { ratio: number; index: number; tau: number; len: number; attack?: number }): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  let pc = 0;
  let pm = 0;
  const att = (o.attack ?? 0.002) * SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-t / o.tau);
    out[i] = (i < att ? i / att : 1) * e * Math.sin(pc + o.index * e * Math.sin(pm));
    pc += (TAU * f) / SR;
    pm += (TAU * f * o.ratio) / SR;
  }
  return out;
}
