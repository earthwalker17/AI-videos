/**
 * The score of "Who Routes the Agents?" on the 84-bar cue sheet: bars 1-43 laid bar by bar on the picture's contact
 * frames in session 4 (approved as built on 2026-11-12), bars 44-84 in session 5 on part two's schedules (BEAT_7 to
 * BEAT_11 and END). It keeps the voices and devices of the sketch of bars 1-27 the user heard on 2026-11-08 ("Right
 * direction"). TREATMENT.md "Sound design" and STORYBOARD.md's Sound column, in order, one module per stretch:
 *
 *   actOne.ts      bars 1-12   the hook (folder motifs lit by their warmth, a woodblock per swing of
 *                              your lamp, the request motif, the title), the human router (F6-F8
 *                              landing, the swings speeding up, a falling tone per flag snapping up,
 *                              the four chores), the hub and its silence
 *   fixes.ts       bars 13-18  Fix A's plod hard left, Fix B's plucks and reply chirps hard right,
 *                              the Dsus2 into the breath
 *   levels.ts      bars 19-29  the turn's unison arpeggio, the request's stations, the strikes, the
 *                              ghost backlog, the dispatches' knocks and Worker voices, MT1, the rest
 *   keepUp.ts      bars 30-43  beat 5's pulse, clacks and bells; beat 6's batch chords, detent,
 *                              cache fold and recall
 *   waiting.ts     bars 44-49  beat 7: the Thread cord and its flyover, the tally, the job capsule,
 *                              the two replies
 *   evidence.ts    bars 50-57  beat 8: the thinned pulse, the rain of ticks, the strips as long as
 *                              their slowest runs, the bracket, the notches, the stacks
 *   persistent.ts  bars 58-62  beat 9: the lid, the vellum, the strut handed over, the Watchdog's
 *                              sweeps over the stuck bay's loop
 *   open.ts        bars 63-68  beat 10: the minor second, the etch, the open problems, bar 68's
 *                              handshake
 *   signoff.ts     bars 69-77  beats 11-12: the stamp and the drag, the labels, the act-one theme,
 *                              the half-speed motif, the bookend
 *   endCard.ts     bars 78-84  beat 13: the solo mallet under the end card
 *   continuity.ts  bars 19-78  the Router's layer under all of it: the bowed pad, the sine-bass
 *                              pulse, the memory ticks on 2 and 4 (one a beat at the bookend)
 *   places.ts                  where part two's objects stand across the frame (their pans)
 *   common.ts                  pitches, levels, the landmarks (marks) and the placing desk
 *
 * Every position comes from ctx.cues through the kit's timeline: a cue by id, a frame of the cue
 * sheet's plain-data schedules (LAMP_VISITS, ARRIVE, WARMTH, FIX_A, FIX_B, BEAT_4, MT1, BEAT_5,
 * BEAT_6, BEAT_7, BEAT_8, BEAT_9, BEAT_10, BEAT_11, END), which the picture reads too, or the bar
 * grid. Every random choice is rand(ctx.seed, id, k) from @aiv/core and every noise stream the
 * kit's seeded noise: the score is a pure function of the cue sheet and the seed.
 */
import type { Timeline } from '@aiv/pipeline/audio/kit';
import { actOne } from './actOne.ts';
import { desk, marks, type Desk, type FxPlacement, type Marks, type Placer } from './common.ts';
import { routerLayer } from './continuity.ts';
import { endCard } from './endCard.ts';
import { evidence, evidenceBeats } from './evidence.ts';
import { fixes } from './fixes.ts';
import { keepUp, keepUpBeats } from './keepUp.ts';
import { levels } from './levels.ts';
import { open, openBeats } from './open.ts';
import { persistent, persistentBeats } from './persistent.ts';
import { signoff, signoffBeats } from './signoff.ts';
import { waiting, waitingBeats } from './waiting.ts';

export { marks, type FxPlacement, type Marks };

/** The beats the parts mark where the Router's tick would also sound (continuity.ts leaves them to the parts). */
export const markedBeats = (d: Desk): number[] => [...keepUpBeats(d), ...waitingBeats(d), ...evidenceBeats(d), ...persistentBeats(d), ...openBeats(d), ...signoffBeats(d)];

/** Place every part of the score (the Workers' wall is index.ts's, on the mixed bus). Returns the UI sounds as placed, for the report. */
export function arrange(T: Timeline, mx: Placer): FxPlacement[] {
  const d = desk(T, mx);
  actOne(d);
  fixes(d);
  levels(d);
  keepUp(d);
  waiting(d);
  evidence(d);
  persistent(d);
  open(d);
  signoff(d);
  endCard(d);
  routerLayer(d, { skip: markedBeats(d) });
  return d.fx;
}
