// `aiv captions` on a scratch repo: drafts from a small cue sheet, the selection and language
// flags, --lint on files already there, the frozen refusal and the usage errors.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT } from '@aiv/core';
import { tempRepo, type TempRepo } from '@aiv/pipeline';
import { main } from '../cli.ts';

let repo: TempRepo;
const saved = { ...process.env };

const CUES = {
  schemaVersion: 1,
  fps: 30,
  filmFrames: 600,
  leaderFrames: 15,
  events: [
    { id: 'title', kind: 'card', frame: 30, end: 120, text: { en: 'Who Routes the Agents?', 'zh-Hans': '谁来调度智能体？' } },
    { id: 'beat-1', kind: 'mark', frame: 30 },
    { id: 'c1', kind: 'text', frame: 150, end: 240, text: { en: 'Your AI agents work in parallel. You can’t.', 'zh-Hans': 'AI 智能体可以并行 你却不能' } },
    { id: 'c2', kind: 'text', frame: 240, end: 330, text: { en: 'Each session knows one task.', 'zh-Hans': '每个 Session 只懂一件事' } },
    { id: 'tag-x', kind: 'text', frame: 160, end: 200, text: { en: 'a tag' } },
    { id: 'tag-y', kind: 'text', frame: 150, end: 240, text: { en: 'A second note that is long enough to need two lines' } },
  ],
};
const write = (slug: string, status: string) => {
  repo.write(`videos/${slug}/video.json`, `${JSON.stringify({ slug, title: 'Demo', status, languages: ['en', 'zh-Hans'], engine: 'fake', entry: 'src/index.ts', format: { width: 320, height: 180, fps: 30 } }, null, 2)}\n`);
  repo.write(`videos/${slug}/src/cues.ts`, `export const cues = ${JSON.stringify(CUES, null, 2)};\n`);
};
const file = (slug: string, lang: string) => join(repo.root, `videos/${slug}/publish/captions/${lang}.srt`);

