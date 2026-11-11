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
import { textCanvas } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { CanvasTexture, CircleGeometry, Matrix4, Path, SRGBColorSpace, Shape, type BufferGeometry, type Material, type MeshStandardMaterial, type Texture } from 'three';
import { TAPE_ROWS, type TapeCell } from '../beat4.ts';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, ringFlat, slab, sweep, tube } from '../geom.ts';
import { HEX, paper, stepColour } from '../gl/materials.ts';
import { Step, WithMats, isStepped, useDeskMats, useDeskSets, type DeskMats } from '../kit.tsx';
import { CACHE_WINDOW, CELLS_X, CROSS, DECK, DECK_PLATE, DISPATCH_HOUSING, DRAWER, DRAWER_OPEN_C, FANFOLD, INDEX, JEWEL, LEG_R, LEG_STRUTS, LOCK, LOUPE, MOUTH, POLICY_CARD, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, TAPE, TAPE_FLAT_X1, THROAT, TRAIT_PLATE, WINDOW, rectC, type P2, type P3, type Rect } from '../layout.ts';
import { INK, NEWEST_STEP, PRINT_SIZE, REQUEST_MARK_Y, TEX, cargoMark, requestStub, stagedInk, texture, threadMark, tooth } from '../gl/text.ts';
import { FiledTabs } from './Cache.tsx';
import { REWIND_TURN, THREAD_ROW } from '../beat6.ts';
import { DETENT, EVENTS_B, EVENTS_D, HEAD_DIP, closeAt, hammerOffset, headDipAt, loupeAt, type DeskState } from '../state.ts';

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
    const barOf = (x1: number) => slab({ x0: x1 + 0.5, x1: x1 + 3.5, y0: WINDOW.frame.y0 + WINDOW.bar - 1, y1: WINDOW.frame.y1 - WINDOW.bar + 1 }, TAPE.z, WINDOW.z[1] - 2, 1, 0.5);
    // the bar between the second and third cells is its own: MT1's second stamp-in moves it on onto the next bar's place, so it never crosses #0408 once that print has moved on a whole newest cell (objects/Register.tsx Register)
    const bars = merge([0, 2, 3].map((i) => barOf(CELLS_X[i][1])));
    const bar1 = barOf(CELLS_X[1][1]);
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

    // the neck-collar gauge on the throat: an arc scale and a needle sitting low (the queue is short)
    const gx = THROAT.box.x0 + 8;
    const gy = THROAT.box.y0 - 34;
    const gaugeBody = disc(28, top - 2, top + 3, { cx: gx, cy: gy, bevel: 1.2 });
    // (its face round, as its back is: one shape face down and face up, design D5)
    const gaugeFace = (() => {
      const c = new CircleGeometry(24, 48);
      c.translate(gx, gy, top + 3.2);
      return c;
    })();
    // the needle at its hub, pointing +x: posed per frame (beat4.ts GAUGE: low)
    const needle = (() => {
      const s = new Shape();
      s.moveTo(0, -1.8);
      s.lineTo(22, 0);
      s.lineTo(0, 1.8);
      s.closePath();
      return extrude(s, top + 3.5, top + 4.8, 0);
    })();
    const gaugeHub = dome(3.4, gx, gy, top + 4.6);

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
      // low side walls: a docked card lies over them, never behind them (its print clear)
      slab({ x0: M.x0, x1: M.x0 + 5, y0: M.y0, y1: M.y1 }, MOUTH.z[0], MOUTH.z[0] + 8, 2, 1),
      slab({ x0: M.x1 - 5, x1: M.x1, y0: M.y0, y1: M.y1 }, MOUTH.z[0], MOUTH.z[0] + 8, 2, 1),
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

    // the Continuous plate: an enamel plate with its words on a graphite backing, on two brackets off the north rail
    const T = TRAIT_PLATE.box;
    const traitBack = slab(T, TRAIT_PLATE.z[0], TRAIT_PLATE.z[0] + 2, 4, 0.8);
    const trait = slab(inset(T, 3), TRAIT_PLATE.z[0] + 2, TRAIT_PLATE.z[1], 3, 1);
    const traitFace = planeOn(inset(T, 5), TRAIT_PLATE.z[1] + 0.2);
    const bolts = merge(TRAIT_PLATE.brackets.map((x) => dome(2.6, x, T.y0 + 6, TRAIT_PLATE.z[1])));
    const traitBrackets = merge(TRAIT_PLATE.brackets.map((x) => slab({ x0: x - 7, x1: x + 7, y0: DECK.y1 - DECK.rail + 4, y1: T.y0 + 14 }, TRAIT_PLATE.z[0] - 7, TRAIT_PLATE.z[0], 2, 1)));

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

    // the dispatch housing under the deck's east end: a graphite box behind the ramp's face, its top just under the rails
    const HB = DISPATCH_HOUSING;
    const housing = slab({ ...HB.box, x1: HB.box.x1 - 4.2 }, HB.z[0], HB.z[1], 3, 1.5);
    const housingRim = frame({ x0: HB.box.x0 + 4, x1: HB.box.x1 - 4.2, y0: HB.box.y0 + 4, y1: HB.box.y1 - 4 }, 3, HB.z[1], HB.z[1] + 1.2, 1, 0.4);

    return {
      housing,
      housingRim,
      bar1,
      gauge: [gx, gy] as P2,
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
      traitBrackets,
      gaugeBody,
      gaugeFace,
      needle,
      gaugeHub,
    };
  }, []);
}

