# AI-videos

The source, workflows and shared tooling behind a YouTube channel of videos made with code
and AI, and an open knowledge base for anyone making high-quality video the same way.

Every frame is code: React and Remotion, three.js and WebGL/WebGPU in a browser, and later
Manim or Blender. Every video lives in one folder on top of shared, tested infrastructure:
deterministic rendering, resumable chunked renders, colour-correct encoding, loudness
mastering, automated QA and reproducible releases.

**Status: the first film is out.** The shared tooling, both engines and their templates work
end to end, and *A Halloween Gift* (#3) was made here from brief to release, picture and score
in code. The two films before it were made before this repository and are catalogued as
records.

## Videos

<!-- aiv:generated catalog -->
| # | Video | Series | Status | Watch |
|---|---|---|---|---|
| 1 | [Journey Through Middle-Earth](videos/journey-through-middle-earth/README.md) | standalone | published (record only) | [YouTube](https://youtu.be/kRuPq4GjhGc) |
| 2 | [THE AI STACK](videos/the-ai-stack/README.md) | [3D Concept Visualizations](series/concept-viz/SERIES.md) | published (record only) | [YouTube](https://youtu.be/LDH7UhHeKG4) |
| 3 | [A Halloween Gift](videos/halloween-gift/README.md) | [Festival & Celebration](series/festivals/SERIES.md) | published | [YouTube](https://youtu.be/gL01vESC-fU) |
<!-- /aiv:generated -->

Series: [3D Concept Visualizations](series/concept-viz/SERIES.md) ·
[Science & Knowledge Explainers](series/science-explainers/SERIES.md) ·
[Micro Films](series/micro-films/SERIES.md) ·
[Festival & Celebration](series/festivals/SERIES.md) ·
[Product & Launch](series/product-launch/SERIES.md)

## I want to…

| … | Start here |
|---|---|
| see how a video was made | its folder under [`videos/`](videos/): README, brief, treatment, script, storyboard, sources and code; start with [A Halloween Gift](videos/halloween-gift/README.md). The two earlier records link to their own sources, and [`templates/`](templates/) holds the runnable examples |
| learn a technique | [`knowledge/`](knowledge/README.md) (verified cards) and [`references/`](references/README.md) (pinned notes on outside tools) |
| render a template on my machine | [Quick start](#quick-start) |
| make my own videos with this toolchain | fork it ([Make your own](#make-your-own)), then read [ARCHITECTURE](docs/ARCHITECTURE.md) and [PRODUCTION](docs/PRODUCTION.md) |
| add an engine, fix a tool or write a card | [CONTRIBUTING](CONTRIBUTING.md) |
| work on it with an AI agent | [CLAUDE.md](CLAUDE.md), then the generated map [docs/INDEX.md](docs/INDEX.md) |

## Quick start

Needs Node `>=24.11`, pnpm (`corepack enable`), Git, FFmpeg 8 on `PATH`, and a hardware
GPU with WebGL: both engines refuse software rendering ([ENVIRONMENT](docs/ENVIRONMENT.md)).

```sh
pnpm install
pnpm aiv doctor --fix                          # pinned browsers, GPU check
pnpm aiv render template:web --profile draft   # deterministic frames → lossless mezzanine
pnpm aiv post   template:web --profile draft   # BT.709 encode, -14 LUFS audio
pnpm aiv qa     template:web --profile draft   # probe, colour swatches, loudness, contact sheet
```

The contact sheet lands in `out/_template-web/qa/draft/contact.png`. `pnpm aiv --help`
lists every command.

## Make your own

Fork the repository, then make it your channel's:
1. Replace or delete the records in `videos/` and the guides in `series/` to suit your
   channel. `aiv new` numbers a video after the highest existing number, so delete the
   records first if your first video should be number 1.
2. Update the identity text in this README and in `CLAUDE.md`.
3. Keep `NOTICE.md`, `LICENSE` and `LICENSES/`: MIT and CC BY 4.0 require the existing
   notices and attribution. Add your own name beside them (`LICENSE`, `REUSE.toml`) for
   your own work.
4. Run `pnpm aiv check --fix` to regenerate the catalog, `docs/INDEX.md` and the generated
   tables.

## How it works

```text
videos/<slug>/src ─engine→ lossless mezzanine + render.json ─post→ delivery + archive ─qa→ report ─release→ manifest
```

- **Engines** turn a video's source into frames: `web` (three.js/WebGL/WebGPU pages driven
  by a pinned Chrome) and `remotion` (React, React Three Fiber). Every engine is an adapter
  driven by the shared runner, which writes the mezzanine and `render.json`; post, QA and
  release never know which one ran.
- **Determinism.** A frame is a pure function of its index. Renders are chunked, resumable
  and keyed to a hash of their inputs; the same machine produces byte-identical files.
- **Quality gates.** Colour swatches are decoded from the final file and must match within
  ±3 code values; loudness is -14 LUFS; black and frozen frames are caught; the contact sheet
  is looked at before anything ships.
- **A lifecycle per video**, from idea to published, with three human approvals and frozen,
  rebuildable releases.

Details: [ARCHITECTURE](docs/ARCHITECTURE.md) · [PRODUCTION](docs/PRODUCTION.md) ·
[ENVIRONMENT](docs/ENVIRONMENT.md) · [ROADMAP](docs/ROADMAP.md).

## Licence

Code is [MIT](LICENSE). Prose (docs, knowledge cards, scripts, guides) and original media
are [CC BY 4.0](LICENSES/CC-BY-4.0.txt). Third-party material keeps its own licence, and
finished films state theirs in their `video.json`. The full matrix is in
[LICENSING](docs/LICENSING.md); adapted code is credited in [NOTICE](NOTICE.md).

The Remotion engine depends on [Remotion](https://www.remotion.dev), which has its own
licence: free for individuals and organisations of up to three people, a company licence
otherwise. Check yours before rendering with it.
