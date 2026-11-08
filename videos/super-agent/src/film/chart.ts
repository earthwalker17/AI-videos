/**
 * The timetable panel's numbers and layout (TREATMENT.md, beat 6; FACTS.md, block 113 of the
 * article's results table): three lanes from one shared start line, each a rail with a dot at the
 * typical (p50) task time and a terminus bar at the slowest (p95), on ONE unitless scale, so the
 * lengths are exactly proportional to the article's minutes. No time axis and no minute value is
 * ever drawn. A paler second column draws the cache-read tokens per run, again on one scale.
 * Pure: tested in chart.test.ts.
 */
import type { WordsId } from '../cues.ts';

/** One run of the authors' synthetic test (FACTS.md, block 113). Minutes and millions: never shown. */
export interface ChartRun {
  id: 'one' | 'told' | 'two';
  /** the lane's name in WORDS */
  lane: WordsId;
  /** p50 task time, minutes */
  typical: number;
  /** p95 task time, minutes */
  slowest: number;
  /** cache-read tokens per run, millions */
  tokens: number;
  /** the two-level design (ink); the single-session baselines are drawn in the sketch tone */
  built: boolean;
}

export const RUNS: readonly ChartRun[] = [
  { id: 'one', lane: 'laneOne', typical: 20.4, slowest: 29.5, tokens: 6.1, built: false },
  { id: 'told', lane: 'laneTold', typical: 13.8, slowest: 29.0, tokens: 10.8, built: false },
  { id: 'two', lane: 'laneTwo', typical: 12.4, slowest: 15.7, tokens: 23.2, built: true },
];

export interface ChartBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaneLayout {
  run: ChartRun;
  /** the rail's centre line */
  y: number;
  /** where the rail starts (the shared start line), its typical dot and its terminus */
  x0: number;
  dotX: number;
  endX: number;
  /** the token bar: from the token column's start to `tokenX1`, centred on `y` */
  tokenX1: number;
}

export interface TimetableLayout {
  /** the header band: its baseline (the legend's) and the rule under it */
  header: { x: number; baseline: number; ruleY: number; ruleX1: number };
  /** the shared start line */
  start: { x: number; y0: number; y1: number };
  /** the rule between the timetable and the token column, and where the token bars start */
  tokens: { divider: number; x0: number };
  lanes: LaneLayout[];
  /** world units per minute and per million tokens: one scale each */
  minute: number;
  million: number;
}

/** Inner margin of the panel, world units. */
export const CHART_PAD = 48;

/**
 * The layout inside a panel box: a header band, then three lanes. The longest slowest-time rail
 * fills the timetable's width, the largest token bar the token column's.
 */
export function timetable(box: ChartBox, runs: readonly ChartRun[] = RUNS): TimetableLayout {
  const left = box.x + CHART_PAD;
  const right = box.x + box.w - CHART_PAD;
  const headerBaseline = box.y + 72;
  const ruleY = box.y + 104;
  // the timetable takes about 2/3 of the width, the tokens the rest
  const startX = left + 96;
  const divider = Math.round(left + (right - left) * 0.68);
  const railEnd = divider - 144;
  const tokenX0 = divider + 48;
  const slowest = Math.max(...runs.map((r) => r.slowest));
  const most = Math.max(...runs.map((r) => r.tokens));
  const minute = (railEnd - startX) / slowest;
  const million = (right - tokenX0) / most;
  const laneTop = ruleY + 120;
  const laneBottom = box.y + box.h - 84;
  const pitch = runs.length > 1 ? (laneBottom - laneTop) / (runs.length - 1) : 0;
  const lanes = runs.map((run, i) => {
    const y = laneTop + i * pitch;
    return { run, y, x0: startX, dotX: startX + minute * run.typical, endX: startX + minute * run.slowest, tokenX1: tokenX0 + million * run.tokens };
  });
  return {
    header: { x: left, baseline: headerBaseline, ruleY, ruleX1: right },
    start: { x: startX, y0: ruleY + 48, y1: box.y + box.h - 40 },
    tokens: { divider, x0: tokenX0 },
    lanes,
    minute,
    million,
  };
}
