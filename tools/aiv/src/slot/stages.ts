/**
 * Stage documents: the stubs in templates/_video/ that `aiv new` copies into every video. Each
 * keeps the stub marker (gates.ts STUB_MARKER) until it is written, so `aiv check` can tell a
 * placeholder from a real brief.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** In lifecycle order (docs/PRODUCTION.md). */
export const STAGE_DOCS = ['README.md', 'BRIEF.md', 'TREATMENT.md', 'SCRIPT.md', 'STORYBOARD.md', 'FACTS.md', 'CREDITS.md'] as const;

export interface StageVars {
  title: string;
  slug: string;
  number: number;
  series: string;
  engine: string;
}

/** A stub with its {{placeholders}} filled. Unknown placeholders are left visible on purpose. */
export function stageDoc(root: string, name: string, vars: StageVars): string {
  const text = readFileSync(join(root, 'templates/_video', name), 'utf8');
  return text.replace(/\{\{(\w+)\}\}/g, (all, k: string) => (k in vars ? String(vars[k as keyof StageVars]) : all));
}
