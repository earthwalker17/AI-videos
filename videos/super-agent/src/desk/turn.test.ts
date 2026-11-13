import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { MOTION_TESTS } from '../lookdev/frames.ts';
import { actOneFrameFootprints, fixAOf, fixBOf } from './ActOneFrame.tsx';
import { FLAG, FOLDERS, LOOP_A, PEN, POOL_A_Z, actOneAt, actOnePools, stackTop, youPoseA } from './actOne.ts';
import { A_CHUTES, A_FOLDER_IN, A_ITEMS, A_PILE, A_STACK_END, BAY_TRAYS, FIX_A_FOLDER, IMPRINTS, RETIRE_TRAYS, TRAYS, TRAY_Z } from './beat3.ts';
import { FRAMING_B, cameraAt, deskCamera, project } from './camera.ts';
import { REQUEST_FROM } from './beat4.ts';
import { BELT_SLOPE, CARRIERS, SPOUT_INSIDE } from './beat6.ts';
import { MAX_FOOTPRINTS, footprintsAt, youFootprints, type Footprint } from './footprints.ts';
import { BAYS, DECK, DECK_PLATE, NEXT_SLIP, REEL, SPOOL, YOU, type P3 } from './layout.ts';
import { EMIT, MAX_POOLS, linearOf, poolsAt } from './pools.ts';
import { DESK_HEX } from './gl/desk.ts';
import { LAMP_STEPS, deskStateAt } from './state.ts';
import {
  A_TAPE_LEN,
  BAY_ORDER,
  CHUTE_CLEAR,
  CHUTE_IN,
  LEAVES_OPEN,
  OLDER_REPLY,
  OLDER_REPLY_REST,
  STRUT_HOME,
  aTailAt,
  olderReplyAt,
  retireContact,
  slateToneAt,
  strutTurnAt,
  COIL_R0,
  PACK_H,
  STOCK_FRAMES,
  WRAP_FULL,
  PRESS_DELAY,
  PRESS_PHASE,
  PRESS_SPREAD,
  SPOOL_NORTH,
  TESTS_SLIDE,
  HIGH_POOL,
  TURN,
  TURN_SPAN,
  UPPER_POOL,
  bayShapeAt,
  bayTimes,
  deckPoint,
  deckTurnAt,
  FIRST_HOP,
  FIRST_OUT,
  firstSlipAt,
  fixATurnAt,
  foldPressAt,
  imprintOf,
  imprintsAt,
  loopTurnAt,
  replyLands,
  retireAt,
  retireStarts,
  shiftAt,
  slateAt,
  trayStarts,
  turnAt,
  turnDeskState,
  turnFootprints,
  turnHoles,
  turnPools,
  wrapRadius,
  youPoseTurn,
} from './turn.ts';
import { YOU_POSE_B, strutEnds, strutOnLid } from './you.ts';

/** The pools' light (green) at a place and height, as the shaders sum it (gl/light.ts dskPool). */
const poolLight = (t: ReturnType<typeof turnAt>, c: readonly [number, number], z: number) =>
  turnPools(t).reduce((s, q) => {
    if (z < q.z[0] || z > q.z[1]) return s;
    const dx = (c[0] - q.c[0]) / q.sigma[0];
    const dy = (c[1] - q.c[1]) / q.sigma[1];
    return s + q.rgb[1] * Math.exp(-0.5 * (dx * dx + dy * dy));
  }, 0);
/** A state without its frame number, for comparing frames. */
const still = (f: number) => JSON.stringify({ ...turnAt(f), f: 0, act: { ...turnAt(f).act, f: 0 } });
const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL = span(TURN_SPAN[0], TURN_SPAN[1]);
/** Footprints as a multiset (a capsule either way round, rounded to 0.05 u). */
const fpKey = (fp: Footprint): string => {
  const r = (x: number) => (Math.round(x * 20) / 20).toFixed(2);
  if (fp.kind === 'seg') {
    const [a, b] = [`${r(fp.a[0])},${r(fp.a[1])},${r(fp.ha)}`, `${r(fp.b[0])},${r(fp.b[1])},${r(fp.hb)}`].sort();
    return `seg ${a} ${b} ${r(fp.r)}`;
  }
  if (fp.kind === 'canopy') return `canopy ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.z)} ${r(fp.strength)}`;
  if (fp.kind === 'circle') return `circle ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.r)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
  return `rect ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.r)} ${r(fp.rot)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
};
const fpSet = (fps: Footprint[]) => fps.map(fpKey).sort();

