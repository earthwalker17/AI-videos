/**
 * Bars 3-9: the terminal. MiniDSH's full-screen terminal doing the task, from the live take,
 * retimed to the beat (waits shortened, nothing reordered or changed):
 *
 *   3-5   wide on the turn as it streams (commands, the test output, thinking)
 *   5     the push-in lands on the refused edit (FS_NOT_OBSERVED) on the downbeat; a pan down
 *         to its error: "edit requires reading ... first"
 *   6     a cut on the downbeat: the read, then the edit that went through (+7 -1)
 *   7     wide again while the tests run
 *   8     a push to the reply: "Both tests pass."
 *   9     the payoff: the test's own table, its numbers sliding into right alignment
 */
import { clamp, easings } from '@aiv/core';
import { prog, type Vec2 } from '@aiv/web-kit';
import { ACTS, HITS, at } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { TUI_H, TUI_W, cellPx, paintAt } from '../tui.ts';
import { titles, type ActModule, type Ctx } from './common.ts';

/** Film frame -> real time in the take (ms): the take's own order, its waits shortened. */
const RETIME: readonly (readonly [number, number])[] = [
  [ACTS.terminal, 7241], // Enter
  [at(4, 3), 16900], // the commands, the failing test and the thinking, about 3x
  [HITS.refused, 17171], // the refused edit lands on the downbeat of bar 5
  [at(5, 4) + 20, 18250], // held while the push lands and pans (its rows do not move)
  [HITS.read, 20578], // the cut: the read and the edit that went through
  [at(7, 1), 21600],
  [HITS.pass, 22963], // "Both tests pass."
  [HITS.pass + 12, 23717], // the reply streams in quickly and the turn is over: it is still when read
  [ACTS.handoff, 23717],
];
export function realTime(f: number): number {
  if (f <= RETIME[0]![0]) return RETIME[0]![1];
  for (let i = 1; i < RETIME.length; i++) {
    const [f1, t1] = RETIME[i]!;
    const [f0, t0] = RETIME[i - 1]!;
    if (f <= f1) return t0 + ((t1 - t0) * (f - f0)) / (f1 - f0);
  }
  return RETIME.at(-1)![1];
}
/** The paint a frame shows: every sub-frame of a frame shows the same one. */
export const paintOf = (f: number): number => paintAt(realTime(Math.round(f)));

/** A crop of the terminal canvas (canvas px) shown at a screen centre and scale. */
interface Frame {
  crop: readonly [number, number, number, number];
  centre: Vec2;
  k: number;
}
const WIDE: Frame = { crop: [0, 0, TUI_W, TUI_H], centre: [1215, 640], k: 0.5 };
/** rows `a`..`b` (inclusive), columns 0..`cols`, at scale k: 40 px text reads at 36 px from k 0.9 */
function rows(a: number, b: number, cols: number, centre: Vec2, k: number): Frame {
  const [x0, y0] = cellPx(0, a);
  const [x1, y1] = cellPx(cols, b + 1);
  return { crop: [x0 - 30, y0 - 14, x1 - x0 + 60, y1 - y0 + 28], centre, k };
}
const REFUSED = rows(1, 9, 62, [1130, 650], 0.9);
const ERROR = rows(14, 22, 62, [1130, 650], 0.9);
const READ = rows(1, 8, 62, [1130, 650], 0.9);
const REPLY = rows(12, 24, 60, [1130, 680], 0.9);

/** A camera move: the scale changes geometrically, the pane's size on screen linearly. */
function mix(a: Frame, b: Frame, t: number): Frame {
  const m = (x: number, y: number) => x + (y - x) * t;
  const k = a.k * Math.pow(b.k / a.k, t);
  const w = m(a.crop[2] * a.k, b.crop[2] * b.k) / k;
  const h = m(a.crop[3] * a.k, b.crop[3] * b.k) / k;
  const cx = m(a.crop[0] + a.crop[2] / 2, b.crop[0] + b.crop[2] / 2);
  const cy = m(a.crop[1] + a.crop[3] / 2, b.crop[1] + b.crop[3] / 2);
  return { crop: [cx - w / 2, cy - h / 2, w, h], centre: [m(a.centre[0], b.centre[0]), m(a.centre[1], b.centre[1])], k };
}
/** the wide shot, pushed in a little: the stream of commands is never a dead hold */
const WIDE_IN: Frame = { ...WIDE, centre: [1190, 655], k: 0.56 };

