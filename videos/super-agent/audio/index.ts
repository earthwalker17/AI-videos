/**
 * The score of "Who Routes the Agents?": one stereo track, `mix` (video.json audio.tracks:
 * {"source": "audio:mix"}), built on the shared score kit (@aiv/pipeline/audio/kit).
 *
 * Bars 1-43 (0:00-1:54.7) were laid on the picture's contact frames in session 4 (approved as
 * built, 2026-11-12), bars 44-84 (to 3:44.0) on part two's schedules in session 5. arrangement.ts
 * lists the parts. The whole film is mixed and mastered as one. Part two places nothing a reader
 * must hear on the Workers' bus: it stays behind its wall (levels.ts throughWall) from MT1 on.
 *
 *   arrangement.ts  the parts, on the cue sheet's grid and schedules (ctx.cues through the kit's timeline)
 *   instruments.ts  the film's voices, built from kit primitives
 *   foley.ts        the soft UI sounds (paper, ink and small mechanisms)
 *   index.ts        the desk: four buses, a hall and a ping-pong echo, the master, the report
 *
 * Hard cuts (every clip that started before one stops there, reverb and echo included): the hub
 * (the swings stop dead), `silence-hub` and `silence-intrusion` (also forced to digital zero by
 * the master), bar 18 (the split stops and the Dsus2 hangs alone) and the turn. On the hall and
 * the echo only, also the start of every rest (`rest-breath`, `rest-model`, `rest-signoff`,
 * `rest-tail`): the tails from before it stop there, so a rest holds only its own quiet sounds
 * and their reverb (QA wants a rest 20 dB under the mix).
 *
 * The master is the kit's (28 Hz high-pass, glue, iterated loudness, look-ahead true-peak
 * limiter): -14 LUFS integrated, the limiter at post's loudnorm ceiling (-1.5 dBTP) less an AAC
 * margin of 2.0 dB, so -3.5 dBTP here and the AAC delivery stays under qa's -1 dBTP. (The kit's 1.1 dB
 * was not enough here: the half-speed motif's D5 on bar 74 beat 4, struck into the limiter, came out of
 * the draft's 192k AAC 1.7 dB over its true peak, at -0.7 dBTP; at 320k 0.5 dB. Session 6.) The
 * last 2 s fade to nothing (`rest-tail`).
 *
 * The report (the stage's log) prints the master, the loudness of bars 1-43 and of bars 44-84 alone,
 * the rests and silences measured as `aiv qa` measures them (unweighted, on the master's output),
 * each hit's onset, how far each UI sound sits under the bed, and the mixer's levels.
 *
 * Deterministic: float64 state, fixed loop order, randomness only from ctx.seed (@aiv/core).
 */
import { defineScore, type ScoreContext, type Stereo } from '@aiv/pipeline/audio';
import { HALL, Mixer, SR, convolver, delay, loudness, master, synthIr, timeline, type Timeline } from '@aiv/pipeline/audio/kit';
import { arrange, marks, type FxPlacement } from './arrangement.ts';
import { throughWall } from './levels.ts';

export const TARGET_LUFS = -14;
export const CEILING_DBTP = -1.5;
export const AAC_MARGIN_DB = 2.0;
/** the hall's and the echo's return levels */
const HALL_RETURN = 0.45;
const ECHO_RETURN = 0.4;
/** QA's thresholds (packages/pipeline/src/qa/audio.ts): a silence at most -60 dB RMS, a rest's loudest 3 s at least 20 dB under the mix, a hit's onset within ±1 frame */
const SILENCE_MAX_DB = -60;
const REST_UNDER_DB = 20;
const HIT_SEARCH_MS = 120;

/** How far each kind of UI sound sits under the bed (the dry music, Workers and pad within ±0.5 s): its loudest 400 ms against the bed's mean power. */
function underBed(mx: Mixer, fx: readonly FxPlacement[], fps: number): string[] {
  const bed = ['music', 'workers', 'pad'].map((b) => mx.bus(b));
  const by = new Map<string, number[]>();
  const at = new Map<string, number[]>();
  for (const f of fx) {
    const a = Math.max(0, f.at - SR / 2);
    const b = Math.min(mx.n, f.at + SR / 2);
    let e = 0;
    for (let i = a; i < b; i++) {
      let l = 0;
      let r = 0;
      for (const x of bed) {
        l += x.l[i];
        r += x.r[i];
      }
      e += (l * l + r * r) / 2;
    }
    if (!(e > 0) || !(f.power > 0)) continue;
    by.set(f.part, [...(by.get(f.part) ?? []), 10 * Math.log10(e / (b - a) / f.power)]);
    at.set(f.part, [...(at.get(f.part) ?? []), f.at]);
  }
  return [...by.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([part, us]) => {
      const s = [...us].sort((x, y) => x - y);
      // where a sound comes within 10 dB of the bed: the three closest, in film frames
      const near = us
        .map((u, k) => [u, at.get(part)![k]] as const)
        .filter(([u]) => u < 10)
        .sort((x, y) => x[0] - y[0])
        .slice(0, 3)
        .map(([u, t]) => `f${Math.round((t * fps) / SR)} (${u.toFixed(1)})`);
      return `foley ${part.padEnd(12)} ${String(s.length).padStart(3)} placed, ${s[0].toFixed(1)} to ${s[s.length - 1].toFixed(1)} dB under the bed (median ${s[Math.floor(s.length / 2)].toFixed(1)})${near.length ? `; closest ${near.join(', ')}` : ''}`;
    });
}

