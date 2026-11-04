import { describe, expect, it } from 'vitest';
import { at, cues, FILM_FRAMES } from '../cues.ts';
import { GATE_POSTS, PAGE, pathDistance } from '../world/layout.ts';
import { APPEAL_SNATCH, bigPumpkinLitAt, paintAt, coverAt, doorOpenAt, farColdAt, footAt, gatesOpenAt, ghostLowerAt, growAt, immersionAt, letterAt, pailLitAt, popAt, POPS, pumpkinsLitAt, windowsAt } from './beats.ts';
import { clawdAt } from './blocking.ts';
import { OUT_OF_BOOK } from './journey.ts';

const beats: [string, (f: number) => number][] = [
  ['cover', coverAt],
  ['immersion', immersionAt],
  ['big pumpkin', bigPumpkinLitAt],
  ['pumpkins', (f) => pumpkinsLitAt(f)],
  ['porch pumpkins', (f) => pumpkinsLitAt(f, true)],
  ['pail', pailLitAt],
  ['ghost', ghostLowerAt],
  ['gates', gatesOpenAt],
  ['door', doorOpenAt],
  ['letter rise', (f) => letterAt(f).rise],
  ['letter flip', (f) => letterAt(f).flip],
  ['far window', farColdAt],
  ['foot', footAt],
  ['windows', windowsAt],
  ['paint', paintAt],
  ['grow (page middle)', (f) => growAt(f, 0)],
];

describe('the V2 beats', () => {
  it("sweeps the world up out of the page left to right, each sixth on the score's pop", () => {
    // audio/foley.ts: the six valley pops at at(4) + 6 + k × 3, panned left to right
    expect(POPS).toEqual([0, 1, 2, 3, 4, 5].map((k) => at(4) + 6 + k * 3));
    for (let k = 0; k < 6; k++) expect(popAt(-PAGE.w / 2 + ((k + 0.5) / 6) * PAGE.w)).toBeCloseTo(POPS[k], 9);
    expect(popAt(-PAGE.w)).toBe(popAt(-PAGE.w / 2));
  });

  it('eases every beat over frames: no one-frame jump, everything on ones', () => {
    // the cover's slam (a hit) is faster
    for (const [name, fn] of beats)
      for (let f = 1; f < FILM_FRAMES; f++) {
        expect(Math.abs(fn(f) - fn(f - 1)), `${name} at frame ${f}`).toBeLessThan(name === 'cover' && f > at(34, 3) ? 0.25 : 0.36);
      }
  });

  it('keeps the gates clear of Clawd while he passes through them', () => {
    const [a, b] = GATE_POSTS;
    const gs = pathDistance((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).s;
    let seen = 0;
    for (let f = at(13); f < at(16); f++) {
      const p = clawdAt(f).pose.pos;
      // Clawd is 0.33 long: within his half length plus a margin of the gate line, both leaves clear
      if (Math.abs(pathDistance(p[0], p[2]).s - gs) < 0.3) {
        seen++;
        expect(gatesOpenAt(f), `frame ${f}`).toBeGreaterThanOrEqual(0.75);
      }
    }
    expect(seen).toBeGreaterThan(4);
    expect(gatesOpenAt(at(15))).toBeCloseTo(1, 9);
  });

  it('lands the beats on their cues', () => {
    expect(coverAt(at(4) - 1)).toBe(0);
    expect(coverAt(at(34, 3) - 1)).toBe(1);
    expect(coverAt(at(35))).toBe(0);
    expect(immersionAt(at(4))).toBe(0);
    expect(immersionAt(at(5))).toBe(1);
    expect(immersionAt(OUT_OF_BOOK[0])).toBe(1);
    expect(immersionAt(OUT_OF_BOOK[1])).toBe(0);
    expect(bigPumpkinLitAt(at(5) - 1)).toBe(0);
    expect(bigPumpkinLitAt(at(5) + 4)).toBe(1);
    // every pumpkin out six frames after the seal; the porch's back after the door closes, the pail on the relight
    expect(pumpkinsLitAt(at(26) + 6)).toBe(0);
    expect(bigPumpkinLitAt(at(26) + 6)).toBe(0);
    expect(pumpkinsLitAt(at(33) + 14, true)).toBe(1);
    expect(pailLitAt(at(31, 2) - 1)).toBe(0);
    expect(pailLitAt(at(31, 2) + 6)).toBe(1);
    expect(ghostLowerAt(at(11, 2))).toBeCloseTo(1, 9);
    expect(ghostLowerAt(at(11, 2) + 8)).toBe(0);
    expect(doorOpenAt(at(20) + 16)).toBe(1);
    expect(doorOpenAt(at(33) + 10)).toBe(0);
    expect(letterAt(at(25, 2) + 18).flip).toBe(1);
    expect(letterAt(at(26) - 1).sealed).toBe(false);
    expect(letterAt(at(26)).sealed).toBe(true);
    // the 3D face loses the Appeal tab on the score's snatch
    expect(APPEAL_SNATCH).toBe(cues.events.find((e) => e.id === 'appeal-snatch')!.frame);
    expect(letterAt(APPEAL_SNATCH - 1).tabGone).toBe(false);
    expect(letterAt(APPEAL_SNATCH).tabGone).toBe(true);
    expect(farColdAt(at(33, 3) + 5)).toBe(1);
    expect(footAt(at(10))).toBe(1);
    expect(footAt(at(20))).toBeCloseTo(0.3, 9);
  });

  it('flares once in the cold snap, then goes out', () => {
    const v = Array.from({ length: 8 }, (_, i) => pumpkinsLitAt(at(26) + i));
    const rises = v.slice(1).filter((x, i) => x > v[i]).length;
    expect(rises).toBeGreaterThanOrEqual(1);
    expect(v[7]).toBe(0);
  });
});
