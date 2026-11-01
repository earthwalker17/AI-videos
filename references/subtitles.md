# Subtitles — EN / zh-Hans limits, and narration text vs subtitle text

| | |
|---|---|
| Upstream | Netflix Simplified Chinese Timed Text Style Guide https://partnerhelp.netflixstudios.com/hc/en-us/articles/215986007 · Netflix English (USA) Timed Text Style Guide https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 · YouTube caption formats https://support.google.com/youtube/answer/2734698 |
| Pin | zh-Hans guide change log dated 2025-07-04; en-US guide change log dated 2025-12-19; accessed 2026-11-01. Article IDs are as recorded by the research sweep: confirm the page title when re-reading. |
| Licence | Netflix guides proprietary (facts and numbers only); YouTube help proprietary (paraphrase) |
| Accessed | 2026-11-01 |
| Stale after | 2027-11-01, or when either guide's change log moves. |

## What it is
Primary-source numeric limits for subtitle text in the two languages this repo targets
(English first, Chinese-ready), plus the rules from lemo-opuscar for on-screen text.

## Why it matters here
Captions are per language in each video's `publish/` folder. Reading-speed limits differ
by language and from on-screen text rules, and the Chinese style conflicts with the
punctuation a TTS engine needs.

## Key facts
**Netflix zh-Hans** [V]
- At most 16 characters per line.
- Adult reading speed at most 9 characters per second.
- No commas or periods: a pause is shown as a single space. Question marks, exclamation marks and colons are full-width (？！：), and so are quotation marks (which glyph pair the guide prescribes was not recorded).
- SimHei is named as the placeholder font.

**Netflix en-US** [V]
- At most 42 characters per line, at most 2 lines.
- Adult reading speed at most 20 characters per second.

**YouTube** [V]: SRT and SBV are basic (plain UTF-8, no styling); WebVTT supports positioning. Captions are uploaded per language.

**On-screen text, not subtitles** (lemo-opuscar) [V]
- readcheck: each on-screen text must stay fully in frame and unchanged for ≥ max(1.5, CJK chars / 4.5 + other chars / 15 + 1.5) s.
- DIRECTOR rule for burned-in subtitles: hold ≥ max(1.8 s, spoken duration + 0.6 s).
- These are different from the Netflix reading-speed limits; they need a separate check.

**Narration vs subtitle text** [V as observed practice; U as our design]
- lemo-opuscar's TTS contract separates `say` (spoken form) from `text` (displayed form).
- ASR pitfalls: homophones and number formats. Spell numbers out for TTS, use digits in subtitles; an `asr` override field handles deliberate differences. Under speech, music should give up the ~1.2–5 kHz band or Whisper mishears the full mix.
- Aligning captions to the script text (not raw ASR) keeps product names intact (e.g. "Remotion" heard as "remote").
- If one text file feeds TTS, ASR checking and Chinese subtitles, either narration loses prosody cues (no commas) or subtitles break the style guide.

## What we adopted / adapted (per the plan)
- Languages per video in `video.json`; captions per language under `publish/` (English first, zh-Hans when added).
- Narration text (punctuated, spoken form, numbers spelled out) is kept separate from subtitle text per language (Netflix-style spacing for zh-Hans, digits).
- A subtitle linter with per-language profiles (line length, line count, characters per second, punctuation transform) next to an on-screen readcheck: planned, not yet built.

## What we deliberately did NOT adopt, and why
- One shared text file for TTS, ASR and subtitles: the zh-Hans style removes punctuation the TTS needs.
- Opuscar's bilingual one-line-per-language burned-in subtitles as a default: our captions are sidecar files per language.
- Netflix limits as hard law: they are a well-documented reference for broadcast-quality timed text, applied as lint thresholds.

## Gotchas
- CJK reading speed is counted in characters, Latin in characters including spaces: do not reuse one counter.
- Proprietary system CJK fonts (SimHei, Microsoft YaHei) are fine for local preview but must not be committed or relied on in renders; use OFL fonts (e.g. Noto Sans SC via fontsource, OFL-1.1).
- Typewriter reveals fail readcheck by design.

## Not read
Netflix minimum event duration, minimum gap between events, shot-change timing, line-break and two-line rules for zh-Hans, children's-content speeds, zh-Hant guide; YouTube auto-translation behaviour; burned-in subtitle rules for Shorts.
