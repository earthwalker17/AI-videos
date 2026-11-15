# Brief: Who Routes the Agents? (V2)

V2 remakes film #4. V1 was finished and then archived unpublished on 2026-11-15 ([V1.md](V1.md)).
The user gives V2's own brief and references at the start of V2. Until then, this file holds what
still holds, what is open, and the user's original briefs, quoted in full below. In the user's words
(2026-11-15), the briefs "can be used as guidance for V2 as well (but do not treat them as doctrines,
since we may need to change the narrative way and visual direction)". The title is V1's working
title; V2 may change it.

## Audience
Curious developers and tech-literate viewers who use or follow AI coding agents. They need not have
read the article. Coverage framed it as a DeepSeek product, or as a rival to Claude Code, so many
viewers arrive with that idea ([FACTS.md](FACTS.md), section 9).

## Promise
By the end, the viewer understands four things without having to read the article:
- the problem;
- the core architectural idea;
- why it matters;
- its most important implications.

The viewer can also tell what the public prototype builds, what is only proposed, and what is still
open, and comes away with real insight into the mechanisms, not only the Router/Worker split. The
user ranked the priorities in this order: storytelling, then the viewer's mental model, then the
visual execution (brief 2).

## Shape
- **Platform:** YouTube for V1. The user said "I'm not going to publish this film to BiliBili" of
  V1 (2026-11-13). The platform is open for V2: confirm it.
- **Languages:** English first, with captions made as [PRODUCTION.md](../../docs/PRODUCTION.md)
  describes. Whether any Chinese appears in the picture is open.
