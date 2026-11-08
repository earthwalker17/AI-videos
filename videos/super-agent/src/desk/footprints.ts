/**
 * Analytic shadows (synthesis §2, Shadows): every object that stands on or hangs over a receiver
 * registers its footprint here, a rounded rectangle, a circle or a capsule segment with the heights
 * it spans. The desk shader and every lit material (gl/light.ts) cast each footprint's shadow from
 * the part above the receiver: swept along the key by 0.84·h, with a penumbra of 4 + 0.35·h, plus a
 * contact occlusion of 16–28 u round footprints standing on the receiver. No shadow maps, so no
 * shadow box to depend on where a chunk began (knowledge/r3f-under-remotion.md).
 *
 * Pure: the footprints are a function of the layout and the frame's state. The GPU gets them
 * packed as three vec4 each (`packFootprints`).
 */
import { SHADOW_K, BAYS, BAY_FLOOR, BELT, BENCH, CARD, CHUTE, CHUTE_POSTS, CORDS, CROSS, DECK, DECK_PLATE, DRAWER, FANFOLD, FEEDERS, FEEDER_H, FOLDER, GALLEY_LAMP, GALLEY_TRAY, GATE, HOPPER, LAMP, LEG, LEGS, LOCK, MAST, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, SLIP, SPIKE, SPOOL, THROAT, TOWER, TRAIT_PLATE, towerTop, WINDOW, YOU, penumbra, rectC, type BayLayout, type P2, type P3, type Rect } from './layout.ts';
import { slipPose, type DeskState } from './state.ts';

/** At most this many footprints reach the GPU (the uniform array's size). */
export const MAX_FOOTPRINTS = 128;

export type Footprint =
  /** a rounded rectangle centred at c, half sizes h, corner radius r, turned by rot (radians) */
  | { kind: 'rect'; c: P2; h: P2; r: number; rot: number; z0: number; z1: number; contact: number }
  | { kind: 'circle'; c: P2; r: number; z0: number; z1: number; contact: number }
  /** a capsule from a (at height ha) to b (at hb), radius r: cords, arms, sloped plates */
  | { kind: 'seg'; a: P2; b: P2; ha: number; hb: number; r: number }
  /** an open structure overhead (the deck): it casts no shadow of its own but takes sky light from what lies under it */
  | { kind: 'canopy'; c: P2; h: P2; z: number; strength: number };

