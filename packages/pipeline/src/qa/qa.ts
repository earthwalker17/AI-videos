/**
 * QA of a FINAL deliverable: the file a viewer gets, not the mezzanine. Checks:
 *  - probe: size, fps, frame count, yuv420p, BT.709 matrix/primaries/transfer, limited range,
 *    the expected audio codec (AAC for deliveries, 24-bit PCM for the archive master) at 48 kHz stereo;
 *  - A/V duration within one frame (and the expected duration);
 *  - loudness via ebur128: integrated within tolerance, true peak under the ceiling (a target
 *    that cannot be measured FAILS: no verdict without a measurement);
 *  - black / frozen spans longer than a threshold, unless declared intentional; silence (info);
 *  - swatches: chosen frames decoded with an explicit BT.709 limited-range matrix to rgb24, each
 *    patch's central 50 % mean within ±3 code values of TEST_SWATCHES;
 *    without swatch frames (or when they lie outside a partial render) the report records colour
 *    as NOT VERIFIED;
 *  - a contact sheet of evenly spaced frames, labelled with their frame numbers;
 *  - the sample peak (audio.clipping, FAILS above -0.1 dBFS).
 * With the cue sheet of generated audio (audio.json, found through post.json): its black and hold
 * spans join the allowances; silence, rest and hit cues are measured on the decoded samples'
 * power (audio.ts); audio.json's intent checks are re-reported; audio.png marks every cue on a
 * spectrogram over the waveform; and report.listening says where a person should listen.
 * One decode pass does probe-free analysis; swatch and contact frames, the samples and the audio
 * sheet are decoded separately.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { centralRegion, parseContract, QaReport, SWATCH_TOLERANCE, swatchLayout, type AudioResult, type CueSheet, type LoudnessTarget, type QaCheck, type SwatchRect } from '@aiv/core';
import { ffmpeg, ffmpegBin } from '../media/bin.ts';
import { countFrames, probe, type ProbeResult } from '../media/probe.ts';
import { sha256File } from '../util/hash.ts';
import type { Log } from '../util/log.ts';
import { repoRel, repoRoot, writeJson } from '../util/paths.ts';
import { execBuffer } from '../util/proc.ts';
import { allowedSpans, audioCueChecks, clippingCheck, deliveryCues, deliveryFrame, intentQaChecks, listeningPoints, shiftSpans } from './audio.ts';
import { audioSheet, decodePower, sheetMarks } from './audioMedia.ts';
import { check } from './check.ts';
import { parseAstatsPeak, parseBlack, parseEbur128, parseFreeze, parseSilence, unexpected, type Ebur128Summary, type Segment } from './detect.ts';

export interface QaOptions {
  file: string;
  root?: string;
  expect: {
    width: number;
    height: number;
    fps: number;
    frames?: number;
    durationS?: number;
    /** expect a 48 kHz stereo track (default true) */
    audio?: boolean;
    /** its codec (default 'aac'; the archive master carries 'pcm_s24le') */
    audioCodec?: string;
  };
  /** null/absent: loudness is measured and reported, not judged */
  loudness?: LoudnessTarget | null;
  /**
   * composition frames [start, end) that show the swatch strip (video.json qa.swatchFrames;
   * shifted by startFrame like the allowances); null/absent: no swatch check
   */
  swatch?: { frames: readonly [number, number]; layout?: SwatchRect[]; tolerance?: number } | null;
  /** intentional spans, composition frames [start, end) (video.json qa.allowBlack / allowFreeze) */
  allowBlack?: readonly (readonly [number, number])[];
  allowFreeze?: readonly (readonly [number, number])[];
  /** the composition frame of the file's first frame (render.frames.start; > 0 for a partial render) */
  startFrame?: number;
  /** the cue sheet and intent checks of the generated audio the file was mixed from (audio.json) */
  cues?: { sheet: CueSheet; intent?: AudioResult['checks'] } | null;
  /** audio.png, the cues on a spectrogram over the waveform (needs cues and outDir); null/absent: none */
  audioSheet?: { width?: number } | null;
  /** shortest black / frozen span that fails QA, seconds (default 0.5 / 3) */
  blackMinS?: number;
  freezeMinS?: number;
  /** contact sheet: `count` evenly spaced frames tiled `cols` wide; null: none */
  contact?: { count: number; cols?: number; tileWidth?: number } | null;
  /** where report.json and contact.png go (nothing is written when absent) */
  outDir?: string;
  /** another file's report next to the delivery's: report-<name>.json, contact-<name>.png */
  name?: string;
  log?: Log;
}

