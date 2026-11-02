// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 LemoLab
// SPDX-FileCopyrightText: 2026 earthwalker17
// Adapted from https://github.com/lemomo-ai/lemo-opuscar/blob/bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00/core/render/mux.sh
// (two-pass loudnorm with measured values and linear=true, exact-length padding/trimming)
/**
 * The audio bed: every track of video.json mixed at 48 kHz stereo to exactly the picture's
 * length (from the picture's first frame: a partial render's bed starts where its frames do),
 * then mastered with a two-pass loudnorm. Pass 1 measures; pass 2 applies the measured
 * values with linear=true, which is a single gain (no dynamics change) whenever the target is
 * reachable without breaking the true-peak ceiling.
 */
import { copyFileSync } from 'node:fs';
import type { AudioTrack, LoudnessMeasure } from '@aiv/core';
import { fromRepo } from '../util/paths.ts';
import { ffmpeg } from './bin.ts';

export const AUDIO_RATE = 48_000;

export interface LoudnessTargetSpec {
  /** integrated, LUFS (YouTube normalises playback to about -14) */
  i: number;
  /** true-peak ceiling, dBTP */
  tp: number;
  /** loudness-range target, LU (raised to the measured LRA so linear mode stays possible) */
  lra: number;
}

export const DEFAULT_LOUDNESS: LoudnessTargetSpec = { i: -14, tp: -1.5, lra: 11 };

const samples = (s: number) => Math.round(s * AUDIO_RATE);

export interface AudioBedOptions {
  /**
   * where the bed starts in the video, in samples: a partial render (--frames a-b) delivers the
   * picture from frame a, so every track moves by -a/fps to stay in sync (default 0)
   */
  offsetSamples?: number;
  /** absolute files for sources that are not repo paths (audio:<name> → out/<slug>/audio/<name>.wav) */
  files?: Readonly<Record<string, string>>;
}

/**
 * The ffmpeg arguments that mix `tracks` into a 48 kHz stereo float WAV of exactly durationS.
 * Exported for tests; buildAudioBed runs it. Without an offset the arguments are what they
 * always were, so an existing lavfi mix stays byte-identical.
 */
