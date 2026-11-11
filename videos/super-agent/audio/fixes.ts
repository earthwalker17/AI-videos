/**
 * Bars 13-18 (f960-1439): the two easy fixes and the breath (STORYBOARD 3.1-3.3, Sound column).
 *
 *   Fix A, hard left (`fix-a`, f960): its tape runs in (a soft paper slide); then one plodding
 *   marimba note on each of its queue's steps (FIX_A.steps, one station a beat from f980), a
 *   second line a semitone away smearing into each a sixteenth later. While the picture's focus is
 *   on Fix B (FIX_B.in + 10 to BOTH_FIXES, src/desk/actOne.ts FOCUS_A.fixA) it sits back 3 dB.
 *   Fix B, hard right (`fix-b`, f1120): its trays slide in (a soft slide); each reply leaving its
 *   tray (FIX_B.replies, reply7) is a bright pluck panned by its tray, with a long echo so they
 *   scatter; each reply landing in your in-tray (17 f later: 3 f anticipation and a 14 f arc,
 *   src/desk/beat3.ts replyLandsB) is a reply chirp, so the chirps cluster where you are. The
 *   follow-up landing in the wrong tray (FIX_B.followUp) is a muted pluck; on `fix-b-break` the
 *   stub tears off (a short paper tear).
 *   Bar 18: the split stops on the downbeat (a hard cut, index.ts; Fix A's last two steps before
 *   the breath are left silent) and a Dsus2 hangs alone on felt piano, damped into `rest-breath`.
 */
import { rand } from '@aiv/core';
import { BOTH_FIXES, FIX_A, FIX_B } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { paperTear, sketchScratch } from './foley.ts';
import { brightPluck, chirp, feltPiano, marimba, smear } from './instruments.ts';

const { D3, E3, F3, G3, A3, D4, E4, D5, E5, G5, A5, C6, D6 } = M;

/** A reply posted from its tray lands in your in-tray this many frames later (src/desk/beat3.ts: 3 f anticipation + B_ARC 14 f). */
export const REPLY_FLIGHT = 17;

export function fixes(d: Desk): void {
  const { T, seed, m, music, foley } = d;
  const SR = T.ctx.sampleRate;

  // ===== Fix A, hard left ========================================================================
  foley(T.cue('fix-a'), sketchScratch(seed, { len: 0.6, k: 3 }), { part: 'slide', db: LV.slide, pan: -0.95, sends: { hall: 0.15 } });
  const PLOD = [D3, E3, F3, E3, D3, E3, F3, G3, F3, E3, D3, E3, F3, G3, F3, E3, D3, E3, F3, E3];
  const focusB: [number, number] = [d.f(FIX_B.in + 10), d.f(BOTH_FIXES)];
  FIX_A.steps
    .map((frame) => d.f(frame))
    .filter((at) => at < m.question)
    .forEach((at, j) => {
      const midi = PLOD[j % PLOD.length];
      const lvl = at >= focusB[0] && at < focusB[1] ? -3 : 0;
      music(at, marimba(midi, { seed, k: 5000 + j, vel: 0.7, bright: 0.25, tau: 0.45 }), { part: 'plod', db: LV.plod + lvl, pan: -1, sends: { hall: 0.2 } });
      music(at + T.beats(0.25), smear(midi + 1, midi, { len: 0.55, glide: 0.35, vel: 0.7 }), { part: 'smear', db: LV.smear + lvl, pan: -0.9, sends: { hall: 0.25 } });
    });

  // ===== Fix B, hard right =======================================================================
  foley(T.cue('fix-b'), sketchScratch(seed, { len: 0.5, k: 4 }), { part: 'slide', db: LV.slide, pan: 0.95, sends: { hall: 0.15 } });
  const NOTES = [D5, E5, G5, A5, C6, D6];
  const trayPan = (k: number) => 0.72 + 0.035 * k;
  [...FIX_B.replies, FIX_B.reply7].forEach((post, k) => {
    const at = d.f(post);
    const midi = NOTES[Math.floor(rand(seed, 'stub-note', k) * NOTES.length)];
    const pluck = brightPluck(midi, { seed, k: 300 + k, vel: 0.6 + 0.3 * rand(seed, 'stub-vel', k), t60: 0.5 + 0.6 * rand(seed, 'stub-t60', k) });
    music(at, pluck, { part: 'stubs', db: LV.stubs, pan: trayPan(k), sends: { hall: 0.2, echo: 0.3 } });
    const lands = d.f(post + REPLY_FLIGHT);
    if (lands >= m.question) return;
    const f0 = 1500 + 800 * rand(seed, 'reply-pitch', k);
    const reply = chirp({ f0, f1: f0 * 1.45, len: 0.05 + 0.03 * rand(seed, 'reply-len', k), vel: 0.6 });
    music(lands, reply, { part: 'replies', db: LV.replies, pan: 0.35 + 0.25 * rand(seed, 'reply-pan', k), sends: { hall: 0.15 } });
  });
  // the follow-up lands in tray 6, away from its task's tray 2; then tray 2's stub tears off
  music(d.f(FIX_B.followUp), brightPluck(G5, { seed, k: 320, vel: 0.6, t60: 0.25, bright: 0.45 }), { part: 'follow-up', db: LV.stubs - 4, pan: trayPan(6), sends: { hall: 0.15 } });
  foley(T.cue('fix-b-break'), paperTear(seed, 0), { part: 'tear', db: LV.tear, pan: trayPan(2), sends: { hall: 0.1 } });

  // ===== bar 18: a Dsus2 hangs alone, damped into the breath =========================================
  [D3, A3, D4, E4].forEach((midi, j) => {
    const roll = Math.round(j * 0.012 * SR);
    const hold = (m.breath[0] - m.question - roll) / SR - 0.25;
    music(m.question + roll, feltPiano(midi, { seed, k: 20 + j, vel: 0.6, hold, damp: 0.16 }), { part: 'dsus2', db: LV.dsus2, pan: -0.15 + 0.1 * j, sends: { hall: 0.25 } });
  });
}
