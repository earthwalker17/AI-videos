import { describe, expect, it } from 'vitest';
import { cueShown, narrationAt } from './onScreen.ts';
import { STILL_FRAMES } from './world.ts';

describe('what the cue sheet shows at the lookdev frames', () => {
  it('still 1 (f750) shows C4 alone', () => {
    expect(narrationAt(STILL_FRAMES.still1)).toEqual(['c4']);
  });
  it('still 2 (f1880) shows C12 alone, and the built tag has gone', () => {
    expect(narrationAt(STILL_FRAMES.still2)).toEqual(['c12']);
    expect(cueShown('tag-built', STILL_FRAMES.still2)).toBe(false);
    expect(cueShown('tag-built', 1750)).toBe(true);
  });
  it('still 3 (f4130) is the rest: no narration and no tag', () => {
    expect(narrationAt(STILL_FRAMES.still3)).toEqual([]);
    for (const id of ['tag-built', 'tag-gate', 'tag-chart', 'tag-proposed', 'chart-lanes', 'chart-tokens', 'plate']) expect(cueShown(id, STILL_FRAMES.still3)).toBe(false);
  });
  it('the step-down check (f4400) shows C27 alone', () => {
    expect(narrationAt(STILL_FRAMES.stepDown)).toEqual(['c27']);
  });
  it('hands one line over to the next: the fade out, then the wipe in, never both', () => {
    // c3's window ends at f660 where c4's begins: c3 fades over f654-659, c4 wipes in from f661
    expect(narrationAt(657)).toEqual(['c3']);
    expect(narrationAt(660)).toEqual([]);
    expect(narrationAt(663)).toEqual(['c4']);
  });
});
