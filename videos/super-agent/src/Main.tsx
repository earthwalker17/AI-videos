/**
 * Who Routes the Agents?: frames [0, LEADER_FRAMES) are the kit's test card with the colour
 * swatch strip QA measures; the film follows in a Sequence, so inside it useCurrentFrame() is the
 * film frame the cue sheet counts in (src/cues.ts). Until the film is built (session 3), its first
 * 300 frames are the 2D determinism probe (lookdev/ProbeScene.tsx) and the rest is the bare ground.
 * Every frame is a pure function of useCurrentFrame().
 */
import { TestCard } from '@aiv/remotion-kit';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { LEADER_FRAMES } from './cues.ts';
import { PROBE_FRAMES, ProbeScene } from './lookdev/ProbeScene.tsx';
import { C } from './look/tokens.ts';

export type MainProps = {
  /** frames [start, end) that show the test card (absent without a leader); the engine checks them against video.json qa.swatchFrames */
  swatchFrames?: [number, number];
};

export function Main({ swatchFrames }: MainProps) {
  const frame = useCurrentFrame();
  if (swatchFrames && frame < swatchFrames[1]) return <TestCard label="AI-videos · Who Routes the Agents?" />;
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Sequence from={LEADER_FRAMES} durationInFrames={PROBE_FRAMES}>
        <ProbeScene />
      </Sequence>
    </AbsoluteFill>
  );
}
