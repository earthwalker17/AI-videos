import { EXIT } from '@aiv/core';
import { createLog, getProfile, repoRel, resolveTarget, runPost } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { withHeavySlot } from '../heavySlot.ts';

const usage = `usage: aiv post <target> [--profile draft|review|final] [--no-wait]

Reads out/<slug>/render/<profile>/render.json + its mezzanine and video.json's audio tracks;
writes out/<slug>/post/<profile>/: <slug>.mp4 (the profile's delivery preset), archive.mkv
(final only), audio.wav (the mastered bed) and post.json. The audio is mixed at 48 kHz stereo
to the picture's exact length and loudness-normalised in two passes (default -14 LUFS).

  <target>     a video slug (videos/<slug>) or template:<engine>
  --profile    default review
  --no-wait    exit 75 at once if another heavy job runs

exit: 0 ok · 1 error · 3 low memory · 64 usage · 75 busy`;

export const post: Command = {
  name: 'post',
  summary: 'mix + master the audio and encode the deliverables from a finished render',
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { profile: { type: 'string', default: 'review' }, 'no-wait': { type: 'boolean' } }, usage);
    if (positionals.length !== 1) usageError('expected exactly one <target>', usage);
    const target = resolveTarget(positionals[0]);
    const profile = getProfile(values.profile);
    const log = createLog('post');
    return withHeavySlot(`post ${target.slug} ${profile.name}`, !values['no-wait'], async () => {
      const r = await runPost({ target, profile, log });
      log.info(`delivery ${r.post.delivery.path} (${(r.post.delivery.bytes / 2 ** 20).toFixed(1)} MB, ${r.post.delivery.preset} via ${r.post.delivery.encoder})`);
      if (r.post.archive) log.info(`archive  ${r.post.archive.path} (${(r.post.archive.bytes / 2 ** 20).toFixed(1)} MB)`);
      for (const w of r.post.warnings) log.warn(w);
      log.info(`wrote ${repoRel(r.postJsonPath)} · next: aiv qa ${target.spec} --profile ${profile.name}`);
      return EXIT.OK;
    });
  },
};
