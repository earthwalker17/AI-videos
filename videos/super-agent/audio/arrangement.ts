/**
 * The score sketch: bars 1-27 of the film (0:00-1:12), placed on the cue sheet's grid. Every
 * position comes from ctx.cues through the kit's timeline: a cue (T.cue, T.span) where the sheet
 * has one, else the bar grid (T.beat), on which the picture also moves. TREATMENT.md "Sound
 * design" and STORYBOARD.md's sound column, in order:
 *
 *   bars 1-5    the hook. Quiet modal-marimba tile motifs in D Dorian, each on its own
 *               subdivision (3, 4 or 5 a bar, ±12-cent drift), lit by your visits; a soft
 *               woodblock per hop, on quarters. f20 (hit `request`): the request motif, A4 then
 *               D5 on FM mallet; the F♮5 that follows falls away under the tiles, unfinished.
 *               f160 (hit `title-thump`): a low felt-piano D and a soft paper thump.
 *   bars 6-9    you become the router. Three more tiles (5 → 8) pile into the 3:4:5 polyrhythm;
 *               hops speed up (quarters, eighths in bar 8, sixteenths in bar 9); a tile left
 *               unvisited fades with a short falling, closing tone.
 *   bar 10      f720 (hit `hub`): everything stops dead; one low felt-piano D and an ink scratch,
 *               damped for beat 4: a beat of silence (digital zero, see index.ts).
 *   bars 11-15  the two easy fixes, split hard left and right. Left (sketch A): one plodding
 *               marimba note per beat, a second line a semitone away smearing into each. Right
 *               (sketch B, from bar 13): scattered bright plucks, each with a reply chirp, the
 *               replies clustering. Bar 15 holds both side by side.
 *   bar 16      the split stops; a Dsus2 hangs alone on felt piano, damped before beat 3: the
 *               near silence of `rest-breath`.
 *   bar 17      f1280 (hit `turn`): every voice (mallet, marimba, pluck, felt piano) collapses into
 *               one D-major unison arpeggio, centred; a sine-bass pulse on beats 1 and 3 and the
 *               bowed pad enter; the ink is a soft spreading noise swell.
 *   bars 18-26  the two levels. Router ticks on 2 and 4; each new Worker a low wooden knock, then
 *               its marimba voice (A, D, F♯; the third at bar 22, C11's fresh platform); the
 *               request motif at its stations (bar 19 on the trunk, bar 22 into its Worker); the
 *               struck-through split a dry scratch (bar 21); status dots as ink clicks and the
 *               reply to you one felt-piano note (bar 24); from bar 26 the Workers are heard
 *               through a wall (a closing low-pass on their bus, 8 dB down), their last notes
 *               a beat before the rest.
 *   bar 27      rest `rest-27`: the pad, 19 dB down, and two plucks.
 *   bar 28      the pad decays to nothing; from bar 29 the sketch is silent (index.ts).
 *
 * Every random choice is rand(ctx.seed, id, k) from @aiv/core, every noise stream the kit's
 * seeded noise: the sketch is a pure function of the cue sheet and the seed.
 */
import { rand } from '@aiv/core';
import { SR, Svf, dbToGain, gainToDb, seedOf, slowNoise, smooth, type Mixer, type Place, type StereoClip, type Timeline } from '@aiv/pipeline/audio/kit';
import { inkClick, inkSwell, paperThump, sketchScratch, woodKnock, woodblockHop } from './foley.ts';
import { bowedNote, brightPluck, chirp, fallTone, feltPiano, fmMallet, marimba, sineBass, smear, woodTick } from './instruments.ts';

// pitches (MIDI)
const D2 = 38;
const D3 = 50;
const E3 = 52;
const F3 = 53;
const G3 = 55;
const A3 = 57;
const B3 = 59;
const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const Fs4 = 66;
const G4 = 67;
const A4 = 69;
const B4 = 71;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const Fs5 = 78;
const G5 = 79;
const A5 = 81;
const C6 = 84;
const D6 = 86;

/**
 * Placement levels, dB on peak-normalised clips (the pad's notes on their fixed scale), set
 * against the mixer's report (index.ts prints it, and how far each UI sound sits under the bed).
 */
