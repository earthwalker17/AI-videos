/**
 * Bars 50-57 (f3920-4559): beat 8, many runs, the evidence (STORYBOARD 8.1-8.5, Sound column), on BEAT_8's contact
 * frames and the hero stamps' text windows. continuity.ts has no pad here and keeps the bass on 1 and 3 and the ticks
 * on 2 and 4.
 *
 *   8.1  the pulse thins to mallet and bass: a soft FM mallet on 1 and 3 with the bass, tracing the harmony the pad
 *        would hold (D, Bm, G, A over the Router's D, so bar 58's B minor arrives as a deceptive turn); the load
 *        line prints as a soft rain of ticks, the 20 inked ones a little louder, each at its place on the row as the
 *        camera trucks to the sheet
 *   8.2  the caveat stamp inks in (a print tap); each lane's strip sounds one held tone for exactly as long as it
 *        slides (stripFrames x its p95): D4, F♯4, A4, the two baselines lighter than two levels, so the halving is
 *        heard as the A4 stopping first; the hero stamp "~½" (a print tap)
 *   8.3  the bracket springs: a soft tick in an open fifth (D5 and A5); "~10%" (a print tap)
 *   8.4  the told-to-delegate lane's notches on eighths: a muted click for each punched one, nothing for the run
 *        that did the work itself, whose long tail then slides out as one held tone (F♯4, the lane's)
 *   8.5  the token stacks: three soft rising notes (A4, C♯5, E5) on their completions, the last heavier (an E4
 *        under it); "2–4×" lands on it (a print tap), and the mallet stands aside on that beat
 */
import { BEAT_8, cue, textWindow } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { gateClack, printTap, tickRain } from './foley.ts';
import { brightPluck, fmMallet, marimba, stripTone } from './instruments.ts';
import { SCREEN, panAt, screenPan } from './places.ts';

const { G3, A3, B3, Cs4, D4, E4, Fs4, A4, Cs5, D5, E5, A5 } = M;

/** The thinned pulse: [beat 1, beat 3] per bar, 50-57. */
const PULSE: readonly (readonly [number, number])[] = [
  [D4, Fs4],
  [D4, Fs4],
  [B3, D4],
  [B3, D4],
  [G3, B3],
  [G3, B3],
  [A3, Cs4],
  [A3, Cs4],
];
/** Each lane's strip tone (one session, told to delegate, two levels). */
export const STRIP_NOTES: readonly number[] = [D4, Fs4, A4];
/** The hero stamps, by text cue. */
export const STAMPS = ['stamp-half', 'stamp-ten', 'stamp-tokens'] as const;
/** A stamp's contact: the first frame of its text window (the 3 f ink spread starts there). */
export const stampFrame = (id: string): number => textWindow(cue(id))[0];

/** The ticks this part marks (continuity.ts leaves those beats to it): a punched notch, the long run's slide. */
export const evidenceBeats = (d: Desk): number[] => [d.f(BEAT_8.notches[1].f), d.f(BEAT_8.longRun.from)];

export function evidence(d: Desk): void {
  const { T, seed, music, foley } = d;
  const B = BEAT_8;
  const sheet = screenPan(SCREEN.lanes);
  const lastStack = d.f(B.stacks[B.stacks.length - 1].done);

  // ===== 8.1: the thinned pulse and the rain of ticks =======================================================
  PULSE.forEach((notes, i) =>
    notes.forEach((midi, j) => {
      const at = T.beat(50 + i, 1 + 2 * j);
      if (at === lastStack) return;
      music(at, fmMallet(midi, { vel: 0.6, tau: 0.45 }), { part: 'pulse-mallet', db: LV.pulseMallet, pan: -0.05, sends: { hall: 0.2 } });
    }),
  );
  const inked = new Set<number>(B.ticks.inked);
  const span = B.ticks.to - B.ticks.from;
  const ticks = Array.from({ length: B.ticks.n }, (_, i) => {
    const f = B.ticks.from + (span * i) / B.ticks.n;
    const x = SCREEN.rowFrom + ((SCREEN.rowTo - SCREEN.rowFrom) * i) / (B.ticks.n - 1);
    return { t: (f - B.ticks.from) / T.ctx.fps, amp: inked.has(i) ? 1 : 0.35, pan: panAt(x, f) };
  });
  foley(d.f(B.ticks.from), tickRain(seed, ticks), { part: 'rain', db: LV.rain, pan: 0, sends: { hall: 0.12 } });

  // ===== 8.2: the caveat stamp, the strips as long as their slowest runs, the hero stamps ======================
  foley(d.f(B.caveat), printTap(seed, 5), { part: 'stamp-8', db: LV.stamp8, pan: sheet - 0.1, sends: { hall: 0.1 } });
  B.lanes.forEach((lane, i) => {
    const at = d.f(lane.slide);
    const n = d.f(lane.slide + lane.p95 * B.stripFrames) - at;
    music(at, stripTone(STRIP_NOTES[i], { n, vel: 0.6 }), { part: 'strip', db: i === 2 ? LV.stripHero : LV.strip, pan: sheet + 0.04 * (i - 1), sends: { hall: 0.15 } });
  });
  STAMPS.forEach((id, i) => foley(d.f(stampFrame(id)), printTap(seed, 6 + i), { part: 'stamp-8', db: LV.stamp8, pan: i === 2 ? screenPan(SCREEN.stacks) : sheet + 0.1, sends: { hall: 0.1 } }));

  // ===== 8.3: the bracket, an open fifth ========================================================================
  [D5, A5].forEach((midi, j) => music(d.f(B.bracket), brightPluck(midi, { seed, k: 340 + j, vel: 0.6, t60: 0.25, bright: 0.45 }), { part: 'bracket', db: LV.bracket, pan: sheet, sends: { hall: 0.2 } }));

  // ===== 8.4: the notches, and the long run ======================================================================
  B.notches.forEach(({ f, punched }, i) => {
    if (punched) foley(d.f(f), gateClack(seed, 20 + i), { part: 'notch', db: LV.notch, pan: sheet, sends: { hall: 0.08 } });
  });
  const run = d.f(B.longRun.from);
  music(run, stripTone(STRIP_NOTES[1], { n: d.f(B.longRun.from + B.longRun.frames) - run, vel: 0.6 }), { part: 'strip', db: LV.strip, pan: sheet, sends: { hall: 0.15 } });

  // ===== 8.5: the token stacks, three rising notes, the last heavier ==============================================
  const stacks = screenPan(SCREEN.stacks);
  [A4, Cs5, E5].forEach((midi, i) => {
    const at = d.f(B.stacks[i].done);
    const last = i === B.stacks.length - 1;
    music(at, marimba(midi, { seed, k: 7500 + i, vel: last ? 0.85 : 0.6, bright: 0.45 }), { part: 'stack', db: LV.stack + (last ? 2 : 0), pan: stacks, sends: { hall: 0.25 } });
    if (last) music(at, marimba(E4, { seed, k: 7510, vel: 0.8, bright: 0.4 }), { part: 'stack', db: LV.stack - 1, pan: stacks, sends: { hall: 0.25 } });
  });
}
