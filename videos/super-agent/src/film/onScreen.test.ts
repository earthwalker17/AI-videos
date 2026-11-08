import { describe, expect, it } from 'vitest';
import { MOTION_TESTS, ROUND2 } from '../lookdev/frames.ts';
import { cueShown, narrationAt } from './onScreen.ts';

describe('what the cue sheet shows at the round-2 lookdev frames', () => {
  it('still (a) shows C4 alone', () => {
    expect(narrationAt(ROUND2.stillA)).toEqual(['c4']);
  });
  it('still (b) shows C12 alone, and the built tag has gone', () => {
    expect(narrationAt(ROUND2.stillB)).toEqual(['c12']);
    expect(cueShown('c12', ROUND2.stillB - 6) && cueShown('c12', ROUND2.stillB + 6)).toBe(true);
    expect(cueShown('tag-built', ROUND2.stillB)).toBe(false);
    expect(cueShown('tag-built', ROUND2.tag)).toBe(true);
    expect(narrationAt(ROUND2.tag)).toEqual(['c11']);
  });
  it('still (c) shows N5 alone', () => {
    expect(narrationAt(ROUND2.stillC)).toEqual(['n5']);
  });
  it('the chart frame shows C21 under the chart’s tags', () => {
    expect(narrationAt(ROUND2.chart)).toEqual(['c21']);
    for (const id of ['tag-chart', 'tag-load', 'chart-lanes']) expect(cueShown(id, ROUND2.chart), id).toBe(true);
  });
  it('still (d) is the sign-off rest: no narration and no tag', () => {
    expect(narrationAt(ROUND2.stillD)).toEqual([]);
    for (const id of ['tag-built', 'tag-gate', 'tag-100', 'tag-chart', 'tag-load', 'tag-proposed', 'chart-lanes', 'chart-tokens', 'plate', 'ideas', 'key-map']) expect(cueShown(id, ROUND2.stillD), id).toBe(false);
  });
  it('the step-down check shows C27 alone', () => {
    expect(narrationAt(ROUND2.stepDown)).toEqual(['c27']);
  });
  it('the motion tests cover their handshakes: MT2 holds the turn, MT1 the report up and the reply', () => {
    const [a2, b2] = MOTION_TESTS.mt2;
    expect(a2 < 1440 && 1440 < b2).toBe(true);
    const [a1, b1] = MOTION_TESTS.mt1;
    expect(narrationAt(2200)).toEqual(['c12']);
    expect(a1 < 2200 && 2200 < b1).toBe(true);
  });
  it('hands one line over to the next: the fade out, then the wipe in, never both', () => {
    // c3's window ends at f660 where n1's begins: c3 fades over f654-659, n1 wipes in from f661
    expect(narrationAt(657)).toEqual(['c3']);
    expect(narrationAt(660)).toEqual([]);
    expect(narrationAt(663)).toEqual(['n1']);
  });
});
