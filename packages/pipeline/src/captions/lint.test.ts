import { describe, expect, it } from 'vitest';
import { lintSrt, zhPunctuationFaults } from './lint.ts';
import { MIN_DURATION_MS, speedChars, subtitleProfile, SUBTITLE_PROFILES } from './profiles.ts';
import { formatSrt, type Caption } from './srt.ts';

const srt = (...caps: Caption[]) => formatSrt(caps);
const cap = (start: number, end: number, ...lines: string[]): Caption => ({ start, end, lines });
const rules = (text: string, lang = 'en') => lintSrt(text, lang).issues.map((i) => `${i.severity}:${i.rule}${i.caption ? `#${i.caption}` : ''}`);

describe('subtitle profiles', () => {
  it('finds a profile by tag, dropping subtags; none for a bare zh', () => {
    expect(subtitleProfile('en')).toBe(SUBTITLE_PROFILES.en);
    expect(subtitleProfile('en-GB')).toBe(SUBTITLE_PROFILES.en);
    expect(subtitleProfile('zh-Hans-CN')).toBe(SUBTITLE_PROFILES['zh-Hans']);
    expect(subtitleProfile('zh')).toBeNull();
    expect(subtitleProfile('fr')).toBeNull();
  });

  it('counts reading speed with spaces in English (a break is one), without them in zh-Hans', () => {
    expect(speedChars(['ab cd', 'ef'], SUBTITLE_PROFILES.en)).toBe(8);
    expect(speedChars(['切换 逐次', '等待'], SUBTITLE_PROFILES['zh-Hans'])).toBe(6);
  });
});

describe('the subtitle linter', () => {
  it('passes a clean file', () => {
    const r = lintSrt(srt(cap(0, 3000, 'Each session knows one task.', 'You must know them all.'), cap(3000, 5000, 'Touching is fine.')), 'en');
    expect(r).toEqual({ lang: 'en', profile: 'en', captions: 2, issues: [], errors: 0, warnings: 0 });
  });

  it('fails what is not SRT, and an empty file', () => {
    expect(rules('1\n00:00:01,000 -> 00:00:02,000\nx\n')).toEqual(['error:srt.syntax']);
    expect(lintSrt('1\n00:00:01,000 -> 00:00:02,000\nx\n', 'en').issues[0]).toMatchObject({ line: 2 });
    expect(rules('')).toEqual(['error:srt.empty']);
    expect(rules('\n\n')).toEqual(['error:srt.empty']);
    // a missing blank line between two captions: a syntax error, in a language without a profile too
    expect(rules('1\n00:00:01,000 --> 00:00:09,000\n2\n00:00:05,000 --> 00:00:09,000\nworld\n', 'fr')).toEqual(['warning:profile.none', 'error:text.empty#1', 'error:srt.syntax', 'error:srt.overlap#2']);
  });

  it('fails indices out of sequence, an end not after its start, a start out of order, an overlap', () => {
    const text = srt(cap(0, 1000, 'a'), cap(1000, 2000, 'b')).replace(/^2$/m, '3');
    expect(rules(text)).toEqual(['error:srt.index#3']);
    expect(rules(srt(cap(2000, 2000, 'a')))).toEqual(['error:srt.timing#1']);
    expect(rules(srt(cap(3000, 2000, 'a')))).toEqual(['error:srt.timing#1']);
    expect(rules(srt(cap(5000, 6000, 'a'), cap(3000, 4500, 'b')))).toEqual(['error:srt.order#2']);
    expect(rules(srt(cap(0, 2000, 'a'), cap(1999, 4000, 'b')))).toEqual(['error:srt.overlap#2']);
  });

  it('fails a caption without text', () => {
    expect(rules('1\n00:00:00,000 --> 00:00:02,000\n\n2\n00:00:02,000 --> 00:00:04,000\nok\n')).toEqual(['error:text.empty#1']);
  });

  it('fails a line over 42 characters and a third line (en)', () => {
    expect(rules(srt(cap(0, 4000, 'x'.repeat(42))))).toEqual([]);
    expect(rules(srt(cap(0, 4000, 'x'.repeat(43))))).toEqual(['error:line.length#1']);
    expect(rules(srt(cap(0, 4000, 'one', 'two', 'three')))).toEqual(['error:line.count#1']);
  });

  it('fails reading speed over 20 characters/s (en) and 9 (zh-Hans), spaces counted per profile', () => {
    // 40 characters, spaces included: 2.0 s is 20/s, 1.9 s is over
    const forty = ['abcd efghi jklmn opqrs', 'tuvw xyzab cdefgh']; // 22 + 1 + 17
    expect(speedChars(forty, SUBTITLE_PROFILES.en)).toBe(40);
    expect(rules(srt(cap(0, 2000, ...forty)))).toEqual([]);
    expect(rules(srt(cap(0, 1900, ...forty)))).toEqual(['error:speed#1']);
    // the space is a pause, not counted: 9 characters in 1.0 s pass, 10 do not
    expect(rules(srt(cap(0, 1000, '一二三四 五六七八九')), 'zh-Hans')).toEqual([]);
    expect(rules(srt(cap(0, 1000, '一二三四 五六七八九十')), 'zh-Hans')).toEqual(['error:speed#1']);
  });

  it('warns (only) on a caption under our minimum duration', () => {
    expect(MIN_DURATION_MS).toBe(1000);
    expect(rules(srt(cap(0, 1000, 'ok')))).toEqual([]);
    expect(rules(srt(cap(0, 999, 'ok')))).toEqual(['warning:duration.min#1']);
    expect(lintSrt(srt(cap(0, 999, 'ok')), 'en')).toMatchObject({ errors: 0, warnings: 1 });
  });

  it('fails ，and 。, half-width ? ! : , . outside a Latin run and a half-width " in zh-Hans, and nothing else', () => {
    expect(zhPunctuationFaults('设想：云端常驻 你合上电脑它也不停')).toEqual([]);
    expect(zhPunctuationFaults('6.4 s → 1.6 s avg 3:44')).toEqual([]);
    expect(zhPunctuationFaults('Router 忙得过来吗？')).toEqual([]);
    expect(zhPunctuationFaults('切换，等待。')).toEqual(['uses ，or 。: a pause is a single space']);
    expect(zhPunctuationFaults('忙得过来吗? 好:')).toEqual(['half-width ? : outside a Latin run: use ？！： and drop commas and full stops']);
    // after a Latin word, or a space, it is still half-width
    expect(zhPunctuationFaults('Router?')).toEqual(['half-width ? outside a Latin run: use ？！： and drop commas and full stops']);
    expect(zhPunctuationFaults('你好 ! Worker, 好')).toEqual(['half-width ! , outside a Latin run: use ？！： and drop commas and full stops']);
    expect(zhPunctuationFaults('他说"好"')).toEqual(['half-width quotation mark ": use full-width quotation marks']);
    expect(zhPunctuationFaults('他说“好”')).toEqual([]);
    expect(rules(srt(cap(0, 4000, '切换，等待')), 'zh-Hans')).toEqual(['error:zh.punctuation#1']);
    // the English profile has no such rule
    expect(rules(srt(cap(0, 4000, '切换，等待')))).toEqual([]);
    // 16 characters a line in zh-Hans
    expect(rules(srt(cap(0, 4000, '一'.repeat(17))), 'zh-Hans')).toEqual(['error:line.length#1']);
  });

  it('warns on a BOM and CRLF line endings, which it still reads', () => {
    expect(rules(`${String.fromCharCode(0xfeff)}${srt(cap(0, 2000, 'ok')).replace(/\n/g, '\r\n')}`)).toEqual(['warning:file.bom', 'warning:file.crlf']);
  });

  it('checks only the structure of a language without a profile, and says so', () => {
    const r = lintSrt(srt(cap(0, 500, 'x'.repeat(80), 'y', 'z')), 'fr');
    expect(r.profile).toBeNull();
    expect(r.issues.map((i) => i.rule)).toEqual(['profile.none', 'duration.min']);
    expect(r.errors).toBe(0);
  });
});
