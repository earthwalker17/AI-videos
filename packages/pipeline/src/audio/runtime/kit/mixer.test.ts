import { describe, expect, it } from 'vitest';
import { SR, dbToGain } from './dsp.ts';
import { Mixer } from './mixer.ts';

/** A return that hands the send back unchanged (to check the routing, not a reverb). */
const dry = { process: (l: Float32Array, r: Float32Array) => ({ l: l.slice(), r: r.slice() }), level: 0.5 };

describe('kit mixer', () => {
  it('truncates a clip at the next cut of its bus, or at `until`, with a short fade', () => {
    const mx = new Mixer({ n: 5000, buses: { music: [3000], sfx: [] } });
    const clip = new Float32Array(4000).fill(0.5);
    mx.add(100, clip, { part: 'x', bus: 'music' });
    mx.add(100, clip, { part: 'y', bus: 'sfx' });
    const music = mx.bus('music');
    const sfx = mx.bus('sfx');
    expect(music.l[1000]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
    expect(Math.abs(music.l[2999])).toBeLessThan(0.01);
    expect(music.l.subarray(3000).every((v) => v === 0)).toBe(true);
    expect(sfx.l[3500]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
    expect(mx.cutAfter('music', 3000)).toBe(5000);

    const gate = new Mixer({ n: 5000, buses: { lanes: [] } });
    gate.add(0, clip, { part: 'lane', bus: 'lanes', until: 1000, db: -6, pan: -1 });
    const lanes = gate.bus('lanes');
    expect(lanes.l[500]).toBeCloseTo(0.5 * dbToGain(-6), 6);
    expect(lanes.r[500]).toBeCloseTo(0, 6);
    expect(lanes.l.subarray(1000).every((v) => v === 0)).toBe(true);
    expect(lanes.l[999]).toBeLessThan(lanes.l[500] / 100);
  });

  it('routes sends to their returns, and the mixdown is every bus plus every return', () => {
    const mx = new Mixer({ n: 1000, buses: { a: [], b: [] }, sends: { hall: [], spare: [] } });
    const one = new Float32Array(1000).fill(0.2);
    mx.add(0, { l: one, r: one }, { part: 'p', bus: 'a', sends: { hall: 0.5 } });
    mx.add(0, one, { part: 'q', bus: 'b', pan: 1 });
    // the spare send received nothing: it needs no return
    const out = mx.mixdown({ hall: dry });
    expect(out.l[10]).toBeCloseTo(0.2 + 0.5 * 0.2 * 0.5, 6);
    expect(out.r[10]).toBeCloseTo(0.2 + 0.2 + 0.5 * 0.2 * 0.5, 6);
    expect(() => mx.mixdown({ hall: dry })).toThrow(/once/);

    const bad = new Mixer({ n: 100, buses: { a: [] }, sends: { hall: [] } });
    expect(() => bad.add(0, one, { part: 'p', bus: 'hall' })).toThrow(/is a send/);
    expect(() => bad.add(0, one, { part: 'p', bus: 'nope' })).toThrow(/no bus or send 'nope'/);
    expect(() => bad.add(0, one, { part: 'p', bus: 'a', sends: { room: 1 } })).toThrow(/no send 'room'/);
    bad.add(0, one, { part: 'p', bus: 'a', sends: { hall: 1 } });
    expect(() => new Mixer({ n: 100, buses: { a: [] }, sends: { hall: [] } }).mixdown({ room: dry })).toThrow(/not a send/);
    expect(() => bad.mixdown()).toThrow(/'hall' has clips but no return/);
    expect(() => new Mixer({ n: 10, buses: { a: [] }, sends: { a: [] } })).toThrow(/both a bus and a send/);
    // an onset between samples (seconds passed for samples, an unrounded product) would vanish silently
    expect(() => new Mixer({ n: 100, buses: { a: [] } }).add(0.5, one, { part: 'p', bus: 'a' })).toThrow(/whole sample/);
    expect(() => new Mixer({ n: 100, buses: { a: [] } }).add(Number.NaN, one, { part: 'p', bus: 'a' })).toThrow(/whole sample/);
  });

  it('ducks a bus under another at the mixdown, by the expected depth', () => {
    const n = 2 * SR;
    const mx = new Mixer({ n, buses: { music: [], sfx: [] } });
    mx.add(0, { l: new Float32Array(n).fill(0.5), r: new Float32Array(n).fill(0.5) }, { part: 'bed', bus: 'music' });
    mx.add(SR / 2, new Float32Array(SR / 2).fill(0.3), { part: 'hit', bus: 'sfx' });
    mx.duck('music', 'sfx', { depthDb: 9, attack: 0.002, release: 0.1 });
    const out = mx.mixdown();
    const music = mx.bus('music');
    expect(music.l[SR / 4]).toBe(0.5);
    expect(music.l[0.75 * SR]).toBeCloseTo(0.5 * dbToGain(-9), 6);
    expect(out.l[0.75 * SR]).toBeCloseTo(0.5 * dbToGain(-9) + 0.3 * Math.SQRT1_2, 6);
    expect(music.l[n - 1]).toBeCloseTo(0.5, 6);
    expect(mx.duckReport()).toEqual([{ target: 'music', by: 'sfx', maxDb: expect.closeTo(9, 5) }]);
    expect(() => mx.duck('music', 'music', { depthDb: 3 })).toThrow(/itself/);
  });

  it('keeps levels per part and per bus, and reports them', () => {
    const mx = new Mixer({ n: SR, buses: { music: [] } });
    const tone = Float32Array.from({ length: SR / 2 }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / SR));
    mx.add(0, { l: tone, r: tone }, { part: 'tone', bus: 'music' });
    mx.add(SR / 2, { l: tone, r: tone }, { part: 'tone', bus: 'music', db: -6 });
    const v = mx.levels('music');
    expect(v.peak).toBeCloseTo(1, 4);
    // loudest 400 ms: inside the first clip, a full-scale sine's RMS
    expect(v.loudest400).toBeCloseTo(Math.SQRT1_2, 3);
    expect(v.rms).toBeCloseTo(Math.sqrt((0.5 + 0.5 * dbToGain(-6) ** 2) / 2), 3);
    const lines = mx.report();
    expect(lines[0]).toMatch(/^bus music +peak +0\.0 +rms +-5\.0 +loudest 400 ms +-3\.0$/);
    expect(lines[1]).toMatch(/^part tone +2 clips +peak +0\.0 +rms +-5\.0 +loudest 400 ms +-3\.0$/);
    // an unused bus reads as silence and stays unallocated (it is not in the report)
    const quiet = new Mixer({ n: SR, buses: { music: [], spare: [] } });
    quiet.add(0, tone, { part: 'tone', bus: 'music' });
    expect(quiet.levels('spare')).toEqual({ peak: 0, rms: 0, loudest400: 0 });
    expect(quiet.report().some((l) => l.includes('spare'))).toBe(false);
    expect(() => quiet.levels('nope')).toThrow(/no bus or send 'nope'/);
  });
});
