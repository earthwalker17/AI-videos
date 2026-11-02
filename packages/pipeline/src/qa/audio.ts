/**
 * Audio QA for an agent that cannot hear (docs/ARCHITECTURE.md, decision 25): the cue sheet's
 * intent, measured on the delivery's decoded samples. Pure functions over the cue sheet and the
 * samples' power, so every threshold is pinned by tests; qa.ts decodes the file and wires them in.
 *
 * The samples arrive as POWER: per sample, the mean over the channels of the squared sample
 * ((L²+R²)/2 for stereo; audioMedia.ts decodePower). A downmix (L+R)/2 would cancel anti-phase
 * content and read a decorrelated stereo tail 3 dB low, so a span that is audible in either ear
 * could pass as silent. Levels are 10·log10 of the mean power, i.e. 20·log10(RMS) (a full-scale
 * square wave is 0 dB, a full-scale sine -3 dB). The rest check compares two such levels, so it
 * compares like with like rather than an RMS with a K-weighted LUFS reading.
 *
 * Frames: cue frames are film frames, counted from the end of the test-card leader. In a file
 * whose first frame is composition frame `startFrame` (render.frames.start; > 0 for a partial
 * render), a cue sits at delivery frame leaderFrames + frame - startFrame.
 */
import type { AudioResult, CueKind, CueSheet, QaCheck } from '@aiv/core';
import { check } from './check.ts';

/** a silence cue's RMS ceiling, dB */
export const SILENCE_MAX_DB = -60;
/** how far under the mix's integrated level a rest must stay, dB */
export const REST_UNDER_DB = 20;
/** how far from a hit cue the onset is searched, ms */
export const HIT_SEARCH_MS = 120;
/** the sample-peak ceiling of a delivery, dBFS */
export const CLIP_MAX_DBFS = -0.1;

/** A [start, end) span of frames. */
export type Span = readonly [number, number];

/** A cue placed on a file: delivery frames from its first frame, spans clipped to the file. */
export interface DeliveryCue {
  id: string;
  kind: CueKind;
  label?: string;
  text?: Record<string, string>;
  /** the frame as written in the sheet (film frame) */
  filmFrame: number;
  /** delivery frame of a point, or the (clipped) start of a span */
  frame: number;
  /** (clipped) exclusive end of a span */
  end?: number;
}

/** The delivery frame of a film frame. */
export const deliveryFrame = (sheet: Pick<CueSheet, 'leaderFrames'>, filmFrame: number, startFrame = 0): number => sheet.leaderFrames + filmFrame - startFrame;

/** A span clipped to [0, frames), or null when nothing of it is left. */
export function clipSpan([a, b]: Span, frames: number): Span | null {
  const s = Math.max(0, a);
  const e = Math.min(frames, b);
  return e > s ? [s, e] : null;
}

/**
 * The sheet's events on a file of `frames` frames whose first frame is composition frame
 * `startFrame`: points inside the file, spans clipped to it. Events outside a partial render
 * are left out.
 */
export function deliveryCues(sheet: CueSheet, frames: number, startFrame = 0): DeliveryCue[] {
  const out: DeliveryCue[] = [];
  for (const e of sheet.events) {
    const base = { id: e.id, kind: e.kind, filmFrame: e.frame, ...(e.label !== undefined ? { label: e.label } : {}), ...(e.text !== undefined ? { text: e.text } : {}) };
    const at = deliveryFrame(sheet, e.frame, startFrame);
    if (e.end !== undefined) {
      const s = clipSpan([at, deliveryFrame(sheet, e.end, startFrame)], frames);
      if (s) out.push({ ...base, frame: s[0], end: s[1] });
    } else if (at >= 0 && at < frames) out.push({ ...base, frame: at });
  }
  return out;
}

/** Composition-frame spans (video.json) moved onto a file that starts at `startFrame`, clipped to it. */
export function shiftSpans(spans: readonly Span[], startFrame: number, frames: number): Span[] {
  return spans.flatMap(([a, b]) => {
    const s = clipSpan([a - startFrame, b - startFrame], frames);
    return s ? [s] : [];
  });
}

