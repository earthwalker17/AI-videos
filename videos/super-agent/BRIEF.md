# Brief: Who Routes the Agents?

## Audience
Curious developers and tech-literate viewers who use AI coding agents or follow them. Some
have run several agent sessions at once and felt the juggling. Many have only seen the
headlines, and some of those present the article as a new DeepSeek product or a rival to
Claude Code. It is neither. The viewer does not need to have read the article.

- **Where:** YouTube in English and Bilibili in Simplified Chinese, on laptops and phones
  alike. On Bilibili, danmaku run across the picture. *Amended 2026-11-13: YouTube only. The
  user will not publish the film on Bilibili, so the zh captions are dropped; labels, plates,
  the title card and the end card keep their zh (README.md, Decisions).*
- **Languages:** English is the primary line and zh-Hans the second line, on screen together
  (the captions are English only since 2026-11-13).
- **What Bilibili viewers bring:** they may know the Chinese coverage (IT之家, 量子位) and the
  short, text-led "Vibe知识" films (比特新语 among them). The zh line therefore uses the
  terms that coverage uses, keeping Router, Worker, Trigger, Thread and Session in Latin
  script.

## Promise
By the end, the viewer can explain:
- why running many AI agents quietly makes one person their router;
- how the Super-agent design moves that job onto two levels: one long-lived Router above
  isolated Workers, one per task;
- how one Router keeps up: a filter drops the noise, waiting events go in together, context is
  kept as a cache, old tasks are recalled by their IDs, and follow-ups pass straight to their
  Worker;
- how waiting disappears: long jobs run in the background while new input goes in;
- what is only proposed (an always-on cloud loop, a Watchdog that checks progress) and what is
  still open (security, sharding, stepping in midway);
- what of it the public prototype builds, and what the authors' synthetic test does and does
  not show.

## Shape
- **Length: 3:44.0.** The user chose "~3:45, full depth (Recommended)" over the 2–3 minute
  target (session 3, 2026-11-08/09). That is 84 bars of 4/4 at 90 bpm, 80 frames a bar,
  6,720 frames, and replaces the 2:56 cut (66 bars, 5,280 frames).
  - The added time goes to how the design works: beats 4–7 and 9 take 36 of the 84 bars.
  - If the animatic needs more picture-only time, the first cut is N11 (its labels then land
    during C26–C27), then N3.
- **Format:** 16:9, 1920×1080 at 30 fps, BT.709, mastered at 1080p. One film; **no 9:16
  Short is planned.**
- **Text-led, no voiceover.** Each beat has one English line and one zh-Hans line,
  lower-left (EN baseline y 938, zh y 992, at most 1560 px wide), clear of danmaku and of
  YouTube's controls.
  - **The budget:** 36 narration lines, 25 kept from the 2:56 cut and 11 new (N1–N11). With
    the title card and the end card that is 38 text cues, plus 18 more: the credit subline,
    eight tags, the stress plate, the chart's lanes and token header, the test sheet's three
    hero stamps ("~½", "~10%", "2–4×", the same in both languages), the six classic-idea
    labels, and the status key, read on the summary map and again on the end card. English:
    394 words (347 narration, 11 title and credit, 36 end card). Chinese: 561 Han characters
    (499, 17 and 45). The persistent labels and the four trait plates come on top.
  - Narration windows cover 168.3 s of the 206.7 s before the end card, about 81%.
  - Every line holds for at least max(1.8 s, reading time + 0.6 s) + 0.1 s in both
    languages. The tightest margin is 0.06 s (C7, N2, N4, N5 and C27, all set by the zh line).
  - Text meant to be read is never below 36 px, read as font size (see Risks).
  - **Micro-print is texture only.** The user chose "Micro-print as texture (Recommended)"
    (session 3, 2026-11-08/09): small real print, at least 18 px, on paper and plates, which
    never carries anything needed to follow the film and never quotes the article's IDs or
    dialogues.
  - zh lines follow the Netflix zh-Hans style in
    [references/subtitles.md](../../references/subtitles.md): a space instead of commas
    and full stops, and full-width ： and ？.
  - Every zh string is signed off by the user: the kept ones on 2026-11-08, the new ones on
    2026-11-09 (SCRIPT.md, "zh sign-off").
