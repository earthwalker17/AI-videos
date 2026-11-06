# Styles

A style is a look that several videos share: palette, type, motion and composition rules,
written down so a new video can follow them and a review can check them. One folder per
style, `styles/<id>/`:

| File | What |
|---|---|
| `STYLE.md` | The look in words: intent, palette, type, motion, composition, and the invariants a frame must keep. Start from [`_template/STYLE.md`](_template/STYLE.md). |
| `tokens.ts` (optional) | The same decisions as plain constants (colours, sizes, easing names) for frame code to import by relative path. Frame-code rules apply: lint and typecheck cover `styles/`. |
| small assets (optional) | A logo, a texture, a LUT: original or licensed for redistribution, at most 2 MiB each. |

## When to add one
By the rule of two: a style is created when a **second** video reuses a look, not before.
The first video keeps its look in its own `src/`. When the second one arrives, move the
shared part here and list the style id in the `styles` of every video that imports it. If the
first video is already published, copy the part from its tag instead: its own `src/` and
`video.json` stay as tagged. `aiv check`
fails on a `styles` entry without a `styles/<id>/STYLE.md`.

## Rules
- A style is pixels: its code, tokens and assets are part of every render's input hash, so
  editing them invalidates resumable runs of every video, which is intended. Prose
  (`STYLE.md`, this file) is not hashed.
- Published videos are frozen at their tag. Changing a style never edits them; a style that
  must change incompatibly gets a new id (`<id>-v2`). The old one may be deleted once only
  published videos use it: they are rebuilt from their tag.
- Fonts come from pinned npm packages (as Inter does in `@aiv/remotion-kit`), never from a
  CDN at render time.
- Prose is CC BY 4.0, code and tokens MIT, like the rest of the repository.
