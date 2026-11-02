// Post with the audio stage's tracks (audio:<name>) and with partial renders: the mix refuses
// stale or foreign tracks and pins every file it read.
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXIT, type AudioTrack } from '@aiv/core';
import { runAudioStage } from '../audio/stage.ts';
import { encodeWav, readWav } from '../audio/runtime/wav.ts';
import { audioBedArgs } from '../media/audio.ts';
import { PROFILES, type Profile } from '../runner/profiles.ts';
import { runRender } from '../runner/runner.ts';
import { resolveTarget } from '../runner/target.ts';
import { fakeAdapter, tempRepo, withAudioRuntime, type TempRepo } from '../testing.ts';
import { silentLog } from '../util/log.ts';
import { runPost } from './post.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());
const profile: Profile = { ...PROFILES.review, chunkFrames: 40 };
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

const CUES = `export const cues = ${JSON.stringify({ schemaVersion: 1, fps: 30, filmFrames: 60, leaderFrames: 6, events: [{ id: 'knock', kind: 'hit', frame: 30 }] })};\n`;
const SCORE = (gain: number) => `export default { tracks: { tone: (ctx) => {
  const l = new Float32Array(ctx.filmSamples);
  for (let i = 0; i < l.length; i++) l[i] = ${gain} * Math.sin((2 * Math.PI * 440 * i) / ctx.sampleRate);
  l[ctx.frameToSample(ctx.cues.events[0].frame)] = 0.9;
  return [l, l.slice()];
} } };\n`;

async function render(frames: number, range?: [number, number]) {
  const r = await runRender({ target: resolveTarget('demo', repo.root), profile, range, adapter: fakeAdapter({ frames }), log: silentLog(), keepAwake: false, minDiskMB: 1, fresh: true });
  expect(r.exit, r.message).toBe(EXIT.OK);
  return r.renderJson!;
}
const post = () => runPost({ target: resolveTarget('demo', repo.root), profile, log: silentLog() });
const audio = async () => expect((await runAudioStage({ slug: 'demo', root: repo.root, log: silentLog() })).exit).toBe(EXIT.OK);

describe('post with audio:<name> tracks', () => {
  it('mixes fresh tracks and records every sha256; refuses stale, altered, foreign-cue or wrong-length tracks', async () => {
    repo = withAudioRuntime(tempRepo({ audio: { tracks: [{ source: 'audio:tone' }] } }));
    repo.write('videos/demo/src/cues.ts', CUES);
    repo.write('videos/demo/audio/index.ts', SCORE(0.25));
    await expect(post()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/no render/) });
    await render(66);
    await expect(post()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/out\/demo\/audio\/audio\.json is missing: run aiv audio demo/) });
    await audio();

    const ok = await post();
    const wav = join(repo.root, 'out/demo/audio/tone.wav');
    const audioJson = join(repo.root, 'out/demo/audio/audio.json');
    const a = JSON.parse(readFileSync(audioJson, 'utf8'));
    expect(ok.post.audio.files).toEqual([{ source: 'audio:tone', path: 'out/demo/audio/tone.wav', bytes: readFileSync(wav).length, sha256: sha(wav) }]);
    expect(ok.post.audio.generated).toEqual({ audioJson: 'out/demo/audio/audio.json', audioJsonSha256: sha(audioJson), inputHash: a.inputHash, cuesSha256: sha(join(repo.root, 'videos/demo/src/cues.ts')) });
    expect(ok.post.audio.masterSha256).toBe(sha(join(repo.root, 'out/demo/post/review/audio.wav')));
    expect(ok.post.audio.mode).toBe('linear');

    // the score changed after aiv audio: refused, naming the file
    repo.write('videos/demo/audio/index.ts', SCORE(0.2));
    await expect(post()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/stale \(changed videos\/demo\/audio\/index\.ts\): run aiv audio demo/) });
    await audio();
    expect((await post()).post.audio.files![0].sha256).toBe(sha(wav));

    // a track file that is not the one audio.json describes
    const bytes = readFileSync(wav);
    bytes[bytes.length - 3] ^= 0x40;
    writeFileSync(wav, bytes);
    await expect(post()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/not the file audio\.json describes/) });

    // the score follows a new cue sheet, the picture was rendered from the old one
    repo.write('videos/demo/src/cues.ts', CUES.replace('"frame":30', '"frame":31'));
    await audio();
    await expect(post()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/different cue sheets/) });

    // re-rendered with the new cues, but the composition is longer than leader + film
    await render(70);
    await expect(post()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/has 105600 samples; the picture's composition needs 112000 \(70 frames at 30 fps\)/) });
    await render(66);
    expect((await post()).post.audio.generated?.cuesSha256).toBe(sha(join(repo.root, 'videos/demo/src/cues.ts')));

    rmSync(audioJson);
    await expect(post()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/run aiv audio demo/) });
  }, 240_000);
});

