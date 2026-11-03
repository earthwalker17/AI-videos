/**
 * The score of "A Halloween Gift": one stereo track, `mix` (video.json: {"source": "audio:mix"}).
 *
 *   timeline.ts  cue sheet → samples, the cuts and digital silences
 *   music.ts     the cue: an original D-minor waltz (sampled VSCO 2 CE strings, brass and
 *                percussion; synthesised celesta, music box, theremins, ghost choir, pads)
 *   foley.ts     the effects on their cues (all synthesised: sfx.ts)
 *   mixer.ts     buses, sends, cut-aware placement   reverb.ts + fft.ts  hall and room
 *   master.ts    28 Hz high-pass, glue, -14 LUFS, true-peak limiter, the silences forced to 0.0
 *
 * Deterministic: float64 state, fixed loop order, randomness from @aiv/core's hash only.
 */
import { defineScore, type ScoreContext, type Stereo } from '@aiv/pipeline/audio';
import { SR } from './dsp.ts';
import { convolveInto, prepareIr } from './fft.ts';
import { foley } from './foley.ts';
import { master } from './master.ts';
import { Mixer } from './mixer.ts';
import { music } from './music.ts';
import { hallIr, roomIr } from './reverb.ts';
import { timeline } from './timeline.ts';

/** delivery loudness and this meter's true-peak ceiling (ffmpeg's meter reads a little higher) */
export const TARGET_LUFS = -14;
export const CEILING_DBTP = -2.6;
/** hall and room return levels */
const HALL = 0.5;
const ROOM = 0.6;
/** a reverb tail is faded over this long before each cut */
const TAIL_FADE = Math.round(0.03 * SR);

export function renderMix(ctx: ScoreContext): { l: Float32Array; r: Float32Array; lines: string[] } {
  const T = timeline(ctx);
  const n = T.n;
  const mx = new Mixer(n, { music: T.cuts.music, sfx: T.cuts.sfx });
  music(T, mx);
  foley(T, mx);

  const L = new Float64Array(n);
  const R = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = mx.music.l[i] + mx.sfx.l[i];
    R[i] = mx.music.r[i] + mx.sfx.r[i];
  }
  const wl = new Float32Array(n);
  const wr = new Float32Array(n);
  convolveInto(mx.hall.l, mx.hall.r, prepareIr(hallIr(ctx.seed)), wl, wr, T.cuts.hall, TAIL_FADE);
  for (let i = 0; i < n; i++) {
    L[i] += HALL * wl[i];
    R[i] += HALL * wr[i];
  }
  wl.fill(0);
  wr.fill(0);
  convolveInto(mx.room.l, mx.room.r, prepareIr(roomIr(ctx.seed)), wl, wr, T.cuts.room, TAIL_FADE);
  for (let i = 0; i < n; i++) {
    L[i] += ROOM * wl[i];
    R[i] += ROOM * wr[i];
  }
  const parts = mx.report();

  const tail = T.silences[T.silences.length - 1];
  const out = master(L, R, {
    targetLufs: TARGET_LUFS,
    ceilingDb: CEILING_DBTP,
    silences: T.silences,
    fadeOut: [tail[0] - T.s(1.0), tail[0]],
  });
  const r = out.report;
  const lines = [
    `master: ${r.lufs.toFixed(2)} LUFS, LRA ${r.lra.toFixed(1)} LU, true peak ${r.truePeakDb.toFixed(2)} dBTP, sample peak ${r.samplePeakDb.toFixed(2)} dBFS, PLR ${(r.truePeakDb - r.lufs).toFixed(1)} dB`,
    `master: gain ${r.gainDb.toFixed(1)} dB, glue max ${r.glueMaxGrDb.toFixed(1)} dB, limiter max ${r.limiterMaxGrDb.toFixed(1)} dB at ${r.limiterMaxAt.toFixed(2)} s (over 3 dB for ${r.limitedOver3.toFixed(2)} s, over 6 dB for ${r.limitedOver6.toFixed(2)} s), ${r.iterations} pass(es)`,
    `master: limiter over 3 dB at ${r.limiterEvents.map((e) => `${e.at.toFixed(2)} s (${e.grDb.toFixed(1)} dB)`).join(', ') || 'nowhere'}`,
    ...parts.map((p) => `part: ${p}`),
  ];
  return { l: out.l, r: out.r, lines };
}

const mix = (ctx: ScoreContext): Stereo => {
  const m = renderMix(ctx);
  for (const line of m.lines) console.log(line);
  return [m.l, m.r];
};

export default defineScore({ tracks: { mix } });
