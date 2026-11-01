/**
 * The test card (DOM/CSS): the @aiv/core swatch strip QA measures, a grey ramp, crop marks in
 * every corner and a circle that shows a wrong aspect ratio at a glance. Sizes are fractions of
 * the composition height, so every profile draws the same picture; the strip alone is laid out
 * at the render size (see swatches.ts).
 *
 * Declare the frames it is shown on as the composition's `swatchFrames` prop: the engine refuses
 * to render when they differ from video.json qa.swatchFrames (what QA measures).
 */
import { swatchCss } from '@aiv/core';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useInter } from './fonts.ts';
import { useRenderSize } from './scale.ts';
import { swatchRectsCss } from './swatches.ts';

/** The swatch strip alone, with its labels; place it on an opaque background. */
export function SwatchStrip({ labels = true }: { labels?: boolean }) {
  const font = useInter();
  const { height } = useVideoConfig();
  const r = useRenderSize();
  const u = height / 1080;
  return (
    <>
      {swatchRectsCss(r.width, r.height, r.scale).map((s) => (
        <div key={s.id}>
          {labels && <div style={{ position: 'absolute', left: s.left, top: s.top - 34 * u, fontFamily: font, fontWeight: 500, fontSize: 22 * u, color: '#d8dce4' }}>{s.id}</div>}
          <div style={{ position: 'absolute', left: s.left, top: s.top, width: s.width, height: s.height, background: swatchCss(s.rgb) }} />
        </div>
      ))}
    </>
  );
}

export interface TestCardProps {
  /** second line, after the size, rate and frame number */
  label?: ReactNode;
  background?: string;
}

export function TestCard({ label = 'AI-videos · remotion engine', background = '#23272f' }: TestCardProps) {
  const font = useInter();
  const frame = useCurrentFrame();
  const { width: w, height: h, fps } = useVideoConfig();
  const out = useRenderSize();
  const u = h / 1080;
  const line = Math.max(1, Math.round(3 * u));
  const m = 24 * u;
  const l = 64 * u;
  const mark = (pos: CSSProperties): CSSProperties => ({ position: 'absolute', width: l, height: l, borderColor: '#d8dce4', borderStyle: 'solid', borderWidth: 0, ...pos });
  return (
    <AbsoluteFill style={{ background, fontFamily: font }}>
      {/* crop marks: every corner must be visible in the delivered file */}
      <div style={mark({ left: m, top: m, borderLeftWidth: line, borderTopWidth: line })} />
      <div style={mark({ right: m, top: m, borderRightWidth: line, borderTopWidth: line })} />
      <div style={mark({ left: m, bottom: m, borderLeftWidth: line, borderBottomWidth: line })} />
      <div style={mark({ right: m, bottom: m, borderRightWidth: line, borderBottomWidth: line })} />
      {/* a circle shows a wrong aspect ratio at a glance */}
      <div style={{ position: 'absolute', left: w * 0.82 - h * 0.17, top: h * 0.3 - h * 0.17, width: h * 0.34, height: h * 0.34, borderRadius: '50%', border: `${line}px solid #d8dce4`, boxSizing: 'border-box' }} />
      <div style={{ position: 'absolute', left: w * 0.0625, top: h * 0.17 - 72 * u, fontSize: 72 * u, fontWeight: 650, color: '#f2f4f8', lineHeight: 1 }}>Test card</div>
      <div style={{ position: 'absolute', left: w * 0.0625, top: h * 0.235 - 34 * u, fontSize: 34 * u, fontWeight: 400, color: '#b9c0cc', lineHeight: 1 }}>
        {label} · {out.width}×{out.height} · {fps} fps · frame {frame}
      </div>
      {/* grey ramp, 0 to 255 in 17 steps: banding or clipped ends show up here */}
      <div style={{ position: 'absolute', left: w * 0.0625, top: h * 0.42, height: h * 0.16, display: 'flex' }}>
        {Array.from({ length: 17 }, (_, k) => {
          const v = Math.min(255, k * 16);
          return <div key={k} style={{ width: Math.floor((w * 0.6) / 17), height: '100%', background: `rgb(${v}, ${v}, ${v})` }} />;
        })}
      </div>
      <SwatchStrip />
    </AbsoluteFill>
  );
}
