import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AudioTrack, parseContract, ReleaseManifest, RenderResult, RepoPath, VideoConfig } from './contracts.ts';
import realRelease from './fixtures/release.v1.json' with { type: 'json' };
import realRender from './fixtures/render.v1.json' with { type: 'json' };

const H = 'a'.repeat(64);

const sampleRender = {
  schemaVersion: 1,
  engine: { name: 'fake', version: '1.0.0', adapterVersion: '1' },
  target: { slug: 'demo', entry: 'src/index.html' },
  profile: 'draft',
  frames: { start: 0, end: 30, count: 30 },
  composition: { durationFrames: 30 },
  fps: 30,
  width: 320,
  height: 180,
  color: { space: 'rgb', range: 'pc' },
  mezzanine: { path: 'out/demo/render/draft/mezzanine.mkv', codec: 'ffv1', pixFmt: 'bgr0', bytes: 10, sha256: H },
  inputHash: H,
  git: { commit: 'abc', dirty: false },
  toolchain: { node: 'v24', ffmpeg: '8.0.1', ffmpegBuildconfHash: '0123', os: 'win32', arch: 'x64' },
  timing: { startedAt: '2026-11-01T00:00:00.000Z', endedAt: '2026-11-01T00:00:01.000Z', wallS: 1 },
  warnings: [],
};

describe('contracts', () => {
  it('accepts a valid render.json', () => {
    expect(parseContract(RenderResult, sampleRender, 'render.json').frames.count).toBe(30);
  });

  it('rejects absolute and escaping paths', () => {
    for (const p of ['C:/x/y.mkv', '/abs/y.mkv', 'a\\b.mkv', '../up.mkv', 'a/../../b']) expect(RepoPath.safeParse(p).success, p).toBe(false);
    expect(RepoPath.safeParse('out/demo/x.mkv').success).toBe(true);
    const bad = { ...sampleRender, mezzanine: { ...sampleRender.mezzanine, path: 'D:/renders/x.mkv' } };
    expect(() => parseContract(RenderResult, bad, 'render.json')).toThrow(/repo-relative/);
  });

  it('audio sources are lavfi graphs or repo-relative files, never absolute or escaping paths', () => {
    for (const ok of ['lavfi:sine=f=440', 'videos/demo/assets/bed.wav']) expect(AudioTrack.safeParse({ source: ok }).success, ok).toBe(true);
    for (const bad of ['C:/Users/someone/music.wav', '/home/someone/music.wav', '../other/bed.wav', 'videos/demo/../../x.wav', 'lavfi:', ''])
      expect(AudioTrack.safeParse({ source: bad }).success, bad).toBe(false);
  });

  it('rejects an inconsistent frame range', () => {
    expect(RenderResult.safeParse({ ...sampleRender, frames: { start: 0, end: 30, count: 29 } }).success).toBe(false);
  });

  it('video.json keeps unknown keys (the full slot schema lands later)', () => {
    const v = parseContract(
      VideoConfig,
      { slug: 'my-video', title: 'T', engine: 'web', entry: 'src/index.html', format: { width: 1920, height: 1080, fps: 30 }, status: 'idea' },
      'video.json',
    );
    expect(v.status).toBe('idea');
    expect(VideoConfig.safeParse({ ...v, slug: 'My Video' }).success).toBe(false);
    expect(VideoConfig.safeParse({ ...v, qa: { swatchFrames: [10, 5] } }).success).toBe(false);
  });

  // The frozen v1 contracts were derived from these real files (web template, final profile).
  // If one of these tests fails, the change breaks v1: make it a new version instead.
  it('the real render.json and release manifest parse as v1', () => {
    expect(parseContract(RenderResult, realRender, 'render.v1 fixture').composition.durationFrames).toBe(150);
    expect(parseContract(ReleaseManifest, realRelease, 'release.v1 fixture').files.map((f) => f.role)).toEqual(['delivery', 'archive']);
  });

  it('the path rule survives the JSON Schema export', () => {
    const pattern = (z.toJSONSchema(RepoPath) as { pattern?: string }).pattern;
    expect(pattern).toBeTruthy();
    const re = new RegExp(pattern!);
    expect(re.test('out/demo/x.mkv')).toBe(true);
    for (const p of ['C:/x', '/abs', 'a\\b', '../up', 'a/../b', 'a/..']) expect(re.test(p), p).toBe(false);
  });
});