/** The Register's own print's ink for the cells of the window (as gl/text.ts tapeOf prints older cells): the newest's a step darker. */
const OLD_INK = '#55534D';

/**
 * One state of the tape (beat4.ts TAPE_ROWS) as the window prints it before a stamp-in (gl/text.ts tapeOf, its
 * `tapeBefore`): each cell's frame and its mark (the newest a step darker, its frame heavier), the request's
 * vermilion stub and, once its Thread is subscribed, the Thread's mark beside it; its tooth and sprocket ticks. The
 * newest print (`fresh`: the new cell, or the Thread's mark alone) at its ink stage (0, 1, then 2 printed).
 */
function rowTexture(cells: readonly TapeCell[], fresh: 'cell' | 'thread', stage: number, aniso: number): Texture {
  const [tw, h] = PRINT_SIZE.tape;
  return texture(
    tw,
    h,
    (g) => {
      cells.forEach((cell, i) => {
        const x = CELLS_X[i][0] - TAPE.x0;
        const w = CELLS_X[i][1] - CELLS_X[i][0];
        const ink = i === 0 ? INK : OLD_INK;
        const freshCell = i === 0 && fresh === 'cell';
        const freshThread = i === 0 && fresh === 'thread';
        const body = (c: CanvasRenderingContext2D) => {
          c.strokeStyle = ink;
          c.lineWidth = i === 0 ? 2.2 : 1.2;
          c.strokeRect(x + 2, 4, w - 4, h - 8);
          c.filter = 'blur(0.35px)';
          cargoMark(c, cell.kind, x + 8, cell.request ? REQUEST_MARK_Y : 20, ink);
          c.filter = 'none';
          if (cell.request) requestStub(c, x);
          if (cell.thread && !freshThread) threadMark(c, x);
        };
        if (freshCell) stagedInk(g, tw, h, TEX, stage, body);
        else body(g);
        if (freshThread && cell.thread) stagedInk(g, tw, h, TEX, stage, (c) => threadMark(c, x));
      });
      tooth(g, tw, h);
      for (let x = 4; x < tw; x += 9) {
        g.fillStyle = '#C9C4B8';
        g.fillRect(x, 1, 3, 1.6);
        g.fillRect(x, h - 2.6, 3, 1.6);
      }
    },
    aniso,
  );
}

