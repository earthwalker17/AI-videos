/**
 * Bars 30-43 (f2320-3439): prompting each run handed over, and how one Router keeps up
 * (STORYBOARD 5.1-6.4, Sound column). The pad, the bass pulse and the ticks are continuity.ts's.
 *
 *   5.1  `key-dock` the starter key docks on the intake (a woodblock tap, the chore's sound handed
 *        over) and `plate-proactive` the Proactive plate docks (an enamel tap); each event that
 *        then arrives by itself strikes the docked key (BEAT_5.trips: a dry wood tick; each kept ask
 *        strikes it too, KEY_STRIKE_LEAD frames before it lands, a softer tick); a soft sixteenth
 *        pulse rises under the pad (the Router listening), full by `spike-in` (a small detent: the
 *        spike stands up), and gives way on the last beat of bar 34
 *   5.2  each slip at the gate (BEAT_5.slips): flipped onto the spike, a muted clack panned at the
 *        spike as it is impaled (f + impale); kept, a soft bell as the loupe notches it (f + notchAfter)
 *   6.1  batching (BEAT_6.batches): each waiting slip butting into the strip is a soft held tick,
 *        its pitch held under it; on the sweep (`batch`, `batch-2`) the held pitches are released
 *        as one struck chord on the downbeat (its notes 3 ms apart): five notes, then eight for the longer strip
 *   6.2  `plate-detent` the stress plate sets: a soft mechanical detent; on bar 39's downbeat it lifts off
 *        its hooks and flies back out (a dry unhook)
 *   6.3  `cache-eject` the report card ejects (an ink click); `cache-fold` the body folds (paper),
 *        and a pointer tick as its tab lands in the drawer 16 f later (src/desk/state.ts EVENTS_C:
 *        fold 8 f, a 2 f hold, the tab's 6 f drop)
 *   6.4  `review-card` the review comment enters the throat (a click); `review-in` it is stamped in
 *        (a print tap, in place of that beat's tick); `recall` the reel rewinds over 24 f (a
 *        ratchet); the thread's hops (`hop-1..3`) are motif fragments, A4, D5, A4 (never F♯5: the
 *        stamp keeps it); `recall-answer` a short felt-piano note goes back
 */
import { rand } from '@aiv/core';
import { BEAT_5, BEAT_6 } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { detent, gateClack, inkClick, paperFold, plateTap, pointerTick, printTap, ratchet, unhook, woodblockHop } from './foley.ts';
import { bowedNote, feltPiano, fmMallet, loupeBell, marimba, softPulse, woodTick } from './instruments.ts';

const { D3, A3, D4, Fs4, A4, D5, E5, A5 } = M;

/** The batch chords: one pitch per waiting slip (five, then eight); F♯5 stays the stamp's. */
export const BATCH_CHORDS: readonly (readonly number[])[] = [
  [D4, Fs4, A4, D5, E5],
  [D3, A3, D4, Fs4, A4, D5, E5, A5],
];
/** Where the gate's spike and the Register's throat sit across the frame (FRAMING_B: centre x -200, 1129 u half-width; layout.ts SPIKE x -646). */
const SPIKE_PAN = -0.4;
const THROAT_PAN = -0.05;
/** A kept ask strikes the docked key this long before it lands past the gate (src/desk/beat5.ts KICK_FLY; held by score.test.ts). */
export const KEY_STRIKE_LEAD = 6;
/** The tab lands in the drawer this long after the fold starts (src/desk/state.ts EVENTS_C: foldFrames 8 + 2 f hold + tabFrames 6). */
export const TAB_LANDS = 16;

/** The stress plate lifts off its hooks on this film frame (src/desk/beat6.ts E6.plateExit; held by score.test.ts). */
export const PLATE_UNHOOK = 3040;

/** The samples this part marks on a beat the Router's tick would also sound (continuity.ts leaves them to it). */
export const keepUpBeats = (d: Desk): number[] => [d.f(BEAT_6.recall.stampIn)];

