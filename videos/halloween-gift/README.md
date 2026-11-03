# A Halloween Gift

A one-minute storybook Halloween: Clawd, the Claude Code mascot, dressed as a witch, walks
through a moonlit pop-up book of graveyards and crooked gates to deliver a "gift" to the last
house still awake. Made entirely in code, picture and score.

**Series:** [Festival & Celebration](../../series/festivals/SERIES.md) · **Number:** 3 · **Engine:** remotion
▶ **Watch:** the YouTube link, once published.

## Status (2026-11-03): V1 draft done; V2 polish of the picture next
The whole film exists as a draft, picture and score, built through the shared pipeline
(`aiv render` → `aiv audio` → `aiv post` → `aiv qa` all green at draft). `status` is
`production`; the only approval recorded is the treatment's. No review approval.

**The user's checkpoint verdict** (watched the draft with sound and 1080p stills):
- **Keep:** the story, the pacing and the gag (the treatment as built, the cue sheet's timing).
- **Keep:** the score and sound design, "good as is".
- **Keep:** every Chinese string, checked by the user as fluent reader (`FACTS.md`).
- **Rework:** the picture "looks a bit too rough" for the series opener and "may need a
  bigger rework". The user will give the specific changes in the next session's brief.

**Start of the next session (V2 polish):** read this section, `video.json`, `STORYBOARD.md`
and the user's brief. The timing in `src/cues.ts` and the score in `audio/` are approved in
substance; changing a cue frame makes `aiv audio` rebuild (seconds) and post refuses the old
track until it does. Footsteps follow the walks copied into `audio/timeline.ts` (`WALKS`): if
Clawd's blocking in `src/film/actors.ts` changes, update `WALKS` too. Then iterate on drafts,
run a `frame-critic` round, and render the 1080p review cut (`--profile review --budget-min 9`,
about 1.2–1.7 s per frame on the heaviest shots, so 30–40 min in several calls).

**Known weaknesses of the V1 picture** (the agent's own list, for the V2 brief to confirm or
replace; the 1080p stills of the checkpoint are in the gitignored `out/halloween-gift/checkpoint/`):
- Models are primitive: Clawd is plain boxes (no papercraft folds or texture), the neighbour
  a lathe sheet, the hanging ghosts lathes, the house front a flat card; props (cauldron,
  lanterns, bats) are greybox-simple.
- The paper-theatre look is only half there: cards have no thickness, edge colour or layered
  depth; the ground prints are flat; fog is thin; the lightbox glow reads mostly in the sky.
- Light is dark and flat in the door spread; Clawd's face is mostly hidden during the gag.
- The first frame-critic round's motion notes were fixed broadly (eased turns, slower pops,
  the page turn), but the film was not re-critiqued after the fixes.
- Delivery true peak was exactly -1.0 dBTP at draft (AAC 192k adds about 1.5 dB over the
  -2.5 dBTP master); check at the review profile (AAC 320k) before trusting it.

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
