# Architecture

How this repository is organised, where each kind of thing goes, the contracts between
its parts, and the decisions behind them. If something new has no clear home here, decide
its home here first, then write the code.

## The map

| Layer | Folder | Holds | Grows when |
|---|---|---|---|
| Content | `videos/<slug>/` | One folder per video: `video.json`, stage documents, `src/`, small `assets/`, `release/` manifests. Flat: the series is metadata. | every video |
| Content | `series/<id>/` | `series.json` (id, summary, facts policy, defaults) and `SERIES.md` (identity, editorial principles, craft hypotheses). | a series is added or learns something |
| Library | `styles/<id>/` | `STYLE.md` (palette, type, motion and composition rules) plus tokens, for looks shared by several videos. | a second video reuses a look |
| Library | `knowledge/` | Technique cards: method first, then "in this repo", each with the evidence that verified it. | something is learned and verified |
| Library | `references/` | Pinned notes on external projects, platforms and licences, plus `sources.json`. Maps, not copies. | research |
| Library | `prompts/<modality>/` | Versioned prompt templates for generated assets (created with the first one). | the first generated asset |
| Code | `packages/` | `@aiv/core` (browser-safe: seeded rng, easing, swatches, render contracts), `@aiv/pipeline` (Node: host safety, encode, chunk runner, QA, release), `@aiv/remotion-kit` (React/R3F building blocks). | code is promoted (rule of two) |
| Code | `engines/<id>/` | One adapter per renderer: turns a video's source into a mezzanine plus `render.json`. `ENGINE.md` documents it. | a video needs another renderer |
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
| A new video | `pnpm aiv new <slug> --engine <id> --series <id>` creates `videos/<slug>/`. |
| Code only one video needs | `videos/<slug>/src/`. |
| Code a second video needs | Promote it, never copy it: frame maths and contracts → `@aiv/core`; React, Remotion or R3F components → `@aiv/remotion-kit`; Node-side media work → `@aiv/pipeline`; a look → `styles/<id>/`. |
| A new renderer (Manim, Blender, …) | `engines/<id>/` with `ENGINE.md`, plus `templates/<id>/` that passes render → post → qa. It must emit `render.json` v1. |
| A verified technique | `knowledge/<topic>.md`, method first, with the evidence. |
| Notes on an outside project or rule | `references/<topic>.md` and an entry in `references/sources.json`. |
| A small original asset (≤ 2 MiB) | `videos/<slug>/assets/` with its provenance in `CREDITS.md`. |
| Large media, delivery files, masters | GitHub Release assets with a sha256 manifest (see Storage). |
| Machine-specific settings | `aiv.local.json` (gitignored; copy `aiv.local.example.json`). |
| Raw research, renders, caches | `.cache/` and `out/`. |

## The pipeline

```text
videos/<slug>/src ──engine──▶ out/<slug>/render/<profile>/mezzanine.mkv + render.json
                  ──aiv post──▶ out/<slug>/post/<profile>/<slug>.mp4 (+ archive.mkv) + post.json
                  ──aiv qa────▶ out/<slug>/qa/<profile>/report.json + contact.png
                  ──aiv release▶ videos/<slug>/release/v<N>.json + GitHub release video/<slug>/v<N>
```

- **Engines** produce frames. The runner in `@aiv/pipeline` owns everything around them:
  chunking, the input hash, resume, time budgets, the heavy lock and the mezzanine. A
  streaming engine hands over RGBA frames; the runner hashes each frame and writes a
  lossless FFV1 RGB mezzanine.
- **Post** mixes the audio bed (two-pass loudness normalisation to -14 LUFS) and makes the
  single RGB → BT.709 limited-range conversion, with explicit colour tags. Profiles:
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

`render.json` and the release manifest were derived from the first real render and release
(pinned as test fixtures). `post.json` and the QA report are working files in `out/`.

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
- The **input hash** covers what pixels depend on: the video's `src/` and `assets/`, `styles/`,
  every frame-side package, the engine's runtime, the render settings and the lockfile. A
  resumed render refuses (exit 2) when it changed, so stale chunks cannot survive an edit.
  Engines refuse to load files outside the hashed roots.

## Storage

| Tier | Where | What | Limit |
|---|---|---|---|
| T0 | git | Text, code, small original assets | 2 MiB per file; no Git LFS |
| T1 | GitHub Releases | Delivery file and archive master per release, listed in the manifest with sha256 | 2 GiB per asset |
| T2 | local or private storage | Masters too large for T1, material that may not be redistributed | hash only in git |

Generated AI material carries a provenance sidecar and a rights class (A–D, see
[LICENSING.md](LICENSING.md)); classes C and D never enter git.

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
repository root, so creating a video never changes the lockfile. Browsers are pinned too
(Chrome for Testing in `.cache/browsers` for the web engine). `render.json` records the
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
