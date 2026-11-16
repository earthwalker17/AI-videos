/**
 * Section 4, the question and its first answer.
 *
 * "One Router for all this?": seen edge-on and close, the question stands on the Router's slab and
 * the world's events rise and crowd up under it. Nothing lights: this is the worry, not how the
 * design works.
 *
 * Then the look-down on the world. A flood of events (a few of them a person's) meets gate one, a
 * ruled edge of plain code: each is checked the moment it touches, most fall to ash on the spot,
 * and no model runs. The few that pass meet gate two, where a model judges each one: the first
 * light of the section. A person's request lifts off towards the Router. Work nobody asked for,
 * which the model would accept, is only recorded (the prototype's default): it stops at a short
 * shelf past the gate, hollow.
 */
import { clamp, easings, lerp, rand, smoothstep, valueNoise } from '@aiv/core';
import { LABELS, SECTIONS, at, line } from '../cues.ts';
import type { Pose, Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale, type Rgb } from '../kit/look.ts';
import { bump, lineState, prog } from '../kit/time.ts';
import { LANES, WORLD_NAME, rest } from './lift.ts';
import { DIM, type Section } from './section.ts';
import { LEVEL, NAME, SLAB, blur, edgeOn, namesOn, slabNameY, spineNameY } from './world.ts';

const SEED = 4204;
const W = LEVEL.world;

// ── the camera ─────────────────────────────────────────────────────────────────────────────────

/**
 * A look-down on the world that keeps the top of the frame for the words and all six lanes under
 * them. It looks at a point in front of the near lane, set low in the frame: on the way down from
 * the strata, and back up to them, the names on the stack's spine then never meet each other.
 */
const down = (x: number): Pose => ({ target: [x, W, 480], tilt: 62, yaw: 0, dist: 0.926, centre: [960, 971] });

/** where the flood meets gate one (under the question's view, so the camera comes straight down) and where the few that pass meet gate two */
const X1 = 526;
/** events drift at this many world units a frame; from gate one to gate two takes seven beats */
const V = 2.25;
const TRANSIT = 210;
const X2 = X1 + V * TRANSIT;

/**
 * The Router's level, flatter and closer than the resting strata: its slab lies under the question
 * (no edge of it behind the words) and the crowd gathers under its face.
 */
const ASK: Pose = { target: [110, LEVEL.router, 0], tilt: 4, yaw: 0, dist: 1.1, centre: [960, 640] };
/** gate one stands in the right third: the flood fills the frame */
const FLOOD_VIEW = down(X1 - 416);
/** one gate along: gate two stands where gate one stood */
const GATES_VIEW = down(X1 + 40);

/** the camera comes down as the question leaves, and lands on the bar line with the next headline */
const DIVE = at(26, 3);
const LANDED = at(27, 1);
/** gate one is ruled across the lanes by here; gate two by here */
const G1 = at(28, 3);
const G2 = at(30, 2);
/** the shelf is ruled, and the first unasked event is on it, by here */
const SHELF = at(31, 3);
/** the picture is held while the verdict is read, then cleared: everything of this section's own is gone by its end */
const HOLD = at(34, 2.5);
const CLEAR_FROM = HOLD - 9;
const CLEAR_BY = SECTIONS.threads - 2;

// ── the question: the crowd under the Router ───────────────────────────────────────────────────

/** how far the scene steps back behind an h1 and behind a verdict */
const H1_DIM = DIM.h1;
const VERDICT_DIM = DIM.verdict;

/**
 * 1 where a mark of radius `r` px at world point `o` is clear of the names on the stack's spine,
 * 0 behind one. The names are set by world.ts (slab, spineLabel) while the stack is seen edge-on:
 * nothing of this section's runs behind them, at the question or on the way down from it.
 */
