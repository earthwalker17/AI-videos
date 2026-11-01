// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/ffmpeg.ts
// (the RGB → BT.709 conversion filter, the BT.709 tags and the FFV1 mezzanine arguments)
/**
 * Named encode presets: data first, argument builders second. Callers pick a name; nobody
 * hand-writes encoder flags in a video folder.
 *
 * Colour policy (docs/ARCHITECTURE.md, decision 2): mezzanines stay RGB (sRGB-encoded, full
 * range); the delivery encode does the single RGB → YUV conversion with an explicit BT.709
 * matrix to limited range, tags the frames (setparams: the encoder writes the VUI from frame
 * properties) and the stream (-colorspace/-color_primaries/-color_trc/-color_range). Without
 * the explicit matrix older ffmpeg builds convert with BT.601 and colours shift on playback.
 */
import type { ColorInfo } from '@aiv/core';
import { ffmpegBin } from './bin.ts';
import { exec } from '../util/proc.ts';

export type PresetName = 'mezzanine-ffv1' | 'youtube' | 'archive' | 'preview-hw';

export interface VideoPreset {
  name: PresetName;
  description: string;
  container: 'mkv' | 'mp4';
  ext: '.mkv' | '.mp4';
  video: {
    encoder: string;
    pixFmt: string;
    crf?: number;
    speed?: string;
    /** keyframe interval in seconds (YouTube asks for a closed GOP of half the frame rate) */
    gopSeconds: number;
    bframes?: number;
  };
  audio: { codec: 'aac' | 'pcm_s24le'; bitrate?: string } | null;
}

export const PRESETS: Record<PresetName, VideoPreset> = {
  'mezzanine-ffv1': {
    name: 'mezzanine-ffv1',
    description: 'lossless RGB intermediate: raw RGBA on stdin → FFV1 level 3, bgr0, intra-only (concat-safe chunks)',
    container: 'mkv',
    ext: '.mkv',
    video: { encoder: 'ffv1', pixFmt: 'bgr0', gopSeconds: 0 },
    audio: null,
  },
  youtube: {
    name: 'youtube',
    description: 'delivery: H.264 High, CRF 17, preset slow, yuv420p BT.709 limited, closed GOP of fps/2, 2 B-frames, AAC-LC 320k 48 kHz stereo, faststart',
    container: 'mp4',
    ext: '.mp4',
    video: { encoder: 'libx264', pixFmt: 'yuv420p', crf: 17, speed: 'slow', gopSeconds: 0.5, bframes: 2 },
    audio: { codec: 'aac', bitrate: '320k' },
  },
  archive: {
    // ≤ 2 GiB master for GitHub Releases (T1). H.264 CRF 10 is visually lossless for rendered
    // content at a fraction of ProRes size. Audio stays PCM: the master's audio is the mastered
    // bed itself, so a later re-encode does not stack a second lossy generation; 24-bit stereo
    // costs ~17 MB per minute, noise next to the video.
    name: 'archive',
    description: 'archival master: H.264 High, CRF 10, preset slow, yuv420p BT.709 limited, 2 s GOP + 24-bit PCM, Matroska',
    container: 'mkv',
    ext: '.mkv',
    video: { encoder: 'libx264', pixFmt: 'yuv420p', crf: 10, speed: 'slow', gopSeconds: 2, bframes: 2 },
    audio: { codec: 'pcm_s24le' },
  },
  'preview-hw': {
    name: 'preview-hw',
    description: 'fast preview: hardware H.264 (QSV / VideoToolbox / NVENC / AMF) when one works, else libx264 ultrafast CRF 23; same BT.709 tags; AAC 192k',
    container: 'mp4',
    ext: '.mp4',
    video: { encoder: 'auto', pixFmt: 'yuv420p', crf: 23, speed: 'ultrafast', gopSeconds: 1 },
    audio: { codec: 'aac', bitrate: '192k' },
  },
};

