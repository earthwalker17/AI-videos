/**
 * Section 4, third answer: arrivals wait for the running call to end, then enter together.
 *
 * A look-down on the Router's plane. A call is running: a lit stretch of the rail. Arrivals come
 * down the three channels at their own times and stop short of the rail, unlit. On the bar line
 * the call ends, those waiting step in together, and one light takes them all. Under the test's
 * figures every call holds three: the same light, shared. Then a burst: a call fills its places
 * and the rest wait for the next one.
 *
 * The picture does not stop at this section's end: cache.ts carries the same rail on.
 */
import { SECTIONS, at, line } from '../cues.ts';
import type { Pose } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { prog } from '../kit/time.ts';
import { R, rail } from './batch-rail.ts';
import { rest } from './lift.ts';
import type { Anchor, Section } from './section.ts';

export const FROM = SECTIONS.batch;

/**
 * Steep enough that the far edge of the Workers' slab, which shows through from below, lies above
 * the words and not behind them.
 */
export const TILT = 73;

/**
 * Down on the rail, which lies low in the frame: the words have the clear ground above it, the
 * channels the ground below. The present stands right of the middle, the history runs off left.
 */
export const BATCH_VIEW: readonly [Pose, Pose] = [
  { target: [512, R, 0], tilt: TILT, yaw: 0, dist: 0.64, centre: [960, 650] },
  { target: [498, R, 0], tilt: TILT, yaw: 0, dist: 0.655, centre: [960, 650] },
];

/** the figure's baseline: its top stands on the title-safe edge */
const figure = (d: Draw) => d.type.layout('num', line('cost.n').text);
const figureY = (d: Draw): number => 124 + figure(d).cap;
const LEFT = 150;

export const batch: Section = {
  from: FROM,
  to: SECTIONS.cache,
  // it backs off a little while the calls run, and stays until the last of them have gone in (49,4)
  keys: [[at(41, 4), BATCH_VIEW[0]], [at(49, 4) + 12, BATCH_VIEW[1]]],
  place: {
    cost: (d): Anchor => ({ x: LEFT, y: figureY(d), align: 'left' }),
  },
  linePlace: {
    'cost.of': (d) => ({ x: LEFT, y: figureY(d) + 82, align: 'left' }),
    'cost.by': (d) => ({ x: LEFT, y: figureY(d) + 150, align: 'left' }),
    'cost.rate': (d) => ({ x: LEFT, y: figureY(d) + 212, align: 'left' }),
  },
  draw(d, f) {
    rest(d, f);
    rail(d, f, FROM, prog(f, FROM, FROM + 20));
  },
};
