// `aiv audio` end to end on a scratch repo: a 2 s score (a sine and a click on a cue frame) →
// --verify (two fresh processes, equal bytes) → audio.json → post mixes it as audio:tone.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AudioResult, EXIT, PostResult } from '@aiv/core';
import { fakeAdapter, PROFILES, readWav, resolveTarget, runRender, silentLog, tempRepo, withAudioRuntime, type TempRepo } from '@aiv/pipeline';
import { main } from '../cli.ts';

let repo: TempRepo;
const saved = { ...process.env };

const CUES = { schemaVersion: 1, fps: 30, filmFrames: 60, leaderFrames: 0, events: [{ id: 'click', kind: 'hit', frame: 45 }, { id: 'title', kind: 'text', frame: 0, end: 60, text: { en: 'Two seconds', 'zh-Hans': '两秒' } }] };
const SCORE = `export default {
  tracks: {
    tone: (ctx) => {
      const l = new Float32Array(ctx.filmSamples);
      for (let i = 0; i < l.length; i++) l[i] = 0.2 * Math.sin((2 * Math.PI * 330 * i) / ctx.sampleRate);
      const at = ctx.frameToSample(ctx.cues.events.find((e) => e.kind === 'hit').frame);
      for (let k = 0; k < 48; k++) l[at + k] += 0.6 * (1 - k / 48);
      return [l, l.slice()];
    },
  },
};
`;

beforeAll(() => {
  repo = withAudioRuntime(tempRepo({ audio: { tracks: [{ source: 'audio:tone' }] } }));
  repo.write('videos/demo/src/cues.ts', `export const cues = ${JSON.stringify(CUES, null, 2)};\n`);
  repo.write('videos/demo/audio/index.ts', SCORE);
  // the scratch repo, a private lock and no memory guard: the test must not touch the machine-wide state
  process.env.AIV_ROOT = repo.root;
  process.env.AIV_HEAVY_LOCK = join(repo.root, 'heavy.lock');
  process.env.AIV_MEM_GUARD = '0';
  delete process.env.AIV_QUIET;
});

afterAll(() => {
  process.env = saved;
  repo?.cleanup();
});

const run = async (...argv: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')));
  const error = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void err.push(a.join(' ')));
  const warn = vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void err.push(a.join(' ')));
  try {
    return { code: await main(argv), out: out.join('\n'), err: err.join('\n') };
  } finally {
    log.mockRestore();
    error.mockRestore();
    warn.mockRestore();
  }
};
const sha = (rel: string) => createHash('sha256').update(readFileSync(join(repo.root, rel))).digest('hex');
const audioJson = () => AudioResult.parse(JSON.parse(readFileSync(join(repo.root, 'out/demo/audio/audio.json'), 'utf8')));

