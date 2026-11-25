# Product & Launch

> Polished code-generated motion graphics: product demos, cinematic launch films,
> UI and product animation.

Status: active · First video: #5 *MiniDSH 2.0: One Runtime, Every Surface* (published
2026-11-24, [README](../../videos/minidsh-launch/README.md))

## Promise
A launch piece that feels like a premium studio made it, and is fully reproducible
from code: change a line of copy or a colour and re-render every format in minutes.

## Editorial principles
- **Product truth.** UI on screen is the real product or is clearly stylized; no
  features that do not exist. Specs and numbers are sourced.
- **Typography leads.** Hierarchy, rhythm and spacing are the main design tools;
  effects support them.
- **Cut to the music.** Edits and motion land on the beat grid of the score.
- **One message per beat;** an end card states the one thing to remember.
- **Every format from one source.** 16:9, 9:16 and 1:1 come from the same
  compositions with layout rules, not from re-editing.

## Craft
What #5 confirmed:
- **Real UI as stills.** Record the product live and stage stills captured at three times the
  pixel density in the web engine (`@aiv/web-kit`'s image mark), one element per readable shot
  ([knowledge card](../../knowledge/real-ui-in-a-film.md)).
- **Format.** 84 s, 16:9 at 60 fps, a score on a 120 bpm grid, cuts on bars.

Still open:
- Remotion for layout-driven UI animation (#5 needed none).
- Brand tokens (colour, type, spacing, motion curves) live in a style (`styles/<brand>/`) once a
  brand is used twice.
- Multiple aspect ratios from one source (#5 was 16:9 only).

## Policies
- Third-party brands, logos and trademarks appear only with permission or under a
  clear editorial use; the clearance is recorded in the video's `CREDITS.md`.
- Paid or sponsored work is marked as such, on YouTube and in the video's `CREDITS.md`.
- Generative AI: allowed for backgrounds and abstract plates; never to fabricate
  product screenshots or results. One exception so far: #5's thumbnail, which the creator made
  with ChatGPT from the film's real stills. The model redrew the UI slightly and the creator
  accepted it; the mark was replaced with the real one, and the AI-use note says so.

## Reusable resources
Indexed in `docs/INDEX.md` once videos in this series declare `reusable` items.
