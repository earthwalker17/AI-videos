# A Halloween Gift

A one-minute storybook Halloween: Clawd, the Claude Code mascot, dressed as a witch, walks
through a moonlit pop-up book of graveyards and crooked gates to deliver a "gift" to the last
house still awake. Made entirely in code, picture and score.

**Series:** [Festival & Celebration](../../series/festivals/SERIES.md) · **Number:** 3 · **Engine:** remotion
▶ **Watch:** the YouTube link, once published.

## How it was made
In production. Picture: Remotion with React Three Fiber, a paper-theatre world lit like a
lightbox, actors animated on twos at 24 fps. Sound: an original score and sound effects
composed in TypeScript and rendered by the repository's audio stage. Numbers are recorded
here once the review cut exists.

## Reproduce it
```sh
pnpm aiv render halloween-gift --profile final
pnpm aiv post halloween-gift --profile final
pnpm aiv qa halloween-gift --profile final
```
A published video is rebuilt from its release tag `video/halloween-gift/v<N>`, not from `main`.

## Reusable
Listed in `video.json` `reusable` as parts prove themselves.

## Lessons
Written once the review cut exists. Verified lessons become
[knowledge cards](../../knowledge/README.md).

## Licence and trademarks
<!-- REUSE-IgnoreStart: third-party rights, not notices for this file -->
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film is
**not** offered under a reuse licence (`video.json` `license.film: none`): it is a fan parody
whose central character, Clawd, belongs to Anthropic. Claude, Claude Code and Clawd are
Anthropic's; this film is not affiliated with, sponsored or endorsed by Anthropic. The email
shown in it is fictional and refers to no real account or person.
<!-- REUSE-IgnoreEnd -->