describe('the turn (MT2)', () => {
  it('spans MT2 and keeps the cue sheet’s hits', () => {
    expect(TURN_SPAN).toEqual(MOTION_TESTS.mt2);
    expect(TURN.hit).toBe(1440);
    expect(TURN.hit).toBe(cue('turn').frame);
    expect(TURN.plate).toBe(cue('trait-continuous').frame);
    expect([TURN.lock, TURN.jewel, TURN.throat, TURN.print]).toEqual([1616, 1618, 1620, 1624]);
  });

  it('is a pure function of the frame', () => {
    for (const f of [1400, 1444, 1500, 1561, 1616, 1660]) expect(JSON.stringify(turnAt(f))).toBe(JSON.stringify(turnAt(f)));
  });

  it('takes act one’s world over at f1400 exactly as act one and beat 3 would draw it (shadows, light, focus, lamp, Fix A, Fix B)', () => {
    const t = turnAt(1400);
    // act one's own clock runs on (its pens stroke on eighths): the turn's first frame is act one's f1400
    expect(t.act).toEqual(actOneAt(1400));
    expect(fpSet(turnFootprints(t))).toEqual(fpSet(actOneFrameFootprints(1400)));
    expect(turnPools(t)[0]).toEqual(actOnePools(actOneAt(1400))[0]);
    for (const p of turnPools(t).slice(1)) expect(Math.max(...p.rgb)).toBe(0);
    // the intake held stepped down (act one's FOCUS_A.intake), nothing on its own ramp
    const s = turnDeskState(1400);
    expect(s.step.amount).toBe(actOneAt(1399).step.amount);
    expect(s.step.ids).toEqual(actOneAt(1399).step.ids);
    expect(actOneAt(1399).step.own?.amount ?? 0).toBe(0);
    // (act two's own late ramp, not yet started: −0 from its ease)
    expect(s.testsStep).toBeCloseTo(0, 9);
    // your desk and lamp
    expect(t.you.lamp).toEqual(youPoseA(actOneAt(1400)).lamp);
    expect(t.you.shift).toEqual(youPoseA(actOneAt(1400)).shift);
    expect(t.you.bulb).toBe(youPoseA(actOneAt(1400)).bulb);
    // Fix A's tape, queue and folder as beat 3 leaves them (its last station only starts on this frame)
    const A = fixAOf(1399);
    expect(t.fixA.tape).toEqual(A.tape);
    expect(t.fixA.items.map((x) => x!.p)).toEqual(A.items.filter((x) => x !== null).map((x) => x!.p));
    expect(t.fixA.stackTop).toBe(A.stackTop);
    // the request's copy (and its vermilion stub) not yet turning to paper
    expect(t.fixA.items.every((x) => x === null || x.paper === 0)).toBe(true);
    expect(t.fixA.chutes).toEqual(A.chutes);
    // Fix B's replies all in your in-tray as beat 3 left them (reply 7 came home on f1317: nothing in flight)
    expect(JSON.stringify(t.fixB.slips)).toBe(JSON.stringify(fixBOf(1400).b.slips));
    expect(t.press.every((p) => p.k === 0) && t.pressA.k === 0).toBe(true);
    expect(t.fixB.bays.every((b) => b.grow === 0 && b.slide === 0 && !b.hole && !b.done)).toBe(true);
    expect(t.fixB.retire.every((r) => r === null || (r.off.every((v) => v === 0) && !r.gone))).toBe(true);
    // no act-one label (it left as beat 3 began), the act-two ones not yet
    expect(t.labels.you).toBeNull();
    expect(t.labels.router).toBeNull();
    const L = t.loop.ribbon!.L;
    expect([L.c, L.a, L.b, L.n]).toEqual([LOOP_A.c, LOOP_A.a, LOOP_A.b, LOOP_A.n]);
  });

  it('holds still from the pens lifting until the hit (stillness before the climax)', () => {
    const ref = still(TURN.still + 4);
    for (let f = TURN.still + 4; f < TURN.hit; f++) expect(still(f)).toBe(ref);
    expect(TURN.hit - (TURN.still + 4)).toBeGreaterThanOrEqual(10);
    // the intake stays stepped down until "hears every channel", then comes back over 16 f
    for (let f = 1400; f <= TURN.stepOut; f++) expect(turnAt(f).step).toBe(1);
    expect(turnAt(TURN.stepOut + TURN.stepFrames).step).toBeCloseTo(0, 6);
  });

  it('ends in act two at f1660: your desk, the deck, the reel, three bays, the camera', () => {
    const t = turnAt(1660);
    expect({ ...t.you, bulb: null, inTray: true, inTraySlip: undefined }).toEqual({ ...YOU_POSE_B, inTraySlip: undefined });
    expect(Math.abs(t.deck.dy) + Math.abs(t.deck.dz) + Math.abs(t.deck.tilt[0]) + Math.abs(t.deck.tilt[1])).toBeLessThan(1e-3);
    const { posts, chute, ...rest } = t.parts;
    expect(posts).toBeGreaterThan(0.999);
    expect(chute).toBe(1);
    for (const v of Object.values(rest)) expect(Math.abs(v)).toBeLessThan(1e-3);
    const c = t.loop.coil!;
    expect(c.c[0]).toBeCloseTo(REEL.x, 6);
    expect(c.c[1]).toBeCloseTo(REEL.y, 6);
    expect(c.h).toBeCloseTo(REEL.packZ[0], 6);
    expect(c.rOut).toBeCloseTo(REEL.packR, 3);
    expect(c.rIn).toBeCloseTo(REEL.hubR, 2);
    expect(imprintsAt(t).every((d) => d > 0.999)).toBe(true);
    expect(cameraAt(1660, 15)).toEqual(deskCamera(FRAMING_B, 15));
    expect(t.fixA.deskLen + t.fixA.spanLen).toBe(0);
    expect(t.fixA.chutes!.every((e) => e === 0)).toBe(true);
    expect(t.step).toBe(0);
    expect(turnHoles(t)).toHaveLength(0);
    expect(turnDeskState(1660).testsStep).toBe(deskStateAt(1660).testsStep);
  });

  it('turns eight event trays into three task bays: five posted back out, three walled up one at a time as (b)’s closed bays', () => {
    expect(RETIRE_TRAYS.length + BAY_TRAYS.length).toBe(TRAYS.length);
    expect(new Set([...RETIRE_TRAYS, ...BAY_TRAYS.map((b) => b.k)]).size).toBe(TRAYS.length);
    expect(new Set(BAY_TRAYS.map((b) => b.id))).toEqual(new Set(Object.keys(BAYS)));
    const t = turnAt(1660);
    for (const k of RETIRE_TRAYS) expect(t.fixB.retire[k]!.gone).toBe(true);
    for (const b of t.fixB.bays) {
      expect(b.grow).toBe(1);
      expect(b.lid).toBe(1);
      // closed and idle: its lid shut, its hole closed (beat 4 dispatches it)
      expect(b.leaves).toBe(0);
      expect(b.hole).toBe(false);
      expect(b.done).toBe(true);
    }
    const s = turnDeskState(1660);
    for (const id of ['bug', 'tests', 'docs'] as const) {
      expect(s.b4.bays[id].rise).toBe(0);
      expect(s.b4.bays[id].light).toBe(0);
      expect(s.b4.bays[id].hole).toBe(false);
    }
    // one at a time, every bay closed before the reel descends (the reel's lock is the only big motion then)
    const starts = BAY_ORDER.map((id) => bayTimes(BAY_TRAYS.find((b) => b.id === id)!.k));
    for (let i = 1; i < starts.length; i++) expect(starts[i].grow).toBeGreaterThanOrEqual(starts[i - 1].grow + TURN.bayGap);
    for (const T of starts) expect(T.closed).toBeLessThanOrEqual(TURN.descend);
  });

  it('walls each bay up from its own tray, physically, one bay at a time', () => {
    for (const { k, id } of BAY_TRAYS) {
      const T = bayTimes(k);
      const at = (f: number) => turnAt(f).fixB.bays.find((b) => b.id === id)!;
      const L = BAYS[id];
      // the trays that stood in its box have flown out east (beyond the box) before its walls grow
      for (const j of RETIRE_TRAYS) {
        const tr = TRAYS[j];
        const r = retireAt(j, T.grow);
        const x0 = tr.c[0] - tr.w / 2 + r.off[0];
        const overlaps = x0 < L.box.x1 && tr.c[0] + tr.w / 2 + r.off[0] > L.box.x0 && tr.c[1] - tr.d / 2 < L.box.y1 && tr.c[1] + tr.d / 2 > L.box.y0;
        expect(r.gone || !overlaps, `tray ${j} still in the ${id} bay's box at f${T.grow}`).toBe(true);
      }
      // it grows from the tray's own rect to the bay's box, never jumping
      for (let f = T.slide; f < T.closed; f++) {
        const a = at(f);
        const b = at(f + 1);
        const sa = bayShapeAt(k, L, a.grow, a.slide).box;
        const sb = bayShapeAt(k, L, b.grow, b.slide).box;
        expect(Math.max(Math.abs(sb.x0 - sa.x0), Math.abs(sb.x1 - sa.x1), Math.abs(sb.y0 - sa.y0), Math.abs(sb.y1 - sa.y1)), `${id} f${f}`).toBeLessThan(60);
      }
      expect(bayShapeAt(k, L, 0).box).toEqual({ x0: TRAYS[k].c[0] - TRAYS[k].w / 2, x1: TRAYS[k].c[0] + TRAYS[k].w / 2, y0: TRAYS[k].c[1] - TRAYS[k].d / 2, y1: TRAYS[k].c[1] + TRAYS[k].d / 2 });
      expect(bayShapeAt(k, L, 1, at(T.grow).slide).box).toEqual(L.box);
      // its floor becomes the lid before the lid opens; the hole opens only once the leaves have left the slate and
      // closes as they shut; what lay in the tray falls only once they are open
      expect(at(T.open).lid).toBe(1);
      expect(at(T.open).leaves).toBe(0);
      expect(at(T.open).hole).toBe(false);
      expect(at(T.open + 1).hole).toBe(true);
      expect(at(T.open + 1).leaves).toBeGreaterThan(0);
      expect(at(T.open + 1).fall).toBe(0);
      expect(at(T.closed - 1).hole).toBe(true);
      expect(at(T.closed - 1).leaves).toBeGreaterThan(0);
      expect(at(T.closed - 1).fall).toBe(1);
      expect(at(T.closed).leaves).toBe(0);
      expect(at(T.closed).hole).toBe(false);
      expect(at(T.closed).done).toBe(true);
      // the walls are the kit's graphite before the shell is handed to act two's
      expect(at(T.open).built).toBeGreaterThan(0.99);
    }
    // the test tower's tray slides west along the south row, south of the docs galley's box, once your desk has left
    const k6 = BAY_TRAYS.find((b) => b.id === 'tests')!.k;
    expect(TRAYS[k6].c[1] + TRAYS[k6].d / 2).toBeLessThan(BAYS.docs.box.y0);
    expect(shiftAt(bayTimes(k6).slide)[0] + YOU.slab.x1).toBeLessThan(TRAYS[k6].c[0] + TESTS_SLIDE - TRAYS[k6].w / 2);
  });

  it('posts the five other trays back out beyond the east edge, lifted over the trays that stay, never vanishing', () => {
    for (const k of RETIRE_TRAYS) {
      const t0 = retireStarts(k);
      expect(t0).toBeGreaterThan(replyLands(k));
      let last = -1;
      for (let f = Math.floor(t0); f <= 1600; f++) if (!retireAt(k, f).gone) last = f;
      // on its last drawn frame it is wholly beyond the frame's east edge
      const r = retireAt(k, last);
      const tr = TRAYS[k];
      const west = project(cameraAt(last, 15), [tr.c[0] - tr.w / 2 + r.off[0], tr.c[1], r.off[2]]);
      expect(west[0], `tray ${k} f${last}`).toBeGreaterThan(1920);
      // lifted well clear of the trays that stay (their rims) as it flies over them
      expect(retireAt(k, t0 + TURN.retireAntic + 4).off[2]).toBeGreaterThan(TRAY_Z.rim + 10);
    }
  });

  it('presses every folder, act one’s and Fix A’s, into its imprint', () => {
    expect(IMPRINTS).toHaveLength(FOLDERS.length + 1);
    expect(IMPRINTS.slice(0, FOLDERS.length).map((m) => m.c)).toEqual(FOLDERS.map((fl) => fl.c));
    expect(IMPRINTS[FOLDERS.length].c).toEqual(FIX_A_FOLDER.c);
  });

  it('presses the folders down with their pens, flags and piles: a squash spreading flat, the rim, the draw-in, then the slate’s tone and the sink, run along the arc (L1-05, R-A3)', () => {
    // from the hit, along the arc from Fix A's to F8: 0 to PRESS_SPREAD (1-2 f), every body after its neighbour
    expect(TURN.press).toBe(TURN.hit);
    expect(PRESS_DELAY).toHaveLength(FOLDERS.length + 1);
    expect(PRESS_DELAY[FOLDERS.length]).toBe(0);
    expect(PRESS_DELAY[FOLDERS.length - 1]).toBeCloseTo(PRESS_SPREAD, 9);
    expect(PRESS_SPREAD).toBeGreaterThanOrEqual(1);
    expect(PRESS_SPREAD).toBeLessThanOrEqual(2);
    // Fix A's, then F1 to F8 in order, no two closer than 0.15 f (by radius five had pressed within 0.44 f)
    const order = [PRESS_DELAY[FOLDERS.length], ...PRESS_DELAY.slice(0, FOLDERS.length)];
    for (let i = 1; i < order.length; i++) expect(order[i] - order[i - 1], `body ${i}`).toBeGreaterThan(0.15);
    expect(TURN.pressGone).toBe(PRESS_SPREAD + TURN.pressFrames - 1);
    expect(TURN.pressFrames).toBeGreaterThanOrEqual(10);
    expect(TURN.pressFrames).toBeLessThanOrEqual(14);
    // the first body moves on the hit itself; nothing moves before it
    expect(foldPressAt(TURN.press, 0).scaleZ).toBeLessThan(0.8);
    expect(foldPressAt(TURN.press - 1, 0).k).toBe(0);
    for (const delay of PRESS_DELAY) {
      // its own frame t (1 on its first frame)
      const at = (t: number) => foldPressAt(TURN.press + delay - 1 + t, delay);
      expect(at(0).k).toBeCloseTo(0, 9);
      // a visible squash in 3 f (its shadow pulls in with its height), spreading flat and held spread until the draw-in
      expect(at(3).scaleZ).toBeLessThan(0.5);
      expect(at(3).scaleZ).toBeGreaterThan(0.4);
      for (const t of [3, 4, 5]) expect(at(t).inset!, `d${delay} t${t}`).toBeCloseTo(-PRESS_PHASE.spread, 9);
      // the imprint's rim comes in from t 2 and is full before the tone starts (4 frames of physical change first)
      expect(imprintOf(at(2))).toBeCloseTo(0, 9);
      expect(imprintOf(at(PRESS_PHASE.rimTo))).toBeCloseTo(1, 9);
      for (let t = 0; t <= PRESS_PHASE.slateFrom; t++) expect(at(t).slate, `d${delay} t${t}`).toBeCloseTo(0, 9);
      expect(at(PRESS_PHASE.drawTo).inset).toBeCloseTo(5, 9);
      // flat and in the slate's tone by `flat`, only then sunk to −2 (nothing goes under the slate before it is in its tone)
      expect(at(PRESS_PHASE.flat).scaleZ).toBeLessThan(0.03);
      expect(at(PRESS_PHASE.flat).slate).toBeGreaterThan(0.999);
      expect(at(PRESS_PHASE.sinkTo).sink).toBeGreaterThan(2.39);
      for (let t = 0; t <= PRESS_PHASE.sinkFrom; t++) expect(at(t).sink, `d${delay} t${t}`).toBeCloseTo(0, 9);
      let prev = at(0);
      for (let t = 1; t < TURN.pressFrames; t++) {
        const p = at(t);
        // it only goes down; the tone only comes in, over 6 f (never a fade of nine bodies in 4: at most a quarter a frame)
        expect(p.scaleZ, `d${delay} t${t}`).toBeLessThanOrEqual(prev.scaleZ + 1e-9);
        expect(p.sink, `d${delay} t${t}`).toBeGreaterThanOrEqual(prev.sink - 1e-9);
        expect(p.slate!, `d${delay} t${t}`).toBeGreaterThanOrEqual(prev.slate! - 1e-9);
        expect(p.slate! - prev.slate!, `d${delay} t${t}`).toBeLessThanOrEqual(0.26);
        expect(imprintOf(p), `d${delay} t${t}`).toBeGreaterThanOrEqual(imprintOf(prev) - 1e-9);
        prev = p;
      }
      // its last drawn frame: in the slate's tone, every part (the lifted pen, the flag, Fix A's pile) under the slate
      const fl = Math.ceil(TURN.press + delay - 1 + TURN.pressFrames) - 1;
      const last = foldPressAt(fl, delay);
      expect(last.k).toBeLessThan(1);
      expect(last.slate).toBeGreaterThan(0.999);
      for (const f of FOLDERS) expect((stackTop(f) + 1.2 + PEN.lift + 8) * last.scaleZ - last.sink, `F${f.n} pen`).toBeLessThan(0);
      for (const f of FOLDERS) expect((stackTop(f) + 1 + FLAG.staff + FLAG.plate[1]) * last.scaleZ - last.sink, `F${f.n} flag`).toBeLessThan(0);
      expect((A_STACK_END + 0.5 + 0.8 * A_PILE.length + 2) * last.scaleZ - last.sink).toBeLessThan(0);
      expect(foldPressAt(fl + 1, delay).k).toBe(1);
      expect(fl + 1).toBeLessThanOrEqual(TURN.press + TURN.pressGone);
    }
    // the bodies in the frame carry their own delays
    const t = turnAt(TURN.press + 3);
    FOLDERS.forEach((_, i) => expect(t.press[i].scaleZ).toBeCloseTo(foldPressAt(TURN.press + 3, PRESS_DELAY[i]).scaleZ, 9));
    expect(t.pressA.scaleZ).toBeCloseTo(foldPressAt(TURN.press + 3, PRESS_DELAY[FOLDERS.length]).scaleZ, 9);
    expect(slateAt(TURN.press + TURN.pressGone - 1, PRESS_SPREAD)).toBeGreaterThan(0.999);
    expect(imprintsAt(turnAt(TURN.press + TURN.pressGone - 1)).every((d) => d === 1)).toBe(true);
    expect(turnAt(TURN.press + TURN.pressGone).press.every((p) => p.k === 1)).toBe(true);
    // the pens, flags and clips are toned with each folder's own press (objects/ActOne.tsx folderKit): the kit's late ramp
    // is act two's own through the press (nothing on it moves)
    for (let f = TURN.press - 1; f <= TURN.press + TURN.pressGone; f++) expect(turnDeskState(f).testsStep).toBe(deskStateAt(f).testsStep);
  });

  it('lets every part emerge over frames from a visible source', () => {
    // the coil takes over from the round ribbon at its own radius, height and width (no jump)
    const r = turnAt(TURN.coil - 1).loop.ribbon!;
    const c = turnAt(TURN.coil).loop.coil!;
    expect(r.edge).toBeGreaterThan(0.98);
    expect(Math.abs(r.L.a - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.rOut - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.h - r.h)).toBeLessThan(1);
    // its height is the ribbon's on edge (the tape's width), its top comes in from nothing, its outer turn is the ribbon's
    expect(Math.abs(c.t - r.L.w)).toBeLessThan(0.05);
    expect(c.rIn).toBeCloseTo(COIL_R0, 9);
    expect(c.rim).toBeCloseTo(COIL_R0, 9);
    expect(c.wrap).toBe(0);
    // Fix A's tape end lifts off the desk where its folder's mouth was (the span grows from nothing)
    expect(turnAt(TURN.catch).fixA.span.len).toBeLessThan(1e-9);
    expect(turnAt(TURN.catch + 1).fixA.span.len).toBeLessThan(40);
    // the spool slides in from off the top of the frame
    expect(turnAt(TURN.spool).intake.spool).toBe(SPOOL_NORTH);
    const top = project(cameraAt(TURN.spool, 15), [SPOOL.x, SPOOL.y + SPOOL_NORTH - 30, 110]);
    expect(top[1]).toBeLessThan(0);
    // the belt runs out of the throat from nothing; the gate rides its foot
    expect(turnAt(TURN.belt - 1).intake.belt).toBeNull();
    expect(turnAt(TURN.belt + 1).intake.belt!).toBeLessThan(0.15);
    // mail and calendar are pressed over 8 f (their vellum laid down as they go)
    expect(turnAt(TURN.mail + 1).intake.mail.k).toBeLessThan(0.2);
    // the chute extends from the deck's corner; its posts drop only once it is out
    expect(turnAt(TURN.chute + 1).parts.chute).toBeLessThan(0.2);
    expect(turnAt(TURN.posts).parts.chute).toBeGreaterThan(0.95);
    // the row prints with a 3 f ink spread after the head has dropped over 4 f
    expect(turnAt(TURN.print - 1).tape.ink).toBe(-1);
    expect([0, 1, 2, 3].map((d) => turnAt(TURN.print + d).tape.ink)).toEqual([0, 1, 2, 3]);
    expect(turnAt(TURN.headDrop).tape.hammer).toBe(0);
    expect(turnAt(TURN.print).tape.hammer).toBeCloseTo(1, 6);
  });

  it('acts only after its cause', () => {
    // the loop lifts only after the hit; the dip comes first
    for (let f = 1400; f < TURN.rise; f++) expect(turnAt(f).loop.ribbon!.h).toBeCloseTo(LOOP_A.z, 6);
    expect(turnAt(TURN.riseEnd).loop.coil?.h ?? turnAt(TURN.riseEnd).loop.ribbon!.h).toBeGreaterThan(155);
    // Fix A's tape lifts off only once its folder is pressed and gone
    expect(TURN.catch).toBeGreaterThanOrEqual(TURN.press + TURN.pressGone);
    // each tray changes only after its reply has come home
    TRAYS.forEach((_, k) => expect(trayStarts(k)).toBeGreaterThan(replyLands(k)));
    // the tape has left the desk's path before your desk slides over it
    expect(turnAt(TURN.slide + 8).fixA.deskLen).toBeLessThan(400);
    // your desk leaves before the deck lands; the legs lift the deck only once it has rolled in
    expect(TURN.legs).toBeGreaterThanOrEqual(TURN.deckInEnd - 6);
    expect(turnAt(TURN.legs).deck.dz).toBeCloseTo(-80, 6);
    expect(shiftAt(TURN.deckInEnd - 6)[1]).toBeLessThan(20);
    // the reel locks before the jewel lights, the slip enters the throat after both, the row prints after it
    expect(TURN.lock).toBeLessThan(TURN.jewel);
    expect(turnAt(TURN.jewel - 1).tape.jewel).toBe(0);
    expect(TURN.jewel).toBeLessThan(TURN.throat);
    expect(firstSlipAt(TURN.throat - 1)).not.toBeNull();
    expect(turnAt(TURN.print).tape.leader).toBe(1);
    // the intake is in place before the first slip lands on it
    expect(turnAt(TURN.ride).intake.belt!).toBeGreaterThan(0.98);
    // the reading lamp's pool waits for the first read
    expect(turnAt(TURN.throat).tape.reading).toBe(0);
    // labels: "you" once the camera has settled, "Router" 2 f after the lock; the plate turns after the Router's wipe
    expect(TURN.youLabel).toBeGreaterThanOrEqual(1600);
    expect(TURN.routerLabel).toBe(TURN.lock + 2);
    expect(TURN.plate - 6).toBeGreaterThanOrEqual(TURN.routerLabel + 14);
  });

  it('rolls the deck in from beyond the frame’s top edge: nothing of it (nor its shade) in view until it is rolling', () => {
    // its southmost reach, collapsed: the mouth (y 62, up to z 44), the feet's contact (14 + 28 round y 86) and what it
    // casts down the key (the mouth's shadow and penumbra, about 30 u further south): y 20 over the deck's x span
    const reach = (f: number): number => {
      const d = turnAt(f).deck;
      const pose = cameraAt(f, 15);
      let y = -Infinity;
      for (const x of [-420, -200, 0, 200, 360]) for (const z of [0, 22, 44]) y = Math.max(y, project(pose, [x, 20 + d.dy, z])[1]);
      return y;
    };
    let first = -1;
    for (let f = TURN.deckIn; f < TURN.deckInEnd; f++)
      if (reach(f) > 0) {
        first = f;
        break;
      }
    expect(first).toBeGreaterThan(TURN.deckIn);
    // on its first frame in view it has come at least 20 px since the frame before
    expect(reach(first) - reach(first - 1)).toBeGreaterThan(20);
  });

  it('winds all of Fix A’s tape onto the coil before the glide, queue and all, its chutes back in their feeders', () => {
    const t = turnAt(TURN.glide);
    expect(t.fixA.deskLen + t.fixA.spanLen).toBeLessThan(0.5);
    expect(t.fixA.items.every((it) => it === null)).toBe(true);
    expect(t.fixA.chutes!.every((e) => e === 0)).toBe(true);
    expect(A_ITEMS.filter((it) => it.kind === 'task')).toHaveLength(2);
    expect(A_ITEMS.filter((it) => it.kind === 'request')).toHaveLength(1);
    expect(A_TAPE_LEN).toBeGreaterThan(600);
    // nothing in the queue jumps along the tape (it slides, it rides the span, it threads into the coil)
    for (let f = TURN.catch; f < TURN.windEnd; f++) {
      const a = fixATurnAt(f, loopTurnAt(f)).items;
      const b = fixATurnAt(f + 1, loopTurnAt(f + 1)).items;
      a.forEach((it, i) => {
        if (it && b[i]) expect(Math.hypot(b[i]!.p[0] - it.p[0], b[i]!.p[1] - it.p[1], b[i]!.p[2] - it.p[2]), `item ${i} f${f}`).toBeLessThan(90);
      });
    }
  });

  it('keeps one idea at a time: at most three of the turn’s motions run in any frame (MT2 critic: 5-7 ran at f1530-1610)', () => {
    const last = bayTimes(BAY_TRAYS.find((b) => b.id === BAY_ORDER[BAY_ORDER.length - 1])!.k);
    // each window is one visible motion (its own sub-steps following one another); its end is when it has settled
    const windows: [string, number, number][] = [
      ['the loop lifts, turns on edge, coils', TURN.rise, TURN.coilEnd],
      ['the folders are pressed in', TURN.press, TURN.press + TURN.pressGone],
      ['Fix A’s tape end is caught, the coil winds it on, its chutes go home', TURN.catch, TURN.windEnd + 4],
      ['Fix B: the flock home, the trays posted out, the bays walled up and shut one at a time', TURN.replies, last.closed],
      ['your desk slides', TURN.slide, TURN.slideEnd - 4],
      ['the deck rolls in, stands up and unfolds', TURN.deckIn, TURN.parts + 9 + TURN.partFrames - 4],
      ['the reel glides, descends, locks; its leader laid', TURN.glide, TURN.lock + 6],
      ['the belt runs out, the first slip rides it in, its row prints', TURN.belt, TURN.print + TURN.inkFrames],
      ['every other channel joins the intake', TURN.spool, TURN.spool + TURN.spoolFrames],
      ['the chute extends, its posts drop, its first (older) reply slides down it into your in-tray', TURN.chute, Math.max(TURN.posts + TURN.postFrames, OLDER_REPLY.lands)],
      ['the Continuous plate turns over', TURN.plate - 6, TURN.plate + 8],
      ['the request starts out of the heap', REQUEST_FROM, TURN_SPAN[1] + 1],
    ];
    for (const f of ALL) {
      const on = windows.filter(([, a, b]) => f >= a && f < b).map(([n]) => n);
      expect(on.length, `f${f}: ${on.join('; ')}`).toBeLessThanOrEqual(3);
    }
  });

  it('hands act two the world it draws at f1660: the same shadows and pools, your lamp at act two’s level', () => {
    const f = TURN_SPAN[1];
    const t = turnAt(f);
    const s = deskStateAt(f);
    expect(fpSet(turnFootprints(t))).toEqual(fpSet(footprintsAt(s)));
    // the pools that light anything, as a set
    const lit = (ps: { c: readonly number[]; z: readonly number[]; sigma: readonly number[]; rgb: readonly number[] }[]) =>
      ps.filter((p) => Math.max(...p.rgb) > 1e-6).map((p) => [...p.c, ...p.z, ...p.sigma, ...p.rgb].map((x) => x.toFixed(4)).join(',')).sort();
    expect(lit(turnPools(t))).toEqual(lit(poolsAt(s)));
    expect(t.you.bulb).toBeCloseTo(EMIT.bulbMax * LAMP_STEPS.dim, 3);
    expect(t.you.bulbOut ?? 0).toBeLessThan(0.01);
    expect(s.lamp).toBe(LAMP_STEPS.dim);
  });

  it('keeps your desk clear of the notes band while C8 is up', () => {
    for (let f = cue('c8').frame; f <= cue('c8').end!; f++) {
      const t = turnAt(f);
      const pose = cameraAt(f, 15);
      const front: P3 = [YOU.slab.x0 + t.you.shift[0], YOU.slab.y0 + t.you.shift[1], 0];
      const front2: P3 = [YOU.slab.x1 + t.you.shift[0], YOU.slab.y0 + t.you.shift[1], 0];
      expect(project(pose, front)[1]).toBeLessThan(868);
      expect(project(pose, front2)[1]).toBeLessThan(868);
    }
  });

  it('never runs Fix A’s tape through the deck', () => {
    for (let f = TURN.catch; f <= TURN.windEnd; f++) {
      const t = turnAt(f);
      const S = t.fixA.span;
      for (let k = 0; k <= 1; k += 0.05) {
        if (k * S.len > t.fixA.spanLen) continue;
        const p = [S.b[0] + (S.a[0] - S.b[0]) * k, S.b[1] + (S.a[1] - S.b[1]) * k, S.b[2] + (S.a[2] - S.b[2]) * k];
        const over = p[0] > DECK.x0 - 12 && p[0] < DECK.x1 + 12 && p[1] > DECK.y0 - 12 + t.deck.dy && p[1] < DECK.y1 + 12 + t.deck.dy;
        if (over) expect(p[2]).toBeGreaterThan(DECK.top + t.deck.dz + 20);
      }
    }
  });

  it('keeps your lamp on over the rising loop, dims it one step once the loop is handed over, at most 8 pools and 128 footprints', () => {
    // attending (its bulb blooming) from the turn's start through the loop's rise, the coil and the glide
    for (let f = 1400; f < TURN.lampHandOver; f++) expect(youPoseTurn(f).bulb!, `f${f}`).toBeGreaterThan(1);
    // the loop's hand-over is the Continuous plate docking: then one step dimmer, under the bloom's threshold
    expect(TURN.lampHandOver).toBeGreaterThanOrEqual(TURN.plate);
    expect(youPoseTurn(TURN.lampHandOver + 12).bulb!).toBeLessThan(1);
    for (const f of ALL) {
      const t = turnAt(f);
      expect(turnPools(t).length).toBeLessThanOrEqual(MAX_POOLS);
      expect(turnFootprints(t).length, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
  });

  it('shades the loop’s band continuously as it lifts and turns on edge: never under its own chords, in your lamp’s pool while its face is up', () => {
    for (let f = 1400; f < TURN.coil; f++) {
      const t = turnAt(f);
      const r = t.loop.ribbon!;
      const chords = turnFootprints(t).filter((x) => x.kind === 'seg' && Math.abs(x.r - (10 + 2 * (1 - r.edge))) < 1e-9);
      expect(chords, `f${f}`).toHaveLength(16);
      // a receiver on the band (its underside up) is never 0.5 u under a chord: the shaders skip it
      for (const c of chords) if (c.kind === 'seg') expect(Math.max(c.ha, c.hb), `f${f}`).toBeLessThanOrEqual(r.L.z);
      // while its face turns well up (under 0.6 of the way on edge) the whole band and its clip take the pool's full light
      const top = r.L.z + LOOP_A.w * Math.sin((r.edge * Math.PI) / 2) + 12 * r.edge + 10;
      const south: [number, number] = [LOOP_A.c[0], LOOP_A.c[1] - LOOP_A.b];
      if (r.edge < 0.6) expect(poolLight(t, south, top - 0.01), `f${f}`).toBeCloseTo(poolLight(t, south, 1), 6);
    }
    // the pool's top only rises (never a step down on anything in it) until your desk slides
    for (let f = 1400; f < TURN.slide; f++) expect(turnPools(turnAt(f + 1))[0].z[1]).toBeGreaterThanOrEqual(turnPools(turnAt(f))[0].z[1]);
  });

  it('keeps Fix A’s folder and its whole pile in your lamp’s pool from 3.2’s break mark to its press (no step as it is pressed through the pool’s top)', () => {
    const pileTop = A_STACK_END + 0.5 + 0.8 * A_PILE.length + 1;
    for (let f = POOL_A_Z.from; f < 1400; f++) expect(actOnePools(actOneAt(f))[0].z[1]).toBeGreaterThanOrEqual(pileTop);
    for (let f = 1400; f < TURN.press + TURN.pressGone; f++) expect(turnPools(turnAt(f))[0].z[1]).toBeGreaterThanOrEqual(pileTop);
    // when act one's pool takes the taller heights it lies on Fix B, far from Fix A, and no reply is in the air above the low top
    const P = actOnePools(actOneAt(POOL_A_Z.from))[0];
    const d = [(FIX_A_FOLDER.c[0] - P.c[0]) / P.sigma[0], (FIX_A_FOLDER.c[1] - P.c[1]) / P.sigma[1]];
    expect(Math.exp(-0.5 * (d[0] * d[0] + d[1] * d[1]))).toBeLessThan(1e-3);
    for (const sl of fixBOf(POOL_A_Z.from).b.slips) expect(sl.p[2]).toBeLessThan(POOL_A_Z.low);
  });

  it('takes a pressed folder’s paper to the slate’s tone as lit where it lies (never darker than the desk round it)', () => {
    expect(slateToneAt([], [0, 0])).toEqual(linearOf(DESK_HEX.base));
    for (let f = TURN.press; f < TURN.press + TURN.pressGone; f++) {
      const t = turnAt(f);
      expect(t.pressA.tone).toEqual(slateToneAt(turnPools(t), FIX_A_FOLDER.c));
      FOLDERS.forEach((fl, i) => expect(t.press[i].tone).toEqual(slateToneAt(turnPools(t), fl.c)));
      // lit by your lamp's pool, brighter than the bare slate
      expect(t.pressA.tone![1]).toBeGreaterThan(linearOf(DESK_HEX.base)[1]);
    }
  });

  it('sends each of Fix A’s chutes home as the tape’s tail passes it (within 2 f)', () => {
    for (let f = TURN.catch; f <= TURN.windEnd; f++) {
      const A = fixATurnAt(f, loopTurnAt(f));
      expect(aTailAt(f), `f${f}`).toBeCloseTo(A.tape?.d1 ?? aTailAt(f), 6);
      if (A.tape) expect(aTailAt(f)).toBeGreaterThanOrEqual(A_FOLDER_IN);
    }
    A_CHUTES.forEach((c, k) => {
      const f0 = CHUTE_IN[k];
      expect(aTailAt(f0 - 1), `chute ${k}`).toBeGreaterThanOrEqual(c.d - CHUTE_CLEAR);
      expect(aTailAt(f0), `chute ${k}`).toBeLessThan(c.d - CHUTE_CLEAR);
      expect(fixATurnAt(f0, loopTurnAt(f0)).chutes![k]).toBe(1);
      expect(fixATurnAt(f0 + 2, loopTurnAt(f0 + 2)).chutes![k]).toBeLessThan(1);
    });
  });

  it('turns each queued item from grey stock to paper over frames, never in one', () => {
    for (let f = TURN.catch; f < TURN.windEnd; f++) {
      const a = turnAt(f).fixA.items;
      const b = turnAt(f + 1).fixA.items;
      a.forEach((it, i) => {
        if (it && b[i]) expect(Math.abs(b[i]!.paper - it.paper), `item ${i} f${f}`).toBeLessThanOrEqual(0.4);
      });
    }
  });

  it('fades the contact shadows of pressed folders and lifting trays before they go (never a cut of more than half)', () => {
    const key = (x: Footprint) => (x.kind === 'rect' || x.kind === 'circle' ? `${x.kind} ${x.z0 > 0.5 ? 'up' : 'down'} ${Math.round(x.c[0] / 8)},${Math.round(x.c[1] / 8)}` : '');
    const near = (c: readonly number[]) => [...FOLDERS.map((fl) => fl.c), FIX_A_FOLDER.c].some((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) < 140);
    for (let f = TURN.press; f < TURN.press + TURN.pressGone + 1; f++) {
      const next = turnFootprints(turnAt(f + 1));
      for (const x of turnFootprints(turnAt(f))) {
        if ((x.kind !== 'rect' && x.kind !== 'circle') || x.contact < 0.45 || !near(x.c)) continue;
        // a footprint with a strong contact is still there the next frame (near where it was), with no less than half of it
        const y = next.find((n) => (n.kind === 'rect' || n.kind === 'circle') && Math.hypot(n.c[0] - x.c[0], n.c[1] - x.c[1]) < 8 && Math.abs(n.z1 - x.z1) < 20);
        expect(y, `f${f} ${x.kind} at ${x.c.map((v) => v.toFixed(0))}`).toBeDefined();
        if (y && (y.kind === 'rect' || y.kind === 'circle')) expect(x.contact - y.contact, `f${f}`).toBeLessThanOrEqual(0.5);
      }
    }
    void key;
    // the loop's clip (it lifts with the loop: its contact halves on the rise's first frame and is gone by 3.2 u)
    const clipOf = (f: number) => turnFootprints(turnAt(f)).find((x) => x.kind === 'circle' && x.r === 26);
    for (let f = TURN.hit; f < TURN.edge + 4; f++) {
      const [a, b] = [clipOf(f), clipOf(f + 1)];
      if (a?.kind !== 'circle' || b?.kind !== 'circle') throw new Error(`f${f}: the clip's footprint`);
      expect(a.contact - b.contact, `clip f${f}`).toBeLessThanOrEqual(0.5);
    }
    for (const k of RETIRE_TRAYS) {
      const t0 = Math.floor(retireStarts(k));
      // the contact the shaders draw: none once its underside is over 2 u up
      const c = (f: number) => (retireAt(k, f).off[2] > 2 ? 0 : retireContact(k, f));
      for (let f = t0; f < t0 + TURN.retireAntic + 1; f++) expect(c(f) - c(f + 1), `tray ${k} f${f}`).toBeLessThanOrEqual(0.45);
    }
  });

  it('opens each bay’s lid over a few frames gathering speed; what lay in its tray falls into the pit toward its near wall before the leaves shut', () => {
    for (const { k, id } of BAY_TRAYS) {
      const T = bayTimes(k);
      const at = (f: number) => turnAt(f).fixB.bays.find((b) => b.id === id)!;
      expect(at(T.open + LEAVES_OPEN).leaves).toBe(1);
      expect(LEAVES_OPEN).toBeGreaterThanOrEqual(3);
      // gathering speed (the Hatch's angle is open²): the first frame's swing is the smallest
      expect(at(T.open + 1).leaves ** 2).toBeLessThan(0.1);
      expect(at(T.shut - 1).fall).toBe(1);
      // the pit darkens by depth only (no hard shadow on the frame the leaves leave the slate's plane)
      for (let f = T.open; f < T.closed; f++) expect(turnFootprints(turnAt(f)).some((x) => x.kind === 'rect' && x.z1 === 0 && x.z0 === -1)).toBe(false);
    }
  });

  it('takes your lid strut home to its recess as your desk slides (never a one-frame swap), and brings the older reply down the chute into your in-tray before the hand-off', () => {
    expect(strutTurnAt(STRUT_HOME.from)).toEqual({ strut: 'lid' });
    expect(strutTurnAt(STRUT_HOME.from + STRUT_HOME.frames)).toEqual({ strut: 'tray' });
    let prev = strutEnds(youPoseTurn(STRUT_HOME.from));
    expect(prev).toEqual(strutOnLid());
    for (let f = STRUT_HOME.from + 1; f <= STRUT_HOME.from + STRUT_HOME.frames; f++) {
      const e = strutEnds(youPoseTurn(f));
      expect(Math.hypot(e.a[0] - prev.a[0], e.a[1] - prev.a[1], e.a[2] - prev.a[2]), `f${f}`).toBeLessThan(35);
      expect(Math.hypot(e.b[0] - prev.b[0], e.b[1] - prev.b[1], e.b[2] - prev.b[2]), `f${f}`).toBeLessThan(35);
      prev = e;
    }
    // its recess's footprint closes in round it over the hop's last frames: contact and shade by amount, the same on landing
    const recess = (f: number) => {
      const P = youPoseTurn(f);
      const e = strutEnds(P);
      // the rect centred under the strut (in its recess at rest: CHORES.strut)
      return youFootprints(P).find((x) => x.kind === 'rect' && Math.hypot(x.c[0] - P.shift[0] - (e.a[0] + e.b[0]) / 2, x.c[1] - P.shift[1] - (e.a[1] + e.b[1]) / 2) < 1);
    };
    for (let f = STRUT_HOME.from + 1; f <= STRUT_HOME.from + STRUT_HOME.frames + 2; f++) {
      const [a, b] = [recess(f - 1), recess(f)];
      const [ca, cb] = [a?.kind === 'rect' ? a.contact : 0, b?.kind === 'rect' ? b.contact : 0];
      expect(Math.abs(cb - ca), `f${f}`).toBeLessThanOrEqual(0.3);
      if (a?.kind === 'rect' && b?.kind === 'rect') expect(Math.abs(b.z1 - a.z1), `f${f}`).toBeLessThan(3.5);
    }
    expect(recess(STRUT_HOME.from + STRUT_HOME.frames)).toBeDefined();
    // the in-tray is empty from the flock until the reply lands; it lands at act two's slip's place, still before f1660
    for (let f = TURN.replies + 30; f < OLDER_REPLY.lands; f++) expect(youPoseTurn(f).inTraySlip, `f${f}`).toBe(false);
    expect(youPoseTurn(OLDER_REPLY.lands).inTraySlip).toBe(true);
    expect(OLDER_REPLY.lands).toBeLessThanOrEqual(TURN_SPAN[1] - 2);
    const last = olderReplyAt(OLDER_REPLY.lands - 1)!;
    expect(Math.hypot(last.p[0] - OLDER_REPLY_REST.p[0], last.p[1] - OLDER_REPLY_REST.p[1], last.p[2] - OLDER_REPLY_REST.p[2])).toBeLessThan(40);
    for (let f = OLDER_REPLY.leave; f < OLDER_REPLY.lands - 1; f++) {
      const a = olderReplyAt(f)!;
      const b = olderReplyAt(f + 1)!;
      expect(Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]), `f${f}`).toBeLessThan(40);
    }
    expect(olderReplyAt(OLDER_REPLY.lands)).toBeNull();
    // the chute it slides down is out before it comes out from under the deck
    expect(turnAt(OLDER_REPLY.leave + 5).parts.chute).toBeGreaterThan(0.99);
  });

  it('never lights or darkens anything in one frame as the pool’s top rises with the loop (your lamp’s hood and arm, the clip, the coil’s top)', () => {
    // the pools' light (green) at your lamp's head and at the loop's centre (the coil), at every height, frame to frame
    const head = youPoseTurn(1450).lamp.head;
    const shift = youPoseTurn(1450).shift;
    const places: [number, number][] = [[head[0] + shift[0], head[1] + shift[1]], [LOOP_A.c[0], LOOP_A.c[1]]];
    for (let f = 1400; f < TURN.slide; f++)
      for (const c of places)
        for (const z of [90, 100, 110, 116, 120, 125, 130, 140, 145, 155, 165, 175, 185, 195, 205, 230, 260]) {
          expect(Math.abs(poolLight(turnAt(f + 1), c, z) - poolLight(turnAt(f), c, z)), `f${f} ${c} z${z}`).toBeLessThan(0.15);
        }
    // the coil's top (it comes up as the band stands on edge) is never lit by your lamp's pool: never blown to white
    for (let f = TURN.coil; f < TURN.slide; f++) {
      const C = turnAt(f).loop.coil!;
      expect(poolLight(turnAt(f), [C.c[0], C.c[1]], C.h + C.t + 0.25), `f${f}`).toBeLessThan(0.02);
    }
  });

  it('lights every row of the loop’s band alike as it rises through the pools’ heights: no hard line swept down it', () => {
    // a row of the band (h of its width up from its underside, as its face turns up), at four places round it
    const rowZ = (f: number, h: number) => {
      const r = turnAt(f).loop.ribbon!;
      return r.L.z + h * LOOP_A.w * Math.sin((r.edge * Math.PI) / 2);
    };
    // the light above your lamp's band fades only once all of the band is over the upper pool's top
    expect(turnAt(HIGH_POOL.from).loop.ribbon!.L.z).toBeGreaterThanOrEqual(UPPER_POOL.top);
    expect(turnAt(HIGH_POOL.from - 1).loop.ribbon!.L.z).toBeLessThan(UPPER_POOL.top);
    expect(HIGH_POOL.to).toBeLessThanOrEqual(TURN.coil);
    for (let f = TURN.hit; f < TURN.coil - 1; f++) {
      const [r0, r1] = [turnAt(f).loop.ribbon!, turnAt(f + 1).loop.ribbon!];
      for (const [ux, uy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const steps = [0, 0.25, 0.5, 0.75, 1].map((h) => {
          const a = poolLight(turnAt(f), [r0.L.c[0] + ux * r0.L.a, r0.L.c[1] + uy * r0.L.b], rowZ(f, h));
          const b = poolLight(turnAt(f + 1), [r1.L.c[0] + ux * r1.L.a, r1.L.c[1] + uy * r1.L.b], rowZ(f + 1, h));
          return b - a;
        });
        // each row changes by amount (the fade's 10 f), and every row of the band by the same amount
        for (const d of steps) expect(Math.abs(d), `f${f}`).toBeLessThan(0.16);
        expect(Math.max(...steps) - Math.min(...steps), `f${f} (${ux},${uy})`).toBeLessThan(0.03);
      }
    }
  });

  it('casts Fix A’s folder at its real height across the f1399/f1400 seam (its 79 u stack and pile), and presses it under the slate', () => {
    const body = (fps: Footprint[]) => fps.find((x) => x.kind === 'rect' && Math.hypot(x.c[0] - FIX_A_FOLDER.c[0], x.c[1] - FIX_A_FOLDER.c[1]) < 1 && Math.abs(x.h[0] - FIX_A_FOLDER.w / 2) < 1);
    const a = body(actOneFrameFootprints(1399));
    const b = body(turnFootprints(turnAt(1400)));
    expect(a).toBeDefined();
    expect(b).toEqual(a);
    expect(a!.kind === 'rect' && a!.z1).toBeCloseTo(A_STACK_END + 0.4, 6);
  });
});

describe('the coil keeps the loop until Fix A’s tape has wound over it (the turn’s code review, MAJOR 6)', () => {
  it('grows from the ribbon’s height to the pack’s with the coil, never more than a unit a frame', () => {
    for (let f = TURN.coil; f < TURN.lock; f++) {
      const c = loopTurnAt(f).coil!;
      expect(c.t, `f${f}`).toBeGreaterThanOrEqual(Math.min(LOOP_A.w, PACK_H) - 0.5);
      expect(c.t, `f${f}`).toBeLessThanOrEqual(Math.max(LOOP_A.w, PACK_H) + 0.5);
      if (f > TURN.coil) expect(Math.abs(c.t - loopTurnAt(f - 1).coil!.t), `f${f}`).toBeLessThan(1);
    }
    expect(loopTurnAt(TURN.lock).coil!.t).toBeCloseTo(PACK_H, 3);
  });
  it('is wound over from TURN.wind as it turns, once round by WRAP_FULL, its rim easing out to the pack’s with it', () => {
    for (let f = TURN.coil; f < TURN.wind; f++) {
      const c = loopTurnAt(f).coil!;
      expect(c.wrap, `f${f}`).toBe(0);
      expect(c.rim, `f${f}`).toBeCloseTo(COIL_R0, 9);
    }
    let prev = 0;
    for (let f = TURN.wind; f < TURN.lock; f++) {
      const c = loopTurnAt(f).coil!;
      expect(c.wrap, `f${f}`).toBeGreaterThanOrEqual(prev);
      // the coil carries the wound end round at its own turn (never faster than a turn in 8 f)
      expect(c.wrap - prev, `f${f}`).toBeLessThan((2 * Math.PI) / 8);
      // (the pack grows as it winds: at most 3 u a frame, while the coil turns 30° and more)
      expect(Math.abs(c.rim - (f > TURN.wind ? loopTurnAt(f - 1).coil!.rim : COIL_R0)), `f${f}`).toBeLessThan(3);
      prev = c.wrap;
    }
    expect(loopTurnAt(WRAP_FULL - 1).coil!.wrap).toBeLessThan(2 * Math.PI);
    expect(loopTurnAt(WRAP_FULL).coil!.wrap).toBe(2 * Math.PI);
    expect(loopTurnAt(WRAP_FULL).coil!.rim).toBeCloseTo(loopTurnAt(WRAP_FULL).coil!.rOut, 9);
  });
  it('holds Fix A’s tape where the ribbon held it as the coil takes over (its span’s end does not jump, so neither does the tape on the desk)', () => {
    const b = (f: number) => turnAt(f).fixA.span.b;
    const at = b(TURN.coil);
    const before = b(TURN.coil - 1);
    expect(Math.abs(at[2] - before[2])).toBeLessThan(0.2);
    // (then it settles to the pack's middle with the coil, under a unit a frame)
    for (let f = TURN.coil + 1; f < TURN.glide; f++) expect(Math.abs(b(f)[2] - b(f - 1)[2]), `f${f}`).toBeLessThan(1);
  });
  it('lands the tape’s span end on the turn it is wound onto while it winds (never in the air outside the partial wrap)', () => {
    for (let f = TURN.wind; f <= WRAP_FULL; f++) {
      const c = loopTurnAt(f).coil!;
      const b = turnAt(f).fixA.span.b;
      const r = wrapRadius(c);
      expect(Math.abs(Math.hypot(b[0] - c.c[0], b[1] - c.c[1]) - r), `f${f}`).toBeLessThan(1);
      if (f > TURN.wind) {
        const a = turnAt(f - 1).fixA.span.b;
        expect(Math.hypot(b[0] - a[0], b[1] - a[1]), `f${f}`).toBeLessThan(3);
      }
    }
  });
  it('takes the reel’s paper by amount over STOCK_FRAMES once the loop’s turn is under the new tape, before the glide', () => {
    for (let f = TURN.coil; f <= WRAP_FULL; f++) expect(loopTurnAt(f).coil!.stock, `f${f}`).toBeCloseTo(0, 12);
    for (let f = WRAP_FULL + 1; f < TURN.lock; f++) expect(Math.abs(loopTurnAt(f).coil!.stock - loopTurnAt(f - 1).coil!.stock), `f${f}`).toBeLessThan(1.6 / STOCK_FRAMES);
    expect(WRAP_FULL + STOCK_FRAMES).toBeLessThanOrEqual(TURN.glide);
    expect(loopTurnAt(TURN.glide).coil!.stock).toBe(1);
  });
});

describe('the Register’s footprints ride the deck as it is drawn (its tilt too), so nothing on it is shaded by its own support (A18)', () => {
  it('keeps the deck plate’s top out of the plate’s own shadow while the legs settle, and is the layout’s at rest', () => {
    const isPlate = (x: Footprint) => x.kind === 'rect' && Math.abs(x.h[0] - (DECK_PLATE.x1 - DECK_PLATE.x0) / 2) < 1e-6 && Math.abs(x.h[1] - (DECK_PLATE.y1 - DECK_PLATE.y0) / 2) < 1e-6;
    for (let f = TURN.legs; f <= TURN.legs + 40; f++) {
      const d = deckTurnAt(f);
      const plate = turnFootprints(turnAt(f)).filter(isPlate);
      expect(plate, `f${f}`).toHaveLength(1);
      const z1 = (plate[0] as { z1: number }).z1;
      // every point of its top, as drawn, is at or over the footprint's top (the shader casts only from z1 > zr + 0.5, zr = z - 0.5)
      for (let x = DECK_PLATE.x0; x <= DECK_PLATE.x1; x += 20)
        for (let y = DECK_PLATE.y0; y <= DECK_PLATE.y1; y += 20) expect(z1, `f${f} (${x}, ${y})`).toBeLessThanOrEqual(deckPoint(d, [x, y, DECK.top])[2] + 1e-9);
    }
    // at rest the pose is the identity: the plate's footprint is the layout's, exactly
    const rest = turnFootprints(turnAt(1660)).filter(isPlate)[0] as Extract<Footprint, { kind: 'rect' }>;
    expect(rest.c).toEqual([(DECK_PLATE.x0 + DECK_PLATE.x1) / 2, (DECK_PLATE.y0 + DECK_PLATE.y1) / 2]);
    expect(rest.z0).toBe(DECK.top - 6);
    expect(rest.z1).toBe(DECK.top);
  });
});

describe('the first chat slip into the throat (R2-L1-02)', () => {
  const dAng = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  it('posts, rides and hops over the cheeks as beat 6’s carriers do: never turned or tilted in a frame, flat before it lies in the throat', () => {
    // (it rode straight into the jaw tilted 0.45 rad and turned 0.45 rad, then lay flat across the jaw in one frame, f1619-1620)
    for (let f = TURN.post - FIRST_OUT + 1; f < TURN.throat + TURN.feedFrames; f++) {
      const a = firstSlipAt(f - 1)!;
      const b = firstSlipAt(f)!;
      expect(dAng(a.heading, b.heading), `f${f}`).toBeLessThan(0.15);
      expect(Math.abs(a.slope - b.slope), `f${f}`).toBeLessThan(0.15);
      // from the crest on, the hop settles: never a drop of 12 u in a frame
      if (f > FIRST_HOP) expect(a.p[2] - b.p[2], `f${f}`).toBeLessThan(12);
    }
    // in the belt's pose on its landing on the gate and up to its crest; flat from the frame before it lies in the throat
    expect(firstSlipAt(TURN.ride)!.p).toEqual(NEXT_SLIP.gate);
    expect(firstSlipAt(TURN.ride)!.slope).toBeCloseTo(BELT_SLOPE, 6);
    expect(firstSlipAt(FIRST_HOP)!.p).toEqual(CARRIERS.chat.crest);
    expect(firstSlipAt(TURN.throat - 1)!.heading).toBeCloseTo(0, 6);
    expect(firstSlipAt(TURN.throat - 1)!.slope).toBeCloseTo(0, 6);
    expect(firstSlipAt(TURN.throat)!.p).toEqual(NEXT_SLIP.throat);
    // its last drop onto the throat's floor a settle
    expect(firstSlipAt(TURN.throat - 1)!.p[2] - NEXT_SLIP.throat[2]).toBeLessThan(4);
  });
  it('comes out of the spout from inside the chat drum over FIRST_OUT frames, as every chat slip (it had appeared 42 u out of it, RV-TURN-SPOUT-POP)', () => {
    expect(firstSlipAt(TURN.post - FIRST_OUT - 1)).toBeNull();
    expect(firstSlipAt(TURN.post - FIRST_OUT)!.p).toEqual(SPOUT_INSIDE);
    expect(firstSlipAt(TURN.post)!.p).toEqual(NEXT_SLIP.spout);
    // out along the spout's axis, square to it, slowing to rest at its mouth for the anticipation
    let last = Infinity;
    for (let f = TURN.post - FIRST_OUT + 1; f <= TURN.post; f++) {
      const [a, b] = [firstSlipAt(f - 1)!, firstSlipAt(f)!];
      // (square to the spout while it comes out; it starts turning to aim at the gate as it comes to rest at its mouth)
      if (f < TURN.post) expect(b.heading, `f${f}`).toBe(0);
      else expect(Math.abs(b.heading), `f${f}`).toBeLessThan(0.06);
      expect(b.p[1], `f${f}`).toBe(NEXT_SLIP.spout[1]);
      const step = b.p[0] - a.p[0];
      expect(step, `f${f}`).toBeGreaterThan(0);
      expect(step, `f${f}`).toBeLessThan(last);
      last = step;
    }
  });
  it('never shades its own top face by its footprint (on the belt’s slope its lower half had sat under it)', () => {
    for (let f = TURN.post - FIRST_OUT; f < TURN.throat + TURN.feedFrames; f++) {
      const sl = firstSlipAt(f)!;
      const own = turnFootprints(turnAt(f)).find((fp) => fp.kind === 'rect' && fp.c[0] === sl.p[0] && fp.c[1] === sl.p[1] && fp.rot === sl.heading && fp.h[1] === NEXT_SLIP.w / 2);
      expect(own, `f${f}`).toBeDefined();
      const low = sl.p[2] + 0.4 * Math.cos(sl.slope) - (NEXT_SLIP.l / 2) * Math.abs(Math.sin(sl.slope));
      if (own?.kind === 'rect') expect(low, `f${f}`).toBeGreaterThanOrEqual(own.z1 + 0.1);
    }
  });
});
