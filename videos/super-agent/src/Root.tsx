/**
 * The compositions of this video. 'Main' must match video.json `format` exactly (the engine
 * refuses otherwise): 1920x1080 at 30 fps, the test-card leader then the film (6720 frames, 84 bars
 * at 90 bpm: src/cues.ts). `swatchFrames` declares the frames the test card shows the swatch strip
 * on; it must equal video.json qa.swatchFrames. The final has no leader (LEADER_FRAMES 0; the
 * approved review cut had 15, with qa.swatchFrames [0, 15]), so it declares none.
 */
import { Composition } from 'remotion';
import { FILM_FRAMES, FPS, LEADER_FRAMES } from './cues.ts';
import { Main, type MainProps } from './Main.tsx';

// (no leader in the final, decision 24: then no swatch strip is declared, and video.json has no qa.swatchFrames)
const props: MainProps = LEADER_FRAMES > 0 ? { swatchFrames: [0, LEADER_FRAMES] } : {};

export function Root() {
  return <Composition id="Main" component={Main} width={1920} height={1080} fps={FPS} durationInFrames={LEADER_FRAMES + FILM_FRAMES} defaultProps={props} />;
}
