import { describe, expect, it } from 'vitest';
import { CueSheet, type CueEvent } from '@aiv/core';
import { cardsLongEnough, cutsOnBars, failedChecks, intentChecks, readingSeconds, requiredHoldS, textHeld } from './intent.ts';

const sheet = (events: CueEvent[], over: Partial<CueSheet> = {}): CueSheet => CueSheet.parse({ schemaVersion: 1, fps: 24, filmFrames: 2400, leaderFrames: 24, events, ...over });

describe('intent checks', () => {
  it('cuts land on bar lines of the grid (offset counted), and a fractional bar fails', () => {
    // 120 bpm, 4/4 at 24 fps: a bar is 48 frames
    const grid = { bpm: 120, beatsPerBar: 4, offsetFrames: 12 };
    const cuts = (frames: number[]) => frames.map((frame, i) => ({ id: `c${i}`, kind: 'cut' as const, frame }));
    expect(cutsOnBars(sheet(cuts([12, 60, 108]), { grid }))).toMatchObject({ passed: true, detail: expect.stringMatching(/3 cut.*48 frames/) });
    const off = cutsOnBars(sheet(cuts([12, 61, 0]), { grid }));
    expect(off.passed).toBe(false);
    expect(off.detail).toMatch(/c1 @61 \(\+1\).*c2 @0 \(\+36\)/);
    // 100 bpm, 4/4 at 25 fps: 60 frames a bar
    expect(cutsOnBars(sheet(cuts([60, 120]), { fps: 25, grid: { bpm: 100, beatsPerBar: 4, offsetFrames: 0 } })).passed).toBe(true);
    const fractional = cutsOnBars(sheet(cuts([0]), { grid: { bpm: 130, beatsPerBar: 4, offsetFrames: 0 } }));
    expect(fractional).toMatchObject({ passed: false, detail: expect.stringMatching(/44\.308 frames/) });
    // no grid: informational, never a failure
    expect(cutsOnBars(sheet(cuts([61])))).toMatchObject({ passed: true, info: true });
  });

  it('reading time: CJK at 4.5 per second, other non-space characters at 15', () => {
    expect(readingSeconds('Hello world')).toBeCloseTo(10 / 15, 9);
    expect(readingSeconds('万圣节礼物')).toBeCloseTo(5 / 4.5, 9);
    expect(readingSeconds('Clawd 的礼物!')).toBeCloseTo(3 / 4.5 + 6 / 15, 9);
    expect(requiredHoldS('Hi')).toBe(1.8);
    expect(requiredHoldS('代码千行一次过，账号百年永不封')).toBeCloseTo(14 / 4.5 + 1 / 15 + 0.6, 9);
  });

  it('every language of a text or card cue is held long enough', () => {
    const title = { id: 'title', kind: 'text' as const, frame: 0, end: 48, text: { en: 'A Halloween Gift', 'zh-Hans': '万圣节礼物' } };
    // 2 s held: en needs max(1.8, 14/15 + 0.6) ≈ 1.53 → 1.8 s; zh needs 5/4.5 + 0.6 ≈ 1.71 → 1.8 s
    expect(textHeld(sheet([title])).passed).toBe(true);
    const long = { ...title, id: 'couplet', end: 72, text: { en: 'Ok', 'zh-Hans': '代码千行一次过，账号百年永不封' } };
    const r = textHeld(sheet([long]));
    expect(r.passed).toBe(false);
    expect(r.detail).toMatch(/couplet \[zh-Hans\] held 3\.00 s < 3\.78 s/);
    expect(r.detail).not.toMatch(/\[en\]/);
    expect(textHeld(sheet([{ id: 'x', kind: 'text', frame: 0, end: 10 }]))).toMatchObject({ passed: true, info: true });
  });

  it('cards last at least 4 s', () => {
    const card = (id: string, frames: number) => ({ id, kind: 'card' as const, frame: 100, end: 100 + frames });
    expect(cardsLongEnough(sheet([card('end', 96)])).passed).toBe(true);
    const r = cardsLongEnough(sheet([card('end', 96), card('title', 95)]));
    expect(r).toMatchObject({ passed: false, detail: expect.stringMatching(/title \(3\.96 s\)/) });
    expect(r.detail).not.toMatch(/end \(/);
  });

  it('all three, with only real failures counted', () => {
    const checks = intentChecks(sheet([{ id: 'end', kind: 'card', frame: 0, end: 24, text: { en: 'The End' } }]));
    expect(checks.map((c) => c.id)).toEqual(['cuts.bars', 'text.hold', 'card.length']);
    expect(failedChecks(checks).map((c) => c.id)).toEqual(['text.hold', 'card.length']);
  });
});
