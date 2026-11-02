/**
 * The picture's timeline, derived from the cue sheet: which set is on stage, the book's
 * mechanics (cover, page turn, slide) and the camera, all pure functions of the film frame.
 *
 * Stop-motion grammar: actors move on twos (`twos(f)`: a new pose every 2 frames, 12 per
 * second); the camera, fog and light move on ones.
 */
import { clamp, easings, lerp, progress, type EasingName } from '@aiv/core';
import { at, BAR, BEAT } from '../cues.ts';

/** Actors (puppets, flats, cloth, bats) hold each pose for two frames. */
export const twos = (f: number): number => f - (f % 2);

// ---- the book's mechanics -------------------------------------------------------------------

/** The cover's opening angle, 0 closed .. 1 standing (90°): bursts open on bar 4, slams on bar 35. */
export function coverOpen(f: number): number {
  const t = twos(f);
  if (t < at(4)) return 0;
  if (t < at(34, 3)) return progress(t, at(4), at(4) + 18, 'outCubic');
  return 1 - progress(t, at(34, 3), at(35), 'inCubic');
}

/** The page turn from the valley to the graveyard: 0 lying .. 1 turned against the backdrop. */
export const pageTurn = (f: number): number => progress(twos(f), at(9), at(9) + 14, 'inOutSine');

/** The flats of the graveyard slide off stage on bar 13: 0 in place .. 1 gone. */
export const slideAway = (f: number): number => progress(twos(f), at(13), at(13) + 16, 'inCubic');

/** A pop-up's rise, 0 flat .. 1 standing, starting at `from` (frames): paper springing up on its
 * hinge, easing in (no first-drawing pop) and overshooting a little before it settles. */
export function rise(f: number, from: number, dur = 14): number {
  const t = progress(twos(f), from, from + dur, 'linear');
  if (t <= 0) return 0;
  const c = 1.3;
  const x = t - 1;
  return clamp(1 + (c + 1) * x * x * x + c * x * x, 0, 1.1);
}

// ---- which set is on stage --------------------------------------------------------------------

export type SetId = 'valley' | 'graveyard' | 'lane' | 'door';

/** Sets mounted at film frame f (only the current and the next one: memory on the iGPU). */
export function setsAt(f: number): SetId[] {
  const s: SetId[] = [];
  if (f >= at(4) - 2 && f < at(9) + 20) s.push('valley');
  if (f >= at(9) - 2 && f < at(13) + 18) s.push('graveyard');
  if (f >= at(13) - 2 && f < at(17)) s.push('lane');
  if (f >= at(17) && f < at(35)) s.push('door');
  return s;
}

/** True while the camera is outside the book (the desk shots). */
export const onDesk = (f: number): boolean => f < at(4) + 30 || f >= at(35);

// ---- the camera -------------------------------------------------------------------------------

export type V3 = readonly [number, number, number];
export interface Pose {
  pos: V3;
  look: V3;
  /** vertical field of view, degrees */
  fov: number;
  /** focus distance for depth of field, world units */
  focus: number;
}
interface Key extends Pose {
  f: number;
  /** easing from the previous key to this one */
  ease?: EasingName | 'settle';
}

/** ease-out with a small overshoot and a search back: a motion-control move that "settles" */
const settle = (x: number) => {
  const c = 1.2;
  const y = 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
  return y;
};

const v = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function along(keys: Key[], f: number): Pose {
  if (f <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (f <= b.f) {
      const x = clamp((f - a.f) / (b.f - a.f));
      const e = b.ease === 'settle' ? settle(x) : easings[b.ease ?? 'inOutCubic'](x);
      return { pos: v(a.pos, b.pos, e), look: v(a.look, b.look, e), fov: lerp(a.fov, b.fov, e), focus: lerp(a.focus, b.focus, e) };
    }
  }
  return keys[keys.length - 1];
}

// World: the desk top is y = 0; the closed book is 12 wide (x), 8 deep (z), 1.2 thick, its spine
// along the back edge (z = -4). Open, its first page is the stage floor (y = 1.2) and the cover
// stands at the back as the backdrop (z = -4, up to y = 9.2).
const FLOOR = 1.2;

