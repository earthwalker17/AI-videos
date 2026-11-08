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

## Status: production, the look in rework
The film has been in production since 2026-11-08. Decisions with the user so far:

| Date | Decision | The user's words |
|---|---|---|
| 2026-11-08 | Treatment | "Hybrid on B (Recommended)": *Who Routes the Agents? / 谁来调度智能体？* (recorded in `video.json` `approvals`) |
| 2026-11-08 | Narration | "Text-led, no voice (Recommended)" |
| 2026-11-08 | Look direction | "Dark ink map (Recommended)" |
| 2026-11-08 | zh copy | "Correct as written" (every zh-Hans string, [SCRIPT.md](SCRIPT.md#zh-sign-off)) |
| 2026-11-08 | Score sketch, bars 1–27 | "Right direction" |
| 2026-11-08 | Lookdev, round 1 | **Not approved.** "everything except the look itself should be OK"; "the look is still too simple and crude to be something worth watching" |
| 2026-11-08 | Chrome frame study of 比特新语 | "Connect Chrome (Recommended)" (the user logged in; 1080p, muted, view-only, nothing saved) |
| 2026-11-08 | Length | "~3:45, full depth (Recommended)": 84 bars, the human router's chores handed over |
| 2026-11-08 | Light | "Light where it means (Recommended)" |
| 2026-11-09 | Concept | "Desk, render both angles (Recommended)": the Register Desk, shown at 15° and straight down |
| 2026-11-09 | Micro-print | "Micro-print as texture (Recommended)" (≥ 18 px, texture only) |
| 2026-11-09 | zh copy of the 3:45 cut | "Correct as written" (n1–n11, tags, plates, labels, stamps); C12: "Keep C12 as signed off" |
| 2026-11-09 | Angle (style frame b) | "15° tilt (Recommended)" |
| 2026-11-09 | Bloom | "Bloom 0.3 (Recommended)": on live processes only, ≤ 3 sources |
| 2026-11-09 | Register Desk direction, seen at round-2 style frame (b) | "Right direction, refine (Recommended)": keep refining (b), then the other lookdev stills and the two motion tests |

**What this means (session 3).** The session-3 brief named the faults:
- basic flat geometry;
- one shape language for parallel elements;
- static connections.

It set the bar as "at least competitive with 比特新语". It also asked whether the film was
deep enough, and it was not: 41% of the 2:56 cut set up the problem and 14% explained how the
design works.

- **The story** is now 3:44 (84 bars, 36 lines). It keeps 25 of the signed-off lines verbatim,
  cuts 3 and adds 11 new ones (n1–n11); the user signed off their zh on 2026-11-09. Every mechanism
  answers "which of your chores did this take over?":
  - the async loop;
  - context as a cache and recall by ID;
  - the 100-word chat cap;
  - the Watchdog;
  - sharding and stepping in mid-task.
- **The look:** the transit map is retired, because its grammar (rings, boxes, 0/45/90° lines)
  was the crudeness itself. The new world is **the Register Desk**:
  - context is paper; light is attention or work; material is status;
  - the Router is a raised register deck with a tape reel; the Workers are walled bays, one
    per task; relationships are grooves, cords, flights, tape and a reply chute;
  - it is drawn in WebGL under the DOM text (ARCHITECTURE decision 30).

  [TREATMENT.md](TREATMENT.md) "Art direction v2" is the spec.
- **No scene code is built** until lookdev round 2 (style frames, stills and motion tests) is
  signed off.

**Session 1 (2026-11-08): research and the foundation docs.**
- **Research:** 22 research and design agents and a frame study, written back to:
  - [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md);
  - [references/vibe-knowledge-style-2026-11.md](../../references/vibe-knowledge-style-2026-11.md);
  - [references/motion-graphics-2d-2026-11.md](../../references/motion-graphics-2d-2026-11.md).
- **Docs:** the series widened to science and technology; this slot with
  [BRIEF.md](BRIEF.md), [TREATMENT.md](TREATMENT.md), [FACTS.md](FACTS.md) and
  [sources.jsonl](sources.jsonl).

**Session 2 (2026-11-08): foundations and lookdev round 1.**
- **Shared infrastructure**, each piece its own commit:
  - the dependencies;
  - a determinism-lint rule for CSS animation, WAAPI and the layout observers;
  - `readingSeconds` and the hold rule in `@aiv/core`;
  - the shared score kit `@aiv/pipeline/audio/kit` (ARCHITECTURE decision 29).
- **Copy and timing:**
  - [SCRIPT.md](SCRIPT.md), with the zh copy signed off;
  - [STORYBOARD.md](STORYBOARD.md);
  - `src/cues.ts`, the one timeline (66 bars at 90 bpm, 5,280 frames; 84 bars and 6,720 frames since session 3), with `src/cues.test.ts`
    proving every hold.
- **Picture foundations:**
  - the 2D kit (`src/kit/`), the look tokens and fonts (`src/look/`), the determinism probe
    (`src/lookdev/ProbeScene.tsx`);
  - the film's world and components (`src/film/`), the three lookdev stills
    (`src/lookdev/stills.tsx`).
- **Measured** on the reference host:
  - 0.20–0.21 s per frame and 0.49 MiB per frame at 1080p;
  - two fresh 1080p runs gave identical frame hashes and a byte-identical mezzanine;
  - 12 of 12 chunk-start checks matched;
  - lessons in [knowledge/dom-text-determinism.md](../../knowledge/dom-text-determinism.md).
- **Score sketch:** bars 1–27 in `audio/` (-14.0 LUFS, -2.6 dBTP, byte-identical rebuilds).

**Sessions to come** (revised 2026-11-09, session 3). Each ends committed, with this status,
`video.json` `next` and the project memory updated.
3. **Session 3 (now): story depth and lookdev round 2.**
   - **Done:**
     - the research write-back;
     - the frame-critic calibrated on the rejected stills;
     - the 84-bar cue sheet, SCRIPT, STORYBOARD, FACTS and TREATMENT revision 2;
     - ARCHITECTURE decisions 30–31;
     - the motion-test tooling (`aiv still --span --encode --inner`);
     - the kit parts copied from the frozen film.
   - **Then:**
     - **User:** signs off the new zh strings (done 2026-11-09: "Correct as written").
     - The Register Desk vertical slice: style frame (b) at both angles, with bloom on and off.
     - **User:** picks the angle and the bloom.
     - Stills (a) to (d) and motion tests MT1 and MT2; the critic; a refine pass.
     - **User:** signs off lookdev round 2.
4. **Build, part 1.**
   - An animatic: the key poses timed on the cue sheet, with the score sketch re-laid on the
     84-bar grid.
   - Beats 1–6 on draft renders in the signed-off look, each checked with its contact sheet and
     motion QA.
   - The score for bars 1–43.
5. **Build, part 2.**
   - Beats 7–13 and the rest of the score.
   - Two adversarial frame-critic rounds.
   - **User:** listens to the full score.
6. **Review cut, then release.**
   - The 1080p review cut through `aiv qa`.
   - Caption tooling (an SRT generator and a per-language linter).
   - `publish/` (EN and zh descriptions, chapters, AI disclosure, a short
     `references/bilibili-publishing.md`), the thumbnail.
   - The final and `aiv release`.
   - **User:** approves the review cut, then the final.
   - Push, tag and GitHub release only when the user asks.
7. **Buffer.**

## Handoff (for the next session)
**Start here.** Read this section and `video.json` `next`, then the user's brief for the look.
The visual spec in force is [TREATMENT.md](TREATMENT.md) "Art direction: dark ink map" as
amended by that brief.

**Where things are.**
| Path | What |
|---|---|
| `src/cues.ts` | Every on-screen string (EN, zh) and span; `cue(id)`, `at(bar, beat)`. Copy changes re-run `src/cues.test.ts` and a new zh check |
| `src/look/` | Palette, type scale, strokes, safe areas, `MAX_TEXT_PX` (136), `STEP_DOWN`; fonts (Plex Sans, Noto Sans SC slices planned from WORDS, IBM Plex Mono); the flat ground with its dither |
| `src/kit/` | Film-agnostic 2D parts: timeline and easings, wipe/fade text and the notes block, the camera with screen-space labels, SVG diagram parts, tapered sketch strokes, the dither tile |
| `src/film/` | The world (coordinates, routes, camera framings, tested), the act-one sketch world, the transit map, pills, glyphs, tags, the timetable chart (proportions tested) |
| `src/lookdev/stills.tsx` | The lookdev compositions: Still1 (f750), Still2 (f1880), Still3 (f4130), Chart (f3500), StepDown (f4400); `StillScenes.tsx` places their contents |
| `src/desk/` | The Register Desk (session 3): layout, state (the event schedule and per-beat focus), camera, footprints and pools, GL materials, post and canvas text, and the objects (Register, bays, your desk, intake, links); tested in `desk.test.ts` |
| `src/lookdev/round2.tsx`, `frames.ts` | Lookdev round 2 (its own entry): StyleB15/StyleB0 with and without bloom, ground diagnostics; the round's film frames |
| `src/lookdev/probe.tsx` | The determinism probe ('Probe') and the notes width sheet ('Notes') |
| `src/Main.tsx` | Leader test card, the probe in film frames 0–299, then bare ground (the beats are built in session 4) |
| `audio/` | The score sketch (bars 1–27): instruments, foley, arrangement, on `@aiv/pipeline/audio/kit` |

**Commands.**
```sh
pnpm aiv still super-agent --entry src/lookdev/stills.tsx --composition Still1 --frames 0 --profile review --label lookdev-1
pnpm aiv audio super-agent --verify                     # the score; listen to out/super-agent/audio/mix.wav
pnpm exec vitest run videos/super-agent                 # 148 tests
```
For the determinism evidence, re-run the probe checks after any change to fonts, type sizes
or the ground (the `render-verify` skill; numbers in
[knowledge/dom-text-determinism.md](../../knowledge/dom-text-determinism.md)).

**Rules learned, which a new look must keep.**
- DOM text ≤ 136 px; above that it is not bit-exact across pages here.
- Text in a `GREY_TEXT` layer, or it gets LCD colour fringes.
- No CSS gradients on the dark ground: they band. Bake gradients and textures into images
  loaded with `<Img>`, or draw them in SVG with an explicit dither.
- No CSS transitions or animations, and no filters that resample per frame.
- The ground stays above limited-range luma 38 (QA's black detector).

**Open items carried over** (from the lookdev agents and reviews; most depend on the new look):
- TREATMENT.md and STORYBOARD.md predate the stills as built:
  - Still 3 is framed at 0.6×, not 0.5×, and without the timetable panel, which a shot must
    remove before beat 7 (bar 46);
  - the proposed machines sit at world x 2736, not "about 3500";
  - the 70% step-down lands at C27 (f4310), after Still 3's frame (shown in the `StepDown`
    check);
  - the Workers stand at x 2352–2572.
- PRODUCTION.md does not say whether the 1/30 text-height rule means font size or cap height.
  The film's labels have a 28 px cap height at 40 px.
- Positions of status dots, pills and the reply in the stills are placed by hand;
  the build takes them from an event schedule.
- Score: the Router's memory ticks are inaudible (-30 dB); a `silence` cue for bar 10 beat 4
  would let the cue sheet own that silence; the Worker knocks, motif returns and other sync
  points still need cue ids.
- Shared, not blocking (docs/ROADMAP.md, Known gaps): LCD fringes on the kit's own `TestCard`
  and `Title`; `@aiv/remotion-kit` has no `"sideEffects": false`, so 3D code is bundled.

## How it was made
The picture style is being reworked (see Status); the stack and the numbers below hold. Speed and size were measured in session 2.
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
- **Numbers:** 6,720 frames at 30 fps (3:44.0; the 2:56 cut had 5,280).
  - The round-1 DOM look measured 0.20–0.21 s and 0.49 MiB per frame at 1080p.
  - The round-2 WebGL world is estimated at 0.5–0.9 s per frame, so a 1080p pass takes about
    56–100 min, as chunked foreground calls with `--budget-min 9` or overnight. The probe on
    style frame (b) measures it before anything is built (gate: 0.8 s per frame or less).
  - At about 1.2 MiB per frame, a review mezzanine is about 8 GiB.

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
