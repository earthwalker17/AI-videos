/**
 * Caption files lint clean: every `publish/captions/<lang>.srt` of a video passes the subtitle
 * linter of its language (@aiv/pipeline lintSrt, the limits in references/subtitles.md). Its
 * errors are issues; its warnings are not (`aiv captions <slug> --lint` prints them), except a
 * file whose name is not a language with a subtitle profile (zh-CN.srt, EN.srt): only its
 * structure could be checked, so it is an issue too. slots() calls this for unfrozen videos
 * only: a frozen video's captions were published as they are.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintSrt, SUBTITLE_PROFILES } from '@aiv/pipeline';
import type { Issue } from './files.ts';

/** The lint errors of the caption files in `dir` (a repo-relative video folder). */
export function captionIssues(root: string, dir: string): Issue[] {
  const folder = join(root, dir, 'publish', 'captions');
  if (!existsSync(folder)) return [];
  const out: Issue[] = [];
  const how = `(aiv captions ${dir.split('/').at(-1)} --lint)`;
  for (const f of readdirSync(folder)
    .filter((n) => n.endsWith('.srt'))
    .sort()) {
    const file = `${dir}/publish/captions/${f}`;
    const r = lintSrt(readFileSync(join(folder, f), 'utf8'), f.slice(0, -'.srt'.length));
    if (!r.profile) out.push({ group: 'captions', file, message: `'${r.lang}' has no subtitle profile, so its lines and reading speed go unchecked: name the file by a language that has one (${Object.keys(SUBTITLE_PROFILES).join(', ')}, or a tag under them such as en-GB), or add a profile ${how}` });
    for (const i of r.issues) if (i.severity === 'error') out.push({ group: 'captions', file, line: i.line, message: `${i.caption ? `caption ${i.caption}: ` : ''}${i.rule}: ${i.message} ${how}` });
  }
  return out;
}
