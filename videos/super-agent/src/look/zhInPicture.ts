/**
 * Which on-screen strings draw their zh in the picture: one policy, consulted by every drawer of a cues.ts WORDS string
 * (desk/Overlay.tsx's labels, tags and notes; gl/plate.ts's trait and stress plates; gl/print8.ts's evidence sheet;
 * objects/Proposed.tsx's vellum words; objects/Beat11.tsx's and objects/End.tsx's keys; endCard.ts's card). The zh copy of
 * every string stays signed off in WORDS, where the reading checks and the score read it; only what is drawn changes.
 *
 * The user's decisions:
 * - 2026-11-13: the film is published on YouTube only, so "remove the Chinese captions": no narration line and not the
 *   credit draws its zh (the notes block and the credit are the EN line alone).
 * - 2026-11-14, "Drop it from long plates (Recommended)": the long in-world text goes EN only (every tag and its leader
 *   block, the evidence sheet's print, the stress plate's header, the six idea labels, the map key and the end key); the
 *   short text keeps its zh: the role label "you · 你", the four trait plates (Persistent's vellum words with them), the
 *   title card and the end card's own body (the source).
 *
 * So ZH_IN_PICTURE lists the WORDS ids whose zh is drawn; every other id draws its EN alone. A layout built for EN only
 * (the tags' blocks, the sheet, the stress plate, the keys) relies on this list: the tests hold every drawer to it.
 */
import { WORDS, type WordsId } from '../cues.ts';

/** The WORDS ids whose zh the picture draws (the user, 2026-11-14): every other string is drawn in EN alone. */
export const ZH_IN_PICTURE = ['title', 'you', 'traitContinuous', 'traitProactive', 'traitProductive', 'traitPersistent', 'end'] as const satisfies readonly WordsId[];

/** A WORDS entry (by identity: the drawers pass the cue sheet's own objects). */
type Bilingual = { readonly en: string; readonly 'zh-Hans': string };
const KEPT = new Set<Bilingual>(ZH_IN_PICTURE.map((id) => WORDS[id]));

/**
 * The zh the picture draws for `words`, or null: the string's zh if its WORDS id is in ZH_IN_PICTURE and differs from its
 * EN (a string the same in both languages is drawn once), else null. A string that is not a WORDS entry draws no zh.
 */
export function zhInPicture(words: Bilingual): string | null {
  if (!KEPT.has(words)) return null;
  const zh = words['zh-Hans'];
  return zh === words.en ? null : zh;
}

/** A short bilingual line as the role label and the trait plates set it ("you · 你", "Continuous · 连续"), or the EN alone. */
export const pictureLine = (words: Bilingual): string => {
  const zh = zhInPicture(words);
  return zh === null ? words.en : `${words.en} · ${zh}`;
};

/** Han (and CJK punctuation, kana, full-width forms): what a drawer that sets EN only must never draw. */
const HAN = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3100-\u312F\u3190-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/u;
export const hasHan = (s: string): boolean => HAN.test(s);
