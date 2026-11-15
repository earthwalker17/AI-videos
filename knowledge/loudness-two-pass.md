# Master to -14 LUFS with a two-pass, linear loudnorm

Platforms turn loud uploads down and leave quiet ones quiet, so a mix should arrive at the
platform's reference loudness with headroom for true peaks. YouTube's reference is commonly
given as -14 LUFS integrated.

## Method
1. Mix every track at 48 kHz stereo to exactly the picture's length (pad and trim by
   sample count, not by seconds).
2. **Pass 1** measures: `loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json` prints integrated
   loudness, true peak, loudness range and threshold.
3. **Pass 2** applies the measurement with `linear=true`, which is one gain change with no
   dynamics processing whenever the target is reachable without breaking the true-peak
   ceiling. Raise the target LRA to at least the measured LRA so linear mode stays possible.
4. Resample back to 48 kHz after loudnorm (it works at 192 kHz internally) and enforce the
   exact length again.
5. **Verify the delivery file** with `ebur128=peak=true`: integrated within ±1 LU of the
   target and true peak at or below -1 dBTP. If the measurement cannot be read, fail; never
   pass by default.

## Evidence
On the template's generated bed (a quiet sine chord plus pink noise): the raw mix measured
-19.0 LUFS; after the linear second pass, -13.8 LUFS, and QA on the AAC delivery read
-13.9 LUFS integrated and -7.6 dBTP true peak.

A bug found on the way: loudnorm reads `measured_LRA=0` as "not provided" and silently
switches to dynamic mode. A steady bed really measures 0 LU, so pass a minimal non-zero value
(0.01).

The score kit's default true-peak margin was not enough for one struck note of a real score.
Video #4 V1 (archived 2026-11-15 unpublished) mastered a synthesised score with the shared
score kit's master, whose limiter aims at post's -1.5 dBTP ceiling less an AAC margin of
1.1 dB. A D5 struck into that limiter came out of the draft's 192k AAC 1.7 dB over its true
peak, at -0.7 dBTP, past QA's -1 dBTP (at 320k, 0.5 dB over). V1 used a 2.0 dB margin (the
limiter at -3.5 dBTP); its final measured -14.0 LUFS and -3.3 dBTP. V1 recorded that the
larger margin cost an onset: a pickup note rang loud enough that the next note's attack was no
onset for QA's finder, until the pickup went 2 dB under that note. A test then held every hit
of bars 44-84 to an onset within a frame. Sources at tag `video/super-agent/v1-archived`,
under `videos/super-agent/`: `README.md:190-191`, `audio/index.ts:22-27`,
`audio/waiting.ts:87-91`, `audio/score.test.ts:665-669`.

Not verified: narration over music with ducking (no narrated video yet); what margin a mix
other than V1's needs.

## In this repo
`buildAudioBed`, `measureLoudness` and `masterAudio` in `packages/pipeline/src/media/audio.ts` (two-pass approach
adapted from lemo-opuscar, see `NOTICE.md`); the loudness checks in `packages/pipeline/src/qa`;
`video.json` `audio.tracks` and `qa.loudness`.

The score kit's master
(`packages/pipeline/src/audio/runtime/kit/master.ts`, `MASTER.aacMarginDb`) still defaults to
1.1 dB; a score can pass its own `aacMarginDb`. Whether the default should rise is open.

## Pitfalls
- Check the encoded delivery, not the WAV: AAC encoding moves the true peak, and more at a lower
  bitrate (192k against 320k, above).
- A larger margin limits harder, and a hit's attack can then stop standing out from the note
  before it: re-test the hits' onsets after changing it.
- Dynamic loudnorm changes the sound. If a report says `dynamic`, the mix needs attention,
  not a louder target.
