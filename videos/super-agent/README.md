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

## Status: production, lookdev signed off; the build is next
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
| 2026-11-10 | Lookdev, round 2: stills (a)–(d), motion tests MT1 and MT2 | **Signed off.** "I've checked the lookdev stills and they're OK, which can be carried on to the final render." (Recorded here: `video.json` approvals hold only the treatment, review and final gates.) |

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
- **Lookdev round 2 is built in the film's own code** (`src/desk/`): four stills and two motion
  tests. The user signed it off on 2026-11-10, so the build starts from them.

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
3. **Session 3 (2026-11-08 to 11-10): story depth and lookdev round 2.**
   - **Done:**
     - the research write-back;
     - the frame-critic calibrated on the rejected stills;
     - the 84-bar cue sheet, SCRIPT, STORYBOARD, FACTS and TREATMENT revision 2;
     - ARCHITECTURE decisions 30–31;
     - the motion-test tooling (`aiv still --span --encode --inner`);
     - the kit parts copied from the frozen film;
     - **User:** signed off the new zh strings (2026-11-09: "Correct as written");
     - the Register Desk vertical slice: style frame (b) at both angles, with bloom on and off;
     - **User:** picked the 15° angle and bloom 0.3, and "Right direction, refine";
     - the kit's noise hash replaced by a public-domain one; IBM Plex Mono for JetBrains Mono;
     - stills (a) to (d) and motion tests MT1 and MT2, with critic rounds and refine passes;
     - polish pass 2 by two builders on disjoint files, then a final critic round (the scores and
       the fixes it still asks for are under Handoff);
     - **User:** signed off lookdev round 2 (2026-11-10).
4. **Build, part 1 (next).**
   - First, the lookdev fixes the final critic round left that touch shared parts (Handoff,
     "Open items"), each checked on its still or span.
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
**Start here.** Read this section and `video.json` `next`. Session 4 is the build, part 1 (the
session plan above). The look is signed off (2026-11-10): build every beat in the Register Desk
as the lookdev stills and motion tests show it. The visual spec in force is
[TREATMENT.md](TREATMENT.md) "Art direction v2: The Register Desk", with the user's picks (15°
pitch, bloom 0.3) and the standing decisions below. The round-1 dark ink map (`src/film/`
renderers, `src/lookdev/stills.tsx`) is retired. It stays in the tree only until the build
replaces it, because its schedules and chart proportions are reused.

