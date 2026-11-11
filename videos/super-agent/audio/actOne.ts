/**
 * Bars 1-12 (f0-959): the hook and the human router (STORYBOARD 1.1-2.3, Sound column).
 *
 *   bars 1-5    eight session folders (five at first) each sound a modal-marimba motif in D Dorian
 *               on its own subdivision (3, 4 or 5 a bar, ±12-cent drift): a 3:4:5 polyrhythm. A
 *               folder's motif is as loud as the folder is warm in the picture (the lamp's visits
 *               warm it, it cools with WARMTH.tau). Each swing of your lamp (LAMP_VISITS) is a soft
 *               woodblock, panned to the folder it swings to. f20 (`request`): the request motif,
 *               A4 then D5; the F♮5 after it falls away unfinished. f160 (`title-thump`): a low
 *               felt-piano D and a soft paper thump.
 *   bars 6-11   F6-F8 land on ARRIVE (a soft board landing; their motifs start on it); the swings
 *               go to eighths and sixteenths; a folder left to cool sounds a short falling tone
 *               as its flag snaps up (its warmth falls through WARMTH.flagUp). The four chores, one
 *               a beat: `chore-switch` a marimba rescan run (the notes loop tightens),
 *               `chore-prompt` a woodblock double tap (the key lands, the tray nudges 2 f later),
 *               `chore-wait` a dry granular trickle (the sand-glass), `chore-keep` a low hum held
 *               to the hub (the lid strut).
 *   bar 12      f880 (`hub`): the buses cut, so every voice stops dead; a low felt-piano D and a
 *               dry scratch, damped before `silence-hub` (digital zero, index.ts).
 *
 * The picture's folder positions are copied here (the score may not import src/desk); score.test.ts
 * holds them equal to src/desk/actOne.ts FOLDERS, and the warmth model to the picture's.
 */
import { rand } from '@aiv/core';
import { clamp, gainToDb, seedOf, slowNoise, type Timeline } from '@aiv/pipeline/audio/kit';
import { ARRIVE, BEAT, LAMP_VISITS, WARMTH } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { paperThump, sandTrickle, sketchScratch, woodblockHop } from './foley.ts';
import { fallTone, feltPiano, fmMallet, hum, marimba } from './instruments.ts';

const { D2, D3, G3, A3, B3, C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5 } = M;

/** Each folder's centre x (world u, src/desk/actOne.ts FOLDERS[n - 1].c[0]), folders 1-8. */
export const FOLDER_X: readonly number[] = [-598, -448, -320, -180, -40, 98, 226, 384];
/**
 * Act one's camera across the frame (src/desk/camera.ts; score.test.ts holds these equal): the hook's framing
 * (FRAMING_HOOK, centre x -600 at 1.6×) until f160, then ACT_ONE_MOVE on the camera token, cubic-bezier(.65, 0, .35, 1),
 * to FRAMING_A (centre x -296 at 1.2×) by f320, its zoom even in log scale and its centre trucking with 1/zoom (camera.ts moveFraming).
 */
export const ACT_ONE_CAMERA = { hook: { x: -600, zoom: 1.6 }, a: { x: -296, zoom: 1.2 }, from: 160, to: 320 } as const;
/** The camera token: cubic-bezier(.65, 0, .35, 1) at progress t (Newton's method on the curve's x, then its y). */
export function cameraEase(t: number): number {
  const [x1, y1, x2, y2] = [0.65, 0, 0.35, 1];
  const bez = (u: number, p1: number, p2: number) => 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u;
  const dBez = (u: number, p1: number, p2: number) => 3 * (1 - u) * (1 - u) * p1 + 6 * (1 - u) * u * (p2 - p1) + 3 * u * u * (1 - p2);
  let u = t;
  for (let i = 0; i < 8; i++) {
    const dx = dBez(u, x1, x2);
    if (Math.abs(dx) < 1e-9) break;
    u = clamp(u - (bez(u, x1, x2) - t) / dx, 0, 1);
  }
  return bez(u, y1, y2);
}
/** The frame's centre x and the half-width it shows (960 px / zoom) at film frame f. */
export function actOneFrameAt(f: number): { x: number; halfW: number } {
  const { hook, a, from, to } = ACT_ONE_CAMERA;
  const u = f <= from ? 0 : f >= to ? 1 : cameraEase((f - from) / (to - from));
  const r = a.zoom / hook.zoom;
  const w = (1 - r ** -u) / (1 - 1 / r);
  return { x: hook.x + (a.x - hook.x) * w, halfW: 960 / (hook.zoom * r ** u) };
}
/** A folder's pan at film frame f: where it stands across the frame then, a little narrowed. */
export const folderPan = (n: number, f: number): number => {
  const fr = actOneFrameAt(f);
  return clamp((0.9 * (FOLDER_X[n - 1] - fr.x)) / fr.halfW, -0.9, 0.9);
};