const fmtSeg = (s: Segment) => `${s.start.toFixed(2)}-${s.end.toFixed(2)} s`;

function probeChecks(p: ProbeResult, o: QaOptions, frames: number | null): QaCheck[] {
  const v = p.video;
  const a = p.audio;
  const out: QaCheck[] = [];
  if (!v) return [check('probe.video', false, 'no video stream')];
  out.push(check('probe.size', v.width === o.expect.width && v.height === o.expect.height, `${v.width}x${v.height} (expect ${o.expect.width}x${o.expect.height})`, [v.width, v.height]));
  out.push(check('probe.fps', Math.abs(v.fps - o.expect.fps) < 1e-3, `${v.fpsRational} = ${v.fps.toFixed(3)} (expect ${o.expect.fps})`, v.fps));
  if (o.expect.frames !== undefined) out.push(check('probe.frames', frames === o.expect.frames, `${frames ?? 'unknown'} frames (expect ${o.expect.frames})`, frames));
  out.push(check('probe.pix_fmt', v.pixFmt === 'yuv420p', `${v.pixFmt} (expect yuv420p)`, v.pixFmt));
  const color = { space: v.colorSpace, primaries: v.colorPrimaries, transfer: v.colorTransfer, range: v.colorRange };
  const colorOk = color.space === 'bt709' && color.primaries === 'bt709' && color.transfer === 'bt709' && color.range === 'tv';
  out.push(check('probe.color', colorOk, `matrix ${color.space} · primaries ${color.primaries} · transfer ${color.transfer} · range ${color.range} (expect bt709 ×3, tv)`, color));
  if (o.expect.audio !== false) {
    const codec = o.expect.audioCodec ?? 'aac';
    const ok = !!a && a.codec === codec && a.sampleRate === 48000 && a.channels === 2;
    out.push(check('probe.audio', ok, a ? `${a.codec}${a.profile ? ` ${a.profile}` : ''} ${a.sampleRate} Hz ${a.channels} ch (expect ${codec} 48000 Hz 2 ch)` : 'no audio stream', a ? { codec: a.codec, sampleRate: a.sampleRate, channels: a.channels } : null));
  }
  return out;
}

function durationChecks(p: ProbeResult, o: QaOptions, frames: number | null): QaCheck[] {
  const out: QaCheck[] = [];
  const frame = 1 / o.expect.fps;
  const vDur = p.video?.durationS ?? (frames !== null ? frames / o.expect.fps : null);
  if (o.expect.audio !== false && p.audio) {
    const aDur = p.audio.durationS;
    const ok = vDur !== null && aDur !== null && Math.abs(vDur - aDur) <= frame + 1e-6;
    out.push(check('av.duration', ok, `video ${vDur?.toFixed(4)} s · audio ${aDur?.toFixed(4)} s (within one frame: ${(frame * 1000).toFixed(1)} ms)`, { video: vDur, audio: aDur }));
  }
  if (o.expect.durationS !== undefined) {
    const ok = vDur !== null && Math.abs(vDur - o.expect.durationS) <= frame + 1e-6;
    out.push(check('duration', ok, `${vDur?.toFixed(4)} s (expect ${o.expect.durationS.toFixed(4)} s)`, vDur));
  }
  return out;
}

/**
 * Loudness checks from the ebur128 summary. With a target, a missing or unreadable summary is a
 * FAILED check: a passing report must mean the loudness was measured. Without one: info only.
 */
export function loudnessChecks(ebu: Ebur128Summary | null, target: LoudnessTarget | null | undefined): QaCheck[] {
  if (!target) return [check('loudness', true, ebu ? `${ebu.i.toFixed(1)} LUFS integrated, ${ebu.tp?.toFixed(1)} dBTP, LRA ${ebu.lra.toFixed(1)} LU (no target)` : 'not measurable (no target)', ebu, true)];
  if (!ebu) return [check('loudness.integrated', false, 'no ebur128 summary in the analysis output: loudness NOT verified')];
  const dI = ebu.i - target.integrated;
  return [
    check('loudness.integrated', Number.isFinite(dI) && Math.abs(dI) <= target.tolerance, `${ebu.i.toFixed(1)} LUFS (target ${target.integrated} ± ${target.tolerance})`, ebu.i),
    check('loudness.truePeak', ebu.tp !== null && ebu.tp <= target.truePeakMax, `${ebu.tp?.toFixed(1) ?? 'no'} dBTP (max ${target.truePeakMax})`, ebu.tp),
  ];
}

