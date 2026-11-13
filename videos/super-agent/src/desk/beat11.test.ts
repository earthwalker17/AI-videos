import { describe, expect, it } from 'vitest';
import { BEAT_11, cue, textWindow } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { SAFE, DIAGRAM_BAND } from '../look/tokens.ts';
import { youPoseAt } from './actOne.ts';
import {
  BUILT,
  CARD_SPOT_11,
  COLLAR,
  KEY_BOX,
  KEY_MOVE,
  KEY_SAMPLES,
  KEY_SCREEN,
  LAMP_11,
  NEXT_REPLIES,
  RETIRE,
  SETTLE,
  STEP_11,
  TAGS_11,
  TAB_FLAT,
  TRAY_DOCK,
  TRAY_ORDER,
  TURN,
  WATCH_EAST,
  MINI,
  actOneCardAt,
  beat11At,
  cardNotchAt,
  collarAt,
  keyAt,
  keyWordsAt,
  lampAims,
  lampTurnAt,
  nextRideAt,
  onD,
  plateAt,
  plateLands,
  plateLifts,
  readLampAt,
  retireLiftOf,
  type PlateId,
  KEY_STEP,
  keyStepAt,
} from './beat11.ts';
import { REPLY_0405 } from './beat10.ts';
import { cardIn, cardPose, cardSize } from './beat4.ts';
import { EASE_OUT_D, TO_BOOKEND, project } from './camera.ts';
import { SUMMARY_TAGS } from './film.ts';
import { LAMP, PRINT_HEAD, READ_LAMP, YOU, rectC, type P3 } from './layout.ts';
import { STEP_FRAMES, deskStateAt, replyPose } from './state.ts';
import { SEAM_D, WATCHDOG, poseD, summaryDeskState, summaryStep } from './summary.ts';
import { tagLeaderReveal } from './Overlay.tsx';

const ids: PlateId[] = ['proactive', 'productive', 'continuous'];
/** A plate's four plan corners at its pose (its turn about z, its plan scale; its roll ignored: a bound). */
const corners = (id: PlateId, f: number): P3[] => {
  const q = plateAt(f, id)!;
  const worded = q.body === 'worded';
  const size = worded ? (id === 'continuous' ? [384, 64] : [0, 0]) : [MINI.l, MINI.w];
  const [hl, hw] = [(size[0]! * q.sx) / 2, (size[1]! * q.sy) / 2];
  const [c, s] = [Math.cos(q.yaw), Math.sin(q.yaw)];
  return [
    [-hl, -hw],
    [hl, -hw],
    [hl, hw],
    [-hl, hw],
  ].map(([u, v]): P3 => [q.c[0] + u! * c - v! * s, q.c[1] + u! * s + v! * c, q.c[2]]);
};
/** The plate's centre on screen through the film's camera at f. */
const onScreen = (f: number, id: PlateId): [number, number] | null => {
  const p = plateAt(f, id);
  return p ? project(poseD(f, 15), p.c) : null;
};

