/**
 * The film's motion tokens as a leaf module (it imports only the cue sheet's FPS and Remotion's spring): the spring
 * configs and the step-down ramp's length. state.ts re-exports them; a beat module (beat7.ts ... end.ts), which
 * state.ts imports, takes them from here, so its module-level tables never meet an import cycle.
 */
import { spring } from 'remotion';
import { FPS } from '../cues.ts';

/** Remotion spring configs from the synthesis's tokens (mass 1, c = 2ζ√k). Remotion's default spring is never used. */
export const SPRING = {
  settle: { stiffness: 380, damping: 31.2, mass: 1 },
  dock: { stiffness: 800, damping: 33.9, mass: 1 },
  heavy: { stiffness: 200, damping: 22.6, mass: 1 },
  detent: { stiffness: 600, damping: 44.1, mass: 1 },
  effects: { stiffness: 1600, damping: 80, mass: 1 },
} as const;

/** A spring from 0 to 1 starting at frame `start` (0 before it). */
export const springAt = (f: number, start: number, config: (typeof SPRING)[keyof typeof SPRING]): number =>
  f <= start ? 0 : spring({ frame: f - start, fps: FPS, config: { ...config, overshootClamping: false } });

/** The step-down ramp, frames (synthesis: 12–16 f). */
export const STEP_FRAMES = 14;
