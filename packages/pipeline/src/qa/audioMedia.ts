/**
 * The file and ffmpeg side of audio QA (the measurements are pure, in audio.ts): the generated
 * audio record a delivery was mixed from, the delivery's samples, and audio.png, the picture an
 * agent that cannot hear looks at: a spectrogram (log frequency, with its legend) over the
 * waveform, with a line and a label at every cue.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { AudioResult, audioTrackName, EXIT, ExitError, parseContract, type AudioTrack, type CueKind, type PostResult, type RenderResult } from '@aiv/core';
import { ffmpeg, ffmpegBin } from '../media/bin.ts';
import { filterValue } from '../media/escape.ts';
import { probe } from '../media/probe.ts';
import { sha256File } from '../util/hash.ts';
import type { Log } from '../util/log.ts';
import { fromRepo, repoRoot } from '../util/paths.ts';
import { execBuffer } from '../util/proc.ts';
import { cueSheetMisfit, type DeliveryCue } from './audio.ts';

/**
 * The audio.json a delivery was mixed from (post.json audio.generated), or null when its audio
 * was not generated. Refuses (exit 2) when the file changed since post wrote its hash, or when
 * its cue sheet cannot describe the render (another fps or length): judging the mix against
 * another cue sheet would pass or fail for the wrong reason. Also refuses when an `audio:<name>`
 * track (in post.json's mix, or in `tracks`, video.json's) has no generated-audio record: the
 * cue checks would be skipped without a word and QA could pass unmeasured.
 */
export async function readGeneratedAudio(post: PostResult, render: RenderResult, o: { tracks?: readonly Pick<AudioTrack, 'source'>[]; root?: string } = {}): Promise<AudioResult | null> {
  const gen = post.audio.generated;
  if (!gen) {
    const named = [...new Set([...post.audio.tracks, ...(o.tracks ?? [])].filter((t) => audioTrackName(t.source) !== null).map((t) => t.source))];
    if (named.length > 0) throw new ExitError(EXIT.REFUSED, `post.json has no generated-audio record, but the mix uses ${named.join(', ')}: run aiv post again`);
    return null;
  }
  const root = o.root ?? repoRoot();
  const file = fromRepo(gen.audioJson, root);
  if (!existsSync(file)) throw new ExitError(EXIT.ERROR, `${gen.audioJson} is missing (post.json was mixed from it): build the audio and run aiv post again`);
  if ((await sha256File(file)) !== gen.audioJsonSha256) throw new ExitError(EXIT.REFUSED, `${gen.audioJson} changed since post.json was written (sha256 differs): run aiv post again`);
  const audio = parseContract(AudioResult, JSON.parse(readFileSync(file, 'utf8')), gen.audioJson);
  const misfit = cueSheetMisfit(audio.cues.sheet, render);
  if (misfit) throw new ExitError(EXIT.REFUSED, `${gen.audioJson} does not fit ${post.render.path}: ${misfit}`);
  return audio;
}

/** The aeval expression of a sample's power: the mean over `channels` of the squared samples. */
export const powerExpr = (channels: number): string => {
  const n = Math.max(1, Math.floor(channels));
  return `(${Array.from({ length: n }, (_, c) => `val(${c})*val(${c})`).join('+')})/${n}`;
};

/**
 * The power of the file's first audio stream, per sample at `sampleRate`: decoded once, the mean
 * over the channels of the squared samples ((L²+R²)/2 for stereo), as one f32 channel. Computed
 * in ffmpeg (aeval), so the memory is that of one mono channel (about 115 MB per 10 minutes at
 * 48 kHz) whatever the channel count. Power rather than a downmix: (L+R)/2 cancels anti-phase
 * content, so a span audible in both ears could read as silent. Resampled before squaring.
 */