interface Tile {
  /** its motif, cycled */
  notes: readonly number[];
  /** notes a bar: 3, 4 or 5 (the polyrhythm) */
  perBar: number;
  /** beats after the downbeat of its first note (folders 1-5) */
  offset: number;
}
/** Folders 1-8's motifs (the sketch's tiles, in folder order); F6-F8 start on their arrival. D Dorian throughout. */
const TILES: readonly Tile[] = [
  { notes: [D4, F4, A4, G4], perBar: 4, offset: 0 },
  { notes: [D3, A3, C4], perBar: 3, offset: 0 },
  { notes: [A4, C5, D5, E5, G4], perBar: 5, offset: 0 },
  { notes: [F4, E4, D4, C4], perBar: 4, offset: 0.5 },
  { notes: [G3, B3, D4], perBar: 3, offset: 0.5 },
  { notes: [E5, D5, B4, A4, C5], perBar: 5, offset: 0.4 },
  { notes: [C5, A4, F4, A4], perBar: 4, offset: 0.25 },
  { notes: [B3, D4, F4], perBar: 3, offset: 0.5 },
];
/** a motif never falls under this (gain) */
const DIM = 0.1;

/** The lamp's swings (LAMP_VISITS) as placed: the sample, the folder, and the gap to the next swing in beats (the last: a sixteenth). */
export function swings(T: Timeline): { at: number; frame: number; folder: number; step: number }[] {
  return LAMP_VISITS.map(([frame, folder], k) => {
    const next = LAMP_VISITS[k + 1];
    return { at: T.frame(frame), frame, folder, step: next ? (next[0] - frame) / BEAT : 0.25 };
  });
}

/**
 * A folder's warmth at a film frame, as the picture has it (src/desk/actOne.ts actOneAt): 1 while
 * the lamp attends it (warming over 4 f from where it had cooled to), exp(-(f - left) / tau) after
 * the lamp leaves (the start of the next swing), 0 before its first visit.
 */
export function warmthAt(n: number, f: number): number {
  let k = -1;
  for (let i = 0; i < LAMP_VISITS.length && LAMP_VISITS[i][0] <= f; i++) k = i;
  if (k < 0) return 0;
  let left = -Infinity;
  if (LAMP_VISITS[k][1] === n) {
    for (let i = 0; i < k; i++) if (LAMP_VISITS[i][1] === n) left = LAMP_VISITS[i + 1][0];
    const v0 = LAMP_VISITS[k][0];
    const before = left === -Infinity ? 0 : Math.exp(-(v0 - left) / WARMTH.tau);
    return before + (1 - before) * clamp((f - v0) / 4);
  }
  for (let i = 0; i < k; i++) if (LAMP_VISITS[i][1] === n) left = LAMP_VISITS[i + 1][0];
  return left === -Infinity ? 0 : Math.exp(-(f - left) / WARMTH.tau);
}

/** The film frames (fractional) where a folder's flag snaps up before `before`: its warmth falls through WARMTH.flagUp with no visit to come first. */
export function flagSnaps(before: number): { frame: number; folder: number }[] {
  const out: { frame: number; folder: number }[] = [];
  const cool = WARMTH.tau * Math.log(1 / WARMTH.flagUp);
  LAMP_VISITS.forEach(([, n], k) => {
    if (k + 1 >= LAMP_VISITS.length) return;
    const left = LAMP_VISITS[k + 1][0];
    let next = Infinity;
    for (let j = k + 1; j < LAMP_VISITS.length; j++)
      if (LAMP_VISITS[j][1] === n) {
        next = LAMP_VISITS[j][0];
        break;
      }
    const snap = left + cool;
    // the visit's next swing must be to another folder (else the lamp has not left), and it must cool before it returns
    if (LAMP_VISITS[k + 1][1] !== n && snap < next && snap < before) out.push({ frame: snap, folder: n });
  });
  return out.sort((a, b) => a.frame - b.frame);
}

