/**
 * Section 4, fourth answer: the Router's context is a cache; the rest waits behind IDs.
 *
 * The same rail as batch.ts, seen a little further back along its history. What a call has handled
 * is kept whole near the present: an event with its body hanging from it. Further back, an item is
 * out of the Router's view: its body has dropped to a shelf beside the rail and gone ash, and a
 * tick, its ID, is all the rail still carries.
 *
 * Then a person brings an old task up again. The call follows the ID from its tick to the body on
 * the shelf, and from that body to the next (each object names the next): the walk is drawn dashed,
 * because the prototype has summaries and read pointers but no multi-hop recall (FACTS.md, section
 * 3). The body it reaches comes back into view at the present. One body on the shelf is then seen
 * broken: recall loses less, not nothing (section 6, "Forgets nothing").
 */
import { clamp, easings, lerp, smoothstep } from '@aiv/core';
import { SECTIONS, at, line } from '../cues.ts';
import type { Pose, Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale, type Rgb } from '../kit/look.ts';
import { bump, prog } from '../kit/time.ts';
import { ARRIVALS, CALLS, HIST, PITCH, R, event, placeX, rail, restX, smear, type Arrival, type Kept } from './batch-rail.ts';
import { FROM as RAIL_FROM, TILT } from './batch.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { SLAB } from './world.ts';

const FROM = SECTIONS.cache;
const TO = SECTIONS.evidence;

// ── the plane ──────────────────────────────────────────────────────────────────────────────────
/** left of this place the rail keeps only an ID: the five places nearest the present stay whole */
const EDGE = HIST - 4.5 * PITCH;
/** the shelf: a rule beside the rail, on the near side, as far back as the history goes */
const SHELF_Z = 196;
/** a body: a bar that hangs from its event, or stands on the shelf */
const BODY = { half: 6.5, len: 56 } as const;
const HUNG = 2;
const STOOD = SHELF_Z - 4 - BODY.len;
/** the broken body: what is lost of it, from its end nearer the rail */
const GAP: readonly [number, number] = [19, 37];
/** an ID: a tick across the rail */
const TICK = { half: 2.4, reach: 17 } as const;

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
/** every handled item shows its body by the headline; then, on it, the old ones let theirs go, oldest first */
const BODIES_FROM = FROM + 2;
const CASCADE = line('cache').frame;
const DROP = 22;
/**
 * The call that answers the old task (lit from 52,1), and the walk it takes once the headline has
 * named it: the ID, its body, the next body, and back to the present. No part of the walk is drawn
 * before its words are up.
 */
const ASK = CALLS[CALLS.length - 1]!;
const PING = line('recall').frame;
const HOP_1: readonly [number, number] = [PING + 6, at(52, 4)];
const HOP_2: readonly [number, number] = [at(52, 4) + 6, at(53, 1)];
const BACK: readonly [number, number] = [at(53, 1) + 8, at(53, 3)];
/** one body is seen broken */
const LOSS = at(53, 4);
/** under the verdict the picture holds, then clears to the resting stack as the camera leaves */
const CLEAR: readonly [number, number] = [at(55, 1) + 20, at(55, 3) + 14];

/**
 * Down on the rail, higher in the frame than before: the shelf has the ground below it, the words
 * the ground above. Under the verdict the camera goes back along the history, over what waits there.
 */
const view = (x: number, dist = 0.66): Pose => ({ target: [x, R, 0], tilt: TILT, yaw: 0, dist, centre: [960, 560] });
const VIEW = { cache: view(190), recall: view(205), rest: view(40, 0.67) } as const;
/**
 * The camera leaves for the stack here, two beats before the next section: the verdict is read for
 * the first of them, over a picture that has only begun to turn, and the second is clear of type.
 */
const LEAVE = at(55, 3);

// ── what each handled item shows, and when ─────────────────────────────────────────────────────
interface Look {
  /** its body starts to show at this frame */
  body: number;
  /** its body leaves for the shelf at this frame (never, for the ones still in view at the end) */
  drop: number;
}
const NEVER = 1e9;
const LOOKS = new Map<Arrival, Look>();
{
  // the last call that had ended when this section begins
  let m0 = 0;
  for (let k = 0; k < CALLS.length; k++) if (CALLS[k]!.close <= FROM) m0 = k;
  const xAfter = (a: Arrival, m: number): number => restX(a.call, a.seat, m);
  for (const a of ARRIVALS) LOOKS.set(a, { body: CALLS[a.call]!.close + 4, drop: NEVER });
  // on the rail already: bodies show from the present back into the history
  const old = ARRIVALS.filter((a) => a.call <= m0).sort((a, b) => xAfter(b, m0) - xAfter(a, m0));
  old.forEach((a, i) => (LOOKS.get(a)!.body = BODIES_FROM + i * 4));
  // past the edge already: they drop on the headline, oldest first
  old
    .filter((a) => xAfter(a, m0) < EDGE)
    .reverse()
    .forEach((a, i) => (LOOKS.get(a)!.drop = CASCADE + i * 7));
  // pushed past the edge by a later call: they drop as they get there
  for (let m = m0 + 1; m < CALLS.length; m++) {
    ARRIVALS.filter((a) => a.call <= m && LOOKS.get(a)!.drop === NEVER && xAfter(a, m) < EDGE)
      .sort((a, b) => xAfter(a, m) - xAfter(b, m))
      .forEach((a, i) => (LOOKS.get(a)!.drop = CALLS[m]!.close + 7 + i * 6));
  }
}

