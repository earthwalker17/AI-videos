import { describe, expect, it } from 'vitest';
import { BEAT_10, BEAT_11, BEAT_4, FILM_FRAMES, WORDS, at } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { E5 } from './beat5.ts';
import { E6 } from './beat6.ts';
import { EASE_OUT_D, TO_BOOKEND, TO_REGISTER, TO_SHEET, TO_VELLUM } from './camera.ts';
import { ACT2_TAGS, LABELS_7, LABELS_D, PART1_TO, PART2_BEATS, SEAM_D, SEGMENTS, SUMMARY_BUILT_TO, SUMMARY_TAGS, TAG_BUILT_LINES, act2LabelsAt, builtAt, keepFilm, segmentAt, segmentSpan, summaryLabelsAt } from './film.ts';
import { keepTeaching } from './marks.ts';
import { ROLE_LABELS, TAG_GAP } from './Overlay.tsx';
import { TURN_SPAN } from './turn.ts';

describe('the film’s segments', () => {
  it('cover every film frame once, in order, with no gap', () => {
    expect(SEGMENTS[0]!.from).toBe(0);
    expect(SEGMENTS[SEGMENTS.length - 1]!.to).toBe(FILM_FRAMES);
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i]!.from).toBe(SEGMENTS[i - 1]!.to);
  });

  it('draw each signed-off still through the frame component it was signed off through', () => {
    expect(segmentAt(ROUND2.stillA)).toBe('actOne');
    expect(segmentAt(1500)).toBe('turn');
    expect(segmentAt(TURN_SPAN[1])).toBe('turn');
    expect(segmentAt(TURN_SPAN[1] + 1)).toBe('act2');
    expect(segmentAt(ROUND2.stillB)).toBe('act2');
    expect(segmentAt(ROUND2.stillC)).toBe('act2');
    expect(segmentAt(ROUND2.stillD)).toBe('summary');
    expect(segmentSpan('turn')).toEqual(TURN_SPAN);
  });
});

describe('act two’s DOM layer', () => {
  it('shows still (b)’s three role labels landed, as the lookdev still drew them', () => {
    expect(act2LabelsAt(ROUND2.stillB)).toEqual([...ROLE_LABELS]);
  });

  it('brings the Worker label in on its cue, its leader first', () => {
    const worker = (f: number) => act2LabelsAt(f).find((l) => l.text === WORDS.worker.en);
    expect(worker(BEAT_4.workerLabel - 1)).toBeUndefined();
    expect(worker(BEAT_4.workerLabel + 3)).toMatchObject({ leader: 0.5, wipe: 0 });
    expect(worker(BEAT_4.workerLabel + 20)).toEqual(ROLE_LABELS.find((l) => l.text === WORDS.worker.en));
  });

  it('takes every label away over the dolly onto the throat and brings them back once the ease-out has settled', () => {
    expect(act2LabelsAt(2643).every((l) => l.opacity !== undefined && l.opacity < 1)).toBe(true);
    expect(act2LabelsAt(ROUND2.stillC)).toEqual([]);
    expect(act2LabelsAt(3441)).toEqual([]);
    // they re-enter as beat 7's (session 5: the Router label leaves the Thread cord's descent, the Worker label names the
    // request's bay; nothing before f3442 changes, still (b) keeps ROLE_LABELS)
    expect(act2LabelsAt(3480)).toEqual([...LABELS_7]);
    expect(LABELS_7.filter((l, i) => l !== ROLE_LABELS[i]).map((l) => l.text)).toEqual([WORDS.router.en, WORDS.worker.en]);
  });

  it('places act two’s three tags (part 1’s; part 2’s beat modules add theirs after them)', () => {
    expect(ACT2_TAGS.slice(0, 3).map((t) => t.cue)).toEqual(['tag-built', 'tag-gate', 'tag-cache']);
  });

  it('sets the built tag on lines broken where its own words break, never re-worded, clear of the notes band', () => {
    expect(TAG_BUILT_LINES.en.join(' ')).toBe(WORDS.tagBuilt.en);
    expect(TAG_BUILT_LINES.zh.join('')).toBe(WORDS.tagBuilt['zh-Hans']);
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-built')!;
    expect(t.lines).toBe(TAG_BUILT_LINES);
    // its last line's baseline far above the notes (they start at y 880)
    expect(t.at[1] + (t.lines!.en.length + t.lines!.zh.length - 1) * TAG_GAP).toBeLessThan(400);
  });

  it('prints still (b)’s strings as keepTeaching did', () => {
    for (const s of ['#0408', 'W-08 #0408', '14:02', 'ok', 'W-09']) expect(keepFilm(s), s).toBe(keepTeaching(s));
  });
});

