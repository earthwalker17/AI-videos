# <Style name>

<One or two sentences: what this look is for and how it should feel. A new collaborator
should be able to tell from this paragraph whether their frame belongs to the style.>

- **id:** `<id>` (the folder name; videos list it in `video.json` `styles`)
- **Used by:** `<slug>`, `<slug>` (at least two; `catalog.json` lists them too)
- **Engines:** `<web | remotion | …>`

## Palette
| Role | Value (sRGB hex) | Notes |
|---|---|---|
| Background | `#000000` | |
| Text | `#ffffff` | Contrast against the background: at least 4.5:1. |
| Accent | `#000000` | |

Values are display sRGB. Code that lights or blends in linear light converts them once
(three.js `Color` does this for hex input).

## Type
Family (pinned package), weights, sizes as a fraction of frame height, line height, minimum
on-screen time per word for read-along text.

## Motion
Easing families and durations, how things enter and leave, what never moves (for example
the title baseline), camera rules.

## Composition
Safe areas (title-safe and action-safe margins), grid, where text may sit, what the frame's
focal point is.

## Invariants
Checkable statements a frame must keep, phrased so `frame-critic` or a person can verify
them on the contact sheet. For example:
- No text closer than 5 % of the frame height to any edge.
- At most one accent colour per frame.
- Background never brighter than code value 40.

## Tokens
If `tokens.ts` exists: what it exports, and which of the sections above it encodes.