- **Sound:** an original score, all synthesis and no samples, on the same 90 bpm grid.
  Mastered to -14 LUFS, true peak ≤ -1 dBTP. The sketch of bars 1–27 is re-laid on the
  84-bar sheet (bars 1–5 stay; the rest shifts or stretches), and bars 30–84 are new.
- **Captions:** a sidecar SRT per language (en, zh-Hans), to be generated from the cue
  sheet and linted in the release session. Nothing is burned in beyond the film's own
  on-screen lines.
- **Deadline:** none set. The plan now runs to six sessions: session 3 rebuilt the story and
  the look, sessions 4 and 5 build the beats and the score, and session 6 makes the review
  cut and the release.

## References
Tags: **[V]** verified in a primary source; **[S]** secondary (press, reprint or summary);
**[U]** unverified or our inference. All sources were accessed on 2026-11-08 unless a date is
given. Full notes, pins and URLs are in the repository's references and in
[sources.jsonl](sources.jsonl).

- **The article.** *Exploring Super-agent Design: Towards a More Autonomous Agent System* by
  the DeepSeek Harness team; its last block credits Yujia Qiao as author and implementer [V].
  - **What we take:** the argument and every number. Each claim cites its block in
    [FACTS.md](FACTS.md). Block 2 says the article discusses architectural ideas, not
    existing DeepSeek Harness features [V].
  - **What we refuse:** its figure layouts, its recurring example IDs and chat dialogues
    (on screen and in the micro-print), its blue accent and its cover image. Charts are
    re-plotted from its own numbers and say so. Its text is never committed.
  - **English pin:** a machine translation published as an X article: status
    2116857257245987236, created 2026-11-01T11:37:54Z. Its first block says it is a machine
    translation [V]. We read it through the fxtwitter API, a third-party proxy, and it is
    archived on the Wayback Machine at 20261104183343. Block numbers are 1-based. Re-read on
    2026-11-09: still 143 blocks, unchanged.
  - **Chinese original:** published by 2026-10-31, when IT之家 reported it at 21:36 and 量子位
    at 21:49, Beijing time [S]. That is before the English version, so the Chinese came
    first. IT之家 gives the title as 《Super-agent 设计探索：迈向更自主的 Agent 系统》, and
    量子位 leaves out 设计探索 [S]. The original WeChat/Zhihu post was not read, so its text and
    publish time are unverified [U].
- **The prototype.** `deepseek-ai/dsh-superagent-prototype` at `8c32a9d`. The full SHA is
  `8c32a9dc5d72c033816c6a8110b37f40cf94fba4`; it is the only commit on `main`, from
  2026-10-31. Licence MIT; Wayback snapshot 20261104092814 [V].
  - **What it is:** a DeepSeek Harness bundle that its README describes as a proactive
    coding agent for one GitHub repository; out of the box it acts only on explicit requests
    (see Risks). The README calls it a research prototype, not an official DeepSeek product,
    that differs from the team's internal version and leaves some of the article's designs
    unimplemented [V].
  - **What we take:** the built-versus-proposed matrix. It decides which parts are drawn
    solid (enamel and graphite: built), as vellum with a dashed edge (proposed) or in pencil
    (open), and which parts carry a "prototype" tag.
