import { describe, expect, it } from 'vitest';
import { after, all, barBeat, barFrames, beatFrames, criticalSpring, delay, EASE, endOf, envelope, gridPosition, lagged, nextOnGrid, prog, seq, spanOf, win, type Grid } from './timeline.ts';

const G: Grid = { fps: 30, bpm: 90, beatsPerBar: 4 };

describe('grid', () => {
  it('has 20 frames a beat and 80 a bar at 30 fps, 90 bpm', () => {
    expect(beatFrames(G)).toBe(20);
    expect(barFrames(G)).toBe(80);
    expect(barBeat(G, 1)).toBe(0);
    expect(barBeat(G, 17)).toBe(1280);
    expect(barBeat(G, 2, 4)).toBe(140);
    expect(barBeat(G, 7, 3.5)).toBe(530);
    expect(barBeat({ ...G, offsetFrames: 15 }, 1, 2)).toBe(35);
  });
  it('places a frame on the grid', () => {
    expect(gridPosition(G, 0)).toEqual({ bar: 1, beat: 1, phase: 0 });
    expect(gridPosition(G, 1290)).toEqual({ bar: 17, beat: 1, phase: 0.5 });
    expect(gridPosition(G, 79)).toMatchObject({ bar: 1, beat: 4 });
  });
  it('finds the next eighth, beat or sixteenth', () => {
    expect(nextOnGrid(G, 0)).toBe(0);
    expect(nextOnGrid(G, 1)).toBe(10);
    expect(nextOnGrid(G, 10)).toBe(10);
    expect(nextOnGrid(G, 11, 1)).toBe(20);
    expect(nextOnGrid(G, 11, 4)).toBe(15);
  });
});

describe('windows', () => {
  it('runs 0 to 1 through a window and holds at both ends', () => {
    const w = win(10, 10);
    expect(prog(0, w)).toBe(0);
    expect(prog(10, w)).toBe(0);
    expect(prog(15, w)).toBe(0.5);
    expect(prog(20, w)).toBe(1);
    expect(prog(99, w)).toBe(1);
    expect(prog(15, win(10, 10, 'inOutCubic'))).toBeCloseTo(0.5);
    expect(prog(9, win(10, 0))).toBe(0);
    expect(prog(10, win(10, 0))).toBe(1);
  });
  it('combines windows', () => {
    expect(seq(100, [10, [20, 'outCubic'], 5])).toEqual([win(100, 10), win(110, 20, 'outCubic'), win(130, 5)]);
    expect(seq(0, [10, 10], 4).map((w) => w.start)).toEqual([0, 14]);
    expect(all(5, 10, 3)).toEqual([win(5, 10), win(5, 10), win(5, 10)]);
    expect(lagged(0, 8, 3, 4).map((w) => w.start)).toEqual([0, 4, 8]);
    expect(delay(win(10, 5), 3)).toEqual(win(13, 5));
    expect(after(win(10, 5), 8, undefined, 2)).toEqual(win(17, 8));
    expect(endOf(win(10, 5))).toBe(15);
    expect(spanOf(lagged(0, 8, 3, 4))).toEqual(win(0, 16));
  });
  it('makes an envelope', () => {
    const inW = win(0, 6);
    const outW = win(30, 6);
    expect(envelope(0, inW, outW)).toBe(0);
    expect(envelope(3, inW, outW)).toBe(0.5);
    expect(envelope(20, inW, outW)).toBe(1);
    expect(envelope(33, inW, outW)).toBe(0.5);
    expect(envelope(36, inW, outW)).toBe(0);
  });
});

describe('easings', () => {
  it('start at 0 and end at 1', () => {
    for (const e of Object.values(EASE)) {
      expect(e(0)).toBeCloseTo(0, 12);
      expect(e(1)).toBe(1);
    }
  });
  it('a critically damped spring never overshoots and settles at 1', () => {
    const s = criticalSpring(30, 80);
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const v = s(i / 100);
      expect(v).toBeGreaterThanOrEqual(last - 1e-12);
      expect(v).toBeLessThanOrEqual(1);
      last = v;
    }
    expect(s(0)).toBe(0);
    expect(s(0.98)).toBeGreaterThan(0.99);
    expect(s(1)).toBe(1);
    // a pure function of t: the same value however it is reached
    expect(s(0.37)).toBe(criticalSpring(30, 80)(0.37));
  });
});
