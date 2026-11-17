# Who Routes the Agents?

[![Who Routes the Agents? The film's thumbnail: a Router between three numbered sessions and three Workers, under the title and the tag SUPER-AGENT DESIGN. Click to watch the film on YouTube.](publish/thumbnail.jpg)](https://youtu.be/-b7g5XIgEn0)

An explainer for curious developers on YouTube. Its subject is the DeepSeek Harness team's article
*Exploring Super-agent Design: Towards a More Autonomous Agent System*: the Chinese original appeared
on 2026-10-31, and the English machine translation on 2026-11-01. The article argues that when one
person runs many AI agent sessions, that person quietly becomes their router. Its design hands that
job to a long-lived Router above isolated Workers. A public research prototype builds part of the
design. The research is in [FACTS.md](FACTS.md), with its sources in [sources.jsonl](sources.jsonl). On
YouTube the film is titled *Who Routes the Agents? | DSH Super-agent Architecture Explanation*.

**Series:** [Science & Technology Explainers](../../series/science-explainers/SERIES.md) · **Number:** 4 · **Engine:** web, 1920×1080 at 60 fps
▶ **Watch:** [youtu.be/-b7g5XIgEn0](https://youtu.be/-b7g5XIgEn0) (published 2026-11-17)

## Status: published
Published on YouTube on 2026-11-17 at 18:30 UTC
([youtu.be/-b7g5XIgEn0](https://youtu.be/-b7g5XIgEn0)) as release v2
([release/v2.json](release/v2.json)): the delivery `super-agent-v2.mp4` (1920×1080 at 60 fps,
84 bars at 120 bpm, 10,080 frames, 2:48.0, H.264 and AAC, BT.709; sha256 `4982377ab3fe…`, the
file that was uploaded) and an archive master with PCM audio (sha256 `4e010cd0398c…`), published
as the assets of the GitHub release `video/super-agent/v2`. English, no voice. The film is frozen
at that tag and rebuilt only from it (see Reproduce it). The approval dates below are the
creator's local dates, which is why the final approval reads 2026-11-18.

- **V1 and V2.** V1 was archived unpublished on 2026-11-15 ([V1.md](V1.md)). V2 is a fresh remake
  made with Claude Fable 5.2 from the user's brief ([BRIEF.md](BRIEF.md)): a simpler,
  hierarchical, typographic film. Its bar was an 88 s explainer of the same article that the
  user supplied ([the study](../../references/fable-explainer-benchmark-2026-11.md)); that film's
  frames stayed local and were never committed.
- **Approvals** (`video.json` `approvals`): the treatment, a layer stack cut on a 120 bpm clock
  (2026-11-16, [TREATMENT.md](TREATMENT.md)); the 1080p60 review cut (2026-11-17); the final
  (2026-11-18). At the pilot's look check on 2026-11-17, a checkpoint and not a recorded gate,
  the user picked phosphor green and coral. Before the release the user decided to release the
  film in `science-explainers` (it was made under `concept-viz`) and as v2.
- **Verified.** The final is the approved review cut without its 30-frame test card: all 10,080
  frame hashes of the final render equal the review render's. `aiv qa` passes on the delivery
  and on the archive master (−14.0 LUFS, −3.1 dBTP, no unexpected freeze or black, every
  reading hold). One near-still span is declared for it in `video.json` (`qa.allowFreeze`): on
  the archive master the first run's freeze detector read 0:35.1 to 0:38.1 as a frozen picture
  (3.03 s against a 3 s threshold, while the prototype stamp stands and only the Worker's trace
  moves), although every frame in that span differs in the lossless render. The release's
  delivery was encoded again from the committed tree and is byte for byte the uploaded file.
  Colour was verified on the review cut's swatches (within 2 levels); the final has no test card
  to measure. On the review cut, 17 frames re-rendered on a fresh page matched the render's
  hashes.
- **How it was judged.** Two passes of review by agents came before the user's. The first (two
  frame critics, a first-time viewer with no context, a facts auditor, a motion reviewer, each
  serious finding checked by a verifier) found no wrong fact or number; its findings were fixed.
  A confirm pass on the fixed draft (a second first-time viewer, a motion reviewer, a regression
  critic, then a cold read of four frames) found a second, shorter list, also fixed.
  [TREATMENT.md](TREATMENT.md) lists the departures as built.
- **Not verified by any tool.** No agent heard the score or watched the cut at speed: the user's
  review was the only check of both. QA's onset detector reads ten of the thirteen hits as 65 to
  115 ms late; a high-band measure of the same mix puts all thirteen on their frame.
- **Known and accepted:** the cache's "not nothing" loss is a small event; the swing back to the
  stack before "only the Router answers you" is fast; the evidence charts leave the stack's world
  for about fifteen seconds. QA lists two moments to watch at speed: 0:24.1, where the title
  card's three lines leave together, and 0:51.1, a slow camera start.
- **Publish files.** [`publish/`](publish/) holds the English captions (43, hand-set from the
  cue sheet, lint clean), the title and description as uploaded (the creator's own), the
  chapters (kept, not in the uploaded description), the AI-use note and the thumbnail as
  uploaded with its provenance. The captions and chapters were audited against
  [FACTS.md](FACTS.md) and the cue sheet.
- **Thumbnail:** not a film frame. The creator made it with ChatGPT's image generation (OpenAI),
  restaging the film's subject, title and palette; provenance in
  `publish/thumbnail.provenance.json`.

## Source
| Path | What it holds |
|---|---|
| `audio/` | The score in code on the shared audio kit: `voices.ts`, `arrangement.ts` (120 bpm, 84 bars), `index.ts` (the desk and the master) |
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
| [publish/](publish/) | Captions, the title and description as uploaded, chapters (kept, not in the uploaded description), the AI-use note, the thumbnail as uploaded and its provenance |

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

V1 never had a release. The user chose to release V2 as v2 (`aiv release --version 2`), so that
the release number matches the film's name and cannot be confused with V1's `v1-archived` tag.

## Reproduce it
The film is frozen: rebuild it from its release tag, not from `main`.
```sh
git worktree add ../rebuild-super-agent-v2 video/super-agent/v2
cd ../rebuild-super-agent-v2
pnpm install --frozen-lockfile && pnpm aiv doctor --fix   # that tag's toolchain and pinned browser
pnpm aiv audio super-agent
pnpm aiv render super-agent --profile final && pnpm aiv post super-agent --profile final && pnpm aiv qa super-agent --profile final
```
On the reference host the frames match the release's frame hashes, and the delivery came out
byte for byte the same in two encodes; elsewhere compare with SSIM
([PRODUCTION](../../docs/PRODUCTION.md), Rebuild a frozen video).

## Licence
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film itself
(picture and score) is CC BY 4.0 (`video.json` `license`); what it uses is in
[CREDITS.md](CREDITS.md). The thumbnail (`publish/thumbnail.jpg`) is AI output: no copyright is
claimed (`LicenseRef-AI-Output`).

<!-- REUSE-IgnoreStart: third-party names, not notices for this file -->
This film is an independent explainer. It is not affiliated with, sponsored or endorsed by
DeepSeek or the DeepSeek Harness team; their names only identify the work being explained.
The prototype is a research prototype, not an official DeepSeek product.
<!-- REUSE-IgnoreEnd -->
