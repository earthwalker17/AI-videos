# Lay a synthesised score on the film's cue sheet, and measure it the way QA will

A score written in code for a film whose picture is also code can stay in sync to the sample,
but only if both read one timeline and the score is measured against what QA will check: an
agent that writes it cannot hear it. The answer is a tempo that falls on whole frames, score
events addressed by cue id, rests and silences built as QA measures them, levels set against
the bed, and tests for the holes a thinned texture leaves.

## Method
1. **Pick a tempo whose subdivisions are whole frames.** At 30 fps, 90 bpm in 4/4 gives 20
   frames a beat, 80 a bar, 10 an eighth and 5 a sixteenth; at 48 kHz a frame is 1,600 samples,
   so a beat on a frame is also that frame's first sample.
2. **Address score events by cue id, never by a bare beat index.** Read landmarks as "the
   `turn` cue" or "the `rest-model` span", and the picture's own contact frames from the plain-data
   schedules both sides import. A re-timed cue sheet then re-places the sound; a bare index needs
   re-indexing by hand. Make a lookup by id throw on an unknown id, so a renamed cue fails loudly.
3. **Build rests and silences the way QA measures them.** A rest's loudest 3 s must sit at least
   20 dB under the mix's (unweighted, gated) level; a silence must be at most -60 dB RMS.
   - Cut the reverb and echo tails at the start of every rest, so a rest holds only its own
     quiet sounds.
   - Sink a sustained pad to its rest level over the last 1.5 beats before the rest, and bring
     it back over the beat after.
   - Stop every bus at each silence, and force the silences to digital zero in the master.
4. **Set UI sounds against the bed.** Measure each placed sound's loudest 400 ms against the mean
   power of the bed (the music, voices and pad within ±0.5 s) and place it in a band under it
   (V1's was 12-18 dB). A 70 ms click reads low on a 400 ms window, so it can sit a little
   higher. Print that table on every build.
5. **Give every hit a sharp contact.** QA's onset finder looks for the 5 ms block with the
   largest energy rise within ±120 ms. A soft or low hit over a bass pulse and a pad needs a
   short, bright contact on its frame, or the low tones' own 5 ms ripple can win.
6. **Test for holes.** A thinned texture leaves gaps an ear hears as drop-outs. Over the mastered
   film, outside the declared rests and silences, fail when a beat sits too far under the beats
   either side of it, or a 250 ms window too far under the second round it or under a floor
   (V1: 12 dB, 25 dB, -50 dBFS). Hold a stroke to the next one where the texture thins.
7. **Hold copied numbers to their source with tests.** When the score's build may read the cue
   sheet but not the picture's code (this repo's audio stage refuses any other repository file),
   a layout or camera number a pan needs is copied into the score, with a test per copy that
   holds it equal to its source. Untried: moving such numbers into the cue sheet instead [U].

## Evidence
Video #4 V1 (`videos/super-agent`, archived 2026-11-15 unpublished): an original synthesised
score on the shared score kit, 84 bars of 4/4 at 90 bpm on a 30 fps, 6,720-frame film, built
by `aiv audio` with the repository's pinned toolchain of 2026-11 (Node 24, the ffmpeg that
`aiv doctor` checks) on the reference host class (an 8 GB laptop with an integrated GPU). Its code and tests are only at tag `video/super-agent/v1-archived`; the paths
below are under `videos/super-agent/` there.
- The grid: `src/cues.ts:1-25` and `TREATMENT.md:1125-1127`. The cue sheet "imports only
  @aiv/core" (`src/cues.ts:13-14`), and `cue(id)` throws on a typo (`src/cues.ts:779-782`).
- By id: the arrangement takes every position from a cue by id, a schedule frame or the bar grid
  (`audio/arrangement.ts:33-37`), tested in `audio/score.test.ts:56-73`. When the cue sheet
  grew from 66 to 84 bars after the user had heard a sketch of bars 1-27, the cue sheet in the
  audio input hash made the sketch stale, and the plan recorded that cue-anchored parts
  re-place themselves while bare-index parts need re-indexing (`TREATMENT.md:1090-1106`).
- Rests and silences: `audio/index.ts:15-20, :46-48, :91-134` (a mirror of QA's checks printed
  on every build), `audio/continuity.ts:7-11`; the test that every rest and silence passes as
  QA measures it, `audio/score.test.ts:615-619`.
- UI sounds: `audio/index.ts:51-86` (the under-the-bed table), `audio/common.ts:49-52` and
  `audio/foley.ts:1-5` (12-18 dB). The 70 ms click: `audio/common.ts:98-99`. One click at -21
  measured 23.6 dB under the bed and went up to -15 (`audio/common.ts:132-133`).
- Contact: at -13 the low tones' 5 ms ripple came within 1.4× of a hit's contact, so the contact
  went to -12 (`audio/common.ts:136-137`); every hit of bars 44-84 is tested to have an onset
  within a frame (`audio/score.test.ts:665-669`).
- Holes: a 1 s bass stroke on a 1.33 s spacing left 10 frames 25-29 dB under the second round
  them until each stroke held to the next, and one 0.34 s gap read -78 dBFS
  (`audio/continuity.ts:34-38`, `audio/score.test.ts:621-663`).
- Copies: the score could not import the picture's layout, so `audio/places.ts:1-11` copied it,
  with a test per copy (`audio/score.test.ts:138-211`).
- The final passed `aiv qa --profile final`, whose rest and silence checks fail a film: -14.0
  LUFS, -3.3 dBTP, no unexpected silence. Six hit onsets read 55-110 ms late; QA reports hits as
  information only (`README.md:248-252`).

Not verified: by ear. The agent measured. When the review cut went to the user, nobody had yet
listened to bars 44-84 (`README.md:425-428`); the user then approved the cut. The 12-18 dB band
and the hole thresholds are one film's choices, not research. Narration over the score (V1 had
none).

## In this repo
- The shared score kit, `@aiv/pipeline/audio/kit` (`packages/pipeline/src/audio/runtime/kit/`):
  `timeline.ts` (the bar grid in samples, a cue or span by id, the silences and bus cuts),
  `mixer.ts` (buses and sends that stop at their cuts) and `master.ts` (`silences` written as
  exact zeros).
- QA's audio checks: `packages/pipeline/src/qa/audio.ts` (the rest, silence and onset rules).
- The audio stage's import rule: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md), the audio
  stage.
- Not shared yet: V1's QA mirror (`qaLines`), the under-the-bed table (`underBed`) and the hole
  tests, at the tag. Promote them when a second score uses them.

## Pitfalls
- A larger true-peak margin in the master can bury an onset under the note before it: re-run
  the onset test after changing it ([loudness-two-pass.md](loudness-two-pass.md)).
- QA's onset finder takes the largest rise of 3 dB or more near the cue, so in a dense mix it
  can pick a neighbour: in V1's draft, six hits of part one read 40-110 ms off although each was
  placed on its frame (`README.md:543-545` at the tag). Check the placement, not only the
  reading.