export function audioBedArgs(tracks: readonly AudioTrack[], durationS: number, out: string, root?: string, o: AudioBedOptions = {}): string[] {
  const n = samples(durationS);
  const off = o.offsetSamples ?? 0;
  const inputs: string[] = [];
  const chains: string[] = [];
  tracks.forEach((t, i) => {
    // a generated source runs from the video's start, so it must also cover the skipped part
    if (t.source.startsWith('lavfi:')) inputs.push('-f', 'lavfi', '-t', (durationS + off / AUDIO_RATE).toFixed(6), '-i', t.source.slice(6));
    else inputs.push('-i', o.files?.[t.source] ?? fromRepo(t.source, root));
    const steps = [`aresample=${AUDIO_RATE}`, 'aformat=sample_fmts=fltp:channel_layouts=stereo'];
    if (t.gainDb) steps.push(`volume=${t.gainDb}dB`);
    // where this track starts in the delivered bed: before it, trim its head instead
    const at = samples(t.start ?? 0) - off;
    if (at < 0) steps.push(`atrim=start_sample=${-at}`, 'asetpts=PTS-STARTPTS');
    else if (t.start || off) steps.push(`adelay=delays=${at}S:all=1`);
    chains.push(`[${i}:a]${steps.join(',')}[a${i}]`);
  });
  const mix = tracks.length > 1 ? `${tracks.map((_, i) => `[a${i}]`).join('')}amix=inputs=${tracks.length}:normalize=0:duration=longest[m]` : '[a0]anull[m]';
  // pad short sources, cut long ones: exactly the picture's length in samples
  const tail = `[m]apad=whole_len=${n},atrim=end_sample=${n}[out]`;
  return ['-loglevel', 'error', ...inputs, '-filter_complex', [...chains, mix, tail].join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', '-ar', String(AUDIO_RATE), '-ac', '2', '-f', 'wav', out];
}

/** Mix the tracks (or silence when there are none) into a float WAV of exactly durationS. */
export async function buildAudioBed(o: { tracks: readonly AudioTrack[]; durationS: number; out: string; root?: string } & AudioBedOptions): Promise<void> {
  const tracks = o.tracks.length ? o.tracks : [{ source: `lavfi:anullsrc=r=${AUDIO_RATE}:cl=stereo` }];
  await ffmpeg(audioBedArgs(tracks, o.durationS, o.out, o.root, { offsetSamples: o.offsetSamples, files: o.files }), 'audio bed', { timeoutMs: 10 * 60_000 });
}

/** The JSON block loudnorm prints at the end of its run (print_format=json). */
export function parseLoudnormJson(stderr: string): Record<string, string> {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('loudnorm printed no JSON summary');
  return JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
}

const measureOf = (j: Record<string, string>, p: 'input' | 'output'): LoudnessMeasure | null => {
  const m = { i: Number(j[`${p}_i`]), tp: Number(j[`${p}_tp`]), lra: Number(j[`${p}_lra`]), thresh: Number(j[`${p}_thresh`]) };
  return Number.isFinite(m.i) && Number.isFinite(m.tp) ? m : null;
};

/** loudnorm pass 1: integrated loudness, true peak, LRA and gate of a file. null = silence. */
export async function measureLoudness(file: string, target: LoudnessTargetSpec = DEFAULT_LOUDNESS): Promise<{ measure: LoudnessMeasure | null; offset: number }> {
  const err = await ffmpeg(['-nostats', '-loglevel', 'info', '-i', file, '-vn', '-af', `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}:print_format=json`, '-f', 'null', '-'], 'loudness measurement', { timeoutMs: 10 * 60_000 });
  const j = parseLoudnormJson(err);
  return { measure: measureOf(j, 'input'), offset: Number(j.target_offset) || 0 };
}

export interface MasterResult {
  before: LoudnessMeasure | null;
  after: LoudnessMeasure | null;
  mode: 'linear' | 'dynamic' | 'silent';
  target: LoudnessTargetSpec;
}

/**
 * Two-pass loudnorm of `input` into a 48 kHz 24-bit WAV of exactly durationS. A silent mix is
 * copied through unchanged (normalising silence would only amplify noise).
 */
export async function masterAudio(o: { input: string; out: string; durationS: number; target?: LoudnessTargetSpec }): Promise<MasterResult> {
  const target = o.target ?? DEFAULT_LOUDNESS;
  const { measure, offset } = await measureLoudness(o.input, target);
  const n = samples(o.durationS);
  if (!measure || measure.i < -70) {
    copyFileSync(o.input, o.out);
    return { before: measure, after: measure, mode: 'silent', target };
  }
  // linear mode needs target LRA ≥ source LRA; keep the source's dynamics instead of squashing them
  const lra = Math.min(50, Math.max(target.lra, Math.ceil(measure.lra * 10) / 10 + 0.1));
  // loudnorm reads measured_LRA=0 as "not given" and silently drops to dynamic mode; a steady
  // bed really measures 0 LU, so pass the smallest non-zero value instead
  const mLra = Math.max(measure.lra, 0.01);
  const ln = [
    `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${lra.toFixed(1)}`,
    `measured_I=${measure.i}:measured_TP=${measure.tp}:measured_LRA=${mLra}:measured_thresh=${measure.thresh}`,
    `offset=${offset}:linear=true:print_format=json`,
  ].join(':');
  // loudnorm resamples to 192 kHz internally: back to 48 kHz, then exact length again
  const af = `${ln},aresample=${AUDIO_RATE},apad=whole_len=${n},atrim=end_sample=${n}`;
  const err = await ffmpeg(['-nostats', '-loglevel', 'info', '-i', o.input, '-af', af, '-c:a', 'pcm_s24le', '-ar', String(AUDIO_RATE), '-ac', '2', '-f', 'wav', o.out], 'loudnorm', { timeoutMs: 10 * 60_000 });
  const j = parseLoudnormJson(err);
  return { before: measure, after: measureOf(j, 'output'), mode: j.normalization_type === 'linear' ? 'linear' : 'dynamic', target };
}