- **The look: the Register Desk (登记台).** It replaces the dark ink map, which the user did
  not approve at lookdev round 1 (2026-11-08: "the look is still too simple and crude to be
  something worth watching"). The spec is in [TREATMENT.md](TREATMENT.md).
  - **The world:** one dark slate desk at night under a long-lens camera, with three rules:
    context is paper, light is attention or work, and material is status. You are a small
    desk with a lamp; the Router is a raised register deck one level above, keeping one tape;
    each task gets a walled bay on the floor below.
  - **Light:** the user chose "Light where it means (Recommended)" (session 3, 2026-11-08/09):
    shaded objects, a key light and pools of light on a ground that is not flat. Emission and
    bloom only on live processes (a lamp that attends, a Worker that computes, one carrier in
    flight), never on structure or text; no nebula, stars or decorative particles.
  - **Angle and bloom:** the user chose "Desk, render both angles (Recommended)": the world is
    built once, and the key style frame is rendered at a 15° long-lens angle and straight down,
    each with bloom on and off. The user picks from those images.
  - **Micro-print:** "Micro-print as texture (Recommended)", as under Shape.
- **比特新语 (Bilibili), a style study, not a model.**
  - **How it was studied:** on 2026-11-08, first the public pages, preview sprites and
    covers; then frames watched in the user's own browser, logged out at 360p (one 1080p
    frame from the player's guest preview); then paused 1080p frames of three films in the
    user's browser, logged in with the user's consent, muted, view-only and nothing saved.
    The music question was answered from audio decoded silently in page memory, never played
    or saved. Findings are [V] for what was seen and [U] for what was inferred.
  - **The genre:** 18 of the channel's 26 uploads run 2:38–2:44 [V]. The loudness curves of
    four of the 2:41–2:42 films match, so they very likely share one music bed [U].
    Several descriptions say the films were made with Opus, and most pages checked carry
    Bilibili's AI-content label [V]. There is probably no voice: one caption line carries
    the narration over music [U].
  - **The look:** a tinted near-black, one accent, a serif display face against mono,
    morphs instead of cuts, real data, bookends and tiny citations. At 1080p the finish
    carries it, not the geometry: light only on the active element, dense real content,
    micro-type and motion from rules [U, judgement].
  - **Press:** a single syndicated piece criticises the genre's sameness (dark grounds,
    glowing lines, particles, beat-synced cuts, recurring topics) and calls the look "模型味"
    (model-flavoured) [S].
  - **What we take:** principles only. One dark ground for the whole film; one focal idea
    per frame; light only where something is live; real print as texture; one accent that
    carries meaning; a fixed line position; objects that persist and change role instead of
    cuts; structure planned on the music; a bookend; a quiet end card with sources; AI use
    declared from day one.
  - **What we refuse:**
    - its name, its title lockup and its 《X》 title habit;
    - the white-flash title on a shared music bed;
    - the bottom-centre serif subtitle band;
    - the gold-on-navy glow package;
    - the dedication end line;
    - its scenes, compositions and copy.
  - **What we leave out entirely:** glow on lines, structure or text; bloom outside the
    emission rule; blur and depth of field; particles, haze and vignette; serif type.
- **Repository notes written for this film:**
  - [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md):
    the article, the built-versus-proposed matrix, the mechanisms behind the 3:45 cut,
    reception, misreadings, the zh glossary and the pins.
  - [references/vibe-knowledge-style-2026-11.md](../../references/vibe-knowledge-style-2026-11.md):
    the genre and frame study (three passes), and the do-not-copy list.
  - [references/motion-graphics-2d-2026-11.md](../../references/motion-graphics-2d-2026-11.md):
    the 2D tooling delta, the fonts and CJK typesetting.
  - [references/agent-video-skills-2026-11.md](../../references/agent-video-skills-2026-11.md):
    the skills and method sources behind the frame-critic's craft rubric and the motion
    doctrine.
- **Earlier work in this repository:** [A Halloween Gift](../halloween-gift/README.md) is
  frozen. We take its bilingual caption pattern and the generic parts of its score's DSP and
  mastering, promoted as copies into shared packages; the film itself is never edited. Its
  noise GLSL, finish effect, spline and camera path, DOM-to-3D projection and material
  pattern are copied into `@aiv/remotion-kit` for the Register Desk, their second use
  (docs/ARCHITECTURE.md, decision 30).

