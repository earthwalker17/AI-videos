import { afterEach, describe, expect, it } from 'vitest';
import { tempRepo, type TempRepo } from '@aiv/pipeline';
import { captionIssues } from './captions.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

describe('check: caption files', () => {
  it('passes a video without captions, and clean ones (warnings are not issues)', () => {
    repo = tempRepo();
    expect(captionIssues(repo.root, 'videos/demo')).toEqual([]);
    // 0.5 s is under the one-second minimum: a warning only
    repo.write('videos/demo/publish/captions/en.srt', '1\n00:00:00,000 --> 00:00:00,500\nok\n');
    repo.write('videos/demo/publish/captions/README.md', 'not a caption file\n');
    expect(captionIssues(repo.root, 'videos/demo')).toEqual([]);
  });

  it('reports each lint error with its file, line and caption, per language', () => {
    repo = tempRepo();
    repo.write('videos/demo/publish/captions/en.srt', `1\n00:00:00,000 --> 00:00:04,000\n${'x'.repeat(43)}\n\n2\n00:00:03,000 --> 00:00:05,000\nok\n`);
    repo.write('videos/demo/publish/captions/zh-Hans.srt', '1\n00:00:00,000 --> 00:00:04,000\n切换，等待\n');
    expect(captionIssues(repo.root, 'videos/demo')).toEqual([
      { group: 'captions', file: 'videos/demo/publish/captions/en.srt', line: 1, message: expect.stringMatching(/^caption 1: line\.length: line 1 has 43 characters.*\(aiv captions demo --lint\)$/) },
      { group: 'captions', file: 'videos/demo/publish/captions/en.srt', line: 5, message: expect.stringMatching(/^caption 2: srt\.overlap: /) },
      { group: 'captions', file: 'videos/demo/publish/captions/zh-Hans.srt', line: 1, message: expect.stringMatching(/^caption 1: zh\.punctuation: /) },
    ]);
  });

  it('reports a file named by a language without a subtitle profile: its lines go unchecked', () => {
    repo = tempRepo();
    for (const lang of ['zh-CN', 'EN']) repo.write(`videos/demo/publish/captions/${lang}.srt`, `1\n00:00:00,000 --> 00:00:04,000\n${'x'.repeat(50)}，\n`);
    // en-GB falls back to the en profile
    repo.write('videos/demo/publish/captions/en-GB.srt', '1\n00:00:00,000 --> 00:00:04,000\nok\n');
    expect(captionIssues(repo.root, 'videos/demo').map((i) => [i.file, i.message.slice(0, 40)])).toEqual([
      ['videos/demo/publish/captions/EN.srt', "'EN' has no subtitle profile, so its lin"],
      ['videos/demo/publish/captions/zh-CN.srt', "'zh-CN' has no subtitle profile, so its "],
    ]);
  });
});
