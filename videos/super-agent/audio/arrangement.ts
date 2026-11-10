/**
 * The score of "Who Routes the Agents?" on the 84-bar cue sheet (session 4, the build): bars
 * 1-43 laid bar by bar on the picture's contact frames, bars 44-84 an animatic bed that session 5
 * replaces. It keeps the voices and devices of the sketch of bars 1-27 the user heard on
 * 2026-11-08 ("Right direction"). TREATMENT.md "Sound design" and STORYBOARD.md's Sound column,
 * in order, one module per stretch:
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
 *   bed.ts         bars 44-84  the animatic bed (REPLACED IN SESSION 5) and its few landmarks
 *   continuity.ts  bars 19-77  the Router's layer under all of it: the bowed pad, the sine-bass
 *                              pulse, the memory ticks on 2 and 4
 *   common.ts                  pitches, levels, the landmarks (marks) and the placing desk
 *
 * Every position comes from ctx.cues through the kit's timeline: a cue by id, a frame of the cue
 * sheet's plain-data schedules (LAMP_VISITS, ARRIVE, WARMTH, FIX_A, FIX_B, BEAT_4, MT1, BEAT_5,
 * BEAT_6), which the picture reads too, or the bar grid. Every random choice is rand(ctx.seed,
 * id, k) from @aiv/core and every noise stream the kit's seeded noise: the score is a pure
 * function of the cue sheet and the seed.
 */
import type { Timeline } from '@aiv/pipeline/audio/kit';
import { actOne } from './actOne.ts';
import { bed } from './bed.ts';
import { desk, marks, type FxPlacement, type Marks, type Placer } from './common.ts';
import { routerLayer } from './continuity.ts';
import { fixes } from './fixes.ts';
import { keepUp, keepUpBeats } from './keepUp.ts';
import { levels } from './levels.ts';

export { marks, type FxPlacement, type Marks };

/** Place every part of the score (the Workers' wall is index.ts's, on the mixed bus). Returns the UI sounds as placed, for the report. */
export function arrange(T: Timeline, mx: Placer): FxPlacement[] {
  const d = desk(T, mx);
  actOne(d);
  fixes(d);
  levels(d);
  keepUp(d);
  bed(d);
  routerLayer(d, { skip: keepUpBeats(d) });
  return d.fx;
}
