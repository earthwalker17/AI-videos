/**
 * The arrangement: what sounds when, on the cue sheet's grid (src/cues.ts: 120 bpm, 42 bars of
 * four beats; a beat is 30 frames, a bar 2 s).
 *
 * Every hit is placed on its cue's own sample, read by name from src/cues.ts (HITS), so a moved
 * hit takes its sound with it. The music around the hits is written in bars for the acts as the
 * cue sheet has them now (WRITTEN): when an act or a hit moves, the build says so, and the sound
 * still lands on its frame.
 *
 * The ideas the music carries:
 * - D major, calm and bright: the chords are Dmaj9, Bm11, Gmaj9 and A9sus4, a few voicings of
 *   the same few notes, so every change is a soft one.
 * - The teal dot is a glass bell falling E6, A5, F♯5 (the dot drops into the caret). It sounds
 *   three times: the hook, the desktop's return and the mark, where it comes to rest on D.
 * - The terminal runs half-time (a product film's calm demo); a refusal stops the music for a
 *   beat; the hand-off brings in a straight, restrained pulse.
 * - The permission scene leaves the key: the sandbox swells into G minor (borrowed, uneasy), the
 *   amber card asks with a rising fourth (E5 to A5), and Allow once answers with D and F♯, then
 *   half a bar of quiet.
 * - The quit is heard through a wall (the music's low-pass closes); the reopen opens it.
 * - The runtime's four callbacks are stamps on D3, F♯3, A3 and E4, the notes of the chord that
 *   lights at bar 33 (Dmaj9), where all of it sounds at once with the bells.
 *
 * Buses: kick, drums (the rest of the kit: ticks, shaker, rim, clap), bass, pad, keys (piano and
 * plucks), bell (the glass), air (risers and shimmer) and fx (the sound design, with its own small
 * room). See index.ts.
 */
import { SR, Svf, curve, dbToGain, seedOf, type Mixer, type StereoClip, type Timeline } from '@aiv/pipeline/audio/kit';
import { ACTS, HITS, actAt, type Act, type Hit } from '../src/cues.ts';
import * as V from './voices.ts';

/** the teal dot: a glass bell falling E6, A5, F♯5, a sixteenth apart */
export const MOTIF = [88, 81, 78] as const;

/**
 * The film's dynamics: what each act's music gets on top of the levels written at its calls
 * (dB). The demo sections are calm, the runtime is the peak, the close comes back down. The
 * sound design is set per hit, not by act.
 */
const DYN: Record<Act, number> = { hook: -4, terminal: -3.5, handoff: -2.5, record: -2.5, permission: -3, desktop: -2.5, runtime: -1.5, close: -3.5 };

/** The runtime's build, in bars: each step starts at one (27 Bm11, 29 four on the floor, 31 the claps and sixteenths, 33 the light); 35 ends it. */
export const BUILD_BARS = [27, 29, 31, 33, 35] as const;

/**
 * What the band's tone (the pad, the keys, the bells and the air; not the drums, the bass or the
 * sound design, whose peaks the limiter would catch) gets in each step of the build (dB): it
 * rises, and the light (HITS.lit, bar 33) is the film's peak.
 */
const BUILD_LIFT = [-1.5, -1, -1, 2.5] as const;

/**
 * The balance: what each family gets on top of the level written at its call (dB), set from the
 * mixer's report and the master's limiter (which should rarely work).
 */
const TRIM = { kick: -3, tick: 9, shaker: 6, rim: 4, clap: 3, sub: -3.5, bass: 1, pad: 2.5, pluck: 5 } as const;

const CH = {
  /** the hook: open, no third */
  open: [50, 57, 62, 64, 69],
  dmaj9: [50, 57, 61, 64, 66],
  /** the warm resolutions (the pass, Allow once, the mark): no seventh */
  dadd9: [50, 57, 62, 64, 66],
  /** the runtime lit: Dmaj9, wide */
  dlit: [50, 57, 61, 64, 66, 69, 73],
  bm11: [47, 54, 57, 62, 64],
  gmaj9: [50, 55, 59, 62, 66, 69],
  a9sus: [52, 57, 59, 62, 67],
  em9: [52, 55, 59, 62, 66],
  /** the sandbox: G minor 6/9, borrowed from the minor key */
  gm69: [55, 58, 62, 64, 69],
  /** the wait: E half-diminished */
  e7b5: [52, 55, 58, 62],
} as const;
type Chord = keyof typeof CH;

/** bass roots: D2, E2, F♯2, G1, A1, B1, and G2 (the build lifts its bass an octave) */
const ROOT = { D: 38, E: 40, Fs: 42, G: 31, A: 33, B: 35, G2: 43 } as const;

interface Segment {
  bar: number;
  beat?: number;
  /** null: no harmony (the rest) */
  chord: Chord | null;
  root: number;
  /** the pad: level, brightness, envelope, drift (cents) */
  db?: number;
  bright?: number;
  attack?: number;
  release?: number;
  drift?: number;
  /** the pad's gate closes here (bar, beat) instead of at the next segment */
  until?: readonly [number, number];
}