/** Every state of beat 4's tape at its three ink stages, as paper (made once per world). */
function useRowTapes(): { full: MeshStandardMaterial; stepped: MeshStandardMaterial }[][] {
  const gl = useThree((st) => st.gl);
  const mats = useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return TAPE_ROWS.map((row, i) => {
      const fresh = i > 0 && TAPE_ROWS[i - 1].cells.length === row.cells.length ? 'thread' : 'cell';
      return [0, 1, 2].map((stage) => {
        const t = rowTexture(row.cells, fresh, stage, aniso);
        // one print, two materials: as it is, and in the stepped set (the deck steps down under a counterfactual)
        return { full: paper(t, HEX.paper), stepped: paper(t, HEX.paper, { stepped: true }) };
      });
    });
  }, [gl]);
  useLayoutEffect(
    () => () => {
      for (const m of mats.flat()) {
        m.full.map?.dispose();
        m.full.dispose();
        m.stepped.dispose();
      }
    },
    [mats],
  );
  return mats;
}

/**
 * The reel's top while the request's stub inks onto it with its row (beat4.ts stubAt): the bare top (gl/text.ts
 * `reelTopBare`) with the vermilion stub at its first two ink stages; printed, the top is gl/text.ts `reelTop`.
 */
function useStubTops(): MeshStandardMaterial[] {
  const { textures } = useDeskSets();
  const mats = useMemo(() => {
    const bare = textures.reelTopBare.image as HTMLCanvasElement;
    const R = REEL.packR;
    return [0, 1].map((stage) => {
      const { c, g } = textCanvas(bare.width, bare.height);
      g.drawImage(bare, 0, 0);
      g.scale(bare.width / (2 * R), bare.height / (2 * R));
      stagedInk(g, 2 * R, 2 * R, bare.width / (2 * R), stage, (ig) => {
        ig.strokeStyle = HEX.vermilion;
        ig.lineWidth = 3.2;
        ig.beginPath();
        ig.arc(R, R, R - 6, -0.55, -0.35);
        ig.stroke();
      });
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = textures.reelTopBare.anisotropy;
      return paper(t, '#FFFFFF');
    });
  }, [textures]);
  useLayoutEffect(
    () => () => {
      for (const m of mats) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [mats],
  );
  return mats;
}

/** The newest cell's step along the tape, in the tape texture's u (gl/text.ts NEWEST_STEP). */
const NEWEST_STEP_U = NEWEST_STEP / (TAPE_FLAT_X1 - TAPE.x0);
/** One older cell's step along the tape, in the tape texture's u. */
const CELL_STEP_U = (CELLS_X[1][1] - CELLS_X[1][0] + 4) / (TAPE_FLAT_X1 - TAPE.x0);
/** One stub's step along the tape in still (c). */
const STUB_STEP_U = (CACHE_WINDOW.stub + CACHE_WINDOW.bar) / (TAPE_FLAT_X1 - TAPE.x0);
/** Beat 6's rewind: how far the bare tape runs back (the Thread's row's run out from under the reel), in the tape texture's u. */
const REWIND_U = (THREAD_ROW.from - THREAD_ROW.x0) / (TAPE_FLAT_X1 - TAPE.x0);
/** The hammer's offset inside the dipping head, lifted back by the head's dip, so its stroke onto the tape is the same. */
const withDip = (o: readonly [number, number, number], dz: number): [number, number, number] => [o[0], o[1], o[2] + dz];
/** The holder's hinge along the south rail's lower edge (y, z) and how far it folds down to hang against the rail's face (radians). */
const HOPPER_HINGE = [DECK.y0, MOUTH.z[0]] as const;
const HOPPER_FOLD = 1.42;

/**
 * MT1's printed tape as the close's print swap fades it off over the window's cards (beat 6, from the bar-34 dolly: state.ts
 * CacheState.fade): the same print, transparent, as it is and in the stepped set.
 */
function useTapeFade(): { full: MeshStandardMaterial; stepped: MeshStandardMaterial } {
  const { textures } = useDeskSets();
  const mats = useMemo(() => {
    const make = (stepped: boolean) => {
      const m = paper(textures.tape2, HEX.paper, { stepped });
      m.transparent = true;
      m.depthWrite = false;
      return m;
    };
    return { full: make(false), stepped: make(true) };
  }, [textures]);
  useLayoutEffect(
    () => () => {
      mats.full.dispose();
      mats.stepped.dispose();
    },
    [mats],
  );
  return mats;
}

/**
 * The loupe on its swing arm, turned `a` about its pivot (MT1: it scans the policy card). Its lens
 * shows the card under its centre, magnified 1.1x, wherever it is; at rest (a = 0) the parts are drawn
 * exactly as before.
 */
function LoupeSwing({ a, lens, children }: { a: number; lens: BufferGeometry; children: ReactNode }) {
  const rest = useMemo(() => Float32Array.from(lens.getAttribute('uv').array as ArrayLike<number>), [lens]);
  useLayoutEffect(() => {
    const uv = lens.getAttribute('uv');
    if (a === 0) (uv.array as Float32Array).set(rest);
    else {
      const pos = lens.getAttribute('position');
      const [cw, ch] = PRINT_SIZE.policy;
      const [cx, cy] = loupeAt(a);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      for (let i = 0; i < uv.count; i++) {
        const ox = pos.getX(i) - LOUPE.x;
        const oy = pos.getY(i) - LOUPE.y;
        const wx = ox * c - oy * sn;
        const wy = ox * sn + oy * c;
        uv.setXY(i, (cx - POLICY_CARD.box.x0) / cw + wx / (1.1 * cw), (cy - POLICY_CARD.box.y0) / ch + wy / (1.1 * ch));
      }
    }
    uv.needsUpdate = true;
  }, [a, lens, rest]);
  if (a === 0) return <>{children}</>;
  const [px, py] = LOUPE.pivot;
  return (
    <group position={[px, py, 0]} rotation={[0, 0, a]}>
      <group position={[-px, -py, 0]}>{children}</group>
    </group>
  );
}

/**
 * The Register's pose during the turn (desk/turn.ts): the deck rolling in and lifting on its legs (which the
 * turn draws, telescoping), the parts that dock on it, the tape's run and print, the jewel's light. The reel's
 * pack, hub and spokes are the turn's coil until the lock, so the Register leaves them out. Its log rides in with
 * it: the fanfold slides in on the slate under the deck, the filed tabs in its spill drawer, so the world the turn
 * hands to act two is the one act two draws.
 */
export interface RegisterTurn {
  deck: { dy: number; dz: number; tilt: readonly [number, number] };
  /**
   * The parts as they assemble, all riding in with the deck: the throat and its gauge raised from under the deck's
   * west end (z, 0 seated), the print head hinged up from lying flat (radians about its west edge), the index arm and
   * the loupe swung in (radians added to their angles), the ramp lowered like a drawbridge (radians), the Continuous
   * plate turned over on its long axis (radians: it rides in face down, its graphite back up)
   */
  parts: { throat: number; head: number; index: number; loupe: number; ramp: number; plate: number };
  /** the flat run laid (its rows as beat 4 prints them: beat4.ts tapeAt), or false while the turn lays the leader itself */
  tape: boolean;
  hammer: number;
  /** the pilot jewel's light (0 dark .. 1 lit) */
  jewel: number;
}

const DECK_C: P2 = [(DECK.x0 + DECK.x1) / 2, (DECK.y0 + DECK.y1) / 2];
/** Everything on the deck, posed by the turn (as it is without one). */
export function DeckPose({ pose, children }: { pose?: RegisterTurn['deck']; children: ReactNode }) {
  if (!pose) return <>{children}</>;
  return (
    <group position={[DECK_C[0], DECK_C[1] + pose.dy, pose.dz]} rotation={[pose.tilt[0], pose.tilt[1], 0]}>
      <group position={[-DECK_C[0], -DECK_C[1], 0]}>{children}</group>
    </group>
  );
}
/** A part raised or lowered into its seat (as it is without a height). */
function Lift({ z, children }: { z?: number; children: ReactNode }) {
  if (z === undefined) return <>{children}</>;
  return <group position={[0, 0, z]}>{children}</group>;
}
/** The Continuous plate turned over about its long axis (as it is without an angle). */
function Flip({ angle, children }: { angle?: number; children: ReactNode }) {
  if (angle === undefined) return <>{children}</>;
  const [cx, cy] = rectC(TRAIT_PLATE.box);
  const cz = (TRAIT_PLATE.z[0] + TRAIT_PLATE.z[1]) / 2 + 1;
  return (
    <group position={[cx, cy, cz]} rotation={[angle, 0, 0]}>
      <group position={[-cx, -cy, -cz]}>{children}</group>
    </group>
  );
}
/** A part turned about a hinge along y at (x, z) (as it is without an angle). */
export function Hinge({ angle, x, z, children }: { angle?: number; x: number; z: number; children: ReactNode }) {
  if (angle === undefined) return <>{children}</>;
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <group position={[-x, 0, -z]}>{children}</group>
    </group>
  );
}

