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
`pnpm aiv new <slug> --engine <web|remotion> [--series <id>]` creates
`videos/<slug>/` from the engine's template, copies the series defaults into
`video.json`, and allocates the next video `number` (leave out `--series` for a
standalone video). Then `pnpm aiv check --fix` adds it to the generated catalog and
index; deleting a slot needs the same. Write `BRIEF.md`:
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
- **Timing first.** A video with a score writes `src/cues.ts` (a `CueSheet`: length, leader,
  bar grid, cuts, hits, rests, silences, text and cards) before animating; picture and score
  both read it, so they cannot drift (ARCHITECTURE decision 22).
- **Sound.** The score lives in `audio/` (entry `audio/index.ts`, `defineScore` from
  `@aiv/pipeline/audio`); `video.json` mixes it as `{"source": "audio:<name>"}`. Build it with
  `aiv audio <slug>` (`--pin` records the sample files it reads in `audio/library.json`,
  `--verify` renders it twice and compares bytes), then post and qa as usual. An audio edit
  never re-renders the picture; post refuses tracks that went stale.
- Iterate on drafts: `aiv render <slug> --profile draft`, `aiv post` and `aiv qa`
  (same profile; all three default to `review`), then **look at the contact sheet and
  key frames** before changing anything else. Run `pnpm lint` after editing `src/`:
  the determinism rules are ESLint rules, and `aiv check` does not run them.
- **Lookdev stills.** `aiv still <slug> --frames 40,240 [--entry src/lookdev/<x>.entry.ts
  --composition <id>] [--ref <image>]` renders full-size stills without touching a render run,
  and with `--ref` a compare sheet (side by side, value maps, palettes, the value-grid and ΔE
  numbers). Get the look signed off on stills early, against a reference when there is one.
  `--check <profile>` compares a few mid-chunk frames' hashes with that profile's run.
- Run at least one adversarial critique and fix round: the `frame-critic` agent
  compares contact sheets against the brief, storyboard and style.
- **Colour check.** A new video starts with the template's test card on its first
  frames, and `qa.swatchFrames` names them, so QA verifies colour on every draft and on
  the review cut. Keep it through the review cut. For the final, remove the test-card
  frames and `qa.swatchFrames` together (QA then reports colour as not verified for that
  file): the review cut's QA report is the colour evidence, and CI checks the shared
  colour conversion on every commit. The engine template's README ("Start a video from
  it") lists what else the template leaves behind.
- **Languages.** `video.json` `languages` lists them (English first); `titles` holds the
  title per language (for example `zh-Hans`); `SCRIPT.md` has one section per language.

### 4. Review cut
`--profile review` (full resolution). `aiv qa` must pass. Look at `motion.png` and the strips
too, and play the `motion.watch` times at full speed (judder, flashes, pops, boil). The user watches the
whole cut; their notes go into the next production round or into approval.

### 5. Locked and final
No changes to the inputs once a video is `locked`: the final render is keyed to
them and refuses to resume if they change. Render `--profile final` (chunked and
resumable; long renders run unattended), post, qa. Prepare `publish/`:
`description.<lang>.md`, `chapters.md`, captions `captions/<lang>.srt` (for example
`captions/en.srt`, `captions/zh-Hans.srt`), the AI-use disclosure and the thumbnail.
Check `video.json` `license.film` against `CREDITS.md`: a film with class C or D material,
or any non-commercial or share-alike part, is not CC BY ([LICENSING](LICENSING.md)).

### 6. Release and publish
With the final approved and every input committed (release refuses a dirty tree):
1. `pnpm aiv release <slug>` checks the final QA reports, copies the delivery and the
   archive master to `out/<slug>/release/v<N>/` and writes the manifest
   `videos/<slug>/release/v<N>.json` (file hashes, versions, toolchain, loudness, QA).
2. Upload the delivery to YouTube. In `video.json` set `release.version`, `youtube.id`
   and `youtube.published`, record the final approval, and set `status: published`. In the
   video's `README.md`, replace the Watch placeholder with the link (and the thumbnail from
   `publish/`, linked to the video), and turn the Status section into the published state.
   `pnpm aiv check --fix`, then commit: `release(<slug>): v<N>`.
3. Tag that commit and publish the files (each ≤ 2 GiB), never marking a video release
   as the repository's latest release:
   ```sh
   git tag video/<slug>/v<N> && git push origin video/<slug>/v<N>
   gh release create video/<slug>/v<N> out/<slug>/release/v<N>/* --latest=false --title "<title> v<N>"
   pnpm aiv release verify <slug>
   ```
From here on the video is frozen: it is rebuilt from its tag, never edited to follow
upgrades, and `aiv render` refuses it at any other commit.

### Rebuild a frozen video
```sh
git worktree add ../rebuild-<slug> video/<slug>/v<N>
cd ../rebuild-<slug>
pnpm install --frozen-lockfile && pnpm aiv doctor --fix   # that tag's toolchain, browsers and sample libraries
pnpm aiv audio <slug>                                     # videos with a score
pnpm aiv render <slug> --profile final && pnpm aiv post <slug> --profile final && pnpm aiv qa <slug> --profile final
```
Large inputs listed in `media/manifest.json` are fetched from where the manifest says
they are kept. On the same host, the frames match the release's frame hashes; elsewhere,
compare with SSIM. Remove the worktree with `git worktree remove` when done.

## Quality bars (every video)
- **Hook:** the first five seconds give a reason to keep watching.
- **Readable text:** on-screen text stays at least `max(1.8 s, reading time + 0.6 s)`,
  sits inside the title-safe area, and is at least 1/30 of the frame height.
- **Rest:** at least one deliberate moment of quiet or stillness.
- **Sound:** -14 LUFS integrated (±1 LU), true peak ≤ -1 dBTP, no clipping; music ducks
  under narration; narration intelligible on laptop speakers. The intended silences and rests
  of the cue sheet are measured by QA; how it sounds is judged by a person who listened
  (an agent cannot), before the review approval.
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

Records of films made elsewhere (`reproducibility: metadata-only`, like the two earlier
films) need only `README.md` and `youtube.id` to be `published`: there is nothing here to
render or release.

## Working with agents
- Research agents (read-only) gather facts and references; they write back to
  `references/` and `FACTS.md`, citing sources.
- The `frame-critic` agent reviews renders adversarially against a written rubric.
- At most two heavy implementers at once (for example two chapters as separate
  components). They never run git or change dependencies; the main agent
  integrates their work, renders, and looks at every result itself.
- Agent worktrees start from the pushed `main`, not from local commits: name the commit their
  work must sit on (they can bring it in with read-only `git show`), or let them work in the
  main tree on folders nobody else edits. Integrate by diffing the worktree against that
  commit, then apply.

## Heavy work on a small machine
Renders run through the machine-wide lock, one heavy job at a time, in foreground
calls of about ten minutes: with `--budget-min 9`, `aiv render` stops with exit code 75
when the next chunk would not fit, and the same command continues where it left off
(without a budget it runs to the end). Draft renders
use half resolution; final renders can run for hours unattended.
