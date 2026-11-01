/**
 * The repository model is consistent: every video.json, series.json, template and release
 * manifest matches its schema; slugs match folders; numbers are unique; series, styles and
 * engines named by a video exist (for a frozen video only its series: it is rebuilt from its tag,
 * so HEAD may retire the styles and engines it used); every video meets the gates of the status
 * it claims.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReleaseManifest } from '@aiv/core';
import type { Issue } from './files.ts';
import { unmetGates } from '../slot/gates.ts';
import { isFrozen } from '../slot/schema.ts';
import type { RepoModel } from '../slot/repo.ts';
import { STAGE_DOCS } from '../slot/stages.ts';

export function slots(m: RepoModel): Issue[] {
  const issues: Issue[] = [];
  const add = (file: string, message: string) => issues.push({ group: 'slots', file, message });
  const series = new Map(m.series.filter((s) => s.data).map((s) => [s.data!.id, s.data!]));
  const styles = new Set(m.styles.map((s) => s.id));
  const engines = new Set(m.engines.map((e) => e.id));

  for (const s of m.series) {
    if (!s.data) add(s.file, s.error!);
    else if (s.data.id !== s.name) add(s.file, `id '${s.data.id}' does not match its folder '${s.name}'`);
    if (!existsSync(join(m.root, s.dir, 'SERIES.md'))) add(`${s.dir}/SERIES.md`, 'missing: every series has a written guide');
  }

  const numbers = new Map<number, string>();
  for (const l of m.videos) {
    if (!l.data) {
      add(l.file, l.error!);
      continue;
    }
    const v = l.data;
    if (v.slug !== l.name) add(l.file, `slug '${v.slug}' does not match its folder '${l.name}'`);
    const twin = numbers.get(v.number);
    if (twin) add(l.file, `number ${v.number} is also used by ${twin}`);
    numbers.set(v.number, l.dir);
    if (v.series !== null && !series.has(v.series)) add(l.file, `series '${v.series}' does not exist (series/${v.series}/series.json)`);
    const frozen = isFrozen(v.status);
    if (!frozen) for (const st of v.styles) if (!styles.has(st)) add(l.file, `style '${st}' does not exist (styles/${st}/STYLE.md)`);
    if (!frozen && v.engine && v.reproducibility !== 'metadata-only' && !engines.has(v.engine)) add(l.file, `engine '${v.engine}' does not exist (engines/${v.engine}/ENGINE.md)`);
    for (const msg of unmetGates(v, { dir: join(m.root, l.dir), series: v.series ? (series.get(v.series) ?? null) : null })) add(l.dir, `status '${v.status}' needs: ${msg}`);
    const relDir = join(m.root, l.dir, 'release');
    if (existsSync(relDir))
      for (const f of readdirSync(relDir).filter((x) => /^v\d+\.json$/.test(x))) {
        let raw: unknown;
        try {
          raw = JSON.parse(readFileSync(join(relDir, f), 'utf8'));
        } catch (e) {
          add(`${l.dir}/release/${f}`, `not valid JSON: ${(e as Error).message}`);
          continue;
        }
        const r = ReleaseManifest.safeParse(raw);
        if (!r.success) add(`${l.dir}/release/${f}`, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
        else if (r.data.slug !== v.slug) add(`${l.dir}/release/${f}`, `manifest is for '${r.data.slug}'`);
      }
  }

  for (const t of m.templates) {
    if (!t.data) {
      add(t.file, t.error!);
      continue;
    }
    if (t.data.engine !== t.name) add(t.file, `engine '${t.data.engine}' does not match the template folder '${t.name}'`);
    if (t.data.slug !== `template-${t.name}`) add(t.file, `slug should be 'template-${t.name}'`);
    if (!engines.has(t.name)) add(t.file, `no engines/${t.name}/ENGINE.md for this template`);
    if (!existsSync(join(m.root, t.dir, 'README.md'))) add(`${t.dir}/README.md`, 'missing');
  }
  for (const d of STAGE_DOCS) if (!existsSync(join(m.root, 'templates/_video', d))) add(`templates/_video/${d}`, 'missing: aiv new copies it into every video');
  return issues;
}
