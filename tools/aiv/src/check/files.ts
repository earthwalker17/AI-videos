/**
 * File-level checks over everything git would commit (tracked plus untracked-not-ignored files,
 * or only the staged ones): the storage tier (T0 ≤ 2 MiB, no LFS), names that break on some
 * filesystem, private data, provenance of adapted code, and links/commands named in the docs.
 *
 * A line can opt out of the privacy scan with `aiv:allow-private` (test fixtures that must
 * look like a leak). Every rule is a cheap regex: this runs in the pre-commit hook.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { exec } from '@aiv/pipeline';

export interface Issue {
  group: string;
  file?: string;
  line?: number;
  message: string;
}

/** T0: what git may hold. Larger media goes to release assets (T1) with a sha256 manifest. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** keeps a clone under Windows' 260-character limit from a reasonably short folder */
export const MAX_PATH_CHARS = 180;

export async function candidateFiles(root: string, staged: boolean): Promise<string[]> {
  const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  const r = await exec('git', args, { cwd: root, timeoutMs: 60_000 });
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim()}`);
  // deleted-but-unstaged files are still listed by ls-files --cached
  return [...new Set(r.stdout.split('\0').filter(Boolean))].filter((f) => existsSync(join(root, f))).sort();
}

const BINARY = /\.(?:png|jpe?g|gif|webp|avif|ico|bmp|tiff?|psd|exr|hdr|ktx2|basis|mp4|mkv|mov|webm|avi|wav|mp3|flac|ogg|opus|m4a|aac|woff2?|ttf|otf|eot|zip|gz|7z|tar|pdf|glb|blend|fbx|bin|wasm)$/i;
const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function hygiene(root: string, files: readonly string[]): Issue[] {
  const issues: Issue[] = [];
  const lower = new Map<string, string>();
  for (const f of files) {
    const size = statSync(join(root, f)).size;
    if (size > MAX_FILE_BYTES) issues.push({ group: 'files', file: f, message: `${(size / 1048576).toFixed(1)} MiB is over the 2 MiB limit for git: publish it as a release asset (T1) with a sha256 manifest` });
    if (f.length > MAX_PATH_CHARS) issues.push({ group: 'files', file: f, message: `path is ${f.length} characters (max ${MAX_PATH_CHARS})` });
    for (const seg of f.split('/')) {
      if (RESERVED.test(seg)) issues.push({ group: 'files', file: f, message: `'${seg}' is a reserved name on Windows` });
      // eslint-disable-next-line no-control-regex
      if (/[<>:"|?*\u0000-\u001f\\]/.test(seg) || /[ .]$/.test(seg)) issues.push({ group: 'files', file: f, message: `'${seg}' has a character or ending that breaks on Windows` });
    }
    const key = f.toLowerCase();
    const other = lower.get(key);
    if (other) issues.push({ group: 'files', file: f, message: `differs only in case from ${other}: the two collide on Windows and macOS` });
    else lower.set(key, f);
    if (/(?:^|\/)\.env(?:\.|$)/.test(f) && !f.endsWith('.env.example')) issues.push({ group: 'files', file: f, message: 'environment files hold secrets and are never committed (only .env.example)' });
  }
  return issues;
}

/** Placeholder user names that example paths may use. */
const PLACEHOLDER_USER = /^(?:[a-z]|someone|user(?:name)?|you|me|name|example|runner|<[^>]+>|\{[^}]+\}|%USERNAME%|\$USER|\.\.\.|…)$/i;

interface PrivacyRule {
  name: string;
  re: RegExp;
  /** a match is fine when this returns true */
  ok?: (m: RegExpExecArray) => boolean;
}

const PRIVACY: PrivacyRule[] = [
  { name: 'a user profile path', re: /[A-Za-z]:[\\/]+Users[\\/]+([^\\/\s'"`<>|]+)/gi, ok: (m) => PLACEHOLDER_USER.test(m[1]) || /^(?:public|default)$/i.test(m[1]) },
  { name: 'a home folder path', re: /(?<![\w.:])\/(?:home|Users)\/([A-Za-z_][\w.-]*)/g, ok: (m) => PLACEHOLDER_USER.test(m[1]) },
  { name: 'a machine name', re: /\b(?:DESKTOP|LAPTOP)-[A-Z0-9]{6,}\b/g },
  {
    name: 'an e-mail address',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    ok: (m) => /@(?:example\.(?:com|org|net)|users\.noreply\.github\.com)$/i.test(m[0]) || /^(?:noreply@anthropic\.com|git@github\.com)$/i.test(m[0]),
  },
  { name: 'an AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'a GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { name: 'an Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'an OpenAI-style API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { name: 'a Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'a Hugging Face token', re: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { name: 'a Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'a private key', re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
  { name: 'a credential assignment', re: /\b(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*['"][^'"\s$<{]{16,}['"]/gi },
];

const isText = (root: string, f: string): string | null => {
  if (BINARY.test(f)) return null;
  const buf = readFileSync(join(root, f));
  return buf.subarray(0, 8192).includes(0) ? null : buf.toString('utf8');
};

export function privacy(root: string, files: readonly string[]): Issue[] {
  const issues: Issue[] = [];
  for (const f of files) {
    const text = isText(root, f);
    if (text === null) continue;
    const lines = text.split('\n');
    for (const [i, line] of lines.entries()) {
      if (line.includes('aiv:allow-private')) continue;
      for (const rule of PRIVACY) {
        rule.re.lastIndex = 0;
        for (let m = rule.re.exec(line); m; m = rule.re.exec(line)) {
          if (!rule.ok?.(m)) issues.push({ group: 'privacy', file: f, line: i + 1, message: `${rule.name}: '${m[0].slice(0, 48)}'` });
        }
      }
    }
  }
  return issues;
}

// REUSE-IgnoreStart: this function names the SPDX tags it looks for
/** Adapted code keeps its SPDX header and is listed (by full path) in NOTICE.md. */
export function provenance(root: string, files: readonly string[], allFiles: readonly string[]): Issue[] {
  const issues: Issue[] = [];
  const noticeFile = join(root, 'NOTICE.md');
  const notice = existsSync(noticeFile) ? readFileSync(noticeFile, 'utf8') : '';
  for (const f of files) {
    if (!/\.(?:[cm]?[jt]sx?|py|sh|glsl|wgsl|frag|vert)$/.test(f)) continue;
    const head = readFileSync(join(root, f), 'utf8').split('\n').slice(0, 15).join('\n');
    if (!/Adapted from https?:\/\//.test(head)) continue;
    if (!/SPDX-License-Identifier:/.test(head)) issues.push({ group: 'provenance', file: f, message: 'adapted file without an SPDX-License-Identifier header' });
    if (!notice.includes(`\`${f}\``)) issues.push({ group: 'provenance', file: f, message: 'adapted file not listed (by full path) in NOTICE.md' });
  }
  const known = new Set(allFiles);
  for (const m of notice.matchAll(/`((?:packages|engines|tools|templates)\/[^`\s]+)`/g))
    if (!known.has(m[1]) && !existsSync(join(root, m[1]))) issues.push({ group: 'provenance', file: 'NOTICE.md', message: `lists ${m[1]}, which does not exist` });
  return issues;
}
// REUSE-IgnoreEnd

/** Code spans and fenced blocks of a Markdown text (where commands are written). */
function codeText(md: string): string {
  const fences = [...md.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
  const spans = [...md.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  return [...fences, ...spans].join('\n');
}

/**
 * Docs that name an `aiv` command which does not exist, or link to a repository file that does
 * not exist. External links are not fetched (no network in checks).
 */
export function docs(root: string, files: readonly string[], commands: readonly string[]): Issue[] {
  const issues: Issue[] = [];
  const cmds = new Set(commands);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const md = readFileSync(join(root, f), 'utf8');
    for (const m of codeText(md).matchAll(/\baiv ([a-z][a-z-]*)\b/g))
      if (!cmds.has(m[1])) issues.push({ group: 'docs', file: f, message: `names \`aiv ${m[1]}\`, which is not a command (aiv --help)` });
    const prose = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const abs = target.startsWith('/') ? join(root, target) : join(root, dirname(f), target);
      if (!existsSync(abs)) issues.push({ group: 'docs', file: f, message: `links to ${posix.normalize(target)}, which does not exist` });
    }
  }
  return issues;
}
