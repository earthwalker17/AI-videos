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
 *
 * StillC15 is still (c), context as a cache (film f3150, composition frame 3165), at 15° with bloom,
 * through the film's camera (desk/camera.ts cameraAt: 2.0x on the reading window from bar 34), with
 * N5 and the cache tag; DeskGroundC15 is its objects-free twin:
 *   pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillC15 --frames 3165 --label r2-c15
 */
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { FILM_FRAMES, FPS, LEADER_FRAMES } from '../cues.ts';
import { cameraAt, type Angle } from '../desk/camera.ts';
import { ActOneFrame } from '../desk/ActOneFrame.tsx';
import { SPAN_D, poseD, summaryAt, summaryDeskState } from '../desk/summary.ts';
import { PRINT_FONT } from '../desk/gl/text.ts';
import { Proposed } from '../desk/objects/Proposed.tsx';
import { Trace } from '../desk/objects/Trace.tsx';
import { DeskFrame } from '../desk/DeskFrame.tsx';
import { World } from '../desk/objects/World.tsx';
import type { TagSpec } from '../desk/Overlay.tsx';
import { WORDS } from '../cues.ts';

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

/**
 * Still (a), act one at f915 (composition frame 930), 15°, bloom on:
 *   pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillA15 --frames 930 --label r2-a15
 * StillAGround15 is the same frame without its objects (for the 25% silhouette sheet).
 */
function StillA({ objects }: { objects: boolean }) {
  const f = useCurrentFrame() - LEADER_FRAMES;
  return <ActOneFrame f={f} angle={15} bloom objects={objects} />;
}
export const StillA15 = () => <StillA objects />;
export const StillAGround15 = () => <StillA objects={false} />;

/**
 * Still (d), the summary at the sign-off rest (film f5520, composition frame 5535), 15°, bloom on:
 *   pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillD15 --frames 5535 --label r2-d15
 * StillDGround15 is its objects-free twin (the silhouette sheet).
 */
/** The print face's CSS family (the kit's useFont registers it as `"AIV <family>"`). */
const PRINT_CSS = `"AIV ${PRINT_FONT.family}"`;

function StillD({ objects }: { objects: boolean }) {
  const f = useCurrentFrame() - LEADER_FRAMES;
  return (
    <DeskFrame
      f={f}
      angle={15}
      bloom
      poseAt={poseD}
      span={SPAN_D}
      stateAt={summaryDeskState}
      objects={(s) =>
        objects ? (
          <>
            <World s={s} />
            <Proposed printFamily={PRINT_CSS} />
            <Trace a={summaryAt(s.f)} printFamily={PRINT_CSS} />
          </>
        ) : null
      }
    />
  );
}
export const StillD15 = () => <StillD objects />;
export const StillDGround15 = () => <StillD objects={false} />;

/** Act two's frames this world is posed for (the turn to the close's ease-out). */
const SPAN_C: readonly [number, number] = [2100, 3440];
/** The cache tag (cues.ts tag-cache): under the window on the dark deck plate, its leader ending on the inline record it qualifies. */
const TAGS_C: readonly TagSpec[] = [{ cue: 'tag-cache', words: WORDS.tagCache, at: [772, 530], anchor: 'start', foot: [-112, 196, 123] }];

function StillC({ angle, bloom, objects = true }: { angle: Angle; bloom: boolean; objects?: boolean }) {
  const f = useCurrentFrame() - LEADER_FRAMES;
  return <DeskFrame f={f} angle={angle} bloom={bloom} poseAt={cameraAt} span={SPAN_C} labels={[]} tags={TAGS_C} objects={(s) => (objects ? <World s={s} /> : null)} />;
}
export const StillC15 = () => <StillC angle={15} bloom />;
export const DeskGroundC15 = () => <StillC angle={15} bloom objects={false} />;

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
      <Composition id="StillC15" component={StillC15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="DeskGroundC15" component={DeskGroundC15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StillA15" component={StillA15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StillAGround15" component={StillAGround15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StillD15" component={StillD15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
      <Composition id="StillDGround15" component={StillDGround15} width={1920} height={1080} fps={FPS} durationInFrames={LENGTH} />
    </>
  );
}

registerRoot(Round2Root);
