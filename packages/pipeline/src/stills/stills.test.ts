import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXIT } from '@aiv/core';
import type { EngineAdapter } from '../runner/engine.ts';
import { computeInputHash, renderSettings } from '../runner/inputHash.ts';
import { PROFILES, renderSize, type Profile } from '../runner/profiles.ts';
import { runRender } from '../runner/runner.ts';
import { resolveTarget } from '../runner/target.ts';
import { fakeAdapter, syntheticFrame, tempRepo, type TempRepo } from '../testing.ts';
import { sha256 } from '../util/hash.ts';
import { silentLog } from '../util/log.ts';
import { MAX_SPAN, MIN_ENCODE_FRAMES } from './span.ts';
import {
  checkRefusals,
  chunkStarts,
  compareFrameHashes,
  defaultCheckFrames,
  innerRendering,
  MAX_STILLS,
  parseFrameHashes,
  parseFrameList,
  runStills,
  stillsRendering,
  validateStillsFrames,
  withEntry,
  type CheckRunJson,
  type StillsJson,
} from './stills.ts';

describe('parseFrameList', () => {
  it('reads indices and inclusive ranges, sorted and unique', () => {
    expect(parseFrameList('40,240,300-303')).toEqual([40, 240, 300, 301, 302, 303]);
    expect(parseFrameList(' 5, 3,3-4 ')).toEqual([3, 4, 5]);
    expect(parseFrameList('0')).toEqual([0]);
  });

  it('refuses anything else as a usage error', () => {
    for (const bad of ['', 'a', '5-3', '1,,2', '-1', '1.5', '2-', '1-2-3']) expect(() => parseFrameList(bad), bad).toThrow(expect.objectContaining({ exit: EXIT.USAGE }));
    expect(() => parseFrameList('0-200')).toThrow(/more than 120/);
    expect(() => parseFrameList('0-99,200-220')).toThrow(/more than 120/);
  });

  it('takes up to 240 frames for --span, 120 stills otherwise', () => {
    expect(parseFrameList('0-119')).toHaveLength(MAX_STILLS);
    expect(parseFrameList('15-254', { span: true })).toHaveLength(MAX_SPAN);
    expect(() => parseFrameList('15-255', { span: true })).toThrow(expect.objectContaining({ exit: EXIT.USAGE, message: expect.stringMatching(/--span renders at most 240/) }));
  });
});

describe('validateStillsFrames', () => {
  const frames = (a: number, n: number) => Array.from({ length: n }, (_, k) => a + k);
  const refused = (f: number[] | undefined, o: Parameters<typeof validateStillsFrames>[1]) => {
    try {
      validateStillsFrames(f, o);
    } catch (e) {
      expect((e as { exit?: number }).exit).toBe(EXIT.USAGE);
      return (e as Error).message;
    }
    return null;
  };

  it('refuses --encode and --inner without --span, and an --inner that is not a whole number of at least 1', () => {
    expect(refused(undefined, { encode: true })).toMatch(/--encode needs --span/);
    expect(refused(frames(0, 30), { inner: 2 })).toMatch(/--inner needs --span/);
    for (const n of [0, -1, 1.5]) expect(refused(undefined, { span: true, inner: n }), String(n)).toMatch(/--inner takes a whole number/);
    expect(refused(undefined, { span: true, encode: true, inner: 3 })).toBeNull();
  });

  it('caps stills at 120 and a span at 240 contiguous frames', () => {
    expect(refused(frames(0, 120), {})).toBeNull();
    expect(refused(frames(0, 121), {})).toMatch(/more than 120 stills/);
    expect(refused(frames(15, 240), { span: true, encode: true, inner: 3 })).toBeNull();
    expect(refused(frames(15, 241), { span: true })).toMatch(/at most 240/);
    expect(refused([10, 12], { span: true })).toMatch(/--frames 10-12 has gaps/);
  });

  it('needs one motion window for --encode and fewer --inner frames than the span has after its first', () => {
    expect(refused(frames(0, 11), { span: true, encode: true })).toMatch(/at least 12 frames .*has 11/);
    expect(refused(frames(0, 12), { span: true, encode: true })).toBeNull();
    expect(refused(frames(0, 10), { span: true, inner: 9 })).toBeNull();
    expect(refused(frames(0, 10), { span: true, inner: 10 })).toMatch(/--inner 10: a span of 10 frames has 9/);
    expect(refused(frames(0, 1), { span: true, inner: 1 })).toMatch(/has 0/);
  });
});