function clearOfNames(d: Draw, o: Vec3, r: number): number {
  const n = namesOn(d);
  if (n <= 0) return 1;
  const q = d.cam.project(o);
  const rad = r * q.s;
  const cap = d.type.layout('label', LABELS.router).cap;
  const names: ReadonlyArray<readonly [string, number]> = [
    [LABELS.router, slabNameY(d, LEVEL.router)],
    [LABELS.workers, slabNameY(d, LEVEL.workers)],
    [LABELS.world, spineNameY(d, WORLD_NAME)],
  ];
  let k = 1;
  for (const [text, base] of names) {
    if (q.x - rad > NAME.x + d.type.layout('label', text).width + 16) continue;
    k = Math.min(k, clamp(Math.max(base - cap - 6 - (q.y + rad), q.y - rad - (base + 8)) / 8));
  }
  // as the names fade with the tilt, what they hid comes back
  return 1 - (1 - k) * clamp(n * 3);
}

const PACK = { z: SLAB.halfD - 10, top: LEVEL.router - SLAB.thick - 12.5, row: 19, pitch: 24, perRow: 121, r: 7.5 } as const;
const WAVES = 9;
const FIRST_WAVE = at(25, 3);

interface Riser {
  lane: number;
  /** where on its lane it appears */
  x0: number;
  /** it appears, leaves its lane and reaches the crowd at these frames */
  born: number;
  lift: number;
  land: number;
  /** its place under the Router */
  slot: Vec3;
  person: boolean;
}

const RISERS: Riser[] = [];
{
  // a crowd, not a queue: it hangs deeper under the slab in some places than in others, and fills
  // from the Router's underside down
  const places: Array<readonly [row: number, j: number, order: number]> = [];
  for (let j = 0; j < PACK.perRow; j++) {
    const deep = 2 + Math.round(4.4 * valueNoise(j * 0.19, 0.5, SEED) ** 1.3 + 0.8 * rand(SEED, j, 8));
    for (let row = 0; row < deep; row++) places.push([row, j, row + 1.7 * rand(SEED, row * 1000 + j, 7)]);
  }
  places.sort((a, b) => a[2] - b[2]);
  // waves land on the half beats, each larger than the last: the events multiply
  let n = 0;
  for (let w = 1; w <= WAVES; w++) {
    const upto = Math.round((places.length * (w * (w + 1))) / (WAVES * (WAVES + 1)));
    for (; n < upto; n++) {
      const [row, j] = places[n]!;
      const x = (j - (PACK.perRow - 1) / 2) * PACK.pitch + (row % 2) * (PACK.pitch / 2);
      const land = FIRST_WAVE + (w - 1) * 15 - Math.round(rand(SEED, n, 5) * 5);
      const lift = land - 36 - Math.round(rand(SEED, n, 1) * 12);
      RISERS.push({
        lane: Math.floor(rand(SEED, n, 2) * LANES.length),
        x0: x + (rand(SEED, n, 3) - 0.5) * 110,
        born: Math.max(SECTIONS.spine + 2, lift - 8 - Math.round(rand(SEED, n, 4) * 12)),
        lift,
        land,
        // packed, but not ruled: each stands a little off its place
        slot: [x + (rand(SEED, n, 9) - 0.5) * 5, PACK.top - row * PACK.row + (rand(SEED, n, 10) - 0.5) * 3, PACK.z],
        person: rand(SEED, n, 6) < 0.06,
      });
    }
  }
}

/** The worry: events leave every lane and press up under the Router's slab. */
function crowd(d: Draw, f: number, focus: number): void {
  const e = edgeOn(d);
  if (e <= 0 || f < SECTIONS.spine) return;
  const p = d.pal;
  // the question dims the stack it stands on, not what it asks about: the crowd keeps its own
  // brightness (bone, never more) under the headline's shade
  const q1 = lineState('spine', f);
  const keep = 1 / (1 - H1_DIM * q1.enter * (1 - q1.exit));
  const bone = scale(p.bone, keep);
  const coral = scale(p.you, keep);
  for (const r of RISERS) {
    if (f <= r.born) continue;
    const u = easings.inOutCubic((f - r.lift) / (r.land - r.lift));
    const o: Vec3 = [lerp(r.x0, r.slot[0], u), lerp(W, r.slot[1], u), lerp(LANES[r.lane]!, r.slot[2], u)];
    const q = d.cam.project(o);
    const rad = PACK.r * q.s;
    // below the Workers' slab an event is seen only under its front face; above it, in the open
    const under = d.cam.project([o[0], LEVEL.workers - SLAB.thick, SLAB.halfD]).y;
    const seen = Math.max(clamp((q.y - rad - under - 3) / 8), clamp((o[1] - LEVEL.workers - 6) / 26)) * clearOfNames(d, o, PACK.r + 5);
    const b = blur(o[1], focus);
    const alpha = (e * seen * clamp((f - r.born) / 6)) / (1 + 0.8 * b);
    if (alpha <= 0) continue;
    // rising, it is fast: it stretches into its own motion
    const du = u > 0 && u < 1 ? Math.abs(easings.inOutCubic((f - 1 - r.lift) / (r.land - r.lift)) - u) : 0;
    const feather = b * 3.2 + Math.min(6, du * 480 * 0.14);
    d.dot(o, PACK.r, bone, { alpha: 0.95 * alpha, feather });
    if (r.person) d.dot(o, PACK.r + 4.6, coral, { stroke: 2.2, alpha: 0.95 * alpha, feather });
  }
}

