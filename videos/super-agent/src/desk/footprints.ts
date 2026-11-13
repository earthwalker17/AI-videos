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
import { carrierSpan, circleFp, polySegs, rectFp, segFp, shiftFootprints, tiltedFp, type Footprint } from './fpKit.ts';
import { SHADOW_K, shadowOffset, BAYS, BAY_FLOOR, BELT, BENCH, CARD, CHUTE, CHUTE_POSTS, CROSS, DECK, DECK_PLATE, DRAWER, FANFOLD, FEEDERS, FEEDER_H, FOLDER, GALLEY_TRAY, GATE, LAMP, LEG_R, LEG_STRUTS, LOCK, MOUTH, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, PINS, SLIP, SPOOL, THROAT, TOWER, TRAIT_PLATE, TAPE, towerTop, WINDOW, YOU, penumbra, rectC, type BayLayout, type P2, type P3, type Rect } from './layout.ts';
import { CARD_C, CARD_FILE, DISPATCH, DISPATCH_HOUSING, FRESH, HATCH_DEPTH, NEXT_SLIP, REQUEST, SINK, type BayId } from './layout.ts';
import { CAP_SLOT, CARD_DOCK_TILT, CARD_STAND, DOCK_B, HEAD_DIP, hammerOffset, headDipAt, TAB_B, TAB_LEAN_B, TAB_REST_B, TAB_REST_C, cardRise, cardTilt, replyPose, tabArc, type DeskState } from './state.ts';
import { CHORES, TRAY_Z, YOU_POSE_B, strutEnds, type YouPose } from './you.ts';
import { HEAP, PIECE, ciHopperFootprints, youPoseAt } from './actOne.ts';
import { BAND_RAMP, REQUEST_HEAP, RIDE, WORK_DEPTH as WORK_DEPTH_FP, cardPose, cardShadeShift, cardSize, heapFloor, heapPieceAt, liftOf, ON_REQUEST, type Beat4State, type CardSpot, type CardState, type CardUp, type Carry, type HeapState } from './beat4.ts';
import { cards7, footprints7 } from './beat7.ts';
import { cards8, footprints8 } from './beat8.ts';
import { cards9, footprints9 } from './beat9.ts';
import { cards10, footprints10 } from './beat10.ts';
import { cards11, footprints11 } from './beat11.ts';
import { cardsEnd, footprintsEnd } from './end.ts';
import { SPIKE_BASE, type Beat5State } from './beat5.ts';
import { BAR_RIDE, DECODE, PLATE_CONTACT, REVIEW, STRESS_PLATE, TAB_FILE, TRAY, type Beat6State } from './beat6.ts';
import { DRAWER_OPEN_C, PROACTIVE_PLATE, SPIKE } from './layout.ts';

/** At most this many footprints reach the GPU (the uniform array's size, gl/light.ts). */
export const MAX_FOOTPRINTS = 160;

// the shapes and their helpers live in the leaf fpKit.ts (a beat module builds its own footprints from there)
export { carrierSpan, circleFp, polySegs, rectFp, segFp, shiftFootprints, tiltedFp, type Footprint } from './fpKit.ts';

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

function bayFootprints(b: BayLayout, door = 0): Footprint[] {
  return [...bayShellFootprints(b, door), ...bayWorkOf(b)];
}
/** A bay's shell: its walls (the north one split round its door) and its door, shut or lifted (`door`, 0..1 of its lift). */
export function bayShellFootprints(b: BayLayout, door = 0): Footprint[] {
  const lift = door * (b.wallH - 2);
  return [...bayWalls(b).map((w) => rectFp(w, 0, b.wallH, 1, 2)), rectFp(bayDoor(b), lift, b.wallH - 6 + lift, lift < 1 ? 1 : 0, 2)];
}
/**
 * How far below the top of a part a footprint ends when that top is a receiver the part lights (the bay floor plate's top,
 * the test tower's cap, the galley's rails): exactly at a footprint's top the shader's own-shade test (gl/light.ts: a
 * receiver under z1 - 0.5 is shaded) is a coin flip a hair of motion turns over, so a floor would go dark for frames on
 * its spring's last wobble. A quarter unit under it, the shadow it casts on the slate is the same to the eye.
 */
const TOP_CLEAR = 0.25;
/**
 * The top of the throat body's footprint: 0.6 u over its floor (objects/Register.tsx: THROAT.z[1] − 8), so the floor
 * stays shaded as before, and under a carrier lying on it (its centre at 118.8: layout.ts NEXT_SLIP.throat), which is lit.
 */
