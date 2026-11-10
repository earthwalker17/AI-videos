/**
 * ANIMATIC BED, bars 44-84 (f3440-6719): REPLACED IN SESSION 5.
 *
 * A placeholder so the animatic has a score to its end, built only from the Router's layer
 * (continuity.ts reads BED_PLAN: the pad, the sine-bass pulse, the ticks) and a few cheap
 * landmarks. None of beats 7-13's own devices are here yet (STORYBOARD 7.x-13.x: the lane tones
 * sized to their values, the job capsule, the Watchdog sweep, the detuning chord, the suspension,
 * the label clicks, the thinned pulse): session 5 replaces this file with them.
 *
 *   bars 44-57  D major, the bass on 1 and 3, ticks on 2 and 4. f3520 (`flyover`): the motif an
 *               octave up, quickly over the bar line (A5 a sixteenth before it, D6 on it), and the
 *               Router's beat-1 pulse is skipped
 *   bars 58-62  the bass drops out; B minor, with E minor (the borrowed iv) over the B
 *   bar 63      `silence-intrusion`: digital silence (index.ts); f5000 (`intrusion`) a low D-E♭
 *               minor second on felt piano as the pad swells back in (B minor, then a suspension)
 *   bar 69      f5440 (`stamp`): a felt stamp thump and the motif completed, A4 D5 F♯5;
 *               `rest-signoff` the pad holds a Dmaj9 at its rest level (continuity.ts)
 *   bars 71-75  D major again, the bass back
 *   bars 76-77  f6040 (`bookend`): the motif once, with no felt-piano answer; the ticks on every
 *               beat (the frame-0 rhythm) fade, and the pad fades out to the dissolve
 *   bars 78-84  under the end card a solo mallet plays the motif twice, then one D5 that decays to
 *               nothing by the film's end (`rest-tail`; the master fades the last 2 s)
 *
 * The bed's level sits near beats 4-6 (padDb lifts its pad for the missing Workers), so that the
 * master's whole-film normalisation leaves bars 1-43 where they were (index.ts prints both halves).
 */
import { LV, M, type Desk } from './common.ts';
import type { RouterPlan } from './continuity.ts';
import { feltPiano, fmMallet } from './instruments.ts';
import { paperThump } from './foley.ts';

const { B2, D3, Eb3, E3, Fs3, G3, A3, B3, Cs4, D4, E4, Fs4, A4, D5, Fs5, A5, D6 } = M;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const on24 = (bars: readonly number[], db: number) => bars.flatMap((bar) => [[bar, 2, db] as const, [bar, 4, db] as const]);

export const BED_PLAN: RouterPlan = {
  chords: [
    { bar: 44, notes: [D3, A3, D4, Fs4] },
    { bar: 46, notes: [D3, G3, B3, E4] },
    { bar: 48, notes: [D3, A3, Fs4, A4] },
    { bar: 50, notes: [D3, B3, D4, Fs4] },
    { bar: 52, notes: [D3, G3, B3, D4] },
    { bar: 54, notes: [D3, A3, E4, Fs4] },
    { bar: 56, notes: [D3, A3, Cs4, E4] },
    // the open problem: B minor, the bass out
    { bar: 58, notes: [B2, Fs3, B3, D4] },
    { bar: 60, notes: [B2, G3, B3, E4] },
    { bar: 62, notes: [B2, Fs3, A3, D4] },
    // after the silence: the pad swells back in under the minor second
    { bar: 63, beat: 3, notes: [B2, D3, Fs3, B3] },
    { bar: 65, notes: [B2, E3, G3, B3] },
    { bar: 67, notes: [B2, E3, Fs3, B3] },
    // the sign-off: D major, the held Dmaj9 through the rest
    { bar: 69, notes: [D3, A3, D4, Fs4] },
    { bar: 69, beat: 3, notes: [D3, A3, Cs4, E4, Fs4] },
    { bar: 71, notes: [D3, G3, B3, D4] },
    { bar: 73, notes: [D3, A3, Fs4, A4] },
    { bar: 75, notes: [D3, A3, E4, Fs4] },
  ],
  bass: [...range(44, 57), ...range(71, 75)],
  bassSkip: [[45, 1]],
  ticks: [
    ...on24(range(44, 75), -2),
    // bars 76-77: one quiet tick a beat (the frame-0 rhythm), fading out by the end card
    ...range(0, 7).map((k) => [76 + Math.floor(k / 4), 1 + (k % 4), -4 - 2.5 * k] as const),
  ],
  padDb: 2,
};

export function bed(d: Desk): void {
  const { T, seed, m, music, foley } = d;

  // f3520: the follow-up rides its Thread over the Register: the motif an octave up, quickly over the bar line
  const fly = T.cue('flyover');
  d.motif(fly - T.beats(0.25), { pan: 0.35, db: LV.motif - 2, notes: [A5, D6], step: 0.25, tau: 0.35 });

  // f5000: the hatched slip reaches the Register: a low D-E♭ minor second
  const intr = T.cue('intrusion');
  [D3, Eb3].forEach((midi, j) => music(intr + j * T.s(0.012), feltPiano(midi, { seed, k: 50 + j, vel: 0.75 }), { part: 'intrusion', db: LV.piano - 3, pan: -0.1 + 0.2 * j, sends: { hall: 0.3 } }));

  // f5440: your desk stamps the reply: a felt stamp thump, and the motif completes as A4, D5, F♯5 (short, so it is gone before the rest)
  const stamp = T.cue('stamp');
  foley(stamp, paperThump(seed, 3), { part: 'stamp', db: LV.thump - 1, pan: -0.4, sends: { hall: 0.1 } });
  d.motif(stamp, { pan: -0.4, db: LV.motif, notes: [A4, D5, Fs5], tau: 0.22, until: m.signoff[0] });

  // f6040: as at f20 a slip turns vermilion: the motif once, no felt-piano answer
  d.motif(T.cue('bookend'), { pan: -0.45, db: LV.motif - 2 });

  // the end card: a solo mallet plays the motif twice, then one D5 that decays to nothing by the end
  const card = T.cue('hold-end');
  d.motif(card, { pan: -0.2, db: LV.motif - 4, sends: { hall: 0.35, echo: 0.2 } });
  d.motif(card + T.beats(8), { pan: -0.2, db: LV.motif - 5, sends: { hall: 0.35, echo: 0.2 } });
  music(card + T.beats(16), fmMallet(D5, { vel: 0.8, tau: 0.8 }), { part: 'motif', db: LV.motif - 6, pan: -0.2, sends: { hall: 0.35 } });
}
