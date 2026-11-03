/**
 * Lookdev compositions, at the film's exact format (1920x1080, 24 fps) so the engine accepts
 * them: the de-risk probe, then one per asset family as the world is built.
 */
import { Composition } from 'remotion';
import { FPS } from '../cues.ts';
import { FILM_FRAMES } from '../cues.ts';
import { Journey } from './Journey.tsx';
import { Probe, PROBE_FRAMES } from './Probe.tsx';

const probe = { component: Probe, width: 1920, height: 1080, fps: FPS, durationInFrames: PROBE_FRAMES } as const;

export function LookdevRoot() {
  return (
    <>
      <Composition id="Probe" {...probe} />
      {/* the V2 post chain: god rays only, then with the painterly filter */}
      <Composition id="ProbeRays" {...probe} defaultProps={{ post: { paint: 0, rays: true } }} />
      <Composition id="ProbePaint" {...probe} defaultProps={{ post: { paint: 3, rays: true } }} />
      {/* without grain: what is left on a static span is boil and shimmer */}
      <Composition id="ProbeRaysClean" {...probe} defaultProps={{ post: { paint: 0, rays: true, grain: 0 } }} />
      <Composition id="ProbePaintClean" {...probe} defaultProps={{ post: { paint: 3, rays: true, grain: 0 } }} />
      {/* the film's camera journey over the world as built so far */}
      <Composition id="Journey" component={Journey} width={1920} height={1080} fps={FPS} durationInFrames={FILM_FRAMES} />
    </>
  );
}
