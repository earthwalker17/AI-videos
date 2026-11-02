import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { rand } from '@aiv/core';
import { ffmpeg } from '../../media/bin.ts';
import { probe } from '../../media/probe.ts';
import { encodeWav, readWav, samplePeak } from './wav.ts';

const dir = mkdtempSync(join(tmpdir(), 'aiv-wav-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const noise = (n: number, seed: number) => Float32Array.from({ length: n }, (_, i) => rand(seed, 'wav', i) * 2 - 1);
const fourccs = (b: Uint8Array) => {
  const ids: string[] = [];
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let o = 12; o + 8 <= b.length; ) {
    ids.push(String.fromCharCode(...b.subarray(o, o + 4)));
    const size = v.getUint32(o + 4, true);
    o += 8 + size + (size & 1);
  }
  return ids;
};

/** A hand-built WAV: an unknown chunk before fmt and one between fmt and data. */
function craft(o: { format: number; bits: number; channels: number; samples: number[][]; extensible?: boolean }): Uint8Array {
  const bps = o.bits / 8;
  const n = o.samples[0].length;
  const fmt = new Uint8Array(o.extensible ? 40 : 16);
  const fv = new DataView(fmt.buffer);
  fv.setUint16(0, o.extensible ? 0xfffe : o.format, true);
  fv.setUint16(2, o.channels, true);
  fv.setUint32(4, 44100, true);
  fv.setUint32(8, 44100 * o.channels * bps, true);
  fv.setUint16(12, o.channels * bps, true);
  fv.setUint16(14, o.bits, true);
  if (o.extensible) {
    fv.setUint16(16, 22, true);
    fv.setUint16(18, o.bits, true);
    fv.setUint16(24, o.format, true); // SubFormat GUID, first two bytes
  }
  const data = new Uint8Array(n * o.channels * bps);
  const dv = new DataView(data.buffer);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < o.channels; c++) {
      const at = (i * o.channels + c) * bps;
      const s = o.samples[c][i];
      if (o.bits === 16) dv.setInt16(at, s, true);
      else {
        data[at] = s & 0xff;
        data[at + 1] = (s >> 8) & 0xff;
        data[at + 2] = (s >> 16) & 0xff;
      }
    }
  const chunk = (id: string, body: Uint8Array) => {
    const b = new Uint8Array(8 + body.length + (body.length & 1));
    b.set([...id].map((ch) => ch.charCodeAt(0)));
    new DataView(b.buffer).setUint32(4, body.length, true);
    b.set(body, 8);
    return b;
  };
  const parts = [chunk('JUNK', new Uint8Array(5)), chunk('fmt ', fmt), chunk('LIST', new Uint8Array(10)), chunk('data', data)];
  const body = new Uint8Array(4 + parts.reduce((s, p) => s + p.length, 0));
  body.set([...'WAVE'].map((ch) => ch.charCodeAt(0)));
  let at = 4;
  for (const p of parts) {
    body.set(p, at);
    at += p.length;
  }
  return chunk('RIFF', body);
}

describe('wav', () => {
  it('float 32: the bytes round-trip exactly, and equal samples give equal bytes', () => {
    const l = noise(1001, 1);
    const r = noise(1001, 2);
    const bytes = encodeWav([l, r], 48000);
    expect(encodeWav([l, r], 48000)).toEqual(bytes);
    const back = readWav(bytes);
    expect(back.sampleRate).toBe(48000);
    expect(back.channels).toEqual([l, r]);
    expect(Buffer.from(encodeWav(back.channels, back.sampleRate))).toEqual(Buffer.from(bytes));
    // tag 3, an 18-byte fmt chunk with extension size 0, fact, data: nothing else
    const v = new DataView(bytes.buffer);
    expect([v.getUint32(16, true), v.getUint16(20, true), v.getUint16(36, true)]).toEqual([18, 3, 0]);
    expect(fourccs(bytes)).toEqual(['fmt ', 'fact', 'data']);
    expect(bytes.length).toBe(12 + 26 + 12 + 8 + 1001 * 8);
  });

  it('24-bit PCM: the bytes round-trip exactly, odd sizes are padded', () => {
    const mono = noise(7, 3);
    const bytes = encodeWav([mono], 44100, 's24');
    expect(fourccs(bytes)).toEqual(['fmt ', 'data']);
    expect(bytes.length % 2).toBe(0);
    const back = readWav(bytes);
    expect(back.channels[0].length).toBe(7);
    for (let i = 0; i < 7; i++) expect(Math.abs(back.channels[0][i] - mono[i])).toBeLessThanOrEqual(1 / 8388608);
    expect(Buffer.from(encodeWav(back.channels, 44100, 's24'))).toEqual(Buffer.from(bytes));
    // full scale clips instead of wrapping
    const clipped = readWav(encodeWav([Float32Array.of(1.5, -1.5, 1, -1)], 48000, 's24')).channels[0];
    expect([...clipped]).toEqual([8388607 / 8388608, -1, 8388607 / 8388608, -1]);
  });

  it('reads 16-bit and 24-bit WAVE_FORMAT_EXTENSIBLE files, skipping unknown chunks', () => {
    const s16 = readWav(craft({ format: 1, bits: 16, channels: 2, samples: [[0, 16384, -32768], [1, -1, 32767]] }));
    expect(s16.sampleRate).toBe(44100);
    expect([...s16.channels[0]]).toEqual([0, 0.5, -1]);
    expect([...s16.channels[1]]).toEqual([1 / 32768, -1 / 32768, 32767 / 32768]);
    const s24 = readWav(craft({ format: 1, bits: 24, channels: 1, samples: [[4194304, -8388608, 0x7fffff]], extensible: true }));
    expect([...s24.channels[0]]).toEqual([0.5, -1, 8388607 / 8388608]);
    expect(() => readWav(craft({ format: 2, bits: 16, channels: 1, samples: [[0]] }))).toThrow(/unsupported/);
    expect(() => readWav(new TextEncoder().encode('not a wav file at all'))).toThrow(/RIFF/);
  });

  it('is the float WAV ffmpeg reads and writes: same sample count, same samples', async () => {
    const l = noise(4800, 4);
    const r = noise(4800, 5);
    const ours = join(dir, 'ours.wav');
    const theirs = join(dir, 'theirs.wav');
    writeFileSync(ours, encodeWav([l, r], 48000));
    const p = await probe(ours);
    expect(p.audio).toMatchObject({ codec: 'pcm_f32le', sampleRate: 48000, channels: 2 });
    await ffmpeg(['-loglevel', 'error', '-i', ours, '-c:a', 'pcm_f32le', '-bitexact', '-map_metadata', '-1', theirs], 'float copy');
    // byte for byte what ffmpeg itself writes (its 24-bit files use WAVE_FORMAT_EXTENSIBLE instead)
    expect(readFileSync(theirs)).toEqual(readFileSync(ours));
    const back = readWav(readFileSync(theirs));
    expect(back.channels).toEqual([l, r]);
    expect(samplePeak(back.channels)).toBe(samplePeak([l, r]));
  });
});
