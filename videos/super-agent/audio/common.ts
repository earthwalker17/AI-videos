/**
 * What every part of the score shares: its pitches, its placement levels, the landmarks it reads
 * from the cue sheet, and the desk a part places its clips on (arrangement.ts lists the parts).
 *
 * Every position is a sample from ctx.cues through the kit's timeline: a cue by id (T.cue,
 * T.span), a frame of one of the cue sheet's plain-data schedules (LAMP_VISITS, FIX_A, BEAT_4, ...
 * in src/cues.ts, which the picture reads too) through T.frame, or the bar grid (T.beat).
 */
import { SR, dbToGain, panGains, type Place, type StereoClip, type Timeline } from '@aiv/pipeline/audio/kit';
import { fmMallet } from './instruments.ts';

/** Pitches (MIDI, A4 = 69). */
export const M = {
  D2: 38,
  Eb2: 39,
  G2: 43,
  A2: 45,
  B2: 47,
  D3: 50,
  Eb3: 51,
  E3: 52,
  F3: 53,
  Fs3: 54,
  G3: 55,
  A3: 57,
  Bb3: 58,
  B3: 59,
  C4: 60,
  Cs4: 61,
  D4: 62,
  E4: 64,
  F4: 65,
  Fs4: 66,
  G4: 67,
  A4: 69,
  B4: 71,
  C5: 72,
  Cs5: 73,
  D5: 74,
  E5: 76,
  F5: 77,
  Fs5: 78,
  G5: 79,
  A5: 81,
  C6: 84,
  D6: 86,
} as const;

/**
 * Placement levels, dB on peak-normalised clips (the pad's notes on their fixed scale), set
 * against the mixer's report: index.ts prints it, and how far each UI sound sits under the bed
 * (the target is 12-18 dB under).
 */
export const LV = {
  tiles: -17,
  hop: -25,
  /** added to the eighth and sixteenth swings: the fast visits light every folder, and without it they sank 16-22 dB under the bed */
  hopEighths: 1.5,
  hopSixteenths: 3,
  /** the request motif: its D5 lands on the still-ringing A4, and at -12 the master took over 2 dB off the hook's tiles for half a second under it */
  motif: -14,
  motifFall: -20,
  piano: -9,
  thump: -23,
  scratch: -19,
  strike: -20,
  tileFade: -27,
  boardLands: -30,
  rescan: -21,
  doubleTap: -23,
  trip: -21,
  trickle: -21,
  hum: -25,
  plod: -15,
  smear: -23,
  slide: -29,
  stubs: -13,
  replies: -26,
  tear: -27,
  dsus2: -15,
  /**
   * each of the turn's four unison voices. Its six notes ring into each other, so by beat 3 the
   * stack plus the bass pulse is the sketch's loudest moment: at -13 the master's glue and limiter
   * took up to 6.3 dB off bar 17 (over 2 dB for 1.9 s of it); at -16 the turn still peaks at the
   * ceiling and is still the loudest bar, with at most 4.3 dB taken off (over 2 dB for 0.8 s).
   */
  arp: -16,
  bass: -18,
  pad: -27,
  /** the Router's memory on 2 and 4: at -30 (the sketch) it was inaudible under the Workers */
  ticks: -20,
  /** an index detent off the beat (the arm turning toward a hatch) */
  armTick: -21,
  /** the Workers' voices: at -13 two of them on one beat (bar 27) pushed the limiter over 3 dB */
  workers: -15,
  knock: -22,
  swell: -26,
  /** an ink click is 70 ms: its loudest 400 ms reads low, so it sits a little higher than the longer UI sounds */
  click: -16,
  plate: -22,
  print: -20,
  gauge: -22,
  ghost: -22,
  restPluck: -29,
  /** the pad in a rest, relative to its level outside: at -19 (the sketch's) the pad alone sat only 21 dB under the mix */
  restPad: -22,
  // beats 5 and 6
  pulse: -23,
  clack: -18,
  bell: -21,
  detent: -18,
  heldTick: -15,
  heldTone: -33,
  /** each voice of a batch chord, its notes strummed 3 ms apart: at -19, struck together, the eight-note chord took 6.5 dB of limiting */
  batch: -21,
  fold: -21,
  pointer: -17,
  ratchet: -25,
  hopNote: -17,
  answer: -15,
  // part one's two late sounds (session 5): the older reply's paper tick, the stress plate's unhook
  paperTick: -19,
  unhook: -17,
  // ===== part two (session 5): bars 44-84 =====
  // beat 7
  cordRun: -29,
  cordPluck: -24,
  tally: -20.5,
  /** the job capsule's held tone (its strike on the peel is LV.capsuleStrike) */
  capsule: -27,
  capsuleStrike: -19,
  /** the "started" receipt's tiny ink click (at -21 it sat 23.6 dB under the bed) */
  receipt: -15,
  dockChord: -20,
  dossier: -26,
  /** the sharp contact a hit needs over the bass pulse and the pad (QA's onset finder: the loudest 5 ms rise within 120 ms; at -13 the low tones' 5 ms ripple came within 1.4x of it) */
  contact: -12,
  // beat 8
  /** the tick row's rain: one clip, normalised on its loudest (inked) tick (panned where the row prints, right of centre, it reads 1 dB lower than at the centre: at -24 it sat 19 dB under the bed) */
  rain: -22.5,
  /** the thinned pulse: a soft FM mallet on 1 and 3 with the bass, the pad gone */
  pulseMallet: -22,
  /** the sheet's print taps (at -22 they sat 18.5-19 dB under the bed once each bass stroke held to the next) */
  stamp8: -20.5,
  /** the lanes' strips: the two baselines in lighter print, two levels in full */
  strip: -25,
  stripHero: -23,
  /** the bracket's open fifth: two short plucks, at -24 far under the sheet's bass and mallet (at -18, 19.2-19.9 under the held bass) */
  bracket: -16,
  /** the told-to-delegate strip's notch clicks (at -21 the first two sat 18.6-19.4 dB under the sheet's bass and mallet, at -19.5 18.2-18.3 under the held bass) */
  notch: -19,
  stack: -21,
  // beat 9
  /** the lid's latch and the vellum breaths: the B minor pad is back within 0.35 s of bar 58 (at -34 and -30 the lid sat 24 dB and the lays 20-23 dB under it; at -27 the lid 18.8 under the beat-8 bass held to bar 58) */
  lid: -26,
  vellum: -27.5,
  strutHum: -27,
  vellumTap: -21,
  lampOn: -19,
  slipDrop: -22,
  sweep: -17,
  /** the stuck bay's loop: its damped B4 and A4 lose their fundamental to the soft mallet, so they sit high (at -24 they were lost under the pad) */
  stuck: -18,
  pencil: -26,
  // beat 10
  etch: -15,
  fixEcho: -26,
  /** Fix B's ghost pluck over LV.fixEcho: a short bright pluck reads about 14 dB under the plod's marimba at the same level */
  fixPluck: 8,
  reach: -17,
  report: -17,
  pop: -19,
  // beats 11-13
  /** the scratching drag along the trace: it runs into rest-signoff, which must stay 20 dB under the mix */
  drag: -33,
  /** the idea labels (the first, as the pad comes back from the rest, 4 dB lower) */
  label: -16,
  keySet: -20.5,
  theme: -26,
  collar: -18,
  endMotif: -18,
} as const;

