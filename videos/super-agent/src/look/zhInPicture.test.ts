import { describe, expect, it } from 'vitest';
import { NARRATION, WORDS, type WordsId } from '../cues.ts';
import { ACT_ONE_LABELS, TITLE_CARD } from '../desk/ActOneFrame.tsx';
import { KEY_LINES } from '../desk/beat11.ts';
import { END_CARD } from '../desk/endCard.ts';
import { ACT2_TAGS, SUMMARY_TAGS } from '../desk/film.ts';
import { plateLine, stressText } from '../desk/gl/plate.ts';
import { SHEET_TEXT } from '../desk/gl/print8.ts';
import { ROLE_LABELS, tagText } from '../desk/Overlay.tsx';
import { ZH_IN_PICTURE, hasHan, pictureLine, zhInPicture } from './zhInPicture.ts';

const TRAITS = [WORDS.traitContinuous, WORDS.traitProactive, WORDS.traitProductive, WORDS.traitPersistent];

describe('the zh policy (the user, 2026-11-13 and 2026-11-14)', () => {
  it('keeps the zh of the short text only: the role label "you", the four trait plates, the title card, the end card', () => {
    expect([...ZH_IN_PICTURE].sort()).toEqual(['end', 'title', 'traitContinuous', 'traitPersistent', 'traitProactive', 'traitProductive', 'you']);
    for (const id of ZH_IN_PICTURE) {
      expect(zhInPicture(WORDS[id]), id).toBe(WORDS[id]['zh-Hans']);
      expect(hasHan(WORDS[id]['zh-Hans']), id).toBe(true);
    }
    // every other string draws its EN alone (its zh stays in the cue sheet, signed off)
    for (const id of Object.keys(WORDS) as WordsId[]) if (!(ZH_IN_PICTURE as readonly string[]).includes(id)) expect(zhInPicture(WORDS[id]), id).toBeNull();
    // only the cue sheet's own objects count: a copy draws no zh
    expect(zhInPicture({ ...WORDS.you })).toBeNull();
    expect(pictureLine(WORDS.you)).toBe('you · 你');
    expect(pictureLine(WORDS.tagGate)).toBe(WORDS.tagGate.en);
  });

  it('holds every drawer of the long text to it: no tag, idea label, chart print, stress plate line, key row or caption draws a Han glyph', () => {
    for (const t of [...ACT2_TAGS, ...SUMMARY_TAGS]) {
      const { en, zh } = tagText(t);
      expect(zh, t.id ?? t.cue).toEqual([]);
      for (const l of en) expect(hasHan(l), `${t.id ?? t.cue}: ${l}`).toBe(false);
    }
    for (const l of SHEET_TEXT) expect(hasHan(l), l).toBe(false);
    for (const l of stressText({ head: WORDS.plateHead, arrivals: WORDS.plateArrivals, decision: WORDS.plateDecision })) expect(hasHan(l), l).toBe(false);
    for (const l of KEY_LINES) expect(hasHan(l), l).toBe(false);
    for (const id of [...NARRATION, 'credit'] as const) expect(zhInPicture(WORDS[id]), id).toBeNull();
  });

  it('still draws the kept set: "you · 你", the trait plates and Persistent’s vellum words, the title card, the end card’s body', () => {
    expect(ROLE_LABELS.map((l) => l.text)).toContain('you · 你');
    expect(ACT_ONE_LABELS[0]!.text).toBe('you · 你');
    for (const w of TRAITS) expect(plateLine(w)).toBe(`${w.en} · ${w['zh-Hans']}`);
    expect(TITLE_CARD.lines.map((l) => l.text)).toContain(WORDS.title['zh-Hans']);
    const card = END_CARD.lines.map((l) => l.text);
    for (const l of WORDS.end['zh-Hans'].split('\n')) expect(card).toContain(l);
  });
});
