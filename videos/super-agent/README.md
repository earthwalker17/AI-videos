# Who Routes the Agents?

A text-led explainer of just under four minutes, captioned in English (its labels in English and
Simplified Chinese), for curious developers on YouTube. It covers the DeepSeek Harness team's article
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

## Status: production, the whole film built (beats 1–13, the score for bars 1–84); the user's review is next
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
| 2026-11-13 | Bilibili, and the zh captions | "I'm not going to publish this film to BiliBili. So can you remove the Chinese captions if it's cheap to do? Leave other parts unchanged unless genuinely necessary." The notes block and the credit draw the EN line alone; the zh copy stays in `src/cues.ts`, and tags, plates, labels, the title card and the end card keep their zh |
| 2026-11-14 | Review of the session-6 draft | "Right, carry on (Recommended)": apply the answers below, fix the cheaper P2s, then the 1080p review cut |
| 2026-11-14 | zh in the picture | "Drop it from long plates (Recommended)": the long plates, the chart's labels and the idea labels go EN only; the short tags ("you · 你", the trait plates), the title card and the end card keep their zh |
| 2026-11-14 | C12 | "Change to 'answers you' (Recommended)": "Workers report up. Only the Router answers you." (its zh follows unsigned: not shown) |

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
5. **Session 5 (2026-11-12 to 11-13): build, part 2.**
   - **Done:**
     - beats 7–13 (f3440–6719) built in four waves of lanes, each lane with a frame critic and a
       fixer: the Thread and the job rail (7), the evidence sheet (8), keeping it running with
       the proposed Watchdog (9), still open (10), the sign-off and the old ideas (11), the
       bookend (12) and the end card (13). The animatic is gone;
     - the score composed for bars 44–84 against the finished picture (822f788), with its own
       review and fix round;
     - STORYBOARD rows 9.1–13.3 reconciled with the build (429573e).
   - The session stopped for low memory before its whole-film critic rounds.