/** Shots, in film frames. Cuts only at bar 17 (the door) and bar 35 (back on the desk). */
const SHOTS: { from: number; keys: Key[] }[] = [
  {
    // 1-8: an orbit around the closed book, then a crane down into it as it bursts open
    from: 0,
    keys: [
      { f: 0, pos: [9.5, 7.2, 12.5], look: [0, 1.0, 0], fov: 30, focus: 15 },
      { f: at(4), pos: [6.8, 7.8, 13.2], look: [0, 1.2, 0], fov: 30, focus: 15, ease: 'linear' },
      { f: at(4) + 20, pos: [1.5, 15.5, 9.0], look: [0, FLOOR, 0.5], fov: 34, focus: 14, ease: 'inOutSine' },
      { f: at(7), pos: [1.0, FLOOR + 1.1, 7.2], look: [-0.3, FLOOR + 2.15, -3.0], fov: 36, focus: 4.9, ease: 'settle' },
      { f: at(8, 3), pos: [2.1, FLOOR + 0.95, 5.8], look: [1.2, FLOOR + 1.5, -2.0], fov: 34, focus: 4.0 },
      // crane up and back to watch the page turn sweep over the stage
      { f: at(9), pos: [1.2, FLOOR + 6.4, 10.5], look: [0, FLOOR + 1.6, -1.0], fov: 34, focus: 11, ease: 'inOutSine' },
    ],
  },
  {
    // 9-12: a lateral truck alongside Clawd through the graveyard
    from: at(9),
    keys: [
      // the page turn, watched from above as it sweeps over the stage, then down into the truck
      { f: at(9), pos: [1.2, FLOOR + 6.4, 10.5], look: [0, FLOOR + 1.6, -1.0], fov: 34, focus: 11 },
      { f: at(9) + 16, pos: [-1.2, FLOOR + 3.4, 7.6], look: [-1.0, FLOOR + 1.2, -0.5], fov: 32, focus: 8, ease: 'inOutSine' },
      { f: at(10), pos: [-3.4, FLOOR + 0.75, 3.6], look: [-2.9, FLOOR + 0.7, 0.4], fov: 30, focus: 3.2, ease: 'inOutCubic' },
      { f: at(13), pos: [2.6, FLOOR + 0.85, 3.6], look: [3.1, FLOOR + 0.8, 0.4], fov: 30, focus: 3.2, ease: 'linear' },
    ],
  },
  {
    // 13-16: the flats slide away; push through the opening gates along the path to the house
    from: at(13),
    keys: [
      { f: at(13), pos: [2.6, FLOOR + 0.85, 3.6], look: [3.1, FLOOR + 0.8, 0.4], fov: 30, focus: 3.2 },
      { f: at(14), pos: [0, FLOOR + 1.2, 6.2], look: [0, FLOOR + 1.6, -2.8], fov: 32, focus: 4.2 },
      { f: at(17), pos: [0.15, FLOOR + 1.05, 3.0], look: [0, FLOOR + 1.8, -3.0], fov: 32, focus: 4.9, ease: 'inOutSine' },
    ],
  },
  {
    // 17-34: the door. Locked low two-shot; rack to the door; push in on the gift; snap zoom on
    // the ding; pull back; push in on the wink; follow Clawd out; the cover comes down.
    from: at(17),
    keys: [
      { f: at(17), pos: [1.2, FLOOR + 0.55, 3.0], look: [0.0, FLOOR + 1.2, -1.3], fov: 36, focus: 4.1 },
      { f: at(20), pos: [0.95, FLOOR + 0.5, 3.6], look: [-0.15, FLOOR + 1.3, -1.2], fov: 36, focus: 4.7, ease: 'inOutSine' },
      { f: at(21), pos: [0.7, FLOOR + 0.7, 4.4], look: [-0.15, FLOOR + 1.35, -1.0], fov: 36, focus: 5.3 },
      { f: at(24, 3), pos: [0.35, FLOOR + 0.9, 4.1], look: [-0.1, FLOOR + 1.2, -0.4], fov: 34, focus: 4.3, ease: 'inOutSine' },
      { f: at(25) + BEAT, pos: [-0.05, FLOOR + 1.15, 3.41], look: [-0.05, FLOOR + 1.15, -0.15], fov: 30, focus: 3.56, ease: 'outCubic' },
      { f: at(29), pos: [-0.03, FLOOR + 1.16, 3.37], look: [-0.05, FLOOR + 1.15, -0.15], fov: 30, focus: 3.52, ease: 'linear' },
      { f: at(30), pos: [0.7, FLOOR + 0.7, 4.6], look: [-0.15, FLOOR + 1.3, -1.0], fov: 36, focus: 5.0, ease: 'inOutCubic' },
      { f: at(31, 3), pos: [0.68, FLOOR + 0.7, 4.5], look: [-0.15, FLOOR + 1.3, -1.0], fov: 36, focus: 5.0, ease: 'linear' },
      { f: at(32), pos: [0.85, FLOOR + 0.5, 2.6], look: [0.8, FLOOR + 0.45, 0.4], fov: 30, focus: 2.2, ease: 'outCubic' },
      { f: at(33), pos: [0.9, FLOOR + 0.55, 2.7], look: [0.9, FLOOR + 0.5, 0.4], fov: 30, focus: 2.3, ease: 'linear' },
      { f: at(34, 3), pos: [1.6, FLOOR + 0.8, 3.6], look: [2.6, FLOOR + 0.8, 0.0], fov: 32, focus: 3.4, ease: 'inOutSine' },
      { f: at(35), pos: [1.6, FLOOR + 0.9, 3.7], look: [2.6, FLOOR + 1.2, 0.0], fov: 32, focus: 3.4, ease: 'linear' },
    ],
  },
  {
    // 35-40: back on the desk, the closed book; locked off
    from: at(35),
    keys: [
      { f: at(35), pos: [6.0, 6.8, 13.0], look: [0, 1.1, 0.3], fov: 30, focus: 14.5 },
      { f: at(40) + BAR, pos: [5.8, 6.6, 12.6], look: [0, 1.1, 0.3], fov: 30, focus: 14.2, ease: 'linear' },
    ],
  },
];

export function cameraAt(f: number): Pose {
  let shot = SHOTS[0];
  for (const s of SHOTS) if (f >= s.from) shot = s;
  return along(shot.keys, f);
}

export { BAR, BEAT, FLOOR };