## Risks
**Facts**
- **Built versus proposed.** At `8c32a9d` the prototype builds these [V]:
  - the two levels: a main session plus one Worker per ticket;
  - GitHub and Feishu triggers;
  - two-stage filtering, with the Slow Path run by the main session;
  - Threads with fan-out;
  - batching, per Thread;
  - context as a cache and recall by ID, in prototype form (cards with summaries and read
    pointers; every shown ID readable);
  - background jobs: a command moves to the background after 5 s;
  - the 100-word IM cap.

  It builds some parts differently:
  - proactive pickup only records until an operator switches it on, while explicit requests
    work in every mode;
  - the Router keeps a restricted shell, and staying out of the code is a prompt rule;
  - Workers do reply on GitHub, open PRs and post their own acknowledgements.

  Missing: stateless cloud compute with a shared database (state is one local SQLite file),
  bring-your-own-machine (BYOM), the Watchdog (an operator can set up an hourly
  status-and-restart check, which judges no progress), Router sharding and the experiment
  harness.

  The "built" tag is scoped to the two levels. Three prototype tags qualify the rest: the
  gate tag (proactive pickup off by default), tag-cache (summaries and read pointers) and
  tag-jobs (background after 5 s). The article's Router-level batching numbers come from the
  authors' stress test and are never attributed to the public code.