/** The analysis pass: black, freeze, loudness, silence and the sample peak in one decode. */
async function analyse(file: string, hasAudio: boolean, o: QaOptions): Promise<string> {
  const vf = `blackdetect=d=${o.blackMinS ?? 0.5}:pix_th=0.10,freezedetect=n=-60dB:d=${o.freezeMinS ?? 3}`;
  // astats: the overall sample peak only (its flat factor and the rest are not judged)
  const af = 'ebur128=peak=true:framelog=quiet,silencedetect=n=-60dB:d=2,astats=measure_perchannel=none:measure_overall=Peak_level';
  return ffmpeg(['-nostats', '-loglevel', 'info', '-i', file, '-map', '0:v:0', ...(hasAudio ? ['-map', '0:a:0', '-af', af] : []), '-vf', vf, '-f', 'null', '-'], 'qa analysis', { timeoutMs: 60 * 60_000 });
}

export interface SwatchResult {
  frame: number;
  patches: { id: string; expect: readonly number[]; mean: number[]; dev: number }[];
  worst: number;
}

/** Decode `frames` with an explicit BT.709 limited → full rgb24 conversion and measure each patch. */
export async function measureSwatches(file: string, width: number, height: number, frames: readonly number[], layout = swatchLayout(width, height)): Promise<SwatchResult[]> {
  const want = [...new Set(frames)].sort((a, b) => a - b);
  const select = `select=${want.map((i) => `eq(n\\,${i})`).join('+')}`;
  const vf = `${select},scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24`;
  const r = await execBuffer(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', vf, '-fps_mode', 'passthrough', '-frames:v', String(want.length), '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {
    timeoutMs: 30 * 60_000,
  });
  const size = width * height * 3;
  if (r.code !== 0 || r.stdout.length !== size * want.length) throw new Error(`swatch decode failed (${r.stdout.length} of ${size * want.length} bytes): ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
  return want.map((frame, k) => {
    const px = r.stdout.subarray(k * size, (k + 1) * size);
    const patches = layout.map((rect) => {
      const c = centralRegion(rect);
      const sum = [0, 0, 0];
      for (let y = c.y; y < c.y + c.h; y++) {
        for (let x = c.x; x < c.x + c.w; x++) {
          const o = (y * width + x) * 3;
          sum[0] += px[o];
          sum[1] += px[o + 1];
          sum[2] += px[o + 2];
        }
      }
      const mean = sum.map((s) => Math.round((s / (c.w * c.h)) * 100) / 100);
      return { id: rect.id, expect: rect.rgb, mean, dev: Math.max(...mean.map((m, j) => Math.abs(m - rect.rgb[j]))) };
    });
    return { frame, patches, worst: Math.max(...patches.map((p) => p.dev)) };
  });
}

/** Contact sheet from the final file: `count` evenly spaced frames, labelled, tiled. */
export async function contactSheet(file: string, o: { frames: number; fps: number; out: string; count: number; cols?: number; tileWidth?: number; log?: Log }): Promise<void> {
  const n = Math.max(1, Math.min(o.count, o.frames));
  const picks = [...new Set(Array.from({ length: n }, (_, k) => (n === 1 ? 0 : Math.round((k * (o.frames - 1)) / (n - 1)))))];
  const tw = o.tileWidth ?? 320;
  const tmp = `${o.out}.tiles`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  let labels = true;
  try {
    for (const [k, f] of picks.entries()) {
      // seek just before the frame's timestamp: the first frame at or after it is frame f
      const ss = Math.max(0, (f - 0.25) / o.fps).toFixed(6);
      // top-right and small: titles usually sit top-left, timecodes bottom
      const label = `drawtext=text='${f}':x=w-text_w-6:y=6:fontsize=${Math.round(tw / 22)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=3`;
      const tile = join(tmp, `t${String(k).padStart(3, '0')}.png`);
      const args = (withLabel: boolean) => ['-loglevel', 'error', '-ss', ss, '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf', `scale=${tw}:-2${withLabel ? `,${label}` : ''}`, '-update', '1', tile];
      try {
        if (!labels) throw new Error('labels off');
        await ffmpeg(args(true), 'contact tile', { timeoutMs: 120_000 });
      } catch {
        // drawtext needs a usable font; an unlabelled sheet still beats none
        if (labels) o.log?.warn('contact sheet: drawtext unavailable, tiles are unlabelled');
        labels = false;
        await ffmpeg(args(false), 'contact tile', { timeoutMs: 120_000 });
      }
    }
    const cols = Math.min(o.cols ?? 4, picks.length);
    const rows = Math.ceil(picks.length / cols);
    await ffmpeg(['-loglevel', 'error', '-framerate', '1', '-i', join(tmp, 't%03d.png'), '-vf', `tile=${cols}x${rows}:padding=4:color=0x101214`, '-frames:v', '1', '-update', '1', o.out], 'contact sheet', { timeoutMs: 120_000 });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Run every check on a final file; writes report.json (+ contact.png, audio.png) when outDir is given. */
export async function runQa(o: QaOptions): Promise<QaReport> {
  const root = o.root ?? repoRoot();
  const [p, frames] = await Promise.all([probe(o.file), countFrames(o.file, 'packets')]);
  const checks: QaCheck[] = [...probeChecks(p, o, frames), ...durationChecks(p, o, frames)];
  const durationS = p.video?.durationS ?? p.durationS ?? 0;
  const fps = o.expect.fps;
  const toSeg = (spans: readonly (readonly [number, number])[]) => spans.map(([a, b]) => ({ start: a / fps, end: b / fps }));
  // the file's place in the composition (a partial render starts later) and the cues that fall in it
  const total = frames ?? o.expect.frames ?? Math.round(durationS * fps);
  const startFrame = o.startFrame ?? 0;
  const cues = o.cues ? deliveryCues(o.cues.sheet, total, startFrame) : [];
  const allowed = allowedSpans({ allowBlack: o.allowBlack, allowFreeze: o.allowFreeze, cues, startFrame, frames: total });

  const err = await analyse(o.file, !!p.audio, o);
  const ebu = p.audio ? parseEbur128(err) : null;
  // no audio stream: probe.audio already fails when one was expected
  if (p.audio) checks.push(...loudnessChecks(ebu, o.loudness));
  const slack = 0.5 / fps;
  const black = parseBlack(err);
  const badBlack = unexpected(black, toSeg(allowed.black), slack);
  checks.push(check('black', badBlack.length === 0, badBlack.length ? `unexpected black: ${badBlack.map(fmtSeg).join(', ')}` : `no unexpected black ≥ ${o.blackMinS ?? 0.5} s${black.length ? ` (${black.length} allowed)` : ''}`, black));
  const freeze = parseFreeze(err, durationS);
  const badFreeze = unexpected(freeze, toSeg(allowed.freeze), slack);
  checks.push(check('freeze', badFreeze.length === 0, badFreeze.length ? `unexpected frozen picture: ${badFreeze.map(fmtSeg).join(', ')}` : `no unexpected freeze ≥ ${o.freezeMinS ?? 3} s${freeze.length ? ` (${freeze.length} allowed)` : ''}`, freeze));
  if (p.audio) {
    const silence = parseSilence(err, p.audio.durationS ?? durationS);
    checks.push(check('silence', true, silence.length ? `silent spans ≥ 2 s: ${silence.map(fmtSeg).join(', ')}` : 'no silence ≥ 2 s', silence, true));
    checks.push(clippingCheck(parseAstatsPeak(err)));
  }

  // the cue sheet's intent, measured on the samples' power (decoded once) and re-reported from audio.json
  const sampleRate = 48_000;
  let power: Float32Array | null = null;
  if (o.cues && p.audio) {
    try {
      power = await decodePower(o.file, p.audio.channels, sampleRate);
      checks.push(...audioCueChecks(power, cues, { fps, sampleRate }));
    } catch (e) {
      checks.push(check('audio.cues', false, `cue checks NOT run: ${(e as Error).message}`));
    }
  }
  if (o.cues) checks.push(...intentQaChecks(o.cues.intent ?? []));

  if (!o.swatch) checks.push(check('swatches', true, 'colour NOT VERIFIED: no swatch frames (video.json qa.swatchFrames); only the tags were checked', null, true));
  // composition frames, like the allowances: on a partial render the strip sits startFrame earlier, or outside
  const swatchSpan = o.swatch ? (shiftSpans([o.swatch.frames], startFrame, total)[0] ?? null) : null;
  if (o.swatch && !swatchSpan) checks.push(check('swatches', true, `colour NOT VERIFIED: the swatch frames [${o.swatch.frames.join(', ')}) are outside this partial render (composition frames from ${startFrame})`, null, true));
  if (o.swatch && swatchSpan && p.video) {
    const [a, b] = swatchSpan;
    const picks = [a, Math.floor((a + b - 1) / 2), b - 1];
    const tol = o.swatch.tolerance ?? SWATCH_TOLERANCE;
    try {
      const res = await measureSwatches(o.file, p.video.width, p.video.height, picks, o.swatch.layout);
      const worst = Math.max(...res.map((r) => r.worst));
      const bad = res.flatMap((r) => r.patches.filter((x) => x.dev > tol).map((x) => `${x.id}@${r.frame} (${x.mean.map((m) => m.toFixed(1)).join(',')} vs ${x.expect.join(',')})`));
      checks.push(check('swatches', bad.length === 0, bad.length ? `off by more than ±${tol}: ${bad.slice(0, 4).join('; ')}` : `${res.length} frames × ${res[0].patches.length} patches within ±${tol} (worst ${worst.toFixed(2)})`, res));
    } catch (e) {
      checks.push(check('swatches', false, (e as Error).message));
    }
  }

  let contact: string | null = null;
  if (o.outDir) mkdirSync(o.outDir, { recursive: true });
  if (o.contact && o.outDir && frames) {
    const out = join(o.outDir, o.name ? `contact-${o.name}.png` : 'contact.png');
    try {
      await contactSheet(o.file, { frames, fps, out, count: o.contact.count, cols: o.contact.cols, tileWidth: o.contact.tileWidth, log: o.log });
      contact = repoRel(out, root);
      checks.push(check('contact', true, `${contact} (${Math.min(o.contact.count, frames)} frames): look at it`, contact, true));
    } catch (e) {
      checks.push(check('contact', false, `contact sheet failed: ${(e as Error).message}`));
    }
  }

  let sheet: string | null = null;
  if (o.cues && o.audioSheet && o.outDir && p.audio) {
    const out = join(o.outDir, o.name ? `audio-${o.name}.png` : 'audio.png');
    const filmStart = deliveryFrame(o.cues.sheet, 0, startFrame);
    try {
      const marks = sheetMarks(cues, fps, filmStart < total ? filmStart : undefined);
      const { labels } = await audioSheet(o.file, { out, marks, durationS: power ? power.length / sampleRate : (p.audio.durationS ?? durationS), width: o.audioSheet.width, log: o.log });
      sheet = repoRel(out, root);
      checks.push(check('audio.sheet', true, `${sheet} (${cues.length} cues${labels ? '' : ', unlabelled'}): look at it`, sheet, true));
    } catch (e) {
      checks.push(check('audio.sheet', false, `audio sheet failed: ${(e as Error).message}`));
    }
  }

  const report = parseContract(
    QaReport,
    {
      schemaVersion: 1,
      file: repoRel(o.file, root),
      sha256: await sha256File(o.file),
      createdAt: new Date().toISOString(),
      passed: checks.every((c) => c.passed || c.info),
      checks,
      loudness: ebu && Number.isFinite(ebu.i) && ebu.tp !== null && Number.isFinite(ebu.tp) ? { i: ebu.i, tp: ebu.tp, lra: ebu.lra } : null,
      contactSheet: contact,
      ...(o.cues ? { audioSheet: sheet, listening: listeningPoints(cues, fps) } : {}),
    },
    'qa report',
  );
  if (o.outDir) writeJson(join(o.outDir, o.name ? `report-${o.name}.json` : 'report.json'), report);
  return report;
}

/** A compact table for the terminal: the checks, where to listen (with a cue sheet), the verdict. */
export function formatQaTable(r: QaReport): string {
  const w = Math.max(...r.checks.map((c) => c.id.length), 5);
  const lines = r.checks.map((c) => `  ${(c.info ? 'info' : c.passed ? 'PASS' : 'FAIL').padEnd(4)}  ${c.id.padEnd(w)}  ${c.detail}`);
  const listen = (r.listening ?? []).map((l) => `  listen  ${`${l.t.toFixed(2)} s`.padStart(9)}  ${l.id}: ${l.what}`);
  return [...lines, ...listen, `  ${r.passed ? 'QA PASSED' : `QA FAILED (${r.checks.filter((c) => !c.passed && !c.info).map((c) => c.id).join(', ')})`}`].join('\n');
}
