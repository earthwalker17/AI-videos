/**
 * The arrangement: what sounds when, on the cue sheet's grid (120 bpm, 80 bars of four beats).
 *
 * The music carries the picture's own ideas:
 * - The stack is a chord with one pitch per level: D (events), A (the Workers), C (the Router),
 *   E (you). Those four notes, bottom to top, are also the film's motif.
 * - The bass sits on the note of the level the camera is on, and the pad on that level's chord
 *   (Dm9, Am11, Cmaj9, Em11: all white keys, so every move between levels is a soft one).
 * - Each counted verdict plays as many notes of the motif as its number. The motif is whole only
 *   at the fourth verdict, and it resolves (to the D above) only at the sign-off.
 * - Plain code is a dry tick; a model call is a swell of the pad.
 * - Evidence runs half-time. What is proposed plays dashed, what is open leaves gaps.
 *
 * Positions are (bar, beat) as in src/cues.ts; `A(bar, beat)` is beats from the film's start. The
 * few positions that follow the picture rather than a cue are named constants with the scene they
 * come from.
 */
import { seedOf, uni, type Mixer, type StereoClip, type Timeline } from '@aiv/pipeline/audio/kit';
import { bass, bell, clap, hat, kick, pad, riser, string, thud, tick } from './voices.ts';

/** beats from bar 1 beat 1 */
const A = (bar: number, beat = 1): number => (bar - 1) * 4 + (beat - 1);

/** the motif: the stack from the bottom up (D4 A4 C5 E5), and where it comes to rest (D5) */
export const MOTIF = [62, 69, 72, 76] as const;
const REST = 74;

const CHORD = {
  dm9: [50, 57, 60, 64, 65],
  am11: [45, 55, 60, 62, 64],
  cmaj9: [48, 55, 59, 62, 64],
  em11: [52, 55, 57, 59, 62],
  /** the four levels alone: D3 A3 C4 E4 */
  stack: [50, 57, 60, 64],
  /** the question: open, with no third */
  open: [38, 45, 52, 57, 62, 67],
} as const;
/** bass notes of the four levels: D2, A1, C2, E2 */
const ROOT = { events: 38, workers: 33, router: 36, you: 40 } as const;

// ── positions taken from the picture (scene constants), not from a cue ──────────────────────────
/** scenes/levels.ts REQUEST: the whole task leaves the Router and lands in its Worker */
const TASK_DROP = A(16, 3);
const TASK_LANDED = A(17, 3);
/** scenes/flat.ts FREEZE: you stop moving */
const FREEZE = A(7, 4);
/** scenes/batch.ts: the waiting arrivals enter together */
const ENTER = A(43, 1);

/** The balance: what each family gets on top of the level written at its call (dB). Set from the mixer's report. */
const TRIM = { kick: -1, thud: -3, hat: 4, clap: 4, bass: 5, pad: 5, swell: 4, string: 3, arp: 4, tick: 4 } as const;

