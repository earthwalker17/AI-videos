/**
 * A feedback delay, plain or ping-pong, with its time in whole samples so it can lock to the bar
 * grid (Timeline.beats(0.5) is an eighth note). It returns only the repeats (the wet signal), to
 * be added at a return level, like a reverb. Like the convolution reverb it respects cuts: the
 * lines are emptied at each cut and the repeats are faded out just before it, so no echo sounds
 * into a silence.
 */
import { SR, TAU, clamp, type StereoClip } from './dsp.ts';

export interface DelayOptions {
  /** the delay time, samples (rounded, at least 1) */
  time: number;
  /** the level of each repeat relative to the one before (0 ≤ feedback < 1) */
  feedback: number;
  /**
   * ping-pong: the input, summed to mono ((l + r) / 2), feeds the left line and the repeats
   * alternate left, right, left…; otherwise each channel repeats in place
   */
  pingPong?: boolean;
  /** a one-pole low-pass in the loop, Hz: every repeat a little darker than the one before (default none) */
  damp?: number;
  /** cut points, samples: nothing that entered before a cut repeats after it */
  cuts?: readonly number[];
  /** the fade before a cut, s (default 30 ms) */
  cutFade?: number;
}

/** The repeats of (l, r): the first `time` samples after the input, then each `time` later, scaled by `feedback`. */
export function delay(l: Float32Array, r: Float32Array, o: DelayOptions): StereoClip {
  const n = l.length;
  const T = Math.max(1, Math.round(o.time));
  const fb = clamp(o.feedback, 0, 0.999);
  const a = o.damp ? Math.exp((-TAU * clamp(o.damp, 1, SR * 0.49)) / SR) : 0;
  const fade = Math.round((o.cutFade ?? 0.03) * SR);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const bounds = [0, ...(o.cuts ?? []).filter((c) => c > 0 && c < n), n].sort((x, y) => x - y);
  const lineL = new Float64Array(T);
  const lineR = new Float64Array(T);
  for (let s = 0; s + 1 < bounds.length; s++) {
    const from = bounds[s];
    const to = bounds[s + 1];
    if (to <= from) continue;
    lineL.fill(0);
    lineR.fill(0);
    let k = 0;
    let lpL = 0;
    let lpR = 0;
    for (let i = from; i < to; i++) {
      const yl = lineL[k];
      const yr = lineR[k];
      // the loop's low-pass acts on what is fed back, so the first repeat is the input itself
      lpL = (1 - a) * yl + a * lpL;
      lpR = (1 - a) * yr + a * lpR;
      if (o.pingPong) {
        lineL[k] = (l[i] + r[i]) / 2 + fb * lpR;
        lineR[k] = fb * lpL;
      } else {
        lineL[k] = l[i] + fb * lpL;
        lineR[k] = r[i] + fb * lpR;
      }
      outL[i] = yl;
      outR[i] = yr;
      if (++k === T) k = 0;
    }
    // the last segment runs to the end of the film: nothing to cut there
    if (to < n) {
      const f = Math.min(fade, to - from);
      for (let j = 0; j < f; j++) {
        const g = 0.5 - 0.5 * Math.cos((Math.PI * j) / f);
        outL[to - 1 - j] *= g;
        outR[to - 1 - j] *= g;
      }
    }
  }
  return { l: outL, r: outR };
}
