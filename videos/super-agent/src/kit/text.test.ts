import { describe, expect, it } from 'vitest';
import { revealState, scriptRuns } from './text.tsx';

describe('revealState', () => {
  const span = { frame: 100, end: 200 };
  it('wipes in over the 6 frames before the span and fades over the 6 after it', () => {
    expect(revealState(93, span).visible).toBe(false);
    expect(revealState(94, span)).toEqual({ visible: false, wipe: 0, opacity: 1 });
    const mid = revealState(97, span);
    expect(mid.visible).toBe(true);
    expect(mid.wipe).toBeGreaterThan(0.5);
    expect(mid.wipe).toBeLessThan(1);
    expect(mid.opacity).toBe(1);
    expect(revealState(100, span)).toEqual({ visible: true, wipe: 1, opacity: 1 });
    expect(revealState(200, span)).toEqual({ visible: true, wipe: 1, opacity: 1 });
    expect(revealState(203, span).opacity).toBeCloseTo(0.5);
    expect(revealState(205, span).visible).toBe(true);
    expect(revealState(206, span).visible).toBe(false);
  });
  it('is on screen inside the cue sheet window [frame - in, end + out), its first wipe frame still empty', () => {
    const on = Array.from({ length: 140 }, (_, i) => 80 + i).filter((f) => revealState(f, span).visible);
    expect(on[0]).toBe(95);
    expect(on[on.length - 1]).toBe(205);
  });
  it('wipes left to right without going back', () => {
    let last = 0;
    for (let f = 94; f <= 100; f++) {
      const w = revealState(f, span).wipe;
      expect(w).toBeGreaterThanOrEqual(last);
      last = w;
    }
  });
});

describe('scriptRuns', () => {
  it('splits Latin and Han, a space going with the run it follows', () => {
    expect(scriptRuns('you · 你')).toEqual([
      { text: 'you · ', cjk: false },
      { text: '你', cjk: true },
    ]);
    expect(scriptRuns('AI 智能体可以并行 你却不能')).toEqual([
      { text: 'AI ', cjk: false },
      { text: '智能体可以并行 你却不能', cjk: true },
    ]);
    expect(scriptRuns('上层：常驻的 Router 接收')).toEqual([
      { text: '上层：常驻的 ', cjk: true },
      { text: 'Router ', cjk: false },
      { text: '接收', cjk: true },
    ]);
    expect(scriptRuns('')).toEqual([]);
  });
});
