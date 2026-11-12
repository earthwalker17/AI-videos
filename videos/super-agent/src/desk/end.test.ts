import { describe, expect, it } from 'vitest';
import { BEAT, END, WORDS } from '../cues.ts';
import { SAFE } from '../look/tokens.ts';
import { KEEP_LAND, UNDER_HEAD } from './beat5.ts';
import { cameraAt, project } from './camera.ts';
import { BUILT, CI_TICK, E_END, HEAP_GONE, LAMP_END, STEP_UP, TAGS_END, TICKS, bookendSlipAt, cardsEnd, ciFeedAt, endAt, endDesk, footprintsEnd, heapGoneAt, nextSlipAt, poolsEnd, stepEnd, veilAt, youEnd } from './end.ts';
import { END_CARD, END_KEY, END_KEY_MOVE, END_KEY_OFF, END_KEY_SCREEN, END_TYPE, LEAVE, endCardAt, endKeyAt, endPools, endWorldFootprints } from './endCard.ts';
import { END_FROM, SEGMENTS, segmentAt, segmentSpan } from './film.ts';
import { KEY_BOX, KEY_SAMPLES } from './beat11.ts';
import { footprintsAt } from './footprints.ts';
import { FEEDERS, GATE } from './layout.ts';
import { CARD_T, cardCentre, cardCorners } from './objects/TitleCard.tsx';
import { poolsAt } from './pools.ts';
import type { DeskState, FocusId } from './state.ts';
import { summaryDeskState, summaryStep } from './summary.ts';
import { deskStateAt } from './state.ts';
import { YOU_POSE_B } from './you.ts';
import type { P3 } from './layout.ts';

/** Objects never move faster than 2410 px/s on screen (the brief's cap): px a frame at 30 fps. */
const CAP = 2410 / 30;
/** A part's step amount as desk.test reads it (the late set at 1 in part 2). */
const eff = (s: DeskState, id: FocusId): number => (s.step.late?.includes(id) ? s.testsStep : s.step.own?.ids.includes(id) ? s.step.own.amount : s.step.amount > 0 && s.step.ids.includes(id) ? s.step.amount : 0);

