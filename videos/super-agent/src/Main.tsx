/**
 * Who Routes the Agents?: frames [0, LEADER_FRAMES) are the kit's test card with the colour swatch
 * strip QA measures; the film follows in a Sequence, so inside it useCurrentFrame() is the film frame
 * the cue sheet counts in (src/cues.ts). The film is one continuous Register Desk world (desk/FilmFrame.tsx,
 * the segments in desk/film.ts). Every frame is a pure function of useCurrentFrame().
 */
import { TestCard } from '@aiv/remotion-kit';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { FILM_FRAMES, LEADER_FRAMES } from './cues.ts';
import { FilmFrame } from './desk/FilmFrame.tsx';
import { DESK_HEX } from './desk/gl/desk.ts';

export type MainProps = {
  /** frames [start, end) that show the test card (absent without a leader); the engine checks them against video.json qa.swatchFrames */
  swatchFrames?: [number, number];
};

function Film() {
  return <FilmFrame f={useCurrentFrame()} />;
}

export function Main({ swatchFrames }: MainProps) {
  const frame = useCurrentFrame();
  if (swatchFrames && frame < swatchFrames[1]) return <TestCard label="AI-videos · Who Routes the Agents?" />;
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      <Sequence from={LEADER_FRAMES} durationInFrames={FILM_FRAMES}>
        <Film />
      </Sequence>
    </AbsoluteFill>
  );
}
