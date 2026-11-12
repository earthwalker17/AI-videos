/**
 * Bars 50-57 (f3920-4559): beat 8, many runs, the evidence (STORYBOARD 8.1-8.5, Sound column), on BEAT_8's contact
 * frames and the hero stamps' text windows. continuity.ts has no pad here and keeps the bass on 1 and 3 and the ticks
 * on 2 and 4.
 *
 *   8.1  the pulse thins to mallet and bass: a soft FM mallet on 1 and 3 with the bass (each bass stroke held to the
 *        next, continuity.ts `bassHold`, so no half bar ends in a near-silence), tracing the harmony the pad would hold
 *        (D, Bm, G, A over the Router's D, so bar 58's B minor arrives as a deceptive turn, on one more stroke as the
 *        sheet slides away: B3 and D4 together, the bass's last stroke ending on it, the pad coming back); the load
 *        line prints as a soft rain of ticks, the 20 inked ones a little louder, each at its place on the row as the
 *        camera trucks to the sheet (the sheet lies east of the bays: all of it sounds right of centre)
 *   8.2  the caveat stamp inks in (a print tap); each lane's strip sounds one held tone for exactly as long as it
 *        slides (stripFrames x its p95): D4, F♯4, A4, the two baselines lighter than two levels, so the halving is
 *        heard as the A4 stopping first (the mallet stands aside on bar 51's downbeat, so no stroke doubles them);
 *        the hero stamp "~½" (a print tap) as the pulse comes back on beat 3, once every strip has stopped, on A3, a
 *        pitch none of them held (so it blurs none of their lengths, and bar 51 does not fall silent after them)
 *   8.3  the bracket springs: a soft tick in an open fifth (D5 and A5); "~10%" (a print tap)
 *   8.4  the told-to-delegate lane's notches on eighths: a muted click for each punched one, nothing for the run
 *        that did the work itself (bar 55's downbeat: the bass and the mallet stand aside, so the gap is heard),
 *        whose long tail then slides out as one held tone (F♯4, the lane's); on beat 3 the bass comes back under the
 *        G chord struck whole (G3 and B3), the bar's G its downbeat could not state
 *   8.5  the token stacks: three soft rising notes (A4, C♯5, E5) on their completions, one a beat, the last heavier
 *        (an E4 under it); "2–4×" lands on it (a print tap), and the mallet stands aside on that beat (the second, on
 *        beat 4, stands in for the Router's tick)
 */
import { BEAT_8, cue, textWindow } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { gateClack, printTap, tickRain } from './foley.ts';
import { brightPluck, fmMallet, marimba, stripTone } from './instruments.ts';
import { SHEET_X, panAt } from './places.ts';

const { G3, A3, B3, Cs4, D4, E4, Fs4, A4, Cs5, D5, E5, A5 } = M;

/**
 * The thinned pulse: the notes struck on [beat 1, beat 3] of each bar, 50-57. Bar 51's beat 3 is A3 (the strips have
 * stopped, and none of them held an A3), bar 55's beat 3 the whole G chord (its downbeat is the unpunched notch's gap).
 */
export const PULSE: readonly (readonly [readonly number[], readonly number[]])[] = [
  [[D4], [Fs4]],
  [[D4], [A3]],
  [[B3], [D4]],
  [[B3], [D4]],
  [[G3], [B3]],
  [[G3], [G3, B3]],
  [[A3], [Cs4]],
  [[A3], [Cs4]],
];
/** The pulse's arrival on bar 58's downbeat (BEAT_8.away), B minor's B3 and D4 struck together. */
const ARRIVAL: readonly number[] = [B3, D4];
/** Each lane's strip tone (one session, told to delegate, two levels). */
export const STRIP_NOTES: readonly number[] = [D4, Fs4, A4];
/** The hero stamps, by text cue. */
export const STAMPS = ['stamp-half', 'stamp-ten', 'stamp-tokens'] as const;
/** A stamp's contact: the first frame of its text window (the 3 f ink spread starts there). */
export const stampFrame = (id: string): number => textWindow(cue(id))[0];

/** The ticks this part marks (continuity.ts leaves those beats to it): a punched notch, the long run's slide, the stacks done (the second on beat 4). */
export const evidenceBeats = (d: Desk): number[] => [d.f(BEAT_8.notches[1].f), d.f(BEAT_8.longRun.from), ...BEAT_8.stacks.map((s) => d.f(s.done))];

