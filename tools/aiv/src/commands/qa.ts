import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EXIT, ExitError, parseContract, PostResult, RenderResult, type QaReport } from '@aiv/core';
import { createLog, formatQaTable, fromRepo, getProfile, outDir, readGeneratedAudio, repoRel, resolveTarget, runQa, type QaOptions } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { withHeavySlot } from '../heavySlot.ts';

const usage = `usage: aiv qa <target> [--profile draft|review|final] [--file <path>] [--json] [--no-wait]

Checks the FINAL deliverables of out/<slug>/post/<profile>/post.json against their render.json and
video.json: size, fps, frame count, yuv420p, BT.709 tags and limited range, 48 kHz stereo audio
(AAC; 24-bit PCM in the archive master), A/V duration within one frame, loudness (ebur128), the
sample peak (fails above -0.1 dBFS), unexpected black or frozen spans, swatch colours (video.json
qa.swatchFrames, decoded from the final file) and a contact sheet of the delivery. Writes
out/<slug>/qa/<profile>/report.json (+ report-archive.json when post made an archive master) and
contact.png. Look at the sheet.

When the mix used generated audio (post.json audio.generated), its audio.json cue sheet is checked
too: black and hold cues are allowed spans, silence cues must stay under -60 dB, rest cues 20 dB
under the mix, hit onsets are reported against their frame, audio.json's intent checks count, and
audio.png (spectrogram over waveform, every cue marked) is written: look at it, and listen where
the report's "listen" lines say.
Refused (exit 2) when post.json was made from another render than the current render.json, or
from another audio.json than the one on disk, or has no generated-audio record although the mix
(or video.json) uses an audio:<name> track. On a partial render, video.json's allowed spans and
swatch frames (composition frames) move with render.frames.start.

  --file    check another file made from the same render (report-<name>.json)
  --json    print the report(s) as JSON instead of the table
  --no-wait exit 75 at once if another heavy job runs

exit: 0 passed · 1 failed · 2 refused · 3 low memory · 64 usage · 75 busy`;

export const DEFAULT_QA_LOUDNESS = { integrated: -14, tolerance: 1, truePeakMax: -1 };

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;

export const qa: Command = {
  name: 'qa',
  summary: 'verify the final deliverables: probe, colour swatches, loudness, clipping, black/freeze, audio cues, contact and audio sheets',
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { profile: { type: 'string', default: 'review' }, file: { type: 'string' }, json: { type: 'boolean' }, 'no-wait': { type: 'boolean' } }, usage);
    if (positionals.length !== 1) usageError('expected exactly one <target>', usage);
    const target = resolveTarget(positionals[0]);
    const profile = getProfile(values.profile);
    const log = createLog('qa');
    const renderFile = join(outDir(target.slug, 'render', profile.name), 'render.json');
    const postFile = join(outDir(target.slug, 'post', profile.name), 'post.json');
    for (const [f, step] of [
      [renderFile, 'render'],
      [postFile, 'post'],
    ] as const)
      if (!existsSync(f)) throw new ExitError(EXIT.ERROR, `${repoRel(f)} is missing: run aiv ${step} ${target.spec} --profile ${profile.name}`);
    const render = parseContract(RenderResult, readJson(renderFile), repoRel(renderFile));
    const post = parseContract(PostResult, readJson(postFile), repoRel(postFile));
    // judging an old mix against a new render's expectations would pass or fail for the wrong reason
    if (post.render.inputHash !== render.inputHash || post.render.mezzanineSha256 !== render.mezzanine.sha256)
      throw new ExitError(EXIT.REFUSED, `${repoRel(postFile)} was made from another render than ${repoRel(renderFile)} (re-rendered since): run aiv post ${target.spec} --profile ${profile.name} again`);

    const cfg = target.config;
    // generated audio: the cue sheet and intent checks of the audio.json the mix was made from
    // (refused when an audio:<name> track has no such record: the cue checks would be skipped)
    const generated = await readGeneratedAudio(post, render, { tracks: cfg.audio?.tracks });

    const hasAudio = (cfg.audio?.tracks.length ?? 0) > 0;
    if (!cfg.qa?.swatchFrames) log.warn('video.json has no qa.swatchFrames: colour is NOT verified (tags only)');
    const qaDir = outDir(target.slug, 'qa', profile.name);
    const base = {
      expect: { width: render.width, height: render.height, fps: render.fps, frames: render.frames.count, durationS: render.frames.count / render.fps, audio: true },
      // a silent bed has no loudness to judge
      loudness: hasAudio ? (cfg.qa?.loudness ?? DEFAULT_QA_LOUDNESS) : null,
      swatch: cfg.qa?.swatchFrames ? { frames: cfg.qa.swatchFrames } : null,
      allowBlack: cfg.qa?.allowBlack,
      allowFreeze: cfg.qa?.allowFreeze,
      // a partial render starts later in the composition: spans and cues move with it
      startFrame: render.frames.start,
      cues: generated ? { sheet: generated.cues.sheet, intent: generated.checks } : null,
      outDir: qaDir,
      log,
    } satisfies Partial<QaOptions>;
    const contact = { count: 12, cols: 4, tileWidth: Math.min(320, render.width) };

    // the delivery (with the contact and audio sheets) and the archive master (24-bit PCM, no sheets), or one --file
    const jobs: { file: string; opts: Partial<QaOptions> }[] = [];
    if (values.file) {
      const file = resolve(values.file);
      const isArchive = post.archive && repoRel(file) === post.archive.path;
      const name = file.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '');
      jobs.push({ file, opts: isArchive ? { name: 'archive', expect: { ...base.expect, audioCodec: 'pcm_s24le' }, contact: null } : { name, contact, audioSheet: {} } });
    } else {
      jobs.push({ file: fromRepo(post.delivery.path), opts: { contact, audioSheet: {} } });
      if (post.archive) jobs.push({ file: fromRepo(post.archive.path), opts: { name: 'archive', expect: { ...base.expect, audioCodec: 'pcm_s24le' }, contact: null } });
    }
    for (const j of jobs) if (!existsSync(j.file)) throw new ExitError(EXIT.ERROR, `no deliverable at ${repoRel(j.file)}: run aiv post ${target.spec} --profile ${profile.name}`);

    return withHeavySlot(`qa ${target.slug} ${profile.name}`, !values['no-wait'], async () => {
      const reports: QaReport[] = [];
      for (const j of jobs) {
        const report = await runQa({ ...base, ...j.opts, file: j.file });
        reports.push(report);
        if (!values.json) {
          console.log(`[qa] ${report.file} (sha256 ${report.sha256.slice(0, 12)}…)`);
          console.log(formatQaTable(report));
        }
      }
      if (values.json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
      return reports.every((r) => r.passed) ? EXIT.OK : EXIT.ERROR;
    }, { json: values.json });
  },
};
