/**
 * The score of "Who Routes the Agents?": one stereo track, `mix` (video.json audio.tracks:
 * {"source": "audio:mix"}), built on the shared score kit (@aiv/pipeline/audio/kit).
 *
 * THIS IS THE SCORE SKETCH (session 2), for the user to listen to. It scores bars 1-27 of the
 * film (0:00-1:12): the hook, the switchboard, the two easy fixes, the turn and the first rest.
 * After the bar-27 rest the pad decays to silence within bar 28, and from bar 29 (f2240, 1:14.7)
 * to the film's end the track is digital silence. The full score comes in session 3.
 *
 *   arrangement.ts  bars 1-27 on the cue sheet's grid (ctx.cues through the kit's timeline)
 *   instruments.ts  the film's voices, built from kit primitives
 *   foley.ts        the soft UI sounds (paper and ink)
 *   index.ts        the desk: four buses, a hall and a ping-pong echo, the master
 *
 * Hard cuts (every clip that started before one stops there, reverb and echo included): the hub
 * (bar 10, the hops stop dead), bar 10 beat 4 (the beat of silence, also forced to digital zero
 * by the master), bar 16 (the split stops and the Dsus2 hangs alone) and the turn (bar 17). On
 * the hall and the echo only, also the bar-27 rest: their tails of bar 26 stop there, so the
 * rest is the quiet pad, two plucks and their own reverb (QA wants a rest 20 dB under the mix).
 *
 * The master is the kit's (28 Hz high-pass, glue, iterated loudness, look-ahead true-peak
 * limiter): -14 LUFS integrated, the limiter at post's loudnorm ceiling (-1.5 dBTP) less the
 * kit's AAC margin (1.1 dB), so -2.6 dBTP here and the AAC delivery stays under qa's -1 dBTP.
 *
 * Deterministic: float64 state, fixed loop order, randomness only from ctx.seed (@aiv/core).
 */
import { defineScore, type ScoreContext, type Stereo } from '@aiv/pipeline/audio';
import { HALL, Mixer, SR, convolver, delay, master, synthIr, timeline } from '@aiv/pipeline/audio/kit';
import { arrange, marks, type FxPlacement } from './arrangement.ts';

export const TARGET_LUFS = -14;
export const CEILING_DBTP = -1.5;
export const AAC_MARGIN_DB = 1.1;
/** the hall's and the echo's return levels */
const HALL_RETURN = 0.45;
const ECHO_RETURN = 0.4;

/** How far each kind of UI sound sits under the bed (the dry music, Workers and pad within ±0.5 s): its loudest 400 ms against the bed's mean power. */
function underBed(mx: Mixer, fx: readonly FxPlacement[]): string[] {
  const bed = ['music', 'workers', 'pad'].map((b) => mx.bus(b));
  const by = new Map<string, number[]>();
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
  }
  return [...by.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([part, us]) => {
      const s = [...us].sort((x, y) => x - y);
      return `foley ${part.padEnd(12)} ${String(s.length).padStart(3)} placed, ${s[0].toFixed(1)} to ${s[s.length - 1].toFixed(1)} dB under the bed (median ${s[Math.floor(s.length / 2)].toFixed(1)})`;
    });
}

export function renderMix(ctx: ScoreContext): { l: Float32Array; r: Float32Array; lines: string[] } {
  const T = timeline(ctx);
  const m = marks(T);
  // the sketch is mixed and mastered over bars 1-28; the rest of the film is silence
  const n = m.end;
  if (n > T.n) throw new Error(`the sketch runs to sample ${n}, past the film's end (${T.n})`);
  // every dry bus stops at the hard cuts (and at any silence the cue sheet declares in the sketch)
  const hard = T.cuts(m.hub, m.hush, m.question, m.turn).filter((c) => c < n);
  const wet = [...hard, m.rest[0]];
  const mx = new Mixer({ n, buses: { music: hard, workers: hard, pad: hard, foley: hard }, sends: { hall: wet, echo: wet } });
  const fx = arrange(T, mx);
  const bedLines = underBed(mx, fx);
  const mixed = mx.mixdown({
    hall: { process: convolver(synthIr({ ...HALL, seed: ctx.seed, id: 'super-agent-hall', rt60: 1.9, length: 2.2 })), level: HALL_RETURN },
    echo: { process: (l, r, cuts) => delay(l, r, { time: T.beats(0.75), feedback: 0.33, pingPong: true, damp: 2600, cuts }), level: ECHO_RETURN },
  });
  const out = master(mixed.l, mixed.r, {
    targetLufs: TARGET_LUFS,
    ceilingDb: CEILING_DBTP,
    aacMarginDb: AAC_MARGIN_DB,
    silences: [[m.hush, m.split], ...T.silences],
    // bar 28's last two beats fade to nothing: no reverb tail reaches the end of the sketch
    fadeOut: [m.rest[1] + T.beats(2), n],
  });
  const L = new Float32Array(T.n);
  const R = new Float32Array(T.n);
  L.set(out.l);
  R.set(out.r);
  const r = out.report;
  const lines = [
    `sketch: bars 1-27 and the bar-28 decay (0-${(n / SR).toFixed(2)} s), then digital silence to ${(T.n / SR).toFixed(2)} s`,
    `master: ${r.lufs.toFixed(2)} LUFS, LRA ${r.lra.toFixed(1)} LU, true peak ${r.truePeakDb.toFixed(2)} dBTP (limit ${r.limitDb.toFixed(2)}), sample peak ${r.samplePeakDb.toFixed(2)} dBFS, PLR ${(r.truePeakDb - r.lufs).toFixed(1)} dB`,
    `master: gain ${r.gainDb.toFixed(1)} dB, glue max ${r.glueMaxGrDb.toFixed(1)} dB, limiter max ${r.limiterMaxGrDb.toFixed(1)} dB at ${r.limiterMaxAt.toFixed(2)} s (over 3 dB for ${r.limitedOver3.toFixed(2)} s), ${r.iterations} pass(es)`,
    ...bedLines,
    ...mx.report().map((p) => `mix: ${p}`),
  ];
  return { l: L, r: R, lines };
}

const mix = (ctx: ScoreContext): Stereo => {
  const m = renderMix(ctx);
  for (const line of m.lines) console.log(line);
  return [m.l, m.r];
};

export default defineScore({ tracks: { mix } });
