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
import { useDeskMats } from '../kit.tsx';
import { CELLS_X, CROSS, DECK, DECK_PLATE, DRAWER, FANFOLD, GAUGE, HOPPER, INDEX, JEWEL, LEG, LEGS, LOCK, LOUPE, POLICY_CARD, PRINT_HEAD, RAMP, READ_LAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SHEET, TAPE, TAPE_FLAT_X1, THROAT, TRAIT_PLATE, WINDOW, rectC, type P2, type Rect } from '../layout.ts';
import { PRINT_SIZE } from '../gl/text.ts';
import { DETENT, type DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/** The quarter-pipe's profile in (y, z): the lip down from the rail, then the curve to the desk. */
function rampProfile(): P2[] {
  const pts: P2[] = [];
  const r = RAMP.lip;
  const yc = RAMP.foot;
  // outer (top) surface, from the foot up to the rail, then back down the underside (a 4 u sheet)
  for (let i = 0; i <= 16; i++) {
    const a = (Math.PI / 2) * (i / 16);
    pts.push([yc + r * Math.sin(a), r - r * Math.cos(a)]);
  }
  pts.push([DECK.y0, RAMP.top]);
  const under: P2[] = [];
  for (let i = 16; i >= 0; i--) {
    const a = (Math.PI / 2) * (i / 16);
    under.push([yc + (r + 4) * Math.sin(a), r - (r + 4) * Math.cos(a)]);
  }
  return [...pts, [DECK.y0 + 4, RAMP.top], ...under];
}

/** A shape in the (y, z) plane extruded along x from x0 by `w`. */
function extrudeYZ(shape: Shape, x0: number, w: number, bevel = 1): BufferGeometry {
  const g = extrude(shape, 0, w, bevel);
  // (sx, sy, ez) → (x0 + ez, sx, sy)
  g.applyMatrix4(new Matrix4().set(0, 0, 1, x0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  return g;
}

/** The ramp's two cheeks: the quarter-circle region between the curve and the deck's south face. */
function rampCheek(x0: number): BufferGeometry {
  const s = new Shape();
  const r = RAMP.lip;
  const yc = RAMP.foot;
  s.moveTo(yc, 0);
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI / 2) * (i / 12);
    s.lineTo(yc + r * Math.sin(a) - 0.5, r - r * Math.cos(a) + 3);
  }
  s.lineTo(DECK.y0 + 2, RAMP.top + 4);
  s.lineTo(DECK.y0 + 2, 0);
  s.closePath();
  return extrudeYZ(s, x0, 6, 1);
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
    const legRect = ([x, y]: P2): Rect => ({ x0: x - LEG / 2, x1: x + LEG / 2, y0: y - LEG / 2, y1: y + LEG / 2 });
    const legs = merge(LEGS.map((p) => slab(legRect(p), 0, DECK.railZ0, 3, 2)));
    const feet = merge(LEGS.map(([x, y]) => disc(13, 0, 3.5, { cx: x, cy: y, bevel: 1.2 })));
    const rails = frame({ x0: DECK.x0, x1: DECK.x1, y0: DECK.y0, y1: DECK.y1 }, DECK.rail, DECK.railZ0, top, 6, 3.2);
    const cross = merge(CROSS.map((c) => slab(c, DECK.railZ0 + 2, top, 2, 1.5)));
    const plate = slab(DECK_PLATE, top - 6, top, 2, 1);
    // gussets where the legs meet the rails: small enamel plates on the rail tops at the corners
    const gussets = merge(LEGS.map(([x, y]) => slab(legRect([x, y]), top, top + 2.5, 3, 0.8)));

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
    // the reading lamp: a bar hood on two bent arms
    const hoodLen = READ_LAMP.x1 - READ_LAMP.x0;
    const hood = (() => {
      const s = new Shape();
      // a half-round hood opening to the south and down (profile in y, z about its axis)
      s.absarc(0, 0, READ_LAMP.r, -0.6, 2.4, false);
      s.absarc(0, 0, READ_LAMP.r - 3, 2.4, -0.6, true);
      s.closePath();
      const g = extrudeYZ(s, READ_LAMP.x0, hoodLen, 0.8);
      g.translate(0, READ_LAMP.y, READ_LAMP.z);
      return g;
    })();
    const hoodCaps = merge(
      [READ_LAMP.x0 - 3, READ_LAMP.x1].map((x) => {
        const s = new Shape();
        s.absarc(0, 0, READ_LAMP.r + 1, 0, Math.PI * 2, false);
        const g = extrudeYZ(s, x, 3, 0.6);
        g.translate(0, READ_LAMP.y, READ_LAMP.z);
        return g;
      }),
    );
    const lampArms = merge(
      READ_LAMP.posts.map((x) =>
        tube(
          [
            [x, READ_LAMP.postY, top],
            [x, READ_LAMP.postY + 2, top + 30],
            [x, READ_LAMP.postY + 10, READ_LAMP.z + 12],
            [x, READ_LAMP.y, READ_LAMP.z + READ_LAMP.r - 2],
          ],
          3.2,
          24,
          8,
        ),
      ),
    );
    const lampFeet = merge(READ_LAMP.posts.map((x) => disc(8, top, top + 3, { cx: x, cy: READ_LAMP.postY, bevel: 0.8 })));

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
    const gaugeBody = disc(GAUGE.r + 3, GAUGE.z - 4, GAUGE.z, { cx: GAUGE.x, cy: GAUGE.y, bevel: 1 });
    const gaugeFace = plane(2 * GAUGE.r, 2 * GAUGE.r, GAUGE.x, GAUGE.y, GAUGE.z + 0.2);
    // the needle sits low: near the start of its arc
    const needle = (() => {
      const s = new Shape();
      s.moveTo(0, -1.2);
      s.lineTo(GAUGE.r - 3, 0);
      s.lineTo(0, 1.2);
      s.closePath();
      const g = extrude(s, GAUGE.z + 0.4, GAUGE.z + 1.4, 0);
      g.rotateZ(Math.PI * 0.86);
      g.translate(GAUGE.x, GAUGE.y, 0);
      return g;
    })();
    const gaugeHub = dome(2.4, GAUGE.x, GAUGE.y, GAUGE.z + 1.2);

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
          [LOUPE.pivot[0], LOUPE.pivot[1], LOUPE.z - 4],
          [LOUPE.pivot[0] + 8, LOUPE.pivot[1] - 30, LOUPE.z + 2],
          [LOUPE.x + 6, LOUPE.y + LOUPE.r + 2, LOUPE.z],
        ],
        2.6,
        24,
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

    // the hopper for report cards
    const hopper = merge([slab(HOPPER.box, HOPPER.z[0], HOPPER.z[0] + 3, 4, 1), frame(HOPPER.box, 5, HOPPER.z[0], HOPPER.z[1], 4, 1)]);

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

    // the Continuous plate: enamel on a graphite backing, bolted at its corners
    const T = TRAIT_PLATE.box;
    const traitBack = slab(T, TRAIT_PLATE.z[0], TRAIT_PLATE.z[0] + 2, 6, 0.8);
    const trait = slab(inset(T, 3), TRAIT_PLATE.z[0] + 2, TRAIT_PLATE.z[1], 5, 1.2);
    const traitFace = planeOn(inset(T, 5), TRAIT_PLATE.z[1] + 0.2);
    const bolts = merge(
      [
        [T.x0 + 9, T.y0 + 9],
        [T.x1 - 9, T.y0 + 9],
        [T.x0 + 9, T.y1 - 9],
        [T.x1 - 9, T.y1 - 9],
      ].map(([x, y]) => dome(3, x, y, TRAIT_PLATE.z[1])),
    );

    // the dispatch ramp and its cheeks
    const rampSheet = (() => {
      const s = new Shape();
      const prof = rampProfile();
      s.moveTo(prof[0][0], prof[0][1]);
      for (const [y, z] of prof.slice(1)) s.lineTo(y, z);
      s.closePath();
      return extrudeYZ(s, RAMP.x0 + 6, RAMP.x1 - RAMP.x0 - 12, 0.6);
    })();
    const rampCheeks = merge([rampCheek(RAMP.x0), rampCheek(RAMP.x1 - 6)]);

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
      hoodCaps,
      lampArms,
      lampFeet,
      head,
      headCap,
      headHammer,
      throat,
      cheeks,
      collar,
      gaugeBody,
      gaugeFace,
      needle,
      gaugeHub,
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
      {/* the reel */}
      <mesh geometry={g.flange} material={m.graphiteDark} />
      <mesh geometry={g.pack} material={m.paperShade} />
      <mesh geometry={g.packTop} material={m.printed.reelTop} />
      <mesh geometry={g.hub} material={m.enamel} />
      <mesh geometry={g.hubSlot} material={m.graphiteDark} />
      <mesh geometry={g.spokes} material={m.enamel} />
      <mesh geometry={g.frameMembers} material={m.graphite} />
      <mesh geometry={g.frameCaps} material={m.enamelShade} />
      <mesh geometry={g.bosses} material={m.enamel} />
      {/* the tape, the window and its lamp */}
      <mesh geometry={g.tapeFlat} material={m.printed.tape} />
      <mesh geometry={g.tapeRise} material={m.paper} />
      <mesh geometry={g.win} material={m.graphite} />
      <mesh geometry={g.bars} material={m.enamelShade} />
      <mesh geometry={g.hood} material={m.enamelShade} />
      <mesh geometry={g.hoodCaps} material={m.enamelShade} />
      <mesh geometry={g.lampArms} material={m.graphite} />
      <mesh geometry={g.lampFeet} material={m.graphiteDark} />
      {/* the throat, the print head, the gauge */}
      <mesh geometry={g.head} material={m.graphite} />
      <mesh geometry={g.headCap} material={m.enamel} />
      <mesh geometry={g.headHammer} material={m.steel} />
      <mesh geometry={g.throat} material={m.graphiteDark} />
      <mesh geometry={g.cheeks} material={m.enamel} />
      <mesh geometry={g.collar} material={m.steel} />
      <mesh geometry={g.gaugeBody} material={m.graphite} />
      <mesh geometry={g.gaugeFace} material={m.printed.gauge} />
      <mesh geometry={g.needle} material={m.rubber} />
      <mesh geometry={g.gaugeHub} material={m.graphite} />
      {/* the Slow Path: the loupe over the pinned policy card */}
      <mesh geometry={g.policyBase} material={m.graphiteDark} />
      <mesh geometry={g.policyCard} material={m.printed.policy} />
      <mesh geometry={g.pin} material={m.enamel} />
      <mesh geometry={g.loupeRing} material={m.steel} />
      <mesh geometry={g.lens} material={m.printed.lens} />
      <mesh geometry={g.loupeArm} material={m.graphite} />
      {/* the index arm on its detent plate */}
      <mesh geometry={g.plateGeo} material={m.enamelShade} />
      <group position={[INDEX.pivot[0], INDEX.pivot[1], 0]} rotation={[0, 0, s.arm]}>
        <mesh geometry={g.arm} material={m.graphite} />
        <mesh geometry={g.armTip} material={m.enamel} />
      </group>
      <mesh geometry={g.boss} material={m.enamel} />
      {/* the spill drawer, the hopper */}
      <mesh geometry={g.drawerBox} material={m.graphiteDark} />
      <mesh geometry={g.drawerFront} material={m.enamel} />
      <mesh geometry={g.drawerHandle} material={m.steel} />
      <mesh geometry={g.tabs} material={m.paper} />
      <mesh geometry={g.hopper} material={m.enamelShade} />
      {/* the sealed shell key */}
      <mesh geometry={g.lockBlock} material={m.graphite} />
      <mesh geometry={g.lockPlate} material={m.enamel} />
      <mesh geometry={g.lockFace} material={m.printed.lockFace} />
      <mesh geometry={g.keyMetal} material={m.steel} />
      <mesh geometry={g.seal} material={m.enamelShade} />
      {/* the pilot jewel */}
      <mesh geometry={g.jewel} material={m.jewel} />
      <mesh geometry={g.bezel} material={m.steel} />
      {/* the fanfold under the deck */}
      <mesh geometry={g.fanfoldBody} material={m.paperShade} />
      <mesh geometry={g.fanfoldTop} material={m.printed.fanfold} />
      <mesh geometry={g.fanfoldSide} material={m.printed.fanfoldSide} />
      {/* the Continuous plate */}
      <mesh geometry={g.traitBack} material={m.graphiteDark} />
      <mesh geometry={g.trait} material={m.enamel} />
      <mesh geometry={g.traitFace} material={m.printed.trait} />
      <mesh geometry={g.bolts} material={m.steel} />
      {/* the dispatch ramp */}
      <mesh geometry={g.rampSheet} material={m.graphite} />
      <mesh geometry={g.rampCheeks} material={m.enamelShade} />
    </group>
  );
}
