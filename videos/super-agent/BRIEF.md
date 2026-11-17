# Brief: Who Routes the Agents? (V2)

V2 remakes film #4 from a clean baseline. V1 was finished and archived unpublished on 2026-11-15
([V1.md](V1.md)). The user gave V2's brief on 2026-11-16; it is quoted in full below. V1's two
briefs are in this file's history (`git show 13893ff:videos/super-agent/BRIEF.md`) and no longer
bind anything. V2 was published on 2026-11-17 under this title (on YouTube: *Who Routes the
Agents? | DSH Super-agent Architecture Explanation*); the rest of this page is the brief as
written before production.

## Audience
Curious developers and tech-literate viewers who use or follow AI coding agents. They need not have
read the article. Coverage framed it as a DeepSeek product, or as a rival to Claude Code, so many
viewers arrive with that idea ([FACTS.md](FACTS.md), section 9).

## Promise
In two to three minutes, without reading the article, the viewer understands the problem (you have
become the router of your own agent sessions), the design's idea (a long-lived Router above isolated
Workers), how one Router keeps up (four mechanisms beyond the Router/Worker split), what the authors'
tests show and cost, and what is built, proposed and still open.

## Shape
- **Platform:** YouTube.
- **Languages:** English only, in the picture and everywhere else. No Chinese.
- **Voice:** none. Words are animated typography inside the scene; there is no subtitle strip.
  Captions are still drafted from the cue sheet for accessibility ([PRODUCTION.md](../../docs/PRODUCTION.md)).
- **Length:** about 2:36 (78 bars at 120 bpm) as briefed, inside the 2–3 minutes asked for. As
  built: 2:48 (84 bars); [TREATMENT.md](TREATMENT.md) says why.
- **Format:** 16:9, 1920×1080 at 60 fps. The benchmark film runs at 60 fps; this is the
  repository's first 60 fps film.
- **Score:** an original score made in code at 120 bpm, read from the same cue sheet as the picture.
- **Engine:** web (one WebGL canvas), chosen for this film ([TREATMENT.md](TREATMENT.md), How it is built).
- **Series:** `science-explainers`. The V2 brief below moved the film to `concept-viz` on
  2026-11-16, and it was made there; on 2026-11-18, before the release, the user decided to
  release it in `science-explainers`: it explains one published design and weighs its evidence.
- **Type size:** text meant to be read is at least 52 px at 1080p. That satisfies both readings of
  the repository's "1/30 of the frame height" bar (font size, or cap height), so the open question
  from V1 does not need an answer here.
- **Model:** made with Claude Fable 5.2.

## References
- **The subject:** [FACTS.md](FACTS.md), [sources.jsonl](sources.jsonl) and
  [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).
  Re-checked on 2026-11-16: the article's text hash is unchanged, and the prototype is still at
  `8c32a9d`.
- **The quality bar:** an 88-second explainer of the same article, made with Claude Fable 5.2 and
  published inside an X article by another creator. The user supplied the film and named it "a
  concrete benchmark to meet or exceed". The study is
  [references/fable-explainer-benchmark-2026-11.md](../../references/fable-explainer-benchmark-2026-11.md).
  Its frames stay under `.cache/` and are never committed. Compare by qualities, side by side, at
  the pilot and again before the review approval.
- **V1:** [V1.md](V1.md) says what it was, why it was dropped and what it taught.

## Risks
- **Look.** The look is why V1 was dropped, and the bar has moved twice. The user sees a finished
  pilot and style frames before the rest is built. The stack must not read as the benchmark's
  two tilted planes in another colour ([TREATMENT.md](TREATMENT.md), Guard rails).
- **Reading load.** V1 had text on screen 81% of the time. V2 keeps to short grid-native lines, a
  wordless bar at the start of every mechanism, and tests on the cue sheet.
- **Facts.** The series holds a facts standard; [FACTS.md](FACTS.md) section 6 lists the traps.
  Both research notes go stale after 2026-12-08: re-check the article and the repositories before
  the script locks if that date has passed. The Chinese original is still unread.
- **Rights.** The article states no licence: never commit its text, and never reuse its figures,
  examples, IDs, dialogues or cover. Charts are redrawn from its numbers and labelled re-plotted.
  No logos, product interfaces, URLs or handles on screen. Credit the article in plain text with a
  non-affiliation line.
- **Technical.** The host is an 8 GB laptop with an integrated GPU. 60 fps doubles the frame count;
  the first draft render measures the real cost before the look grows.

## The user's V2 brief, verbatim (2026-11-16)
> We're starting V2 of the Super-agent explainer video using Fable 5.2. V1 is complete but archived unpublished. This is a fresh creative remake, not another polish pass.
>
> Start in Plan Mode. First read the current project docs and relevant memories. Review V1's reusable assets, research, and lessons without assuming its visual design or narrative structure must survive.
>
> Our biggest change is visual direction.
>
> V1 became overly complicated: too many detailed 3D objects scattered across a plane, competing for attention without forming a clear visual whole. It looked elaborate but was often distracting, especially when viewers also had to read subtitles below.
>
> For V2, aim for a simpler, more coherent and visually hierarchical system. Think of interconnected layers, clear structure, selective detail, fluid transitions, and meaningful motion. Individual objects don't need extreme realism or complexity; what matters is that the whole system feels organized, intuitive, visually compelling, and easy to follow.
>
> Please study these references carefully:
> - A reference video on my Desktop: `video.MP4`. Analyze its composition, animation, typography, pacing, and narrative.
> - The X article containing that video and other examples: https://x.com/Khazix0918/status/2119941585538572390
>
> The creator explains the same topic in just 90 seconds, using relatively simple 2D animation with excellent pacing and clarity. Treat its visual and storytelling quality as a concrete benchmark to meet or exceed, not merely loose inspiration. We can explore a similarly clean, cyberpunk-style aesthetic, prominent in-scene typography, and smooth animated transitions, but develop our own recognizable design rather than copying theirs.
>
> Content and production requirements:
> - Keep the original DeepSeek Harness article and its open-source prototype as our primary factual sources.
> - Preserve V1's valuable technical depth while improving clarity. Aim for roughly 2–3 minutes, with a slightly faster, more engaging pace and carefully selected deeper mechanisms beyond the basic Router/Worker concept.
> - Make the video entirely English, including all on-screen text. No Chinese and no voice-over.
> - Use well-integrated, readable animated typography instead of relying on a persistent subtitle strip.
> - Move this video to the `concept-viz` series, instead of the current `science-explainers`.
> - You may rethink the narrative, visual design, animation approach, and rendering engine. Reuse existing infrastructure where useful, and improve it if justified by actual needs.
>
> Keep the production lean. The reference creator reportedly produced their video in one or two hours from a simple prompt. We don't need to be that fast, but we should avoid over-engineering, excessive planning, and repeated approval cycles. Prioritize visible results and efficient iteration over building an elaborate production system.
>
> Follow the repository's quality and factual standards, and preserve its human approval gates. Keep the plan concise, with realistic scope and clear deliverables.
>
> The guiding principle: make a better explainer, not a more complicated animation.

### Decisions the user made in the planning session (2026-11-16)
- Treatment: "Layer stack hybrid (Recommended)", from three candidates.
- Look check: "Pause at the pilot (Recommended)": one pause after a finished ~30 s pilot and style
  frames. A checkpoint, not a recorded gate.
- Reference media: "Keep locally for benchmarking". The benchmark's files stay under `.cache/`
  and are never committed.
