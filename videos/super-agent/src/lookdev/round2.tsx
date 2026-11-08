/**
 * Lookdev round 2, "The Register Desk" (session 3; TREATMENT.md, Art direction v2): style frame (b),
 * "Workers report up. Only the Router talks to you." (film f2200), in the lit WebGL world under DOM
 * text (docs/ARCHITECTURE.md decision 30), at the two pitches the user chooses between, with and
 * without bloom.
 *
 * Each composition spans the whole film timeline (the test-card leader included, so composition
 * frame 2215 is film frame 2200) at the video's exact format, and renders the desk world only:
 *   pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StyleB15 --frames 2215 --label r2-b15
 *   (StyleB15NoBloom, StyleB0, StyleB0NoBloom; a cost span: --frames 2200-2229 --span)
 * DeskGround15 and DeskGround0 draw the same frame without its objects (the desk, its shadows, pools and
 * the text): the difference from StyleB15 / StyleB0 is the objects' silhouettes (the 25% silhouette sheet).
 */
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { FILM_FRAMES, FPS, LEADER_FRAMES } from '../cues.ts';
import type { Angle } from '../desk/camera.ts';
import { DeskFrame } from '../desk/DeskFrame.tsx';
import { World } from '../desk/objects/World.tsx';

function StyleB({ angle, bloom }: { angle: Angle; bloom: boolean }) {
  const f = useCurrentFrame() - LEADER_FRAMES;
  return <DeskFrame f={f} angle={angle} bloom={bloom} objects={(s) => <World s={s} />} />;
}

export const StyleB15 = () => <StyleB angle={15} bloom />;
export const StyleB15NoBloom = () => <StyleB angle={15} bloom={false} />;
export const StyleB0 = () => <StyleB angle={0} bloom />;
export const StyleB0NoBloom = () => <StyleB angle={0} bloom={false} />;

function Ground({ angle }: { angle: Angle }) {
  const f = useCurrentFrame() - LEADER_FRAMES;
  return <DeskFrame f={f} angle={angle} bloom objects={() => null} />;
}
export const DeskGround15 = () => <Ground angle={15} />;
export const DeskGround0 = () => <Ground angle={0} />;

const LENGTH = LEADER_FRAMES + FILM_FRAMES;

export function Round2Root() {
  return (
    <>
      <Composition id="StyleB15" component={StyleB15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StyleB15NoBloom" component={StyleB15NoBloom} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StyleB0" component={StyleB0} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StyleB0NoBloom" component={StyleB0NoBloom} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="DeskGround15" component={DeskGround15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="DeskGround0" component={DeskGround0} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
    </>
  );
}

registerRoot(Round2Root);
