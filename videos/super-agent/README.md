# Who Routes the Agents?

An explainer for curious developers on YouTube. Its subject is the DeepSeek Harness team's article
*Exploring Super-agent Design: Towards a More Autonomous Agent System*: the Chinese original appeared
on 2026-10-31, and the English machine translation on 2026-11-01. The article argues that when one
person runs many AI agent sessions, that person quietly becomes their router. Its design hands that
job to a long-lived Router above isolated Workers. A public research prototype builds part of the
design. The research is done: [FACTS.md](FACTS.md), with its sources in [sources.jsonl](sources.jsonl).
The title is a working title.

**Series:** [3D Concept Visualizations](../../series/concept-viz/SERIES.md) · **Number:** 4 · **Engine:** web, 1920×1080 at 60 fps
▶ **Watch:** not yet published.

## Status: V2, in production
- **V1 was archived unpublished on 2026-11-15.** [V1.md](V1.md) records what it was and what it
  taught.
- **V2** is a fresh remake made with Claude Fable 5.2: a simpler, hierarchical, typographic film,
  English only, no voice, about 2:40. The user's brief is in [BRIEF.md](BRIEF.md).
- **The treatment is approved** (2026-11-16): the layer stack, cut on a 120 bpm clock.
  [TREATMENT.md](TREATMENT.md) holds the image system, the arc, the guard rails and the
  do-not-copy lists.
- **The bar** is the 88 s explainer of the same article that the user supplied
  ([the study](../../references/fable-explainer-benchmark-2026-11.md)). Its frames are under
  `.cache/refs/super-agent-v2/`, never in git.
- **The look is chosen (2026-11-17):** at the pilot's look check the user picked phosphor green
  and coral and said to go ahead. The look check is a checkpoint, not a recorded gate.
- **Where it stands (2026-11-17):** sections 1 to 3 are staged (bars 1 to 24); sections 4 to 7
  are being staged, one module each (`src/scenes/section.ts` is their contract).
  - The pilot (bars 1 to 17 as first shown) passed QA at 1080p60. A context-free viewer judged
    our frames and the benchmark's to be different films (closeness 3 and 4 out of 10). The frame
    critic's first pass was "partial"; its fixes were applied.
  - Found after the pilot and fixed: a headline that followed another on the same beat rose over
    it for a third of a second. A line now leaves before the next block lands (`out` in the cue
    sheet), and the reading-time tests count that shorter stay.
- **Session plan:**
  1. ~~Baseline.~~ Done.
  2. ~~`src/cues.ts` with the full copy and its tests, the kit, an animatic.~~ Done.
  3. ~~The first ~35 s at full craft, stills beside the benchmark, the kill test, style frames.~~
     Done. The user picked phosphor and coral and said go.
  4. Stage sections 4 to 7 (the four answers, evidence, status, close), then one review round
     (critic, context-free viewer, facts auditor).
  5. The score on the shared audio kit (`audio/index.ts`, the `audio:mix` track).
  6. The review cut at 1080p60 (about 45 minutes of rendering), SCRIPT, STORYBOARD and the claims
     table in FACTS, the user's review approval.
  7. The final, CREDITS and the publish files, the user's upload, then `aiv release`.

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
| SCRIPT, STORYBOARD, CREDITS | Template stubs until V2 writes them |

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