/** The harmony, bar by bar: the pads play it, the bass and the plucks read their notes from it. */
const PLAN: readonly Segment[] = [
  { bar: 1, chord: 'open', root: ROOT.D, db: -23, bright: 0.22, attack: 2.6, release: 1.2 },
  { bar: 3, chord: 'dmaj9', root: ROOT.D, attack: 0.35 },
  { bar: 5, beat: 2, chord: 'bm11', root: ROOT.B, attack: 0.1 },
  { bar: 7, chord: 'gmaj9', root: ROOT.G },
  // the pad breathes out half a beat before the pass, the hand-off and the runtime (a short
  // release): its close seconds beat in QA's 5 ms onset blocks and outgrew those hits' own rise
  { bar: 7, beat: 3, chord: 'a9sus', root: ROOT.A, attack: 0.3, release: 0.3, until: [7, 4.5] },
  { bar: 8, chord: 'dadd9', root: ROOT.D, db: -19.5, bright: 0.55, attack: 0.04 },
  { bar: 9, chord: 'gmaj9', root: ROOT.G, release: 0.3, until: [9, 4.5] },
  // and comes back under the whoosh and the boom (rising over 0.3 s), not with them
  { bar: 10, chord: 'dmaj9', root: ROOT.D, attack: 0.3 },
  { bar: 11, chord: 'bm11', root: ROOT.B },
  { bar: 12, chord: 'gmaj9', root: ROOT.G },
  { bar: 13, chord: 'a9sus', root: ROOT.A },
  { bar: 14, chord: 'dmaj9', root: ROOT.D },
  { bar: 15, chord: 'bm11', root: ROOT.B },
  { bar: 16, chord: 'gmaj9', root: ROOT.G },
  // the sandbox's swell: uneasy, but under the light (bar 33)
  { bar: 16, beat: 3, chord: 'gm69', root: ROOT.G, db: -19, bright: 0.3, attack: 1.4, drift: 7 },
  { bar: 18, chord: 'e7b5', root: ROOT.E, db: -19, bright: 0.3, attack: 0.5, drift: 5 },
  { bar: 18, beat: 3, chord: 'a9sus', root: ROOT.A, bright: 0.35, attack: 0.3 },
  // Allow once: the pad's gate closes after half a bar, so it has died away before the rest
  { bar: 19, chord: 'dadd9', root: ROOT.D, db: -19.5, bright: 0.5, attack: 0.05, release: 0.85, until: [19, 3] },
  { bar: 20, chord: null, root: ROOT.D },
  { bar: 21, chord: 'gmaj9', root: ROOT.G, bright: 0.45, attack: 0.1 },
  { bar: 22, chord: 'dmaj9', root: ROOT.Fs, bright: 0.45 },
  { bar: 23, chord: 'em9', root: ROOT.E, bright: 0.45 },
  { bar: 24, chord: 'a9sus', root: ROOT.A, bright: 0.45 },
  { bar: 25, chord: 'bm11', root: ROOT.B, attack: 0.3 },
  { bar: 26, chord: 'gmaj9', root: ROOT.G, bright: 0.55, attack: 0.08 },
  { bar: 26, beat: 3, chord: 'a9sus', root: ROOT.A, bright: 0.5, release: 0.3, until: [26, 4.5] },
  { bar: 27, chord: 'bm11', root: ROOT.B, db: -19.5, bright: 0.35, attack: 0.3, release: 1.0 },
  { bar: 29, chord: 'gmaj9', root: ROOT.G2, bright: 0.45 },
  { bar: 31, chord: 'dmaj9', root: ROOT.Fs, bright: 0.5 },
  { bar: 32, chord: 'a9sus', root: ROOT.A, bright: 0.55 },
  // the light: the chord strikes, and the pad blooms after it (its rise kept off the strike's peak)
  { bar: 33, chord: 'dlit', root: ROOT.D, db: -17.5, bright: 0.75, attack: 0.2 },
  { bar: 34, chord: 'bm11', root: ROOT.B, bright: 0.5 },
  { bar: 35, chord: 'gmaj9', root: ROOT.G, db: -20, bright: 0.35, attack: 0.3 },
  { bar: 35, beat: 3, chord: 'a9sus', root: ROOT.A, db: -21, bright: 0.35 },
  { bar: 36, chord: 'dadd9', root: ROOT.D, db: -19.5, bright: 0.45, attack: 0.08 },
  { bar: 38, chord: 'gmaj9', root: ROOT.G, db: -20.5, bright: 0.35 },
  { bar: 39, chord: 'dadd9', root: ROOT.D, db: -20, bright: 0.35, release: 1.6, until: [42, 1] },
];

/** Where the music around each hit was written for (bar, beat). */
const WRITTEN: Record<Hit, readonly [number, number]> = {
  dotDrop: [2, 3],
  enter: [3, 1],
  refused: [5, 1],
  read: [6, 1],
  edited: [6, 3],
  pass: [8, 1],
  table: [9, 1],
  handoff: [10, 1],
  receipt: [13, 3],
  sandbox: [16, 3],
  approval: [17, 1],
  allow: [19, 1],
  desktop: [21, 1],
  quit: [24, 1],
  collapse: [25, 1],
  reopen: [26, 1],
  runtime: [27, 1],
  cbRead: [30, 1],
  cbAllow: [31, 1],
  cbKept: [31, 3],
  cbModels: [32, 1],
  lit: [33, 1],
  mark: [36, 1],
};
const WRITTEN_ACTS: Record<Act, number> = { hook: 1, terminal: 3, handoff: 10, record: 12, permission: 15, desktop: 21, runtime: 27, close: 35 };

