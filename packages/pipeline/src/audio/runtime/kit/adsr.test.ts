import { describe, expect, it } from 'vitest';
import { adsr, adsrAt, type Adsr } from './adsr.ts';
import { SR } from './dsp.ts';

const ENV: Adsr = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 };

describe('kit adsr', () => {
  it('each stage lands on its target exactly at its end, and the clip is hold + release long', () => {
    for (const curve of [0, 5]) {
      const o = { ...ENV, curve };
      const e = adsr(o, 0.5);
      expect(e.length).toBe(Math.round(0.7 * SR));
      expect(e[0]).toBe(0);
      expect(e[0.01 * SR]).toBe(1);
      // rising until the end of the attack, falling through the decay
      expect(e[0.01 * SR - 1]).toBeLessThan(1);
      expect(e[0.11 * SR - 1]).toBeGreaterThan(0.5);
      expect(e[0.11 * SR]).toBe(0.5);
      expect(e[0.3 * SR]).toBe(0.5);
      expect(e[0.5 * SR - 1]).toBe(0.5);
      expect(e[0.6 * SR]).toBeGreaterThan(0);
      expect(e[0.6 * SR]).toBeLessThan(0.5);
      expect(e[e.length - 1]).toBe(0);
      expect(adsrAt(o, 0.5, 0.7)).toBeCloseTo(0, 12);
    }
    // linear: halfway through the decay and the release
    expect(adsrAt(ENV, 0.5, 0.06)).toBeCloseTo(0.75, 12);
    expect(adsrAt(ENV, 0.5, 0.6)).toBeCloseTo(0.25, 12);
    // a curve falls faster first
    expect(adsrAt({ ...ENV, curve: 5 }, 0.5, 0.06)).toBeLessThan(0.75);
  });

  it('a gate closed during the attack or the decay releases from where it was', () => {
    expect(adsrAt(ENV, 0.005, 0.005)).toBeCloseTo(0.5, 12);
    expect(adsrAt(ENV, 0.005, 0.105)).toBeCloseTo(0.25, 12);
    expect(adsrAt(ENV, 0.06, 0.16)).toBeCloseTo(0.375, 12);
    // no attack: full at the onset
    expect(adsrAt({ ...ENV, attack: 0 }, 1, 0)).toBe(1);
    expect(adsr(ENV, 0.3)).toEqual(adsr(ENV, 0.3));
  });
});
