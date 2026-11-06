# Festival & Celebration

> Visual pieces for Halloween, Christmas, Chinese New Year, Mid-Autumn and other
> traditional and seasonal celebrations, built on workflows that return every year.

Status: active · First video: [A Halloween Gift](../../videos/halloween-gift/README.md)

## Promise
A piece people want to share on the day: beautiful, warm or eerie as the festival
asks, culturally accurate, and fresh every year.

## Editorial principles
- **Reuse the workflow, not the film.** What returns each year is the toolkit
  (palette, motif library, particle and lighting rigs, music cues, title treatments).
  Each year's film has its own concept. Mass-produced, templated videos also run
  against YouTube's inauthentic-content monetization rules.
- **Cultural accuracy.** Symbols, colours, characters and customs are researched
  (zodiac animal of the year, lantern shapes, calligraphy, regional variants) and
  recorded in `FACTS.md`. Chinese text is checked by a fluent reader.
- **Respect over spectacle.** No stereotypes or caricatures; religious and
  traditional symbols are used in their proper sense.
- **Calendar discipline.** Production starts early enough to publish ahead of the
  date (and ahead of the search peak); the deadline lives in each video's `BRIEF.md`
  (under Shape).

## Craft hypotheses (to confirm with the next festival pieces)
- Engines: the web engine (particles, shaders, light) and Remotion (typography,
  greetings), both deterministic so a piece can be re-rendered for a new format. Remotion with
  React Three Fiber carried a whole continuous 3D world with DOM typography over it
  (*A Halloween Gift*); the web engine is untried in this series.
- A per-festival kit is promoted to `styles/<festival>/` once two videos use it.
- Formats: a 16:9 piece of 30 s–3 min plus a 9:16 Short (*A Halloween Gift*: 60 s, 16:9 at
  24 fps; its 9:16 Short left for later).
- Sound: festive or eerie scores composed in code, or properly licensed music
  recorded in the video's credits (*A Halloween Gift*: an original waltz and seeded foley in
  code, VSCO 2 CE samples, CC0).

## Policies
- Generative AI: allowed for backgrounds, textures and thumbnails with provenance (rights
  class A or B, the sidecar next to the file, disclosed in `publish/ai-disclosure.md`); never
  for culturally significant artefacts presented as authentic.
- Music: only sources whose licence allows publishing (and monetization) on YouTube.
- Satire of real companies, products or policies follows the parody rule in
  [LICENSING](../../docs/LICENSING.md#third-party-characters-brands-and-parody). No nationality
  or group is the butt of a joke; people stand for themselves (a silhouette, a costume),
  never drawn with ethnic features, and cultural details are used in their proper sense.

## Reusable resources
Indexed in `docs/INDEX.md` (Reusable parts of videos). From *A Halloween Gift*: the
SFZ-subset sampler, the mastering chain and the foley (`audio/`), the storybook-night materials
and the Kuwahara pass (`src/look/`), and the procedural kit (`src/kit/`: trees, conifers,
stones, rocks, iron, roofs, pumpkins, bats, cobwebs, a book). That film is frozen, so promote by
copying into `packages/` or `styles/` and leave its own copy as it is.