/** The camera on the terminal at film frame f. */
function frameAt(f: number): Frame {
  if (f < at(4, 4) - 15) return mix(WIDE, WIDE_IN, prog(f, ACTS.terminal, at(4, 4) - 15, easings.inOutSine));
  if (f < HITS.refused) return mix(WIDE_IN, REFUSED, prog(f, at(4, 4) - 15, HITS.refused, easings.inOutCubic));
  if (f < at(5, 3) - 10) return REFUSED;
  if (f < HITS.read) return mix(REFUSED, ERROR, prog(f, at(5, 3) - 10, at(6, 1) - 4, easings.inOutSine));
  if (f < at(7, 1)) return READ;
  if (f < HITS.pass - 30) return WIDE;
  if (f < HITS.table) return mix(WIDE, REPLY, prog(f, HITS.pass - 30, HITS.pass + 16, easings.inOutCubic));
  return REPLY;
}

/** Draws the terminal pane through a frame (also used by the hook and the hand-off). */
export function drawTerminal(c: Ctx, paint: number, fr: Frame, opts: { gain?: number; opacity?: number } = {}): void {
  const [x, y, w, h] = fr.crop;
  c.d.screenPane(fr.centre, [(w * fr.k) / 2, (h * fr.k) / 2], c.term(paint), { crop: [x, y, w, h], radius: 16, shadow: SHADOW, gain: opts.gain, opacity: opts.opacity });
}

export const WIDE_FRAME = WIDE;

/** The test's own data (test/table.test.js): text left, numbers sliding to the right. */
const TABLE: readonly [string, string][] = [
  ['item', 'qty'],
  ['bolts', '120'],
  ['nuts', '8'],
];
function payoff(f: number, c: Ctx): void {
  // in on the hit, gone before the hand-off so the reply shows for the match cut
  const show = prog(f, HITS.table - 24, HITS.table, easings.outCubic) * (1 - prog(f, at(9, 3) + 16, at(9, 4) + 4, easings.inCubic));
  if (show <= 0) return;
  const slide = prog(f, HITS.table + 6, HITS.table + 30, easings.inOutCubic);
  const cx = 1215;
  const cy = 640;
  const lift = (1 - show) * 30;
  c.d.box([cx, cy + lift], [380, 200], 22, PAL.paper, { alpha: show });
  // monospace columns: 'item ' / 'bolts' / 'nuts ' then two spaces, the qty column 3 wide
  const charW = 66 * 0.6;
  const left = cx - 6 * charW;
  const top = cy - 70 + lift;
  TABLE.forEach(([name, qty], i) => {
    const y = top + i * 90;
    c.d.text('table', name, left, y, { rgb: PAL.paperInk, alpha: show });
    const leftAligned = left + 7 * charW;
    const rightAligned = left + (7 + 3 - qty.length) * charW;
    const isNum = i > 0;
    const x = isNum ? leftAligned + (rightAligned - leftAligned) * slide : leftAligned;
    c.d.text('table', qty, x, y, { rgb: PAL.paperInk, alpha: show });
  });
}

export const terminal: ActModule = {
  needs: () => [],
  // the cut to the read and the edit, and the cut back to wide
  cuts: [HITS.read, at(7, 1)],
  draw(f, c) {
    const fr = frameAt(f);
    const dim = 1 - 0.75 * prog(f, HITS.table - 24, HITS.table, easings.outCubic) * (1 - prog(f, at(9, 3) + 16, at(9, 4) + 4, easings.inCubic));
    drawTerminal(c, paintOf(f), fr, { gain: dim });
    payoff(f, c);
    titles(f, c.d, 'terminal');
  },
};

/** For the hand-off: the reply sentence's place on screen in the REPLY framing. */
export const REPLY_FRAME = REPLY;
export const clampUnit = (x: number) => clamp(x);
