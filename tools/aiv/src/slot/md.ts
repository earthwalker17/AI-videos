// Just enough Markdown reading for generated indexes: a document's title and its first sentence.
import { existsSync, readFileSync } from 'node:fs';

/** The text of the first `# ` heading, or null. */
export function mdTitle(file: string): string | null {
  if (!existsSync(file)) return null;
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1].trim() : null;
}

const flatten = (p: string) =>
  p
    .replace(/\s*\n\s*/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // emphasis and code marks only: underscores stay (styles/_template, file_names)
    .replace(/[`*]/g, '')
    .trim();

/** a paragraph that says what the document is (not a list, table, quote, label or status line) */
const isProse = (p: string) => p && !/^(#|\||[-*+]\s|\d+\.\s|>|!\[|<|▶)/.test(p) && !/^\*\*[^*\n]+\*\*\s*(\[[A-Z]\])?\s*(\n|$)/.test(p) && !/^status\b/i.test(flatten(p));

/**
 * One or two sentences that say what a document is: the first prose paragraph of its "What it
 * is" section when it has one (reference notes), else of the document. Skips front matter,
 * headings, tables, lists, quotes, code, HTML comments, bold labels and status lines.
 */
export function mdSummary(file: string, max = 180): string {
  if (!existsSync(file)) return '';
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (text.startsWith('---\n')) text = text.slice(text.indexOf('\n---', 4) + 4);
  text = text.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  const section = /^##\s+What it is\s*$/im.exec(text);
  const paras = (section ? text.slice(section.index + section[0].length) : text).split(/\n\s*\n/).map((p) => p.trim());
  const para = paras.find(isProse);
  if (!para) return '';
  // a sentence ends at . ! ? followed by a space or the end, so three.js and remotion.md stay whole
  const sentences = flatten(para).match(/.+?(?:[.!?](?=\s|$)|$)/g) ?? [flatten(para)];
  let out = sentences[0].trim();
  // "Thanks for your interest." says nothing: take the next sentence too
  if (out.length < 40 && sentences[1]) out = `${out} ${sentences[1].trim()}`;
  return out.length > max ? `${out.slice(0, out.lastIndexOf(' ', max - 1)).replace(/[,;:]$/, '')}…` : out;
}
