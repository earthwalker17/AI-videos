import { describe, expect, it } from 'vitest';
import { SR, dbToGain } from './dsp.ts';
import { duckGain, duckReductionDb, follow } from './duck.ts';

describe('kit ducking', () => {
  it('the follower tracks a level with its attack and release', () => {
    const x = new Float32Array(SR).fill(0);
    x.fill(0.5, 0, SR / 2);
    const env = follow(x, 0.01, 0.1);
    // one time constant into the attack: 1 - 1/e of the level
    expect(env[0.01 * SR - 1]).toBeCloseTo(0.5 * (1 - Math.exp(-1)), 6);
    expect(env[SR / 2 - 1]).toBeCloseTo(0.5, 6);
    // one release time constant after it stops: 1/e
    expect(env[SR / 2 + 0.1 * SR - 1]).toBeCloseTo(0.5 * Math.exp(-1), 6);
  });

  it('ducks by its depth while the sidechain is well over the threshold, and lets go after', () => {
    // the sidechain: a -12 dBFS tone from 0.5 s to 1.5 s
    const side = Float32Array.from({ length: 3 * SR }, (_, i) => (i >= SR / 2 && i < 1.5 * SR ? 0.25 * Math.sin((2 * Math.PI * 440 * i) / SR) : 0));
    const g = duckGain(side, { depthDb: 6, thresholdDb: -40, attack: 0.005, release: 0.2 });
    expect(g[SR / 4]).toBe(1);
    for (const i of [0.6 * SR, SR, 1.49 * SR]) expect(g[i]).toBeCloseTo(dbToGain(-6), 6);
    // the release: the envelope falls 8.7 dB per 0.2 s, so the full depth holds until it is under
    // -34 dBFS (about 0.5 s after the tone), then lets go through the knee, gone by about 0.7 s
    expect(g[1.9 * SR]).toBeCloseTo(dbToGain(-6), 6);
    expect(g[2.1 * SR]).toBeGreaterThan(dbToGain(-6));
    expect(g[2.1 * SR]).toBeLessThan(1);
    expect(g[2.5 * SR]).toBe(1);
    expect(g.reduce((m, v) => Math.min(m, v), 1)).toBeGreaterThanOrEqual(dbToGain(-6) - 1e-7);
    expect(duckGain(side, { depthDb: 6 })).toEqual(duckGain(side, { depthDb: 6 }));
  });

  it('the gain computer: nothing under the knee, a ratio over it, never past the depth', () => {
    const o = { depthDb: 10, thresholdDb: -30, ratio: 2, kneeDb: 0 };
    expect(duckReductionDb(-35, o)).toBe(0);
    expect(duckReductionDb(-24, o)).toBeCloseTo(3, 12);
    expect(duckReductionDb(0, o)).toBe(10);
    // a soft knee starts half its width below the threshold
    expect(duckReductionDb(-33.1, { ...o, kneeDb: 6 })).toBe(0);
    expect(duckReductionDb(-30, { ...o, kneeDb: 6 })).toBeGreaterThan(0);
  });
});
