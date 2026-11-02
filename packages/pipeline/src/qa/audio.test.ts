// Audio QA on synthetic signals (as per-sample power) and cue sheets: the thresholds and the frame arithmetic, pinned.
import { CueSheet, type CueEvent, type QaCheck } from '@aiv/core';
import { describe, expect, it } from 'vitest';
import {
  allowedSpans,
  audioCueChecks,
  clippingCheck,
  cueSheetMisfit,
  deliveryCues,
  findOnset,
  integratedLevelDb,
  intentQaChecks,
  listeningPoints,
  loudestWindowDb,
  mergeSpans,
  rmsDb,
  shiftSpans,
} from './audio.ts';

const SR = 48_000;
const FPS = 24;

const sheet = (events: CueEvent[], o: { leaderFrames?: number; filmFrames?: number } = {}) =>
  CueSheet.parse({ schemaVersion: 1, fps: FPS, filmFrames: o.filmFrames ?? 240, leaderFrames: o.leaderFrames ?? 0, events });

/** The per-sample power (what decodePower yields) of a mono signal of `seconds`, built per sample from f(t). */
function power(seconds: number, f: (t: number, i: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = f(i / SR, i) ** 2;
  return out;
}

/** A deterministic noise in [-1, 1] (LCG), so the tests need no randomness. */
function noise(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

const sine = (amp: number, hz = 440) => (t: number) => amp * Math.sin(2 * Math.PI * hz * t);
const byId = (cs: QaCheck[], id: string) => cs.find((c) => c.id === id)!;

describe('cue frames on a delivery', () => {
  const events: CueEvent[] = [
    { id: 'knock', kind: 'hit', frame: 10 },
    { id: 'hush', kind: 'silence', frame: 20, end: 40 },
    { id: 'dark', kind: 'black', frame: 100, end: 130 },
    { id: 'still', kind: 'hold', frame: 128, end: 160 },
  ];

  it('adds the leader and subtracts where a partial render starts', () => {
    // a 48-frame leader: film frame 10 is composition frame 58
    const full = deliveryCues(sheet(events, { leaderFrames: 48 }), 288);
    expect(full.map((c) => [c.id, c.frame, c.end])).toEqual([
      ['knock', 58, undefined],
      ['hush', 68, 88],
      ['dark', 148, 178],
      ['still', 176, 208],
    ]);
    expect(full[0].filmFrame).toBe(10);
    // a partial render of composition frames [70, 190): the hit is outside, spans are clipped
    const part = deliveryCues(sheet(events, { leaderFrames: 48 }), 120, 70);
    expect(part.map((c) => [c.id, c.frame, c.end])).toEqual([
      ['hush', 0, 18],
      ['dark', 78, 108],
      ['still', 106, 120],
    ]);
  });

  it('shifts video.json spans by the partial start, clips them and merges black and hold cues in', () => {
    expect(shiftSpans([[0, 30], [60, 90]], 50, 100)).toEqual([[10, 40]]);
    expect(mergeSpans([[50, 60], [0, 10], [10, 20], [15, 18]])).toEqual([[0, 20], [50, 60]]);
    const cues = deliveryCues(sheet(events, { leaderFrames: 48 }), 288);
    const allowed = allowedSpans({ allowBlack: [[0, 48]], allowFreeze: [[0, 48]], cues, startFrame: 0, frames: 288 });
    // black cues allow black and freeze (a black picture is still); hold cues freeze only
    expect(allowed.black).toEqual([[0, 48], [148, 178]]);
    expect(allowed.freeze).toEqual([[0, 48], [148, 208]]);
    // the same video.json spans on a partial render that starts at composition frame 40
    expect(allowedSpans({ allowBlack: [[0, 48]], cues: [], startFrame: 40, frames: 100 }).black).toEqual([[0, 8]]);
  });

  it('refuses a cue sheet made for another fps or length', () => {
    const s = sheet([], { leaderFrames: 48, filmFrames: 240 });
    expect(cueSheetMisfit(s, { fps: FPS, composition: { durationFrames: 288 } })).toBeNull();
    expect(cueSheetMisfit(s, { fps: 30, composition: { durationFrames: 288 } })).toMatch(/24 fps/);
    expect(cueSheetMisfit(s, { fps: FPS, composition: { durationFrames: 240 } })).toMatch(/48 leader \+ 240 film = 288/);
  });
});

describe('levels', () => {
  it('measures RMS in dB (full-scale sine -3 dB) and the gated mix level', () => {
    expect(rmsDb(power(1, sine(1)))).toBeCloseTo(-3.01, 1);
    expect(rmsDb(power(1, sine(0.1)))).toBeCloseTo(-23.01, 1);
    expect(rmsDb(new Float32Array(100))).toBe(-Infinity);
    // half tone, half silence: the gate ignores the silent half
    const half = power(4, (t) => (t < 2 ? sine(0.1)(t) : 0));
    expect(integratedLevelDb(half, SR)).toBeCloseTo(-23.01, 0);
    expect(integratedLevelDb(new Float32Array(SR), SR)).toBeNull();
  });

  it('finds the loudest 3 s of a long span', () => {
    const x = power(8, (t) => (t >= 5 && t < 6 ? sine(0.5)(t) : sine(0.01)(t)));
    // 1 s at -9 dB inside a 3 s window of -43 dB: power mean ≈ -13.8 dB
    expect(loudestWindowDb(x, SR, 0, x.length)).toBeCloseTo(-13.8, 0);
    expect(loudestWindowDb(x, SR, 0, 2 * SR)).toBeCloseTo(-43, 0);
  });
});

describe('cue checks on synthetic signals', () => {
  const at = (frame: number) => frame / FPS;
  const run = (x: Float32Array, events: CueEvent[]) => audioCueChecks(x, deliveryCues(sheet(events), Math.round((x.length / SR) * FPS)), { fps: FPS, sampleRate: SR });

  it('silence: passes a -70 dB floor, ignores a loud edge frame, fails a -40 dB tone', () => {
    const n = noise(7);
    // music until frame 48, a -70 dB noise floor to frame 96, music again
    const floor = 10 ** (-70 / 20) * Math.sqrt(3);
    const x = power(6, (t) => (t >= at(48) && t < at(96) ? floor * n() : sine(0.3)(t)));
    // the span starts one frame early, on the music's last frame: the edge is not judged
    const ok = byId(run(x, [{ id: 'gap', kind: 'silence', frame: 47, end: 96 }]), 'audio.silence.gap');
    expect(ok.passed).toBe(true);
    expect(ok.detail).toMatch(/-70\.\d dB RMS/);
    // two frames into the music: that is not an edge any more
    expect(byId(run(x, [{ id: 'gap', kind: 'silence', frame: 46, end: 96 }]), 'audio.silence.gap').passed).toBe(false);
    const hum = power(6, (t) => (t >= at(48) && t < at(96) ? sine(0.01 * Math.SQRT2)(t) : sine(0.3)(t)));
    const bad = byId(run(hum, [{ id: 'gap', kind: 'silence', frame: 48, end: 96 }]), 'audio.silence.gap');
    expect(bad.passed).toBe(false);
    expect(bad.detail).toMatch(/-40\.\d dB RMS \(max -60 dB\)/);
  });

  it('rest: at least 20 dB under the mix', () => {
    // mix at -13.5 dB (0.3 sine); a rest at -38.5 dB passes (25 dB under), one at -28.5 fails (15 dB)
    const quiet = power(10, (t) => (t >= 4 && t < 7 ? sine(0.0168)(t) : sine(0.3)(t)));
    const loud = power(10, (t) => (t >= 4 && t < 7 ? sine(0.053)(t) : sine(0.3)(t)));
    const rest: CueEvent = { id: 'lull', kind: 'rest', frame: 4 * FPS, end: 7 * FPS };
    const ok = byId(run(quiet, [rest]), 'audio.rest.lull');
    expect(ok.passed).toBe(true);
    expect(ok.detail).toMatch(/2[45]\.\d dB under/);
    expect(byId(run(loud, [rest]), 'audio.rest.lull').passed).toBe(false);
  });

  it('hit: reports the onset offset (info), within ±1 frame or not', () => {
    // a 1 kHz burst 10 ms after frame 48, over a quiet bed
    const burst = (start: number) => (t: number) => (t >= start && t < start + 0.05 ? sine(0.8, 1000)(t) : sine(0.01)(t));
    const near = byId(run(power(4, burst(at(48) + 0.01)), [{ id: 'knock', kind: 'hit', frame: 48 }]), 'audio.hit.knock');
    expect(near.info).toBe(true);
    expect(near.passed).toBe(true);
    expect((near.value as { offsetMs: number }).offsetMs).toBeGreaterThanOrEqual(7.5);
    expect((near.value as { offsetMs: number }).offsetMs).toBeLessThanOrEqual(12.5);
    expect(near.detail).toMatch(/within ±1 frame, 41\.7 ms/);
    // 80 ms late: found, but two frames off
    const late = byId(run(power(4, burst(at(48) + 0.08)), [{ id: 'knock', kind: 'hit', frame: 48 }]), 'audio.hit.knock');
    expect(late.passed).toBe(false);
    expect(late.info).toBe(true);
    expect(late.detail).toMatch(/onset \+(7[5-9]|8[0-5])\.\d ms \(NOT within/);
    // nothing there
    expect(findOnset(power(2, () => 0), SR, 1)).toBeNull();
    expect(byId(run(power(4, sine(0.2)), [{ id: 'knock', kind: 'hit', frame: 48 }]), 'audio.hit.knock').detail).toMatch(/no onset within ±120 ms/);
  });
});

describe('listening, intent and clipping', () => {
  it('lists where to listen, in time order', () => {
    const cues = deliveryCues(
      sheet(
        [
          { id: 'title', kind: 'card', frame: 0, end: 48, text: { en: 'The Gift', zh: '礼物' } },
          { id: 'knock', kind: 'hit', frame: 96, label: 'door' },
          { id: 'cut-1', kind: 'cut', frame: 50 },
          { id: 'lull', kind: 'rest', frame: 60, end: 84 },
        ],
        { leaderFrames: 24 },
      ),
      264,
    );
    expect(listeningPoints(cues, FPS)).toEqual([
      { t: 1, id: 'title', what: 'card 2.00 s: en "The Gift" · zh "礼物"' },
      { t: 3.5, id: 'lull', what: 'rest 1.00 s: quiet, at least 20 dB under the mix' },
      { t: 5, id: 'knock', what: 'hit "door": lands on film frame 96' },
    ]);
  });

  it('re-reports intent checks: a failed one fails, info stays info', () => {
    const qa = intentQaChecks([
      { id: 'cuts.bars', passed: false, detail: 'cut-3 is 2 frames off the bar line' },
      { id: 'text.time', passed: true, info: true, detail: 'all text held ≥ 1.5 s' },
    ]);
    expect(qa).toEqual([
      { id: 'intent.cuts.bars', passed: false, detail: 'cut-3 is 2 frames off the bar line' },
      { id: 'intent.text.time', passed: true, info: true, detail: 'all text held ≥ 1.5 s' },
    ]);
  });

  it('fails a sample peak over -0.1 dBFS, and fails closed without a measurement', () => {
    expect(clippingCheck(-1.2).passed).toBe(true);
    expect(clippingCheck(-0.1).passed).toBe(true);
    expect(clippingCheck(-0.05).passed).toBe(false);
    expect(clippingCheck(0.4).passed).toBe(false);
    expect(clippingCheck(-Infinity)).toMatchObject({ passed: true, detail: 'sample peak -inf dBFS (max -0.1)' });
    expect(clippingCheck(null).passed).toBe(false);
  });
});