export function evidence(d: Desk): void {
  const { T, seed, music, foley } = d;
  const B = BEAT_8;
  const lastStack = d.f(B.stacks[B.stacks.length - 1].done);

  // ===== 8.1: the thinned pulse and the rain of ticks =======================================================
  // the mallet stands aside where the sheet speaks alone: the caveat and the strips (bar 51's downbeat), the unpunched notch, the last stack
  const aside = new Set([d.f(B.caveat), ...B.notches.filter((n) => !n.punched).map((n) => d.f(n.f)), lastStack]);
  const stroke = (at: number, midi: number) => music(at, fmMallet(midi, { vel: 0.6, tau: 0.45 }), { part: 'pulse-mallet', db: LV.pulseMallet, pan: -0.05, sends: { hall: 0.2 } });
  PULSE.forEach((strokes, i) =>
    strokes.forEach((notes, j) => {
      const at = T.beat(50 + i, 1 + 2 * j);
      if (!aside.has(at)) for (const midi of notes) stroke(at, midi);
    }),
  );
  for (const midi of ARRIVAL) stroke(d.f(B.away), midi);
  const inked = new Set<number>(B.ticks.inked);
  const span = B.ticks.to - B.ticks.from;
  const ticks = Array.from({ length: B.ticks.n }, (_, i) => {
    const f = B.ticks.from + (span * i) / B.ticks.n;
    const x = SHEET_X.row[0] + ((SHEET_X.row[1] - SHEET_X.row[0]) * i) / (B.ticks.n - 1);
    return { t: (f - B.ticks.from) / T.ctx.fps, amp: inked.has(i) ? 1 : 0.35, pan: panAt(x, f) };
  });
  foley(d.f(B.ticks.from), tickRain(seed, ticks), { part: 'rain', db: LV.rain, pan: 0, sends: { hall: 0.12 } });

  // ===== 8.2: the caveat stamp, the strips as long as their slowest runs, the hero stamps ======================
  foley(d.f(B.caveat), printTap(seed, 5), { part: 'stamp-8', db: LV.stamp8, pan: panAt(SHEET_X.caveat, B.caveat), sends: { hall: 0.1 } });
  B.lanes.forEach((lane, i) => {
    const at = d.f(lane.slide);
    const n = d.f(lane.slide + lane.p95 * B.stripFrames) - at;
    music(at, stripTone(STRIP_NOTES[i], { n, vel: 0.6 }), { part: 'strip', db: i === 2 ? LV.stripHero : LV.strip, pan: panAt(SHEET_X.strips[i], lane.slide), sends: { hall: 0.15 } });
  });
  STAMPS.forEach((id, i) => foley(d.f(stampFrame(id)), printTap(seed, 6 + i), { part: 'stamp-8', db: LV.stamp8, pan: panAt(SHEET_X.stamps[i], stampFrame(id)), sends: { hall: 0.1 } }));

  // ===== 8.3: the bracket, an open fifth ========================================================================
  [D5, A5].forEach((midi, j) => music(d.f(B.bracket), brightPluck(midi, { seed, k: 340 + j, vel: 0.6, t60: 0.25, bright: 0.45 }), { part: 'bracket', db: LV.bracket, pan: panAt(SHEET_X.bracket, B.bracket), sends: { hall: 0.2 } }));

  // ===== 8.4: the notches, and the long run ======================================================================
  B.notches.forEach(({ f, punched }, i) => {
    if (punched) foley(d.f(f), gateClack(seed, 20 + i), { part: 'notch', db: LV.notch, pan: panAt(SHEET_X.notches[i], f), sends: { hall: 0.08 } });
  });
  const run = d.f(B.longRun.from);
  music(run, stripTone(STRIP_NOTES[1], { n: d.f(B.longRun.from + B.longRun.frames) - run, vel: 0.6 }), { part: 'strip', db: LV.strip, pan: panAt(SHEET_X.longRun, B.longRun.from), sends: { hall: 0.15 } });

  // ===== 8.5: the token stacks, three rising notes, the last heavier ==============================================
  [A4, Cs5, E5].forEach((midi, i) => {
    const at = d.f(B.stacks[i].done);
    const last = i === B.stacks.length - 1;
    const stacks = panAt(SHEET_X.stacks[i], B.stacks[i].done);
    music(at, marimba(midi, { seed, k: 7500 + i, vel: last ? 0.85 : 0.6, bright: 0.45 }), { part: 'stack', db: LV.stack + (last ? 2 : 0), pan: stacks, sends: { hall: 0.25 } });
    if (last) music(at, marimba(E4, { seed, k: 7510, vel: 0.8, bright: 0.4 }), { part: 'stack', db: LV.stack - 1, pan: stacks, sends: { hall: 0.25 } });
  });
}