describe('beat 11: the seam, summary side', () => {
  it('starts on act two’s last frame for what it lasts (the window, the tape, the drawer, beat 5’s and beat 7’s parts, the 7.4 reply)', () => {
    const a = deskStateAt(SEAM_D - 1);
    const s = summaryDeskState(SEAM_D);
    expect(s.cache).toEqual(a.cache);
    for (const k of ['key', 'spike', 'slips', 'pile', 'plate'] as const) expect(s.e5[k], `e5.${k}`).toEqual(a.e5[k]);
    for (const k of ['advance', 'rewind', 'threadRow', 'thread'] as const) expect(s.e6[k], `e6.${k}`).toEqual(a.e6[k]);
    expect({ ...s.e7, f: 0 }).toEqual({ ...a.e7, f: 0 });
    expect(s.replies.find((r) => r.id === '7-chat')).toEqual(a.replies.find((r) => r.id === '7-chat'));
    expect(s.e11?.plates).toEqual({ proactive: null, productive: null, continuous: null });
  });
  it('holds still through the stillness (f5424-5439): nothing of the summary’s own settling moves before the stamp', () => {
    const a = summaryDeskState(SEAM_D);
    for (let f = SEAM_D + 1; f < BEAT_11.stamp; f++) {
      const s = summaryDeskState(f);
      expect(s.cache?.lamp, `f${f}`).toBe(a.cache?.lamp);
      expect(s.e6.thread, `f${f}`).toEqual(a.e6.thread);
      expect(s.e11?.plates, `f${f}`).toEqual(a.e11?.plates);
    }
  });
  it('settles into still (d)’s by f5519: the reading lamp idle, the hopper up, the reading thread wound in (its tabs flat), the pictogram plates docked', () => {
    const s = summaryDeskState(ROUND2.stillD - 1);
    expect(s.cache?.lamp).toBeCloseTo(0.25, 2);
    // the hopper back up for the next report (act two folded it)
    expect(summaryDeskState(SEAM_D).cache?.hopper).toBe(deskStateAt(SEAM_D - 1).cache?.hopper);
    expect(Math.abs(s.cache?.hopper ?? 1)).toBeLessThan(0.01);
    expect(readLampAt(BEAT_11.stamp)).toBe(1);
    expect(s.e6.thread?.pts.length).toBe(1);
    expect(s.e6.thread?.shuttle).toBeNull();
    for (const k of s.e6.thread?.tabs ?? []) expect(k).toBe(TAB_FLAT);
    for (const id of ['proactive', 'productive'] as const) {
      expect(plateLands(id)[0]!, id).toBeLessThan(ROUND2.stillD - 4);
      const p = plateAt(ROUND2.stillD, id)!;
      expect(p.body).toBe('mini');
      expect(p.flying).toBe(false);
      expect(p.squash).toBe(0);
    }
    expect(plateAt(ROUND2.stillD, 'continuous')).toBeNull();
    expect(SETTLE.proactive.lift).toBeGreaterThan(BEAT_11.stamp);
  });
});