export function getPreset(name: string): VideoPreset {
  const p = (PRESETS as Record<string, VideoPreset | undefined>)[name];
  if (!p) throw new Error(`unknown encode preset '${name}' (known: ${Object.keys(PRESETS).join(', ')})`);
  return p;
}

const BT709_STREAM_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const BT709_FRAME_TAGS = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
// full_chroma_int only acts on YUV → RGB, so it is a no-op here (identical output, measured);
// full_chroma_inp changes the RGB → 4:2:0 chroma but measured 0.1–0.2 dB worse round-trip PSNR
// on the web template's test card and scene (ffmpeg 8.0.1), so it is not used
const SWS_FLAGS = 'flags=accurate_rnd';

/**
 * The filter chain that turns a source of colour `src` into BT.709 limited-range YUV `pixFmt`.
 *  - RGB (mezzanines): one explicit RGB → YUV conversion.
 *  - BT.709 limited YUV: no matrix change, only a pixel-format resample if needed.
 *  - another matrix or full range (e.g. a BT.601 engine output): zscale converts through RGB;
 *    swscale's YUV → YUV path would only re-scale the planes. Primaries and transfer stay 709:
 *    such sources are sRGB pictures stored with another matrix, not BT.601-gamut footage.
 */
export function toBt709Filter(src: ColorInfo, pixFmt = 'yuv420p'): string {
  if (src.space === 'rgb') return `scale=out_color_matrix=bt709:out_range=tv:${SWS_FLAGS},format=${pixFmt},${BT709_FRAME_TAGS}`;
  if (src.space === 'bt709' && src.range === 'tv')
    return `scale=in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:${SWS_FLAGS},format=${pixFmt},${BT709_FRAME_TAGS}`;
  const min = src.space === 'bt601' ? '170m' : '709';
  const rin = src.range === 'pc' ? 'full' : 'limited';
  return `zscale=pin=709:p=709:tin=709:t=709:min=${min}:m=709:rin=${rin}:r=limited,format=${pixFmt},${BT709_FRAME_TAGS}`;
}

/** Keyframe interval in frames for a preset at fps (at least 1). */
export const gopFrames = (p: VideoPreset, fps: number): number => Math.max(1, Math.round(p.video.gopSeconds * fps));

/** Encoder arguments (after the inputs and -vf) for a delivery preset. `encoder` resolves preview-hw's 'auto'. */
export function videoCodecArgs(p: VideoPreset, fps: number, encoder?: string): string[] {
  const g = String(gopFrames(p, fps));
  const enc = p.video.encoder === 'auto' ? (encoder ?? 'libx264') : p.video.encoder;
  switch (enc) {
    case 'libx264': {
      const speed = p.video.encoder === 'auto' ? 'ultrafast' : (p.video.speed ?? 'medium');
      // +cgop: closed GOPs, so every keyframe is a clean cut point (YouTube's recommendation)
      return ['-c:v', 'libx264', '-profile:v', 'high', '-preset', speed, '-crf', String(p.video.crf ?? 18), '-g', g, ...(p.video.bframes !== undefined ? ['-bf', String(p.video.bframes)] : []), '-flags', '+cgop', ...BT709_STREAM_TAGS];
    }
    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', String(p.video.crf ?? 23), '-g', g, ...BT709_STREAM_TAGS];
    case 'h264_videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-g', g, ...BT709_STREAM_TAGS];
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', String(p.video.crf ?? 23), '-g', g, ...BT709_STREAM_TAGS];
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cqp', '-qp_i', String(p.video.crf ?? 23), '-qp_p', String(p.video.crf ?? 23), '-g', g, ...BT709_STREAM_TAGS];
    default:
      throw new Error(`no argument builder for encoder ${enc}`);
  }
}

/** Hardware encoders want NV12 input; software keeps yuv420p (same 4:2:0 layout, same probe result). */
export const encoderPixFmt = (encoder: string, p: VideoPreset): string => (/_(qsv|videotoolbox|nvenc|amf)$/.test(encoder) ? 'nv12' : p.video.pixFmt);