// ── the first answer: the flood and the two gates ──────────────────────────────────────────────

/**
 * What becomes of an event: it went by before the gates were drawn (free), the code stops it, or
 * the code passes it on to the model, which drops it, lets it up or has it recorded.
 */
type Fate = 'free' | 'code' | 'drop' | 'lift' | 'park';

interface Ev {
  lane: number;
  /** it touches gate one (or passes its place) at this frame */
  t: number;
  /** a person sent it */
  person: boolean;
  fate: Fate;
  /** its number among its lane's dropped (code), among the model's dropped (drop) or on the shelf (park) */
  n: number;
}

/**
 * The few that pass the code: `a` is the frame each reaches gate two, on a beat. None of those the
 * model judges in this section runs on the near lane: its light would pool under the gates' names.
 */
const CAST: ReadonlyArray<{ a: number; lane: number; fate: 'drop' | 'lift' | 'park' }> = [
  { a: at(30, 2), lane: 2, fate: 'drop' },
  { a: at(30, 3), lane: 4, fate: 'lift' },
  { a: at(31, 1), lane: 1, fate: 'park' },
  { a: at(31, 4), lane: 3, fate: 'drop' },
  { a: at(32, 2), lane: 3, fate: 'lift' },
  { a: at(32, 3), lane: 0, fate: 'park' },
  { a: at(33, 1), lane: 4, fate: 'lift' },
  // people's requests still on their way when the section ends
  { a: at(33, 2) + TRANSIT, lane: 3, fate: 'lift' },
  { a: at(33, 3) + TRANSIT, lane: 1, fate: 'lift' },
  { a: at(34, 1) + TRANSIT, lane: 5, fate: 'lift' },
  { a: at(34, 3) + TRANSIT, lane: 2, fate: 'lift' },
  { a: at(35, 2) + TRANSIT, lane: 4, fate: 'lift' },
];

/** People's prompts that went by before the gates were drawn: `t` is when each passed gate one's place. */
const EARLY: ReadonlyArray<{ t: number; lane: number }> = [
  { t: G1 - 300, lane: 3 },
  { t: G1 - 150, lane: 1 },
];

/** frames the model takes over one event */
const JUDGE = 30;
const DOT = 13;
const RING = 23;
const ASH = 10.5;
/** an event's centre stops this far short of a gate's rule */
const STOP = 19;
const HOP = 14;
const RULE = 4.2;
/** the gates' rules start just past the far lane and leave the frame at the bottom */
const Z0 = LANES[0]! - 46;
const Z1 = 700;
/** the gates' names stand beside their rules, under the near lane */
const NAME_Z = LANES[LANES.length - 1]! + 66;
/** the bank of ash against gate one: a file on each side of every lane, pushed back as it grows */
const BANK = { side: 37, step: 25, first: RULE + ASH + 1.5, push: 10 } as const;
/** the shelf: a short rule past gate two, across the two far lanes */
const SHELF_X = X2 + 172;
const SHELF_Z: readonly [number, number] = [Z0 + 8, (LANES[1]! + LANES[2]!) / 2];
/** as gate one is ruled, what had already gone by clears: from here on nothing is downstream that the code did not pass */
const SWEPT: readonly [number, number] = [G1 - 22, G1 + 10];

