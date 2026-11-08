# Who Routes the Agents?

A text-led explainer of just under three minutes, in English with a Simplified Chinese line,
for curious developers on YouTube and Bilibili. It covers the DeepSeek Harness team's article
*Exploring Super-agent Design: Towards a More Autonomous Agent System*. The Chinese original
appeared on 2026-10-31 and the English machine translation on 2026-11-01. The article's
argument: when one person runs many AI agent sessions, that person quietly becomes their
router, and the design hands that job to a long-lived Router above isolated Workers.
The film keeps three things apart: what the public research prototype
(`deepseek-ai/dsh-superagent-prototype` at `8c32a9d`) builds, what the authors' synthetic
test shows, and what is still open. Picture and score are made in code. The sources, with
their URLs and pins, are in [sources.jsonl](sources.jsonl), and every claim is in
[FACTS.md](FACTS.md).

**Series:** [Science & Technology Explainers](../../series/science-explainers/SERIES.md) · **Number:** 4 · **Engine:** remotion
▶ **Watch:** not yet published.

## Status: production
The film has been in production since 2026-11-08, when the user approved the treatment,
"Hybrid on B (Recommended)": *Who Routes the Agents? / 谁来调度智能体？*. The approval is
recorded in `video.json` `approvals`. Decided with the user the same day:
- the look, "Dark ink map (Recommended)";
- the narration, "Text-led, no voice (Recommended)";
- a frame study of 比特新语 in the user's own browser, "Connect Chrome".

**Session 1 (2026-11-08): research and a durable foundation, no code.**
- **Research:** 22 research and design agents, plus the frame study.
  - Seven research branches, each checked by an adversarial verifier.
  - A critic that resolved the contradictions between them.
  - Three treatments, three judges and a synthesis.

  The results were written back to:
  - [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md):
    the article, the built-versus-proposed matrix, reception, misreadings, the zh glossary
    and the pins;
  - [references/vibe-knowledge-style-2026-11.md](../../references/vibe-knowledge-style-2026-11.md):
    the genre and frame study, and the do-not-copy list;
  - [references/motion-graphics-2d-2026-11.md](../../references/motion-graphics-2d-2026-11.md):
    the 2D tooling delta, the fonts and CJK typesetting;
  - [references/sources.json](../../references/sources.json): entries for all of the above.
- **Corrections:** [references/remotion.md](../../references/remotion.md) now says 20
  transition presentations at 4.0.539, 8 of them DOM-based, with no `cube`. The Remotion
  licence wording in [LICENSING](../../docs/LICENSING.md) now follows the pinned licence.
- **Series:** widened from mathematics and physics to science and technology.
- **This folder:**
  - [BRIEF.md](BRIEF.md);
  - [TREATMENT.md](TREATMENT.md): the three candidates, the chosen hybrid, the art
    direction and the sound;
  - [FACTS.md](FACTS.md) and [sources.jsonl](sources.jsonl), seeded from the verified facts;
  - this README.
- **Roadmap:** [ROADMAP](../../docs/ROADMAP.md) entries for the shared work this film
  triggers.
- **Not verified yet:**
  - nothing has been rendered or heard;
  - the look, the 2D render speed and the determinism of large DOM text are untested.

**Sessions to come.** Each ends committed, with this status, `video.json` `next` and the
project memory updated.

2. **Foundations and lookdev.**
   - Shared work, each piece its own verified commit:
     - the determinism-lint rule for CSS animation, WAAPI and the observers;
     - the new dependencies (`@remotion/paths`, `@remotion/layout-utils` and three
       fontsource variable fonts);
     - the score kit promoted from the frozen film's audio.
   - A 2D determinism probe: large EN and zh DOM text, a dark gradient with dither, SVG
     draw-on and tokens.
     - It measures seconds and MiB per frame.
     - It runs `aiv still --check` on chunk-start frames and two `--fresh` renders.
     - It checks that the 3D exports are tree-shaken.
     - The results go into the engine notes or a knowledge card.
   - Kit v0, SCRIPT.md with the final EN and zh copy, STORYBOARD.md and `src/cues.ts`.
   - Three lookdev stills (f750, f1880, f4130), reviewed by the frame-critic.
   - **User:** signs off the zh copy, signs off the lookdev stills, and listens to a score
     sketch.
3. **Build.**
   - Every beat on draft renders, each checked with its contact sheet and motion QA.
   - Two adversarial frame-critic rounds, then the full score and fixes.
   - **User:** listens to the full score.
4. **Review cut, then release.**
   - The 1080p review cut through `aiv qa`.
   - Caption tooling: an SRT generator and a per-language linter.
   - `publish/`: EN and zh descriptions, chapters and the AI disclosure, plus a short
     `references/bilibili-publishing.md`.
   - The thumbnail, the final and `aiv release`.
   - **User:** approves the review cut, then the final.
   - Pushing, tagging and the GitHub release happen only when the user asks.
5. **Buffer.**

## How it was made
Planned. The numbers below are estimates until session 2 measures them.
- **Picture:** Remotion 4.0.539 in 2D: DOM text and inline SVG, with no React Three Fiber.
  - **World and camera:** one 3840×2160 route-map world under a camera that only translates
    and scales.
  - **Determinism:** every frame is a pure function of `useCurrentFrame()`, built with
    `@aiv/core` (`progress`, easings, seeded `rand`).
  - **Libraries:** `@remotion/paths` for drawing lines along their paths and moving tokens
    on them; `@remotion/layout-utils` for measuring text.
  - **Fonts:** IBM Plex Sans, Noto Sans SC and JetBrains Mono, all OFL npm packages that are
    not committed. They load through the kit's `useFont`, which proves glyph coverage.
  - **Where the code lives:** the look tokens in `src/look/`, the 2D motion kit in
    `src/kit/`.
  - **Fallback:** the web engine, only if the DOM determinism probe fails.
