/**
 * Section 5, evidence: the authors' synthetic test, re-plotted without units.
 *
 * The camera rises off the stack while the caveats are read: the test is not the design, and the
 * chart gets clean ground. Two rows are named (the Super-agent; one session with a subagent tool,
 * told to delegate first), and only then does a length appear.
 *
 * A length is a trail: how long a task took, from a common left edge, with square ends. Both
 * trails run at the same pace, so the Super-agent's stops when about half the time has gone
 * (slowest tasks, p95: 15.7 to 29.0). They then draw back to the typical task on the same scale
 * (p50: 12.4 to 13.8), leaving the slowest behind them in ash. The price is light, because light
 * is a model reading tokens: three lit bands whose lengths are 23.2 to 10.8 to 6.1.
 *
 * No minutes, no axis, no figures: the table's clock is unstated (FACTS.md, section 6).
 */
import { clamp, easings, lerp, rand } from '@aiv/core';
import { LABELS, SECTIONS, at, line } from '../cues.ts';
import type { Pose } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale } from '../kit/look.ts';
import { TEXT_OUT, lineState, prog } from '../kit/time.ts';
import type { Anchor, Section } from './section.ts';
import { STACK_VIEW, stack } from './status-stack.ts';
import { strata } from './world.ts';

// ── the figures (the article's results table, FACTS.md section 4) ──────────────────────────────
/** completion time: the Super-agent, then one session with a subagent tool under the delegation prompt */
const P95 = [15.7, 29.0] as const;
const P50 = [12.4, 13.8] as const;
/** cache-read tokens: the Super-agent, that baseline, and the same single session left to choose */
const TOKENS = [23.2, 10.8, 6.1] as const;

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
const FROM = SECTIONS.evidence;
const TO = SECTIONS.status;
/** the stack has sunk out of the frame by here */
const ABOVE_BY = at(58, 2);
/** each row's lane is ruled from the common left edge as the rows are named */
const LANES: readonly [number, number] = [line('who.sa').frame - 8, at(59, 2)];
/** both trails leave the left edge; the slower one stops four beats later, the Super-agent's on the second */
const RUN = line('slow').frame;
const RUN_FRAMES = at(61, 3) - RUN;
/** the trails draw back to the typical task, once its headline is up */
const TYPICAL: readonly [number, number] = [line('typ').frame + 12, at(63, 1)];
/** the trails leave, and light takes their place */
const PRICE = line('price').frame;
const LIT_BY = at(64, 2);
/** the chart goes with its words, and the camera comes back down */
const CLEAR = at(66, 1) + 6;

// ── the camera ─────────────────────────────────────────────────────────────────────────────────
/** the same attitude, well above you: nothing of the stack is in frame */
const ABOVE: Pose = strata(STACK_VIEW.dist, 1900);

// ── the page ───────────────────────────────────────────────────────────────────────────────────
/** the common left edge, and where the longest length ends */
const X0 = 150;
const X1 = 1770;
const FULL = X1 - X0;
/** a trail's thickness */
const THICK = 30;
/** baselines of the two rows' names, and the middle of the trail under each; the third band hangs under the second row */
const ROWS = [
  { name: 490, trail: 550 },
  { name: 712, trail: 772 },
] as const;
const THIRD = 845;
/** while the rows are only named they stand higher, in the middle of the frame; they step down as the first headline lands */
const NAMED_UP = 104;
/** the test's stream of events, drifting along both lanes while the rows are named: how many, and px a frame */
const STREAM = { seed: 4205, count: 12, pace: 2.2 } as const;
/** the headline's two baselines (film.ts sets an h3 at 226; its lines are 0.9 of 132 px apart) */
const HEAD: Anchor = { x: X0, y: 226, align: 'left' };
const HEAD_2 = HEAD.y + 119;
/** while the stack is in frame, type stands right of you, as on the title card */
const BESIDE_YOU = 596;

/**
 * How far both trails have run at `f`, in the table's unit. One law for both rows, so their heads
 * are level until the shorter one stops: it reaches 15.7 on the second beat and 29.0 on the fourth.
 */
function ran(f: number): number {
  const u = clamp((f - RUN) / RUN_FRAMES);
  const ease = 4 * (P95[0] / P95[1] - 0.5);
  return P95[1] * (u + ease * u * (1 - u));
}

/** How far above their place in the chart the rows stand at `f`. */
const raised = (f: number): number => NAMED_UP * (1 - prog(f, RUN - 46, RUN - 16));

/** A length from the common left edge: a bar with square ends. */
function bar(d: Draw, y: number, len: number, rgb: readonly [number, number, number], alpha: number): void {
  if (len < 0.5 || alpha <= 0) return;
  d.box([X0 + len / 2, y], [len / 2, THICK / 2], 0, rgb, { alpha });
}

/** A lit band: tokens being read. Its length is the amount; its light is the same in every row. */
function band(d: Draw, y: number, len: number, f: number): void {
  if (len < 0.5) return;
  const p = d.pal;
  // its light on the ground
  d.box([X0 + len / 2, y], [len / 2, THICK / 2], 0, p.think, { alpha: 0.16, add: 1, feather: 44 });
  d.box([X0 + len / 2, y], [len / 2, THICK / 2], 0, scale(p.think, 1.5), { add: 0.4 });
  // the model reads on: a brighter stretch runs along it, as round a working cell. One pace for all, so a longer band carries more
  const pitch = 460;
  const reach = 90;
  const lead = (f * 4.5) % pitch;
  for (let x = lead - pitch; x < len + reach; x += pitch) {
    const from = Math.max(0, x - reach);
    const to = Math.min(len, x + reach);
    if (to - from < 24) continue;
    d.box([X0 + (from + to) / 2, y], [(to - from) / 2 - 10, THICK / 2 - 9], 0, scale(p.think, 2.4), { alpha: 0.75 * clamp((to - from - 24) / 60), add: 0.7, feather: 9 });
  }
}

