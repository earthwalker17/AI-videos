import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { MOTION_TESTS } from '../lookdev/frames.ts';
import { ACT_ONE_LABELS } from './ActOneFrame.tsx';
import { FOLDERS, LOOP_A, actOneAt, actOnePools, youPoseA } from './actOne.ts';
import { A_ITEMS, BAY_TRAYS, IMPRINTS, PRESS_TRAYS, TRAYS } from './beat3.ts';
import { FRAMING_B, cameraAt, deskCamera, project } from './camera.ts';
import { B4 } from './beat4.ts';
import { MAX_FOOTPRINTS, footprintsAt, type Footprint } from './footprints.ts';
import { BAYS, DECK, REEL, SPOOL, YOU, type P3 } from './layout.ts';
import { EMIT, MAX_POOLS, poolsAt } from './pools.ts';
import { LAMP_STEPS, deskStateAt } from './state.ts';
import {
  A_TAPE_LEN,
  BAY_ORDER,
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
    expect(t.fixB.bays.every((b) => b.grow === 0 && !b.hole && !b.done)).toBe(true);
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
      expect(b.print).toBe(1);
      expect(b.slide).toBe(1);
      // closed and idle: its hatch shut, its hole closed, nothing of its work up (beat 4 dispatches it)
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
    // every bay is closed before the reel descends, so the reel's lock is the only big motion then; and one at a time
    for (const { k } of BAY_TRAYS) expect(bayTimes(k).closed).toBeLessThanOrEqual(TURN.descend);
    const starts = BAY_ORDER.map((id) => bayTimes(BAY_TRAYS.find((b) => b.id === id)!.k));
    for (let i = 1; i < starts.length; i++) expect(starts[i].grow).toBeGreaterThanOrEqual(starts[i - 1].grow + TURN.bayGap);
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
    // a bay's hatch opens only under its tray's floor; its leaves shut only once the floor has slid away; its hole closes once they are shut
    for (const { k } of BAY_TRAYS) {
      const T = bayTimes(k);
      const at = (f: number) => turnAt(f).fixB.bays.find((_, i) => BAY_TRAYS[i].k === k)!;
      expect(at(T.drop - 1).hole).toBe(false);
      expect(at(T.drop).hole).toBe(true);
      expect(T.shut).toBeGreaterThanOrEqual(T.slide + 8);
      expect(at(T.shut).leaves).toBe(1);
      expect(at(T.closed - 1).hole).toBe(true);
      expect(at(T.closed).leaves).toBe(0);
      expect(at(T.closed).hole).toBe(false);
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

  it('keeps one idea at a time: at most three of the turn’s motions run in any frame (MT2 critic: 5-7 ran at f1530-1610)', () => {
    const last = bayTimes(BAY_TRAYS.find((b) => b.id === BAY_ORDER[BAY_ORDER.length - 1])!.k);
    // each window is one visible motion (its own sub-steps following one another); its end is when it has settled
    const windows: [string, number, number][] = [
      ['the loop lifts, turns on edge, coils', TURN.rise, TURN.coilEnd],
      ['the folders are pressed in', TURN.press, TURN.press + TURN.pressStagger * FOLDERS.length + TURN.pressFrames],
      ['Fix A winds on, the coil turning', TURN.wind, TURN.windEnd],
      ['Fix B: the flock home, the trays pressed, the bays walled up one at a time', TURN.replies, last.closed],
      ['your desk slides', TURN.slide, TURN.slideEnd - 4],
      ['the deck rolls in, stands up and unfolds', TURN.deckIn, TURN.parts + 9 + TURN.partFrames - 4],
      ['the reel glides, descends, locks; its leader laid', TURN.glide, TURN.lock + 6],
      ['the belt runs out, the first slip rides it in, its row prints', TURN.belt, TURN.print + TURN.inkFrames],
      ['every other channel joins the intake', TURN.spool, TURN.spool + TURN.spoolFrames],
      ['the chute extends, its posts drop', TURN.chute, TURN.posts + TURN.postFrames],
      ['the Continuous plate turns over', TURN.plate - 6, TURN.plate + 8],
      ['the request rises out of the heap', B4.requestRise, TURN_SPAN[1] + 1],
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
    // footprints as a multiset (a capsule either way round, rounded to 0.05 u); act two casts them through footprintsAt
    const key = (fp: Footprint): string => {
      const r = (x: number) => (Math.round(x * 20) / 20).toFixed(2);
      if (fp.kind === 'seg') {
        const [a, b] = [`${r(fp.a[0])},${r(fp.a[1])},${r(fp.ha)}`, `${r(fp.b[0])},${r(fp.b[1])},${r(fp.hb)}`].sort();
        return `seg ${a} ${b} ${r(fp.r)}`;
      }
      if (fp.kind === 'canopy') return `canopy ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.z)} ${r(fp.strength)}`;
      if (fp.kind === 'circle') return `circle ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.r)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
      return `rect ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.r)} ${r(fp.rot)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
    };
    const turnSet = turnFootprints(t).map(key).sort();
    const act2Set = footprintsAt(s).map(key).sort();
    expect(turnSet).toEqual(act2Set);
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

  it('keeps your lamp on over the rising loop, dims it one step once the loop is handed over, at most 8 pools and 128 footprints', () => {
    // attending (its bulb blooming) from the turn's start through the loop's rise, the coil and the glide
    for (let f = 1400; f < TURN.lampHandOver; f++) expect(youPoseTurn(f).bulb!, `f${f}`).toBeGreaterThan(1);
    // the loop's hand-over is the Continuous plate docking: then one step dimmer, under the bloom's threshold
    expect(TURN.lampHandOver).toBeGreaterThanOrEqual(TURN.plate);
    expect(youPoseTurn(TURN.lampHandOver + 12).bulb!).toBeLessThan(1);
    for (let f = 1400; f <= 1660; f += 2) {
      const t = turnAt(f);
      expect(turnPools(t).length).toBeLessThanOrEqual(MAX_POOLS);
      expect(turnFootprints(t).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
  });
});