const toDb = (ms: number) => (ms > 0 ? 10 * Math.log10(ms) : -Infinity);
const fmt = (db: number) => (Number.isFinite(db) ? `${db.toFixed(1)} dB` : '-inf dB');

/**
 * The rests, silences and hits as `aiv qa` measures them (packages/pipeline/src/qa/audio.ts
 * audioCueChecks), on the master's output: power is the mean of the channels' squares; the mix's
 * level is gated like BS.1770 but unweighted; a span drops one frame at each edge.
 */
function qaLines(T: Timeline, l: Float32Array, r: Float32Array): string[] {
  const pw = (i: number) => (l[i] * l[i] + r[i] * r[i]) / 2;
  const seg = SR / 10;
  const segs: number[] = [];
  for (let k = 0; (k + 1) * seg <= l.length; k++) {
    let s = 0;
    for (let i = k * seg; i < (k + 1) * seg; i++) s += pw(i);
    segs.push(s / seg);
  }
  const blocks = segs.slice(3).map((_, k) => (segs[k] + segs[k + 1] + segs[k + 2] + segs[k + 3]) / 4);
  const loud = blocks.filter((p) => p > 1e-7);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const mix = toDb(mean(loud.filter((p) => p > mean(loud) * 0.1)));
  const lines = [`qa: the mix's level ${fmt(mix)} (unweighted, gated)`];
  const fps = T.ctx.fps;
  const frame = (f: number) => T.frame(f);
  for (const e of T.ctx.cues.events) {
    if ((e.kind !== 'rest' && e.kind !== 'silence') || e.end === undefined) continue;
    const [a, b] = e.end - e.frame > 2 ? [frame(e.frame + 1), frame(e.end - 1)] : [frame(e.frame), frame(e.end)];
    if (e.kind === 'silence') {
      let s = 0;
      for (let i = a; i < b; i++) s += pw(i);
      const db = toDb(s / (b - a));
      lines.push(`qa: silence ${e.id.padEnd(18)} ${fmt(db)} RMS (max ${SILENCE_MAX_DB}) ${db <= SILENCE_MAX_DB ? 'ok' : 'FAIL'}`);
    } else {
      const w = Math.min(b - a, 3 * SR);
      const hop = SR / 100;
      const prefix = new Float64Array(b - a + 1);
      for (let i = a; i < b; i++) prefix[i - a + 1] = prefix[i - a] + pw(i);
      let best = 0;
      for (let s = 0; ; s += hop) {
        const start = Math.min(s, b - a - w);
        best = Math.max(best, prefix[start + w] - prefix[start]);
        if (start === b - a - w) break;
      }
      const under = mix - toDb(best / w);
      lines.push(`qa: rest ${e.id.padEnd(21)} loudest ${Math.round(w / SR * 100) / 100} s ${fmt(toDb(best / w))}: ${under.toFixed(1)} dB under the mix (min ${REST_UNDER_DB}) ${under >= REST_UNDER_DB ? 'ok' : 'FAIL'}`);
    }
  }
  // each hit's onset: the 5 ms block with the largest energy rise within ±120 ms (at least 3 dB over the one before)
  const h = SR / 200;
  const misses: string[] = [];
  let hits = 0;
  for (const e of T.ctx.cues.events) {
    if (e.kind !== 'hit') continue;
    hits++;
    const centre = frame(e.frame);
    const reach = Math.floor(((HIT_SEARCH_MS / 1000) * SR) / h);
    const energy = (k: number) => {
      let s = 0;
      for (let i = Math.max(0, centre + k * h); i < Math.min(l.length, centre + (k + 1) * h); i++) s += pw(i);
      return s;
    };
    let prev = energy(-reach - 1);
    let best = 0;
    let bestK: number | null = null;
    for (let k = -reach; k <= reach; k++) {
      const x = energy(k);
      if (x >= 2 * prev && (x - prev) / h > 1e-8 && x - prev > best) {
        best = x - prev;
        bestK = k;
      }
      prev = x;
    }
    const ms = bestK === null ? null : (bestK * h * 1000) / SR;
    if (ms === null || Math.abs(ms) > 1000 / fps + 1e-6) misses.push(`${e.id} (f${e.frame}): ${ms === null ? 'no onset' : `${ms >= 0 ? '+' : ''}${ms.toFixed(1)} ms`}`);
  }
  lines.push(`qa: hits ${hits - misses.length} of ${hits} with an onset within ±1 frame${misses.length ? `; not: ${misses.join(', ')}` : ''}`);
  return lines;
}