- **Text:** `src/cues.ts` is the single source of every on-screen string, English and
  zh-Hans, and of its span on the bar grid (90 bpm, 4/4, 80 frames a bar).
  - Three things read it: the picture draws from it, the score's hold check reads it, and
    the sidecar SRT generator will read it.
  - A text span covers only the time a line is fully visible. The line wipes in over 6
    frames before it and fades out over 6 frames after it, never typewriter-style.
  - zh phrase breaks are written out by hand, because Intl word segmentation splits 路由器
    into single characters (tested in Node).
- **Sound:** an original score in `audio/`, all synthesis, built by `aiv audio` against the
  same cue sheet; `video.json` takes it as the `audio:mix` track.
  - **Harmony:** 90 bpm; D Dorian, D major at the turn, B minor for the open problem.
  - **Motif:** the request's rising fourth, A4–D5, completed with F♯5 at the sign-off.
  - **Voices:** FM mallet, modal marimba, felt piano, sine bass, additive bowed pad,
    Karplus–Strong ticks, and paper and ink foley.
  - **Master:** -14 LUFS, true peak ≤ -1 dBTP.
  - **Shared code:** the generic DSP, reverb, mastering and mixing come from the frozen
    [A Halloween Gift](../halloween-gift/README.md) score, copied into the shared audio kit
    in `packages/pipeline/src/audio/runtime/kit/`. The frozen film is untouched.
- **Numbers:** 5,280 frames at 30 fps (2:56.0).
  - At an estimated 0.2–0.4 s per frame, a 1080p render takes about 18–35 min, run as 3–5
    foreground calls with `--budget-min 9`.
  - A review mezzanine is about 3.5–4 GiB.

## Reproduce it
```sh
pnpm aiv audio super-agent            # videos with a score (audio/)
pnpm aiv render super-agent --profile final
pnpm aiv post super-agent --profile final
pnpm aiv qa super-agent --profile final
```
A published video is rebuilt from its release tag `video/super-agent/v<N>`, not from `main`.

## Reusable
Planned; nothing is built yet.
- **The 2D motion kit in `src/kit/`:**
  - timeline combinators on the bar grid;
  - EN and zh text reveals with explicit phrase breaks;
  - nodes, edges and tokens drawn along paths;
  - a 2D translate-and-scale camera;
  - seeded, tapered sketch strokes;
  - a static dither tile.
- **Its rules:** it imports nothing from the film and has its own tests. Each part is
  listed in `video.json` `reusable` once it is built. The kit moves to `@aiv/remotion-kit`
  when the next 2D explainer needs it (the rule of two).
- **Shared code this film puts straight into `packages/`** is documented with those
  packages, not here: the score kit, the bilingual caption pattern, the cue-text helpers
  and `readingSeconds`. `reusable` paths are relative to this folder.

## Lessons
Session 1, research and design:
- **Study platforms as a viewer, not through scripted APIs.**
  - A scripted request to Bilibili's public view API got an HTML page back instead of JSON,
    Zhihu returned 403 and WeChat an error page. The agents stopped there: no retries, no
    way around the bot checks.
  - The frame study then ran in the user's own browser, with the user's consent. It was
    logged out, so it saw 360p, plus one 1080p frame from the player's guest preview. The
    sound was analysed from audio decoded silently in page memory, never played or saved.
    Nothing was liked, followed or posted, and nothing was saved to the repository.
  - Downloads need the user's explicit approval and stay in `.cache/`, for analysis only.
- **Brief design agents with the user's preferences, not only with what to avoid.** The
  design agents were told to keep clear of the genre's look. The recommended design drifted
  to a light "survey sheet" paper palette, against the user's stated preference for dark,
  minimal looks. The user chose "Dark ink map (Recommended)": the film differs from the genre
  through line grammar and semantic colour, not through its background.
- **Invert percentages with care.** "About 37% more tokens without pass-through" became
  "37% fewer with it" in one verifier's report, and "30% more decisions" became "30% fewer"
  in a draft line. With pass-through it is about 27% fewer tokens and about 23% fewer
  decisions. Every number headed for the screen is recomputed from the article's own figures
  in FACTS.md.
- **Write the do-not-copy lists before designing.** There are two, kept in the references
  notes:
  - **The article's figures:** their layouts, the recurring example IDs, the chat
    dialogues, the blue accent and the cover.
  - **The genre's signatures:** the title lockup, the white-flash title on a shared music
    bed, the serif subtitle band, the gold-on-navy glow, the dedication end line and the
    specific scenes.

  Treatments, lookdev stills and the frame-critic are checked against both lists.

## Licence
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film
itself: see `video.json` `license` and `CREDITS.md`.

<!-- REUSE-IgnoreStart: third-party names, not notices for this file -->
This film is an independent explainer. It is not affiliated with, sponsored or endorsed by
DeepSeek or the DeepSeek Harness team; their names only identify the work being explained.
The prototype is a research prototype, not an official DeepSeek product. The film shows no
logos or interfaces, and its charts are re-plotted from the article's published numbers
rather than copied from its figures.
<!-- REUSE-IgnoreEnd -->
