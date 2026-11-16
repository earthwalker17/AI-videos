# Credits: Who Routes the Agents?

Everything in the picture is drawn by code in `src/`: flat shapes, lines and type on one WebGL2
canvas, moved frame by frame from the cue sheet. The type is set from three open fonts, drawn once
into an atlas at render time. The score is composed and synthesised by code in `audio/`. The film
uses no third-party media: no images, footage, samples, models or textures.

| Asset | Source | Licence or rights class | Changes | Used as |
|---|---|---|---|---|
| Big Shoulders Display | `@fontsource-variable/big-shoulders-display` 5.3.0 (variable; the package names Google Inc. as its author) | OFL-1.1 | none (used unmodified, not redistributed; only its latin file is loaded) | Headlines, verdicts and the hollow numerals |
| IBM Plex Sans | `@fontsource-variable/ibm-plex-sans` 5.3.0 (variable, © 2019 IBM Corp.) | OFL-1.1 | none (used unmodified, not redistributed; only its latin file is loaded) | Sentence-case support lines; the test card of review renders |
| IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 (weight 500, © 2017 IBM Corp.) | OFL-1.1 | none (used unmodified, not redistributed; only its latin file is loaded) | Stamps and the names on marks |
| The article (the film's subject) | *Exploring Super-agent Design: Towards a More Autonomous Agent System*, the DeepSeek Harness team, 2026 ([FACTS.md](FACTS.md), `sources.jsonl`) | No licence stated: facts paraphrased, nothing quoted on screen, none of its figures, examples or IDs reused; its test results are re-plotted from its numbers, without its charts, and labelled so | n/a | The source the film explains and credits on its end card |
| The benchmark film | An 88 s explainer of the same article by another creator, supplied by the user as a reference | Unknown rights: reference only | Not used in the film, never committed; studied for pacing, hierarchy and finish ([the study](../../references/fable-explainer-benchmark-2026-11.md)) | The quality bar |

The fonts come from pinned npm packages and are never committed. No logo, product screen, URL or
handle of DeepSeek or of anyone else appears in the film, and the end card says that it is an
independent explainer.

## Tools
The repository's web engine (Playwright 1.64.1 driving Chromium, Vite 8.3.5; the film's renderer
is its own WebGL2 code, with no rendering library), FFmpeg 8 (LGPL/GPL build, used as a tool),
Node 24 and the repository's own pipeline (render, audio, post, QA). Made with Claude Code
(Claude Fable 5.2). No generative image, video, music or voice models are used in the film.