export function keepUp(d: Desk): void {
  const { T, seed, music, foley } = d;
  const SR = T.ctx.sampleRate;

  // ===== 5.1: the key and the plate dock; the sixteenth pulse rises =====================================
  foley(T.cue('key-dock'), woodblockHop(seed, 950, 880), { part: 'double-tap', db: LV.doubleTap, pan: SPIKE_PAN + 0.05, sends: { hall: 0.1 } });
  foley(T.cue('plate-proactive'), plateTap(seed, 1), { part: 'plate', db: LV.plate, pan: SPIKE_PAN + 0.05, sends: { hall: 0.2 } });
  // events arrive by themselves: each strikes the docked key, a dry wood tick a little higher each time
  BEAT_5.trips.forEach((f, k) => foley(d.f(f), woodTick(1250 + 60 * k, { seed, k: 700 + k, vel: 0.6 }), { part: 'trip', db: LV.trip, pan: SPIKE_PAN + 0.05, sends: { hall: 0.1 } }));
  // and every kept ask strikes it on its way to the gate: the same tick, softer, as the run it starts is routine by now
  BEAT_5.slips.forEach(({ f, keep }, k) => {
    if (keep) foley(d.f(f - KEY_STRIKE_LEAD), woodTick(1370, { seed, k: 710 + k, vel: 0.45 }), { part: 'trip', db: LV.trip - 3, pan: SPIKE_PAN + 0.05, sends: { hall: 0.1 } });
  });
  const pulseFrom = T.beat(30);
  const full = T.cue('spike-in');
  const pulseTo = T.beat(35);
  const PULSE = [D4, A4, D5, A4];
  for (let k = 0; ; k++) {
    const at = pulseFrom + T.beats(k / 4);
    if (at >= pulseTo) break;
    const g = Math.min(1, (at - pulseFrom) / (full - pulseFrom)) * (1 - Math.max(0, (at - (pulseTo - T.beats(1))) / T.beats(1)));
    if (g < 0.05) continue;
    const accent = k % 4 === 0 ? 2 : 0;
    music(at, softPulse(PULSE[k % 4], { vel: 0.6 }), { part: 'pulse', db: LV.pulse + accent + 20 * Math.log10(g), pan: k % 2 ? 0.08 : -0.08, sends: { hall: 0.12 } });
  }
  foley(T.cue('spike-in'), detent(seed, 1), { part: 'detent', db: LV.detent - 2, pan: SPIKE_PAN, sends: { hall: 0.1 } });

  // ===== 5.2-5.3: the two-stage filter ======================================================================
  BEAT_5.slips.forEach(({ f, keep }, k) => {
    if (keep) music(d.f(f + BEAT_5.notchAfter), loupeBell(A5, { vel: 0.55 }), { part: 'bell', db: LV.bell, pan: THROAT_PAN, sends: { hall: 0.3, echo: 0.12 } });
    else foley(d.f(f + BEAT_5.impale), gateClack(seed, k), { part: 'clack', db: LV.clack, pan: SPIKE_PAN + 0.12 * (rand(seed, 'clack-pan', k) - 0.5), sends: { hall: 0.08 } });
  });

  // ===== 6.1-6.2: batching: held ticks released as one chord on the sweep ====================================
  BEAT_6.batches.forEach(({ sweep, slips }, b) => {
    const at = d.f(sweep);
    const chord = BATCH_CHORDS[b];
    slips.forEach((s, i) => {
      const lands = d.f(s);
      foley(lands, woodTick(1400 + 50 * (i % 3), { seed, k: 600 + b * 20 + i, vel: 0.7 }), { part: 'held-tick', db: LV.heldTick, pan: THROAT_PAN, sends: { hall: 0.12 } });
      // its pitch, held quietly under it until the sweep releases it into the chord
      const midi = chord[i % chord.length];
      const release = 0.25;
      d.pad(lands, bowedNote(midi, { seed, k: 900 + b * 20 + i, len: (at - lands) / SR + release, attack: 0.12, release, vibrato: 2 }), { part: 'held-tone', db: LV.heldTone, pan: THROAT_PAN + 0.04 * (i - slips.length / 2), sends: { hall: 0.2 } });
    });
    const thick = b === 1;
    chord.forEach((midi, j) => {
      const pan = -0.3 + (0.6 * j) / (chord.length - 1);
      // low to high, 3 ms apart: one chord to the ear (the eight-note one spans 21 ms), its first note on the downbeat
      const on = at + j * T.s(0.003);
      music(on, marimba(midi, { seed, k: 6500 + b * 20 + j, vel: 0.75, bright: 0.55 }), { part: 'batch', db: LV.batch, pan, sends: { hall: 0.3 } });
      music(on, feltPiano(midi, { seed, k: 6600 + b * 20 + j, vel: 0.6, hold: thick ? 1.6 : 1.0 }), { part: 'batch', db: LV.batch - 3, pan, sends: { hall: 0.3 } });
      if (thick && j >= chord.length - 3) music(on, fmMallet(midi, { vel: 0.7 }), { part: 'batch', db: LV.batch - 6, pan, sends: { hall: 0.3, echo: 0.1 } });
    });
  });
  foley(T.cue('plate-detent'), detent(seed, 0), { part: 'detent', db: LV.detent, pan: 0.3, sends: { hall: 0.12 } });
  foley(d.f(PLATE_UNHOOK), unhook(seed, 0), { part: 'unhook', db: LV.unhook, pan: 0.3, sends: { hall: 0.1 } });

  // ===== 6.3: context as a cache ==============================================================================
  foley(T.cue('cache-eject'), inkClick(seed, 6), { part: 'ink-click', db: LV.click, pan: 0.3 });
  const fold = T.cue('cache-fold');
  foley(fold, paperFold(seed, 0), { part: 'fold', db: LV.fold, pan: THROAT_PAN, sends: { hall: 0.12 } });
  foley(fold + d.f(TAB_LANDS), pointerTick(seed, 0), { part: 'pointer', db: LV.pointer, pan: THROAT_PAN - 0.1, sends: { hall: 0.1 } });

  // ===== 6.4: recall ===========================================================================================
  foley(T.cue('review-card'), inkClick(seed, 7), { part: 'ink-click', db: LV.click - 4, pan: -0.3 });
  foley(T.cue('review-in'), printTap(seed, 2), { part: 'print', db: LV.print, pan: THROAT_PAN, sends: { hall: 0.1 } });
  foley(T.cue('recall'), ratchet(seed, { len: BEAT_6.recall.rewindFrames / T.ctx.fps }), { part: 'ratchet', db: LV.ratchet, pan: THROAT_PAN, sends: { hall: 0.1 } });
  [A4, D5, A4].forEach((midi, i) => {
    music(T.cue(`hop-${i + 1}`), fmMallet(midi, { vel: 0.75, tau: 0.3 }), { part: 'hop-note', db: LV.hopNote, pan: [-0.15, -0.05, 0.35][i], sends: { hall: 0.3, echo: 0.2 } });
  });
  music(T.cue('recall-answer'), feltPiano(D4, { seed, k: 31, vel: 0.6, hold: 0.45 }), { part: 'answer', db: LV.answer, pan: -0.3, sends: { hall: 0.3 } });
}
