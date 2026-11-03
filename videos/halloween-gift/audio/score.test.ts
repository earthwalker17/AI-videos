// The score's building blocks: SFZ parsing and region choice, interpolation, FFT convolution,
// the loudness meter, the true-peak limiter and the timeline. The full render is exercised by
// `aiv audio halloween-gift --verify` (two fresh processes, identical bytes).
import { describe, expect, it } from 'vitest';
import type { Library, ScoreContext, WavData } from '@aiv/pipeline/audio';
import { at, cues, FILM_FRAMES } from '../src/cues.ts';
import { SR, whiteNoise } from './dsp.ts';
import { convolveInto, fft, prepareIr } from './fft.ts';
import { limiterGain, loudness, truePeakDb, truePeakEnvelope } from './master.ts';
import { Mixer } from './mixer.ts';
import { hermite, Sampler } from './sampler.ts';
import { parseKey, parseSfz } from './sfz.ts';
import { ding, gravelStep, knock, thunder } from './sfx.ts';
import { footfalls, timeline, WALKS } from './timeline.ts';

const SFZ = `<control>
default_path=Strings\\Solo Contrabass\\Pizz\\

<global>
ampeg_attack=0.001
ampeg_release=3
volume=0
/* a block
   comment */
<group> //Begin Group 1
lorand=0.0 hirand=0.5
<region>
sample=Low A_v1.wav
lokey=33
hikey=34
pitch_keycenter=34
volume=24
<region> sample=High_v1.wav lokey=c4 hikey=d#4 pitch_keycenter=c#4
<group>
lorand=0.5 hirand=1.0
seq_length=2 seq_position=2
<region>
sample=Low A_v2.wav
lokey=33
hikey=34
pitch_keycenter=34
`;

