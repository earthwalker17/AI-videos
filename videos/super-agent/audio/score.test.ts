// The score sketch's building blocks: its landmarks on the cue sheet's grid and its voices. The
// full render is exercised by `aiv audio super-agent --verify` (two fresh processes, identical
// bytes), and its levels are in out/super-agent/audio/audio.json and the stage's log.
import { describe, expect, it } from 'vitest';
import type { ScoreContext } from '@aiv/pipeline/audio';
import { peakOf, timeline } from '@aiv/pipeline/audio/kit';
import { at, cues } from '../src/cues.ts';
import { marks } from './arrangement.ts';
import { inkClick, inkSwell, paperThump, sketchScratch, woodKnock, woodblockHop } from './foley.ts';
import { bowedNote, brightPluck, chirp, fallTone, feltPiano, fmMallet, marimba, sineBass, smear, woodTick } from './instruments.ts';

const SR = 48_000;
const ctx: ScoreContext = {
  sampleRate: SR,
  cues,
  fps: cues.fps,
  filmSamples: Math.round((cues.filmFrames * SR) / cues.fps),
  frameToSample: (f) => Math.round((f * SR) / cues.fps),
  library: () => {
    throw new Error('the score plays no samples');
  },
  seed: 12345,
};
const S = (frame: number) => ctx.frameToSample(frame);

describe('the sketch on the cue sheet', () => {
  it('finds its landmarks on the 3:45 cue sheet, and ends well inside the film', () => {
    // re-anchored on the 84-bar sheet (session 3); the build session re-lays the sketch itself
    const m = marks(timeline(ctx));
    expect(m.hub).toBe(S(at(12)));
    expect(m.hush).toBe(S(at(12, 4)));
    expect(m.split).toBe(S(at(13)));
    expect(m.question).toBe(S(at(18)));
    expect(m.breath).toBe(S(at(18, 3)));
    expect(m.turn).toBe(S(at(19)));
    expect(m.stepDown).toBe(S(at(28, 2)));
    expect(m.rest).toEqual([S(at(29, 2)), S(at(30))]);
    expect(m.end).toBe(S(at(31)));
    expect(m.end).toBeLessThan(ctx.filmSamples);
  });
});

describe('the voices', () => {
  const seed = 7;
  const mono: [string, () => Float32Array, number][] = [
    ['fmMallet', () => fmMallet(69, { vel: 0.8 }), 0.8],
    ['fmMallet with a droop', () => fmMallet(77, { vel: 0.5, droop: 40, droopTime: 0.6, tau: 0.28 }), 0.5],
    ['marimba', () => marimba(62, { seed, k: 1, vel: 0.7, cents: 12 }), 0.7],
    ['feltPiano', () => feltPiano(38, { seed, k: 1, vel: 0.75, hold: 1 }), 0.75],
    ['sineBass', () => sineBass(38, { len: 1, vel: 0.9 }), 0.9],
    ['woodTick', () => woodTick(1250, { seed, k: 1 }), 0.7],
    ['brightPluck', () => brightPluck(81, { seed, k: 1 }), 0.7],
    ['smear', () => smear(51, 50, { len: 0.55, glide: 0.35 }), 0.7],
    ['chirp', () => chirp({ f0: 1500, f1: 2200, len: 0.06 }), 0.6],
    ['fallTone', () => fallTone(74), 0.6],
    ['woodblockHop', () => woodblockHop(seed, 1), 1],
    ['sketchScratch', () => sketchScratch(seed, { len: 0.3 }), 1],
    ['sketchScratch, dry', () => sketchScratch(seed, { len: 0.22, k: 2, dry: true }), 1],
    ['inkClick', () => inkClick(seed, 1), 1],
    ['paperThump', () => paperThump(seed), 1],
    ['woodKnock', () => woodKnock(seed, 1), 1],
  ];
  it.each(mono)('%s is finite, peaks at its velocity and is the same every time', (_, make, vel) => {
    const a = make();
    expect(a.every((x) => Number.isFinite(x))).toBe(true);
    expect(peakOf(a)).toBeCloseTo(vel, 5);
    expect(make()).toEqual(a);
  });

  it('a bowed note keeps its fixed scale whatever its pitch; the ink swell is a stereo spread', () => {
    for (const midi of [50, 66]) {
      const a = bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 });
      expect(a.every((x) => Number.isFinite(x))).toBe(true);
      expect(peakOf(a)).toBeGreaterThan(0.5);
      expect(peakOf(a)).toBeLessThan(1.4);
      expect(bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 })).toEqual(a);
    }
    const swell = inkSwell(seed, { len: 1 });
    expect(Math.max(peakOf(swell.l), peakOf(swell.r))).toBeCloseTo(1, 5);
    expect(swell.l).not.toEqual(swell.r);
  });
});