const EVENTS: Ev[] = [];
/** per lane, when the code stops an event: the bank's clock */
const STOPS: number[][] = LANES.map(() => []);
{
  /** the lanes whose first event meets the gate as it lands; the others follow off the beat */
  const FRONT = [5];
  /** irregular gaps, never closer than a body and a half */
  const gap = (lane: number, k: number): number => 27 + Math.round(Math.min(84, -Math.log(1 - 0.98 * rand(SEED, lane * 131 + k, 11)) * 15));
  for (let lane = 0; lane < LANES.length; lane++) {
    const passes = [...CAST.filter((c) => c.lane === lane).map((c) => c.a - TRANSIT), ...EARLY.filter((c) => c.lane === lane).map((c) => c.t)];
    const clear = (t: number): boolean => !passes.some((tp) => Math.abs(tp - t) < 30);
    const first = FRONT.includes(lane) ? G1 : G1 + 6 + Math.round(rand(SEED, lane, 12) * 14);
    // from the gate's landing on, the code checks every one
    let t = first;
    for (let k = 0; t < G1 + 1500; k++) {
      if (clear(t)) {
        EVENTS.push({ lane, t, person: false, fate: 'code', n: STOPS[lane]!.length });
        STOPS[lane]!.push(t);
      }
      t += gap(lane, k);
    }
    // before it, the world's events simply went by
    t = first;
    for (let k = 1; t > G1 - 900; k++) {
      t -= gap(lane, -k);
      // the last of them is clear of the gate's place when it is ruled
      if (t < G1 - 36 && clear(t)) EVENTS.push({ lane, t, person: false, fate: 'free', n: 0 });
    }
  }
  for (const c of EARLY) EVENTS.push({ lane: c.lane, t: c.t, person: true, fate: 'free', n: 0 });
  let parked = 0;
  let dropped = 0;
  for (const c of CAST) EVENTS.push({ lane: c.lane, t: c.a - TRANSIT, person: c.fate === 'lift', fate: c.fate, n: c.fate === 'park' ? parked++ : c.fate === 'drop' ? dropped++ : 0 });
}

/** Where the `n`th event the code stopped in a lane lies at frame `f`: each later one on its side pushes it a place back. */
function bankPlace(lane: number, n: number, f: number): Vec3 {
  const stops = STOPS[lane]!;
  let rank = 0;
  let last = 0;
  for (let m = n + 2; m < stops.length && stops[m]! <= f; m += 2) {
    rank++;
    last = stops[m]!;
  }
  const back = rank === 0 ? 0 : rank - 1 + easings.outCubic((f - last) / BANK.push);
  return [X1 - BANK.first - back * BANK.step, W, LANES[lane]! + (n % 2 === 0 ? BANK.side : -BANK.side)];
}

/** A gate: a matte ruled edge across every lane, its name beside it. */
function rule(d: Draw, x: number, landed: number, name: string, alpha: number, soft: number): void {
  const p = d.pal;
  const on = prog(d.f, landed - 24, landed);
  if (on <= 0 || alpha <= 0) return;
  const half = ((Z1 - Z0) / 2) * on;
  // it sits on the plane: a little shade beside it
  d.flat([x + 7, W, Z0 + half], [11, half], 4, p.ground[0], { alpha: 0.55 * alpha, feather: 9 + soft });
  d.flat([x, W + 1, Z0 + half], [RULE, half], 1, mix(p.bone, p.ash, 0.06), { alpha: 0.95 * alpha, feather: soft });
  const q = d.cam.project([x, W, NAME_Z]);
  d.text('label', name, q.x + 30, q.y + 16, { alpha, enter: clamp((d.f - (landed - 12)) / 16) });
}

/** An event: a disc that faces the viewer; it wears a coral ring when a person sent it. */
function event(d: Draw, o: Vec3, rgb: Rgb, alpha: number, person: boolean, feather: number): void {
  alpha *= clearOfNames(d, o, RING);
  if (alpha <= 0) return;
  d.dot(o, DOT, rgb, { alpha: 0.94 * alpha, feather });
  if (person) d.dot(o, RING, d.pal.you, { stroke: 3.4, alpha: 0.95 * alpha, feather });
}