describe('sfz', () => {
  it('reads regions with inherited opcodes, default_path with spaces and backslashes, comments', () => {
    const r = parseSfz(SFZ);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ sample: 'Strings/Solo Contrabass/Pizz/Low A_v1.wav', lokey: 33, hikey: 34, keycenter: 34, volume: 24, release: 3, attack: 0.001, lorand: 0, hirand: 0.5 });
    expect(r[1]).toMatchObject({ sample: 'Strings/Solo Contrabass/Pizz/High_v1.wav', lokey: 60, hikey: 63, keycenter: 61, volume: 0 });
    // a new group resets the group's opcodes (not the global ones)
    expect(r[2]).toMatchObject({ lorand: 0.5, hirand: 1, seqLength: 2, seqPosition: 2, release: 3 });
    expect([parseKey('c4'), parseKey('C#4'), parseKey('db4'), parseKey('a-1'), parseKey('69')]).toEqual([60, 61, 61, 9, 69]);
  });

  it('picks regions by key, velocity and a seeded round robin, the nearest key outside the range', () => {
    const lib: Library = { id: 'x', commit: '0'.repeat(40), readText: () => SFZ, readWav: () => ({ sampleRate: SR, channels: [new Float32Array(10)] }) };
    const s = new Sampler(lib, 'x.sfz', 'test', 0, 1234);
    const picks = Array.from({ length: 64 }, (_, k) => s.pick(34, 80, k * 1000).sample);
    // both round robins occur, and the choice is a pure function of (key, onset)
    expect(new Set(picks).size).toBe(2);
    expect(Array.from({ length: 64 }, (_, k) => s.pick(34, 80, k * 1000).sample)).toEqual(picks);
    expect(s.pick(20, 80, 0).lokey).toBe(33);
    expect(s.pick(62, 80, 0).sample).toMatch(/High_v1/);
  });

  it('resamples with Hermite interpolation (exact on a line) and pitches by the key', () => {
    expect(hermite(0, 1, 2, 3, 0.25)).toBeCloseTo(1.25, 12);
    expect(hermite(5, 1, 7, 3, 0)).toBe(1);
    const sine = new Float32Array(44_100);
    for (let i = 0; i < sine.length; i++) sine[i] = Math.sin((2 * Math.PI * 440 * i) / 44_100);
    const lib: Library = { id: 'x', commit: '0'.repeat(40), readText: () => '<region> sample=a.wav pitch_keycenter=69', readWav: (): WavData => ({ sampleRate: 44_100, channels: [sine] }) };
    const s = new Sampler(lib, 'x.sfz', 'sine', 0, 1);
    // an octave up: 880 Hz at 48 kHz, half as long
    const { l } = s.note({ key: 81, vel: 127, at: 0 });
    expect(l.length).toBeGreaterThan(23_000);
    let crossings = 0;
    for (let i = 1000; i < 1000 + SR / 4; i++) if (l[i - 1] < 0 && l[i] >= 0) crossings++;
    expect(crossings).toBeGreaterThanOrEqual(219);
    expect(crossings).toBeLessThanOrEqual(221);
  });

  it('corrects a mis-mapped instrument (an octave shift, per-file cents) and returns no trailing zeros', () => {
    const sine = new Float32Array(44_100);
    for (let i = 0; i < sine.length; i++) sine[i] = Math.sin((2 * Math.PI * 440 * i) / 44_100 + 0.3);
    const sfz = '<region> sample=a.wav lokey=60 hikey=75 pitch_keycenter=69\n<region> sample=b.wav lokey=76 hikey=90 pitch_keycenter=81';
    const read: string[] = [];
    const lib: Library = { id: 'x', commit: '0'.repeat(40), readText: () => sfz, readWav: (p): WavData => (read.push(p), { sampleRate: 44_100, channels: [sine] }) };
    const hz = (l: Float32Array) => {
      let c = 0;
      for (let i = 1; i < SR; i++) if (l[i - 1] < 0 && l[i] >= 0) c++;
      return c;
    };
    // key 81 is the sounding pitch: with shift -12 it plays a.wav at its own pitch, then 100 cents flat
    const plain = new Sampler(lib, 'x.sfz', 'm', 0, 1).note({ key: 81, vel: 127, at: 0 });
    const fixed = new Sampler(lib, 'x.sfz', 'm', 0, 1, { shift: -12, retune: { 'a.wav': -100 } }).note({ key: 81, vel: 127, at: 0 });
    expect(read).toEqual(['b.wav', 'a.wav']);
    expect(Math.abs(hz(plain.l) - 440)).toBeLessThanOrEqual(1);
    expect(Math.abs(hz(fixed.l) - 440 * 2 ** (-100 / 1200))).toBeLessThanOrEqual(1);
    // the clip is as long as the recording lasts at that rate, not a padded upper bound
    const expected = 44_100 / ((44_100 / SR) * 2 ** (-100 / 1200));
    expect(Math.abs(fixed.l.length - expected)).toBeLessThan(8);
    expect(fixed.l[fixed.l.length - 1]).not.toBe(0);
  });
});

