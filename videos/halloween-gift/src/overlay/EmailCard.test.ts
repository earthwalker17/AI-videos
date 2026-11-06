import { describe, expect, it } from 'vitest';
import { WORDS } from '../cues.ts';
import { emailLayout, EMAIL, PARAGRAPH, READ_PATH, SIGN_OFF } from './EmailCard.tsx';

describe('the email card', () => {
  it('reads what the cue sheet times: WORDS.email is the card read path', () => {
    expect(WORDS.email.en).toBe(READ_PATH);
    expect(WORDS.email['zh-Hans']).toBe('封号 申诉');
  });

  it('prints every word of its read path, the punch line on a row of its own', () => {
    const rows = PARAGRAPH.map((l) => l.runs.map((r) => r.t).join(''));
    const printed = ['Hello,', ...rows, ...SIGN_OFF, 'Appeal'].join(' ');
    for (const w of READ_PATH.split(' ')) expect(printed).toContain(w);
    expect(rows).toContain('Your Claude account has been buried.');
    expect(rows).toContain('Happy Halloween!');
    // the link is one run on one row: never split across a line
    expect(PARAGRAPH.flatMap((l) => l.runs).filter((r) => r.u).map((r) => r.t)).toContain('Trick-or-Treat Policy');
  });

  it('sets the read path at least 36 px tall where the card is held (the face about 765 px tall)', () => {
    const face = 765;
    const big = PARAGRAPH.filter((l) => l.runs.some((r) => r.b));
    expect(EMAIL.hello.size * face).toBeGreaterThanOrEqual(36);
    expect(EMAIL.tab.size * face).toBeGreaterThanOrEqual(36);
    for (const l of big) expect((l.size ?? EMAIL.para.size) * face).toBeGreaterThanOrEqual(36);
  });

  it("puts the Appeal tab where OverlayV2's bat looks for it", () => {
    const h = 765;
    const lay = emailLayout(h);
    expect(lay.tab.top).toBeCloseTo(h * (EMAIL.para.top + PARAGRAPH.length * EMAIL.para.size * EMAIL.para.lead) + h * 0.02, 6);
    expect(lay.tab.right).toBeCloseTo(h * EMAIL.pad, 6);
  });
});
