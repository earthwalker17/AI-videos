# guizang product video skill: a method for code-made software launch films (2026-11)

| | |
|---|---|
| Upstream | https://github.com/op7418/guizang-product-video-skill |
| Pin | `18842e0f49a9eb2b8c00cc065ec37b314e235aaa` (2026-10-09; still `main` on 2026-11-24), tree `4ce06cc4d60a515d7caa48fa0cb5967f29d260bb`, 104 files |
| Licence | AGPL-3.0 for the repository: workflow, docs, scripts, starter and its own audio. `assets/fallback/` is BUSL-1.1 (CodePilot), and its grant excludes commercial use. Upstream also offers separate commercial terms (`COMMERCIAL_LICENSING.md`) for closed integrations; nothing here uses them. |
| Use here | **Ideas only** (`excerpt_policy: link-only`). Nothing of it is vendored, copied, translated, installed in the project or run in this tree. |
| Accessed | 2026-11-24, read at the pin through `gh api` |
| Stale after | 2027-02-24, or when upstream moves past the pin |

## What it is
A Claude Code and Codex skill for making software-update promos and changelog films in code. Its
author built it out of his own product's launch films. Its stages:
1. The user fixes the version and the surfaces the film covers.
2. A product audit: evidence for each feature, the product's own style.
3. A direction document with three candidates.
4. Shot-by-shot building, mounting the product's real UI components with fixtures, each shot
   giving a still.
5. Music and sound effects.
6. A review with contact sheets and transition strips.
7. A delivery check.

It renders with Playwright, a screenshot per frame, and encodes in one pass with ffmpeg. Its own
scripts plan, mix and check.

## Why it matters here
It is the most complete written method for the kind of film the `product-launch` series makes. The
creator asked to integrate it, and to keep third-party skills reusable across films (see
[README.md](README.md), External skills).

## How we use it (our stage → what we take, in our own words)
- **BRIEF.** A scope lock: the version and surfaces the film covers, and a plain statement of what
  it leaves out.
- **FACTS.** A feature-evidence row for every claim, with the product state that demonstrates it and
  its limits.
- **TREATMENT.**
  - Candidates that differ on named axes: ground and light, type, motif source, camera, transitions,
    rhythm, sound.
  - Every device justified by a product fact ("because the product has X, the film uses Y").
  - For agent products, the structure is one real task carried to completion.
- **STORYBOARD.**
  - The frame system in numbers, including **UI magnification = the size the text must reach ÷ the
    product's own text size**.
  - One protagonist per shot. A state change or camera move in every shot.
  - **Push-in continuation**: the element that ends one shot opens the next, at the same place and
    size.
  - The first frame is a complete poster, since some platforms use frame 0 as the thumbnail.
- **Capture.** Show the real product. Where a part must be rebuilt, rebuild it faithfully from
  source and label it as a rebuild. Never start a real app's IPC inside the film's render.
- **Sound.** A few sound-effect roles, each tied to an action. Music ducks under each effect, by role.
- **Review.** Contact sheets plus dense strips around every transition, and full-size frames of the
  densest UI. Its fault table: titles colliding with UI, uniform entrances, a blank first frame, a
  light-to-dark crossfade going grey.

## Never
- **Don't copy into this repository** (copyleft would follow):
  - its files, text, tables or checklists, or a translation of them;
  - its starter (`assets/starter`) or its fx sketches.
- **Don't use in a film:**
  - its sound effects (`assets/audio/sfx/*.wav`) or its example scores (both AGPL);
  - its fallback style (`assets/fallback`, BUSL).
- **Don't run here:**
  - `scripts/init_project.py`, which copies the AGPL starter into the folder it is given;
  - the skill's other scripts.
- **Don't install it as a project skill.** Its description would route an agent into its own
  `plan.json` pipeline beside `make-video`.

## Not adopted, and why
- **Its renderer.** JPEG frames encoded once, with no hashes, chunking or colour tags. Our engines,
  runner, post and QA do this with proofs.
- **Its numbers where ours differ.** Loudness: −16 LUFS against our −14. Text floor: 22 px against
  our 36 px for text that must be read.
- **Its default language and its Python tooling.**

## Not read
`extras/news-video/`, `tests/`, `scripts/init_project.py`, `scripts/check_environment.py`, the fx-lab
sources, the example score scripts, `assets/starter/cover.mjs` and `server.mjs`.
