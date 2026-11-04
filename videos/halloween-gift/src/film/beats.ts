/**
 * The V2 film's story beats as pure functions of the film frame: what the world does on each cue
 * (src/cues.ts) — the cover, the six pops the world grows out of the page on, the sky's fade-in
 * as the camera enters the story, the pumpkins' light and the seal's cold snap, the peeking
 * ghost, the gates, the door, the gift letter, the far window, and the post's foot band. All on
 * ones (no stepped motion), every change eased over frames (no one-frame flash). V1's approved
 * timings (film/timeline.ts, world/Sets.tsx, world/DoorSet.tsx) carried over where V1 had them.
 */
import { clamp, progress, smoothstep } from '@aiv/core';
import { at } from '../cues.ts';
import { FLOOR, PAGE } from '../world/layout.ts';
import { HIDDEN_CUT } from './journey.ts';

/** The score's six pops as the cover bursts (audio/foley.ts: at(4) + 6 + k × 3), left to right. */
export const POPS = [0, 1, 2, 3, 4, 5].map((k) => at(4) + 6 + k * 3);

/**
 * The world's grow out of the page (look/materials.ts setGrow, look/Grows.tsx): the sweep starts
 * at `from`, crosses the page (x0 .. x0 + width) in `sweep` frames, each point rising over `dur`
 * frames from the page's height `floor`.
 */
export const GROW = { from: POPS[0] - 1.5, sweep: 18, dur: 14, x0: -PAGE.w / 2, width: PAGE.w, floor: FLOOR } as const;

/**
 * When the world at x (world units) springs up out of the page: a sweep from the page's left
 * edge to its right over 18 frames, so the middle of the k-th sixth of the page lands on the k-th
 * pop (a continuous sweep: no seam between bands).
 */
export function popAt(x: number): number {
  const u = clamp((x - GROW.x0) / GROW.width, 0, 1);
  return GROW.from + GROW.sweep * u;
}

/**
 * A pop-up's rise, 0 flat .. 1 standing (V1's curve on ones): paper springing up on its hinge,
 * easing in and overshooting a little (to 1.1) before it settles.
 */
export function riseAt(f: number, from: number, dur = 14): number {
  const t = clamp((f - from) / dur, 0, 1);
  if (t <= 0) return 0;
  const c = 1.3;
  const x = t - 1;
  return clamp(1 + (c + 1) * x * x * x + c * x * x, 0, 1.1);
}

/** The world at x grown out of the page (0 flat .. 1, with the rise's overshoot). */
export const growAt = (f: number, x: number): number => riseAt(f, popAt(x), GROW.dur);

/** The whole page grown: 0 before the first point rises .. 1 once the last has settled (the moon's shadows and the mist fade in with it). */
export const grownAt = (f: number): number => progress(f, GROW.from, GROW.from + GROW.sweep + GROW.dur);

/** The cover, 0 closed .. 1 standing open (90°): bursts open on bar 4, slams on bar 35 (V1's curve). */
export function coverAt(f: number): number {
  if (f < at(4)) return 0;
  if (f < at(34, 3)) return progress(f, at(4), at(4) + 18, 'outCubic');
  return 1 - progress(f, at(34, 3), at(35), 'inCubic');
}

/**
 * Inside the story: the sky dome round the world fades in as the camera cranes down into the
 * opened book (the cover's printed sky is the same sky, so its edge disappears), and is gone
 * the moment the closing cover hides the lens (the camera comes out onto the desk).
 */
export function immersionAt(f: number): number {
  if (f >= HIDDEN_CUT) return 0;
  return smoothstep(at(4) + 14, at(5), f);
}

/**
 * The seal's cold snap (bar 26), 1 .. 0 over six frames: the light drops, flares once a little,
 * then goes out (no frame drops by more than about a quarter).
 */
const SNAP = [1, 0.72, 0.46, 0.26, 0.38, 0.14, 0];
function coldSnap(f: number, from: number): number {
  const t = f - from;
  if (t <= 0) return 1;
  if (t >= 6) return 0;
  const i = Math.floor(t);
  return SNAP[i] + (SNAP[i + 1] - SNAP[i]) * (t - i);
}

