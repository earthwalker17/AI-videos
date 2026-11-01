// The repository model: slot and series schemas, gates, generated blocks, Markdown summaries.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gatesTable, STUB_MARKER, unmetGates } from './gates.ts';
import { render, SCHEMAS, type Generated } from './generate.ts';
import { mdSummary } from './md.ts';
import { SeriesConfig, VideoSlot, type VideoSlot as Slot } from './schema.ts';

const slot = (over: Partial<Slot> = {}): Slot =>
  VideoSlot.parse({
    schemaVersion: 1,
    number: 3,
    slug: 'my-video',
    title: 'My video',
    series: 'concept-viz',
    status: 'idea',
    approvals: [],
    languages: ['en', 'zh-Hans'],
    styles: [],
    reproducibility: 'full',
    engine: 'web',
    entry: 'src/index.html',
    format: { width: 1920, height: 1080, fps: 30 },
    reusable: [],
    license: { film: 'CC-BY-4.0' },
    youtube: null,
    release: null,
    source: null,
    ...over,
  });

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'aiv-slot-'));
  dirs.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

describe('video.json v1', () => {
  it('accepts a regular slot and a metadata-only record without engine fields', () => {
    expect(slot().number).toBe(3);
    const rec = VideoSlot.safeParse({ ...slot(), engine: undefined, entry: undefined, format: undefined, reproducibility: 'metadata-only', status: 'published' });
    expect(rec.success).toBe(true);
  });

  it('requires engine, entry and format unless metadata-only', () => {
    const r = VideoSlot.safeParse({ ...slot(), engine: undefined });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/engine is required/);
  });

  it('is strict: misspelt keys, bad slugs, bad languages and bad YouTube ids fail', () => {
    expect(VideoSlot.safeParse({ ...slot(), aprovals: [] }).success).toBe(false);
    for (const slug of ['My-Video', 'my_video', '-x', 'x', 'a--b']) expect(VideoSlot.safeParse({ ...slot(), slug }).success, slug).toBe(false);
    expect(VideoSlot.safeParse({ ...slot(), languages: ['english'] }).success).toBe(false);
    expect(VideoSlot.safeParse({ ...slot(), youtube: { id: 'short' } }).success).toBe(false);
  });

  it('series.json: defaults are optional, unknown keys fail', () => {
    const s = { schemaVersion: 1, id: 'festivals', title: 'Festivals', summary: 's', status: 'active', factsRequired: true, defaults: {} };
    expect(SeriesConfig.safeParse(s).success).toBe(true);
    expect(SeriesConfig.safeParse({ ...s, defaults: { fps: 30 } }).success).toBe(false);
  });

  it('every schema exports to JSON Schema', () => {
    for (const s of SCHEMAS) expect(() => render({ path: s.file, content: '' }, null)).not.toThrow();
  });
});

