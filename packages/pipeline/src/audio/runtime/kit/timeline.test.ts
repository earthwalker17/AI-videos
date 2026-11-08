import { describe, expect, it } from 'vitest';
import { CueSheet } from '@aiv/core';
import { scoreContext } from '../render.ts';
import { timeline } from './timeline.ts';

const context = (sheet: Record<string, unknown>) =>
  scoreContext({
    sheet: CueSheet.parse({ schemaVersion: 1, leaderFrames: 15, events: [], ...sheet }),
    slug: 'demo',
    library: () => {
      throw new Error('no library');
    },
  });

describe('kit timeline', () => {
  it('reads the bar grid from the cue sheet, its offset included, exact in samples', () => {
    const T = timeline(
      context({
        fps: 30,
        filmFrames: 400,
        grid: { bpm: 90, beatsPerBar: 4, offsetFrames: 10 },
        events: [
          { id: 'hit', kind: 'hit', frame: 50 },
          { id: 'breath', kind: 'rest', frame: 100, end: 120 },
          { id: 'hush-2', kind: 'silence', frame: 300, end: 320 },
          { id: 'hush-1', kind: 'silence', frame: 200, end: 210 },
        ],
      }),
    );
    expect(T.n).toBe(400 * 1600);
    expect(T.beatSamples).toBe(32_000);
    // bar 1 beat 1 is the grid's offset: frame 10, sample 16 000
    expect(T.beat(1)).toBe(16_000);
    expect(T.beat(2)).toBe(16_000 + 4 * 32_000);
    expect(T.beat(1, 1.5)).toBe(32_000);
    expect(T.beatFrame(2, 3)).toBe(10 + 80 + 40);
    for (let bar = 1; bar <= 4; bar++) for (const b of [1, 1.25, 2, 3.5, 4]) expect(T.beat(bar, b)).toBe(T.frame(T.beatFrame(bar, b)));
    expect(T.beats(0.5)).toBe(16_000);
    expect(T.position(T.beat(3, 2.5))).toEqual({ bar: 3, beat: 2.5 });
    // before the offset: half a beat before bar 1 is bar 0's beat 4.5
    expect(T.position(0)).toEqual({ bar: 0, beat: 4.5 });

    expect(T.cue('hit')).toBe(50 * 1600);
    expect(T.span('breath')).toEqual([100 * 1600, 120 * 1600]);
    expect(T.span('hit')).toEqual([50 * 1600, 50 * 1600]);
    expect(T.event('breath').kind).toBe('rest');
    expect(() => T.cue('nope')).toThrow(/needs cue 'nope'/);
    expect(T.spans('rest')).toEqual([[100 * 1600, 120 * 1600]]);
    expect(T.silences).toEqual([
      [200 * 1600, 210 * 1600],
      [300 * 1600, 320 * 1600],
    ]);
    expect(T.cuts()).toEqual([200 * 1600, 300 * 1600]);
    expect(T.cuts(T.beat(3), 300 * 1600)).toEqual([T.beat(3), 200 * 1600, 300 * 1600]);
    expect(T.s(0.5)).toBe(24_000);
  });

  it('does not round a beat to a frame when the two do not meet; needs a grid for bars', () => {
    // 128 bpm at 24 fps: a beat is 22 500 samples, 11.25 frames
    const T = timeline(context({ fps: 24, filmFrames: 240, grid: { bpm: 128, beatsPerBar: 3 } }));
    expect(T.grid).toEqual({ bpm: 128, beatsPerBar: 3, offsetFrames: 0 });
    expect(T.beat(1, 2)).toBe(22_500);
    expect(T.beat(2)).toBe(67_500);
    expect(T.beatFrame(1, 2)).toBe(11);
    expect(T.frame(11)).toBe(22_000);

    const none = timeline(context({ fps: 24, filmFrames: 24 }));
    expect(none.grid).toBeNull();
    expect(() => none.beat(1)).toThrow(/no bar grid|has none/);
    expect(() => none.beats(1)).toThrow(/has none/);
    expect(none.cuts()).toEqual([]);
  });
});
