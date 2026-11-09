/**
 * Which printed strings a planned shot prints (gl/text.ts makePrintTextures `keep`). TREATMENT Type:
 * printed fields are at least 36 px and only in planned close shots; elsewhere they are marks, and
 * micro-print is texture only. A dropped string leaves its paper, rules and marks.
 * - Still (c), the close on the reading window: the report's own print stays (the record, the card);
 *   the bays' dossiers, nameplates and galley, the log and the policy card print nothing, so no
 *   readable word competes with the record or sits under the notes.
 * - Still (d), the summary at 0.5×-0.65×: nothing in the world's shared print is read; the one
 *   readable string is the teaching chain's "#0405" on the reply your stamp signed (objects/Trace.tsx).
 */
import { DOSSIER, DOSSIER_FINE, FANFOLD, FANFOLD_FINE, GALLEY, GALLEY_FINE, NAMEPLATE, POLICY, REPORT_C } from '../print.ts';

const REPORT_STRINGS = new Set<string>([REPORT_C.id, ...REPORT_C.summary, ...REPORT_C.body]);
const CLOSE_MARKS = new Set<string>([...Object.values(DOSSIER).flat(), ...Object.values(NAMEPLATE), ...DOSSIER_FINE, ...GALLEY, ...GALLEY_FINE, ...FANFOLD, ...FANFOLD_FINE, ...POLICY]);

/** Still (c): the report prints; the bays, the log and the policy card are marks. */
export const keepClose = (text: string): boolean => REPORT_STRINGS.has(text) || !CLOSE_MARKS.has(text);

/** Still (d): the world's shared print is all marks. */
export const keepNone = (): boolean => false;