export const THROAT_FLOOR_FP = THROAT.z[1] - 8 + 0.6;
/** A bay's work in place: its floor plate, its work slot, its dossier (the superstructure is its own). */
const bayWorkOf = (b: BayLayout): Footprint[] => [rectFp(b.box, 0, BAY_FLOOR - TOP_CLEAR, 1, 6), rectFp(b.slot, BAY_FLOOR, 40, 1, 4), rectFp(b.dossier, BAY_FLOOR, BAY_FLOOR + 4 + b.sheets * SHEET, 1, 4)];
/** The test tower's footprint (its cap's top a receiver: TOP_CLEAR). */
const towerFp = (): Footprint => circleFp([TOWER.x, TOWER.y], TOWER.r + 2, TOWER.base, towerTop() + TOWER.dome - TOP_CLEAR, 1);
/** The docs galley's footprint (its rails' tops a receiver: TOP_CLEAR). */
const galleyFp = (): Footprint => rectFp(GALLEY_TRAY.box, GALLEY_TRAY.z[0], GALLEY_TRAY.z[1] - TOP_CLEAR, 1, 4);
/** Each bay's superstructure: the bug bench, its pins and the request's folder; the test tower; the docs galley. */
function superFootprints(id: BayId): Footprint[] {
  if (id === 'bug') return [rectFp(BENCH.top, BENCH.z[0], BENCH.z[1], 0.4), rectFp(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 0.7), rectFp(BENCH.top, BENCH.z[0], BENCH.z[1] + PINS.h, 0, 4)];
  if (id === 'tests') return [towerFp()];
  return [galleyFp()];
}
/**
 * A beat-4 bay at its dispatch (desk/beat4.ts): its shell, and its work once its hatch is open, at its height as it rises
 * (what is still under the slate casts nothing on it; its contact closes in as it settles).
 */
export function dispatchedBayFootprints(id: BayId, d: { hole: boolean; hatch: number; rise: number; door: number; contact: number; rises?: readonly number[] }, depth: number): Footprint[] {
  const b = BAYS[id];
  const fp = bayShellFootprints(b, d.door);
  // closed: its shell round its lid (the lid lies flush, under the slate's surface, and casts nothing)
  if (d.hatch <= 0 && d.rise <= 0) return fp;
  const work = [...bayWorkOf(b), ...superFootprints(id)].map((x) => (x.kind === 'rect' || x.kind === 'circle' ? { ...x, contact: x.contact * d.contact } : x));
  // at the height its work is drawn at (objects/Bay.tsx workOf), its overshoot included: a part never leaves its footprint
  const lift = liftOf(d.rise, depth);
  const past = (d.rises ?? []).map((r) => liftOf(r, depth));
  const band = bandTop(b);
  for (const x of shiftFootprints(work, lift)) {
    // a part whose top rises past its nameplate band (a receiver at its top, objects/Bay.tsx) would put its whole contact
    // on the band in the one frame its top crosses it (the shader's gate is all or nothing in height: the bug bay's
    // dossier at f1769, A14). For the BAND_RAMP frames from that one the part is split by height so that only the band's
    // contact ramps in: the whole part topped a hair under the band (its contact on everything under the band), the whole
    // part with its contact ramped in (its shade exactly as before; its contact on the band), and the part's feet raised
    // just out of the band's contact reach (BAND_REACH: its contact on what is over the band, its own top among them).
    // Then it is the one footprint again.
    if ((x.kind === 'rect' || x.kind === 'circle') && x.contact > 0 && x.z1 > band) {
      const rest = x.z1 - lift;
      const k = d.rises ? 1 + past.filter((l) => rest + l > band).length : BAND_RAMP;
      if (k < BAND_RAMP) {
        // (topped under the band, its feet lowered as far, so its contact's reach, which grows with its height, is as before)
        const cut = x.z1 - (band - 0.01);
        fp.push({ ...x, z0: Math.max(0, x.z0 - cut), z1: band - 0.01 }, { ...x, contact: (x.contact * k) / BAND_RAMP });
        if (x.z1 > band + BAND_REACH) fp.push({ ...x, z0: Math.max(x.z0, band + BAND_REACH) });
        continue;
      }
    }
    fp.push(x);
  }
  if (d.hole) fp.push(...pitFootprints(b.box));
  return fp;
}
/** A bay's nameplate band's top (objects/Bay.tsx: on the south wall's top, a quarter unit over it): a receiver. */
const bandTop = (b: BayLayout): number => b.wallH + 0.25;
/** Feet this far over a receiver are out of its contact (gl/light.ts: a footprint's contact reaches a surface at z when z0 <= z + 1.5). */
const BAND_REACH = 1.51;
/** An open hatch's pit: the slate round it shades and roofs what is below it (a bay rising out of the dark into the light). */
export function pitFootprints(B: Rect): Footprint[] {
  return [rectFp({ x0: B.x0 - 80, x1: B.x1 + 80, y0: B.y0 - 80, y1: B.y1 + 80 }, -1, 0, 0, 6), { kind: 'canopy', c: rectC(B), h: [(B.x1 - B.x0) / 2 + 30, (B.y1 - B.y0) / 2 + 30], z: 0, strength: 0.92 }];
}