describe('beat 11.1: the trait plates retire into the emptied chore tray', () => {
  it('land on the cue sheet’s plates.lands (the two that lie on the board first, Continuous across them last), never lifting before f5521 (still (d) keeps them)', () => {
    // the three built plates (Persistent, proposed, stays in vellum), the first lifting on the retirement's cue
    expect(RETIRE.lands).toEqual(BEAT_11.plates.lands);
    expect(BEAT_11.plates.lands.length).toBe(3);
    // (a leg's first move is the frame after its lift: legAt holds it at rest through its lift frame)
    expect(Math.min(...ids.map(retireLiftOf)) + 1).toBe(BEAT_11.plates.from);
    expect(plateAt(BEAT_11.plates.from - 1, 'proactive')).toEqual(plateAt(BEAT_11.plates.from - 2, 'proactive'));
    expect(plateAt(BEAT_11.plates.from, 'proactive')!.c).not.toEqual(plateAt(BEAT_11.plates.from - 1, 'proactive')!.c);
    expect(TRAY_ORDER).toEqual(ids);
    ids.forEach((id, k) => {
      expect(plateLands(id).at(-1), id).toBe(BEAT_11.plates.lands[k]);
      expect(plateLifts(id).at(-1)!, id).toBeGreaterThanOrEqual(5521);
      expect(retireLiftOf(id)).toBe(plateLifts(id).at(-1));
    });
  });
  it('fly clear of the parts they pass: over the print head and the reading lamp’s hood, never over the stamped reply or your lamp’s hood on screen', () => {
    const inBox = (p: P3, b: { x0: number; x1: number; y0: number; y1: number }, z0: number, z1: number): boolean => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1 && p[2] > z0 && p[2] < z1;
    const hood = { x0: READ_LAMP.hood.x0, x1: READ_LAMP.hood.x1, y0: READ_LAMP.hood.y - READ_LAMP.hood.r, y1: READ_LAMP.hood.y + READ_LAMP.hood.r };
    // #0405 and your lamp's hood on still (d)'s screen (the camera is settled from f5500)
    const reply = [-1, 1].flatMap((a) => [-1, 1].map((b): [number, number] => onD([REPLY_0405.rest[0] + (a * REPLY_0405.size[0]) / 2, REPLY_0405.rest[1] + (b * REPLY_0405.size[1]) / 2, REPLY_0405.rest[2]])));
    const rx = [Math.min(...reply.map((q) => q[0])), Math.max(...reply.map((q) => q[0]))];
    const ry = [Math.min(...reply.map((q) => q[1])), Math.max(...reply.map((q) => q[1]))];
    const head = onD(LAMP.head);
    for (const id of ids) {
      for (let f = retireLiftOf(id) + 1; f < plateLands(id).at(-1)!; f++) {
        const q = plateAt(f, id)!;
        // the plate's corners and centre at its height, and (worded or turning) its edges' reach above and below it
        const reach = Math.abs(Math.sin(q.roll)) * ((id === 'continuous' && q.body === 'worded' ? 64 : MINI.w) * q.sy) / 2;
        for (const c of [...corners(id, f), q.c]) {
          for (const dz of [-reach - 3, 0, reach + 3]) {
            const at: P3 = [c[0], c[1], c[2] + dz];
            expect(inBox(at, PRINT_HEAD.box, PRINT_HEAD.z[0] - 2, PRINT_HEAD.z[1] + 6), `${id} f${f} head`).toBe(false);
            expect(inBox(at, hood, READ_LAMP.hood.z - READ_LAMP.hood.r - 4, READ_LAMP.hood.z + READ_LAMP.hood.r + 4), `${id} f${f} hood`).toBe(false);
          }
          const sc = project(poseD(f, 15), c);
          expect(sc[0] > rx[0]! - 4 && sc[0] < rx[1]! + 4 && sc[1] > ry[0]! - 4 && sc[1] < ry[1]! + 4, `${id} f${f} over #0405`).toBe(false);
          expect(Math.hypot(sc[0] - head[0], sc[1] - head[1]), `${id} f${f} over your lamp`).toBeGreaterThan(30);
        }
      }
    }
  });
  it('fly no faster than beat 5’s key (2410 px/s), swap bodies on a frame edge-on to the camera (75°) and land inside the tray over their recesses', () => {
    for (const id of ids) {
      let prev = onScreen(SEAM_D, id);
      let prevSize: number | null = null;
      for (let f = SEAM_D + 1; f < 5600; f++) {
        const q = onScreen(f, id);
        if (prev && q) expect(Math.hypot(q[0] - prev[0], q[1] - prev[1]) * 30, `${id} f${f}`).toBeLessThanOrEqual(2410);
        const p = plateAt(f, id);
        const size = p ? p.sx * (p.body === 'mini' ? MINI.l : 1) : null;
        if (p && prevSize !== null && plateAt(f - 1, id)?.body !== p.body) {
          // the swap: on the frame it is edge-on to the 15° camera (75°), the worded body the frame before
          const w = plateAt(f - 1, id)!;
          expect(w.body).toBe('worded');
          expect(p.roll + Math.PI, `${id} f${f}`).toBeCloseTo(TURN.swap, 6);
        }
        prevSize = size;
        prev = q;
      }
    }
    for (const id of ids) {
      const land = plateLands(id).at(-1)!;
      expect(plateAt(land, id)!.c).toEqual(TRAY_DOCK[id].c);
      for (const c of corners(id, land + 10)) {
        expect(c[0], id).toBeGreaterThanOrEqual(YOU.tray.x0);
        expect(c[0], id).toBeLessThanOrEqual(YOU.tray.x1);
        expect(c[1], id).toBeGreaterThanOrEqual(YOU.tray.y0 - 1e-9);
        expect(c[1], id).toBeLessThanOrEqual(YOU.tray.y1 + 1e-9);
      }
    }
    // Continuous lies across the two: its underside on their tops
    expect(TRAY_DOCK.continuous.c[2] - MINI.t / 2).toBeCloseTo(TRAY_DOCK.proactive.c[2] + MINI.t / 2, 9);
  });
  it('are drawn by one body at a time: the act-two body until the lift, beat 11 from the frame after', () => {
    const lift = plateLifts('proactive')[0]!;
    expect(summaryDeskState(lift).e5.plate).not.toBeNull();
    expect(plateAt(lift, 'proactive')).toBeNull();
    expect(summaryDeskState(lift + 1).e5.plate).toBeNull();
    expect(plateAt(lift + 1, 'proactive')).not.toBeNull();
    const pl = plateLifts('productive')[0]!;
    expect(summaryDeskState(pl).e7?.plate).not.toBeNull();
    expect(summaryDeskState(pl + 1).e7?.plate).toBeNull();
  });
});

