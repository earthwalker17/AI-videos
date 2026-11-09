/**
 * What the cue sheet puts on screen at a film frame: the narration lines and the tags whose
 * window (span plus wipe in and fade out, src/cues.ts) holds the frame. The picture asks here and
 * never decides on its own when a line shows. Pure: tested in onScreen.test.ts.
 */
import { NARRATION, TEXT_IN, TEXT_OUT, cue, type WordsId } from '../cues.ts';
import { revealState, type RevealState } from '../kit/text.tsx';

/** The reveal of cue `id` at film frame `f` (the cue sheet's 6-frame wipe in and fade out). */
export const cueReveal = (id: string, f: number): RevealState => revealState(f, cue(id), TEXT_IN, TEXT_OUT);

/** Whether any of cue `id` is on screen at film frame `f`. */
export const cueShown = (id: string, f: number): boolean => cueReveal(id, f).visible;

/** The narration lines on screen at film frame `f` (two only while one fades as the next wipes in). */
export const narrationAt = (f: number): WordsId[] => NARRATION.filter((id) => cueShown(id, f));
