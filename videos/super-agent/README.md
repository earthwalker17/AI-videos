# Who Routes the Agents?

An explainer for curious developers on YouTube. Its subject is the DeepSeek Harness team's article
*Exploring Super-agent Design: Towards a More Autonomous Agent System*: the Chinese original appeared
on 2026-10-31, and the English machine translation on 2026-11-01. The article argues that when one
person runs many AI agent sessions, that person quietly becomes their router. Its design hands that
job to a long-lived Router above isolated Workers. A public research prototype builds part of the
design. The research is done: [FACTS.md](FACTS.md), with its sources in [sources.jsonl](sources.jsonl).
The title is a working title.

**Series:** [Science & Technology Explainers](../../series/science-explainers/SERIES.md) · **Number:** 4 · **Engine:** remotion (V1's choice, kept as a placeholder because `video.json` needs one; V2 chooses, and sets `engine`, `entry`, `composition` and `format` with it)
▶ **Watch:** not yet published.

## Status: V2, at the brief
- **V1 was archived unpublished on 2026-11-15.** Its final was made and passed QA. The user chose not
  to publish it, because newer films on similar topics made with Claude Fable 5.2 look much better.
  [V1.md](V1.md) records what V1 was and what it taught.
- **V2** remakes the film with Claude Fable 5.2. The user gives V2's brief and references at the start
  of V2's first session. That session plans V2 as a whole.
- **Settled:** the subject and its research, the series, the licence (the film is CC BY 4.0), and the
  repository's quality bars.
- **Open:** the narrative, the look, the engine, the length, voice or none, whether there is a score
  and its form, any Chinese in the picture, and the session plan. The platform was YouTube for V1;
  confirm it for V2. [BRIEF.md](BRIEF.md) lists what still holds and quotes the
  user's original briefs, which are guidance, not doctrine.
- **Next:**
  1. Read this folder's README, BRIEF, FACTS and V1, then the user's V2 brief.
  2. Write that brief and its references into BRIEF.md.
  3. Plan V2 as a whole, and put the session plan here, at most about 15 lines.
  4. Write three structurally different treatments in TREATMENT.md, then stop for the user's
     treatment approval ([PRODUCTION.md](../../docs/PRODUCTION.md)).

  Before the critic judges V2's lookdev, calibrate it
  ([frame-critic.md](../../.claude/agents/frame-critic.md), Calibration): V1's rejected stills
  and its final look are rebuilt only from their commits.

## Files
| File | What it holds |
|---|---|
| [BRIEF.md](BRIEF.md) | Audience, promise, shape, references and risks for V2, and the user's original briefs verbatim |
| [FACTS.md](FACTS.md) | The research by topic: the article, the prototype at `8c32a9d`, the synthetic tests, what is open, terms, reception, and the accuracy traps V1 caught |
| [sources.jsonl](sources.jsonl) | The sources, with URLs, pins and access dates |
| [V1.md](V1.md) | V1 in brief: why it was archived, what worked, what did not, the lessons, and how to take anything from its tag |
| TREATMENT, SCRIPT, STORYBOARD, CREDITS | Template stubs until V2 writes them |

The fuller research note is [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).
It also covers the reception, name collisions, neighbouring products and attention research.

## V1 at its tag
V1 is complete at the local tag `video/super-agent/v1-archived` (commit `b233c67`). The tag stays
local until the user asks for a push. The tag holds:
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
pnpm aiv audio super-agent            # if V2 has a score (audio/)
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
