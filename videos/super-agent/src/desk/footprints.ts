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
import { SHADOW_K, shadowOffset, BAYS, BAY_FLOOR, BELT, BENCH, CARD, CHUTE, CHUTE_POSTS, CORDS, CROSS, DECK, DECK_PLATE, DRAWER, FANFOLD, FEEDERS, FEEDER_H, FOLDER, GALLEY_TRAY, GATE, LAMP, LEG_R, LEG_STRUTS, LOCK, MAST, MOUTH, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, PINS, SLIP, SPOOL, THROAT, TOWER, TRAIT_PLATE, TAPE, towerTop, WINDOW, YOU, penumbra, rectC, type BayLayout, type P2, type P3, type Rect } from './layout.ts';
import { CARD_C, CARD_FILE, DISPATCH, DISPATCH_HOUSING, FRESH, HATCH_DEPTH, NEXT_SLIP, SINK } from './layout.ts';
import { CAP_SLOT, CARD_DOCK_TILT, CARD_STAND, CORD_FROM, DOCK_B, hammerOffset, TAB_B, TAB_LEAN_B, TAB_REST_B, TAB_REST_C, cardRise, cardTilt, replyPose, tabArc, type DeskState } from './state.ts';
import { CHORES, TRAY_Z, YOU_POSE_B, strutOnLid, type YouPose } from './you.ts';
import { ciHopperFootprints, youPoseAt } from './actOne.ts';

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

/**
 * Your desk's footprints at a pose (`you.ts`): the slab, the lamp's base, arms and head, the
 * laptop and its lid, the lid strut, the shadow-board tray and each chore resting in it (a recess's
 * floor is in the plate's shadow; a chore stands proud of it), the in-tray.
 */
export function youFootprints(pose: YouPose): Footprint[] {
  const [sx, sy] = pose.shift;
  const at2 = (x: number, y: number): P2 => [x + sx, y + sy];
  const at3 = (p: P3): P3 => [p[0] + sx, p[1] + sy, p[2]];
  const R = (r: Rect): Rect => ({ x0: r.x0 + sx, x1: r.x1 + sx, y0: r.y0 + sy, y1: r.y1 + sy });
  const { base, elbow, head } = pose.lamp;
  const fp: Footprint[] = [];
  fp.push(rectFp(R(YOU.slab), 0, YOU.top, 1, 8));
  fp.push(circleFp(at2(base[0], base[1]), LAMP.baseR, YOU.top, YOU.top + 8, 1));
  fp.push(segFp(at3([base[0], base[1], YOU.top + 8]), at3(elbow), 5));
  fp.push(segFp(at3(elbow), at3(head), 5));
  fp.push(circleFp(at2(head[0], head[1]), LAMP.hoodR, head[2] - 26, head[2] + 14, 0));
  fp.push(rectFp(R(YOU.laptop), YOU.top, YOU.top + 8, 1, 6));
  const lid = YOU.laptop;
  const lx = (lid.x0 + lid.x1) / 2;
  // the lid about its hinge as YourDesk poses it: leaning back while open, shut down over the keys for the night
  const th = Math.PI / 2 - YOU.lidLean + (Math.PI / 2 + YOU.lidLean - 0.02) * (pose.lidShut ?? 0);
  fp.push(segFp(at3([lx, lid.y1, YOU.top + 8]), at3([lx, lid.y1 + YOU.lidH * Math.cos(th), YOU.top + 8 + YOU.lidH * Math.sin(th)]), (lid.x1 - lid.x0) / 2 - 4));
  fp.push(rectFp(R(YOU.tray), YOU.top, TRAY_Z.plate, 1, 6));
  const { key, glass, strut } = CHORES;
  if (pose.held.key > 0.5) fp.push(rectFp(R({ x0: key.c[0] - key.bowR, x1: key.c[0] + key.bit.x[1], y0: key.c[1] + key.shank[0], y1: key.c[1] + key.bowY + key.bowR }), TRAY_Z.floor, TRAY_Z.floor + 4, 0.7, 4));
  if (pose.held.glass > 0.5) fp.push(rectFp(R({ x0: glass.c[0] - glass.half[0] + 1, x1: glass.c[0] + glass.half[0] - 1, y0: glass.c[1] - glass.half[1], y1: glass.c[1] + glass.half[1] }), TRAY_Z.floor, TRAY_Z.floor + 27, 0.8, 4));
  if (pose.held.strut > 0.5) {
    if (pose.strut === 'tray') fp.push(rectFp(R({ x0: strut.c[0] - strut.half[0], x1: strut.c[0] + strut.half[0], y0: strut.c[1] - strut.half[1], y1: strut.c[1] + strut.half[1] }), TRAY_Z.floor, TRAY_Z.floor + 8, 0.7, 4));
    else {
      const s = strutOnLid();
      fp.push(segFp(at3(s.a), at3(s.b), 3.4));
    }
  }
  if (pose.inTray) fp.push(rectFp(R(YOU.inTray), YOU.top, YOU.top + 18, 1, 4));
  return fp;
}

