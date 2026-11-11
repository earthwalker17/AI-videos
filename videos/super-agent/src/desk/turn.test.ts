import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { MOTION_TESTS } from '../lookdev/frames.ts';
import { actOneFrameFootprints, fixAOf, fixBOf } from './ActOneFrame.tsx';
import { FLAG, FOLDERS, LOOP_A, PEN, actOneAt, actOnePools, stackTop, youPoseA } from './actOne.ts';
import { A_ITEMS, A_PILE, A_STACK_END, BAY_TRAYS, FIX_A_FOLDER, IMPRINTS, RETIRE_TRAYS, TRAYS, TRAY_Z } from './beat3.ts';
import { FRAMING_B, cameraAt, deskCamera, project } from './camera.ts';
import { REQUEST_FROM } from './beat4.ts';
import { MAX_FOOTPRINTS, footprintsAt, type Footprint } from './footprints.ts';
import { BAYS, DECK, REEL, SPOOL, YOU, type P3 } from './layout.ts';
import { EMIT, MAX_POOLS, poolsAt } from './pools.ts';
import { LAMP_STEPS, deskStateAt } from './state.ts';
import {
  A_TAPE_LEN,
  BAY_ORDER,
  COIL_R0,
  PRESS_LATE,
  SPOOL_NORTH,
  TESTS_SLIDE,
  TURN,
  TURN_SPAN,
  bayShapeAt,
  bayTimes,
  firstSlipAt,
  fixATurnAt,
  foldPressAt,
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
  youPoseTurn,
} from './turn.ts';
import { YOU_POSE_B } from './you.ts';

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
    expect(s.testsStep).toBe(0);
    // your desk and lamp
    expect(t.you.lamp).toEqual(youPoseA(actOneAt(1400)).lamp);
    expect(t.you.shift).toEqual(youPoseA(actOneAt(1400)).shift);
    expect(t.you.bulb).toBe(youPoseA(actOneAt(1400)).bulb);
    // Fix A's tape, queue and folder as beat 3 leaves them (its last station only starts on this frame)
    const A = fixAOf(1399);
    expect(t.fixA.tape).toEqual(A.tape);
    expect(t.fixA.items.map((x) => x!.p)).toEqual(A.items.filter((x) => x !== null).map((x) => x!.p));
    expect(t.fixA.stackTop).toBe(A.stackTop);
    expect(t.fixA.requestInk).toBe(A.requestInk);
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

  it('presses the folders down on a spring with their pens, flags and piles, into the slate’s tone before they go under (nothing vanishes)', () => {
    let prev = foldPressAt(TURN.press);
    expect(prev.k).toBe(0);
    for (let f = TURN.press + 1; f < TURN.press + TURN.pressGone; f++) {
      const p = foldPressAt(f);
      // a spring: it only goes down, and the tone only comes in
      expect(p.scaleZ).toBeLessThanOrEqual(prev.scaleZ + 1e-9);
      expect(p.sink).toBeGreaterThanOrEqual(prev.sink - 1e-9);
      expect(p.slate!).toBeGreaterThanOrEqual(prev.slate! - 1e-9);
      prev = p;
    }
    // about 8 f to flat, h 0 → −2
    expect(foldPressAt(TURN.press + 8).scaleZ).toBeLessThan(0.05);
    expect(foldPressAt(TURN.press + 8).sink).toBeGreaterThan(2);
    // its last drawn frame: in the slate's tone, the imprint in, and every part (the lifted pen, the flag, Fix A's pile) under the slate
    const last = foldPressAt(TURN.press + TURN.pressGone - 1);
    expect(last.slate).toBeGreaterThan(0.999);
    expect(slateAt(TURN.press + TURN.pressGone - 1) * PRESS_LATE).toBeCloseTo(PRESS_LATE, 3);
    expect(imprintsAt(turnAt(TURN.press + TURN.pressGone - 1)).every((d) => d === 1)).toBe(true);
    for (const fl of FOLDERS) expect((stackTop(fl) + 1.2 + PEN.lift + 8) * last.scaleZ - last.sink, `F${fl.n} pen`).toBeLessThan(0);
    for (const fl of FOLDERS) expect((stackTop(fl) + 1 + FLAG.staff + FLAG.plate[1]) * last.scaleZ - last.sink, `F${fl.n} flag`).toBeLessThan(0);
    expect((A_STACK_END + 0.5 + 0.8 * A_PILE.length + 2) * last.scaleZ - last.sink).toBeLessThan(0);
    expect(foldPressAt(TURN.press + TURN.pressGone).k).toBe(1);
    // the kit's late ramp carries the pens to the slate's tone while the folders are drawn, then lets go
    expect(turnDeskState(TURN.press + TURN.pressGone - 1).testsStep).toBeCloseTo(PRESS_LATE, 3);
    expect(turnDeskState(TURN.press + TURN.pressGone).testsStep).toBeCloseTo(0, 9);
  });

  it('lets every part emerge over frames from a visible source', () => {
    // the coil takes over from the round ribbon at its own radius, height and width (no jump)
    const r = turnAt(TURN.coil - 1).loop.ribbon!;
    const c = turnAt(TURN.coil).loop.coil!;
    expect(r.edge).toBeGreaterThan(0.98);
    expect(Math.abs(r.L.a - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.rOut - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.h - r.h)).toBeLessThan(1);
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
      ['the chute extends, its posts drop', TURN.chute, TURN.posts + TURN.postFrames],
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
});
