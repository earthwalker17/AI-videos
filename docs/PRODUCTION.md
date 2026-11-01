# Production workflow

How a video goes from idea to published, who decides at each gate, and the quality
bars every video must meet. Series guides (`series/<id>/SERIES.md`) add their own
rules on top; they never relax these.

## Lifecycle

`video.json` `status` moves forward through these stages. `aiv check` enforces the
artifacts each stage requires (see [Gates](#gates)).

| Status | Meaning | Leaves the stage when |
|---|---|---|
| `idea` | The slot exists (`aiv new`). | A brief is written. |
| `brief` | `BRIEF.md` says who it is for, the one-sentence promise, constraints and risks. | Three treatments are written. |
| `treatment` | `TREATMENT.md` has three structurally different candidates and the chosen one. | **The user approves the treatment.** |
| `production` | Script, storyboard, facts, code and assets are being built and iterated on draft renders. | A review cut passes `aiv qa`. |
| `review` | The full 1080p review cut exists. | **The user has watched it and approves.** |
| `locked` | Picture and sound are frozen. The final render, captions and publish files are produced. | **The user approves the final.** |
| `published` | Released (`aiv release`), tagged `video/<slug>/v<N>`, uploaded. The video is now frozen. | (archival only) |
| `archived` | Kept for the record; not maintained. | — |

Human approvals are recorded in `video.json` `approvals[]` (gate, date, note).
An agent never records an approval the user did not give.

## Stage by stage

### 1. Idea → brief
`pnpm aiv new <slug> --series <id> --engine <web|remotion>` creates
`videos/<slug>/` from the engine's template, copies the series defaults into
`video.json`, and allocates the next video `number`. Write `BRIEF.md`:
audience, promise, length and formats, deadline (festivals), references, risks
(facts, rights, technical).

### 2. Treatment
`TREATMENT.md` holds **three structurally different candidates**: a different arc,
governing image or point of view, not three variations of one idea. Write them
before looking at earlier videos or templates, so a new video does not quietly
clone an old one. For each: the arc in 5–8 beats, the central image system, the
sound idea, what could go wrong. Then choose one and say why. Stop for the user's
approval.

### 3. Production
- `SCRIPT.md`: narration and on-screen text, per language. Keep narration text
  (punctuated for speech) separate from subtitle text (formatted for reading).
- `STORYBOARD.md`: a shot table (id, time, picture, motion, text, sound, purpose).
- `FACTS.md` + `sources.jsonl` for every claim, number, date and attribution
  (required for factual series).
- Build in `src/` with the shared packages; small assets in `assets/` with their
  provenance; anything reusable you discover is listed in `video.json` `reusable`.
- Iterate on drafts: `aiv render <slug> --profile draft`, `aiv post`, `aiv qa`, then
  **look at the contact sheet and key frames** before changing anything else.
- Run at least one adversarial critique and fix round: the `frame-critic` agent
  compares contact sheets against the brief, storyboard and style.

### 4. Review cut
`--profile review` (full resolution). `aiv qa` must pass. The user watches the
whole cut; their notes go into the next production round or into approval.

### 5. Locked and final
No changes to the inputs once a video is `locked`: the final render is keyed to
them and refuses to resume if they change. Render `--profile final` (chunked and
resumable; long renders run unattended), post, qa. Prepare `publish/`:
description, chapters, captions per language, AI-use disclosure, thumbnail.

### 6. Release and publish
`aiv release <slug>` checks the final QA report, writes the release manifest
(`videos/<slug>/release/v<N>.json`: file hashes, versions, toolchain, loudness, QA
summary) and the files go to the GitHub release `video/<slug>/v<N>` (each file
≤ 2 GiB). Upload to YouTube, record the YouTube id and date in `video.json`, and set
`status: published`. From here on the video is frozen: it is rebuilt from its tag,
never edited to follow upgrades.

## Quality bars (every video)
- **Hook:** the first five seconds give a reason to keep watching.
- **Readable text:** on-screen text stays at least `max(1.8 s, reading time + 0.6 s)`,
  sits inside the title-safe area, and is at least 1/30 of the frame height.
- **Rest:** at least one deliberate moment of quiet or stillness.
- **Sound:** -14 LUFS integrated (±1 LU), true peak ≤ -1 dBTP; music ducks under
  narration; narration intelligible on laptop speakers.
- **Picture:** BT.709 limited range, correctly tagged; no unintended black or frozen
  frames; no flicker from non-deterministic code.
- **Determinism:** on the same machine, re-rendering any frame gives identical pixels.
- **Facts:** every claim sourced; simplifications named.
- **Rights:** every asset has a known licence or a rights class; credits complete.
- **Verified, not assumed:** QA green *and* the frames and the full cut were
  actually looked at. Reports say what was checked and what was not.

## Gates
<!-- aiv:generated gates -->
| Status | Requires, on top of every earlier status |
|---|---|
| `idea` | `video.json`, `README.md` |
| `brief` | `BRIEF.md` written; `README.md` written |
| `treatment` | `TREATMENT.md` written (three candidates and the choice) |
| `production` | the **treatment approval** |
| `review` | `SCRIPT.md` and `STORYBOARD.md` written; `FACTS.md` written and `sources.jsonl` non-empty (series with `factsRequired`); the entry file exists |
| `locked` | the **review approval**; `CREDITS.md` written |
| `published` | the **final approval**; `release.version` with its manifest `release/v<N>.json`; `youtube.id` |
<!-- /aiv:generated -->

## Working with agents
- Research agents (read-only) gather facts and references; they write back to
  `references/` and `FACTS.md`, citing sources.
- The `frame-critic` agent reviews renders adversarially against a written rubric.
- At most two heavy implementers at once (for example two chapters as separate
  components). They never run git or change dependencies; the main agent
  integrates their work, renders, and looks at every result itself.

## Heavy work on a small machine
Renders run through the machine-wide lock, one heavy job at a time, in foreground
calls of about ten minutes: `aiv render` stops with exit code 75 when its time
budget is spent, and the same command continues where it left off. Draft renders
use half resolution; final renders can run for hours unattended.