/** The mixed (unmastered) film and the mixer's report lines; the mixer's buses are released when it returns. */
function mixFilm(T: Timeline): { l: Float64Array; r: Float64Array; lines: string[] } {
  const m = marks(T);
  // every dry bus stops at the hard cuts and at the cue sheet's silences (T.cuts adds their starts)
  const hard = T.cuts(m.hub, m.question, m.turn);
  const wet = T.cuts(m.hub, m.question, m.turn, m.breath[0], m.rest[0], m.signoff[0], m.tail[0]);
  // the Workers' tails stop at the model rest too: the bays step down into it
  const mx = new Mixer({ n: T.n, buses: { music: hard, workers: T.cuts(m.hub, m.question, m.turn, m.rest[0]), pad: hard, foley: hard }, sends: { hall: wet, echo: wet } });
  const fx = arrange(T, mx);
  throughWall(mx, m);
  const lines = underBed(mx, fx, T.ctx.fps);
  const mixed = mx.mixdown({
    hall: { process: convolver(synthIr({ ...HALL, seed: T.ctx.seed, id: 'super-agent-hall', rt60: 1.9, length: 2.2 })), level: HALL_RETURN },
    echo: { process: (l, r, cuts) => delay(l, r, { time: T.beats(0.75), feedback: 0.33, pingPong: true, damp: 2600, cuts }), level: ECHO_RETURN },
  });
  return { ...mixed, lines: [...lines, ...mx.report().map((p) => `mix: ${p}`)] };
}

export function renderMix(ctx: ScoreContext): { l: Float32Array; r: Float32Array; lines: string[] } {
  const T = timeline(ctx);
  const m = marks(T);
  const mixed = mixFilm(T);
  const out = master(mixed.l, mixed.r, {
    targetLufs: TARGET_LUFS,
    ceilingDb: CEILING_DBTP,
    aacMarginDb: AAC_MARGIN_DB,
    silences: T.silences,
    // the end card's last mallet note fades to nothing over the film's last 2 s (`rest-tail`)
    fadeOut: [m.end - T.s(2), m.end],
  });
  const r = out.report;
  const half = T.beat(44);
  const part = (a: number, b: number) => loudness(out.l.subarray(a, b), out.r.subarray(a, b));
  const one = part(0, half);
  const two = part(half, m.end);
  const lines = [
    `score: bars 1-43 laid (0-${(half / SR).toFixed(2)} s), bars 44-84 laid (to ${(m.end / SR).toFixed(2)} s), ${m.end} samples`,
    `master: ${r.lufs.toFixed(2)} LUFS, LRA ${r.lra.toFixed(1)} LU, true peak ${r.truePeakDb.toFixed(2)} dBTP (limit ${r.limitDb.toFixed(2)}), sample peak ${r.samplePeakDb.toFixed(2)} dBFS, PLR ${(r.truePeakDb - r.lufs).toFixed(1)} dB`,
    `master: gain ${r.gainDb.toFixed(1)} dB, glue max ${r.glueMaxGrDb.toFixed(1)} dB, limiter max ${r.limiterMaxGrDb.toFixed(1)} dB at ${r.limiterMaxAt.toFixed(2)} s (over 3 dB for ${r.limitedOver3.toFixed(2)} s), ${r.iterations} pass(es)`,
    `master: limiter over 3 dB at ${r.limiterEvents.map((e) => `${e.at.toFixed(2)} s (${e.grDb.toFixed(1)})`).join(', ') || 'nowhere'}`,
    `loudness: bars 1-43 alone ${one.i.toFixed(2)} LUFS (LRA ${one.lra.toFixed(1)}, max momentary ${one.maxMomentary.toFixed(1)}); bars 44-84 alone ${two.i.toFixed(2)} LUFS (LRA ${two.lra.toFixed(1)}, max momentary ${two.maxMomentary.toFixed(1)})`,
    ...qaLines(T, out.l, out.r),
    ...mixed.lines,
  ];
  return { l: out.l, r: out.r, lines };
}

const mix = (ctx: ScoreContext): Stereo => {
  const m = renderMix(ctx);
  for (const line of m.lines) console.log(line);
  return [m.l, m.r];
};

export default defineScore({ tracks: { mix } });
