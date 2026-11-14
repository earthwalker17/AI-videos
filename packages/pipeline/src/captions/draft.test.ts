import { describe, expect, it } from 'vitest';
import { CueSheet, type CueEvent } from '@aiv/core';
import { draftCaptions, selectCues } from './draft.ts';
import { lintSrt } from './lint.ts';
import { formatSrt } from './srt.ts';

const sheetOf = (events: CueEvent[], over: Partial<CueSheet> = {}): CueSheet => CueSheet.parse({ schemaVersion: 1, fps: 30, filmFrames: 600, leaderFrames: 15, events, ...over });

const CREDIT = 'A credit that runs long enough to need a second line';
const SHEET = sheetOf([
  { id: 'title', kind: 'card', frame: 30, end: 150, text: { en: 'A Title', 'zh-Hans': '标题' } },
  { id: 'credit', kind: 'text', frame: 60, end: 150, text: { en: CREDIT } },
  { id: 'beat', kind: 'mark', frame: 155 },
  { id: 'n1', kind: 'text', frame: 160, end: 220, text: { en: 'First line.' } },
  { id: 'n2', kind: 'text', frame: 220, end: 280, text: { en: 'Second line.' } },
  { id: 'tag-a', kind: 'text', frame: 170, end: 190, text: { en: 'a tag' } },
  { id: 'hold-1', kind: 'hold', frame: 300, end: 420 },
  { id: 'end', kind: 'card', frame: 300, end: 420, text: { en: 'one\ntwo\nthree\nfour\nfive' } },
]);
const ids = (c: { cues: string[] }[]) => c.map((x) => x.cues.join('+'));

describe('selecting cues', () => {
  it('takes text and card cues by default, in sheet order', () => {
    expect(selectCues(SHEET).cues.map((e) => e.id)).toEqual(['title', 'credit', 'n1', 'n2', 'tag-a', 'end']);
    expect(selectCues(SHEET, { kinds: ['card'] }).cues.map((e) => e.id)).toEqual(['title', 'end']);
  });

  it('matches ids and globs, and names the ones that chose nothing of those kinds', () => {
    expect(selectCues(SHEET, { ids: ['n?', 'end', 'title'] })).toEqual({ cues: [SHEET.events[0], SHEET.events[3], SHEET.events[4], SHEET.events[7]], unmatched: [] });
    expect(selectCues(SHEET, { ids: ['tag-*'] }).cues.map((e) => e.id)).toEqual(['tag-a']);
    // 'beat' is a mark and 'hold-1' a hold: not text or card cues
    expect(selectCues(SHEET, { ids: ['n*', 'beat', 'hold-?', 'nope', 'n.'] }).unmatched).toEqual(['beat', 'hold-?', 'nope', 'n.']);
  });
});

