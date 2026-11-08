/**
 * The lookdev stills for the user's sign-off (TREATMENT.md, Lookdev stills), at the film's exact
 * format, one frame each: the film's world at film frames 750, 1880 and 4130, and checks of C27's
 * step-down at f4400, of the timetable panel's words at f3500 and of the built tag at f1750
 * (lookdev/StillScenes.tsx).
 *   pnpm aiv still super-agent --entry src/lookdev/stills.tsx --composition Still1 --frames 0 --profile review --label lookdev-1
 * (Still2 -> lookdev-2, Still3 -> lookdev-3, StepDown -> lookdev-c27, Chart -> lookdev-chart,
 * Tag -> lookdev-tag; --profile draft checks the half size.)
 */
import { Composition, registerRoot } from 'remotion';
import { FPS } from '../cues.ts';
import { ChartCheck, StepDownCheck, Still1, Still2, Still3, TagCheck } from './StillScenes.tsx';

export function StillsRoot() {
  return (
    <>
      <Composition id="Still1" component={Still1} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="Still2" component={Still2} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="Still3" component={Still3} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="StepDown" component={StepDownCheck} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="Chart" component={ChartCheck} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="Tag" component={TagCheck} width={1920} height={1080} fps={FPS} durationInFrames={1} />
    </>
  );
}

registerRoot(StillsRoot);
