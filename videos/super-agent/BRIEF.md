# Brief: Who Routes the Agents?

## Audience
Curious developers and tech-literate viewers who use AI coding agents or follow them. Some
have run several agent sessions at once and felt the juggling. Many have only seen the
headlines, and some of those present the article as a new DeepSeek product or a rival to
Claude Code. It is neither. The viewer does not need to have read the article.

- **Where:** YouTube in English and Bilibili in Simplified Chinese, on laptops and phones
  alike. On Bilibili, danmaku run across the picture.
- **Languages:** English is the primary line and zh-Hans the second line, on screen together.
- **What Bilibili viewers bring:** they may know the Chinese coverage (IT之家, 量子位) and the
  short, text-led "Vibe知识" films (比特新语 among them). The zh line therefore uses the
  terms that coverage uses, keeping Router, Worker, Trigger, Thread and Session in Latin
  script.

## Promise
By the end, the viewer can explain why running many AI agents quietly makes a person their
router, how the Super-agent design moves that job to a long-lived Router above isolated
Workers, and what of it the public prototype builds, what the authors' synthetic test shows
and what is still open.

## Shape
- **Length:** a 2–3 minute target; **2:56 planned**. That is 66 bars of 4/4 at 90 bpm,
  80 frames a bar, 5,280 frames. If 2:56 proves too long, the planned fallback trims are
  cues C7 and C22 (an open item).
- **Format:** 16:9, 1920×1080 at 30 fps, BT.709. One film; **no 9:16 Short is planned.**
- **Text-led, no voiceover.** Each beat has one English line and one zh-Hans line,
  lower-left (EN baseline y 938, zh y 992, at most 1560 px wide), clear of danmaku and of
  YouTube's controls.
  - The budget: 30 cues, 300 English words and 416 Han characters.
  - Every line holds for at least max(1.8 s, reading time + 0.6 s) + 0.1 s in both
    languages.
  - Text is never below 36 px, read as font size. That reading is an open item; see Risks.
  - zh lines follow the Netflix zh-Hans style in
    [references/subtitles.md](../../references/subtitles.md): a space instead of commas
    and full stops, and full-width ： and ？.
- **Sound:** an original score, all synthesis and no samples, on the same 90 bpm grid.
  Mastered to -14 LUFS, true peak ≤ -1 dBTP.
- **Captions:** a sidecar SRT per language (en, zh-Hans), to be generated from the cue
  sheet and linted in the release session. Nothing is burned in beyond the film's own
  on-screen lines.
- **Deadline:** none set. The plan has four sessions and a fifth as a buffer.

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
  - **What we refuse:** its figure layouts, its recurring example IDs and chat dialogues,
    its blue accent and its cover image. Charts are re-plotted from its own numbers and say
    so. Its text is never committed.
  - **English pin:** a machine translation published as an X article: status
    2116857257245987236, created 2026-11-01T11:37:54Z. Its first block says it is a machine
    translation [V]. We read it through the fxtwitter API, a third-party proxy, and it is
    archived on the Wayback Machine at 20261104183343. Block numbers are 1-based.
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
  - **What we take:** the built-versus-proposed matrix. It decides which lines are drawn
    solid (built), dashed (proposed) or as a sketched "?" (open).
- **比特新语 (Bilibili), a style study, not a model.**
  - **How it was studied:** on 2026-11-08, first the public pages, preview sprites and
    covers; then frames watched in the user's own browser, logged out at 360p (one 1080p
    frame from the player's guest preview). The music question was answered from audio
    decoded silently in page memory, never played or saved. Findings are [V] for what was
    seen and [U] for what was inferred.
  - **The genre:** 18 of the channel's 26 uploads run 2:38–2:44 [V]. The loudness curves of
    four of the 2:41–2:42 films match, so they very likely share one music bed [U].
    Several descriptions say the films were made with Opus, and most pages checked carry
    Bilibili's AI-content label [V]. There is probably no voice: one caption line carries
    the narration over music [U].
  - **The look:** a tinted near-black, one accent, a serif display face against mono,
    morphs instead of cuts, real data, bookends and tiny citations.
  - **Press:** a single syndicated piece criticises the genre's sameness (dark grounds,
    glowing lines, particles, beat-synced cuts, recurring topics) and calls the look "模型味"
    (model-flavoured) [S].
  - **What we take:** principles only. One dark ground for the whole film; one focal idea
    per frame, with empty space; one accent that carries meaning; a fixed line position;
    objects that persist and change role instead of cuts; structure planned on the music;
    a bookend; a quiet end card with sources; AI use declared from day one.
  - **What we refuse:**
    - its name, its title lockup and its 《X》 title habit;
    - the white-flash title on a shared music bed;
    - the bottom-centre serif subtitle band;
    - the gold-on-navy glow package;
    - the dedication end line;
    - its scenes, compositions and copy.
  - **What we leave out entirely:** glow, bloom, blur, particles, vignette and serif type.
- **Repository notes written for this film:**
  - [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md):
    the article, the built-versus-proposed matrix, reception, misreadings, the zh glossary
    and the pins.
  - [references/vibe-knowledge-style-2026-11.md](../../references/vibe-knowledge-style-2026-11.md):
    the genre and frame study, and the do-not-copy list.
  - [references/motion-graphics-2d-2026-11.md](../../references/motion-graphics-2d-2026-11.md):
    the 2D tooling delta, the fonts and CJK typesetting.
- **Earlier work in this repository:** [A Halloween Gift](../halloween-gift/README.md) is
  frozen. We take its bilingual caption pattern and the generic parts of its score's DSP and
  mastering, promoted as copies into shared packages; the film itself is never edited.