/** Overlapping or touching spans joined, sorted: a detection across two allowed spans is allowed. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  const sorted = [...spans].sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * The black and freeze allowances of a file, in its frames: video.json qa.allowBlack /
 * allowFreeze (composition frames, shifted by startFrame) plus the cue sheet's `black` and
 * `hold` spans. A black span is also a still picture, so it allows a freeze too.
 */
export function allowedSpans(o: { allowBlack?: readonly Span[]; allowFreeze?: readonly Span[]; cues: readonly DeliveryCue[]; startFrame: number; frames: number }): { black: Span[]; freeze: Span[] } {
  const cueSpans = (kinds: readonly CueKind[]) => o.cues.flatMap((c) => (kinds.includes(c.kind) && c.end !== undefined ? [[c.frame, c.end] as const] : []));
  return {
    black: mergeSpans([...shiftSpans(o.allowBlack ?? [], o.startFrame, o.frames), ...cueSpans(['black'])]),
    freeze: mergeSpans([...shiftSpans(o.allowFreeze ?? [], o.startFrame, o.frames), ...cueSpans(['black', 'hold'])]),
  };
}

/** Why a cue sheet cannot describe a render (another fps or length), or null when it fits. */
export function cueSheetMisfit(sheet: CueSheet, render: { fps: number; composition: { durationFrames: number } }): string | null {
  if (Math.abs(sheet.fps - render.fps) > 1e-6) return `the cue sheet is at ${sheet.fps} fps, the render at ${render.fps} fps`;
  const total = sheet.leaderFrames + sheet.filmFrames;
  if (total !== render.composition.durationFrames) return `the cue sheet spans ${sheet.leaderFrames} leader + ${sheet.filmFrames} film = ${total} frames, the composition ${render.composition.durationFrames}`;
  return null;
}

// --- levels ------------------------------------------------------------------------------------

const toDb = (meanSquare: number): number => (meanSquare > 0 ? 10 * Math.log10(meanSquare) : -Infinity);

/** 20·log10(RMS) of the samples whose power is power[from, to); -Infinity for digital silence or an empty range. */
export function rmsDb(power: Float32Array, from = 0, to = power.length): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(power.length, Math.floor(to));
  if (b <= a) return -Infinity;
  let sum = 0;
  for (let i = a; i < b; i++) sum += power[i];
  return toDb(sum / (b - a));
}

/**
 * The mix's integrated level, gated like ITU-R BS.1770 but unweighted: 400 ms blocks every
 * 100 ms, an absolute gate at -70 dB and a relative gate 10 dB under the mean of the blocks
 * above it. Silent passages then do not drag the level down. Null when nothing passes the
 * absolute gate (a silent mix).
 */
export function integratedLevelDb(power: Float32Array, sampleRate: number): number | null {
  const seg = Math.max(1, Math.round(sampleRate * 0.1));
  const n = Math.floor(power.length / seg);
  const segPower: number[] = [];
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let i = k * seg; i < (k + 1) * seg; i++) sum += power[i];
    segPower.push(sum / seg);
  }
  // shorter than one block: the whole file is the one block
  const blocks = n >= 4 ? segPower.slice(3).map((_, k) => (segPower[k] + segPower[k + 1] + segPower[k + 2] + segPower[k + 3]) / 4) : [10 ** (rmsDb(power) / 10)];
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const loud = blocks.filter((p) => p > 10 ** (-70 / 10));
  if (loud.length === 0) return null;
  const relative = mean(loud) * 10 ** (-10 / 10);
  return toDb(mean(loud.filter((p) => p > relative)));
}

/**
 * The loudest `windowS` (3 s, EBU short-term) of power[from, to), as 20·log10(RMS), hopping 10 ms;
 * a shorter range is measured whole.
 */