6. **Session 6 (2026-11-13): finishing part 2.**
   - **Done:**
     - **User:** the film goes to YouTube only, so the zh caption line goes (059e437, aa973d9);
     - the full draft through `aiv post` and `aiv qa`;
     - critic round 1: four span critics, a stranger and adversarial verifiers found 1 P0 and
       15 P1s;
     - fix wave 1: three lanes (act one to beat 6, beats 7–8, beats 9–13), each with an
       implementer, an adversarial frame critic and a fixer (e1ca0c3); the score rebuilt from
       the new cues, its limiter 2.0 dB under post's ceiling (faf3027);
     - the draft rendered again, QA passed (-14.0 LUFS, -2.0 dBTP; the reading holds declared);
     - critic round 2: act one passes, no P0, and the one confirmed P1 (a regression: your lamp's
       arm vanished under the stamp's hatch) fixed (8bfa0f0); the P2s left are listed under Handoff;
     - the draft rendered again for the user's review (8bfa0f0: QA passed, -14.0 LUFS, -2.0 dBTP);
     - the docs: this README, STORYBOARD, `video.json` `next`, the roadmap.
   - **User:** reviews the film, the changed stills and the score (Handoff).
7. **Review cut, then release.**
   - The 1080p review cut through `aiv qa`.
   - Caption tooling (an SRT generator and a subtitle linter).
   - `publish/` (the YouTube description, chapters, AI disclosure), the thumbnail.
   - The final and `aiv release`.
   - **User:** approves the review cut, then the final.
   - Push, tag and GitHub release only when the user asks.
8. **Buffer.**

## Handoff (for the next session)
**Start here.** Read this section and `video.json` `next`. The whole film is built (film f0–6719,
beats 1–13) and the score covers all 84 bars. Session 6 ran two whole-film critic rounds and a fix
wave between them. Two things are left:
- the user's review of the film, its changed stills and its score (below);
- then the review cut and the release (the session plan).

The look is signed off (2026-11-10). The visual spec in force is [TREATMENT.md](TREATMENT.md)
"Art direction v2: The Register Desk", with the user's picks (15° pitch, bloom 0.3), the standing
decisions below, and what STORYBOARD.md's "Settled in the build" sections record.

**How sessions 4–6 worked, and what to keep.**
- **Lanes:** one implementer per lane of frames, never two on the same files. Each lane is
  followed by an adversarial frame critic on its final renders, then a fixer for what the critic
  found.
- **Whole-film critic rounds:** four span critics plus a stranger who has no project context.
  Every P0/P1 goes to a verifier told to refute it; in round 1 about a fifth were downgraded or
  refuted. Brief the critics with the known-open and accepted lists, so they do not re-prove them.
- **Tile diffs around every event:** motion QA only sees whole-frame change, so this is the check
  that finds one-frame swaps of small parts.
- **Briefs** that name the contact frames, the files owned and the renders to make kept the lanes
  apart.

**Where things are.**
| Path | What |
|---|---|
| `src/cues.ts` | Every on-screen string (EN, zh) and span on the 84-bar grid, and the event schedules (`BEAT_4`…`BEAT_11`, `MT1`, `END`): `cue(id)`, `at(bar, beat)`. Since 2026-11-13 the notes block draws the EN line only; the zh copy stays signed off here. `hold` spans declare the reading holds QA allows. It is in both the picture's and the score's input hash: a cue change means `aiv audio`, then `--verify`, before `aiv post` |
| `src/print.ts` | Micro-print strings (texture only, ≥ 18 px, never read as content); the font plan reads them with WORDS |
| `src/look/` | Palette, type scale, `MAX_TEXT_PX` (136), `STEP_DOWN`, the notes layout `NOTES`; fonts (Plex Sans, Noto Sans SC slices planned from WORDS, IBM Plex Mono) |
| `src/kit/` | Film-agnostic 2D parts the overlay uses: timeline and easings, the notes block (an EN line, a zh line optional) and labels (`GREY_TEXT`), camera maths, diagram and sketch helpers |
| `src/desk/` | The Register Desk:<br>• `layout.ts`, `geom.ts`: world coordinates.<br>• `film.ts`: the segments (act one [0, 1400), the turn [1400, 1660], act two [1661, 5400), the summary [5400, 6200), the end [6200, 6720)), act two's labels and tags. `FilmFrame.tsx` draws a film frame from them (its animatic slate still exists, but draws nothing now that every beat is built).<br>• Pure schedules, every effect a sum over one event list: `actOne.ts`, `you.ts`, `beat3.ts` (Fix A, Fix B), `turn.ts`, `state.ts` (act two's world, the focus steps, `EVENTS_B`/`C`/`D`), `beat4.ts` to `beat11.ts`, `proposed.ts` (beats 9–10's proposed parts), `summary.ts` (still (d) and the sign-off), `end.ts` (the bookend and the dissolve), `endCard.ts`.<br>• `camera.ts`: framings and moves. `footprints.ts`, `fpKit.ts`, `pools.ts`: analytic SDF shadows and light pools. `springs.ts`, `marks.ts`, `onScreen.ts`: springs, marks and screen-space checks.<br>• `gl/`: desk shader, light set, materials, post, canvas text; `plate.ts` the trait and stress plates; `print5.ts`–`print8.ts` beats 5–8's print; `veil.ts` the dissolve.<br>• `objects/`: one file per part or beat: Register, Bay, YourDesk, Intake, Links, Handshake, Dispatch, Counterfactual, Filter, Batch, Cache, Recall, Proposed, Trace, ActOne, TitleCard, Turn, FixCards, Replies, Thread (7.1), Jobs (7.3), Evidence (beat 8), Beat7–Beat11, End, World.<br>• `*Frame.tsx`, `DeskWorld.tsx`, `Overlay.tsx`: a frame's world and its DOM labels and notes, posed by one camera function.<br>• Tests: a `*.test.ts` per schedule (614 tests in the video, with the cue sheet's and the score's) |
| `src/lookdev/round2.tsx`, `frames.ts` | Lookdev round 2, its own entry: `StillA15` (a), `StyleB15` (b, and MT1's span), `StillC15` (c), `StillD15` (d), `MT2`, the 0° and no-bloom variants and ground twins. The signed-off reference; the film draws the same frames through `FilmFrame` |
| `src/lookdev/probe.tsx` | The determinism probe ('Probe') and the notes width sheet ('Notes') |
| `src/Main.tsx` | The leader test card (15 frames), then the film: `desk/FilmFrame.tsx` for every film frame |
| `audio/` | The score on the 84-bar grid (`index.ts`, one stereo track `mix`; the master at -14 LUFS with its limiter at -3.5 dBTP). `arrangement.ts` lists the parts, one module per stretch: `actOne.ts` (bars 1–12), `fixes.ts` (13–18), `levels.ts` (19–29), `keepUp.ts` (30–43), `waiting.ts` (44–49), `evidence.ts` (50–57), `persistent.ts` (58–62), `open.ts` (63–68), `signoff.ts` (69–77), `endCard.ts` (78–84). `continuity.ts` is the Router's layer (pad, bass pulse, memory ticks) from the turn to the end, with part two's harmonic plan. `places.ts` holds part two's pans (copies of desk positions and the camera plan, each held equal to its source by the tests). `instruments.ts`, `foley.ts` and `common.ts` are shared. `score.test.ts` holds every sync point to the cue sheet and to the picture's own frames |

On the reference host only, since `out/` and `.cache/` are not in git:
- `out/super-agent/stills/r2-final/` holds the signed-off lookdev set.
- `out/super-agent/post/draft/super-agent.mp4` is the current draft (8bfa0f0).
- `out/super-agent/stills/s6-r2-full/`, `s6-r2-full-b/` and `s6-r2-events/` hold full-size stills
  of it. `s6-r1-full*` hold the same frames before the fix wave.

**Commands.** Frames are composition frames: film frame + 15 (the leader).
```sh
# the film (Main): full-size keys, then a draft span of at most 240 frames with its fresh-page check
pnpm aiv still super-agent --frames 930,2240,3165,3454,5435,5446,5535 --label keys
pnpm aiv still super-agent --profile draft --frames 2735-2974 --span --encode --inner 3 --label b6-span
# the whole film, draft: chunked and resumable (exit 75 = the heavy lock is busy: wait and rerun)
pnpm aiv render super-agent --profile draft --budget-min 9
pnpm aiv audio super-agent && pnpm aiv audio super-agent --verify
pnpm aiv post super-agent --profile draft && pnpm aiv qa super-agent --profile draft
# lookdev round 2, the signed-off reference
pnpm aiv still super-agent --entry src/lookdev/round2.tsx --composition StillD15 --frames 5535 --label r2-d
pnpm exec vitest run videos/super-agent --maxWorkers=2
```
Measured on the reference host (session 6):
- a draft pass is 113 chunks and about 46 minutes, in five or six foreground calls of 9 minutes;
- a call cut off by its timeout during the final mezzanine hash resumes there when rerun;
- a full-size still takes 4–6 s after a 4–8 s boot;
- the test suite takes about 7 minutes.

Check free memory first, and close Chrome if it is connected.

The signed-off lookdev stills hash as follows (first 12 hex of the RGBA sha256): (a)
`5cb677648515`, (b) `6b660e981ea9`, (c) `43d104d679bb`, (d) `fc8ee34c5a43`. The film's own keys
at 8bfa0f0:

| Composition frame | Hash |
|---|---|
| 930 | `db1f4491385a` |
| 2240 | `dfb63474e476` |
| 3165 | `c85833f97b92` |
| 3454 | `5ccf303e78ec` |
| 5435, 5438, 5439, 5446 | `96ca2cbb49ca` (still equal to each other) |
| 5535 | `8c8005727eea` |

A change that should not touch a key keeps its hash.

**Standing look decisions** (session 3, on top of TREATMENT.md).
- **D1:** no Thread cord before C17 (f3440). It pays out at 7.1 through a guide on the
  Register's frame; until then a Thread is a row on the tape.
- **D2:** only a teaching ID chain (#0405, #0408) is readable as numbers (about 24 px today).
  Every other row, card and folder carries marks or texture print. The docs galley's cast type
  reads right-way round (the user, 2026-11-12).
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
- A part's own footprint stays under its own top face (`TOP_CLEAR`) through every squash, tilt
  and landing. Otherwise the part shades itself, whole, for the frames it pokes through: F6–F8's
  blink, MT1's slip and the stress plate's band in session 6.
- Proof per change:
  - two fresh stills hash-identical;
  - every span rendered with `--inner 3` (fresh-page frames equal the span's).
- Screen speed is tested per frame through the camera:
  - 700 px/s for a move's aim point;
  - 2410 px/s for an object in flight;
  - a flight at 2.4× needs about four times the frames it needs at 0.6×.
- A still stretch on purpose is a `hold` cue in `src/cues.ts`, and QA allows only those. Anything
  else that holds 3 s needs a working part to keep its beat.
- DOM text ≤ 136 px in a `GREY_TEXT` layer. Larger or in-world text is a canvas texture.
- The ground stays above limited-range luma 38 (QA's black detector); the desk shader's floor is
  40.
- Keep the GL programs few and cached (the kit's GPU program cache): cold shader compiles cost
  minutes.
- The score's master sits 2.0 dB under post's ceiling (-3.5 dBTP). The draft's 192k AAC encode
  overshot a struck note by 1.7 dB at the kit's 1.1 dB margin.
- A pass that writes depth unconditionally (the stamp hatch's punch, the veil's depth reset) erases
  every part drawn before it in its screen area. Draw the parts that stand over it after it (your
  lamp: render order 13).
- Two implementers never edit the same files at once. Give each a disjoint set of files; shared
  files get small, re-read edits that each implementer reports. Agents on Windows can leave CRLF
  in files: normalise to LF before rendering, or the input hash differs from the commit's.
- Critic scores are evidence, not the bar. The user signed off a set the critic scored 23–30 of
  38, after rejecting round 1 that an uncalibrated critic had passed. Ask the user early, with
  images.

**For the user's review** (session 6; none of this is approved yet).
- **The film:** `out/super-agent/post/draft/super-agent.mp4` (the 960×540 draft at 8bfa0f0,
  QA passed).
- **The stills that changed** since the user last saw them (part 1, 2026-11-12):
  - the throat now lights a slip lying in it: keys 2240, 3165, 3454, the seam and (d), at the
    throat only;
  - still (d): the pencil flag on the stuck bay's south-east corner, the Watchdog's aim, the
    hand-sized rubber stamp at rest and its framed green tick;
  - the notes block in English only.
- **New elements from the fix wave:**
  - the vermilion tear-off stub on Fix A's copy of the request (beats 3–4);
  - the ink tab on the stuck drum's card under N8;
  - the rubber stamp rising out of a hatch (11.1);
  - the travelling etch crawl (10.1);
  - the counterfactual cards sliding out of slots (7.2–7.3).
- **Questions:**
  - Should the zh also go from the tags, plates and labels now that the film is YouTube only?
    The round-2 stranger found the short tags ("you · 你", the trait plates) added character, and
    the long bilingual plates and the chart's doubled labels distracting (1:07–1:27, 2:05–2:32,
    3:06–3:15).
  - C12 keeps its signed-off line. Open option: "Workers report up. Only the Router answers
    you.", which also holds for the prototype and would need a new zh sign-off.
- **The score.**
  - Bars 1–43: the user heard them ("Right direction"). Since then the only change is the
    master's limiter at -3.5 dBTP: up to 0.9 dB more limiting on the loudest peaks.
  - Bars 44–84: nobody has listened yet. In the draft mp4 (film frame + 15 over 30):

    | mp4 time | Film frames | What to listen for |
    |---|---|---|
    | 1:55.2–1:57.8 | f3440–3520 | 7.1: the Thread cord pays out (a twisted friction), a low pluck as the follow-up clips on, then the motif an octave up over the bar line with the bass pulse skipped (the follow-up skips the Router's decision) |
    | 2:01.8, 2:04.1 | f3640, 3708 | 7.2–7.3: an ink click and a dry scratch as each ghost card is struck |
    | 2:04.5–2:07.2 | f3720–3800 | 7.3: the long job: a marimba A4 held as a bowed tone that recedes while the capsule laps its rail, then a chord as it docks back; between them a sand trickle (the glass docks) and an enamel tap (Productive) |
    | 2:08.5, 2:09.8 | f3840, 3880 | 7.4: one felt-piano D5 (the short reply, light), then a paper slap and a low thump (the heavy dossier) |
    | 2:11.2 | f3920 | 8.1: the pad releases and a soft mallet pulse over a held bass begins (beat 8 has no pad): the thinning should feel deliberate |
    | 2:13.8–2:15.2 | f4000–4040 | 8.2: the caveat stamp, then three held tones, the top one stopping at half length (the halving) |
    | 2:18.8, 2:19.2 | f4150, 4160 | 8.3: an open-fifth tick (the bracket), a print tap ("~10%") |
    | 2:23.5–2:25.8 | f4290–4360 | 8.4: four muted clicks on eighths with one missing, a held F♯4 (the long run), the bass back with a G chord |
    | 2:28.5–2:29.8 | f4440–4480 | 8.5: three rising marimba notes, the last heavier, with a print tap ("2–4×") |
    | 2:32.5–2:34.4 | f4560–4616 | 9.1: the turn to B minor, then four airy breaths as the vellum parts are laid down (not whooshes) |
    | 2:33.7 | f4596 | 9.1: a soft latch: your laptop's lid shuts (since session 6, once your desk is in frame) |
    | 2:35.2–2:36.5 | f4640–4680 | 9.1: a short low hum (the strut docks on the loop), a papery tap (the Persistent plate), a machine's lamp click, a slip dropping in |
    | 2:40.5–2:45.5 | f4800–4950 | 9.2: a woodblock knock and an inspector's bell on each sweep; under them the stuck bay's damped two-note loop (it should sound stuck, not busy); a pencil stroke as the flag is pinned (f4900) |
    | 2:45.8 | f4960 | 10.1: two beats of digital silence |
    | 2:47.2–2:50.5 | f5000–5100 | 10.1: a low D–E♭ drone (the intrusion), three descending notes (one per machine), a pencil stroke as the pad suspends |
    | 2:51.2–2:55.8 | f5120–5260 | 10.2: the pad turns to G minor and its notes split and drift (a slow wobble, not a chorus); a paper tear; a ghost of beat 3, hard left and hard right; a pencil stroke |
    | 2:56.5–3:01.2 | f5280–5420 | 10.3: a felt-piano G4 left unresolved; reporting back (D5 → A4); a soft pop as the reply lands, then 20 frames with nothing new |
    | 3:01.8 | f5440 | 11.1: the stamp: a felt thump and the motif completed (A4 D5 F♯5), the pad resolving to D major |
    | 3:01.8–3:06.2 | f5440–5570 | a slow scratching drag following the trace, then the rest (the held Dmaj9) |
    | 3:06.5–3:10.5 | f5580–5700 | 11.2: six ink clicks left to right (the idea labels), the bass back, a print tap (the key) |
    | 3:12.5–3:13.6 | f5760–5792 | 11.3: act one's theme, softer, in D Dorian, as the act-one card rests |
    | 3:16.5–3:17.2 | f5880, 5900 | 11.4: the motif at half speed |
    | 3:20.5–3:25.8 | f6000–6160 | 12.1: one quiet tick a beat (frame 0's rhythm); the motif once with no answer as the slip turns vermilion (f6100); the print head's soft stamp-in on the dissolve's first frame |
    | 3:27.2–3:44.5 | f6200–6719 | 13: a solo mallet plays the motif as the end card lands, four more times, softer and further apart, once at half speed, then one long D5 decaying to nothing |

**Open after critic round 2** (2026-11-13). No P0 or P1 is left: the one confirmed P1, your
lamp's arm vanishing under the stamp's hatch at comp 5447–5451, was fixed in 8bfa0f0. Everything
below is P2: crop-level, or seen only on a careful watch. A pass over it is optional before the
review cut, and the user's review may reorder it.
- **Motion and speed:**
  - the cache card glides at about 2600 px/s, 8% over the cap, and stops hard (comp 3096–3114).
    Its eject (f3080) and dock (f3098) leave 17 f in frame; moving them is a cue change;
  - the counterfactual cards of beats 4, 10 and 11.3 still come and go across the frame's edges:
    beat 4's at about 3800 px/s, the act-one card over the cap on its last two exit frames.
    7.2–7.3's cards slide out of slots;
  - the title card posts in and out at about 3100–3400 px/s; the stress plate slides in from
    beyond the east edge;
  - the trait plates retire at 1200–1800 px/s (f5528–5560): their cue frames cap the flights.
- **One-frame steps:**
  - the first ask slip's tilt snaps flat at the throat's mouth (comp 1634→1635);
  - MT1's slip turns one value at 2259→2260;
  - W-10's nameplate and panel step while it rises (2307→2308, 2310→2311);
  - the heavy dossier blinks as it lands (3892–3903);
  - a rider sliver at the spout (3485); its clip is drawn over the spool, then under it
    (3496–3498);
  - a light sliver flickers at the frame edge in the close (3212–3218, 3334–3345);
  - the shard window's "#0404" double-prints over "#0405" as it retracts (5303–5305);
  - the request's transit light comes on in one frame (1666).
- **Reading and focus:**
  - the turn's press still reads mostly as a fast fade at speed: the tone change outweighs the
    squash;
  - 7.3 is still busy: the rider, the peel, the tag and the glass start within about 20 f. The
    jobs tag sits tight between W-08's nameplate and the Productive plate, and the capsule is
    about 86 px;
  - under N8 the reel and W-07's slot light still outweigh the Watchdog by area. The flag's
    pennant is about 35×27 px. The lid shuts during the bar-58 move's fastest frames, with the
    laptop clipped by the frame edge;
  - under C25 the reel's paper stays at full value;
  - beat 8's legend leaves the notches and the long-run band undefined, and its load tag is the
    brightest text in the beat;
  - the lamp's steps at the reply (f2237) and at the stamp (f5440) are about 3 codes: too small
    to see;
  - the end card sits on a flat ground, without the storyboard's one warm pool;
  - the captions in the close cross the light notes card's edges (N4–N6);
  - the summary's traces never retire, and lie over the bookend's queued replies;
  - labels: "Router" and "Worker" come back in different places after the close; the
    full-duplex leader runs beside the Thread cord; at 0.85× the Worker leader's dot sits on the
    "8" of #0408, and the lamp's reach for "stepping in" covers its "0".
- **Known from before, as described:**
  - the reel's wedge (comp 1587–1590);
  - the jaw's step at the seam (film 1660/1661, in Register.tsx's geometry);
  - the tower cap through the housing (2173→2174, as in the signed-off MT1);
  - the request's copy on the spout's housing (994–995);
  - the key's trip, readable only in crops;
  - 3.3's focus;
  - W-10's lamp lighting without a cue (2338–2341);
  - the arm's boss through the decode slips;
  - the riders sinking into the reel;
  - beat 4's floating dispatch trips;
  - the bookend's lamp-lit chute.
- **The round-2 stranger** had no project context. They took away the argument and found the film
  honest about what is built and what is proposed. Their main notes:
  - the wide shots fill a central band, and much in-world text is unreadable at 540p: "a
    handsome animated system diagram rather than a top-tier cinematic explainer". The 2.4×
    close is the best stretch;
  - it drags at the act-one desk (0:14–0:32), at the open beat's wide map (2:33–3:01) and on the
    end card (3:27–3:43). It rushes the turn (0:48–0:53) and the idea labels (3:06–3:15);
  - the long bilingual plates and the chart's doubled labels distract; the short "you · 你"
    tags add character;
  - the test-card leader read as a broken upload. The final drops it (ARCHITECTURE decision 24).

**Tooling and shared, not blocking** (docs/ROADMAP.md, Known gaps).
- Motion QA only sees whole-frame changes, so one-frame swaps of small parts pass it. A
  cue-aware step test per tile would catch them.
- QA's onset finder accepts any doubling of energy, so in a dense mix it can pick a neighbour:
  six of part one's hits measure 40–110 ms off although each is placed on its frame (session 5
  checked them).
- The frozen *A Halloween Gift*'s hash licence (shadertoy 4djSRW); LCD fringes on the kit's own
  `TestCard` and `Title`; `@aiv/remotion-kit` has no `"sideEffects": false`, so 3D code is bundled.

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