export async function decodePower(file: string, channels: number, sampleRate = 48_000): Promise<Float32Array> {
  const af = `aresample=${sampleRate},aeval=exprs=${powerExpr(channels)}:channel_layout=mono`;
  const r = await execBuffer(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-af', af, '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], {
    timeoutMs: 30 * 60_000,
  });
  if (r.code !== 0) throw new Error(`audio decode failed: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
  const power = new Float32Array(Math.floor(r.stdout.length / 4));
  // copied, so the floats are aligned; f32le matches every supported host (x64, arm64: little-endian)
  new Uint8Array(power.buffer).set(r.stdout.subarray(0, power.length * 4));
  return power;
}

/** One mark on audio.png: a cue (or the end of the leader, 'film'), in seconds of the file. */
export interface SheetMark {
  t: number;
  /** span end, seconds */
  endT?: number;
  label: string;
  kind: CueKind | 'film';
}

/** The marks for a file's cues, plus the start of the film when a leader comes first. */
export function sheetMarks(cues: readonly DeliveryCue[], fps: number, filmStartFrame?: number): SheetMark[] {
  const film: SheetMark[] = filmStartFrame !== undefined && filmStartFrame > 0 ? [{ t: filmStartFrame / fps, label: 'film', kind: 'film' }] : [];
  return [...film, ...cues.map((c) => ({ t: c.frame / fps, ...(c.end !== undefined ? { endT: c.end / fps } : {}), label: c.id, kind: c.kind }))].sort((a, b) => a.t - b.t);
}

const KIND_COLOR: Record<SheetMark['kind'], string> = {
  cut: '0xffffff',
  hit: '0xff5a3c',
  mark: '0xb4b4b4',
  rest: '0x5ee7ff',
  silence: '0x6a8cff',
  black: '0x9a9a9a',
  hold: '0xc07aff',
  text: '0xffd84a',
  card: '0x6ee08a',
  film: '0x7d8794',
};

/** The layout of audio.png: the spectrogram picture's size decides where its plot sits. */
export interface SheetLayout {
  /** spectrogram picture, legend included */
  specW: number;
  specH: number;
  /** its plot area: the time axis spans plotW pixels from plotX */
  plotW: number;
  plotH: number;
  waveH: number;
  durationS: number;
}

const ROW_H = 16;
const ROWS = 3;
const BAND_H = ROWS * ROW_H + 6;
const LEGEND_H = 26;

/** x of a time on the plot (showspectrumpic and showwavespic both spread the whole file over plotW). */
export function sheetX(l: SheetLayout, t: number): number {
  const plotX = Math.round((l.specW - l.plotW) / 2);
  const x = plotX + Math.round((Math.min(Math.max(t, 0), l.durationS) / l.durationS) * l.plotW);
  return Math.min(x, plotX + l.plotW - 1);
}

/**
 * The compositing graph of audio.png (input 0: the file's audio, input 1: the spectrogram).
 * Under the spectrogram: a band of staggered labels, the waveform (spans shaded) and a legend of
 * the cue kinds. Every cue gets a line through the spectrogram plot, the band and the waveform.
 */
export function audioSheetGraph(l: SheetLayout, marks: readonly SheetMark[], labels: boolean): string {
  const plotX = Math.round((l.specW - l.plotW) / 2);
  const plotY = Math.round((l.specH - l.plotH) / 2);
  const waveY = l.specH + BAND_H;
  const panelH = BAND_H + l.waveH + LEGEND_H;
  const draw: string[] = [];
  for (const m of marks) {
    if (m.endT === undefined) continue;
    const x0 = sheetX(l, m.t);
    draw.push(`drawbox=x=${x0}:y=${waveY}:w=${Math.max(1, sheetX(l, m.endT) - x0)}:h=${l.waveH}:color=${KIND_COLOR[m.kind]}@0.22:t=fill`);
  }
  marks.forEach((m) => draw.push(`drawbox=x=${sheetX(l, m.t)}:y=${plotY}:w=2:h=${waveY + l.waveH - plotY}:color=${KIND_COLOR[m.kind]}@0.85:t=fill`));
  if (labels) {
    const text = (s: string, x: string | number, y: number, color: string) => `drawtext=text=${filterValue(s)}:x=${x}:y=${y}:fontsize=13:fontcolor=${color}`;
    marks.forEach((m, k) => {
      const x = sheetX(l, m.t);
      // near the right edge the label goes left of its line
      const at = x > plotX + l.plotW * 0.9 ? `${x - 3}-text_w` : x + 4;
      draw.push(text(m.label, at, l.specH + 4 + (k % ROWS) * ROW_H, KIND_COLOR[m.kind]));
    });
    const kinds = [...new Set(marks.map((m) => m.kind))];
    kinds.forEach((kind, k) => draw.push(text(kind, plotX + k * 80, waveY + l.waveH + 6, KIND_COLOR[kind])));
  }
  return [
    `[0:a:0]showwavespic=s=${l.plotW}x${l.waveH}:colors=0xc8d2e0|0x8fa3bd:filter=peak[w]`,
    `color=c=0x101214:s=${l.specW}x${panelH}:r=1:d=1[bg]`,
    `[bg][w]overlay=x=${plotX}:y=${BAND_H},format=rgb24[panel]`,
    '[1:v]format=rgb24[spec]',
    `[spec][panel]vstack=inputs=2${draw.length ? `,${draw.join(',')}` : ''},format=rgb24[out]`,
  ].join(';');
}

/**
 * audio.png for `file`: the spectrogram is drawn first, so its legend's margins (which depend on
 * the sample rate) are measured rather than assumed, then composed with the waveform and the
 * marks. Labels need drawtext and a usable font; without them the lines alone are drawn.
 * Returns whether the labels were drawn.
 */
export async function audioSheet(file: string, o: { out: string; marks: readonly SheetMark[]; durationS: number; width?: number; log?: Log }): Promise<{ labels: boolean }> {
  const plotW = o.width ?? 1600;
  const plotH = 400;
  const spec = `${o.out}.spectrum.png`;
  const graph = `${o.out}.graph.txt`;
  try {
    await ffmpeg(['-loglevel', 'error', '-i', file, '-filter_complex', `[0:a:0]showspectrumpic=s=${plotW}x${plotH}:legend=1:fscale=log[s]`, '-map', '[s]', '-frames:v', '1', '-update', '1', spec], 'audio spectrogram', { timeoutMs: 10 * 60_000 });
    const v = (await probe(spec)).video;
    if (!v) throw new Error('the spectrogram picture has no image');
    const layout: SheetLayout = { specW: v.width, specH: v.height, plotW, plotH, waveH: 160, durationS: Math.max(o.durationS, 1e-3) };
    const compose = async (labels: boolean) => {
      // a long cue sheet makes a long graph: it goes through a file, past the command-line limit
      writeFileSync(graph, audioSheetGraph(layout, o.marks, labels));
      await ffmpeg(['-loglevel', 'error', '-i', file, '-i', spec, '-/filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-update', '1', o.out], 'audio sheet', { timeoutMs: 10 * 60_000 });
    };
    try {
      await compose(true);
      return { labels: true };
    } catch {
      o.log?.warn('audio sheet: drawtext unavailable, the cue lines are unlabelled');
      await compose(false);
      return { labels: false };
    }
  } finally {
    rmSync(spec, { force: true });
    rmSync(graph, { force: true });
  }
}
