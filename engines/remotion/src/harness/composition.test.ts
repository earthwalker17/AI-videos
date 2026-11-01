import { EXIT, ExitError } from '@aiv/core';
import { createLog } from '@aiv/pipeline';
import { describe, expect, it, vi } from 'vitest';
import { checkComposition, checkSwatchFrames, type CompositionInfo } from './composition.ts';

const comp = (o: Partial<CompositionInfo> = {}): CompositionInfo => ({ id: 'Main', width: 1920, height: 1080, fps: 30, durationInFrames: 150, ...o });
const format = { width: 1920, height: 1080, fps: 30 };

describe('checkComposition', () => {
  it('derives the Remotion scale from the profile size', () => {
    expect(checkComposition(comp(), format, { width: 1920, height: 1080 })).toEqual({ scale: 1 });
    expect(checkComposition(comp(), format, { width: 960, height: 540 })).toEqual({ scale: 0.5 });
  });

  it('refuses (exit 2) a composition whose format differs from video.json', () => {
    for (const c of [comp({ width: 1280 }), comp({ height: 720 }), comp({ fps: 25 })]) {
      let err: unknown;
      try {
        checkComposition(c, format, { width: 1920, height: 1080 });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).exit).toBe(EXIT.REFUSED);
      expect((err as Error).message).toMatch(/video\.json format says 1920x1080 at 30 fps/);
    }
  });

  it('rejects a non-uniform scale and an empty composition', () => {
    expect(() => checkComposition(comp(), format, { width: 960, height: 542 })).toThrow(/uniform scale/);
    expect(() => checkComposition(comp({ durationInFrames: 0 }), format, { width: 1920, height: 1080 })).toThrow(/durationInFrames 0/);
  });
});

describe('checkSwatchFrames', () => {
  const log = createLog('test');
  it('accepts agreeing frames and refuses others', () => {
    expect(checkSwatchFrames(comp({ props: { swatchFrames: [0, 15] } }), [0, 15], log)).toEqual([0, 15]);
    expect(() => checkSwatchFrames(comp({ props: { swatchFrames: [0, 30] } }), [0, 15], log)).toThrow(/QA would measure other content/);
    expect(() => checkSwatchFrames(comp({ props: { swatchFrames: [5, 2] } }), [0, 15], log)).toThrow(/must be \[start, end\)/);
  });

  it('warns when only one side declares the strip', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    expect(checkSwatchFrames(comp(), [0, 15], log)).toBeNull();
    checkSwatchFrames(comp({ props: { swatchFrames: [0, 15] } }), undefined, log);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
