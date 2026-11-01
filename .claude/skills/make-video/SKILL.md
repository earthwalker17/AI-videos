---
name: make-video
description: Start or continue a video in this repository, from idea to release (new slot, brief, treatment, script, storyboard, facts, scene code, review cut, final, release). Use for any work under videos/<slug>/ or when the user wants a new video. Routes to the aiv commands and docs/PRODUCTION.md, keeps the lifecycle gates and stops at the user's approval points.
---

# Make a video

## Orient (every time)
1. Read `docs/INDEX.md`. For an existing video read its `video.json` (`status`, `next`) and
   `README.md`, its series' `SERIES.md`, and the section of `docs/PRODUCTION.md` for the
   current status. Do the work of that stage only.
2. New video: `pnpm aiv new <slug> --engine <web|remotion> --series <id> --title "<title>"`.
   Slugs are lowercase-kebab and permanent once production starts.

## Stages
| Status | Do | Then |
|---|---|---|
| `idea` → `brief` | Write `BRIEF.md` (audience, promise, shape, references, risks) and the README's opening. | `status: brief` |
| `brief` → `treatment` | Write three structurally different candidates in `TREATMENT.md` **before** looking at earlier videos, then choose one and say why. | **Stop: the user approves the treatment.** |
| `production` | `SCRIPT.md`, `STORYBOARD.md`, `FACTS.md` + `sources.jsonl` (factual series), code in `src/`. Iterate with the `render-verify` skill on draft renders. At least one adversarial round with the `frame-critic` agent. | review cut passes `aiv qa` |
| `review` | Full-size cut (`--profile review`). | **Stop: the user watches it and approves.** |
| `locked` | Final render, captions per language, `publish/` files, `CREDITS.md`. | **Stop: the user approves the final.** |
| `published` | `pnpm aiv release <slug>` from a clean, committed tree; upload; record `youtube.id` and `release.version`. | frozen |

## Rules
- Approvals go into `video.json` `approvals` (gate, date, the user's words in `note`) only
  when the user gave them. Never record one yourself.
- Update `status` and `next` in `video.json`, then run `pnpm aiv check`; it enforces the gates.
- Reuse before writing: `packages/`, `styles/`, `knowledge/`, and other videos' `reusable`
  lists. Code a second video needs is promoted, never copied (`docs/ARCHITECTURE.md`, "Where
  things go").
- Spending money (paid APIs, cloud renders) and changing dependencies need the user's approval.
- Commit after each verified step. Verified means rendered and looked at, not only exit 0.
