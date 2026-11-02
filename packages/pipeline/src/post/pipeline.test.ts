// The engine-agnostic slice end to end with a fake engine: render → post → qa → release.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXIT, type QaReport, type RenderResult } from '@aiv/core';
import { ffmpeg } from '../media/bin.ts';
import { probe } from '../media/probe.ts';
import { encodeDelivery } from '../media/mux.ts';
import { runQa, type QaOptions } from '../qa/qa.ts';
import { readManifest, refuseStalePicture, verifyRelease, writeRelease } from '../release/release.ts';
import { PROFILES, type Profile } from '../runner/profiles.ts';
import { runRender } from '../runner/runner.ts';
import { resolveTarget, type Target } from '../runner/target.ts';
import { fakeAdapter, tempRepo, type TempRepo } from '../testing.ts';
import { silentLog } from '../util/log.ts';
import { fromRepo } from '../util/paths.ts';
import { runPost, type PostOutcome } from './post.ts';

let repo: TempRepo;
let target: Target;
let post: PostOutcome;
let report: QaReport;
let archiveReport: QaReport;
const profile: Profile = { ...PROFILES.final, chunkFrames: 30 };
const loudness = { integrated: -14, tolerance: 1, truePeakMax: -1 };

const qaOptions = (file: string): QaOptions => ({
  file,
  root: repo.root,
  expect: { width: 320, height: 180, fps: 30, frames: 60, durationS: 2 },
  loudness,
  swatch: { frames: [10, 20] },
  contact: { count: 6, cols: 3, tileWidth: 160 },
  outDir: join(repo.root, 'out', 'demo', 'qa', 'final'),
  log: silentLog(),
});

beforeAll(async () => {
  repo = tempRepo({
    audio: { tracks: [{ source: 'lavfi:sine=f=440:r=48000' }, { source: 'lavfi:sine=f=660:r=48000', gainDb: -9, start: 0.5 }] },
    qa: { swatchFrames: [10, 20], loudness },
  });
  target = resolveTarget('demo', repo.root);
  const r = await runRender({ target, profile, adapter: fakeAdapter({ frames: 60, swatchFrames: [10, 20] }), log: silentLog(), keepAwake: false, minDiskMB: 1 });
  expect(r.exit, r.message).toBe(EXIT.OK);
  post = await runPost({ target, profile, log: silentLog() });
  // a render and a final post (two encodes, two loudness passes): beyond the 10 s hook default on a slow host
}, 120_000);
afterAll(() => repo?.cleanup());