/** Footprints moved up or down by dz (a bay rising out of or sinking into its hatch); what ends under the desk casts nothing on it. */
export function shiftFootprints(fps: readonly Footprint[], dz: number): Footprint[] {
  if (dz === 0) return [...fps];
  const out: Footprint[] = [];
  for (const fp of fps) {
    if (fp.kind === 'rect' || fp.kind === 'circle') {
      if (fp.z1 + dz <= 0.5) continue;
      out.push({ ...fp, z0: Math.max(0, fp.z0 + dz), z1: fp.z1 + dz });
    } else if (fp.kind === 'seg') {
      if (Math.max(fp.ha, fp.hb) + dz <= 0.5) continue;
      out.push({ ...fp, ha: Math.max(0, fp.ha + dz), hb: Math.max(0, fp.hb + dz) });
    } else out.push(fp);
  }
  return out;
}

/** The test tower's bay and its tower (they sink together once it has finished). */
function testsFootprints(): Footprint[] {
  return [...bayFootprints(BAYS.tests), circleFp([TOWER.x, TOWER.y], TOWER.r + 2, TOWER.base, towerTop() + TOWER.dome, 1)];
}

/**
 * The Register's footprints, in the layout's order: the deck's canopy, its legs, rails, cross members and plate, the
 * reel and its frame, the head, throat, window and reading lamp, the drawer, mouth and lock, the fanfold, the trait
 * plate and the ramp. The turn (desk/turn.ts) leaves out what it draws itself.
 */
export function registerFootprints(o: { legs?: boolean; fanfold?: boolean; trait?: boolean } = {}): Footprint[] {
  o = { legs: true, fanfold: true, trait: true, ...o };
  const fp: Footprint[] = [];
  // the deck's shade: its outline as a canopy carried down the key by its shadow's offset, so the desk and the bays'
  // floors where the deck's shadow falls (the bays' north parts, tucked under its south edge) see less sky and sit in
  // its soft shade: two levels as real height (C9, C11)
  const [ox, oy] = shadowOffset(DECK.top);
  fp.push({ kind: 'canopy', c: [(DECK.x0 + DECK.x1) / 2 + ox, (DECK.y0 + DECK.y1) / 2 + oy], h: [(DECK.x1 - DECK.x0) / 2 + 10, (DECK.y1 - DECK.y0) / 2 + 10], z: DECK.railZ0, strength: 0.86 });
  // the Register: splayed legs, rails, cross members, the plate, the reel and its frame, the head, the window, the lamp
  if (o.legs)
    for (const l of LEG_STRUTS) {
      fp.push(segFp(l.top, [l.foot[0], l.foot[1], 0], LEG_R));
      fp.push(circleFp(l.foot, 14, 0, 4, 1));
    }
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
  // the reading lamp: its hood and its bent arm
  const H = READ_LAMP.hood;
  fp.push(rectFp({ x0: H.x0, x1: H.x1, y0: H.y - H.r, y1: H.y + H.r }, H.z - H.r, H.z + H.r, 0, H.r));
  fp.push(segFp([READ_LAMP.base[0], READ_LAMP.base[1], DECK.top], [READ_LAMP.base[0], READ_LAMP.base[1], H.z + 30], 4));
  fp.push(segFp([READ_LAMP.base[0], READ_LAMP.base[1], H.z + 30], [H.x1, H.y, H.z + 6], 4));
  fp.push(rectFp(DRAWER.box, DRAWER.z[0], DRAWER.z[1], 0));
  fp.push(rectFp(MOUTH.box, MOUTH.z[0], MOUTH.z[1], 0));
  fp.push(rectFp(LOCK.box, LOCK.z[0], LOCK.z[1], 0.6));
  fp.push(segFp([LOCK.key.x0, LOCK.key.y, LOCK.key.z], [LOCK.key.x1 + 2 * LOCK.key.bowR, LOCK.key.y, LOCK.key.z], 6));
  if (o.fanfold) fp.push(rectFp(FANFOLD.box, 0, FANFOLD.sheets * SHEET + 2, 1, 2));
  if (o.trait) fp.push(rectFp(TRAIT_PLATE.box, TRAIT_PLATE.z[0], TRAIT_PLATE.z[1], 0, 4));
  // the ramp's curved sheet, as a sloped plate from the east rail down to its foot
  const rampY = (RAMP.y0 + RAMP.y1) / 2;
  fp.push(segFp([RAMP.x, rampY, RAMP.top], [RAMP.foot - 14, rampY, 4], (RAMP.y1 - RAMP.y0) / 2));
  return fp;
}

