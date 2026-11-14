import { describe, expect, it } from 'vitest';
import { lineChars, SUBTITLE_PROFILES } from './profiles.ts';
import { paginate, wrapParagraph, wrapText } from './wrap.ts';

const en = SUBTITLE_PROFILES.en;
const zh = SUBTITLE_PROFILES['zh-Hans'];

describe('wrapping', () => {
  it('keeps a line that fits whole, and collapses runs of white space', () => {
    expect(wrapParagraph('You’ve quietly become their router.', en)).toEqual(['You’ve quietly become their router.']);
    expect(wrapParagraph('  two   spaces\there ', en)).toEqual(['two spaces here']);
    expect(wrapParagraph('   ', en)).toEqual([]);
  });

  it('balances two lines, a tie going to the shorter top line', () => {
    expect(wrapParagraph('Charts re-plotted from the authors’ synthetic tests', en)).toEqual(['Charts re-plotted from the', 'authors’ synthetic tests']);
    // 'aaaa bbbb cccc' at 9: 4 + 9 or 9 + 4, a tie: the top line is the shorter
    expect(wrapParagraph('aaaa bbbb cccc', { maxLineChars: 9, script: 'latin' })).toEqual(['aaaa', 'bbbb cccc']);
    expect(wrapParagraph('aa bb cc dd', { maxLineChars: 8, script: 'latin' })).toEqual(['aa bb', 'cc dd']);
  });

  it('prefers a break after clause punctuation up to 11 characters off balance, not further', () => {
    expect(wrapParagraph('Your AI agents work in parallel. You can’t.', en)).toEqual(['Your AI agents work in parallel.', 'You can’t.']);
    expect(wrapParagraph('It listens for events, so no one has to prompt each run.', en)).toEqual(['It listens for events,', 'so no one has to prompt each run.']);
    expect(wrapParagraph('Chinese original 31 Oct 2026 · machine-translated 1 Nov 2026', en)).toEqual(['Chinese original 31 Oct 2026 ·', 'machine-translated 1 Nov 2026']);
    expect(wrapParagraph('Above: one long-lived Router hears every channel.', en)).toEqual(['Above: one long-lived', 'Router hears every channel.']);
  });

  it('uses as few lines as fit, more than two when it must', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen';
    const lines = wrapParagraph(long, en);
    expect(lines).toHaveLength(3);
    expect(lines.join(' ')).toBe(long);
    for (const l of lines) expect(lineChars(l)).toBeLessThanOrEqual(42);
  });

  it('cuts a word longer than a line into line-long pieces', () => {
    expect(wrapParagraph('see abcdefghijkl', { maxLineChars: 5, script: 'latin' })).toEqual(['see', 'abcde', 'fghij', 'kl']);
    expect(wrapParagraph('https://example.com/a/very/long/path/that/never/breaks/at/a/space', en).every((l) => lineChars(l) <= 42)).toBe(true);
  });

  it('keeps explicit breaks: each paragraph is wrapped on its own, blank ones dropped', () => {
    expect(wrapText('Source: “Exploring Super-agent Design:\nTowards a More Autonomous Agent System”\n\nNot affiliated with DeepSeek', en)).toEqual([
      ['Source: “Exploring Super-agent Design:'],
      ['Towards a More Autonomous Agent System”'],
      ['Not affiliated with DeepSeek'],
    ]);
    expect(wrapText('short\nCharts re-plotted from the authors’ synthetic tests', en)).toEqual([['short'], ['Charts re-plotted from the', 'authors’ synthetic tests']]);
  });

  it('breaks CJK text without spaces between characters, preferring a pause', () => {
    // no space at all: 20 characters on two lines of 10
    expect(wrapParagraph('一二三四五六七八九十一二三四五六七八九十', zh)).toEqual(['一二三四五六七八九十', '一二三四五六七八九十']);
    // a pause (a space) wins over the balanced cut, and is dropped at the break
    expect(wrapParagraph('切换 逐次下指令 等待 还得守着它们别停', zh)).toEqual(['切换 逐次下指令', '等待 还得守着它们别停']);
    expect(wrapParagraph('谁来调度智能体？', zh)).toEqual(['谁来调度智能体？']);
  });

  it('never breaks CJK text before closing punctuation, after opening punctuation or inside a Latin run', () => {
    const text = '读一本《书》吧？好的：走';
    for (let w = 3; w <= 8; w++) {
      const lines = wrapParagraph(text, { maxLineChars: w, script: 'cjk' });
      expect(lines.join('')).toBe(text);
      for (const l of lines) {
        expect(l, `width ${w}: ${lines.join(' / ')}`).not.toMatch(/^[》？：]/u);
        expect(l, `width ${w}: ${lines.join(' / ')}`).not.toMatch(/《$/u);
      }
    }
    const narrow = { maxLineChars: 4, script: 'cjk' as const };
    // a Latin run stays whole while it fits a line, and is cut only when it does not
    expect(wrapParagraph('用abc做事', narrow)).toEqual(['用abc', '做事']);
    expect(wrapParagraph('用Router', narrow)).toEqual(['用', 'Rout', 'er']);
    const credit = 'Super-agent（超级智能体）· DeepSeek Harness 团队的设计';
    const lines = wrapParagraph(credit, zh);
    expect(lines.join(' ').replace(/\s/g, '')).toBe(credit.replace(/\s/g, ''));
    expect(lines[0]).toMatch(/^Super-agent/);
    for (const l of lines) expect(lineChars(l)).toBeLessThanOrEqual(16);
  });

  it('puts paragraphs on pages of at most maxLines lines, whole where they fit', () => {
    expect(paginate([['a'], ['b'], ['c']], 2)).toEqual([['a', 'b'], ['c']]);
    expect(paginate([['a'], ['b1', 'b2'], ['c']], 2)).toEqual([['a'], ['b1', 'b2'], ['c']]);
    expect(paginate([['a1', 'a2', 'a3'], ['b']], 2)).toEqual([['a1', 'a2'], ['a3', 'b']]);
    expect(paginate([], 2)).toEqual([]);
  });
});
