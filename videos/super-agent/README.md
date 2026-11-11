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

## Status: production, build part 1 done (beats 1–6 and the animatic); part 2 is next
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
| 2026-11-12 | Build part 1 (beats 1–6, the draft and the four changed stills against the signed-off set) | "Right, carry on (Recommended)" |
| 2026-11-12 | Score, bars 1–43 | "Right direction (Recommended)" |
| 2026-11-12 | The recall in the 2.4× close, the ease-out on bar 43 (not STORYBOARD 6.4's bar 42) | "Keep the bar-43 ease-out (Recommended)" |
| 2026-11-12 | The docs galley's mirrored cast type | "Flip to right-reading (Recommended)" |

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
4. **Session 4 (2026-11-10 to 11-11): build, part 1.**
   - **Done:**
     - the build's event schedule in the cue sheet (`BEAT_4`, `MT1`, `BEAT_5` with the trips,
       `BEAT_6`), every schedule frame a contact frame for the picture and the score;
     - the film as one continuous Register Desk (`src/Main.tsx` → `desk/FilmFrame.tsx`, segments
       in `desk/film.ts`): act one, the turn, act two and the summary, each segment's world
       remounting at its boundary with a continuous picture across it;
     - beats 1–6 built (film f0–3439, 1:55): act one with Fix A and Fix B, the turn, the Router
       and its bays (beat 4), the two-stage filter with the starter key and the spike (beat 5),
       batching, the context cache and recall by ID in the close (beat 6);
     - the animatic from f3440: the act-two world runs on, and the words of every cue not built
       yet sit on a slate, timed on the score; the summary (still (d)) is built to f5570;
     - the camera: the bar-34 dolly into the close and its mirror on bar 43, so the recall
       plays in the 2.4× close (a change from STORYBOARD 6.4's two-bar ease-out on bar 42);
     - the score re-laid on 84 bars: bars 1–43 composed against the picture, an animatic bed
       after them; every key strike, slip, batch and stamp sounds on its contact frame;
     - fixes from the final lookdev critic that touch shared parts (the chat mark, the summary
       trace), then four fix rounds, each a fixer per lane, a frame critic and a code review.
   - The renders are drafts (960×540) with full-size keys. The whole film rendered as a draft
     passed `aiv post` and `aiv qa` (2026-11-11): -14.0 LUFS, -2.4 dBTP, no unexpected black or
     freeze (the animatic's holds are declared), cue holds and colour swatches pass. The critic's
     leftover list and what needs the user's eye are under Handoff.
5. **Build, part 2 (next).**
   - Beats 7–13 (f3440–6719) and the rest of the score, in the same way: fixer lanes, frame
     critics, code reviews.
   - The open items from part 1 (Handoff).
   - Two adversarial frame-critic rounds on the whole film.
   - **User:** looks at the build so far and listens to the full score.
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
**Start here.** Read this section and `video.json` `next`. Session 5 is the build, part 2 (the
session plan above): beats 7–13 (f3440–6719), which are the animatic today. The look is
signed off (2026-11-10): build every beat in the Register Desk as the lookdev stills and motion
tests show it, and as beats 1–6 now do. The visual spec in force is
[TREATMENT.md](TREATMENT.md) "Art direction v2: The Register Desk", with the user's picks (15°
pitch, bloom 0.3) and the standing decisions below. The round-1 dark ink map (`src/film/`
renderers, `src/lookdev/stills.tsx`) is retired. It stays in the tree only until the build
replaces it, because its schedules and chart proportions are reused.

How session 4 worked, and what to keep: one fixer per lane of frames (never two on the same
files), each lane followed by a frame critic on its final renders and a code reviewer that runs
the pure schedules frame by frame. The code reviews found the one-frame swaps that motion QA
misses (it only sees whole-frame changes): tile diffs around every event are the check that
works. Briefs that name the contact frames, the files owned and the renders to make kept the
lanes apart.

**Where things are.**
| Path | What |
|---|---|
| `src/cues.ts` | Every on-screen string (EN, zh) and span on the 84-bar grid; `cue(id)`, `at(bar, beat)`. Copy changes re-run `src/cues.test.ts` and a new zh check |
| `src/print.ts` | Micro-print strings (texture only, ≥ 18 px, never read as content); the font plan reads them with WORDS |
| `src/look/` | Palette, type scale, `MAX_TEXT_PX` (136), `STEP_DOWN`; fonts (Plex Sans, Noto Sans SC slices planned from WORDS, IBM Plex Mono) |
| `src/kit/` | Film-agnostic 2D parts the overlay uses: timeline and easings, the notes block and labels (`GREY_TEXT`), camera maths, diagram and sketch helpers |
| `src/desk/` | The Register Desk:<br>• `layout.ts`, `geom.ts`: world coordinates.<br>• `film.ts`: the segments (act one [0, 1400), the turn [1400, 1660], act two [1661, 5400), the summary [5400, 6720)), `BUILT_TO` (3440) and `SUMMARY_BUILT_TO` (5570), act two's labels and tags; `FilmFrame.tsx` draws a film frame from them, with the animatic slate.<br>• Pure schedules, every effect a sum over one event list: `actOne.ts`, `you.ts`, `beat3.ts` (Fix A, Fix B), `turn.ts`, `state.ts` (act two's world, `FOCUS_BEATS`, `EVENTS_B`/`EVENTS_C`), `beat4.ts` (the bays, the request's ride), `beat5.ts` (the key, the trips, the spike), `beat6.ts` (batching, the cache, the recall), `summary.ts`.<br>• `camera.ts`: framings and moves (`DOLLY_IN` bar 34, `EASE_OUT` bar 43, `CAMERA_EASE`).<br>• `footprints.ts`, `pools.ts`: analytic SDF shadows, light pools, the emitter budget.<br>• `gl/`: desk shader, light set, materials, post, canvas text; `gl/plate.ts` the trait and stress plates; `gl/print5.ts`, `gl/print6.ts` beat 5's stamps and beat 6's strip print.<br>• `objects/`: Register, bays, your desk, intake, links (grooves, chute, cargo), the handshake (report card and reply), dispatch, the counterfactual card, the filter (beat 5), batch, cache and recall (beat 6), proposed parts, trace, act one, the title card, the turn.<br>• `*Frame.tsx`, `DeskWorld.tsx`, `Overlay.tsx`: a frame's world and its DOM labels and notes, posed by one camera function.<br>• Tests: a `*.test.ts` per schedule (about 420 tests in the video, with the cue sheet's and the score's) |
| `src/lookdev/round2.tsx`, `frames.ts` | Lookdev round 2, its own entry: `StillA15` (a), `StyleB15` (b, and MT1's span), `StillC15` (c), `StillD15` (d), `MT2`; the 0° and no-bloom variants and ground twins. `frames.ts` holds the round's film frames and motion-test spans. The signed-off reference; the film now draws the same frames through `FilmFrame` |
| `src/lookdev/probe.tsx` | The determinism probe ('Probe') and the notes width sheet ('Notes') |
| `src/Main.tsx` | The leader test card (15 frames), then the film: `desk/FilmFrame.tsx` for every film frame |
| `audio/` | The score on the 84-bar grid (`index.ts`, one stereo track `mix`): `arrangement.ts` lists the parts, one module per stretch: `actOne.ts` (bars 1–12), `fixes.ts` (13–18), `levels.ts` (19–29), `keepUp.ts` (30–43); `continuity.ts` is the Router's layer (pad, bass pulse, memory ticks) from the turn to the end; `bed.ts` is the animatic bed for bars 44–84, which session 5 replaces; `instruments.ts`, `foley.ts`, `common.ts` are shared. `score.test.ts` holds every sync point to the cue sheet and to the picture's own frames |

On the reference host only, since `out/` and `.cache/` are not in git:
- `out/super-agent/stills/r2-final/` holds the signed-off set: the four stills, a sheet and both
  motion tests as mp4.
- `.cache/research/2026-11-08-super-agent-s3/lookdev-r2/` holds the critic and stranger
  reports of both rounds.

**Commands.** Frames are composition frames: film frame + 15 (the leader).
```sh
# the film (Main): full-size keys, then a draft span of at most 240 frames with its fresh-page check
pnpm aiv still super-agent --frames 930,2240,3165,5535 --label keys
pnpm aiv still super-agent --profile draft --frames 2735-2974 --span --encode --inner 3 --label b6-span
# the whole film, draft: chunked and resumable (exit 75 = the heavy lock is busy: wait and rerun)
pnpm aiv render super-agent --profile draft --budget-min 9
pnpm aiv audio super-agent --verify
pnpm aiv post super-agent --profile draft && pnpm aiv qa super-agent --profile draft
# lookdev round 2, the signed-off reference
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

**Open items carried over** (after session 4, 2026-11-11).
- **Show the user first.** None of these is approved yet.
  - The stills that changed from the signed-off set (`out/super-agent/stills/r2-final/`):
    - (a), composition 930 against `a-act-one-f915`: mean |ΔL| 5.3, on the heap, the loop's tabs
      and print, and the folders (session 4's rebuild of act one);
    - (b), 2240 against `b-report-up-f2225`: mean |ΔL| 1.0. A heap of dark slips left of the
      throat; "Router" about 57 px lower, its leader on the dispatch housing; a round gauge with a
      bezel (it was a square dial); the Thread tab as a red hook on tape cell 4 (it was an
      underline); the "ask" slip docked on W-09; dot rows on W-08's card where "run 2 / 41 ok" was;
    - (c), 3165 against `c-context-cache-f3150`: a round gauge; the throat's jaws and two enamel
      bosses stepped grey (they were lit white); the hopper a folded, tilted lid; the window's
      stubs in a new order, the red tab on the fifth; the drawer's tabs slightly higher; W-08's
      dossier carries beat 4's punched CI card; the left-edge bay lamp a neutral white (it was
      warm cream). The stress plate and the "ask" chevron are gone, as signed off;
    - (d), 5535 against `d-summary-f5520`: the heap of pressed slips left of the throat (beat 4
      leaves it as history), and the "Worker" label lower and further east. W-09's docked ask is
      gone, as signed off.
  - The camera: the bar-43 ease-out (f3360–3440) replaces STORYBOARD 6.4's move, and it does not
    follow the Thread.
  - Storyboard changes the build made:
    - 6.1: the strip leaves the tray and is gulped; the ride goes by crest and hop; the kinds mix;
    - 4.3: no door, and the hops go over the walls;
    - the gather tray, and the round gauge in still (c).
  - The score for bars 1–43, which no one has listened to yet. In the draft mp4 (film frame + 15
    over 30):

    | mp4 time | What to listen for |
    |---|---|
    | 0:05.8 | the title's thump (f160) |
    | 0:23.2–0:25.2 | the four chores landing (f680–740) |
    | 0:32.5, 0:37.8 | Fix A, then Fix B (f960, f1120) |
    | 0:41.2 | the break (f1220) |
    | 0:48.5 | the turn (f1440) |
    | 0:59.2–1:08.5 | the dispatches: bug, tests, docs (f1760, 2000, 2040) |
    | 1:13.5–1:15.0 | the stamp, then the reply landing (f2190, 2234) |
    | 1:19.0–1:21.8 | the key docks; three events arrive by themselves, each a dry tick (f2356; 2380, 2410, 2440) |
    | 1:22.8–1:30.2 | the spike; the slips' clacks and bells; the kept asks' softer ticks (f2470–2690; 2514, 2574, 2644) |
    | 1:33.8, 1:39.2 | the two batches (f2800, f2960) |
    | 1:43.2 | the cache ejects (f3080) |
    | 1:49.8–1:52.2 | the recall's three hops and its answer (f3280–3350) |
    | 1:55.2 | beat 7: the animatic bed begins (f3440) |
- **Part 1's leftovers.** These are the last critics' P1s and P2s. No P0 is open: the last
  one the round-4 critics found (Fix B's replies lighting up in place) was fixed and checked on
  renders.
  - Act one and the turn:
    - the title card reads as a sticker, and the break card has dark bars;
    - the riders' clip sinks into the reel at f1690–1694;
    - 3.3's focus;
    - the copy hands the vermilion back to the heap in about 4 f at f1130–1134 (the storyboard's
      step-down token is 12–16 f); the heap's request now steps by colour and reads as brick in
      3.2–3.3 (judge whether it leads the frame too much);
    - the throat window (fixer P's item 11, not fixed; its notes suspect the deck's tilt);
    - the credit's knockout leaves scalloped tape slivers between its lines;
    - the coil's height and its print (the turn's code review, item 6);
    - P2s:
      - Fix A's press reads as a fade;
      - a hairline loop ring at f1467–1480;
      - the coil sweep;
      - the spool slides in under C9;
      - the lamp touches the tape print and the strut;
      - the bug bay's slips stay lit as they fall;
      - the calendar's vellum crossfade;
      - three bays are drawn alike;
      - the stillness starts early.
  - Beat 4:
    - the tape stamp narrows (a design call);
    - the tower cap shows through the housing at f2071;
    - dispatch trips float and run 43 f (the storyboard has 20–28 f);
    - the Worker label's leader on W-08 differs from the storyboard;
    - `CARD_DEPTH`'s chroma mix of 1.05 needs a clamp in `gl/materials.ts`;
    - a phantom shade at f1769;
    - the docs slip dips about 10 codes for one frame at f2078, while it moves fast.
  - Beat 5:
    - the key's and the pile's sizes;
    - the trip reads only in crops;
    - arrivals leave no tape row, and kept slips stamp none;
    - the vermilion keep-side route, and the loupe;
    - P2s:
      - the tag leader runs over the trip slips;
      - 默认 sits near the flange;
      - the spike reads as a dial;
      - "COT" and "rule / drop";
      - two keys.
  - Beat 6:
    - the slips look alike (two glyphs);
    - the hopper's value jumps at f3146→3147;
    - the arm boss pokes the decode slips;
    - a dark band crosses the plate in flight, and a white sliver crosses the right edge;
    - hop 3 reads as a taut line;
    - the tape does not advance, and the stubs stay during the rewind;
    - the cache tag's leader and label start together;
    - beat 6's asks strike no key (the key is off frame), so the score is silent there;
    - the drawer (round 4's P1, the code review's MINOR 2): #0408 swings through the standing
      filed tabs as it lies back (c3138 reads "#U408"), its glyph bottoms show under the tabs over
      c3139–3148, and an "8" sits east of #0405 at c3150. Lift each tab per frame from #0408's top
      face (`FILED_LIFT` scales its end state linearly), and test the tab boxes against its slab;
    - the stress plate's contact cuts out in one frame as it unhooks at f3040 (the code review's
      MINOR 1): seat its first frame and fade the contact with the lift, as `clipContact` does;
    - the galley's coarse print is mirrored on purpose (cast type) and reads as garbled text at
      the wide (c2605) and the ease-out (c3405): the user's call, or flip its U;
    - `STRESS_LATE` (Batch.tsx, state.ts) is nearly moot now that the plate leaves at f3055;
    - from f3440 the footprints number 126 a frame (MAX_FOOTPRINTS is 128).
  - Beats 5 and 6, round 4's other leftovers:
    - W-10's lamp lights at c2338–2341 with no cue, and its body rises and steps down again over
      c2352–2365 (hold it on the late set too);
    - four frames after each impale (c2531, 2561, 2591) the spike pile's top slip brightens 10–20
      luma in one frame;
    - the throat's cheek shade splits a landed slip at its west face and changes in one frame on
      the landing (c2726);
    - strip slip 0.0 leaves 3 f earlier, while beat 5's last dropped slip is still in the air (off
      frame); nothing tests beat 5's slips against beat 6's;
    - W-08's dossier still carries beat 4's CI card in still (c); W-09's take-in could apply.
  - Still (c)'s critic, items 3 and 8.
  - Optional cues the fixers asked for: a dry unhook at f3040 as the stress plate lifts, and a
    soft card-into-slot at f2600 when W-09 takes its ask in.
- **Session 5's own** (the seams with part 2):
  - at the animatic's edge the Thread cord and the stamp appear in one frame at f3455 (the build
    replaces the animatic there);
  - the 主动 plate is half cut off during the bar-43 ease-out;
  - the trait plates' retirement (f5540–5570), and the pops and the plate's jump on the f5400
    boundary (QA's motion pops at 180.5 s; the others, 133.9 s and 207.2 s, are in the animatic);
  - `video.json` `qa.allowFreeze` declares the animatic's holds (composition 3455–5415 and
    5585–6735): shrink it as each beat is built, and remove it before the review cut.
- **From the lookdev critics, not re-checked in session 4.** Session 4 fixed the chat mark,
  (d)'s trace, MT1, MT2, (a)'s items and the Router leader (commits b528ae4, b693136). Still open:
  - (b):
    - "above" is still weak;
    - the bays read W-08, W-09, W-07 left to right. Renumbering bug → W-10 and fresh → W-11
      breaks the dispatch order, so this is a director call;
    - lifted shadows show the imprints as ghost cards (`gl/desk.ts` `imprintShade`);
  - (c): the summary ejects without anticipation, and the pointer glyph prints before the tab
    settles;
  - (d)'s right-hand blueprint cluster floats without a link, and to a stranger the unreadable
    micro-print reads as noise;
  - finish:
    - the slate tooth (std 0.55) is a director call;
    - IDs are about 24 px, under the 36 px read floor;
    - the per-object step-down stagger, the fanfold +1 and the engraved system boundary are not
      done.
- **Score:** bars 44–84 are the animatic bed (`audio/bed.ts`). The older reply's landing at
  f1656 is silent; a paper tick there is optional. QA measured six hits in the built part
  40–110 ms off their frames: hub +65 ms, strike-ghost −60, dispatch-docs +95, plate-detent +55,
  batch-2 +40 and recall +110. Its onset finder accepts any doubling of energy (docs/ROADMAP.md,
  Known gaps), so in a dense mix it may catch a neighbour: listen to these first.
- **Tooling:** motion QA only sees whole-frame changes, so one-frame swaps of small parts pass
  it. A cue-aware step test per tile would catch them (docs/ROADMAP.md, Known gaps).
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
