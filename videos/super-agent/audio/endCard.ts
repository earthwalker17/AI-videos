/**
 * Bars 78-84 (f6160-6719): beat 13, the end card (STORYBOARD 13.1-13.3, Sound column). continuity.ts's ticks fade
 * through the dissolve (the last near f6180) as the pad ends on it.
 *
 *   13.2  from the card's landing (END.card.land) a solo mallet plays the motif, alone with its hall and echo: five
 *         statements, each a little softer and the gaps slowly widening (never 2 s of silence: QA's silencedetect
 *         is -60 dB for 2 s), then once at half speed
 *   13.3  one last D5, long, that decays to nothing by f6720 (`rest-tail` holds nothing new; the master fades the
 *         last 2 s)
 */
import { END } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { fmMallet } from './instruments.ts';
import { SCREEN, screenPan } from './places.ts';

const { D5 } = M;

/** The motif's statements under the card: beats after its landing, and the step between A4 and D5 (beats). */
export const END_MOTIFS: readonly { beat: number; step: number }[] = [
  { beat: 0, step: 0.5 },
  { beat: 3, step: 0.5 },
  { beat: 6, step: 0.5 },
  { beat: 9.5, step: 0.5 },
  { beat: 13, step: 0.5 },
  { beat: 17, step: 1 },
];
/** The last note: D5, this many beats after the landing. */
export const LAST_NOTE = 21.5;

export function endCard(d: Desk): void {
  const { T, music } = d;
  const land = d.f(END.card.land);
  const pan = screenPan(SCREEN.endCard);
  const sends = { hall: 0.35, echo: 0.25 };
  END_MOTIFS.forEach(({ beat, step }, i) => d.motif(land + T.beats(beat), { pan, db: LV.endMotif - 0.6 * i, step, tau: 0.6, sends }));
  music(land + T.beats(LAST_NOTE), fmMallet(D5, { vel: 0.8, tau: 0.9 }), { part: 'motif', db: LV.endMotif - 4.5, pan, sends });
}
