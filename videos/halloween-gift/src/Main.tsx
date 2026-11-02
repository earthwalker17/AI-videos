/**
 * The Remotion template: frames [0, swatchFrames[1]) are the kit's test card with the colour
 * swatch strip QA measures; the rest is an R3F scene with a title overlay. Every frame is a
 * pure function of useCurrentFrame().
 */
import { TestCard } from '@aiv/remotion-kit';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Overlay } from './Overlay.tsx';
import { BACKGROUND, Scene } from './Scene.tsx';

export type MainProps = {
  /** frames [start, end) that show the test card; the engine checks them against video.json qa.swatchFrames */
  swatchFrames: [number, number];
};

export function Main({ swatchFrames }: MainProps) {
  const frame = useCurrentFrame();
  if (frame < swatchFrames[1]) return <TestCard label="AI-videos · remotion engine template" />;
  return (
    <AbsoluteFill style={{ background: BACKGROUND }}>
      <Scene start={swatchFrames[1]} />
      <Overlay start={swatchFrames[1]} />
    </AbsoluteFill>
  );
}