describe('draft captions', () => {
  it('times each span on the delivery (the leader included) and rounds frames to ms one way', () => {
    const caps = draftCaptions(SHEET, selectCues(SHEET, { ids: ['n1', 'n2'] }).cues, 'en');
    // frame f of the film is delivery frame 15 + f: round((15 + f) × 1000 / 30)
    expect(caps).toEqual([
      { start: 5833, end: 7833, lines: ['First line.'], cues: ['n1'], frames: [160, 220] },
      { start: 7833, end: 9833, lines: ['Second line.'], cues: ['n2'], frames: [220, 280] },
    ]);
    // without a leader, film time
    const film = draftCaptions({ ...SHEET, leaderFrames: 0 }, selectCues(SHEET, { ids: ['n1'] }).cues, 'en');
    expect(film[0]).toMatchObject({ start: 5333, end: 7333 });
  });

  it('never overlaps touching captions, whatever the frame rate', () => {
    const fps = 30000 / 1001;
    const events: CueEvent[] = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, kind: 'text' as const, frame: i * 7 + (i % 3), end: (i + 1) * 7 + ((i + 1) % 3), text: { en: `line ${i}` } }));
    const caps = draftCaptions(sheetOf(events, { fps, leaderFrames: 0 }), events, 'en');
    expect(caps).toHaveLength(40);
    expect(caps[1].start).toBe(Math.round((8 * 1000) / fps));
    caps.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i) expect(c.start).toBe(caps[i - 1].end);
    });
  });

  it('wraps to the profile and shows a too-long cue as pages over its span, shared by characters', () => {
    const caps = draftCaptions(SHEET, selectCues(SHEET, { ids: ['credit', 'end'] }).cues, 'en');
    expect(caps[0].lines).toEqual(['A credit that runs long', 'enough to need a second line']);
    // five kept lines on pages of two: 'one two' (7), 'three four' (10), 'five' (4) over 120 frames
    expect(caps.slice(1).map((c) => [c.lines, c.frames])).toEqual([
      [['one', 'two'], [300, 340]],
      [['three', 'four'], [340, 397]],
      [['five'], [397, 420]],
    ]);
  });

  it('stacks overlapping cues while they fit, earliest first; else the newest wins until it ends', () => {
    const caps = draftCaptions(SHEET, selectCues(SHEET).cues, 'en');
    expect(caps.map((c) => [c.lines.join(' / '), c.frames])).toEqual([
      // the title, then the two-line credit: three lines do not fit, so the title leaves
      ['A Title', [30, 60]],
      ['A credit that runs long / enough to need a second line', [60, 150]],
      // the tag fits under the line: stacked, then the line alone again
      ['First line.', [160, 170]],
      ['First line. / a tag', [170, 190]],
      ['First line.', [190, 220]],
      ['Second line.', [220, 280]],
      ['one / two', [300, 340]],
      ['three / four', [340, 397]],
      ['five', [397, 420]],
    ]);
    expect(ids(caps)).toEqual(['title', 'credit', 'n1', 'n1+tag-a', 'n1', 'n2', 'end', 'end', 'end']);
    // a cue that loses its lines to a newer one comes back when that one ends
    const s = sheetOf([
      { id: 'a', kind: 'text', frame: 0, end: 100, text: { en: 'Long one' } },
      { id: 'b', kind: 'text', frame: 20, end: 40, text: { en: CREDIT } },
    ]);
    expect(draftCaptions(s, s.events, 'en').map((c) => [c.cues[0], c.frames])).toEqual([
      ['a', [0, 20]],
      ['b', [20, 40]],
      ['a', [40, 100]],
    ]);
  });

  it("judges which cue is newer by the cue's own start, not its page's", () => {
    // the card's page 2 starts at 118, after the note: the card is still the older cue, so it gives way
    const s = sheetOf([
      { id: 'card', kind: 'card', frame: 0, end: 300, text: { en: 'Page one line A\nPage one line B\nPage two line C\nPage two line D\nPage three line E' } },
      { id: 'note', kind: 'text', frame: 100, end: 230, text: { en: CREDIT } },
    ]);
    expect(draftCaptions(s, s.events, 'en').map((c) => [c.cues.join('+'), c.lines[0], c.frames])).toEqual([
      ['card', 'Page one line A', [0, 100]],
      ['note', 'A credit that runs long', [100, 230]],
      ['card', 'Page two line C', [230, 235]],
      ['card', 'Page three line E', [235, 300]],
    ]);
  });

  it('refuses a selection where a chosen cue or page would never be shown', () => {
    // same span, two lines each: the earlier in the sheet gives way the whole time
    const same = sheetOf([
      { id: 'c1', kind: 'text', frame: 0, end: 90, text: { en: CREDIT } },
      { id: 'c2', kind: 'text', frame: 0, end: 90, text: { en: 'Another line that runs long enough to need two' } },
    ]);
    expect(() => draftCaptions(same, same.events, 'en')).toThrow(/1 chosen cue\(s\) or page\(s\) would never be shown[^]*\n {2}cue 'c1' on frames \[0, 90\) under 'c2'$/);
    // a newer two-line cue covers an older one's whole span; a page of a card covered the same way
    const covered = sheetOf([
      { id: 'n3', kind: 'text', frame: 100, end: 160, text: { en: 'It listens for events.' } },
      { id: 'tag', kind: 'text', frame: 90, end: 200, text: { en: CREDIT } },
      { id: 'end', kind: 'card', frame: 300, end: 420, text: { en: 'one\ntwo\nthree\nfour\nfive' } },
      { id: 'key', kind: 'text', frame: 330, end: 400, text: { en: CREDIT } },
    ]);
    // 'tag' started first, so the newer 'n3' wins: nothing is lost there
    expect(() => draftCaptions(covered, covered.events.slice(0, 2), 'en')).not.toThrow();
    expect(() => draftCaptions(covered, covered.events.slice(2), 'en')).toThrow(/\n {2}cue 'end' \(page 2 of 3\) on frames \[340, 397\) under 'key'$/);
  });

  it('merges equal neighbouring pieces into one caption', () => {
    const s = sheetOf([
      { id: 'a', kind: 'text', frame: 0, end: 60, text: { en: CREDIT } },
      { id: 'b', kind: 'text', frame: 20, end: 40, text: { en: 'x' } },
      { id: 'c', kind: 'text', frame: 60, end: 90, text: { en: CREDIT } },
    ]);
    // b never fits beside a's two lines, so a holds [0, 20) and [40, 60) around it; c, with a's words, carries on
    expect(draftCaptions(s, s.events, 'en').map((c) => c.frames)).toEqual([
      [0, 20],
      [20, 40],
      [40, 90],
    ]);
  });

  it('makes a file the linter passes: no overlaps, no line or caption over the profile', () => {
    for (const lang of ['en'] as const) {
      const r = lintSrt(formatSrt(draftCaptions(SHEET, selectCues(SHEET, { ids: ['title', 'credit', 'n?', 'end'] }).cues, lang)), lang);
      expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
      // the last page, 'five', is up 23 frames: under our one-second minimum
      expect(r.issues.map((i) => i.rule)).toEqual(['duration.min']);
    }
  });

  it('wraps zh-Hans to its profile', () => {
    const s = sheetOf([{ id: 'z', kind: 'text', frame: 0, end: 300, text: { 'zh-Hans': '切换 逐次下指令 等待 还得守着它们别停' } }]);
    expect(draftCaptions(s, s.events, 'zh-Hans')[0].lines).toEqual(['切换 逐次下指令', '等待 还得守着它们别停']);
  });

  it('refuses a cue without words in the language, a point, a span too short for its pages, a language without a profile', () => {
    expect(() => draftCaptions(SHEET, selectCues(SHEET, { ids: ['credit'] }).cues, 'zh-Hans')).toThrow(/cue 'credit' has no 'zh-Hans' text \(it has: en\)/);
    expect(() => draftCaptions(SHEET, [SHEET.events[2]], 'en')).toThrow(/cue 'beat' has no 'en' text/);
    expect(() => draftCaptions(SHEET, [{ id: 'p', kind: 'text', frame: 3, text: { en: 'x' } }], 'en')).toThrow(/'p' is a point/);
    expect(() => draftCaptions(SHEET, [{ id: 'q', kind: 'card', frame: 3, end: 5, text: { en: 'a\nb\nc\nd\ne' } }], 'en')).toThrow(/needs 3 captions but lasts 2 frame/);
    expect(() => draftCaptions(SHEET, selectCues(SHEET, { ids: ['title'] }).cues, 'fr')).toThrow(/no subtitle profile for 'fr'/);
  });
});