/** A footprint of a rectangle from z0 to z1 (contact: how strongly it occludes the receiver it stands on, 0..1). */
export const rectFp = (r: Rect, z0: number, z1: number, contact = 1, radius = 3): Footprint => ({
  kind: 'rect',
  c: rectC(r),
  h: [(r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2],
  r: Math.min(radius, (r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2),
  rot: 0,
  z0,
  z1,
  contact,
});
export const circleFp = (c: P2, r: number, z0: number, z1: number, contact = 1): Footprint => ({ kind: 'circle', c, r, z0, z1, contact });
export const segFp = (a: P3, b: P3, r: number): Footprint => ({ kind: 'seg', a: [a[0], a[1]], b: [b[0], b[1]], ha: a[2], hb: b[2], r });

/** Segments along a 3D polyline (for cords and the chute). */
export const polySegs = (pts: readonly P3[], r: number): Footprint[] => pts.slice(1).map((b, i) => segFp(pts[i], b, r));

/** The four walls of a bay (the north wall split round its door) and its floor. */
export function bayWalls(b: BayLayout): Rect[] {
  const { box, wall, southWall, door } = b;
  return [
    { x0: box.x0, x1: box.x0 + wall, y0: box.y0, y1: box.y1 },
    { x0: box.x1 - wall, x1: box.x1, y0: box.y0, y1: box.y1 },
    { x0: box.x0 + wall, x1: box.x1 - wall, y0: box.y0, y1: box.y0 + southWall },
    { x0: box.x0 + wall, x1: door[0], y0: box.y1 - wall, y1: box.y1 },
    { x0: door[1], x1: box.x1 - wall, y0: box.y1 - wall, y1: box.y1 },
  ];
}
/** The closed door plate in the north wall's gap (a little lower than the wall). */
export const bayDoor = (b: BayLayout): Rect => ({ x0: b.door[0], x1: b.door[1], y0: b.box.y1 - b.wall + 2, y1: b.box.y1 - 2 });

function bayFootprints(b: BayLayout): Footprint[] {
  const fp: Footprint[] = bayWalls(b).map((w) => rectFp(w, 0, b.wallH, 1, 2));
  fp.push(rectFp(bayDoor(b), 0, b.wallH - 6, 1, 2));
  fp.push(rectFp(b.box, 0, BAY_FLOOR, 1, 6));
  fp.push(rectFp(b.slot, BAY_FLOOR, 40, 1, 4));
  fp.push(rectFp(b.dossier, BAY_FLOOR, BAY_FLOOR + 4 + b.sheets * SHEET, 1, 4));
  return fp;
}

/** Every footprint that does not move in this lookdev (the layout's). */
export function staticFootprints(): Footprint[] {
  const fp: Footprint[] = [];
  // under the deck the desk sees less sky: the deck's outline as a canopy
  fp.push({ kind: 'canopy', c: [(DECK.x0 + DECK.x1) / 2, (DECK.y0 + DECK.y1) / 2], h: [(DECK.x1 - DECK.x0) / 2 - 10, (DECK.y1 - DECK.y0) / 2 - 10], z: DECK.railZ0, strength: 0.6 });
  // the Register: legs, rails, cross members, the plate, the reel and its frame, the head, the window, the lamp
  for (const [x, y] of LEGS) fp.push(rectFp({ x0: x - LEG / 2, x1: x + LEG / 2, y0: y - LEG / 2, y1: y + LEG / 2 }, 0, DECK.railZ0, 1, 3));
  const r = DECK.rail;
  fp.push(rectFp({ x0: DECK.x0, x1: DECK.x1, y0: DECK.y0, y1: DECK.y0 + r }, DECK.railZ0, DECK.top, 0));
  fp.push(rectFp({ x0: DECK.x0, x1: DECK.x1, y0: DECK.y1 - r, y1: DECK.y1 }, DECK.railZ0, DECK.top, 0));
  fp.push(rectFp({ x0: DECK.x0, x1: DECK.x0 + r, y0: DECK.y0, y1: DECK.y1 }, DECK.railZ0, DECK.top, 0));
  fp.push(rectFp({ x0: DECK.x1 - r, x1: DECK.x1, y0: DECK.y0, y1: DECK.y1 }, DECK.railZ0, DECK.top, 0));
  for (const c of CROSS) fp.push(rectFp(c, DECK.railZ0, DECK.top, 0));
  fp.push(rectFp(DECK_PLATE, DECK.top - 6, DECK.top, 0));
  fp.push(circleFp([REEL.x, REEL.y], REEL.r, REEL.flangeZ[0], REEL.packZ[1], 0.6));
  fp.push(circleFp([REEL.x, REEL.y], REEL.hubR, REEL.packZ[1], REEL.hubZ[1], 0.6));
  for (const m of REEL_FRAME) fp.push(rectFp(m, REEL_FRAME_Z[0], REEL_FRAME_Z[1], 0.7));
  fp.push(rectFp(PRINT_HEAD.box, PRINT_HEAD.z[0], PRINT_HEAD.z[1] + 4, 0.8));
  fp.push(rectFp(THROAT.box, THROAT.z[0], THROAT.z[1], 0));
  const wf = WINDOW.frame;
  const bar = WINDOW.bar;
  fp.push(rectFp({ ...wf, y1: wf.y0 + bar }, WINDOW.z[0], WINDOW.z[1], 0.5, 2));
  fp.push(rectFp({ ...wf, y0: wf.y1 - bar }, WINDOW.z[0], WINDOW.z[1], 0.5, 2));
  fp.push(rectFp({ ...wf, x1: wf.x0 + bar }, WINDOW.z[0], WINDOW.z[1], 0.5, 2));
  fp.push(rectFp({ ...wf, x0: wf.x1 - bar }, WINDOW.z[0], WINDOW.z[1], 0.5, 2));
  fp.push(rectFp({ x0: READ_LAMP.x0, x1: READ_LAMP.x1, y0: READ_LAMP.y - READ_LAMP.r, y1: READ_LAMP.y + READ_LAMP.r }, READ_LAMP.z - READ_LAMP.r, READ_LAMP.z + READ_LAMP.r, 0, READ_LAMP.r));
  for (const x of READ_LAMP.posts) fp.push(segFp([x, READ_LAMP.postY, DECK.top], [x, READ_LAMP.y, READ_LAMP.z + 10], 4));
  fp.push(rectFp(DRAWER.box, DRAWER.z[0], DRAWER.z[1], 0));
  fp.push(rectFp(HOPPER.box, HOPPER.z[0], HOPPER.z[1], 0.5));
  fp.push(rectFp(LOCK.box, LOCK.z[0], LOCK.z[1], 0.6));
  fp.push(segFp([LOCK.key.x0, LOCK.key.y, LOCK.key.z], [LOCK.key.x1 + LOCK.key.bowR, LOCK.key.y, LOCK.key.z], 5));
  fp.push(rectFp(FANFOLD.box, 0, FANFOLD.sheets * SHEET + 2, 1, 2));
  fp.push(rectFp(TRAIT_PLATE.box, TRAIT_PLATE.z[0], TRAIT_PLATE.z[1], 0.5, 6));
  // the ramp's curved sheet, as a sloped plate from the rail down to its foot
  const rampX = (RAMP.x0 + RAMP.x1) / 2;
  fp.push(segFp([rampX, DECK.y0, RAMP.top], [rampX, RAMP.foot + 16, 4], (RAMP.x1 - RAMP.x0) / 2));
  // the bays
  for (const b of Object.values(BAYS)) fp.push(...bayFootprints(b));
  fp.push(rectFp(BENCH.top, BENCH.z[0], BENCH.z[1], 0.4));
  fp.push(rectFp(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 0.7));
  fp.push(circleFp([TOWER.x, TOWER.y], TOWER.r, TOWER.base, towerTop(), 1));
  fp.push(rectFp(GALLEY_TRAY.box, GALLEY_TRAY.z[0], GALLEY_TRAY.z[1], 1, 4));
  fp.push(rectFp({ x0: GALLEY_LAMP.x0, x1: GALLEY_LAMP.x1, y0: GALLEY_LAMP.y - 10, y1: GALLEY_LAMP.y + 10 }, GALLEY_LAMP.z - 8, GALLEY_LAMP.z + 8, 0));
  // you
  fp.push(rectFp(YOU.slab, 0, YOU.top, 1, 8));
  fp.push(circleFp([LAMP.base[0], LAMP.base[1]], LAMP.baseR, YOU.top, YOU.top + 8, 1));
  fp.push(segFp([LAMP.base[0], LAMP.base[1], YOU.top + 8], LAMP.elbow, 5));
  fp.push(segFp(LAMP.elbow, LAMP.head, 5));
  fp.push(circleFp([LAMP.head[0], LAMP.head[1]], LAMP.hoodR, LAMP.head[2] - 26, LAMP.head[2] + 14, 0));
  fp.push(rectFp(YOU.laptop, YOU.top, YOU.top + 8, 1, 6));
  // the lid, a sloped plate from its hinge up and back
  const lid = YOU.laptop;
  const hingeY = lid.y1;
  const lx = (lid.x0 + lid.x1) / 2;
  fp.push(segFp([lx, hingeY, YOU.top + 8], [lx, hingeY + YOU.lidH * Math.sin(YOU.lidLean), YOU.top + 8 + YOU.lidH * Math.cos(YOU.lidLean)], (lid.x1 - lid.x0) / 2 - 4));
  fp.push(rectFp(YOU.tray, YOU.top, YOU.top + 12, 1, 6));
  fp.push(rectFp(YOU.inTray, YOU.top, YOU.top + 20, 1, 4));
  // the chute and its posts
  fp.push(...polySegs(CHUTE, 24));
  for (const [x, y] of CHUTE_POSTS) fp.push(circleFp([x, y], 6, 0, 90, 1));
  // intake
  fp.push(rectFp(FEEDERS.chat, 0, FEEDER_H.chat, 1, 8));
  fp.push(rectFp(FEEDERS.ci, 0, FEEDER_H.ci, 1, 8));
  fp.push(circleFp([SPOOL.x, SPOOL.y], SPOOL.r, 0, SPOOL.z[1], 1));
  fp.push(rectFp(GATE.bar, 0, GATE.h, 1, 3));
  fp.push(circleFp([SPIKE.x, SPIKE.y], 4, 0, SPIKE.h, 1));
  fp.push(circleFp([SPIKE.x, SPIKE.y], SPIKE.baseR, 0, 6, 1));
  fp.push(segFp(BELT.from, BELT.to, BELT.w / 2));
  // the Thread cords and their mast
  fp.push(circleFp([MAST.x, MAST.y], 7, 0, MAST.h, 1));
  fp.push(...polySegs(CORDS.vermilion, 4));
  fp.push(...polySegs(CORDS.graphite, 4));
  return fp;
}

/** The footprints that move with the frame: the card in flight, the slip in the chute. */
export function movingFootprints(s: DeskState): Footprint[] {
  const fp: Footprint[] = [];
  if (s.card) {
    const [x, y, z] = s.card.pos;
    fp.push({ kind: 'rect', c: [x, y], h: [CARD.w / 2, CARD.d / 2], r: 4, rot: Math.atan2(196 - y, 243 - x), z0: z - 1, z1: z + 1, contact: 0 });
  }
  if (s.slip && s.slip.s < 1) {
    const pose = slipPose(s.slip.s);
    fp.push({ kind: 'rect', c: [pose.p[0], pose.p[1]], h: [SLIP.l / 2, SLIP.w / 2], r: 3, rot: pose.heading, z0: pose.p[2] + 2, z1: pose.p[2] + 3, contact: 0 });
  }
  return fp;
}

/** All footprints at a frame (static first). Throws past MAX_FOOTPRINTS. */
export function footprintsAt(s: DeskState): Footprint[] {
  const all = [...staticFootprints(), ...movingFootprints(s)];
  if (all.length > MAX_FOOTPRINTS) throw new Error(`desk: ${all.length} footprints, over the ${MAX_FOOTPRINTS} the shaders hold`);
  return all;
}

/** The farthest a footprint's shadow and contact occlusion reach from its reference point, for a receiver at z = 0. */
export function cullRadius(fp: Footprint): number {
  if (fp.kind === 'canopy') return Math.hypot(fp.h[0], fp.h[1]) + 80;
  if (fp.kind === 'seg') {
    const half = Math.hypot(fp.b[0] - fp.a[0], fp.b[1] - fp.a[1]) / 2;
    return half + fp.r + (SHADOW_K * Math.abs(fp.hb - fp.ha)) / 2 + penumbra(Math.max(fp.ha, fp.hb)) / 2 + 2;
  }
  const extent = fp.kind === 'rect' ? Math.hypot(fp.h[0], fp.h[1]) : fp.r;
  const sweep = (SHADOW_K * (fp.z1 - Math.max(fp.z0, 0))) / 2;
  return extent + sweep + penumbra(fp.z1) / 2 + 30;
}

/** Kind codes in the shader. */
export const KIND = { rect: 0, circle: 1, seg: 2, canopy: 3 } as const;

/**
 * Three vec4 per footprint, for `uniform vec4 uFp[3 * MAX]`:
 * - rect: (cx, cy, hx, hy), (r, z0, z1, 0), (cos, sin, cull, contact)
 * - circle: (cx, cy, r, 0), (0, z0, z1, 1), (1, 0, cull, contact)
 * - seg: (ax, ay, bx, by), (r, ha, hb, 2), (1, 0, cull, 0)
 * - canopy: (cx, cy, hx, hy), (falloff, z, z, 3), (1, 0, cull, strength)
 */
export function packFootprints(fps: readonly Footprint[], out: Float32Array = new Float32Array(MAX_FOOTPRINTS * 12)): Float32Array {
  out.fill(0);
  fps.forEach((fp, i) => {
    const o = i * 12;
    const cull = cullRadius(fp);
    if (fp.kind === 'rect') {
      out.set([fp.c[0], fp.c[1], fp.h[0], fp.h[1], fp.r, fp.z0, fp.z1, KIND.rect, Math.cos(fp.rot), Math.sin(fp.rot), cull, fp.contact], o);
    } else if (fp.kind === 'canopy') {
      out.set([fp.c[0], fp.c[1], fp.h[0], fp.h[1], 40, fp.z, fp.z, KIND.canopy, 1, 0, cull, fp.strength], o);
    } else if (fp.kind === 'circle') {
      out.set([fp.c[0], fp.c[1], fp.r, 0, 0, fp.z0, fp.z1, KIND.circle, 1, 0, cull, fp.contact], o);
    } else {
      out.set([fp.a[0], fp.a[1], fp.b[0], fp.b[1], fp.r, fp.ha, fp.hb, KIND.seg, 1, 0, cull, 0], o);
    }
  });
  return out;
}