describe('innerRendering', () => {
  it('calls an inner frame a chunk start only on Remotion', () => {
    expect(innerRendering('remotion')).toMatch(/opens a fresh page \(Remotion\), so each is a chunk start/);
    expect(innerRendering('web')).toMatch(/no fresh page, no chunk start/);
    expect(innerRendering('fake')).not.toMatch(/chunk|page/);
  });
});

describe('defaultCheckFrames', () => {
  it('spreads 12 frames over the run, never on a chunk start (+7 off one)', () => {
    // halloween-gift draft: 1452 frames in chunks of 60; the first pick (60) is a chunk start
    expect(defaultCheckFrames([0, 1452], 60)).toEqual([67, 181, 302, 423, 544, 665, 786, 907, 1028, 1149, 1270, 1391]);
  });

  it('counts the first frame of a partial run as a chunk start', () => {
    const frames = defaultCheckFrames([35, 100], 10);
    const starts = chunkStarts([35, 100], 10);
    expect([...starts]).toEqual([35, 40, 50, 60, 70, 80, 90]);
    expect(frames).toHaveLength(12);
    for (const f of frames) {
      expect(f).toBeGreaterThanOrEqual(35);
      expect(f).toBeLessThan(100);
      expect(starts.has(f)).toBe(false);
    }
    expect(new Set(frames).size).toBe(frames.length);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
  });

  it('returns fewer frames for a short run, none for a run of chunk starts only', () => {
    expect(defaultCheckFrames([0, 3], 60)).toEqual([1, 2]);
    expect(defaultCheckFrames([1332, 1333], 120)).toEqual([]);
    expect(defaultCheckFrames([0, 40], 10)).toHaveLength(12);
  });
});

describe('frame hashes', () => {
  const h = (c: string) => c.repeat(64);
  it('parses frames.sha256 (LF or CRLF) and compares stills with it', () => {
    const map = parseFrameHashes(`0 ${h('a')}\r\n1 ${h('b')}\n\n7 ${h('c')}\n`);
    expect([...map]).toEqual([
      [0, h('a')],
      [1, h('b')],
      [7, h('c')],
    ]);
    expect(
      compareFrameHashes(
        [
          { i: 1, sha256: h('b') },
          { i: 7, sha256: h('d') },
          { i: 9, sha256: h('e') },
        ],
        map,
      ),
    ).toEqual([
      { i: 1, sha256: h('b'), expected: h('b'), match: true },
      { i: 7, sha256: h('d'), expected: h('c'), match: false },
      { i: 9, sha256: h('e'), expected: null, match: false },
    ]);
    expect(() => parseFrameHashes(`0 ${h('a')}\nnot a line\n`)).toThrow(/line 2/);
  });
});

const profile: Profile = { ...PROFILES.draft, chunkFrames: 10 };
let repo: TempRepo;
afterEach(() => repo?.cleanup());

describe('checkRefusals', () => {
  it('names the render size, the settings and the files that differ', () => {
    repo = tempRepo();
    const target = resolveTarget('demo', repo.root);
    const adapter = fakeAdapter({ frames: 40 });
    const size = renderSize(target.config.format, profile);
    const settings = renderSettings(target, profile, size);
    const before = computeInputHash({ target, adapter, settings });
    const run: CheckRunJson = { inputHash: before.hash, settings, frames: [0, 40], durationFrames: 40, info: {} };
    expect(checkRefusals(run, size, before, settings, null)).toEqual([]);
    expect(checkRefusals(run, { width: 320, height: 180 }, before, settings, null)[0]).toMatch(/160x90.*320x180/);

    repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n');
    const after = computeInputHash({ target, adapter, settings });
    const inputs = { schemaVersion: 1 as const, inputHash: before.hash, header: before.header, roots: before.declaredRoots, files: before.inputs };
    const why = checkRefusals(run, size, after, settings, inputs).join('; ');
    expect(why).toMatch(/input hash .* differs/);
    expect(why).toContain('changed videos/demo/src/index.ts');

    const other = renderSettings(target, PROFILES.review, size);
    expect(checkRefusals(run, size, { ...after, hash: 'x' }, other, null).join('; ')).toMatch(/settings differ: profile "draft" → "review", chunkFrames 10 → 120/);
  });
});

