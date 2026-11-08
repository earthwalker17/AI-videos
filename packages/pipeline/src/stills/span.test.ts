import { describe, expect, it } from 'vitest';
import { mezzanineArgs } from '../media/presets.ts';
import { innerFrames, MAX_SPAN, MIN_ENCODE_FRAMES, spanMkvArgs } from './span.ts';

describe('innerFrames', () => {
  it('spreads n frames evenly inside the span, never on its first frame', () => {
    // the smoke span of the probe: frames 15-74
    expect(innerFrames(15, 60, 3)).toEqual([25, 45, 65]);
    expect(innerFrames(0, 2, 1)).toEqual([1]);
    // as many as fit: every frame after the first
    expect(innerFrames(10, 5, 4)).toEqual([11, 12, 13, 14]);
    for (const [first, count, n] of [
      [0, MAX_SPAN, 12],
      [7, 13, 12],
      [100, 61, 7],
      [3, 30, 29],
    ]) {
      const f = innerFrames(first, count, n);
      expect(f).toHaveLength(n);
      expect(new Set(f).size).toBe(n);
      expect([...f].sort((a, b) => a - b)).toEqual(f);
      expect(f.every((i) => i > first && i < first + count)).toBe(true);
      // deterministic: the same arguments, the same frames
      expect(innerFrames(first, count, n)).toEqual(f);
    }
  });

  it('refuses counts that do not fit inside the span', () => {
    for (const [count, n] of [
      [5, 5],
      [1, 1],
      [10, 0],
      [10, 1.5],
    ])
      expect(() => innerFrames(0, count, n), `${count} ${n}`).toThrow(/do not fit/);
  });
});

describe('spanMkvArgs', () => {
  it("is the mezzanine's encode with the PNG sequence as its input", () => {
    const o = { width: 960, height: 540, fps: 30, out: 'span.part.mkv' };
    const args = spanMkvArgs({ ...o, dir: 'C:/out/50%/stills', first: 15, frames: 60 });
    const m = mezzanineArgs(o);
    const i = args.indexOf('-i');
    expect(args.slice(i - 6, i + 4)).toEqual(['-f', 'image2', '-framerate', '30', '-start_number', '15', '-i', expect.stringMatching(/50%%[\\/]stills[\\/]f%05d\.png$/), '-frames:v', '60']);
    // every output argument of the mezzanine, in order: FFV1 level 3, bgr0, its tags, bit-exact Matroska
    expect(args.slice(i + 4)).toEqual(m.slice(m.indexOf('pipe:0') + 1));
    expect(args).not.toContain('pipe:0');
    expect(args).not.toContain('rawvideo');
    expect(MIN_ENCODE_FRAMES).toBe(12);
  });
});