export function audioCodecArgs(p: VideoPreset): string[] {
  if (!p.audio) return ['-an'];
  if (p.audio.codec === 'aac') return ['-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', p.audio.bitrate ?? '320k', '-ar', '48000', '-ac', '2'];
  return ['-c:a', 'pcm_s24le', '-ar', '48000', '-ac', '2'];
}

/**
 * Matroska writes a random segment UID and the muxing date unless told to be bit-exact; with it,
 * the same frames give the same file bytes. (mp4 is already reproducible.)
 */
export const MATROSKA_BITEXACT = ['-fflags', '+bitexact', '-flags:v', '+bitexact'];

/** Muxer arguments: faststart for mp4 (playback starts before the download ends). */
export const containerArgs = (p: VideoPreset): string[] =>
  p.container === 'mp4' ? ['-movflags', '+faststart', '-f', 'mp4'] : [...MATROSKA_BITEXACT, '-f', 'matroska'];

const MEZZANINE_FRAME_TAGS = 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr:range=pc';

/** Full ffmpeg arguments for one mezzanine chunk: raw RGBA frames on stdin → lossless FFV1 RGB. */
export function mezzanineArgs(o: { width: number; height: number; fps: number; out: string }): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${o.width}x${o.height}`,
    '-framerate',
    String(o.fps),
    '-i',
    'pipe:0',
    // ffmpeg 8 writes the stream's colour tags from the frames: without setparams the mezzanine
    // says transfer/primaries "unknown" to any other tool (pixels are identical either way)
    '-vf',
    MEZZANINE_FRAME_TAGS,
    '-c:v',
    'ffv1',
    '-level',
    '3',
    '-g',
    '1',
    '-slices',
    '16',
    '-slicecrc',
    '1',
    '-pix_fmt',
    'bgr0',
    // sRGB-encoded RGB, full range: what the delivery conversion reads
    '-color_primaries',
    'bt709',
    '-color_trc',
    'iec61966-2-1',
    '-colorspace',
    'rgb',
    '-color_range',
    'pc',
    ...MATROSKA_BITEXACT,
    '-f',
    'matroska',
    o.out,
  ];
}

/** The colour of what mezzanineArgs writes. */
export const MEZZANINE_COLOR: ColorInfo = { space: 'rgb', range: 'pc' };

const HW_CANDIDATES: Record<string, string[]> = {
  darwin: ['h264_videotoolbox'],
  win32: ['h264_qsv', 'h264_nvenc', 'h264_amf'],
  linux: ['h264_qsv', 'h264_nvenc'],
};

let hwCache: Promise<string | null> | null = null;

/**
 * The first hardware H.264 encoder that really encodes a frame here (listing is not enough: a
 * build lists NVENC on machines without an NVIDIA GPU). AIV_PREVIEW_ENCODER forces one.
 */
export function detectHwEncoder(): Promise<string | null> {
  hwCache ??= (async () => {
    const forced = process.env.AIV_PREVIEW_ENCODER;
    if (forced) return forced === 'libx264' ? null : forced;
    for (const enc of HW_CANDIDATES[process.platform] ?? []) {
      const r = await exec(
        ffmpegBin(),
        ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=black:s=256x144:r=30:d=0.1', '-frames:v', '1', '-vf', 'format=nv12', '-c:v', enc, '-f', 'null', '-'],
        { timeoutMs: 20_000 },
      ).catch(() => null);
      if (r?.code === 0) return enc;
    }
    return null;
  })();
  return hwCache;
}

/** The concrete video encoder a preset uses on this host. */
export async function resolveEncoder(p: VideoPreset): Promise<string> {
  return p.video.encoder === 'auto' ? ((await detectHwEncoder()) ?? 'libx264') : p.video.encoder;
}
