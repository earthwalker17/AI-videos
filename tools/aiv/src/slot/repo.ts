/**
 * The repository as data: video slots, series, templates, styles, knowledge cards, engines and
 * packages, read from disk in a stable order. A file that fails its schema becomes an issue,
 * not an exception, so one bad video.json never hides the state of the others.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { VideoConfig } from '@aiv/core';
import type { z } from 'zod';
import { mdSummary, mdTitle } from './md.ts';
import { SeriesConfig, VideoSlot } from './schema.ts';

export interface Loaded<T> {
  /** folder name (the slug or id it must match) */
  name: string;
  /** repo-relative folder */
  dir: string;
  /** repo-relative file that was parsed */
  file: string;
  data: T | null;
  error: string | null;
}

export interface Entry {
  id: string;
  /** repo-relative path of its main document */
  path: string;
  title: string;
  summary: string;
}

export interface PackageEntry {
  name: string;
  path: string;
  description: string;
}

export interface RepoModel {
  root: string;
  videos: Loaded<VideoSlot>[];
  series: Loaded<SeriesConfig>[];
  /** templates/<engine>/video.json; `name` is the engine */
  templates: Loaded<VideoConfig>[];
  styles: Entry[];
  knowledge: Entry[];
  engines: Entry[];
  packages: PackageEntry[];
}

const dirs = (abs: string): string[] =>
  existsSync(abs)
    ? readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort()
    : [];

function load<S extends z.ZodType>(root: string, dir: string, name: string, fileName: string, schema: S): Loaded<z.infer<S>> | null {
  const file = `${dir}/${name}/${fileName}`;
  const abs = join(root, file);
  if (!existsSync(abs)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    return { name, dir: `${dir}/${name}`, file, data: null, error: `not valid JSON: ${(e as Error).message}` };
  }
  const r = schema.safeParse(raw);
  return r.success
    ? { name, dir: `${dir}/${name}`, file, data: r.data, error: null }
    : { name, dir: `${dir}/${name}`, file, data: null, error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') };
}

/** Folders under `dir` holding `doc`, as entries titled by the document's first heading. */
function docEntries(root: string, dir: string, doc: string, skip: (name: string) => boolean = () => false): Entry[] {
  return dirs(join(root, dir))
    .filter((n) => !skip(n) && existsSync(join(root, dir, n, doc)))
    .map((n) => {
      const path = `${dir}/${n}/${doc}`;
      return { id: n, path, title: mdTitle(join(root, path)) ?? n, summary: mdSummary(join(root, path)) };
    });
}

export interface LoadOptions {
  /** keep only these video and series folders (repo-relative, e.g. 'videos/<slug>'): the pre-commit check passes the tracked ones */
  only?: (relDir: string) => boolean;
}

export function loadRepo(root: string, o: LoadOptions = {}): RepoModel {
  const keep = o.only ?? (() => true);
  const videos: Loaded<VideoSlot>[] = [];
  for (const n of dirs(join(root, 'videos')).filter((n) => keep(`videos/${n}`))) {
    // a folder without video.json is a broken slot, reported by the caller
    videos.push(load(root, 'videos', n, 'video.json', VideoSlot) ?? { name: n, dir: `videos/${n}`, file: `videos/${n}/video.json`, data: null, error: 'video.json is missing' });
  }
  const series = dirs(join(root, 'series'))
    .filter((n) => keep(`series/${n}`))
    .map((n) => load(root, 'series', n, 'series.json', SeriesConfig) ?? { name: n, dir: `series/${n}`, file: `series/${n}/series.json`, data: null, error: 'series.json is missing' });
  // templates/_video holds stage stubs, not an engine scaffold
  const templates = dirs(join(root, 'templates'))
    .filter((n) => !n.startsWith('_'))
    .map((n) => load(root, 'templates', n, 'video.json', VideoConfig))
    .filter((t): t is Loaded<VideoConfig> => t !== null);

  const knowledgeDir = join(root, 'knowledge');
  const knowledge: Entry[] = existsSync(knowledgeDir)
    ? readdirSync(knowledgeDir)
        .filter((f) => f.endsWith('.md') && f !== 'README.md' && statSync(join(knowledgeDir, f)).isFile())
        .sort()
        .map((f) => {
          const path = `knowledge/${f}`;
          return { id: f.slice(0, -3), path, title: mdTitle(join(root, path)) ?? f, summary: mdSummary(join(root, path)) };
        })
    : [];

  const packages: PackageEntry[] = [];
  for (const group of ['packages', 'engines', 'tools'])
    for (const n of dirs(join(root, group))) {
      const pj = join(root, group, n, 'package.json');
      if (!existsSync(pj)) continue;
      const p = JSON.parse(readFileSync(pj, 'utf8')) as { name?: string; description?: string };
      if (p.name) packages.push({ name: p.name, path: `${group}/${n}`, description: p.description ?? '' });
    }

  return {
    root,
    videos,
    series,
    templates,
    styles: docEntries(root, 'styles', 'STYLE.md', (n) => n.startsWith('_')),
    knowledge,
    engines: docEntries(root, 'engines', 'ENGINE.md'),
    packages,
  };
}

/** The @aiv/* packages a video's source imports (scans src/ text; cheap and good enough for "used by"). */
export function importedPackages(root: string, videoDir: string): string[] {
  const src = join(root, videoDir, 'src');
  if (!existsSync(src)) return [];
  const found = new Set<string>();
  const walk = (abs: string) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(join(abs, e.name));
      } else if (/\.(?:[cm]?[jt]sx?|html)$/.test(e.name)) {
        for (const m of readFileSync(join(abs, e.name), 'utf8').matchAll(/['"](@aiv\/[a-z0-9-]+)/g)) found.add(m[1]);
      }
    }
  };
  walk(src);
  return [...found].sort();
}
