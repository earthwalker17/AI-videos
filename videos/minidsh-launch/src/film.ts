/**
 * The film's frames: which act a film frame belongs to, what it needs and how it draws. Every act
 * is a module in acts/ with a pure `needs(f)` and `draw(f, ctx)`; `f` is fractional inside a frame
 * (motion blur averages sub-frames), but never across a hard cut.
 */
import { themed, type CaptureKey } from './captures.ts';
import { ACTS, actAt, type Act } from './cues.ts';
import type { ActModule, Ctx } from './acts/common.ts';
import { close } from './acts/close.ts';
import { desktop } from './acts/desktop.ts';
import { handoff } from './acts/handoff.ts';
import { hook } from './acts/hook.ts';
import { permission } from './acts/permission.ts';
import { record } from './acts/record.ts';
import { runtime } from './acts/runtime.ts';
import { terminal } from './acts/terminal.ts';

export type { Ctx } from './acts/common.ts';

const MODULES: Record<Act, ActModule> = { hook, terminal, handoff, record, permission, desktop, runtime, close };

export function needs(f: number): CaptureKey[] {
  return [...new Set(MODULES[actAt(f)].needs(f).map(themed))];
}

export function draw(f: number, c: Ctx): void {
  MODULES[actAt(f)].draw(f, c);
}

/**
 * Hard cuts: a frame's motion-blur sub-frames never cross one (each would show the other shot).
 * Act starts, and the cuts each act declares inside itself.
 */
export const CUTS: readonly number[] = [...Object.values(ACTS).filter((f) => f > 0), ...Object.values(MODULES).flatMap((m) => m.cuts ?? [])].sort((a, b) => a - b);

/** A sub-frame instant `s` of frame `f`, kept on the frame's side of any cut between them. */
export function sameShot(f: number, s: number): number {
  for (const c of CUTS) if (Math.min(f, s) < c && c <= Math.max(f, s)) return f;
  return s;
}
