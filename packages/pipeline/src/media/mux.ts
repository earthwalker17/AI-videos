// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/ffmpeg.ts
// (the delivery mux: mapped streams, exact -t length, faststart)
/**
 * The deliverable: the mezzanine's video converted once to BT.709 limited YUV and encoded with
 * a preset, plus the mastered audio, cut to exactly the picture's length. Written to a .part
 * file and moved into place only once its frame count is right.
 */
import { rmSync, statSync } from 'node:fs';
import type { ColorInfo } from '@aiv/core';
import type { Log } from '../util/log.ts';
import { partPath } from '../util/paths.ts';
import { ffmpeg } from './bin.ts';
import { commitPart } from './encoder.ts';
import { audioCodecArgs, containerArgs, encoderPixFmt, getPreset, resolveEncoder, toBt709Filter, videoCodecArgs, type PresetName } from './presets.ts';

export interface EncodeDeliveryOptions {
  /** the mezzanine (or any video file whose first video stream is the picture) */
  video: string;
  /** mastered audio (WAV) or null for a video-only file */
  audio: string | null;
  out: string;
  preset: Exclude<PresetName, 'mezzanine-ffv1'>;
  fps: number;
  /** exact number of frames the output must hold */
  frames: number;
  /** the colour of `video` (render.json color) */
  source: ColorInfo;
  log?: Log;
}

export interface EncodeDeliveryResult {
  file: string;
  encoder: string;
  frames: number;
  bytes: number;
}

/** ffmpeg arguments for a delivery encode (exported for tests and dry runs). */
export function deliveryArgs(o: EncodeDeliveryOptions, encoder: string, out: string): string[] {
  const p = getPreset(o.preset);
  const durationS = o.frames / o.fps;
  return [
    '-loglevel',
    'error',
    '-i',
    o.video,
    ...(o.audio ? ['-i', o.audio] : []),
    '-map',
    '0:v:0',
    ...(o.audio ? ['-map', '1:a:0'] : []),
    '-vf',
    toBt709Filter(o.source, encoderPixFmt(encoder, p)),
    ...videoCodecArgs(p, o.fps, encoder),
    ...(o.audio ? audioCodecArgs(p) : ['-an']),
    '-frames:v',
    String(o.frames),
    '-t',
    durationS.toFixed(6),
    ...containerArgs(p),
    out,
  ];
}

export async function encodeDelivery(o: EncodeDeliveryOptions): Promise<EncodeDeliveryResult> {
  const encoder = await resolveEncoder(getPreset(o.preset));
  const part = partPath(o.out);
  rmSync(part, { force: true });
  o.log?.info(`encoding ${o.preset} (${encoder}) → ${o.out.split(/[\\/]/).pop()}`);
  await ffmpeg(deliveryArgs(o, encoder, part), `${o.preset} encode`, { timeoutMs: 9 * 60 * 60_000 });
  await commitPart(part, o.out, o.frames);
  return { file: o.out, encoder, frames: o.frames, bytes: statSync(o.out).size };
}
