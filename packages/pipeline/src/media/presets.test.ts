import { describe, expect, it } from 'vitest';
import { deliveryArgs } from './mux.ts';
import { audioCodecArgs, containerArgs, encoderPixFmt, getPreset, gopFrames, mezzanineArgs, PRESETS, toBt709Filter, videoCodecArgs } from './presets.ts';

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('presets', () => {
  it('youtube: H.264 High CRF 17 slow, closed GOP of fps/2, BT.709 tags, AAC-LC 320k 48 kHz stereo, faststart', () => {
    const p = getPreset('youtube');
    const v = videoCodecArgs(p, 30);
    expect(after(v, '-c:v')).toBe('libx264');
    expect(after(v, '-profile:v')).toBe('high');
    expect(after(v, '-crf')).toBe('17');
    expect(after(v, '-preset')).toBe('slow');
    expect(after(v, '-g')).toBe('15');
    expect(after(v, '-bf')).toBe('2');
    expect(after(v, '-flags')).toBe('+cgop');
    for (const [k, val] of [['-colorspace', 'bt709'], ['-color_primaries', 'bt709'], ['-color_trc', 'bt709'], ['-color_range', 'tv']]) expect(after(v, k)).toBe(val);
    const a = audioCodecArgs(p);
    expect([after(a, '-c:a'), after(a, '-profile:a'), after(a, '-b:a'), after(a, '-ar'), after(a, '-ac')]).toEqual(['aac', 'aac_low', '320k', '48000', '2']);
    expect(containerArgs(p)).toEqual(['-movflags', '+faststart', '-f', 'mp4']);
    expect(gopFrames(p, 60)).toBe(30);
    expect(gopFrames(p, 24)).toBe(12);
  });

  it('converts RGB explicitly with the BT.709 matrix to limited range and tags the frames', () => {
    const f = toBt709Filter({ space: 'rgb', range: 'pc' });
    expect(f).toMatch(/^scale=out_color_matrix=bt709:out_range=tv:/);
    expect(f).toContain('format=yuv420p');
    expect(f).toMatch(/setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv$/);
    expect(toBt709Filter({ space: 'bt709', range: 'tv' })).toMatch(/^scale=in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709/);
    expect(toBt709Filter({ space: 'bt601', range: 'tv' })).toMatch(/^zscale=.*min=170m:m=709:rin=limited:r=limited/);
    expect(toBt709Filter({ space: 'bt709', range: 'pc' })).toMatch(/rin=full:r=limited/);
  });

  it('archive: CRF 10 + 24-bit PCM in Matroska', () => {
    const p = PRESETS.archive;
    expect(after(videoCodecArgs(p, 30), '-crf')).toBe('10');
    expect(after(videoCodecArgs(p, 30), '-g')).toBe('60');
    expect(after(audioCodecArgs(p), '-c:a')).toBe('pcm_s24le');
    // bit-exact Matroska: no random segment UID or muxing date, so equal frames give equal bytes
    expect(containerArgs(p)).toEqual(['-fflags', '+bitexact', '-flags:v', '+bitexact', '-f', 'matroska']);
  });

  it('preview-hw: hardware encoders get NV12, software falls back to ultrafast x264', () => {
    const p = PRESETS['preview-hw'];
    expect(after(videoCodecArgs(p, 30, 'h264_qsv'), '-c:v')).toBe('h264_qsv');
    expect(encoderPixFmt('h264_qsv', p)).toBe('nv12');
    const sw = videoCodecArgs(p, 30, 'libx264');
    expect([after(sw, '-preset'), after(sw, '-crf')]).toEqual(['ultrafast', '23']);
    expect(encoderPixFmt('libx264', p)).toBe('yuv420p');
    for (const enc of ['h264_qsv', 'h264_videotoolbox', 'h264_nvenc', 'h264_amf', 'libx264']) expect(after(videoCodecArgs(p, 30, enc), '-colorspace')).toBe('bt709');
  });

  it('mezzanine: raw RGBA from stdin to lossless FFV1 bgr0 tagged sRGB full range', () => {
    const m = mezzanineArgs({ width: 320, height: 180, fps: 30, out: 'x.mkv' });
    expect([after(m, '-pix_fmt'), after(m, '-s'), after(m, '-i')]).toEqual(['rgba', '320x180', 'pipe:0']);
    expect([after(m, '-c:v'), after(m, '-level'), after(m, '-g')]).toEqual(['ffv1', '3', '1']);
    expect(m.lastIndexOf('-pix_fmt')).toBeGreaterThan(m.indexOf('-i'));
    expect(m[m.lastIndexOf('-pix_fmt') + 1]).toBe('bgr0');
    expect([after(m, '-colorspace'), after(m, '-color_trc'), after(m, '-color_range')]).toEqual(['rgb', 'iec61966-2-1', 'pc']);
    // the frames carry the same tags, or ffmpeg 8 writes "unknown" into the stream (the runner test probes it)
    expect(after(m, '-vf')).toBe('setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr:range=pc');
  });

  it('delivery args cut both streams to the exact picture length', () => {
    const args = deliveryArgs({ video: 'm.mkv', audio: 'a.wav', out: 'o.mp4', preset: 'youtube', fps: 30, frames: 61, source: { space: 'rgb', range: 'pc' } }, 'libx264', 'o.part.mp4');
    expect(after(args, '-frames:v')).toBe('61');
    expect(after(args, '-t')).toBe((61 / 30).toFixed(6));
    expect(args.at(-1)).toBe('o.part.mp4');
    expect(after(args, '-vf')).toContain('out_color_matrix=bt709');
  });
});
