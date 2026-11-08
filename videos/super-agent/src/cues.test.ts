// The cue sheet's craft rules (TREATMENT.md, Grid; docs/PRODUCTION.md, readable text). It runs in
// the picture's lint scope, so it imports only @aiv/core and the sheet.
import { describe, expect, it } from 'vitest';
import { requiredHoldS, type CueEvent } from '@aiv/core';
import { BAR, BEAT, BEATS, FILM_FRAMES, FPS, NARRATION, TEXT_IN, TEXT_OUT, WORDS, at, cue, cues, textWindow, type Words } from './cues.ts';

/** Hold margin over max(1.8 s, reading + 0.6 s): the treatment's rule, in both languages. */
const MARGIN_S = 0.1;
const EIGHTH = BEAT / 2;
/** One English line of the notes block (IBM Plex Sans 48 px in at most 1560 px). */
const EN_MAX_CHARS = 62;
/** One zh-Hans line, in CJK widths: an ideograph or full-width mark is 1, anything else ½. */
const ZH_MAX_WIDTH = 34;
/** A title or end card stays up at least this long: the audio stage's `card.length` check (MIN_CARD_S in @aiv/pipeline, which this scope may not import). */
const MIN_CARD_S = 4;

const FULL_WIDTH = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;
const zhWidth = (s: string): number => [...s].reduce((w, ch) => w + (FULL_WIDTH.test(ch) ? 1 : 0.5), 0);
const heldS = (e: CueEvent): number => ((e.end ?? e.frame) - e.frame) / FPS;
const shownCues = cues.events.filter((e) => e.kind === 'text' || e.kind === 'card');
const narration = NARRATION.map((id) => cue(id));
const overlaps = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] < b[1] && b[0] < a[1];

/** The beat each narration line belongs to (TREATMENT.md, the chosen treatment). */
const BEAT_OF: Record<string, number> = {
  ...Object.fromEntries(['c1'].map((id) => [id, 1])),
  ...Object.fromEntries(['c2', 'c3', 'c4'].map((id) => [id, 2])),
  ...Object.fromEntries(['c5', 'c6', 'c7'].map((id) => [id, 3])),
  ...Object.fromEntries(['c8', 'c9', 'c10', 'c11', 'c12', 'c13'].map((id) => [id, 4])),
  ...Object.fromEntries(['c14', 'c15', 'c16', 'c17', 'c18'].map((id) => [id, 5])),
  ...Object.fromEntries(['c19', 'c20', 'c21', 'c22', 'c23'].map((id) => [id, 6])),
  ...Object.fromEntries(['c24', 'c25'].map((id) => [id, 7])),
  ...Object.fromEntries(['c26', 'c27'].map((id) => [id, 8])),
  ...Object.fromEntries(['c28'].map((id) => [id, 9])),
};
/** [start, end) frames of beat n (1-based). */
const beatSpan = (n: number): [number, number] => [at(BEATS[n - 1]!.bar), n < BEATS.length ? at(BEATS[n]!.bar) : FILM_FRAMES];

