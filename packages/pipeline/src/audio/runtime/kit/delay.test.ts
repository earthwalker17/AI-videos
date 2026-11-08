import { describe, expect, it } from 'vitest';
import { CueSheet } from '@aiv/core';
import { scoreContext } from '../render.ts';
import { delay } from './delay.ts';
import { timeline } from './timeline.ts';

/** The indices and values of the non-zero samples. */
const taps = (x: Float32Array) => [...x].map((v, i) => [i, v] as const).filter(([, v]) => v !== 0);

describe('kit delay', () => {
  it('repeats an impulse every `time` samples, scaled by the feedback', () => {
    const l = new Float32Array(5000);
    const r = new Float32Array(5000);
    l[100] = 1;
    r[200] = 0.5;
    const w = delay(l, r, { time: 1000, feedback: 0.5 });
    expect(taps(w.l)).toEqual([
      [1100, 1],
      [2100, 0.5],
      [3100, 0.25],
      [4100, 0.125],
    ]);
    expect(taps(w.r)).toEqual([
      [1200, 0.5],
      [2200, 0.25],
      [3200, 0.125],
      [4200, 0.0625],
    ]);
  });

  it('ping-pong alternates left and right from a mono sum; the loop low-pass darkens later repeats', () => {
    const l = new Float32Array(5000);
    const r = new Float32Array(5000);
    l[0] = 1;
    r[0] = 1;
    const w = delay(l, r, { time: 1000, feedback: 0.5, pingPong: true });
    expect(taps(w.l)).toEqual([
      [1000, 1],
      [3000, 0.25],
    ]);
    expect(taps(w.r)).toEqual([
      [2000, 0.5],
      [4000, 0.125],
    ]);
    const d = delay(l, r, { time: 1000, feedback: 0.5, damp: 2000 });
    expect(d.l[1000]).toBe(1);
    expect(d.l[2000]).toBeLessThan(0.5);
    expect(d.l[2000]).toBeGreaterThan(0);
  });

  it('locks to the bar grid, and no repeat crosses a cut', () => {
    const sheet = CueSheet.parse({ schemaVersion: 1, fps: 30, filmFrames: 320, leaderFrames: 0, grid: { bpm: 90, beatsPerBar: 4 }, events: [] });
    const T = timeline(scoreContext({ sheet, slug: 'demo', library: () => { throw new Error('no library'); } }));
    const eighth = T.beats(0.5);
    expect(eighth).toBe(16_000);
    const l = new Float32Array(T.n);
    const r = new Float32Array(T.n);
    l[T.beat(1)] = 1;
    l[T.beat(3)] = 1;
    const cut = T.beat(2, 3);
    const w = delay(l, r, { time: eighth, feedback: 0.5, cuts: [cut], cutFade: 0 });
    expect(taps(w.l)).toEqual([
      [T.beat(1, 1.5), 1],
      [T.beat(1, 2), 0.5],
      [T.beat(1, 2.5), 0.25],
      [T.beat(1, 3), 0.125],
      [T.beat(1, 3.5), 0.0625],
      [T.beat(1, 4), 0.03125],
      [T.beat(1, 4.5), 0.015625],
      [T.beat(2, 1), 0.0078125],
      [T.beat(2, 1.5), 0.00390625],
      [T.beat(2, 2), 0.001953125],
      [T.beat(2, 2.5), 0.0009765625],
      // the cut at bar 2 beat 3 empties the line: bar 3's input starts fresh
      [T.beat(3, 1.5), 1],
      [T.beat(3, 2), 0.5],
      [T.beat(3, 2.5), 0.25],
      [T.beat(3, 3), 0.125],
      [T.beat(3, 3.5), 0.0625],
      [T.beat(3, 4), 0.03125],
      [T.beat(3, 4.5), 0.015625],
      [T.beat(4, 1), 0.0078125],
      [T.beat(4, 1.5), 0.00390625],
      [T.beat(4, 2), 0.001953125],
      [T.beat(4, 2.5), 0.0009765625],
      [T.beat(4, 3), 0.00048828125],
      [T.beat(4, 3.5), 0.000244140625],
      [T.beat(4, 4), 0.0001220703125],
      [T.beat(4, 4.5), 0.00006103515625],
    ]);
    expect(delay(l, r, { time: eighth, feedback: 0.4, pingPong: true, damp: 3000, cuts: [cut] })).toEqual(delay(l, r, { time: eighth, feedback: 0.4, pingPong: true, damp: 3000, cuts: [cut] }));
  });
});