describe('beats 12-13: the bookend (end.ts)', () => {
  it('is built, and adds nothing before bar 76 (every hook returns its input; the summary state before f6000 is beat 11’s)', () => {
    expect(BUILT).toBe(true);
    expect(E_END.from).toBe(END.move[0]);
    expect(endAt(E_END.from - 1)).toBeNull();
    for (let f = 5424; f < E_END.from; f++) {
      const st = summaryStep(f);
      expect(stepEnd(f, st), `f${f}`).toBe(st);
      expect(summaryDeskState(f).step, `f${f}`).toEqual(st);
      expect(summaryDeskState(f).end, `f${f}`).toBeNull();
    }
    // endDesk hands back the very state it is given before bar 76 (so summaryDeskState is beat 11's, whatever it holds)
    for (const f of [0, 3000, 5424, 5999]) {
      const s = deskStateAt(f);
      expect(endDesk(f, s), `f${f}`).toBe(s);
      expect(heapGoneAt(f), `f${f}`).toBeNull();
    }
    for (let f = 5424; f < E_END.from; f++) expect(summaryDeskState(f).b4.heap.gone, `f${f}`).toBeUndefined();
    expect(LAMP_END).toEqual([]);
    expect(TAGS_END).toEqual([]);
    const s = summaryDeskState(6100);
    expect(cardsEnd(s)).toEqual([]);
    expect(poolsEnd(s)).toEqual([]);
    for (const f of [0, 3000, 6100, 6500]) expect(youEnd(f, YOU_POSE_B)).toBe(YOU_POSE_B);
  });

  it('starts from beat 11’s held step (everything but your desk on the main set at a full step, the intake on the own set at 1)', () => {
    for (let f = E_END.from; f < 6720; f++) {
      const st = summaryStep(f);
      expect(st.amount, `f${f}`).toBe(1);
      expect(st.ids, `f${f}`).toContain('gate');
      expect(st.ids, `f${f}`).toContain('belt');
      expect(st.own, `f${f}`).toEqual({ amount: 1, ids: ['intake'] });
    }
  });

  it('steps the intake, the gate and the belt back up over 14 f as the camera sets off for them, every other part as beat 11 left it', () => {
    const at = (f: number) => summaryDeskState(f);
    const before = at(E_END.from - 1);
    for (let f = E_END.from; f < 6200; f++) {
      const s = at(f);
      const prev = at(f - 1);
      for (const id of STEP_UP) {
        expect(Math.abs(eff(s, id) - eff(prev, id)), `f${f} ${id}`).toBeLessThanOrEqual(Math.PI / 28 + 1e-9);
        if (f <= E_END.stepUp) expect(eff(s, id), `f${f} ${id}`).toBe(1);
        if (f >= E_END.stepUp + 14) expect(eff(s, id), `f${f} ${id}`).toBe(0);
      }
      const ids = new Set<FocusId>([...before.step.ids, ...(before.step.own?.ids ?? []), ...(before.step.late ?? [])]);
      for (const id of ids) if (!STEP_UP.includes(id)) expect(eff(s, id), `f${f} ${id}`).toBe(eff(before, id));
    }
    expect(E_END.stepUp).toBe(END.move[0]);
  });

  it('turns the spout’s slip vermilion on the held frame, as act one’s f20 request, then posts it over the gate onto the belt on bookend.gate', () => {
    const T = END.bookend;
    // on the held frame (bar 77's downbeat, or a beat after it: the cue sheet's, everything here hangs off it)
    expect(T.turn).toBeGreaterThanOrEqual(END.move[1]);
    expect((T.turn - END.move[1]) % BEAT).toBe(0);
    for (let f = E_END.from; f <= E_END.antic; f++) expect(bookendSlipAt(f)!.pose.lying, `f${f}`).toBe(true);
    expect(bookendSlipAt(T.turn - 1)!.ink).toBe(0);
    expect(bookendSlipAt(T.turn)!.ink).toBeGreaterThan(0.3);
    expect(bookendSlipAt(E_END.antic)!.ink).toBeGreaterThan(0.98);
    // the gate passes it: it lands where beat 5's kept asks land, the whole slip past the gate's bar
    const land = bookendSlipAt(T.gate)!.pose;
    expect(land.p).toEqual(KEEP_LAND);
    expect(land.flying).toBe(false);
    expect(bookendSlipAt(T.gate - 1)!.pose.flying).toBe(true);
    // over the gate's bar it is clear above its cap (the bar 36 u, its cap 6 more)
    for (let f = E_END.post; f < T.gate; f++) {
      const p = bookendSlipAt(f)!.pose.p;
      if (p[0] > GATE.bar.x0 - 10 && p[0] < GATE.bar.x1 + 10) expect(p[2], `f${f}`).toBeGreaterThan(GATE.h + 8);
    }
  });

  it('rides it up the belt into the throat and feeds it wholly under the print head on bookend.out, out of sight in the Register, where the head stamps it in', () => {
    const T = END.bookend;
    expect(bookendSlipAt(T.out)!.pose.p).toEqual(UNDER_HEAD);
    expect(bookendSlipAt(T.out + 1)).toBeNull();
    expect(endAt(T.out + 1)!.slip).toBeNull();
    // the receipt: the print head's hammer comes down on a beat (the last tick), after the slip has gone under it, and goes back up
    expect((E_END.stamp - END.ticks.from) % BEAT).toBe(0);
    expect(E_END.stamp).toBeLessThanOrEqual(END.dissolve[0]);
    expect(E_END.stamp).toBeGreaterThan(T.out + 2);
    expect(summaryDeskState(E_END.stamp - 3).e6.hammer).toBe(0);
    expect(summaryDeskState(E_END.stamp).e6.hammer).toBe(1);
    expect(summaryDeskState(E_END.stamp + 4).e6.hammer).toBe(0);
  });

  it('presses the old heap into the slate during the move: its tone to the slate’s, then what is left of it fades, gone well before the camera lands', () => {
    const G = HEAP_GONE;
    expect(G.tone[0]).toBeGreaterThan(E_END.from);
    expect(G.fade[0]).toBeGreaterThan(G.tone[0]);
    expect(G.fade[1]).toBeLessThanOrEqual(END.move[1] - 20);
    expect(G.tone[1] - G.tone[0]).toBeGreaterThanOrEqual(14);
    expect(G.fade[1] - G.fade[0]).toBeGreaterThanOrEqual(14);
    let prev = heapGoneAt(E_END.from)!;
    expect(prev).toEqual({ tone: 0, fade: 0 });
    for (let f = E_END.from + 1; f < 6720; f++) {
      const g = heapGoneAt(f)!;
      expect(g.tone, `f${f}`).toBeGreaterThanOrEqual(prev.tone);
      expect(g.fade, `f${f}`).toBeGreaterThanOrEqual(prev.fade);
      expect(g.tone - prev.tone, `f${f}`).toBeLessThan(0.06);
      expect(g.fade - prev.fade, `f${f}`).toBeLessThan(0.08);
      prev = g;
    }
    // its tone is at the slate's before what is left of it fades much
    expect(heapGoneAt(G.fade[0] + 4)!.tone).toBeGreaterThan(0.95);
    expect(heapGoneAt(G.fade[1])).toEqual({ tone: 1, fade: 1 });
    expect(summaryDeskState(END.move[1]).b4.heap.gone).toEqual({ tone: 1, fade: 1 });
  });

  it('moves the slip at most 2410 px/s on screen (each corner), from its lift to the head', () => {
    const corners = (f: number): [number, number][] => {
      const p = bookendSlipAt(f)!.pose;
      const c = Math.cos(p.heading);
      const s = Math.sin(p.heading);
      return [
        [-48, -20],
        [48, -20],
        [48, 20],
        [-48, 20],
      ].map(([x, y]) => project(cameraAt(f, 15), [p.p[0] + x! * c - y! * s, p.p[1] + x! * s + y! * c, p.p[2] + x! * Math.sin(p.slope)]));
    };
    for (let f = E_END.antic + 1; f <= END.bookend.out; f++) {
      const a = corners(f - 1);
      const b = corners(f);
      for (let i = 0; i < 4; i++) expect(Math.hypot(b[i]![0] - a[i]![0], b[i]![1] - a[i]![1]), `f${f}`).toBeLessThanOrEqual(CAP);
    }
  });

  it('casts the slip’s footprint while it is off the spout (a carrier’s: no contact), none while it lies there', () => {
    expect(footprintsEnd(summaryDeskState(END.bookend.turn))).toEqual([]);
    const fp = footprintsEnd(summaryDeskState(END.bookend.gate - 5));
    expect(fp).toHaveLength(1);
    expect(fp[0]).toMatchObject({ kind: 'rect', contact: 0 });
    expect(footprintsEnd(summaryDeskState(END.bookend.out + 1))).toEqual([]);
  });

  it('ticks the feeders once a beat from bar 76 to bar 77’s last beat: the fed card a notch on each (staying in its mouth), the next slip out of the spout a third on each once the slip has gone', () => {
    // the fed card (84 u, centred 30 u east of the feeder's east face) keeps its west edge inside the mouth's slab (22 u east of it)
    expect(-12 + CI_TICK.step * TICKS.length).toBeLessThanOrEqual(22 - 2);
    expect(ciFeedAt(6719)).toBeCloseTo(CI_TICK.step * TICKS.length, 9);
    expect(FEEDERS.ci.x1).toBeLessThan(FEEDERS.ci.x1 + 22);
    expect(TICKS).toEqual(Array.from({ length: 8 }, (_, i) => END.ticks.from + i * BEAT));
    expect(TICKS[TICKS.length - 1]).toBe(END.ticks.to);
    for (const t of TICKS) {
      // the beat's own frame shows it moving (the tick sounds on it), and it is still between ticks
      if (t > E_END.from) expect(ciFeedAt(t), `t${t}`).toBeGreaterThan(ciFeedAt(t - 1));
      for (let f = t + 2; f < t + BEAT - 1; f++) expect(ciFeedAt(f + 1), `f${f}`).toBe(ciFeedAt(f));
    }
    expect(ciFeedAt(E_END.from)).toBeGreaterThan(0);
    expect(ciFeedAt(E_END.from - 1)).toBe(0);
    expect(nextSlipAt(END.bookend.gate - 1)).toBe(0);
    expect(nextSlipAt(END.ticks.to + 3)).toBeCloseTo(96, 9);
    for (const t of TICKS.filter((x) => x >= END.bookend.gate)) expect(nextSlipAt(t), `t${t}`).toBeGreaterThan(nextSlipAt(t - 1));
  });

  it('dissolves the world to the bare desk over the dissolve, complete on its last frame before the card lands', () => {
    expect(veilAt(END.dissolve[0])).toBe(0);
    expect(veilAt(END.dissolve[1] - 1)).toBe(1);
    for (let f = END.dissolve[0]; f < END.dissolve[1]; f++) expect(veilAt(f + 1)).toBeGreaterThanOrEqual(veilAt(f));
    // the end's own world takes over on the landing (film.ts SEGMENTS 'end')
    expect(END_FROM).toBe(END.card.land);
    expect(segmentAt(END.card.land - 1)).toBe('summary');
    expect(segmentAt(END.card.land)).toBe('end');
    expect(segmentSpan('end')).toEqual([END.card.land, 6719]);
    expect(SEGMENTS.map((s) => s.kind)).toEqual(['actOne', 'turn', 'act2', 'summary', 'end']);
  });

  it('stays inside the shaders’ budgets in both worlds (the summary’s from f6000, the end’s own from the landing)', () => {
    for (let f = E_END.from; f < 6720; f++) {
      const s = summaryDeskState(f);
      expect(footprintsAt(s).length, `f${f}`).toBeLessThanOrEqual(152);
      expect(poolsAt(s).length, `f${f}`).toBeLessThanOrEqual(10);
      expect(endWorldFootprints(f).length, `f${f}`).toBeLessThanOrEqual(3);
      expect(endPools(f).length, `f${f}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('beat 13: the end card and the end key (endCard.ts)', () => {
  const POSE = cameraAt(6400, 15);
  const corners = (f: number): [number, number][] => {
    const s = endCardAt(f);
    const q = cardCorners(END_CARD, s);
    const low = (p: P3): P3 => [p[0], p[1], p[2] - CARD_T];
    return [q.nw, q.ne, q.sw, q.se, low(q.sw), low(q.se)].map((p) => project(POSE, p));
  };

  it('holds the camera from bar 77 (the bookend’s framing) through the end', () => {
    for (let f = END.move[1]; f < 6720; f += 7) expect(cameraAt(f, 15)).toEqual(POSE);
  });

  it('sets the end card’s copy, six EN lines and five zh lines, the source’s title a tier up and the rest at the film’s end-card type, all at least 36 px', () => {
    expect(END_CARD.lines.map((l) => l.text)).toEqual([...WORDS.end.en.split('\n'), ...WORDS.end['zh-Hans'].split('\n')]);
    expect(WORDS.end.en.split('\n')).toHaveLength(6);
    expect(WORDS.end['zh-Hans'].split('\n')).toHaveLength(5);
    expect(END_CARD.lines.every((l) => l.cue === 'end')).toBe(true);
    const titles = new Set([0, 1, 6]);
    // each line's size on screen, across and down the card where it lies (the card lies flat: a unit is about 1.59 px across, 1.53 down)
    END_CARD.lines.forEach((l, i) => {
      const at = (x: number, y: number) => project(POSE, [END_CARD.place.x0 + x, END_CARD.place.y1 - y, CARD_T]);
      const a = at(l.x, l.y);
      const across = (at(l.x + 100, l.y)[0] - a[0]) / 100;
      const down = (a[1] - at(l.x, l.y - 10)[1]) / 10;
      expect(l.size * across, l.text).toBeGreaterThanOrEqual(37.5);
      expect(l.size * down, l.text).toBeGreaterThanOrEqual(36);
      expect(l.size * across, l.text).toBeLessThanOrEqual(titles.has(i) ? 45 : 41);
      expect(l.weight, l.text).toBe(i < 2 ? END_TYPE.title.enWeight : i === 6 ? END_TYPE.title.zhWeight : 400);
      // every baseline inside the card, each line below the one before
      expect(l.y, l.text).toBeLessThan(END_CARD.place.d - 6);
      if (i > 0) expect(l.y, l.text).toBeGreaterThan(END_CARD.lines[i - 1]!.y + 20);
    });
  });

  it('lies lower left at rest, wholly inside title-safe, from its landing to its leave, dead still', () => {
    const c = corners(6400);
    for (const [x, y] of c) {
      expect(x).toBeGreaterThanOrEqual(SAFE.x);
      expect(x).toBeLessThanOrEqual(SAFE.right);
      expect(y).toBeGreaterThanOrEqual(SAFE.y);
      expect(y).toBeLessThanOrEqual(SAFE.bottom);
    }
    expect(endCardAt(END.card.land)).toEqual({ present: true, off: [0, 0, 0], contact: 0.8 });
    for (let f = END.card.land; f < END.card.leave; f++) expect(endCardAt(f), `f${f}`).toEqual(endCardAt(END.card.land));
  });

  it('is posted in from beyond the frame’s south edge over the dissolve’s last frames and lands on card.land, its shadow tightening over the drop', () => {
    const { enter, land } = END_CARD.frames;
    expect(endCardAt(enter - 1).present).toBe(false);
    expect(Math.min(...corners(enter).map((p) => p[1]))).toBeGreaterThan(1080);
    expect(enter).toBeGreaterThan(END.dissolve[0]);
    for (let f = land - 4; f < land; f++) expect(endCardAt(f + 1).contact, `f${f}`).toBeGreaterThan(endCardAt(f).contact);
  });

  it('leaves on card.leave within 11 f: its contact goes over 2 f, it is wholly off the frame (and its shadow with it) on its last frame', () => {
    const { leave, gone } = END_CARD.frames;
    expect(gone - leave).toBe(LEAVE.frames);
    expect(gone - leave).toBeLessThanOrEqual(11);
    // the leave's frame shows it lifting (its contact half gone), the next has none
    expect(endCardAt(leave).off[2]).toBeGreaterThan(0);
    expect(endCardAt(leave).contact).toBeGreaterThan(0);
    expect(endCardAt(leave + 1).contact).toBe(0);
    expect(Math.min(...corners(gone - 1).map((p) => p[1]))).toBeGreaterThan(1080);
    // its cast shadow lies south-east of it, so off the frame with it; nothing of it is drawn from `gone`
    expect(endCardAt(gone).present).toBe(false);
    expect(endWorldFootprints(gone).length).toBe(0);
  });

  it('moves every point of its faces in the frame at most 2410 px/s, coming and going (its top face and its south face, sampled)', () => {
    const { enter, land, leave, gone } = END_CARD.frames;
    const { w, d } = END_CARD.place;
    const c = cardCentre(END_CARD);
    const pts: P3[] = [];
    for (let i = 0; i <= 12; i++)
      for (let j = 0; j <= 12; j++) pts.push([c[0] - w / 2 + (w * i) / 12, c[1] - d / 2 + (d * j) / 12, CARD_T]);
    for (let i = 0; i <= 12; i++) for (const z of [0, CARD_T]) pts.push([c[0] - w / 2 + (w * i) / 12, c[1] - d / 2, z]);
    const at = (f: number) => {
      const s = endCardAt(f);
      return pts.map((p) => project(POSE, [p[0] + s.off[0], p[1] + s.off[1], p[2] + s.off[2]]));
    };
    const inFrame = (q: [number, number]) => q[0] >= 0 && q[0] <= 1920 && q[1] >= 0 && q[1] <= 1080;
    let worst = 0;
    for (const [a, b] of [
      [enter, land],
      [leave, gone - 1],
    ] as const) {
      for (let f = a + 1; f <= b; f++) {
        const p = at(f - 1);
        const q = at(f);
        for (let i = 0; i < p.length; i++) if (inFrame(p[i]!) || inFrame(q[i]!)) worst = Math.max(worst, Math.hypot(q[i]![0] - p[i]![0], q[i]![1] - p[i]![1]));
      }
    }
    expect(worst).toBeLessThanOrEqual(CAP);
  });

  it('moves every corner in the frame at most 2410 px/s, coming and going', () => {
    const { enter, land, leave, gone } = END_CARD.frames;
    for (const [a, b] of [
      [enter, land],
      [leave - 1, gone - 1],
    ] as const) {
      for (let f = a + 1; f <= b; f++) {
        const p = corners(f - 1);
        const q = corners(f);
        for (let i = 0; i < p.length; i++) if (p[i]![1] <= 1080 || q[i]![1] <= 1080) expect(Math.hypot(q[i]![0] - p[i]![0], q[i]![1] - p[i]![1]), `f${f} corner ${i}`).toBeLessThanOrEqual(CAP);
      }
    }
  });

  it('sets the end key in the upper right: lane D’s plate scaled so its samples land on their rows, dead still from END.key, its words inside title-safe', () => {
    const s = END_KEY.scale;
    const at = (p: P3, dy = 0): [number, number] => project(POSE, [END_KEY.to[0] + (p[0] - END_KEY.from[0]) * s, END_KEY.to[1] + (p[1] - END_KEY.from[1]) * s + dy, p[2] * s]);
    KEY_SAMPLES.forEach((p, i) => {
      const q = at(p);
      expect(Math.abs(q[0] - END_KEY_SCREEN.x), `sample ${i}`).toBeLessThan(3);
      expect(Math.abs(q[1] - END_KEY_SCREEN.ys[i]!), `sample ${i}`).toBeLessThan(3);
    });
    expect(endKeyAt(END_KEY_MOVE.in)).toBeNull();
    // dead still from 2 f before its words, through 2 f after the card's leave starts (it trails the card out)
    expect(END_KEY_MOVE.settle).toBe(END.key - 2);
    expect(END_KEY_MOVE.out).toBe(END.card.leave + 2);
    expect(endKeyAt(END_KEY_MOVE.settle - 1)!.dy).toBeGreaterThan(0);
    for (let f = END_KEY_MOVE.settle; f < END_KEY_MOVE.out; f++) expect(endKeyAt(f), `f${f}`).toEqual({ dy: 0 });
    expect(endKeyAt(END_KEY_MOVE.out)!.dy).toBeGreaterThan(0);
    // in from and out to beyond the frame's top edge (its south edge and its shadow above it), gone before the card
    const south = (f: number) => project(POSE, [END_KEY.box.x0, END_KEY.box.y0 + endKeyAt(f)!.dy, 0])[1];
    const last = END_KEY_MOVE.out + END_KEY_MOVE.outFrames - 1;
    expect(south(END_KEY_MOVE.in + 1)).toBeLessThan(-6);
    expect(south(last)).toBeLessThan(-6);
    expect(endKeyAt(last + 1)).toBeNull();
    expect(last + 1).toBeLessThanOrEqual(END_CARD.frames.gone);
    expect(project(POSE, [END_KEY.box.x0, END_KEY.box.y1, 3])[1]).toBeGreaterThanOrEqual(SAFE.y);
    // its plate's corners move at most 2410 px/s
    const box = (f: number) => {
      const k = endKeyAt(f)!;
      return [
        [END_KEY.box.x0, END_KEY.box.y0],
        [END_KEY.box.x1, END_KEY.box.y0],
        [END_KEY.box.x1, END_KEY.box.y1],
      ].map(([x, y]) => project(POSE, [x!, y! + k.dy, 3]));
    };
    for (const [a, b] of [
      [END_KEY_MOVE.in + 2, END_KEY_MOVE.settle],
      [END_KEY_MOVE.out, last],
    ] as const)
      for (let f = a; f <= b; f++) box(f).forEach((q, i) => expect(Math.hypot(q[0] - box(f - 1)[i]![0], q[1] - box(f - 1)[i]![1]), `f${f}`).toBeLessThanOrEqual(CAP));
    expect(END_KEY_OFF).toBeGreaterThan(0);
    expect(KEY_BOX.x1).toBeGreaterThan(KEY_BOX.x0);
    // the zh column's longest entry (6 glyphs at 36 px) ends inside title-safe
    expect(END_KEY_SCREEN.zh + 6 * 36).toBeLessThanOrEqual(SAFE.right);
    // the key's words never reach the card
    expect(END_KEY_SCREEN.ys[2] + 13 + 10).toBeLessThan(Math.min(...corners(6400).map((p) => p[1])));
  });
});

describe('beat 13: the end’s light (endCard.ts endPools)', () => {
  it('lights the end with one soft warm pool over the card’s north-west quarter, from the dissolve to the card’s leave, and none once the card is gone', () => {
    for (const f of [6160, 6200, 6400, END.card.leave - 1]) {
      const p = endPools(f);
      expect(p, `f${f}`).toHaveLength(1);
      expect(p[0]!.rgb[0], `f${f}`).toBeGreaterThan(p[0]!.rgb[2]);
      expect(p[0]!.rgb[0], `f${f}`).toBeLessThan(0.2);
    }
    expect(endPools(END.card.leave + 3)[0]!.rgb[0]).toBeLessThan(endPools(END.card.leave)[0]!.rgb[0]);
    expect(endPools(END_CARD.frames.gone)).toEqual([]);
    expect(endPools(6719)).toEqual([]);
    const [p] = endPools(6400);
    const { x0, y1, w, d } = END_CARD.place;
    expect(p!.c[0]).toBeGreaterThan(x0);
    expect(p!.c[0]).toBeLessThan(x0 + w / 2);
    expect(p!.c[1]).toBeLessThan(y1);
    expect(p!.c[1]).toBeGreaterThan(y1 - d / 2);
  });
});
