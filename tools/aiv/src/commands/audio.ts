import { createLog, repoRel, resolveTarget, runAudioStage } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { refuseFrozen } from '../frozen.ts';
import { withHeavySlot } from '../heavySlot.ts';

const usage = `usage: aiv audio <slug> [--verify] [--pin] [--json]

The audio stage: runs the video's score, videos/<slug>/audio/index.ts (default export
defineScore({ tracks }) from @aiv/pipeline/audio), against its cue sheet src/cues.ts in a fresh
Node process, and writes out/<slug>/audio/: <name>.wav per track (48 kHz stereo float: silence
under the test-card leader, then the film) and audio.json (input hash, per-file hashes, peak,
loudness, intent checks). video.json mixes a track with {"source": "audio:<name>"}; post and
release refuse it once its inputs change. Intent checks: with a musical grid every cut is on a
bar line; every text/card cue is held max(1.8 s, reading time + 0.6 s) per language; every card
lasts 4 s or more. A failed check still writes the tracks, then exits 1.

A score may load only its own audio/ folder, src/cues.ts, @aiv/core and @aiv/pipeline/audio
(everything the audio input hash covers): another repo file is refused. Sample-library files
are read through ctx.library(id), verified against audio/library.json.

  <slug>     a video slug
  --verify   render twice, in two fresh processes, and require byte-identical tracks
  --pin      record every library file the score reads (path, bytes, sha256) in
             audio/library.json (each library's id, repo, commit and licence must be listed
             there first); a file missing from the store is copied from the library's
             aiv.local.json librarySeeds checkout only when git confirms it is at that commit,
             unmodified; without --pin, reading an unpinned file is an error
  --json     print audio.json to stdout (progress goes to stderr)

A published or archived video is frozen: its score runs only from a checkout of its release tag.
Runs as the machine's one heavy job, with the usual free-memory guard (minFreeMB), and never
waits for the lock. The score's process gets almost no environment.

exit: 0 ok · 1 error, a failed intent check, or --verify found different bytes · 2 refused
      (the score loaded an unhashed file or ran on another checkout's runtime, or the video is
      frozen) · 3 low memory · 64 usage
      · 75 machine busy: run again`;

export const audio: Command = {
  name: 'audio',
  summary: "build a video's audio tracks from its score and cue sheet (deterministic, verified, pinned samples)",
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { verify: { type: 'boolean' }, pin: { type: 'boolean' }, json: { type: 'boolean' } }, usage);
    if (positionals.length !== 1) usageError('expected exactly one <slug>', usage);
    const target = resolveTarget(positionals[0]);
    await refuseFrozen(target);
    const json = !!values.json;
    const log = createLog('audio', { infoToStderr: json });
    const say = (line: string) => (json ? console.error(line) : console.log(line));
    return withHeavySlot(
      `audio ${target.slug}`,
      false,
      async () => {
        const r = await runAudioStage({ slug: target.spec, root: target.root, verify: values.verify, pin: values.pin, log });
        const a = r.result;
        for (const t of a.tracks)
          say(`  ${t.name}  ${t.samples} samples (${(t.samples / a.sampleRate).toFixed(3)} s) · peak ${t.peakDb.toFixed(1)} dBFS · ${t.loudness ? `${t.loudness.i.toFixed(1)} LUFS` : 'silent'} · sha256 ${t.sha256.slice(0, 12)}`);
        for (const c of a.checks) say(`  ${c.info ? 'info' : c.passed ? 'PASS' : 'FAIL'}  ${c.id.padEnd(12)} ${c.detail}`);
        for (const w of a.warnings) log.warn(w);
        if (json) console.log(JSON.stringify(a, null, 2));
        log.info(`wrote ${repoRel(r.audioJsonPath, target.root)}${a.verified ? ' (verified: two fresh renders, identical bytes)' : ''}`);
        if (r.failed.length) log.error(`${r.failed.length} intent check(s) failed: ${r.failed.map((c) => c.id).join(', ')}`);
        else log.info(`next: aiv post ${target.spec} --profile <draft|review|final>`);
        return r.exit;
      },
      { json },
    );
  },
};