/** The lid strut's hop (you.ts strutEnds): from this far along it the recess's footprint closes in round it (contact and shade by amount). */
const STRUT_SETTLE = 0.8;
const smooth01 = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
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
    if (pose.strut === 'tray' && pose.strutMix === undefined) fp.push(rectFp(R({ x0: strut.c[0] - strut.half[0], x1: strut.c[0] + strut.half[0], y0: strut.c[1] - strut.half[1], y1: strut.c[1] + strut.half[1] }), TRAY_Z.floor, TRAY_Z.floor + 8, 0.7, 4));
    else {
      // on the lid, or on its way from the lid to its recess (the turn)
      const s = strutEnds(pose);
      fp.push(segFp(at3(s.a), at3(s.b), 3.4));
      // over the hop's last frames the recess's footprint closes in round it (where it is, raised by the hop that
      // remains): its contact and the shade over the strut's upper half arrive by amount, so landing (the rest rect above)
      // changes nothing in one frame
      const m = pose.strutMix ?? 0;
      if (m >= STRUT_SETTLE) {
        const k = smooth01((m - STRUT_SETTLE) / (1 - STRUT_SETTLE));
        const [dx, dy] = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
        const half = Math.hypot(dx, dy) / 2;
        const z0 = (s.a[2] + s.b[2]) / 2 - 4.4;
        fp.push({ kind: 'rect', c: at2((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2), h: [half + 3.4 + (strut.half[1] - half - 3.4) * k, 3.4 + (strut.half[0] - 3.4) * k], r: 3.4 + 0.6 * k, rot: Math.atan2(dy, dx), z0, z1: z0 + 1 + 7 * k, contact: 0.7 * k });
      }
    }
  }
  if (pose.inTray) {
    // its four walls, not a solid block: a block's footprint shades its own floor black, and the empty tray read as a
    // second screen beside the laptop (still (a)'s critic)
    const I = R(YOU.inTray);
    const t = 3.5;
    for (const w of [{ ...I, y1: I.y0 + t }, { ...I, y0: I.y1 - t }, { ...I, x1: I.x0 + t }, { ...I, x0: I.x1 - t }]) fp.push(rectFp(w, YOU.top, YOU.top + 18, 1, 1));
  }
  return fp;
}

/** The test tower's bay and its tower (they sink together once it has finished). */
function testsFootprints(): Footprint[] {
  return [...bayFootprints(BAYS.tests), towerFp()];
}

/**
 * The Register's footprints, in the layout's order: the deck's canopy, its legs, rails, cross members and plate, the
 * reel and its frame, the head, throat, window and reading lamp, the drawer, mouth and lock, the fanfold, the trait
 * plate and the ramp. The turn (desk/turn.ts) leaves out what it draws itself.
 */
