/**
 * Where the puppets are and what they do, per film frame: blocking as data, so the camera,
 * the sets and the score can be checked against one table. Actors move on twos; every turn and
 * gesture is eased over a few drawings (no one-frame pops).
 */
import { clamp, easings, lerp, progress } from '@aiv/core';
import { at, BEAT, KNOCKS } from '../cues.ts';
import { FLOOR, twos, type V3 } from './timeline.ts';

export interface ClawdPose {
  pos: V3;
  /** heading about y: 0 faces the camera (+z), π faces the backdrop */
  heading: number;
  /** 0..1 how far through a walk cycle (legs), or null when standing */
  walk: number | null;
  /** pop-up rise 0 (flat) .. 1 (standing) */
  rise: number;
  arms: 'down' | 'up' | 'one-up';
  eyes: 'open' | 'closed' | 'wink' | 'left' | 'right';
  /** wand lifted 0..1 (knocks, flicks) */
  wand: number;
  /** the pumpkin pail's candle, 0 out .. 1 lit (it goes out with every pumpkin on the seal) */
  pailLit: number;
  /** the black envelope held up over his head, 0 hidden .. 1 shown */
  envelope: number;
  /** the hat tip, 0 .. 1 (raised and tilted) */
  hatTip: number;
  /** a little hop (world units), for stepping back from the door */
  hop: number;
  visible: boolean;
}

/** Steps per beat while walking: one leg pair per beat at 120 bpm. */
const STEP_FRAMES = BEAT;
/** frames a turn takes (on twos: four drawings) */
const TURN = 8;

function walking(f: number, from: number, to: number, a: V3, b: V3) {
  const t = clamp((f - from) / (to - from));
  const pos: V3 = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const moving = f > from && f < to;
  return { pos, walk: moving ? ((f - from) % (2 * STEP_FRAMES)) / (2 * STEP_FRAMES) : null };
}

/** A heading that holds each key and eases to the next over TURN frames (shortest way round). */
function headingAt(f: number, keys: [number, number][]): number {
  let h = keys[0][1];
  for (const [k, target] of keys) {
    if (f < k) break;
    let d = target - h;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    h += d * easings.inOutCubic(clamp((f - k) / TURN));
  }
  return h;
}

/** The wand on the five knocks: wound up a drawing before each, forward on the knock, then back. */
function knockWand(f: number): number {
  let w = 0;
  for (const k of KNOCKS) {
    const d = f - k;
    if (d >= -4 && d < 0) w = Math.max(w, 0.45);
    else if (d >= 0 && d < 4) w = Math.max(w, 1);
  }
  return f >= KNOCKS[0] - 8 && f < KNOCKS[KNOCKS.length - 1] + 6 ? Math.max(w, 0.3) : w;
}

const P = (x: number, z: number): V3 => [x, FLOOR, z];

/** where Clawd stands to knock, and where he waits once the door opens */
export const KNOCK_SPOT = P(0.2, -0.95);
export const WAIT_SPOT = P(1.25, -0.15);

