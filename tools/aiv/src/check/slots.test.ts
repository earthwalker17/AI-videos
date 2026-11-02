import { afterEach, describe, expect, it } from 'vitest';
import { tempRepo, type TempRepo } from '@aiv/pipeline';
import { audioIssues } from './slots.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const lib = (files: { path: string }[]) =>
  JSON.stringify({ schemaVersion: 1, libraries: [{ id: 'harp', repo: 'https://github.com/example/harp', commit: 'a'.repeat(40), license: 'CC0-1.0', files: files.map((f) => ({ ...f, bytes: 1, sha256: 'b'.repeat(64) })) }] });

describe('check: audio inputs', () => {
  it('audio:<name> needs the score and the cue sheet', () => {
    repo = tempRepo();
    const issues = audioIssues(repo.root, 'videos/demo', [{ source: 'audio:bed' }, { source: 'lavfi:anullsrc' }]);
    expect(issues).toEqual([
      ['videos/demo/video.json', "track 'audio:bed' needs videos/demo/audio/index.ts (the score)"],
      ['videos/demo/video.json', "track 'audio:bed' needs videos/demo/src/cues.ts (the cue sheet it plays to)"],
    ]);
    repo.write('videos/demo/audio/index.ts', 'export default {};\n');
    repo.write('videos/demo/src/cues.ts', 'export const cues = {};\n');
    expect(audioIssues(repo.root, 'videos/demo', [{ source: 'audio:bed' }])).toEqual([]);
  });

  it('a file track exists inside the video folder (media/ is gitignored: not checked), never in out/', () => {
    repo = tempRepo();
    repo.write('videos/demo/assets/sting.wav', 'x');
    repo.write('videos/other/media/voice.wav', 'x');
    const msgs = audioIssues(repo.root, 'videos/demo', [
      { source: 'videos/demo/assets/sting.wav' },
      { source: 'videos/demo/assets/missing.wav' },
      // not in a fresh clone or on CI: post checks it where the mix needs it
      { source: 'videos/demo/media/voice.wav' },
      { source: 'videos/other/media/voice.wav' },
      { source: 'out/demo/audio/bed.wav' },
    ]).map(([, m]) => m);
    expect(msgs).toEqual([
      "track 'videos/demo/assets/missing.wav' does not exist",
      "track 'videos/other/media/voice.wav' lies outside the video folder: keep its audio files under videos/demo/",
      "track 'out/demo/audio/bed.wav' reads generated output: build it with the audio stage (audio:<name>) instead",
    ]);
  });

  it('audio/library.json must parse and be sorted', () => {
    repo = tempRepo();
    repo.write('videos/demo/audio/library.json', lib([{ path: 'a.wav' }, { path: 'b.wav' }]));
    expect(audioIssues(repo.root, 'videos/demo', [])).toEqual([]);
    repo.write('videos/demo/audio/library.json', lib([{ path: 'b.wav' }, { path: 'a.wav' }]));
    expect(audioIssues(repo.root, 'videos/demo', [])).toEqual([['videos/demo/audio/library.json', 'libraries.0.files: files must be sorted by path, without duplicates']]);
    repo.write('videos/demo/audio/library.json', '{ nope');
    expect(audioIssues(repo.root, 'videos/demo', [])[0][1]).toMatch(/not valid JSON/);
  });
});
