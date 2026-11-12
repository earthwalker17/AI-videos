import { describe, expect, it } from 'vitest';
import { CELLS, NAMEPLATE, PRINT_STRINGS, REPLY, REPORT, REPORT_C } from '../print.ts';
import { CAMERA_EASE, CAMERA_MOVES, D1, EASE_OUT_D, FRAMING_B, FRAMING_BOOKEND, FRAMING_C, FRAMING_D, FRAMING_HOOK, FRAMING_SHEET, TO_BOOKEND, TO_REGISTER, TO_SHEET, TO_VELLUM, cameraAt, deskCamera, moveFraming, project, projectBox } from './camera.ts';
import { poseD, summaryDeskState } from './summary.ts';
import { SEAM_D } from './film.ts';
import { footprintsAt, KIND, MAX_FOOTPRINTS, cullRadius, packFootprints, staticFootprints, type Footprint } from './footprints.ts';
import { neutral, preToe } from './gl/post.ts';
import { BAYS, BENCH, CARD, CELLS_X, CORDS, DECK, DISPATCH, FRESH, HATCH_DEPTH, KEY, PINS, REEL, SHADOW_DIR, SHADOW_K, SLIP, TAPE, TOWER, WINDOW, penumbra, PENUMBRA_K, shadowOffset, towerTop, type BayId, type P3 } from './layout.ts';
import { MAX_POOLS, linearOf, packPools, poolsAt } from './pools.ts';
import { ROUND2, MOTION_TESTS } from '../lookdev/frames.ts';
import { BEAT_6, BEAT_7, BEAT_9, MT1, at } from '../cues.ts';
import { youPoseAt } from './actOne.ts';
import { CAP_SLOT, CARD_STAND, CORD_FROM, IN_TRAY_REST, LAMP_AIM, LAMP_DIMS, LAMP_PART1, SPRING, springAt, REPLY_ARC, REPLY_PATH, SLIP_LIP, STEP_FRAMES, armAt, armOf, cardArc, cardRise, closeAt, deskStateAt, DETENT, EVENTS_B, EVENTS_C, EVENTS_D, focusAt, focusEntries, focusOf, lampAt, LAMP_STEPS, replyRideAt, SLIP_LANDS, SLIP_RIDE_FROM, replyPose, stepAt, stepOf, type ArmStep, type DeskState, type FocusEntry, type FocusId } from './state.ts';

const B = deskStateAt(ROUND2.stillB);

/** OKLCH chroma of a linear sRGB colour (Björn Ottosson's OKLab matrices). */
function oklchChroma([r, g, b]: [number, number, number]): number {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(A, B2);
}

describe('desk camera', () => {
  it('puts one world unit on one pixel of the desk at zoom 1 (fov 20)', () => {
    expect(D1).toBeCloseTo(540 / Math.tan((10 * Math.PI) / 180), 6);
    const plan = deskCamera({ x: 0, y: 0, zoom: 1 }, 0);
    const [x0, y0] = project(plan, [0, 0, 0]);
    const [x1, y1] = project(plan, [100, 100, 0]);
    expect(x0).toBeCloseTo(960, 6);
    expect(y0).toBeCloseTo(540, 6);
    expect(x1 - x0).toBeCloseTo(100, 4);
    // north is up on screen
    expect(y1 - y0).toBeCloseTo(-100, 4);
  });
  it('scales by the framing zoom and keeps the aim point centred at either pitch', () => {
    for (const angle of [0, 15] as const) {
      const pose = deskCamera(FRAMING_B, angle);
      const [x, y] = project(pose, [FRAMING_B.x, FRAMING_B.y, 0]);
      expect(x).toBeCloseTo(960, 6);
      expect(y).toBeCloseTo(540, 6);
      const [xr] = project(pose, [FRAMING_B.x + 100, FRAMING_B.y, 0]);
      expect(xr - 960).toBeCloseTo(85, 3);
    }
  });
  it('at 15° raises what is high and shows north foreshortened', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const [, yLow] = project(pose, [FRAMING_B.x, FRAMING_B.y + 200, 0]);
    const [, yHigh] = project(pose, [FRAMING_B.x, FRAMING_B.y + 200, 120]);
    expect(yLow - yHigh).toBeGreaterThan(20);
    expect(540 - yLow).toBeLessThan(0.85 * 200);
    expect(540 - yLow).toBeGreaterThan(0.85 * 200 * 0.9);
  });
  it('keeps the frame (b) diagram inside the band y 72..868 and the deck where the spec draws it', () => {
    for (const angle of [0, 15] as const) {
      const pose = deskCamera(FRAMING_B, angle);
      const deck = projectBox(pose, [
        [DECK.x0, DECK.y0, 0],
        [DECK.x1, DECK.y1, DECK.top],
      ]);
      expect(deck.x0).toBeGreaterThan(700);
      expect(deck.x1).toBeLessThan(1500);
      expect(deck.y0).toBeGreaterThan(72);
      for (const b of Object.values(BAYS)) {
        const box = projectBox(pose, [
          [b.box.x0, b.box.y0, 0],
          [b.box.x1, b.box.y1, b.wallH],
        ]);
        expect(box.y1).toBeLessThan(868);
        expect(box.y0).toBeGreaterThan(deck.y0);
      }
      for (const p of CORDS.vermilion) expect(project(pose, p)[1]).toBeGreaterThan(72);
      // the docs nameplate stays inside title-safe
      expect(projectBox(pose, [[BAYS.docs.box.x1, BAYS.docs.box.y0, BAYS.docs.wallH]]).x1).toBeLessThan(1824);
    }
  });
  it('runs every move from the turn on between held framings: each starts where the one before it landed, on a downbeat, and lands exactly', () => {
    for (let i = 0; i < CAMERA_MOVES.length; i++) {
      const m = CAMERA_MOVES[i]!;
      if (i > 0) {
        expect(m.a, `move ${i}`).toEqual(CAMERA_MOVES[i - 1]!.b);
        expect(m.from, `move ${i}`).toBeGreaterThanOrEqual(CAMERA_MOVES[i - 1]!.to);
      }
      expect(m.from % 80, `move ${i} on a downbeat`).toBe(0);
      // held before it and after it: the static pose of each framing, exactly
      expect(cameraAt(m.from, 15)).toEqual(deskCamera(m.a, 15));
      expect(cameraAt(m.to, 15)).toEqual(deskCamera(m.b, 15));
      // and the path meets the hold at its end (no last-frame step)
      const end = moveFraming(m, CAMERA_EASE(1));
      for (const k of ['x', 'y', 'zoom'] as const) expect(Math.abs(end[k] - m.b[k]), `move ${i} ${k}`).toBeLessThan(1e-9);
    }
    // part 2's moves, by name, on the cue sheet's downbeats; the summary poses through the same camera
    expect([TO_SHEET.from, TO_VELLUM.from, TO_REGISTER.from, EASE_OUT_D.from, TO_BOOKEND.from]).toEqual([at(50), at(58), at(65), at(69), at(76)]);
    expect([TO_SHEET.b, TO_VELLUM.b, TO_REGISTER.b, EASE_OUT_D.b, TO_BOOKEND.b]).toEqual([FRAMING_SHEET, FRAMING_D, FRAMING_B, FRAMING_D, FRAMING_BOOKEND]);
    expect(poseD(ROUND2.stillD, 15)).toEqual(cameraAt(ROUND2.stillD, 15));
  });
  /** A move's peak aim speed: the desk point under the frame's centre at f, through the camera at f + 1, its travel per frame at 30 fps. */
  const aimPeak = (m: (typeof CAMERA_MOVES)[number]): number => {
    let peak = 0;
    for (let f = m.from; f < m.to; f++) {
      const a = cameraAt(f, 15);
      const p0 = project(a, a.look);
      const p1 = project(cameraAt(f + 1, 15), a.look);
      peak = Math.max(peak, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 30);
    }
    return peak;
  };
  it('keeps the aim point under 700 px/s on screen through every move from the turn on (TREATMENT Camera)', () => {
    for (const m of CAMERA_MOVES) expect(aimPeak(m), `move ${m.from}-${m.to}`).toBeLessThanOrEqual(700);
  });
  it('lands bar 76’s move on the bookend, the hook’s framing 40 u east, under the cap with headroom', () => {
    expect(aimPeak(TO_BOOKEND)).toBeLessThanOrEqual(695);
    expect(TO_BOOKEND.b).toEqual({ ...FRAMING_HOOK, x: -560 });
  });
});