describe('the super-agent cue sheet', () => {
  it('is 66 bars of 4/4 at 90 bpm: exactly 5280 frames at 30 fps', () => {
    expect([FPS, BEAT, BAR, FILM_FRAMES]).toEqual([30, 20, 80, 5280]);
    expect(cues.filmFrames).toBe(5280);
    expect(cues.grid).toMatchObject({ bpm: 90, beatsPerBar: 4, offsetFrames: 0 });
  });

  it('holds every text and card cue for max(1.8 s, reading + 0.6 s) + 0.1 s in every language it has', () => {
    const short: string[] = [];
    for (const e of shownCues) {
      expect(e.text && Object.keys(e.text).sort(), e.id).toEqual(['en', 'zh-Hans']);
      for (const [lang, s] of Object.entries(e.text!)) {
        const need = requiredHoldS(s) + MARGIN_S;
        if (heldS(e) + 1e-9 < need) short.push(`${e.id} [${lang}] held ${heldS(e).toFixed(2)} s < ${need.toFixed(2)} s`);
      }
    }
    expect(short).toEqual([]);
  });

  it('holds every card for at least 4 s', () => {
    const cards = cues.events.filter((e) => e.kind === 'card');
    expect(cards.map((e) => e.id)).toEqual(['title', 'end']);
    for (const e of cards) expect(heldS(e), e.id).toBeGreaterThanOrEqual(MIN_CARD_S);
  });

  it('keeps every span, and every text window with its wipe and fade, inside the film', () => {
    for (const e of cues.events) {
      expect(e.frame, e.id).toBeGreaterThanOrEqual(0);
      expect(e.end ?? e.frame, e.id).toBeLessThanOrEqual(FILM_FRAMES);
    }
    for (const e of shownCues) {
      const [a, b] = textWindow(e);
      expect(a, e.id).toBeGreaterThanOrEqual(0);
      expect(b, e.id).toBeLessThanOrEqual(FILM_FRAMES);
    }
  });

  it('has 28 narration lines whose windows start on eighths and never overlap', () => {
    expect(narration.map((e) => e.kind)).toEqual(Array(28).fill('text'));
    for (const e of narration) expect(textWindow(e)[0] % EIGHTH, e.id).toBe(0);
    const sorted = [...narration].sort((x, y) => x.frame - y.frame);
    expect(sorted.map((e) => e.id)).toEqual([...NARRATION]);
    for (let i = 1; i < sorted.length; i++) expect(overlaps(textWindow(sorted[i - 1]!), textWindow(sorted[i]!)), `${sorted[i - 1]!.id} / ${sorted[i]!.id}`).toBe(false);
  });

  it('keeps each narration window inside its own beat', () => {
    for (const e of narration) {
      const [a, b] = beatSpan(BEAT_OF[e.id]!);
      const [from, to] = textWindow(e);
      expect(from, e.id).toBeGreaterThanOrEqual(a);
      expect(to, e.id).toBeLessThanOrEqual(b);
    }
  });

  it('marks every beat on its downbeat', () => {
    for (const b of BEATS) expect(cue(b.id)).toMatchObject({ kind: 'mark', frame: at(b.bar) });
    expect(BEATS.map((b) => b.bar)).toEqual([1, 6, 11, 17, 28, 37, 46, 50, 57]);
  });

  it('sets every line within the notes block: EN at most 62 characters, zh-Hans at most 34 CJK widths', () => {
    const long: string[] = [];
    for (const [id, w] of Object.entries(WORDS) as [string, Words][]) {
      for (const s of (w.en ?? '').split('\n')) if ([...s].length > EN_MAX_CHARS) long.push(`${id} [en] ${[...s].length}: ${s}`);
      for (const s of (w['zh-Hans'] ?? '').split('\n')) if (zhWidth(s) > ZH_MAX_WIDTH) long.push(`${id} [zh-Hans] ${zhWidth(s)}: ${s}`);
    }
    expect(long).toEqual([]);
  });

  it('writes the zh-Hans narration in the Netflix style: no commas or full stops, full-width ： and ？', () => {
    for (const id of NARRATION) {
      const zh = WORDS[id]['zh-Hans'];
      expect(zh, id).not.toMatch(/[，。、,.!！;；]/u);
      expect(zh, id).not.toMatch(/[:?]/u);
      expect(zh, id).not.toMatch(/\s{2}|^\s|\s$/u);
    }
  });

  it('draws the narration cues from WORDS, unchanged', () => {
    for (const id of NARRATION) expect(cue(id).text).toEqual(WORDS[id]);
  });

  it('keeps the rests free of text, and every sync hit on a beat', () => {
    const rests = cues.events.filter((e) => e.kind === 'rest');
    expect(rests.map((e) => e.id)).toEqual(['rest-breath', 'rest-27', 'rest-signoff', 'rest-tail']);
    for (const r of rests) for (const e of shownCues) expect(overlaps([r.frame, r.end!], textWindow(e)), `${r.id} / ${e.id}`).toBe(false);
    const hits = cues.events.filter((e) => e.kind === 'hit');
    // the sync points the sound design names (TREATMENT.md, Sound design)
    for (const id of ['request', 'turn', 'batch', 'flyover', 'intrusion', 'stamp', 'bookend']) expect(cue(id).kind, id).toBe('hit');
    for (const h of hits) expect(h.frame % BEAT, h.id).toBe(0);
  });

  it('sounds no hit inside a rest or a silence (QA measures both)', () => {
    const quiet = cues.events.filter((e) => e.kind === 'rest' || e.kind === 'silence');
    for (const h of cues.events.filter((e) => e.kind === 'hit')) for (const q of quiet) expect(h.frame >= q.frame && h.frame < q.end!, `${h.id} in ${q.id}`).toBe(false);
  });

  it('declares the treatment’s fixed points: the silence before the intrusion, the end-card hold, the built tag ending before C12', () => {
    expect(cue('silence-intrusion')).toMatchObject({ kind: 'silence', frame: at(48), end: at(48, 3) });
    expect(cue('intrusion').frame).toBe(at(48, 3));
    expect(cue('hold-end')).toMatchObject({ kind: 'hold', frame: at(60) });
    expect(cue('hold-end').end! - cue('hold-end').frame).toBeGreaterThanOrEqual(3 * FPS);
    expect(textWindow(cue('tag-built'))[1]).toBeLessThanOrEqual(textWindow(cue('c12'))[0]);
    expect(cue('request').frame).toBe(20);
    expect(cue('turn').frame).toBe(at(17));
    expect(cue('stamp').frame).toBe(at(51));
    expect([TEXT_IN, TEXT_OUT]).toEqual([6, 6]);
  });
});