/** The score's landmarks, in samples, read from the cue sheet. */
export interface Marks {
  /** bar 12 downbeat (hit `hub`): everything stops dead */
  hub: number;
  /** the beat of silence after the hub's D (silence `silence-hub`), [start, end) */
  hush: [number, number];
  /** bar 13 (mark `beat-3`): the two easy fixes */
  split: number;
  /** bar 18 downbeat, two beats before the breath: the split stops, the Dsus2 hangs alone */
  question: number;
  /** the half-bar breath (rest `rest-breath`), [start, end) */
  breath: [number, number];
  /** bar 19 downbeat (hit `turn`) */
  turn: number;
  /** MT1's stamp-in (mark `stamp-in`): from here the Workers are heard through a wall */
  stepDown: number;
  /** the model rest (rest `rest-model`), [start, end) */
  rest: [number, number];
  /** the two beats of silence before the intrusion (silence `silence-intrusion`), [start, end) */
  intrusion: [number, number];
  /** the sign-off rest (rest `rest-signoff`), [start, end) */
  signoff: [number, number];
  /** the bare desk at the end (rest `rest-tail`), [start, end) */
  tail: [number, number];
  /** bar 44 downbeat (mark `beat-7`): part two, beats 7-13 (continuity.ts numbers its pad lines apart from part one's) */
  two: number;
  /** the film's end */
  end: number;
}

export function marks(T: Timeline): Marks {
  const breath = T.span('rest-breath');
  return {
    hub: T.cue('hub'),
    hush: T.span('silence-hub'),
    split: T.cue('beat-3'),
    question: breath[0] - T.beats(2),
    breath,
    turn: T.cue('turn'),
    stepDown: T.cue('stamp-in'),
    rest: T.span('rest-model'),
    intrusion: T.span('silence-intrusion'),
    signoff: T.span('rest-signoff'),
    tail: T.span('rest-tail'),
    two: T.cue('beat-7'),
    end: T.n,
  };
}

