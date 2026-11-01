# Licensing tooling — REUSE 3.3, SPDX headers, secret scanning, licence traps

| | |
|---|---|
| Upstream | REUSE spec https://reuse.software/spec-3.3/ · reuse tool https://pypi.org/project/reuse/ · gitleaks https://github.com/gitleaks/gitleaks · pre-commit-hooks https://github.com/pre-commit/pre-commit-hooks · GitHub secret scanning patterns https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns |
| Pin | REUSE spec 3.3 (REUSE.toml version 1); reuse 6.3.0 on PyPI (latest GitHub release v6.2.0, 2025-10-27); gitleaks v8.30.1 (2026-03-21, HEAD `5f6ec56cfa6f8c67648d863582c7ae2f206d5c1c`); pre-commit-hooks v6.0.0; check-jsonschema 0.39.0; pre-commit 4.7.0 |
| Licence | REUSE spec CC BY-SA 4.0; reuse tool Apache-2.0 AND CC0-1.0 AND CC-BY-SA-4.0 AND GPL-3.0-or-later; gitleaks MIT; pre-commit-hooks MIT; GitHub docs CC BY 4.0 |
| Accessed | 2026-11-01 |
| Stale after | 2027-05-01 (gitleaks rules: whenever a new provider key is added to `.env.example`). |

## What it is
The tools and facts behind the repo's per-path licence matrix, provenance headers and
secret hygiene, plus a list of upstream licences that must never be mixed in.

## Why it matters here
The repo mixes MIT code, CC BY 4.0 prose and media, OFL fonts, third-party CC0/CC BY assets
and (later) AI output; it is public and agent-written, and calls paid APIs.

## Key facts
**REUSE 3.3** [V]
- A `REUSE.toml` (version 1) may sit in any directory and covers that directory and below; precedence values are `closest` (default), `aggregate` and `override`. It is mutually exclusive with the older `.reuse/dep5`.
- Licence texts live in `LICENSES/<SPDX-id>.txt`; files are labelled by SPDX headers or by REUSE.toml path globs.
- `reuse lint` checks that every file has copyright and licence information; the tool needs Python ≥ 3.10 (install as an isolated tool, e.g. `uvx reuse lint`).

**Provenance headers in this repo** (project rules, recorded here for lookup)
- Adapted from the user's MAP repo: an SPDX licence header (MIT) plus `// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/<path>`.
- Adapted from lemo-opuscar: additionally an SPDX copyright header naming LemoLab (2026) and an Adapted-from URL at `bebbbe1`.
- Apache-2.0 sources (e.g. video-shotcraft text, Wan2.2 prompts, HyperFrames code) require keeping their NOTICE/attribution if text or code is copied [V].

**gitleaks** [V]
- Pre-commit hook id `gitleaks` (language golang) runs `gitleaks git --pre-commit --redact --staged --verbose`.
- Default rules include OpenAI, GCP API keys, Hugging Face tokens, Alibaba access key ids, Anthropic and Cloudflare keys; they do **not** include ElevenLabs, DashScope `sk-` keys, Replicate `r8_` tokens or fal keys.
- Extend with a `.gitleaks.toml` using `[extend] useDefault = true` plus custom rules. Candidate patterns from the sweep, unconfirmed against real keys [U]: ElevenLabs `sk_[a-f0-9]{48}`, DashScope `sk-[a-f0-9]{32}`, Replicate `r8_[A-Za-z0-9]{37}`.
- GitHub secret scanning for public repos covers OpenAI, Hugging Face and Replicate (push-protected), but Google API keys are **not** push-protected: a local or CI scan is the only block [V].

**Other hooks** [V]: pre-commit-hooks `check-added-large-files --maxkb=N` (default 500 kB, `--enforce-all`) and `detect-private-key`; check-jsonschema validates JSON files against a schema at commit time.

