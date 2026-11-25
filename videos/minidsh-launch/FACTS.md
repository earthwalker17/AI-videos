# Facts: MiniDSH 2.0: One Runtime, Every Surface

Every claim the film makes in words or pictures, with its source. MiniDSH is cited at its v2.0.0
tag (`minidsh-v2.0.0` in `sources.jsonl`, commit `3d411ea`), as `file:line`; the live takes are
cited as `take-*` (recorded 2026-11-24, logs kept locally, never committed). Lines were checked
against the tag on 2026-11-24.

## The words on screen

<!-- REUSE-IgnoreStart: a quoted third-party notice, not one for this file -->

| Claim | As said in the film | Source | Checked |
|---|---|---|---|
| A coding agent you use from a terminal, a browser and a desktop window | "A coding agent for your terminal, browser and desktop." | README.md:14 ("A coding agent for a terminal, a browser, a desktop window or a script") | yes |
| The editor refuses an edit to a file the session has not read | "No edit before a read." | src/capabilities/fs-observation-policy/index.ts:33 (`FS_NOT_OBSERVED`: "edit requires reading … first"); README.md:49; take-tui (the refusal is genuine: the model's first edit was refused, then it read the file) | yes, scoped (below) |
| The terminal's session continues in the web UI | "Same session. In your browser." | README.md:62 ("use one runtime and the same stored sessions"); docs/GUIDE.md:174; take-web (the web take opened the session the terminal take started, same MINIDSH_HOME) | yes |
| The receipt is the runtime's record, not the model's account | "The runtime's record, not the model's word." | src/app/web/cards.js:261 ("the runtime's own record of an effect, never the model's account of it") | yes |
| The default preset | "Write inside the workspace. / Anything wider needs approval." | src/core/presets/index.ts:37 (verbatim: "Write inside the workspace; anything wider needs approval.") | yes, scoped (below) |
| The desktop app has its own window, with Node inside | "Its own window. Node inside." | docs/GUIDE.md:29 ("the web UI in its own window, with its own Node inside") | yes |
| Quitting mid-turn keeps the session | "Quit mid-turn. The session is kept." | desktop/src/main.ts:410-411 (the confirm: "Quit MiniDSH? … Quitting stops it; every session is kept and can be resumed."); take-desk (quit mid-turn; on restart the session was listed and opened, marked "Stopped · The turn was cancelled before it finished.") | yes |
| Four ways in | "Four ways in." | README.md:62 (terminal, web UI, desktop app, headless `run`) | yes |
| Three providers | "DeepSeek, Anthropic or OpenAI." | README.md:56; docs/GUIDE.md:54-60 (bring your own key); take-desk (the model picker lists the providers) | yes |
| One runtime behind every surface | "One runtime." | README.md:62; desktop/README.md (the desktop runs the bundled CLI's `minidsh web --json`) | yes |
| The four layers | the strips `app/ capabilities/ core/ kernel/`, each listing every module | README.md:15 ("Four layers in one package"), README.md:88-93; every entry of src/app (13), src/capabilities (30), src/core (26) and src/kernel (5) at the tag, folders and files, tests and READMEs left out (checked with `git ls-tree` 3d411ea, 2026-11-24) | yes |
| Each moment's module | the stamps: the refusal on `fs-observation-policy/`, Allow once on `core/approval/` and `core/sandbox/`, the kept session on `persistence-jsonl/` (writing `sessions/<id>.jsonl`), the providers on `llm-anthropic/ llm-deepseek/ llm-openai/` | src/capabilities/fs-observation-policy/index.ts:33; src/core/sandbox, src/core/approval; docs/GUIDE.md:157 (one append-only log per session); README.md:56 | yes |
| The ways in | tabs `terminal`, `web`, `desktop` (docked into `web`: the desktop runs `minidsh web --json`), `headless run` | README.md:62; desktop/README.md:3 ("spawns the bundled CLI's `minidsh web --json`"); src/app/headless.ts | yes |
| The product's own self-description | "An architecture-first, local-first agent harness." | README.md:8 (the hero image's alt text and the social preview) | yes |
| Install | "npm install -g minidsh" · "Node 24+" | README.md:20-27; package.json `engines` (node >= 24); npm `minidsh@2.0.0` | yes |
| Size | "One package. One runtime dependency." | SECURITY.md:119 ("The npm package has one runtime dependency, `zod`"); README.md:15 | yes, scoped (below) |
| The repository | "github.com/earthwalker17/MiniDSH" | the repository (public, MIT) | yes |
| Non-affiliation | "An independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek." | README.md:152, condensed (it reads "MiniDSH is an independent project inspired by DeepSeek Harness (MIT, © DeepSeek). It is not affiliated with or endorsed by DeepSeek."); NOTICE | yes |
| How the film was made | "Real sessions, recorded live; waits shortened." | take-tui, take-web, take-desk; capture/ (the film retimes the takes to the beat and never changes their content) | yes |

<!-- REUSE-IgnoreEnd -->

## The pictures

| Claim | What is shown | Source | Checked |
|---|---|---|---|
| The terminal turn | MiniDSH's full-screen terminal fixing the failing test: the commands, the refused edit, the read, the edit (+7 −1), "2 pass, 0 fail" | take-tui (the published package `minidsh@2.0.0` in WSL, deepseek-flash, 2026-11-24) | yes |
| The web turn | the same session in the web UI: the edit's Record ("wrote table.js · 641 B · sha256 3e895076e748"), the follow-up, the sandbox refusing the write ("Read-only file system"), the approval card, "Allowed once by you" | take-web | yes |
| The desktop turn | the official v2.0.0 installer's app on Windows: its window, its line, mid-turn with `SANDBOX_UNAVAILABLE` rows, the quit, the session kept | take-desk (`MiniDSH-Setup-x64.exe`, sha256 `2f2ee949…f04c2`, matching the release's SHA256SUMS) | yes |
| The approval names the exact command and mode | "Run `cd /code/tinytable && node --test > /code/reports/tests.txt 2>&1; echo "exit=$?"` under danger-full-access/none" | take-web; src/app/web/approval.js | yes |