export function actOne(d: Desk): void {
  const { T, seed, m, music, foley } = d;
  const fps = T.ctx.fps;
  const toFrame = (s: number) => (s * fps) / T.ctx.sampleRate;

  // ===== the folder motifs, lit by the folders' warmth ===========================================
  TILES.forEach((tile, i) => {
    const n = i + 1;
    const drift = slowNoise(seedOf(seed, 'tile-drift', i), 0.22);
    const arrive = ARRIVE[n];
    const onsets: number[] = [];
    if (arrive === undefined) {
      for (let bar = 1; T.beat(bar) < m.hub; bar++) for (let j = 0; j < tile.perBar; j++) onsets.push(T.beat(bar, 1 + tile.offset + (j * 4) / tile.perBar));
    } else {
      // a spawned folder's motif starts on the frame its board lands
      const t0 = d.f(arrive);
      for (let j = 0; t0 + T.beats((j * 4) / tile.perBar) < m.hub; j++) onsets.push(t0 + T.beats((j * 4) / tile.perBar));
      foley(t0, paperThump(seed, 10 + n), { part: 'board-lands', db: LV.boardLands, pan: folderPan(n, arrive), sends: { hall: 0.1 } });
    }
    onsets
      .filter((at) => at < m.hub)
      .forEach((at, c) => {
        const w = warmthAt(n, toFrame(at));
        // the motif's gain is the warmth squared: it falls about as fast as the sketch's 1.6 s light, and sits at its floor when the flag snaps up
        const light = Math.max(DIM, w * w);
        const clip = marimba(tile.notes[c % tile.notes.length], { seed, k: i * 1000 + c, vel: 0.55 + 0.3 * rand(seed, `tile-vel-${i}`, c), cents: 12 * drift(at / T.ctx.sampleRate), bright: 0.35 });
        music(at, clip, { part: 'tiles', db: LV.tiles + gainToDb(light), pan: folderPan(n, toFrame(at)), sends: { hall: 0.25 } });
      });
  });

  // ===== your lamp's swings ======================================================================
  swings(T).forEach(({ at, frame, folder, step }, k) => {
    // the film opens mid-swing: the first swing began before frame 0 (src/desk/actOne.ts PRE_SWING), so its tap is not heard
    if (k === 0) return;
    const db = LV.hop + (step <= 0.25 ? LV.hopSixteenths : step <= 0.5 ? LV.hopEighths : 0);
    foley(at, woodblockHop(seed, k, 760 + 30 * ((folder - 1) % 4)), { part: 'hop', db, pan: folderPan(folder, frame), sends: { hall: 0.12 } });
  });

  // a folder left to cool: a short falling tone as its flag snaps up
  flagSnaps(toFrame(m.hub) - BEAT / 2).forEach(({ frame, folder }) => {
    music(d.f(frame), fallTone(TILES[folder - 1].notes[0] + 12, { vel: 0.6 }), { part: 'tile-fade', db: LV.tileFade, pan: folderPan(folder, frame), sends: { hall: 0.3 } });
  });

  // ===== the hook ================================================================================
  // f20: the request, A4 then D5; the F♮5 after it falls away into the echoes, unfinished
  const req = T.cue('request');
  d.motif(req, { pan: -0.45, db: LV.motif });
  music(req + T.beats(1), fmMallet(F5, { vel: 0.5, droop: 40, droopTime: 0.6, tau: 0.28 }), { part: 'motif-fall', db: LV.motifFall, pan: -0.45, sends: { hall: 0.35, echo: 0.5 } });
  // f160: the title sets; a low felt-piano D and a soft paper thump
  const tt = T.cue('title-thump');
  music(tt, feltPiano(D2, { seed, k: 1, vel: 0.75 }), { part: 'piano', db: LV.piano - 1.5, pan: -0.15, sends: { hall: 0.3 } });
  foley(tt, paperThump(seed, 0), { part: 'paper-thump', db: LV.thump, pan: -0.35, sends: { hall: 0.1 } });

  // ===== the four chores, one a beat (STORYBOARD 2.2) ==============================================
  // remember and switch: the notes loop tightens round your desk, a rescan run up the mode in 32nds
  const sw = T.cue('chore-switch');
  [D4, E4, F4, G4, A4, C5, D5].forEach((midi, j) => {
    music(sw + j * T.beats(0.125), marimba(midi, { seed, k: 9000 + j, vel: 0.45 + 0.06 * j, bright: 0.6, tau: 0.3 }), { part: 'rescan', db: LV.rescan, pan: 0.1 + 0.03 * j, sends: { hall: 0.2 } });
  });
  // prompt each run: the starter key lands in the chore tray, and the tray nudges 2 f later
  const pr = T.cue('chore-prompt');
  foley(pr, woodblockHop(seed, 900, 880), { part: 'double-tap', db: LV.doubleTap, pan: 0.2, sends: { hall: 0.1 } });
  foley(pr + d.f(2), woodblockHop(seed, 901, 820), { part: 'double-tap', db: LV.doubleTap - 4, pan: 0.2, sends: { hall: 0.1 } });
  // wait: the sand-glass lands, and its sand runs (dry)
  foley(T.cue('chore-wait'), sandTrickle(seed, { len: 1.1 }), { part: 'trickle', db: LV.trickle, pan: 0.25 });
  // keep it running: the lid strut props the laptop open; a low hum, held until the hub cuts it
  const keep = T.cue('chore-keep');
  music(keep, hum(D2, { len: (m.hub - keep) / T.ctx.sampleRate + 0.1, attack: 0.25 }), { part: 'hum', db: LV.hum, pan: 0.15 });

  // ===== bar 12: the hub ===========================================================================
  // the buses cut at the hub (index.ts), so the motifs and swings stop dead; the D is damped before the beat of silence
  music(m.hub, feltPiano(D2, { seed, k: 2, vel: 0.85, hold: (m.hush[0] - m.hub) / T.ctx.sampleRate - 0.25, damp: 0.07 }), { part: 'piano', db: LV.piano, pan: 0.15, sends: { hall: 0.25 } });
  // the notes loop closes with its clip: one dry scratch
  foley(m.hub, sketchScratch(seed, { len: 0.3, k: 1, dry: true }), { part: 'ink-scratch', db: LV.scratch, pan: 0.2, sends: { hall: 0.1 } });
}
