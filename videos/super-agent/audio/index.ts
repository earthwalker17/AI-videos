/**
 * The score of "Who Routes the Agents?" (V2): one stereo track, `mix` (video.json audio.tracks:
 * {"source": "audio:mix"}), built on the shared score kit (@aiv/pipeline/audio/kit).
 *
 *   voices.ts       the film's few voices, from kit primitives
 *   arrangement.ts  what sounds when, on the cue sheet's grid (120 bpm), and the ideas it carries
 *   index.ts        the desk (five buses, a hall, a ping-pong echo), the master and the report
 *
 * The master is the kit's: a 28 Hz high-pass, glue, iterated loudness to -14 LUFS and a
 * look-ahead true-peak limiter at post's ceiling (-1.5 dBTP) less 2.0 dB for the AAC encode (the
 * margin V1 of this film measured). The last bar fades to nothing.
 *
 * Deterministic: float64 state, fixed loop order, noise only from ctx.seed.
 */
import { defineScore, type ScoreContext, type Stereo } from '@aiv/pipeline/audio';
import { Mixer, SR, convolver, delay, hallIr, loudness, master, seedOf, timeline } from '@aiv/pipeline/audio/kit';
import { arrange } from './arrangement.ts';

export const TARGET_LUFS = -14;
const CEILING_DBTP = -1.5;
const AAC_MARGIN_DB = 2.0;

const mix = (ctx: ScoreContext): Stereo => {
  const T = timeline(ctx);
  const cuts = T.cuts();
  const mx = new Mixer({ n: T.n, buses: { drums: cuts, bass: cuts, pad: cuts, lead: cuts, fx: cuts }, sends: { hall: cuts, echo: cuts } });
  const accents = arrange(T, mx, ctx.seed);
  for (const e of ctx.cues.events) {
    if (e.kind === 'hit' && accents.get(e.id) !== T.cue(e.id)) throw new Error(`score: hit '${e.id}' has no sound on its frame`);
  }
  // the kick makes room for itself
  mx.duck('pad', 'drums', { depthDb: 4, thresholdDb: -18, attack: 0.004, release: 0.16 });
  mx.duck('bass', 'drums', { depthDb: 3, thresholdDb: -16, attack: 0.003, release: 0.11 });
  const mixed = mx.mixdown({
    hall: { process: convolver(hallIr(seedOf(ctx.seed, 'hall'))), level: 0.4 },
    echo: { process: (l, r, c) => delay(l, r, { time: T.beats(0.75), feedback: 0.36, pingPong: true, damp: 3200, cuts: c }), level: 0.45 },
  });
  const out = master(mixed.l, mixed.r, { targetLufs: TARGET_LUFS, ceilingDb: CEILING_DBTP, aacMarginDb: AAC_MARGIN_DB, fadeOut: [T.beat(84, 1), T.n] });
  const r = out.report;
  const part = (name: string, fromBar: number, toBar: number): string => {
    const a = T.beat(fromBar);
    const b = Math.min(T.n, T.beat(toBar));
    const p = loudness(out.l.subarray(a, b), out.r.subarray(a, b));
    return `loudness: ${name.padEnd(10)} bars ${fromBar}-${toBar - 1}: ${p.i.toFixed(1)} LUFS (max momentary ${p.maxMomentary.toFixed(1)})`;
  };
  const lines = [
    `master: ${r.lufs.toFixed(2)} LUFS, LRA ${r.lra.toFixed(1)} LU, true peak ${r.truePeakDb.toFixed(2)} dBTP (limit ${r.limitDb.toFixed(2)}), ${(T.n / SR).toFixed(2)} s`,
    `master: gain ${r.gainDb.toFixed(1)} dB, glue max ${r.glueMaxGrDb.toFixed(1)} dB, limiter max ${r.limiterMaxGrDb.toFixed(1)} dB at ${r.limiterMaxAt.toFixed(2)} s (over 3 dB for ${r.limitedOver3.toFixed(2)} s), ${r.iterations} pass(es)`,
    part('flat', 1, 9),
    part('lift', 9, 13),
    part('levels', 13, 25),
    part('question', 25, 27),
    part('answers', 27, 56),
    part('evidence', 56, 67),
    part('status', 67, 71),
    part('close', 71, 76),
    part('recap', 76, 80),
    part('end card', 80, 85),
    ...mx.report(),
  ];
  for (const line of lines) console.log(line);
  return [out.l, out.r];
};

export default defineScore({ tracks: { mix } });
