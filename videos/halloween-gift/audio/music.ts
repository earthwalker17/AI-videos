/**
 * The cue: an original D-minor waltz in 3/4 at 120 bpm, bar by bar against src/cues.ts. Pitches
 * are MIDI numbers (C4 = 60). The only quotations are the knock's rhythm (in foley.ts) and two
 * bars of the opening of Chopin's funeral march (Op. 35, public domain), newly set for tuba and
 * bass drum in D minor on the seal.
 *
 * Theme A (bars 5-8):   Dm | Gm | A7 | Dm          A4 D5 F5 | G5. F#5 G5 | E5 C#5 E5 G5 | F5. E5 D5
 * Graveyard (9-12):     Dm | Bbm | F#m | A7       (chromatic mediants under the ghost choir)
 * Lane, Theme A' (13-16): Dm | Gm | Eb | A7      (xylophone an octave above the celesta; a theremin
 *                         counter-line; the bell tolls A on bar 16; the build into the hard stop)
 */
import type { Library } from '@aiv/pipeline/audio';
import { SR, clamp, curve, panGains, seedOf, slowNoise, smooth } from './dsp.ts';
import type { Mixer, Place } from './mixer.ts';
import { OneShot, Sampler, type NoteOptions, type Stereo } from './sampler.ts';
import { celesta, choir, musicBox, organ, sub, theremin, windUp, type ChoirChord, type GlidePoint } from './synth.ts';
import type { Timeline } from './timeline.ts';

/**
 * Per-instrument calibration (dB), a reference the placements' own gains build on. Measured: one
 * note at velocity 90, its loudest momentary (400 ms, K-weighted) loudness: -15 to -26 LUFS with
 * these values. The pizzicato trio, which plays as one chord, is levelled to within 1 dB (cello
 * -25.0, viola -24.4, violin -24.9 at their waltz keys), so the violins' top voice no longer sits
 * 8 dB under the violas; the glockenspiel, the quietest at -27 to -28, is raised 3 dB to -24/-25.
 */
export const CAL = {
  tuba: 9,
  cbTrem: 10,
  celloPizz: -1,
  violaPizz: -5,
  violinPizz: 2,
  celloTrem: -4,
  violinTrem: -6,
  harp: 1,
  hornMute: 6,
  trombone: 6,
  timpani: 7,
  timpRoll: 9,
  xylo: -5,
  glock: 12,
  bells: -1,
} as const;

/**
 * VSCO 2 CE maps its glockenspiel and xylophone recordings an octave under the pitch they sound
 * (glock "C5", keycenter 72, sounds C6 = 1054 Hz, with nothing at C5: -59 dB), and they are a
 * little sharp. Measured: the strongest partial 30-500 ms after the onset, in a ±1.5 semitone
 * band around the sounding pitch (FFT, 2^19 points, Hann). So a note's key is its sounding pitch:
 * shift -12, and each recording is pulled back by the cents it measured sharp.
 */
export const MALLETS = {
  glock: {
    shift: -12,
    retune: { 'glock_medium_G4.wav': -8, 'glock_medium_C5.wav': -12, 'glock_medium_G5.wav': -12, 'glock_medium_C6.wav': -16, 'glock_medium_G6.wav': -16, 'glock_medium_C7.wav': -24 },
  },
  xylo: {
    shift: -12,
    retune: {
      'Xylo_Medium_G3_ff_01_far.wav': -13,
      'Xylo_Medium_C4_ff_01_far.wav': -12,
      'Xylo_Medium_G4_ff_01_far.wav': -14,
      'Xylo_Medium_C5_ff_01_far.wav': -15,
      'Xylo_Medium_G5_ff_01_far.wav': -16,
      'Xylo_Medium_C6_ff_01_far.wav': -17,
      'Xylo_Medium_G6_ff_01_far.wav': -21,
      'Xylo_Medium_C7_ff_01_far.wav': -16,
    },
  },
} as const;

/** Mono clip → stereo with a pan that moves over the clip's time. */
export function autopan(x: Float32Array, pan: (t: number) => number): Stereo {
  const l = new Float32Array(x.length);
  const r = new Float32Array(x.length);
  let gl = 0;
  let gr = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 63) === 0) [gl, gr] = panGains(pan(i / SR));
    l[i] = x[i] * gl;
    r[i] = x[i] * gr;
  }
  return { l, r };
}

const W = 'vsco2-ce';

