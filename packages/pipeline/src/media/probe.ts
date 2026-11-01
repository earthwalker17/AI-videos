// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/ffmpeg.ts
// (countFrames: packet vs decode frame counts with ffprobe)
/** ffprobe as JSON, normalised to the fields the pipeline asserts on. */
import { exec } from '../util/proc.ts';
import { ffprobeBin } from './bin.ts';

export interface VideoStreamInfo {
  index: number;
  codec: string;
  profile: string | null;
  width: number;
  height: number;
  pixFmt: string | null;
  /** r_frame_rate as a number (e.g. 30, 29.97) and as ffprobe's rational */
  fps: number;
  fpsRational: string;
  /** container frame count when the container stores one (mp4 does, mkv does not) */
  nbFrames: number | null;
  durationS: number | null;
  colorSpace: string | null;
  colorPrimaries: string | null;
  colorTransfer: string | null;
  colorRange: string | null;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  profile: string | null;
  sampleRate: number;
  channels: number;
  channelLayout: string | null;
  durationS: number | null;
}

export interface ProbeResult {
  formatName: string;
  durationS: number | null;
  bytes: number;
  bitRate: number | null;
  video: VideoStreamInfo | null;
  audio: AudioStreamInfo | null;
  streams: number;
}

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' && v !== 'unknown' ? v : null);

/**
 * A stream's duration in seconds. Matroska stores none per stream (ffprobe says N/A); its muxer
 * writes a DURATION tag ("00:00:05.000000000") instead, which the archive master's A/V check needs.
 */
export function streamDuration(s: Raw): number | null {
  const d = num(s.duration);
  if (d !== null) return d;
  const tag = (s.tags as Raw | undefined)?.DURATION;
  const m = typeof tag === 'string' ? /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(tag) : null;
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** "30000/1001" → 29.97…; "0/0" → 0. */
export function rational(r: string | null | undefined): number {
  if (!r) return 0;
  const [a, b] = r.split('/').map(Number);
  return b ? a / b : Number(a) || 0;
}

export async function probe(file: string): Promise<ProbeResult> {
  const r = await exec(ffprobeBin(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeoutMs: 60_000 });
  if (r.code !== 0) throw new Error(`ffprobe failed for ${file}: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  const j = JSON.parse(r.stdout) as { format?: Raw; streams?: Raw[] };
  const streams = j.streams ?? [];
  // attached pictures (cover art) are video streams too; skip them
  const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition as Raw | undefined)?.attached_pic);
  const a = streams.find((s) => s.codec_type === 'audio');
  const f = j.format ?? {};
  return {
    formatName: String(f.format_name ?? ''),
    durationS: num(f.duration),
    bytes: num(f.size) ?? 0,
    bitRate: num(f.bit_rate),
    streams: streams.length,
    video: v
      ? {
          index: Number(v.index),
          codec: String(v.codec_name ?? ''),
          profile: str(v.profile),
          width: Number(v.width ?? 0),
          height: Number(v.height ?? 0),
          pixFmt: str(v.pix_fmt),
          fps: rational(String(v.r_frame_rate ?? '0/0')),
          fpsRational: String(v.r_frame_rate ?? '0/0'),
          nbFrames: num(v.nb_frames),
          durationS: streamDuration(v),
          colorSpace: str(v.color_space),
          colorPrimaries: str(v.color_primaries),
          colorTransfer: str(v.color_transfer),
          colorRange: str(v.color_range),
        }
      : null,
    audio: a
      ? {
          index: Number(a.index),
          codec: String(a.codec_name ?? ''),
          profile: str(a.profile),
          sampleRate: num(a.sample_rate) ?? 0,
          channels: Number(a.channels ?? 0),
          channelLayout: str(a.channel_layout),
          durationS: streamDuration(a),
        }
      : null,
  };
}

/**
 * Video frame count. 'packets' counts packets (one per frame in mp4/mkv: seconds even for long
 * files); 'decode' decodes every frame (the ground truth, minutes for a long film).
 */
export async function countFrames(file: string, how: 'packets' | 'decode' = 'packets'): Promise<number | null> {
  const [flag, entry] = how === 'packets' ? ['-count_packets', 'stream=nb_read_packets'] : ['-count_frames', 'stream=nb_read_frames'];
  const r = await exec(ffprobeBin(), ['-v', 'error', flag, '-select_streams', 'v:0', '-show_entries', entry, '-of', 'csv=p=0', file], { timeoutMs: 10 * 60_000 });
  if (r.code !== 0) return null;
  const n = Number(r.stdout.trim().split(/[\r\n,]/)[0]);
  return Number.isFinite(n) ? n : null;
}

/** Duration of the audio stream in seconds from its packets (exact for PCM; AAC includes priming handled by the edit list). */
export async function audioDuration(file: string): Promise<number | null> {
  const r = await exec(ffprobeBin(), ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', file], { timeoutMs: 60_000 });
  const n = Number(r.stdout.trim());
  return r.code === 0 && Number.isFinite(n) ? n : null;
}