describe('beat 11.2: the idea labels and the map key', () => {
  it('six TagSpecs on the ideas cue, one per beat on BEAT_11.ideas, each its own id, in film.ts SUMMARY_TAGS', () => {
    expect(TAGS_11.length).toBe(6);
    expect(new Set(TAGS_11.map((t) => t.id)).size).toBe(6);
    TAGS_11.forEach((t, i) => {
      expect(t.cue).toBe('ideas');
      expect(t.from).toBe(BEAT_11.ideas[i]);
      expect(t.reveal).toBe('leader');
      expect(SUMMARY_TAGS).toContain(t);
    });
    // the leader's foot on the beat itself, then its 6 f leader and 8 f wipe; all down (faded) before the collar flies
    const t = TAGS_11[0]!;
    expect(tagLeaderReveal(t, t.from! - 1).visible).toBe(false);
    expect(tagLeaderReveal(t, t.from!)).toMatchObject({ visible: true, wipe: 0 });
    expect(tagLeaderReveal(t, t.from!).leader).toBeGreaterThan(0);
    expect(tagLeaderReveal(t, t.from! + 5)).toMatchObject({ leader: 1, wipe: 0 });
    expect(tagLeaderReveal(t, t.from! + 6).wipe).toBeGreaterThan(0);
    expect(tagLeaderReveal(t, t.from! + 13).wipe).toBe(1);
    expect(textWindow(cue('ideas'))[1]).toBeLessThanOrEqual(BEAT_11.collar.from);
    expect(tagLeaderReveal(t, BEAT_11.collar.from).visible).toBe(false);
    // the control loop's foot on the Watchdog's station (restated for the import rule)
    expect(WATCH_EAST).toEqual([WATCHDOG.c[0] + WATCHDOG.w / 2, WATCHDOG.c[1], 1]);
  });
  it('sets every line inside title-safe and the diagram band (widths at about 21 px a Latin character, 40 a Han one)', () => {
    const width = (s: string): number => [...s].reduce((w, c) => w + ((c.codePointAt(0) ?? 0) >= 0x2e80 ? 40 : 21), 0);
    for (const t of TAGS_11) {
      const lines = [...(t.lines?.en ?? [t.words.en]), ...(t.lines?.zh ?? [t.words['zh-Hans']])].filter(Boolean);
      const gap = t.gap ?? 50;
      lines.forEach((l, i) => {
        const w = width(l);
        const x0 = t.anchor === 'start' ? t.at[0] : t.at[0] - w;
        const x1 = t.anchor === 'start' ? t.at[0] + w : t.at[0];
        const y = t.at[1] + i * gap;
        expect(x0, `${t.id} ${l}`).toBeGreaterThanOrEqual(SAFE.x);
        expect(x1, `${t.id} ${l}`).toBeLessThanOrEqual(SAFE.right);
        expect(y - 32, `${t.id} ${l}`).toBeGreaterThanOrEqual(DIAGRAM_BAND.top);
        expect(y + 8, `${t.id} ${l}`).toBeLessThanOrEqual(DIAGRAM_BAND.bottom);
      });
      const foot = onD(t.foot);
      expect(foot[0]).toBeGreaterThan(0);
      expect(foot[1]).toBeLessThan(1080);
    }
  });
  it('the key: three samples in the upper right, its plate in from beyond the frame’s top edge and out again, gone by bar 76', () => {
    expect(KEY_SAMPLES.length).toBe(3);
    for (const y of KEY_SCREEN.ys) {
      expect(y).toBeGreaterThanOrEqual(60);
      expect(y).toBeLessThanOrEqual(230);
    }
    expect(KEY_SCREEN.x).toBeGreaterThanOrEqual(1200);
    // its first and last drawn frames: the plate wholly beyond the frame's top edge (its south edge above y 0)
    const south = (f: number) => onD([(KEY_BOX.x0 + KEY_BOX.x1) / 2, KEY_BOX.y0 + keyAt(f)!.dy, 6])[1];
    expect(keyAt(KEY_MOVE.in)).toBeNull();
    expect(south(KEY_MOVE.in + 1)).toBeLessThan(0);
    const last = KEY_MOVE.out + KEY_MOVE.outFrames - 1;
    expect(south(last)).toBeLessThan(0);
    expect(keyAt(last + 1)).toBeNull();
    expect(last + 1).toBeLessThanOrEqual(TO_BOOKEND.from);
    // dead still from the cue's wipe on, its words gone before it moves again
    const c = cue('key-map');
    for (let f = c.frame - 6; f <= KEY_MOVE.out; f++) expect(keyAt(f)!.dy, `f${f}`).toBe(0);
    expect(keyWordsAt(KEY_MOVE.out - KEY_MOVE.fade)).toBe(1);
    expect(keyWordsAt(KEY_MOVE.out)).toBe(0);
    // the key-map cue's window ends with the words' fade (the cue sheet's own 6 f fade out)
    expect(textWindow(c)[1]).toBe(KEY_MOVE.out);
    expect(c.end).toBe(KEY_MOVE.out - KEY_MOVE.fade);
    // its right edge inside title-safe (zh: six Han at 36 px)
    expect(KEY_SCREEN.zh + 6 * 36).toBeLessThanOrEqual(1824);
  });
});