export function loudestWindowDb(power: Float32Array, sampleRate: number, from: number, to: number, windowS = 3): number {
  const a = Math.max(0, Math.floor(from));
  const n = Math.min(power.length, Math.floor(to)) - a;
  if (n <= 0) return -Infinity;
  const w = Math.min(n, Math.max(1, Math.round(windowS * sampleRate)));
  const hop = Math.max(1, Math.round(sampleRate * 0.01));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + power[a + i];
  let best = 0;
  for (let s = 0; ; s += hop) {
    const start = Math.min(s, n - w);
    best = Math.max(best, prefix[start + w] - prefix[start]);
    if (start === n - w) break;
  }
  return toDb(best / w);
}

export interface Onset {
  /** seconds from the start of the file */
  t: number;
  /** onset - cue, ms (negative: early) */
  offsetMs: number;
}

/**
 * Energy-flux onset near `t` seconds: the energy of 5 ms blocks on a grid through the cue, and
 * the start of the block with the largest rise over the one before, within ±searchMs (error
 * ≤ 2.5 ms). A rise counts only when the block is at least 3 dB above the one before and more
 * than -80 dB (mean square) louder, so a steady tone's ripple or a noise floor cannot pass for a
 * hit. Null when nothing rises.
 */
export function findOnset(power: Float32Array, sampleRate: number, t: number, searchMs = HIT_SEARCH_MS): Onset | null {
  const h = Math.max(1, Math.round(sampleRate * 0.005));
  const centre = Math.round(t * sampleRate);
  const reach = Math.floor(((searchMs / 1000) * sampleRate) / h);
  const energy = (k: number) => {
    let e = 0;
    for (let i = Math.max(0, centre + k * h); i < Math.min(power.length, centre + (k + 1) * h); i++) e += power[i];
    return e;
  };
  let prev = energy(-reach - 1);
  let best = 0;
  let bestK: number | null = null;
  for (let k = -reach; k <= reach; k++) {
    const e = energy(k);
    const rise = e - prev;
    if (e >= 2 * prev && rise / h > 1e-8 && rise > best) {
      best = rise;
      bestK = k;
    }
    prev = e;
  }
  return bestK === null ? null : { t: (centre + bestK * h) / sampleRate, offsetMs: ((bestK * h) / sampleRate) * 1000 };
}

// --- checks ------------------------------------------------------------------------------------

const fmtDb = (db: number | null) => (db === null || db === -Infinity ? '-inf dB' : `${db.toFixed(1)} dB`);
const fmtS = (frame: number, fps: number) => (frame / fps).toFixed(2);
const spanText = (c: DeliveryCue, fps: number) => `${fmtS(c.frame, fps)}-${fmtS(c.end ?? c.frame, fps)} s`;

/** One frame off each edge, where a cut's fade still sounds; the whole span when that leaves nothing. */
const interior = (a: number, b: number): { span: Span; whole: boolean } => (b - a > 2 ? { span: [a + 1, b - 1], whole: false } : { span: [a, b], whole: true });

/**
 * The cue checks on the decoded delivery: each `silence` span at most -60 dB RMS, each `rest`
 * span's loudest 3 s at least 20 dB under the mix's integrated level (both excluding one frame
 * at each edge), and, for information, how far each `hit`'s onset lies from its frame.
 */
