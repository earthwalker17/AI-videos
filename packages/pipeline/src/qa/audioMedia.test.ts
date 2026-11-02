// The generated-audio record QA trusts, the decoded power, and the layout of audio.png.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXIT, ExitError, type AudioResult, type PostResult, type RenderResult } from '@aiv/core';
import { ffmpeg } from '../media/bin.ts';
import { tempRepo, type TempRepo } from '../testing.ts';
import { sha256 } from '../util/hash.ts';
import { deliveryCues, rmsDb } from './audio.ts';
import { audioSheetGraph, decodePower, powerExpr, readGeneratedAudio, sheetMarks, sheetX, type SheetLayout } from './audioMedia.ts';

const HEX = 'a'.repeat(64);
const sheet = { schemaVersion: 1, fps: 24, filmFrames: 240, leaderFrames: 48, events: [{ id: 'knock', kind: 'hit', frame: 24 }] } as const;
const audioJson = (checks: AudioResult['checks'] = []) =>
  `${JSON.stringify({
    schemaVersion: 1,
    slug: 'demo',
    inputHash: HEX,
    inputs: [],
    settings: {},
    cues: { path: 'videos/demo/src/cues.ts', sha256: HEX, sheet },
    sampleRate: 48000,
    tracks: [],
    libraries: [],
    verified: false,
    checks,
    git: { commit: 'abc', dirty: false },
    toolchain: { node: 'v24', ffmpeg: '8.0.1', os: 'win32', arch: 'x64' },
    timing: { startedAt: '2026-11-03T00:00:00.000Z', endedAt: '2026-11-03T00:00:01.000Z', wallS: 1 },
    warnings: [],
  })}\n`;

let repo: TempRepo;
beforeAll(() => {
  repo = tempRepo();
});
afterAll(() => repo?.cleanup());

const post = (generated?: { audioJson: string; audioJsonSha256: string }, sources = generated ? ['audio:score'] : ['lavfi:sine']) =>
  ({ render: { path: 'out/demo/render/draft/render.json' }, audio: { tracks: sources.map((source) => ({ source })), generated: generated && { ...generated, inputHash: HEX, cuesSha256: HEX } } }) as unknown as PostResult;
const render = (durationFrames: number, fps = 24) => ({ fps, composition: { durationFrames } }) as unknown as RenderResult;
const exitOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ExitError ? e.exit : 'not an ExitError'));

describe('readGeneratedAudio', () => {
  it('returns the audio.json post.json names, after checking its hash and its fit to the render', async () => {
    const text = audioJson([{ id: 'cards.length', passed: true, detail: 'ok' }]);
    repo.write('out/demo/audio/audio.json', text);
    const rec = { audioJson: 'out/demo/audio/audio.json', audioJsonSha256: sha256(text) };
    expect(await readGeneratedAudio(post(), render(288), { root: repo.root })).toBeNull();
    const a = await readGeneratedAudio(post(rec), render(288), { root: repo.root });
    expect(a?.cues.sheet.leaderFrames).toBe(48);
    expect(a?.checks.map((c) => c.id)).toEqual(['cards.length']);
    // changed since post: refused; another length or fps: refused; gone: an error
    expect(await exitOf(readGeneratedAudio(post({ ...rec, audioJsonSha256: HEX }), render(288), { root: repo.root }))).toBe(EXIT.REFUSED);
    expect(await exitOf(readGeneratedAudio(post(rec), render(240), { root: repo.root }))).toBe(EXIT.REFUSED);
    expect(await exitOf(readGeneratedAudio(post(rec), render(288, 30), { root: repo.root }))).toBe(EXIT.REFUSED);
    expect(await exitOf(readGeneratedAudio(post({ ...rec, audioJson: 'out/demo/audio/gone.json' }), render(288), { root: repo.root }))).toBe(EXIT.ERROR);
  });

  it('refuses an audio:<name> mix without a generated-audio record, in post.json or in video.json', async () => {
    // an old post.json, or a post bug: the cue checks would otherwise be skipped without a word
    expect(await exitOf(readGeneratedAudio(post(undefined, ['audio:score']), render(288), { root: repo.root }))).toBe(EXIT.REFUSED);
    await expect(readGeneratedAudio(post(undefined, ['lavfi:sine']), render(288), { tracks: [{ source: 'audio:score' }], root: repo.root })).rejects.toThrow(/no generated-audio record, but the mix uses audio:score: run aiv post again/);
    // lavfi and file tracks need none
    expect(await readGeneratedAudio(post(undefined, ['lavfi:sine', 'media/bed.wav']), render(288), { tracks: [{ source: 'lavfi:sine' }], root: repo.root })).toBeNull();
  });
});

describe('decodePower', () => {
  it('averages the squared channels, so anti-phase stereo is not cancelled', async () => {
    expect(powerExpr(1)).toBe('(val(0)*val(0))/1');
    expect(powerExpr(2)).toBe('(val(0)*val(0)+val(1)*val(1))/2');
    // L = 0.5 sine, R = -L: the downmix (L+R)/2 is digital silence, the power a -9 dB tone
    mkdirSync(join(repo.root, 'out'), { recursive: true });
    const file = join(repo.root, 'out', 'anti.wav');
    await ffmpeg(['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.5*sin(2*PI*440*t)|-0.5*sin(2*PI*440*t):s=48000:d=1:c=stereo', '-c:a', 'pcm_f32le', file], 'anti-phase wav');
    const power = await decodePower(file, 2);
    expect(power.length).toBe(48_000);
    expect(rmsDb(power)).toBeCloseTo(20 * Math.log10(0.5) - 3.01, 1);
    // one channel: the plain square
    const mono = join(repo.root, 'out', 'mono.wav');
    await ffmpeg(['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.1*sin(2*PI*440*t):s=48000:d=1', '-c:a', 'pcm_f32le', mono], 'mono wav');
    expect(rmsDb(await decodePower(mono, 1))).toBeCloseTo(-23.01, 1);
  });
});

describe('audio.png layout', () => {
  // ffmpeg 8.0.1 at 48 kHz: a 1600x400 plot gets 142 px of legend left and right, 64 above and below
  const l: SheetLayout = { specW: 1884, specH: 528, plotW: 1600, plotH: 400, waveH: 160, durationS: 10 };

  it('maps seconds onto the plot, clamped to it', () => {
    expect(sheetX(l, 0)).toBe(142);
    expect(sheetX(l, 2.5)).toBe(142 + 400);
    expect(sheetX(l, 10)).toBe(142 + 1599);
    expect(sheetX(l, 99)).toBe(142 + 1599);
  });

  it('marks the film start and every cue; labels only when drawtext is usable', () => {
    const s = { ...sheet, events: [...sheet.events, { id: 'hush', kind: 'silence' as const, frame: 48, end: 72 }] };
    const marks = sheetMarks(deliveryCues(s, 288), 24, 48);
    expect(marks.map((m) => [m.label, m.t, m.endT])).toEqual([
      ['film', 2, undefined],
      ['knock', 3, undefined],
      ['hush', 4, 5],
    ]);
    const g = audioSheetGraph(l, marks, true);
    expect(g).toContain(`drawbox=x=${sheetX(l, 3)}:y=64:w=2:`);
    // the silence span is shaded over the waveform
    expect(g).toContain(`drawbox=x=${sheetX(l, 4)}:y=${528 + 54}:w=${sheetX(l, 5) - sheetX(l, 4)}:h=160:color=0x6a8cff@0.22:t=fill`);
    expect(g).toContain('drawtext=text=knock:');
    expect(audioSheetGraph(l, marks, false)).not.toContain('drawtext');
  });
});
