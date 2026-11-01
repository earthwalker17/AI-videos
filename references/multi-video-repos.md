# Multi-video repositories — patterns and anti-patterns

| | |
|---|---|
| Upstream | ~25 repos, pinned below; lists: https://github.com/zhuyansen/awesome-claude-video-skills (`533c784c4f0f`, 394 repos indexed, licence NOASSERTION), https://www.remotion.dev/docs/resources |
| Pin | Per repo (HEAD SHAs as of 2026-11-01 unless dated) |
| Licence | Per repo; several are NC, GPL, AGPL or unlicensed: structure and ideas only |
| Accessed | 2026-11-01 |
| Stale after | 2027-05-01 (structural lessons age slowly; star counts and HEADs do not matter). |

## What it is
A study of repos that hold many videos, video knowledge bases and agent video toolkits,
sorted into four families, with concrete evidence of what scaled and what broke.

## Why it matters here
The repo targets 50–100 videos and many agent sessions. These repos have already paid for
most of the mistakes available to us.

## Key facts — families
**1. Year- or number-sharded creator monorepos**
- **3b1b/videos** @`306a1346a356c7a7b097875ceb51c5cd67d0a56c` (CC BY-NC-SA 4.0; engine MIT): year folders `_2015…_2026`, a deliberately thin shared layer (`custom/` channel identity, one universal import, `once_useful_constructs/` for retired helpers, `outside_videos/` for non-series content), branch-per-video PRs, a root CLAUDE.md since 2026. No per-video metadata, tags or releases; README admits older projects may not run on current manim [V].
- **WelchLabs/videos** @`d9224ec211d2c72d001b050c92c84f579d20147e` (MIT): reuses the 3b1b skeleton verbatim for AI/ML topics; splits research notebooks from scene files named after script paragraphs (`p31.ipynb`) [V].
- **xiaoxiae/videos** (Polylog) @`f65794b0dfc81b225364ea776feac8326599cdaa` (GPL-3.0): numbered `NN-slug` folders, long/short templates, per-video `DESCRIPTION.md` (the YouTube description) and `SCRIPT.md`, repo-level `IDEAS.md` backlog, `MUSIC.md` licence ledger with "used in NN" back-references, and a `WORKFLOW.md` checklist through upload [V].

**2. Workspace-per-video JS repos**
- **motion-canvas/examples** @`8ffefed144368d33de4b0e451894c718eb95d574` (MIT): one npm workspace package per video, engine pinned once at root, `*.meta linguist-generated`; still commits 5.8–12.7 MB voice MP3s [V].
- **Takamasa045/remotion-studio-monorepo** @`c1648da6e0c3f7a0d67664ccd28d7e59358fa10d` (MIT): pnpm `catalog:` pins every `@remotion/*`, `apps/_template`, scaffold and upgrade scripts, per-app `app.meta.json` [V].
- **remotion-dev/our-recorder** @`e2dc4620188ab8ee1a3167a1fc566021639f1ff7`: ~80 videos in one project with an 11,021-line `Root.tsx` [V].
- Remotion's own brand videos moved from a 716 MB standalone repo into the monorepo (`packages/brand` @`fe9ffaa7`), with `*.sources.md` provenance sidecars (source URLs, image-gen prompt, processing steps, hosted URLs) and runtime media on object storage [V].

**3. Agent-era knowledge bases**
- **lemo-opuscar**: STYLE (invariants) vs DEMO (one film) split; see `lemo-opuscar.md`.
- **video-shotcraft** @`1266a3ec4831289c4d893d42dd5102723658039a` (Apache-2.0): "shot cards" `references/shots/<category>/<shot>.md` with frontmatter (name, summary, use case, duration, energy), intent, motion core, parameter table, known pitfalls, path to a runnable reference implementation; per-video `BRIEF.md` with YAML frontmatter and a dated Approval section; gallery media on a Releases tag (215 assets) pulled by a fetch script [V].
- **digitalsamba/claude-code-video-toolkit** @`eddb488a093064f1be59cc3c6977684c2672a495` (MIT): `.claude/skills` + commands, `brands/<name>/{brand.json, voice.json}`, nested CLAUDE.md per example, `project.json` multi-session state; `tools/qc.py` gates: scene VO −16 LUFS, render −14 LUFS / −1 dBTP, black gaps ≥ 0.5 s, still stretches > 3 s, WCAG AA contrast, text ≥ 2.6 % of the short side, exit 1 blocks the render [V].
- **Opus-made micro films** (ledbetterljoshua/functional-emotions-video @`b34c20a4f8f6`, MIT code; JohnHeibel/PDoomVideo @`fa546a38092e`, no licence): converged independently on `STORYBOARD.md` + `ANIMATION_GUIDE.md` (a contract for parallel chapter subagents: pure function of t, seeded randomness, edit only your chapter file, report bugs in shared files instead of fixing them, end exactly on the chapter boundary), chapter files, a `legacy/` folder for the rejected first attempt, parallel render and contact-sheet check scripts. One film: 372.7 s, 168 shots, 7 parallel subagents [V].
- **remotion-dev/skills** @`30d4553e`: a router SKILL.md loading sub-references on demand; generated README [V].