## Risks
**Facts**
- **Built versus proposed.** At `8c32a9d` the prototype builds these [V]:
  - the two levels: a main session plus one Worker per ticket;
  - GitHub and Feishu triggers;
  - two-stage filtering;
  - Threads with fan-out;
  - batching, per Thread;
  - ID-addressable recall;
  - the 100-word IM cap.

  It builds some parts differently:
  - proactive pickup only records until an operator switches it on, while explicit requests
    work in every mode;
  - the Router keeps a restricted shell, and staying out of the code is a prompt rule;
  - Workers do reply on GitHub.

  Missing: stateless cloud compute with a shared database (state is one local SQLite file),
  bring-your-own-machine (BYOM), the Watchdog (only an hourly status-and-restart prompt
  exists), Router sharding and the experiment harness.

  The "built" tag is scoped to the two levels. The article's Router-level batching numbers
  come from the authors' stress test and are never attributed to the public code.
- **Synthetic experiments.** The article calls its results indicative only [V]:
  - Coding was simulated by a tool that only consumes time, and no model is named.
  - The chart's caption scales message intervals and work durations by 1/4 but not model
    call times. Whether the results table's minutes use the same clock is not stated [U].
  - On screen: p95 roughly halves; p50 is only about 10% better than the stronger baseline;
    cache-read tokens run at 2.1–3.8× the baselines. Behind that, from the table: p95 15.7
    vs 29.5 and 29.0 min, p50 12.4 vs 13.8 min.
  - Pass-through does not make tasks finish faster. Without it the Router makes about 30%
    more decisions and reads about 37% more cache tokens (23.2M → 31.8M). Put the other
    way, pass-through means about 23% fewer decisions and about 27% fewer tokens. "37% fewer
    tokens" is an arithmetic error, and so was "about 30% fewer decisions" in the approved
    beat-5 line; C18 was corrected to "about 23% fewer" on 2026-11-08 (FACTS.md).
  - In the stress test the Router used a real model and the Workers mock models. As
    Trigger arrivals rose from about 1 to about 40 a minute, the average batch grew from 1.0
    to 2.8 and the amortised time per decision fell from 6.4 s to 1.6 s.
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
    events.
- **Framing.** Anthropic's brain/hands metaphor is not used. The film is made with Claude, so
  it makes no comparisons with competing agent products. The Chinese original is unread
  [U], so the zh terms follow IT之家 and 量子位 [S], and the user signs off every zh line.

**Rights**
- **On screen:** plain-text credits only: the title, the DeepSeek Harness team, the author
  and both dates. No logos, UIs, URLs or handles. Events are generic glyphs, not chat or
  GitHub screenshots.
- **URLs:** in `publish/description.*`, [CREDITS.md](CREDITS.md) and
  [sources.jsonl](sources.jsonl). The README names the sources and points to sources.jsonl.
- **Non-affiliation notice:** on the end card, in the README and in the descriptions. The
  "Not claimed" list in [FACTS.md](FACTS.md) records that there is no endorsement and that
  the prototype is not an official product.
- **AI disclosure:** in the YouTube description, and through Bilibili's AI-content label
  (含AI生成内容).
- **Licences:** the fonts (IBM Plex Sans, Noto Sans SC, JetBrains Mono) are OFL npm
  packages, credited in CREDITS.md and never committed. Picture and sound are original, so
  the film is CC BY 4.0.

**Technical**
- **Large DOM text determinism is untested.** The kit lists DOM text at large sizes as not
  tested. GPU-canvas glyphs from 166 px at weight 600 varied between renders, and on the
  last film a CSS shadow composited differently on chunk-start frames. The probe in session
  2 runs `aiv still --check` on frames right after a chunk start and two `--fresh` renders
  before any film code. The web engine is the fallback only if the DOM probe fails.
- **2D render speed is unmeasured.** Every figure is extrapolated from the 3D template
  (0.28–0.37 s per frame at 1080p on the reference host). The estimate is 0.2–0.4 s per
  frame, about 18–35 min per 1080p render and a 3.5–4 GiB review mezzanine. Whether a
  2D-only bundle tree-shakes the kit's 3D exports is also unchecked.
- **Banding on a dark ground.** The DOM path has no dither. The ground stays flat (its centre
  may lift, its corners never darken), and a static seeded dither tile is planned. Both are
  judged on the lookdev stills.
- **Determinism-lint blind spots.** The lint bans clocks, timers and unseeded randomness. It
  does not yet catch CSS `transition`, `animation` or `@keyframes`, `element.animate()`,
  `getAnimations()`, or `ResizeObserver` and `IntersectionObserver`. The rule is added in
  its own commit before any kit or film code.
- **Reading load.** 30 bilingual cues in 2:56 is dense, and the tightest hold clears its
  minimum by about 0.11 s. To keep it readable:
  - every copy edit re-runs the hold check;
  - diagram action starts only after a line has settled;
  - the two rests are kept.

  If the 36 px rule turns out to mean cap height, the type grows to 52/44 px and the copy
  is trimmed.
- **QA on a dark look.**
  - **Black:** QA flags black when, for at least 0.5 s, 98% of a frame's pixels sit below
    Y 37.9 (BT.709 limited range). The ground `#202226` is Y 45.1, just above it, so no
    fade toward black is allowed outside a declared black cue.
  - **Freeze:** freezedetect (-60 dB for 3 s) can flag still holds such as the end card.
    They are declared as hold cues, or as `allowFreeze` spans in `video.json`.
- **Sound.** An agent cannot hear. The synthesised voices are new code, and the user's
  listening is the deciding check.
