# Manim — Community Edition vs ManimGL

| | |
|---|---|
| Upstream | https://github.com/ManimCommunity/manim · https://github.com/3b1b/manim |
| Pin | ManimCE v0.22.1 (2026-10-27) at `16ea443e2a5f1d79db0a721161411ce916d6e733` · ManimGL master `fafa083a4fb274bba9cabde0b6e2f50ba6da0622` (2026-09-09); PyPI `manimgl` 1.7.2 (2024-12-13) |
| Licence | Both MIT. The 3Blue1Brown scene code (https://github.com/3b1b/videos) is CC BY-NC-SA 4.0. |
| Accessed | 2026-11-01 |
| Stale after | 2027-01-01, or on the next ManimCE minor release (0.21 and 0.22 both broke workflows). |
| Status here | Deferred engine for math explainers; installed only when the first such video needs it (`aiv doctor` prints the fix). |

## What it is
A Python library for programmatic math animation. Community Edition (`manim`, `from manim
import *`) is the maintained, packaged fork; ManimGL (`manimgl`, `from manimlib import *`)
is Grant Sanderson's interactive-first original.

## Why it matters here
It is the natural engine for math-heavy explainers, and 0.21/0.22 changed both math
typesetting (LaTeX now optional) and the CLI that agents have memorised.

## Key facts
**ManimCE** [V]
- Python ≥ 3.11, including 3.14; every native dependency ships Windows wheels (pycairo 1.29.2, manimpango 0.7.1, moderngl 5.13.0, skia-pathops 0.9.2, av 19.0.2, mapbox-earcut 2.1.0, glcontext 3.1.0, typst 0.15.0). No compilers or system Cairo/Pango needed.
- Encodes through PyAV (`av >= 15`), so no separate FFmpeg binary is required.
- Defaults (`manim/_config/default.cfg`): Cairo CPU renderer, 1920×1080 at **60 fps**. `--renderer opengl` exists.
- `config.seed` seeds both `random` and numpy (`manim/scene/scene.py`); partial movie files are cached by hash.
- v0.21.0 (2026-08-10): first-class Typst text and math (`Typst`, `MathTypst` — renamed from `TypstMath`), optional extra `manim[typst]` (typst ≥ 0.14). LaTeX is now optional; `MathTex` still needs a TeX install.
- v0.22.0 (2026-10-08): output unified under `--format {auto,mp4,mov,webm,gif,png,png-sequence,none}`; added `--video-codec`, `--pixel-format`, repeatable `--encoder-option`; **removed** `--write_to_movie`, `-g/--save_pngs`, `-i/--save_as_gif`, `--force_window`, `--flush_cache` (and `--custom_folders` per the sweep). A `Manager` class starts a render-lifecycle rewrite: expect more API churn.
- The docs' example gallery (`docs/source/examples.rst`, 27 `.. manim::` directives) is rendered at docs build time, so examples cannot rot.
- `manim-voiceover` 0.4.0 (MIT) syncs animations to TTS or recorded narration with bookmarks.
- No official agent skills or llms.txt, but heavy coverage in model training data.

**ManimGL** [V]
- No PyPI release since 1.7.2 (2024-12-13). Master merged a port from OpenGL/moderngl to wgpu + rendercanvas (PR #2487, 2026-08-06) and later added `VideoMobject` and `Sprite`; the README still lists OpenGL, FFmpeg and LaTeX.
- Different package, imports, CLI and API from CE; models mix the two dialects.

**Python baseline when Manim lands** [V]: 3.13 is the only interpreter every planned Python tool accepts (see `toolchain-2026-11.md`); pin `requires-python = ">=3.13,<3.14"` and a `.python-version`.

## What we adopted / adapted (per the plan)
- Nothing installed yet. When added: `engines/manim/` emits a mezzanine + `render.json` like every engine, and the adapter (not the agent) builds the exact CLI command for the pinned version.
- CE only; `MathTypst` as the default math path (no TeX install); `MathTex` opt-in with a pinned TinyTeX package list if ever needed.
- Seed via `config.seed`; fps from the video's `video.json`, not Manim's 60 fps default.

## What we deliberately did NOT adopt, and why
- ManimGL: unreleased master diverges from the last release; one dialect only.
- Any code from 3b1b/videos: NC-SA licence is incompatible with our MIT/CC BY split.
- Manim's own encode as a delivery file: post still does the single BT.709 conversion and the delivery encode.

## Gotchas
- Commands from older docs or model memory (`-g`, `-i`, `--write_to_movie`) fail on 0.22.
- Typst support is recent; few examples online, so agents fall back to `MathTex` and hit the missing LaTeX.
- 1080p60 Cairo is slow on a 4-core laptop: draft at low quality, and keep heavy 3D out of Cairo.

## Not read
Colour tags and pixel format of PyAV-encoded output (assumed to need post conversion, not verified); OpenGL renderer stability; Typst coverage of complex notation; a real Windows install (not executed in the sweep).
