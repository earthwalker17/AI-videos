/**
 * Which printed strings a planned shot prints, and how (gl/text.ts makePrintTextures `keep`). TREATMENT
 * Type: printed fields are at least 36 px and only in planned close shots; elsewhere they are marks, and
 * micro-print is texture only. A string kept as `'texture'` prints faint (its ink a step off the paper),
 * so the paper keeps its tooth of print without a word competing with what the shot teaches; a string
 * dropped (`false`) leaves its paper, rules and marks.
 * - Still (c), the close on the reading window: the report's own print stays (the record, the card); the
 *   bays' fine print (dossiers, galley, log) stays as faint texture, never blank paper; their coarse
 *   print, the nameplates and the policy card print nothing, so no readable word competes with the
 *   record or sits under the notes.
 * - Still (d), the summary at 0.64×: nothing in the world's shared print is read, but every paper and
 *   plate keeps its print as faint texture (never a blank greybox tile); the one readable string is the
 *   teaching chain's "#0405" on the reply your stamp signed (objects/Trace.tsx).
 */
import { DOSSIER, DOSSIER_FINE, FANFOLD, FANFOLD_FINE, GALLEY_FINE, NAMEPLATE, POLICY, REPORT_C } from '../print.ts';

/** How a string prints: as set, as faint texture, or not at all. */
export type PrintMode = boolean | 'texture';

const REPORT_STRINGS = new Set<string>([REPORT_C.id, ...REPORT_C.summary, ...REPORT_C.body]);
const FINE = new Set<string>([...DOSSIER_FINE, ...GALLEY_FINE, ...FANFOLD_FINE]);
const CLOSE_MARKS = new Set<string>([...Object.values(DOSSIER).flat(), ...Object.values(NAMEPLATE), ...FANFOLD, ...POLICY]);

/** Still (c): the report prints; the bays' and the log's fine print is texture; their coarse print, the nameplates and the policy card are marks. */
export const keepClose = (text: string): PrintMode => (REPORT_STRINGS.has(text) ? true : FINE.has(text) ? 'texture' : !CLOSE_MARKS.has(text));

/**
 * Style frame (b) and MT1: only the teaching chain (#0408) prints as set, so it is the one string a viewer reads;
 * every other string (dossiers, the log, clocks, the nameplates' numbers, the chat slip's word) is faint texture.
 */
export const keepTeaching = (text: string): PrintMode => (text.includes('#') ? true : 'texture');

/** Still (d): the world's shared print is all faint texture. */
export const keepTexture = (): PrintMode => 'texture';