/** The cue id src/cues.ts gives a hit (dotDrop → hit-dot-drop): its rule, which cues.ts writes inline in its events and does not export. */
export const hitId = (k: Hit): string => `hit-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

export interface Arrangement {
  /** cue id → the sample its sound starts on */
  accents: Map<string, number>;
  /** what was placed on each hit, in time order */
  hits: { id: string; at: number; what: string }[];
  /** acts or hits that moved from where the music was written for them */
  warnings: string[];
}

export function arrange(T: Timeline, mx: Mixer, seed: number): Arrangement {
  const grid = T.grid;
  if (!grid) throw new Error('score: the cue sheet has no bar grid');
  const S = (bar: number, beat = 1): number => T.beat(bar, beat);
  /** a length of `b` beats, in samples and in seconds */
  const beats = (b: number): number => T.beats(b);
  const secs = (b: number): number => (b * 60) / grid.bpm;
  const H = (k: Hit): number => T.frame(HITS[k]);

  const warnings: string[] = [];
  const where = (s: number): string => {
    const p = T.position(s);
    return `bar ${p.bar} beat ${Number(p.beat.toFixed(3))}`;
  };
  for (const [k, [bar, beat]] of Object.entries(WRITTEN) as [Hit, readonly [number, number]][])
    if (H(k) !== S(bar, beat)) warnings.push(`hit '${k}' is at ${where(H(k))}; the music around it was written for bar ${bar} beat ${beat}`);
  for (const [a, bar] of Object.entries(WRITTEN_ACTS) as [Act, number][])
    if (T.frame(ACTS[a]) !== S(bar)) warnings.push(`act '${a}' starts at ${where(T.frame(ACTS[a]))}; the music was written for bar ${bar}`);

  // ── the harmony ────────────────────────────────────────────────────────────────────────────
  const segs = PLAN.map((p) => ({ ...p, from: S(p.bar, p.beat ?? 1) }));
  const segAt = (s: number) => {
    let cur = segs[0]!;
    for (const g of segs) if (g.from <= s) cur = g;
    return cur;
  };
  const rootAt = (s: number): number => segAt(s).root;
  const chordAt = (s: number): readonly number[] => {
    const c = segAt(s).chord;
    return c ? CH[c] : CH.dadd9;
  };

  // ── clips ─────────────────────────────────────────────────────────────────────────────────
  const memo = <C>(make: (key: string) => C): ((key: string) => C) => {
    const m = new Map<string, C>();
    return (key) => {
      let v = m.get(key);
      if (v === undefined) m.set(key, (v = make(key)));
      return v;
    };
  };
  const nums = (key: string): number[] => key.split(':').map(Number);
  const KICK = V.kick(seedOf(seed, 'kick'));
  const TICKS = [0, 1, 2, 3].map((k) => V.tick(seedOf(seed, 'tick', k)));
  const SHAKES = [0, 1, 2].map((k) => V.shaker(seedOf(seed, 'shaker', k)));
  const RIM = V.rim(seedOf(seed, 'rim'));
  const CLAP = V.clap(seedOf(seed, 'clap'));
  const subClip = memo((key) => {
    const [m, b, rel, attack] = nums(key);
    return V.sub(m!, secs(b!), rel, attack);
  });
  const bassClip = memo((key) => V.bass(nums(key)[0]!, 0.2));
  const glassClip = memo((key) => {
    const [m, len, bright, warm] = nums(key);
    return V.glass(m!, { seed: seedOf(seed, 'glass', m), len, bright, warm });
  });
  const epClip = memo((key) => {
    const [m, len, bright] = nums(key);
    return V.ep(m!, len!, bright);
  });
  const pluckClip = memo((key) => V.mutedPluck(nums(key)[0]!, seedOf(seed, 'pluck'), 0.5));

  // ── placing ───────────────────────────────────────────────────────────────────────────────
  /** the act's dynamics at a sample (the drums) */
  const dyn = (s: number): number => DYN[actAt(Math.floor((s * T.ctx.fps) / SR))];
  /** and the band's tone (pad, keys, bells, air), lifted step by step through the build */
  const tone = (s: number): number => {
    const k = BUILD_LIFT.findIndex((_, j) => s >= S(BUILD_BARS[j]!) && s < S(BUILD_BARS[j + 1]!));
    return dyn(s) + (k < 0 ? 0 : BUILD_LIFT[k]!);
  };
  const kickAt = (s: number, db = -9): void => mx.add(s, KICK, { bus: 'kick', part: 'kick', db: db + TRIM.kick + dyn(s) });
  const tickAt = (s: number, db: number, k: number, pan = 0.2): void => mx.add(s, TICKS[k & 3]!, { bus: 'drums', part: 'tick', db: db + TRIM.tick + dyn(s), pan });
  const shakeAt = (s: number, db: number, k: number): void => mx.add(s, SHAKES[k % 3]!, { bus: 'drums', part: 'shaker', db: db + TRIM.shaker + dyn(s), pan: -0.25 });
  const rimAt = (s: number, db = -21): void => mx.add(s, RIM, { bus: 'drums', part: 'rim', db: db + TRIM.rim + dyn(s), pan: -0.1, sends: { hall: 0.15 } });
  const clapAt = (s: number, db = -19): void => mx.add(s, CLAP, { bus: 'drums', part: 'clap', db: db + TRIM.clap + dyn(s), pan: 0.05, sends: { hall: 0.28 } });
  const subAt = (s: number, m: number, b: number, db = -12, rel = 0.22, attack = 0.012): void =>
    mx.add(s, subClip(`${m}:${b}:${rel}:${attack}`), { bus: 'bass', part: 'sub', db: db + TRIM.sub + dyn(s) });
  const bassAt = (s: number, m: number, db = -15): void => mx.add(s, bassClip(`${m}`), { bus: 'bass', part: 'bass', db: db + TRIM.bass + dyn(s) });
  interface BellOptions {
    len?: number;
    bright?: number;
    warm?: number;
    pan?: number;
    part?: string;
    echo?: number;
  }
  const bell = (s: number, m: number, db: number, o: BellOptions = {}): void =>
    mx.add(s, glassClip(`${m}:${o.len ?? 2.4}:${o.bright ?? 0.7}:${o.warm ?? 0}`), { bus: 'bell', part: o.part ?? 'bell', db: db + tone(s), pan: o.pan ?? 0, sends: { hall: 0.36, echo: o.echo ?? 0.18 } });
  /** the teal dot's motif from `s`, a sixteenth a note */
  const motif = (s: number, db = -14.5): void =>
    MOTIF.forEach((m, k) => bell(s + beats(0.25 * k), m, db - (k ? 1.5 : 0), { pan: [-0.2, 0.12, 0.28][k], part: 'motif', len: k === 2 ? 3.2 : 2.4 }));
  const epAt = (s: number, m: number, db: number, len = 2.6, bright = 0.5, pan = 0): void =>
    mx.add(s, epClip(`${m}:${len}:${bright}`), { bus: 'keys', part: 'piano', db: db + tone(s), pan, sends: { hall: 0.3, echo: 0.1 } });
  const pluckAt = (s: number, m: number, db: number, pan: number, part = 'pluck'): void =>
    mx.add(s, pluckClip(`${m}`), { bus: 'keys', part, db: db + TRIM.pluck + tone(s), pan, sends: { hall: 0.14, echo: 0.28 } });
  const fx = (s: number, clip: Float32Array | StereoClip, part: string, db: number, pan = 0, room = 0.22): void => mx.add(s, clip, { bus: 'fx', part, db, pan, sends: { room } });
  /** a swell of `b` beats that ends just before `s` (its clip leaves a 12 ms gap), on the air bus unless it is sound design */
  const swellTo = (s: number, b: number, db: number, o: V.SwellOptions, part = 'riser', bus: 'air' | 'fx' = 'air'): void => {
    const clip = V.swell(seedOf(seed, part, s), secs(b), o);
    const at = s - clip.l.length;
    mx.add(at, clip, { bus, part, db: db + (bus === 'air' ? tone(at) : 0), sends: bus === 'fx' ? { room: 0.2 } : { hall: 0.3 } });
  };
  const airAt = (s: number, clip: StereoClip | Float32Array, part: string, db: number): void => mx.add(s, clip, { bus: 'air', part, db: db + tone(s), sends: { hall: 0.3 } });

  /** grid steps of `step` beats in [from, to): the sample, the beat within the bar (0 ≤ beat < 4) and the step's index */
  const steps = (from: number, to: number, step: number): { s: number; beat: number; j: number }[] => {
    const out: { s: number; beat: number; j: number }[] = [];
    for (let j = Math.ceil((from - S(1)) / T.beatSamples / step - 1e-9); ; j++) {
      const ab = j * step;
      const s = S(1, 1 + ab);
      if (s >= to) return out;
      out.push({ s, beat: ab % grid.beatsPerBar, j });
    }
  };
  const isWhole = (beat: number): boolean => Math.abs(beat - Math.round(beat)) < 1e-9;

  interface Pulse {
    kickDb?: number;
    shakeDb?: number;
    /** which beats (0-3) carry the kick (default all) */
    kickOn?: (beat: number) => boolean;
    rimFrom?: number;
    clapFrom?: number;
    /** sixteenth ticks from here */
    ticksFrom?: number;
  }
  /** beats where a hit takes the kick's place (the quit's click, the receipt's printer, the stamps) */
  const KICKLESS = new Set((['quit', 'receipt', 'cbRead', 'cbAllow', 'cbKept', 'cbModels'] as const).map(H));
  /** the kick's level (dB) on the beats where a hit sets it, over the pulse's own (the hand-off's accent, the light's) */
  const KICK_LEVEL_AT = new Map([
    [H('handoff'), -7],
    [H('lit'), -11],
  ]);
  /** beats where a hit takes the arpeggio's pluck's place (the receipt's printer, which the pluck masked) */
  const PLUCKLESS = new Set((['receipt'] as const).map(H));
  /**
   * What a tick, the rim or the clap gets when it sounds with a kick (dB). The kit and the kick
   * shared one soft clip once, which took about this much off them on those beats (3.3 to 3.9 dB
   * above 2 kHz, and with it the kick's ripple); on their own clean bus they keep the balance by
   * level, and the master's limiter is not asked for more.
   */
  const WITH_KICK_DB = -3;
  /** the straight pulse: a kick a beat, a shaker on the offbeats, a rim or a clap on 2 and 4 */
  const pulse = (from: number, to: number, o: Pulse = {}): void => {
    for (const { s, beat, j } of steps(from, to, 0.25)) {
      const whole = isWhole(beat);
      const half = isWhole(beat * 2);
      const kicked = whole && (o.kickOn ? o.kickOn(beat) : true) && !KICKLESS.has(s);
      if (kicked) kickAt(s, KICK_LEVEL_AT.get(s) ?? o.kickDb ?? -10);
      const under = kicked ? WITH_KICK_DB : 0;
      if (half && !whole) shakeAt(s, o.shakeDb ?? -26, j);
      if (whole && (beat === 1 || beat === 3) && s >= (o.rimFrom ?? Infinity)) rimAt(s, -21 + under);
      if (whole && (beat === 1 || beat === 3) && s >= (o.clapFrom ?? Infinity)) clapAt(s, -19 + under);
      if (s >= (o.ticksFrom ?? Infinity)) tickAt(s, (whole ? -31 : half ? -34 : -36) + under, j, 0.25);
    }
  };
  /** the offbeat bass: a short note on every "and", on the chord's root */
  const offbeats = (from: number, to: number, db = -15): void => {
    for (const { s, beat } of steps(from, to, 0.5)) if (!isWhole(beat)) bassAt(s, rootAt(s), db);
  };
  /**
   * Downbeats whose hit brings its own low sound (the runtime's boom, the first stamp's D3): the
   * sub leaves it the first beat (the note before ends half a beat early, the next starts on beat
   * 2), so the two do not beat against each other, a ripple QA's 5 ms onset blocks read as rises
   * after the hit's own.
   */
  const SUB_RESTS = new Set((['runtime', 'cbRead'] as const).map(H));
  /** downbeats where the sub's note rises in 50 ms, not 12: the desktop's soft clicks, whose first blocks its rise against the kick outgrew */
  const SUB_SLOW = new Set((['desktop'] as const).map(H));
  /** the sub: a note on every downbeat and chord change in [from, to), held to the next */
  const subs = (from: number, to: number, db = -12.5): void => {
    const at = steps(from, to, 0.5)
      .filter(({ s, beat }, k) => k === 0 || beat === 0 || segs.some((g) => g.from === s))
      .map(({ s }) => s);
    at.forEach((s, k) => {
      const next = at[k + 1] ?? to;
      const start = SUB_RESTS.has(s) ? s + beats(1) : s;
      const end = next - beats(SUB_RESTS.has(next) ? 0.5 : 0.15);
      if (end > start) subAt(start, rootAt(s), (end - start) / T.beatSamples, db, 0.22, SUB_SLOW.has(s) ? 0.05 : 0.012);
    });
  };
  const ORDER = [0, 2, 1, 3, 2, 1, 3, 0];
  /** plucks through the chord's upper notes, an octave up, every `step` beats; the downbeat is left to the kick */
  const arp = (from: number, to: number, step: number, db: number): void => {
    for (const { s, beat, j } of steps(from, to, step)) {
      if (beat === 0 || PLUCKLESS.has(s)) continue;
      const tones = chordAt(s)
        .slice(1)
        .map((m) => m + 12);
      pluckAt(s, tones[ORDER[j % 8]! % tones.length]!, db - (isWhole(beat) ? 0 : 1.5), j % 2 ? 0.35 : -0.35, 'arp');
    }
  };

  const accents = new Map<string, number>();
  const hits: Arrangement['hits'] = [];
  /** a sound that must land on a hit: its cue's sample, by name */
  const hit = (k: Hit, what: string, play: (s: number) => void): void => {
    const id = hitId(k);
    const s = T.cue(id);
    if (s !== H(k)) throw new Error(`score: cue '${id}' is at sample ${s}, HITS.${k} at ${H(k)}`);
    accents.set(id, s);
    hits.push({ id, at: s, what });
    play(s);
  };

  // ── the pads ──────────────────────────────────────────────────────────────────────────────
  segs.forEach((g, k) => {
    if (!g.chord) return;
    const to = g.until ? S(g.until[0], g.until[1]) : (segs[k + 1]?.from ?? T.n);
    const clip = V.pad(CH[g.chord], (to - g.from) / SR, { seed: seedOf(seed, 'pad', g.from), attack: g.attack, release: g.release, bright: g.bright, drift: g.drift });
    mx.add(g.from, clip, { bus: 'pad', part: g.drift ? 'pad, uneasy' : 'pad', db: (g.db ?? -21) + TRIM.pad + tone(g.from), sends: { hall: 0.3 } });
  });

  // ── Hook (bars 1-2): the poster; the caret waits; the teal dot drops ────────────────────────
  // a soft low fifth under the poster from frame 0, and the caret's wait as faint ticks, growing
  epAt(S(1), 50, -24, 4.5, 0.3, -0.15);
  epAt(S(1), 57, -26, 4.5, 0.3, 0.15);
  for (let k = 1; k <= 5; k++) tickAt(S(1, 1 + k), -37 + k, k, 0.1);
  swellTo(H('dotDrop'), 1.5, -27, { f0: 500, f1: 6000, curve: 3.5 });
  hit('dotDrop', 'the motif (glass E6 A5 F#5), a soft D sub under it', (s) => {
    motif(s, -15.5);
    subAt(s, ROOT.D, 2, -15);
  });

  // ── Terminal (bars 3-9): half-time; the refusal stops the music for a beat ─────────────────
  const dropFrom = H('refused');
  const dropTo = H('refused') + beats(1);
  const dropped = (s: number): boolean => s >= dropFrom && s < dropTo;
  {
    // the downbeat's tick sounds with the kick: it sits under it (WITH_KICK_DB)
    const VEL = [-27 + WITH_KICK_DB, -34, -31, -34, -28, -34, -31, -33];
    for (const { s, beat, j } of steps(S(3), S(10), 0.5)) {
      if (dropped(s)) continue;
      const k = j % 8;
      const bar = T.position(s).bar;
      if (beat === 0) kickAt(s, -9);
      if (beat === 1.5 && bar % 2 === 0) kickAt(s, -17);
      if (beat === 2) rimAt(s, -21);
      tickAt(s, VEL[k]!, j, 0.18);
    }
    // the music comes back on the next beat, with the title
    kickAt(dropTo, -13);
    subs(S(3), dropFrom, -12.5);
    subs(dropTo, S(10), -12.5);
    // a soft piano comp on the chord's changes (an airy fourth or fifth an octave up), not on the pass
    for (const s of [S(3), S(4), dropTo, S(6), S(7), S(7, 3), S(9)]) {
      const c = chordAt(s);
      epAt(s, c[2]! + 12, -25, 1.6, 0.4, -0.2);
      epAt(s, c[4]! + 12, -26, 1.6, 0.4, 0.2);
    }
    // a sparse figure on the upper notes, where nothing else speaks
    for (const bar of [3, 4, 6, 7]) {
      for (const [beat, idx] of [
        [2.5, 3],
        [4, 2],
      ] as const) {
        const s = S(bar, beat);
        pluckAt(s, chordAt(s)[idx]! + 12, -25, beat === 4 ? 0.3 : -0.3);
      }
    }
  }
  hit('enter', 'the Enter key (click, body, return); the kick and a D sub start the half-time', (s) => fx(s, V.keyPress(seedOf(seed, 'key')), 'key', -14, 0.05));
  hit('refused', 'the low "denied" (A2 against B-flat 2, sagging, over a thump); every music bus and its reverb stop for one beat', (s) =>
    fx(s, V.denied(seedOf(seed, 'denied')), 'denied', -10, 0, 0.3),
  );
  hit('read', 'a small tick at 2.6 kHz, on the bar kick', (s) => fx(s, V.uiTick(2600, seedOf(seed, 'read')), 'ui tick', -15, -0.1));
  hit('edited', 'two small ticks (3.1 then 3.5 kHz, 45 ms apart), on the rim', (s) => {
    fx(s, V.uiTick(3100, seedOf(seed, 'edit', 0)), 'ui tick', -15, 0.1);
    fx(s + T.s(0.045), V.uiTick(3500, seedOf(seed, 'edit', 1)), 'ui tick', -19, 0.15);
  });
  hit('pass', 'a warm resolving chord: piano D4 F#4 A4 D5 over a brighter Dadd9 pad and the D sub, a soft glass A5, a small contact on the frame', (s) => {
    for (const [k, m] of [62, 66, 69, 74].entries()) epAt(s, m, -20, 3, 0.45, (k - 1.5) * 0.25);
    // a small contact on the frame: the chord's first 5 ms, and the music steps back under it
    fx(s, V.uiTick(3000, seedOf(seed, 'pass')), 'ui tick', -19);
    bell(s, 81, -22, { len: 2.2, pan: 0.2, part: 'bell' });
  });
  hit('table', 'a soft slide (noise moving left to right, rising a little), on the bar kick', (s) => fx(s, V.slide(seedOf(seed, 'slide')), 'slide', -13));
  // the hand-off's whoosh is the transition: no riser under it

  // ── Hand-off, the record and the permission (bars 10-16): a straight, restrained pulse ──────
  const sandbox = H('sandbox');
  pulse(S(10), sandbox, { rimFrom: S(12) });
  offbeats(S(10), sandbox);
  subs(S(10), sandbox);
  arp(S(12), sandbox, 0.5, -25);
  hit('handoff', 'a tight whoosh (left to right, breaking off just before its peak and a bright contact on the frame); the pulse starts under it with an accented kick', (s) =>
    fx(s - T.s(0.28), V.whoosh(seedOf(seed, 'whoosh'), 0.28, 0.32, -0.6, 0.6), 'whoosh', -15),
  );
  hit('receipt', 'the receipt printing (a heavy first strike, six print-head ticks, a rasp of paper) in place of the kick and the pluck', (s) => fx(s, V.printer(seedOf(seed, 'printer')), 'printer', -12.5, 0.2));

  // ── the sandbox and the amber card (bars 16-19): the pulse stops; a clock; a question ──────
  hit('sandbox', 'the bolt (a muted low knock); the kick stops; the pad swells into G minor 6/9, drifting', (s) => fx(s, V.bolt(seedOf(seed, 'bolt')), 'bolt', -16));
  const allow = H('allow');
  for (const { s, beat, j } of steps(sandbox, allow, 0.5)) tickAt(s, isWhole(beat) ? -31 : -35, j, j % 2 ? 0.3 : -0.3);
  subs(sandbox, allow, -14);
  kickAt(S(17), -13);
  kickAt(S(18), -14);
  kickAt(S(18, 3), -16);
  hit('approval', 'the amber card: a warm glass bell rising E5 to A5 (an eighth apart), a heartbeat kick', (s) => {
    bell(s, 76, -13, { warm: 0.8, bright: 0.35, len: 2.6, pan: -0.15, part: 'amber' });
    bell(s + beats(0.5), 81, -13.5, { warm: 0.8, bright: 0.35, len: 3, pan: 0.15, part: 'amber' });
  });
  hit('allow', 'Allow once: a crisp click, the resolving bells D5 and F#5, Dadd9 and a D sub; all of it gone before the rest', (s) => {
    fx(s, V.click(seedOf(seed, 'allow')), 'click', -13);
    bell(s, 74, -15, { warm: 0.5, len: 2, pan: -0.1, part: 'resolve', echo: 0.1 });
    bell(s, 78, -16.5, { warm: 0.5, len: 2, pan: 0.1, part: 'resolve', echo: 0.1 });
    kickAt(s, -16);
    subAt(s, ROOT.D, 2, -13, 0.4);
  });
  // the rest (bar 20, beats 1-2) holds nothing; then a breath in towards the desktop
  swellTo(S(21), 2, -24, { f0: 300, f1: 5000, curve: 3 });

  // ── Desktop (bars 21-26): the pulse, brighter; the quit is heard through a wall ─────────────
  const collapse = H('collapse');
  const reopen = H('reopen');
  pulse(S(21), collapse, { rimFrom: S(21) });
  offbeats(S(21), collapse);
  subs(S(21), collapse);
  arp(S(21), collapse, 0.5, -25);
  hit('desktop', 'two soft UI clicks (a double click, 150 ms apart) on the bar kick', (s) => {
    fx(s, V.click(seedOf(seed, 'desktop', 0), true), 'click, soft', -13, 0.1);
    fx(s + T.s(0.15), V.click(seedOf(seed, 'desktop', 1), true), 'click, soft', -16, 0.1);
  });
  hit('quit', 'a soft click in place of the bar kick (the beat stumbles); the music closes behind a low-pass (16 kHz to 700 Hz in 0.6 s)', (s) => fx(s, V.click(seedOf(seed, 'quit'), true), 'click, soft', -11, -0.1));
  hit('collapse', 'a short reverse swoosh into a single pip (A6); the drums stop, the muffled pad and sub stay', (s) => {
    swellTo(s, 0.9, -18, { f0: 300, f1: 7000, curve: 6, pan0: 0.5, pan1: 0 }, 'swoosh', 'fx');
    fx(s, V.pip(93), 'pip', -10);
  });
  subs(collapse, reopen, -14);
  hit('reopen', 'the motif returns (glass E6 A5 F#5) as the low-pass opens in half a second and the pulse comes back', (s) => motif(s));
  pulse(reopen, S(27), { rimFrom: reopen });
  offbeats(reopen, S(27));
  subs(reopen, S(27));
  arp(reopen, S(27), 0.5, -25);
  swellTo(S(27), 2, -22, { f0: 300, f1: 6000, curve: 3 });

  // ── One runtime (bars 27-34): a build; the callbacks stamp, closer and closer; it lights ────
  hit('runtime', 'a deep boom (driven near square while it is loud, its first 5 ms over its body) and air; the build starts on Bm11 (kick on 1 and 3, the sub from beat 2)', (s) => {
    fx(s, V.boom(seedOf(seed, 'boom'), { drive: 3, bodyDb: -3 }), 'boom', -12, 0, 0.3);
    airAt(s, V.shimmer(seedOf(seed, 'shimmer', 0), 2.2), 'shimmer', -23);
  });
  pulse(S(27), S(29), { kickOn: (b) => b === 0 || b === 2, kickDb: -10, shakeDb: -27 });
  subs(S(27), S(29));
  arp(S(28), S(29), 0.5, -27);
  pulse(S(29), S(31), { rimFrom: S(29), kickDb: -9.5, shakeDb: -25 });
  offbeats(S(29), S(31), -14.5);
  subs(S(29), S(31));
  arp(S(29), S(31), 0.5, -24.5);
  // the last beat before the light is a breath: drums, bass and plucks stop, the riser carries
  const breath = S(32, 4);
  pulse(S(31), breath, { clapFrom: S(31), ticksFrom: S(31), kickDb: -9, shakeDb: -25 });
  // the bass stays under the light's (bar 33), which it leads to
  offbeats(S(31), breath, -15);
  subs(S(31), breath);
  arp(S(31), breath, 0.25, -25.5);
  // levelled by loudness (voices.ts, stamp), so they sound alike: they come closer in time, and
  // they stay under the light they lead to. The first sits half a dB up and has its beat to itself
  // (the G2 sub starts on beat 2: SUB_RESTS), A3 a dB down (its crest is 2 dB over the others')
  const STAMPS: readonly [Hit, number, number, number][] = [
    ['cbRead', 50, -11, -0.25],
    ['cbAllow', 54, -11.5, -0.08],
    ['cbKept', 57, -12.5, 0.08],
    ['cbModels', 64, -11.5, 0.25],
  ];
  const NAMES = ['D3', 'F#3', 'A3', 'E4'];
  STAMPS.forEach(([k, m, db, pan], i) => hit(k, `a stamp on ${NAMES[i]} (a sharp strike, then a tuned body, a thwack, a slap of paper), in place of the kick${i === 0 ? ' and the sub' : ''}`, (s) => fx(s, V.stamp(m, seedOf(seed, 'stamp', i)), 'stamp', db, pan)));
  swellTo(H('lit'), 4, -19, { f0: 250, f1: 7000, curve: 3 });
  hit('lit', 'the peak: the whole chord (Dmaj9 pad, piano D4 F#4 A4 C#5 E5 rolled over 28 ms), glass F#5 A5 D6 E6 (rolled over 27 ms), air, a low boom and the kick', (s) => {
    // rolled by a few milliseconds, low to high: one strike to the ear, but the peaks do not stack
    // the strike stays where it was written (the light's lift is in its bloom: the strike's peaks are the limiter's)
    for (const [k, m] of [62, 66, 69, 73, 76].entries()) epAt(s + T.s(0.007 * k), m, -25, 3.5, 0.6, (k - 2) * 0.22);
    for (const [k, m] of [78, 81, 86, 88].entries()) bell(s + T.s(0.009 * k), m, -23, { len: 3.4, pan: (k - 1.5) * 0.3, part: 'bell' });
    airAt(s, V.shimmer(seedOf(seed, 'shimmer', 1), 2.6), 'shimmer', -21);
    // the boom is weight, not loudness: it stays where it was, under the lift
    airAt(s, V.boom(seedOf(seed, 'boom-lit')), 'boom', -22.5);
  });
  pulse(S(33), S(34, 3), { clapFrom: S(33), ticksFrom: S(33), kickDb: -9, shakeDb: -25 });
  pulse(S(34, 3), S(35), { kickOn: (b) => b === 2, kickDb: -11, shakeDb: -27 });
  offbeats(S(33), S(35), -14.5);
  subs(S(33), S(35));
  arp(S(33), S(35), 0.25, -25);

  // ── Close (bars 35-42): resolve; the dot comes to rest in the mark; a long tail; quiet ──────
  kickAt(S(35), -13);
  subs(S(35), H('mark'), -13);
  hit('mark', 'the motif (glass E6 A5 F#5) coming to rest on D5 a half bar later; Dadd9, the D sub, a breath of air', (s) => {
    motif(s);
    bell(s + beats(2), 74, -18, { len: 4, part: 'motif' });
    airAt(s, V.shimmer(seedOf(seed, 'shimmer', 2), 2.4), 'shimmer', -27);
  });
  kickAt(S(36), -12);
  kickAt(S(37), -14);
  kickAt(S(38), -15);
  for (const { s, beat, j } of steps(S(36), S(39), 0.5)) tickAt(s, (isWhole(beat) ? -33 : -36) - (T.position(s).bar - 36), j, 0.15);
  subs(S(36), S(40), -13);
  // the end card's lines arrive: one soft glass note each, falling
  bell(S(37), 81, -23, { len: 3, pan: 0.2 });
  bell(S(38), 78, -24, { len: 3, pan: -0.15 });
  bell(S(39), 76, -24, { len: 3.5, pan: 0.1 });
  // the last chord, held while the card is read; the master fades it out by the rest
  bell(S(40), 74, -21, { len: 5, pan: -0.1 });
  bell(S(40), 69, -24, { len: 5, pan: 0.1 });
  epAt(S(40), 50, -24, 5, 0.25, -0.1);
  epAt(S(40), 57, -26, 5, 0.25, 0.1);
  subAt(S(40), ROOT.D, 3, -14, 1.5);

  hits.sort((a, b) => a.at - b.at);
  return { accents, hits, warnings };
}

/**
 * The quit, heard through a wall: from HITS.quit the music's low-pass (two state-variable
 * filters, 24 dB an octave) closes from 16 kHz to 700 Hz in 0.6 s and on to 480 Hz; at
 * HITS.collapse to 300 Hz and 4 dB down; from HITS.reopen it opens again in half a second.
 * Applied in place to a bus before the mixdown, or to a send's return after it.
 */
export function muffler(T: Timeline): (clip: StereoClip) => StereoClip {
  const q = T.cue(hitId('quit'));
  const c = T.cue(hitId('collapse'));
  const o = T.cue(hitId('reopen'));
  const end = o + T.s(0.5);
  const OPEN = Math.log2(16000);
  const lf = curve([
    [q, OPEN],
    [q + T.s(0.6), Math.log2(700)],
    [c, Math.log2(480)],
    [c + T.s(0.25), Math.log2(300)],
    [o, Math.log2(300)],
    [end, OPEN],
  ]);
  const gain = curve([
    [q, 0],
    [q + T.s(0.6), -1.5],
    [c, -1.5],
    [c + T.s(0.25), -4],
    [o, -4],
    [end, 0],
  ]);
  // 20 ms crossfades in and out, where the filter is open
  const X = T.s(0.02);
  return (clip) => {
    const from = Math.max(0, q - X);
    const to = Math.min(clip.l.length, end + X);
    for (const ch of [clip.l, clip.r]) {
      const a = new Svf();
      const b = new Svf();
      for (let i = from; i < to; i++) {
        if (((i - from) & 15) === 0) {
          const f = 2 ** lf(i);
          a.set(f, Math.SQRT1_2);
          b.set(f, Math.SQRT1_2);
        }
        a.tick(ch[i]);
        b.tick(a.lp);
        const w = i < q ? (i - from) / X : i >= end ? (to - i) / X : 1;
        ch[i] = ch[i] * (1 - w) + b.lp * dbToGain(gain(i)) * w;
      }
    }
    return clip;
  };
}