describe('gates', () => {
  const stub = `${STUB_MARKER}: write this -->\n# x\n`;
  const ctx = (dir: string, factsRequired = false) => ({ dir, series: { schemaVersion: 1 as const, id: 'concept-viz', title: 't', summary: 's', status: 'active' as const, factsRequired, defaults: {} } });

  it('idea needs only the README; brief needs BRIEF.md written, not the stub', () => {
    const dir = folder({ 'README.md': stub, 'BRIEF.md': stub });
    expect(unmetGates(slot(), ctx(dir))).toEqual([]);
    expect(unmetGates(slot({ status: 'brief' }), ctx(dir))).toEqual(expect.arrayContaining([expect.stringMatching(/BRIEF.md is still the stub/), expect.stringMatching(/README.md is still the stub/)]));
  });

  it('production needs the user’s treatment approval; review needs facts for factual series', () => {
    const dir = folder({ 'README.md': '# x', 'BRIEF.md': '# b', 'TREATMENT.md': '# t', 'SCRIPT.md': '# s', 'STORYBOARD.md': '# sb', 'src/index.html': '<p>' });
    expect(unmetGates(slot({ status: 'production' }), ctx(dir))).toEqual([expect.stringMatching(/'treatment' approval/)]);
    const approved = { approvals: [{ gate: 'treatment' as const, date: '2026-11-01' }] };
    expect(unmetGates(slot({ status: 'review', ...approved }), ctx(dir, false))).toEqual([]);
    expect(unmetGates(slot({ status: 'review', ...approved }), ctx(dir, true))).toEqual([expect.stringMatching(/FACTS.md is missing/)]);
  });

  it('published needs the final approval, the release manifest and the YouTube id; records need README + id only', () => {
    const dir = folder({ 'README.md': '# x' });
    expect(unmetGates(slot({ status: 'published', reproducibility: 'metadata-only', youtube: { id: 'LDH7UhHeKG4' } }), ctx(dir))).toEqual([]);
    expect(unmetGates(slot({ status: 'published', reproducibility: 'metadata-only' }), ctx(dir))).toEqual([expect.stringMatching(/youtube is null/)]);
    const all = { 'README.md': '# x', 'BRIEF.md': '# b', 'TREATMENT.md': '# t', 'SCRIPT.md': '# s', 'STORYBOARD.md': '# sb', 'CREDITS.md': '# c', 'src/index.html': '<p>' };
    const approvals = (['treatment', 'review', 'final'] as const).map((gate) => ({ gate, date: '2026-11-01' }));
    const v = slot({ status: 'published', approvals, release: { version: 1 }, youtube: { id: 'LDH7UhHeKG4' } });
    expect(unmetGates(v, ctx(folder(all)))).toEqual([expect.stringMatching(/release\/v1.json is missing/)]);
    expect(unmetGates(v, ctx(folder({ ...all, 'release/v1.json': '{}' })))).toEqual([]);
  });

  it('the generated table lists every regular status once, in order', () => {
    const rows = gatesTable().split('\n').slice(2);
    expect(rows.map((r) => /`(\w+)`/.exec(r)?.[1])).toEqual(['idea', 'brief', 'treatment', 'production', 'review', 'locked', 'published']);
  });
});

describe('generated blocks', () => {
  const block: Generated = { path: 'README.md', block: 'catalog', content: '| a |' };

  it('replaces only the marked block and reports a missing marker', () => {
    const doc = 'intro\n<!-- aiv:generated catalog -->\nold\n<!-- /aiv:generated -->\noutro\n';
    expect(render(block, doc)).toBe('intro\n<!-- aiv:generated catalog -->\n| a |\n<!-- /aiv:generated -->\noutro\n');
    expect(render(block, 'no marker\n')).toBeNull();
  });

  it('sets or removes a JSON field and keeps the rest', () => {
    const tsconfig = '{\n  "extends": "./tsconfig.base.json"\n}\n';
    const g: Generated = { path: 'tsconfig.json', jsonField: 'exclude', content: '["videos/a/src"]' };
    expect(JSON.parse(render(g, tsconfig)!)).toEqual({ extends: './tsconfig.base.json', exclude: ['videos/a/src'] });
    expect(JSON.parse(render({ ...g, content: '[]' }, render(g, tsconfig))!)).toEqual({ extends: './tsconfig.base.json' });
  });
});

describe('mdSummary', () => {
  const md = (text: string) => join(folder({ 'x.md': text }), 'x.md');

  it('takes the first prose sentence, skipping status lines, labels, tables and lists', () => {
    expect(mdSummary(md('# T\n\n**Status: active** (M1).\n\n| a |\n|---|\n\nRenders every frame with three.js, see `remotion.md` too. Second.\n'))).toBe('Renders every frame with three.js, see remotion.md too.');
  });

  it("prefers a 'What it is' section and extends a too-short first sentence", () => {
    expect(mdSummary(md('# T\n\n| meta |\n\n## What it is\nA tool for x. More.\n'))).toBe('A tool for x. More.');
    expect(mdSummary(md('# T\n\nThanks. This repository is two things at once, really.\n'))).toBe('Thanks. This repository is two things at once, really.');
  });
});
