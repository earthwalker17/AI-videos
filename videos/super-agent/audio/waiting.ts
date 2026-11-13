/**
 * Bars 44-49 (f3440-3919): beat 7, waiting handed over (STORYBOARD 7.1-7.4, Sound column), on BEAT_7's contact
 * frames. The pad (D major), the bass pulse and the ticks on 2 and 4 are continuity.ts's.
 *
 *   7.1  the Thread cord pays out from the chat spool to its bay (a soft twisted friction, panned along it); a
 *        follow-up clips on at the spool (a damped pluck runs the cord) and rides it over the Register: as it
 *        crosses the guide (`flyover`) the motif sounds an octave up, quickly over the bar line (A5 a sixteenth
 *        before, D6 on it) and the Router's pulse is skipped on that beat (continuity.ts); the faint notice row
 *        prints on the tape in silence (the Router hears of it without deciding: no detent, no tap under the D6)
 *   7.2  the decision tally prints beside the reel (a print tap); the ghost tally rises silently and is struck (an
 *        ink click and a dry scratch, `strike-tally`); the pulse carries on
 *   7.3  the door ghost is struck (a softer scratch); a second follow-up clips on (a softer pluck); on `job-peel`
 *        the long test peels off as a capsule: the bug bay's marimba A4 is struck and held as a tone that goes off
 *        to the side rail over its 10 f arc (the rail lies on the bay floor's south edge, under the bay on screen, so
 *        the tone does not travel across the image: it recedes, 5 dB down and darker), runs its lap there, and comes
 *        back over the dock's 8 f; on `job-dock` it docks back as a chord (D4 F♯4 A4 on
 *        marimba, with the Router's pulse). Between, the "started" receipt (a tiny ink click), the sand-glass docking on the job rail (the
 *        chore's own sound handed over: a short trickle, as beat 5's key docked as its woodblock) and the
 *        Productive plate (an enamel tap)
 *   7.4  the index turns west on its own frame, between beats (a detent tick, the arm's; the Router's tick keeps its
 *        own beat after it); the chat reply lands in your in-tray (one felt-piano note, light); the dossier lands in
 *        the repo port (its edge's slap and a paper thump, heavy; the bass stands aside on that beat)
 */
import { BEAT_7 } from '../src/cues.ts';
import { OnePole, SR, TAU, clamp, dbToGain } from '@aiv/pipeline/audio/kit';
import { LV, M, panned, type Desk } from './common.ts';
import { cordRun, inkClick, paperThump, paperTick, plateTap, printTap, sandTrickle, sketchScratch } from './foley.ts';
import { bowedNote, brightPluck, feltPiano, marimba, woodTick } from './instruments.ts';
import { X, panAt } from './places.ts';

const { A3, D4, Fs4, A4, D5, A5, D6 } = M;

/** The ticks this part marks (continuity.ts leaves those beats to it): the glass docking. (The index turns west off the beat, 6 f before the reply leaves: its detent is its own and the Router's tick on bar 48 beat 4 sounds after it.) */
export const waitingBeats = (d: Desk): number[] => [d.f(BEAT_7.glass.dock)];

/** How far out the capsule is at film frame f: 0 in its bay, 1 on the side rail; out over the peel's arc (after its 3 f anticipation), back over the dock's 8 f. */
export function capsuleAway(f: number): number {
  const { lift, rail, dockFrom, dock } = BEAT_7.peel;
  if (f <= lift + 3 || f >= dock) return 0;
  if (f < rail) return (f - lift - 3) / (rail - lift - 3);
  if (f < dockFrom) return 1;
  return 1 - (f - dockFrom) / (dock - dockFrom);
}

/** The capsule's pan at film frame f: from the bay out to the side rail over the peel's arc, held, and back over the dock (the rail lies under the bay on screen, so it barely moves). */
export function capsulePan(f: number): number {
  const bay = panAt(X.bugBay, f);
  return bay + (panAt(X.sideRail, f) - bay) * capsuleAway(f);
}

/**
 * On the side rail the capsule's tone is further off, not across the image (the rail lies under its bay): this much
 * quieter and darker (a one-pole low-pass down to `cutoff` Hz). Its hall send (RAIL_DISTANCE.hall) is fixed, so the
 * wet part falls with the dry and the level and the darkening carry the distance.
 */
export const RAIL_DISTANCE = { db: -5, cutoff: 900, hall: 0.5 } as const;

/** A held tone heard `far(t)` of RAIL_DISTANCE off (0..1, t in s from its start): its level and a one-pole low-pass (open at 9 kHz) follow it, read every 32 samples. */
function distant(clip: Float32Array, far: (t: number) => number): Float32Array {
  const out = new Float32Array(clip.length);
  const lp = new OnePole(1 / (TAU * 9000));
  let g = 1;
  for (let i = 0; i < clip.length; i++) {
    if ((i & 31) === 0) {
      const a = clamp(far(i / SR));
      g = dbToGain(RAIL_DISTANCE.db * a);
      lp.setTau(1 / (TAU * 9000 * (RAIL_DISTANCE.cutoff / 9000) ** a));
    }
    out[i] = lp.tick(clip[i] * g);
  }
  return out;
}

