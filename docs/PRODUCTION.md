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
It is then `archived` with `release: null` and `youtube: null`. Its only gate is a written
(non-stub) `README.md`. By convention, the README says why the film was dropped and names the tag
that holds its source. A video that reached YouTube, or a metadata-only record, keeps the
`published` gates.

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
- **Brief design agents with what the user wants**, not only with what to avoid, and with the
  facts matrix. On #4 V1 both gaps showed:
  - designers told only to stay away from a genre's look drifted to a light palette the user had
    not asked for;
  - designers without the matrix drew the Router with no tool at all, while the film showed the
    prototype's two levels as built and that prototype's Router keeps a restricted shell.
- **Write the do-not-copy lists before designing.** List the source's own figures and the
  signatures of the genre and its creators. Check the treatments, the stills and the critic
  against both lists.
- **A remake** (a film dropped before publication and made again) reads its predecessor's
  retrospective first: the slot's `V1.md`. Its candidates are not variations of whatever the
  user dropped the film for (for #4 V1, its look and governing image). The old arc may be kept
  or changed, if a candidate argues why: the choice is the user's.

### 3. Production
- `SCRIPT.md`: narration and on-screen text, per language. Keep narration text
  (punctuated for speech) separate from subtitle text (formatted for reading).
- `STORYBOARD.md`: a shot table (id, time, picture, motion, text, sound, purpose).
- Keep SCRIPT.md to copy and intent, and STORYBOARD.md to shot intent. Per-frame fixes and session
  logs belong in commit messages. #4 V1's docs grew into build logs, including a 680-line README.
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
  Use the `--ref` numbers against the film's own references, such as a painting it adapts or its
  signed-off stills. Compare third-party films side by side by their qualities only: matching
  their numbers pulls a look toward imitation.
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
    crude to be something worth watching" (video #4, round 1).
  - **Benchmark against the user's references.** When the user names reference films, put the
    stills and motion tests beside them and judge by their qualities.
    - Take frames only from files the user supplies, or from a browser session the user consents
      to, watched as a viewer (`references/vibe-knowledge-style-2026-11.md`, Method). Never use
      download tools without the user's approval.
    - Keep the frames under `.cache/` and never commit them.
  - **A rejected look reopens the governing image**, not only its grammar and rendering.
    #4 V1 replaced its rejected transit-map grammar with a material-rich desk, but kept a
    node-and-link system diagram underneath. A context-free viewer still read it as "a handsome
    animated system diagram".
  - **Build lookdev in the film's own frame components**, so that the film draws the signed-off
    frames.
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
whole cut; their notes go into the next production round or into approval. Before asking for
that approval, put the cut beside the newest films the user names as the bar. A look signed off
at lookdev can fall behind them: #4 V1's review cut was approved and its final passed QA, and the
user still dropped it for looking worse than newer films on similar topics.

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
With the final approved and every input committed (release refuses a dirty tree). On #4 V1 the
user set the order: "Do not push or release until the film is published." Follow it unless the
user says otherwise:
- the user uploads the delivery first;
- then run `aiv release`, record `youtube.id` and tag;
- push only when the user asks.
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
   When main is pushed, push the tag with it (`git push origin video/<slug>/v<N>-archived`): the
   docs cite it.
2. Write down its lessons while the source and the renders still exist.
   - Production lessons go to the shared docs and knowledge cards.
   - Subject research stays in the slot.
   - Write a short retrospective, `V<N>.md`, in the slot.
   - Salvage anything the session caches alone hold, such as URLs and content hashes.
3. Delete its renders, stills and audio from `out/`, any mezzanine on another drive, and the
   session caches in `.cache/research/`. First copy the stills the frame-critic calibrates on to
   `.cache/`, unless the user wants those gone too.
4. To remake the film under the same slug, reset the slot in a second commit.
   - Remove the old `src/`, `audio/`, `assets/` and `publish/`, and shorten the documents to what
     the remake needs.
   - Reset `video.json`: set `status` and `approvals` for the new film, since approvals of the
     dropped film do not carry over; empty `reusable`; drop `audio` tracks that read the old
     score; review `languages` and `titles`.
   - When the remake reaches production, copy `templates/<engine>/src/` into the slot, set
     `engine`, `entry`, `composition` and `format` for its engine, and restore `qa.swatchFrames`
     to match the test card (the template README, "Start a video from it").

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
  - Still open: does 1/30 mean the font size or the cap height? #4 V1 read it as the font size,
    so its cap heights were smaller. Ask the user before a film's type scale is set.
  - **Every line names its subject.** A line on screen stands alone: the noun a pronoun points to
    left with the line before. On #4 V2 two first-time viewers could not say what "it" was in
    "most never reach it"; the line became "FEW REACH THE ROUTER."
- **Rest:** at least one deliberate moment of quiet or stillness.
- **Sound:** -14 LUFS integrated (±1 LU), true peak ≤ -1 dBTP, no clipping; music ducks
  under narration; narration intelligible on laptop speakers. The intended silences and rests
  of the cue sheet are measured by QA; how it sounds is judged by a person who listened
  (an agent cannot), before the review approval.
- **Picture:** BT.709 limited range, correctly tagged; no unintended black or frozen
  frames; no flicker from non-deterministic code.
- **Determinism:** on the same machine, re-rendering any frame gives identical pixels.
- **Facts:** every claim sourced; simplifications named.
  - **Recompute every on-screen number** from the source's own figures, including the direction
    of a percentage. "About 30% more decisions without it" is about 23% fewer with it, not 30%
    fewer. Two such inversions reached #4 V1's drafts.
  - **Name the baseline** of every comparison, and prefer the strongest one.
  - **Show no units the source cannot back.** For example, show no minutes when the source's
    clock is scaled or unstated.
  - **Pictures make claims too.** A part drawn as built, a link drawn before the line that
    explains it, or a tool drawn missing is checked like a sentence.
  - **A number beside a bar is read as that bar's value.** On #4 V2 a multiple set next to a
    baseline's band was taken by two cold readers for that band's own cost, when it was the ratio
    of the top band to it. Put a ratio in the headline, name each bar by what it is, and let the
    drawn lengths carry the comparison.
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
- **Whole-film critic rounds.** Run span critics, plus one viewer agent with no project context
  ("what is this frame telling you?"). Send every P0 and P1 finding to a verifier told to refute
  it: in #4 V1 about a fifth were downgraded or refuted. Brief the critics with the lists of what
  is known to be open and what has been accepted, so they do not prove those again. Write fixed
  choreography findings as tests on the frame state, so that they stay fixed.
- **Cold-read the fixed frames.** After a fix round, show single frames to a reader who has seen
  nothing of the project, not even the earlier cut, and ask only what each frame says. On #4 V2 a
  cold read of four frames found misreadings that reviewers who knew the film had passed: they
  read the intent into the picture. Use a new reader each time.
- **Audit the publish files too.** A description makes public claims: check each against
  `FACTS.md` (baselines named, built or proposed, what is and is not public yet) before upload.
- **Fix lanes.** One implementer per lane, on disjoint files, then a critic on that lane's renders,
  then a fixer. Findings in another lane's files are passed on to that lane, not fixed in place.
- **Session size.** Size each session to end with its own critic round and a durable handoff.
  Before a long workflow, check free memory and whether an operating-system reboot is pending.
  #4 V1 lost sessions to a reboot, a usage limit and low memory.
- **Line endings.** Agents on Windows can leave CRLF line endings, which changes the input hash
  against the commit's. Normalise to LF before rendering.
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

The call that renders the last chunk goes straight on into the join and hash, about 10 minutes
for a 3:44 film at 1080p. When only a few chunks are left, run it as one call with no time limit.
- **Disk.** The join needs about twice the mezzanine on disk: about 19 GB free for 6,720 frames at
  1080p.
- **A call killed after the join**, while the mezzanine is checked and hashed, leaves a complete but
  unverified `mezzanine.mkv`. A rerun joins again beside it, so delete it before rerunning, or the
  disk must hold both.
- **Post and QA at the final** take about 35 and 15 minutes. Give them calls with no time limit too.
  A final's QA writes two reports, `report.json` for the delivery and then `report-archive.json`
  for the archive master: read both before saying it passed (#4's archive failed a freeze check
  the delivery passed).
- **A job moved to the background can outlive its stop notice.** On the 8 GB host a long render
  or encode that an agent session had moved to the background kept running after the session
  reported it stopped. Before the next heavy job, check that the lock is free (`aiv doctor`; a
  heavy command exits 75 while it is held) instead of trusting the notice, and never start a
  second copy.
- **Before a release, clean up.** Audit what is about to be pushed (private paths, stale status
  lines, licences and credits), write the film's lessons into the shared docs, and prune local
  outputs that can be regenerated.
- **Session scratch** grows to many GB over a film. Prune old stills and scratch copies as you go.

`engines/remotion/ENGINE.md` and `engines/web/ENGINE.md` have the measured costs.
