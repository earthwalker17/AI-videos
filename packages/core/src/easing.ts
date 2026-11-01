/**
 * Scalar helpers for frame-driven animation: every function is pure, so a value at frame i
 * depends on i alone.
 */

export const clamp = (x: number, min = 0, max = 1): number => (x < min ? min : x > max ? max : x);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Where x sits between a and b (0 at a, 1 at b); unclamped. a === b gives 0. */
export const invLerp = (a: number, b: number, x: number): number => (a === b ? 0 : (x - a) / (b - a));

/** Map x from [inMin, inMax] to [outMin, outMax]; clamped to the output range unless clampOutput is false. */
export function mapRange(x: number, inMin: number, inMax: number, outMin: number, outMax: number, clampOutput = true): number {
  const t = invLerp(inMin, inMax, x);
  return lerp(outMin, outMax, clampOutput ? clamp(t) : t);
}

/** Hermite step between edges e0 and e1 (GLSL semantics). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp(invLerp(e0, e1, x));
  return t * t * (3 - 2 * t);
}

/** Perlin's smootherstep: zero first and second derivatives at both edges. */
export function smootherstep(e0: number, e1: number, x: number): number {
  const t = clamp(invLerp(e0, e1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export type Easing = (t: number) => number;

/** Easings on t ∈ [0, 1] (inputs outside are clamped), each with f(0) = 0 and f(1) = 1. */
export const easings = {
  linear: (t) => clamp(t),
  inQuad: (t) => clamp(t) ** 2,
  outQuad: (t) => 1 - (1 - clamp(t)) ** 2,
  inOutQuad: (t) => {
    const x = clamp(t);
    return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  },
  inCubic: (t) => clamp(t) ** 3,
  outCubic: (t) => 1 - (1 - clamp(t)) ** 3,
  inOutCubic: (t) => {
    const x = clamp(t);
    return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
  },
  inOutSine: (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2,
  outExpo: (t) => {
    const x = clamp(t);
    return x === 1 ? 1 : 1 - 2 ** (-10 * x);
  },
  inOutExpo: (t) => {
    const x = clamp(t);
    if (x === 0 || x === 1) return x;
    return x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
  },
} satisfies Record<string, Easing>;

export type EasingName = keyof typeof easings;

/**
 * The eased progress of `frame` from frame `from` (0) to frame `to` (1), held at the ends.
 * Frame-indexed on purpose: callers pass the frame, never a clock.
 */
export function progress(frame: number, from: number, to: number, ease: Easing | EasingName = 'linear'): number {
  const f = typeof ease === 'string' ? easings[ease] : ease;
  return f(clamp(invLerp(from, to, frame)));
}
