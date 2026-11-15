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

A video can also be **dropped before publication** (see [Archive an unpublished video](#archive-an-unpublished-video)).
It is then `archived` with `release: null`. Its only gate is a written `README.md` that says
why it was dropped and where its source is tagged.

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
- **Lookdev is stills and motion** (decision 31). A look is signed off on both.
  - **Style frames.** When the direction is open, show the user style frames of the competing
    directions (the same beat, the same text) and let them choose from images.
  - **Motion tests.** Render a motion test of each signature relationship at full craft:
    `aiv still <slug> --frames a-b --span --encode --inner 3` gives 12 to 240 frames (up to 8 s) in one engine call,
    a lossless clip, a preview mp4, a contact sheet, motion QA and a chunk-start check of
    inner frames.
  - **Calibrated critic.** Run the `frame-critic` with its finished-craft criterion only after
    that criterion fails the looks the user has already rejected.
  - **Why.** A clean diagram can pass every technical check and still be "too simple and
    crude to be worth watching" (video #4, round 1).
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

**Captions.** On-screen words are drafted from the cue sheet. Draft them once the leader is
gone: their times are the delivery's, a leader included.
```sh
pnpm aiv captions <slug> --cues '<ids or globs>' [--lang en,zh-Hans]   # writes, then lints
pnpm aiv captions <slug> --lint                                         # lints what is there
```
- **Choose the cues** a viewer should get as captions: the narration, the title and end cards.
  Leave out in-world labels that overlap them; overlapping cues stack or the newest wins. A cue
  that newer ones hide the whole time fails the draft, named: leave one of the two out.
- **Read every draft** against the picture. Fix a wording problem in `src/cues.ts`, never only
  in the file. Edit line breaks by hand if needed; `--lint` checks them.
- **Spoken narration** is captioned from its subtitle text in `SCRIPT.md` instead (stage 3):
  the generator only knows on-screen words.
- **The linter's limits** are in `references/subtitles.md`. `aiv check` fails on a lint error in
  any unfrozen video's caption files.

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

### Archive an unpublished video
When the user drops a film before publishing it (for example, to remake it), keep its source at a tag
instead of keeping it in the tree:
1. Set `status: archived` and a `next` that says why. Put the same note at the top of its README.
   Run `pnpm aiv check --fix`, which adds the video to `catalog.json` `frozen`. Commit, then tag
   that commit `video/<slug>/v<N>-archived`. The tag stays local until the user asks for a push.
2. Delete its renders, stills and audio from `out/` (and any mezzanine on another drive).
3. Write down its lessons before the source leaves the tree: production lessons go to the shared
   docs and knowledge cards, and subject research stays in the slot.
4. To remake the film under the same slug, reset the slot in a second commit: remove the old `src/`,
   `audio/`, `assets/` and `publish/`, and shorten the documents to what the remake needs. Set
   `status` and `approvals` for the new film, since approvals of the dropped film do not carry over.

A dropped film is rebuilt like a frozen one, from a worktree at its `-archived` tag.

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
- **Readable text:** on-screen text meant to be read stays at least
  `max(1.8 s, reading time + 0.6 s)`, sits inside the title-safe area, and is at least 1/30 of
  the frame height. Print used only as texture may be smaller, down to 18 px at 1080p: an ID
  on a card or a line on a page, never anything needed to follow the film. The user decided
  this on 2026-11-09, for video #4.
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
