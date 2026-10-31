# AI-videos — project constitution

AI-videos is the source, workflows and shared tooling behind an AI + code YouTube
series, and a public knowledge base for making high-quality video with code.
It must stay understandable after 100 videos and as many sessions.

## Start of every session
1. Read `docs/INDEX.md` (generated map of what exists) and `docs/ROADMAP.md` (what is next).
2. Read `docs/ARCHITECTURE.md` when the task touches structure, contracts or a new kind of thing.
3. For video work, read the video's `video.json` + `README.md`, its series' `SERIES.md`,
   and `docs/PRODUCTION.md` for the workflow and gates.
Do not read the whole repo. The docs are maps; detail lives in code and in each slot.

## Principles
- **Architecture first.** Every new thing gets a home before it gets code. If it has no
  clear home in `docs/ARCHITECTURE.md`, that is an architecture question: resolve it there.
  Architecture first is not abstraction first: no empty layers, no speculative frameworks.
- **Shared infrastructure, thin videos.** A video folder holds only what is specific to it.
  Code needed by a second video is promoted to `packages/`, `engines/` or `styles/` (rule of two);
  never copy a helper between videos.
- **The engine boundary is a file.** Any engine (Remotion, web pages, later Manim/Blender/…)
  emits a mezzanine + `render.json`; post, QA and release only read those files.
- **Determinism.** A frame is a pure function of its index: no wall clocks, timers, unseeded
  randomness or clock-driven helpers in frame code (ESLint enforces it). Same host, same inputs,
  same pixels.
- **Verify real media, not exit codes.** Work is not done until the output was rendered, run
  through `aiv qa`, and its contact sheet / frames were actually looked at. Report what was
  verified and what was not; never claim quality you have not seen or heard.
- **Repair the environment; do not lower the bar.** A missing or broken tool is fixed (or the
  user is asked to approve the fix), not designed around. Heavy work that this laptop cannot do
  well is routed to a documented alternative (chunked overnight render, cloud), not dropped.
- **Reproducible and frozen.** Exact pins at HEAD; a published video is frozen at its git tag
  and rebuilt from that tag, never edited to keep up with upgrades.
- **Research deliberately.** Check `references/` before researching; write back what you
  verified or falsified, with a pin (commit/version/date). Prefer primary sources.
- **Public by default, private by rule.** No secrets, personal paths, host details or
  non-redistributable media in git. Respect every license (`docs/LICENSING.md`).

## Rules
- Generated outputs never enter git: `out/` (renders, QA, releases) and `.cache/` are local.
  Committed binaries are small (≤ 2 MB each); larger media goes to GitHub Releases with a
  sha256 manifest. No Git LFS.
- Heavy jobs (renders, encodes, Blender, audio renders) run through `pnpm aiv heavy` / the
  engines, one at a time machine-wide. Keep foreground calls under ~10 minutes; long renders
  run chunked and resumable.
- Never edit generated files by hand (`catalog.json`, `docs/INDEX.md`, `schemas/*.json`,
  marked regions in README/docs). Run `pnpm aiv check --fix`.
- Spending money (paid generation APIs, cloud renders) needs the user's approval or a preset budget.
- Subagents and workflows: use them for research, review and bounded parallel work. At most two
  heavy implementers at once; they never run git or change dependencies; the main agent
  integrates, reviews and views every render itself.
- Commit after each coherent, verified step (conventional commits). Push only when the user asks.
- Keep this file stable and short. Session history belongs in git, state in `docs/ROADMAP.md`,
  structure in `docs/ARCHITECTURE.md`.

## Commands
`pnpm aiv --help` lists every command. Core loop for a video:
`aiv new` → `aiv render` → `aiv post` → `aiv qa` → `aiv release`; `aiv check` before committing.
Also: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
