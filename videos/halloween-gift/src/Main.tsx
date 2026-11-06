/**
 * Frames [0, LEADER_FRAMES) are the kit's test card with the colour swatch strip QA measures
 * (the review cut's colour evidence); the film follows in a Sequence, so inside it
 * useCurrentFrame() is the film frame the cue sheet counts in.
 */
import { TestCard } from '@aiv/remotion-kit';
import { Sequence, useCurrentFrame } from 'remotion';
import { FILM_FRAMES, LEADER_FRAMES } from './cues.ts';
import { FilmV2 } from './film/FilmV2.tsx';

export type MainProps = {
  /** frames [start, end) that show the test card; the engine checks them against video.json qa.swatchFrames */
  swatchFrames: [number, number];
};

export function Main({ swatchFrames }: MainProps) {
  const frame = useCurrentFrame();
  if (frame < swatchFrames[1]) return <TestCard label="A Halloween Gift · test card" />;
  return (
    <Sequence from={LEADER_FRAMES} durationInFrames={FILM_FRAMES}>
      <FilmV2 />
    </Sequence>
  );
}
