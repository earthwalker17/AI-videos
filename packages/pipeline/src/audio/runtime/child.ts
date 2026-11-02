/**
 * The audio stage's child process: `node --import tsx child.ts <job.json>`, one fresh process
 * per render, so nothing a score keeps in module state survives into the next render (--verify
 * renders twice and compares bytes).
 *
 * Before anything else it registers a synchronous module hook (node:module registerHooks; it
 * runs in this thread and sees every ES module tsx loads) that records each file loaded from
 * then on. A .ts file outside a "type": "module" package is compiled to CommonJS by tsx, and
 * its require() calls do not pass that hook, so the CommonJS module cache is added at the end.
 * The runtime and the score are imported only after the hook, so the report lists every file
 * the bytes could depend on, and the stage refuses a score that loaded one the audio input hash
 * does not cover. stdout carries exactly one line, the JSON report: a score's console output is
 * moved to stderr.
 */
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioJob, AudioReport } from './types.ts';

const loaded = new Set<string>();
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      // loaders may tag a URL with a query (?tsx-namespace=…): the file is what counts
      const u = new URL(url);
      u.search = '';
      u.hash = '';
      loaded.add(fileURLToPath(u));
    }
    return nextLoad(url, context);
  },
});

const toStderr = (...args: unknown[]) => console.error(...args);
console.log = toStderr;
console.info = toStderr;
console.debug = toStderr;

const job = JSON.parse(readFileSync(process.argv[2], 'utf8')) as AudioJob;
let report: AudioReport;
try {
  const { runJob } = await import('./render.ts');
  report = { ok: true, ...(await runJob(job)), modules: [] };
} catch (e) {
  report = { ok: false, error: e instanceof Error ? e.message : String(e), tracks: [], reads: [], modules: [] };
}
for (const f of Object.keys(createRequire(import.meta.url).cache)) if (isAbsolute(f)) loaded.add(f);
report.modules = [...loaded].sort();
process.stdout.write(`${JSON.stringify(report)}\n`);
