/**
 * The compositions of this video. 'Main' must match video.json `format` exactly (the engine
 * refuses otherwise): 1920x1080 at 24 fps. Its length and the test-card leader come from the
 * cue sheet, the timeline the score shares (src/cues.ts); `swatchFrames` must equal
 * video.json qa.swatchFrames.
 */
import { Composition } from 'remotion';
import { FILM_FRAMES, FPS, LEADER_FRAMES } from './cues.ts';
import { Main, type MainProps } from './Main.tsx';

const props: MainProps = { swatchFrames: [0, LEADER_FRAMES] };

export function Root() {
  return <Composition id="Main" component={Main} width={1920} height={1080} fps={FPS} durationInFrames={LEADER_FRAMES + FILM_FRAMES} defaultProps={props} />;
}