/** The giant jack-o'-lantern: lights on bar 5 (over four frames), out on the seal. */
export function bigPumpkinLitAt(f: number): number {
  return progress(f, at(5), at(5) + 4) * coldSnap(f, at(26));
}

/** The small pumpkins along the lane and on the porch: lit from the start, out on the seal; the porch's relight after the door closes (V1). */
export function pumpkinsLitAt(f: number, porch = false): number {
  const out = coldSnap(f, at(26));
  if (!porch) return out;
  return Math.max(out, progress(f, at(33) + 10, at(33) + 14));
}

/** Clawd's pumpkin pail: out on the seal with the others, relit when the user drops the candy in. */
export function pailLitAt(f: number): number {
  return Math.max(coldSnap(f, at(26)), progress(f, at(31, 2), at(31, 2) + 6, 'inOutSine'));
}

/**
 * The ghost that peeks at Clawd (Ghosts' `lower`, the one at LAND.peek): lowers as he reaches the
 * ghost tree, and jerks back up on the ember flick (V1's curves, on ones).
 */
export function ghostLowerAt(f: number): number {
  const shoo = progress(f, at(11, 2), at(11, 2) + 8, 'outCubic');
  return progress(f, at(10, 3), at(11, 2), 'inOutSine') * (1 - shoo);
}

/**
 * The gates (Fence's `open`, 0 shut .. 1 swung back against the fence): they creak open on bar 14,
 * clear of the path (open ≥ 0.75, world/Fence.tsx) by the frame Clawd's front reaches the gateway
 * (482), the sticking right leaf finishes its swing on the clang (bar 15) and rebounds a little.
 */
export const GATES_CLEAR = at(14) + 14;
export function gatesOpenAt(f: number): number {
  const creak = at(14);
  const clang = at(15);
  if (f <= creak) return 0;
  // the creak: a swing to 0.88 that slows into a pause
  if (f <= GATES_CLEAR) return 0.88 * smoothstep(creak, GATES_CLEAR, f);
  // the last of the right leaf's swing, gathering speed into the fence: the clang
  if (f <= clang) {
    const t = (f - GATES_CLEAR) / (clang - GATES_CLEAR);
    return 0.88 + 0.12 * t * t;
  }
  // the rebound off the fence, damped over eight frames
  const t = Math.min(1, (f - clang) / 8);
  return 1 - 0.035 * Math.sin(Math.PI * t) * (1 - t);
}

/** The cottage's door (House `doorOpen`): it opens on the creak (bar 20) and shuts on bar 33 (V1's flap). */
export function doorOpenAt(f: number): number {
  return progress(f, at(20), at(20) + 16, 'outCubic') * (1 - progress(f, at(33), at(33) + 10, 'inOutCubic'));
}

/** The gift letter: its rise from the yard's slot, the slats' flip to the email, the 封号 seal, face A's wax seal cracking. */
export interface LetterBeat {
  rise: number;
  flip: number;
  sealed: boolean;
  crack: number;
}
export function letterAt(f: number): LetterBeat {
  return {
    // springs up on the seal-crack (bar 23) and sinks back on the pull-back (bar 29), V1's curves
    rise: riseAt(f, at(23), 18) * (1 - progress(f, at(29), at(29) + 14, 'inCubic')),
    // the slats flip top to bottom on the second ding (each slat's own stagger is the letter's)
    flip: progress(f, at(25, 2), at(25, 2) + 18, 'linear'),
    sealed: f >= at(26),
    crack: progress(f, at(23), at(23) + 4, 'outCubic'),
  };
}

/** The far window's cold flip between the far dings (bar 33): five frames, not one. */
export function farColdAt(f: number): number {
  return progress(f, at(33, 3), at(33, 3) + 5, 'inOutSine');
}

/**
 * The post's maroon foot band (NightPost `foot`): full in the valley and the graveyard, eased
 * down as the camera settles on the door spread so Clawd's feet and the yard stay readable, none
 * on the desk.
 */
export function footAt(f: number): number {
  const door = smoothstep(at(16, 3), at(17), f);
  return immersionAt(f) * (1 - 0.7 * door);
}

/** The cottage's windows (House `windows`): bright from afar, dimmed for the door spread so the red papers lead. */
export function windowsAt(f: number): number {
  return 1 - 0.6 * smoothstep(at(16, 3), at(17), f);
}
