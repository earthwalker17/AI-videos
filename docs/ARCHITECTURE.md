# Architecture

How this repository is organised, where each kind of thing goes, the contracts between
its parts, and the decisions behind them. If something new has no clear home here, decide
its home here first, then write the code.

## The map

| Layer | Folder | Holds | Grows when |
|---|---|---|---|
| Content | `videos/<slug>/` | One folder per video (layout below). Flat: the series is metadata. | every video |
| Content | `series/<id>/` | `series.json` (id, summary, facts policy, defaults) and `SERIES.md` (identity, editorial principles, craft hypotheses). | a series is added or learns something |
| Library | `styles/<id>/` | `STYLE.md` (palette, type, motion and composition rules) plus tokens, for looks shared by several videos. | a second video reuses a look |
| Library | `knowledge/` | Technique cards: method first, then "in this repo", each with the evidence that verified it. | something is learned and verified |
| Library | `references/` | Pinned notes on external projects, platforms and licences, plus `sources.json`. Maps, not copies. | research |
| Library | `prompts/<modality>/` | Versioned prompt templates for generated assets (created with the first one). | the first generated asset |
| Code | `packages/` | `@aiv/core` (browser-safe: seeded rng, easing, swatches, the file contracts and the cue sheet), `@aiv/pipeline` (Node: host safety, encode, chunk runner, the audio stage, QA, release), `@aiv/remotion-kit` (React/R3F building blocks). | code is promoted (rule of two) |
| Code | `engines/<id>/` | One adapter per renderer: produces a video's frames for the shared runner, which writes the mezzanine and `render.json`. `ENGINE.md` documents it. | a video needs another renderer |
| Code | `templates/<engine>/` | A runnable scaffold per engine, which doubles as that engine's end-to-end fixture. `templates/_video/` holds the stage-document stubs. | an engine is added |
| Code | `tools/aiv/` | The `aiv` CLI, including the repository model (slot and series schemas, gates, generators, checks). | a workflow becomes a command |
| Contract | `schemas/` | JSON Schema generated from the zod sources, one file per contract version. | a contract version is added |
| Docs | `docs/` | This file, PRODUCTION (workflow, gates, quality bars), ENVIRONMENT, LICENSING, ROADMAP, and the generated INDEX. | |
| Local | `out/`, `.cache/` | Renders, posts, QA, release files; browsers, bundles, research dumps. Never committed. | |

Root files: `README.md`, `CLAUDE.md` (rules for agents), `CONTRIBUTING.md`, `LICENSE` +
`LICENSES/`, `REUSE.toml`, `NOTICE.md`, the generated `catalog.json`, `aiv.local.example.json`.

## Where things go

