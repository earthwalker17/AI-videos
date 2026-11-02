/**
 * The repository model is consistent: every video.json, series.json, template and release
 * manifest matches its schema; slugs match folders; numbers are unique; series, styles and
 * engines named by a video exist (for a frozen video only its series: it is rebuilt from its tag,
 * so HEAD may retire the styles and engines it used); every video meets the gates of the status
 * it claims; its audio tracks have their inputs (audioIssues).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { audioTrackName, ReleaseManifest, type AudioTrack } from '@aiv/core';
import { LibraryManifest } from '@aiv/pipeline';
import type { Issue } from './files.ts';
import { unmetGates } from '../slot/gates.ts';
import { isFrozen } from '../slot/schema.ts';
import type { RepoModel } from '../slot/repo.ts';
import { STAGE_DOCS } from '../slot/stages.ts';

/**
 * A video's audio inputs, as [file, message] issues: an `audio:<name>` track needs the score
 * (audio/index.ts) and the cue sheet (src/cues.ts); a file track must lie inside the video's own
 * folder (a rebuild from the tag must find it; generated files in out/ never count) and exist,
 * unless it is under media/: those files are gitignored (listed in media/manifest.json), so a
 * fresh clone or CI never has them, and post refuses a missing one where the mix needs it. A
 * library.json must match its schema, sorted (aiv audio --pin writes it that way).
 */
export function audioIssues(root: string, dir: string, tracks: readonly AudioTrack[]): [string, string][] {
  const out: [string, string][] = [];
  const file = `${dir}/video.json`;
  for (const t of tracks) {
    if (t.source.startsWith('lavfi:')) continue;
    if (audioTrackName(t.source) !== null) {
      for (const need of ['audio/index.ts', 'src/cues.ts'])
        if (!existsSync(join(root, dir, need))) out.push([file, `track '${t.source}' needs ${dir}/${need} (${need.startsWith('audio') ? 'the score' : 'the cue sheet it plays to'})`]);
    } else if (t.source === 'out' || t.source.startsWith('out/')) out.push([file, `track '${t.source}' reads generated output: build it with the audio stage (audio:<name>) instead`]);
    else if (!t.source.startsWith(`${dir}/`)) out.push([file, `track '${t.source}' lies outside the video folder: keep its audio files under ${dir}/`]);
    else if (!t.source.startsWith(`${dir}/media/`) && !existsSync(join(root, t.source))) out.push([file, `track '${t.source}' does not exist`]);
  }
  const lib = `${dir}/audio/library.json`;
  if (existsSync(join(root, lib))) {
    try {
      const r = LibraryManifest.safeParse(JSON.parse(readFileSync(join(root, lib), 'utf8')));
      if (!r.success) out.push([lib, r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')]);
    } catch (e) {
      out.push([lib, `not valid JSON: ${(e as Error).message}`]);
    }
  }
  return out;
}

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
    for (const [file, msg] of audioIssues(m.root, l.dir, v.audio?.tracks ?? [])) add(file, msg);
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
