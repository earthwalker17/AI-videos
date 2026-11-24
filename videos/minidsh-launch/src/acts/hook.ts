/**
 * Bars 1-2: the hook and poster. Frame 0 is complete (it is the thumbnail on platforms that use
 * the first frame): MiniDSH's mark, its name and one line upper left, and the real terminal's
 * composer, close and at an angle, with the task already typed (36 px), bleeding off the right
 * edge. The camera pushes in slowly; then the line leaves, the mark's teal dot drops, and the camera
 * pulls back and flat to the whole terminal as the dot lands in the caret: Enter, on bar 3.
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
/** the pull-back: from the dot's drop to Enter */
const SWING = [HITS.dotDrop, HITS.enter] as const;

/** A view of the terminal canvas: its crop (canvas px), where it sits, its scale and its angle. */
interface Shot {
  crop: readonly [number, number, number, number];
  centre: Vec2;
  k: number;
  yaw: number;
  pitch: number;
}
/** the composer: rows 24-29 (the box with the task, the status lines) */
const COMPOSER_TOP = cellPx(0, 24)[1] - 18;
const COMPOSER_BOTTOM = cellPx(0, 30)[1] + 12;
/** The poster: the composer at 0.9 (40 px glyphs at 36 px), its left part near, the rest bleeding off the right. */
const POSTER: Shot = { crop: [0, COMPOSER_TOP, TUI_W, COMPOSER_BOTTOM - COMPOSER_TOP], centre: [1430, 752], k: 0.9, yaw: 24, pitch: -4 };
/** ... pushed in a little by the end of the hold */
const POSTER_IN: Shot = { ...POSTER, centre: [1395, 746], k: 0.97, yaw: 21 };
const WIDE: Shot = { crop: [0, 0, TUI_W, TUI_H], centre: WIDE_FRAME.centre, k: WIDE_FRAME.k, yaw: 0, pitch: 0 };

/** A camera move between two shots: the scale changes geometrically, the size on screen linearly. */
function mixShot(a: Shot, b: Shot, t: number): Shot {
  const m = (x: number, y: number) => x + (y - x) * t;
  const k = a.k * Math.pow(b.k / a.k, t);
  const w = m(a.crop[2] * a.k, b.crop[2] * b.k) / k;
  const h = m(a.crop[3] * a.k, b.crop[3] * b.k) / k;
  const cx = m(a.crop[0] + a.crop[2] / 2, b.crop[0] + b.crop[2] / 2);
  const cy = m(a.crop[1] + a.crop[3] / 2, b.crop[1] + b.crop[3] / 2);
  return { crop: [cx - w / 2, cy - h / 2, w, h], centre: [m(a.centre[0], b.centre[0]), m(a.centre[1], b.centre[1])], k, yaw: m(a.yaw, b.yaw), pitch: m(a.pitch, b.pitch) };
}

/** The caret of the typed paint on screen in the wide framing (where the dot lands). */
function caretOnScreen(): Vec2 {
  const [cx, cy] = caretOf(TYPED) ?? [0, 0];
  const [x, y] = cellPx(cx, cy);
  const k = WIDE.k;
  return [WIDE.centre[0] + (x + 2 - TUI_W / 2) * k, WIDE.centre[1] + (y + 26 - TUI_H / 2) * k];
}

export const hook: ActModule = {
  needs: () => [],
  draw(f, c) {
    // the slow push through the hold, then the pull-back and flat into the terminal act's framing
    const hold = mixShot(POSTER, POSTER_IN, easings.inOutSine(clamp(f / SWING[0])));
    const s = mixShot(hold, WIDE, prog(f, SWING[0], SWING[1], easings.inOutCubic));
    const half: Vec2 = [(s.crop[2] * s.k) / 2, (s.crop[3] * s.k) / 2];
    c.d.pane(world(s.centre), half, c.term(TYPED), { crop: s.crop, yaw: s.yaw, pitch: s.pitch, radius: 16, shadow: SHADOW });

    // the mark, the name and the line: complete on frame 0, gone before the pane rises past them
    const t = title('t-hook');
    const exit = clamp((f - t.end) / TEXT_OUT);
    const markOut = prog(f, SWING[0] - 8, SWING[0] + 10, easings.inCubic);
    if (markOut < 1) {
      const a = 1 - markOut;
      c.d.screenPane(MARK_C, [MARK_SIZE / 2, MARK_SIZE / 2], c.mark, { opacity: a });
      c.d.text('title', 'MiniDSH', MARK_C[0] + 70, MARK_C[1] + 30, { alpha: a });
    }
    if (exit < 1) c.d.text('sub', t.text, 128, 330, { exit, by: 'line' });

    // the teal dot: it leaves the mark, swells in flight, and lands in the caret (Enter)
    const home = dotOf(MARK_C, MARK_SIZE);
    const r = (DOT_R * MARK_SIZE) / MARK_UNITS;
    const fall = prog(f, HITS.dotDrop - 6, HITS.enter, easings.inOutCubic);
    if (f < HITS.enter) {
      const end = caretOnScreen();
      const x = home[0] + (end[0] - home[0]) * fall;
      const y = home[1] + (end[1] - home[1]) * fall - Math.sin(fall * Math.PI) * 140;
      c.d.dot(world([x, y]), r * (1 + 1.7 * Math.sin(fall * Math.PI)) * (1 - 0.3 * fall), PAL.teal);
    }
  },
};

/** Real time of the typed paint (for tests and the storyboard). */
export const TYPED_T = paintTime(TYPED);
export type { Ctx };