beforeAll(() => {
  repo = tempRepo();
  write('demo', 'locked');
  write('old', 'published');
  process.env.AIV_ROOT = repo.root;
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

describe('aiv captions', () => {
  it('is listed, and maps usage errors to 64', async () => {
    expect((await run('--help')).out).toMatch(/\n {2}captions {2,}draft a video's caption files/);
    expect((await run('captions', '--help')).out).toMatch(/^usage: aiv captions <slug> \[--lang <list>\]/);
    expect((await run('captions')).code).toBe(EXIT.USAGE);
    expect((await run('captions', 'demo', '--bogus')).code).toBe(EXIT.USAGE);
    expect((await run('captions', 'demo', '--lint', '--cues', 'c1')).code).toBe(EXIT.USAGE);
    expect((await run('captions', 'demo', '--lang', 'EN_us')).code).toBe(EXIT.USAGE);
    expect((await run('captions', 'demo', '--kinds', 'text,bogus')).code).toBe(EXIT.USAGE);
    const typo = await run('captions', 'demo', '--cues', 'c?,beat-1,nope');
    expect(typo.code).toBe(EXIT.USAGE);
    expect(typo.err).toMatch(/--cues: 'beat-1', 'nope' match\(es\) no text or card cue/);
    // a flag that lists nothing names itself
    for (const [flag, v] of [
      ['--cues', ''],
      ['--lang', ''],
      ['--lang', ','],
      ['--kinds', ' '],
    ]) {
      const r = await run('captions', 'demo', flag, v);
      expect(r.code, `${flag} '${v}'`).toBe(EXIT.USAGE);
      expect(r.err.startsWith(`aiv captions: ${flag}: '${v}' lists nothing`), r.err).toBe(true);
    }
    expect(existsSync(file('demo', 'en'))).toBe(false);
  });

  it('writes the first language by default from the chosen cues, then lints it', async () => {
    const r = await run('captions', 'demo', '--cues', 'title,c?');
    expect(r.code, `${r.out}\n${r.err}`).toBe(EXIT.OK);
    expect(r.out).toMatch(/wrote videos\/demo\/publish\/captions\/en\.srt: 3 caption\(s\) from 3 cue\(s\), 00:00:01,500 to 00:00:11,500/);
    expect(r.out).toMatch(/lint videos\/demo\/publish\/captions\/en\.srt: 3 caption\(s\) · 0 error\(s\) · 0 warning\(s\) \(en: ≤ 42 characters a line, ≤ 2 lines, ≤ 20 characters\/s\)/);
    expect(existsSync(file('demo', 'zh-Hans'))).toBe(false);
    // the leader (15 frames) is in the delivery's time
    expect(readFileSync(file('demo', 'en'), 'utf8')).toBe(
      [
        '1',
        '00:00:01,500 --> 00:00:04,500',
        'Who Routes the Agents?',
        '',
        '2',
        '00:00:05,500 --> 00:00:08,500',
        'Your AI agents work in parallel.',
        'You can’t.',
        '',
        '3',
        '00:00:08,500 --> 00:00:11,500',
        'Each session knows one task.',
        '',
      ].join('\n'),
    );
  });

  it('writes the languages asked, and --json describes them', async () => {
    const r = await run('captions', 'demo', '--cues', 'title,c?', '--lang', 'en,zh-Hans', '--json');
    expect(r.code, r.err).toBe(EXIT.OK);
    const j = JSON.parse(r.out) as { files: { path: string; lang: string; wrote: boolean; captions: { lines: string[]; cues: string[] }[]; lint: { errors: number } }[] };
    expect(j.files.map((f) => [f.lang, f.wrote, f.lint.errors])).toEqual([
      ['en', true, 0],
      ['zh-Hans', true, 0],
    ]);
    expect(j.files[1].captions.map((c) => c.lines)).toEqual([['谁来调度智能体？'], ['AI 智能体可以并行 你却不能'], ['每个 Session 只懂一件事']]);
    expect(readFileSync(file('demo', 'zh-Hans'), 'utf8')).toMatch(/^1\n00:00:01,500 --> 00:00:04,500\n谁来调度智能体？\n\n/);
  });

  it('fails (1), writing nothing, when a chosen cue would never be shown', async () => {
    const before = readFileSync(file('demo', 'en'), 'utf8');
    const r = await run('captions', 'demo', '--cues', 'c1,tag-y');
    expect(r.code).toBe(EXIT.ERROR);
    expect(r.err).toMatch(/1 chosen cue\(s\) or page\(s\) would never be shown[^]*cue 'c1' on frames \[150, 240\) under 'tag-y'/);
    expect(readFileSync(file('demo', 'en'), 'utf8')).toBe(before);
  });

  it('fails (1) on a cue without words in the language, and on a language without a profile', async () => {
    const zh = await run('captions', 'demo', '--lang', 'zh-Hans');
    expect(zh.code).toBe(EXIT.ERROR);
    expect(zh.err).toMatch(/cue 'tag-x' has no 'zh-Hans' text/);
    const fr = await run('captions', 'demo', '--lang', 'fr', '--cues', 'title');
    expect(fr.code).toBe(EXIT.ERROR);
    expect(fr.err).toMatch(/no subtitle profile for 'fr'/);
  });

  it('--lint reads the files there and fails on an error', async () => {
    const ok = await run('captions', 'demo', '--lint');
    expect(ok.code, ok.err).toBe(EXIT.OK);
    expect(ok.out).toMatch(/lint videos\/demo\/publish\/captions\/en\.srt: 3 caption/);
    expect(ok.out).toMatch(/lint videos\/demo\/publish\/captions\/zh-Hans\.srt: 3 caption/);
    repo.write('videos/demo/publish/captions/en.srt', `1\n00:00:00,000 --> 00:00:04,000\n${'x'.repeat(43)}\n`);
    const bad = await run('captions', 'demo', '--lint', '--lang', 'en');
    expect(bad.code).toBe(EXIT.ERROR);
    expect(bad.out).toMatch(/ERROR {2}videos\/demo\/publish\/captions\/en\.srt:1 {2}#1 line\.length {2}line 1 has 43 characters/);
    expect((await run('captions', 'demo', '--lint', '--lang', 'de')).code).toBe(EXIT.ERROR);
  });

  it('refuses to write a frozen video (2), and lints it', async () => {
    const r = await run('captions', 'old');
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.err).toMatch(/old is published, so it is frozen/);
    expect(existsSync(file('old', 'en'))).toBe(false);
    expect((await run('captions', 'old', '--lint')).err).toMatch(/no captions in videos\/old\/publish\/captions/);
    repo.write('videos/old/publish/captions/en.srt', '1\n00:00:01,000 --> 00:00:03,000\nPublished as it is.\n');
    expect((await run('captions', 'old', '--lint')).code).toBe(EXIT.OK);
  });
});