describe('part 2’s frame plumbing (wave 0, session 5)', () => {
  it('hands act two over to the summary’s world inside bar 68’s stillness (SEAM_D), beats 5 and 6 with it', () => {
    expect(SEAM_D).toBe(5424);
    expect(SEAM_D).toBeGreaterThan(BEAT_10.replyLands);
    expect(SEAM_D).toBeLessThan(BEAT_11.stamp - 8);
    expect(segmentAt(SEAM_D - 1)).toBe('act2');
    expect(segmentAt(SEAM_D)).toBe('summary');
    expect(E5.until).toBe(SEAM_D);
    expect(E6.until).toBe(SEAM_D);
    expect(segmentSpan('summary')[0]).toBe(SEAM_D);
  });

  it('marks a frame built only in part 1, the summary’s sign-off, or a beat whose module says BUILT', () => {
    expect(PART2_BEATS.map((b) => b.from)).toEqual([at(44), at(50), at(58), at(63), at(69), at(76)]);
    for (let i = 1; i < PART2_BEATS.length; i++) expect(PART2_BEATS[i]!.from).toBe(PART2_BEATS[i - 1]!.to);
    expect(PART2_BEATS[PART2_BEATS.length - 1]!.to).toBe(FILM_FRAMES);
    expect(builtAt(PART1_TO - 1)).toBe(true);
    expect(builtAt(ROUND2.stillD)).toBe(true);
    for (const b of PART2_BEATS) for (const f of [b.from, b.to - 1]) if (f < SEAM_D || f >= SUMMARY_BUILT_TO) expect(builtAt(f), `${b.id} f${f}`).toBe(b.built);
  });

  it('takes the labels away over bar 50’s truck and brings them back for still (d)’s framing once bar 58 has landed, then over bar 65’s dolly', () => {
    expect(act2LabelsAt(TO_SHEET.from + 3).every((l) => l.opacity === 0.5)).toBe(true);
    expect(act2LabelsAt(TO_SHEET.from + 6)).toEqual([]);
    expect(act2LabelsAt(TO_VELLUM.to + 1)).toEqual([]);
    expect(act2LabelsAt(TO_VELLUM.to + 2)[0]).toMatchObject({ text: LABELS_D[0]!.text, leader: 0, wipe: 0 });
    expect(act2LabelsAt(TO_VELLUM.to + 40)).toEqual([...LABELS_D]);
    expect(act2LabelsAt(TO_REGISTER.from + 3).map((l) => l.foot)).toEqual(LABELS_D.map((l) => l.foot));
    expect(act2LabelsAt(TO_REGISTER.from + 20)).toEqual([]);
    expect(act2LabelsAt(TO_REGISTER.to + 40)).toEqual([...ROLE_LABELS]);
  });

  it('changes no label at the seam, fades them over the stamp, lands still (d)’s, and takes them away over bar 76’s move', () => {
    expect(summaryLabelsAt(SEAM_D)).toEqual(act2LabelsAt(SEAM_D - 1));
    expect(summaryLabelsAt(EASE_OUT_D.from + 3).every((l) => l.opacity === 0.5)).toBe(true);
    expect(summaryLabelsAt(ROUND2.stillD)).toEqual([...LABELS_D]);
    expect(summaryLabelsAt(5719)).toEqual([...LABELS_D]);
    expect(summaryLabelsAt(TO_BOOKEND.from + 3).every((l) => l.opacity === 0.5)).toBe(true);
    expect(summaryLabelsAt(TO_BOOKEND.to)).toEqual([]);
  });

  it('places part 2’s tags from the beat modules, each with an id of its own', () => {
    const ids = [...ACT2_TAGS, ...SUMMARY_TAGS].map((t) => t.id ?? t.cue);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
