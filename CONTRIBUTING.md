# Contributing

Thanks for your interest. This repository is two things: the production home of
one channel's videos, and an open knowledge base for making video with code. Most
outside contributions belong to the second part.

## What is welcome
- **Knowledge cards** (`knowledge/`): a technique you have verified, written
  method-first and tool-agnostic, with evidence.
- **Reference notes** (`references/`): a pinned, licence-clean map of an external
  project or document (see `references/README.md` for the policy).
- **Fixes and improvements to shared tooling** (`packages/`, `engines/`, `tools/`),
  with tests.
- **New engine adapters** (`engines/<id>/`): follow the checklist in
  [Adding an engine](docs/ARCHITECTURE.md#adding-an-engine). An adapter comes with a
  fixture template and an `ENGINE.md`, and passes the render contract checks.
- **Fixes to styles** (`styles/<id>/`). A new style is created only when a second video
  reuses a look (the rule of two, see [`styles/README.md`](styles/README.md)), so new
  styles come from the channel's own videos; in a fork, the same rule applies.

## What is not
- New videos for the channel's series: `videos/` is the channel's own production
  record. You are welcome to fork the repository and make your own
  ([Make your own](README.md#make-your-own)).
- Large binaries. Committed files stay at or under 2 MiB each, and there is no Git
  LFS. Heavy media goes to release assets with a sha256 manifest.
- Material you do not have the rights to share, including model outputs whose
  terms forbid redistribution.

## How
1. Node `>=24.11`, pnpm (the version pinned in `package.json`) and FFmpeg 8. Then
   `pnpm install` and `git config core.hooksPath .githooks` (runs `aiv check --staged`
   before each commit). [ENVIRONMENT](docs/ENVIRONMENT.md) has the details.
2. Read `CLAUDE.md` for the principles and `docs/ARCHITECTURE.md` for where things go.
3. Before opening a pull request: `pnpm typecheck`, `pnpm lint`, `pnpm test` and
   `pnpm aiv check`. If you changed rendering code, render a template and run
   `pnpm aiv qa` on it.
4. Use conventional commit messages (`feat(pipeline): …`, `docs(knowledge): …`).
5. No secrets, absolute personal paths or machine details in committed files.
   `aiv check` and the pre-commit hook catch the common cases.

## Licence of contributions
By contributing you agree that your code is licensed under MIT and your prose and
media under CC BY 4.0, the same licences as the rest of the repository
([`docs/LICENSING.md`](docs/LICENSING.md)).