const LV = {
  tiles: -17,
  hop: -25,
  /** added to bar 9's sixteenth hops: the fast visits light every tile, and without it they sank 16-22 dB under the bed */
  hopSixteenths: 3,
  /** the request motif: its D5 lands on the still-ringing A4, and at -12 the master took over 2 dB off the hook's tiles for half a second under it */
  motif: -14,
  motifFall: -20,
  piano: -9,
  thump: -23,
  scratch: -22,
  strike: -20,
  tileFade: -27,
  plod: -15,
  smear: -23,
  stubs: -13,
  replies: -26,
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
  ticks: -30,
  workers: -13,
  knock: -22,
  swell: -26,
  click: -24,
  restPluck: -29,
  /** the pad in the bar-27 rest, relative to its level before */
  restPad: -19,
} as const;

/** The sketch's landmarks, in samples, from the cue sheet. */
export interface Marks {
  /** bar 10 downbeat (hit `hub`): everything stops dead */
  hub: number;
  /** bar 10 beat 4: the beat of silence after the hub's D */
  hush: number;
  /** bar 11 (mark `beat-3`): the two easy fixes */
  split: number;
  /** bar 16 downbeat: the split stops, the Dsus2 hangs alone */
  question: number;
  /** bar 16 beat 3 (rest `rest-breath`): near silence */
  breath: number;
  /** bar 17 downbeat (hit `turn`) */
  turn: number;
  /** bar 26 downbeat: the Workers step down */
  stepDown: number;
  /** bar 27 (rest `rest-27`), [start, end) */
  rest: [number, number];
  /** bar 29 downbeat, after bar 28's decay: nothing sounds from here to the end of the film */
  end: number;
}

