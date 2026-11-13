import { describe, expect, it } from 'vitest';
import { BEAT_10, BEAT_11, BEAT_4, FILM_FRAMES, WORDS, at, cue } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { E5 } from './beat5.ts';
import { E6 } from './beat6.ts';
import { EASE_OUT_D, TO_BOOKEND, TO_REGISTER, TO_SHEET, TO_VELLUM, cameraAt, project } from './camera.ts';
import { SAFE } from '../look/tokens.ts';
import { ACT2_TAGS, BUILT_TAG_Y, CACHE_LEADER_BACK, CACHE_LEADER_UNTIL, LABELS_7, LABELS_10, LABELS_AFTER_CARDS, LABELS_D, PART1_TO, PART2_BEATS, SEAM_D, SEGMENTS, SUMMARY_BUILT_TO, SUMMARY_TAGS, TAG_BUILT_LINES, act2LabelsAt, builtAt, keepFilm, segmentAt, segmentSpan, summaryLabelsAt } from './film.ts';
import { keepTeaching } from './marks.ts';
import { ROLE_LABELS, TAG_GAP, TAG_LEADER_FADE, TAG_MID, tagLayout, tagLeaderOpacity, tagText } from './Overlay.tsx';
import { REEL_FRAME } from './layout.ts';
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
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-built')!;
    expect(t.lines).toBe(TAG_BUILT_LINES);
    expect(t.at[1]).toBe(BUILT_TAG_Y);
    // its last line's baseline far above the notes (they start at y 880)
    expect(t.at[1] + (tagText(t).en.length + tagText(t).zh.length - 1) * TAG_GAP).toBeLessThan(400);
  });

  it('lays every tag’s block (its EN alone) inside title-safe, its leader leaving the block’s side nearest its foot, the built tag’s level', () => {
    // (about 20 px a character at 40 px: the cache tag's 38 characters measure 745 px on the render)
    const measure = (x: string) => 20 * x.length;
    for (const t of [...ACT2_TAGS, ...SUMMARY_TAGS]) {
      const f = t.from ?? cue(t.cue).frame;
      const foot = project(cameraAt(f, 15), t.foot);
      const L = tagLayout(t, foot, measure);
      const id = t.id ?? t.cue;
      expect(L.zh, id).toEqual([]);
      expect(L.x0, id).toBeGreaterThanOrEqual(SAFE.x - 8);
      expect(L.x0 + L.w, id).toBeLessThanOrEqual(SAFE.right + 8);
      // (its ascenders, 0.75 of its 40 px over the first baseline, inside title-safe)
      expect(t.at[1] - 30, id).toBeGreaterThanOrEqual(SAFE.y);
      expect(L.bottom, id).toBeLessThanOrEqual(880);
      // the leader's end at the text: on the block's edge (a side, its top or its bottom)
      const [lx, ly] = L.l;
      const onSide = lx <= L.x0 - 8 + 1e-9 || lx >= L.x0 + L.w + 8 - 1e-9;
      expect(onSide || ly === L.top || ly >= L.top, id).toBe(true);
      if (onSide) {
        expect(ly, id).toBeGreaterThanOrEqual(L.top);
        expect(ly, id).toBeLessThanOrEqual(L.bottom);
      }
    }
    // (the load tag's drops at an angle: beat8.test.ts)
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-built')!;
    const foot = project(cameraAt(cue(t.cue).frame, 15), t.foot);
    expect(Math.abs(tagLayout(t, foot, measure).l[1] - foot[1])).toBeLessThanOrEqual(6);
    // ... from its last line's middle (TAG_MID over the baseline), on the reel frame's east post
    expect(Math.abs(foot[1] - (t.at[1] + 2 * TAG_GAP - TAG_MID))).toBeLessThanOrEqual(3);
    expect(t.foot[1]).toBeGreaterThan(REEL_FRAME[2]!.y0);
    expect(t.foot[1]).toBeLessThan(REEL_FRAME[2]!.y1);
  });

  it('sets the built tag well apart from the Router label under it, so the two never read as one block (T-rv-02)', () => {
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-built')!;
    const f = cue(t.cue).frame;
    const router = act2LabelsAt(f).find((l) => l.text === WORDS.router.en)!;
    const pose = cameraAt(f, 15);
    // the Router label's baseline (Overlay.tsx leaderOf: its foot plus its offset), its caps about 29 px over it
    const rFoot = project(pose, router.foot);
    const routerTop = rFoot[1] + router.dy - 29;
    const last = t.at[1] + (tagText(t).en.length - 1) * TAG_GAP;
    // clear air from the tag's last baseline to the label's caps: three times the tag's own (50 px leading, 29 px caps)
    expect(routerTop - last).toBeGreaterThanOrEqual(3 * (TAG_GAP - 29));
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

  it('opts only the idea labels into the leader-then-wipe reveal (every other tag reveals as before)', () => {
    expect(ACT2_TAGS.every((t) => t.reveal === undefined)).toBe(true);
    expect(SUMMARY_TAGS.filter((t) => t.reveal === 'leader').every((t) => t.cue === 'ideas')).toBe(true);
    expect(SUMMARY_TAGS.filter((t) => t.cue !== 'ideas').every((t) => t.reveal === undefined)).toBe(true);
  });

  it('takes the labels away over bar 50’s truck and brings them back for still (d)’s framing once bar 58 has landed, then over bar 65’s dolly', () => {
    expect(act2LabelsAt(TO_SHEET.from + 3).every((l) => l.opacity === 0.5)).toBe(true);
    expect(act2LabelsAt(TO_SHEET.from + 6)).toEqual([]);
    expect(act2LabelsAt(TO_VELLUM.to + 1)).toEqual([]);
    expect(act2LabelsAt(TO_VELLUM.to + 2)[0]).toMatchObject({ text: LABELS_D[0]!.text, leader: 0, wipe: 0 });
    expect(act2LabelsAt(TO_VELLUM.to + 40)).toEqual([...LABELS_D]);
    expect(act2LabelsAt(TO_REGISTER.from + 3).map((l) => l.foot)).toEqual(LABELS_D.map((l) => l.foot));
    expect(act2LabelsAt(TO_REGISTER.from + 20)).toEqual([]);
    // they wait for 10.2's Fix cards and their step to be gone (the cards slide away over 8 f from their exit; the step
    // ramps back over 14 f from the frame after it), and for the windings' "?"
    expect(act2LabelsAt(LABELS_AFTER_CARDS - 1)).toEqual([]);
    expect(LABELS_AFTER_CARDS).toBeGreaterThanOrEqual(BEAT_10.cards.exit + 1 + 14);
    expect(LABELS_AFTER_CARDS).toBeGreaterThan(BEAT_10.windings + 9);
    expect(act2LabelsAt(LABELS_AFTER_CARDS)[0]).toMatchObject({ text: LABELS_10[0]!.text, leader: 0, wipe: 0 });
    expect(act2LabelsAt(LABELS_AFTER_CARDS + 18)).toEqual([...LABELS_10]);
    // "Router" names the deck from its north-west corner as beat 7's does (off the Thread cord); the others are part 1's
    expect(LABELS_10.filter((l, i) => l !== ROLE_LABELS[i]).map((l) => l.text)).toEqual([WORDS.router.en]);
    expect(LABELS_10.find((l) => l.text === WORDS.router.en)).toEqual(LABELS_7.find((l) => l.text === WORDS.router.en));
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

describe('the cache tag and the reading thread (A17)', () => {
  it('fades the tag’s leader out before the thread’s last hop leaves its foot, long after still (c)', async () => {
    const { E6 } = await import('./beat6.ts');
    const tag = ACT2_TAGS.find((t) => t.cue === 'tag-cache')!;
    expect(tag.leaderUntil).toBe(CACHE_LEADER_UNTIL);
    expect(CACHE_LEADER_UNTIL + TAG_LEADER_FADE).toBeLessThanOrEqual(E6.hops[2]! - E6.hopFrames);
    expect(CACHE_LEADER_UNTIL).toBeGreaterThan(3150 + 100);
    expect(tagLeaderOpacity(tag, E6.hops[2]! - E6.hopFrames)).toBe(0);
    // it fades back in once the hop has landed, whole well before the tag's fade
    expect(tag.leaderBack).toBe(CACHE_LEADER_BACK);
    expect(CACHE_LEADER_BACK).toBeGreaterThan(E6.hops[2]!);
    expect(CACHE_LEADER_BACK + TAG_LEADER_FADE).toBeLessThan(cue('tag-cache').end! - 6);
  });

  it('never cuts the leader short: on every frame of the tag’s window it is whole (foot to block) or not drawn, its opacity stepping at most 1/6 a frame (R2-L2-09)', () => {
    const tag = ACT2_TAGS.find((t) => t.cue === 'tag-cache')!;
    const [a, b] = [cue('tag-cache').frame - 6, cue('tag-cache').end! + 6];
    for (let f = a; f <= b; f++) {
      const o = tagLeaderOpacity(tag, f);
      expect(o, `f${f}`).toBeGreaterThanOrEqual(0);
      expect(o, `f${f}`).toBeLessThanOrEqual(1);
      expect(Math.abs(o - tagLeaderOpacity(tag, f - 1)), `f${f}`).toBeLessThanOrEqual(1 / TAG_LEADER_FADE + 1e-9);
    }
    // the layout's leader is one segment from the foot to the block's edge: no part of the drawer shortens it with the fade
    const L = tagLayout(tag, [903, 340], (x) => 21 * x.length);
    expect(L.l[0]).toBe(L.x0 - 8);
  });
});
