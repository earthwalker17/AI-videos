/**
 * Where the puppets are and what they do, per film frame: blocking as data, so the camera,
 * the sets and the score can be checked against one table. Actors move on twos.
 */
import { clamp, lerp, progress } from '@aiv/core';
import { at, BEAT } from '../cues.ts';
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
  visible: boolean;
}

/** Steps per beat while walking: one leg pair per beat at 120 bpm. */
const STEP_FRAMES = BEAT;

function walking(f: number, from: number, to: number, a: V3, b: V3) {
  const t = clamp((f - from) / (to - from));
  const pos: V3 = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const moving = f > from && f < to;
  return { pos, walk: moving ? ((f - from) % (2 * STEP_FRAMES)) / (2 * STEP_FRAMES) : null };
}

const P = (x: number, z: number): V3 => [x, FLOOR, z];

export function clawdAt(film: number): ClawdPose {
  const f = twos(film);
  const pail = film >= at(26) && film < at(31, 2) ? 0 : 1;
  const base: ClawdPose = { pos: P(0, 1), heading: 0, walk: null, rise: 1, arms: 'down', eyes: 'open', wand: 0, pailLit: pail, visible: false };
  // valley: pops up on bar 7, peeks into the pail, sets off screen-right
  if (f >= at(7) - 2 && f < at(9)) {
    const w = walking(f, at(8, 2), at(9), P(0.5, 2.4), P(2.6, 1.8));
    return {
      ...base,
      visible: true,
      pos: w.pos,
      walk: w.walk,
      rise: progress(f, at(7), at(7) + 8, 'outCubic'),
      heading: f < at(8, 2) ? 0 : Math.PI / 2,
      eyes: f >= at(7, 3) && f < at(8) ? 'closed' : 'open',
    };
  }
  // graveyard: walks left to right, stops to shoo a ghost
  if (f >= at(9) && f < at(13) + 16) {
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
      heading: shoo ? 0.9 : Math.PI / 2,
      eyes: f >= stop0 && f < stop0 + BEAT ? 'left' : 'open',
      wand: shoo ? progress(f, at(11, 2) - 4, at(11, 2), 'outCubic') : 0,
      arms: shoo ? 'one-up' : 'down',
    };
  }
  // the lane: walks ahead of the camera up the path to the house
  if (f >= at(14) && f < at(17)) {
    const w = walking(f, at(14) + 6, at(16, 3), P(0.3, 2.8), P(0.1, -0.9));
    return { ...base, visible: true, pos: w.pos, walk: w.walk, heading: Math.PI, wand: f >= at(14) && f < at(14) + 10 ? 1 : 0 };
  }
  // the door
  if (f >= at(17) && f < at(35)) {
    const knock = f >= at(17) && f < at(18, 2);
    const tada = f >= at(22) && f < at(23);
    const wink = f >= at(32) && f < at(32, 3);
    const exit = f >= at(33, 2);
    const w = exit ? walking(f, at(33, 2), at(34, 3), P(0.55, 0.45), P(3.4, 0.6)) : { pos: P(0.55, 0.45), walk: null };
    let heading = Math.PI + 0.55; // three-quarter: facing the door, seen from the front-right
    if (f >= at(18, 3) && f < at(19, 2)) heading = 0.35; // the glance at the lens in the silence
    if (f >= at(31, 3) && f < at(33, 2)) heading = 0.25; // to camera for the wink
    if (exit) heading = Math.PI / 2;
    return {
      ...base,
      visible: true,
      pos: w.pos,
      walk: w.walk,
      heading,
      wand: knock ? 1 : 0,
      arms: tada || (f >= at(26) && f < at(29)) ? 'up' : 'down',
      eyes: wink ? 'wink' : f >= at(21) && f < at(21, 3) ? 'closed' : 'open',
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
  /** 1 standing tall .. 0.6 sagging (after the stamp) */
  stand: number;
  /** 0 cream sheet .. 1 'ghosted' (cyan eyeholes, cold) */
  ghosted: number;
  hop: number;
}

export function userAt(film: number): UserPose {
  const f = twos(film);
  const visible = f >= at(20) && f < at(33) + 8;
  const hop = f >= at(20, 3) && f < at(21) ? Math.sin(((f - at(20, 3)) / BEAT) * Math.PI) * 0.18 : 0;
  const sag = progress(f, at(29), at(30), 'inOutCubic') * (1 - progress(f, at(32, 3), at(33), 'linear'));
  return {
    visible,
    pos: P(-0.25, -1.05),
    stand: 1 - 0.32 * sag,
    ghosted: progress(f, at(26), at(26) + 4, 'linear') * (1 - progress(f, at(33), at(33) + 6, 'linear')),
    hop,
  };
}