/** The gauge's disc's mid-height (its body from the deck's top - 2 to + 3), and how high it is carried as it turns over (a coin turned onto its face, never through the collar). */
const GAUGE_MID = DECK.top + 0.5;
const GAUGE_LIFT = 30;
/** The gauge turned over about its east-west axis by `flip` (pi face down, 0 face up), lifted clear as it turns. */
function GaugeFlip({ flip, c, children }: { flip: number; c: P2; children: ReactNode }) {
  if (flip === 0) return <>{children}</>;
  return (
    <group position={[c[0], c[1], GAUGE_MID + GAUGE_LIFT * Math.sin(flip)]} rotation={[flip, 0, 0]}>
      <group position={[-c[0], -c[1], -GAUGE_MID]}>{children}</group>
    </group>
  );
}

/**
 * The pilot jewel's own emitter in act two: its light stepped with the deck by the step's amount (a set's emitters are
 * stepped whole, so handing the jewel from one set to the other would darken or light it in one frame).
 */
function useJewel(amount: number) {
  const { full } = useDeskSets();
  const mat = useMemo(() => full.jewel.clone(), [full]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  useLayoutEffect(() => {
    mat.color.copy(amount > 0 ? stepColour(full.jewel.color, amount) : full.jewel.color);
  }, [mat, full, amount]);
  return mat;
}

export function Register({ s, turn }: { s: DeskState; turn?: RegisterTurn }) {
  const m = useDeskMats();
  const g = useRegisterGeometry();
  const rows = useRowTapes();
  const stubs = useStubTops();
  const C = s.cache;
  const b4 = s.b4;
  const tapeFade = useTapeFade();
  const fadeOpacity = C ? 1 - C.fade : 1;
  useLayoutEffect(() => {
    tapeFade.full.opacity = fadeOpacity;
    tapeFade.stepped.opacity = fadeOpacity;
  }, [tapeFade, fadeOpacity]);
  useLayoutEffect(() => {
    // the tape advances one cell, driven by the reel's detent: the old print slides east, fresh tape comes out of the head
    // (beat 4's rows: each state moves on with its next stamp-in's detent, the last with MT1's first, f2183)
    rows.forEach((stages, i) => {
      for (const st of stages) if (st.full.map) st.full.map.offset.x = i === b4.tape.row ? -CELL_STEP_U * (b4.tape.advance + s.tape) : 0;
    });
    // MT1's second stamp-in drives the stamped tape on one more cell; in still (c) the bare tape moves one stub with the reel
    const stamped = m.printed.tape.map;
    // (MT1's second stamp-in moves it on by the newest cell's width, so #0408's print clears that cell whole)
    if (stamped) stamped.offset.x = -NEWEST_STEP_U * s.next.tape;
    const bare = m.printed.tapeBlank.map;
    // beat 6's rewind runs the bare tape back the way the request's Thread's row comes out from under the reel
    if (bare) bare.offset.x = -STUB_STEP_U * (C?.tape ?? 0) + REWIND_U * s.e6.rewind;
  }, [m, rows, b4.tape.row, b4.tape.advance, s.tape, s.next.tape, C?.tape, s.e6.rewind]);
  const T = turn;
  // each stamp-in inks its cell over 3 f (the ink's stages), the frame after the head comes down
  const inkStage = (ink: number) => (ink <= 0 ? -1 : Math.min(2, Math.ceil(ink * 3 - 1e-6) - 1));
  const stamped = (after: number, ink: number, before: Material, stages: Material[], full: Material) => (inkStage(ink) < 0 ? before : inkStage(ink) < 2 ? stages[inkStage(ink)] : full);
  // beat 4's rows as stamped since the turn (the bare leader before the first)
  // the deck's body, the window, the tape: stepped down together while a counterfactual is up (state.ts FOCUS_BEATS 'deck')
  const deckOn = isStepped(s.step, 'deck');
  const jewel = useJewel(deckOn === 'own' ? (s.step.own?.amount ?? 0) : deckOn ? s.step.amount : 0);
  const rowSet = deckOn ? 'stepped' : 'full';
  const rowMat = (d: DeskMats) => (b4.tape.row < 0 ? d.printed.tapeBlank : rows[b4.tape.row][b4.tape.stage][rowSet]);
  const lastRow = rows[rows.length - 1][2][rowSet];
  // the stamp-ins are contact frames: from its cue on, the newest print shows its first ink (beat4.ts inkSpread)
  const tapeMat = T
    ? T.tape
      ? rowMat
      : null
    : C
      ? (d: DeskMats) => d.printed.tapeBlank
      : s.f >= EVENTS_D.stampIn
        ? (d: DeskMats) => stamped(EVENTS_D.stampIn, s.next.ink, d.printed.tape, d.printed.tape2Ink, d.printed.tape2)
        : s.f >= EVENTS_B.stampIn
          ? (d: DeskMats) => stamped(EVENTS_B.stampIn, s.ink, lastRow, d.printed.tapeInk, d.printed.tape)
          : rowMat;
  // the reel: beat 4's detents bring it from where the coil locked to its rest (0) by MT1, then MT1's and the cache's detents
  const reelTurn = s.reel + s.next.reel + (C?.reel ?? 0);
  // beat 6.4: the reel rewinds over 24 f (it spins back half a turn, beat6.ts REWIND_TURN)
  const reelAngle = b4.reel - 0.26 * reelTurn + REWIND_TURN * s.e6.rewind;
  const hammer = T ? T.hammer : Math.max(s.stamp, s.next.stamp, C?.stamp ?? 0, s.e6.hammer);
  // the head presses down with its hammer for the cache's record and the review's row (still (c)'s critic item 4: a dip
  // you see, its footprint going with it), the hammer's own stroke onto the tape unchanged by it
  const headDip = T ? 0 : headDipAt(s);
  return (
    <group>
      {/* the gantry */}
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              {!T && <mesh geometry={g.legs} material={d.graphite} />}
              {!T && <mesh geometry={g.feet} material={d.graphiteDark} />}
            </>
          )}
        </WithMats>
      </Step>
      <DeckPose pose={T?.deck}>
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              <mesh geometry={g.rails} material={d.graphite} />
              <mesh geometry={g.cross} material={d.graphiteDark} />
              <mesh geometry={g.plate} material={d.graphiteDeck} />
              <mesh geometry={g.gussets} material={d.enamelShade} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the reel: it detents one step as a report stamps in (stepped down in C12: its face is not the action) */}
      <Step on={isStepped(s.step, 'reel')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.flange} material={n.graphiteDark} />
              {!T && <mesh geometry={g.pack} material={n.paperShade} />}
              {!T && <group position={[REEL.x, REEL.y, 0]} rotation={[0, 0, reelAngle]}>
                <group position={[-REEL.x, -REEL.y, 0]}>
                  {/* its top: bare until the request's stub inks onto it with its row (beat4.ts stubAt) */}
                  <mesh geometry={g.packTop} material={b4.stub < 0 ? n.printed.reelTopBare : b4.stub < 2 ? stubs[b4.stub] : n.printed.reelTop} />
                  <mesh geometry={g.hub} material={n.enamel} />
                  <mesh geometry={g.hubSlot} material={n.graphiteDark} />
                  <mesh geometry={g.spokes} material={n.enamel} />
                </group>
              </group>}
            </>
          )}
        </WithMats>
      </Step>
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              <mesh geometry={g.frameMembers} material={d.graphite} />
              <mesh geometry={g.frameCaps} material={d.enamelShade} />
              {/* the tape, the window and its lamp; from the close the window's cards replace the printed tape by an 8 f print swap (objects/Cache.tsx): the print fades off over them */}
              {tapeMat && <mesh geometry={g.tapeFlat} material={tapeMat(d)} />}
              {!T && C && C.fade < 1 && <mesh geometry={g.tapeFlat} material={tapeFade[deckOn ? 'stepped' : 'full']} position={[0, 0, 0.45]} />}
              {tapeMat && <mesh geometry={g.tapeRise} material={d.paper} />}
              <mesh geometry={g.win} material={d.graphite} />
              {/* the window's bars; in still (c) they slide with the shrinking cards (objects/Cache.tsx) */}
              {!C && <mesh geometry={g.bars} material={d.enamelShade} />}
              {!C && <mesh geometry={g.bar1} material={d.enamelShade} position={[(CELLS_X[2][1] - CELLS_X[1][1]) * s.next.tape, 0, 0]} />}
              <mesh geometry={g.hood} material={d.enamel} />
              <mesh geometry={g.hoodLining} material={d.paperLit} />
              <mesh geometry={g.hoodCaps} material={d.enamelShade} />
              <mesh geometry={g.lampArms} material={d.graphite} />
              <mesh geometry={g.lampFeet} material={d.graphiteDark} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the reel frame's enamel bosses: with the deck, and in still (c) stepped under the lit record (state.ts CACHE_STEP) */}
      <Step on={deckOn || isStepped(s.step, 'bosses')}>
        <WithMats>{(d) => <mesh geometry={g.bosses} material={d.enamel} />}</WithMats>
      </Step>
      {/* the throat, the print head */}
      <Hinge angle={T?.parts.head} x={PRINT_HEAD.box.x0} z={DECK.top}>
      <group position={[0, 0, -HEAD_DIP * headDip]}>
      <Step on={isStepped(s.step, 'head')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.head} material={n.graphite} />
              <mesh geometry={g.headCap} material={n.enamel} />
              {/* the hammer: raised clear of the tape at rest, it rocks east and comes down onto the newest cell */}
              <mesh geometry={g.headHammer} material={n.steel} position={T ? [0, 0, -9 * hammer] : withDip(hammerOffset(hammer), HEAD_DIP * headDip)} />
            </>
          )}
        </WithMats>
      </Step>
      </group>
      </Hinge>
      <Lift z={T?.parts.throat}>
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              <mesh geometry={g.throat} material={d.graphiteDark} />
              <mesh geometry={g.collar} material={d.steel} />
            </>
          )}
        </WithMats>
      </Step>
      <Step on={deckOn || isStepped(s.step, 'jaws')}>
        <WithMats>{(d) => <mesh geometry={g.cheeks} material={d.enamel} />}</WithMats>
      </Step>
      </Lift>
      <Lift z={T?.parts.throat}>
      <Step on={isStepped(s.step, 'gauge')}>
        <WithMats>
          {(n) => (
            <>
              {/* face down (its graphite back up) until it turns face up onto the collar on its cue, its needle low (beat4.ts gaugeFlipAt) */}
              <GaugeFlip flip={b4.gauge.flip} c={g.gauge}>
                <mesh geometry={g.gaugeBody} material={n.graphite} />
                <mesh geometry={g.gaugeFace} material={n.printed.gauge} />
                <mesh geometry={g.needle} material={n.rubber} position={[g.gauge[0], g.gauge[1], 0]} rotation={[0, 0, b4.gauge.needle + s.e6.needle]} />
                <mesh geometry={g.gaugeHub} material={n.steel} />
              </GaugeFlip>
            </>
          )}
        </WithMats>
      </Step>
      </Lift>
      {/* the Slow Path: the loupe over the pinned policy card (stepped down in C12) */}
      <Step on={isStepped(s.step, 'policy')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.policyBase} material={n.graphiteDark} />
              <mesh geometry={g.policyCard} material={n.printed.policy} />
              <mesh geometry={g.pin} material={n.enamel} />
              <LoupeSwing a={T ? s.next.loupe + T.parts.loupe : s.next.loupe + s.e5.loupe} lens={g.lens}>
                <mesh geometry={g.loupeRing} material={n.steel} />
                <mesh geometry={g.lens} material={n.printed.lens} />
                <mesh geometry={g.loupeArm} material={n.graphite} />
              </LoupeSwing>
            </>
          )}
        </WithMats>
      </Step>
      {/* the index arm on its detent plate */}
      <Step on={isStepped(s.step, 'index')}>
        <WithMats>
          {(n) => (
            <>
              <mesh geometry={g.plateGeo} material={n.enamelShade} />
              <group position={[INDEX.pivot[0], INDEX.pivot[1], 0]} rotation={[0, 0, T ? s.arm + T.parts.index : s.arm]}>
                <mesh geometry={g.arm} material={n.graphite} />
                <mesh geometry={g.armTip} material={n.enamel} />
              </group>
              <mesh geometry={g.boss} material={n.enamel} />
            </>
          )}
        </WithMats>
      </Step>
      {/* the spill drawer (in still (c) it pulls open to take the request's tab) with its filed pointer tabs, the mouth */}
      <group position={[0, -DRAWER_OPEN_C * (C?.drawer ?? 0), 0]}>
        <Step on={deckOn}>
          <WithMats>
            {(d) => (
              <>
                <mesh geometry={g.drawerBox} material={d.graphiteDark} />
                <mesh geometry={g.drawerFront} material={d.enamel} />
                <mesh geometry={g.drawerHandle} material={d.steel} />
                <FiledTabs file={C && !C.summary ? C.file : 0} />
              </>
            )}
          </WithMats>
        </Step>
      </group>
      <Step on={isStepped(s.step, 'mouth')}>
        <WithMats>
          {(n) => (
            // folding down to hang against the rail's face (on spring-heavy), out of the record's way
            <group position={[0, HOPPER_HINGE[0], HOPPER_HINGE[1]]} rotation={[HOPPER_FOLD * (C?.hopper ?? 0), 0, 0]}>
              <mesh geometry={g.hopper} material={n.enamelShade} position={[0, -HOPPER_HINGE[0], -HOPPER_HINGE[1]]} />
            </group>
          )}
        </WithMats>
      </Step>
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
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              <mesh geometry={g.jewel} material={T ? (T.jewel < 0.5 ? d.graphiteDark : d.jewel) : jewel} />
              <mesh geometry={g.bezel} material={d.steel} />
              {/* the Continuous plate behind the reel, on its brackets */}
              <mesh geometry={g.traitBrackets} material={d.graphite} />
            </>
          )}
        </WithMats>
      </Step>
      <Flip angle={T?.parts.plate}>
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
      </Flip>
      {/* the dispatch housing the request and the folders are pushed out of, behind the ramp's face */}
      <Step on={deckOn}>
        <WithMats>
          {(d) => (
            <>
              <mesh geometry={g.housing} material={d.graphiteDark} />
              <mesh geometry={g.housingRim} material={d.steel} />
              {/* the dispatch ramp */}
              <Hinge angle={T?.parts.ramp} x={RAMP.x} z={RAMP.top}>
                <mesh geometry={g.rampSheet} material={d.enamelShade} />
                <mesh geometry={g.rampCheeks} material={d.steel} />
              </Hinge>
            </>
          )}
        </WithMats>
      </Step>
      </DeckPose>
      {/* the fanfold on the slate under the deck: in the turn it slides in under the collapsed deck as it rolls in */}
      <group position={[0, T?.deck.dy ?? 0, 0]}>
        <Step on={isStepped(s.step, 'fanfold')}>
          <WithMats>
            {(n) => (
              <>
                <mesh geometry={g.fanfoldBody} material={n.paperShade} />
                <mesh geometry={g.fanfoldTop} material={n.printed.fanfold} />
                {closeAt(s.f) > 0 && <mesh geometry={g.fanfoldTop} material={n.printed.fanfoldFine} position={[0, 0, 0.06]} />}
                <mesh geometry={g.fanfoldSide} material={n.printed.fanfoldSide} />
              </>
            )}
          </WithMats>
        </Step>
      </group>
    </group>
  );
}