/** A UI sound as placed: where, how long, and its loudest 400 ms (mean power per channel, after its gain). */
export interface FxPlacement {
  part: string;
  at: number;
  len: number;
  power: number;
}

/** The loudest 400 ms (100 ms hops) of a clip as mean power per channel; a mono clip is taken as panned equal-power (half its power each side). */
export function loudest400(clip: Float32Array | StereoClip): number {
  const mono = clip instanceof Float32Array;
  const [l, r] = mono ? [clip, clip] : [clip.l, clip.r];
  const hop = SR / 10;
  const e = new Float64Array(Math.max(1, Math.ceil(l.length / hop)));
  for (let i = 0; i < l.length; i++) e[Math.floor(i / hop)] += ((l[i] * l[i] + r[i] * r[i]) / 2) * (mono ? 0.5 : 1);
  let best = 0;
  for (let h = 0; h < e.length; h++) {
    let w = 0;
    for (let k = h; k < Math.min(e.length, h + 4); k++) w += e[k];
    best = Math.max(best, w / (4 * hop));
  }
  return best;
}

/** Where the parts place their clips: the kit's Mixer, or a recorder in the tests. */
export interface Placer {
  add(at: number, clip: Float32Array | StereoClip, p: Place): void;
}

/** A placement without its bus (the desk's helpers name the bus). */
export type P = Omit<Place, 'bus'>;

/** What a part of the score places its clips with. */
export interface Desk {
  T: Timeline;
  seed: number;
  m: Marks;
  /** the first sample of a film frame (a fractional frame rounds to the nearest sample) */
  f: (frame: number) => number;
  music: (at: number, clip: Float32Array | StereoClip, p: P) => void;
  workers: (at: number, clip: Float32Array | StereoClip, p: P) => void;
  pad: (at: number, clip: Float32Array | StereoClip, p: P) => void;
  /** a UI sound: placed on the foley bus and listed for the under-the-bed report */
  foley: (at: number, clip: Float32Array | StereoClip, p: P) => void;
  /** the request motif (A4 then D5, an eighth apart, on FM mallet), or other `notes` at another `step` (beats) */
  motif: (at: number, o: { pan: number; db: number; notes?: readonly number[]; step?: number; tau?: number; sends?: Readonly<Record<string, number>>; until?: number }) => void;
  fx: FxPlacement[];
}

export function desk(T: Timeline, mx: Placer): Desk {
  const fx: FxPlacement[] = [];
  const on = (bus: string) => (at: number, clip: Float32Array | StereoClip, p: P) => mx.add(at, clip, { bus, ...p });
  const music = on('music');
  return {
    T,
    seed: T.ctx.seed,
    m: marks(T),
    f: (frame) => T.frame(frame),
    music,
    workers: on('workers'),
    pad: on('pad'),
    foley: (at, clip, p) => {
      mx.add(at, clip, { bus: 'foley', ...p });
      const len = clip instanceof Float32Array ? clip.length : clip.l.length;
      fx.push({ part: p.part, at, len, power: loudest400(clip) * dbToGain(p.db ?? 0) ** 2 });
    },
    motif: (at, o) => {
      const notes = o.notes ?? [M.A4, M.D5];
      const step = T.beats(o.step ?? 0.5);
      notes.forEach((midi, j) =>
        music(at + j * step, fmMallet(midi, { vel: 0.85, ...(o.tau !== undefined ? { tau: o.tau } : {}) }), {
          part: 'motif',
          db: o.db,
          pan: o.pan,
          sends: o.sends ?? { hall: 0.3, echo: 0.3 },
          ...(o.until !== undefined ? { until: o.until } : {}),
        }),
      );
    },
    fx,
  };
}

/**
 * A mono clip as a stereo one that moves while it sounds: equal-power gains from `pan(t)` (t in s from the clip's
 * start, -1 left .. +1 right), read every 32 samples. Placed at pan 0 (the mixer's balance is unity there), it is
 * exactly the mono clip placed at a fixed pan wherever pan(t) holds still.
 */
export function panned(clip: Float32Array, pan: (t: number) => number): StereoClip {
  const l = new Float32Array(clip.length);
  const r = new Float32Array(clip.length);
  let gl = 0;
  let gr = 0;
  for (let i = 0; i < clip.length; i++) {
    if ((i & 31) === 0) [gl, gr] = panGains(pan(i / SR));
    l[i] = clip[i] * gl;
    r[i] = clip[i] * gr;
  }
  return { l, r };
}
