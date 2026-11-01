/**
 * The composition contract between a Remotion entry and video.json: the composition must have
 * exactly the format video.json declares (post, QA and the audio bed follow video.json), the
 * render size must be a uniform scale of it (the draft profile is half size), and a declared
 * swatch strip must sit on the frames QA measures.
 */
import { EXIT, ExitError, type VideoConfig } from '@aiv/core';
import type { FrameSpan, Log } from '@aiv/pipeline';

/** The composition video.json names when it names none. */
export const DEFAULT_COMPOSITION = 'Main';

export interface CompositionInfo {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** the composition's resolved props (a declared swatchFrames lives here) */
  props?: Record<string, unknown>;
}

/**
 * Refuse (exit 2) a composition whose format differs from video.json; return the Remotion
 * `scale` that renders it at the run's size.
 */
export function checkComposition(comp: CompositionInfo, format: VideoConfig['format'], render: { width: number; height: number }): { scale: number } {
  if (comp.width !== format.width || comp.height !== format.height || comp.fps !== format.fps)
    throw new ExitError(
      EXIT.REFUSED,
      `composition '${comp.id}' is ${comp.width}x${comp.height} at ${comp.fps} fps, video.json format says ${format.width}x${format.height} at ${format.fps} fps: make them agree (post, QA and the audio bed follow video.json)`,
    );
  if (!Number.isInteger(comp.durationInFrames) || comp.durationInFrames < 1) throw new Error(`composition '${comp.id}' has durationInFrames ${comp.durationInFrames}`);
  const scale = render.width / comp.width;
  // Remotion scales both axes by one factor: the profile's even rounding must not distort it
  if (!(scale > 0) || comp.width * scale !== render.width || comp.height * scale !== render.height)
    throw new Error(`render size ${render.width}x${render.height} is not a uniform scale of the composition's ${comp.width}x${comp.height}`);
  return { scale };
}

const isSpan = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0) && v[1] > v[0];

/**
 * A composition may declare the frames that show the swatch strip as a `swatchFrames: [a, b)`
 * prop (the kit's TestCard draws it). It must equal video.json qa.swatchFrames, or QA would
 * measure other content; either side alone is only warned about, like the web engine does.
 */
export function checkSwatchFrames(comp: CompositionInfo, qa: FrameSpan | undefined, log: Log): FrameSpan | null {
  const raw = comp.props?.swatchFrames;
  if (raw !== undefined && !isSpan(raw)) throw new Error(`composition '${comp.id}' prop swatchFrames must be [start, end) frames, got ${JSON.stringify(raw)}`);
  const declared = raw ?? null;
  if (declared && qa && (declared[0] !== qa[0] || declared[1] !== qa[1]))
    throw new Error(`composition '${comp.id}' draws the swatch strip on frames [${declared.join(', ')}), video.json qa.swatchFrames says [${qa.join(', ')}): QA would measure other content. Make them agree.`);
  if (qa && !declared) log.warn(`video.json sets qa.swatchFrames, but composition '${comp.id}' declares no swatchFrames prop: nothing checks that they agree`);
  if (declared && !qa) log.warn(`composition '${comp.id}' draws a swatch strip on frames [${declared.join(', ')}), but video.json has no qa.swatchFrames: QA will not verify colour`);
  return declared;
}
