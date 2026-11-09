import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { MOTION_TESTS } from '../lookdev/frames.ts';
import { ACT_ONE_LABELS } from './ActOneFrame.tsx';
import { FOLDERS, LOOP_A, actOneAt, actOnePools, youPoseA } from './actOne.ts';
import { A_ITEMS, BAY_TRAYS, IMPRINTS, PRESS_TRAYS, TRAYS } from './beat3.ts';
import { FRAMING_B, cameraAt, deskCamera, project } from './camera.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { BAYS, DECK, REEL, SPOOL, YOU, type P3 } from './layout.ts';
import { EMIT, MAX_POOLS } from './pools.ts';
import {
  A_TAPE_LEN,
  COIL_R0,
  SPOOL_NORTH,
  TURN,
  TURN_SPAN,
  bayTimes,
  firstSlipAt,
  imprintsAt,
  replyLands,
  shiftAt,
  trayStarts,
  turnAt,
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

  it('holds still from the pens lifting until the focus pull, then until the hit (stillness before the climax)', () => {
    const ref = still(TURN.still + 4);
    for (let f = TURN.still + 4; f < TURN.stepIn; f++) expect(still(f)).toBe(ref);
    expect(TURN.hit - (TURN.still + 4)).toBeGreaterThanOrEqual(10);
    // the focus pull leads the camera: the step-down starts before the move and is complete soon after it starts
    expect(TURN.stepIn).toBeLessThan(TURN.hit);
    expect(turnAt(TURN.stepIn + TURN.stepFrames).step).toBeCloseTo(1, 6);
  });

  it('starts as act one plus beat 3 at f1400 (the same lamp, pool and label)', () => {
    const t = turnAt(1400);
    expect(t.act).toEqual(actOneAt(1400));
    expect(t.you.lamp).toEqual(youPoseA(actOneAt(1400)).lamp);
    expect(t.you.shift).toEqual(youPoseA(actOneAt(1400)).shift);
    expect(t.you.bulb).toBe(youPoseA(actOneAt(1400)).bulb);
    expect(turnPools(t)[0].c).toEqual(actOnePools(actOneAt(1400))[0].c);
    const L = t.loop.ribbon!.L;
    expect([L.c, L.a, L.b, L.n]).toEqual([LOOP_A.c, LOOP_A.a, LOOP_A.b, LOOP_A.n]);
    expect(t.press.every((p) => p.k === 0) && t.pressA.k === 0).toBe(true);
    expect(t.fixB.bays.every((b) => b.grow === 0 && b.rise === 0)).toBe(true);
    expect(t.fixA.items.every((it) => it !== null)).toBe(true);
    // your act-one label is still there (it leaves as the camera moves), the act-two labels are not yet
    expect(t.labels.youA).toEqual({ leader: 1, wipe: 1 });
    expect(t.labels.you).toBeNull();
    expect(t.labels.router).toBeNull();
    expect(ACT_ONE_LABELS).toHaveLength(1);
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
    expect(t.step).toBe(0);
    expect(turnHoles(t)).toHaveLength(0);
  });

  it('turns eight event trays into three task bays: five pressed into imprints, three walled up as (b)’s bays', () => {
    expect(PRESS_TRAYS.length + BAY_TRAYS.length).toBe(TRAYS.length);
    expect(new Set([...PRESS_TRAYS, ...BAY_TRAYS.map((b) => b.k)]).size).toBe(TRAYS.length);
    expect(new Set(BAY_TRAYS.map((b) => b.id))).toEqual(new Set(Object.keys(BAYS)));
    const t = turnAt(1660);
    for (const k of PRESS_TRAYS) expect(t.fixB.press[k]!.k).toBe(1);
    for (const b of t.fixB.bays) {
      expect(b.grow).toBeGreaterThan(0.999);
      expect(b.rise).toBeGreaterThan(0.999);
      expect(b.print).toBe(1);
      expect(b.slide).toBe(1);
    }
    // every bay is up before the reel descends, so the reel's lock is the only motion then
    for (const { k } of BAY_TRAYS) expect(bayTimes(k).risen).toBeLessThanOrEqual(TURN.descend);
  });

  it('presses every folder, act one’s and Fix A’s, and five trays into their imprints', () => {
    expect(IMPRINTS).toHaveLength(FOLDERS.length + 1 + PRESS_TRAYS.length);
    expect(IMPRINTS.slice(0, FOLDERS.length).map((m) => m.c)).toEqual(FOLDERS.map((fl) => fl.c));
    expect(IMPRINTS.slice(FOLDERS.length + 1).map((m) => m.c)).toEqual(PRESS_TRAYS.map((k) => TRAYS[k].c));
  });

  it('never swaps anything in one frame: every body is pressed over 8 f and only leaves once it is under the slate', () => {
    for (const f of ALL.slice(0, -1)) {
      const a = turnAt(f);
      const b = turnAt(f + 1);
      for (const [p, q] of [...a.press.map((p, i) => [p, b.press[i]] as const), [a.pressA, b.pressA] as const]) {
        expect(q.k - p.k).toBeLessThanOrEqual(1 / TURN.pressFrames + 1e-9);
        expect(Math.abs(q.scaleZ - p.scaleZ)).toBeLessThan(0.3);
      }
    }
    // the last pressed frame: squashed flat and sunk (the top under the slate) before the body is dropped
    for (let i = 0; i < FOLDERS.length; i++) {
      const p = turnAt(TURN.press + TURN.pressStagger * (i + 1) + TURN.pressFrames - 1).press[i];
      expect(p.scaleZ).toBeLessThan(0.1);
      expect(p.sink).toBeGreaterThan(3);
    }
    // the imprint is fully in before its body sinks into it
    const p = turnAt(TURN.press + 5).pressA;
    expect(imprintsAt(turnAt(TURN.press + 5))[FOLDERS.length]).toBe(1);
    expect(p.sink).toBe(0);
  });

  it('lets every part emerge over frames from a visible source', () => {
    // the coil takes over from the round ribbon at its own radius, height and width (no jump)
    const r = turnAt(TURN.coil - 1).loop.ribbon!;
    const c = turnAt(TURN.coil).loop.coil!;
    expect(r.edge).toBeGreaterThan(0.98);
    expect(Math.abs(r.L.a - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.rOut - COIL_R0)).toBeLessThan(2);
    expect(Math.abs(c.h - r.h)).toBeLessThan(1);
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
    // a bay's hatch opens only under its tray's floor, and its work rises only once the floor is sliding away
    for (const { k } of BAY_TRAYS) {
      const T = bayTimes(k);
      expect(turnAt(T.drop - 1).fixB.bays.find((_, i) => BAY_TRAYS[i].k === k)!.hatch).toBe(false);
      expect(T.rise).toBeGreaterThan(T.slide);
      expect(turnAt(T.rise).fixB.bays.find((_, i) => BAY_TRAYS[i].k === k)!.rise).toBe(0);
    }
    // the row prints with a 3 f ink spread after the head has dropped over 4 f
    expect(turnAt(TURN.print - 1).tape.ink).toBe(-1);
    expect([0, 1, 2, 3].map((d) => turnAt(TURN.print + d).tape.ink)).toEqual([0, 1, 2, 3]);
    expect(turnAt(TURN.headDrop).tape.hammer).toBe(0);
    expect(turnAt(TURN.print).tape.hammer).toBeCloseTo(1, 6);
    // your act-one label leaves over 6 f as the camera moves; the act-two ones re-enter
    expect(turnAt(TURN.youOut + 6).labels.youA!.leader).toBe(0);
    expect(turnAt(TURN.youOut + 7).labels.youA).toBeNull();
    expect(turnAt(TURN.youOut + 2).labels.youA!.wipe).toBeGreaterThan(0);
  });

  it('acts only after its cause', () => {
    // the loop lifts only after the hit; the dip comes first
    for (let f = 1400; f < TURN.rise; f++) expect(turnAt(f).loop.ribbon!.h).toBeCloseTo(LOOP_A.z, 6);
    expect(turnAt(TURN.riseEnd).loop.coil?.h ?? turnAt(TURN.riseEnd).loop.ribbon!.h).toBeGreaterThan(155);
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

  it('winds all of Fix A’s tape onto the coil before the glide, queue and all', () => {
    const t = turnAt(TURN.glide);
    expect(t.fixA.deskLen + t.fixA.spanLen).toBeLessThan(0.5);
    expect(t.fixA.items.every((it) => it === null)).toBe(true);
    expect(A_ITEMS.filter((it) => it.kind === 'task')).toHaveLength(3);
    expect(A_ITEMS.findIndex((it) => it.kind === 'request')).toBe(12);
    expect(A_TAPE_LEN).toBeGreaterThan(900);
  });

  it('keeps one idea at a time: at most three of the turn’s motions overlap in any frame', () => {
    const windows: [number, number][] = [
      [TURN.rise, TURN.coilEnd], // the loop becomes a coil
      [TURN.press, TURN.press + TURN.pressStagger * FOLDERS.length + TURN.pressFrames], // the folders pressed
      [TURN.wind, TURN.windEnd], // Fix A winds on
      [TURN.slide, TURN.slideEnd - 10], // your desk slides
      [TURN.deckIn, TURN.legs + 3 * TURN.legStagger + TURN.legFrames - 6], // the deck arrives and stands up
      [replyLands(7) - TURN.replyArc, bayTimes(BAY_TRAYS[BAY_TRAYS.length - 1].k).risen], // Fix B
      [TURN.glide, TURN.lock], // the reel glides, descends, locks
      [TURN.belt, TURN.calendar + TURN.flattenFrames], // the intake
    ];
    for (const f of ALL) expect(windows.filter(([a, b]) => f >= a && f < b).length).toBeLessThanOrEqual(3);
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
    for (let f = TURN.wind; f <= TURN.windEnd; f++) {
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

  it('keeps the light rule: your bulb pulls in below the bloom threshold once F3 is pressed, at most 8 pools and 128 footprints', () => {
    expect(youPoseTurn(1400).bulb!).toBeGreaterThan(1);
    expect(youPoseTurn(TURN.lampDim + 12).bulb!).toBeLessThan(1);
    expect(youPoseTurn(TURN.slideEnd).bulb ?? EMIT.bulbMax).toBeLessThan(1);
    for (let f = 1400; f <= 1660; f += 2) {
      const t = turnAt(f);
      expect(turnPools(t).length).toBeLessThanOrEqual(MAX_POOLS);
      expect(turnFootprints(t).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
  });
});