/** A dropped event: ash, lying on the plane. */
function ash(d: Draw, o: Vec3, alpha: number, feather: number, gain = 1): void {
  alpha *= clearOfNames(d, o, ASH);
  if (alpha <= 0) return;
  d.flat([o[0], W + 0.5, o[2]], [ASH, ASH], ASH, scale(mix(d.pal.ash, d.pal.bone, 0.1), gain), { alpha: 0.92 * alpha, feather });
}

/** An event dropped at frame `t0`: it turns to ash and falls aside, from `from` to `to`. */
function fall(d: Draw, f: number, t0: number, from: Vec3, to: Vec3, alpha: number, soft: number, gain = 1): void {
  const p = d.pal;
  const u = clamp((f - t0) / HOP);
  const h = easings.outCubic(u);
  const o: Vec3 = [lerp(from[0], to[0], h), W, lerp(from[2], to[2], h)];
  const speed = (Math.hypot(to[0] - from[0], to[2] - from[2]) * 3 * (1 - u) * (1 - u)) / HOP;
  const feather = soft + Math.min(7, speed * 0.16);
  const flat = clamp((f - t0) / 8);
  ash(d, o, alpha * flat, feather, gain);
  event(d, o, mix(p.bone, p.ash, clamp((f - t0) / 4)), alpha * (1 - flat), false, feather);
}

