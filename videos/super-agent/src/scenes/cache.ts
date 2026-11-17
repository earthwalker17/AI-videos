/**
 * Section 4, fourth answer: the Router's context is a cache; the details wait behind IDs.
 *
 * The same rail as batch.ts, seen a little further back along its history. What a call has handled
 * is kept whole near the present: an event with its body hanging from it. Further back, an item is
 * out of the Router's view: its body has dropped to a shelf beside the rail and gone ash, and a
 * tick, its ID, is all the rail still carries. The first place past the edge of view carries the
 * name ID: whatever comes to rest there has just become one.
 *
 * Then a person brings an old task up again. The call reads that ID, follows it straight down to
 * its own body on the shelf, and a copy of the body comes back into view at the present. It is one
 * hop, and it is drawn solid: reading a shown ID through a tool is in the prototype (FACTS.md,
 * section 3). The article's walk from one object to the next is not drawn. Then another body on
 * the shelf loses a piece, which falls off the shelf and lies under it as ash: recall loses less,
 * not nothing (section 6, "Forgets nothing").
 */
import { clamp, easings, lerp, smoothstep } from '@aiv/core';
import { BEAT, LABELS, SECTIONS, at, line } from '../cues.ts';
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
const GAP: readonly [number, number] = [17, 39];
/** the piece comes out sideways this far and falls off the shelf: it comes to lie this far under the rule */
const LOST = { aside: 34, under: 12 } as const;
/** an ID: a tick across the rail, sturdy enough to carry its name */
const TICK = { half: 3.2, reach: 21 } as const;
/** the name ID stands over the first place past the edge, this many px clear of the tick there */
const NAMED = { x: HIST - 5 * PITCH, lift: 16 } as const;

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
/** every handled item shows its body by the headline; then, on it, the old ones let theirs go, from the edge back */
const BODIES_FROM = FROM + 2;
const CASCADE = line('cache').frame;
const DROP = 22;
/** the name lands when the first of them is seen to be a tick */
const NAMED_AT = CASCADE + DROP;
/**
 * The call that answers the old task (lit from 52,1), and what it does once the headline has named
 * it: it reads the ID (on the headline), a line runs from the ID to its body (there on the next
 * beat), and a copy of the body goes back to the present. None of it is drawn before its words are up.
 */
const ASK = CALLS[CALLS.length - 1]!;
const PING = line('recall').frame;
const READ: readonly [number, number] = [PING + 6, at(52, 4)];
const BACK: readonly [number, number] = [at(52, 4) + 4, at(53, 1.5) + 6];
/** another body loses a piece a beat after "It loses less. Not nothing." lands: it falls while the words are read */
const LOSS = line('recall.loss').frame + BEAT;
const FALL = 60;
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
/** the last call that had ended when this section begins */
const SETTLED = CALLS.reduce((m, c, k) => (c.close <= FROM ? k : m), 0);
/** where an item rests once call `m` has ended */
const xAfter = (a: Arrival, m: number): number => restX(a.call, a.seat, m);
{
  const m0 = SETTLED;
  for (const a of ARRIVALS) LOOKS.set(a, { body: CALLS[a.call]!.close + 4, drop: NEVER });
  // on the rail already: bodies show from the present back into the history
  const old = ARRIVALS.filter((a) => a.call <= m0).sort((a, b) => xAfter(b, m0) - xAfter(a, m0));
  old.forEach((a, i) => (LOOKS.get(a)!.body = BODIES_FROM + i * 4));
  // past the edge already: they drop on the headline, from the edge back, so the first tick is the named one
  old.filter((a) => xAfter(a, m0) < EDGE).forEach((a, i) => (LOOKS.get(a)!.drop = CASCADE + i * 7));
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
/**
 * The item the person asks about: its ID is the named one while the call runs. And the one that
 * loses a piece: another body, the oldest of the same group, with clear ground beside it for the
 * piece to fall in. Recall works; what is lost is something else.
 */
const ASKED = item(4, 3);
const BROKEN = item(4, 0);
// the name stands over an ID whenever the rail is at rest, and over the asked one while its call runs
for (let m = SETTLED; m < CALLS.length; m++) {
  if (!ARRIVALS.some((a) => a.call <= m && xAfter(a, m) === NAMED.x)) throw new Error(`cache: no ID under its name once call ${m} has ended`);
}
if (xAfter(ASKED, CALLS.length - 2) !== NAMED.x) throw new Error('cache: the asked ID is not the named one');

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
    const fall = smear(Math.abs(top - lerp(HUNG, STOOD, prog(f - 1, look.drop, look.drop + DROP))));
    // the body that breaks is plain while it does, so the eye finds it; then it is ash again
    const plain = a === BROKEN ? clamp((f - (LOSS - 14)) / 12) * (1 - prog(f, LOSS + FALL - 20, LOSS + FALL + 20)) : 0;
    const rgb = mix(mix(grey, ashBody(d), gone), p.bone, plain);
    if (a === BROKEN && f > LOSS) {
      // part of it is gone: what is left stands either side of a gap.
      // The two ends keep their round outer ends and are cut square where the piece came out
      bar(d, x, top, GAP[0], rgb, alpha, soft);
      d.flat([x, R + 1.5, top + GAP[0] - BODY.half / 2], [BODY.half, BODY.half / 2], 0, rgb, { alpha: 0.95 * alpha });
      bar(d, x, top + GAP[1], BODY.len - GAP[1], rgb, alpha, soft);
      d.flat([x, R + 1.5, top + GAP[1] + BODY.half / 2], [BODY.half, BODY.half / 2], 0, rgb, { alpha: 0.95 * alpha });
      // the piece comes out sideways, plain, and falls off the shelf. It lies under it as ash: dropped, behind no ID
      const half = (GAP[1] - GAP[0]) / 2;
      const from = top + GAP[0] + half;
      const where = (g: number): readonly [number, number] => {
        const v = clamp((g - LOSS) / FALL);
        return [x - LOST.aside * (1 - (1 - v) ** 2), lerp(from, SHELF_Z + LOST.under + half, clamp((v - 0.12) / 0.88) ** 2)];
      };
      const [px, pz] = where(f);
      const [px1, pz1] = where(f - 1);
      const piece = mix(p.bone, ashBody(d), prog(f, LOSS + FALL * 0.6, LOSS + FALL + 16));
      d.flat([px, R + 1.5, pz], [BODY.half, half], 0, piece, { alpha: 0.95 * alpha, feather: smear(Math.hypot(px - px1, pz - pz1)) });
    } else bar(d, x, top, BODY.len * shown, rgb, alpha, soft + fall);
    // read by the call that followed its ID here: lit for as long as the model reads it
    const read = a === ASKED ? bump(f, READ[1] - 2, READ[1] + 5, READ[1] + 40) : 0;
    if (read > 0) {
      d.pool([x, R, STOOD + BODY.len / 2], [10, BODY.len / 2], 38, p.think, 0.16 * read * alpha);
      bar(d, x, top, BODY.len, scale(p.think, 3), alpha * read, 0, 0.8);
    }
  }
  event(d, [x, R + 2, 0], grey, alpha, a.person, soft, 1 - gone);
  tick(d, x, gone, mix(p.bone, p.ash, 0.1), alpha, soft);
  if (a === ASKED) {
    // the ID the call finds in its context
    const found = bump(f, PING - 2, PING + 5, PING + 34);
    if (found > 0) {
      d.pool([x, R, 0], [8, TICK.reach], 34, p.think, 0.16 * found * alpha);
      tick(d, x, 1, scale(p.think, 3), alpha * found, 0, 0.8);
    }
  }
};

