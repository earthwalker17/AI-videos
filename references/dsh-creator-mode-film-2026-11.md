# DeepSeek Harness "Creator Mode" film: the reference for video #5 (2026-11)

| | |
|---|---|
| Upstream | https://x.com/DeepSeekHarness/status/2117256196227019194 (post of 2026-11-02, "Your Harness. You Define It. Meet Creator Mode in DeepSeek Harness.") |
| Pin | The embedded film as served on 2026-11-24: 99.38 s, 1920×1080, 30 fps, H.264 + AAC, sha256 `fc57b5921b570c1d…` (the 1080p variant) |
| Licence | The film, its music and its design are its owner's. This note holds facts and our own descriptions only; the file and frames stay in `.cache/refs/minidsh-launch/`, never committed |
| Accessed | 2026-11-24 (downloaded with the creator's approval, for study) |
| Stale after | The film is fixed |

## What it is
DeepSeek Harness's launch film for its "Creator Mode": a product feature film built around real UI.
The creator named it the primary creative reference for video #5 (`minidsh-launch`), to learn from
and never to copy.

## Method
- Probed and measured from the stream:
  - ffprobe for the format;
  - ffmpeg `scdet` for cuts and `scene` scores for motion per second;
  - `signalstats` for luma and saturation per second;
  - `ebur128` for loudness;
  - an onset-flux autocorrelation for tempo.
- Then, with the file local, five contact sheets at 1 fps and six full frames, looked at.

## Key facts [V: measured on the file]
**Format and sound**
- 99.4 s at 30 fps.
- −16.3 LUFS integrated, LRA 4.4 LU, true peak about 0 dBFS.
- Tempo about 74 bpm (or 148): a calm half-time feel. No voice.

**Structure**
- **0–6 s.** The logo on a dark, smoky backdrop; the wordmark decodes in; black.
- **6–30 s.** "Introducing" typed on black, then white ground. The feature name stacks and scrolls,
  and the product window rises into it. Then real UI on white:
  - close-ups up to about 3× with slight 3D tilts on the composer and the send button;
  - a large pointer that clicks a mode menu;
  - a typed prompt;
  - agent progress rows;
  - the result (a working widget).
- **Pattern.** Each demo is followed by a typed title card with one accent word in blue. Calm: almost
  no cuts from 6 to 37 s, the motion is the camera on one continuous UI.
- **37–92 s.** A second demo (a sidebar plugin built and opened), then a question-led montage of
  "advanced" creations ("Like A … / Or A … / Even A …"), each 2–4 s with hard cuts, mostly dark
  product shots between white title cards. A collage of floating widget cards around one word.
  "Everywhere" over illustrated scenes.
- **92–99 s.** A typed tagline on black with a light-streak wipe; a white logo card.

**Look**
- **Mostly near-white.** Luma about 230 of 235, saturation about 1, for long stretches; black only
  in the bumpers.
- **Type.** A Montserrat-like geometric sans, sentence or title case, dark navy, with a blue
  accent word that glows slightly.
- **UI.** The product's own light theme, on white or over the smoky desktop wallpaper.

## What video #5 adopted, in its own terms
- Real product UI as the hero, magnified until it reads, with a pointer that drives it.
- The demo, then a statement rhythm.
- Calm in the demo, energy at the climax.
- A complete first frame.
- Hard cuts on beats.
- A logo resolve at the end.

## What it deliberately did not copy
- **Type and words:** the typed titles with a caret, the blue accent word, white title cards,
  Montserrat, "Introducing".
- **Ground and devices:** the navy smoke, the logo or whale, the question montage, the widget
  collage, the "Everywhere" scenes, the light-streak wipe.
- **The look as a whole:** video #5 stands on MiniDSH's own dark ink (paper on ink), uses IBM Plex,
  and keeps teal for the mark's dot.

## Not measured
Its music (not analysed beyond tempo and loudness); whether its UI shots are captures or rebuilt
components (their sharpness at 3× suggests components rendered at high density).