describe('beat 11.3: the act-one card and the collar', () => {
  it('the card rises on its cue for one beat and slides away from its exit, never struck, beyond the frame’s west edge at both ends', () => {
    expect(actOneCardAt(BEAT_11.actOneCard.rise - 1)).toBeNull();
    expect(actOneCardAt(BEAT_11.actOneCard.rise)!.rise).toBeGreaterThan(0);
    const exit = BEAT_11.actOneCard.exit;
    expect(actOneCardAt(exit - 1)!.exit).toBeCloseTo(0, 9);
    expect(actOneCardAt(exit)!.exit).toBeGreaterThan(0);
    for (let f = BEAT_11.actOneCard.rise; f < exit + 8; f++) {
      const c = actOneCardAt(f);
      if (!c) continue;
      expect(c.strike).toBe(0);
    }
    const first = actOneCardAt(BEAT_11.actOneCard.rise)!;
    expect(cardIn(first)).toBeLessThan(0.2);
    // off: wholly beyond the west edge at 0.64x, level with where it rests (it crosses none of the idea labels along the top)
    const eastAt = (c: NonNullable<ReturnType<typeof actOneCardAt>>) => onD([cardPose(c, CARD_SPOT_11).c[0] + (CARD_SPOT_11.w ?? 300) / 2, cardPose(c, CARD_SPOT_11).c[1], 240])[0];
    const offEast = onD([CARD_SPOT_11.off[0] + (CARD_SPOT_11.w ?? 300) / 2, CARD_SPOT_11.off[1], CARD_SPOT_11.off[2]])[0];
    expect(offEast).toBeLessThan(0);
    expect(CARD_SPOT_11.off[1]).toBe(CARD_SPOT_11.at[1]);
    expect(cardPose(first, CARD_SPOT_11).c[2]).toBe(240);
    // in 12 f, out over 8 f (TREATMENT: the exit 40% shorter than the entrance), in view on each of its exit's first 7 frames
    expect(actOneCardAt(BEAT_11.actOneCard.rise + 11)!.rise).toBe(1);
    expect(actOneCardAt(BEAT_11.actOneCard.rise + 10)!.rise).toBeLessThan(1);
    expect(actOneCardAt(exit + 7)!.exit).toBe(1);
    expect(actOneCardAt(exit + 8)).toBeNull();
    for (let f = exit; f < exit + 7; f++) expect(eastAt(actOneCardAt(f)!), `f${f}`).toBeGreaterThan(8);
    // at least 340 px wide on screen at its place, its east edge never faster than 2410 px/s while it comes in
    const { w } = cardSize(CARD_SPOT_11);
    const at = CARD_SPOT_11.at;
    expect(onD([at[0] + w / 2, at[1], at[2]])[0] - onD([at[0] - w / 2, at[1], at[2]])[0]).toBeGreaterThanOrEqual(340);
    // (its exit eases in on the exit curve, gathering speed as it leaves: the cap holds while it comes in and is up)
    for (let f = BEAT_11.actOneCard.rise; f < exit; f++) {
      const [a, b] = [actOneCardAt(f), actOneCardAt(f + 1)];
      if (!a || !b || eastAt(a) < 0) continue;
      expect(Math.abs(eastAt(b) - eastAt(a)) * 30, `f${f}`).toBeLessThanOrEqual(2410);
    }
    // the world a notch down under it while it is up, back up as it leaves
    expect(cardNotchAt(BEAT_11.actOneCard.rise - 2)).toBe(0);
    expect(cardNotchAt(BEAT_11.actOneCard.exit - 1)).toBeCloseTo(0.5, 9);
    expect(cardNotchAt(BEAT_11.actOneCard.exit)).toBeLessThan(0.5);
    expect(cardNotchAt(BEAT_11.actOneCard.exit + 9)).toBe(0);
    expect(summaryStep(BEAT_11.actOneCard.exit - 1).ids).toEqual(STEP_11);
    expect(summaryStep(BEAT_11.actOneCard.exit - 1).amount).toBeCloseTo(0.5, 9);
    // the card a full beat at rest and gone (its exit's 8 f) before the collar flies, the world back up by then
    expect(BEAT_11.actOneCard.exit - (BEAT_11.actOneCard.rise + 11)).toBeGreaterThanOrEqual(18);
    expect(actOneCardAt(BEAT_11.collar.from - 2)).toBeNull();
    expect(summaryStep(BEAT_11.collar.from - 1).amount).toBe(0);
  });
  it('the collar lifts off the throat after its cue, docks on your lamp’s neck on collar.to and rides the lamp as YourDesk draws it', () => {
    expect(beat11At(COLLAR.from)!.collar).toBeNull();
    expect(beat11At(COLLAR.from + 1)!.collar!.flying).toBe(true);
    expect(beat11At(COLLAR.to)!.collar!.flying).toBe(false);
    for (let f = COLLAR.to; f < 6000; f += 7) {
      const a = beat11At(f)!.collar!;
      const b = collarAt(f, youPoseAt(f))!;
      for (let i = 0; i < 3; i++) expect(a.c[i]!, `f${f}`).toBeCloseTo(b.c[i]!, 6);
    }
    // its needle high up its scale once it rides your lamp (the scale runs over the top from 160° low to 20° high)
    const s = summaryDeskState(5999);
    const needle = s.b4.gauge.needle + s.e6.needle + beat11At(5999)!.collar!.needle;
    expect(needle).toBeGreaterThan((20 * Math.PI) / 180);
    expect(needle).toBeLessThan((60 * Math.PI) / 180);
    for (let f = COLLAR.to; f < 6000; f++) {
      const n = summaryDeskState(f).b4.gauge.needle + summaryDeskState(f).e6.needle + beat11At(f)!.collar!.needle;
      expect(n, `f${f}`).toBeGreaterThanOrEqual((20 * Math.PI) / 180 - 0.02);
      expect(n, `f${f}`).toBeLessThanOrEqual((160 * Math.PI) / 180 + 0.02);
    }
    // its flight on screen: under 2410 px/s
    let prev: [number, number] | null = null;
    for (let f = COLLAR.from + 1; f <= COLLAR.to + 1; f++) {
      const q = project(poseD(f, 15), collarAt(f, youPoseAt(f))!.c);
      if (prev) expect(Math.hypot(q[0] - prev[0], q[1] - prev[1]) * 30).toBeLessThanOrEqual(2410);
      prev = q;
    }
  });
});

