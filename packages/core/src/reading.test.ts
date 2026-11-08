import { describe, expect, it } from 'vitest';
import { readingSeconds, requiredHoldS } from './reading.ts';

describe('reading time', () => {
  it('counts CJK at 4.5 per second and other non-space characters at 15', () => {
    expect(readingSeconds('Hello world')).toBeCloseTo(10 / 15, 9);
    expect(readingSeconds('万圣节礼物')).toBeCloseTo(5 / 4.5, 9);
    expect(readingSeconds('Clawd 的礼物!')).toBeCloseTo(3 / 4.5 + 6 / 15, 9);
    // kana and hangul read at the CJK rate too
    expect(readingSeconds('ひらがなカタカナ한국')).toBeCloseTo(10 / 4.5, 9);
  });

  it('skips every kind of white space, and counts full-width punctuation at the Latin rate', () => {
    expect(readingSeconds(' \t\n\u3000')).toBe(0);
    expect(readingSeconds('a\nb')).toBeCloseTo(2 / 15, 9);
    expect(readingSeconds('设想：云端？')).toBeCloseTo(4 / 4.5 + 2 / 15, 9);
    expect(readingSeconds('')).toBe(0);
  });

  it('holds a text for max(1.8 s, reading + 0.6 s)', () => {
    expect(requiredHoldS('')).toBe(1.8);
    expect(requiredHoldS('Hi')).toBe(1.8);
    expect(requiredHoldS('代码千行一次过，账号百年永不封')).toBeCloseTo(14 / 4.5 + 1 / 15 + 0.6, 9);
    // the crossover: 18 Latin characters read in 1.2 s, exactly 1.8 s with the 0.6 s to find them
    expect(requiredHoldS('a'.repeat(18))).toBeCloseTo(1.8, 9);
    expect(requiredHoldS('a'.repeat(30))).toBeCloseTo(2.6, 9);
  });
});
