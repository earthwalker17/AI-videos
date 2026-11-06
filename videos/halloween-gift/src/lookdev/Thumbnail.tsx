/**
 * The YouTube thumbnail: one frame of the film's picture (FilmV2 at film frame `at`, without the
 * film's own words) under the title in the film's type: IM Fell English over Noto Serif SC, the
 * captions' cream on a soft dusk shadow. Rendered as a still (`aiv still --entry
 * src/lookdev/index.ts --composition Thumbnail`), then saved to publish/ as a JPEG.
 */
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { FilmV2 } from '../film/FilmV2.tsx';
import { useFilmFonts } from '../look/fonts.ts';

export interface ThumbnailProps {
  /** the film frame shown */
  at: number;
  /** where the title block sits: its left edge and top, as fractions of the frame */
  x?: number;
  y?: number;
  /** the title's alignment within its block */
  align?: 'left' | 'center' | 'right';
}

export function Thumbnail({ at, x = 0.05, y = 0.06, align = 'left' }: ThumbnailProps) {
  const { height: h, width: w } = useVideoConfig();
  const { fonts, ready } = useFilmFonts();
  return (
    <AbsoluteFill>
      <Sequence from={-at} layout="none">
        <FilmV2 overlay={false} />
      </Sequence>
      {ready && (
        <div
          style={{
            position: 'absolute',
            left: x * w,
            top: y * h,
            textAlign: align,
            color: '#E8EEC4',
            textShadow: `0 0 ${h * 0.02}px rgba(16, 8, 22, 0.95), 0 ${h * 0.004}px ${h * 0.008}px rgba(16, 8, 22, 0.9)`,
          }}
        >
          <div style={{ fontFamily: fonts.serif, fontSize: h * 0.13, lineHeight: 1.0, letterSpacing: '0.01em' }}>A Halloween Gift</div>
          <div style={{ fontFamily: fonts.cjk, fontSize: h * 0.085, lineHeight: 1.3, fontWeight: 600, marginTop: h * 0.01 }}>万圣节礼物</div>
        </div>
      )}
    </AbsoluteFill>
  );
}