describe('dsp', () => {
  it('fft round-trips, and convolveInto equals direct convolution, truncated at the cuts', () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.3) + (i % 5));
    const im = new Float64Array(64);
    const keep = Float64Array.from(re);
    fft(re, im);
    fft(re, im, true);
    for (let i = 0; i < 64; i++) expect(re[i]).toBeCloseTo(keep[i], 9);

    const n = 3000;
    const w = whiteNoise(7);
    const inL = Float32Array.from({ length: n }, () => w());
    const inR = Float32Array.from({ length: n }, () => w());
    const ir = { l: Float32Array.from({ length: 300 }, (_, i) => Math.exp(-i / 40) * Math.cos(i)), r: Float32Array.from({ length: 300 }, (_, i) => Math.exp(-i / 60) * Math.sin(i + 1)) };
    const p = prepareIr(ir);
    const outL = new Float32Array(n);
    const outR = new Float32Array(n);
    const cut = 2000;
    convolveInto(inL, inR, p, outL, outR, [cut], 0);
    const direct = (x: Float32Array, h: Float32Array, i: number, from: number, to: number) => {
      let s = 0;
      for (let k = 0; k < h.length; k++) if (i - k >= from && i - k < to) s += x[i - k] * h[k];
      return s;
    };
    for (const i of [0, 1, 250, 1999, 2000, 2001, 2500, 2999]) {
      const seg = i < cut ? [0, cut] : [cut, n];
      expect(outL[i]).toBeCloseTo(direct(inL, ir.l, i, seg[0], seg[1]), 4);
      expect(outR[i]).toBeCloseTo(direct(inR, ir.r, i, seg[0], seg[1]), 4);
    }
  });

  it('meters loudness by BS.1770: a 997 Hz sine at -20 dBFS in both channels reads -20 LUFS', () => {
    const a = 0.1;
    const x = Float32Array.from({ length: SR * 4 }, (_, i) => a * Math.sin((2 * Math.PI * 997 * i) / SR));
    expect(loudness(x, x).i).toBeCloseTo(-20, 1);
    expect(loudness(new Float32Array(SR * 2), new Float32Array(SR * 2)).i).toBe(-Infinity);
  });

  it('finds inter-sample peaks and limits them under the ceiling', () => {
    // fs/4 with a 45° phase: every sample is at ±0.707, the waveform peaks at 1
    const x = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((Math.PI / 2) * i + Math.PI / 4));
    expect(truePeakDb(x, x)).toBeGreaterThan(-0.2);
    const w = whiteNoise(3);
    const y = Float64Array.from({ length: SR }, (_, i) => (i > 20_000 && i < 21_000 ? 3 : 0.3) * w());
    const z = Float64Array.from(y);
    const ceiling = 10 ** (-3 / 20);
    const g = limiterGain(truePeakEnvelope(y, z, 0), ceiling, 240, 0.1);
    for (let i = 0; i < y.length; i++) {
      y[i] *= g[i];
      z[i] *= g[i];
    }
    expect(truePeakDb(y, z)).toBeLessThan(-2.9);
  });

  it('synthesises the same samples every time (pure functions of the seed)', () => {
    for (const f of [() => knock(5), () => knock(5, { muffled: true }), () => gravelStep(9), () => ding(85), () => thunder(2, { len: 1 }).l]) expect(f()).toEqual(f());
    expect(knock(5)).not.toEqual(knock(6));
  });
});

describe('timeline', () => {
  const ctx = { sampleRate: SR, cues, fps: 24, filmSamples: (FILM_FRAMES * SR) / 24, frameToSample: (f: number) => Math.round((f * SR) / 24), seed: 1, library: () => { throw new Error('no library'); } } as unknown as ScoreContext;
  const T = timeline(ctx);

  it('puts bars and beats exactly on the cue sheet frames', () => {
    for (let bar = 1; bar <= 40; bar++) for (const b of [1, 1.5, 2, 2.5, 3]) expect(T.beat(bar, b)).toBe(T.frame(at(bar, b)));
    expect(T.cue('knock-3')).toBe(T.frame(at(17, 2.5)));
  });

  it('knows the silences and the cuts; footfalls land inside the walks, on beats after each start', () => {
    expect(T.silences).toEqual([
      [T.frame(at(18, 3)), T.frame(at(20))],
      [T.frame(at(24)), T.frame(at(25))],
      [T.frame(at(40)), T.frame(FILM_FRAMES)],
    ]);
    expect(T.cuts.music).toEqual([T.frame(at(17)), ...T.silences.map((s) => s[0])]);
    const steps = footfalls();
    expect(steps.length).toBeGreaterThan(20);
    for (const s of steps) {
      const [a, b] = WALKS[s.walk];
      expect(s.frame > a && s.frame <= b && s.u > 0 && s.u <= 1).toBe(true);
    }
  });

  it('truncates a clip at the next cut of its bus', () => {
    const mx = new Mixer(5000, { music: [3000], sfx: [] });
    const clip = new Float32Array(4000).fill(0.5);
    mx.add(100, clip, { part: 'x', bus: 'music' });
    mx.add(100, clip, { part: 'y', bus: 'sfx' });
    expect(mx.music.l[1000]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
    expect(Math.abs(mx.music.l[2999])).toBeLessThan(0.01);
    expect(mx.music.l.subarray(3000).every((v) => v === 0)).toBe(true);
    expect(mx.sfx.l[3500]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
  });
});