describe('withEntry', () => {
  it('replaces the entry and composition in a copy, and drops the film-only swatch frames', () => {
    repo = tempRepo({ composition: 'Main', qa: { swatchFrames: [0, 12] } });
    repo.write('videos/demo/src/lookdev/trees.tsx', 'export const trees = 1;\n');
    const target = resolveTarget('demo', repo.root);
    expect(withEntry(target)).toBe(target);
    expect(withEntry(target, 'src/index.ts', 'Main')).toBe(target);
    const t = withEntry(target, 'src/lookdev/trees.tsx', 'Trees');
    expect(t.config.entry).toBe('src/lookdev/trees.tsx');
    expect(t.config.composition).toBe('Trees');
    expect(t.config.qa?.swatchFrames).toBeUndefined();
    expect(t.config.format).toEqual(target.config.format);
    expect(target.config.entry).toBe('src/index.ts');
    expect(withEntry(target, '.\\src\\lookdev\\trees.tsx').config.entry).toBe('src/lookdev/trees.tsx');
    for (const bad of ['../other/src/index.ts', 'src/../../x.ts', 'C:/x.ts', '/abs.ts', 'src/missing.tsx']) expect(() => withEntry(target, bad), bad).toThrow(expect.objectContaining({ exit: EXIT.USAGE }));
    expect(() => withEntry(target, undefined, 'has space')).toThrow(expect.objectContaining({ exit: EXIT.USAGE }));
  });
});

describe('stillsRendering', () => {
  it('calls a still a chunk start only where every call opens a fresh page (Remotion)', () => {
    const remotion = stillsRendering('remotion');
    expect(remotion.freshPage).toBe(true);
    expect(remotion.rendering).toMatch(/fresh page \(Remotion\), so each is a chunk start/);
    expect(remotion.mismatch).toMatch(/where a chunk began/);
    // the web engine renders every call on the page it loaded once
    const web = stillsRendering('web');
    expect(web.freshPage).toBe(false);
    expect(web.rendering).toMatch(/on the one page the session loaded.*no chunk start/);
    expect(web.rendering).not.toMatch(/so each is a chunk start/);
    expect(web.mismatch).toMatch(/frames rendered before them on the page/);
    expect(web.mismatch).not.toMatch(/chunk/);
    // any other engine: only what holds for all
    for (const s of [stillsRendering('fake'), stillsRendering('blender')]) {
      expect(s.freshPage).toBe(false);
      expect(`${s.rendering} ${s.mismatch}`).not.toMatch(/chunk|page/);
    }
  });
});

/** The fake engine, but the first frame of every renderFrames call differs: a chunk-start bug. */
function warmUpBug(frames: number): EngineAdapter {
  const base = fakeAdapter({ frames });
  return {
    ...base,
    async open(ctx) {
      const s = await base.open(ctx);
      const inner = s.renderFrames!;
      s.renderFrames = (range, onFrame) =>
        inner(range, async (i, rgba, meta) => {
          if (i === range[0]) {
            const copy = Uint8Array.from(rgba);
            copy[0] ^= 1;
            return onFrame(i, copy, meta);
          }
          return onFrame(i, rgba, meta);
        });
      return s;
    },
  };
}