describe('post of a partial render', () => {
  it('starts the bed at the first rendered frame (every track moves by -start/fps)', async () => {
    // a 2 s file with one click at 1.0 s
    const click = new Float32Array(96_000);
    click[48_000] = 0.8;
    repo = tempRepo({ audio: { tracks: [{ source: 'videos/demo/media/click.wav' }] } });
    writeFileSync(repo.write('videos/demo/media/click.wav', ''), encodeWav([click, click], 48000));
    const peakAt = (file: string) => {
      const c = readWav(readFileSync(file)).channels[0];
      let at = 0;
      for (let i = 1; i < c.length; i++) if (Math.abs(c[i]) > Math.abs(c[at])) at = i;
      return at;
    };
    await render(60);
    const whole = await post();
    expect(peakAt(join(repo.root, 'out/demo/post/review/audio.wav'))).toBe(48_000);
    expect(whole.post.audio.files).toEqual([{ source: 'videos/demo/media/click.wav', path: 'videos/demo/media/click.wav', bytes: readFileSync(join(repo.root, 'videos/demo/media/click.wav')).length, sha256: sha(join(repo.root, 'videos/demo/media/click.wav')) }]);
    expect(whole.post.audio.generated).toBeUndefined();
    // frames 15-44: the picture starts 0.5 s in, so the click lands 0.5 s into the delivery
    await render(60, [15, 45]);
    await post();
    expect(peakAt(join(repo.root, 'out/demo/post/review/audio.wav'))).toBe(24_000);
  }, 120_000);

  it('the mix graph: offset tracks are trimmed or delayed less; without an offset nothing changes', () => {
    const tracks: AudioTrack[] = [{ source: 'lavfi:sine=f=440', gainDb: -6 }, { source: 'lavfi:sine=f=660', start: 0.75 }, { source: 'videos/demo/media/a.wav' }];
    const plain = audioBedArgs(tracks, 2, 'bed.wav', '/repo');
    expect(audioBedArgs(tracks, 2, 'bed.wav', '/repo', { offsetSamples: 0 })).toEqual(plain);
    expect(plain.slice(0, 12)).toEqual(['-loglevel', 'error', '-f', 'lavfi', '-t', '2.000000', '-i', 'sine=f=440', '-f', 'lavfi', '-t', '2.000000']);
    expect(plain[plain.indexOf('-filter_complex') + 1]).toBe(
      '[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=-6dB[a0];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=delays=36000S:all=1[a1];[2:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a2];[a0][a1][a2]amix=inputs=3:normalize=0:duration=longest[m];[m]apad=whole_len=96000,atrim=end_sample=96000[out]',
    );
    const shifted = audioBedArgs(tracks, 2, 'bed.wav', '/repo', { offsetSamples: 24_000, files: { 'videos/demo/media/a.wav': '/elsewhere/a.wav' } });
    const graph = shifted[shifted.indexOf('-filter_complex') + 1];
    expect(shifted.slice(4, 6)).toEqual(['-t', '2.500000']);
    expect(shifted).toContain('/elsewhere/a.wav');
    expect(graph).toContain('volume=-6dB,atrim=start_sample=24000,asetpts=PTS-STARTPTS[a0]');
    expect(graph).toContain('adelay=delays=12000S:all=1[a1]');
    expect(graph).toContain('stereo,atrim=start_sample=24000,asetpts=PTS-STARTPTS[a2]');
  });
});