const item = (call: number, seat: number): Arrival => {
  const a = ARRIVALS.find((b) => b.call === call && b.seat === seat);
  if (!a) throw new Error(`cache: no item at call ${call}, place ${seat}`);
  return a;
};
/** the ID the call starts from, the body the walk ends at, and the next one back, which is seen broken */
const FIRST = item(4, 3);
const FOUND = item(3, 2);
const BROKEN = item(3, 1);

const ashBody = (d: Draw): Rgb => mix(d.pal.ash, d.pal.bone, 0.14);

/** A body: a bar from `top` (its end nearer the rail), `len` long. */
function bar(d: Draw, x: number, top: number, len: number, rgb: Rgb, alpha: number, feather = 0, add = 0): void {
  if (len <= 0.5 || alpha <= 0) return;
  d.flat([x, R + 1.5, top + len / 2], [BODY.half, len / 2], Math.min(BODY.half, len / 2), rgb, { alpha: 0.95 * alpha, feather, add });
}

/** An ID: all the rail keeps of an item that is out of view. */
function tick(d: Draw, x: number, grow: number, rgb: Rgb, alpha: number, feather = 0, add = 0): void {
  if (grow <= 0 || alpha <= 0) return;
  d.flat([x, R + 2.2, 0], [TICK.half, TICK.reach * grow], TICK.half, rgb, { alpha: 0.95 * alpha, feather, add });
}

/** A handled item as the cache keeps it: whole near the present; further back a tick on the rail, its body on the shelf. */
const kept: Kept = (d, f, a, x, alpha) => {
  const p = d.pal;
  const look = LOOKS.get(a)!;
  // in the history it had greyed a little (batch-rail.ts); as the context shows what it holds, it is plain again
  const grey = mix(p.bone, p.ash, 0.42 * clamp((f - CALLS[a.call]!.close) / 330) * (1 - prog(f, FROM, FROM + 40)));
  const shown = prog(f, look.body, look.body + 14, easings.outCubic);
  const gone = prog(f, look.drop, look.drop + DROP);
  const soft = smear(Math.abs(x - placeX(a.call, a.seat, f - 1)));
  if (shown > 0) {
    const top = lerp(HUNG, STOOD, gone);
    const rgb = mix(grey, ashBody(d), gone);
    const fall = smear(Math.abs(top - lerp(HUNG, STOOD, prog(f - 1, look.drop, look.drop + DROP))));
    if (a === BROKEN && f > LOSS) {
      // part of it is gone: what is left stands either side of a gap
      const lost = prog(f, LOSS, LOSS + 40, easings.outCubic);
      // the two ends keep their round outer ends and are cut square where the piece came out
      bar(d, x, top, GAP[0], rgb, alpha, soft);
      d.flat([x, R + 1.5, top + GAP[0] - BODY.half / 2], [BODY.half, BODY.half / 2], 0, rgb, { alpha: 0.95 * alpha });
      bar(d, x, top + GAP[1], BODY.len - GAP[1], rgb, alpha, soft);
      d.flat([x, R + 1.5, top + GAP[1] + BODY.half / 2], [BODY.half, BODY.half / 2], 0, rgb, { alpha: 0.95 * alpha });
      // the piece comes out of it, plain for a moment (so it is seen to go), and is gone
      const piece = mix(rgb, p.bone, bump(f, LOSS, LOSS + 6, LOSS + 30));
      if (lost < 1) d.flat([x - 44 * lost, R + 1.5, top + (GAP[0] + GAP[1]) / 2 + 6 * lost], [BODY.half, (GAP[1] - GAP[0]) / 2], 0, piece, { alpha: 0.95 * alpha * (1 - lost) ** 1.5, feather: 3 * lost });
    } else bar(d, x, top, BODY.len * shown, rgb, alpha, soft + fall);
    // read by the call that walks back to it: a brief light
    const read = a === FIRST ? bump(f, HOP_1[1] - 2, HOP_1[1] + 5, HOP_1[1] + 38) : a === FOUND ? bump(f, HOP_2[1] - 2, HOP_2[1] + 5, HOP_2[1] + 44) : 0;
    if (read > 0) {
      d.pool([x, R, STOOD + BODY.len / 2], [10, BODY.len / 2], 38, p.think, 0.16 * read * alpha);
      bar(d, x, top, BODY.len, scale(p.think, 3), alpha * read, 0, 0.8);
    }
  }
  event(d, [x, R + 2, 0], grey, alpha, a.person, soft, 1 - gone);
  tick(d, x, gone, mix(p.bone, p.ash, 0.1), alpha, soft);
  if (a === FIRST) {
    // the ID the call finds in its context
    const found = bump(f, PING - 2, PING + 5, PING + 34);
    if (found > 0) {
      d.pool([x, R, 0], [8, 18], 34, p.think, 0.16 * found * alpha);
      tick(d, x, 1, scale(p.think, 3), alpha * found, 0, 0.8);
    }
  }
};

