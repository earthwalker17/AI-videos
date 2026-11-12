/**
 * Text that reveals by the motion grammar (TREATMENT.md): a short left-to-right wipe, a per-frame
 * clip-path inset, then the line holds, then a short fade. Never a typewriter reveal. EN and zh
 * reveal together, as one block.
 *
 * - `revealState` is the pure timing: a span's line is fully visible from `frame` to `end`, wipes in
 *   over the `inFrames` before it and fades over the `outFrames` after it (the cue sheet's `text`
 *   span convention).
 * - `TextReveal` wraps any DOM content in that wipe and fade.
 * - `NotesBlock` is the lower-left notes block: one EN line over one zh line, set in SVG so each
 *   baseline lands exactly where the layout puts it, behind an ink station tick. It measures the
 *   lines once the fonts are ready (@remotion/layout-utils) and fails the render when a line is
 *   wider than the layout allows.
 * - `Label` is a line of SVG text with a knockout stroke under it, its Latin and Han runs in their
 *   own weights.
 *
 * zh phrase breaks are explicit: a zh line is written with a space at each pause (or given as its
 * phrases), and wrapping zh DOM text uses `ZH_BREAKS` so it breaks only at those spaces. Intl word
 * segmentation is never used (it splits 路由器 into single characters).
 *
 * The kit imports nothing from a film: fonts, sizes, colours and the layout are props.
 */
import { progress, type Easing, type EasingName } from '@aiv/core';
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, ReactNode } from 'react';

/** A text span on the timeline: fully visible from `frame` to `end` (the cue sheet's CueEvent fits). */
export interface RevealSpan {
  frame: number;
  end?: number;
}

export interface RevealState {
  /** whether anything of the text is on screen this frame */
  visible: boolean;
  /** how much of the text's width is revealed, 0..1 */
  wipe: number;
  opacity: number;
}

/**
 * The reveal at frame `f`: the wipe runs over [frame - inFrames, frame], the fade over
 * [end, end + outFrames], so the text is on screen on [frame - inFrames, end + outFrames) and
 * fully visible on [frame, end].
 */
export function revealState(f: number, span: RevealSpan, inFrames = 6, outFrames = 6, ease: Easing | EasingName = 'outQuad'): RevealState {
  const end = span.end ?? span.frame;
  if (f < span.frame - inFrames || f >= end + outFrames) return { visible: false, wipe: 0, opacity: 0 };
  const wipe = inFrames > 0 ? progress(f, span.frame - inFrames, span.frame, ease) : 1;
  const opacity = outFrames > 0 ? 1 - progress(f, end, end + outFrames) : 1;
  return { visible: wipe > 0 && opacity > 0, wipe, opacity };
}

/** One run of text in one script: Han (and CJK punctuation, kana, full-width forms) or not. */
export interface ScriptRun {
  text: string;
  cjk: boolean;
}

const CJK = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3100-\u312F\u3190-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/u;

/** Split text into runs of CJK and other characters (a space belongs to the run it follows). */
export function scriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  for (const ch of text) {
    const last = runs[runs.length - 1];
    const cjk = /\s/u.test(ch) && last ? last.cjk : CJK.test(ch);
    if (last && last.cjk === cjk) last.text += ch;
    else runs.push({ text: ch, cjk });
  }
  return runs;
}

/**
 * Style for wrapping zh DOM text: it breaks only at the typed spaces (the explicit phrase breaks),
 * never between two Han characters, and Chrome adds no Han-Latin spacing of its own (the copy types
 * its spaces; Chrome 140+ would otherwise insert a gap at every script change).
 */
export const ZH_BREAKS: CSSProperties = { wordBreak: 'keep-all', lineBreak: 'strict', textAutospace: 'no-autospace' };

/**
 * Text in its own composited layer, over a transparent background, so the browser antialiases it in
 * grey. On the opaque frame the render shell drew the probe's 40-48 px notes and labels with LCD
 * subpixel antialiasing: red and blue fringes up to 162 code values apart, which 4:2:0 chroma would
 * smear in every delivery; in a layer they stayed within 9 (Chrome Headless Shell 157, 2026-11-08).
 * A layer hint, not a filter: nothing is resampled.
 */
export const GREY_TEXT: CSSProperties = { willChange: 'transform' };

/** SVG and measured text keep their spaces as typed, with no automatic Han-Latin spacing. */
export const AS_TYPED: CSSProperties = { whiteSpace: 'pre', textAutospace: 'no-autospace' };
type MeasureStyles = Parameters<typeof measureText>[0]['additionalStyles'];
/**
 * measureText's styles. The numeric variant goes in here, not in its own option: measureText
 * caches by a key that holds `additionalStyles` but not `fontVariantNumeric` (@remotion/layout-utils
 * 4.0.539), so a line measured with and without tabular figures would get one width.
 */
const measureStyles = (numeric?: string): MeasureStyles => ({ textAutospace: 'no-autospace', ...(numeric ? { fontVariantNumeric: numeric } : {}) }) as unknown as MeasureStyles;

export interface TextRevealProps {
  f: number;
  span: RevealSpan;
  inFrames?: number;
  outFrames?: number;
  ease?: Easing | EasingName;
  /** room round the box the clip leaves open (glyph overhang, accents, descenders), px */
  pad?: number;
  style?: CSSProperties;
  children: ReactNode;
}