/** Every footprint that does not move in this lookdev (the layout's); `testsSink`: the finished test bay sunk into its hatch (0..1); `you`: your desk's pose. */
export function staticFootprints(testsSink = 0, you: YouPose = YOU_POSE_B): Footprint[] {
  const fp: Footprint[] = [];
  fp.push(...registerFootprints());
  // the bays: every one under 80
  if (testsSink > 0) {
    for (const b of Object.values(BAYS)) if (b.id !== 'tests') fp.push(...bayFootprints(b));
  } else for (const b of Object.values(BAYS)) fp.push(...bayFootprints(b));
  fp.push(rectFp(BENCH.top, BENCH.z[0], BENCH.z[1], 0.4));
  fp.push(rectFp(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 0.7));
  if (testsSink > 0) fp.push(...shiftFootprints(testsFootprints(), -SINK * testsSink));
  else fp.push(circleFp([TOWER.x, TOWER.y], TOWER.r + 2, TOWER.base, towerTop() + TOWER.dome, 1));
  fp.push(rectFp(BENCH.top, BENCH.z[0], BENCH.z[1] + PINS.h, 0, 4));
  fp.push(rectFp(GALLEY_TRAY.box, GALLEY_TRAY.z[0], GALLEY_TRAY.z[1], 1, 4));
  // you
  fp.push(...youFootprints(you));
  // the chute and its posts
  // the chute: a narrow line of shadow (a wide one smudged its own trough)
  fp.push(...polySegs(CHUTE, 12));
  for (const [x, y] of CHUTE_POSTS) fp.push(circleFp([x, y], 6, 0, 90, 1));
  // intake
  fp.push(circleFp(rectC(FEEDERS.chat), (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2, 0, FEEDER_H.chat, 1));
  fp.push(...ciHopperFootprints());
  fp.push(circleFp([SPOOL.x, SPOOL.y], SPOOL.r, 0, SPOOL.z[1], 1));
  fp.push(rectFp(GATE.bar, 0, GATE.h, 1, 3));
  fp.push(segFp(BELT.from, BELT.to, BELT.w / 2));
  // the dispatch housing under the deck's east end, behind the ramp's face
  fp.push(rectFp(DISPATCH_HOUSING.box, DISPATCH_HOUSING.z[0], DISPATCH_HOUSING.z[1], 0, 3));
  return fp;
}

/** A sheet's footprint: lying `tilt` up from the desk about x, its centre at c (its depth foreshortened, its height span). */
const tiltedFp = (c: P3, w: number, d: number, tilt: number, contact = 0): Footprint => ({ kind: 'rect', c: [c[0], c[1]], h: [w / 2, Math.max(1, (d / 2) * Math.cos(tilt))], r: 3, rot: 0, z0: c[2] - (d / 2) * Math.sin(tilt), z1: c[2] + (d / 2) * Math.sin(tilt) + 1, contact });

/** The footprints that move with the frame: the card rising, in flight or at the mouth, its tab, the reply in the chute. */
export function movingFootprints(s: DeskState): Footprint[] {
  const fp: Footprint[] = [];
  if (s.cardOut !== null) {
    // standing in the cap's slot: only what has risen above the cap casts
    const p = cardRise(s.cardOut);
    const top = p[2] + (CARD.d / 2) * Math.sin(CARD_STAND);
    if (top > CAP_SLOT[2] + 1) fp.push({ kind: 'rect', c: [p[0], p[1]], h: [CARD.w / 2, 2], r: 1, rot: 0, z0: CAP_SLOT[2], z1: top, contact: 0 });
  } else if (s.card) {
    fp.push(tiltedFp(s.card.pos, CARD.w, CARD.d, cardTilt(s.card.s)));
  } else if (s.dock) {
    const d = s.dock;
    if (d.fold < 0.5 && d.drop <= 0) fp.push(tiltedFp(DOCK_B, CARD.w, CARD.d, CARD_DOCK_TILT));
    else {
      // the folded tab: from its crease (the origin) up its depth at its tilt
      const crease = d.landed !== null ? TAB_REST_B : d.drop > 0 ? tabArc(d.drop) : DOCK_B;
      const tilt = d.landed !== null ? TAB_LEAN_B : CARD_DOCK_TILT + (TAB_LEAN_B - CARD_DOCK_TILT) * d.drop;
      const c: P3 = [crease[0], crease[1] + (TAB_B.d / 2) * Math.cos(tilt), crease[2] + (TAB_B.d / 2) * Math.sin(tilt)];
      fp.push(tiltedFp(c, TAB_B.w, TAB_B.d, tilt, d.landed !== null ? 0.5 : 0));
    }
  }
  // the print head's hammer, raised over the tape at rest, its shadow closing on the newest cell as it comes down
  const hammer = Math.max(s.stamp, s.next.stamp, s.cache?.stamp ?? 0);
  const [hx, , hz] = hammerOffset(hammer);
  fp.push(rectFp({ x0: PRINT_HEAD.box.x1 - 4 + hx, x1: PRINT_HEAD.box.x1 + 10 + hx, y0: TAPE.y0 + 6, y1: TAPE.y1 - 6 }, TAPE.z + 3 + hz, TAPE.z + 16 + hz, 0, 1));
  // the Thread cord and its guide, from 7.1 only (design D1)
  if (s.f >= CORD_FROM) {
    fp.push(segFp([MAST.arm[0], MAST.arm[1], DECK.top - 4], [MAST.x, MAST.y, DECK.top - 4], 4));
    fp.push(segFp([MAST.x, MAST.y, DECK.top - 4], [MAST.x, MAST.y, MAST.h], 5));
    fp.push(...polySegs(CORDS.vermilion, 4));
  }
  // MT1's next dispatch: the chat slip in flight or in the throat, the folder, the fresh bay rising out of its hatch
  const n = s.next;
  if (n.slip) fp.push({ kind: 'rect', c: [n.slip.p[0], n.slip.p[1]], h: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 3, rot: n.slip.heading, z0: n.slip.p[2] - 0.4, z1: n.slip.p[2] + 0.4, contact: 0 });
  if (n.folder) fp.push({ kind: 'rect', c: [n.folder.p[0], n.folder.p[1]], h: [DISPATCH.w / 2, DISPATCH.d / 2], r: 3, rot: n.folder.heading, z0: n.folder.p[2] - 1.5, z1: n.folder.p[2] + 1.5, contact: 0.6 });
  if (n.hatch > 0) {
    // the pit under the open hatch is dark: the desk round it shades and roofs whatever is below the desk (the bay
    // rises out of the dark into the light; nothing above the desk is touched)
    const B = FRESH.box;
    fp.push(rectFp({ x0: B.x0 - 80, x1: B.x1 + 80, y0: B.y0 - 80, y1: B.y1 + 80 }, -1, 0, 0, 6));
    fp.push({ kind: 'canopy', c: rectC(B), h: [(B.x1 - B.x0) / 2 + 30, (B.y1 - B.y0) / 2 + 30], z: 0, strength: 0.92 });
    const F = CARD_FILE;
    const fresh = [...bayFootprints(FRESH), rectFp({ x0: F.x0 - F.cheek, x1: F.x1 + F.cheek, y0: F.y - F.r, y1: F.y + F.r }, BAY_FLOOR, F.z + F.cheekR, 1, 6)];
    fp.push(...shiftFootprints(fresh, -HATCH_DEPTH * (1 - n.rise)));
  }
  // still (c): the report in flight, its body at the mouth, the tab dropping into the drawer
  const c = s.cache;
  if (c?.card) fp.push({ kind: 'rect', c: [c.card.pos[0], c.card.pos[1]], h: [CARD_C.w / 2, CARD_C.d / 2], r: 4, rot: 0, z0: c.card.pos[2] - 1, z1: c.card.pos[2] + 1, contact: 0 });
  if (c && (c.docked || c.drop > 0)) {
    const t = c.drop;
    const [x, y, z] = t > 0 ? [MOUTH.land[0] + (TAB_REST_C[0] - MOUTH.land[0]) * t, MOUTH.land[1] + (TAB_REST_C[1] - MOUTH.land[1]) * t, MOUTH.land[2] + (TAB_REST_C[2] - MOUTH.land[2]) * t] : MOUTH.land;
    // the body (the card's bottom half), folded along its middle into the tab (a quarter of the card's depth)
    const half = c.fold > 0.5 || t > 0 ? CARD_C.d / 8 : CARD_C.d / 4;
    fp.push({ kind: 'rect', c: [x, y - CARD_C.d / 4 + half], h: [CARD_C.w / 2, half], r: 3, rot: 0, z0: z - 3, z1: z + 3, contact: t >= 1 ? 0.5 : 0 });
  }
  if (s.slip && s.slip.s > 0 && s.slip.s < 1) {
    const pose = replyPose(s.slip);
    fp.push({ kind: 'rect', c: [pose.p[0], pose.p[1]], h: [SLIP.l / 2, SLIP.w / 2], r: 3, rot: pose.heading, z0: pose.p[2] - 0.6, z1: pose.p[2] + 0.6, contact: 0 });
  }
  return fp;
}

/** All footprints at a frame (static first). Throws past MAX_FOOTPRINTS. */
export function footprintsAt(s: DeskState): Footprint[] {
  const all = [...staticFootprints(s.testsSink, youPoseAt(s.f)), ...movingFootprints(s)];
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
