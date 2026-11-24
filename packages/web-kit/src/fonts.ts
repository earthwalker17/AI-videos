// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2): the FontFace loading of that
// film's boot.ts and of templates/web/src/main.ts, as one helper.
/**
 * Fonts for a page: font files from pinned packages, imported by the page through Vite (`?url`),
 * registered with FontFace under family names no system font has ('AIV …'), so a fallback can
 * never pass for the real face (the page contract's `fonts` check measures that). Call it in the
 * page's setup, before building a type atlas.
 */

export interface FaceSpec {
  /** the family the page draws with, e.g. 'AIV Plex' */
  family: string;
  /** the file's URL (a Vite `?url` import of a pinned package's woff2) */
  url: string;
  /** a weight or a variable font's range, e.g. '500' or '100 700' (default '400') */
  weight?: string;
  style?: string;
}

/** Load every face and add it to document.fonts. */
export async function loadFaces(faces: readonly FaceSpec[]): Promise<FontFace[]> {
  const loaded = await Promise.all(faces.map((f) => new FontFace(f.family, `url(${f.url})`, { weight: f.weight ?? '400', style: f.style ?? 'normal' }).load()));
  for (const f of loaded) document.fonts.add(f);
  return loaded;
}
