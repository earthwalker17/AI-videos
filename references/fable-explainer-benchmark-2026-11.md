# A Fable-made explainer of the Super-agent article: the benchmark for #4 V2 (2026-11)

| | |
|---|---|
| Upstream | X article by 数字生命卡兹克, https://x.com/Khazix0918/status/2119941585538572390 (a hands-on review of Claude Fable 5.2 with several one-prompt works embedded) · the linked post with a second film, https://x.com/Khazix0918/status/2119902325460590834 |
| Pin | Article 2119938260130832384, created and last modified 2026-11-09T23:53:55Z, 119 blocks, read as JSON through a public mirror on 2026-11-16 · the explainer film as embedded there (88.04 s, 1920×1080, 60 fps) and as a 1280×720, 30 fps copy supplied by the user |
| Licence | The films, their music and the article are their owner's. This note holds facts and our own descriptions only: no frame, audio, copy or asset of theirs is in this repository |
| Accessed | 2026-11-16 |
| Stale after | The film is fixed; the article can be edited. #4 V2, the film this study served, was published on 2026-11-17 (https://youtu.be/-b7g5XIgEn0) |

## What it is
An 88-second explainer of the DeepSeek Harness team's Super-agent article, made with Claude
Fable 5.2 by another creator and published inside their review of the model. The article says
every work in it came from one prompt and one run of about two hours, with no second turn and no
post-processing [S: the creator's statement, not checkable]. It embeds three more works: a
58-second tribute film in a white editorial style and two 3D web scenes.

## Why it matters here
The user named this film the bar for video #4 V2 (`videos/super-agent`), which explains the same
article: "a concrete benchmark to meet or exceed, not merely loose inspiration". V1 of #4 was
dropped for looking worse than films like it. The film is also evidence of what a lean production
can reach, and of how much of its quality is pacing and hierarchy, not geometry.

## Method
- The user supplied the film as a file and gave the article's address.
- The article's text and media list were read as JSON through the mirror the repository already
  uses for X articles ([V via mirror]).
- The benchmark's media were studied locally only (under `.cache/`, never in git). The rule: ask
  the user before fetching any reference media (`docs/PRODUCTION.md`).
- Frames: contact sheets at 2 frames a second, dense strips at 10 frames a second around seven
  transitions, and 1080p frames at fifteen moments. Scene changes by ffmpeg's `scene` score.
- Audio: loudness by `ebur128`; tempo by autocorrelation of the onset flux of a 150 Hz low-passed
  envelope; a spectrogram. An agent cannot hear it: voice and style are judged from the
  spectrogram [U].

## Key facts [V: measured on the files, unless tagged]
**Format and sound**
- 88.04 s, 1920×1080 at 60 fps, stereo AAC. Integrated loudness −14.8 LUFS, true peak −0.8 dBFS.
- No voice [U: no speech formants in the spectrogram]. A synthesised electronic score.
- Tempo: exactly 120 bpm (the strongest autocorrelation peak; kick onsets 0.50 s apart from
  16.04 s on). A bar is 2.0 s.

**Clock**
- 42 lines of text in 84 s, then a 4 s credit: one line per bar, all film long.
- Section changes fall on even seconds: 8, 10, 12, 16, then 22, 24, 26, 28, 30, 32, 44, 58, 66,
  74, 82 and 84 s.
- The music follows the argument: a sparse intro (0–16 s), a riser, the drop on the title at
  16.0 s, a four-on-the-floor groove, a half-time passage for the two-level architecture
  (32–44 s), groove (44–58 s), a breakdown for speculative execution (58–66 s), groove for the
  evidence and the meaning, and an outro.

**Picture**
- One system from first frame to last: a navy ground with a soft central lift, one electric blue
  plus white, glowing dots (an agent, an event, a task), thin outlined rounded rectangles (a
  session, a card), hairlines, dashed paths, rings. Soft bloom, comet trails on moving dots, a
  faint dot grid, specks.
- Ground luma, limited range: the 10th percentile is 27–31 and the mean 37–55. It passes this
  repository's black-frame check (`blackdetect=d=0.5:pix_th=0.10`) with no allowance.
- It alternates two kinds of beat. A **big type beat** is 2–4 words that fill the frame: at 1080p
  a headline glyph is about 290 px tall. A **small diagram beat** is one tiny mechanism of 3–10
  marks in the centre, with one line of text at the bottom (about 64 px) in which one keyword is
  blue. Labels are 36–46 px.
- Type enters by rolling in with motion blur over about 0.3 s. A numeral counts up as an odometer.
- Transitions are transformations of the same marks. Cards fade and leave their dots; the dots
  gather into a ring; the ring collapses to an orb; the orb bursts into particles that reveal the
  title. A headline zooms through the camera to wipe to the next scene. Highlighted dots of a
  grid fly together into a number. ffmpeg's scene score passes 0.25 once in the whole film, at
  the title burst.

**Narrative** (our paraphrase of its outline)
1. 0–12 s: agents need less supervision, but work is still bound to sessions; a person follows a
   few at once; one task is limited by the model, many by human attention.
2. 12–22 s: break the binding; the title; "not a product launch, an exploration of an
   architecture".
3. 22–32 s: four traits, one bar each, as a big word with a small icon; one loop cannot carry all
   four.
4. 32–44 s: two levels as two tilted planes; the Router only receives and dispatches; Workers are
   isolated and parallel; to the user there is one agent.
5. 44–58 s: events instead of prompts; a two-stage filter; a new topic gets a Worker; follow-ups
   pass straight to it.
6. 58–66 s: speculative execution, with a worked example.
7. 66–76 s: the authors' numbers; more tokens buy shorter and steadier runs.
8. 76–88 s: the bottleneck shifts to attention; people move to deciding and signing off; credit.

**The second film** (the tribute, 58 s, 1080p at 60 fps) uses another look entirely: white and
black, a grotesque with italic serif accents, cards that accumulate into a bento grid, rolling
numerals, and two persistent instruments (a timeline scrubber along the bottom and a day counter)
that tell the viewer where they are. Its prompt, as shown in the article [S], asked for 40–60 s, no
narration, original music, facts checked online, a look derived from the subject's own style, a
fast rhythm cut to the music, and a third-party framing.

## What we adopted (qualities, not forms)
- **A musical clock.** 120 bpm, 60 fps, a bar of 120 frames, text entrances and section changes
  on the grid, and a score whose sections follow the argument.
- **Two scales of beat.** Large type alternating with one small mechanism, never both crowded.
- **Object permanence.** A transition transforms marks that are already on screen.
- **One system.** A handful of primitives, one meaning each, from first frame to last.
- **A lean process.** The first cut is a whole film, judged as a film.

## What we deliberately did NOT adopt, and why
- **Its signatures:** the navy ground with a single blue glow; cards → dots → ring → orb → burst;
  the four trait cards; the starfield; the bottom line with a blue keyword; the wordmark with a
  hyphen pill; a slatted column and a lens for the filter; a dashed bypass under a Router node;
  the minutes odometer; two tilted outlined planes with a tool chip. They are its identity.
- **A bottom line that carries the explanation.** The user asked for typography inside the scene.
- **Where this repository's facts bar asks for more:** minutes from a synthetic, time-scaled test
  shown as durations; no split between what is built, proposed and open; the article's own
  example re-staged; glow and specks that mean nothing.

## Gotchas
- The user's copy is 30 fps and 720p; the embedded original is 60 fps. Judge motion on the
  original: the smoothness is part of the bar.
- Matching its numbers (palette, luma, type sizes) pulls a look towards imitation. Compare by
  qualities, side by side (`docs/PRODUCTION.md`, Lookdev).

## Not read
- The two 3D scenes beyond a glance at their stills; replies and quote-posts; the creator's other
  channels; how the film was actually built (engine and code are not public).
