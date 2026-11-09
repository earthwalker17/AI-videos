import { describe, expect, it } from 'vitest';
import { BEAT_4, FILM_FRAMES, WORDS } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { ACT2_TAGS, SEGMENTS, act2LabelsAt, keepFilm, segmentAt, segmentSpan } from './film.ts';
import { keepTeaching } from './marks.ts';
import { ROLE_LABELS } from './Overlay.tsx';
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
    expect(act2LabelsAt(3480)).toEqual([...ROLE_LABELS]);
  });

  it('places act two’s three tags', () => {
    expect(ACT2_TAGS.map((t) => t.cue)).toEqual(['tag-built', 'tag-gate', 'tag-cache']);
  });

  it('prints still (b)’s strings as keepTeaching did', () => {
    for (const s of ['#0408', 'W-08 #0408', '14:02', 'ok', 'W-09']) expect(keepFilm(s), s).toBe(keepTeaching(s));
  });
});
