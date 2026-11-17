# Who Routes the Agents?

[![Who Routes the Agents? The film's thumbnail: a Router between three numbered sessions and three Workers, under the title and the tag SUPER-AGENT DESIGN. Click to watch the film on YouTube.](publish/thumbnail.jpg)](https://youtu.be/-b7g5XIgEn0)

An explainer for curious developers on YouTube. Its subject is the DeepSeek Harness team's article
*Exploring Super-agent Design: Towards a More Autonomous Agent System*: the Chinese original appeared
on 2026-10-31, and the English machine translation on 2026-11-01. The article argues that when one
person runs many AI agent sessions, that person quietly becomes their router. Its design hands that
job to a long-lived Router above isolated Workers. A public research prototype builds part of the
design. The research is in [FACTS.md](FACTS.md), with its sources in [sources.jsonl](sources.jsonl). On
YouTube the film is titled *Who Routes the Agents? | DSH Super-agent Architecture Explanation*.

**Series:** [3D Concept Visualizations](../../series/concept-viz/SERIES.md) · **Number:** 4 · **Engine:** web, 1920×1080 at 60 fps
▶ **Watch:** [youtu.be/-b7g5XIgEn0](https://youtu.be/-b7g5XIgEn0) (published 2026-11-17)

## Status: V2, locked
- **V1 was archived unpublished on 2026-11-15.** [V1.md](V1.md) records what it was and what it
  taught.
- **V2** is a fresh remake made with Claude Fable 5.2: a simpler, hierarchical, typographic film,
  English only, no voice, 2:48. The user's brief is in [BRIEF.md](BRIEF.md).
- **The treatment is approved** (2026-11-16): the layer stack, cut on a 120 bpm clock.
  [TREATMENT.md](TREATMENT.md) holds the image system, the arc, the guard rails and the
  do-not-copy lists.
- **The bar** is the 88 s explainer of the same article that the user supplied
  ([the study](../../references/fable-explainer-benchmark-2026-11.md)). Its frames are under
  `.cache/refs/super-agent-v2/`, never in git.
- **The look is chosen (2026-11-17):** at the pilot's look check the user picked phosphor green
  and coral and said to go ahead. The look check is a checkpoint, not a recorded gate.
- **Locked (2026-11-17):** the user approved the review cut ("It's OK, go ahead."). Picture and
  sound are frozen, the test-card leader is removed, and the final is being made from the same
  inputs.
- **The final (2026-11-18)** waits for the user's final approval:
  `out/super-agent/post/final/super-agent.mp4` (1080p60, 2:48.0, no test card; local, never in
  git), with its archive master beside it.
  - It is the approved cut: all 10,080 frames of the final render are bit-identical to the review
    render's frames after its 30-frame test card. `aiv qa` passes (−14.0 LUFS, −3.1 dBTP, no
    unexpected freeze or black, every reading hold). Colour is verified through the review cut's
    swatches; the final has no test card to measure.
  - [`publish/`](publish/) holds the English captions (43, hand-set from the cue sheet, lint
    clean), a proposed title and description, the chapters, the AI-use note and a thumbnail
    candidate (a frame of the film, with its provenance). The texts were audited against
    [FACTS.md](FACTS.md) and the cue sheet, and corrected.
  - Still true: nobody but the user can judge the sound and the cut at speed.
- **The review cut as approved:** `out/super-agent/post/review/super-agent.mp4` (1080p60, 84 bars, 2:48 after a
  half-second test card). Generated outputs are local, never in git.
  - Two passes of review went into it. The first (two frame critics, a first-time viewer with no
    context, a facts auditor, a motion reviewer, each serious finding checked by a verifier) found
    no wrong fact or number; its findings were fixed. A confirm pass on the fixed draft (a second
    first-time viewer, a motion reviewer, a regression critic, then a cold read of four frames)
    found a second, shorter list, also fixed. [TREATMENT.md](TREATMENT.md) lists the departures
    as built.
  - Checked on the review cut: `aiv qa` passes (picture, loudness −14.0 LUFS, true peak
    −3.2 dBTP, reading holds, no unexpected freeze or black); 17 frames re-rendered on a fresh
    page match the render's hashes; frames from the delivery file show no banding or blocking;
    the contact sheet and frames beside the benchmark's were looked at.
  - Not checked: nobody has heard the score or watched the cut at speed. QA lists two moments to
    watch (0:24.6, where the title card's three lines leave together, and 0:51.6, a slow camera
    start). QA's onset detector reads nine of the thirteen hits as 65 to 115 ms late; a high-band
    measure of the same mix puts all thirteen on their frame, so the ear has to settle it.
  - Known weak spots: the cache's "not nothing" loss is still a small event; the swing back to
    the stack before "only the Router answers you" is fast; the evidence charts leave the
    stack's world for about fifteen seconds.
- **Session plan:**
  1. ~~Baseline.~~ Done.
  2. ~~`src/cues.ts` with the full copy and its tests, the kit, an animatic.~~ Done.
  3. ~~The first ~35 s at full craft, stills beside the benchmark, the kill test, style frames.~~
     Done. The user picked phosphor and coral and said go.
  4. ~~Stage sections 4 to 7, then one review round.~~ Done.
  5. ~~The score on the shared audio kit (`audio/index.ts`, the `audio:mix` track).~~ Done; not
     heard yet.
  6. ~~A full draft render and QA, then the review cut at 1080p60.~~ Done (about 70 minutes of
     rendering on this machine, chunked and resumable). The user approved it.
  7. ~~The final and the publish files.~~ Done. Next: the user's final approval and upload,
     then `aiv release`, the tag, and a push only when asked.

## Source
| Path | What it holds |
|---|---|
| `src/cues.ts` | The one timeline: the 120 bpm grid at 60 fps, every on-screen line and when, the score's hits. `cues.test.ts` holds its rules (holds, blocks, one block at a time, reading room) |
| `src/kit/` | The film's renderer: `stage.ts` (WebGL2: shapes, ribbons, glyphs, bloom, sub-frame blur), `type.ts` (the glyph atlas and layout), `draw.ts`, `camera.ts`, `look.ts` (palettes, type scale), `time.ts` |
| `src/scenes/` | `world.ts` (the strata) and one module per section: `flat.ts`, `lift.ts` (also the resting stack), `levels.ts`, then `gates.ts`, `threads.ts`, `batch.ts`, `cache.ts`, `evidence.ts`, `status.ts`, `close.ts`, each a `Section` (`section.ts`) |
| `src/film.ts`, `src/boot.ts` | The camera track and the typesetter; the page's boot. `src/lookdev/` boots the alternative palettes |

## Files
| File | What it holds |
|---|---|
| [BRIEF.md](BRIEF.md) | Audience, promise, shape, references and risks for V2, and the user's V2 brief verbatim |
| [FACTS.md](FACTS.md) | The research by topic: the article, the prototype at `8c32a9d`, the synthetic tests, what is open, terms, reception, and the accuracy traps V1 caught |
| [sources.jsonl](sources.jsonl) | The sources, with URLs, pins and access dates |
| [V1.md](V1.md) | V1 in brief: why it was archived, what worked, what did not, the lessons, and how to take anything from its tag |
| [TREATMENT.md](TREATMENT.md) | The three candidates, the panel, the chosen hybrid, the guard rails, the do-not-copy lists, the critic's rubric for this film |
| [SCRIPT.md](SCRIPT.md), [STORYBOARD.md](STORYBOARD.md), [CREDITS.md](CREDITS.md) | Every word and when (printed from the cue sheet); the fifteen shots; fonts, sources and tools |
| [publish/](publish/) | Captions, the proposed title and description, chapters, the AI-use note, the thumbnail candidate and its provenance |

The fuller research note is [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).
It also covers the reception, name collisions, neighbouring products and attention research.

## V1 at its tag
V1 is complete at the tag `video/super-agent/v1-archived` (commit `b233c67`). The tag holds:
- the code, the score and the publish files;
- the long treatment, script and storyboard;
- the session records;
- the user's approvals of V1's treatment (2026-11-08) and review cut (2026-11-15).

Approvals do not carry over to V2.

```sh
git show video/super-agent/v1-archived:videos/super-agent/<path>   # read one file
git worktree add ../rebuild-super-agent video/super-agent/v1-archived   # rebuild V1 (docs/PRODUCTION.md)
```

V1 never had a release. The user decides V2's release number at release time:
- `aiv release` counts releases, so V2 would be v1 (tag `video/super-agent/v1`), beside V1's
  `v1-archived`, as *A Halloween Gift*'s reworked film was released as v1;
- `--version 2` would match the film's name instead.

## Reproduce it
Once V2 is built:
```sh
pnpm aiv audio super-agent
pnpm aiv render super-agent --profile final
pnpm aiv post super-agent --profile final
pnpm aiv qa super-agent --profile final
```

## Licence
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film itself:
see `video.json` `license` and `CREDITS.md`.

<!-- REUSE-IgnoreStart: third-party names, not notices for this file -->
This film is an independent explainer. It is not affiliated with, sponsored or endorsed by
DeepSeek or the DeepSeek Harness team; their names only identify the work being explained.
The prototype is a research prototype, not an official DeepSeek product.
<!-- REUSE-IgnoreEnd -->
