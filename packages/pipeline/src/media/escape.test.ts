import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ffmpeg } from './bin.ts';
import { concatLine, escapeFilterGraph, escapeFilterOption, filterPath } from './escape.ts';

describe('ffmpeg escaping', () => {
  it('escapes each level', () => {
    expect(escapeFilterOption("C:/a b/it's.wav")).toBe("C\\:/a b/it\\'s.wav");
    expect(escapeFilterGraph('a,b;c[d]')).toBe('a\\,b\\;c\\[d\\]');
    // option level gives C\:, graph level escapes that backslash: C\\:
    expect(filterPath('C:\\x\\y.srt')).toBe('C\\\\:/x/y.srt');
    expect(concatLine("D:\\clips\\it's.mkv")).toBe("file 'D:/clips/it'\\''s.mkv'");
  });

  // a real round trip: ffmpeg must open a file whose path has a drive colon (on Windows),
  // spaces, a quote, a comma, brackets and a semicolon, named inside a filtergraph
  const dir = mkdtempSync(join(tmpdir(), 'aiv esc '));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('lets ffmpeg open a hostile path through amovie=', async () => {
    const sub = join(dir, "it's [a], b; c");
    mkdirSync(sub, { recursive: true });
    const wav = join(sub, 'tone.wav');
    await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=f=440:r=48000:d=0.2', wav], 'make tone');
    const err = await ffmpeg(['-loglevel', 'info', '-nostats', '-f', 'lavfi', '-i', `amovie=${filterPath(wav)},volumedetect`, '-f', 'null', '-'], 'read tone');
    expect(err).toMatch(/mean_volume/);
  });
});
