# A Halloween Gift

A one-minute storybook Halloween: Clawd, the Claude Code mascot, dressed as a witch, walks
through a moonlit pop-up book of graveyards and crooked gates to deliver a "gift" to the last
house still awake. Made entirely in code, picture and score.

**Series:** [Festival & Celebration](../../series/festivals/SERIES.md) · **Number:** 3 · **Engine:** remotion
▶ **Watch:** the YouTube link, once published.

## Status (2026-11-04): V2 picture in lookdev; the film still renders V1
`status` is `production`; the only approval recorded is the treatment's. The V1 draft (picture
and approved score) still renders from `src/index.ts`; the V2 picture is being built beside it
and is judged on lookdev stills (`aiv still`) against the user's reference images
(`Desktop/Halloween.png` and `Desktop/Email.JPG`, copied to the gitignored `.cache/reference/`,
never committed and never used as plates).

**Decided with the user (2026-11-04):** one continuous storybook world (no page turn, sliding
flats or hard cuts: cue edits `page-turn` → `gust`, `slide` → `mist-part`, the two cuts → marks;
the score rebuilt and verified); the email evokes the real suspension email with our own mark
(no Anthropic logo or wordmark, no verbatim text); one lookdev checkpoint with 1080p stills
beside the references before the full build. Story, pacing, gag, score and every Chinese string
stay as approved.

**Built (V2):** the world map `src/world/layout.ts` (one path, every landmark, the house frame:
the door spread at `DOOR_SCALE` 0.5 so the cottage fits the reference's composition, with Clawd
at the same scale all through), the storybook material, sky portal, night rig and post chain
(painterly Kuwahara stage measured to calm boil, soft moon rays), the hop gait and camera
paths, the V2 blocking (`film/blocking.ts`, on ones, tested against the score's footfalls), the
camera journey (`film/journey.ts`, previewed by the `Journey` lookdev composition), the email
card in DOM and canvas (pixel-matched). Asset families are built by bounded implementers on
their own lookdev entries (`src/lookdev/*.entry.ts`), four batches of two: ground and trees,
graveyard and buildings, props and creatures are in; characters and the book are building.
`src/lookdev/World.tsx` is the whole world as built (`WorldScene`: the giant jack-o'-lantern
and the pumpkin patch, cauldron, coffin, fireflies, the three hanging ghosts framing the moon,
the flocks) through the journey's cameras (`WorldShots`: hero, truck, shoo, climb, gates, lane,
door, door open). The story beats are pure, tested functions of the frame (`film/beats.ts`).
The world grows out of the page on the score's six pops (one vertex transform in the storybook
material, opted in by `look/Grows.tsx`). The hanging ghosts are camera obstacles (in the air,
the peek ghost's let-down only while it peeks), and the journey was re-routed round them (the
peek widens so ghost and Clawd share the frame; the gates hold is three-quarter from the right).
The hero's landmarks sit at the reference's screen positions (projected numerically): value
grid about 0.054 and palette distance 7–11 against the reference at 1080p (`aiv still --ref`);
the 13–18 s span and the peek-to-gates span measure no alternation (0.00–0.03) and no jumps.

**Assembled (2026-11-05):** all four asset batches are in, and the V2 film's picture plays end to
end as the lookdev composition `FilmV2` (`src/film/FilmV2.tsx`, words in
`src/overlay/OverlayV2.tsx`; `Main` still renders V1 until the checkpoint): the desk and its room,
the bats squeezing out of the crack, the world growing out of the page on the six pops, the one
camera journey, Clawd V2, the neighbour, the gift letter and the email, and a close with no cut
(the camera cranes up out of the book onto the desk as the cover swings down and slams). The
first frame of a call fell from 120-240 s to 15-45 s (bit-identical builder speed-ups, and the
engine keeps compiled GPU programs across calls: `engines/remotion/ENGINE.md`).

**Next:** fix the one determinism fault found (Chinese canvas text rasters differently from run
to run: the couplets, the cover's title, the email's 申诉 and 封号; a render's chunks could flicker),
put the witch back across the moon (drafted, held back while the fault is fixed), render the
checkpoint frames at 1080p and run the critique lenses against the references, fix, then the
checkpoint for the user (stills beside the references with the numbers, the closing strip, the
email's wording); after it, `WORDS.email` = the email's read path (the one remaining cue edit),
`FilmV2` into `Main`, drafts with motion QA, and the 1080p review cut. Open points: the castle
stands against a flat haze where the reference's stands dark against bright moonlit cloud banks
(`look/SkyPortal.tsx`, `world/Castle.tsx`); the ghosts' silhouettes and folds (a tied, ragged
sheet in the reference); the maroon foot band (`NightPost` `foot`, `film/beats.ts footAt`) eases
down in the door shots; the moon rays may flare in the door shots; walk 2's footstep pan should
recede (the camera now trails him).

## How it was made
- **Picture:** Remotion 4 with React Three Fiber (`src/`). A storybook on a desk opens into
  pop-up sets of seeded cut-paper cards drawn on canvas (`look/cutouts.ts`, `look/house.ts`),
  a printed sky shader as the backdrop (`look/Sky.tsx`), jack-o'-lanterns, puppets posed from a
  blocking table (`film/actors.ts`) on twos, a keyed camera (`film/timeline.ts`,
  `film/camera.ts`), and a post chain of bloom, depth of field and a depth split-tone grade
  with frame-driven grain (`look/Post.tsx`). Words are DOM over the 3D frame; the email's
  face is projected onto the 3D letter (`overlay/project.ts`) so the hand-over does not jump.
- **Sound:** an original D-minor waltz and seeded synthesised foley in TypeScript (`audio/`),
  VSCO 2 CE samples (CC0) through an SFZ-subset sampler, mastered in the score; built by
  `aiv audio` (decision 21) against the shared cue sheet (`src/cues.ts`, decision 22).
- **Numbers (reference laptop):** 1452 frames at 24 fps (60.5 s with the 12-frame leader).
  Draft 960x540: 0.25–0.36 s per frame, about 6 min for the film, 560 MB mezzanine. 1080p
  stills: 1.2–1.7 s per frame on the heaviest shots. Score: about 12 s to render in one
  process, 65 s for `--verify`, 393 MB peak memory; -14.0 LUFS, true peak -2.4 dBTP, LRA 9.6.

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
