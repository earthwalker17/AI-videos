# Science & Knowledge Explainers

> Dense, honest explanations of hard ideas: advanced mathematics, physics, major
> open problems, and Nobel- and Fields-level work.

Status: active · First video: none yet

## Promise
The viewer follows a real argument, not a summary of one. They see why a result
is true, or why a problem is hard, at the level of the actual ideas, and they know
which parts were simplified.

## Editorial principles
- **Show the reasoning.** Derivations, constructions and proofs are animated step by
  step; nothing important is asserted off-screen.
- **One idea per beat, at reading speed.** On-screen text and formulas stay long
  enough to read (the readcheck QA gate), and a new idea waits until the last one
  has landed.
- **Consistent notation.** One symbol, one meaning, for the whole video; a notation
  card when a video needs more than a handful of symbols.
- **Credit precisely.** Who discovered what, when, and in which paper. No
  lone-genius myths and no wrong attributions.
- **Name the simplifications.** When a picture is an analogy or an approximation,
  say so on screen or in narration.
- **Respect the audience.** Assume curiosity, not prior expertise; do not pad.

## Typical arc (hypothesis)
A concrete question or surprising fact → the minimal background, built visually →
the key idea → the argument → what it unlocked and what is still open → sources.

## Craft hypotheses (to confirm with the first video)
- Engines: Manim Community Edition is the leading candidate for mathematical
  animation (not installed yet; see `references/manim.md`), with the web engine
  (SVG / KaTeX / canvas) and Remotion for titles and typography.
- Narration is expected: script in `SCRIPT.md`, captions per language (English
  first, Chinese-ready), with an ASR round-trip check once the TTS/ASR module exists.
- Length: 8–20 minutes, 16:9, 30 fps (60 fps only when motion needs it).

## Policies
- Facts standard: **strict**. Every claim, number, date and attribution is in
  `FACTS.md` with a primary or authoritative source in `sources.jsonl`; the video
  cannot reach `locked` without it.
- Generative AI: never for diagrams, data, formulas or historical "photos" that
  could be mistaken for evidence.
- Images of real people: only with a clear licence, and credited.

## Reusable resources
Indexed in `docs/INDEX.md` once videos in this series declare `reusable` items.