**4. Mega-framework end**
- **calesthio/OpenMontage** @`195eab24478d` (AGPL-3.0): 2,669 tree entries, 12 pipeline YAMLs, 20 artifact schemas, instructions for 6+ agents. Its asset-manifest fields (id, type, path, source_tool, scene_id, prompt, seed, model, cost_usd, provider, license, original_url) are a useful checklist; the machinery is what we avoid [V].

**Benchmark** [S]: on 2026-10-11 a third-party test had 16 published video skills and a no-skill Claude Code baseline make the same 15 s 1080p30 promo; all passed the same 4 checks; the baseline took 4.4 min, skills 2.0–23.5 min; 6 of 16 looked close to default. Skills earn their place through a look, a workflow or QC, not generic framework knowledge.

## Key facts — failures with evidence
- **Case collision**: 3b1b has `_2026/2025_P6/` and `_2026/2025_p6/` from different contributors; they merge on Windows NTFS [V].
- **Incomplete LFS pattern**: our-recorder tracked only `public/**/*.mp4`, so `.MOV` files up to ~98 MiB went into plain git (repo ~868 MB) [V].
- **Committed media and outputs**: 3b1b has a 56,303,747-byte text file; WelchLabs a 35.7 MB notebook with outputs (repo ~752 MB) [V].
- **Absolute personal paths in config**: 3b1b points asset dirs at a personal Dropbox path, with a TODO in a staging script [V].
- **Hand-maintained registry drift**: digitalsamba's registry is missing a template that exists on disk [V].
- **One giant registry file**: our-recorder's 80-composition `Root.tsx` [V].
- **Engine drift**: 3b1b has no per-video engine pin; Reducible vendored a modified manimlib and mixed engines across years [V].
- **Duplicated agent config**: one repo keeps three identical skill copies in `.claude/`, `.cursor/`, `.opencode/` [V].
- **No licence**: several creator repos say "reference only" or have no LICENSE, so nothing can be reused [V].

## What we adopted / adapted (per the plan)
- Monorepo, one flat folder per video (`videos/<slug>/`), series as metadata, ASCII lowercase-kebab slugs immutable from `production`, sequential `number`; CI rejects case collisions, reserved Windows names and overlong paths.
- Thin shared layer promoted by the rule of two; never copy helpers between videos.
- One machine-readable `video.json` per video; catalog, INDEX and README table generated and freshness-checked in CI.
- Per-video `README.md` (watch link, how made, how to reproduce, reusable bits, lessons), stage files (BRIEF, TREATMENT, SCRIPT, STORYBOARD, FACTS + sources.jsonl, CREDITS), `publish/` (description, chapters, captions, ai-disclosure).
- Freeze on publish: tag `video/<slug>/v<N>`, rebuild from the tag in a worktree, release manifest snapshots toolchain.
- Technique cards (`knowledge/`) that point to verified evidence; style invariants in `styles/`.
- Storage: no LFS, ≤ 2 MB committed binaries, Releases with sha256 manifests; `.gitattributes` `eol=lf` from day one.
- Machine QC gates instead of prose rules; one canonical `.claude/` (no duplicated agent folders).
- Explicit licences split by file type (MIT code, CC BY 4.0 prose/media).

## What we deliberately did NOT adopt, and why
- Year sharding or series-first folders: series is metadata; a video's folder never moves.
- Package-per-video: video code has no `package.json` (one toolchain at HEAD).
- OpenMontage-style pipeline schemas for every stage: speculative; schemas only for video, series, render, release.
- Copying any text or code from NC/GPL/AGPL/unlicensed repos (3b1b, Polylog, OpenMontage, PDoomVideo, Reducible): structure only.
- LFS even for "just small binaries".

## Gotchas
- Notebooks: strip outputs or keep them out of git.
- Planning files that are schema-validated YAML vs free Markdown: too much schema drifts towards the mega-framework failure; the plan keeps stage files as Markdown with required headings.
- Captions aligned to the script text avoid ASR mishearing product names (e.g. "Remotion" → "remote") [V, from digitalsamba].

## Not read
Per-video quality or audience outcomes of any of these repos; the internals of OpenMontage beyond its schemas; private or non-GitHub creator setups; Reducible and vivek3141 beyond their layout and licence status.
