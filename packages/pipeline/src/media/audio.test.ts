import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseEbur128 } from '../qa/detect.ts';
import { ffmpeg } from './bin.ts';
import { audioBedArgs, buildAudioBed, masterAudio, parseLoudnormJson } from './audio.ts';
import { audioDuration, probe } from './probe.ts';

const dir = mkdtempSync(join(tmpdir(), 'aiv-audio-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('audio bed', () => {
  it('builds the mix graph: resample, stereo, gain, sample-exact delay, pad + trim', () => {
    const args = audioBedArgs(
      [
        { source: 'lavfi:sine=f=440', gainDb: -6 },
        { source: 'lavfi:sine=f=660', start: 0.5 },
      ],
      2,
      'bed.wav',
    );
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('volume=-6dB');
    expect(graph).toContain('adelay=delays=24000S:all=1');
    expect(graph).toContain('amix=inputs=2:normalize=0');
    expect(graph).toContain('apad=whole_len=96000,atrim=end_sample=96000');
  });

  it('mixes to exactly the picture length and masters to -14 LUFS ±1 with a linear gain', async () => {
    const bed = join(dir, 'bed.wav');
    const master = join(dir, 'master.wav');
    const durationS = 61 / 30;
    await buildAudioBed({ tracks: [{ source: 'lavfi:sine=f=440:r=48000' }, { source: 'lavfi:sine=f=220:r=48000', gainDb: -8, start: 0.25 }], durationS, out: bed });
    const p = await probe(bed);
    expect(p.audio).toMatchObject({ sampleRate: 48000, channels: 2 });
    expect(Math.abs((await audioDuration(bed))! - durationS)).toBeLessThan(1 / 48000 + 1e-9);

    const r = await masterAudio({ input: bed, out: master, durationS });
    expect(r.mode).toBe('linear');
    expect(r.before!.i).toBeLessThan(-17);
    expect(Math.abs(r.after!.i - -14)).toBeLessThanOrEqual(1);
    expect(r.after!.tp).toBeLessThanOrEqual(-1.5 + 0.1);
    expect(Math.abs((await audioDuration(master))! - durationS)).toBeLessThan(1 / 48000 + 1e-9);

    // an independent meter agrees
    const err = await ffmpeg(['-nostats', '-loglevel', 'info', '-i', master, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], 'ebur128');
    expect(Math.abs(parseEbur128(err)!.i - -14)).toBeLessThanOrEqual(1);
  });

  it('stays linear for a steady bed (measured LRA 0 is not "unset")', async () => {
    const bed = join(dir, 'steady.wav');
    await buildAudioBed({ tracks: [{ source: 'lavfi:sine=f=440:r=48000' }], durationS: 3, out: bed });
    const r = await masterAudio({ input: bed, out: join(dir, 'steady-master.wav'), durationS: 3 });
    expect(r.before!.lra).toBe(0);
    expect(r.mode).toBe('linear');
    expect(Math.abs(r.after!.i - -14)).toBeLessThanOrEqual(1);
  });

  it('passes silence through instead of amplifying it', async () => {
    const bed = join(dir, 'silent.wav');
    await buildAudioBed({ tracks: [], durationS: 1, out: bed });
    const r = await masterAudio({ input: bed, out: join(dir, 'silent-master.wav'), durationS: 1 });
    expect(r.mode).toBe('silent');
  });

  it('parses the loudnorm JSON block', () => {
    expect(parseLoudnormJson('noise\n[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-21.75",\n\t"normalization_type" : "linear"\n}\n[out#0] done').input_i).toBe('-21.75');
    expect(() => parseLoudnormJson('nothing here')).toThrow(/no JSON/);
  });
});