- **Length:** open. The first brief asked for 2–3 minutes. The user then chose depth ("~3:45, full
  depth"), and V1 ran 3:44. The preference for depth stands; the number does not.
- **Narration:** open. V1 was text-led with no voice. [V1.md](V1.md) explains why that made it
  reading-bound. The repository has no voice module yet. If V2 has a voice:
  - **Rights.** The film stays CC BY only with a voice of class A or B
    ([LICENSING.md](../../docs/LICENSING.md)), for example an Apache-2.0 model run locally, such as
    Kokoro-82M (it runs on CPU) or CosyVoice2. A hosted voice whose terms forbid redistribution is
    class C, which reopens the licence. A paid voice needs the user's approval.
  - **Research.** [genai-landscape-2026-11.md](../../references/genai-landscape-2026-11.md) has the
    research, but it goes stale after 2026-12-01: re-check it.
  - **Captions.** They come from SCRIPT.md's subtitle text, aligned to the voice
    ([subtitles.md](../../references/subtitles.md); ARCHITECTURE decision 32 notes the gap).
  - **Timing.** Reading holds stop gating the cut, and the music ducks under speech. V1's planning
    figure was about 140 words a minute, or about 330–360 words for about 3 minutes.
  - **Files.** Recorded or generated audio files belong in `media/`, which is not built yet
    (ROADMAP, "Large inputs").
- **Score:** brief 1 asked for an original score made in code, "as in our previous videos".
  Whether V2 keeps one, and its form, are open.
- **Format:** 16:9 at 30 fps, delivered at 1080p by default. 4K needs a 4K render profile and a
  text-determinism check at device scale 2 first.
- **Model:** V2 is made with Claude Fable 5.2 (the user, 2026-11-15).
- **Open for V2:** the narrative way, the visual direction, the engine and the session plan. Nothing
  V1 chose about these binds V2. For the engine, see
  [code-video-engines-survey.md](../../references/code-video-engines-survey.md),
  [remotion.md](../../references/remotion.md) and [manim.md](../../references/manim.md).

## References
- **The subject:** [FACTS.md](FACTS.md), [sources.jsonl](sources.jsonl) and
  [references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).
- **The quality bar:** newer films on similar topics made with Claude Fable 5.2, which the user
  found "look much better than ours". The user brings them in V2's brief. Compare frames with them
  side by side by their qualities; never commit them.
- **Craft research from V1:**
  - [vibe-knowledge-style-2026-11.md](../../references/vibe-knowledge-style-2026-11.md): the
    study of 比特新语, V1's bar, and the genre's do-not-copy list;
  - [motion-graphics-2d-2026-11.md](../../references/motion-graphics-2d-2026-11.md);
  - [agent-video-skills-2026-11.md](../../references/agent-video-skills-2026-11.md);
  - [hyperframes.md](../../references/hyperframes.md).
- **V1 itself:** [V1.md](V1.md) says what it was, what worked, what did not, and how to take
  anything from its tag.

## Risks
- **Facts:**
  - The series holds a strict facts standard; FACTS.md section 6 lists the traps V1 caught.
  - Before V2's script locks, re-check the article for edits and the prototype for new commits.
    Both research notes go stale after 2026-12-08.
  - The Chinese original is still unread.
- **Rights:**
  - The article states no licence, so never commit its text, and never reuse its figures, examples,
    IDs, dialogues or cover. Redraw charts from its numbers and label them re-plotted.
  - Credit the article in plain text with a non-affiliation notice, and disclose AI use in YouTube's
    field.
  - No logos, product interfaces, URLs or handles on screen
    ([SERIES.md](../../series/science-explainers/SERIES.md)).
- **Look:** the look is why V1 was dropped, and the bar has moved twice. Show the user images early,
  and compare them with the user's references side by side, both at lookdev and before the final.
- **Type size:** does "at least 1/30 of the frame height" mean the font size or the cap height? V1
  read it as the font size. Ask before the type scale is set.
- **Technical:** the reference host is an 8 GB laptop with an integrated GPU
  ([ENGINE.md](../../engines/remotion/ENGINE.md) has the measured costs). Route heavy work instead of
  lowering the bar. Brief 2 put it as: "Do not let current local limitations define the quality
  ceiling."

## The user's original briefs, verbatim
These are the user's own messages from V1, copied from the session transcripts on 2026-11-15. They
are guidance, not doctrine (see the top of this file).

### Brief 1: session 1, 2026-11-08
> We're starting the next video in AI Videos, the first entry in our science/technology explainer series.
>
> This video will explain DeepSeek Harness's recently published article on Super-agent design:
> https://x.com/DeepSeekHarness/status/2116857257245987236
>
> The central idea is a two-layer Router/Worker architecture: a persistent Router handles human interaction and task coordination without directly executing code, while isolated Workers execute delegated tasks concurrently. The deeper motivation is to reduce the human attention and context-management burden when working with multiple coding-agent sessions.
>
> Our goal is to turn this fairly long technical article into an engaging, accessible 2–3 minute visual explainer. Viewers should walk away understanding the problem, the core architectural idea, why it matters, and the most important implications — without having to read the original article.
>
> Start in Plan Mode. Research before implementation.
> 1. Read the full original article carefully, then investigate relevant technical discussions, the published prototype, and other credible sources. Distinguish the authors' proposed architecture from what is actually implemented. Develop a clear, accurate narrative rather than trying to cover every detail.
> 2. Study the Bilibili creator 比特新语 and several representative videos, using frame analysis or other legitimate methods where practical. I'm particularly interested in their minimalist, dark-background, code-driven 2D animations combining diagrams, typography, and smooth motion. Extract useful visual styles without directly copying their work.
> 3. Explore existing open-source approaches to producing polished, code-generated educational motion graphics. Evaluate what would fit our repository and production workflow.
> 4. Inspect the current repo architecture, documentation, existing videos, rendering engines, and production pipeline. Choose an appropriate creative and technical approach. Reuse existing infrastructure where sensible, but improve or extend it when genuine production requirements justify doing so.
>
> Creative directions:
> - Prioritize clarity, storytelling, and educational value over visual complexity.
> - Keep the visual language simple, elegant, polished, and dynamic — not a static slideshow or a dense technical presentation.
> - Use English as the primary on-screen language, with proper Chinese translations where helpful for Bilibili audiences.
> - Create an original background score programmatically, as in our previous videos.
> - Aim for a concise, engaging explanation rather than exhaustive technical coverage or unnecessary visual spectacle.
> - Maintain factual accuracy, source attribution, and the repository's existing quality and licensing standards.
>
> Please develop the creative treatment, narrative structure, visual direction, and implementation plan yourself. Don't assume we need an elaborate 3D system just because previous videos used one.
>
> Session management: We do not have to finish everything in one session. You may divide the work into sensible, self-contained sessions based on actual complexity, workload and context requirements. Keep research, planning, implementation, rendering, and quality review manageable and practical on this machine, with durable documentation and clear handoffs if needed. Don't sacrifice quality to force completion within one context window.
>
> For this first session, focus on thorough research, creative exploration, architectural assessment, and a realistic production roadmap. Don't rush into a full render without enough preparation.
>
> Treat this as both a standalone educational film and an opportunity to improve AI Videos into a more versatile, reusable production system.

### Brief 2: session 3, 2026-11-08, after the first lookdev was rejected
> Continue the Super-agent explainer in Plan Mode.
>
> Before doing anything new, first review the existing materials from the previous sessions — especially the last session's prompt, plan file, README handoff, research notes, and the current lookdev results.
> Reuse what we already know; do not waste time redoing research that is already sufficient.
>
> This session is a polish/rework session focused on both:
> 1. Visual quality
> 2. Narrative richness / informational depth
>
> The current problem is clear: the content may be directionally fine, but the visuals are still too crude and simplistic. Right now too many elements are just basic flat geometry — rings, boxes, repeated small modules, straight connecting lines. That is not enough.
> Please substantially upgrade the visual system while still keeping the pieces fundamentally code-driven and production-practical.
>
> What I want:
> - Every major element should have a more recognizable, refined, visually distinctive form.
> - Give elements more detail, variation, material presence, and design character — not just flat placeholder geometry.
> - Avoid using the exact same shape language over and over for parallel elements.
> - Relationships between components should feel more alive and expressive, not just shown as static line connections.
> - Motion should be smoother, richer, and more elegant.
> - The final visual quality should aim to be at least competitive with 比特新语’s videos. Treat that as a real quality bar, not just loose inspiration. Still avoid imitation or plagiarism.
>
> At the same time, please re-check the substance of the film. The video should not spend 3 minutes only explaining the very basic Router/Worker idea if the original article contains other important mechanisms worth including. You may re-inspect the article and our research with that in mind, and judge whether the narrative is currently rich enough. If needed, adjust the pacing, structure, or scope so that viewers come away with real insight, not just a shallow summary.
>
> Also:
> - Look again for strong external references, especially open-source methods, libraries, techniques, Skills, or Remotion/2D motion design approaches that could meaningfully improve this film.
> - If good ideas or tools exist, adopt them directly when appropriate, or use them to improve the AI Videos system itself.
> - Do not let current local limitations define the quality ceiling. Push the implementation as far as the available tech reasonably allows.
>
> Keep the priorities in this order:
> 1. Clear, informative, educational storytelling
> 2. Stronger mental-model building for viewers
> 3. High-quality visual execution that supports the explanation
>
> Ask me to connect Chrome extension if needed. Close it to save memory before heavy rendering job begins.

### Later instructions that shaped V1
- 2026-11-13: "I'm not going to publish this film to BiliBili. So can you remove the Chinese
  captions if it's cheap to do? Leave other parts unchanged unless genuinely necessary."
- 2026-11-15, when V1 was archived: "Claude Fable 5.2 is out, and I've come across other videos on
  similar topics made with it that look much better than ours. So I'm deciding to make another V2
  film using Fable 5.2." Also: "do not carry unnecessary context debts or V1-limitations to V2. The
  next session should be grounded in a clean project baseline, with sufficient background
  information about the video, while still having enough freedom for re-designing and visual
  upgrades."
