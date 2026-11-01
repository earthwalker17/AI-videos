/**
 * The repository model: video.json v1 (one video slot) and series.json v1.
 *
 * The render-relevant part of video.json is @aiv/core VideoConfig (what engines and the pipeline
 * read). A slot adds what the repository tracks about a video: its number, series, lifecycle
 * status and approvals, licence, reproducibility and publication. Only the CLI reads these, so
 * they live here; `aiv check --fix` exports them to schemas/*.json.
 *
 * Both are strict: a misspelt key is an error, not silently ignored. A change that existing
 * files would fail is a new schemaVersion (docs/ARCHITECTURE.md, schema versioning).
 */
import { VideoConfig } from '@aiv/core';
import { z } from 'zod';

export const STATUSES = ['idea', 'brief', 'treatment', 'production', 'review', 'locked', 'published', 'archived'] as const;
export const Status = z.enum(STATUSES);
export type Status = z.infer<typeof Status>;

/** Published and archived videos are frozen: rebuilt from their release tag, never edited to follow upgrades. */
export const isFrozen = (s: Status): boolean => s === 'published' || s === 'archived';

/** The order of a status in the lifecycle (idea = 0). */
export const statusRank = (s: Status): number => STATUSES.indexOf(s);

/**
 * Lowercase-kebab ASCII, short enough for Windows paths. Immutable once a video reaches
 * production: links, tags and release names are built from it.
 */
export const Slug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected lowercase-kebab ASCII (a-z, 0-9, single hyphens)');

/** A BCP 47 language tag: en, zh-Hans, pt-BR. */
export const Lang = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, 'expected a BCP 47 tag such as en or zh-Hans');

const IsoDate = z.iso.date();

/** A human decision at a lifecycle gate. Agents never record one the user did not give. */
export const Approval = z.strictObject({
  gate: z.enum(['treatment', 'review', 'final']),
  date: IsoDate,
  note: z.string().optional(),
});
export type Approval = z.infer<typeof Approval>;

const render = VideoConfig.shape;

export const VideoSlot = z
  .strictObject({
    $schema: z.string().optional(),
    schemaVersion: z.literal(1),
    /** sequential across the channel, never reused */
    number: z.int().positive(),
    slug: Slug,
    title: z.string().min(1),
    /** the title in other languages, by BCP 47 tag */
    titles: z.record(Lang, z.string().min(1)).optional(),
    /** a series id (series/<id>/), or null for a standalone video */
    series: Slug.nullable(),
    status: Status,
    approvals: z.array(Approval),
    /** the next concrete action: per-video state lives here, not in the roadmap */
    next: z.string().optional(),
    /** narration/caption languages; the first is the primary one */
    languages: z.array(Lang).min(1),
    /** style ids (styles/<id>/) */
    styles: z.array(Slug),
    /** how much of the film this folder can rebuild */
    reproducibility: z.enum(['full', 'partial', 'metadata-only']),
    // the render subset (@aiv/core VideoConfig); required unless metadata-only
    engine: render.engine.optional(),
    entry: render.entry.optional(),
    composition: render.composition,
    format: render.format.optional(),
    audio: render.audio,
    qa: render.qa,
    /** things made for this video that others could reuse (and candidates for promotion) */
    reusable: z.array(z.strictObject({ path: z.string().min(1), what: z.string().min(1) })),
    /** the licence of the finished film: an SPDX id, 'none' (all rights reserved) or a LicenseRef */
    license: z.strictObject({ film: z.string().min(1), note: z.string().optional() }),
    youtube: z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'expected an 11-character YouTube video id'), published: IsoDate.optional() }).nullable(),
    /** the latest release: manifest videos/<slug>/release/v<version>.json, tag video/<slug>/v<version> */
    release: z.strictObject({ version: z.int().positive() }).nullable(),
    /** where the source lives when it is not this folder (earlier films) */
    source: z.strictObject({ repo: z.url(), ref: z.string().min(1) }).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.reproducibility === 'metadata-only') return;
    for (const key of ['engine', 'entry', 'format'] as const)
      if (v[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required unless reproducibility is metadata-only` });
  });
export type VideoSlot = z.infer<typeof VideoSlot>;

export const SeriesConfig = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  id: Slug,
  title: z.string().min(1),
  titles: z.record(Lang, z.string().min(1)).optional(),
  /** one line: what the series promises its audience */
  summary: z.string().min(1),
  status: z.enum(['active', 'planned', 'retired']),
  /** every claim needs FACTS.md + sources.jsonl before the review cut */
  factsRequired: z.boolean(),
  /**
   * copied into video.json by `aiv new`, never inherited afterwards (changing a series never
   * changes an existing video). Filled in once the series' first video has proven them.
   */
  defaults: z.strictObject({
    engine: z.string().min(1).optional(),
    format: render.format.optional(),
    languages: z.array(Lang).min(1).optional(),
    styles: z.array(Slug).optional(),
    qa: render.qa,
  }),
});
export type SeriesConfig = z.infer<typeof SeriesConfig>;