export function arrange(T: Timeline, mx: Mixer, seed: number): Map<string, number> {
  const bpm = T.grid?.bpm ?? 120;
  const at = (abs: number): number => T.beat(1, 1 + abs);
  const secs = (beats: number): number => (beats * 60) / bpm;
  const accents = new Map<string, number>();

  const K = kick();
  const TH = thud(seedOf(seed, 'thud'));
  const CL = clap(seedOf(seed, 'clap'));
  const HATS = [0, 1, 2, 3].map((k) => hat(seedOf(seed, 'hat', k)));
  const memo = <T2>(make: (key: string) => T2): ((key: string) => T2) => {
    const m = new Map<string, T2>();
    return (key) => m.get(key) ?? (m.set(key, make(key)), m.get(key)!);
  };
  const bassClip = memo((k) => {
    const [m, beats] = k.split(':').map(Number) as [number, number];
    return bass(m, secs(beats));
  });
  const stringClip = memo((k) => {
    const [m, len, bright] = k.split(':').map(Number) as [number, number, number];
    return string(m, len, seedOf(seed, 'string'), bright);
  });
  const bellClip = memo((k) => {
    const [m, len] = k.split(':').map(Number) as [number, number];
    return bell(m, len, len * 0.3);
  });

  // ── the parts ───────────────────────────────────────────────────────────────────────────────
  const kickAt = (abs: number, db = -6): void => mx.add(at(abs), K, { bus: 'drums', part: 'kick', db: db + TRIM.kick });
  const thudAt = (abs: number, db = -5): void => mx.add(at(abs), TH, { bus: 'fx', part: 'thud', db: db + TRIM.thud, sends: { hall: 0.12 } });
  const ring = (abs: number, m: number, db = -13, len = 1.8, pan = 0): void =>
    mx.add(at(abs), bellClip(`${m}:${len}`), { bus: 'lead', part: 'bell', db, pan, sends: { hall: 0.4, echo: 0.22 } });
  const strum = (abs: number, m: number, db: number, o: { len?: number; bright?: number; pan?: number; echo?: number; part?: string } = {}): void =>
    mx.add(at(abs), stringClip(`${m}:${o.len ?? 0.7}:${o.bright ?? 0.55}`), { bus: 'lead', part: o.part ?? 'string', db: db + TRIM.string, pan: o.pan ?? 0, sends: { hall: 0.22, echo: o.echo ?? 0.25 } });
  /** a riser that ends on `abs` */
  const rise = (abs: number, beats: number, db = -22): void => {
    const clip = riser(secs(beats), seedOf(seed, 'riser', Math.round(abs * 4)));
    mx.add(at(abs) - clip.l.length, clip, { bus: 'fx', part: 'riser', db, sends: { hall: 0.3 } });
  };

  interface DrumOptions {
    /** claps on 2 and 4 from this position on */
    clapFrom?: number;
    /** half-time: the kick on 1, the clap on 3 */
    half?: boolean;
    hatDb?: number;
  }
  /** kick, hats and clap from `from` up to, not including, `to` */
  const drums = (from: number, to: number, o: DrumOptions = {}): void => {
    for (let e = Math.ceil(from * 2); e < to * 2; e++) {
      const abs = e / 2;
      const beat = abs % 4;
      const whole = Number.isInteger(beat);
      if (o.half) {
        if (beat === 0) kickAt(abs);
        if (beat === 2) mx.add(at(abs), CL, { bus: 'drums', part: 'clap', db: -15 + TRIM.clap, sends: { hall: 0.4 } });
        if (whole) mx.add(at(abs), HATS[e % 4]!, { bus: 'drums', part: 'hat', db: (o.hatDb ?? -25) + TRIM.hat, pan: 0.25 });
        continue;
      }
      if (whole) kickAt(abs);
      else mx.add(at(abs), HATS[e % 4]!, { bus: 'drums', part: 'hat', db: (o.hatDb ?? -21) + TRIM.hat, pan: 0.22 });
      if ((beat === 1 || beat === 3) && abs >= (o.clapFrom ?? Infinity)) mx.add(at(abs), CL, { bus: 'drums', part: 'clap', db: -16 + TRIM.clap, sends: { hall: 0.3 } });
    }
  };

  /** eighth notes on the level's note, with the octave on the "and" of 2 and of 4; `long` holds one note a bar */
  const bassLine = (from: number, to: number, root: number, long = false): void => {
    if (long) {
      for (let b = from; b < to; b += 4) mx.add(at(b), bassClip(`${root}:${Math.min(3.7, to - b)}`), { bus: 'bass', part: 'bass', db: -12 + TRIM.bass });
      return;
    }
    for (let e = Math.ceil(from * 2); e < to * 2; e++) {
      const k = e % 8;
      mx.add(at(e / 2), bassClip(`${root + (k === 3 || k === 7 ? 12 : 0)}:0.42`), { bus: 'bass', part: 'bass', db: (k % 2 === 0 ? -11 : -14) + TRIM.bass });
    }
  };

  interface PadSpan {
    db?: number;
    bright?: number;
    attack?: number;
    release?: number;
  }
  /** the pad holding a chord, struck again every two bars */
  const padSpan = (from: number, to: number, chord: readonly number[], o: PadSpan = {}): void => {
    for (let b = from; b < to; b += 8) {
      const clip: StereoClip = pad(chord, secs(Math.min(8, to - b)), { seed: seedOf(seed, 'pad', Math.round(b * 4)), attack: o.attack, release: o.release, bright: o.bright });
      mx.add(at(b), clip, { bus: 'pad', part: 'pad', db: (o.db ?? -17) + TRIM.pad, sends: { hall: 0.25 } });
    }
  };
  /** a swell of the pad that peaks on `abs`: a model call */
  const swell = (abs: number, chord: readonly number[], beats = 1.5, db = -17): void => {
    const clip = pad(chord, secs(beats), { seed: seedOf(seed, 'swell', Math.round(abs * 4)), attack: secs(beats) * 0.96, release: 0.5, bright: 0.85 });
    mx.add(at(abs - beats), clip, { bus: 'pad', part: 'swell', db: db + TRIM.swell, sends: { hall: 0.35 } });
  };

  /** eighth-note plucks through a chord's upper notes; the downbeat is left to the kick */
  const arp = (from: number, to: number, chord: readonly number[], o: { db?: number; echo?: number } = {}): void => {
    const tones = chord.slice(1).map((m) => m + 12);
    const order = [0, 2, 1, 3, 2, 0, 3, 1];
    for (let e = Math.ceil(from * 2); e < to * 2; e++) {
      if (e % 8 === 0) continue;
      const m = tones[order[e % 8]! % tones.length]!;
      strum(e / 2, m, (o.db ?? -20) + TRIM.arp - (e % 2 ? 2 : 0), { pan: e % 2 ? 0.4 : -0.4, echo: o.echo ?? 0.3, part: 'arp' });
    }
  };

  /** the first `n` notes of the motif, a sixteenth apart, from `abs` */
  const motif = (abs: number, n: number, db = -10): void => {
    for (let k = 0; k < n; k++) ring(abs + k * 0.25, MOTIF[k]!, db - (k === 0 ? 0 : 1.5), 2.2, (k - 1.5) * 0.2);
  };

  /** a sound that must land on a `hit` cue: the cue's frame and the grid position have to agree */
  const hit = (id: string, abs: number, play: () => void): void => {
    if (T.cue(id) !== at(abs)) throw new Error(`score: hit '${id}' is at sample ${T.cue(id)}, the arrangement puts it at ${at(abs)}`);
    accents.set(id, at(abs));
    play();
  };

  /** a counted verdict: weight, a stab of the level's chord, and `n` notes of the motif */
  const verdict = (id: string, abs: number, n: number, chord: readonly number[]): void =>
    hit(id, abs, () => {
      thudAt(abs);
      mx.add(at(abs), pad(chord, secs(2.5), { seed: seedOf(seed, 'stab', n), attack: 0.01, release: 1.6, bright: 0.7 }), { bus: 'pad', part: 'stab', db: -15 + TRIM.pad, sends: { hall: 0.35 } });
      motif(abs, n);
    });

  // ── 1. Flat (bars 1-8): one floor, one note. Your hops speed up until you cannot keep up ─────
  padSpan(A(1), FREEZE, CHORD.am11, { db: -22, bright: 0.25, attack: 1.2, release: 0.4 });
  hit('hit.q', A(1, 2), () => {
    thudAt(A(1, 2), -9);
    ring(A(1, 2), 69, -12, 2.4);
    ring(A(1, 2), 76, -16, 2.4);
  });
  for (let b = A(1, 4); b < A(3); b += 1) strum(b, 57, -15, { part: 'hops' });
  for (let b = A(3); b < A(5); b += 0.5) strum(b, (b * 2) % 2 ? 64 : 57, -15, { pan: (b * 2) % 2 ? 0.3 : -0.3, part: 'hops' });
  for (let b = A(5); b < A(7); b += 0.25) strum(b, [57, 64, 69, 64][(b * 4) % 4]!, -16.5, { pan: ((b * 4) % 4) * 0.2 - 0.3, len: 0.5, part: 'hops' });
  for (let b = A(7); b < FREEZE; b += 0.25) strum(b, [57, 64, 69, 72][(b * 4) % 4]!, -16 + 3 * ((b - A(7)) / 3), { pan: ((b * 4) % 4) * 0.2 - 0.3, len: 0.4, bright: 0.7, part: 'hops' });
  rise(FREEZE, 6, -24);
  // the stall: nothing moves for a beat, then the answer
  hit('hit.youdo', A(8, 1), () => {
    thudAt(A(8, 1));
    ring(A(8, 1), 64, -11, 2.6);
    ring(A(8, 1), 52, -15, 2.6);
  });
  rise(A(9), 2.5, -18);

  // ── 2. The lift (bars 9-12): the stack is built from the bottom, one note a beat ────────────
  hit('hit.drop', A(9, 1), () => {
    kickAt(A(9, 1), -6);
    thudAt(A(9, 1), -7);
    mx.add(at(A(9, 1)), bassClip(`${ROOT.events}:3.6`), { bus: 'bass', part: 'bass', db: -9 + TRIM.bass });
  });
  for (let k = 0; k < 4; k++) ring(A(9, 1 + k), MOTIF[k]!, -11, 2.4, (k - 1.5) * 0.25);
  hit('hit.title', A(10, 1), () => {
    kickAt(A(10, 1), -5);
    for (const [k, m] of MOTIF.entries()) ring(A(10, 1), m, -14, 3, (k - 1.5) * 0.3);
  });
  padSpan(A(10), A(13), CHORD.stack, { db: -15, bright: 0.5, attack: 0.05, release: 1.0 });
  bassLine(A(10), A(13), ROOT.events, true);
  for (let b = A(11); b < A(13); b += 4) kickAt(b, -8);
  for (let e = A(11) * 2; e < A(13) * 2; e++) mx.add(at(e / 2), HATS[e % 4]!, { bus: 'drums', part: 'hat', db: -27 + TRIM.hat + 3 * ((e / 2 - A(11)) / 8), pan: 0.22 });
  rise(A(13), 2, -21);

  // ── 3. Two levels (bars 13-24): the Router's note, then the Worker's ────────────────────────
  drums(A(13), A(24, 3), { clapFrom: A(17) });
  bassLine(A(13), A(20), ROOT.router);
  bassLine(A(20), A(24, 3), ROOT.workers);
  padSpan(A(13), A(20), CHORD.cmaj9);
  padSpan(A(20), A(24, 3), CHORD.am11, { release: 0.8 });
  arp(A(14), A(20), CHORD.cmaj9);
  arp(A(21), A(24, 3), CHORD.am11);
  // the whole task goes down: the Router's note, then the Worker's
  ring(TASK_DROP, 72, -12, 1.4, 0.2);
  ring(TASK_LANDED, 69, -12, 1.8, -0.2);
  kickAt(A(24, 4), -9);
  kickAt(A(24, 4.5), -7);
  rise(A(25), 3, -19);

  // ── 4. One Router for all this? (bars 25-26): the beat stops; a question that does not close ─
  hit('hit.spine', A(25, 1), () => {
    thudAt(A(25, 1), -4);
    mx.add(at(A(25, 1)), pad(CHORD.open, secs(7), { seed: seedOf(seed, 'question'), attack: 0.02, release: 1.4, bright: 0.6 }), { bus: 'pad', part: 'stab', db: -14 + TRIM.pad, sends: { hall: 0.4 } });
  });
  ring(A(25, 3), 76, -14, 1.6, -0.2);
  ring(A(25, 4), 79, -14, 1.6, 0);
  ring(A(26, 1), 81, -13, 1.6, 0.2);
  ring(A(26, 2), 83, -12, 2.6, 0.3);
  rise(A(27), 3, -20);

  // ── first answer, the gates (bars 27-34): the events' note; code ticks, a model swells ──────
  drums(A(27), A(33, 3), { clapFrom: A(29) });
  bassLine(A(27), A(33, 3), ROOT.events);
  padSpan(A(27), A(33, 3), CHORD.dm9, { release: 0.6 });
  // gate one: plain code checks each event, dry and unpitched, a little off the grid
  for (let k = 0, b = A(28, 3); b < A(33, 2); k++, b += 0.25) {
    if (uni(seedOf(seed, 'ticks'), k) < 0.42) continue;
    mx.add(at(b) + Math.round((uni(seedOf(seed, 'tick-late'), k) - 0.5) * 600), tick(seedOf(seed, 'tick'), k), { bus: 'fx', part: 'tick', db: -23 + TRIM.tick, pan: uni(seedOf(seed, 'tick-pan'), k) * 1.4 - 0.7 });
  }
  // gate two: a model judges
  for (const b of [A(30, 2), A(31, 1), A(32, 1), A(33, 1)]) swell(b, CHORD.dm9);
  verdict('hit.v1', A(33, 3), 1, CHORD.dm9);
  rise(A(35), 2, -22);

  // ── second answer, threads (bars 35-40): the Workers' note; follow-ups go straight in ───────
  drums(A(35), A(39, 4), { clapFrom: A(35) });
  bassLine(A(35), A(39, 4), ROOT.workers);
  padSpan(A(35), A(39, 4), CHORD.am11, { release: 0.6 });
  arp(A(36), A(39, 4), CHORD.am11, { db: -21 });
  verdict('hit.v2', A(39, 4), 2, CHORD.am11);

  // ── third answer, batching (bars 41-49): arrivals off the grid, then one chord ──────────────
  padSpan(A(41), ENTER, CHORD.cmaj9, { db: -19, bright: 0.3 });
  kickAt(A(41), -8);
  kickAt(A(42), -8);
  {
    // each arrival waits where it landed: plucks at uneven times, low
    const s = seedOf(seed, 'arrivals');
    let b = A(41, 1.4);
    for (let k = 0; b < ENTER - 0.4; k++) {
      strum(b, CHORD.cmaj9[1 + (k % 4)]! + 12, -19, { pan: uni(s, k) * 1.2 - 0.6, echo: 0.1, part: 'arrival' });
      b += 0.45 + 0.75 * uni(s, k + 100);
    }
  }
  // they enter together: the same notes at once
  for (const [k, m] of CHORD.cmaj9.slice(1).entries()) ring(ENTER, m + 12, -15, 2.2, (k - 1.5) * 0.3);
  drums(ENTER, A(48, 4), { clapFrom: A(45) });
  bassLine(ENTER, A(48, 4), ROOT.router);
  padSpan(ENTER, A(48, 4), CHORD.cmaj9, { release: 0.6 });
  arp(A(45), A(48, 4), CHORD.cmaj9, { db: -21 });
  verdict('hit.v3', A(48, 4), 3, CHORD.cmaj9);

  // ── fourth answer, the cache (bars 50-55): the Router's note still; recall is an echo ───────
  drums(A(50, 3), A(54, 4));
  bassLine(A(50, 3), A(54, 4), ROOT.router);
  padSpan(A(50), A(53), CHORD.cmaj9, { db: -18 });
  padSpan(A(53), A(54, 4), CHORD.em11, { db: -18, release: 0.6 });
  arp(A(51), A(54, 4), CHORD.cmaj9, { db: -22, echo: 0.6 });
  strum(A(52, 3), 76, -13, { len: 1.2, echo: 0.8, part: 'recall' });
  strum(A(53, 1), 71, -14, { len: 1.2, echo: 0.8, part: 'recall' });
  verdict('hit.v4', A(54, 4), 4, CHORD.em11);
  rise(A(56), 2, -21);

  // ── 5. Evidence (bars 56-66): half-time; the chords climb the stack as the results add up ───
  hit('hit.test', A(56, 1), () => thudAt(A(56, 1), -6));
  const climb = [CHORD.dm9, CHORD.am11, CHORD.cmaj9, CHORD.em11, CHORD.dm9] as const;
  const roots = [ROOT.events, ROOT.workers, ROOT.router, ROOT.you, ROOT.events] as const;
  drums(A(56), A(66, 2), { half: true });
  for (let k = 0; k < 5; k++) {
    const from = A(56 + 2 * k);
    const to = k === 4 ? A(66, 2) : A(58 + 2 * k);
    // the price is light: the last chord opens up
    padSpan(from, to, climb[k]!, { db: k === 4 ? -15 : -17, bright: k === 4 ? 0.9 : 0.4, release: 1.0 });
    bassLine(from, to, roots[k]!, true);
    if (k > 0) ring(from, climb[k]![0]! + 24, -15, 2.4, k % 2 ? 0.25 : -0.25);
  }

  // ── 6. Proposed, open (bars 66-70): dashed notes, then notes with gaps ──────────────────────
  padSpan(A(66, 2), A(70, 4), [50, 57], { db: -19, bright: 0.3, release: 1.0 });
  for (let b = A(67); b < A(70, 4); b += 4) kickAt(b, -9);
  // proposed: dashed (two on, one off)
  for (let e = A(66, 2) * 2, k = 0; e < A(68, 3) * 2; e++, k++) if (k % 3 !== 2) strum(e / 2, k % 6 < 3 ? 62 : 69, -17, { len: 0.3, pan: k % 2 ? 0.3 : -0.3, part: 'dashed' });
  // open: the pattern has holes in it
  for (const b of [A(68, 3), A(69, 1), A(69, 2.5), A(70, 1), A(70, 3)]) strum(b, 64, -16, { len: 1.0, echo: 0.5, part: 'open' });

  // ── 7. Close (bars 71-75): the opening's hops come back, slower; then you sign off ──────────
  padSpan(A(71), A(72, 3), CHORD.am11, { db: -20, bright: 0.25, attack: 0.8, release: 0.8 });
  for (let b = A(71); b < A(72, 3); b += 1) strum(b, 57, -15, { part: 'hops' });
  // "NOT YOU.": the bass moves up to your note
  thudAt(A(72, 3), -9);
  mx.add(at(A(72, 3)), bassClip(`${ROOT.you}:5.6`), { bus: 'bass', part: 'bass', db: -12 + TRIM.bass });
  padSpan(A(72, 3), A(74), CHORD.em11, { db: -18, bright: 0.4, release: 0.5 });
  rise(A(74), 3, -19);
  hit('hit.decide', A(74, 1), () => {
    kickAt(A(74, 1), -5);
    thudAt(A(74, 1), -6);
    mx.add(at(A(74, 1)), pad(CHORD.stack, secs(1.8), { seed: seedOf(seed, 'decide'), attack: 0.01, release: 0.4, bright: 0.7 }), { bus: 'pad', part: 'stab', db: -14 + TRIM.pad, sends: { hall: 0.3 } });
  });
  // the motif, whole, leading into the one touch
  motif(A(74, 2), 4, -12);
  hit('hit.sign', A(74, 3), () => {
    thudAt(A(74, 3), -7);
    ring(A(74, 3), REST, -8, 3.2);
    ring(A(74, 3), REST - 12, -13, 3.2);
    ring(A(74, 3), REST + 12, -19, 3.2);
  });
  padSpan(A(74, 3), A(76), CHORD.dm9, { db: -17, bright: 0.5, attack: 0.2, release: 1.0 });
  mx.add(at(A(74, 3)), bassClip(`${ROOT.events}:5.6`), { bus: 'bass', part: 'bass', db: -11 + TRIM.bass });

  // ── the end card (bars 76-80): the stack at rest, the motif once more, slowly, and home ─────
  hit('hit.end', A(76, 1), () => {
    kickAt(A(76, 1), -8);
    for (const [k, m] of MOTIF.entries()) ring(A(76, 1), m, -15, 3.4, (k - 1.5) * 0.3);
  });
  padSpan(A(76), A(80), CHORD.dm9, { db: -18, bright: 0.35, attack: 0.3, release: 2.5 });
  bassLine(A(76), A(80), ROOT.events, true);
  for (let k = 0; k < 4; k++) ring(A(77, 1 + 2 * (k % 2)) + 4 * Math.floor(k / 2), MOTIF[k]!, -15, 3, (k - 1.5) * 0.25);
  ring(A(79, 1), REST, -14, 4);

  return accents;
}
