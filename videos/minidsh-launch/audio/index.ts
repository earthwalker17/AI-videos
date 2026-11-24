/**
 * The score of "MiniDSH 2.0: One Runtime, Every Surface": one stereo track, `mix` (video.json
 * audio.tracks: {"source": "audio:mix"}), an original score and its sound design, synthesised
 * from code on the shared score kit (@aiv/pipeline/audio/kit). No samples.
 *
 *   voices.ts       the film's voices and sound effects, from kit primitives
 *   arrangement.ts  what sounds when, on the cue sheet's grid (120 bpm, 42 bars), each hit on its frame
 *   measure.ts      what QA will measure (the rests, the hits' onsets), measured here on every build
 *   index.ts        the desk, the quit's muffle, the ducking, the master and the report
 *
 * The desk: eight buses (kick, drums, bass, pad, keys, bell, air for the music; fx for the sound
 * design), a hall and a ping-pong echo for the music and a small room for the sound design. The
 * music ducks 2.5 dB under the sound design (its sends too, so its reverb steps back with it),
 * the pad and the bass a little under the kick. The kick and bass buses are soft-clipped; the
 * rest of the kit (ticks, shaker, rim, clap) has its own clean bus, so the kick's spikes do not
 * squeeze it. Every music bus and send stops for the beat after the refusal; every bus and send
 * stops at each rest, and the mix falls away over the 280 ms before the first (after Allow
 * once), so that rest arrives as a decay, not a gate. The quit muffles the kick, drum, bass, pad
 * and keys buses and the hall and echo returns (arrangement.ts, muffler); the bells and the sound
 * design stay clear.
 *
 * The mix bus is tilted (2 dB less under 110 Hz, 3 dB more over 3.5 kHz), for laptop speakers.
 * The master is the kit's: a 28 Hz high-pass, glue, iterated loudness to -14 LUFS and a
 * look-ahead true-peak limiter at -1.5 dBTP less 2.0 dB for the AAC encode (the margin film #4
 * measured: knowledge/loudness-two-pass.md). It fades the close out from bar 41 to the last rest,
 * which it leaves as digital zero.
 *
 * Deterministic: float64 state, fixed loop order, noise only from ctx.seed.
 */
import { defineScore, type ScoreContext, type Stereo } from '@aiv/pipeline/audio';
import { Biquad, HALL, Mixer, ROOM, SR, convolver, dbToGain, delay, loudness, master, seedOf, synthIr, timeline, type StereoClip } from '@aiv/pipeline/audio/kit';
import { ACTS, actSpan, type Act } from '../src/cues.ts';
import { BUILD_BARS, arrange, hitId, muffler } from './arrangement.ts';
import { energy, highBandPower, integratedLevelDb, loudestWindowDb, onsetMs, powerOf } from './measure.ts';

export const TARGET_LUFS = -14;
const CEILING_DBTP = -1.5;
const AAC_MARGIN_DB = 2.0;
/** how far under the mix a rest must stay (QA's REST_UNDER_DB) */
const REST_UNDER_DB = 20;

const MUSIC = ['kick', 'drums', 'bass', 'pad', 'keys', 'bell', 'air'] as const;
/** what the quit muffles: the band (the bells and the sound design stay clear) */
const MUFFLED = ['kick', 'drums', 'bass', 'pad', 'keys'] as const;
/** how long the mix takes to fall away into the rest after Allow once, s */
const INTO_REST_S = 0.28;

const db = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '-inf');

/**
 * A bus's soft clip: t·tanh(x/t), the threshold t in dBFS (before the master). It rounds the
 * kick's and the bass's first spikes by a few dB and leaves their bodies, so the master's
 * limiter does not have to (and pump the whole mix as it does).
 */
function saturate(b: StereoClip, thresholdDb: number): void {
  const t = dbToGain(thresholdDb);
  for (const ch of [b.l, b.r]) for (let i = 0; i < ch.length; i++) ch[i] = t * Math.tanh(ch[i] / t);
}

/**
 * A fade to nothing over the `len` samples before `at` (a half cosine, the master's fade-out
 * shape), so what still rings there (the reverb and the echo, the bells' tails) dies away into a
 * rest instead of being cut at its start.
 */
function fadeInto(m: { l: Float64Array; r: Float64Array }, at: number, len: number): void {
  for (let i = Math.max(0, at - len); i < at; i++) {
    const g = 0.5 + 0.5 * Math.cos((Math.PI * (i - (at - len))) / len);
    m.l[i] *= g;
    m.r[i] *= g;
  }
}

