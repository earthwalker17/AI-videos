/**
 * The Register ("the Router", 登记台): a raised, skeletal graphite deck one level above the bays
 * (C9 "Above", C11 "Below"), carrying a wound-tape reel inside an enamel-capped frame. Its parts are
 * its jobs (synthesis §2, element sheet):
 * - the throat and the print head: the one sequence point where every event is stamped in;
 * - the reading window: its context, five inline cells under a hooded reading lamp (a pool, never bloom);
 * - the tape winding onto the reel (tape thickness is the log), older rows in the fanfold below;
 * - the index arm on its detent plate: it faces whom it addresses (here, west: you);
 * - the loupe over the pinned policy card (the Slow Path), the neck-collar gauge (needle low);
 * - the spill drawer, the hopper where report cards land, the dispatch ramp down to the grooves;
 * - a sealed restricted-shell key on the north-east leg (FACTS l.114), and no bench: it never does the work;
 * - the pilot jewel: lit, never blooming.
 */
import { useMemo } from 'react';
import { CircleGeometry, Matrix4, Path, Shape, type BufferGeometry } from 'three';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, ringFlat, slab, sweep, tube } from '../geom.ts';
import { Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { CELLS_X, CROSS, DECK, DECK_PLATE, DRAWER, FANFOLD, INDEX, JEWEL, LEG_R, LEG_STRUTS, LOCK, LOUPE, MOUTH, POLICY_CARD, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, TAPE, TAPE_FLAT_X1, THROAT, TRAIT_PLATE, WINDOW, rectC, type P2, type P3, type Rect } from '../layout.ts';
import { PRINT_SIZE } from '../gl/text.ts';
import { DETENT, type DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/** The quarter-pipe's profile in (u, z), u outward from the rail: the lip down from the rail, then the curve to the desk (a 4 u sheet). */
function rampProfile(): P2[] {
  const r = RAMP.lip;
  const top: P2[] = [[0, RAMP.top]];
  for (let i = 0; i <= 16; i++) {
    const a = (Math.PI / 2) * (1 - i / 16);
    top.push([r - r * Math.sin(a), r - r * Math.cos(a)]);
  }
  const under: P2[] = [];
  for (let i = 16; i >= 0; i--) {
    const a = (Math.PI / 2) * (1 - i / 16);
    under.push([r - (r + 4) * Math.sin(a), r - (r + 4) * Math.cos(a)]);
  }
  return [...top, ...under, [-4, RAMP.top]];
}

/** A shape in the (y, z) plane extruded along x from x0 by `w`. */
function extrudeYZ(shape: Shape, x0: number, w: number, bevel = 1): BufferGeometry {
  const g = extrude(shape, 0, w, bevel);
  // (sx, sy, ez) → (x0 + ez, sx, sy)
  g.applyMatrix4(new Matrix4().set(0, 0, 1, x0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  return g;
}

/** A shape in the ramp's (u, z) plane extruded across it (along -y from y1 by `w`): x = rail + u. */
function extrudeRamp(shape: Shape, y1: number, w: number, bevel = 1): BufferGeometry {
  const g = extrude(shape, 0, w, bevel);
  // (sx, sy, ez) → (RAMP.x + sx, y1 - ez, sy): a proper rotation, so faces keep their winding
  g.applyMatrix4(new Matrix4().set(1, 0, 0, RAMP.x, 0, 0, -1, y1, 0, 1, 0, 0, 0, 0, 0, 1));
  return g;
}

/** The ramp's two cheeks: the region between its curve and the deck's east face. */
function rampCheek(y1: number): BufferGeometry {
  const s = new Shape();
  const r = RAMP.lip;
  s.moveTo(r, 0);
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI / 2) * (i / 12);
    s.lineTo(r - r * Math.sin(a) + 0.5, r - r * Math.cos(a) + 3);
  }
  s.lineTo(-2, RAMP.top + 4);
  s.lineTo(-2, 0);
  s.closePath();
  return extrudeRamp(s, y1, 6, 1);
}

/** The index arm's tapered bar, pointing along +x from its pivot (local coordinates). */
function armShape(): Shape {
  const L = INDEX.length;
  const s = new Shape();
  s.moveTo(0, -8);
  s.lineTo(L - 22, -4);
  s.lineTo(L, 0);
  s.lineTo(L - 22, 4);
  s.lineTo(0, 8);
  s.absarc(0, 0, 8, Math.PI / 2, (3 * Math.PI) / 2, false);
  return s;
}

/** The detent plate: a sector round the pivot with a notch for each party the arm can face. */
function detentPlate(): BufferGeometry {
  const [a0, a1] = INDEX.plateA.map((d) => (d * Math.PI) / 180);
  const R = INDEX.plateR;
  const [px, py] = INDEX.pivot;
  const s = new Shape();
  s.moveTo(px, py);
  s.absarc(px, py, R, a0, a1, false);
  s.lineTo(px, py);
  // notches near the rim at the detents: you (west), the bug bay, the test tower, the docs galley
  for (const a of [DETENT.you, DETENT.bug, DETENT.tests, DETENT.docs]) {
    const h = new Path();
    const cx = px + Math.cos(a) * (R - 10);
    const cy = py + Math.sin(a) * (R - 10);
    h.absarc(cx, cy, 3.6, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return extrude(s, DECK.top, DECK.top + 4, 1);
}

function useRegisterGeometry() {
  return useMemo(() => {
    const top = DECK.top;
    // splayed struts from under the rails' corners to their feet: they read as legs at 15° and in plan
    const legs = merge(LEG_STRUTS.map((l) => tube([l.top, [l.foot[0], l.foot[1], 0] as P3], LEG_R, 2, 14)));
    const feet = merge(LEG_STRUTS.map((l) => disc(16, 0, 4, { cx: l.foot[0], cy: l.foot[1], bevel: 1.4 })));
    const rails = frame({ x0: DECK.x0, x1: DECK.x1, y0: DECK.y0, y1: DECK.y1 }, DECK.rail, DECK.railZ0, top, 6, 3.2);
    const cross = merge(CROSS.map((c) => slab(c, DECK.railZ0 + 2, top, 2, 1.5)));
    const plate = slab(DECK_PLATE, top - 6, top, 2, 1);
    // gussets where the legs meet the rails: small enamel plates on the rail tops at the corners
    const gussets = merge(LEG_STRUTS.map((l) => slab({ x0: l.top[0] - 11, x1: l.top[0] + 11, y0: l.top[1] - 11, y1: l.top[1] + 11 }, top, top + 2.5, 3, 0.8)));

    // the reel: flange, wound pack, its top, hub, three spokes holding the pack
    const flange = disc(REEL.r, REEL.flangeZ[0], REEL.flangeZ[1], { cx: REEL.x, cy: REEL.y, bevel: 1.5 });
    const pack = cylinderZ(REEL.packR, REEL.packZ[0], REEL.packZ[1], REEL.x, REEL.y, 72);
    const packTop = new CircleGeometry(REEL.packR, 72);
    packTop.translate(REEL.x, REEL.y, REEL.packZ[1] + 0.25);
    const hub = merge([cylinderZ(REEL.hubR, REEL.hubZ[0], REEL.hubZ[1] - 3, REEL.x, REEL.y), disc(REEL.hubR + 2, REEL.hubZ[1] - 3, REEL.hubZ[1], { cx: REEL.x, cy: REEL.y, bevel: 1.2 })]);
    const hubSlot = slab({ x0: REEL.x - 13, x1: REEL.x + 13, y0: REEL.y - 2.5, y1: REEL.y + 2.5 }, REEL.hubZ[1], REEL.hubZ[1] + 1.2, 1, 0.4);
    const spokes = merge(
      [0, 1, 2].map((k) => {
        const a = (k * 2 * Math.PI) / 3 + 0.35;
        const s = new Shape();
        s.moveTo(0, -5);
        s.lineTo(REEL.packR - 6, -3);
        s.lineTo(REEL.packR - 6, 3);
        s.lineTo(0, 5);
        s.closePath();
        const g = extrude(s, REEL.packZ[1] + 0.4, REEL.packZ[1] + 4, 1);
        g.rotateZ(a);
        g.translate(REEL.x, REEL.y, 0);
        return g;
      }),
    );
    // the frame round the reel: graphite members with enamel caps, bosses at the corners
    const frameMembers = merge(REEL_FRAME.map((m) => slab(m, REEL_FRAME_Z[0], REEL_FRAME_Z[1] - 3, 2, 2.5)));
    const frameCaps = merge(REEL_FRAME.map((m) => slab(inset(m, 1.5), REEL_FRAME_Z[1] - 4, REEL_FRAME_Z[1] + 1, 2, 2)));
    const bosses = merge(
      [
        [REEL_FRAME[0].x0 + 8, REEL_FRAME[0].y0 + 8],
        [REEL_FRAME[0].x0 + 8, REEL_FRAME[1].y1 - 8],
        [REEL_FRAME[2].x1 - 8, REEL_FRAME[1].y1 - 8],
        [REEL_FRAME[2].x1 - 8, REEL_FRAME[2].y0 + 8],
      ].map(([x, y]) => merge([cylinderZ(11, REEL_FRAME_Z[0], REEL_FRAME_Z[1] + 5, x, y, 28), dome(4, x, y, REEL_FRAME_Z[1] + 5)])),
    );
    // the tape: flat from the print head along the window, then rising onto the pack's south side
    const tapeFlat = planeOn({ x0: TAPE.x0, x1: TAPE_FLAT_X1, y0: TAPE.y0, y1: TAPE.y1 }, TAPE.z);
    const tapeRise = sweep(
      [
        [TAPE_FLAT_X1 - 2, (TAPE.y0 + TAPE.y1) / 2, TAPE.z],
        [TAPE.x1 - 6, (TAPE.y0 + TAPE.y1) / 2, TAPE.z + 6],
        [TAPE.x1 + 8, (TAPE.y0 + TAPE.y1) / 2 + 3, REEL.packZ[1] - 8],
      ],
      [
        [-(TAPE.y1 - TAPE.y0) / 2, 0],
        [(TAPE.y1 - TAPE.y0) / 2, 0],
      ],
      8,
    );
    // the window: its frame, and enamel bars between the cells
    const win = frame(WINDOW.frame, WINDOW.bar, WINDOW.z[0], WINDOW.z[1], 5, 1.5);
    const bars = merge(CELLS_X.slice(0, 4).map(([, x1]) => slab({ x0: x1 + 0.5, x1: x1 + 3.5, y0: WINDOW.frame.y0 + WINDOW.bar - 1, y1: WINDOW.frame.y1 - WINDOW.bar + 1 }, TAPE.z, WINDOW.z[1] - 2, 1, 0.5)));
    // the hooded reading lamp: a base on the cross member, a bent arm, a half-round hood over the newest cells
    const H = READ_LAMP.hood;
    const hood = (() => {
      const s = new Shape();
      // the hood's section in (y, z) about its axis: closed over the north and the top, open to the south and down
      s.absarc(0, 0, H.r, -0.5, 2.5, false);
      s.absarc(0, 0, H.r - 3, 2.5, -0.5, true);
      s.closePath();
      const g = extrudeYZ(s, H.x0, H.x1 - H.x0, 1);
      g.translate(0, H.y, H.z);
      return g;
    })();
    // its lit lining, seen under the open south edge
    const hoodLining = (() => {
      const s = new Shape();
      s.absarc(0, 0, H.r - 3.2, 1.6, 2.5, false);
      s.absarc(0, 0, H.r - 4.5, 2.5, 1.6, true);
      s.closePath();
      const g = extrudeYZ(s, H.x0 + 3, H.x1 - H.x0 - 6, 0.3);
      g.translate(0, H.y, H.z);
      return g;
    })();
    const hoodCaps = merge(
      [H.x0 - 3, H.x1].map((x) => {
        const s = new Shape();
        s.absarc(0, 0, H.r + 1, 0, Math.PI * 2, false);
        const g = extrudeYZ(s, x, 3, 0.6);
        g.translate(0, H.y, H.z);
        return g;
      }),
    );
    const [bx, by] = READ_LAMP.base;
    const lampArms = tube(
      [
        [bx, by, top + 4],
        [bx, by, H.z + 34],
        [bx - 40, by - 6, H.z + 44],
        [H.x1 + 20, H.y + 6, H.z + 26],
        [H.x1 + 1, H.y, H.z + 2],
      ],
      3.4,
      40,
      8,
    );
    const lampFeet = merge([disc(13, top, top + 4, { cx: bx, cy: by, bevel: 1 }), cylinderZ(6, top + 4, top + 12, bx, by, 16)]);

    // the print head and its cap; the throat with its cheeks and the neck collar; the gauge
    const head = slab(PRINT_HEAD.box, PRINT_HEAD.z[0], PRINT_HEAD.z[1], 5, 2.5);
    const headCap = slab(inset(PRINT_HEAD.box, 4), PRINT_HEAD.z[1], PRINT_HEAD.z[1] + 5, 4, 1.5);
    const headHammer = slab({ x0: PRINT_HEAD.box.x1 - 4, x1: PRINT_HEAD.box.x1 + 10, y0: TAPE.y0 + 6, y1: TAPE.y1 - 6 }, TAPE.z + 3, TAPE.z + 16, 2, 1);
    const throat = slab(THROAT.box, THROAT.z[0], THROAT.z[1] - 8, 4, 2);
    const cheeks = merge([
      slab({ x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y0 - 4, y1: THROAT.box.y0 + 6 }, THROAT.z[0] + 4, THROAT.z[1] + 4, 2, 1.2),
      slab({ x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y1 - 6, y1: THROAT.box.y1 + 4 }, THROAT.z[0] + 4, THROAT.z[1] + 4, 2, 1.2),
    ]);
    const collar = (() => {
      const g = ringFlat((THROAT.box.y1 - THROAT.box.y0) / 2 + 6, 4.5, 0, 0, 0);
      g.rotateY(Math.PI / 2);
      g.translate(THROAT.box.x1 - 6, (THROAT.box.y0 + THROAT.box.y1) / 2, (THROAT.z[0] + THROAT.z[1]) / 2 + 4);
      return g;
    })();

    // the policy card pinned under the loupe on its swing arm
    const policyBase = slab(inset(POLICY_CARD.box, -4), top, POLICY_CARD.z - 0.5, 3, 1);
    const policyCard = planeOn(POLICY_CARD.box, POLICY_CARD.z);
    const pin = dome(4, rectC(POLICY_CARD.box)[0], POLICY_CARD.box.y1 - 9, POLICY_CARD.z + 0.2);
    const loupeRing = ringFlat(LOUPE.r, 3.6, LOUPE.x, LOUPE.y, LOUPE.z);
    const lens = (() => {
      // the lens shows the card under it, magnified 1.1x about the point below its centre
      const g = new CircleGeometry(LOUPE.r - 2, 48);
      const uv = g.getAttribute('uv');
      const pos = g.getAttribute('position');
      const [cw, ch] = PRINT_SIZE.policy;
      const u0 = (LOUPE.x - POLICY_CARD.box.x0) / cw;
      const v0 = (LOUPE.y - POLICY_CARD.box.y0) / ch;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + pos.getX(i) / (1.1 * cw), v0 + pos.getY(i) / (1.1 * ch));
      g.translate(LOUPE.x, LOUPE.y, LOUPE.z - 0.5);
      return g;
    })();
    const loupeArm = merge([
      tube(
        [
          [LOUPE.pivot[0], LOUPE.pivot[1], top + 2],
          [LOUPE.pivot[0], LOUPE.pivot[1], LOUPE.z],
          [LOUPE.x - LOUPE.r, LOUPE.y, LOUPE.z],
        ],
        2.6,
        16,
        8,
      ),
      cylinderZ(7, top, top + 8, LOUPE.pivot[0], LOUPE.pivot[1], 20),
    ]);

    // the index arm's pivot boss and detent plate (the arm itself is posed per frame)
    const plateGeo = detentPlate();
    const boss = merge([cylinderZ(13, top, INDEX.z + 9, INDEX.pivot[0], INDEX.pivot[1], 28), dome(5, INDEX.pivot[0], INDEX.pivot[1], INDEX.z + 9)]);
    const arm = extrude(armShape(), INDEX.z, INDEX.z + 5, 1.2);
    const armTip = dome(4.5, INDEX.length - 14, 0, INDEX.z + 4.6);

    // the spill drawer: a box pulled out under the south rail, its enamel front, folded tabs inside
    const drawerBox = merge([
      frame(DRAWER.box, 4, DRAWER.z[0], DRAWER.z[1], 3, 1),
      slab(inset(DRAWER.box, 2), DRAWER.z[0], DRAWER.z[0] + 3, 2, 0.8),
    ]);
    const drawerFront = slab({ x0: DRAWER.box.x0 - 5, x1: DRAWER.box.x1 + 5, y0: DRAWER.box.y0 - 6, y1: DRAWER.box.y0 }, DRAWER.z[0] - 3, DRAWER.z[1] + 2, 3, 1.5);
    const drawerHandle = tube(
      [
        [rectC(DRAWER.box)[0] - 20, DRAWER.box.y0 - 6, DRAWER.z[1] - 10],
        [rectC(DRAWER.box)[0] - 18, DRAWER.box.y0 - 14, DRAWER.z[1] - 10],
        [rectC(DRAWER.box)[0] + 18, DRAWER.box.y0 - 14, DRAWER.z[1] - 10],
        [rectC(DRAWER.box)[0] + 20, DRAWER.box.y0 - 6, DRAWER.z[1] - 10],
      ],
      2.2,
      20,
      6,
    );
    const tabs = merge(
      [0, 1, 2, 3].map((i) => {
        const g = slab({ x0: DRAWER.box.x0 + 10 + i * 20, x1: DRAWER.box.x0 + 26 + i * 20, y0: DRAWER.box.y0 + 10, y1: DRAWER.box.y1 - 12 }, DRAWER.z[0] + 3, DRAWER.z[0] + 14 + (i % 2) * 4, 1, 0.5);
        return g;
      }),
    );

    // the mouth where report cards dock: a funnel off the south rail, under the newest cell
    const M = MOUTH.box;
    const hopper = merge([
      slab(M, MOUTH.z[0], MOUTH.z[0] + 3, 4, 1),
      slab({ x0: M.x0, x1: M.x0 + 5, y0: M.y0, y1: M.y1 }, MOUTH.z[0], MOUTH.z[1], 2, 1),
      slab({ x0: M.x1 - 5, x1: M.x1, y0: M.y0, y1: M.y1 }, MOUTH.z[0], MOUTH.z[1], 2, 1),
      slab({ x0: M.x0, x1: M.x1, y0: M.y0, y1: M.y0 + 4 }, MOUTH.z[0], MOUTH.z[0] + 9, 2, 1),
    ]);

    // the sealed restricted-shell key in its lock plate on the north-east leg
    const lockBlock = slab(LOCK.box, LOCK.z[0], LOCK.z[1] - 3, 4, 2);
    const lockPlate = slab(inset(LOCK.box, 3), LOCK.z[1] - 3, LOCK.z[1], 3, 1);
    const lockFace = plane(LOCK.box.x1 - LOCK.box.x0 - 6, LOCK.box.y1 - LOCK.box.y0 - 6, rectC(LOCK.box)[0], rectC(LOCK.box)[1], LOCK.z[1] + 0.2);
    const K = LOCK.key;
    const keyMetal = merge([
      tube(
        [
          [K.x0 - 2, K.y, K.z],
          [K.x1, K.y, K.z],
        ],
        3.2,
        8,
        10,
      ),
      ringFlat(K.bowR, 3, K.x1 + K.bowR, K.y, K.z),
      slab({ x0: K.x0 + 4, x1: K.x0 + 12, y0: K.y - 9, y1: K.y - 2 }, K.z - 2, K.z + 2, 1, 0.5),
      ringFlat(5, 0.9, K.x1 + 2 * K.bowR + 4, K.y - 8, K.z - 1),
    ]);
    const seal = disc(7, K.z - 4, K.z - 0.5, { cx: K.x1 + 2 * K.bowR + 10, cy: K.y - 15, bevel: 1 });

    // the pilot jewel in its bezel
    const jewel = dome(JEWEL.r, JEWEL.x, JEWEL.y, JEWEL.z);
    const bezel = ringFlat(JEWEL.r + 1.5, 2, JEWEL.x, JEWEL.y, JEWEL.z + 0.5);

    // the fanfold under the deck
    const ff = FANFOLD.box;
    const ffH = FANFOLD.sheets * SHEET;
    const fanfoldBody = slab(ff, 0, ffH, 1.5, 0.6);
    const fanfoldTop = planeOn(inset(ff, 0.5), ffH + 0.2);
    const fanfoldSide = (() => {
      const g = plane(ff.x1 - ff.x0 - 2, ffH, rectC(ff)[0], 0, 0);
      g.rotateX(Math.PI / 2);
      g.translate(0, ff.y0 - 0.3, ffH / 2);
      return g;
    })();

    // the Continuous plate: a narrow enamel apron along the deck's front, on a graphite backing
    const T = TRAIT_PLATE.box;
    const traitBack = slab(T, TRAIT_PLATE.z[0], TRAIT_PLATE.z[0] + 2, 4, 0.8);
    const trait = slab(inset(T, 3), TRAIT_PLATE.z[0] + 2, TRAIT_PLATE.z[1], 3, 1);
    const traitFace = planeOn(inset(T, 5), TRAIT_PLATE.z[1] + 0.2);
    const bolts = merge(
      [
        [T.x0 + 6, rectC(T)[1]],
        [T.x1 - 6, rectC(T)[1]],
      ].map(([x, y]) => dome(2.6, x, y, TRAIT_PLATE.z[1])),
    );

    // the dispatch ramp off the east rail, and its cheeks
    const rampSheet = (() => {
      const s = new Shape();
      const prof = rampProfile();
      s.moveTo(prof[0][0], prof[0][1]);
      for (const [u, z] of prof.slice(1)) s.lineTo(u, z);
      s.closePath();
      return extrudeRamp(s, RAMP.y1 - 6, RAMP.y1 - RAMP.y0 - 12, 0.6);
    })();
    const rampCheeks = merge([rampCheek(RAMP.y1), rampCheek(RAMP.y0 + 6)]);

    return {
      legs,
      feet,
      rails,
      cross,
      plate,
      gussets,
      flange,
      pack,
      packTop,
      hub,
      hubSlot,
      spokes,
      frameMembers,
      frameCaps,
      bosses,
      tapeFlat,
      tapeRise,
      win,
      bars,
      hood,
      hoodLining,
      hoodCaps,
      lampArms,
      lampFeet,
      head,
      headCap,
      headHammer,
      throat,
      cheeks,
      collar,
      policyBase,
      policyCard,
      pin,
      loupeRing,
      lens,
      loupeArm,
      plateGeo,
      boss,
      arm,
      armTip,
      drawerBox,
      drawerFront,
      drawerHandle,
      tabs,
      hopper,
      lockBlock,
      lockPlate,
      lockFace,
      keyMetal,
      seal,
      jewel,
      bezel,
      fanfoldBody,
      fanfoldTop,
      fanfoldSide,
      rampSheet,
      rampCheeks,
      traitBack,
      trait,
      traitFace,
      bolts,
    };
  }, []);
}

export function Register({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useRegisterGeometry();
  return (
    <group>
      {/* the gantry */}
      <mesh geometry={g.legs} material={m.graphite} />
      <mesh geometry={g.feet} material={m.graphiteDark} />
      <mesh geometry={g.rails} material={m.graphite} />
      <mesh geometry={g.cross} material={m.graphiteDark} />
      <mesh geometry={g.plate} material={m.graphiteDeck} />
      <mesh geometry={g.gussets} material={m.enamelShade} />
      {/* the reel: it detents one step as a report stamps in (stepped down in C12: its face is not the action) */}
      <Step on={isStepped(s.step, 'reel')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.flange} material={n.graphiteDark} />
              <mesh geometry={g.pack} material={n.paperShade} />
              <group position={[REEL.x, REEL.y, 0]} rotation={[0, 0, -0.26 * s.reel]}>
                <group position={[-REEL.x, -REEL.y, 0]}>
                  <mesh geometry={g.packTop} material={n.printed.reelTop} />
                  <mesh geometry={g.hub} material={n.enamel} />
                  <mesh geometry={g.hubSlot} material={n.graphiteDark} />
                  <mesh geometry={g.spokes} material={n.enamel} />
                </group>
              </group>
            </>
          )}
        </WithMats>
      </Step>
      <mesh geometry={g.frameMembers} material={m.graphite} />
      <mesh geometry={g.frameCaps} material={m.enamelShade} />
      <mesh geometry={g.bosses} material={m.enamel} />
      {/* the tape, the window and its lamp */}
      <mesh geometry={g.tapeFlat} material={s.cellLit > 0.5 ? m.printed.tape : m.printed.tapeBefore} />
      <mesh geometry={g.tapeRise} material={m.paper} />
      <mesh geometry={g.win} material={m.graphite} />
      <mesh geometry={g.bars} material={m.enamelShade} />
      <mesh geometry={g.hood} material={m.enamel} />
      <mesh geometry={g.hoodLining} material={m.paperLit} />
      <mesh geometry={g.hoodCaps} material={m.enamelShade} />
      <mesh geometry={g.lampArms} material={m.graphite} />
      <mesh geometry={g.lampFeet} material={m.graphiteDark} />
      {/* the throat, the print head */}
      <mesh geometry={g.head} material={m.graphite} />
      <mesh geometry={g.headCap} material={m.enamel} />
      <mesh geometry={g.headHammer} material={m.steel} position={[0, 0, -9 * s.stamp]} />
      <mesh geometry={g.throat} material={m.graphiteDark} />
      <mesh geometry={g.cheeks} material={m.enamel} />
      <mesh geometry={g.collar} material={m.steel} />
      {/* the Slow Path: the loupe over the pinned policy card (stepped down in C12) */}
      <Step on={isStepped(s.step, 'policy')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.policyBase} material={n.graphiteDark} />
              <mesh geometry={g.policyCard} material={n.printed.policy} />
              <mesh geometry={g.pin} material={n.enamel} />
              <mesh geometry={g.loupeRing} material={n.steel} />
              <mesh geometry={g.lens} material={n.printed.lens} />
              <mesh geometry={g.loupeArm} material={n.graphite} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the index arm on its detent plate */}
      <mesh geometry={g.plateGeo} material={m.enamelShade} />
      <group position={[INDEX.pivot[0], INDEX.pivot[1], 0]} rotation={[0, 0, s.arm]}>
        <mesh geometry={g.arm} material={m.graphite} />
        <mesh geometry={g.armTip} material={m.enamel} />
      </group>
      <mesh geometry={g.boss} material={m.enamel} />
      {/* the spill drawer, the mouth */}
      <mesh geometry={g.drawerBox} material={m.graphiteDark} />
      <mesh geometry={g.drawerFront} material={m.enamel} />
      <mesh geometry={g.drawerHandle} material={m.steel} />
      <mesh geometry={g.tabs} material={m.paper} />
      <mesh geometry={g.hopper} material={m.enamelShade} />
      {/* the sealed shell key */}
      <Step on={isStepped(s.step, 'lock')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.lockBlock} material={n.graphite} />
              <mesh geometry={g.lockPlate} material={n.enamel} />
              <mesh geometry={g.lockFace} material={n.printed.lockFace} />
              <mesh geometry={g.keyMetal} material={n.steel} />
              <mesh geometry={g.seal} material={n.enamelShade} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the pilot jewel */}
      <mesh geometry={g.jewel} material={m.jewel} />
      <mesh geometry={g.bezel} material={m.steel} />
      {/* the fanfold under the deck */}
      <Step on={isStepped(s.step, 'fanfold')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.fanfoldBody} material={n.paperShade} />
              <mesh geometry={g.fanfoldTop} material={n.printed.fanfold} />
              <mesh geometry={g.fanfoldSide} material={n.printed.fanfoldSide} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the Continuous plate on the front apron */}
      <Step on={isStepped(s.step, 'plate')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.traitBack} material={n.graphiteDark} />
              <mesh geometry={g.trait} material={n.enamel} />
              <mesh geometry={g.traitFace} material={n.printed.trait} />
              <mesh geometry={g.bolts} material={n.steel} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the dispatch ramp */}
      <mesh geometry={g.rampSheet} material={m.enamelShade} />
      <mesh geometry={g.rampCheeks} material={m.steel} />
    </group>
  );
}