describe('aiv audio', () => {
  it('is listed, and maps usage errors to 64', async () => {
    expect((await run('--help')).out).toMatch(/\n {2}audio {2,}build a video's audio tracks/);
    expect((await run('audio', '--help')).out).toMatch(/^usage: aiv audio <slug> \[--verify\] \[--pin\] \[--json\]/);
    expect((await run('audio')).code).toBe(EXIT.USAGE);
    expect((await run('audio', 'demo', '--bogus')).code).toBe(EXIT.USAGE);
    expect((await run('audio', 'Not_A_Slug')).code).toBe(EXIT.USAGE);
  });

  it('--verify renders twice in fresh processes with equal bytes and writes a valid audio.json', async () => {
    const r = await run('audio', 'demo', '--verify');
    expect(r.code, `${r.out}\n${r.err}`).toBe(EXIT.OK);
    expect(r.out).toMatch(/tone {2}96000 samples \(2\.000 s\) · peak -?\d+\.\d dBFS/);
    expect(r.out).toMatch(/PASS {2}text\.hold/);
    expect(r.out).toMatch(/verified: 1 track\(s\) byte-identical across two fresh renders/);
    expect(r.out).toMatch(/next: aiv post demo --profile/);
    const a = audioJson();
    expect(a.verified).toBe(true);
    expect(a.tracks).toHaveLength(1);
    expect(a.tracks[0]).toMatchObject({ name: 'tone', samples: 96_000, channels: 2, sha256: sha('out/demo/audio/tone.wav') });
    // the click is on its cue frame: 45 film frames at 30 fps = 1.5 s
    const c = readWav(readFileSync(join(repo.root, 'out/demo/audio/tone.wav'))).channels[0];
    expect(c[72_000] - c[71_999]).toBeGreaterThan(0.5);
    // a third fresh process, without --verify: the same bytes again
    const first = a.tracks[0].sha256;
    expect((await run('audio', 'demo')).code).toBe(EXIT.OK);
    expect(audioJson().tracks[0].sha256).toBe(first);
    expect(audioJson().verified).toBe(false);
  }, 120_000);

  it('--json prints audio.json on stdout, progress on stderr', async () => {
    const r = await run('audio', 'demo', '--json');
    expect(r.code, r.err).toBe(EXIT.OK);
    expect(AudioResult.parse(JSON.parse(r.out))).toEqual(audioJson());
    expect(r.err).toMatch(/render 1\/1/);
  }, 60_000);

  it('post mixes the track as audio:tone and pins it', async () => {
    const target = resolveTarget('demo', repo.root);
    const rr = await runRender({ target, profile: { ...PROFILES.review, chunkFrames: 30 }, adapter: fakeAdapter({ frames: 60 }), log: silentLog(), keepAwake: false, minDiskMB: 1 });
    expect(rr.exit, rr.message).toBe(EXIT.OK);
    const p = await run('post', 'demo', '--profile', 'review');
    expect(p.code, `${p.out}\n${p.err}`).toBe(EXIT.OK);
    const post = PostResult.parse(JSON.parse(readFileSync(join(repo.root, 'out/demo/post/review/post.json'), 'utf8')));
    expect(post.audio.files).toEqual([{ source: 'audio:tone', path: 'out/demo/audio/tone.wav', bytes: audioJson().tracks[0].bytes, sha256: audioJson().tracks[0].sha256 }]);
    expect(post.audio.generated?.inputHash).toBe(audioJson().inputHash);
    // the release manifest lists the track with its audio input hash
    expect((await run('qa', 'demo', '--profile', 'review')).code).not.toBe(EXIT.USAGE);
    const rel = await run('release', 'demo', '--profile', 'review', '--allow-dirty', '--allow-qa-fail');
    expect(rel.code, `${rel.out}\n${rel.err}`).toBe(EXIT.OK);
    const manifest = JSON.parse(readFileSync(join(repo.root, 'videos/demo/release/v1.json'), 'utf8'));
    expect(manifest.audio.sources).toEqual([{ source: 'audio:tone', bytes: audioJson().tracks[0].bytes, sha256: audioJson().tracks[0].sha256, inputHash: audioJson().inputHash }]);
    // the score changes: post and release refuse until aiv audio runs again
    repo.write('videos/demo/audio/index.ts', SCORE.replace('0.2 *', '0.1 *'));
    const stale = await run('post', 'demo', '--profile', 'review');
    expect(stale.code).toBe(EXIT.REFUSED);
    expect(stale.err).toMatch(/stale \(changed videos\/demo\/audio\/index\.ts\): run aiv audio demo/);
    const staleRelease = await run('release', 'demo', '--profile', 'review', '--allow-dirty', '--allow-qa-fail');
    expect(staleRelease.code).toBe(EXIT.REFUSED);
    expect(staleRelease.err).toMatch(/audio tracks are stale \(changed videos\/demo\/audio\/index\.ts\): run aiv audio demo, then post/);
    // the tracks are current again, only the mix is older: release names post as the step behind
    expect((await run('audio', 'demo')).code).toBe(EXIT.OK);
    const behind = await run('release', 'demo', '--profile', 'review', '--allow-dirty', '--allow-qa-fail');
    expect(behind.code).toBe(EXIT.REFUSED);
    expect(behind.err).toMatch(/post mixed older audio tracks .*: re-run aiv post demo --profile review, then qa and release/);
  }, 180_000);

  it('a failed intent check exits 1 after writing; a frozen video is refused', async () => {
    repo.write('videos/demo/src/cues.ts', `export const cues = ${JSON.stringify({ ...CUES, events: [CUES.events[0], { id: 'title', kind: 'card', frame: 0, end: 60 }] })};\n`);
    const r = await run('audio', 'demo');
    expect(r.code).toBe(EXIT.ERROR);
    expect(r.out).toMatch(/FAIL {2}card\.length {2}shorter than 4 s: title \(2\.00 s\)/);
    expect(audioJson().checks.find((c) => c.id === 'card.length')?.passed).toBe(false);
    const video = JSON.parse(readFileSync(join(repo.root, 'videos/demo/video.json'), 'utf8'));
    repo.write('videos/demo/video.json', JSON.stringify({ ...video, status: 'published' }));
    const frozen = await run('audio', 'demo');
    expect(frozen.code).toBe(EXIT.REFUSED);
    expect(frozen.err).toMatch(/frozen/);
  }, 60_000);
});
