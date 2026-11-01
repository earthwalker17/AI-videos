import { readFileSync } from 'node:fs';
import { EXIT, ExitError } from '@aiv/core';
import { createLog, exec, getProfile, repoRel, resolveTarget, runRender, type FrameSpan, type Target } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { engineAdapter } from '../engines.ts';
import { withHeavySlot } from '../heavySlot.ts';

const usage = `usage: aiv render <target> [--profile draft|review|final] [--frames a-b] [--budget-min N] [--force | --fresh] [--browser pinned|system]

Renders a video (videos/<slug>) or a template (template:<engine>) with the engine its video.json
names, into out/<slug>/render/<profile>/: run.json, chunks/ (per-frame sha256), the lossless
mezzanine (FFV1 RGB), frames.sha256 and render.json. Chunked and resumable: a call that uses up
its budget exits 75 and prints the command that continues. A run whose inputs, settings, frames
or engine host changed is refused (exit 2) unless --force replaces it. It runs as the machine's
one heavy job and never waits for the lock (exit 75 while another heavy job runs).

  <target>        a video slug or template:<engine>
  --profile       draft (half size, quick preview encode) · review · final   (default review)
  --frames a-b    only frames a to b, inclusive (a partial render cannot be released)
  --budget-min N  minutes per call, boot included (decimals allowed); exit 75 when the next chunk
                  would not fit. Default: no budget
  --force         replace the existing run if it differs; an unchanged run just continues, so
                  repeating a --force call makes progress
  --fresh         always discard the existing run and start over (determinism checks)
  --browser       web engine: pinned (default: Chrome for Testing in .cache/browsers) or system
                  (the installed Chrome; not pinned, warned, not releasable by default)

A published or archived video is frozen: it renders only from a checkout of its release tag
video/<slug>/v<N> (docs/PRODUCTION.md, 'Rebuild a frozen video'), never at a later commit.

exit: 0 done · 1 error · 2 refused (an existing run differs: see --force; the composition
      contradicts video.json; or the video is frozen) · 3 low memory · 64 usage
      · 75 budget used or machine busy: run the printed command`;

/** A frozen video renders only at its release tag: at a later commit the shared code has moved on. */
async function refuseFrozen(target: Target): Promise<void> {
  if (target.kind !== 'video') return;
  const status = (JSON.parse(readFileSync(target.configPath, 'utf8')) as { status?: string }).status;
  if (status !== 'published' && status !== 'archived') return;
  const r = await exec('git', ['tag', '--points-at', 'HEAD'], { cwd: target.root, timeoutMs: 30_000 });
  if (r.stdout.split(/\r?\n/).some((t) => t.startsWith(`video/${target.slug}/v`))) return;
  throw new ExitError(EXIT.REFUSED, `${target.slug} is ${status}, so it is frozen: rebuild it from a worktree at its tag video/${target.slug}/v<N> (docs/PRODUCTION.md, 'Rebuild a frozen video'), not at this commit`);
}

function frameRange(v: string | undefined): FrameSpan | undefined {
  if (v === undefined) return undefined;
  const m = /^(\d+)-(\d+)$/.exec(v);
  if (!m || Number(m[2]) < Number(m[1])) usageError(`--frames takes a-b with a ≤ b (got '${v}')`, usage);
  return [Number(m[1]), Number(m[2]) + 1];
}

export const render: Command = {
  name: 'render',
  summary: 'render a video or template with its engine into a lossless mezzanine + render.json (chunked, resumable)',
  usage,
  async run(argv) {
    const { values, positionals } = parse(
      argv,
      {
        profile: { type: 'string', default: 'review' },
        frames: { type: 'string' },
        'budget-min': { type: 'string' },
        force: { type: 'boolean' },
        fresh: { type: 'boolean' },
        browser: { type: 'string', default: 'pinned' },
      },
      usage,
    );
    if (positionals.length !== 1) usageError('expected exactly one <target>', usage);
    if (values.force && values.fresh) usageError('--force and --fresh exclude each other (--fresh always starts over)', usage);
    const browser = values.browser;
    if (browser !== 'pinned' && browser !== 'system') usageError(`--browser is pinned or system (got '${browser}')`, usage);
    let budgetS = 0;
    if (values['budget-min'] !== undefined) {
      const n = Number(values['budget-min']);
      if (!(n > 0)) usageError(`--budget-min takes a positive number of minutes (got '${values['budget-min']}')`, usage);
      budgetS = n * 60;
    }
    const range = frameRange(values.frames);
    const target = resolveTarget(positionals[0]);
    await refuseFrozen(target);
    const profile = getProfile(values.profile);
    const adapter = await engineAdapter(target.config.engine, { browser });
    const log = createLog('render');
    // the call that continues a stopped run: never --force/--fresh, which would restart it
    const resume = [
      'pnpm aiv render',
      target.spec,
      `--profile ${profile.name}`,
      ...(values.frames ? [`--frames ${values.frames}`] : []),
      ...(values['budget-min'] ? [`--budget-min ${values['budget-min']}`] : []),
      ...(browser !== 'pinned' ? [`--browser ${browser}`] : []),
    ].join(' ');

    return withHeavySlot(`render ${target.slug} ${profile.name}`, false, async () => {
      const r = await runRender({ adapter, target, profile, range, budgetS, force: values.force, fresh: values.fresh, log });
      if (r.exit === EXIT.OK) {
        log.info(r.message);
        const rj = r.renderJson;
        if (rj) log.info(`${rj.frames.count} frames ${rj.width}x${rj.height} @ ${rj.fps} fps · ${rj.mezzanine.codec} ${(rj.mezzanine.bytes / 2 ** 20).toFixed(1)} MB · ${rj.timing.wallS} s render time · next: aiv post ${target.spec} --profile ${profile.name}`);
      } else {
        log.error(r.message);
        if (r.exit === EXIT.AGAIN || r.exit === EXIT.LOW_MEMORY) log.info(`${r.chunksDone}/${r.chunksTotal} chunks in ${repoRel(r.dir)} · continue with: ${resume}`);
      }
      return r.exit;
    });
  },
};
