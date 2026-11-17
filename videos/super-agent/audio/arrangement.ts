/**
 * The arrangement: what sounds when, on the cue sheet's grid (120 bpm, 84 bars of four beats).
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
/** scenes/gates.ts: waves of events reach the Router on the half beats; gate one is ruled; the model judges one event at each of JUDGED */
const WAVES_FROM = A(25, 3);
const WAVES = 9;
const GATE_ONE = A(28, 3);
const JUDGED = [A(30, 2), A(30, 3), A(31, 1), A(31, 4), A(32, 2), A(32, 3), A(33, 1)] as const;
/** scenes/threads.ts: the request is routed, its task lands in a Worker, and each follow-up reaches that Worker */
const ROUTED = A(34, 4);
const SUBSCRIBED = A(35, 1);
const FOLLOW_UPS = [A(35, 3), A(36, 1), A(36, 3), A(37, 1), A(37, 3), A(38, 1), A(38, 3), A(39, 1), A(39, 3)] as const;
/** scenes/batch-rail.ts: the first call lights; the waiting arrivals enter together; then each later call takes its batch */
const FIRST_CALL = A(41, 3.5);
const ENTER = A(43, 1);
const BATCHES: ReadonlyArray<readonly [at: number, size: number]> = [[A(44, 3), 3], [A(46, 2), 3], [A(48, 1), 4], [A(49, 4), 4]];
const BURST: readonly [number, number] = [A(46, 3), A(47, 4)];
/** scenes/cache.ts: old items let their bodies go, from the edge of view back; the ID lights and its body is read; the copy is back on the rail; a piece of another body falls */
const CASCADE = A(50, 3);
const HOPS = [A(52, 3), A(52, 4)] as const;
const RECALLED = A(53, 1.5);
const LOSS = A(53, 2);
/** scenes/levels.ts (ANSWER): a report leaves the working cell; the Router's model runs on it; the answer reaches you */
const ANSWER = { sent: A(23, 2), routed: A(23, 3), heard: A(24, 1) } as const;
/** scenes/evidence.ts: the two trails stop; the typical lengths land; the token bands are lit */
const STOPS = [A(61, 1), A(61, 3)] as const;
const TYPICAL = A(63, 1);
const LIT = A(64, 2);
/** scenes/status.ts: the four gaps open */
const GAPS = [A(68, 3), A(68, 4.5), A(69, 2), A(69, 3.5)] as const;
/** scenes/close.ts: the question returns; the Router's model runs on the result; the result reaches you */
const ASKED = A(71, 1);
const REPORTED = A(72, 3);
const ARRIVED = A(73, 3);

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
  /** one bright burst, a little long: a clap's bursts are spread over a frame and more */
  const CR = hat(seedOf(seed, 'crack'), 0.11);
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
  /** a bright edge on an impact that a riser runs into: without it the hit is all low end, and its start is soft */
  const crack = (abs: number, db = -13): void => mx.add(at(abs), CR, { bus: 'drums', part: 'crack', db: db + TRIM.clap, sends: { hall: 0.45 } });
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
    crack(A(9, 1), -12);
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
  // only the Router answers you: the Worker's note goes up, the Router's model runs, and your note answers
  ring(ANSWER.sent, 69, -15, 0.9, 0.3);
  swell(ANSWER.routed, CHORD.cmaj9, 1, -19);
  ring(ANSWER.heard, 76, -12, 1.8, -0.3);
  kickAt(A(24, 4), -9);
  kickAt(A(24, 4.5), -7);
  rise(A(25), 3, -19);

  // ── 4. One Router for all this? (bars 25-26): the beat stops; a question that does not close ─
  hit('hit.spine', A(25, 1), () => {
    thudAt(A(25, 1), -4);
    crack(A(25, 1));
    mx.add(at(A(25, 1)), pad(CHORD.open, secs(7), { seed: seedOf(seed, 'question'), attack: 0.02, release: 1.4, bright: 0.6 }), { bus: 'pad', part: 'stab', db: -14 + TRIM.pad, sends: { hall: 0.4 } });
  });
  // the worry: wave after wave of events reaches the Router, each larger than the last
  for (let k = 0; k < WAVES; k++) {
    const b = WAVES_FROM + k / 2;
    strum(b, [62, 64, 67, 69][k % 4]! + (k >= 4 ? 12 : 0), -21 + k * 0.9, { len: 0.5, pan: (k % 2 ? 0.45 : -0.45) * (0.4 + k / 14), echo: 0.35, part: 'waves' });
  }
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
  mx.add(at(GATE_ONE), tick(seedOf(seed, 'gate'), 0), { bus: 'fx', part: 'tick', db: -13 + TRIM.tick });
  thudAt(GATE_ONE, -12);
  for (let k = 0, b = GATE_ONE + 0.25; b < A(33, 2); k++, b += 0.25) {
    if (uni(seedOf(seed, 'ticks'), k) < 0.42) continue;
    mx.add(at(b) + Math.round((uni(seedOf(seed, 'tick-late'), k) - 0.5) * 600), tick(seedOf(seed, 'tick'), k), { bus: 'fx', part: 'tick', db: -23 + TRIM.tick, pan: uni(seedOf(seed, 'tick-pan'), k) * 1.4 - 0.7 });
  }
  // gate two: a model judges
  for (const [k, b] of JUDGED.entries()) swell(b, CHORD.dm9, k > 0 && b - JUDGED[k - 1]! < 2 ? 0.9 : 1.5, -18);
  verdict('hit.v1', A(33, 3), 1, CHORD.dm9);
  // the next request is routed, once, and its task goes down to a Worker: the Router's note, then the Worker's
  swell(ROUTED, CHORD.cmaj9, 1, -18);
  ring(ROUTED, 72, -13, 1.2, 0.2);
  ring(SUBSCRIBED, 69, -12, 1.8, 0.3);
  rise(A(35), 2, -22);

  // ── second answer, threads (bars 35-40): the Workers' note; follow-ups go straight in ───────
  drums(A(35), A(39, 4), { clapFrom: A(35) });
  bassLine(A(35), A(39, 4), ROOT.workers);
  padSpan(A(35), A(39, 4), CHORD.am11, { release: 0.6 });
  arp(A(36), A(39, 4), CHORD.am11, { db: -22 });
  // each follow-up goes straight to its Worker (a high pluck); the Router only notes it: a dry tick, no swell
  for (const [k, b] of FOLLOW_UPS.entries()) {
    strum(b, k % 2 ? 76 : 81, -15, { len: 0.5, pan: 0.35, echo: 0.2, part: 'follow' });
    mx.add(at(b), tick(seedOf(seed, 'seen'), k), { bus: 'fx', part: 'tick', db: -19 + TRIM.tick, pan: 0.35 });
  }
  verdict('hit.v2', A(39, 4), 2, CHORD.am11);

  // ── third answer, batching (bars 41-49): arrivals off the grid, then one chord ──────────────
  padSpan(A(41), ENTER, CHORD.cmaj9, { db: -19, bright: 0.3 });
  kickAt(A(41), -8);
  kickAt(A(42), -8);
  // the first arrival finds the rail free: one call
  swell(FIRST_CALL, CHORD.cmaj9, 1, -18);
  {
    // each arrival waits where it landed: plucks at uneven times, low; in the burst they crowd
    const s = seedOf(seed, 'arrivals');
    const taken = [ENTER, ...BATCHES.map(([t]) => t)];
    let b = A(41, 3.6);
    for (let k = 0; b < A(49, 3); k++) {
      if (!taken.some((t) => Math.abs(b - t) < 0.3)) strum(b, CHORD.cmaj9[1 + (k % 4)]! + 12, b < ENTER ? -19 : -22, { pan: uni(s, k) * 1.2 - 0.6, echo: 0.1, part: 'arrival' });
      const crowd = b >= BURST[0] && b < BURST[1];
      b += (crowd ? 0.22 : 0.45) + (crowd ? 0.3 : 0.75) * uni(s, k + 100);
    }
  }
  // they enter together: the same notes at once
  for (const [k, m] of CHORD.cmaj9.slice(1).entries()) ring(ENTER, m + 12, -18, 2.2, (k - 1.5) * 0.3);
  // and so does every later batch: as many notes as it holds
  for (const [t, size] of BATCHES) for (let k = 0; k < size; k++) ring(t, CHORD.cmaj9[1 + k]! + 12, -21, 1.6, (k - (size - 1) / 2) * 0.3);
  drums(ENTER, A(48, 4), { clapFrom: A(45) });
  bassLine(ENTER, A(48, 4), ROOT.router);
  padSpan(ENTER, A(48, 4), CHORD.cmaj9, { release: 0.6 });
  arp(A(45), A(48, 4), CHORD.cmaj9, { db: -21 });
  verdict('hit.v3', A(48, 4), 3, CHORD.cmaj9);

  // ── fourth answer, the cache (bars 50-55): the Router's note still; recall is an echo ───────
  drums(A(50, 3), A(54, 3));
  bassLine(A(50, 3), A(54, 3), ROOT.router);
  padSpan(A(50), A(53), CHORD.cmaj9, { db: -18 });
  padSpan(A(53), A(54, 3), CHORD.em11, { db: -18, release: 0.6 });
  arp(A(51), A(54, 3), CHORD.cmaj9, { db: -22, echo: 0.6 });
  // old items let their bodies go, one after another, from the edge of view back into the history: a run of dry ticks, falling away
  for (let k = 0; k < 8; k++) mx.add(at(CASCADE + (k * 7) / 30), tick(seedOf(seed, 'spill'), k), { bus: 'fx', part: 'tick', db: -17 - k * 0.8 + TRIM.tick, pan: 0.5 - k * 0.08 });
  // the recall: the ID, then its own body, an echo further back; then the copy is back in view
  for (const [k, b] of HOPS.entries()) strum(b, [76, 74][k]!, -13 - k * 0.5, { len: 1.2, echo: 0.8, pan: -0.15 * k, part: 'recall' });
  ring(RECALLED, 72, -14, 1.8, 0.25);
  // not nothing is lost: one note is cut short
  strum(LOSS, 59, -15, { len: 0.16, bright: 0.3, echo: 0, part: 'recall' });
  verdict('hit.v4', A(54, 3), 4, CHORD.em11);
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
  // the two trails stop, the Super-agent's first; then the typical lengths land
  ring(STOPS[0], 81, -14, 1.6, -0.3);
  ring(STOPS[1], 69, -14, 2.2, 0.3);
  ring(TYPICAL, 76, -15, 1.8, 0);
  // the price is light: models reading
  swell(LIT, CHORD.dm9, 1, -16);

  // ── 6. Proposed, open (bars 66-70): dashed notes, then notes with gaps ──────────────────────
  padSpan(A(66, 2), A(70, 4), [50, 57], { db: -19, bright: 0.3, release: 1.0 });
  for (let b = A(67); b < A(70, 4); b += 4) kickAt(b, -9);
  // proposed: dashed (two on, one off)
  for (let e = A(66, 2) * 2, k = 0; e < A(68, 3) * 2; e++, k++) if (k % 3 !== 2) strum(e / 2, k % 6 < 3 ? 62 : 69, -17, { len: 0.3, pan: k % 2 ? 0.3 : -0.3, part: 'dashed' });
  // open: the pattern has holes in it
  for (const [k, b] of GAPS.entries()) strum(b, [64, 67, 62, 69][k]!, -15, { len: 1.0, echo: 0.5, pan: k % 2 ? 0.3 : -0.3, part: 'open' });

  // ── 7. Close (bars 71-75): the opening's hops come back, slower; then you sign off ──────────
  rise(ASKED, 1, -22);
  padSpan(ASKED, REPORTED, CHORD.am11, { db: -20, bright: 0.25, attack: 0.8, release: 0.8 });
  // the question again, as it first landed
  thudAt(ASKED, -9);
  ring(ASKED, 69, -12, 2.4);
  ring(ASKED, 76, -16, 2.4);
  for (let b = ASKED + 1; b < REPORTED; b += 1) strum(b, 57, -15, { part: 'hops' });
  // "NOT YOU.": the Router's model runs on the result, and the bass moves up to your note
  swell(REPORTED, CHORD.cmaj9, 1.5, -17);
  thudAt(REPORTED, -9);
  mx.add(at(REPORTED), bassClip(`${ROOT.you}:5.6`), { bus: 'bass', part: 'bass', db: -12 + TRIM.bass });
  padSpan(REPORTED, A(74), CHORD.em11, { db: -18, bright: 0.4, release: 0.5 });
  // the result is beside you: your note
  ring(ARRIVED, 76, -12, 2.0, 0.2);
  rise(A(74), 3, -19);
  hit('hit.decide', A(74, 1), () => {
    kickAt(A(74, 1), -5);
    thudAt(A(74, 1), -6);
    crack(A(74, 1));
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

  // ── the recap (bars 76-79): the four answers land a beat apart, a note of the motif each; under
  // them the chords walk back down the stack, from your level to the events', a bar each ────────
  for (const [k, m] of MOTIF.entries()) ring(A(76, 1 + k), m, -12, 2.6, (k - 1.5) * 0.3);
  const down = [[CHORD.em11, ROOT.you], [CHORD.cmaj9, ROOT.router], [CHORD.am11, ROOT.workers], [CHORD.dm9, ROOT.events]] as const;
  for (const [k, [chord, root]] of down.entries()) {
    padSpan(A(76 + k), A(77 + k), chord, { db: -19, bright: 0.3, attack: 0.25, release: 0.9 });
    bassLine(A(76 + k), A(77 + k), root, true);
  }
  for (let b = A(77); b < A(80); b += 4) kickAt(b, -10);
  rise(A(79, 3), 2, -22);

  // ── the end card (bars 80-84): the stack at rest, the motif once more, slowly, and home ─────
  hit('hit.end', A(80, 1), () => {
    kickAt(A(80, 1), -8);
    for (const [k, m] of MOTIF.entries()) ring(A(80, 1), m, -15, 3.4, (k - 1.5) * 0.3);
  });
  padSpan(A(80), A(84), CHORD.dm9, { db: -18, bright: 0.35, attack: 0.3, release: 2.5 });
  bassLine(A(80), A(84), ROOT.events, true);
  for (let k = 0; k < 4; k++) ring(A(81, 1 + 2 * (k % 2)) + 4 * Math.floor(k / 2), MOTIF[k]!, -15, 3, (k - 1.5) * 0.25);
  ring(A(83, 1), REST, -14, 4);

  return accents;
}
