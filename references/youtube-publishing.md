# YouTube publishing — encode spec, upload assets, licence, AI policy

| | |
|---|---|
| Upstream | YouTube Help: encoding https://support.google.com/youtube/answer/1722171 · thumbnails /answer/72431 · captions /answer/2734698 · chapters /answer/9884579 · multi-language audio /answer/13338784 · Creative Commons /answer/2797468 · Audio Library /answer/3376882 · AI disclosure /answer/14328491 and /answer/15446725 · inauthentic content /answer/1311392 |
| Pin | Accessed 2026-11-01 (help pages are unversioned) |
| Licence | Google help content, proprietary: facts paraphrased, link only |
| Accessed | 2026-11-01 |
| Stale after | 2027-05-01 for the encode spec; 2026-12-01 for AI-disclosure and monetisation policy (both changed in 2025–26). |

## What it is
The platform rules that decide the delivery encode and every file in a video's `publish/`
folder, restated in our own words.

## Why it matters here
`@aiv/pipeline` encode presets, the QA gate and the publish checklist are derived from
these pages; getting colour or GOP wrong is invisible until it ships.

## Key facts — upload encoding (answer/1722171) [V]
- Container MP4, `moov` atom at the front (faststart), no edit lists.
- Video H.264 High profile, progressive, 2 consecutive B-frames, closed GOP of **half the frame rate**, CABAC, variable bitrate, 4:2:0.
- SDR bitrates (standard / high frame rate): 1080p 8 / 12 Mbps; 1440p 16 / 24 Mbps; 2160p 35–45 / 53–68 Mbps.
- Audio AAC-LC (or Opus, or Eclipsa) at 48 kHz, stereo 384 kbps.
- Colour: BT.709 is the recommended SDR colour space; untagged transfer, matrix or primaries are interpreted as BT.709.
- Loudness: the commonly cited ~−14 LUFS playback normalisation is community consensus, not on this page [S].

## Key facts — upload assets [V]
- **Thumbnails** (72431): ideally 3840×2160 (2160×3840 for Shorts), minimum width 640 px, JPG or PNG, up to 50 MB on desktop / 2 MB from mobile, 16:9; custom thumbnails need at least intermediate account verification.
- **Captions** (2734698): SRT and SBV are "basic" formats: plain UTF-8 text, no styling. WebVTT supports positioning.
- **Chapters** (9884579): first timestamp must be 00:00, at least 3 timestamps in ascending order, each chapter at least 10 s.
- **Multi-language audio** (13338784): needs the channel's Advanced features; each audio file should be roughly the video's length; long-form videos can also have per-language thumbnails; copyright problems in a secondary track can get it removed.

## Key facts — licence and music [V]
- **Creative Commons option** (2797468): YouTube's only alternative licence is CC BY 4.0 (it links `creativecommons.org/licenses/by/4.0/`), and it is unavailable when the video has a Content ID claim. Any BY-SA or NC component conflicts with releasing the film as CC BY 4.0.
- **Audio Library** (3376882): its tracks will not be claimed through Content ID and can be monetised in YPP; Creative Commons tracks need artist credit in the description; YouTube is not responsible for "royalty-free" music from other libraries.

## Key facts — AI disclosure and monetisation [V]
- **Altered or synthetic content** (14328491): disclose via Studio → "AI use" when realistic content is generated or meaningfully altered (real people, real events or places, realistic scenes). AI-generated music is now listed as needing disclosure (wording mentions music that is the main focus; whether background scores count is unclear [U]). Clearly unrealistic content, AI animation in fully animated videos and production assistance (scripts, thumbnails, infographics) do not need it.
- Labels triggered by C2PA metadata in the upload are applied automatically and cannot be changed; the "captured with a camera" label needs C2PA ≥ 2.1 capture with no edits (15446725) — never applicable to code-made video.
- **Inauthentic content** (1311392, renamed 2025-07-15): content made with generic or unoriginal templates giving the impression of mass production, or templated storylines, is not eligible for monetisation; a series where each video has a distinct storyline, focus or concept is fine.

## What we adopted / adapted (per the plan)
- `@aiv/pipeline` preset `youtube-1080p`: H.264 High, yuv420p, 2 B-frames, closed GOP, `+faststart`, AAC 48 kHz; one RGB→YUV **BT.709 limited-range conversion** in post, with explicit `color_primaries`/`color_trc`/`colorspace`/`color_range` tags.
- QA gate: ffprobe asserts size, fps, frames, BT.709 tags, AAC 48 kHz; −14 ±1 LUFS integrated; ≤ −1 dBTP; A/V duration within one frame; no black or frozen frames; swatches decoded from the final mp4 within ±3.
- `publish/` per video: description, chapters, captions per language, ai-disclosure; thumbnails per the spec.
- CC BY 4.0 for original media, consistent with YouTube's CC option (only when nothing in the video is claimed or NC/SA).
- Templates are infrastructure; each video needs a distinct concept (monetisation policy).

## What we deliberately did NOT adopt, and why
- Relying on YouTube to fix colour: untagged or BT.601 files shift colours on some players.
- C2PA metadata in uploads by default: the resulting label cannot be changed.
- Committing Audio Library or stock MP3s: keep a music ledger instead.

## Gotchas
- MAP's delivery preset used a 2 s GOP; the spec asks for a GOP of half the frame rate. Decide per preset and test.
- Retagging BT.601 output as BT.709 without converting the matrix shifts colours; convert, then tag.
- x264 4K60 medium on the reference host class peaked near 3 GiB RSS at ~11 fps (see `toolchain-2026-11.md`).

## Not read
HDR upload settings; Shorts beyond thumbnail size; end screens and cards; the Data API upload flow; Content ID registration; "made for kids" rules; Eclipsa audio details; whether the channel has Advanced features (needed for multi-language audio).
