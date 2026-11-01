// @aiv/pipeline — Node only: host safety, ffmpeg/encode, the chunk runner, QA and release.
// Engines and the aiv CLI import from here; frame code never does (it imports @aiv/core).

// util
export { createLog, silentLog, type Log } from './util/log.ts';
export { repoRoot, outDir, repoRel, fromRepo, partPath, writeFileAtomic, writeJson, type OutKind } from './util/paths.ts';
export { gitState } from './util/git.ts';
export { toolchain, ffmpegVersion, pnpmVersion, type FfmpegVersion } from './util/toolchain.ts';
export { sha256, sha256File, canonicalJson } from './util/hash.ts';
export { which, exec, execBuffer, spawnTool, resolveSpawn, cmdLine, killTree, pidAlive, powershell, type ExecResult, type ExecOptions } from './util/proc.ts';

// host safety
export { onAbort, abortProcess } from './host/abort.ts';
export { hostMemory, availableMB, parseVmStat, fmtMem, waitForMemory, sweepBackgroundApps, topConsumers, type HostMemory, type GuardOptions } from './host/memory.ts';
export {
  acquireLock,
  lockStatus,
  lockPath,
  defaultLockPath,
  expandPath,
  inheritedSlot,
  slotEnvValue,
  reclaimStale,
  HEAVY_SLOT_ENV,
  HEARTBEAT_MS,
  STALE_MS,
  type LockInfo,
  type LockStatus,
  type LockResult,
  type AcquireOptions,
} from './host/lock.ts';
export {
  sweepOrphans,
  findOrphanBrowsers,
  browserProfilesDir,
  userDataDir,
  remotionBrowserDir,
  staleRemotionProfiles,
  REMOTION_PROFILE_PREFIX,
  REMOTION_PROFILE_MARKER,
  profileOwner,
  ownedProfile,
  type ClassifyOptions,
  type OrphanProcess,
} from './host/orphans.ts';
export { gpuFamily, isSoftwareRenderer, softwareAllowed } from './host/gpu.ts';
export { keepAwake } from './host/keepAwake.ts';
export { readLocalConfig, LocalConfig, LOCAL_CONFIG_FILE } from './host/localConfig.ts';
export { acquireHeavy, runHeavy, DEFAULT_MIN_FREE_MB, type HeavyOptions, type HeavySlot, type RunHeavyOptions } from './host/heavy.ts';

// media
export { ffmpegBin, ffprobeBin, ffmpeg, mediaBins } from './media/bin.ts';
export { probe, countFrames, audioDuration, rational, type ProbeResult, type VideoStreamInfo, type AudioStreamInfo } from './media/probe.ts';
export { escapeFilterOption, escapeFilterGraph, filterValue, filterPath, concatLine } from './media/escape.ts';
export {
  PRESETS,
  getPreset,
  toBt709Filter,
  videoCodecArgs,
  audioCodecArgs,
  containerArgs,
  encoderPixFmt,
  mezzanineArgs,
  gopFrames,
  detectHwEncoder,
  resolveEncoder,
  MEZZANINE_COLOR,
  type PresetName,
  type VideoPreset,
} from './media/presets.ts';
export { ChunkEncoder, commitPart, concatCopy, type ChunkEncoderOptions } from './media/encoder.ts';
export { buildAudioBed, audioBedArgs, measureLoudness, masterAudio, parseLoudnormJson, DEFAULT_LOUDNESS, AUDIO_RATE, type LoudnessTargetSpec, type MasterResult } from './media/audio.ts';
export { encodeDelivery, deliveryArgs, type EncodeDeliveryOptions, type EncodeDeliveryResult } from './media/mux.ts';

// runner
export type { EngineAdapter, EngineSession, EngineOpenContext, EngineInfo, FrameMeta, FrameSpan } from './runner/engine.ts';
export { PROFILES, getProfile, renderSize, type Profile, type ProfileName } from './runner/profiles.ts';
export { resolveTarget, type Target } from './runner/target.ts';
export { computeInputHash, renderSettings, inputRoots, hashedBy, filesOutsideHash, type InputHash, type RenderSettings } from './runner/inputHash.ts';
export { runRender, chunkList, type RunOptions, type RunOutcome } from './runner/runner.ts';

// qa
export { runQa, loudnessChecks, measureSwatches, contactSheet, formatQaTable, type QaOptions, type SwatchResult } from './qa/qa.ts';
export { decodedFrameHashes, allFrameHashes, parseFramehash, toRgbFilter, type HashPixFmt } from './qa/frames.ts';
export { parseEbur128, parseBlack, parseFreeze, parseSilence, unexpected, type Segment, type Ebur128Summary } from './qa/detect.ts';

// release
export { writeRelease, verifyRelease, readManifest, describeFile, releaseName, buildPaths, buildTreeState, type ReleaseOptions, type VerifyResult } from './release/release.ts';

// post (shared by the CLI and tests)
export { runPost, type PostOptions, type PostOutcome } from './post/post.ts';

// test fixtures (engine tests reuse the fake adapter and temp repo)
export { tempRepo, fakeAdapter, syntheticFrame, type TempRepo, type FakeAdapter, type FakeAdapterOptions } from './testing.ts';
