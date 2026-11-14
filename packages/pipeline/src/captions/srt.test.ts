import { describe, expect, it } from 'vitest';
import { formatSrt, formatSrtTime, parseSrt, parseSrtTime, type Caption } from './srt.ts';

const CAPS: Caption[] = [
  { start: 867, end: 4467, lines: ['Your AI agents work in parallel.', 'You can’t.'] },
  { start: 5533, end: 6867, lines: ['谁来调度智能体？'] },
  { start: 3_725_004, end: 3_726_000, lines: ['past the hour'] },
];

describe('SRT', () => {
  it('formats times as HH:MM:SS,mmm, hours growing past two digits', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000');
    expect(formatSrtTime(867)).toBe('00:00:00,867');
    expect(formatSrtTime(3_725_004)).toBe('01:02:05,004');
    expect(formatSrtTime(100 * 3_600_000)).toBe('100:00:00,000');
    expect(() => formatSrtTime(1.5)).toThrow(/whole number/);
    expect(() => formatSrtTime(-1)).toThrow(/whole number/);
    expect(parseSrtTime('01:02:05,004')).toBe(3_725_004);
    expect(parseSrtTime('00:00:60,000')).toBeNull();
    expect(parseSrtTime('00:00:01.000')).toBeNull();
  });

  it('writes numbered blocks with LF, a blank line between them and a final newline', () => {
    const srt = formatSrt(CAPS);
    expect(srt).toBe(
      [
        '1',
        '00:00:00,867 --> 00:00:04,467',
        'Your AI agents work in parallel.',
        'You can’t.',
        '',
        '2',
        '00:00:05,533 --> 00:00:06,867',
        '谁来调度智能体？',
        '',
        '3',
        '01:02:05,004 --> 01:02:06,000',
        'past the hour',
        '',
      ].join('\n'),
    );
    expect(srt).not.toMatch(/\r/);
    expect(formatSrt([])).toBe('');
  });

  it('round-trips: parse(format(x)) gives x back, with indices and the line of each index', () => {
    const p = parseSrt(formatSrt(CAPS));
    expect(p.errors).toEqual([]);
    expect(p.captions.map(({ start, end, lines }) => ({ start, end, lines }))).toEqual(CAPS);
    expect(p.captions.map((c) => [c.index, c.line])).toEqual([
      [1, 1],
      [2, 6],
      [3, 10],
    ]);
    expect(formatSrt(p.captions)).toBe(formatSrt(CAPS));
  });

  it('reads CRLF, a BOM and extra blank lines, and says so', () => {
    const p = parseSrt(`${String.fromCharCode(0xfeff)}${formatSrt(CAPS).replace(/\n/g, '\r\n')}\r\n\r\n`);
    expect(p).toMatchObject({ bom: true, crlf: true, errors: [] });
    expect(p.captions).toHaveLength(3);
    expect(p.captions[0].lines).toEqual(CAPS[0].lines);
    expect(parseSrt(formatSrt(CAPS))).toMatchObject({ bom: false, crlf: false });
  });

  it('reports a missing blank line between two captions, and reads both', () => {
    const p = parseSrt(['1', '00:00:01,000 --> 00:00:02,000', 'hello', '2', '00:00:05,000 --> 00:00:09,000', 'world', '', '3', '00:00:09,000 --> 00:00:10,000', 'x'].join('\n'));
    expect(p.errors).toEqual([{ line: 4, message: "'2' starts a new caption without the blank line before it" }]);
    expect(p.captions.map((c) => [c.index, c.line, c.lines])).toEqual([
      [1, 1, ['hello']],
      [2, 4, ['world']],
      [3, 8, ['x']],
    ]);
    // without text in the first, and without the second's index
    expect(parseSrt('1\n00:00:01,000 --> 00:00:09,000\n2\n00:00:05,000 --> 00:00:09,000\n').errors.map((e) => e.line)).toEqual([3]);
    expect(parseSrt('1\n00:00:01,000 --> 00:00:09,000\nhi\n00:00:05,000 --> 00:00:09,000\nworld\n').errors.map((e) => [e.line, e.message.slice(0, 40)])).toEqual([
      [4, "'00:00:05,000 --> 00:00:09,000' starts a"],
      [4, "expected a caption index (a whole number"],
    ]);
  });

  it('reports a block it cannot read, with its line, and keeps the others', () => {
    const p = parseSrt(['1', '00:00:01,000 --> 00:00:02,000', 'ok', '', 'two', '00:00:03,000 --> 00:00:04,000', 'x', '', '3', '00:00:05.000 --> 00:00:06,000', 'y', '', '4', '00:00:07,000 --> 00:00:08,000', ''].join('\n'));
    expect(p.captions.map((c) => c.index)).toEqual([1, 4]);
    expect(p.captions[1].lines).toEqual([]);
    expect(p.errors).toEqual([
      { line: 5, message: expect.stringMatching(/expected a caption index.*'two'/) },
      { line: 10, message: expect.stringMatching(/expected 'HH:MM:SS,mmm --> HH:MM:SS,mmm' after index 3/) },
    ]);
  });
});