describe('desk layout', () => {
  it('casts shadows away from the key, 0.84 per unit of height, with a penumbra of 4 + 0.35 h', () => {
    expect(Math.hypot(...SHADOW_DIR)).toBeCloseTo(1, 9);
    expect(SHADOW_DIR[0]).toBeGreaterThan(0);
    expect(SHADOW_DIR[1]).toBeLessThan(0);
    expect(SHADOW_DIR[0] * KEY[0] + SHADOW_DIR[1] * KEY[1]).toBeLessThan(0);
    expect(Math.hypot(...shadowOffset(120))).toBeCloseTo(SHADOW_K * 120, 9);
    expect(penumbra(0)).toBe(4);
    expect(penumbra(100)).toBeCloseTo(4 + 100 * PENUMBRA_K, 9);
  });
  it('lays the five inline cells inside the window, over the tape, newest west by the print head', () => {
    expect(CELLS_X).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(CELLS_X[i][0]).toBeGreaterThan(WINDOW.frame.x0 + WINDOW.bar - 1);
      expect(CELLS_X[i][1]).toBeLessThan(WINDOW.frame.x1 - WINDOW.bar + 1);
      if (i > 0) expect(CELLS_X[i][0]).toBeGreaterThan(CELLS_X[i - 1][1]);
    }
    expect(TAPE.y0).toBeGreaterThan(WINDOW.frame.y0);
    expect(TAPE.y1).toBeLessThan(WINDOW.frame.y1);
    // the tape runs onto the reel's pack at its south side
    expect(REEL.y - REEL.packR).toBeGreaterThan(TAPE.y0);
    expect(REEL.y - REEL.packR).toBeLessThan(TAPE.y1);
  });
  it('keeps every bay clearly lower than the deck (at most 80 against 120) and under its shadow', () => {
    expect(towerTop() + TOWER.dome).toBeLessThanOrEqual(80);
    expect(BENCH.z[1] + PINS.h).toBeLessThanOrEqual(85);
    for (const b of Object.values(BAYS)) expect(b.wallH).toBeLessThanOrEqual(40);
    // the south rail's shadow on a 40 u wall top reaches past the tests and docs bays' north walls
    const reach = DECK.y0 + shadowOffset(DECK.top - 40)[1];
    expect(reach).toBeLessThan(BAYS.tests.box.y1);
    expect(reach).toBeLessThan(BAYS.docs.box.y1);
  });
  it('gives each bay its own ground: no two bays overlap, every bay is below the deck', () => {
    const ids = Object.keys(BAYS) as BayId[];
    for (const a of ids) {
      // tucked under the deck's south edge at most: the rail cuts across a north wall, never more
      expect(BAYS[a].box.y1).toBeLessThan(DECK.y0 + 30);
      expect(BAYS[a].box.y0).toBeLessThan(DECK.y0 - 150);
      for (const b of ids) {
        if (a >= b) continue;
        const A = BAYS[a].box;
        const C = BAYS[b].box;
        const overlap = A.x0 < C.x1 && C.x0 < A.x1 && A.y0 < C.y1 && C.y0 < A.y1;
        expect(overlap).toBe(false);
      }
      const d = BAYS[a].door;
      expect(d[0]).toBeGreaterThan(BAYS[a].box.x0);
      expect(d[1]).toBeLessThan(BAYS[a].box.x1);
    }
  });
});