describe('beat 11.4 and the end of the beat', () => {
  it('steps everything but your desk, your lamp and the stamped reply down from the cue, and is held stepped at f6000', () => {
    expect(STEP_11).not.toContain('you');
    expect(summaryStep(BEAT_11.stepDown).amount).toBeCloseTo(0, 9);
    expect(summaryStep(5999).amount).toBe(1);
    expect(summaryStep(5999).ids).toEqual(STEP_11);
  });
  it('your lamp brightens a step on the stamp and turns to the next reply on each lampTurns frame (its aim on spring-heavy)', () => {
    expect(LAMP_11).toEqual([{ at: BEAT_11.stamp, steps: 1 }]);
    const before = youPoseAt(BEAT_11.lampTurns[0]!);
    const after = youPoseAt(BEAT_11.lampTurns[0]! + 1);
    expect(before.lamp.aim).toEqual(youPoseAt(BEAT_11.stamp).lamp.aim);
    expect(after.lamp.aim).not.toEqual(before.lamp.aim);
    const a1 = youPoseAt(BEAT_11.lampTurns[1]! - 1).lamp.aim;
    const a2 = youPoseAt(5999).lamp.aim;
    expect(Math.hypot(a2[0] - a1[0], a2[1] - a1[1])).toBeGreaterThan(40);
    expect(lampTurnAt(BEAT_11.lampTurns[0]!, before)).toBe(before);
    // each turn is to the next reply, waiting in the chute before the turn (its cause)
    NEXT_REPLIES.forEach((n, i) => {
      const turn = BEAT_11.lampTurns[i]!;
      expect(nextRideAt(n.leave, n)).toBeNull();
      expect(n.leave + n.frames).toBeLessThanOrEqual(turn - 2);
      expect(nextRideAt(turn, n)).toEqual(nextRideAt(n.leave + n.frames, n));
      const r = summaryDeskState(turn).replies.find((x) => x.id === n.id)!;
      const p = replyPose(r.ride, r.rest).p;
      expect(Math.hypot(p[0] - lampAims()[i]![0], p[1] - lampAims()[i]![1])).toBeLessThan(1e-6);
      expect(r.ride.s).toBeGreaterThan(0);
      expect(r.ride.s).toBeLessThan(1);
    });
    // queued clear of each other (a slip's length apart) and, on screen, never over the stamped reply
    const rc = [-1, 1].flatMap((a) => [-1, 1].map((b) => onD([REPLY_0405.rest[0] + (a * REPLY_0405.size[0]) / 2, REPLY_0405.rest[1] + (b * REPLY_0405.size[1]) / 2, REPLY_0405.rest[2]])));
    const [rx0, rx1, ry0, ry1] = [Math.min(...rc.map((q) => q[0])), Math.max(...rc.map((q) => q[0])), Math.min(...rc.map((q) => q[1])), Math.max(...rc.map((q) => q[1]))];
    expect((NEXT_REPLIES[0].stop - NEXT_REPLIES[1].stop) * 227).toBeGreaterThan(104);
    for (let f = NEXT_REPLIES[0].leave + 1; f < 6000; f += 2)
      for (const r of summaryDeskState(f).replies.filter((x) => x.id.startsWith('b11-next'))) {
        const p = replyPose(r.ride, r.rest);
        const [c, sn] = [Math.cos(p.heading), Math.sin(p.heading)];
        for (const [u, v] of [[-58, -22], [58, -22], [58, 22], [-58, 22]] as const) {
          const q = onD([p.p[0] + u * c - v * sn, p.p[1] + u * sn + v * c, p.p[2]]);
          expect(q[0] > rx0 && q[0] < rx1 && q[1] > ry0 && q[1] < ry1, `${r.id} f${f}`).toBe(false);
        }
      }
    // the aims turn the lamp's pool well off where it was (the stamped reply, then the first reply)
    expect(Math.hypot(lampAims()[0]![0] - youPoseAt(BEAT_11.stamp).lamp.aim[0], lampAims()[0]![1] - youPoseAt(BEAT_11.stamp).lamp.aim[1])).toBeGreaterThan(40);
    expect(rectC(YOU.inTray)[0]).toBeLessThan(0);
  });
  it('fades the map key’s words with the world under 11.4’s step-down, on its ramp, to 55%', () => {
    expect(keyStepAt(KEY_STEP.from)).toBe(1);
    expect(keyStepAt(KEY_STEP.from + STEP_FRAMES)).toBeCloseTo(0.55, 9);
    for (let f = KEY_STEP.from; f < KEY_STEP.from + STEP_FRAMES + 2; f++) {
      expect(keyStepAt(f + 1), `f${f}`).toBeLessThanOrEqual(keyStepAt(f));
      expect(keyStepAt(f) - keyStepAt(f + 1), `f${f}`).toBeLessThan(0.07);
      const main = summaryStep(f);
      if (main.ids.includes('deck')) expect(keyStepAt(f), `f${f}`).toBeCloseTo(1 - 0.45 * main.amount, 9);
    }
  });

  it('is built (the slate drops its cues over f5440-5999)', () => {
    expect(BUILT).toBe(true);
    expect(EASE_OUT_D.to).toBeLessThan(ROUND2.stillD);
  });
});
