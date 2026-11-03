---
name: render-verify
description: Render, encode and verify a video or template, and actually look at the result (aiv render, post, qa, contact sheet, motion QA, frame crops, lookdev stills against a reference, determinism and resume checks). Use after changing scene or shared rendering code, before saying a render works, and before any review cut or release.
---

# Render and verify

Targets are a video slug or `template:<engine>`. Heavy commands take the machine-wide lock
themselves; never run two at once.

## The loop
0. After editing frame code: `pnpm lint` (the determinism rules are ESLint rules).
1. `pnpm aiv render <target> --profile draft`
   - exit `75`: budget spent or lock busy. Run the printed `continue with:` command again.
   - exit `2`: inputs changed under an unfinished run. Add `--force` to replace it.
   - exit `3`: low memory. Close something, then continue.
2. Videos with a score (`audio/`): `pnpm aiv audio <slug>` (add `--verify` before a review
   cut). Then `pnpm aiv post <target> --profile draft`.
3. `pnpm aiv qa <target> --profile draft` must end with `QA PASSED`.
4. **Look.** Read `out/<slug>/qa/<profile>/contact.png` (templates: `out/_template-<engine>/…`).
   Extract frames at key moments into a temporary folder outside the repository and read
   them at their full size (draft deliveries are half size; use `review` or `final` for
   1080p detail):
   `ffmpeg -v error -y -ss <seconds> -i out/<slug>/post/<profile>/<slug>.mp4 -frames:v 1 <tmp>/f.png`
   Check text sharpness and size, edges, banding, blank or black frames, colour, framing.
5. **Motion.** Read `out/<slug>/qa/<profile>/motion.png` and the strips in `strips/`; play
   (or extract 12-24 consecutive frames at) each `motion.watch` time and each walk and camera
   move. One still never shows judder, skating feet, boil or a pop.
6. Judge against `BRIEF.md`, `STORYBOARD.md`, the style and any reference images; for an
   outside eye, ask the `frame-critic` agent (give it the references and the motion files).
7. **Sound.** Read `out/<slug>/qa/<profile>/audio.png` (spectrogram and waveform with the cue
   sheet's events marked): hits on their lines, silences flat, no clipped peaks. The QA checks
   prove levels and timing, not taste: say "not listened" and ask the user to listen at the
   timestamps of the report's `listening` list.
8. Report the profile, frame count, seconds per frame, the QA numbers, what you looked at and
   what you did not check.

## Lookdev stills (before a render)
`pnpm aiv still <slug> --frames 0,240 [--entry src/lookdev/<x>.entry.ts --composition <id>]
[--ref <image>] [--label <name>]` writes full-size stills into `out/<slug>/stills/<label>/`
and never touches a render run. With `--ref`, read every `compare-<NNNNN>.png` (still beside
the reference, value maps, palettes) and note `valueGridMAE` and `paletteDeltaE` from
`stills.json`: reported, not gating; the eye decides. `--span` renders a contiguous range in
one call and reports the steady cost per frame (`timing.steadyMs`): measure a heavy scene that
way before committing to it. A lookdev entry's compositions use the video's exact format.

## Extra checks
- **Determinism** (after touching shared code, or when something flickers): render
  `--fresh` twice and compare `out/<slug>/render/<profile>/frames.sha256`: identical or a bug.
- **Chunk independence**: `pnpm aiv still <slug> --check <profile>` renders 12 frames that
  were mid-chunk in that finished run, each on a fresh page (Remotion), and compares their
  hashes with its `frames.sha256`: all MATCH or a bug. It never touches the run (the old
  `aiv render --frames` way replaced it). Name frames with `--frames` to aim at a suspect span.
- **Final**: `--profile final --budget-min 9`, repeated until exit 0; then post and qa (the
  delivery and the archive master). Release only from a clean, committed tree.
- **Leader removed for the final** (decision 24): set the cue sheet's `leaderFrames` to 0 and
  remove `qa.swatchFrames`; then prove the final is the approved review cut shifted by the
  leader: line k of the final's `frames.sha256` equals line k + leader of the review's, and the
  score's samples equal the review's from the leader's sample offset on.
- **Thin lines** (twigs, fence bars): before a review cut, render the densest such shot at full
  size with `--frames` and look for shimmer across a few frames; only then decide on extra
  anti-aliasing.