/** DOM content revealed by the wipe (a clip-path inset, in % of its own box) and faded out. */
export function TextReveal({ f, span, inFrames = 6, outFrames = 6, ease, pad = 32, style, children }: TextRevealProps) {
  const s = revealState(f, span, inFrames, outFrames, ease);
  if (!s.visible) return null;
  const clipPath = s.wipe >= 1 ? undefined : `inset(${-pad}px ${(100 * (1 - s.wipe)).toFixed(3)}% ${-pad}px ${-pad}px)`;
  return <div style={{ ...GREY_TEXT, ...style, clipPath, opacity: s.opacity }}>{children}</div>;
}

/** One text style for SVG text: a CSS font-family value, weight, size (px), colour. */
export interface TextLook {
  family: string;
  weight: number;
  size: number;
  color: string;
  /** e.g. 'tabular-nums' */
  numeric?: string;
}

/** The width of one line of text in px, as typed. Call only once the fonts are ready (measureText caches). */
export function lineWidth(text: string, look: Pick<TextLook, 'family' | 'weight' | 'size' | 'numeric'>): number {
  return measureText({ text, fontFamily: look.family, fontSize: look.size, fontWeight: look.weight, additionalStyles: measureStyles(look.numeric) }).width;
}

export interface NotesLayout {
  /** where both lines start, px */
  x: number;
  enBaseline: number;
  zhBaseline: number;
  /** a wider line fails the render */
  maxWidth: number;
  tick: { x: number; width: number; top: number; height: number };
}

export interface NotesBlockProps {
  f: number;
  span: RevealSpan;
  en: string;
  /** the zh line, with a space at each pause, or its phrases (joined by one space) */
  zh: string | readonly string[];
  layout: NotesLayout;
  look: { en: TextLook; zh: TextLook; tick: string };
  /** the fonts are loaded (useFont's `ready`): nothing is drawn or measured before */
  ready: boolean;
  inFrames?: number;
  outFrames?: number;
}

/** room the clip leaves round the lines, px */
const NOTES_PAD = 32;

/**
 * The notes block: the EN line over the zh line, each on its exact baseline, revealed together by
 * one wipe edge that crosses the wider line, the tick showing from the first frame of the wipe.
 */
export function NotesBlock({ f, span, en, zh, layout, look, ready, inFrames = 6, outFrames = 6 }: NotesBlockProps) {
  const s = revealState(f, span, inFrames, outFrames);
  if (!s.visible || !ready) return null;
  const zhText = typeof zh === 'string' ? zh : zh.join(' ');
  const w = Math.max(lineWidth(en, look.en), lineWidth(zhText, look.zh));
  if (w > layout.maxWidth) throw new Error(`notes block: a line is ${Math.ceil(w)} px wide, over the ${layout.maxWidth} px the layout allows: "${en}" / "${zhText}"`);
  // whole pixels: the block is its own composited layer, never resampled
  const left = Math.floor(Math.min(layout.tick.x, layout.x) - NOTES_PAD);
  const top = Math.floor(Math.min(layout.tick.top, layout.enBaseline - look.en.size * 1.2) - NOTES_PAD);
  const bottom = Math.ceil(Math.max(layout.tick.top + layout.tick.height, layout.zhBaseline + look.zh.size * 0.4) + NOTES_PAD);
  const textX = layout.x - left;
  const width = Math.ceil(textX + w + NOTES_PAD);
  const height = bottom - top;
  const revealed = textX + w * s.wipe;
  const clipPath = s.wipe >= 1 ? undefined : `inset(0px ${(width - revealed).toFixed(2)}px 0px 0px)`;
  const line = (text: string, baseline: number, l: TextLook) => (
    <text x={textX} y={baseline - top} fontFamily={l.family} fontWeight={l.weight} fontSize={l.size} fill={l.color} style={{ ...AS_TYPED, fontVariantNumeric: l.numeric }}>
      {text}
    </text>
  );
  return (
    <div style={{ ...GREY_TEXT, position: 'absolute', left, top, width, height, clipPath, opacity: s.opacity }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <rect x={layout.tick.x - left} y={layout.tick.top - top} width={layout.tick.width} height={layout.tick.height} fill={look.tick} />
        {line(en, layout.enBaseline, look.en)}
        {line(zhText, layout.zhBaseline, look.zh)}
      </svg>
    </div>
  );
}

export interface LabelProps {
  x: number;
  /** the baseline */
  y: number;
  text: string;
  family: string;
  size: number;
  /** weight of the Latin runs */
  weight: number;
  /** weight of the Han runs (default: `weight`) */
  cjkWeight?: number;
  color: string;
  anchor?: 'start' | 'middle' | 'end';
  /** a stroke in the ground colour under the text, `width` px on each side (no filter) */
  knockout?: { color: string; width: number };
  opacity?: number;
}

/** One line of SVG text (place it in an <svg>), its Latin and Han runs each in their own weight. */
export function Label({ x, y, text, family, size, weight, cjkWeight, color, anchor = 'start', knockout, opacity }: LabelProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={family}
      fontSize={size}
      fill={color}
      opacity={opacity}
      stroke={knockout?.color}
      strokeWidth={knockout ? 2 * knockout.width : undefined}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={AS_TYPED}
    >
      {scriptRuns(text).map((r, i) => (
        <tspan key={i} fontWeight={r.cjk ? (cjkWeight ?? weight) : weight}>
          {r.text}
        </tspan>
      ))}
    </text>
  );
}