const mix = (ctx: ScoreContext): Stereo => {
  const T = timeline(ctx);
  const restAllow = T.span('rest-allow');
  const restEnd = T.span('rest-end');
  const musicCuts = T.cuts(T.cue('hit-refused'), restAllow[0], restEnd[0]);
  const sfxCuts = T.cuts(restAllow[0], restEnd[0]);
  const mx = new Mixer({
    n: T.n,
    buses: { kick: musicCuts, drums: musicCuts, bass: musicCuts, pad: musicCuts, keys: musicCuts, bell: musicCuts, air: musicCuts, fx: sfxCuts },
    sends: { hall: musicCuts, echo: musicCuts, room: sfxCuts },
  });
  const a = arrange(T, mx, ctx.seed);
  for (const e of ctx.cues.events) {
    if (e.kind === 'hit' && a.accents.get(e.id) !== T.cue(e.id)) throw new Error(`score: hit '${e.id}' has no sound on its frame`);
  }
  // the kick alone is soft-clipped: the ticks, the shaker, the rim and the clap stay clean
  saturate(mx.bus('kick'), -19);
  saturate(mx.bus('bass'), -18);
  const muffle = muffler(T);
  for (const b of MUFFLED) muffle(mx.bus(b));
  // the music steps back under the sound design; the pad and the bass make room for the kick
  for (const b of [...MUSIC, 'hall', 'echo']) mx.duck(b, 'fx', { depthDb: 2.5, thresholdDb: -32, attack: 0.004, release: 0.22 });
  mx.duck('pad', 'kick', { depthDb: 2, thresholdDb: -24, attack: 0.005, release: 0.15 });
  mx.duck('bass', 'kick', { depthDb: 1.5, thresholdDb: -22, attack: 0.003, release: 0.1 });
  const hall = convolver(synthIr({ ...HALL, seed: seedOf(ctx.seed, 'hall'), rt60: 2.0, length: 2.3 }));
  const room = convolver(synthIr({ ...ROOM, seed: seedOf(ctx.seed, 'room') }));
  const mixed = mx.mixdown({
    hall: { process: (l, r, c) => muffle(hall(l, r, c)), level: 0.3 },
    echo: { process: (l, r, c) => muffle(delay(l, r, { time: T.beats(0.75), feedback: 0.3, pingPong: true, damp: 3400, cuts: c })), level: 0.38 },
    room: { process: room, level: 0.3 },
  });
  fadeInto(mixed, restAllow[0], T.s(INTO_REST_S));
  // a gentle tilt on the mix bus: less weight a laptop cannot play, more of the presence it can
  for (const ch of [mixed.l, mixed.r]) {
    new Biquad('lowshelf', 110, Math.SQRT1_2, -2).run(ch);
    new Biquad('highshelf', 3500, Math.SQRT1_2, 3).run(ch);
  }
  const out = master(mixed.l, mixed.r, {
    targetLufs: TARGET_LUFS,
    ceilingDb: CEILING_DBTP,
    aacMarginDb: AAC_MARGIN_DB,
    fadeOut: [T.beat(41, 1), restEnd[0]],
    silences: [[restEnd[0], T.n]],
  });

  // ── the report ────────────────────────────────────────────────────────────────────────────
  const r = out.report;
  const lines = [
    `master: ${r.lufs.toFixed(2)} LUFS, LRA ${r.lra.toFixed(1)} LU, true peak ${r.truePeakDb.toFixed(2)} dBTP (limit ${r.limitDb.toFixed(2)}), sample peak ${r.samplePeakDb.toFixed(2)} dBFS, ${(T.n / SR).toFixed(2)} s`,
    `master: gain ${r.gainDb.toFixed(1)} dB, glue max ${r.glueMaxGrDb.toFixed(1)} dB, limiter max ${r.limiterMaxGrDb.toFixed(1)} dB at ${r.limiterMaxAt.toFixed(2)} s (over 3 dB for ${r.limitedOver3.toFixed(2)} s), ${r.iterations} pass(es)`,
    `master: limited over 3 dB at ${r.limiterEvents.length ? r.limiterEvents.map((e) => `${e.at.toFixed(2)} s (${e.grDb.toFixed(1)} dB)`).join(', ') : 'no point'}`,
  ];
  for (const act of Object.keys(ACTS) as Act[]) {
    const [f0, f1] = actSpan(act);
    const s0 = T.frame(f0);
    const s1 = Math.min(T.n, T.frame(f1));
    const p = loudness(out.l.subarray(s0, s1), out.r.subarray(s0, s1));
    const [b0, b1] = [T.position(s0).bar, T.position(s1).bar - 1];
    lines.push(`loudness: ${act.padEnd(10)} bars ${b0}-${b1}: ${db(p.i)} LUFS (max momentary ${db(p.maxMomentary)})`);
  }
  // the runtime is a build and the light its peak: each step louder than the last, and the
  // light's first second the loudest moment of the film (outside the lit bars, 33-34)
  const span = (a: number, b: number) => loudness(out.l.subarray(a, b), out.r.subarray(a, b));
  const steps = BUILD_BARS.slice(0, -1).map((b, k) => ({ bars: `${b}-${BUILD_BARS[k + 1]! - 1}`, i: span(T.beat(b, 1), T.beat(BUILD_BARS[k + 1]!, 1)).i }));
  const rising = steps.every((x, k) => k === 0 || x.i > steps[k - 1]!.i);
  lines.push(`build: ${steps.map((x) => `bars ${x.bars} ${db(x.i)}`).join(', ')} LUFS: ${rising ? 'rising' : 'NOT RISING'}`);
  const lit = T.cue(hitId('lit'));
  const litM = span(lit, lit + T.s(1)).maxMomentary;
  const before = span(0, lit - T.s(0.05)).maxMomentary;
  const after = span(T.beat(BUILD_BARS.at(-1)!, 1), T.n).maxMomentary;
  const rest = Math.max(before, after);
  lines.push(`peak: the light ${db(litM)} LUFS max momentary; before it at most ${db(before)}, after the lit bars ${db(after)}: ${litM > rest ? `pass, ${(litM - rest).toFixed(1)} LU clear` : 'FAIL'}`);
  lines.push(...mx.report());
  for (const w of a.warnings) lines.push(`arrangement: ${w}`);

  // what QA will measure on the delivery, measured on the master
  const P = powerOf(out.l, out.r);
  const HB = highBandPower(out.l, out.r);
  const mixLevel = integratedLevelDb(P);
  lines.push(`qa mirror: mix level ${mixLevel === null ? 'silent' : `${mixLevel.toFixed(1)} dB`} (unweighted, gated)`);
  for (const e of ctx.cues.events) {
    if (e.kind !== 'rest' || e.end === undefined) continue;
    // one frame off each edge, as QA measures
    const [f0, f1] = e.end - e.frame > 2 ? [e.frame + 1, e.end - 1] : [e.frame, e.end];
    const lvl = loudestWindowDb(P, T.frame(f0), T.frame(f1));
    const under = mixLevel === null ? Infinity : mixLevel - lvl;
    lines.push(
      `qa mirror: rest ${e.id} ${(e.frame / ctx.fps).toFixed(2)}-${(e.end / ctx.fps).toFixed(2)} s: ${db(lvl)} dB, ${Number.isFinite(under) ? `${under.toFixed(1)} dB` : 'silent,'} under the mix (min ${REST_UNDER_DB}): ${under >= REST_UNDER_DB ? 'pass' : 'FAIL'}`,
    );
  }
  const frameMs = 1000 / ctx.fps;
  const E = energy(P);
  const EH = energy(HB);
  const fmt = (ms: number | null): string => (ms === null ? 'none' : `${ms >= 0 ? '+' : ''}${ms.toFixed(1)} ms${Math.abs(ms) <= frameMs + 1e-6 ? '' : ' OFF'}`);
  for (const h of a.hits) {
    const qa = onsetMs(E, h.at);
    const high = onsetMs(EH, h.at);
    // how far the hit stands out: its first 100 ms against the 280 ms before it
    const rise = 10 * Math.log10(E(h.at, h.at + T.s(0.1)) / T.s(0.1) / Math.max(1e-12, E(h.at - T.s(0.3), h.at - T.s(0.02)) / T.s(0.28)));
    const pos = T.position(h.at);
    lines.push(`hit ${h.id.padEnd(16)} bar ${pos.bar} beat ${Number(pos.beat.toFixed(3))} (${(h.at / SR).toFixed(3)} s): onset ${fmt(qa)} (qa), ${fmt(high)} (high band); +${rise.toFixed(1)} dB over the 0.3 s before: ${h.what}`);
  }
  for (const line of lines) console.log(line);
  return [out.l, out.r];
};

export default defineScore({ tracks: { mix } });