export function waiting(d: Desk): void {
  const { T, seed, music, foley } = d;
  const fps = T.ctx.fps;
  const B = BEAT_7;

  // ===== 7.1: the cord pays out; a follow-up clips on and rides over the Register ======================
  const run = (B.cordTaut - B.cordOut) / fps;
  const cordPan = (t: number) => panAt(X.spool + (X.terminal - X.spool) * Math.min(1, t / run), B.cordOut + t * fps);
  foley(d.f(B.cordOut), panned(cordRun(seed, { len: run, k: 0 }), cordPan), { part: 'cord-run', db: LV.cordRun, pan: 0, sends: { hall: 0.1 } });
  B.riders.forEach((r, i) => {
    music(d.f(r.clipOn), brightPluck(A3, { seed, k: 330 + i, vel: 0.65, t60: 0.4, bright: 0.5 }), { part: 'cord-pluck', db: LV.cordPluck - 3 * i, pan: panAt(X.spool, r.clipOn), sends: { hall: 0.2 } });
  });
  const guide = d.f(B.riders[0].guide);
  // the A5 is a pickup, 2 dB under the D6 on the guide: with the limiter at -3.5 dBTP (index.ts AAC_MARGIN_DB 2.0) an
  // equal A5 still rang loud enough that the D6's attack was no onset (`flyover` heard by no onset finder, session 6)
  const flyover = { pan: panAt(X.mast, B.riders[0].guide), tau: 0.35 };
  d.motif(guide - T.beats(0.25), { ...flyover, db: LV.motif - 4, notes: [A5] });
  d.motif(guide, { ...flyover, db: LV.motif - 2, notes: [D6] });

  // ===== 7.2: the decision tally, and its ghost struck ===================================================
  const reel = (f: number) => panAt(X.reel, f);
  foley(d.f(B.tally.print), printTap(seed, 4), { part: 'tally', db: LV.tally, pan: reel(B.tally.print), sends: { hall: 0.1 } });
  // the ink rule's contact, then its dry stroke: the click carries the hit over the bass pulse on the same beat
  const struck = d.f(B.tally.ghostStrike);
  foley(struck, inkClick(seed, 23), { part: 'strike', db: LV.contact, pan: reel(B.tally.ghostStrike) });
  foley(struck, sketchScratch(seed, { len: 0.22, k: 6, dry: true, attack: 0.002 }), { part: 'strike', db: LV.strike, pan: reel(B.tally.ghostStrike), sends: { hall: 0.1 } });

  // ===== 7.3: the door ghost; the job peels off as a capsule and docks back as a chord =====================
  foley(d.f(B.doorGhost.strike), sketchScratch(seed, { len: 0.2, k: 7, dry: true }), { part: 'strike', db: LV.strike - 3, pan: panAt(X.bugDoor, B.doorGhost.strike), sends: { hall: 0.1 } });
  const peel = d.f(B.peel.lift);
  const dock = d.f(B.peel.dock);
  music(peel, marimba(A4, { seed, k: 7400, vel: 0.75, bright: 0.6 }), { part: 'capsule', db: LV.capsuleStrike, pan: capsulePan(B.peel.lift), sends: { hall: 0.25 } });
  // the held tone: in under the strike, further off (quieter, darker, more of the hall) as it runs out to the rail, back as it docks, released into the chord
  const held = (dock - peel) / SR;
  const tone = distant(bowedNote(A4, { seed, k: 7410, len: held + 0.3, attack: 0.12, release: 0.3, vibrato: 3 }), (t) => capsuleAway(B.peel.lift + t * fps));
  music(peel, panned(tone, (t) => capsulePan(B.peel.lift + t * fps)), { part: 'capsule', db: LV.capsule, pan: 0, sends: { hall: RAIL_DISTANCE.hall } });
  foley(d.f(B.peel.receipt), inkClick(seed, 20), { part: 'receipt', db: LV.receipt, pan: capsulePan(B.peel.receipt) });
  const rail = (f: number) => panAt(X.glassDocked, f);
  // act one's trickle handed over, 2 dB fuller: here it docks over the pad and the held capsule (at LV.trickle it sat 20 dB under the bed)
  foley(d.f(B.glass.dock), sandTrickle(seed, { len: 0.7, k: 1 }), { part: 'trickle', db: LV.trickle + 2, pan: rail(B.glass.dock) });
  foley(d.f(B.glass.plateDock), plateTap(seed, 2), { part: 'plate', db: LV.plate, pan: rail(B.glass.plateDock), sends: { hall: 0.2 } });
  [D4, Fs4, A4].forEach((midi, j) => {
    music(dock + j * T.s(0.003), marimba(midi, { seed, k: 7420 + j, vel: 0.75, bright: 0.55 }), { part: 'dock-chord', db: LV.dockChord, pan: capsulePan(B.peel.dock) - 0.06 + 0.06 * j, sends: { hall: 0.3 } });
  });

  // ===== 7.4: two replies, two weights ======================================================================
  music(d.f(B.reply.indexWest), woodTick(1180, { seed, k: 502, vel: 0.7 }), { part: 'arm-tick', db: LV.armTick, pan: panAt(X.index, B.reply.indexWest), sends: { hall: 0.15 } });
  music(d.f(B.reply.lands), feltPiano(D5, { seed, k: 32, vel: 0.6, hold: 0.8 }), { part: 'reply', db: LV.piano - 3, pan: panAt(X.inTray, B.reply.lands), sends: { hall: 0.3 } });
  // the heavy dossier: its edge slaps (the contact), then its weight thuds
  const port = panAt(X.repoPort, B.dossier.lands);
  foley(d.f(B.dossier.lands), paperTick(seed, 1), { part: 'dossier', db: LV.contact - 2, pan: port });
  foley(d.f(B.dossier.lands), paperThump(seed, 4), { part: 'dossier', db: LV.dossier, pan: port, sends: { hall: 0.12 } });
}