describe('runStills', () => {
  const base = () => {
    repo = tempRepo();
    const target = resolveTarget('demo', repo.root);
    return { target, opts: { target, profile, log: silentLog(), abortFreeMB: 0 } };
  };
  const readStills = (dir: string) => JSON.parse(readFileSync(join(dir, 'stills.json'), 'utf8')) as StillsJson;

  it('writes PNG stills with the runner frame hashes into their own folder, never into render/', async () => {
    const { opts } = base();
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runStills({ ...opts, adapter, frames: [3, 17] });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(r.dir).toBe(join(repo.root, 'out', 'demo', 'stills', 'draft'));
    expect(readdirSync(r.dir).sort()).toEqual(['f00003.png', 'f00017.png', 'stills.json']);
    expect(existsSync(join(repo.root, 'out', 'demo', 'render'))).toBe(false);
    const j = readStills(r.dir);
    expect(j.frames.map((f) => [f.i, f.sha256, f.file])).toEqual([
      [3, sha256(syntheticFrame(3, 160, 90, false)), 'f00003.png'],
      [17, sha256(syntheticFrame(17, 160, 90, false)), 'f00017.png'],
    ]);
    expect([j.width, j.height, j.profile, j.label, j.entry, j.durationFrames]).toEqual([160, 90, 'draft', 'draft', 'src/index.ts', 40]);
    const settings = renderSettings(opts.target, profile, { width: 160, height: 90 }, undefined, adapter.settings);
    expect(j.inputHash).toBe(computeInputHash({ target: opts.target, adapter, settings }).hash);
    // one session, one call per still
    expect(adapter.opened).toBe(1);
    expect(adapter.rendered).toEqual([3, 17]);
    expect(JSON.stringify(j)).not.toContain(repo.root.replace(/\\/g, '/'));

    // a second call with the same label replaces the stills of the first
    const again = await runStills({ ...opts, adapter, frames: [5] });
    expect(again.exit, again.message).toBe(EXIT.OK);
    expect(readdirSync(again.dir).sort()).toEqual(['f00005.png', 'stills.json']);
  });

  it('--span renders a contiguous range in one call, as inside a chunk, and reports the steady pace', async () => {
    const { opts } = base();
    // the first frame of each call differs: a span's interior frames are the run's mid-chunk pixels
    const r = await runStills({ ...opts, adapter: warmUpBug(40), frames: [10, 11, 12, 13], span: true, label: 'span' });
    expect(r.exit, r.message).toBe(EXIT.OK);
    const j = readStills(r.dir);
    expect(j.frames.map((f) => f.i)).toEqual([10, 11, 12, 13]);
    expect(j.frames[0].sha256).not.toBe(sha256(syntheticFrame(10, 160, 90, false)));
    expect(j.frames.slice(1).map((f) => f.sha256)).toEqual([11, 12, 13].map((i) => sha256(syntheticFrame(i, 160, 90, false))));
    expect(typeof j.timing.steadyMs).toBe('number');
    expect(j.rendering).toMatch(/one renderFrames\(\[a, b\+1\]\) call/);
    expect(r.message).toMatch(/s\/frame \(median, in one call\)/);
    const gaps = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), frames: [10, 12], span: true, label: 'gaps' });
    expect(gaps.exit).toBe(EXIT.USAGE);
    expect(gaps.message).toMatch(/has gaps/);
  });

  it('--inner renders frames inside the span again, each in its own call: MATCH, or MISMATCH (exit 1) where a call start differs', async () => {
    const { opts } = base();
    const adapter = fakeAdapter({ frames: 40 });
    const ok = await runStills({ ...opts, adapter, frames: [10, 11, 12, 13, 14, 15], span: true, inner: 3, label: 'inner' });
    expect(ok.exit, ok.message).toBe(EXIT.OK);
    // one span call, then one call per inner frame (innerFrames: never the span's first)
    expect(adapter.rendered).toEqual([10, 11, 12, 13, 14, 15, 11, 13, 15]);
    const j = readStills(ok.dir);
    expect(j.inner).toEqual({
      rendering: innerRendering('fake'),
      frames: [11, 13, 15].map((i) => ({ i, sha256: sha256(syntheticFrame(i, 160, 90, false)), expected: sha256(syntheticFrame(i, 160, 90, false)), match: true, ms: 0 })),
      matched: 3,
      mismatched: 0,
    });
    expect(j.encode).toBeUndefined();
    expect(ok.message).toMatch(/inner check: all 3 MATCH the span \(frames 11, 13, 15\)/);

    // the first frame of every call differs: each inner frame starts its call, so all differ
    const bad = await runStills({ ...opts, adapter: warmUpBug(40), frames: [10, 11, 12, 13, 14, 15], span: true, inner: 2, label: 'inner' });
    expect(bad.exit).toBe(EXIT.ERROR);
    expect(bad.message).toMatch(/inner check: 2 of 2 MISMATCH the span \(frames 12, 14; inner-f00012\.png, inner-f00014\.png\): those frames depend on what the engine rendered before them/);
    const jb = readStills(bad.dir);
    expect(jb.inner).toMatchObject({ matched: 0, mismatched: 2 });
    expect(jb.inner!.frames.map((f) => [f.i, f.match, f.file])).toEqual([
      [12, false, 'inner-f00012.png'],
      [14, false, 'inner-f00014.png'],
    ]);
    expect(existsSync(join(bad.dir, 'inner-f00012.png'))).toBe(true);

    // refused before the engine opens: --inner without --span, or as many as the span has frames
    const idle = fakeAdapter({ frames: 40 });
    expect((await runStills({ ...opts, adapter: idle, frames: [3, 4, 5], inner: 1 })).message).toMatch(/--inner needs --span/);
    expect((await runStills({ ...opts, adapter: idle, frames: [3, 4, 5], span: true, inner: 3 })).exit).toBe(EXIT.USAGE);
    expect((await runStills({ ...opts, adapter: idle, frames: [3, 4, 5], encode: true })).exit).toBe(EXIT.USAGE);
    expect((await runStills({ ...opts, adapter: idle, frames: [3, 4, 5], span: true, encode: true })).message).toMatch(/at least 12 frames/);
    expect(idle.opened).toBe(0);
  });

  it('--encode writes the clip, the preview, the contact sheet and motion QA into the stills folder only', { timeout: 120_000 }, async () => {
    const { opts } = base();
    // full size (320x180) through the review preset (libx264): the draft preset may pick a hardware encoder
    const review: Profile = { ...PROFILES.review, chunkFrames: 10 };
    const adapter = fakeAdapter({ frames: 40 });
    const span = Array.from({ length: MIN_ENCODE_FRAMES }, (_, k) => 8 + k);
    const r = await runStills({ ...opts, profile: review, adapter, frames: span, span: true, encode: true, inner: 1, label: 'motion' });
    expect(r.exit, r.message).toBe(EXIT.OK);
    const names = readdirSync(r.dir);
    for (const f of ['span.mkv', 'span.mp4', 'contact.png', 'motion.png', 'motion.json', 'stills.json', 'f00008.png', 'f00019.png']) expect(names, f).toContain(f);
    expect(names.filter((f) => /\.part\.|\.tiles$|graph\.txt$/.test(f))).toEqual([]);
    expect(existsSync(join(repo.root, 'out', 'demo', 'render'))).toBe(false);
    expect(existsSync(join(repo.root, 'out', 'demo', 'qa'))).toBe(false);
    const j = readStills(r.dir);
    const e = j.encode!;
    expect(e).toMatchObject({
      firstFrame: 8,
      frames: 12,
      fps: 30,
      files: { clip: 'span.mkv', preview: 'span.mp4', contact: 'contact.png', motionSheet: 'motion.png', motionJson: 'motion.json' },
      clip: { decodedMatch: true },
      preview: { preset: 'youtube', encoder: 'libx264', pixFmt: 'yuv420p', color: { space: 'bt709', primaries: 'bt709', transfer: 'bt709', range: 'tv' } },
      motion: { source: 'out/demo/stills/motion/span.mkv' },
    });
    expect(e.motion.checks.map((c) => c.id)).toEqual(['motion.cadence', 'motion.flash', 'motion.pop', 'motion.boil', 'motion.watch']);
    for (const s of e.files.strips) expect(existsSync(join(r.dir, s)), s).toBe(true);
    expect(Object.values(e.timing).every((t) => typeof t === 'number' && t >= 0)).toBe(true);
    expect(j.inner).toMatchObject({ matched: 1, mismatched: 0 });
    expect(r.message).toMatch(/encoded in .* s: span\.mkv \(lossless, decodes to the span's hashes\), span\.mp4 \(youtube, libx264\), contact\.png, motion\.png/);
    // the motion measure saw the clip's 12 frames
    const motion = JSON.parse(readFileSync(join(r.dir, 'motion.json'), 'utf8')) as { series: { d: number[] }; lossy: boolean };
    expect(motion.series.d).toHaveLength(12);
    expect(motion.lossy).toBe(false);

    // a later call with the same label leaves none of the encode files behind
    const again = await runStills({ ...opts, profile: review, adapter, frames: [5], label: 'motion' });
    expect(again.exit, again.message).toBe(EXIT.OK);
    expect(readdirSync(again.dir).sort()).toEqual(['f00005.png', 'stills.json']);
  });

  it('refuses frames outside the composition and needs frames without --check', async () => {
    const { opts } = base();
    const r = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), frames: [39, 40] });
    expect(r.exit).toBe(EXIT.USAGE);
    expect(r.message).toMatch(/40 are outside the composition's 40 frames/);
    // the folder this failed call created is gone again; a failing engine start leaves none either
    expect(existsSync(r.dir)).toBe(false);
    expect((await runStills({ ...opts, adapter: fakeAdapter({ frames: 40, failOpen: true }), frames: [1] })).exit).toBe(EXIT.ERROR);
    expect(existsSync(r.dir)).toBe(false);
    expect((await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }) })).exit).toBe(EXIT.USAGE);
    expect((await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), frames: [1], label: '../x' })).exit).toBe(EXIT.USAGE);
  });

  it('--check: MATCH for a deterministic engine, MISMATCH for one whose chunk starts differ', async () => {
    const { opts } = base();
    const r0 = await runRender({ target: opts.target, profile, adapter: fakeAdapter({ frames: 40 }), log: silentLog(), keepAwake: false, minDiskMB: 1 });
    expect(r0.exit, r0.message).toBe(EXIT.OK);
    const renderJson = join(r0.dir, 'render.json');
    const before = statSync(renderJson).mtimeMs;

    const ok = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), check: profile, label: 'check' });
    expect(ok.exit, ok.message).toBe(EXIT.OK);
    const j = readStills(ok.dir);
    // the default frames: spread over the run, none a chunk start (0, 10, 20, 30)
    expect(j.frames.map((f) => f.i)).toEqual(defaultCheckFrames([0, 40], 10));
    expect(j.frames.every((f) => f.check?.match && !f.check.chunkStartInRun)).toBe(true);
    expect(j.check).toMatchObject({ profile: 'draft', run: 'out/demo/render/draft', matched: 12, mismatched: 0 });
    expect(ok.message).toMatch(/all 12 MATCH/);

    const bad = await runStills({ ...opts, adapter: warmUpBug(40), check: profile, frames: [5, 6], label: 'check' });
    expect(bad.exit).toBe(EXIT.ERROR);
    expect(bad.message).toMatch(/2 of 2 MISMATCH \(frames 5, 6\): those frames depend on what the engine rendered before them/);
    // stills.json says how the stills were rendered, for this engine
    expect(readStills(bad.dir).rendering).toBe(stillsRendering('fake').rendering);
    expect(readStills(bad.dir).frames.map((f) => f.check?.match)).toEqual([false, false]);
    // the run was only read
    expect(statSync(renderJson).mtimeMs).toBe(before);
  });

  it('--check refuses (exit 2) a run of other inputs or another size, before the engine opens', async () => {
    const { opts } = base();
    const r0 = await runRender({ target: opts.target, profile, adapter: fakeAdapter({ frames: 40 }), log: silentLog(), keepAwake: false, minDiskMB: 1 });
    expect(r0.exit, r0.message).toBe(EXIT.OK);
    repo.write('videos/demo/src/index.ts', 'export const scene = 3;\n');
    const adapter = fakeAdapter({ frames: 40 });
    const r = await runStills({ ...opts, adapter, check: profile });
    expect(r.exit).toBe(EXIT.REFUSED);
    expect(r.message).toMatch(/rendered from other inputs.*changed videos\/demo\/src\/index\.ts.*--force/);
    expect(adapter.opened).toBe(0);
    // another profile than the run's is a usage error; a missing run is refused
    expect((await runStills({ ...opts, adapter, check: PROFILES.review })).exit).toBe(EXIT.USAGE);
    expect((await runStills({ ...opts, profile: PROFILES.review, adapter, check: PROFILES.review })).exit).toBe(EXIT.REFUSED);
    // the same inputs again: comparable
    repo.write('videos/demo/src/index.ts', 'export const scene = 1;\n');
    const out = await runStills({ ...opts, adapter, check: profile, frames: [3] });
    expect(out.exit, out.message).toBe(EXIT.OK);
  });

  it('--check against a partial run compares like for like and only within its frames', async () => {
    const { opts } = base();
    const r0 = await runRender({ target: opts.target, profile, adapter: fakeAdapter({ frames: 40 }), range: [15, 32], log: silentLog(), keepAwake: false, minDiskMB: 1 });
    expect(r0.exit, r0.message).toBe(EXIT.OK);
    const outside = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), check: profile, frames: [14, 20] });
    expect(outside.exit).toBe(EXIT.USAGE);
    expect(outside.message).toMatch(/frames 14 are not in the draft run \(frames 15-31\)/);
    const ok = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), check: profile });
    expect(ok.exit, ok.message).toBe(EXIT.OK);
    const picked = readStills(ok.dir).frames.map((f) => f.i);
    expect(picked).toEqual(defaultCheckFrames([15, 32], 10));
    // 15 (the run's first frame), 20 and 30 started chunks there
    expect(picked.some((i) => i === 15 || i === 20 || i === 30)).toBe(false);
    expect(picked.length).toBe(12);
  });

  it('--ref: a compare sheet per still and numbers near 0 against the same picture', async () => {
    const { opts } = base();
    const first = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), frames: [12], label: 'src' });
    expect(first.exit, first.message).toBe(EXIT.OK);
    const ref = join(repo.root, 'ref.png');
    copyFileSync(join(first.dir, 'f00012.png'), ref);
    const r = await runStills({ ...opts, adapter: fakeAdapter({ frames: 40 }), frames: [12, 30], label: 'cmp', ref });
    expect(r.exit, r.message).toBe(EXIT.OK);
    expect(readdirSync(r.dir).sort()).toEqual(['compare-00012.png', 'compare-00030.png', 'f00012.png', 'f00030.png', 'stills.json']);
    const j = readStills(r.dir);
    expect(j.reference).toMatchObject({ file: 'ref.png', width: 160, height: 90, crop: { w: 160, h: 90, x: 0, y: 0 } });
    expect(j.reference!.palette.length).toBeGreaterThan(0);
    const [same, other] = j.frames.map((f) => f.compare!);
    expect(same.valueGridMAE).toBe(0);
    expect(same.paletteDeltaE).toBe(0);
    expect(same.palette.map((p) => p.hex)).toEqual(j.reference!.palette.map((p) => p.hex));
    expect(other.valueGridMAE).toBeGreaterThan(0);
    expect(other.matched.length).toBe(Math.min(other.palette.length, j.reference!.palette.length));
    expect(r.message).toMatch(/mean valueGridMAE/);
    // a missing reference is a usage error, found before the engine opens
    const adapter = fakeAdapter({ frames: 40 });
    expect((await runStills({ ...opts, adapter, frames: [1], ref: join(repo.root, 'nope.png') })).exit).toBe(EXIT.USAGE);
    expect(adapter.opened).toBe(0);
  });
});
