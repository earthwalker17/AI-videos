// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2): the stage's command list, factored
// out of stage.ts so its merge rule can be tested, and extended for image marks.
/**
 * The stage draws marks in call order. Consecutive marks of one kind become one instanced draw
 * call when nothing that a draw call fixes differs between them: the space (world or screen) and,
 * for image marks, the texture, the display-referred flag and the drop shadow (a shadow is drawn
 * in its own pass just before its pane, so a pane with one is always a call of its own).
 */

export const SHAPE = 0;
export const RIBBON = 1;
export const GLYPH = 2;
export const IMAGE = 3;
export type Kind = typeof SHAPE | typeof RIBBON | typeof GLYPH | typeof IMAGE;

export interface Command<T = unknown> {
  kind: Kind;
  /** world space (posed by the camera) or screen space (reference px) */
  world: boolean;
  /** first instance (or vertex, for ribbons) in the kind's buffer, and how many */
  start: number;
  count: number;
  /** image marks: the texture they sample; null for the other kinds */
  tex: T | null;
  /** image marks: display-referred (bypasses the tone shoulder and the vignette) */
  display: boolean;
  /** image marks: draws a drop shadow first */
  shadow: boolean;
}

/** Whether `b` can join `a` in one draw call. */
export function canMerge<T>(a: Command<T>, b: Command<T>): boolean {
  if (a.kind !== b.kind || a.world !== b.world || a.start + a.count !== b.start) return false;
  if (a.kind !== IMAGE) return true;
  return a.tex === b.tex && a.display === b.display && !a.shadow && !b.shadow;
}

/** Append a command, merging it into the last one when it can join it. */
export function pushCommand<T>(list: Array<Command<T>>, c: Command<T>): void {
  const last = list[list.length - 1];
  if (last && canMerge(last, c)) last.count += c.count;
  else list.push({ ...c });
}