## Simplifications
- **Retimed.** The takes are retimed to the beat: waits are shortened, the order and the content of
  every state are the take's own. The terminal turn ran about 16 s; the film shows it in 12.
- **Two sessions.** The terminal and the browser show ONE session (WSL). The desktop app shows its
  own session on Windows, a different task on the same project; the film never says or draws it as
  the same session.
- **Scope of "No edit before a read."** It is the editor tool's check (str_replace and insert),
  not the sandbox; shell writes are governed by the operating system's confinement.
- **Scope of the preset line.** It is the default preset (`workspace-write` with `ask`). An editor
  write outside the folder is refused without asking; a shell command that needs more asks. On
  Windows (no confinement) every shell command asks, as the desktop take shows. The sandbox limits
  writes, not reads or the network.
- **Scope of "One runtime dependency."** True of the npm package (`zod`). The desktop installers
  also ship Electron and a pinned Node.
- **The browser frame** around the web UI is the film's own generic frame (no real browser's
  chrome); the address `127.0.0.1:20555` is the take's real host.

## Not claimed
- Not "official", "native", "offline" or "private"; the model is a remote provider reached with the
  user's key.
- Not a "tiny codebase" (about 44,000 lines of TypeScript, CASE-STUDY.md:46).
- No read or network sandboxing; no shell confinement on Windows.
- No comparison with DeepSeek Harness, no "alternative to" it, no endorsement by DeepSeek.
- That the macOS or Linux desktop builds were used by hand (only Windows was).
- MiniDSH is "an experiment and a learning resource first" and "does not compete with DSH or with
  any product" (README.md:10): the publish texts say so.