| You have | It goes |
|---|---|
| A new video | `pnpm aiv new <slug> --engine <id> [--series <id>]` creates `videos/<slug>/` (layout below). |
| Code only one video needs | `videos/<slug>/src/` (picture) or `videos/<slug>/audio/` (score and sound effects). |
| The timing a video's picture and sound share | `videos/<slug>/src/cues.ts`: one `CueSheet` (`@aiv/core`), imported by both (decision 22). |
| A sample library a score plays | Pinned per video in `audio/library.json` (files, sha256, upstream commit); the files live in `.cache/libraries/` and are never committed (decision 23). |
| Code a second video needs | Promote it, never copy it: frame maths and contracts → `@aiv/core`; React, Remotion or R3F components → `@aiv/remotion-kit`; plain three.js or page helpers → a new `packages/web-kit` (created with the first promotion); Node-side media work → `@aiv/pipeline`; a look → `styles/<id>/`. |
| A new renderer (Manim, Blender, …) | `engines/<id>/`; see [Adding an engine](#adding-an-engine). |
| A verified technique | `knowledge/<topic>.md`, method first, with the evidence. |
| Notes on an outside project or rule | `references/<topic>.md` and an entry in `references/sources.json`. |
| A small original asset (≤ 2 MiB) | `videos/<slug>/assets/` with its provenance in `CREDITS.md`. |
| A large input (music, voice, footage, a big texture or model) | `videos/<slug>/media/`, listed in `media/manifest.json` (see Storage). |
| Generated material (images, audio, video from a model) | `videos/<slug>/gen/` with a provenance sidecar per file ([LICENSING](LICENSING.md#ai-generated-material)). |
| Delivery files and masters | GitHub Release assets with a sha256 manifest (see Storage). |
| Machine-specific settings | `aiv.local.json` (gitignored; copy `aiv.local.example.json`). |
| Raw research, renders, caches | `.cache/` and `out/`. |

### A video folder

| Path | Holds | In git | Input hash |
|---|---|---|---|
| `video.json` | The slot: number, status, approvals, engine, format, audio tracks, QA settings, licence, links ([schema](../schemas/video.v1.json)). | yes | only its render fields |
| `README.md` | What it is, how to watch it, how it was made, lessons. | yes | no |
| `BRIEF.md`, `TREATMENT.md`, `SCRIPT.md`, `STORYBOARD.md`, `FACTS.md`, `CREDITS.md` | The stage documents ([PRODUCTION](PRODUCTION.md)). | yes | no |
| `sources.jsonl` | One line per factual source (factual series). | yes | no |
| `src/` | The video's picture code; the engine entry lives here, and `src/cues.ts` (the shared timeline) when the video has a score. | yes | yes (`cues.ts` also in the audio hash) |
| `audio/` | The score: code that builds the video's audio tracks with `aiv audio` (entry `audio/index.ts`), and `library.json`, the sample files it reads. | yes | the audio hash only |
| `assets/` | Small original or licensed files the code loads (≤ 2 MiB each). | yes | yes |
| `media/` | Large inputs; only `media/manifest.json` (path, sha256, bytes, source, licence, where the file is kept) is committed. | manifest only | yes |
| `gen/` | Generated material; only the `*.provenance.json` sidecars are committed. A redistributable file the code loads is copied into `assets/`. | sidecars only | no |
| `publish/` | Upload texts per language: description, chapters, captions (`<lang>.srt`), AI disclosure, thumbnail. | yes | no |
| `release/v<N>.json` | Release manifests written by `aiv release`. | yes | no |

Every subfolder except `src/` is optional and appears when first needed.

## Adding an engine

An engine is an `EngineAdapter` (`packages/pipeline/src/runner/engine.ts`) that renders a
frame range; the runner does the rest. Adding one touches:
1. `engines/<id>/`: the adapter package (`src/`, its tests) and `ENGINE.md`.
2. `tools/aiv/src/engines.ts` (the registry) and `tools/aiv/package.json` (the dependency).
3. A doctor section in `tools/aiv/src/doctor/` for its tools and GPU path.
4. `templates/<id>/`: a runnable scaffold that passes render → post → qa, which is also the
   engine's end-to-end fixture.
5. A render step in `.github/workflows/ci.yml`, and `catalog.json`/`docs/INDEX.md` via
   `pnpm aiv check --fix`.

Post, QA, release and `render.json` v1 do not change. If an engine needs browser-specific host
care (the orphan sweep in `host/orphans.ts` knows the web and Remotion browsers), it extends it.

## The pipeline

```text
videos/<slug>/audio ─aiv audio─▶ out/<slug>/audio/<name>.wav + audio.json   (videos with a score)
videos/<slug>/src ──engine──▶ out/<slug>/render/<profile>/mezzanine.mkv + render.json
                  ──aiv post──▶ out/<slug>/post/<profile>/<slug>.mp4 (+ archive.mkv) + post.json
                  ──aiv qa────▶ out/<slug>/qa/<profile>/report.json + contact.png
                  ──aiv release▶ videos/<slug>/release/v<N>.json + out/<slug>/release/v<N>/ (uploaded to
                                 the GitHub release video/<slug>/v<N>; PRODUCTION.md, "Publish")
```

- **Engines** produce frames. The runner in `@aiv/pipeline` owns everything around them:
  chunking, the input hash, resume, time budgets, the heavy lock and the mezzanine. A
  streaming engine hands over RGBA frames; the runner hashes each frame and writes a
  lossless FFV1 RGB mezzanine. Both current engines stream: `web` reads the canvas back in
  the page, and `remotion` decodes the lossless PNG that Remotion captures for each frame.
  An engine that can only write video files itself (a future Blender or Manim adapter)
  uses the runner's file style instead.
- **The audio stage** (`aiv audio`) runs a video's score, the code in `videos/<slug>/audio/`,
  and writes its tracks with `audio.json`: the stage's own input hash (the score, the cue sheet,
  `@aiv/core`, the stage's synthesis runtime, the pinned sample files, the lockfile, Node), the
  sha256 of each track and the cue sheet it was built against. The score runs in a fresh Node
  process with almost no environment, and the stage refuses it if it loaded any repository file
  outside those inputs. Picture and sound are separate builds of one timeline: an edit to the
  score never invalidates a picture render.
- **The runner** also writes `inputs.json` next to `render.json`: the picture hash's per-file
  hashes and settings, so post can tell which cue sheet a picture was rendered against and
  release can recompute the picture hash against the tree it releases.
- **Post** mixes the audio bed (two-pass loudness normalisation to -14 LUFS) and makes the
  single RGB → BT.709 limited-range conversion, with explicit colour tags. A track named
  `audio:<name>` is the stage's output; post refuses it when its hash is stale or when it was
  built against a different cue sheet than the picture, and records the sha256 of every
  file it mixed. Profiles:
  `draft` (half size, hardware preview encode), `review` and `final` (full size; final adds
  the archive master).
- **QA** judges the final files, not the intermediates: probe facts, colour tags, swatch
  colours decoded from the delivery (within ±3 code values), loudness, A/V length, black and
  frozen spans, and a contact sheet that a person or agent must look at.
- **Release** refuses dirty trees, partial renders, unpinned browsers and files without a
  passing QA report for their exact bytes, then writes a manifest with hashes and provenance.

## Contracts and versioning

| Contract | Source | Schema |
|---|---|---|
| `render.json` v1 (engine → post) | `packages/core/src/contracts.ts` | `schemas/render.v1.json` |
| release manifest v1 | `packages/core/src/contracts.ts` | `schemas/release.v1.json` |
| `video.json` v1 (a video slot) | `tools/aiv/src/slot/schema.ts` | `schemas/video.v1.json` |
| `series.json` v1 | `tools/aiv/src/slot/schema.ts` | `schemas/series.v1.json` |
| cue sheet v1 (`src/cues.ts`, picture and score) | `packages/core/src/contracts.ts` | none: a TypeScript module, validated when it is built |

`render.json` and the release manifest were derived from the first real render and release
(pinned as test fixtures). `post.json`, `audio.json` and the QA report are working files in `out/`.

Every metadata file carries `schemaVersion` (and `$schema` for editor validation). A change
that existing files still pass (a new optional field) keeps the version. A change that an
existing file would fail is a new version: a new schema file next to the old one (old schema
files are never deleted), a migration in `aiv`, and an entry under Decisions below.

## Lifecycle and frozen videos

A video moves through `idea → brief → treatment → production → review → locked → published
→ archived`. [PRODUCTION.md](PRODUCTION.md) describes each stage and its gates; `aiv check`
enforces them. The three human approvals (treatment, review cut, final) are recorded in
`video.json` `approvals`, never by an agent on its own.

A published or archived video is **frozen**. Its manifest pins the toolchain and its source
is tagged `video/<slug>/v<N>`. It leaves the typecheck and lint scope (`aiv check --fix`
writes the `tsconfig.json` exclude list and `catalog.json` `frozen`). Upgrades move all
active videos together; a frozen video is rebuilt from its tag in a `git worktree`, never
edited to keep up.

## Determinism

- A frame is a pure function of its index. Frame code (`packages/core`, `packages/remotion-kit`,
  `engines/web/src/page`, `templates/*/src`, `videos/*/src`) may not read clocks, timers or
  unseeded randomness, nor use `useFrame` or clock-driven drei helpers. ESLint enforces this.
- Every frame's RGBA sha256 is recorded. On the same host, the same inputs give the same frame
  hashes and, verified, byte-identical mezzanines, delivery files and archive masters. Across
  hosts and GPUs, compare with SSIM, not bytes.
- The **input hash** covers what pixels depend on: the video's `src/`, `assets/` and `media/`,
  `styles/`, every frame-side package, the engine's runtime, the render settings and the
  lockfile (Markdown and tests excluded). A resumed render refuses (exit 2) when it changed,
  so stale chunks cannot survive an edit. Engines refuse to load files the hash does not
  cover.
- The **audio input hash** does the same for a video's tracks (decision 21). The cue sheet is
  in both hashes, so a timing change invalidates picture and sound together; post and release
  refuse a mix whose tracks or picture went stale.

## Storage

| Tier | Where | What | Limit |
|---|---|---|---|
| T0 | git | Text, code, small original assets | 2 MiB per file; no Git LFS |
| T1 | GitHub Releases | Delivery file and archive master per release, listed in the manifest with sha256 | 2 GiB per asset |
| T2 | local or private storage | Masters too large for T1, material that may not be redistributed | hash only in git |

Large inputs (`videos/<slug>/media/`) are T1 or T2: the file stays out of git, and
`media/manifest.json` records its sha256, size, source, licence and where it is kept, so a
rebuild can fetch it and the input hash proves it is the same file. Generated AI material
carries a provenance sidecar and a rights class (A–D, see [LICENSING.md](LICENSING.md));
classes C and D never enter git.

`out/` grows with every render: a lossless 1080p mezzanine is about 1.2 MiB per frame, so a
five-minute final needs about 10 GiB, twice that while its chunks are joined. Once a release
is verified, its `out/<slug>/render/` and `post/` folders may be deleted; the release folder
and the manifest are what count.

## Host safety

Renders and big encodes take a machine-wide **heavy lock** (one heavy job at a time, with a
heartbeat), after a free-memory guard, and clean up only the browsers they started. Commands
never wait silently: they exit `75` when the slot is busy or their time budget is spent, and
print the command that continues. Exit codes: `0` ok, `1` error or failed checks, `2`
refused, `3` low memory, `64` usage, `75` run again. Optional, machine-specific behaviour
(stopping background apps before a long render, a shared lock with another repository)
lives in the gitignored `aiv.local.json`.

## Toolchain

One toolchain at HEAD: every third-party version is pinned once in the pnpm catalog
(`pnpm-workspace.yaml`). Video and template code has no `package.json` and resolves from the
repository root, so creating a video never changes the lockfile. Browsers are pinned too:
Chrome for Testing in `.cache/browsers` for the web engine, and Remotion's own Chrome Headless
Shell in `node_modules/.remotion`. `aiv doctor --fix` installs both; a render never downloads. `render.json` records the
toolchain (Node, pnpm, FFmpeg version and build hash, browser, OS, GPU family) without host
names or paths. [ENVIRONMENT.md](ENVIRONMENT.md) lists versions, reference hosts and optional
modules.

## Decisions

Each entry: the decision, why, and what it costs. Newest last. Changing one means adding a
new entry that supersedes it, not editing history.

1. **2026-11-01 · Flat videos, series as metadata.** `videos/<slug>/` with a sequential
   `number`; the series is a field. Moving a video between series never moves files, and one
   video can stand alone. Slugs are immutable from `production` on.
2. **2026-11-01 · The engine boundary is a file.** Engines emit a mezzanine plus `render.json`;
   post, QA and release read only files. Any renderer can join without touching the rest.
   The mezzanine is lossless RGB; post makes the one BT.709 conversion.
3. **2026-11-01 · One toolchain at HEAD.** Exact pins in the pnpm catalog, no per-video
   `package.json`. Videos cannot drift apart; the price is that an upgrade must keep every
   active video working (frozen videos are exempt).
4. **2026-11-01 · Lifecycle with frozen releases.** Eight statuses, three human gates, frozen
   once published. Old videos stay rebuildable without holding back the shared code.
5. **2026-11-01 · Versioned schemas.** `schemaVersion` everywhere; breaking changes add a
   version and keep the old schema.
6. **2026-11-01 · Series defaults are copied, not inherited.** `aiv new` copies them once.
   Editing a series never silently changes an existing video.
7. **2026-11-01 · Determinism contract.** Pure frames, a lint ban list, per-frame hashes,
   resume keyed to an input hash that refuses on change (the fix for the chunk-reuse bug of
   *THE AI STACK*).
8. **2026-11-01 · Storage tiers without LFS.** Git for text and small files, GitHub Releases
   for media with a manifest, private storage for the rest. Free, durable, and clones stay small.
9. **2026-11-01 · Host safety is cross-platform and opt-in.** A lock, a memory guard and an
   orphan sweep limited to our own browsers; never a built-in list of apps to kill.
10. **2026-11-01 · Toolchain fingerprint, coarse host class.** Committed files record versions
    and a GPU family, never host names, user paths or driver builds.
11. **2026-11-01 · Licensing by path and file type.** MIT for code, CC BY 4.0 for prose and
    original media, recorded in `REUSE.toml`; adapted code keeps SPDX headers and is listed in
    `NOTICE.md`. Remotion is a dependency with its own licence, never redistributed.
12. **2026-11-01 · Generated, never hand-edited.** Schemas, the catalog, the index and marked
    doc blocks are generated by `aiv check --fix` and checked for freshness.
13. **2026-11-01 · Bit-exact Matroska.** Mezzanines and archive masters are written with
    ffmpeg's bit-exact flags, so equal frames give equal files and release hashes are
    reproducible on the same host.
14. **2026-11-01 · The repository model lives in the CLI.** `video.json` and `series.json`
    schemas, gates and generators are in `tools/aiv`; `@aiv/core` holds only what engines and
    the pipeline need, so repository bookkeeping never changes a render's input hash.
15. **2026-11-01 · Remotion streams PNG frames into the shared runner.** The engine calls
    Remotion's `renderFrames` per chunk and decodes each lossless PNG, rather than letting
    `renderMedia` encode video. Remotion frames then get the same per-frame hashes, mezzanine
    and single BT.709 conversion as every other engine, and `render.json` v1 did not change.
    The cost is a PNG encode and decode per frame (about 40 ms at 1080p on the reference host).
    The bundle is cached by its inputs, and webpack must report every bundled file under the
    hashed roots or the render refuses.
16. **2026-11-01 · No `@react-three/postprocessing`.** It assembles its composer after the
    first render, so every chunk starts with unprocessed frames. `@aiv/remotion-kit`'s
    `PostChain` builds a `postprocessing` composer synchronously instead, and the wrapper
    package is not installed.
17. **2026-11-01 · Large inputs live beside the video, out of git.** `videos/<slug>/media/` is
    gitignored except its `manifest.json`, and is part of the input hash. Music, voice,
    footage and large textures then have a home without Git LFS. The manifest check and
    engine access to media files are built with the first video that needs them.
18. **2026-11-01 · Frozen is enforced, not only promised.** `aiv render` refuses a published
    or archived video unless the checkout is at its release tag, and `aiv check` no longer
    requires the styles and engines a frozen video named to exist at HEAD: it is rebuilt from
    its tag, so HEAD may retire them.
19. **2026-11-01 · The pre-commit check judges the commit.** `aiv check --staged` reads staged
    contents and builds the repository model from tracked slots only, so a secret fixed in
    the working tree but still staged is caught, and an untracked work-in-progress video
    does not block an unrelated commit.
20. **2026-11-01 · Prose is not a render input.** The input hash skips Markdown files, so
    editing a style guide or a README never invalidates a resumable render.
21. **2026-11-03 · Audio is a build stage with its own input hash.** A video's score lives in
    `videos/<slug>/audio/`, outside the picture's inputs, and `aiv audio` builds it into
    `out/<slug>/audio/` with `audio.json`. A track names its output `audio:<name>`; post and
    release refuse stale tracks, a track built against another cue sheet, and (release) a stale
    picture. The stage's synthesis runtime is in `@aiv/pipeline` and in the audio hash; musical
    content (instruments, sound design, the mix) stays in the video until a second scored film
    needs it (rule of two). Why: the first film had no way to build sound from code, and score
    code under `src/` would have forced a full picture re-render for every audio edit. Cost: a
    second build step (seconds) before post, and a rebuild recipe with one more command.
22. **2026-11-03 · One cue sheet per video.** `src/cues.ts` exports a `CueSheet`: the film's
    length, the test-card leader, an optional bar grid and its events (cuts, hits, rests,
    silences, black and held spans, text and cards). Picture and score import it; QA reads its
    events from `audio.json` to check rests, silences and intentional black or held spans,
    and `aiv audio` checks cuts against bar lines, text hold times and card lengths. Why:
    MAP's score once bypassed its cue sheet and drifted. Cost: timing lives in one module
    that both hashes cover.
23. **2026-11-03 · Pinned sample libraries.** A score that plays samples pins exactly the files
    it reads in `audio/library.json` (path, bytes, sha256, upstream repository and commit,
    licence). The files sit in a shared store, `.cache/libraries/<id>@<commit>/`, filled by
    `aiv doctor --fix` from a local seed (`aiv.local.json` `librarySeeds`: a git checkout of
    the library that git confirms is at the pinned commit, unmodified) or downloaded from
    upstream at that commit, and verified (bytes and sha256) on every read. Libraries are never
    committed and never part of `media/` (a picture input). Cost: a rebuild on a new machine
    fetches the pinned files first.
24. **2026-11-03 · The leader is a cue-sheet constant.** Frames and samples count from the end
    of the test-card leader (`leaderFrames`), so removing it for the final shifts picture and
    sound together; `render-verify` proves the final equals the approved review cut shifted by
    the leader. Post does not trim a leader (the roadmap item stays deferred).
25. **2026-11-03 · Audio QA for an agent that cannot hear.** `aiv qa` draws the sound
    (spectrogram and waveform with the cue sheet's events), fails on clipping and on intended
    silences or rests that are not quiet, reports hit timing, and lists where a person must
    listen. Reports say what was not heard; a person listens before the review approval.
26. **2026-11-03 · Third-party characters and parody.** Others' characters, brands and marks
    appear only with permission or as parody a viewer cannot mistake for the real thing: no
    logos, wordmarks, verbatim official notices or real addresses, and a non-affiliation
    notice. A film whose central character belongs to someone else is `license.film: none`
    ([LICENSING](LICENSING.md#third-party-characters-brands-and-parody)).