- **Synthetic experiments.** The article calls its results indicative only [V]:
  - Coding was simulated by a tool that only consumes time, and no model is named.
  - The chart's caption scales message intervals and work durations by 1/4 but not model
    call times. Whether the results table's minutes use the same clock is not stated [U].
  - On screen (C20–C23 and the test sheet's stamps "~½", "~10%" and "2–4×"): p95 roughly
    halves; p50 is only about 10% better than the stronger baseline; cache-read tokens run at
    2–4× the baselines (2.1× and 3.8×). Behind that, from the table: p95 15.7 vs 29.5 and
    29.0 min, p50 12.4 vs 13.8 min.
  - Pass-through does not make tasks finish faster. Without it the Router makes about 30%
    more decisions and reads about 37% more cache tokens (23.2M → 31.8M). Put the other
    way, pass-through means about 23% fewer decisions and about 27% fewer tokens. "37% fewer
    tokens" is an arithmetic error, and so was "about 30% fewer decisions" in the approved
    beat-5 line; C18 was corrected to "about 23% fewer" on 2026-11-08 (FACTS.md).
  - In the stress test the Router used a real model and the Workers mock models. As
    Trigger arrivals rose from about 1 to about 40 a minute, the average batch grew from 1.0
    to 2.8 and the amortised time per decision fell from 6.4 s to 1.6 s. Only the plate's
    endpoints are on screen. N4 gives the authors' reason, and the gain holds only up to a
    limit (FACTS.md, open item 9).
  - No minutes are shown as real-world time. "Synthetic", "re-plotted" and "indicative only"
    stay on screen.
- **Misreadings to avoid** [V against the article]:
  - "the Router decomposes tasks": it only dispatches and tracks how tasks relate;
  - "a Claude Code rival" or a new product;
  - "3–5 sessions is a measured limit": it is the authors' experience, and Cowan's "about
    four chunks" is not evidence for it;
  - "16 vs 29 minutes": these are p95 values over synthetic runs;
  - "39% faster": this is p50 against the baseline that never delegated;
  - "Workers talk to each other": in the design they coordinate only through shared Thread
    events;
  - "the Router never sees follow-ups": it sees every event and skips only the decision;
  - "it forgets nothing": recall reduces loss, and memory over months is open;
  - "the prototype has a Watchdog", or "the async loop is on (or off) by default in DeepSeek
    Harness": neither is said (FACTS.md, open item 8).
- **Framing.** Anthropic's brain/hands metaphor is not used. The film is made with Claude, so
  it makes no comparisons with competing agent products. The Chinese original is unread
  [U], so the zh terms follow IT之家 and 量子位 [S], and the user signs off every zh line.

**Rights**
- **On screen:** plain-text credits only: the title, the DeepSeek Harness team, the author
  and both dates. No logos, UIs, URLs or handles. Events are generic forms, not chat or
  GitHub screenshots, and the micro-print is our own text.
- **URLs:** in `publish/description.*`, [CREDITS.md](CREDITS.md) and
  [sources.jsonl](sources.jsonl). The README names the sources and points to sources.jsonl.
- **Non-affiliation notice:** on the end card, in the README and in the descriptions. The
  "Not claimed" list in [FACTS.md](FACTS.md) records that there is no endorsement and that
  the prototype is not an official product.
- **AI disclosure:** in the YouTube description, and through Bilibili's AI-content label
  (含AI生成内容).
- **Licences:** the fonts (IBM Plex Sans, Noto Sans SC, JetBrains Mono, and IBM Plex Mono if
  it replaces JetBrains Mono as planned) are OFL npm packages, credited in CREDITS.md and
  never committed. Picture and sound are original, so the film is CC BY 4.0.

**Technical**
- **A lit WebGL world is a new build cost.** The Register Desk is a WebGL world (React Three
  Fiber under the kit's `Stage3D` and `PostChain`, about 8 shader programs) under the DOM text
  layer, posed by one camera function (docs/ARCHITECTURE.md, decision 30).
  - **Speed:** estimated at 0.5–0.9 s per frame at 1080p [U], against the 0.20–0.21 s the DOM
    probe measured in session 2. That is 56–100 min per 6,720-frame pass, run chunked or
    overnight, one heavy job at a time.
  - **Shaders:** the first draw of *A Halloween Gift* took 119–225 s cold and 6.7 s warm
    ([engines/remotion/ENGINE.md](../../engines/remotion/ENGINE.md)), so lookdev keeps the
    GPU program cache and few programs.
  - **Probe gates before anything is built:** at most 0.8 s per frame; two fresh runs
    identical; fresh-page frames inside a span equal to the span's (`aiv still --span
    --inner`, decision 31); `GREY_TEXT` fringes at most 9 codes over the canvas; at most 3
    emitters; the ground at luma 38 or above.
  - **Fallback ladder** above 1.2 s per frame: simpler geometry, then the plan view only,
    then a CPU Canvas2D world without bloom.
  - **4K stays deferred:** there is no 4K profile, DOM text is not proven bit-exact at device
    scale 2, and the mezzanine would be about 32 GiB.
- **A desk can read as kitsch or a product render.** The style frames face a 25%
  silhouette test and a one-sentence stranger test, and the plan view is the built-in
  alternative. The frame-critic's craft rubric must first fail the round-1 stills the user
  rejected before it judges the new ones.
- **Text over WebGL is not yet proven.** DOM text over the old 2D ground was: two fresh
  1080p runs identical and 12 of 12 chunk-start checks matched
  ([knowledge/dom-text-determinism.md](../../knowledge/dom-text-determinism.md)). Its rules
  stay (DOM text ≤ 136 px in a `GREY_TEXT` layer); larger or lit text is drawn into a CPU
  canvas and used as a texture. Shadows are analytic, with no shadow maps.
- **Banding on a dark ground.** The world is dithered once at the 8-bit output, and the desk's
  corners never darken. Both are judged in 8× gain crops of the style frames.
- **Determinism.** The lint rule added in session 2 bans clocks, timers, unseeded randomness,
  CSS animation, WAAPI and the layout observers. World motion comes only from the frame
  index, as a sum over the cue sheet's events, which also drives the score's hits.
- **Reading load.** 36 bilingual lines cover about 81% of the time before the end card (the
  2:56 cut covered about 82%), and the zh line sets 31 of the 36 holds. The tightest hold
  clears its minimum by 0.06 s. A critic's rule of at least one bar of picture-only time per
  mechanism is not met: the typical gap between lines is about 1.3 s. To keep it readable:
  - every copy edit re-runs the hold check;
  - diagram action starts only after a line has settled;
  - the declared rests are kept, among them the 3.0 s sign-off rest;
  - the animatic decides whether N11, then N3, goes to buy picture-only time.

  If the 36 px rule turns out to mean cap height, the type grows to 52/44 px and the copy
  is trimmed.
- **QA on a dark look.**
  - **Black:** QA flags black when, for at least 0.5 s, 98% of a frame's pixels sit below
    Y 37.9 (BT.709 limited range). The desk `#212322` is Y 45.6, just above it, so no fade
    toward black is allowed outside a declared black cue; the film dissolves to the bare
    desk, never to black.
  - **Freeze:** freezedetect (-60 dB for 3 s) can flag still holds such as the end card.
    They are declared as hold cues, or as `allowFreeze` spans in `video.json`. Only working
    parts move, so any long still beat needs the same care.
- **Sound.** An agent cannot hear. The synthesised voices are new code, and the user's
  listening is the deciding check. The score sketch is stale against the 84-bar cue sheet
  until it is re-laid.
