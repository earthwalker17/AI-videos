# Claude Code packaging — skills, CLAUDE.md, plugins, marketplaces

| | |
|---|---|
| Upstream | https://code.claude.com/docs/en/skills.md · /docs/en/memory.md · /docs/en/plugin-marketplaces.md · /docs/en/plugins/marketplace-reference.md · /docs/en/settings-reference.md |
| Pin | Accessed 2026-11-01 (docs unversioned). Related upstream examples: remotion-dev/claude-code-plugin `413c6d622c88045217b441b871d636920961b6a2`; remotion-dev/skills `30d4553ecd46fbc5212fd0ff006ae43af522158b`; lemo-opuscar `bebbbe1`. |
| Licence | Anthropic docs, proprietary: paraphrase and link |
| Accessed | 2026-11-01 |
| Stale after | 2026-12-01 (Claude Code ships often; re-check limits before relying on them). |

## What it is
How Claude Code finds and loads instructions, skills and plugins, and how third parties
(Remotion, HyperFrames, lemo-opuscar) package theirs.

## Why it matters here
The repo is built and used mostly by agents across many sessions. Where a skill lives
decides when it loads; a plugin source type decides whether users must clone 100 videos.

## Key facts
**Skills and memory** [V]
- Project skills live in `.claude/skills/<name>/SKILL.md`.
- Skills in a nested `<subdir>/.claude/skills/` load the first time Claude reads or edits a file in that subdirectory: a natural home for series- or engine-scoped workflows.
- The `paths` frontmatter limits when a skill auto-activates.
- `description` plus `when_to_use` is truncated at 1,536 characters.
- Subdirectory `CLAUDE.md` files load on demand; the guidance is to keep each under about 200 lines.
- `@import` paths containing spaces need backslash escapes (another reason for a space-free repo path).

**Plugins and marketplaces** [V]
- A marketplace plugin source of type `git-subdir` is one subdirectory of a git repository, fetched with a sparse checkout, pinnable by `ref`/`sha`: a plugin can ship from a folder of this monorepo without users cloning the videos.
- A repo's `.claude/settings.json` can declare `extraKnownMarketplaces` and `enabledPlugins`; they take effect only after the user accepts workspace trust.
- `.claude/settings.json` permission rules can deny reading secrets (e.g. `Read(./.env)`).

**Third-party packaging** [V]
- Remotion: plugin `remotion@remotion` from the `remotion-dev/claude-code-plugin` marketplace; `npx remotion skills add` instead runs `npx skills@1.7.0 add remotion-dev/skills --yes` into `.agents/skills` and creates a `.claude/skills` **symlink** (fragile on Windows, where git checks symlinks out as text unless enabled). Skills text has no licence: install, never copy.
- HyperFrames: plugin `hyperframes@hyperframes` (Apache-2.0); 7 skills.
- lemo-opuscar: root `.claude-plugin/marketplace.json` → `./plugin`; a thin SKILL.md runs a setup script that sparse-clones the library and installs dependency tiers; a separate orphan branch holds a self-contained edition.
- remotion-dev/skills layout: a router skill that loads sub-references on demand, techniques as `techniques/<name>/TECHNIQUE.md` with assets/references/scripts, a generated README.
- One repo duplicated identical skills into `.claude/`, `.cursor/` and `.opencode/`, which drifts; keep one canonical copy [V].

**What skills are worth** [S]: a 2026-10-11 third-party test found a no-skill baseline passing the same basic checks as 16 published video skills; skills pay off by encoding a look, a workflow or verification, not generic framework knowledge.

**Agent protocol from MAP** [V]: work in a worktree; allowed/forbidden command lists; a final report with branch, commits, files touched, gates run, renders, visual assessment, contract requests, known issues; a reviewer verdict schema (approve/changes with severity-ranked findings) and an adversarial visual-critic schema (pass/partial/fail per criterion with evidence).

## What we adopted / adapted (per the plan)
- Root `CLAUDE.md` is a short, stable router; sessions start from `docs/INDEX.md` and `docs/ROADMAP.md`.
- `.claude/settings.json` denies reading `.env`; `.claude/settings.local.json` and worktrees stay gitignored.
- Skills `make-video` and `render-verify` as thin routers to `aiv` and `docs/PRODUCTION.md`; an adversarial `frame-critic` agent with a verdict schema.
- Remotion's official skills documented as an opt-in plugin install, never vendored.
- A `plugin/` subfolder published through a `git-subdir` marketplace entry is reserved for later (after 5–10 videos prove which skills are reusable).
- Subagent rules: at most two heavy implementers, no git or dependency changes, main agent integrates and views every render.

## What we deliberately did NOT adopt, and why
- Committing third-party skills or a `.claude/skills` symlink: licence and Windows symlink problems.
- Duplicated per-agent instruction folders.
- Generic framework skills: the benchmark shows little gain; ours encode this repo's workflow and gates.
- Auto-enabling third-party plugins for everyone who clones: opt-in only.

## Gotchas
- A skill description over the cap is silently truncated: put the trigger words first.
- Nested skills don't load until a file in that folder is touched: don't put session-start rules there.
- Workspace trust gates marketplace settings: a fresh clone won't have them active until accepted.

## Not read
The full plugin.json / marketplace.json schema; hooks; skill `allowed-tools`; how `paths` globs match on Windows; settings precedence between user, project and local files.
