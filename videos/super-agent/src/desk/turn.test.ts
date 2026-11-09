import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { MOTION_TESTS } from '../lookdev/frames.ts';
import { LOOP_A, actOneAt, youPoseA } from './actOne.ts';
import { A_ITEMS, IMPRINTS, TRAYS } from './beat3.ts';
import { FRAMING_B, cameraAt, deskCamera } from './camera.ts';
import { FOLDERS } from './actOne.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { DECK, REEL } from './layout.ts';
import { EMIT, MAX_POOLS } from './pools.ts';
import { TURN, TURN_SPAN, firstSlipAt, imprintsAt, replyLands, turnAt, turnFootprints, turnPools, wallsRise, youPoseTurn } from './turn.ts';
import { YOU_POSE_B } from './you.ts';

/** A state without its frame number, for comparing frames. */
const still = (f: number) => JSON.stringify({ ...turnAt(f), f: 0, act: { ...turnAt(f).act, f: 0 } });

describe('the turn (MT2)', () => {
  it('spans MT2 and hits on bar 19', () => {
    expect(TURN_SPAN).toEqual(MOTION_TESTS.mt2);
    expect(TURN.hit).toBe(1440);
    expect(TURN.plate).toBe(cue('trait-continuous').frame);
  });

  it('is a pure function of the frame', () => {
    for (const f of [1400, 1444, 1500, 1561, 1616, 1660]) expect(JSON.stringify(turnAt(f))).toBe(JSON.stringify(turnAt(f)));
  });

  it('holds still from the pens lifting until the hit (stillness before the climax)', () => {
    const ref = still(TURN.still + 4);
    for (let f = TURN.still + 4; f <= TURN.hit; f++) expect(still(f)).toBe(ref);
    expect(TURN.hit - (TURN.still + 4)).toBeGreaterThanOrEqual(10);
  });

  it('starts as act one plus beat 3 at f1400', () => {
    const t = turnAt(1400);
    expect(t.act).toEqual(actOneAt(1400));
    expect(t.you.lamp).toEqual(youPoseA(actOneAt(1400)).lamp);
    expect(t.you.shift).toEqual(youPoseA(actOneAt(1400)).shift);
    const L = t.loop.ribbon!.L;
    expect([L.c, L.a, L.b, L.n]).toEqual([LOOP_A.c, LOOP_A.a, LOOP_A.b, LOOP_A.n]);
    expect(t.press.every((p) => p === 0) && t.pressA === 0).toBe(true);
    expect(t.fixB.walls.every((w) => w === 0)).toBe(true);
    expect(t.fixA.items.every((it) => it !== null)).toBe(true);
    expect(t.labels).toEqual({ you: null, router: null });
  });

  it('ends in act two at f1660: your desk, the deck, the reel, the camera', () => {
    const t = turnAt(1660);
    expect({ ...t.you, inTray: true, inTraySlip: undefined }).toEqual({ ...YOU_POSE_B, inTraySlip: undefined });
    expect(Math.abs(t.deck.dy) + Math.abs(t.deck.dz) + Math.abs(t.deck.tilt[0]) + Math.abs(t.deck.tilt[1])).toBeLessThan(1e-3);
    const { posts, ...rest } = t.parts;
    expect(posts).toBeGreaterThan(0.999);
    for (const v of Object.values(rest)) expect(Math.abs(v)).toBeLessThan(1e-3);
    const c = t.loop.coil!;
    expect(c.c[0]).toBeCloseTo(REEL.x, 6);
    expect(c.c[1]).toBeCloseTo(REEL.y, 6);
    expect(c.h).toBeCloseTo(REEL.packZ[0], 6);
    expect(c.rOut).toBeCloseTo(REEL.packR, 3);
    expect(c.rIn).toBeCloseTo(REEL.hubR, 2);
    expect(c.spin).toBe(0);
    expect(imprintsAt(t).every((d) => d > 0.999)).toBe(true);
    expect(cameraAt(1660, 15)).toEqual(deskCamera(FRAMING_B, 15));
    expect(t.fixA.deskLen + t.fixA.spanLen).toBe(0);
    expect(t.fixB.walls.every((w) => w > 0.99)).toBe(true);
  });

  it('presses every folder, act one’s and Fix A’s, into its imprint', () => {
    expect(IMPRINTS).toHaveLength(FOLDERS.length + 1);
    expect(IMPRINTS.slice(0, FOLDERS.length).map((m) => m.c)).toEqual(FOLDERS.map((fl) => fl.c));
  });

  it('acts only after its cause', () => {
    // the loop lifts only after the hit; the dip comes first
    for (let f = 1400; f < TURN.rise; f++) expect(turnAt(f).loop.ribbon!.h).toBe(0);
    expect(turnAt(TURN.riseEnd).loop.ribbon?.h ?? turnAt(TURN.riseEnd).loop.coil!.h).toBeGreaterThan(155);
    // each tray grows walls only after its reply has come home
    TRAYS.forEach((_, k) => {
      expect(wallsRise(k)).toBeGreaterThan(replyLands(k));
      expect(turnAt(replyLands(k)).fixB.walls[k]).toBe(0);
    });
    // the legs lift the deck only once it has rolled in
    expect(TURN.legs).toBeGreaterThanOrEqual(TURN.deckInEnd - 6);
    expect(turnAt(TURN.legs).deck.dz).toBeCloseTo(-80, 6);
    // the reel locks before the jewel lights, the slip enters the throat after both, the row prints after it
    expect(TURN.lock).toBeLessThan(TURN.jewel);
    expect(turnAt(TURN.jewel - 1).tape.jewel).toBe(0);
    expect(TURN.jewel).toBeLessThan(TURN.throat);
    expect(firstSlipAt(TURN.throat - 1)).not.toBeNull();
    expect(turnAt(TURN.print).tape.print).toBe('blank');
    expect(turnAt(TURN.print + 1).tape.print).toBe('first');
    expect(turnAt(TURN.print).tape.leader).toBe(1);
    // the intake is in place before the first slip is posted onto it
    expect(turnAt(TURN.post).intake.gate!).toBeLessThan(2);
    expect(turnAt(TURN.post).intake.belt!).toBeLessThan(4);
    // the reading lamp's pool waits for the first read
    expect(turnPools(turnAt(TURN.throat)).every((p) => Number.isFinite(p.rgb[0]))).toBe(true);
    expect(turnAt(TURN.throat).tape.reading).toBe(0);
    // labels: "you" once the camera has settled, "Router" 2 f after the lock
    expect(TURN.youLabel).toBeGreaterThanOrEqual(1600);
    expect(TURN.routerLabel).toBe(TURN.lock + 2);
  });

  it('winds all of Fix A’s tape onto the coil by the descent, queue and all', () => {
    const t = turnAt(TURN.descend);
    expect(t.fixA.deskLen + t.fixA.spanLen).toBeLessThan(0.5);
    expect(t.fixA.items.every((it) => it === null)).toBe(true);
    expect(A_ITEMS.filter((it) => it.kind === 'task')).toHaveLength(3);
    expect(A_ITEMS.findIndex((it) => it.kind === 'request')).toBe(12);
  });

  it('never runs Fix A’s tape through the deck', () => {
    for (let f = TURN.wind; f <= TURN.windEnd; f++) {
      const t = turnAt(f);
      const S = t.fixA.span;
      for (let k = 0; k <= 1; k += 0.05) {
        if (k * S.len > t.fixA.spanLen) continue;
        const p = [S.b[0] + (S.a[0] - S.b[0]) * k, S.b[1] + (S.a[1] - S.b[1]) * k, S.b[2] + (S.a[2] - S.b[2]) * k];
        const over = p[0] > DECK.x0 - 12 && p[0] < DECK.x1 + 12 && p[1] > DECK.y0 - 12 && p[1] < DECK.y1 + 12;
        if (over) expect(p[2]).toBeGreaterThan(DECK.top + 20);
      }
    }
  });

  it('keeps the light rule: your bulb narrows below the bloom threshold, at most 8 pools and 128 footprints', () => {
    expect(youPoseTurn(1400).bulb!).toBeGreaterThan(1);
    expect(youPoseTurn(TURN.slideEnd).bulb ?? EMIT.bulbMax * 0.62).toBeLessThan(1);
    for (let f = 1400; f <= 1660; f += 4) {
      const t = turnAt(f);
      expect(turnPools(t).length).toBeLessThanOrEqual(MAX_POOLS);
      expect(turnFootprints(t).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
  });
});
