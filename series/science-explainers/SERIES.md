# Science & Technology Explainers

> Honest explanations of hard ideas in science and technology: advanced mathematics,
> physics, major open problems, prize-winning work, and how computing and AI systems
> actually work.

Status: active · First video: none yet. [#4 `super-agent`](../../videos/super-agent/README.md) started here: its V1, *Who Routes the Agents?*, was archived unpublished on 2026-11-15, and its V2 moved to [`concept-viz`](../concept-viz/SERIES.md) on 2026-11-16 at the user's request. What V1 taught stays below.

Widened on 2026-11-08 from "Science & Knowledge Explainers" (mathematics and physics) to
science and technology, with the first video. The id stays `science-explainers`.

## Promise
The viewer follows a real argument, not a summary of one. They see why a result is true,
why a problem is hard, or how a system works and why it was built that way, at the level
of the actual ideas. They know which parts were simplified and, for technology, which
parts exist and which are only proposed.

## Editorial principles
- **Show the reasoning.** Derivations, constructions, proofs and mechanisms are animated
  step by step; nothing important is asserted off-screen. A system is explained by the
  problem it answers before its parts are named.
- **One idea per beat, at reading speed.** On-screen text and formulas stay long enough
  to read (the readable-text bar in
  [PRODUCTION](../../docs/PRODUCTION.md#quality-bars-every-video); `src/cues.ts` text
  spans are checked by the audio stage), and a new idea waits until the last one has
  landed.
- **Consistent notation.** One symbol, one meaning, one colour, for the whole video; a
  notation card when a video needs more than a handful of symbols.
- **Credit precisely.** Who discovered or built what, when, and in which paper or
  release. No lone-genius myths and no wrong attributions.
- **Built or proposed.** For technology, say on screen what is implemented (and where:
  product, open-source prototype, paper only) and what is a design or a claim. Pin the
  code a claim rests on (repository and commit) in `sources.jsonl`.
- **Name the simplifications.** When a picture is an analogy or an approximation, say
  so on screen or in narration. Experiments keep their caveats beside their numbers
  (synthetic, sample size, what was measured).
- **Respect the audience.** Assume curiosity, not prior expertise; do not pad.

## Typical arc (hypothesis)
- Long form: a concrete question or surprising fact → the minimal background, built
  visually → the key idea → the argument → what it unlocked and what is still open →
  sources.
- Short form (2–3 minutes as a start; #4 V1 ran 3:44 because the user chose depth): a
  concrete hook in the first five seconds → the problem the idea answers → the idea in one
  image → why it works, with the evidence and its limits → what is still open → what it
  changes → sources on the end card.

## Craft hypotheses (to confirm with the first videos)
- **Short form.** #4 V1 tried the options below and was dropped before publication, so
  none is confirmed; each is one tried option, not a default:
  - 2–3 minutes planned (V1 ran 3:44), 16:9, 30 fps;
  - text-led, no voiceover, timed to the bar grid of an original synthesised score;
  - Remotion 2D (DOM + inline SVG) drew the round-1 look the user rejected; the final film was
    a lit WebGL world under DOM text (ARCHITECTURE decision 30);
  - one persistent world under a camera rather than cuts.
- **Long form:**
  - 8–20 minutes, 16:9, 30 fps (60 fps only when motion needs it);
  - narration expected: script in `SCRIPT.md`, captions per language (English first,
    Chinese-ready), with an ASR round-trip check once the TTS/ASR module exists;
  - Manim Community Edition is the leading candidate for mathematical animation (not
    installed yet; see `references/manim.md`), with the web engine and Remotion for
    titles and typography.
- **Look:** a dark, minimal ground (the user's preference on 2026-11-08, open per film), in
  BT.709 limited luma above QA's black threshold. Minimal is not simple: the ground is built
  (light, texture, material), never a void. Distinctness comes from finish (material, light
  where it means, real content density, rule-driven motion), type and semantic colour, not
  from glow, particles or serif subtitle bands, and not from flat line grammar, which the
  user rejected on #4 V1 as "too simple and crude"
  (`references/vibe-knowledge-style-2026-11.md`).

## Learned on #4 V1
- Audit the runtime share that explains how it works: V1's 2:56 cut gave 41% to the
  problem and 14% to the mechanism, and the user judged it shallow.
- Give every mechanism a question the viewer already holds.
- Draw no relationship before the line that explains it.
- Reading holds are a floor, not a pace: V1's six idea labels cleared theirs and still
  read as rushed to a stranger viewer. Budget picture-only time per mechanism (text-led V1
  had text on screen about 81% of the time before the end card).
- Short bilingual tags are fine; long bilingual plates double the reading load. Settle
  platform and languages at the brief.
- Check absolute words ("all", "only", "never") against the mechanism's exceptions.
- Scope every status label (built, proposed, open) to exactly the lines it is true for.
- A context-free stranger viewer finds what specs hide.

## Policies
- Facts standard: **strict**. Every claim, number, date and attribution is in
  `FACTS.md` with a primary or authoritative source in `sources.jsonl`; the video
  cannot reach `locked` without it.
- Generative AI: never for diagrams, data, formulas or historical "photos" that
  could be mistaken for evidence.
- Images of real people: only with a clear licence, and credited.
- Third-party marks: no logos, wordmarks, product UIs, URLs or account handles on screen
  ([LICENSING](../../docs/LICENSING.md#third-party-characters-brands-and-parody)). Sources are
  credited in plain text on the end card, with a non-affiliation line where a company's
  work is explained; links go in the description, `CREDITS.md` and `sources.jsonl`.
- Figures and charts from a source are redrawn in our own style from the reported
  numbers, never copied, and labelled as re-plotted.
- AI use is disclosed in each platform's own field (YouTube's altered-or-synthetic
  setting and description, Bilibili's AI-content label).

## Reusable resources
Indexed in `docs/INDEX.md` once videos in this series declare `reusable` items.