describe('render → post → qa → release', () => {
  it('post writes the delivery mp4, the archive master and post.json', async () => {
    expect(post.post.delivery.path).toBe('out/demo/post/final/demo.mp4');
    expect(post.post.archive?.path).toBe('out/demo/post/final/archive.mkv');
    expect(post.post.audio.mode).toBe('linear');
    expect(Math.abs(post.post.audio.after!.i - -14)).toBeLessThanOrEqual(1);
    const arch = await probe(post.archive!);
    expect(arch.audio?.codec).toBe('pcm_s24le');
    expect(arch.video?.colorSpace).toBe('bt709');
  });

  it('qa passes on the final file, swatches included, and writes the contact sheet', async () => {
    report = await runQa(qaOptions(post.delivery));
    const failed = report.checks.filter((c) => !c.passed && !c.info);
    expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
    expect(report.checks.map((c) => c.id)).toEqual(
      expect.arrayContaining(['probe.size', 'probe.fps', 'probe.frames', 'probe.pix_fmt', 'probe.color', 'probe.audio', 'av.duration', 'duration', 'loudness.integrated', 'loudness.truePeak', 'black', 'freeze', 'silence', 'swatches', 'contact']),
    );
    expect(report.contactSheet).toBe('out/demo/qa/final/contact.png');
    expect(existsSync(fromRepo(report.contactSheet!, repo.root))).toBe(true);
    expect(existsSync(join(repo.root, 'out', 'demo', 'qa', 'final', 'report.json'))).toBe(true);
  });

  it('qa passes on the archive master too (24-bit PCM), with its own report', async () => {
    archiveReport = await runQa({ ...qaOptions(post.archive!), expect: { ...qaOptions('').expect, audioCodec: 'pcm_s24le' }, contact: null, name: 'archive' });
    const failed = archiveReport.checks.filter((c) => !c.passed && !c.info);
    expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
    expect(archiveReport.checks.find((c) => c.id === 'probe.audio')!.detail).toMatch(/^pcm_s24le 48000 Hz 2 ch/);
    expect(existsSync(join(repo.root, 'out', 'demo', 'qa', 'final', 'report-archive.json'))).toBe(true);
    // the delivery's expectations (AAC) fail it: the codec is checked, not assumed
    const asDelivery = await runQa({ ...qaOptions(post.archive!), contact: null, outDir: undefined });
    expect(asDelivery.checks.find((c) => c.id === 'probe.audio')!.passed).toBe(false);
  });

  it('the swatch check catches a BT.601 encode tagged as BT.709', async () => {
    const render = JSON.parse(readFileSync(join(repo.root, 'out', 'demo', 'render', 'final', 'render.json'), 'utf8'));
    const bad = join(repo.root, 'out', 'demo', 'post', 'final', 'bad601.mp4');
    // the classic bug, built by hand (the presets never do this): BT.601 matrix, BT.709 tags
    await ffmpeg(['-loglevel', 'error', '-i', fromRepo(render.mezzanine.path, repo.root), '-vf', 'scale=out_color_matrix=bt601:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-c:v', 'libx264', '-crf', '17', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an', bad], 'bad encode');
    const r = await runQa({ ...qaOptions(bad), expect: { width: 320, height: 180, fps: 30, frames: 60, audio: false }, loudness: null, contact: null, outDir: undefined });
    const sw = r.checks.find((c) => c.id === 'swatches')!;
    expect(sw.passed).toBe(false);
    expect(sw.detail).toMatch(/green|red/);
    expect(r.checks.find((c) => c.id === 'probe.color')!.passed).toBe(true);
  });

  it('the preview-hw path (hardware or fallback) keeps colour and tags', async () => {
    const render = JSON.parse(readFileSync(join(repo.root, 'out', 'demo', 'render', 'final', 'render.json'), 'utf8'));
    const out = join(repo.root, 'out', 'demo', 'post', 'final', 'preview.mp4');
    const r = await encodeDelivery({ video: fromRepo(render.mezzanine.path, repo.root), audio: join(repo.root, 'out', 'demo', 'post', 'final', 'audio.wav'), out, preset: 'preview-hw', fps: 30, frames: 60, source: render.color });
    const q = await runQa({ ...qaOptions(out), loudness: null, contact: null, outDir: undefined });
    // the draft profile ships through this path, so it must meet the same ±3 colour bar
    const failed = q.checks.filter((c) => !c.passed && !c.info);
    expect(failed, `${r.encoder}: ${JSON.stringify(failed)}`).toEqual([]);
  });

  it('release refuses a dirty render, then writes a manifest that verifies; tampering fails verify', async () => {
    const renderJson: RenderResult = JSON.parse(readFileSync(join(repo.root, 'out', 'demo', 'render', 'final', 'render.json'), 'utf8'));
    const outDir = join(repo.root, 'out', 'demo', 'release', 'v1');
    const manifestPath = join(repo.root, 'videos', 'demo', 'release', 'v1.json');
    const base = { target, version: 1, renderJson, qa: { delivery: report, archive: archiveReport }, postJson: post.post, outDir, manifestPath };
    // the temp repo is not a git repository: the render, the post and the build tree count as uncommitted
    await expect(writeRelease(base)).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/the render, the post .*, the build tree/) });
    // every released file needs a QA report for its exact bytes: the archive too
    await expect(writeRelease({ ...base, allowDirty: true, qa: { delivery: report } })).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/no QA report .*archive/) });
    await expect(writeRelease({ ...base, allowDirty: true, qa: { delivery: report, archive: report } })).rejects.toMatchObject({ exit: EXIT.REFUSED });
    // a --frames sub-range or an unpinned browser is not a release, unless asked for
    const partial = { ...renderJson, frames: { start: 0, end: 30, count: 30 } };
    await expect(writeRelease({ ...base, allowDirty: true, renderJson: partial })).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/--allow-partial/) });
    const unpinned = { ...renderJson, toolchain: { ...renderJson.toolchain, browser: 'chrome 156.0.0.0 (system, not pinned)' } };
    await expect(writeRelease({ ...base, allowDirty: true, renderJson: unpinned })).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/--allow-unpinned/) });
    expect(existsSync(manifestPath)).toBe(false);

    const m = await writeRelease({ ...base, allowDirty: true });
    expect(m.files.map((f) => f.name)).toEqual(['demo-v1.mp4', 'demo-v1-archive.mkv']);
    expect(m.files[0]).toMatchObject({ role: 'delivery', vcodec: 'h264', acodec: 'aac', width: 320, height: 180, fps: 30, frames: 60, color: { space: 'bt709', primaries: 'bt709', transfer: 'bt709', range: 'tv' } });
    expect(m.files[1]).toMatchObject({ role: 'archive', acodec: 'pcm_s24le', frames: 60 });
    expect(m.audio.lufs).toBeCloseTo(-14, 0);
    // generated (lavfi) tracks read no file
    expect(m.audio.sources).toEqual([]);
    expect(post.post.audio.masterSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(m.qa).toEqual({ passed: true, failed: [] });
    expect(m.post).toMatchObject({ dirty: true, deliveryPreset: 'youtube', encoder: 'libx264', archivePreset: 'archive' });
    expect(m.tree.dirty).toBe(true);
    expect(m.picture).toMatchObject({ frames: 60, durationFrames: 60 });
    expect(JSON.stringify(m)).not.toMatch(/[A-Za-z]:[\\/]|\/tmp\//);

    const again = readManifest(manifestPath);
    expect((await verifyRelease(again, outDir)).passed).toBe(true);
    await expect(writeRelease({ ...base, allowDirty: true })).rejects.toMatchObject({ exit: EXIT.REFUSED });

    const victim = join(outDir, 'demo-v1.mp4');
    const bytes = readFileSync(victim);
    bytes[bytes.length - 100] ^= 0xff;
    writeFileSync(victim, bytes);
    const v = await verifyRelease(again, outDir);
    expect(v.passed).toBe(false);
    expect(v.checks.find((c) => c.name === 'demo-v1.mp4')!.detail).toMatch(/sha256/);
  });

  it('release refuses a stale picture: inputs edited after the render, named, even with --allow-dirty', async () => {
    const renderJson: RenderResult = JSON.parse(readFileSync(join(repo.root, 'out', 'demo', 'render', 'final', 'render.json'), 'utf8'));
    const outDir = join(repo.root, 'out', 'demo', 'release', 'v2');
    const manifestPath = join(repo.root, 'videos', 'demo', 'release', 'v2.json');
    const o = { target, version: 2, renderJson, qa: { delivery: report, archive: archiveReport }, postJson: post.post, outDir, manifestPath, allowDirty: true };
    const extra = repo.write('videos/demo/src/extra.ts', 'export const later = 1;\n');
    await expect(writeRelease(o)).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/picture is stale: .*added videos\/demo\/src\/extra\.ts.*Re-render \(aiv render demo --profile final\)/) });
    rmSync(extra);
    // video.json is no hashed file, but the settings it gives are: an edit there is a stale picture too
    const videoJson = join(repo.root, 'videos', 'demo', 'video.json');
    const video = readFileSync(videoJson);
    writeFileSync(videoJson, JSON.stringify({ ...JSON.parse(video.toString('utf8')), format: { width: 320, height: 180, fps: 25 } }));
    await expect(writeRelease({ ...o, target: resolveTarget('demo', repo.root) })).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/video\.json changed since the render \(format, fps\)/) });
    // a title is no render setting
    writeFileSync(videoJson, JSON.stringify({ ...JSON.parse(video.toString('utf8')), title: 'Retitled' }));
    expect(() => refuseStalePicture(resolveTarget('demo', repo.root), post.post.render.path, renderJson)).not.toThrow();
    writeFileSync(videoJson, video);
    // prose is no input: a README edit leaves the picture releasable
    repo.write('videos/demo/README.md', '# demo\n');
    const inputs = join(repo.root, 'out', 'demo', 'render', 'final', 'inputs.json');
    const saved = readFileSync(inputs);
    rmSync(inputs);
    await expect(writeRelease(o)).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/inputs\.json is missing \(the render predates it\): run aiv render demo --profile final\. A render that is up to date only writes inputs\.json, so post and qa stand/) });
    writeFileSync(inputs, saved);
    expect(existsSync(manifestPath)).toBe(false);
  });

  it('release refuses deliverables made from an older render (re-rendered after post)', async () => {
    repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n');
    const r = await runRender({ target, profile, adapter: fakeAdapter({ frames: 60, swatchFrames: [10, 20] }), log: silentLog(), keepAwake: false, minDiskMB: 1, force: true });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(r.renderJson!.inputHash).not.toBe(post.post.render.inputHash);
    const outDir = join(repo.root, 'out', 'demo', 'release', 'v2');
    const manifestPath = join(repo.root, 'videos', 'demo', 'release', 'v2.json');
    // the old delivery still matches its QA report, but not the render now on disk
    await expect(writeRelease({ target, version: 2, renderJson: r.renderJson!, qa: { delivery: report, archive: archiveReport }, postJson: post.post, outDir, manifestPath, allowDirty: true })).rejects.toMatchObject({
      exit: EXIT.REFUSED,
      message: expect.stringMatching(/changed since post\.json/),
    });
    expect(existsSync(manifestPath)).toBe(false);
  });
});