export function marks(T: Timeline): Marks {
  const hub = T.cue('hub');
  const breath = T.span('rest-breath')[0];
  const rest = T.span('rest-27');
  return {
    hub,
    hush: hub + T.beats(3),
    split: T.cue('beat-3'),
    question: breath - T.beats(2),
    breath,
    turn: T.cue('turn'),
    stepDown: rest[0] - T.beats(4),
    rest,
    end: rest[1] + T.beats(4),
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
function loudest400(clip: Float32Array | StereoClip): number {
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

// --- act one: the switchboard ---------------------------------------------------------------------

interface Tile {
  /** its motif, cycled */
  notes: readonly number[];
  /** notes a bar: 3, 4 or 5 (the polyrhythm) */
  perBar: number;
  /** beats after the downbeat of its first note */
  offset: number;
  pan: number;
  /** the bar it appears in */
  from: number;
}

/** five tiles round your ring, then three spawned by event pills (bars 6-8); D Dorian throughout */
const TILES: readonly Tile[] = [
  { notes: [D4, F4, A4, G4], perBar: 4, offset: 0, pan: 0.3, from: 1 },
  { notes: [D3, A3, C4], perBar: 3, offset: 0, pan: 0.15, from: 1 },
  { notes: [A4, C5, D5, E5, G4], perBar: 5, offset: 0, pan: 0.5, from: 1 },
  { notes: [F4, E4, D4, C4], perBar: 4, offset: 0.5, pan: 0.6, from: 1 },
  { notes: [G3, B3, D4], perBar: 3, offset: 0.5, pan: 0.05, from: 1 },
  { notes: [E5, D5, B4, A4, C5], perBar: 5, offset: 0.4, pan: 0.7, from: 6 },
  { notes: [C5, A4, F4, A4], perBar: 4, offset: 0.25, pan: 0.4, from: 7 },
  { notes: [B3, D4, F4], perBar: 3, offset: 0.5, pan: 0.2, from: 8 },
];
/** a tile's light falls from your last visit with this time constant (s), to at least DIM */
const LIT_TAU = 1.6;
const DIM = 0.1;
/** a tile whose light falls under this sounds its fading tone */
const FADE_LIGHT = 0.3;

/** Hop onsets and their step in beats: quarters to bar 7, eighths in bar 8, sixteenths in bar 9; none from the hub on. */
function hopTimes(T: Timeline, hub: number): { at: number; step: number }[] {
  const out: { at: number; step: number }[] = [];
  const last = T.position(hub).bar;
  for (let bar = 1; bar < last; bar++) {
    const step = bar <= last - 3 ? 1 : bar === last - 2 ? 0.5 : 0.25;
    for (let b = 1; b < 5 - 1e-9; b += step) out.push({ at: T.beat(bar, b), step });
  }
  return out;
}

export function arrange(T: Timeline, mx: Mixer): FxPlacement[] {
  const seed = T.ctx.seed;
  const m = marks(T);
  const fx: FxPlacement[] = [];
  type P = Omit<Place, 'bus'>;
  const music = (at: number, clip: Float32Array | StereoClip, p: P) => mx.add(at, clip, { bus: 'music', ...p });
  const foley = (at: number, clip: Float32Array | StereoClip, p: P) => {
    mx.add(at, clip, { bus: 'foley', ...p });
    const len = clip instanceof Float32Array ? clip.length : clip.l.length;
    fx.push({ part: p.part, at, len, power: loudest400(clip) * dbToGain(p.db ?? 0) ** 2 });
  };
  /** the request motif: A4 then D5, an eighth apart */
  const motif = (at: number, pan: number, db: number) => {
    for (const [j, midi] of [A4, D5].entries()) music(at + j * T.beats(0.5), fmMallet(midi, { vel: 0.85 }), { part: 'motif', db, pan, sends: { hall: 0.3, echo: 0.3 } });
  };

  // ===== bars 1-9: tiles, hops, the request ======================================================
  {
    const visits: number[][] = TILES.map((tile, i) =>
      // frame 0 is already moving: the first tiles were last visited a moment before the film; a spawned tile is lit as it appears
      [tile.from === 1 ? -Math.round((0.4 + 2.4 * rand(seed, 'tile-age', i)) * SR) : T.beat(tile.from)],
    );
    let prev = -1;
    hopTimes(T, m.hub).forEach(({ at, step }, k) => {
      const bar = T.position(at).bar;
      const open = TILES.map((_, i) => i).filter((i) => TILES[i].from <= bar && i !== prev);
      const i = open[Math.floor(rand(seed, 'hop', k) * open.length)];
      visits[i].push(at);
      prev = i;
      const db = LV.hop + (step < 0.5 ? LV.hopSixteenths : 0);
      foley(at, woodblockHop(seed, k, 760 + 30 * (i % 4)), { part: 'hop', db, pan: TILES[i].pan, sends: { hall: 0.12 } });
    });
    const light = (i: number, at: number) => {
      let v = visits[i][0];
      for (const x of visits[i]) if (x <= at) v = x;
      return Math.max(DIM, Math.exp(-(at - v) / (LIT_TAU * SR)));
    };

    TILES.forEach((tile, i) => {
      const drift = slowNoise(seedOf(seed, 'tile-drift', i), 0.22);
      let c = 0;
      for (let bar = tile.from; T.beat(bar) < m.hub; bar++)
        for (let j = 0; j < tile.perBar; j++) {
          const at = T.beat(bar, 1 + tile.offset + (j * 4) / tile.perBar);
          if (at >= m.hub) continue;
          const clip = marimba(tile.notes[c % tile.notes.length], { seed, k: i * 1000 + c, vel: 0.55 + 0.3 * rand(seed, `tile-vel-${i}`, c), cents: 12 * drift(at / SR), bright: 0.35 });
          music(at, clip, { part: 'tiles', db: LV.tiles + gainToDb(light(i, at)), pan: tile.pan, sends: { hall: 0.25 } });
          c++;
        }
      // bars 6-9: a tile left long enough fades with a short falling tone, on the sixteenth grid
      const q = T.beatSamples / 4;
      const fadeS = LIT_TAU * Math.log(1 / FADE_LIGHT) * SR;
      visits[i].forEach((at, j) => {
        const next = j + 1 < visits[i].length ? visits[i][j + 1] : m.hub;
        const fadeAt = at + fadeS;
        if (fadeAt >= next || fadeAt < T.beat(6) || fadeAt > m.hub - T.beats(0.5)) return;
        const on = Math.round(T.beat(1) + Math.round((fadeAt - T.beat(1)) / q) * q);
        music(on, fallTone(tile.notes[0] + 12, { vel: 0.6 }), { part: 'tile-fade', db: LV.tileFade, pan: tile.pan, sends: { hall: 0.3 } });
      });
    });

    // f20: the request, A4 then D5; the F♮5 after it falls away into the echoes, unfinished
    const req = T.cue('request');
    motif(req, -0.45, LV.motif);
    music(req + T.beats(1), fmMallet(F5, { vel: 0.5, droop: 40, droopTime: 0.6, tau: 0.28 }), { part: 'motif-fall', db: LV.motifFall, pan: -0.45, sends: { hall: 0.35, echo: 0.5 } });

    // f160: the title sets; a low felt-piano D and a soft paper thump
    const tt = T.cue('title-thump');
    music(tt, feltPiano(D2, { seed, k: 1, vel: 0.75 }), { part: 'piano', db: LV.piano, pan: -0.15, sends: { hall: 0.3 } });
    foley(tt, paperThump(seed, 0), { part: 'paper-thump', db: LV.thump, pan: -0.35, sends: { hall: 0.1 } });
  }

  // ===== bar 10: the hub ========================================================================
  // the buses cut at the hub (index.ts), so the tiles and hops stop dead; the D is damped before the beat of silence
  music(m.hub, feltPiano(D2, { seed, k: 2, vel: 0.85, hold: (m.hush - m.hub) / SR - 0.25, damp: 0.07 }), { part: 'piano', db: LV.piano, pan: 0.15, sends: { hall: 0.25 } });
  // the interchange ring draws in 8 frames: one ink scratch about that long
  foley(m.hub, sketchScratch(seed, { len: 0.3, k: 1 }), { part: 'ink-scratch', db: LV.scratch, pan: 0.2, sends: { hall: 0.1 } });

  // ===== bars 11-15: the two easy fixes, hard left and right ====================================
  const b11 = T.position(m.split).bar;
  {
    const PLOD = [D3, E3, F3, E3, D3, E3, F3, G3, F3, E3, D3, E3, F3, G3, F3, E3, D3, E3, F3, E3];
    PLOD.forEach((midi, j) => {
      const bar = b11 + Math.floor(j / 4);
      const at = T.beat(bar, 1 + (j % 4));
      // sketch B has the camera in bars 13-14: sketch A, off to the left, sits back a little
      const lvl = bar === b11 + 2 || bar === b11 + 3 ? -3 : 0;
      music(at, marimba(midi, { seed, k: 5000 + j, vel: 0.7, bright: 0.25, tau: 0.45 }), { part: 'plod', db: LV.plod + lvl, pan: -1, sends: { hall: 0.2 } });
      music(at + T.beats(0.25), smear(midi + 1, midi, { len: 0.55, glide: 0.35, vel: 0.7 }), { part: 'smear', db: LV.smear + lvl, pan: -0.9, sends: { hall: 0.25 } });
    });

    const NOTES = [D5, E5, G5, A5, C6, D6];
    [5, 7, 6].forEach((count, s) => {
      const bar = b11 + 2 + s;
      const slots = Array.from({ length: 16 }, (_, q) => q)
        .sort((a, b) => rand(seed, 'stub-slot', bar * 16 + a) - rand(seed, 'stub-slot', bar * 16 + b))
        .slice(0, count)
        .sort((a, b) => a - b);
      // every stub's reply lands on the next of the bar's gathering points: the replies cluster at your ring
      const gathers = [T.beat(bar, 2.75), T.beat(bar, 4.5), T.beat(bar + 1, 1.75)];
      for (const q of slots) {
        const key = bar * 16 + q;
        const at = T.beat(bar, 1 + q / 4);
        const midi = NOTES[Math.floor(rand(seed, 'stub-note', key) * NOTES.length)];
        const pluck = brightPluck(midi, { seed, k: key, vel: 0.6 + 0.3 * rand(seed, 'stub-vel', key), t60: 0.5 + 0.6 * rand(seed, 'stub-t60', key) });
        music(at, pluck, { part: 'stubs', db: LV.stubs, pan: 0.7 + 0.3 * rand(seed, 'stub-pan', key), sends: { hall: 0.2, echo: 0.15 } });
        const g = gathers.find((x) => x >= at + T.beats(0.5)) ?? gathers[gathers.length - 1];
        const rt = g + Math.round((rand(seed, 'reply-jitter', key) - 0.5) * 0.09 * SR);
        if (rt >= m.question) continue;
        const f0 = 1500 + 800 * rand(seed, 'reply-pitch', key);
        const reply = chirp({ f0, f1: f0 * 1.45, len: 0.05 + 0.03 * rand(seed, 'reply-len', key), vel: 0.6 });
        music(rt, reply, { part: 'replies', db: LV.replies, pan: 0.35 + 0.3 * rand(seed, 'reply-pan', key), sends: { hall: 0.15 } });
      }
    });
  }

  // ===== bar 16: a Dsus2 hangs alone, damped into the breath =====================================
  [D3, A3, D4, E4].forEach((midi, j) => {
    const roll = Math.round(j * 0.012 * SR);
    const hold = (m.breath - m.question - roll) / SR - 0.25;
    music(m.question + roll, feltPiano(midi, { seed, k: 20 + j, vel: 0.6, hold, damp: 0.16 }), { part: 'dsus2', db: LV.dsus2, pan: -0.15 + 0.1 * j, sends: { hall: 0.25 } });
  });

  // ===== bar 17: the turn ========================================================================
  const b17 = T.position(m.turn).bar;
  const b27 = T.position(m.rest[0]).bar;
  {
    const ARP = [D4, Fs4, A4, D5, Fs5, A5];
    ARP.forEach((midi, j) => {
      const at = m.turn + j * T.beats(0.5);
      const p = { pan: 0, sends: { hall: 0.3, echo: 0.12 } };
      const last = j === ARP.length - 1;
      music(at, fmMallet(midi, { vel: 0.75 }), { part: 'arp-mallet', db: LV.arp, ...p });
      music(at, marimba(midi, { seed, k: 6000 + j, vel: 0.75, bright: 0.6 }), { part: 'arp-marimba', db: LV.arp, ...p });
      music(at, brightPluck(midi, { seed, k: 6100 + j, vel: 0.7, t60: 1.4, bright: 0.7 }), { part: 'arp-pluck', db: LV.arp - 3, ...p });
      music(at, feltPiano(midi, { seed, k: 6200 + j, vel: 0.6, hold: last ? 2.5 : 0.9 }), { part: 'arp-piano', db: LV.arp, ...p });
    });
    foley(m.turn, inkSwell(seed, { len: T.beats(4) / SR }), { part: 'ink-swell', db: LV.swell, pan: 0, sends: { hall: 0.2 } });

    // the Router's pulse: a sine-bass D on beats 1 and 3, to the rest
    const pulse = sineBass(D2, { len: 1.0, vel: 0.9 });
    for (let at = m.turn; at < m.rest[0]; at += T.beats(2)) music(at, pulse, { part: 'bass', db: LV.bass, pan: 0 });

    // the Router's memory: a soft tick on 2 and 4 from bar 18
    let tk = 0;
    for (let bar = b17 + 1; bar < b27; bar++)
      for (const b of [2, 4]) {
        music(T.beat(bar, b), woodTick(1250 + 60 * (tk % 3), { seed, k: tk, vel: 0.7 }), { part: 'ticks', db: LV.ticks, pan: 0.05, sends: { hall: 0.15 } });
        tk++;
      }
  }

  // ===== bars 17-28: the bowed pad (continuity) ===================================================
  {
    const CHORDS: readonly (readonly [number, readonly number[]])[] = [
      [b17, [D3, A3, D4, Fs4]],
      [b17 + 2, [D3, G3, B3, D4]],
      [b17 + 4, [D3, A3, Fs4, A4]],
      [b17 + 6, [D3, B3, D4, Fs4]],
      [b17 + 8, [D3, G3, B3, E4]],
      [b27, [D3, A3, E4, Fs4]],
    ];
    // a held pitch carries over a chord change: each pitch is one line from where it starts to where it leaves
    const lines: { midi: number; from: number; to: number }[] = [];
    const open = new Map<number, number>();
    CHORDS.forEach(([bar, notes], c) => {
      const at = c === 0 ? m.turn : T.beat(bar);
      for (const [midi, from] of [...open])
        if (!notes.includes(midi)) {
          lines.push({ midi, from, to: at });
          open.delete(midi);
        }
      for (const midi of notes) if (!open.has(midi)) open.set(midi, at);
    });
    for (const [midi, from] of open) lines.push({ midi, from, to: m.rest[1] });
    // over bar 26's last beat and a half the pad sinks to its rest level, reached on the rest's
    // downbeat (the rest must sit 20 dB under the mix: QA); it then releases through bar 28
    const level = (s: number) => dbToGain(LV.restPad * smooth((s - (m.rest[0] - T.beats(1.5))) / T.beats(1.5)));
    lines.forEach((ln, k) => {
      const attack = ln.from === m.turn ? 2.0 : 0.8;
      const release = ln.to === m.rest[1] ? 1.6 : 0.8;
      const clip = bowedNote(ln.midi, { seed, k, len: (ln.to - ln.from) / SR + release, attack, release, amp: (t) => level(ln.from + t * SR) });
      mx.add(ln.from, clip, { bus: 'pad', part: 'pad', db: LV.pad, pan: (((ln.midi * 7) % 5) - 2) * 0.15, sends: { hall: 0.35 } });
    });
  }

  // ===== bars 18-26: the two levels ===============================================================
  {
    // the request at its stations: rising out of the pile onto the trunk (bar 19), into its own Worker (bar 22)
    motif(T.beat(b17 + 2), -0.2, LV.motif - 3);
    motif(T.beat(b17 + 5, 2), 0.6, LV.motif - 4);
    // C10: the faint split is struck through with one ink stroke
    foley(T.beat(b17 + 4), sketchScratch(seed, { len: 0.22, k: 2, dry: true }), { part: 'strike', db: LV.strike, pan: 0.1, sends: { hall: 0.1 } });

    // each new Worker: a low wooden knock, then its marimba voice a beat later (A, D, F♯)
    const WORKERS = [
      { midi: A4, knock: T.beat(b17 + 1), cell: [1.5, 3, 4.5], pan: 0.3 },
      { midi: D5, knock: T.beat(b17 + 1, 3), cell: [2, 3.5, 4], pan: 0.5 },
      // C11: the fresh platform beside the two busy ones, as the built tag sets (bar 22)
      { midi: Fs5, knock: T.beat(b17 + 5), cell: [1, 2, 3, 4], pan: 0.7 },
    ];
    WORKERS.forEach((w, wi) => {
      foley(w.knock, woodKnock(seed, wi), { part: 'knock', db: LV.knock, pan: w.pan, sends: { hall: 0.2 } });
      const from = w.knock + T.beats(1);
      let c = 0;
      for (let bar = T.position(from).bar; bar < b27; bar++)
        for (const b of w.cell) {
          const at = T.beat(bar, b);
          // the last note a beat before the rest, so no Worker rings into it
          if (at < from || at >= m.rest[0] - T.beats(1)) continue;
          const key = wi * 100 + c++;
          const wall = smooth((at - m.stepDown) / (m.rest[0] - m.stepDown));
          const clip = marimba(w.midi, { seed, k: 7000 + key, vel: 0.55 + 0.2 * rand(seed, 'worker-vel', key), bright: 0.5, cents: 4 * (rand(seed, 'worker-cents', key) - 0.5) });
          mx.add(at, clip, { bus: 'workers', part: 'workers', db: LV.workers, pan: w.pan, sends: { hall: 0.22 * (1 - 0.8 * wall) } });
        }
    });

    // C12: the other Workers' status dots hop up on the beat; the Router's one reply reaches you
    foley(T.beat(b17 + 7, 1), inkClick(seed, 0), { part: 'status-dot', db: LV.click, pan: 0.4 });
    foley(T.beat(b17 + 7, 2), inkClick(seed, 1), { part: 'status-dot', db: LV.click, pan: 0.6 });
    music(T.beat(b17 + 7, 3), feltPiano(D4, { seed, k: 30, vel: 0.65 }), { part: 'reply', db: LV.piano - 3, pan: -0.6, sends: { hall: 0.35 } });

    // C13, bar 26: the Workers step down, heard through a wall
    throughWall(mx, m);
  }

  // ===== bar 27: the rest, the pad and two plucks ==================================================
  music(m.rest[0], brightPluck(A4, { seed, k: 40, vel: 0.6, t60: 1.5, bright: 0.55 }), { part: 'rest-pluck', db: LV.restPluck, pan: -0.15, sends: { hall: 0.35, echo: 0.15 } });
  music(m.rest[0] + T.beats(2), brightPluck(D5, { seed, k: 41, vel: 0.6, t60: 1.5, bright: 0.55 }), { part: 'rest-pluck', db: LV.restPluck, pan: 0.15, sends: { hall: 0.35, echo: 0.15 } });

  return fx;
}

/**
 * The Workers' bus through a wall: over bar 26 a low-pass closes from 16 kHz to 650 Hz and the
 * level falls 8 dB (in place, before the mixdown). The filter runs over the whole bus, open
 * before the step-down, so it never starts mid-note.
 */
function throughWall(mx: Mixer, m: Marks): void {
  const bus = mx.bus('workers');
  const fl = new Svf();
  const fr = new Svf();
  const span = m.rest[0] - m.stepDown;
  let g = 1;
  for (let i = 0; i < bus.l.length; i++) {
    if ((i & 31) === 0) {
      const u = smooth((i - m.stepDown) / span);
      const fc = 16000 * (650 / 16000) ** u;
      fl.set(fc, Math.SQRT1_2);
      fr.set(fc, Math.SQRT1_2);
      g = dbToGain(-8 * u);
    }
    fl.tick(bus.l[i]);
    fr.tick(bus.r[i]);
    bus.l[i] = fl.lp * g;
    bus.r[i] = fr.lp * g;
  }
}
