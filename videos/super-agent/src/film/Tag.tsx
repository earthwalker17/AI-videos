/**
 * A tag (the built, gate, proposed and chart tags; the token header): two lines in screen space
 * at a world anchor, EN in ink over zh in the zh tone, 40 px labels over a ground-colour knockout,
 * standing above the anchor (beside what it qualifies), starting at it or ending at it. Put it in
 * a ScreenLayer.
 */
import { AnchoredLabel, type Pt } from '../kit/camera.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { C } from '../look/tokens.ts';
import { labelLook } from './style.ts';

/** Screen px from the anchor to each line's baseline: the zh line sits just above it, the EN line over that. */
export const TAG_LINES = { en: -60, zh: -16 } as const;

export function Tag({ fonts, at, words, opacity, anchor = 'start' }: { fonts: FilmFonts; at: Pt; words: { en: string; 'zh-Hans': string }; opacity?: number; anchor?: 'start' | 'end' }) {
  const look = labelLook(fonts);
  return (
    <>
      <AnchoredLabel at={at} dy={TAG_LINES.en} anchor={anchor} text={words.en} {...look} opacity={opacity} />
      <AnchoredLabel at={at} dy={TAG_LINES.zh} anchor={anchor} text={words['zh-Hans']} {...look} color={C.zh} opacity={opacity} />
    </>
  );
}