/** The name of an ID, over the place where whatever leaves the Router's view comes to rest as a tick. */
function named(d: Draw, f: number, alpha: number): void {
  if (alpha <= 0 || f <= NAMED_AT - 12) return;
  const q = d.cam.project([NAMED.x, R + 2.2, -TICK.reach]);
  d.text('label', LABELS.id, q.x, q.y - NAMED.lift, { align: 'centre', alpha, enter: clamp((f - (NAMED_AT - 12)) / 16) });
}

/** The shelf: a rule beside the rail, from the edge of the Router's view back along its history. */
function shelf(d: Draw, f: number, alpha: number): void {
  const grow = prog(f, FROM + 26, CASCADE - 2, easings.outCubic);
  if (grow <= 0 || alpha <= 0) return;
  const p = d.pal;
  const end = grow < 1 ? EDGE - 1200 * grow : -SLAB.halfW;
  d.line([[EDGE, R + 1, SHELF_Z], [end, R + 1, SHELF_Z]], 3, mix(p.bone, p.ash, 0.3), { alpha: 0.85 * alpha });
}

/** The read by ID, and what it brings into view. */
function recall(d: Draw, f: number, alpha: number): void {
  if (f <= PING || alpha <= 0) return;
  const p = d.pal;
  const xa = placeX(ASKED.call, ASKED.seat, f);
  // one hop: from the ID on the rail straight to its own body on the shelf
  const z0 = TICK.reach;
  const z1 = STOOD;
  const down = prog(f, READ[0], READ[1]);
  // where it has been stays while the call runs. Solid: the prototype reads a shown ID through a tool
  const held = alpha * (1 - prog(f, ASK.close - 14, ASK.close));
  if (down > 0) d.line([[xa, R + 2.4, z0], [xa, R + 2.4, z1]], 3.2, p.bone, { alpha: 0.9 * held, trim: [0, down] });
  // the model reading its way down: one bead of light
  const on = clamp((f - READ[0]) / 4) * (1 - prog(f, READ[1], READ[1] + 8));
  if (on > 0) {
    const at3: Vec3 = [xa, R + 2.4, lerp(z0, z1, down)];
    d.halo(at3, 7, 30, p.think, 0.4 * on * alpha);
    d.dot(at3, 7.5, scale(p.think, 3.2), { alpha: on * alpha, add: 0.8 });
  }

  // the body comes back into view at the present: a copy leaves the shelf for the call's free place
  const u = prog(f, BACK[0], BACK[1]);
  if (u <= 0) return;
  const here = (g: number): readonly [number, number] => {
    // an even pace: it crosses half the frame, and the eye has to keep up
    const v = prog(g, BACK[0], BACK[1], easings.inOutSine);
    // out of the shelf, along the clear ground between shelf and rail, then up to the rail
    const top = lerp(lerp(STOOD, 76, smoothstep(0, 0.34, v)), HUNG, smoothstep(0.66, 1, v));
    return [lerp(placeX(ASKED.call, ASKED.seat, g), placeX(CALLS.length - 1, 0, g), v), top];
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
    named(d, f, alpha);
  },
};
