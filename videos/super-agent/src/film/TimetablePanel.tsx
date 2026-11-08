/**
 * The timetable panel (TREATMENT.md, beat 6): the panel tone with ink rules; three lanes from a
 * shared start line, each a rail with a dot at the typical time and a terminus bar at the slowest,
 * exactly proportional on one unitless scale (film/chart.ts); a paler column of token bars. No
 * axis, no minutes. Two parts: the panel in the world (TimetablePanel, inside a WorldLayer) and
 * its words in screen space (TimetableLabels, inside a ScreenLayer), every string from WORDS,
 * each shown only while its cue is on screen.
 */
import { useMemo } from 'react';
import { WORDS } from '../cues.ts';
import { AnchoredLabel, NON_SCALING, useCamera, worldToScreen } from '../kit/camera.tsx';
import { Label, lineWidth } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { C, GHOST_OPACITY, STROKE, TYPE } from '../look/tokens.ts';
import { timetable, type ChartBox } from './chart.ts';
import { labelLook } from './style.ts';
import { Tag } from './Tag.tsx';
import { PANEL } from './world.ts';

/** The rails, the dot, the terminus bar and the token bars, world units (they zoom with the panel). */
export const CHART_MARKS = { dot: 12, bar: 44, token: 18 } as const;

/**
 * The panel in the world. `ghost`: its rules and marks as a 12% ghost on the panel tone (the
 * summary map, after the chart has been read and its caveat tag has gone: never bare bars).
 */
export function TimetablePanel({ box = PANEL, ghost = false }: { box?: ChartBox & { r?: number }; ghost?: boolean }) {
  const t = useMemo(() => timetable(box), [box]);
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.r ?? 24} fill={C.panel} />
      <g opacity={ghost ? GHOST_OPACITY : undefined}>
        {/* ink rules: under the header, the start line, the column divider */}
        <g stroke={C.ink} strokeLinecap="butt" {...NON_SCALING}>
          <line x1={t.header.x} y1={t.header.ruleY} x2={t.header.ruleX1} y2={t.header.ruleY} strokeWidth={STROKE.min} {...NON_SCALING} />
          <line x1={t.start.x} y1={t.start.y0} x2={t.start.x} y2={t.start.y1} strokeWidth={STROKE.proposed} {...NON_SCALING} />
          <line x1={t.tokens.divider} y1={t.start.y0} x2={t.tokens.divider} y2={t.start.y1} strokeWidth={STROKE.min} {...NON_SCALING} />
        </g>
        {t.lanes.map((l) => {
          const tone = l.run.built ? C.ink : C.sketch;
          return (
            <g key={l.run.id}>
              <line x1={l.x0} y1={l.y} x2={l.endX} y2={l.y} stroke={tone} strokeWidth={STROKE.branch} strokeLinecap="butt" {...NON_SCALING} />
              <line x1={l.endX} y1={l.y - CHART_MARKS.bar / 2} x2={l.endX} y2={l.y + CHART_MARKS.bar / 2} stroke={tone} strokeWidth={STROKE.trunk} strokeLinecap="butt" {...NON_SCALING} />
              <circle cx={l.dotX} cy={l.y} r={CHART_MARKS.dot} fill={tone} />
              <rect x={t.tokens.x0} y={l.y - CHART_MARKS.token / 2} width={l.tokenX1 - t.tokens.x0} height={CHART_MARKS.token} fill={C.sketch} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

/** Which of the panel's words are on screen (their cues: tag-chart, chart-lanes, chart-tokens). */
export interface TimetableWords {
  header?: boolean;
  lanes?: boolean;
  tokens?: boolean;
}

/** Screen px: a lane's name sits this far above its rail. */
const LANE_NAME = -16;
/** Screen px: the legend's marks. */
const KEY = { dot: 8, bar: { w: 6, h: 30 }, gap: 14, between: 44 } as const;

type Bilingual = { en: string; 'zh-Hans': string };
const both = (w: Bilingual) => `${w.en} · ${w['zh-Hans']}`;

/**
 * The panel's words, in screen space at world anchors, each 40 px (its marks in screen px too, so
 * the key reads the same at any zoom): the header tag and the token header as two-line tags above
 * the panel's top edge (beside what they qualify), the legend in the panel's header band, and each
 * lane's name over the start of its rail ("two levels" in ink, the baselines in the sketch tone).
 * It measures the legend (lineWidth): render it only once the fonts are ready, as a measure taken
 * before is cached for the page and would shift the legend on every later frame.
 */
export function TimetableLabels({ fonts, show, box = PANEL }: { fonts: FilmFonts; show: TimetableWords; box?: ChartBox }) {
  const { cam, view } = useCamera();
  const t = useMemo(() => timetable(box), [box]);
  const onPanel = labelLook(fonts, C.panel);
  // the legend: a dot and its word, then a terminus bar and its word, on the header band's baseline
  const [lx, ly] = worldToScreen(cam, [t.header.x, t.header.baseline], view);
  const word1 = both(WORDS.legendTypical);
  const w1 = lineWidth(word1, { family: fonts.sans, weight: TYPE.label.weight, size: TYPE.label.size });
  const dotX = lx + KEY.dot;
  const text1X = dotX + KEY.dot + KEY.gap;
  const barX = text1X + w1 + KEY.between;
  const text2X = barX + KEY.bar.w / 2 + KEY.gap;
  const midY = ly - TYPE.label.size * 0.34;
  return (
    <>
      {show.header && <Tag fonts={fonts} at={[box.x, box.y]} words={WORDS.tagChart} />}
      {show.tokens && <Tag fonts={fonts} at={[t.tokens.x0, box.y]} words={WORDS.tokenHead} />}
      {show.lanes && (
        <>
          {t.lanes.map((l) => (
            <AnchoredLabel key={l.run.id} at={[l.x0, l.y]} dx={14} dy={LANE_NAME} text={both(WORDS[l.run.lane] as Bilingual)} {...onPanel} color={l.run.built ? C.ink : C.sketch} />
          ))}
          <circle cx={dotX} cy={midY} r={KEY.dot} fill={C.ink} />
          <Label x={text1X} y={ly} text={word1} {...onPanel} />
          <rect x={barX - KEY.bar.w / 2} y={midY - KEY.bar.h / 2} width={KEY.bar.w} height={KEY.bar.h} fill={C.ink} />
          <Label x={text2X} y={ly} text={both(WORDS.legendSlowest)} {...onPanel} />
        </>
      )}
    </>
  );
}