export function clawdAt(film: number): ClawdPose {
  const f = twos(film);
  const pail = film >= at(26) && film < at(31, 2) ? 0 : 1;
  const base: ClawdPose = { pos: P(0, 1), heading: 0, walk: null, rise: 1, arms: 'down', eyes: 'open', wand: 0, pailLit: pail, envelope: 0, hatTip: 0, hop: 0, visible: false };
  // valley: pops up on bar 7, peeks into the pail, sets off screen-right (still walking as the page turns)
  if (f >= at(7) - 2 && f < at(9) + 8) {
    const w = walking(f, at(8, 2), at(9) + 8, P(0.6, 1.4), P(2.9, 1.0));
    return {
      ...base,
      visible: true,
      pos: w.pos,
      walk: w.walk,
      rise: progress(f, at(7), at(7) + 10, 'outCubic'),
      heading: headingAt(f, [
        [0, 0],
        [at(8, 2) - 6, Math.PI / 2],
      ]),
      eyes: f >= at(7, 3) && f < at(8) ? 'closed' : 'open',
    };
  }
  // graveyard: walks left to right, stops to shoo a ghost
  if (f >= at(9) + 8 && f < at(13) + 16) {
    const stop0 = at(11, 1);
    const stop1 = at(11, 3) + 6;
    const w =
      f < stop0
        ? walking(f, at(9) + 18, stop0, P(-3.6, 0.5), P(-0.2, 0.5))
        : f < stop1
          ? { pos: P(-0.2, 0.5), walk: null }
          : walking(f, stop1, at(13) + 16, P(-0.2, 0.5), P(3.6, 0.5));
    const shoo = f >= stop0 && f < stop1;
    return {
      ...base,
      visible: true,
      pos: w.pos,
      walk: w.walk,
      heading: headingAt(f, [
        [0, Math.PI / 2],
        [stop0, 0.9],
        [stop1 - 4, Math.PI / 2],
      ]),
      eyes: f >= stop0 && f < stop0 + BEAT ? 'left' : 'open',
      wand: shoo ? progress(f, at(11, 2) - 6, at(11, 2), 'outCubic') * (1 - progress(f, stop1 - 6, stop1, 'inCubic')) : 0,
      arms: shoo ? 'one-up' : 'down',
    };
  }
  // the lane: an ember flick opens the gates, then he walks ahead of the camera up the path
  if (f >= at(14) && f < at(17)) {
    const w = walking(f, at(14) + 8, at(16, 3), P(0.3, 1.6), P(0.1, -0.9));
    const flick = progress(f, at(14) - 6, at(14), 'outCubic') * (1 - progress(f, at(14) + 4, at(14) + 10, 'inCubic'));
    return { ...base, visible: true, pos: w.pos, walk: w.walk, heading: Math.PI, wand: flick, arms: flick > 0.2 ? 'one-up' : 'down' };
  }
  // the door
  if (f >= at(17) && f < at(35)) {
    // he knocks close to the door, glances at us in the silence, then hops back as it opens
    const back = progress(f, at(19, 2), at(20) - 2, 'inOutSine');
    const exit = f >= at(33, 2);
    let pos: V3 = [lerp(KNOCK_SPOT[0], WAIT_SPOT[0], back), FLOOR, lerp(KNOCK_SPOT[2], WAIT_SPOT[2], back)];
    let walk: number | null = back > 0 && back < 1 ? ((f - at(19, 2)) % 12) / 12 : null;
    if (exit) {
      const w = walking(f, at(33, 2), at(34, 3), WAIT_SPOT, P(2.9, 0.7));
      pos = w.pos;
      walk = w.walk;
    }
    const hop = back > 0 && back < 1 ? Math.abs(Math.sin(back * Math.PI * 2)) * 0.12 : 0;
    const toDoor = Math.PI + 0.25;
    const toUser = Math.PI + 0.75; // three-quarter: toward the neighbour, seen from the front-right
    const heading = headingAt(f, [
      [0, toDoor],
      [at(18, 3), 0.3], // the glance at the lens in the silence
      [at(19, 2) - 2, toUser],
      [at(25, 3), -0.35], // deadpan to us, arms up, as the seal lands
      [at(29), toUser - 0.3],
      [at(31, 3), 0.25], // to camera for the wink and the hat tip
      [at(33, 2), Math.PI / 2],
    ]);
    const tadaUp = progress(f, at(22) - 6, at(22), 'outCubic') * (1 - progress(f, at(23), at(23) + 6, 'inCubic'));
    const proud = progress(f, at(26) - 4, at(26), 'outCubic') * (1 - progress(f, at(29) - 6, at(29), 'inCubic'));
    return {
      ...base,
      visible: true,
      pos,
      walk,
      hop,
      heading,
      wand: f < at(19) ? knockWand(f) : 0,
      arms: tadaUp > 0.3 || proud > 0.3 ? 'up' : 'down',
      envelope: tadaUp,
      eyes: f >= at(32) && f < at(32, 3) ? 'wink' : (f >= at(21) && f < at(21, 2)) || (f >= at(31) && f < at(31, 2)) ? 'closed' : f >= at(29) && f < at(30) ? 'left' : 'open',
      hatTip: progress(f, at(32, 2) - 4, at(32, 2), 'outCubic') * (1 - progress(f, at(32, 3), at(32, 3) + 6, 'inCubic')),
    };
  }
  return base;
}

/** Where Clawd's pail hangs in the world (for the candy that drops into it). */
export function pailWorld(p: ClawdPose): V3 {
  const [x, y, z] = [-9.8 * 0.05, 0.12, 0.05];
  const c = Math.cos(p.heading);
  const s = Math.sin(p.heading);
  return [p.pos[0] + x * c + z * s, p.pos[1] + y, p.pos[2] - x * s + z * c];
}

/** The user in the bedsheet costume, on the door set. */
export interface UserPose {
  visible: boolean;
  pos: V3;
  /** 1 standing tall .. 0.68 sagging (after the stamp) */
  stand: number;
  /** 0 cream sheet .. 1 'ghosted' (cyan eyeholes, cold) */
  ghosted: number;
  hop: number;
  /** the candy bowl tipped toward Clawd, 0 .. 1 */
  tilt: number;
}

export function userAt(film: number): UserPose {
  const f = twos(film);
  // steps out of the dark room as the flap lifts, and back in before it closes
  const out = progress(f, at(20) + 2, at(20) + 14, 'outCubic') * (1 - progress(f, at(32, 3), at(33) - 2, 'inOutSine'));
  const visible = f >= at(20) && f < at(33) + 10;
  const hop = f >= at(20, 3) && f < at(21) ? Math.sin(((f - at(20, 3)) / BEAT) * Math.PI) * 0.18 : 0;
  const sag = progress(f, at(29), at(30), 'inOutCubic') * (1 - progress(f, at(32, 2), at(33), 'linear'));
  return {
    visible,
    pos: [-0.25, FLOOR, lerp(-1.75, -1.05, out)],
    stand: 1 - 0.32 * sag,
    ghosted: progress(f, at(26), at(26) + 4, 'linear') * (1 - progress(f, at(33), at(33) + 6, 'linear')),
    hop,
    tilt: progress(f, at(30, 1), at(30, 2), 'inOutSine') * (1 - progress(f, at(31), at(31) + 8, 'inOutSine')),
  };
}