**Where things are.**
| Path | What |
|---|---|
| `src/cues.ts` | Every on-screen string (EN, zh) and span on the 84-bar grid; `cue(id)`, `at(bar, beat)`. Copy changes re-run `src/cues.test.ts` and a new zh check |
| `src/print.ts` | Micro-print strings (texture only, ≥ 18 px, never read as content); the font plan reads them with WORDS |
| `src/look/` | Palette, type scale, `MAX_TEXT_PX` (136), `STEP_DOWN`; fonts (Plex Sans, Noto Sans SC slices planned from WORDS, IBM Plex Mono) |
| `src/kit/` | Film-agnostic 2D parts the overlay uses: timeline and easings, the notes block and labels (`GREY_TEXT`), camera maths, diagram and sketch helpers |
| `src/desk/` | The Register Desk:<br>• `layout.ts`, `geom.ts`: world coordinates.<br>• Pure schedules, every effect a sum over one event list: `state.ts` (beats 4–6 events, `FOCUS_BEATS`), `actOne.ts`, `you.ts`, `beat3.ts`, `turn.ts`, `summary.ts`.<br>• `camera.ts`: framings and moves.<br>• `footprints.ts`, `pools.ts`: analytic SDF shadows, light pools, the emitter budget.<br>• `gl/`: desk shader, light set, materials, post, canvas text; `gl/plate.ts` makes the trait plates' word textures.<br>• `objects/`: Register, bays, your desk, intake, links (grooves, chute, cargo), the handshake (report card and reply), dispatch, cache, proposed parts, trace, act one, the turn.<br>• `*Frame.tsx`, `DeskWorld.tsx`, `Overlay.tsx`: a frame's world and its DOM labels and notes, posed by one camera function.<br>• Tests: `desk`, `actOne`, `summary`, `turn` (223 tests in the video) |
| `src/lookdev/round2.tsx`, `frames.ts` | Lookdev round 2, its own entry: `StillA15` (a), `StyleB15` (b, and MT1's span), `StillC15` (c), `StillD15` (d), `MT2`; the 0° and no-bloom variants and ground twins. `frames.ts` holds the round's film frames and motion-test spans |
| `src/lookdev/probe.tsx` | The determinism probe ('Probe') and the notes width sheet ('Notes') |
| `src/Main.tsx` | Leader test card, the probe in film frames 0–299, then bare ground (the beats are built from session 4) |
| `audio/` | The score sketch (bars 1–27). Stale: it was laid on the 66-bar grid and is re-laid on 84 bars in session 4 |

On the reference host only, since `out/` and `.cache/` are not in git:
- `out/super-agent/stills/r2-final/` holds the signed-off set: the four stills, a sheet and both
  motion tests as mp4.
- `.cache/research/2026-11-08-super-agent-s3/lookdev-r2/` holds the critic and stranger
  reports of both rounds.

**Commands.** Frames are composition frames: film frame + 15 (the leader).
```sh
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillA15 --frames 930 --label r2-a
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StyleB15 --frames 2240 --label r2-b
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillC15 --frames 3165 --label r2-c
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillD15 --frames 5535 --label r2-d
# motion tests: one span of at most 240 frames per call, lossless, contact sheet, motion QA, fresh-page check
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StyleB15 --frames 2155-2355 --span --encode --inner 3 --label r2-mt1
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition MT2 --frames 1415-1544 --span --encode --inner 3 --label r2-mt2
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition MT2 --frames 1545-1675 --span --encode --inner 3 --label r2-mt2-b
pnpm exec vitest run videos/super-agent
```
Measured on the reference host at 1080p: 0.37–0.79 s per frame steady (a single still about
3–7 s after a 4–30 s boot). A full pass is about 40–90 minutes, run chunked. Check free memory
first, and close Chrome if it is connected. The signed-off stills hash as follows (first 12 hex
of the RGBA sha256):

| Still | Hash |
|---|---|
| (a) | `5cb677648515` |
| (b) | `6b660e981ea9` |
| (c) | `43d104d679bb` |
| (d) | `fc8ee34c5a43` |

A change that should not touch a still keeps its hash.

**Standing look decisions** (session 3, on top of TREATMENT.md).
- **D1:** no Thread cord before C17 (f3440). It pays out at 7.1 through a guide on the
  Register's frame; until then a Thread is a row on the tape.
- **D2:** only a teaching ID chain (#0405, #0408) is readable as numbers (about 24 px today).
  Every other row, card and folder carries marks or texture print. The docs galley's
  mirror-reversed set type is deliberate texture.
- **D3:** label leaders are clear hairlines that end on a body.
- **D4:** one paper-lit value budget per frame (luma 208 and up). Paper stepped down by focus
  still reads as paper, never as a dark slab.
- **D5:** the neck-collar gauge reads as an arc gauge.
- **Carriers** emerge from a slot over 3–4 frames: no one-frame swaps, nothing from nowhere,
  nothing lying over cargo print.
- **Emission** only on your lamp's bulb, a computing Worker's slot and one transit light; at
  most 3 per frame.
- **The turn as built** (TREATMENT MT2): the order is coil → wind → slide → deck. The chores leave
  as bodies pressed into imprints, which stay on the slate.

**Rules learned, which the build must keep.**
- A frame is a pure function of its index: no `useFrame`, clocks, timers or `Math.random` (the
  lint enforces it). Shadows are analytic SDF footprints, never shadow maps.
- Proof per change:
  - two fresh stills hash-identical;
  - every span rendered with `--inner 3` (fresh-page frames equal the span's).
- DOM text ≤ 136 px in a `GREY_TEXT` layer. Larger or in-world text is a canvas texture.
- The ground stays above limited-range luma 38 (QA's black detector); the desk shader's floor is
  40.
- Keep the GL programs few and cached (the kit's GPU program cache): cold shader compiles cost
  minutes.
- Two implementers never edit the same files at once. Give each a disjoint set of files; shared
  files get small, re-read edits that each implementer reports.
- Critic scores are evidence, not the bar. The user signed off a set the critic scored 23–30 of
  38, after rejecting round 1 that an uncalibrated critic had passed. Ask the user early, with
  images.

**Open items carried over.**
- **Fixes the final critic round left** (2026-11-09). These are the scores after polish pass 2,
  with the pass mark at 30 of 38 (79% for a single still):

  | Target | Score | P0 |
  |---|---|---|
  | (a) | 27/34 | none |
  | (b) | 23/38 | yes |
  | (c) | 28/38 | none |
  | (d) | 30/38 | yes |
  | MT1 | 25/38 | yes |
  | MT2 | 25/38 | none |

  The user signed the look off regardless. Fold the fixes in as the beats are built, not as a
  new lookdev round. Top items:
  - **Chat mark, a P0 in (b) and MT1:** the speech bubble with two grey rules (the chat
    feeder's slip and plate, the chat slips) reads as glyph-line text, which is BANNED. Keep the
    notch or the bubble alone, or use ≥ 18 px texture print (`gl/text.ts` `cargoMark`, the
    spout plate in `objects/Intake.tsx`).
  - **(d)'s trace, a P0:** right-angle steps and Z-jogs remain at the deck front, the throat
    bracket and the bay mouth. Make one continuous path, red and green side by side down the
    groove without crossing, and end the reply on the signed slip.
  - **MT1:**
    - a window mullion crosses #0408 after the second advance;
    - the reply passes under the chute lip and holds 4 f;
    - W-10 appears by a 3 f aperture wipe instead of rising from its hatch on spring-heavy.
  - **MT2:**
    - f1530–1610 runs 5–7 motions at once; retime to at most 3;
    - hold the three new bays closed and idle until each is dispatched (this also settles
      STORYBOARD 4.3–4.5);
    - grow the deck's footprint shadow as its legs rise, so "two levels" is physical;
    - keep your lamp on over the rising loop.
  - **(b):**
    - "above" is still weak: the deck's shade moves the bay floors only 2–4 codes;
    - the bays read W-08, W-09, W-07 left to right;
    - the Router leader ends on a rail (a stranger could not tell which object is the Router);
    - lifted shadows show the dark imprints as ghost cards.
  - **(c):**
    - the summary ejects in one frame; give it an arc with 3 f anticipation;
    - print the pointer glyph after the tab settles;
    - step W-09's dossier out of the notes band.
  - **(a):**
    - the empty in-tray reads as a second screen; give its floor the desk's graphite and a
      gradient;
    - the lamp arm lies across the laptop screen;
    - two tape notes sit by the wrong tabs;
    - F7 and F8 collide;
    - the "you" leader crosses tape print.
  - **Strangers, on every still:**
    - props on the left are unexplained until their beat; step them down harder or bring them
      in with it;
    - unreadable micro-print reads as noise;
    - the right-hand blueprint cluster in (d) floats without a link.
- **Not built yet:**
  - beats 5–6's parts: the spike pile, the batching strip, the stress plate;
  - the Proactive · 主动, Productive · 高效 and Persistent · 持久 plates (`gl/plate.ts`
    `plateTexture` with `WORDS.trait*`);
  - Fix A and Fix B in `ActOneFrame` for beat 3 (f960–1399).
- **Continuity and finish:**
  - the reel's riders (clip and tabs) at MT2's end are not on the Register at rest in (b)–(d);
  - the slate tooth (std 0.55) is below what reads as texture, which is a director call;
  - IDs are about 24 px, under the 36 px "read" floor;
  - the per-object step-down stagger, the fanfold +1 and the engraved system boundary are not
    done.
- **Score:** re-lay the sketch on 84 bars. The Router's memory ticks are inaudible (-30 dB); a
  `silence` cue for the old bar 10 beat 4 would let the cue sheet own that silence; the Worker
  knocks, motif returns and other sync points still need cue ids.
- **Shared, not blocking** (docs/ROADMAP.md, Known gaps):
  - the frozen *A Halloween Gift*'s hash licence (shadertoy 4djSRW);
  - LCD fringes on the kit's own `TestCard` and `Title`;
  - `@aiv/remotion-kit` has no `"sideEffects": false`, so 3D code is bundled.

## How it was made
- **Picture:** Remotion 4.0.539 with a WebGL world under a DOM text layer (ARCHITECTURE
  decision 30).
  - **World:** React Three Fiber through `@remotion/three`, three.js 0.186.1 and postprocessing
    6.39.5. One continuous desk world under a long-lens camera (fov 20°, 15° pitch, 1 unit =
    1 px at 1.0×) that only trucks, dollies and zooms. The DOM notes and labels are posed by the
    same pure camera function.
  - **Light and finish:** a fixed light set with no punctual lights; analytic SDF footprint
    shadows instead of shadow maps; mipmap bloom (threshold 1.0, intensity 0.3) on at most
    three live emitters; NEUTRAL tone mapping, dither and the kit's `FinishEffect`.
  - **Determinism:** every frame is a pure function of `useCurrentFrame()`, built with
    `@aiv/core` (`progress`, easings, seeded `rand`); the shaders hash with integers
    (MurmurHash3's fmix32), never clocks.
  - **Libraries:** `@aiv/remotion-kit` (Stage3D and PostChain, noise, `CamPath`, `Curve`,
    `screenBoxAt`, the GPU program cache); `@remotion/layout-utils` for measuring text.
  - **Fonts:** IBM Plex Sans, Noto Sans SC and IBM Plex Mono, all OFL npm packages that are
    not committed. They load through the kit's `useFont`, which proves glyph coverage;
    in-world text is drawn into canvas textures.
  - **Where the code lives:** the world in `src/desk/`, the look tokens in `src/look/`, the 2D
    overlay kit in `src/kit/`.
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
  - The round-2 WebGL world measured 0.37–0.79 s per frame steady at 1080p in the motion tests
    (gate: 0.8 s or less; the busiest, the 0.64× summary, is at the top), so a 1080p pass takes
    about 40–90 min, as chunked foreground calls with `--budget-min 9` or overnight.
  - The lossless spans measured 1.31–1.32 MiB per frame, so a review mezzanine is about
    8.7 GiB.

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
- **The Register Desk's shaders and geometry** (`src/desk/gl/`, `geom.ts`) stay in this film
  until a second video needs them (ARCHITECTURE decision 30). The parts it took from the frozen
  *A Halloween Gift* already live in `@aiv/remotion-kit`.
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

Session 3, the look rework:
- **Calibrate the critic on the user's rejections first.** The frame-critic's "finished craft"
  rubric had to fail the rejected round-1 stills before it judged anything new.
- **Treat a critic's score as evidence, not as the bar.** The critic held style frame (b) near
  23/38 across passes that visibly improved it. Its recurring confusions were real, and each
  became a standing decision (D1–D5 in the Handoff); the user's eye at the gate decides. The
  user signed off the round-2 set at critic scores of 23–30/38, so after calibration the
  critic is stricter than the user. Its fix lists still feed the build.
- **Ask a stranger.** An agent with no project context, asked "what is this frame telling
  you?", found what the spec hid. One example is cords drawn before the line that explains
  them, so they now first appear at C17.
- **Give parallel implementers disjoint files.** Two builders that both edited `state.ts`,
  `layout.ts` and the Register left one combined diff to review before either could be
  committed. Polish pass 2 split the files by owner. Shared files took only small, re-read
  edits that each builder reported, and items found in the other builder's files were relayed,
  not fixed in place. Both halves then landed as one verified commit.

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
