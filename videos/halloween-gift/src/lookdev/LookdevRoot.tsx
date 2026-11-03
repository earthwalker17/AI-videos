/**
 * Lookdev compositions, at the film's exact format (1920x1080, 24 fps) so the engine accepts
 * them: the de-risk probe, then one per asset family as the world is built.
 */
import { Composition } from 'remotion';
import { FPS } from '../cues.ts';
import { Probe, PROBE_FRAMES } from './Probe.tsx';

export function LookdevRoot() {
  return <Composition id="Probe" component={Probe} width={1920} height={1080} fps={FPS} durationInFrames={PROBE_FRAMES} />;
}
