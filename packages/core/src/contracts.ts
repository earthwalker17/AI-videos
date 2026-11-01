/**
 * The file contracts between pipeline stages, as zod schemas plus inferred types.
 *
 * The engine boundary is a file: an engine writes a mezzanine + render.json; post writes the
 * deliverables + post.json; qa writes report.json; release writes the release manifest. Each
 * stage reads only the files of the stages before it.
 *
 * Versions: render.json v1 and the release manifest v1 are frozen. They were derived from the
 * first real web-engine render and release (fixtures/*.v1.json) and are exported to schemas/.
 * A change that old files would fail is a new version, never an edit (docs/ARCHITECTURE.md).
 * post.json and report.json are working files in out/; they carry a schemaVersion but may change
 * with the pipeline.
 */
import { z } from 'zod';

const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'expected a lowercase hex sha256');

/**
 * A repo-relative POSIX path. Committed files never carry absolute or user paths (privacy and
 * portability), so the schema rejects drive letters, leading slashes, backslashes and '..'.
 */
export const RepoPath = z
  .string()
  // a regex rather than a refine, so the rule survives the JSON Schema export
  .regex(/^(?![A-Za-z]:)(?![/\\])(?!.*\\)(?!(?:.*\/)?\.\.(?:\/|$)).+$/, 'expected a repo-relative POSIX path');

/** Frame range: start inclusive, end exclusive, count = end - start. */
export const FrameRange = z
  .object({ start: z.int().nonnegative(), end: z.int().nonnegative(), count: z.int().nonnegative() })
  .refine((r) => r.end >= r.start && r.count === r.end - r.start, { message: 'expected count = end - start ≥ 0' });

export const ColorInfo = z.object({
  /** 'rgb' for RGB mezzanines (sRGB-encoded), otherwise the YUV matrix */
  space: z.enum(['rgb', 'bt709', 'bt601']),
  /** 'pc' = full range, 'tv' = limited range */
  range: z.enum(['pc', 'tv']),
});
export type ColorInfo = z.infer<typeof ColorInfo>;

/** Toolchain fingerprint: versions and a coarse host class only (no hostname, user or paths). */
export const Toolchain = z.object({
  node: z.string(),
  pnpm: z.string().optional(),
  ffmpeg: z.string(),
  /** first 16 hex chars of sha256(`ffmpeg -buildconf`): same version string, different build → different hash */
  ffmpegBuildconfHash: z.string(),
  browser: z.string().optional(),
  os: z.string(),
  arch: z.string(),
  /** vendor / renderer family, e.g. "ANGLE (Intel, D3D11)" */
  gpu: z.string().optional(),
});
export type Toolchain = z.infer<typeof Toolchain>;

export const GitState = z.object({ commit: z.string(), dirty: z.boolean() });
export type GitState = z.infer<typeof GitState>;

/** render.json v1 (frozen). Written by the chunk runner when a render completes. */
export const RenderResult = z.object({
  schemaVersion: z.literal(1),
  engine: z.object({ name: z.string(), version: z.string(), adapterVersion: z.string() }),
  target: z.object({ slug: z.string(), entry: z.string(), composition: z.string().optional() }),
  profile: z.string(),
  /** the frames rendered: the whole composition, or a --frames sub-range */
  frames: FrameRange,
  /** the composition's own length: frames.count < durationFrames means a partial render */
  composition: z.object({ durationFrames: z.int().positive() }),
  fps: z.number().positive(),
  width: z.int().positive(),
  height: z.int().positive(),
  color: ColorInfo,
  mezzanine: z.object({ path: RepoPath, codec: z.string(), pixFmt: z.string(), bytes: z.int().nonnegative(), sha256 }),
  inputHash: sha256,
  git: GitState,
  toolchain: Toolchain,
  timing: z.object({ startedAt: z.iso.datetime(), endedAt: z.iso.datetime(), wallS: z.number().nonnegative() }),
  /** repo-relative path of the per-frame hash list ("<frame> <sha256>" per line) */
  frameHashes: RepoPath.optional(),
  warnings: z.array(z.string()),
});
export type RenderResult = z.infer<typeof RenderResult>;

export const AudioTrack = z.object({
  /** 'lavfi:<filtergraph>' (a generated source) or a repo-relative file (never an absolute or user path) */
  source: z.union([z.string().regex(/^lavfi:.+/), RepoPath.refine((p) => !p.startsWith('lavfi:'), { message: 'an empty lavfi: graph' })]),
  gainDb: z.number().optional(),
  /** seconds from the start of the video */
  start: z.number().nonnegative().optional(),
});
export type AudioTrack = z.infer<typeof AudioTrack>;

export const LoudnessTarget = z.object({
  /** integrated loudness target, LUFS */
  integrated: z.number(),
  /** allowed |measured - integrated|, LU */
  tolerance: z.number().positive(),
  /** true-peak ceiling, dBTP */
  truePeakMax: z.number(),
});
export type LoudnessTarget = z.infer<typeof LoudnessTarget>;

/** A [start, end) range of frames. */
const FrameSpan = z.tuple([z.int().nonnegative(), z.int().nonnegative()]).refine(([a, b]) => b > a, { message: 'expected [start, end) with end > start' });

/**
 * video.json — the minimal pre-schema subset the pipeline reads (M1). The full video slot schema
 * (number, status, approvals, series, …) arrives in M3; unknown keys pass through untouched.
 */
