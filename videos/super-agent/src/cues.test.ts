import { requiredHoldS } from '@aiv/core';
import { describe, expect, it } from 'vitest';
import { BAR, BARS, BEAT, CARD_BLOCKS, cues, FILM_FRAMES, FPS, LINES, SECTIONS, sectionSpan, type Line, type Sec } from './cues.ts';

const seconds = (frames: number) => frames / FPS;
const blocks = new Map<string, Line[]>();
for (const l of LINES) blocks.set(l.block, [...(blocks.get(l.block) ?? []), l]);
const span = (ls: Line[]): [number, number] => [Math.min(...ls.map((l) => l.frame)), Math.max(...ls.map((l) => l.end))];

/** Blocks that may share the screen: a stamp that stays while the next headline lands. */
const MAY_OVERLAP: Array<[string, string]> = [['notyou', 'decide']];

describe('the cue sheet', () => {
  it('is 80 bars of 120 frames: 2:40 at 60 fps and 120 bpm', () => {
    expect(BAR).toBe(120);
    expect(FILM_FRAMES).toBe(BARS * BAR);
    expect(seconds(FILM_FRAMES)).toBe(160);
    expect(cues.filmFrames + cues.leaderFrames).toBe(9630);
    // a bar is a whole number of frames, or the pipeline's bar-line checks cannot hold
    expect((FPS * 60 * cues.grid!.beatsPerBar) / cues.grid!.bpm).toBe(BAR);
  });

  it('has unique line ids, and every line is inside the film and inside its section', () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    for (const l of LINES) {
      const [from, to] = sectionSpan(l.sec);
      expect(l.frame, l.id).toBeGreaterThanOrEqual(from);
      expect(l.end, l.id).toBeLessThanOrEqual(to);
      expect(l.end, l.id).toBeLessThanOrEqual(FILM_FRAMES);
    }
  });

  it('keeps sections in order, each starting on a beat', () => {
    const starts = Object.values(SECTIONS);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (const [s, f] of Object.entries(SECTIONS) as Array<[Sec, number]>) expect(f % BEAT, s).toBe(0);
  });

  it('lands every line on a beat or a half beat, and lets it go on one', () => {
    for (const l of LINES) {
      expect(l.frame % (BEAT / 2), l.id).toBe(0);
      expect(l.end % (BEAT / 2), l.id).toBe(0);
    }
  });

  it('holds every line for at least max(1.8 s, reading time + 0.6 s)', () => {
    for (const l of LINES) expect(seconds(l.end - l.frame), `${l.id}: "${l.text}"`).toBeGreaterThanOrEqual(requiredHoldS(l.text) - 1e-9);
  });

  it('holds every block long enough to read all of it', () => {
    for (const [id, ls] of blocks) {
      const [from, to] = span(ls);
      const all = ls.map((l) => l.text).join(' ');
      expect(seconds(to - from), `block ${id}: "${all}"`).toBeGreaterThanOrEqual(requiredHoldS(all) - 1e-9);
    }
  });

  it('shows one block at a time', () => {
    const list = [...blocks.entries()].map(([id, ls]) => ({ id, span: span(ls) }));
    for (const a of list) {
      for (const b of list) {
        if (a.id >= b.id) continue;
        if (MAY_OVERLAP.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id))) continue;
        const overlap = Math.min(a.span[1], b.span[1]) - Math.max(a.span[0], b.span[0]);
        expect(overlap, `${a.id} and ${b.id} overlap`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('keeps cards up for at least 4 s', () => {
    for (const id of CARD_BLOCKS) {
      const [from, to] = span(blocks.get(id)!);
      expect(seconds(to - from), id).toBeGreaterThanOrEqual(4);
    }
  });

  it('spends at least half the film on how the design works', () => {
    const how = SECTIONS.evidence - SECTIONS.levels;
    expect(how / FILM_FRAMES).toBeGreaterThanOrEqual(0.5);
  });

  it('leaves reading room: outside the two cards, minimum holds take under 75% of the time', () => {
    let need = 0;
    let cards = 0;
    for (const [id, ls] of blocks) {
      if (CARD_BLOCKS.includes(id)) {
        const [from, to] = span(ls);
        cards += seconds(to - from);
      } else need += requiredHoldS(ls.map((l) => l.text).join(' '));
    }
    expect(need / (seconds(FILM_FRAMES) - cards)).toBeLessThan(0.75);
  });

  it('uses one word for events: no "trigger" on screen', () => {
    for (const l of LINES) expect(l.text.toLowerCase(), l.id).not.toContain('trigger');
  });

  it('never shows a duration in minutes, or a product claim', () => {
    // the authors' test clock is unstated and its chart is time-scaled: a rate "a minute" is fine,
    // a number of minutes is not
    for (const l of LINES) {
      expect(l.text, l.id).not.toMatch(/[0-9] *min(ute)?s?(?![a-z])/i);
      expect(l.text.toLowerCase(), l.id).not.toContain('launch');
    }
  });

  it('parses as a CueSheet with hits on beats', () => {
    for (const e of cues.events) if (e.kind === 'hit') expect(e.frame % BEAT, e.id).toBe(0);
    expect(cues.events.filter((e) => e.kind === 'card').map((e) => e.id)).toEqual(['title', 'end.t']);
  });
});