**Fonts** [V]
- OFL-1.1 only; a modified or subset font that has a Reserved Font Name must be renamed (e.g. Cinzel Decorative reserves "Cinzel").
- `@fontsource/noto-sans-sc` 5.3.1 is OFL-1.1 (npm licence field checked); `@fontsource-variable/inter` 5.3.0 is listed as OFL in the sweep's tool table [S]. Windows system fonts (Microsoft YaHei, SimHei, Segoe UI) are proprietary: never commit them, never depend on them in renders.

**Licence traps seen in the research** (never copy code or text from these into this repo) [V]
| Upstream | Licence | Consequence |
|---|---|---|
| 3b1b/videos | CC BY-NC-SA 4.0 | Structure only |
| OpenMontage | AGPL-3.0 | Field ideas only |
| xiaoxiae/videos (Polylog) | GPL-3.0 | Conventions only |
| Theatre.js studio | AGPL-3.0-only | Skip |
| Etro | GPL-3.0 | Skip |
| Twick | npm says MIT; repo "Sustainable Use License" | Skip |
| Shadertoy code | CC BY-NC-SA 3.0 unless stated | Check each shader |
| ComfyUI | GPL-3.0 | Pattern only |
| pedalboard | GPL-3.0 | MAP replaced it with own DSP |
| espeak-ng (via espeakng-loader) | GPL-3.0 | Dependency only, not vendored |
| soxr | LGPL-2.1+ | Dependency only |
| edge-tts | LGPLv3 per one report / NOASSERTION per GitHub; no rights to output | Scratch audio only |
| GSAP | Proprietary "no charge", Prohibited Uses clause | Not in reusable components |
| Remotion | Source-available Remotion License | Depend, never vendor |
| remotion-dev/skills | No licence | Install, never copy |
| Repos with no LICENSE (e.g. PDoomVideo, Reducible, hold-my-tokens) | All rights reserved | Ideas only |

**Content licensing facts** [V unless marked]
- YouTube's CC BY 4.0 option is blocked by any Content ID claim; any BY-SA or NC component in a video conflicts with releasing it as CC BY 4.0.
- Purely AI-generated media likely has no US copyright (Thaler v. Perlmutter cert denied 2026-03-02) [S]; label it honestly rather than covering it with CC BY.
- Other projects' branding (sign-offs, end cards, gallery identity) is product identity, not reusable content, whatever the code licence says [U, our reading].

## What we adopted / adapted (per the plan)
- REUSE path-by-type matrix: MIT for code, templates, schemas, `.claude/`, `.github/`, prompt templates and code blocks in Markdown; CC BY 4.0 for prose (docs, knowledge, SERIES/STYLE, scripts, captions) and original media; `LicenseRef-AI-Output` for gen-AI output (later). `LICENSES/` already holds MIT and CC-BY-4.0 texts.
- `NOTICE.md` listing upstream sources; SPDX + Adapted-from headers on adapted files.
- `aiv check`: privacy scan (local paths, PII), key patterns, NOTICE/SPDX presence; `.githooks/pre-commit` runs `aiv check --staged`.
- CI (M4): `reuse lint` and a gitleaks scan; GitHub secret scanning and push protection enabled at publish.
- Prior-film entries are text and links only, carrying MAP's non-affiliation and trademark notice.

## What we deliberately did NOT adopt, and why
- The pre-commit framework as a hard dependency: the plan uses a plain `.githooks/` hook calling `aiv check`; gitleaks and reuse run in CI.
- DEP5: REUSE.toml supersedes it and the two cannot be combined.
- Any content from the trap table above.

## Gotchas
- `.env.*` is gitignored except `.env.example`; agents can still echo env vars into logs or sidecars: write sidecars from an allow-list of fields.
- A licence field in `package.json` (`(MIT AND CC-BY-4.0)`) does not replace per-file REUSE labels.

## Not read
REUSE snippet tags and `reuse annotate` details; gitleaks allowlist configuration; GitHub custom secret-scanning patterns (may need Advanced Security); SPDX expressions for mixed AI/human works.
