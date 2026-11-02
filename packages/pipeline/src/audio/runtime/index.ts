// @aiv/pipeline/audio — what a video's score (videos/<slug>/audio/) imports: the score contract,
// WAV helpers and the library manifest. Only this folder and @aiv/core may be loaded by a score:
// both are covered by the audio input hash, and the stage refuses any other repo file. The
// stage's own machinery (opening a library's store, running a job) is deliberately not exported:
// a score reads files only through ctx.library(id), which verifies and records every read.
export { SAMPLE_RATE, defineScore, type Library, type Score, type ScoreContext, type Stereo, type Track } from './types.ts';
export { readWav, encodeWav, samplePeak, type WavData, type WavEncoding } from './wav.ts';
export { LibraryManifest, LibraryEntry, LibraryFile, isLibraryPath } from './library.ts';
export { frameSample } from './render.ts';