function chart(d: Draw, f: number): void {
  const named = lineState('who.sa', f);
  const gone = clamp((f - CLEAR) / TEXT_OUT);
  if (named.enter <= 0 || f >= CLEAR + 16) return;
  const p = d.pal;

  // the trails: the slowest task, then the typical one, on one scale
  const away = prog(f, PRICE - 22, PRICE - 4, easings.inCubic);
  const head = ran(f);
  const typical = prog(f, TYPICAL[0], TYPICAL[1]);
  const unit = (FULL / P95[1]) * (1 - away);
  const laid = FULL * prog(f, LANES[0], LANES[1], easings.inOutSine);
  const stream = 1 - prog(f, RUN - 46, RUN - 20);
  const up = raised(f);
  for (let k = 0; k < ROWS.length; k++) {
    const y = ROWS[k]!.trail - up;
    const slowest = Math.min(head, P95[k]!) * unit;
    // the row's lane: its trail runs along it
    if (laid > slowest + 2 && away < 1) d.path([[X0 + slowest, y], [X0 + laid, y]], 2.2, p.ash, { alpha: 0.55 * (1 - away) });
    // before anything is measured, the same synthetic stream of events runs down both lanes
    for (let j = 0; stream > 0 && j < STREAM.count; j++) {
      // spread along the lane, never evenly
      const x = (((j + 0.12 + 0.76 * rand(STREAM.seed, j, 1)) / STREAM.count) * FULL + (f - LANES[0]) * STREAM.pace) % FULL;
      const a = stream * clamp((x - 8) / 40) * clamp((laid - 8 - x) / 40);
      if (a <= 0) continue;
      d.box([X0 + x, y], [13, 13], 13, mix(p.ash, p.bone, 0.7), { alpha: 0.9 * a });
      // a person sent this one
      if (rand(STREAM.seed, j, 2) < 0.3) d.box([X0 + x, y], [23, 23], 23, p.you, { stroke: 3, alpha: 0.9 * a });
    }
    bar(d, y, slowest, p.ash, 0.62);
    bar(d, y, lerp(Math.min(head, P95[k]!), P50[k]!, typical) * unit, p.bone, 0.94);
  }

  // the price: light
  const off = 1 - prog(f, CLEAR, CLEAR + 14, easings.inCubic);
  const token = FULL / TOKENS[0];
  const ys = [ROWS[0].trail, ROWS[1].trail, THIRD];
  for (let k = 0; k < TOKENS.length; k++) {
    const lit = prog(f, PRICE - 4 + 7 * k, LIT_BY + 6 * k, easings.outCubic);
    band(d, ys[k]!, TOKENS[k]! * token * lit * off, f);
  }

  // the rows' names stand for as long as the rows do
  d.text('label', LABELS.sa, X0, ROWS[0].name - up, { enter: named.enter, exit: gone });
  const base = d.text('label', LABELS.base, X0, ROWS[1].name - up, { enter: lineState('who.base', f).enter, exit: gone });
  // which single session this is stays beside its name under every length (FACTS.md, section 6: name the baseline).
  // At the price the name heads two bands, so the words move to the tip of the band they describe
  const told = lineState('who.told', f);
  const moved = clamp((f - (PRICE - 22)) / TEXT_OUT);
  if (told.enter > 0 && moved < 1) d.text('sup', told.l.text, X0 + base.width + 32, ROWS[1].name - up, { enter: told.enter, exit: Math.max(gone, moved) });

  // what each of the lower bands is, and how many of it the Super-agent spent, at its tip
  const two = lineState('price.two', f);
  const four = lineState('price.four', f);
  const rise = d.type.layout('sup', two.l.text).cap / 2;
  if (two.on) d.text('sup', `${two.l.text} ${told.l.text}`, X0 + TOKENS[1] * token + 30, ys[1]! + rise, { enter: two.enter, exit: two.exit });
  if (four.on) d.text('sup', four.l.text, X0 + TOKENS[2] * token + 30, ys[2]! + rise, { enter: four.enter, exit: four.exit });
}

function draw(d: Draw, f: number): void {
  stack(d, f);
  if (f <= FROM || f >= TO) return;
  chart(d, f);
}

export const evidence: Section = {
  from: FROM,
  to: TO,
  keys: [[FROM, STACK_VIEW], [ABOVE_BY, ABOVE], [at(66, 1), ABOVE]],
  place: {
    test: { x: BESIDE_YOU, y: HEAD.y, align: 'left' },
    slow: HEAD,
    typ: HEAD,
    price: HEAD,
  },
  linePlace: {
    // close under its headline: its descenders stay clear of the Router's far edge while the stack is still in frame
    'test.caveat': () => ({ x: BESIDE_YOU, y: 304, align: 'left' }),
    // the tag stands over the chart's far end, on the headline's second line
    'slow.tag': () => ({ x: X1, y: HEAD_2, align: 'right' }),
    'typ.tag': () => ({ x: X1, y: HEAD_2, align: 'right' }),
  },
  own: ['who.sa', 'who.base', 'who.told', 'price.two', 'price.four'],
  draw,
};