export const VideoConfig = z.looseObject({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$|^_template-[a-z0-9-]+$/, 'expected lowercase-kebab ASCII'),
  title: z.string(),
  engine: z.string().min(1),
  /** entry point, relative to the video's folder (e.g. "src/index.html", "src/Root.tsx") */
  entry: z.string().min(1),
  composition: z.string().optional(),
  format: z.object({ width: z.int().positive(), height: z.int().positive(), fps: z.number().positive() }),
  audio: z.object({ tracks: z.array(AudioTrack) }).optional(),
  qa: z
    .object({
      /** frames that show the swatch strip, [start, end) */
      swatchFrames: FrameSpan.optional(),
      loudness: LoudnessTarget.optional(),
      /** intentional black / frozen spans, [start, end) frames, that QA must not fail on */
      allowBlack: z.array(FrameSpan).optional(),
      allowFreeze: z.array(FrameSpan).optional(),
    })
    .optional(),
});
export type VideoConfig = z.infer<typeof VideoConfig>;

export const LoudnessMeasure = z.object({
  /** integrated loudness, LUFS */
  i: z.number(),
  /** true peak, dBTP */
  tp: z.number(),
  /** loudness range, LU */
  lra: z.number(),
  /** gating threshold, LUFS */
  thresh: z.number(),
});
export type LoudnessMeasure = z.infer<typeof LoudnessMeasure>;

/** preset = the encode preset name (youtube, preview-hw, archive); encoder = the video encoder it resolved to here */
const DeliveredFile = z.object({ path: RepoPath, preset: z.string(), encoder: z.string(), bytes: z.int().nonnegative(), sha256, frames: z.int().nonnegative(), durationS: z.number() });

/** post.json (working file). Written by `aiv post` next to the deliverables. */
export const PostResult = z.object({
  schemaVersion: z.literal(1),
  slug: z.string(),
  profile: z.string(),
  render: z.object({ path: RepoPath, inputHash: sha256, mezzanineSha256: sha256 }),
  delivery: DeliveredFile,
  archive: DeliveredFile.optional(),
  audio: z.object({
    tracks: z.array(AudioTrack),
    target: z.object({ i: z.number(), tp: z.number(), lra: z.number() }),
    /** before = the raw mix, after = the mastered bed; null when the mix is silent */
    before: LoudnessMeasure.nullable(),
    after: LoudnessMeasure.nullable(),
    /** 'linear' when loudnorm could apply one gain (no dynamics change) */
    mode: z.enum(['linear', 'dynamic', 'silent']),
  }),
  git: GitState,
  toolchain: Toolchain,
  createdAt: z.iso.datetime(),
  warnings: z.array(z.string()),
});
export type PostResult = z.infer<typeof PostResult>;

export const QaCheck = z.object({
  id: z.string(),
  passed: z.boolean(),
  /** informational checks never fail the report */
  info: z.boolean().optional(),
  detail: z.string(),
  value: z.unknown().optional(),
});
export type QaCheck = z.infer<typeof QaCheck>;

/** qa report.json (working file). */
export const QaReport = z.object({
  schemaVersion: z.literal(1),
  file: RepoPath,
  sha256,
  createdAt: z.iso.datetime(),
  passed: z.boolean(),
  checks: z.array(QaCheck),
  loudness: z.object({ i: z.number(), tp: z.number(), lra: z.number() }).nullable(),
  contactSheet: RepoPath.nullable(),
});
export type QaReport = z.infer<typeof QaReport>;

export const ReleaseFile = z.object({
  name: z.string(),
  role: z.enum(['delivery', 'archive']),
  bytes: z.int().nonnegative(),
  sha256,
  container: z.string(),
  vcodec: z.string().nullable(),
  acodec: z.string().nullable(),
  width: z.int().nullable(),
  height: z.int().nullable(),
  fps: z.number().nullable(),
  frames: z.int().nullable(),
  durationS: z.number().nullable(),
  color: z.object({ space: z.string().nullable(), primaries: z.string().nullable(), transfer: z.string().nullable(), range: z.string().nullable() }),
});
export type ReleaseFile = z.infer<typeof ReleaseFile>;

/** T1 = GitHub Releases: each asset ≤ 2 GiB. */
export const T1_LIMIT_BYTES = 2 * 1024 ** 3;

/** release manifest v1 (frozen; committed as videos/<slug>/release/v<N>.json). */
export const ReleaseManifest = z.object({
  schemaVersion: z.literal(1),
  slug: z.string(),
  version: z.int().positive(),
  createdAt: z.iso.datetime(),
  files: z.array(ReleaseFile).min(1),
  picture: z.object({
    engine: z.object({ name: z.string(), version: z.string(), adapterVersion: z.string() }),
    profile: z.string(),
    commit: z.string(),
    dirty: z.boolean(),
    inputHash: sha256,
    frames: z.int().nonnegative(),
    /** the composition's length (a release holds the whole composition unless allowed otherwise) */
    durationFrames: z.int().positive(),
    fps: z.number(),
    toolchain: Toolchain,
  }),
  /** how the deliverables were made from the picture (the mix, the encode) */
  post: z.object({ dirty: z.boolean(), deliveryPreset: z.string(), encoder: z.string(), archivePreset: z.string().nullable() }),
  /** the build tree at release time (code, templates, the video folder, the lockfile) */
  tree: GitState,
  audio: z.object({ lufs: z.number().nullable(), truePeak: z.number().nullable() }),
  /** QA of every released file; failed ids of the archive report are prefixed 'archive/' */
  qa: z.object({ passed: z.boolean(), failed: z.array(z.string()) }),
  storage: z.object({ tier: z.literal('T1'), limitBytes: z.literal(T1_LIMIT_BYTES) }),
});
export type ReleaseManifest = z.infer<typeof ReleaseManifest>;

/** Parse with a readable one-paragraph error naming the file. */
export function parseContract<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw new Error(`${what} does not match its contract:\n${z.prettifyError(r.error)}`);
}
