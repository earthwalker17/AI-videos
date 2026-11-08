/**
 * The compositions of this video. 'Main' must match video.json `format` exactly (the engine
 * refuses otherwise): 1920x1080 at 30 fps; 150 frames = 5 s. `swatchFrames` declares the frames
 * the test card shows the swatch strip on; it must equal video.json qa.swatchFrames.
 */
import { Composition } from 'remotion';
import { Main, type MainProps } from './Main.tsx';

export const FPS = 30;
const props: MainProps = { swatchFrames: [0, Math.round(0.5 * FPS)] };

export function Root() {
  return <Composition id="Main" component={Main} width={1920} height={1080} fps={FPS} durationInFrames={5 * FPS} defaultProps={props} />;
}
