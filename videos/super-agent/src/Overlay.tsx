/**
 * The DOM layer over the 3D frames: the title in Inter (the kit holds each frame until the font
 * is loaded), a hairline progress bar and the frame counter. Sizes are fractions of the
 * composition height; opacity and offsets are functions of the frame.
 */
import { progress } from '@aiv/core';
import { Title, useInter } from '@aiv/remotion-kit';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export function Overlay({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig();
  // the counter holds its own frame until Inter is loaded (not only through a sibling <Title>)
  const font = useInter();
  const u = h / 1080;
  const t = progress(frame, start + 6, start + 30, 'outCubic');
  const sub = progress(frame, start + 18, start + 42, 'outCubic');
  return (
    <AbsoluteFill>
      {/* a soft shade under the title keeps it legible over bright shapes */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h * 0.42, background: `linear-gradient(rgba(5, 8, 18, ${(0.6 * t).toFixed(3)}), rgba(5, 8, 18, 0))` }} />
      <div style={{ position: 'absolute', left: w * 0.0625, top: h * 0.2 - 96 * u + (1 - t) * 24 * u, opacity: t, textShadow: `0 ${4 * u}px ${18 * u}px rgba(0, 0, 0, 0.5)` }}>
        <Title size={96}>Made with code</Title>
      </div>
      <div style={{ position: 'absolute', left: w * 0.0625, top: h * 0.27 - 38 * u, opacity: sub }}>
        <Title size={38} weight={400} color="#c9d3e6" tracking={0}>
          Remotion · React Three Fiber · one frame = one index
        </Title>
      </div>
      {/* time: a hairline progress bar and the frame number (both a pure function of the frame) */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: w, height: 6 * u, background: 'rgba(255, 255, 255, 0.18)' }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: (w * (frame + 1)) / durationInFrames, height: 6 * u, background: '#5ee7ff' }} />
      <div
        style={{
          position: 'absolute',
          right: w * 0.0625,
          bottom: 30 * u,
          padding: `${6 * u}px ${12 * u}px`,
          borderRadius: 19 * u,
          background: 'rgba(5, 8, 18, 0.55)',
          fontFamily: font,
          fontSize: 26 * u,
          fontWeight: 500,
          color: '#c9d3e6',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        frame {String(frame).padStart(3, '0')} · {(frame / fps).toFixed(2)} s
      </div>
    </AbsoluteFill>
  );
}