export function registerFootprints(o: { legs?: boolean; fanfold?: boolean; trait?: boolean; headDip?: number } = {}): Footprint[] {
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
  // the head's top goes down with its dip (beat 6: state.ts headDipAt), so its cap never falls into its own shadow
  fp.push(rectFp(PRINT_HEAD.box, PRINT_HEAD.z[0], PRINT_HEAD.z[1] + 4 - (o.headDip ?? 0), 0.8));
  // the throat as drawn (objects/Register.tsx): its body up to just over its floor (the floor stays in its own shade) and
  // its two cheeks, so a carrier settling between the cheeks takes their cast shade as it comes down, never the whole
  // box's in one frame below 126 (the cheek shade that split a landed slip on a hard edge: R-A4, lane A)
  fp.push(rectFp(THROAT.box, THROAT.z[0], THROAT_FLOOR_FP, 0));
  // (each cheek's top at its bevel's foot, 1.2 u under its top: its own bevelled rim is never in its shade)
  for (const y of [THROAT.box.y0 - 4, THROAT.box.y1 - 6]) fp.push(rectFp({ x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: y, y1: y + 10 }, THROAT.z[0] + 4, THROAT.z[1] + 4 - 1.2, 0));
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

/**
 * Every footprint that does not move in this lookdev (the layout's); `testsSink`: the finished test bay sunk into its
 * hatch (0..1); `you`: your desk's pose; `b4`: the bays as beat 4 dispatches them (closed, rising, working: desk/beat4.ts;
 * omitted: every bay at work, as still (b) and later).
 */
export function staticFootprints(testsSink = 0, you: YouPose = YOU_POSE_B, b4?: Beat4State['bays'], headDip = 0): Footprint[] {
  const fp: Footprint[] = [];
  fp.push(...registerFootprints({ headDip }));
  // the bays: every one under 80; in beat 4 each is its shell until it is dispatched, then its work rises out of its hatch
  const working = (id: BayId) => !b4 || (b4[id].rise >= 1 - 1e-4 && !b4[id].hole);
  for (const id of ['tests', 'docs', 'bug'] as const) {
    if (working(id)) continue;
    fp.push(...dispatchedBayFootprints(id, b4![id], WORK_DEPTH_FP[id]));
  }
  if (testsSink > 0) {
    for (const b of Object.values(BAYS)) if (b.id !== 'tests' && working(b.id as BayId)) fp.push(...bayFootprints(b, b4?.[b.id as BayId].door ?? 0));
  } else for (const b of Object.values(BAYS)) if (working(b.id as BayId)) fp.push(...bayFootprints(b, b4?.[b.id as BayId].door ?? 0));
  if (working('bug')) {
    fp.push(rectFp(BENCH.top, BENCH.z[0], BENCH.z[1], 0.4));
    fp.push(rectFp(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 0.7));
  }
  if (testsSink > 0) fp.push(...shiftFootprints(testsFootprints(), -SINK * testsSink));
  else if (working('tests')) fp.push(towerFp());
  if (working('bug')) fp.push(rectFp(BENCH.top, BENCH.z[0], BENCH.z[1] + PINS.h, 0, 4));
  if (working('docs')) fp.push(galleyFp());
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
  const hammer = Math.max(s.stamp, s.next.stamp, s.cache?.stamp ?? 0, s.e6.hammer);
  const [hx, , hz] = hammerOffset(hammer);
  fp.push(rectFp({ x0: PRINT_HEAD.box.x1 - 4 + hx, x1: PRINT_HEAD.box.x1 + 10 + hx, y0: TAPE.y0 + 6, y1: TAPE.y1 - 6 }, TAPE.z + 3 + hz, TAPE.z + 16 + hz, 0, 1));
  // (the Thread cord and its guide, from 7.1 on: beat7.ts footprints7)
  // MT1's next dispatch: the chat slip in flight or in the throat, the folder, the fresh bay rising out of its hatch
  const n = s.next;
  // (its top a receiver, TOP_CLEAR: at its own top, the 3% landing squash in the throat put it under for 3 f, c2262–2264)
  if (n.slip) fp.push({ kind: 'rect', c: [n.slip.p[0], n.slip.p[1]], h: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 3, rot: n.slip.heading, z0: n.slip.p[2] - 0.4, z1: n.slip.p[2] + 0.4 - TOP_CLEAR, contact: 0 });
  if (n.folder) fp.push({ kind: 'rect', c: [n.folder.p[0], n.folder.p[1]], h: [DISPATCH.w / 2, DISPATCH.d / 2], r: 3, rot: n.folder.heading, z0: n.folder.p[2] - 1.5, z1: n.folder.p[2] + 1.5, contact: 0.6 });
  if (n.hole || n.rise > 0) {
    // the pit under the open hatch is dark: the desk round it shades and roofs whatever is below the desk (the bay
    // rises out of the dark into the light; nothing above the desk is touched); its contact closes in as it settles
    if (n.hole) fp.push(...pitFootprints(FRESH.box));
    const F = CARD_FILE;
    const fresh = [...bayFootprints(FRESH), rectFp({ x0: F.x0 - F.cheek, x1: F.x1 + F.cheek, y0: F.y - F.r, y1: F.y + F.r }, BAY_FLOOR, F.z + F.cheekR, 1, 6)].map((x) => (x.kind === 'rect' || x.kind === 'circle' ? { ...x, contact: x.contact * n.contact } : x));
    fp.push(...shiftFootprints(fresh, liftOf(n.rise, HATCH_DEPTH)));
  }
  // beat 4: the request on its ride, the arrivals on the intake, the counterfactual cards over the slate, the heap's pit
  const b4 = s.b4;
  const r = b4.request.pose;
  // (on its dispatch ride its own top never under its footprint's: carrierSpan)
  if (r) fp.push({ kind: 'rect', c: [r.p[0], r.p[1]], h: [REQUEST.l / 2, REQUEST.w / 2], r: 2, rot: r.heading, ...(s.f >= RIDE.out ? carrierSpan(r, REQUEST.l / 2, 0.6) : { z0: r.p[2] - 0.4, z1: r.p[2] + 0.6 }), contact: carrierContact(r) });
  for (const a of b4.arrivals) fp.push({ kind: 'rect', c: [a.pose.p[0], a.pose.p[1]], h: a.kind === 'ci' ? [42, 25] : [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 2, rot: a.pose.heading, ...carrierSpan(a.pose, a.kind === 'ci' ? 42 : NEXT_SLIP.l / 2, 0.4), contact: 0 });
  for (const c of b4.carriers) {
    if (c.docked) continue;
    const [hl, hw] = c.kind === 'ci' ? [42, 25] : [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2];
    fp.push({ kind: 'rect', c: [c.pose.p[0], c.pose.p[1]], h: [hl, hw], r: 2, rot: c.pose.heading, ...carrierSpan(c.pose, hl, 0.4), contact: carrierContact(c.pose) });
  }
  for (const which of ['split', 'ghost'] as const) {
    const c = b4.cards[which];
    const cf = c ? cardFootprint(c, which) : null;
    if (cf) fp.push(cf);
  }
  // the old heap, settling and pressed flat into the slate as history (desk/beat4.ts heapPieceAt)
  fp.push(...heapFootprintsAt(b4.heap));
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
  // every reply while it rides the chute (MT1's #0408 first: state.ts DeskState.replies)
  for (const x of s.replies) {
    if (x.ride.s <= 0 || x.ride.s >= 1) continue;
    const pose = replyPose(x.ride, x.rest);
    const [l, w] = x.size ?? [SLIP.l, SLIP.w];
    fp.push({ kind: 'rect', c: [pose.p[0], pose.p[1]], h: [l / 2, w / 2], r: 3, rot: pose.heading, z0: pose.p[2] - 0.6, z1: pose.p[2] + 0.6, contact: 0 });
  }
  fp.push(...beat5Footprints(s.e5));
  // beat 6: #0408's tab, filed in the drawer from the close (objects/Cache.tsx TestTab: the same footprint s.dock gave it), then beat 6's movers
  if (c && !c.summary) {
    const tilt = TAB_LEAN_B + (TAB_FILE.lean - TAB_LEAN_B) * c.file;
    const y = TAB_REST_B[1] - DRAWER_OPEN_C * c.drawer + TAB_FILE.dy * c.file;
    fp.push(tiltedFp([TAB_REST_B[0] + TAB_FILE.dx * c.file, y + (TAB_B.d / 2) * Math.cos(tilt), TAB_REST_B[2] + TAB_FILE.dz * c.file + (TAB_B.d / 2) * Math.sin(tilt)], TAB_B.w * (1 + (TAB_FILE.w - 1) * c.file), TAB_B.d, tilt, 0.5));
  }
  fp.push(...beat6Footprints(s.e6));
  // part 2's beats: each module's own footprints, and the shadow of every counterfactual card it has up
  fp.push(...footprints7(s), ...footprints8(s), ...footprints9(s), ...footprints10(s), ...footprints11(s), ...footprintsEnd(s));
  for (const { card, spot } of part2Cards(s)) {
    const cf = cardFootprint(card, spot);
    if (cf) fp.push(cf);
  }
  return fp;
}

/** Every counterfactual card part 2's beats have up at a state (beat4.ts CardUp): footprints.ts casts each, pools.ts lights each. */
export const part2Cards = (s: DeskState): CardUp[] => [...cards7(s), ...cards8(s), ...cards9(s), ...cards10(s), ...cards11(s), ...cardsEnd(s)];

/**
 * Beat 6's footprints (desk/beat6.ts): each slip of the batches in the air and riding up the belt (paper: no contact)
 * (a slip lying in the gather tray casts nothing), the reading bar over the strip, the decode slip out of the head's slot, the stress plate in flight and seated on its
 * hooks, the review card. The thread (2 px) and its "№" tabs (paper flags 22 u tall, standing on paper) cast nothing: from
 * C17 the Thread cord's 13 footprints come in (beat7.ts footprints7) within MAX_FOOTPRINTS.
 */
export function beat6Footprints(e: Beat6State): Footprint[] {
  const fp: Footprint[] = [];
  for (const x of e.strip) {
    if (x.hidden) continue;
    // a slip lying in the gather tray lies flat on its floor (its shadow is under it; its nose's edge is printed: gl/print6.ts)
    if (x.inTray) continue;
    // in the air, riding up the belt, in the throat: its own size (a CI event is the card feeder's 84 x 50 card), its
    // footprint's top under its own top face (carrierSpan: a tilted card never shades half of itself)
    const [hl, hw] = x.kind.kind === 'ci' ? [REVIEW.l / 2, REVIEW.w / 2] : [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2];
    fp.push({ kind: 'rect', c: [x.pose.p[0], x.pose.p[1]], h: [hl * Math.cos(x.pose.slope), hw], r: 2, rot: x.pose.heading, ...carrierSpan(x.pose, hl, 0.4), contact: 0 });
  }
  if (e.bar) {
    // rising with the tray out of the deck plate (objects/Batch.tsx), then riding over the strip
    const z = TRAY.floor - 2 + (BAR_RIDE + 2) * e.bar.up;
    fp.push(segFp([e.bar.x, TRAY.y0 - 6, z], [e.bar.x, TRAY.y1 + 6, z], 3));
  }
  if (e.decode) {
    const d = e.decode;
    const len = DECODE.cell * d.out;
    const dir: P3 = [0, -Math.cos(d.pitch), Math.sin(d.pitch)];
    fp.push(segFp(d.p, [d.p[0] + dir[0] * len, d.p[1] + dir[1] * len, d.p[2] + dir[2] * len], DECODE.w / 2));
  }
  if (e.plate) {
    const B = STRESS_PLATE.box;
    const [dx, dy, dz] = e.plate.d;
    const contact = e.plate.contact ?? (e.plate.flying ? 0 : PLATE_CONTACT.seated);
    const t = e.plate.tilt;
    if (t > 0) {
      // tilted as it climbs away (its north edge up, turned): its footprint turned with it and its top under its face's
      // lowest point, its south edge (a level top over a tilted face shaded the face's south part behind a hard line that
      // swept up it as it rose: R-A5-plate-band, lane A)
      const hd = (B.y1 - B.y0) / 2;
      const low = STRESS_PLATE.z[0] + dz - hd * Math.sin(t);
      const face = low + (STRESS_PLATE.z[1] - STRESS_PLATE.z[0] + 0.2) * Math.cos(t);
      fp.push({ kind: 'rect', c: [(B.x0 + B.x1) / 2 + dx, (B.y0 + B.y1) / 2 + dy], h: [(B.x1 - B.x0) / 2, hd * Math.cos(t)], r: 4, rot: e.plate.turn, z0: low, z1: face - TOP_CLEAR, contact });
    } else fp.push(rectFp({ x0: B.x0 + dx, x1: B.x1 + dx, y0: B.y0 + dy, y1: B.y1 + dy }, STRESS_PLATE.z[0] + dz, STRESS_PLATE.z[1] + dz, contact, 4));
  }
  if (e.review) fp.push({ kind: 'rect', c: [e.review.p[0], e.review.p[1]], h: [(REVIEW.l / 2) * Math.cos(e.review.slope), REVIEW.w / 2], r: 2, rot: e.review.heading, ...carrierSpan(e.review, REVIEW.l / 2, 0.4), contact: 0 });
  return fp;
}

/** How many of the pile's top slips cast (the ones under them lie in their shadow). */
const PILE_CASTS = 4;
/** How far under a landing pile slip's top its footprint ends at full squash (u; the squash itself lowers the top 0.012 u). */
export const PILE_SQUASH_CLEAR = 0.25;

/**
 * Beat 5's footprints (desk/beat5.ts): the starter key (in your tray's footprint as it lifts, its contact opening as it
 * rises, tightening as it docks), the Proactive plate sliding out of your desk (under its slab it shades only what the
 * slab already does), the spike as it rises out of its hatch (nothing while under the slate; its narrow pit is not
 * roofed, so its walls stay above the desk's floor tone), its rod and the pile's top slips, and every slip of the filter
 * in the air, on the fingers, on the belt or in the throat.
 */
export function beat5Footprints(e: Beat5State): Footprint[] {
  const fp: Footprint[] = [];
  // W-09's ask on its way from the galley into its work slot (beat5.ts docsTakeAt): standing on its short edge it shades a thin line
  const d = e.docs;
  if (d && d !== 'gone') fp.push({ kind: 'rect', c: [d.p[0], d.p[1]], h: [Math.max(1, (NEXT_SLIP.l / 2) * Math.abs(Math.cos(d.slope))), NEXT_SLIP.w / 2], r: 2, rot: d.heading, ...carrierSpan(d, NEXT_SLIP.l / 2, 0.4), contact: 0 });
  const k = e.key;
  if (k) {
    // the tray's key footprint (youFootprints) carried with the key: x from its bow's west edge to its bit, y from its tip to its bow
    const { key } = CHORES;
    const r: Rect = { x0: k.p[0] - key.bowR, x1: k.p[0] + key.bit.x[1], y0: k.p[1] + key.shank[0], y1: k.p[1] + key.bowY + key.bowR };
    const f0 = rectFp(r, k.p[2], k.p[2] + 4, 0.7 * Math.max(0, 1 - k.lift / 4), 4);
    // turned with the key about its rest point (its sway in flight, its kick on the slate)
    if (k.yaw !== 0 && f0.kind === 'rect') {
      const [dx, dy] = [f0.c[0] - k.p[0], f0.c[1] - k.p[1]];
      f0.c = [k.p[0] + dx * Math.cos(k.yaw) - dy * Math.sin(k.yaw), k.p[1] + dx * Math.sin(k.yaw) + dy * Math.cos(k.yaw)];
      f0.rot = k.yaw;
    }
    fp.push(f0);
  }
  const pl = e.plate;
  if (pl) {
    const B = PROACTIVE_PLATE.box;
    fp.push(rectFp({ ...B, y0: B.y0 + pl.dy, y1: B.y1 + pl.dy }, PROACTIVE_PLATE.z[0], PROACTIVE_PLATE.z[1], 0.8, 4));
  }
  const sp = e.spike;
  if (sp) {
    if (SPIKE_BASE + sp.dz > 0.5) fp.push(circleFp([SPIKE.x, SPIKE.y], SPIKE.baseR, Math.max(0, sp.dz), SPIKE_BASE + sp.dz, Math.min(1, Math.max(0, (sp.dz + 3) / 3))));
    if (SPIKE.h + sp.dz > 0.5) fp.push(segFp([SPIKE.x, SPIKE.y, Math.max(0, SPIKE_BASE + sp.dz)], [SPIKE.x, SPIKE.y, SPIKE.h + sp.dz], 2.6));
  }
  const pile = e.slips.filter((x) => x.onPile);
  // a slip's top face sits at its footprint's top (the shader skips a receiver there); squashed 3% as it lands its top
  // dips a hair under it, so the top comes down with a margin while it squashes (PILE_SQUASH_CLEAR x the squash: the
  // landing slip shaded itself for its 4 squash frames and lit up on the 5th, A9), exactly as before once it is still
  for (const x of pile.slice(-PILE_CASTS)) fp.push({ kind: 'rect', c: [x.p[0], x.p[1]], h: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 2, rot: x.heading, z0: x.p[2] - 0.4, z1: x.p[2] + 0.4 - PILE_SQUASH_CLEAR * x.squash, contact: x === pile[0] ? 0.3 : 0 });
  for (const x of e.slips) {
    if (x.onPile) continue;
    // a slip rolled about its length (flipped up on the fingers) shades a narrower strip, over the height it spans
    const half = (NEXT_SLIP.w / 2) * Math.abs(Math.cos(x.roll));
    const rise = (NEXT_SLIP.w / 2) * Math.abs(Math.sin(x.roll)) + (NEXT_SLIP.l / 2) * Math.abs(Math.sin(x.slope));
    fp.push({ kind: 'rect', c: [x.p[0], x.p[1]], h: [NEXT_SLIP.l / 2, Math.max(2, half)], r: 2, rot: x.heading, z0: x.p[2] - 0.4 - rise, z1: x.p[2] + 0.4 + rise, contact: 0 });
  }
  return fp;
}

/**
 * A carrier's contact shadow: its own (desk/beat4.ts Carry.contact: drawn out as it lifts off the slate and in as it settles
 * onto its dock, over frames), else by its height over the slate (full lying on it at 1.4 u, gone 5 u up).
 */
const carrierContact = (c: Carry): number => 0.4 * (c.contact ?? Math.min(1, Math.max(0, (5 - c.p[2]) / 3.6)));

/** Whether every corner of heap piece i lies under a piece that landed after it (its shadow lies under that piece). */
function heapCovered(i: number): boolean {
  const corners = (j: number): P2[] => {
    const p = HEAP[j];
    const [w, d] = PIECE[p.kind];
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => [p.c[0] + (a * w * c) / 2 - (b * d * s) / 2, p.c[1] + (a * w * s) / 2 + (b * d * c) / 2] as P2);
  };
  const inside = (q: P2, j: number): boolean => {
    const p = HEAP[j];
    const [w, d] = PIECE[p.kind];
    const dx = q[0] - p.c[0];
    const dy = q[1] - p.c[1];
    const u = dx * Math.cos(p.rot) + dy * Math.sin(p.rot);
    const v = -dx * Math.sin(p.rot) + dy * Math.cos(p.rot);
    return Math.abs(u) <= w / 2 && Math.abs(v) <= d / 2;
  };
  const cs = corners(i);
  for (let j = i + 1; j < HEAP.length; j++) if (cs.every((q) => inside(q, j))) return true;
  return false;
}
/**
 * The old heap's footprints after act one (the turn and act two; desk/beat4.ts heapAt): every piece not wholly under a
 * later one, its height as it settles and presses flat into the slate, its contact a little lighter once pressed.
 */
export function heapFootprintsAt(h: HeapState): Footprint[] {
  const fp: Footprint[] = [];
  if (!h.cast) return fp;
  const onReq = REQUEST_HEAP.z + ON_REQUEST;
  // pressing flat, each piece's shadow draws in under it (its outline inset by the penumbra's half, its contact gone), so
  // when the pressed heap stops casting nothing shows the change
  const k = Math.min(1, Math.max(0, h.press));
  HEAP.forEach((p, i) => {
    if (heapCovered(i)) return;
    const [w, d] = PIECE[p.kind];
    const q = heapPieceAt(p.z, Math.abs(p.z - onReq) < 1e-6, h, heapFloor(p.c, p.rot, w, d, p.z));
    const inset = 5 * k;
    // (its plate thins to nothing as it presses flat, so the frame it stops casting changes no shade)
    const z0 = q.z - 0.3 * (1 - k);
    fp.push({ kind: 'rect', c: p.c, h: [Math.max(1, w / 2 - inset), Math.max(1, d / 2 - inset)], r: 2, rot: p.rot, z0, z1: z0 + (0.3 + 0.5 * q.k) * (1 - k), contact: 0.45 * (1 - k) });
  });
  return fp;
}

/**
 * A counterfactual card hovering over the slate (desk/beat4.ts cardAt, at its spot: beat 4's by name, a later beat's as
 * its CardUp gives it): its outline, as a thin plate just under its lowest edge (so it shades the slate under it and never
 * its own face); nothing while it is under the slate. At the frame's top edge it rides north of the card (beat4.ts
 * cardShadeShift), so its shadow leaves the frame with it.
 */
export function cardFootprint(c: CardState, which: 'split' | 'ghost' | CardSpot): Footprint | null {
  const p = cardPose(c, which);
  const { w, h } = cardSize(which);
  const low = p.c[2] - (h / 2) * Math.sin(p.tilt);
  if (low < 1) return null;
  return { kind: 'rect', c: [p.c[0], p.c[1] + cardShadeShift(c)], h: [(w / 2) * p.scale, Math.max(2, (h / 2) * Math.cos(p.tilt)) * p.scale], r: 4, rot: 0, z0: low - 1.5, z1: low - 0.5, contact: 0 };
}

/** All footprints at a frame (static first). Throws past MAX_FOOTPRINTS. */
export function footprintsAt(s: DeskState): Footprint[] {
  const all = [...staticFootprints(s.testsSink, youPoseAt(s.f), s.b4.bays, HEAD_DIP * headDipAt(s)), ...movingFootprints(s)];
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