/** Humanised timing: a few ms early or late, seeded per note. */
/** seconds a slow-speaking instrument is played ahead of its beat (its attack peaks 60-130 ms in) */
const ANTICIPATE: Record<string, number> = { tuba: 0.02, 'cello-trem': 0.03, 'violin-trem': 0.03, 'horn-mute': 0.02 };

/** the waltz (bars 5-16) sits this far under the punctuations (burst, stinger, slam) */
const WALTZ = -1.5;

const nudge = (seed: number, part: string, k: number, ms = 6) => Math.round(((seedOf(seed, part, k) / 4294967296) * 2 - 1) * ms * 0.001 * SR);

export function music(T: Timeline, mx: Mixer): void {
  const ctx = T.ctx;
  const seed = ctx.seed;
  const lib: Library = ctx.library(W);
  const B = T.beat;
  const beatS = 0.5;

  const play = (inst: Sampler, at: number, o: Omit<NoteOptions, 'at'>, p: Place) => {
    // slow-speaking recordings start a little early so their bloom sits on the beat
    const lead = Math.round((ANTICIPATE[inst.name] ?? 0) * SR);
    mx.add(at - lead, inst.note({ ...o, at }), p);
  };

  // --- the box's slow wow: one function of absolute time, shared by every note it plays
  const wowNoise = slowNoise(seedOf(seed, 'wow'), 0.4);
  const wow = (abs: number) => 7 * Math.sin(2 * Math.PI * 0.55 * abs + 1.3) + 4 * wowNoise(abs);
  let boxK = 0;
  const box = (at: number, midi: number, o: { vel?: number; db?: number; pan?: number; hall?: number; sag?: (t: number) => number; part?: string } = {}) => {
    const t0 = at / SR;
    const sag = o.sag;
    const clip = musicBox(midi, { seed, k: boxK++, vel: o.vel ?? 90, pitch: (t) => wow(t0 + t) + (sag ? sag(t0 + t) : 0) });
    mx.add(at, clip, { part: o.part ?? 'music-box', db: -8 + (o.db ?? 0), pan: o.pan ?? 0.25, hall: o.hall ?? 0.35 });
  };
  let celK = 0;
  const cel = (at: number, midi: number, o: { vel?: number; dur?: number; db?: number; pan?: number; hall?: number; part?: string } = {}) =>
    mx.add(at, celesta(midi, { seed, k: celK++, vel: o.vel ?? 88, dur: o.dur }), { part: o.part ?? 'celesta', db: -5 + (o.db ?? 0), pan: o.pan ?? -0.1, hall: o.hall ?? 0.3 });

  // =====================================================================================
  // Bars 1-3 · the closed book: the low D pedal, the music-box motif, the roll into the burst
  // =====================================================================================
  {
    const cb = new Sampler(lib, 'ContrabassTrem.sfz', 'cb-trem', CAL.cbTrem, seed);
    const dur = (B(4) - B(1)) / SR;
    play(cb, B(1), { key: 38, vel: 72, dur, attack: 0.5, release: 0.35, amp: (t) => 0.55 + 0.45 * smooth(t / dur) }, { part: 'cb-trem', pan: -0.2, hall: 0.2 });
    // the bookend: the pedal returns, faint, under the end card (bars 36-39)
    const endA = B(36);
    const endDur = (B(39, 3) - endA) / SR;
    play(cb, endA, { key: 38, vel: 50, dur: endDur, attack: 1.2, release: 0.6, amp: (t) => 0.8 * (1 - smooth((t - endDur * 0.6) / (endDur * 0.4))) }, { part: 'cb-trem', db: -6, pan: -0.2, hall: 0.25 });
    cb.release();
    mx.add(B(1), sub(26, { len: dur + 0.4, attack: 0.9, hold: dur - 0.1, release: 0.4 }), { part: 'sub', db: -27 });
  }
  // the key winds the spring (between the thunder's crack and the first note), then the motif
  mx.add(T.s(0.24), windUp(seedOf(seed, 'windup'), 4, 0.058), { part: 'wind-up', db: -23, pan: 0.25, hall: 0.15 });
  {
    const motif: [number, number, number][] = [
      [1, 2, 74],
      [1, 3, 77],
      [2, 1, 80],
      [2, 2, 81],
      [3, 1, 86],
      [3, 1.5, 89],
      [3, 2, 92],
      [3, 2.5, 93],
    ];
    motif.forEach(([bar, b, m], k) => box(B(bar, b), m, { vel: k < 4 ? 96 : 78, hall: 0.4 }));
  }
  {
    const roll = new Sampler(lib, 'TimpaniRolls.sfz', 'timp-roll', CAL.timpRoll, seed);
    // the roll breathes off 60 ms before the burst, so the burst lands on silence
    const d = (B(4) - B(3)) / SR - 0.06;
    play(roll, B(3), { key: 38, vel: 100, dur: d, release: 0.03, amp: (t) => 0.06 + 0.94 * clamp(t / d) ** 2.4 }, { part: 'timp-roll', pan: -0.1, hall: 0.3 });
    // bars 15-16: the build on A, crescendo into the hard stop
    const d2 = (T.hardStop - B(15)) / SR;
    play(roll, B(15), { key: 45, vel: 100, dur: d2, release: 0.02, amp: (t) => 0.05 + 0.95 * clamp(t / d2) ** 2.2 }, { part: 'timp-roll', pan: -0.1, hall: 0.3 });
    roll.release();
  }

  // =====================================================================================
  // Bar 4 · cover-burst: timpani, the harp's glissando up, the cymbal swell landing
  // =====================================================================================
  const timp = new Sampler(lib, 'Timpani.sfz', 'timpani', CAL.timpani, seed);
  const burst = T.cue('cover-burst');
  play(timp, burst, { key: 38, vel: 122 }, { part: 'timpani', pan: -0.1, hall: 0.35 });
  const harp = new Sampler(lib, 'Harp.sfz', 'harp', CAL.harp, seed);
  const gliss = (at: number, keys: number[], gap: number, vel0: number, vel1: number, db = 0) =>
    keys.forEach((k, i) => play(harp, at + Math.round(i * gap * SR), { key: k, vel: vel0 + ((vel1 - vel0) * i) / Math.max(1, keys.length - 1), dur: 1.6, release: 1.2 }, { part: 'harp', db, pan: -0.45 + (0.7 * i) / keys.length, hall: 0.45 }));
  const dHarmMinor = [50, 52, 53, 55, 57, 58, 61, 62, 64, 65, 67, 69, 70, 73, 74, 76, 77, 79, 81, 82, 85, 86];
  gliss(burst, dHarmMinor, 0.026, 66, 104, 2);
  {
    // the suspended cymbal swells up to the burst (cut there), and a crash lands on it
    const swell = new OneShot(lib, 'Percussion/susCymb1-cresc-Short_v1.wav', -2);
    const pk = swell.peakTime();
    const lead = Math.min(pk, 3.0);
    const clip = swell.play({ offset: pk - lead, maxLen: lead, amp: (t) => (t < 0.3 ? smooth(t / 0.3) : 1) * (1 - smooth((t - (lead - 0.05)) / 0.04)) });
    mx.add(burst - T.s(lead), clip, { part: 'cymbal', pan: 0.2, hall: 0.3 });
    const crash = new OneShot(lib, 'Percussion/cymbal-crash1_mf_rr1.wav', -2);
    mx.add(burst, crash.play({ maxLen: 4.5 }), { part: 'cymbal', pan: 0.25, hall: 0.35 });
  }

  // =====================================================================================
  // Bars 5-16 · the waltz: tuba on 1, pizzicato on 2 and 3
  // =====================================================================================
  const tuba = new Sampler(lib, 'TubaStac.sfz', 'tuba', CAL.tuba, seed);
  const cPizz = new Sampler(lib, 'CelloEnsPizz.sfz', 'cello-pizz', CAL.celloPizz, seed);
  const vaPizz = new Sampler(lib, 'ViolaEnsPizz.sfz', 'viola-pizz', CAL.violaPizz, seed);
  const vnPizz = new Sampler(lib, 'ViolinEnsPizz.sfz', 'violin-pizz', CAL.violinPizz, seed);
  type Chord = { bass: number; pizz: [number, number, number] };
  const DM: Chord = { bass: 38, pizz: [57, 62, 65] };
  const GM: Chord = { bass: 43, pizz: [58, 62, 67] };
  const A7: Chord = { bass: 33, pizz: [55, 61, 64] };
  const BBM: Chord = { bass: 34, pizz: [58, 61, 65] };
  const FSM: Chord = { bass: 42, pizz: [57, 61, 66] };
  const EB: Chord = { bass: 39, pizz: [58, 63, 67] };
  const waltz: [number, Chord, number][] = [
    [5, DM, 1],
    [6, GM, 1],
    [7, A7, 1],
    [8, DM, 1],
    [9, DM, 0.95],
    [10, BBM, 0.95],
    [11, FSM, 0.95],
    [12, A7, 0.95],
    [13, DM, 1],
    [14, GM, 1],
    [15, EB, 1.05],
    [16, A7, 1.1],
  ];
  let wk = 0;
  for (const [bar, ch, lvl] of waltz) {
    const v = (x: number) => Math.round(clamp(x * lvl, 1, 127));
    // bar 14: the waltz steps aside on the downbeat and lets the gates creak (a sound transition)
    if (B(bar) !== T.cue('gate-creak')) play(tuba, B(bar) + nudge(seed, 'tuba', bar, 4), { key: ch.bass, vel: v(84) }, { part: 'tuba', db: WALTZ, pan: 0.1, hall: 0.25 });
    for (const b of [2, 3]) {
      const chord = ch.pizz;
      const vel = v(b === 2 ? 74 : 64);
      const at = B(bar, b);
      play(cPizz, at + nudge(seed, 'pz', wk++), { key: chord[0], vel, dur: 0.4, release: 0.5 }, { part: 'pizz', db: WALTZ, pan: 0.35, hall: 0.3 });
      play(vaPizz, at + Math.round(0.006 * SR) + nudge(seed, 'pz', wk++), { key: chord[1], vel, dur: 0.4, release: 0.5 }, { part: 'pizz', db: WALTZ, pan: 0.05, hall: 0.3 });
      play(vnPizz, at + Math.round(0.011 * SR) + nudge(seed, 'pz', wk++), { key: chord[2], vel, dur: 0.4, release: 0.5 }, { part: 'pizz', db: WALTZ, pan: -0.3, hall: 0.3 });
    }
  }

  // the melody (celesta), [bar, beat, midi, beats]
  const themeA: [number, number, number, number][] = [
    [5, 1, 69, 1],
    [5, 2, 74, 1],
    [5, 3, 77, 1],
    [6, 1, 79, 1.5],
    [6, 2.5, 78, 0.5],
    [6, 3, 79, 1],
    [7, 1, 76, 1],
    [7, 2, 73, 1],
    [7, 3, 76, 0.5],
    [7, 3.5, 79, 0.5],
    [8, 1, 77, 1.5],
    [8, 2.5, 76, 0.5],
    [8, 3, 74, 1],
  ];
  const graveyard: [number, number, number, number][] = [
    [9, 1, 74, 1],
    [9, 2, 77, 1],
    [9, 3, 81, 1],
    [10, 1, 82, 1.5],
    [10, 2.5, 81, 0.5],
    [10, 3, 82, 1],
    [11, 1, 85, 1],
    [11, 2, 81, 1],
    [11, 3, 78, 1],
    [12, 1, 76, 1.5],
    [12, 2.5, 77, 0.5],
    [12, 3, 76, 1],
  ];
  const lane: [number, number, number, number][] = [
    [13, 1, 69, 1],
    [13, 2, 74, 1],
    [13, 3, 77, 1],
    [14, 1, 79, 1.5],
    [14, 2.5, 78, 0.5],
    [14, 3, 79, 1],
    [15, 1, 82, 1],
    [15, 2, 79, 1],
    [15, 3, 75, 1],
    [16, 1, 76, 1],
    [16, 2, 79, 1],
    [16, 3, 82, 1],
  ];
  for (const [bar, b, m, d] of [...themeA, ...graveyard, ...lane]) cel(B(bar, b) + nudge(seed, 'cel', bar * 10 + b, 3), m, { vel: b === 1 ? 96 : 86, db: WALTZ, dur: d * beatS + 0.15 });
  // the music box doubles Theme A an octave up, faintly out of tune
  for (const [bar, b, m] of themeA) box(B(bar, b), m + 12, { vel: 70, db: -9 + WALTZ, pan: 0.35 });
  // the xylophone carries Theme A' in the lane
  // the xylophone doubles Theme A' an octave above the celesta in the lane (keys are sounding pitch)
  const xylo = new Sampler(lib, 'Xylophone.sfz', 'xylo', CAL.xylo, seed, MALLETS.xylo);
  for (const [bar, b, m] of lane) play(xylo, B(bar, b), { key: m + 12, vel: b === 1 ? 92 : 80 }, { part: 'xylo', db: WALTZ, pan: 0.3, hall: 0.3 });

  // =====================================================================================
  // Bar 5 · pumpkin-light: the gong blooms   ·   Bar 7 · clawd-pop: a xylophone 'boing'
  // =====================================================================================
  {
    // the gong swells (its strike eased in under the lantern's 'fwip') and blooms
    const gong = new OneShot(lib, 'Percussion/gongHit_p.wav', 1);
    mx.add(T.cue('pumpkin-light'), gong.play({ maxLen: 7, fade: 2.5, amp: (t) => 0.25 + 0.75 * smooth(t / 0.45) }), { part: 'gong', pan: -0.25, hall: 0.4 });
  }
  play(xylo, T.cue('clawd-pop'), { key: 86, vel: 100, bend: (t) => 420 * Math.exp(-t / 0.14) * Math.sin(2 * Math.PI * 11 * t) + 120 * (1 - Math.exp(-t / 0.05)) }, { part: 'xylo', db: -2, pan: 0, hall: 0.25 });

  // =====================================================================================
  // Theremins: the witch crossing (6-8), a ghost lowering to peek (10.3-11.2), the lane's
  // counter-line (13-16)
  // =====================================================================================
  {
    const t0 = B(6) - T.s(0.12);
    const rel = (bar: number, b = 1) => (B(bar, b) - t0) / SR;
    const pts: GlidePoint[] = [
      { t: 0, midi: 70 },
      { t: rel(6, 3), midi: 74, glide: 0.18 },
      { t: rel(7, 1), midi: 73, glide: 0.12 },
      { t: rel(7, 3), midi: 69, glide: 0.2 },
      { t: rel(8, 2.5), midi: 74, glide: 0.2 },
    ];
    const len = rel(9) + 0.1;
    const amp = curve([
      [0, 0],
      [0.45, 0.8],
      [rel(8, 2.5), 0.75],
      [rel(9) - 0.05, 0],
    ]);
    const th = theremin(pts, { seed, id: 'witch', len, amp, vibDepth: 32, vibRate: 5.7 });
    // she flies left to right across the moon
    mx.add(t0, autopan(th, (t) => -0.6 + (1.2 * t) / len), { part: 'theremin', db: -15 + WALTZ, hall: 0.45 });
  }
  {
    const t0 = B(10, 3) - T.s(0.04);
    const shoo = (T.cue('ghost-shoo') - t0) / SR;
    const pts: GlidePoint[] = [
      { t: 0, midi: 88 },
      { t: 0.08, midi: 69, glide: shoo - 0.12 },
      { t: shoo - 0.02, midi: 86, glide: 0.11 },
    ];
    const amp = curve([
      [0, 0],
      [0.12, 0.85],
      [shoo - 0.05, 0.75],
      [shoo + 0.08, 0.6],
      [shoo + 0.24, 0],
    ]);
    const th = theremin(pts, { seed, id: 'ghost', len: shoo + 0.3, amp, vibDepth: 40, vibRate: 6.0, vibDelay: 0.1 });
    mx.add(t0, th, { part: 'theremin', db: -14 + WALTZ, pan: 0.2, hall: 0.5 });
  }
  {
    const t0 = B(13);
    const rel = (bar: number, b = 1) => (B(bar, b) - t0) / SR;
    const pts: GlidePoint[] = [
      { t: 0, midi: 65 },
      { t: rel(14), midi: 67, glide: 0.2 },
      { t: rel(15), midi: 70, glide: 0.2 },
      { t: rel(16), midi: 69, glide: 0.16 },
      { t: rel(16, 3), midi: 73, glide: 0.2 },
    ];
    const len = (T.hardStop - t0) / SR + 0.05;
    const amp = curve([
      [0, 0],
      [0.5, 0.55],
      [rel(15), 0.6],
      [rel(16, 3), 0.85],
      [len, 0.95],
    ]);
    mx.add(t0, theremin(pts, { seed, id: 'lane', len, amp, vibDepth: 25 }), { part: 'theremin', db: -17 + WALTZ, pan: -0.35, hall: 0.45 });
  }

  // =====================================================================================
  // Bars 9-12 · the ghost choir on the chromatic mediants; glock bubbles from the cauldron
  // =====================================================================================
  {
    const t0 = B(9) - T.s(0.25);
    const rel = (bar: number) => (B(bar) - t0) / SR;
    const chords: ChoirChord[] = [
      { t0: rel(9) - 0.1, t1: rel(10) + 0.12, notes: [62, 65, 69], vowel: 'oo', gain: 0.8 },
      { t0: rel(10) - 0.1, t1: rel(11) + 0.12, notes: [61, 65, 70], vowel: 'oo', gain: 0.9 },
      { t0: rel(11) - 0.1, t1: rel(12) + 0.12, notes: [61, 66, 69], vowel: 'oo', gain: 1 },
      { t0: rel(12) - 0.1, t1: rel(13) - 0.1, notes: [61, 64, 69], vowel: 'oo', gain: 0.85 },
    ];
    const c = choir(chords, { seed, id: 'graveyard', len: rel(13) + 0.8, attack: 0.35, release: 0.6 });
    mx.add(t0, c, { part: 'choir', db: -17 + WALTZ, hall: 0.55 });
  }
  const glock = new Sampler(lib, 'Glockenspiel.sfz', 'glock', CAL.glock, seed, MALLETS.glock);
  {
    const notes = [86, 89, 93, 96, 91];
    for (let k = 0; k < 9; k++) {
      const u = seedOf(seed, 'bubble', k) / 4294967296;
      const at = B(9, 1.5) + Math.round((k * 0.62 + 0.3 * u) * SR);
      const key = notes[seedOf(seed, 'bubble-note', k) % notes.length];
      play(glock, at, { key, vel: 48 + Math.round(20 * u) }, { part: 'glock', db: -6, pan: 0.5, hall: 0.35 });
    }
  }

  // =====================================================================================
  // Bars 13-16 · the lane: tubular bell, the build (string tremolo), then the hard stop
  // =====================================================================================
  {
    const bells = new Sampler(lib, 'TubularBells.sfz', 'bells', CAL.bells, seed);
    // the toll is the dominant's root, A4: it rings through the A7 bar into the hard stop
    play(bells, B(16), { key: 69, vel: 96 }, { part: 'bells', db: -3, pan: -0.3, hall: 0.5 });
    bells.release();
    const d = (T.hardStop - B(15)) / SR;
    const cresc = (t: number) => 0.12 + 0.88 * clamp(t / d) ** 1.8;
    const vc = new Sampler(lib, 'CelloEnsTrem.sfz', 'cello-trem', CAL.celloTrem, seed);
    play(vc, B(15), { key: 45, vel: 90, dur: d, attack: 0.2, release: 0.02, amp: cresc }, { part: 'trem', pan: 0.3, hall: 0.35 });
    play(vc, B(15), { key: 52, vel: 90, dur: d, attack: 0.2, release: 0.02, amp: cresc }, { part: 'trem', pan: 0.3, hall: 0.35 });
    vc.release();
    const vn = new Sampler(lib, 'ViolinEnsTrem.sfz', 'violin-trem', CAL.violinTrem, seed);
    play(vn, B(15), { key: 69, vel: 90, dur: d, attack: 0.2, release: 0.02, amp: cresc }, { part: 'trem', pan: -0.35, hall: 0.35 });
    play(vn, B(16), { key: 73, vel: 96, dur: d - 1.5, attack: 0.1, release: 0.02, amp: (t) => cresc(t + 1.5) }, { part: 'trem', pan: -0.35, hall: 0.35 });
    vn.release();
  }

  // =====================================================================================
  // Bars 20-23 · the door opens: a soft cyan room hum, the hopeful 'candy?', ta-da, the seal
  // =====================================================================================
  {
    const at = T.cue('door-creak');
    const len = (T.silences[1][0] - at) / SR;
    mx.add(at, organ([50, 57, 62, 69], { len, attack: 1.0, hold: len - 0.3, release: 0.25, seed, tremolo: 0.18 }), { part: 'room-hum', db: -25, hall: 0.2 });
  }
  {
    const arp: [number, number][] = [
      [1, 74],
      [1.5, 78],
      [2, 81],
      [2.5, 86],
      [3, 88],
    ];
    arp.forEach(([b, m], i) => cel(B(21, b), m, { vel: 78 + i * 3, db: -7, pan: -0.15 }));
    // ta-da: a glock pickup and the D-major landing
    play(glock, T.cue('ta-da') - T.s(0.17), { key: 81, vel: 70 }, { part: 'glock', pan: 0.2, hall: 0.35 });
    play(glock, T.cue('ta-da'), { key: 86, vel: 92 }, { part: 'glock', pan: 0.2, hall: 0.4 });
    play(glock, T.cue('ta-da'), { key: 93, vel: 80 }, { part: 'glock', pan: 0.25, hall: 0.4 });
  }
  {
    const seal = T.cue('seal-crack');
    gliss(seal, [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86], 0.022, 55, 85, -8);
    const rise: [number, number][] = [
      [1, 74],
      [1.5, 78],
      [2, 81],
      [2.5, 83],
      [3, 85],
      [3.5, 88],
    ];
    rise.forEach(([b, m], i) => box(B(23, b), m, { vel: 80 + i * 5, db: -4, pan: 0.15, hall: 0.4 }));
    rise.slice(3).forEach(([b, m]) => play(glock, B(23, b), { key: m, vel: 60 }, { part: 'glock', pan: 0.3, hall: 0.4 }));
  }

  // =====================================================================================
  // Bar 26 · seal-thunk: the stinger. Bars 26-27: Chopin, transposed, for tuba and bass drum
  // =====================================================================================
  const thunk = T.cue('seal-thunk');
  {
    const tbn = new Sampler(lib, 'TromboneStac.sfz', 'trombone', CAL.trombone, seed);
    const horn = new Sampler(lib, 'FHornMute.sfz', 'horn-mute', CAL.hornMute, seed);
    play(tuba, thunk, { key: 38, vel: 122 }, { part: 'tuba-stinger', db: -2, pan: 0.1, hall: 0.35 });
    play(tbn, thunk + T.s(0.004), { key: 51, vel: 104 }, { part: 'trombone', db: -2, pan: -0.2, hall: 0.35 });
    // the horn and the choir are short, so the chord is gone when the quote's four Ds start
    play(horn, thunk + T.s(0.008), { key: 56, vel: 118, dur: 0.35, release: 0.25 }, { part: 'horn', db: 4, pan: 0.3, hall: 0.4 });
    play(timp, thunk, { key: 38, vel: 127 }, { part: 'timpani', db: -2, pan: -0.1, hall: 0.35 });
    const gong = new OneShot(lib, 'Percussion/gongHit_f.wav', 1);
    mx.add(thunk, gong.play({ maxLen: 6, fade: 2.0 }), { part: 'gong', pan: -0.25, hall: 0.4 });
    const ah = choir([{ t0: 0, t1: 0.3, notes: [62, 63, 68], vowel: 'ah', gain: 1 }], { seed, id: 'stinger', len: 0.8, attack: 0.05, release: 0.3 });
    mx.add(thunk, ah, { part: 'choir', db: -10, hall: 0.5 });

    // Chopin, Op. 35/iii, bars 1-2 of the march, in D minor: a quarter is 1/3 s (8 frames).
    // BRIEF.md: a public-domain quote stays under 3 s, so two bars of 4/4 need a quarter under
    // 0.375 s, and every note (the drum's ring too) is damped by QUOTE_S after the first.
    const q = 1 / 3;
    const QUOTE_S = 2.9;
    const start = B(26, 2);
    const march: [number, number, number][] = [
      [0, 50, 96],
      [1, 50, 88],
      [1.75, 50, 76],
      [2, 50, 92],
      [4, 53, 96],
      [4.75, 52, 78],
      [5, 52, 90],
      [5.75, 50, 76],
      [6, 50, 90],
      [6.75, 49, 76],
      [7, 50, 94],
    ];
    const REL = 0.12;
    for (const [beat, key, vel] of march) {
      const at = start + Math.round(beat * q * SR);
      const dur = QUOTE_S - beat * q - REL;
      play(tuba, at, { key, vel, dur, release: REL }, { part: 'chopin-tuba', pan: 0.05, hall: 0.35 });
      play(tuba, at + T.s(0.003), { key: key - 12, vel: vel - 14, dur, release: REL }, { part: 'chopin-tuba', db: -5, pan: 0.15, hall: 0.3 });
    }
    const bd = [new OneShot(lib, 'Percussion/BDrumNewhit_v3_rr1_Sum.wav', 8), new OneShot(lib, 'Percussion/BDrumNewhit_v3_rr2_Sum.wav', 8)];
    [0, 2, 4, 6].forEach((beat, k) => mx.add(start + Math.round(beat * q * SR), bd[k % 2].play({ maxLen: Math.min(1.6, QUOTE_S - beat * q), fade: 0.3 }), { part: 'bass-drum', pan: -0.05, hall: 0.3 }));
    tbn.release();
    horn.release();
  }

  // =====================================================================================
  // Bars 29-30 · the music box winds down (ritardando, the pitch sagging), xylophone falling
  // =====================================================================================
  {
    const t0 = B(29);
    const gaps = [0.4, 0.46, 0.53, 0.63, 0.8];
    const notes = [81, 86, 89, 91, 90, 86];
    const sag = (abs: number) => -120 * clamp((abs - t0 / SR) / 3.1) ** 1.5;
    let t = 0;
    notes.forEach((m, i) => {
      box(t0 + Math.round(t * SR), m, { vel: 92 - i * 6, sag, pan: 0.2, hall: 0.45 });
      t += gaps[i] ?? 0;
    });
    const fall = [96, 93, 89, 86, 81, 77];
    fall.forEach((m, i) => play(xylo, B(29, 1.5) + Math.round(i * 0.5 * SR), { key: m, vel: 64 - i * 4 }, { part: 'xylo', db: -7, pan: -0.4, hall: 0.4 }));
  }
  play(glock, T.cue('pail-relight'), { key: 93, vel: 66 }, { part: 'glock', pan: -0.2, hall: 0.35 });

  // =====================================================================================
  // Bars 32-33 · the wink and a thin, cheeky reprise (celesta and pizzicato only)
  // =====================================================================================
  {
    const wink = T.cue('wink');
    // the wink: a grace note (an acciaccatura) that lands on D6, the reprise's first note
    cel(wink - T.s(0.026), 85, { vel: 60, db: -16, dur: 0.03, pan: -0.2 });
    cel(wink, 86, { vel: 92, db: -3, dur: beatS + 0.1, pan: -0.2 });
    const reprise: [number, number, number, number][] = [
      [32, 2, 89, 1],
      [32, 3, 93, 1],
      [33, 1, 91, 1.25],
    ];
    for (const [bar, b, m, d] of reprise) cel(B(bar, b), m, { vel: 80, db: -6, dur: d * beatS + 0.1, pan: -0.2 });
    const pz: [number, number, number, number][] = [
      [32, 2, 65, 69],
      [32, 3, 65, 69],
      [33, 2, 67, 70],
    ];
    for (const [bar, b, k1, k2] of pz) {
      play(vnPizz, B(bar, b), { key: k2, vel: 60, dur: 0.3, release: 0.4 }, { part: 'pizz', db: -5, pan: -0.3, hall: 0.3 });
      play(vaPizz, B(bar, b) + T.s(0.006), { key: k1, vel: 58, dur: 0.3, release: 0.4 }, { part: 'pizz', db: -5, pan: 0.1, hall: 0.3 });
    }
    play(cPizz, B(32), { key: 50, vel: 62, dur: 0.4, release: 0.5 }, { part: 'pizz', db: -5, pan: 0.35, hall: 0.3 });
  }

  // =====================================================================================
  // Bar 35 · book-slam: low brass 'bwah' and timpani   ·   Bar 36 · end-seal: a timpani stroke
  // Bars 36-39: the celesta plays the opening motif once more, high and soft
  // =====================================================================================
  {
    const slam = T.cue('book-slam');
    const tbn = new Sampler(lib, 'TromboneStac.sfz', 'trombone', CAL.trombone, seed);
    play(tuba, slam, { key: 38, vel: 124 }, { part: 'brass', db: -3, pan: 0.1, hall: 0.35 });
    play(tbn, slam + T.s(0.006), { key: 50, vel: 116 }, { part: 'brass', db: -4, pan: -0.2, hall: 0.35 });
    play(tbn, slam + T.s(0.01), { key: 45, vel: 108 }, { part: 'brass', db: -8, pan: -0.1, hall: 0.35 });
    tbn.release();
    play(timp, slam, { key: 38, vel: 124 }, { part: 'timpani', pan: -0.1, hall: 0.35 });
    // end-seal: a firm timpani stroke under the stamp (foley.ts); the slam's thunder is short
    play(timp, T.cue('end-seal'), { key: 38, vel: 96 }, { part: 'timpani', db: -4, pan: -0.1, hall: 0.35 });
    const tinkle: [number, number][] = [
      [36, 2],
      [36, 2.5],
      [36, 3],
      [36, 3.5],
    ];
    [86, 89, 92, 93].forEach((m, i) => cel(B(tinkle[i][0], tinkle[i][1]), m, { vel: 66 - i * 3, db: -7, pan: 0.15, hall: 0.5 }));
  }

  for (const s of [timp, harp, tuba, cPizz, vaPizz, vnPizz, xylo, glock]) s.release();
}
