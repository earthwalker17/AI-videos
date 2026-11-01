# Licensing

This repository mixes code, prose, original media and third-party material. Each
kind has its own licence. The machine-readable version of this page is
[`REUSE.toml`](../REUSE.toml) (REUSE 3.3); `reuse lint` checks it in CI. The one
thing `REUSE.toml` cannot express is the extra MIT permission for code snippets
inside Markdown (below).

## The matrix

| What | Where | Licence |
|---|---|---|
| Code, configuration, schemas, CLI, CI, and the code of templates | `packages/`, `engines/`, `tools/`, `templates/` (code), `schemas/`, `.github/`, `.githooks/`, root config, all `*.json` metadata | [MIT](../LICENSE) |
| Prose: docs, knowledge cards, series and style guides, reference notes, template READMEs and stage documents, scripts, storyboards, captions, prompts, agent skills and agents | every `*.md`, `*.srt`, `*.vtt`; `prompts/` | [CC BY 4.0](../LICENSES/CC-BY-4.0.txt) |
| Code snippets inside Markdown files | anywhere | CC BY 4.0 with their file, and also MIT: the authors grant that extra permission so snippets can be pasted into code |
| Original media made for this repo (stills, thumbnails, posters, audio, textures, small renders) | any image, audio, video or 3D file (`REUSE.toml` lists the extensions) | CC BY 4.0 unless annotated otherwise |
| Third-party assets (fonts, samples, textures, models) | wherever they are used | their own licence, recorded next to the file and in `REUSE.toml` |
| Large or non-redistributable inputs | `videos/*/media/` (gitignored; `media/manifest.json` is committed) | their own licence, recorded in the manifest |
| Generated AI output | `videos/*/gen/` (gitignored; provenance sidecars are committed) | see [AI-generated material](#ai-generated-material) |
| Finished videos | YouTube / GitHub Releases, not in git | per video, stated in its `video.json` (`license`) |

**Attribution** for CC BY material: "*Title*" by earthwalker17, CC BY 4.0, with a
link to this repository or the video.

## Material quoted from others
Reference notes (`references/`) restate facts in our own words and quote only
short passages where wording matters, with attribution and an access date. Quoted
material remains the property of its owners and is **not** covered by this
repository's CC BY licence. Upstream documentation is linked, not copied.

## Code adapted from other projects
Adapted files keep their upstream copyright line (`SPDX-FileCopyrightText`) and an
`Adapted from <url>@<commit>` comment. [`NOTICE.md`](../NOTICE.md) lists every
upstream project, the commit used, its licence and what was adapted.

## Dependencies with their own terms
Dependencies are installed from npm and never redistributed here, but some carry
obligations for whoever renders with them:

- **Remotion** is source-available under the Remotion License, not an OSI open-source
  licence. Individuals and organisations of up to three people may use it for
  free, including commercially; larger companies need a Remotion company licence.
  If you fork this repository and render with the Remotion engine, check your own
  eligibility at <https://www.remotion.dev/license>. Remotion's documentation and
  agent skills are not copied into this repository.
- Fonts are OFL-licensed packages (for example Inter via `@fontsource-variable`).
  Proprietary system fonts are never committed or required.
- Animation libraries with restrictive licences (for example GSAP's "no charge"
  licence) are kept out of shared packages. If a single video uses one, its
  `README.md` says so.

## AI-generated material
Hosted model outputs are recorded per asset with a provenance sidecar (model,
version, prompt, date, terms, cost) and a **rights class**:

| Class | Meaning | In git? | Licence we apply |
|---|---|---|---|
| A | Redistributable without conditions (e.g. outputs of permissively licensed models, paid API outputs whose terms grant the user the rights) | small files only, copied into `assets/` with their sidecar | no copyright claimed; marked `LicenseRef-AI-Output` |
| B | Redistributable with conditions (attribution, AI disclosure) | as A | as A, plus the stated conditions |
| C | Usable in the finished video only (e.g. provider music or voices whose terms forbid redistribution, stock media) | never; the sidecar records its hash | none: not redistributed |
| D | Not allowed in published work for this channel (non-commercial weights, free tiers without commercial rights, terms we could not verify) | never | none |

Purely AI-generated material may not be protected by copyright at all, so we do
not claim CC BY on it. A finished video that contains class C or D material, or any
non-commercial or share-alike component, is not offered under CC BY.

## Prior films
The two films listed as metadata-only entries (`videos/journey-through-middle-earth`,
`videos/the-ai-stack`) are described here under CC BY 4.0, but the films
themselves are not part of this repository. *Journey Through Middle-Earth* is a
non-commercial fan work whose film, score and renders carry no reuse licence; see
its entry for the trademark and non-affiliation notice.

## Contributions
Contributions are accepted under the same licences (inbound = outbound): code
under MIT, prose and media under CC BY 4.0. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
