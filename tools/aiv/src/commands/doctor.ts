import { EXIT } from '@aiv/core';
import { repoRoot } from '@aiv/pipeline';
import { parse, type Command } from '../command.ts';
import { SECTIONS, type DoctorItem } from '../doctor/index.ts';

const usage = `usage: aiv doctor [--fix] [--json]

Checks the environment: Node and pnpm against the repo pins, ffmpeg and the encoders/filters
the pipeline needs, Python/uv (advisory), PATH traps, free memory and disk, the heavy-job lock
and engine sections (browser, GPU path). Every problem comes with its fix.

  --fix    repair what can be repaired in place: install the pinned Chrome for Testing into
           .cache/browsers (about 170 MB download) and Remotion's Chrome Headless Shell into
           node_modules/.remotion (about 120 MB download)
  --json   print the results as JSON

exit: 0 nothing failed (warnings allowed) · 1 something failed`;

const MARK: Record<DoctorItem['status'], string> = { ok: ' ok ', warn: 'WARN', fail: 'FAIL', info: 'info' };

export const doctor: Command = {
  name: 'doctor',
  summary: 'check the toolchain, ffmpeg capabilities, PATH traps, memory, disk and engines',
  usage,
  async run(argv) {
    const { values } = parse(argv, { json: { type: 'boolean' }, fix: { type: 'boolean' } }, usage);
    const root = repoRoot();
    const results: { title: string; items: DoctorItem[] }[] = [];
    for (const s of SECTIONS) {
      let items: DoctorItem[];
      try {
        items = await s.run({ root, fix: values.fix });
      } catch (e) {
        items = [{ status: 'fail', label: 'check crashed', detail: (e as Error).message }];
      }
      results.push({ title: s.title, items });
      if (!values.json) {
        console.log(`\n${s.title}`);
        for (const i of items) {
          console.log(`  ${MARK[i.status]}  ${i.label.padEnd(18)} ${i.detail}`);
          if (i.fix && i.status !== 'ok') console.log(`        ${''.padEnd(18)} fix: ${i.fix}`);
        }
      }
    }
    const all = results.flatMap((r) => r.items);
    const failed = all.filter((i) => i.status === 'fail').length;
    const warned = all.filter((i) => i.status === 'warn').length;
    if (values.json) console.log(JSON.stringify(results, null, 2));
    else console.log(`\n${failed ? `${failed} failed` : 'nothing failed'}${warned ? `, ${warned} warning(s)` : ''}`);
    return failed ? EXIT.ERROR : EXIT.OK;
  },
};
