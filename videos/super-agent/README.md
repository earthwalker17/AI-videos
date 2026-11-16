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
- **Session plan:**
  1. Baseline: this commit.
  2. `src/cues.ts` with the full copy and its tests, the kit, a grey-box animatic at 540p.
  3. The first ~30 s at full craft, stills beside the benchmark, the kill test, style frames in
     three palettes. **Then stop for the user's look check** (a checkpoint, not a recorded gate).
  4. The full cut at draft size and one review round (critic, context-free viewer, facts auditor).
  5. The score on the shared audio kit.
  6. The review cut at 1080p60, the claims table completed, the user's review approval.
  7. The final, the publish files, the user's upload, then `aiv release`.

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
