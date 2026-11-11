/**
 * Bars 63-68 (f4960-5439): beat 10, still open (STORYBOARD 10.1-10.3, Sound column), on BEAT_10's contact frames. The
 * two beats of `silence-intrusion` are digital silence (index.ts); continuity.ts brings the pad back after them as a
 * drone swell, and holds the "?"'s suspension, the borrowed iv that detunes into two, and bar 67's suspension.
 *
 *   10.1  the hatched slip glides in silence; on `intrusion` a low D-E♭ minor second on felt piano as the drone
 *         swells in; the etch reaches the machines one per beat (`etch-1..3`): one descending marimba note each
 *         (F♯4, D4, B3), dulled (the etch kills their gloss), no alarm; the "?" settles on the pad's suspended
 *         chord (a pencil stroke as it is drawn)
 *   10.2  the Register splits in pencil and the Router's chord detunes into two (continuity.ts, from
 *         BEAT_10.split); its tape tears (a paper tear); for one beat Fix A's and Fix B's grey-stock cards rise
 *         either side: a ghost of each, hard left and hard right as in beat 3 (a plodding marimba D3, a bright
 *         pluck), far down; the reel's outer windings fade into pencil with a "?" (a pencil stroke)
 *   10.3  your lamp reaches for a running bay (one felt-piano G4, the suspension's fourth, unresolved); a pencil
 *         handle and "?" (a pencil stroke); bar 68's handshake: the report card ejects (an ink click), is stamped
 *         in (a print tap, and reporting back falls D5 to A4 on the mallet), and the reply lands in your in-tray (a
 *         soft pop); then nothing new until the stamp (the pad holds)
 */
import { BEAT_10 } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { inkClick, paperTear, printTap, sketchScratch, softPop } from './foley.ts';
import { brightPluck, feltPiano, fmMallet, marimba } from './instruments.ts';
import { X, panAt } from './places.ts';

const { D3, Eb3, B3, D4, Fs4, G4, A4, D5 } = M;

/** The etch's notes, one per machine (north to south), descending. */
export const ETCH_NOTES: readonly number[] = [Fs4, D4, B3];

/** The ticks this part marks (continuity.ts leaves those beats to it): the second etch, the "?", the split, the handle, the stamp-in, the reply. */
export const openBeats = (d: Desk): number[] => [BEAT_10.etch[1], BEAT_10.query, BEAT_10.split, BEAT_10.handle, BEAT_10.stampIn, BEAT_10.replyLands].map((f) => d.f(f));

export function open(d: Desk): void {
  const { T, seed, music, foley } = d;
  const B = BEAT_10;

  // ===== 10.1: the minor second, the etch, the "?" ===========================================================
  const intr = d.f(B.hatch.register);
  [D3, Eb3].forEach((midi, j) => music(intr + j * T.s(0.012), feltPiano(midi, { seed, k: 50 + j, vel: 0.75 }), { part: 'intrusion', db: LV.piano - 3, pan: panAt(X.throat, B.hatch.register) - 0.1 + 0.2 * j, sends: { hall: 0.3 } }));
  B.etch.forEach((f, i) => music(d.f(f), marimba(ETCH_NOTES[i], { seed, k: 7700 + i, vel: 0.75, bright: 0.2, tau: 0.6 }), { part: 'etch', db: LV.etch, pan: panAt(X.machines[i], f), sends: { hall: 0.3 } }));
  foley(d.f(B.query), sketchScratch(seed, { len: 0.3, k: 9 }), { part: 'pencil', db: LV.pencil, pan: panAt(X.query, B.query), sends: { hall: 0.1 } });

  // ===== 10.2: the split (continuity.ts), the tear, the two fixes for one beat, the windings ====================
  foley(d.f(B.tear), paperTear(seed, 1), { part: 'tear', db: LV.tear, pan: panAt(X.tape, B.tear), sends: { hall: 0.1 } });
  const cards = d.f(B.cards.rise);
  music(cards, marimba(D3, { seed, k: 7710, vel: 0.7, bright: 0.25, tau: 0.45 }), { part: 'fix-echo', db: LV.fixEcho, pan: -0.9, sends: { hall: 0.25 } });
  music(cards, brightPluck(D5, { seed, k: 342, vel: 0.6, t60: 0.6 }), { part: 'fix-echo', db: LV.fixEcho, pan: 0.9, sends: { hall: 0.2, echo: 0.2 } });
  foley(d.f(B.windings), sketchScratch(seed, { len: 0.4, k: 10 }), { part: 'pencil', db: LV.pencil - 2, pan: panAt(X.reel, B.windings), sends: { hall: 0.1 } });

  // ===== 10.3: the reach, the handle, bar 68's handshake ==========================================================
  music(d.f(B.reach), feltPiano(G4, { seed, k: 33, vel: 0.55, hold: 1.5 }), { part: 'reach', db: LV.reach, pan: panAt(X.lampHead, B.reach), sends: { hall: 0.35 } });
  foley(d.f(B.handle), sketchScratch(seed, { len: 0.22, k: 11 }), { part: 'pencil', db: LV.pencil - 2, pan: panAt(X.handle, B.handle), sends: { hall: 0.1 } });
  foley(d.f(B.reportUp), inkClick(seed, 22), { part: 'ink-click', db: LV.click, pan: panAt(X.bugBay, B.reportUp) });
  const stampIn = d.f(B.stampIn);
  foley(stampIn, printTap(seed, 9), { part: 'print', db: LV.print, pan: panAt(X.printHead, B.stampIn), sends: { hall: 0.1 } });
  [D5, A4].forEach((midi, j) => music(stampIn + j * T.beats(0.5), fmMallet(midi, { vel: 0.8, tau: 0.3 }), { part: 'report', db: LV.report - 2 * j, pan: panAt(X.printHead, B.stampIn) + 0.1, sends: { hall: 0.3, echo: 0.2 } }));
  foley(d.f(B.replyLands), softPop(seed, 0), { part: 'pop', db: LV.pop, pan: panAt(X.inTray, B.replyLands), sends: { hall: 0.15 } });
}
