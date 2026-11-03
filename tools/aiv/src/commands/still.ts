import { resolve } from 'node:path';
import { EXIT } from '@aiv/core';
import { CHECK_FRAMES, createLog, getProfile, MAX_STILLS, parseFrameList, resolveTarget, runStills } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { engineAdapter } from '../engines.ts';
import { refuseFrozen } from '../frozen.ts';
import { withHeavySlot } from '../heavySlot.ts';

const usage = `usage: aiv still <target> --frames <list> [--profile draft|review|final] [--label <name>] [--entry <path>] [--composition <id>] [--ref <image>] [--check <profile>] [--span] [--browser pinned|system]

Renders chosen frames of a video (videos/<slug>) or a template (template:<engine>) as PNG stills
into out/<slug>/stills/<label>/: f<NNNNN>.png per frame and stills.json (frame hashes, timings,
input hash, engine and toolchain). It never reads or writes a profile's render folder
(out/<slug>/render/**; only --check reads one), so lookdev stills cannot replace a render run.
One engine session renders every frame, each in its own call: on Remotion every call opens a
fresh page (every still is a chunk start); the web engine renders them one after another on the
one page it loaded (the first right after loading). stills.json says which.
It runs as the machine's one heavy job and never waits for the lock (exit 75 while another runs).

  <target>           a video slug or template:<engine>
  --frames <list>    composition frames, test-card leader included (as in frames.sha256):
                     indices and inclusive ranges, e.g. 40,240,300-303 (at most ${MAX_STILLS})
  --profile          draft (half size) · review · final   (default review: full size; with
                     --check, that profile)
  --label <name>     the folder under out/<slug>/stills/ (default: the profile name); the stills
                     an earlier call left there are replaced
  --entry <path>     render another entry file of the video, a path inside its folder (e.g. a
                     lookdev entry src/lookdev/trees.tsx); its composition must have the video's
                     exact format. The input hash still covers the video's src/
  --composition <id> render another composition (Remotion; default: video.json composition)
  --ref <image>      a local reference image: per still, compare-<NNNNN>.png (row 1 the still and
                     the reference centre-cropped to the same aspect, row 2 their blurred value
                     maps with the 8x5 grid, row 3 their 6-colour palettes, matched) and two
                     numbers, reported and never gating:
                       valueGridMAE   mean |difference| of an 8x5 grid of mean Rec.709 luma of
                                      the sRGB-encoded values (0..1)
                       paletteDeltaE  mean CIEDE2000 between the two dominant palettes
                                      (k-means, 6 colours, CIELAB), matched optimally
  --check <profile>  compare each still's sha256 with that profile's finished run
                     (out/<slug>/render/<profile>/frames.sha256): MATCH or MISMATCH per frame.
                     Refused when that run's input hash or render size differs from this tree's.
                     Without --frames: ${CHECK_FRAMES} frames spread over the run that are not chunk starts
                     there (rendered mid-chunk in the run; here, on Remotion as a chunk start, on
                     the web engine after the other stills). A MISMATCH: the frame depends on what
                     was rendered before it
  --span             render the frames, one contiguous range, in ONE call as inside a run's chunk
                     (on Remotion the first opens the page, the rest follow in order): measures
                     the steady cost per frame (timing.steadyMs, the median after the first)
  --browser          web engine: pinned (default) or system

A published or archived video is frozen: it renders only from a checkout of its release tag.

exit: 0 done · 1 error, or a --check MISMATCH · 2 refused (the --check run differs; the
      composition contradicts video.json; the video is frozen) · 3 low memory · 64 usage
      · 75 machine busy: run again`;

export const still: Command = {
  name: 'still',
  summary: 'render chosen frames as full-size PNG stills (own folder), compare with a reference, check their hashes against a finished run',
  usage,
  async run(argv) {
    const { values, positionals } = parse(
      argv,
      {
        frames: { type: 'string' },
        profile: { type: 'string' },
        label: { type: 'string' },
        entry: { type: 'string' },
        composition: { type: 'string' },
        ref: { type: 'string' },
        check: { type: 'string' },
        span: { type: 'boolean', default: false },
        browser: { type: 'string', default: 'pinned' },
      },
      usage,
    );
    if (positionals.length !== 1) usageError('expected exactly one <target>', usage);
    const browser = values.browser;
    if (browser !== 'pinned' && browser !== 'system') usageError(`--browser is pinned or system (got '${browser}')`, usage);
    if (values.frames === undefined && values.check === undefined) usageError('--frames is required (it may be left out with --check)', usage);
    let frames: number[] | undefined;
    if (values.frames !== undefined) {
      try {
        frames = parseFrameList(values.frames);
      } catch (e) {
        usageError((e as Error).message, usage);
      }
    }
    const check = values.check !== undefined ? getProfile(values.check) : undefined;
    const profile = getProfile(values.profile ?? check?.name ?? 'review');
    if (check && check.name !== profile.name) usageError(`--check ${check.name} compares with that profile's run: use --profile ${check.name} or leave --profile out`, usage);
    const target = resolveTarget(positionals[0]);
    await refuseFrozen(target);
    const adapter = await engineAdapter(target.config.engine, { browser });
    const log = createLog('still');

    return withHeavySlot(`still ${target.slug} ${profile.name}`, false, async () => {
      const r = await runStills({
        adapter,
        target,
        profile,
        frames,
        label: values.label,
        entry: values.entry,
        composition: values.composition,
        ref: values.ref !== undefined ? resolve(values.ref) : undefined,
        check,
        span: values.span,
        log,
      });
      if (r.exit === EXIT.OK) log.info(r.message);
      else log.error(r.message);
      return r.exit;
    });
  },
};
