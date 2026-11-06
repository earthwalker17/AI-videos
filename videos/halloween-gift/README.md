# A Halloween Gift

[![A Halloween Gift: Clawd in a witch's hat beside a giant jack-o'-lantern in a moonlit graveyard. Click to watch the film on YouTube.](publish/thumbnail.jpg)](https://youtu.be/gL01vESC-fU)

A one-minute storybook Halloween: Clawd, the Claude Code mascot, dressed as a witch, walks
through a moonlit pop-up book of graveyards and crooked gates to deliver a "gift" to the last
house still awake. Made entirely in code, picture and score.

**Series:** [Festival & Celebration](../../series/festivals/SERIES.md) · **Number:** 3 · **Engine:** remotion
▶ **Watch:** [youtu.be/gL01vESC-fU](https://youtu.be/gL01vESC-fU) (published 2026-11-06)

## Status: published
Published on YouTube on 2026-11-06 ([youtu.be/gL01vESC-fU](https://youtu.be/gL01vESC-fU)) as
release v1 ([release/v1.json](release/v1.json)): the delivery `halloween-gift-v1.mp4` (1920x1080,
24 fps, 1440 frames, 60.0 s, H.264 and AAC, BT.709; sha256 `310993dba397…`) and an archive
master with PCM audio (sha256 `60d4466fd3e2…`), published as the assets of the GitHub release
`video/halloween-gift/v1`. The film is frozen at that tag and rebuilt only from it (see
Reproduce it).

- **Approvals** (`video.json` `approvals`): the treatment (candidate A, bilingual captions, the
  couplet; 2026-11-03); the 1080p review cut, the zh-Hans captions and description, and the
  hero view's closeness to the reference painting (2026-11-06); the final (2026-11-06). Decided
  with the user on the way: one continuous 3D storybook world instead of V1's cut-paper pages
  (2026-11-04); at the lookdev checkpoint, the V2 picture and the email's wording (2026-11-06).
- **Verified:** `aiv qa` passed on the delivery and the archive master (BT.709, -14.0 LUFS,
  true peak -2.3 dBTP, the intended silences silent, no judder or pop); on the review cut the
  colour swatches were within 2 levels and 12 of 12 mid-chunk frames matched fresh pages. The
  final is the approved review cut without its 12-frame test card
  ([ARCHITECTURE](../../docs/ARCHITECTURE.md) decision 24). Proof: the score is byte-identical
  from 0.5 s on; 1,426 of 1,440 frames are bit-identical; the other 14 differ invisibly where
  the two renders' chunks began (ten frames of the climb by at most 6 levels on at most 46
  pixels, four around the email card's first frames; [ROADMAP](../../docs/ROADMAP.md), known
  gaps). `aiv release verify` passed.
- **How the picture was judged:** adversarial critiques of 1080p stills against the references
  through six lenses (composition, light, models, story, email and rights, artefacts), two
  skeptics per finding: 47 findings confirmed in round 1, 50 in round 2, all fixed or triaged.
  Camera moves were planned by their measured screen flow
  ([knowledge card](../../knowledge/camera-moves-by-screen-flow.md)).
- **Known and accepted:** the hanging ghosts' lit folds stay plum rather than grey-lilac; the
  castle's buildings are simpler than the painting's; at the candy Clawd's hat hides 不封 for a
  few seconds (the couplet reads in full for six seconds before); the camera passes over the
  swung gate leaf for about a second on the lane.

The reference painting and the email screenshot the user supplied stay local (gitignored
`.cache/reference/`): never committed, never used as plates.

## How it was made
- **Picture (V2):** Remotion 4 with React Three Fiber (`src/`), one continuous 3D world
  matched to a painted reference. A storybook on a desk (`world/Book2.tsx`, `world/Desk2.tsx`)
  bursts open and the world grows out of its page on the score's pops (`look/Grows.tsx`): a
  terrain with a carved path (`world/Terrain.tsx`, laid out in `world/layout.ts`), gnarled trees,
  conifers, carved stones, iron gates, rocks, pumpkins, roofs and cobwebs built procedurally
  (`kit/`), one storybook-night material family (`look/materials.ts`), a sky drawn as a portal
  (`look/SkyPortal.tsx`) and a post chain with a painterly Kuwahara pass, moon rays, bloom, depth
  of field and a grade (`look/NightPost.tsx`). The camera makes one journey with no cut
  (`film/journey.ts`), the story beats and the actors' blocking are pure, tested functions of the
  frame (`film/beats.ts`, `film/blocking.ts`, on ones). Words are DOM over the 3D frame
  (`overlay/OverlayV2.tsx`); the DOM email card is laid over the 3D letter's face by projecting
  the letter's corners through the camera (`overlay/project.ts`), and both are drawn from one
  layout (`overlay/EmailCard.tsx`), so the hand-over does not jump. `src/lookdev/` holds the
  lookdev compositions used to judge each asset family against the reference (and the
  thumbnail candidates); the film itself builds its world from two of them. V1's cut-paper
  picture is in git history (before the V2 switch, commit a9e6f55).
- **Sound:** an original D-minor waltz and seeded synthesised foley in TypeScript (`audio/`),
  VSCO 2 CE samples (CC0) through an SFZ-subset sampler, mastered in the score; built by
  `aiv audio` against the shared cue sheet `src/cues.ts` ([ARCHITECTURE](../../docs/ARCHITECTURE.md)
  decisions 21 and 22); the footsteps are placed where the camera sees Clawd
  (`audio/timeline.ts` STEP_PLACES, held there by `src/film/sound.test.ts`).
- **Thumbnail:** not a film frame: the creator made it with ChatGPT's image generation
  (OpenAI), restaging the film's world; provenance in `publish/thumbnail.provenance.json`.
- **Numbers (reference laptop, V2):** 1440 frames at 24 fps (60.0 s; the review cut had a
  12-frame test card, 1452 frames).
  Draft 960x540: 0.6-1.3 s per frame, about 12 min for the film, 631 MB mezzanine. Review
  1920x1080: 0.9-1.9 s per frame, about 45 min, 2.3 GB mezzanine, a 94 MB delivery. A lookdev
  still: 15-45 s with a warm GPU program cache. Score: about 12 s to render, 65 s for
  `--verify`; -14.0 LUFS, true peak -2.3 dBTP on the delivery.

## Reproduce it
The film is frozen: rebuild it from its release tag, not from `main`.
```sh
git worktree add ../rebuild-halloween-gift video/halloween-gift/v1
cd ../rebuild-halloween-gift
pnpm install --frozen-lockfile && pnpm aiv doctor --fix   # that tag's toolchain, browser and the pinned VSCO 2 CE files (audio/library.json)
pnpm aiv audio halloween-gift
pnpm aiv render halloween-gift --profile final && pnpm aiv post halloween-gift --profile final && pnpm aiv qa halloween-gift --profile final
```
On the reference host the frames match the release's frame hashes; elsewhere compare with SSIM
([PRODUCTION](../../docs/PRODUCTION.md), Rebuild a frozen video).

## Reusable
Listed in `video.json` `reusable`: the sampler, the mastering chain and the foley of the score;
the picture's procedural kit (`src/kit/`: splines, noise fields, trees, conifers, stones, rocks,
iron, roofs, pumpkins, bats, cobwebs, the book), the storybook-night material family
(`src/look/materials.ts`) and the Kuwahara pass (`src/look/paint.ts`). This folder is frozen:
when a second film needs one of them, promote a copy into `packages/` (rule of two); the film
keeps its own.

## Lessons
- **A text-on-a-diamond trap.** A square hung as a diamond (mesh turned 45°) needs its
  character drawn turned the other way in the canvas; the two rotations added up and the 福 lay
  on its side until an adversarial frame review caught it. Check glyph orientation on a frame.
- **Light carries a palette swap, not the grade.** The cold snap on the seal is done by turning
  lights and emissives down, so Clawd's #D77757 stays on-model; neutral tone mapping keeps it
  from drifting toward pumpkin orange.
- **Crisp text over 3D:** draw the 3D card's face and the DOM layer from one layout table
  (`EMAIL` / `emailLayout` in `overlay/EmailCard.tsx`) and project the card's corners through
  the same camera pose each frame (`overlay/project.ts`); the crossfade then lands on the same
  pixels.
- **Per-chunk state is a determinism bug:** three computes a directional light's shadow box
  only when the shadow map is created, so every render chunk kept its first frame's moon shadow
  box; `aiv still --check` on mid-chunk frames caught it (39cf82f; the rule is now in
  `engines/remotion/ENGINE.md`).
- **Fonts with subsets:** list only the unicode-range files the film's strings need (computed
  from the package's `unicode.json`) and let the kit's loader prove coverage; canvases redraw
  when `ready` flips.
- **Scripted edits eat backslashes** (`\d`, `\n` in heredoc-fed scripts): a regex silently stopped
  matching and a string literal broke. Use the Edit tool for text with backslashes.
- **The pipeline caught real mistakes:** the heavy lock serialised the score's builds and the
  picture renders (exit 75, retried); post accepted the score only once it matched the
  picture's cue sheet; the score's adversarial review found an inaudible hit that the onset
  check had passed, and mallet samples an octave high.
- **Agents cannot hear:** the audio sheet, silence and clipping checks and hit timing made the
  score reviewable without ears; the user's listen was still the deciding check.

## Licence and trademarks
<!-- REUSE-IgnoreStart: third-party rights, not notices for this file -->
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film is
**not** offered under a reuse licence (`video.json` `license.film: none`): it is a fan parody
whose central character, Clawd, belongs to Anthropic. Claude, Claude Code and Clawd are
Anthropic's; this film is not affiliated with, sponsored or endorsed by Anthropic. The email
shown in it is fictional and refers to no real account or person. The thumbnail
(`publish/thumbnail.jpg`) is AI output: no copyright is claimed (`LicenseRef-AI-Output`).
<!-- REUSE-IgnoreEnd -->