function flood(d: Draw, f: number, focus: number, show: number): void {
  if (show <= 0) return;
  const p = d.pal;
  const b = blur(W, focus);
  const dim = show / (1 + 0.9 * b);
  const soft = b * 4;

  // the lanes, as the resting stack draws them
  for (const z of LANES) d.line([[-SLAB.halfW, W, z], [SLAB.halfW, W, z]], 1.4, p.ash, { alpha: (0.42 * show) / (1 + 0.9 * b), feather: b * 2 });

  // what the code has stopped lies against gate one. Behind the verdict the scene steps back, but
  // not this: it is what the verdict counts
  const v1 = lineState('v1', f);
  const kept = lerp(1, 1 / (1 - VERDICT_DIM * v1.enter * (1 - v1.exit)), 0.8);
  for (const ev of EVENTS) {
    if (ev.fate === 'code' && f >= ev.t + HOP) ash(d, bankPlace(ev.lane, ev.n, f), dim, soft, kept);
  }

  rule(d, X1, G1, LABELS.code, dim, soft);
  rule(d, X2, G2, LABELS.model, dim, soft);

  // the shelf: where unasked work is recorded
  const shelf = prog(f, SHELF - 16, SHELF, easings.outCubic);
  if (shelf > 0) d.line([[SHELF_X, W, SHELF_Z[0]], [SHELF_X, W, SHELF_Z[1]]], 4, p.bone, { alpha: 0.88 * dim, feather: soft * 0.5, trim: [0, shelf] });

  for (const ev of EVENTS) {
    const z = LANES[ev.lane]!;
    const dt = f - ev.t;
    if (ev.fate === 'free') {
      // it went by before there was a gate
      const x = X1 - STOP + V * dt;
      if (x > X1 - 2600 && x < X1 + 1600) event(d, [x, W, z], p.bone, dim * (1 - prog(f, SWEPT[0], SWEPT[1])), ev.person, soft);
      continue;
    }
    // gate one checks it the moment it touches: the rule clicks, and nothing lights
    const click = bump(f, ev.t - 1.5, ev.t + 1.5, ev.t + 10);
    if (click > 0) d.flat([X1, W + 1.5, z], [RULE + 2.4, 34], 2, p.bone, { alpha: 0.96 * click * dim, feather: soft });
    if (dt < 0) {
      const x = X1 - STOP + V * dt;
      if (x > X1 - 2600) event(d, [x, W, z], p.bone, dim, ev.person, soft);
      continue;
    }
    if (ev.fate === 'code') {
      if (dt < HOP) fall(d, f, ev.t, [X1 - STOP, W, z], bankPlace(ev.lane, ev.n, f), dim, soft, kept);
      continue;
    }
    // it passed the code: on to gate two
    const a = ev.t + TRANSIT;
    if (f < a) {
      event(d, [X1 - STOP + V * dt, W, z], p.bone, dim, ev.person, soft);
      continue;
    }
    const at2: Vec3 = [X2 - STOP, W, z];
    // the model judges it: a pulse of light on the gate, pooled on the plane
    const run = bump(f, a - 2, a + 10, a + JUDGE + 12);
    if (run > 0) {
      d.pool([X2 - 8, W, z], [36, 58], 74, p.think, 0.2 * run * dim);
      d.flat([X2, W + 2, z], [RULE + 1.6, 62], RULE + 1.6, scale(p.think, 3.2), { alpha: run * dim, add: 0.8, feather: soft });
    }
    const v = a + JUDGE;
    if (f < v) {
      event(d, at2, p.bone, dim, ev.person, soft);
    } else if (ev.fate === 'drop') {
      const to: Vec3 = [X2 - BANK.first, W, z + (ev.n % 2 === 0 ? BANK.side : -BANK.side)];
      if (f < v + HOP) fall(d, f, v, at2, to, dim, soft, kept);
      else ash(d, to, dim, soft, kept);
    } else if (ev.fate === 'lift') {
      // a person's request goes up, towards the Router: off this plane and out of the picture
      const height = (g: number): number => 300 * easings.inOutSine(clamp((g - v) / 62)) ** 1.5;
      const y = height(f);
      const gone = smoothstep(110, 270, y);
      const o: Vec3 = [at2[0], W + y, z];
      // the shade it leaves on the plane tells its height
      const k = 1 + y / 150;
      d.flat([at2[0], W, z], [DOT * k, DOT * k], DOT * k, p.ground[0], { alpha: 0.6 * dim * clamp(y / 30) * (1 - gone), feather: 5 + y * 0.09 });
      event(d, o, p.bone, dim * (1 - gone), ev.person, soft + blur(y, 0) * 6 + Math.min(7, (y - height(f - 1)) * 0.16));
    } else {
      // unasked work the model would accept: recorded, not started. It stops at the shelf, hollow
      const u = easings.inOutCubic((f - v) / JUDGE);
      const to = SHELF_X - STOP + 3;
      const o: Vec3 = [lerp(at2[0], to, u), W, z];
      const du = u > 0 && u < 1 ? u - easings.inOutCubic((f - 1 - v) / JUDGE) : 0;
      const feather = soft + Math.min(7, du * (to - at2[0]) * 0.16);
      const hollow = clamp((f - v - JUDGE * 0.5) / (JUDGE * 0.5));
      event(d, o, p.bone, dim * (1 - hollow), false, feather);
      d.dot(o, DOT, p.bone, { stroke: 3.4, alpha: 0.94 * dim * hollow, feather });
    }
  }
}

export const gates: Section = {
  from: SECTIONS.spine,
  to: SECTIONS.threads,
  keys: [
    // the camera lands with the question, on the hit
    [SECTIONS.spine, ASK],
    [DIVE, ASK],
    [LANDED, FLOOD_VIEW],
    [at(29, 3), FLOOD_VIEW],
    [G2, GATES_VIEW],
    // held while the verdict is read: the stack does not swing in behind it
    [HOLD, GATES_VIEW],
  ],
  place: {
    // the question stands on the Router's slab, beside you: no edge of the stack runs behind it
    spine: (d) => ({ x: 1040, y: 124 + d.type.layout('h1', line('spine').text).cap, align: 'centre' }),
  },
  linePlace: {
    // the support line runs on from its headline, over the gate it is about
    'gate1.no': (d) => ({ x: 150 + d.type.layout('h3', line('gate1').text).width + 54, y: 226, align: 'left' }),
  },
  draw(d, f) {
    const focus = d.cam.pose.target[1];
    // the flood takes over the lanes as the camera comes down, and gives them back at the end
    // (the swap happens while the lanes are still below the frame)
    const show = prog(f, DIVE + 2, DIVE + 18) * (1 - prog(f, CLEAR_FROM, CLEAR_BY));
    rest(d, f, { lanes: 1 - show });
    crowd(d, f, focus);
    flood(d, f, focus, show);
  },
};
