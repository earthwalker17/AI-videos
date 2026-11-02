---
name: render-verify
description: Render, encode and verify a video or template, and actually look at the result (aiv render, post, qa, contact sheet, frame crops, determinism and resume checks). Use after changing scene or shared rendering code, before saying a render works, and before any review cut or release.
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
5. Judge against `BRIEF.md`, `STORYBOARD.md` and the style; for an outside eye, ask the
   `frame-critic` agent.
6. **Sound.** Read `out/<slug>/qa/<profile>/audio.png` (spectrogram and waveform with the cue
   sheet's events marked): hits on their lines, silences flat, no clipped peaks. The QA checks
   prove levels and timing, not taste: say "not listened" and ask the user to listen at the
   timestamps of the report's `listening` list.
7. Report the profile, frame count, seconds per frame, the QA numbers, what you looked at and
   what you did not check.

## Extra checks
- **Determinism** (after touching shared code, or when something flickers): render
  `--fresh` twice and compare `out/<slug>/render/<profile>/frames.sha256`: identical or a bug.
- **Chunk independence**: save the full render's `frames.sha256`, then `--frames <a>-<b>
  --fresh` must reproduce the same lines. Pick `<a>` that is not a multiple of the profile's
  chunk size (draft 60), so a page really starts at a new frame; otherwise the comparison is
  like with like and proves nothing.
- **Final**: `--profile final --budget-min 9`, repeated until exit 0; then post and qa (the
  delivery and the archive master). Release only from a clean, committed tree.
- **Leader removed for the final** (decision 24): set the cue sheet's `leaderFrames` to 0 and
  remove `qa.swatchFrames`; then prove the final is the approved review cut shifted by the
  leader: line k of the final's `frames.sha256` equals line k + leader of the review's, and the
  score's samples equal the review's from the leader's sample offset on.
- **Thin lines** (twigs, fence bars): before a review cut, render the densest such shot at full
  size with `--frames` and look for shimmer across a few frames; only then decide on extra
  anti-aliasing.