describe('desk footprints', () => {
  it('fits the shaders at every frame of the lookdev span', () => {
    for (const f of [2100, 2190, 2200, 2210, 2340]) expect(footprintsAt(deskStateAt(f)).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
  it('adds the card (rising, flying, docked, its tab in the drawer) and the reply while it rides', () => {
    // the static ones and the print head's hammer (always cast, from wherever its stroke has it)
    const base = staticFootprints().length + 1;
    // still B: the tab in the drawer and the reply in the chute
    expect(footprintsAt(B).length).toBe(base + 2);
    expect(footprintsAt(deskStateAt(2185)).length).toBe(base + 1);
    // MT1's next chat slip lands at the gate at 2240 (state.ts EVENTS_D), the tab still in the drawer
    expect(footprintsAt(deskStateAt(2240)).length).toBe(base + 2);
    expect(footprintsAt(deskStateAt(2150)).length).toBe(base);
    for (let f = MOTION_TESTS.mt1[0]; f < MOTION_TESTS.mt1[1]; f++) expect(footprintsAt(deskStateAt(f)).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
  it('culls no farther than the shadow and contact reach', () => {
    const fp: Footprint = { kind: 'rect', c: [0, 0], h: [50, 20], r: 3, rot: 0, z0: 0, z1: 120, contact: 1 };
    const reach = Math.hypot(50, 20) + (SHADOW_K * 120) / 2 + penumbra(120) / 2;
    expect(cullRadius(fp)).toBeGreaterThanOrEqual(reach + 28);
    const seg: Footprint = { kind: 'seg', a: [0, 0], b: [200, 0], ha: 200, hb: 60, r: 4 };
    expect(cullRadius(seg)).toBeGreaterThanOrEqual(100 + 4 + (SHADOW_K * 140) / 2 + penumbra(200) / 2);
  });
  it('packs three vec4 per footprint with its kind code', () => {
    const fps: Footprint[] = [
      { kind: 'rect', c: [1, 2], h: [3, 4], r: 1, rot: Math.PI / 2, z0: 0, z1: 9, contact: 0.5 },
      { kind: 'circle', c: [5, 6], r: 7, z0: 1, z1: 2, contact: 1 },
      { kind: 'seg', a: [0, 1], b: [2, 3], ha: 10, hb: 20, r: 4 },
      { kind: 'canopy', c: [0, 0], h: [10, 10], z: 100, strength: 0.6 },
    ];
    const out = packFootprints(fps);
    expect(out.length).toBe(MAX_FOOTPRINTS * 12);
    expect([...out.slice(0, 8)]).toEqual([1, 2, 3, 4, 1, 0, 9, KIND.rect]);
    expect(out[8]).toBeCloseTo(0, 9);
    expect(out[9]).toBeCloseTo(1, 9);
    expect(out[11]).toBe(0.5);
    expect(out[12 + 7]).toBe(KIND.circle);
    expect([...out.slice(24, 32)]).toEqual([0, 1, 2, 3, 4, 10, 20, KIND.seg]);
    expect(out[36 + 7]).toBe(KIND.canopy);
    expect(out[36 + 11]).toBeCloseTo(0.6, 6);
    expect(out[48]).toBe(0);
  });
});

describe('desk pools and post', () => {
  it('keeps the pools within the shader array and lights with near-neutral colours (never amber)', () => {
    const pools = poolsAt(B);
    expect(pools.length).toBeLessThanOrEqual(MAX_POOLS);
    for (const p of pools) {
      const m = Math.max(...p.rgb);
      if (m === 0) continue;
      // OKLCH chroma of the light's colour at full brightness (synthesis: all light chroma <= 0.03)
      expect(oklchChroma(p.rgb.map((v) => v / m) as [number, number, number])).toBeLessThanOrEqual(0.03);
    }
    expect(packPools(pools).length).toBe(MAX_POOLS * 12);
  });
  it('converts sRGB hex to linear light', () => {
    const [r, g, b] = linearOf('#212322');
    expect(r).toBeCloseTo(0.0152, 3);
    expect(g).toBeCloseTo(0.0168, 3);
    expect(b).toBeCloseTo(0.016, 3);
    expect(linearOf('#FFFFFF')).toEqual([1, 1, 1]);
  });
  it('makes PreToe then NEUTRAL the identity under the shoulder, so the palette lands on its hex values', () => {
    for (const hex of ['#212322', '#1C1E1D', '#2B2D2B', '#3A3D3C', '#6A6F6C', '#A8A296', '#D9D5CA', '#B4452C', '#8FD3A8']) {
      const c = linearOf(hex);
      const out = neutral(preToe(c));
      for (let k = 0; k < 3; k++) expect(out[k]).toBeCloseTo(c[k], 9);
    }
    // the vermilion's red channel (0.81) is just past the shoulder's start: rolled off by under 1%
    const v = linearOf('#E8603F');
    const vo = neutral(preToe(v));
    expect(Math.abs(vo[0] - v[0]) / v[0]).toBeLessThan(0.01);
    // above the shoulder NEUTRAL still rolls emitters off below 1
    const hot = neutral(preToe([4, 4, 3.9]));
    expect(Math.max(...hot)).toBeLessThan(1);
    expect(Math.max(...hot)).toBeGreaterThan(0.9);
  });
});

describe('desk state at still B (C12)', () => {
  it('sits inside C12 and inside MT1', () => {
    expect(ROUND2.stillB).toBeGreaterThan(MOTION_TESTS.mt1[0]);
    expect(ROUND2.stillB).toBeLessThan(MOTION_TESTS.mt1[1]);
  });
  it('runs the handshake in cause order inside MT1: lamps out, cap, rise, fly, dock, detent, stamp, fold, drop; arm, reply, land, lamp', () => {
    const E = EVENTS_B;
    const order = [E.lampsOut, E.testsCap, E.cardEmerge, E.cardEject, E.cardEject + E.cardFly, E.reelDetent, E.stampIn, E.fold, E.tabDrop, E.tabDrop + E.tabFrames];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    // the cap lands on the downbeat, before the card rises out of its slot; the last lamp is out before the cap moves
    expect(E.testsCap + E.capFrames).toBe(2160);
    expect(E.cardEmerge).toBeGreaterThanOrEqual(E.testsCap + E.capFrames);
    expect(E.lampsOut + 2 * E.lampStagger + E.lampFrames).toBeLessThanOrEqual(E.testsCap);
    // the reply follows the stamp-in's ink and the arm's detent; it lands, then your lamp answers
    expect(E.armTurn).toBeGreaterThan(E.stampIn);
    expect(E.armTurn + 6).toBeLessThanOrEqual(E.slipLeave);
    expect(E.slipLeave).toBeGreaterThan(E.stampIn + 4);
    expect(SLIP_RIDE_FROM).toBeLessThan(SLIP_LANDS);
    expect(SLIP_LANDS).toBeLessThan(E.lampUp);
    expect(E.lampsOut).toBeGreaterThanOrEqual(MOTION_TESTS.mt1[0]);
    expect(E.lampUp + 10).toBeLessThan(MOTION_TESTS.mt1[1]);
    // the arm settles (about 6 f) before the reply moves
    expect(Math.abs(deskStateAt(E.slipLeave).arm - DETENT.you)).toBeLessThan(0.05);
    for (let f = MOTION_TESTS.mt1[0]; f < MOTION_TESTS.mt1[1]; f++) {
      const s = deskStateAt(f);
      // nothing acts before its cause: no lit cell before the dock, no reply before the stamp
      if (s.cellLit > 0) expect(s.dock).not.toBeNull();
      if (s.slip) expect(s.cellLit).toBeGreaterThan(0.99);
      // the transit light only on the report card in flight, and dark in its dock frame
      if (s.transit > 0) expect(s.card).not.toBeNull();
    }
    expect(deskStateAt(E.cardEject + E.cardFly).transit).toBe(0);
  });
  it('has the stamp-in done, the card folded into its tab in the drawer, the arm west and the reply 60-70% down the chute, clear of the arm', () => {
    expect(B.card).toBeNull();
    expect(B.dock?.fold).toBe(1);
    expect(B.dock?.landed).toBe(1);
    expect(B.cardOut).toBeNull();
    expect(B.testsCap).toBe(1);
    for (const l of B.lamps) expect(l).toBe(0);
    expect(B.cellLit).toBeGreaterThan(0.99);
    expect(B.reel).toBeGreaterThan(0.95);
    expect(B.arm).toBeCloseTo(DETENT.you, 2);
    expect(deskStateAt(EVENTS_B.armTurn).arm).toBeCloseTo(DETENT.docs, 6);
    expect(B.slip!.emerge).toBe(1);
    expect(B.slip!.s).toBeGreaterThan(0.6);
    expect(B.slip!.s).toBeLessThan(0.7);
    expect(B.transit).toBe(0);
    expect(B.lamp).toBeCloseTo(LAMP_STEPS.dim, 6);
    expect(deskStateAt(EVENTS_B.lampUp + 12).lamp).toBeCloseTo(LAMP_STEPS.up, 2);
  });
  it('flies the card up from the tower: its arc rises above both ends', () => {
    const mid = cardArc(0.5).pos;
    expect(mid[2]).toBeGreaterThan(Math.max(cardArc(0).pos[2], cardArc(1).pos[2]) + 30);
  });
  it('steps down what C12 leaves out, fully during the line', () => {
    expect(B.step.amount).toBe(1);
    for (const id of ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock'] as const) expect(B.step.ids).toContain(id);
    expect(deskStateAt(2100).step.amount).toBe(0);
  });
  it('runs the reply at a constant pace down the chute, along the chute until its lip, then a short arc into the tray (the MT1 critic: no hold under the lip)', () => {
    const at = (f: number) => replyPose(deskStateAt(f).slip!).p;
    const step = (f: number) => Math.hypot(...([0, 1, 2] as const).map((i) => at(f + 1)[i] - at(f)[i]));
    // once out from under the deck it never slows before the lip
    const chute = Array.from({ length: SLIP_LIP - EVENTS_B.slipLeave - 8 }, (_, i) => EVENTS_B.slipLeave + 7 + i);
    for (const f of chute) expect(step(f), `f${f}`).toBeGreaterThan(10);
    // along the chute's line while inside it: its heading the chute's (never broadside to the trough)
    for (let f = EVENTS_B.slipLeave; f < SLIP_LIP; f++) {
      const s = deskStateAt(f).slip!;
      expect(s.arc).toBe(0);
      if (s.s > 0.05 && s.s < 0.95) expect(Math.abs(replyPose(s).slope)).toBeGreaterThan(0.05);
    }
    // off the lip in REPLY_ARC frames, landing on its frame, then dead still after its settle
    expect(SLIP_LIP + REPLY_ARC).toBe(SLIP_LANDS);
    expect(deskStateAt(SLIP_LANDS).slip!.arc).toBe(1);
    for (let f = SLIP_LIP; f < SLIP_LANDS; f++) expect(step(f), `f${f}`).toBeGreaterThan(2);
  });

  it('keeps the reply once it lands: in your in-tray, settled on spring-dock', () => {
    const later = deskStateAt(SLIP_LANDS + 12);
    expect(later.slip?.s).toBe(1);
    expect(later.slip!.settle).toBeGreaterThan(0.95);
    expect(later.transit).toBe(0);
  });
  it('is a pure function of the frame', () => {
    expect(deskStateAt(ROUND2.stillB)).toEqual(B);
    expect(deskStateAt(2217)).toEqual(deskStateAt(2217));
  });
});

describe('micro-print', () => {
  it('is Latin, digits and ASCII punctuation only (the print face loads its latin file)', () => {
    for (const s of PRINT_STRINGS) expect(s).toMatch(/^[\x20-\x7E]+$/);
  });
  it('cites: the reply answers the report it follows, and only the bug bay holds the request work', () => {
    expect(REPLY[0]).toBe(REPORT[0]);
    expect(CELLS[0].code).toBe(REPORT[0]);
    expect(NAMEPLATE.tests).toContain(REPORT[0]);
    // one ID chain (design D2): #0408 is the only ID printed as a number, but for the request's own (#0405) in still (c)'s close shot
    for (const s of PRINT_STRINGS) if (/#\d{4}/.test(s)) expect([REPORT[0], REPORT_C.id].some((id) => s.includes(id))).toBe(true);
    expect(NAMEPLATE.bug).not.toMatch(/#/);
  });
});

describe('MT1 after the reply: the next dispatch (state.ts EVENTS_D)', () => {
  it('runs in cause order inside MT1: slip, post, belt, loupe, notch, feed, detent, stamp, arm, cut, hatch, rise, folder, door, dock, light', () => {
    const E = EVENTS_D;
    const order = [E.slipOut, E.post, E.belt, E.loupe, E.scan, E.notch, E.feed, E.reelDetent, E.stampIn, E.armTurn, E.cut, E.hatch, E.rise, E.folderOut, E.ramp, E.doorUp, E.groove, E.dock, E.doorDown, E.light];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    // the post lands at the gate on f2240 (TREATMENT MT1); the hatch is open before the bay rises
    expect(E.post + E.postFrames).toBe(2240);
    expect(E.hatch + E.hatchFrames).toBeLessThanOrEqual(E.rise);
    expect(E.slipOut).toBeGreaterThan(ROUND2.stillB);
    expect(E.light + 10).toBeLessThanOrEqual(MOTION_TESTS.mt1[1]);
  });
  it('leaves still B as it was: nothing of the dispatch exists at f2225', () => {
    expect(B.next.slip).toBeNull();
    expect(B.next.folder).toBeNull();
    expect(B.next.hatch).toBeCloseTo(0, 9);
    expect(B.next.loupe).toBeCloseTo(0, 9);
    expect(B.cache).toBeNull();
    expect(B.testsSink).toBeCloseTo(0, 9);
    expect(B.step.own).toBeUndefined();
  });
  it('keeps one transit light: the folder carries it only in flight, never with the card', () => {
    for (let f = MOTION_TESTS.mt1[0]; f < MOTION_TESTS.mt1[1]; f++) {
      const s = deskStateAt(f);
      if (s.next.folderTransit > 0) expect(s.next.folder).not.toBeNull();
      expect(s.transit > 0 && s.next.folderTransit > 0).toBe(false);
    }
    expect(deskStateAt(EVENTS_D.dock).next.folderTransit).toBe(0);
  });
  it('lifts the door of the fresh bay fully at least 4 f before the leading edge of the folder reaches it (no effect before its cause)', () => {
    const doorY = FRESH.box.y1;
    let reached = -1;
    for (let f = EVENTS_D.folderOut; f <= EVENTS_D.dock; f++) {
      const fo = deskStateAt(f).next.folder;
      if (!fo) continue;
      // the folder's leading point (its centre plus half its length along its heading)
      const lead = fo.p[1] + Math.sin(fo.heading) * (DISPATCH.w / 2);
      if (fo.p[0] > FRESH.door[0] - 10 && lead < doorY + 4 && reached < 0) reached = f;
    }
    expect(reached).toBeGreaterThan(0);
    expect(deskStateAt(reached - 4).next.door).toBeGreaterThan(0.99);
  });
  it('moves every carrier continuously: no one-frame swaps of the card, the tab, the reply, the folder or the rising bay', () => {
    const anchor = (f: number): Record<string, P3 | null> => {
      const s = deskStateAt(f);
      const card = s.cardOut !== null ? cardRise(s.cardOut) : s.card ? s.card.pos : null;
      const reply = s.slip ? replyPose(s.slip).p : null;
      return { card, reply, folder: s.next.folder?.p ?? null, bay: [0, 0, -HATCH_DEPTH * (1 - s.next.rise)] as P3 };
    };
    for (let f = MOTION_TESTS.mt1[0] + 1; f < MOTION_TESTS.mt1[1]; f++) {
      const a = anchor(f - 1);
      const b = anchor(f);
      for (const k of Object.keys(b)) {
        const p = a[k];
        const q = b[k];
        if (!p || !q) continue;
        expect(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), `${k} at f${f}`).toBeLessThan(40);
      }
    }
    // the card is hidden in the tower as it starts to rise (its top edge at the cap), and the reply under the deck
    expect(cardRise(0)[2] + (CARD.d / 2) * Math.sin(CARD_STAND)).toBeLessThanOrEqual(CAP_SLOT[2] + 0.7);
    const [a, b] = [REPLY_PATH[0], REPLY_PATH[1]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [dx, dy] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    // every corner of the reply at its start lies under the deck (north of the south rail's face)
    for (const [u, v] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      expect(a[1] + (u * SLIP.l * dy) / 2 + (v * SLIP.w * dx) / 2).toBeGreaterThan(DECK.y0);
  });
  it('keeps the cells of the window continuous through both stamp-ins: the ink spreads over 3 f from the head’s contact (the cue frame)', () => {
    for (const [stamp, ink, head] of [
      [EVENTS_B.stampIn, (f: number) => deskStateAt(f).ink, (f: number) => deskStateAt(f).stamp],
      [EVENTS_D.stampIn, (f: number) => deskStateAt(f).next.ink, (f: number) => deskStateAt(f).next.stamp],
    ] as const) {
      expect(ink(stamp - 1)).toBe(0);
      expect(head(stamp)).toBe(1);
      expect(ink(stamp)).toBeCloseTo(1 / 3, 6);
      expect(ink(stamp + 1)).toBeCloseTo(2 / 3, 6);
      expect(ink(stamp + 2)).toBe(1);
    }
  });
  it('turns the arm to the fresh bay after the stamp-in and settles it before the folder moves', () => {
    expect(deskStateAt(EVENTS_D.armTurn).arm).toBeCloseTo(DETENT.you, 6);
    expect(Math.abs(deskStateAt(EVENTS_D.folderOut).arm - DETENT.fresh)).toBeLessThan(0.05);
  });
});

describe('still C: context as a cache (state.ts EVENTS_C)', () => {
  const C = deskStateAt(ROUND2.stillC);
  it('runs in cause order: rise, fly, dock, shrink, the strip to the head, stamp, dim, fold, drop', () => {
    const E = EVENTS_C;
    const order = [E.cardOut, E.cardEject, E.cardEject + E.cardFly, E.shrink, E.header, E.header + E.headerFrames + E.slotFrames, E.stampIn, E.dim, E.fold, E.tabDrop];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    // the strip is inside the head before it prints; the drawer is open before the tab drops
    expect(E.header + E.headerFrames + E.slotFrames).toBeLessThanOrEqual(E.stampIn);
    expect(deskStateAt(E.tabDrop).cache!.drawer).toBeGreaterThan(0.98);
  });
  it('stamps the record in over 3 f of ink stages, never before the head drops', () => {
    const E = EVENTS_C;
    expect(deskStateAt(E.stampIn).cache!.ink).toBe(0);
    expect(deskStateAt(E.stampIn + 3).cache!.ink).toBe(1);
  });
  it('holds at f3150: the reel still, the record inked, the stubs shrunk and dimmed, the tab seated in the drawer', () => {
    const c = C.cache!;
    for (let f = EVENTS_C.from; f <= ROUND2.stillC; f++) expect(deskStateAt(f).cache!.reel).toBe(0);
    expect(c.ink).toBe(1);
    for (const k of c.shrink) expect(k).toBe(1);
    expect(c.dim).toBe(1);
    expect(c.fold).toBe(1);
    expect(c.drop).toBe(1);
    expect(c.drawer).toBeGreaterThan(0.999);
    expect(c.landed).toBeGreaterThan(0.995);
    expect(c.landed).toBeLessThan(1.005);
    expect(c.squash).toBe(0);
    expect(c.card).toBeNull();
    expect(c.strip).toBeNull();
    expect(c.transit).toBe(0);
    // a hold: the next frame differs by less than a hundredth of a unit
    expect(Math.abs(deskStateAt(ROUND2.stillC + 1).cache!.landed! - c.landed!)).toBeLessThan(0.002);
  });
  it('closes the camera on the window from bar 34 and holds it', () => {
    expect(closeAt(ROUND2.stillC)).toBe(1);
    expect(closeAt(ROUND2.stillB)).toBeCloseTo(0, 9);
    const pose = cameraAt(ROUND2.stillC, 15);
    expect(pose).toEqual(deskCamera(FRAMING_C, 15));
    expect(cameraAt(ROUND2.stillB, 15)).toEqual(deskCamera(FRAMING_B, 15));
  });
});

describe('the cue sheet’s schedule and the picture’s events', () => {
  it('holds the cue sheet’s MT1 and cache frames equal to the handshake and the cache fold (the score reads the sheet, the picture its own tables)', () => {
    expect(MT1.reportUp).toBe(EVENTS_B.cardEject);
    expect(MT1.stampIn).toBe(EVENTS_B.stampIn);
    expect(MT1.replyLands).toBe(SLIP_LANDS);
    expect(MT1.dispatchFresh).toBe(EVENTS_D.rise);
    expect(BEAT_6.cacheEject).toBe(EVENTS_C.cardEject);
    expect(BEAT_6.cacheFold).toBe(EVENTS_C.fold);
  });
});

// ------------------------------------------------------------------------------------------------
// Part 2's shared hooks (wave 0, session 5): the beat modules (beat7.ts ... end.ts) add to these lists; the tests hold
// part 1's frames exactly as they were, and every frame of both worlds inside the shaders' budgets and free of
// one-frame focus swaps

/** Every film frame's state in each world: act two's to the seam, the summary's from it (computed once). */
const WORLDS = (() => {
  let cache: { act2: DeskState[]; summary: DeskState[] } | null = null;
  return () => (cache ??= { act2: Array.from({ length: SEAM_D - 1661 }, (_, i) => deskStateAt(1661 + i)), summary: Array.from({ length: 6720 - SEAM_D }, (_, i) => summaryDeskState(SEAM_D + i)) });
})();

describe('part 2’s shared hooks', () => {
  it('steps your lamp as part 1 did: up as MT1’s reply lands, down as the intake answers the key, then each beat module’s steps', () => {
    expect(LAMP_PART1.map((x) => x.at)).toEqual([EVENTS_B.lampUp, LAMP_DIMS]);
    for (let f = 2100; f < 3440; f += 3) {
      const before = LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * (springAt(f, EVENTS_B.lampUp, SPRING.effects) - springAt(f, LAMP_DIMS, SPRING.effects));
      expect(lampAt(f), `f${f}`).toBe(before);
      expect(deskStateAt(f).lamp).toBe(lampAt(f));
    }
  });
  it('turns the arm from MT1’s next stamp-in through the detents in frame order, each from the one before it', () => {
    expect(armAt(EVENTS_D.armTurn, 0.5)).toBe(0.5);
    for (const f of [2281, 2300, 2400, 3000]) expect(armAt(f, 0.5)).toBe(DETENT.you + (DETENT.fresh - DETENT.you) * springAt(f, EVENTS_D.armTurn, SPRING.detent));
  });
  it('superposes the arm’s turns: one begun before the turn before it has settled carries that one’s rest on, never dropping it in a frame', () => {
    // part 1's turn to the fresh bay, then two turns 3 f apart (the second starts while the first is still swinging)
    const steps: ArmStep[] = [
      { at: EVENTS_D.armTurn, to: 'fresh' },
      { at: 3500, to: 'bug' },
      { at: 3503, to: 'tests' },
    ];
    const arm = (f: number): number => armOf(steps, f, 0.5);
    expect(arm(EVENTS_D.armTurn)).toBe(0.5);
    // each turn adds its own swing: on the second's first frames the first's is still running, whole
    for (const f of [3501, 3503, 3504, 3506, 3520]) {
      const want = DETENT.you + (DETENT.fresh - DETENT.you) * springAt(f, EVENTS_D.armTurn, SPRING.detent) + (DETENT.bug - DETENT.fresh) * springAt(f, 3500, SPRING.detent) + (DETENT.tests - DETENT.bug) * springAt(f, 3503, SPRING.detent);
      expect(arm(f), `f${f}`).toBeCloseTo(want, 12);
    }
    // so no frame moves the arm further than the two springs' steepest frames together (e27d7bc dropped 0.68 rad of the first turn in one frame)
    let steepest = 0;
    for (let k = 1; k < 120; k++) steepest = Math.max(steepest, Math.abs(springAt(k, 0, SPRING.detent) - springAt(k - 1, 0, SPRING.detent)));
    const bound = (Math.abs(DETENT.bug - DETENT.fresh) + Math.abs(DETENT.tests - DETENT.bug)) * steepest + 1e-12;
    for (let f = 3499; f < 3600; f++) expect(Math.abs(arm(f + 1) - arm(f)), `f${f + 1}`).toBeLessThanOrEqual(bound);
    expect(arm(3600)).toBeCloseTo(DETENT.tests, 4);
    // the list's order does not matter (frame order does)
    expect(armOf([...steps].reverse(), 3505, 0.5)).toBe(arm(3505));
  });
  it('lists every reply for your in-tray: MT1’s #0408 first, riding the chute as e27d7bc rode it', () => {
    expect(deskStateAt(EVENTS_B.slipLeave - 1).replies).toEqual([]);
    expect([EVENTS_B.slipLeave, SLIP_RIDE_FROM, SLIP_LIP, SLIP_LANDS, REPLY_ARC]).toEqual([2206, 2212, 2229, 2234, 5]);
    expect(SLIP_LANDS - REPLY_ARC).toBe(SLIP_LIP);
    // e27d7bc's ride, sampled: emerging, down the chute, off the lip, landing, settling ([emerge, s, arc, squash, settle])
    const RIDE: [number, number[]][] = [
      [2206, [0, 0, 0, 0, 0]],
      [2209, [0.10600401699055949, 0, 0, 0, 0]],
      [2212, [0.4232799289553591, 0, 0, 0, 0]],
      [2220, [1, 0.29368437798956176, 0, 0, 0]],
      [2228, [1, 0.9215204864432847, 0, 0, 0]],
      [2229, [1, 1, 0, 0, 0]],
      [2231, [1, 1, 0.4, 0, 0]],
      [2234, [1, 1, 1, 1, 0]],
      [2236, [1, 1, 1, 0.5, 0.7388557119353634]],
      [2250, [1, 1, 1, 0, 0.9999371802773025]],
      [3000, [1, 1, 1, 0, 1]],
    ];
    for (const [f, want] of RIDE) {
      const st = deskStateAt(f);
      const r = st.slip!;
      [r.emerge, r.s, r.arc, r.squash, r.settle].forEach((v, k) => expect(v, `f${f} ${k}`).toBeCloseTo(want[k]!, 12));
      expect(replyRideAt(f, EVENTS_B.slipLeave, SLIP_LANDS)).toEqual(r);
      expect(st.replies[0]).toEqual({ id: '0408', ride: r, rest: IN_TRAY_REST });
      expect(replyPose(r, IN_TRAY_REST)).toEqual(replyPose(r));
    }
  });
  it('lets the chores leave your tray on their hand-overs’ lift frames (each flight’s own module draws it from there)', () => {
    expect(youPoseAt(BEAT_7.glass.lift - 1).held.glass).toBe(1);
    expect(youPoseAt(BEAT_7.glass.lift).held.glass).toBe(0);
    expect(youPoseAt(BEAT_9.strut.lift - 1).held.strut).toBe(1);
    expect(youPoseAt(BEAT_9.strut.lift).held.strut).toBe(0);
    // your lamp's pool lies where e27d7bc aimed the lamp all through part 1 (LAMP_AIM), and follows the pose's aim after it
    expect(LAMP_AIM).toEqual([-520, -60]);
    for (const f of [1700, 2225, 3000, 3439]) {
      expect(poolsAt(deskStateAt(f))[2]!.c, `f${f}`).toEqual(LAMP_AIM);
      expect(youPoseAt(f).lamp.aim.slice(0, 2), `f${f}`).toEqual(LAMP_AIM);
    }
    for (const f of [3600, 5000]) expect(poolsAt(deskStateAt(f))[2]!.c).toEqual([youPoseAt(f).lamp.aim[0], youPoseAt(f).lamp.aim[1]]);
  });
  it('reaches every focus entry: each holds the frame somewhere in its life (priority, then list order, decides overlaps)', () => {
    for (const e of focusEntries()) {
      let won = false;
      for (let f = e.from; f < e.to + STEP_FRAMES && !won; f++) won = focusAt(f) === e;
      expect(won, e.id).toBe(true);
    }
    expect(new Set(focusEntries().map((e) => e.id)).size).toBe(focusEntries().length);
  });
  it('steps every part continuously in both worlds: no part’s step moves more in a frame than its own depth’s ramp at its steepest (no one-frame swap)', () => {
    const eff = (s: DeskState, id: FocusId): number => {
      const st = s.step;
      if (st.late?.includes(id)) return s.testsStep;
      if (st.own?.ids.includes(id)) return st.own.amount;
      return st.amount > 0 && st.ids.includes(id) ? st.amount : 0;
    };
    // a part's depth while it is in a set: the holding entry's in act two (1 without one); the summary's step is its own, 0..1
    const inSet = (s: DeskState, id: FocusId): boolean => s.step.ids.includes(id) || !!s.step.own?.ids.includes(id) || !!s.step.late?.includes(id);
    const depthOf = (s: DeskState, id: FocusId, act2: boolean): number => (!inSet(s, id) ? 0 : act2 ? (focusAt(s.f)?.depth ?? 1) : 1);
    for (const [states, act2] of [
      [WORLDS().act2, true],
      [WORLDS().summary, false],
    ] as const) {
      for (let i = 1; i < states.length; i++) {
        const [a, b] = [states[i - 1]!, states[i]!];
        const ids = new Set<FocusId>([...a.step.ids, ...b.step.ids, ...(a.step.own?.ids ?? []), ...(b.step.own?.ids ?? []), ...(a.step.late ?? []), ...(b.step.late ?? [])]);
        for (const id of ids) {
          const limit = (Math.max(depthOf(a, id, act2), depthOf(b, id, act2)) * Math.PI) / (2 * STEP_FRAMES) + 1e-9;
          expect(Math.abs(eff(b, id) - eff(a, id)), `f${b.f} ${id}`).toBeLessThanOrEqual(limit);
        }
      }
    }
  });
  it('keeps every frame of part 2 inside the shaders’ footprint and pool arrays, with 8 footprints of headroom, in both worlds', () => {
    for (let f = 3440; f < 6720; f++) {
      for (const s of [deskStateAt(f), summaryDeskState(f)]) {
        expect(footprintsAt(s).length, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS - 8);
        expect(poolsAt(s).length, `f${f}`).toBeLessThanOrEqual(MAX_POOLS);
      }
    }
  });
});

describe('focus hand-overs (state.ts FocusEntry.handFrom, stepOf)', () => {
  /** A part's step under a step-down (the late set is at 1 from f2200: testsStep). */
  const level = (st: DeskState['step'], id: FocusId): number => (st.late?.includes(id) ? 1 : st.own?.ids.includes(id) ? st.own.amount : st.amount > 0 && st.ids.includes(id) ? st.amount : 0);
  /** Every part's per-frame change over [f0, f1) at most its depth's steepest ramp frame. */
  function continuous(entries: readonly FocusEntry[], ids: readonly FocusId[], f0: number, f1: number, depth: number): void {
    const limit = (depth * Math.PI) / (2 * STEP_FRAMES) + 1e-9;
    for (let f = f0 + 1; f < f1; f++) for (const id of ids) expect(Math.abs(level(stepOf(entries, f), id) - level(stepOf(entries, f - 1), id)), `f${f} ${id}`).toBeLessThanOrEqual(limit);
  }
  // the sample: x steps the reel, the lock and the gauge; y takes over at 3700, keeping the reel and the gauge, dropping
  // the lock and adding the head (x listed later and at a higher priority: neither matters)
  const X: FocusEntry = { id: 'x', from: 3500, to: 3800, step: ['reel', 'lock', 'gauge'], priority: 2 };
  const Y: FocusEntry = { id: 'y', from: 3700, to: 3900, step: ['reel', 'gauge', 'head'], handFrom: 'x' };
  it('carries no part of the film’s hand-overs on a set that the objects drawing it do not honour', () => {
    // these objects draw a part with the main stepped set (or its amount, or the full set) whatever its mode, so on the
    // set named here it would pop where the hand-over moves it there: Intake.tsx:391 maps 'late' to the stepped set;
    // Cache.tsx:199 (the window's cards), Register.tsx:770-771 (the jewel, the tape rows) and Filter.tsx:173 (the pile's
    // slips) map 'own' and 'late' to it; YourDesk.tsx:495/503 keeps your desk's own surfaces full on the main and late sets
    // but steps them on the own set. Fix the object (main agent) before a hand-over carries one of these parts there.
    const BLIND: [FocusId, readonly ('own' | 'late')[]][] = [
      ['intake', ['late']],
      ['deck', ['own', 'late']],
      ['spike', ['own', 'late']],
      ['you', ['own']],
    ];
    for (const e of focusEntries()) {
      if (e.handFrom === undefined) continue;
      for (let f = e.from; f < e.from + STEP_FRAMES; f++) {
        const st = deskStateAt(f).step;
        for (const [id, sets] of BLIND) {
          if (sets.includes('late')) expect(st.late ?? [], `${e.id} f${f} ${id} on the late set`).not.toContain(id);
          if (sets.includes('own')) expect(st.own?.ids ?? [], `${e.id} f${f} ${id} on the own set`).not.toContain(id);
        }
      }
    }
  });
  it('has the late set at a full step wherever a hand-over may use it, and nothing but stepAt on the sets there (part 2)', () => {
    expect(deskStateAt(CORD_FROM).testsStep).toBe(1);
    expect(deskStateAt(6719).testsStep).toBe(1);
    // part 1's holds (state.ts withOwnRamp, withBeat5Ramp, withBeat6Ramp, withLateHold) are over before part 2
    for (const s of WORLDS().act2) if (s.f >= CORD_FROM) expect(s.step, `f${s.f}`).toEqual(stepAt(s.f));
  });
  it('takes over from the entry it names on its own `from`, whatever their order and priority', () => {
    for (const entries of [
      [X, Y],
      [Y, X],
    ]) {
      expect(focusOf(entries, 3699)).toBe(X);
      expect(focusOf(entries, 3700)).toBe(Y);
      expect(focusOf(entries, 3850)).toBe(Y);
    }
    // without handFrom the higher priority wins the overlap whole
    expect(focusOf([X, { ...Y, handFrom: undefined }], 3700)).toBe(X);
  });
  it('keeps the shared parts at a full step, ramps the dropped out and the added in, every part continuous', () => {
    const entries = [Y, X];
    const ids: FocusId[] = ['reel', 'lock', 'gauge', 'head'];
    continuous(entries, ids, 3480, 3930, 1);
    for (let f = 3690; f < 3730; f++) for (const id of ['reel', 'gauge'] as const) expect(level(stepOf(entries, f), id), `f${f} ${id}`).toBe(1);
    const u = (f: number) => (1 - Math.cos((Math.PI * (f - 3700)) / STEP_FRAMES)) / 2;
    for (let f = 3700; f < 3714; f++) {
      expect(level(stepOf(entries, f), 'lock'), `f${f}`).toBeCloseTo(1 - u(f), 12);
      expect(level(stepOf(entries, f), 'head'), `f${f}`).toBeCloseTo(u(f), 12);
    }
    expect(level(stepOf(entries, 3699), 'lock')).toBe(1);
    expect(level(stepOf(entries, 3714), 'lock')).toBe(0);
    expect(level(stepOf(entries, 3714), 'head')).toBe(1);
    // after the hand-over it steps as any entry does (the named one holds no frame while it is live)
    for (const f of [3714, 3800, 3900, 3913]) expect(stepOf(entries, f)).toEqual(stepOf([{ ...Y, handFrom: undefined }], f));
  });
  it('keeps a hand-over at another depth continuous where the main and own sets can carry it', () => {
    const S: FocusId[] = ['intake', 'gate', 'reel', 'deck'];
    // two counterfactual cards, back to back, stepping the same set: it never moves
    const A: FocusEntry = { id: 'a', from: 3500, to: 3600, step: S, depth: 1.5 };
    const B: FocusEntry = { id: 'b', from: 3600, to: 3700, step: S, depth: 1.5, handFrom: 'a' };
    continuous([A, B], S, 3480, 3730, 1.5);
    for (let f = 3514; f < 3700; f++) for (const id of S) expect(level(stepOf([A, B], f), id), `f${f} ${id}`).toBe(1.5);
    // a wider set: the shared hold the main set at 1.5, the added ramp in on the own one
    const C: FocusEntry = { ...B, id: 'c', step: [...S, 'head', 'lock'] };
    continuous([A, C], [...S, 'head', 'lock'], 3480, 3730, 1.5);
    // a narrower one: the dropped ramp out on the own set
    const D: FocusEntry = { ...B, id: 'd', step: ['intake', 'gate'] };
    continuous([A, D], S, 3480, 3730, 1.5);
    // all three groups at 1.5: no set can hold the shared parts
    expect(() => stepOf([A, { ...B, step: ['intake', 'gate', 'head'] }], 3600)).toThrow(/depth 1.5/);
  });
  it('throws on a hand-over that cannot be continuous', () => {
    const at = (entries: FocusEntry[], f = 3700) => () => stepOf(entries, f);
    expect(at([X, { ...Y, handFrom: 'nobody' }])).toThrow(/no other entry/);
    expect(at([X, { ...Y, depth: 1.5 }])).toThrow(/depths differ/);
    expect(at([{ ...X, from: 3690 }, Y])).toThrow(/full step/);
    expect(at([{ ...X, to: 3690 }, Y])).toThrow(/full step/);
    expect(at([{ ...X, to: 3950 }, Y])).toThrow(/outlives/);
    expect(at([{ ...X, to: 3705 }, { ...Y, to: 3710 }])).toThrow(/ramps out/);
    expect(at([X, { ...Y, late: ['plate'] }])).toThrow(/late set/);
    expect(at([{ ...X, late: ['plate'] }, Y])).toThrow(/late set/);
    expect(at([X, { ...Y, own: { from: 3705, to: 3800, step: ['plate'] } }])).toThrow(/own set of 'y' is live/);
    expect(at([{ ...X, own: { from: 3600, to: 3690, step: ['plate'] } }, Y])).toThrow(/own set of 'x' is live/);
    expect(at([X, { ...Y, own: { from: 3720, to: 3800, step: ['lock'] } }])).toThrow(/steps a part/);
    // a third entry holds the frame before
    expect(at([X, Y, { id: 'z', from: 3600, to: 3686, step: ['plate'], priority: 3 }])).toThrow(/does not hold f3699/);
    // part 1's holds drive the late and own sets: no hand-over there
    expect(at([{ ...X, from: 2400, to: 2700 }, { ...Y, from: 2600, to: 2800 }], 2600)).toThrow(/part 2/);
    // an idle own set of parts of neither set is fine
    expect(at([X, { ...Y, own: { from: 3713, to: 3800, step: ['plate'] } }])).not.toThrow();
  });
});
