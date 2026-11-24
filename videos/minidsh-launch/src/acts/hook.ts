/**
 * Bars 1-2: the hook and poster. Frame 0 is complete (it is the thumbnail on platforms that use
 * the first frame): MiniDSH's mark, its name and one line upper left, and the real terminal at a
 * three-quarter angle with the task already typed. The pane swings flat into the terminal act's
 * framing while the mark's teal dot drops into the terminal's caret, landing as Enter on bar 3.
 */
import { clamp, easings } from '@aiv/core';
import { prog, type Vec2 } from '@aiv/web-kit';
import { HITS, TEXT_OUT, title } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { dotOf, DOT_R, MARK_UNITS } from '../mark.ts';
import { TUI_H, TUI_W, caretOf, cellPx, paintAt, paintTime } from '../tui.ts';
import { world, type ActModule, type Ctx } from './common.ts';
import { WIDE_FRAME } from './terminal.ts';

/** The last paint before Enter: the task typed in the composer. */
const TYPED = paintAt(7240);
const MARK_C: Vec2 = [172, 196];
const MARK_SIZE = 92;
const SWING = [HITS.dotDrop - 20, HITS.enter] as const;

/** The pane in the poster: a 3/4 view, biased right and low. */
const POSTER = { centre: [1270, 668] as Vec2, half: [510, (510 * TUI_H) / TUI_W] as Vec2, yaw: -22, pitch: 3 };
const WIDE = { centre: WIDE_FRAME.centre, half: [(TUI_W * WIDE_FRAME.k) / 2, (TUI_H * WIDE_FRAME.k) / 2] as Vec2, yaw: 0, pitch: 0 };

/** The caret of the typed paint on screen in the wide framing (where the dot lands). */
function caretOnScreen(): Vec2 {
  const [cx, cy] = caretOf(TYPED) ?? [0, 0];
  const [x, y] = cellPx(cx, cy);
  const k = WIDE_FRAME.k;
  return [WIDE.centre[0] + (x + 2 - TUI_W / 2) * k, WIDE.centre[1] + (y + 26 - TUI_H / 2) * k];
}

export const hook: ActModule = {
  needs: () => [],
  draw(f, c) {
    const swing = prog(f, SWING[0], SWING[1], easings.inOutCubic);
    const drift = f / SWING[0];
    const m = (a: number, b: number) => a + (b - a) * swing;
    const centre: Vec2 = [m(POSTER.centre[0] - 14 * drift, WIDE.centre[0]), m(POSTER.centre[1], WIDE.centre[1])];
    const half: Vec2 = [m(POSTER.half[0] * (1 + 0.02 * drift), WIDE.half[0]), m(POSTER.half[1] * (1 + 0.02 * drift), WIDE.half[1])];
    c.d.pane(world(centre), half, c.term(TYPED), { yaw: m(POSTER.yaw, 0), pitch: m(POSTER.pitch, 0), radius: 16, shadow: SHADOW });

    // the mark, the name and the line: complete on frame 0, gone as the pane swings flat
    const t = title('t-hook');
    const exit = clamp((f - t.end) / TEXT_OUT);
    const markOut = prog(f, SWING[0] + 6, SWING[1] - 6, easings.inCubic);
    if (markOut < 1) {
      const a = 1 - markOut;
      c.d.screenPane(MARK_C, [MARK_SIZE / 2, MARK_SIZE / 2], c.mark, { opacity: a });
      c.d.text('title', 'MiniDSH', MARK_C[0] + 70, MARK_C[1] + 30, { alpha: a });
    }
    if (exit < 1) c.d.text('sub', t.text, 128, 330, { exit });

    // the teal dot: on the mark, then it falls into the terminal's caret (Enter)
    const home = dotOf(MARK_C, MARK_SIZE);
    const r = (DOT_R * MARK_SIZE) / MARK_UNITS;
    const fall = prog(f, HITS.dotDrop - 6, HITS.enter, easings.inOutCubic);
    if (f < HITS.enter) {
      const end = caretOnScreen();
      const x = home[0] + (end[0] - home[0]) * fall;
      const y = home[1] + (end[1] - home[1]) * fall - Math.sin(fall * Math.PI) * 120;
      c.d.dot(world([x, y]), r * (1 - 0.35 * fall), PAL.teal);
    }
  },
};

/** Real time of the typed paint (for tests and the storyboard). */
export const TYPED_T = paintTime(TYPED);
export type { Ctx };