/** The shelf: a rule beside the rail, from the edge of the Router's view back along its history. */
function shelf(d: Draw, f: number, alpha: number): void {
  const grow = prog(f, FROM + 26, CASCADE - 2, easings.outCubic);
  if (grow <= 0 || alpha <= 0) return;
  const p = d.pal;
  const end = grow < 1 ? EDGE - 1200 * grow : -SLAB.halfW;
  d.line([[EDGE, R + 1, SHELF_Z], [end, R + 1, SHELF_Z]], 3, mix(p.bone, p.ash, 0.3), { alpha: 0.85 * alpha });
}

/** A point `u` of the way along a path of world points, by length. */
function along(pts: readonly Vec3[], u: number): Vec3 {
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![2] - pts[i - 1]![2]));
  const s = clamp(u) * lens[lens.length - 1]!;
  let i = 1;
  while (i < pts.length - 1 && lens[i]! < s) i++;
  const t = (s - lens[i - 1]!) / Math.max(1e-6, lens[i]! - lens[i - 1]!);
  return [lerp(pts[i - 1]![0], pts[i]![0], t), R + 2.4, lerp(pts[i - 1]![2], pts[i]![2], t)];
}

/** The walk back, and what it brings into view. */
function recall(d: Draw, f: number, alpha: number): void {
  if (f <= PING || alpha <= 0) return;
  const p = d.pal;
  const xa = placeX(FIRST.call, FIRST.seat, f);
  const xb = placeX(FOUND.call, FOUND.seat, f);
  // hop one: from the ID on the rail to its body on the shelf. Hop two: from that body to the one it names
  const one: Vec3[] = [[xa, R + 2.4, TICK.reach + 5], [xa, R + 2.4, STOOD - 6]];
  const two: Vec3[] = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    two.push([lerp(xa, xb, t), R + 2.4, STOOD - 8 - 4 * t * (1 - t) * 42]);
  }
  const u1 = prog(f, HOP_1[0], HOP_1[1]);
  const u2 = prog(f, HOP_2[0], HOP_2[1]);
  // where it has been: dashed, because this walk is the design's, not yet the prototype's
  const held = alpha * (1 - prog(f, ASK.close - 14, ASK.close));
  const dash: readonly [number, number, number] = [20, 0.56, 0];
  if (u1 > 0) d.line(one, 2.6, p.bone, { alpha: 0.85 * held, trim: [0, u1], dash });
  if (u2 > 0) d.line(two, 2.6, p.bone, { alpha: 0.85 * held, trim: [0, u2], dash });
  // the model reading its way along: one bead of light
  const on = clamp((f - HOP_1[0]) / 4) * (1 - prog(f, HOP_2[1], HOP_2[1] + 8));
  if (on > 0) {
    const at3 = u2 > 0 ? along(two, u2) : along(one, u1);
    d.halo(at3, 7, 30, p.think, 0.4 * on * alpha);
    d.dot(at3, 7.5, scale(p.think, 3.2), { alpha: on * alpha, add: 0.8 });
  }

  // the body it reached comes back into view at the present: a copy leaves the shelf for the call's free place
  const u = prog(f, BACK[0], BACK[1]);
  if (u <= 0) return;
  const here = (g: number): readonly [number, number] => {
    const v = prog(g, BACK[0], BACK[1]);
    // out of the shelf, along the clear ground between shelf and rail, then up to the rail
    const top = lerp(lerp(STOOD, 76, smoothstep(0, 0.34, v)), HUNG, smoothstep(0.66, 1, v));
    return [lerp(placeX(FOUND.call, FOUND.seat, g), placeX(CALLS.length - 1, 0, g), v), top];
  };
  const [x, top] = here(f);
  const [x1, top1] = here(f - 1);
  const rgb = mix(ashBody(d), p.bone, clamp(u * 2.5));
  bar(d, x, top, BODY.len, rgb, alpha * clamp((f - BACK[0]) / 5), smear(Math.hypot(x - x1, top - top1)));
  // back on the rail, it stands under its ID
  tick(d, x, prog(f, BACK[1] - 2, BACK[1] + 8, easings.outCubic), p.bone, alpha);
}

export const cache: Section = {
  from: FROM,
  to: TO,
  keys: [[line('cache').frame, VIEW.cache], [at(53, 1), VIEW.recall], [at(54, 2), VIEW.recall], [LEAVE, VIEW.rest]],
  draw(d, f) {
    rest(d, f);
    const alpha = 1 - prog(f, CLEAR[0], CLEAR[1]);
    shelf(d, f, alpha);
    rail(d, f, RAIL_FROM, alpha, kept);
    recall(d, f, alpha);
  },
};
