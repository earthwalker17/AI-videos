# A Halloween Gift

A one-minute storybook Halloween: Clawd, the Claude Code mascot, dressed as a witch, walks
through a moonlit pop-up book of graveyards and crooked gates to deliver a "gift" to the last
house still awake. Made entirely in code, picture and score.

**Series:** [Festival & Celebration](../../series/festivals/SERIES.md) · **Number:** 3 · **Engine:** remotion
▶ **Watch:** the YouTube link, once published.

## Status (2026-11-06): locked; the final is rendered and proven; awaiting the user's final approval
`status` is `locked`: the user approved the 1080p review cut on 2026-11-06 (recorded in
`video.json` `approvals`). `Main` renders the V2 picture (`src/film/FilmV2.tsx`); for the final
the test-card leader is removed (decision 24, `LEADER_FRAMES` 0), so the film is 1440 frames,
60.0 s. The user's reference images (`Desktop/Halloween.png`, `Desktop/Email.JPG`) are copied to
the gitignored `.cache/reference/`, never committed and never used as plates.

**The final** (`aiv render/post/qa --profile final`): the delivery `out/halloween-gift/post/final/
halloween-gift.mp4` (93.6 MB, H.264 High, BT.709) and the archive master (382 MB, PCM audio);
`aiv qa` passed on both (1440 frames, -14.0 LUFS, true peak -2.3 dBTP, the intended silences
silent, no judder or pop). **The proof against the approved review cut** (decision 24): the
score is byte-identical to the review's from 0.5 s on; 1,426 of the 1,440 frames are
bit-identical to the review's shifted by 12; the other 14 differ only where the two renders'
chunks began at different frames, invisibly: ten frames of the climb (438-456) by at most 6
levels on at most 46 pixels, three in the email overlay (the card's per-frame grain on 948-949,
the tab's shadow on 960: a page's first frame composites DOM canvases differently, see
docs/ROADMAP.md's known gaps) and one (961) by 2 levels.

**The review cut** (commit e3d4cba): 1452 frames with the leader; `aiv qa` passed (BT.709,
-14.0 LUFS, true peak -2.3 dBTP, swatches within 2 levels); `aiv still --check review`: 12 of 12
mid-chunk frames match on fresh pages after a determinism fix (39cf82f: the moon's shadow box).

**Decided with the user (2026-11-04):** one continuous storybook world (no page turn, sliding
flats or hard cuts); the email evokes the real suspension email with our own mark; one lookdev
checkpoint before the full build. Story, pacing, gag, score and every Chinese string stay as
approved.

**Decided with the user (2026-11-06), at the lookdev checkpoint** (16 film frames at 1080p and
the hero beside the painting, `out/halloween-gift/checkpoint-v2/`): the V2 picture's direction
approved for the full build; the new email wording kept ("Your Claude account has been
buried.", signed "The Graveyard Shift"); after fix round 2 the next stop is the 1080p review
cut, where the user watches the whole film and listens to the score.

**How the picture was judged:** adversarial critiques of 1080p stills against the references,
six lenses (composition, light, models, story, email and rights, artefacts) with two skeptics
per finding: round 1 confirmed 47 findings, round 2 confirmed 50 (all fixed or triaged in two
fix rounds of bounded implementers plus the integrator's staging). Camera moves are planned by
their measured screen flow before rendering (`knowledge/camera-moves-by-screen-flow.md`).

**Done since the checkpoint:** the integrated fix round 1 (a9e6f55); V2 into `Main` (ba82a08);
footsteps placed where the camera sees Clawd (eea4a5a; `audio/timeline.ts` STEP_PLACES is
measured through the camera, `src/film/sound.test.ts` holds it there); the end card holds to the
last frame (7ff0742); staging round 2 (3c7670c: the peek, the crane out, the end card's framing,
the lane, the candy, the witch inside the hero hold, the hero's fence and gateway); the V2
credits and `publish/` (captions per language, descriptions, the AI-use note; 6c2ee21);
thumbnail candidates (`lookdev/Thumbnail.tsx`). A full draft render passed `aiv qa` and the
chunk-independence check (12 of 12 mid-chunk frames MATCH on fresh pages).

**Fix round 2 (done):** the look (no fog flood or pump in the crane out, a plum cottage, a storm
sky and wider moon clearing, tailed sky ghosts, edge anti-aliasing, cleaner grain), the world
(root mass, cauldron, a floating castle, pumpkin rind, stones, track), the characters (the peek
reads, three ghosts round the moon, Clawd lit by the scene, the cottage's stone, lanterns and
slates, the grass), the book (crack light and lit bats, foil, a printed endpaper, paper page
edges) and the email card (pale page, spacing, the mark, the bat's snatch); the integrator's
staging (above) and lane lanterns. A determinism fault was found and fixed on the way: the
moon's shadow box stayed at each chunk's first frame (39cf82f; the rule is now in
`engines/remotion/ENGINE.md`).

**Known and accepted:** the hanging ghosts' lit folds stay plum rather than grey-lilac; the
castle's buildings are simpler than the painting's; at the candy Clawd's hat hides 不封 for a
few seconds (the couplet reads in full for six seconds before); the camera passes over the
swung gate leaf for about a second on the lane; across a chunk start a few dark pixels can
differ by one level (GPU rounding, invisible).

**Next:** the user's final approval; `aiv release halloween-gift` from the clean tree (manifest
`release/v1.json`); the thumbnail the user supplies (a ChatGPT-generated image: record it in
`publish/` with its provenance and update `publish/ai-disclosure.md`); the user uploads to
YouTube; then `youtube.id`, `release.version`, the final approval in `video.json`, `status:
published`, the tag `video/halloween-gift/v1` and the GitHub release (pushed when the user asks).

**Open for the user:** the hero view closely follows the reference painting's composition and
palette (the painting's author and licence are unknown: CREDITS.md lists it as reference only);
whether YouTube's AI-music note applies to a score written as code (`publish/ai-disclosure.md`).

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
  (`overlay/OverlayV2.tsx`); the email's face is projected onto the 3D letter
  (`overlay/project.ts`) so the hand-over does not jump. V1's cut-paper picture is in git history
  (before the V2 switch, commit a9e6f55).
- **Sound:** an original D-minor waltz and seeded synthesised foley in TypeScript (`audio/`),
  VSCO 2 CE samples (CC0) through an SFZ-subset sampler, mastered in the score; built by
  `aiv audio` (decision 21) against the shared cue sheet (`src/cues.ts`, decision 22).
- **Numbers (reference laptop, V2):** 1452 frames at 24 fps (60.5 s with the 12-frame leader).
  Draft 960x540: 0.6-1.3 s per frame, about 12 min for the film, 631 MB mezzanine. Review
  1920x1080: 0.9-1.9 s per frame, about 45 min, 2.3 GB mezzanine, a 94 MB delivery. A lookdev
  still: 15-45 s with a warm GPU program cache. Score: about 12 s to render, 65 s for
  `--verify`; -14.0 LUFS, true peak -2.3 dBTP on the delivery.

## Reproduce it
```sh
pnpm aiv doctor --fix               # the pinned VSCO 2 CE files (audio/library.json)
pnpm aiv audio halloween-gift       # the score
pnpm aiv render halloween-gift --profile final
pnpm aiv post halloween-gift --profile final
pnpm aiv qa halloween-gift --profile final
```
A published video is rebuilt from its release tag `video/halloween-gift/v<N>`, not from `main`.

## Reusable
Listed in `video.json` `reusable`: the sampler, the mastering chain and the foley of the score;
the sky shader, the cut-paper silhouettes and the jack-o'-lantern of the picture. Promote them
when a second film needs them (rule of two).

## Lessons
- **A text-on-a-diamond trap.** A square hung as a diamond (mesh turned 45°) needs its
  character drawn turned the other way in the canvas; the two rotations added up and the 福 lay
  on its side until an adversarial frame review caught it. Check glyph orientation on a frame.
- **Light carries a palette swap, not the grade.** The cold snap on the seal is done by turning
  lights and emissives down, so Clawd's #D77757 stays on-model; neutral tone mapping keeps it
  from drifting toward pumpkin orange.
- **Crisp text over 3D:** draw the 3D card's face and the DOM layer from one layout table
  (`FACE_B` in `world/Letter.tsx`) and project the card's corners each frame; the crossfade then
  lands on the same pixels.
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
shown in it is fictional and refers to no real account or person.
<!-- REUSE-IgnoreEnd -->
