# Credits: MiniDSH 2.0: One Runtime, Every Surface

- **The product.** Every product image in the film is the real MiniDSH 2.0.0, recorded live on
  2026-11-24 from the published npm package and the published Windows installer. It ran on
  DeepSeek (`deepseek-flash`) with the creator's own key, on neutral demo folders (`/code/tinytable`
  in WSL, `C:\code\tinytable` on Windows).
- **The recordings.** The tools that recorded it are in [`capture/`](capture/). The session logs
  were scanned for keys, user names and home paths with MiniDSH's own `scripts/shots/scan.mjs`, and
  stay local (never committed).
- **The model's words.** Every word the model says on screen is its own output from those
  sessions. Nothing was typed in for it or edited.
- **Timing.** The film retimes the takes to its beat ("waits shortened") and never changes their
  content.

| Asset | Source | Licence or rights class | Changes | Used as |
|---|---|---|---|---|
| `assets/ui/web-*.png` | Real stills of MiniDSH's web UI (`minidsh web` 2.0.0 in WSL, shown in Chrome at 3× pixel density, 1280×800 CSS px), from the session the terminal started (`capture/web_take.ts`) | MIT (MiniDSH contributors). The web UI's design tokens and icons are adapted from DeepSeek Harness (MIT, © DeepSeek), per MiniDSH's NOTICE | none | Panes in the web acts, cropped and magnified by the film |
| `assets/ui/desk-*.png` | Real stills of the MiniDSH desktop app 2.0.0 (official `MiniDSH-Setup-x64.exe`, sha256 `2f2ee949…f04c2`): its content at 3× over CDP, and its window (native frame, menus) with PrintWindow (`capture/desktop_take.ts`) | MIT (MiniDSH contributors; tokens and icons as above) | none | The desktop act |
| `assets/tui/paints.json` | MiniDSH's full-screen terminal output (`minidsh chat` 2.0.0 in WSL, 100×30), recorded byte for byte in a pseudo-terminal (`capture/tui_record.py`) and converted to its screen states (`capture/tui_paints.ts`) | MIT (MiniDSH contributors) | Converted from escape sequences to rows of styled text; the film draws them with its own type and colours (the terminal UI paints no background, so the theme is the terminal's) | The terminal act |
| `assets/probe/*.png` | MiniDSH's published README pictures `web-light.png` and `approval.png` (2.0.0, `docs/images/`) | MIT (as above) | none | The web kit's lookdev probe only (not in the film) |
| The MiniDSH mark | Its geometry from MiniDSH's `docs/images/logo/minidsh-mark.svg` (two arches and a dot) | MIT (MiniDSH contributors) | Redrawn in the film's own code from that geometry | The poster and the close |
| IBM Plex Sans | `@fontsource-variable/ibm-plex-sans` 5.3.0 (IBM Corp.) | OFL-1.1 | none (used unmodified, not redistributed) | Titles |
| IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 (IBM Corp.) | OFL-1.1 | none (used unmodified, not redistributed) | Commands, receipts, the terminal pane |
| The reference film | DeepSeek Harness's "Creator Mode" film (X, 2026-11-02), studied locally | Its owner's rights: reference only | Never committed; no frame, sound or asset of it is in the film | The quality bar ([BRIEF.md](BRIEF.md)) |

- **Non-affiliation.** MiniDSH is an independent project inspired by DeepSeek Harness, not
  affiliated with or endorsed by DeepSeek. No DeepSeek logo or brand artwork appears in the film.
  The provider and model names on screen (DeepSeek, Anthropic and OpenAI; the DeepSeek and Claude
  model labels in the picker) are the product's own labels for the providers it calls, used only
  to name them. No logo or brand artwork of any of them appears, and none endorses the film or
  MiniDSH.

## Method
- **The skill.** The production method was read from **op7418/guizang-product-video-skill @
  `18842e0f`** (AGPL-3.0) as a guide only
  ([note](../../references/guizang-product-video-skill.md)). None of its code, text, styles or
  sounds is in this repository or in the film.
- **Our own kit.** The film's picture code builds on `packages/web-kit`, promoted from this
  repository's film #4.

## Tools
- The repository's web engine (Playwright driving Chromium, Vite; the picture is the film's own
  WebGL2 code via `@aiv/web-kit`).
- FFmpeg 8 (used as a tool), Node 24, and the repository's own pipeline (render, audio, post, QA).
- Captures: MiniDSH's own page and desktop drivers (`src/test-support`, read from its v2.0.0
  checkout), Chrome, PowerShell 7.
- Made with Claude Code (Claude Opus 5.5).
- No generative image, video, music or voice models are used.