export function audioCueChecks(power: Float32Array, cues: readonly DeliveryCue[], o: { fps: number; sampleRate: number }): QaCheck[] {
  const at = (frame: number) => Math.round((frame / o.fps) * o.sampleRate);
  const out: QaCheck[] = [];
  let mix: number | null | undefined;
  for (const c of cues) {
    if (c.kind === 'silence' && c.end !== undefined) {
      const { span, whole } = interior(c.frame, c.end);
      const db = rmsDb(power, at(span[0]), at(span[1]));
      const edges = whole ? '; too short to drop the edge frames' : '';
      out.push(check(`audio.silence.${c.id}`, db <= SILENCE_MAX_DB, `${spanText(c, o.fps)}: ${fmtDb(db)} RMS (max ${SILENCE_MAX_DB} dB${edges})`, { db: Number.isFinite(db) ? db : null }));
    } else if (c.kind === 'rest' && c.end !== undefined) {
      if (mix === undefined) mix = integratedLevelDb(power, o.sampleRate);
      const { span, whole } = interior(c.frame, c.end);
      const db = loudestWindowDb(power, o.sampleRate, at(span[0]), at(span[1]));
      // a silent mix (null) or a silent rest (-inf) is as far under as it gets
      const under = mix === null ? Infinity : mix - db;
      const edges = whole ? '; too short to drop the edge frames' : '';
      const detail =
        mix === null
          ? `${spanText(c, o.fps)}: the mix is silent`
          : `${spanText(c, o.fps)}: loudest 3 s ${fmtDb(db)}, mix ${fmtDb(mix)}: ${Number.isFinite(under) ? `${under.toFixed(1)} dB under` : 'silent'} (min ${REST_UNDER_DB} dB under${edges})`;
      out.push(check(`audio.rest.${c.id}`, under >= REST_UNDER_DB, detail, { db: Number.isFinite(db) ? db : null, mix }));
    } else if (c.kind === 'hit') {
      const t = c.frame / o.fps;
      const onset = findOnset(power, o.sampleRate, t);
      const frameMs = 1000 / o.fps;
      const within = onset !== null && Math.abs(onset.offsetMs) <= frameMs + 1e-6;
      const detail =
        onset === null
          ? `${t.toFixed(3)} s: no onset within ±${HIT_SEARCH_MS} ms`
          : `${t.toFixed(3)} s: onset ${onset.offsetMs >= 0 ? '+' : ''}${onset.offsetMs.toFixed(1)} ms (${within ? 'within' : 'NOT within'} ±1 frame, ${frameMs.toFixed(1)} ms)`;
      out.push(check(`audio.hit.${c.id}`, within, detail, onset ? { offsetMs: Math.round(onset.offsetMs * 10) / 10, withinFrame: within } : null, true));
    }
  }
  return out;
}

/** Where a person should listen closely: every hit, rest, silence, text and card cue, in time order. */
export function listeningPoints(cues: readonly DeliveryCue[], fps: number): { t: number; id: string; what: string }[] {
  const kinds: readonly CueKind[] = ['hit', 'rest', 'silence', 'text', 'card'];
  const words = (c: DeliveryCue) => (c.text ? `: ${Object.entries(c.text).map(([lang, s]) => `${lang} "${s}"`).join(' · ')}` : '');
  const what = (c: DeliveryCue): string => {
    const label = c.label !== undefined ? ` "${c.label}"` : '';
    const dur = c.end !== undefined ? ` ${((c.end - c.frame) / fps).toFixed(2)} s` : '';
    switch (c.kind) {
      case 'hit':
        return `hit${label}: lands on film frame ${c.filmFrame}`;
      case 'rest':
        return `rest${dur}${label}: quiet, at least ${REST_UNDER_DB} dB under the mix`;
      case 'silence':
        return `silence${dur}${label}: nothing audible`;
      default:
        return `${c.kind}${dur}${label}${words(c)}`;
    }
  };
  return cues
    .filter((c) => kinds.includes(c.kind))
    .map((c) => ({ t: Math.round((c.frame / fps) * 1000) / 1000, id: c.id, what: what(c) }))
    .sort((x, y) => x.t - y.t);
}

/** The audio stage's intent checks (audio.json) as QA checks: a failed one fails QA, info stays info. */
export function intentQaChecks(checks: AudioResult['checks']): QaCheck[] {
  return checks.map((c) => check(`intent.${c.id}`, c.passed, c.detail, undefined, c.info === true));
}

/** Sample peak against the ceiling. Without a measurement the check fails: no verdict unmeasured. */
export function clippingCheck(peakDb: number | null): QaCheck {
  if (peakDb === null) return check('audio.clipping', false, 'no astats peak in the analysis output: clipping NOT verified');
  return check('audio.clipping', peakDb <= CLIP_MAX_DBFS, `sample peak ${peakDb === -Infinity ? '-inf' : peakDb.toFixed(2)} dBFS (max ${CLIP_MAX_DBFS})`, Number.isFinite(peakDb) ? peakDb : null);
}
