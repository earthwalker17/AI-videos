/**
 * Render profiles: one name picks resolution scale, delivery preset and chunking, so agents
 * choose a profile instead of hand-writing flags.
 */
import { ExitError, EXIT } from '@aiv/core';

export type ProfileName = 'draft' | 'review' | 'final';

export interface Profile {
  name: ProfileName;
  /** render size relative to video.json format */
  scale: number;
  /** delivery encode preset used by `aiv post` */
  encode: 'preview-hw' | 'youtube';
  /** also write the archival master (archive preset) */
  archive: boolean;
  /** frames per resumable chunk */
  chunkFrames: number;
}

export const PROFILES: Record<ProfileName, Profile> = {
  draft: { name: 'draft', scale: 0.5, encode: 'preview-hw', archive: false, chunkFrames: 60 },
  review: { name: 'review', scale: 1, encode: 'youtube', archive: false, chunkFrames: 120 },
  final: { name: 'final', scale: 1, encode: 'youtube', archive: true, chunkFrames: 120 },
};

export function getProfile(name: string): Profile {
  const p = (PROFILES as Record<string, Profile | undefined>)[name];
  if (!p) throw new ExitError(EXIT.USAGE, `unknown profile '${name}' (known: ${Object.keys(PROFILES).join(', ')})`);
  return p;
}

/** The render size for a profile: scaled and rounded to even numbers (4:2:0 needs even sizes). */
export function renderSize(format: { width: number; height: number }, profile: Profile): { width: number; height: number } {
  const even = (n: number) => Math.max(2, 2 * Math.round((n * profile.scale) / 2));
  return { width: even(format.width), height: even(format.height) };
}
