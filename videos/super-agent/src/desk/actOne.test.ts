import { describe, expect, it } from 'vitest';
import { ROUND2 } from '../lookdev/frames.ts';
import { FOLDER_PRINT, LOOP_NOTES } from '../print.ts';
import { TEXT_OUT, WORDS, cue } from '../cues.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { CREDIT_CUE, TITLE_CARD, actOneFrameFootprints } from './ActOneFrame.tsx';
import { NOTES_ASCENT, NOTES_GROUND, notesHaloReach, notesHaloTop } from './Overlay.tsx';
import {
  ACT_ONE_END,
  ARRIVE,
  CARD,
  CHORE_ARC,
  CHORE_POSTS,
  CLIP_AFTER,
  EVENT_ARC,
  FEEDER_OF,
  FLAG,
  FLAG_UP,
  FLIGHT,
  FOLDERS,
  GENERIC_FEEDERS,
  HEAP,
  LOOP_A,
  MOUTH,
  PEN_ON,
  PIECE,
  REQUEST_A,
  REQUEST_INK,
  TAB_SHARE,
  YOU_LABEL_FROM,
  YOU_SHIFT_A,
  actOneAt,
  actOneFootprints,
  actOnePools,
  aimOf,
  boardAt,
  boardThrown,
  cardWorld,
  choreFlightAt,
  eventLands,
  eventSlipAt,
  flagTop,
  folderFootprints,
  folderPoint,
  loopNormal,
  loopPoint,
  penWorld,
  postPose,
  postedAt,
  requestZ,
  stackTop,
  tabAt,
  trayNudgeAt,
  YOU_LABEL_OUT,
  youLabelAt,
  youPoseA,
  youPoseAt,
  lampAimAt,
  FIX_LAMP,
  AIM_LAG,
  HEAD_A,
  actOneStep,
  actOneStepA,
} from './actOne.ts';
import { ACT_ONE_MOVE, FRAMING_A, FRAMING_HOOK, cameraAt, deskCamera, framingAt, project, screenToDesk } from './camera.ts';
import { loopArc, loopNotesAt } from './objects/ActOne.tsx';
import { CARD_CONTACT_INSET, CARD_POST, CARD_T, cardAt, cardContactFootprint, cardCorners, cardFootprint, cardMatrix } from './objects/TitleCard.tsx';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { LAMP, YOU, type P2, type P3 } from './layout.ts';
import { LAMP_ARMS, LAMP_FOOT_Z, YOU_POSE_B } from './you.ts';

const A = actOneAt(ROUND2.stillA);
const pose = deskCamera(FRAMING_A, 15);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

describe('act one at still A (f915, C4)', () => {
  it('is act one, inside C4, with the loop clipped shut since f880 and every chore on the desk', () => {
    expect(ROUND2.stillA).toBeLessThan(ACT_ONE_END);
    expect(A.loop.closed).toBeGreaterThan(0.99);
    expect(actOneAt(879).loop.closed).toBe(0);
    for (const c of Object.values(A.chores)) expect(c).toBeGreaterThan(0.99);
    expect(A.step.amount).toBe(1);
    expect(A.step.ids).toContain('intake');
  });
  it('keeps the lamp settled on F3, blooming: one light against eight folders', () => {
    expect(A.lamp.n).toBe(3);
    expect(dist(A.lamp.aim, aimOf(3))).toBeLessThan(1);
    expect(A.lamp.bulb).toBeGreaterThan(1);
    const pools = actOnePools(A);
    expect(pools).toHaveLength(1);
    // centred a little toward the lamp, so F3 falls off to its far edge
    expect(dist(pools[0].c, [FOLDERS[2].c[0], FOLDERS[2].c[1]])).toBeLessThan(60);
    expect(pools[0].c[1]).toBeLessThan(FOLDERS[2].c[1]);
  });
  it('has about four warm folders working and four cold ones waiting (no number on screen)', () => {
    for (const [i, s] of A.folders.entries()) {
      expect(s.present).toBe(1);
      if ([0, 2, 4, 6].includes(i)) {
        expect(s.warmth).toBeGreaterThan(PEN_ON);
        expect(s.pen).toBe(0);
        expect(s.flag).toBe(0);
      } else {
        expect(s.warmth).toBeLessThan(FLAG_UP);
        expect(s.pen).toBe(1);
        expect(s.flag).toBe(1);
      }
    }
  });
  it('has one chat slip in mid-arc, at about h 40–60', () => {
    expect(A.flight).not.toBeNull();
    expect(A.flight!.pos[2]).toBeGreaterThan(35);
    expect(A.flight!.pos[2]).toBeLessThan(65);
  });
  it('is a pure function of the frame', () => {
    expect(actOneAt(ROUND2.stillA)).toEqual(A);
    expect(actOneAt(700)).toEqual(actOneAt(700));
  });
});

describe('act one layout (FRAMING_A, 15°)', () => {
  it('fans eight folders north of the desk, never round it, each 150–210 px and none overlapping', () => {
    expect(FOLDERS).toHaveLength(8);
    for (const fl of FOLDERS) {
      expect(fl.c[1]).toBeGreaterThan(LOOP_A.c[1] + LOOP_A.b);
      expect(Math.max(fl.w, fl.d) * FRAMING_A.zoom).toBeGreaterThanOrEqual(150);
      expect(Math.max(fl.w, fl.d) * FRAMING_A.zoom).toBeLessThanOrEqual(210);
    }
    for (let i = 1; i < FOLDERS.length; i++) {
      const a = FOLDERS[i - 1];
      const b = FOLDERS[i];
      expect(dist(a.c, b.c)).toBeGreaterThan((a.w + b.w) / 2);
    }
  });
  it('keeps the diagram in the band y 72–868 and the stacks different (context is paper)', () => {
    for (const [i, fl] of FOLDERS.entries()) {
      // the highest point: a raised flag's pennant tip, else the tab
      const top = A.folders[i].flag > 0 ? flagTop(fl, A.folders[i].flag) : ([fl.c[0], fl.c[1] + fl.d / 2 + 13, stackTop(fl)] as const);
      const tip: P3 = [top[0], top[1] + (A.folders[i].flag > 0 ? FLAG.plate[0] : 0), top[2]];
      expect(project(pose, tip)[1]).toBeGreaterThan(72);
    }
    for (let k = 0; k < 64; k++) {
      const p = loopPoint(LOOP_A, (k / 64) * Math.PI * 2);
      expect(project(pose, [p[0], p[1] - LOOP_A.w / 2, 0])[1]).toBeLessThan(868);
    }
    expect(new Set(FOLDERS.map((f) => f.sheets)).size).toBe(8);
  });
  it('rings your desk with the loop: the tape clears the slab, and each tab faces its folder', () => {
    const s = { x0: YOU.slab.x0 + YOU_SHIFT_A[0], x1: YOU.slab.x1 + YOU_SHIFT_A[0], y0: YOU.slab.y0 + YOU_SHIFT_A[1], y1: YOU.slab.y1 + YOU_SHIFT_A[1] };
    for (let k = 0; k < 360; k++) {
      const t = (k / 360) * Math.PI * 2;
      const p = loopPoint(LOOP_A, t);
      const n = loopNormal(LOOP_A, t);
      const inner = [p[0] - (n[0] * LOOP_A.w) / 2, p[1] - (n[1] * LOOP_A.w) / 2];
      const inside = inner[0] > s.x0 + 2 && inner[0] < s.x1 - 2 && inner[1] > s.y0 + 2 && inner[1] < s.y1 - 2;
      expect(inside).toBe(false);
    }
    for (const fl of FOLDERS) {
      const t = tabAt(LOOP_A, fl);
      const p = loopPoint(LOOP_A, t);
      const n = loopNormal(LOOP_A, t);
      const toward = Math.atan2(fl.c[1] - p[1], fl.c[0] - p[0]);
      // the tab leaves the tape outward and turns to its folder
      expect(n[0] * Math.cos(toward) + n[1] * Math.sin(toward)).toBeGreaterThan(0.3);
    }
  });
  it('leaves the request a creased corner clear of every later piece of the heap', () => {
    const flap = [REQUEST_A.c[0] + Math.cos(REQUEST_A.rot) * (REQUEST_A.l / 2 - REQUEST_A.crease / 2), REQUEST_A.c[1] + Math.sin(REQUEST_A.rot) * (REQUEST_A.l / 2 - REQUEST_A.crease / 2)];
    const over = HEAP.filter((p) => p.z > requestZ());
    expect(over.length).toBeGreaterThanOrEqual(3);
    for (const p of over) expect(dist(p.c, flap)).toBeGreaterThan(55);
  });
  it('prints whole lines that fit their sheets (16 u mono, 0.6 em advance)', () => {
    for (const fl of FOLDERS) for (const l of FOLDER_PRINT[fl.n - 1].lines) expect(8 + l.length * 9.6).toBeLessThan(fl.w - 10);
  });
});

describe('your desk in act one', () => {
  it('stands north-east of its act-two place, its in-tray empty, the strut on the lid and the bulb out of the hood', () => {
    const y = youPoseA(A);
    expect(y.shift[0]).toBeGreaterThan(0);
    expect(y.shift[1]).toBeGreaterThan(0);
    expect(y.inTray).toBe(true);
    expect(y.inTraySlip).toBe(false);
    expect(y.strut).toBe('lid');
    expect(y.bulbOut).toBeGreaterThan(0);
    expect(youPoseAt(ACT_ONE_END)).toBe(YOU_POSE_B);
    expect(youPoseAt(2225)).toBe(YOU_POSE_B);
  });
  it('bends one lamp inside the loop: the arms keep their lengths, the elbow up (the Λ), only the light crosses the tape to F3', () => {
    const y = youPoseA(A);
    const { base, elbow, head, aim } = y.lamp;
    const foot: P3 = [base[0], base[1], base[2] + LAMP_FOOT_Z];
    expect(dist(foot, elbow)).toBeCloseTo(LAMP_ARMS.lower, 3);
    expect(dist(elbow, head)).toBeCloseTo(LAMP_ARMS.upper, 3);
    expect(elbow[2]).toBeGreaterThan(head[2]);
    expect(aim[2]).toBeLessThan(head[2]);
    // the hood aims north at F3
    expect(aim[1]).toBeGreaterThan(head[1]);
    // every joint, seen through the camera, lies inside the loop's outer edge (no arm reaches past the tape toward a folder)
    const L = LOOP_A;
    for (const p of [foot, elbow, head]) {
      const w: P3 = [p[0] + y.shift[0], p[1] + y.shift[1], p[2]];
      // the point on the desk the camera sees it over (its height pushes it north on screen by z·tan 15°)
      const seen: [number, number] = [w[0], w[1] + w[2] * Math.tan((15 * Math.PI) / 180)];
      const q = ((seen[0] - L.c[0]) / (L.a + L.w / 2)) ** 2 + ((seen[1] - L.c[1]) / (L.b + L.w / 2)) ** 2;
      expect(q).toBeLessThan(1);
    }
  });
  it('fits its footprints in the shaders', () => {
    expect(actOneFootprints(A).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
});

describe('act one over time (beats 1–2)', () => {
  const at = (f: number) => actOneAt(f);
  it('opens on a working intake: frame 0 already has a piece in the air and the lamp swinging', () => {
    expect(at(0).posts.length).toBeGreaterThan(0);
    expect(dist(at(0).lamp.aim, at(3).lamp.aim)).toBeGreaterThan(0.5);
  });
  it('turns the request vermilion on its cue (f20), over a few frames, never in one', () => {
    // a hint the frame before, vermilion on the hit itself (L1-15), never all of it in one frame
    expect(at(REQUEST_INK - 2).request.ink).toBe(0);
    expect(at(REQUEST_INK - 1).request.ink).toBeLessThan(0.2);
    expect(at(REQUEST_INK).request.ink).toBeGreaterThan(0.5);
    expect(at(REQUEST_INK).request.ink).toBeLessThan(0.75);
    expect(at(REQUEST_INK + 12).request.ink).toBeGreaterThan(0.95);
  });
  it('buries and creases the request from f100: half buried by f150, its east corner clear', () => {
    expect(at(99).request.lift).toBe(0);
    expect(at(160).request.lift).toBeGreaterThan(REQUEST_A.lift * 0.9);
    const R = REQUEST_A;
    const over = HEAP.filter((p) => p.z > requestZ() && p.lands >= 100 && p.lands <= 150);
    expect(over.length).toBeGreaterThanOrEqual(3);
    // nothing lies on the request at f0: it is the newest of the old heap there
    expect(HEAP.filter((p) => p.lands === -Infinity && p.z > requestZ() && dist(p.c, R.c) < (R.l + Math.max(...PIECE[p.kind])) / 2 * 0.8)).toHaveLength(0);
  });
  it('posts every new piece out of its feeder’s mouth, on its rhythm, and keeps it on the heap once it lands', () => {
    for (const [i, h] of HEAP.entries()) {
      if (h.lands === -Infinity) continue;
      const first = postPose(h, i, postedAt(h))!;
      expect(first).not.toBeNull();
      expect(dist(first.p, MOUTH[FEEDER_OF[h.kind]].in)).toBeLessThan(1e-6);
      expect(postPose(h, i, postedAt(h) - 1)).toBeNull();
      expect(at(h.lands).landed).toBeGreaterThan(i);
      expect(at(1399).landed).toBeGreaterThan(i);
    }
    // still (a)'s slip lands and stays (it used to vanish at f920)
    const k = HEAP.findIndex((h) => h.lands === FLIGHT.posted + 15);
    expect(k).toBeGreaterThan(0);
    expect(at(921).landed).toBeGreaterThan(k);
  });
  it('posts F6–F8 whole: the board thrown in from beyond the top edge lands on its cue, its slip lands on it as its card, the clip snaps on', () => {
    for (const n of [6, 7, 8]) {
      const arrive = ARRIVE[n];
      const fl = FOLDERS[n - 1];
      const i = n - 1;
      const t0 = boardThrown(n);
      // full scale from the frame it is thrown, from beyond the frame's top edge; never there before
      expect(at(t0 - 1).folders[i].present).toBe(0);
      expect(at(t0).folders[i].present).toBe(1);
      const b0 = boardAt(fl, t0)!;
      expect(project(pose, [fl.c[0] + b0.off[0], fl.c[1] - fl.d / 2 + b0.off[1], b0.off[2]])[1]).toBeLessThan(0);
      // it comes down onto its place on its cue (the last frames straight down, so its shadow tightens), squashing as it lands
      const z = [3, 2, 1].map((k) => boardAt(fl, arrive - k)!.off[2]);
      expect(z[0]).toBeGreaterThan(z[1]);
      expect(z[1]).toBeGreaterThan(z[2]);
      expect(z[2]).toBeGreaterThan(0.5);
      expect(boardAt(fl, arrive)?.off ?? [0, 0, 0]).toEqual([0, 0, 0]);
      expect(boardAt(fl, arrive + 2)!.squash).toBeGreaterThan(0);
      // its event slip is in the air until it lands on the board, then the board draws it as its card: never a frame with neither
      const s0 = eventLands(n) - EVENT_ARC.arc - 3;
      for (let f = s0; f <= eventLands(n) + 3; f++) expect(eventSlipAt(n, f) !== null || at(f).folders[i].card, `F${n} f${f}`).toBe(true);
      expect(eventSlipAt(n, eventLands(n))).toBeNull();
      const last = eventSlipAt(n, eventLands(n) - 1)!;
      expect(dist([last.p[0], last.p[1]], cardWorld(fl).c)).toBeLessThan(12);
      // it settles onto the stack over its last frames, its fall slowing (it had dropped 15 u in its last frame): R-A1-slip-landing
      const zs = [5, 4, 3, 2, 1].map((k) => eventSlipAt(n, eventLands(n) - k)!.p[2] - (stackTop(fl) + 0.2));
      const drops = [...zs.slice(1), 0].map((z, k) => zs[k]! - z);
      expect(drops.every((d) => d > 0), `F${n}`).toBe(true);
      expect(drops[4]!, `F${n}`).toBeLessThan(6);
      expect(drops[4]!, `F${n}`).toBeLessThan(drops[2]!);
      // never shaded by its own footprint as it flutters (it flew in grey and turned to paper as it landed)
      for (let f = s0; f < eventLands(n); f++) {
        const e = eventSlipAt(n, f)!;
        const own = actOneFootprints(at(f)).find((x) => x.kind === 'rect' && x.c[0] === e.p[0] && x.c[1] === e.p[1]);
        const face = e.p[2] + 0.7 * Math.cos(e.tilt) - (CARD[fl.card][1] / 2) * Math.abs(Math.sin(e.tilt));
        if (own?.kind === 'rect') expect(face, `F${n} f${f}`).toBeGreaterThan(own.z1 + 0.2);
        else throw new Error(`F${n} f${f}: no footprint`);
      }
      expect(at(eventLands(n) - 1).folders[i].card).toBe(false);
      // the clip rides open on the board, then slides onto the card and snaps shut (spring-dock)
      expect(at(arrive + CLIP_AFTER).folders[i].clip).toBe(0);
      expect(at(arrive + CLIP_AFTER + 2).folders[i].clip).toBeGreaterThan(0);
      expect(at(arrive + CLIP_AFTER + 14).folders[i].clip).toBeGreaterThan(0.95);
      expect(at(arrive + 2).folders[i].tab).toBe(0);
      expect(at(arrive + 10).folders[i].note).toBe(0);
      expect(at(arrive + 40).folders[i].tab).toBeGreaterThan(0.99);
      expect(at(arrive + 40).folders[i].note).toBe(1);
    }
  });
  it('never shades a landing folder by its own footprint: its top squashes with the board, so F6–F8 never blink dark (L1-01)', () => {
    for (const n of [6, 7, 8]) {
      const arrive = ARRIVE[n];
      const fl = FOLDERS[n - 1];
      for (let f = arrive - 2; f <= arrive + 10; f++) {
        const s = at(f).folders[n - 1];
        const sq = s.board?.squash ?? 0;
        const off = s.board?.off ?? [0, 0, 0];
        // the top sheet's surface as drawn (objects/ActOne.tsx: at stackTop + 0.1, the folder scaled by 1 - squash in z)
        const top = off[2] + (stackTop(fl) + 0.1) * (1 - sq);
        const own = folderFootprints(fl, s)[0];
        expect(own.kind).toBe('rect');
        // gl/light.ts shades a receiver at height z by a footprint whose top is over z
        expect((own as { z1: number }).z1, `F${n} f${f}`).toBeLessThan(top);
      }
      // the squash is still there (3%), only its shadow no longer cuts the sheet
      expect(Math.max(...[1, 2, 3, 4, 5].map((k) => boardAt(fl, arrive + k)?.squash ?? 0))).toBeCloseTo(0.03, 3);
    }
  });
  it('lands the chores as posts on their cues: off the frame’s top edge when thrown, the tray nudging 2 f after', () => {
    for (const id of ['key', 'glass', 'strut'] as const) {
      const P = CHORE_POSTS[id];
      expect(at(P.lands - 1).chores[id]).toBe(0);
      expect(at(P.lands).chores[id]).toBe(1);
      const start = choreFlightAt(id, P.lands - CHORE_ARC.arc - 3)!;
      expect(start).not.toBeNull();
      expect(choreFlightAt(id, P.lands - CHORE_ARC.arc - 4)).toBeNull();
      const from = youPoseA(at(P.lands - 15));
      const w: P3 = [P.from[0] + from.shift[0], P.from[1] + from.shift[1], P.from[2]];
      expect(project(pose, w)[1]).toBeLessThan(0);
    }
    expect(trayNudgeAt(CHORE_POSTS.key.lands + 1)).toBe(0);
    expect(trayNudgeAt(CHORE_POSTS.key.lands + 5)).toBeGreaterThan(0);
    expect(trayNudgeAt(CHORE_POSTS.key.lands + 20)).toBe(0);
  });
  it('never lifts or lowers a pen or a flag, nor lights or warms a folder, in one frame (4 f, both ways)', () => {
    for (let f = 0; f < 1419; f++) {
      const a0 = at(f).folders;
      const a1 = at(f + 1).folders;
      a0.forEach((s, i) => {
        expect(Math.abs(a1[i].pen - s.pen), `F${i + 1} pen f${f}`).toBeLessThanOrEqual(0.26);
        expect(Math.abs(a1[i].flag - s.flag), `F${i + 1} flag f${f}`).toBeLessThanOrEqual(0.26);
        // a folder's lit sheet comes up and goes down over 4 f (the hook's judder, bar 11's strobe)
        expect(Math.abs(a1[i].lit - s.lit), `F${i + 1} lit f${f}`).toBeLessThanOrEqual(0.3);
        expect(Math.abs(a1[i].warmth - s.warmth), `F${i + 1} warmth f${f}`).toBeLessThanOrEqual(0.3);
      });
    }
  });
  it('closes the loop’s clip on the hub without a pop: the clip rides the tape from the start and snaps down', () => {
    expect(at(0).loop.closed).toBe(0);
    expect(at(881).loop.closed).toBeGreaterThan(0);
    expect(at(881).loop.closed).toBeLessThan(0.5);
  });
  it('brings your label in only once the camera has settled (beat 2), leader first', () => {
    expect(youLabelAt(399)).toBeNull();
    expect((youLabelAt(YOU_LABEL_FROM + 3) as { wipe: number }).wipe).toBe(0);
    expect(youLabelAt(YOU_LABEL_FROM + 20)).toEqual({ leader: 1, wipe: 1 });
    expect(YOU_LABEL_FROM).toBeGreaterThan(ACT_ONE_MOVE.to);
    // it leaves as beat 3 begins (6 f, never a slide), clear of Fix B's trays
    expect(youLabelAt(YOU_LABEL_OUT - 1)).toEqual({ leader: 1, wipe: 1 });
    expect(youLabelAt(YOU_LABEL_OUT + 3)).toEqual({ opacity: 0.5 });
    expect(youLabelAt(YOU_LABEL_OUT + 6)).toBeNull();
  });
});

describe('act one’s camera', () => {
  it('holds the hook at 1.6x, eases out on bar 3’s downbeat to FRAMING_A and leaves the later moves as they were', () => {
    expect(FRAMING_HOOK.zoom).toBe(1.6);
    expect(ACT_ONE_MOVE).toMatchObject({ from: 160, to: 320, a: FRAMING_HOOK, b: FRAMING_A });
    expect(cameraAt(0, 15)).toEqual(deskCamera(FRAMING_HOOK, 15));
    expect(cameraAt(160, 15)).toEqual(deskCamera(FRAMING_HOOK, 15));
    expect(cameraAt(320, 15)).toEqual(deskCamera(FRAMING_A, 15));
    expect(cameraAt(1400, 15)).toEqual(deskCamera(FRAMING_A, 15));
    expect(framingAt(1500)).toEqual(FRAMING_A);
  });
  it('frames the west end in the hook: the four feeders and the lamp in, the calendar clear of the notes band', () => {
    const p = deskCamera(FRAMING_HOOK, 15);
    const chatTop = project(p, [-942, 470, 60]);
    expect(chatTop[1]).toBeGreaterThan(20);
    expect(project(p, [-1004, -60, 0])[1]).toBeLessThan(900);
    expect(project(p, [-1004, -60, 0])[0]).toBeGreaterThan(96);
    const lamp = youPoseA(actOneAt(0)).lamp.head;
    expect(project(p, [lamp[0] + YOU_SHIFT_A[0], lamp[1] + YOU_SHIFT_A[1], lamp[2]])[0]).toBeGreaterThan(1300);
  });
  it('maps a screen point to the desk and back (the title card holds still on screen through the move)', () => {
    for (const f of [160, 200, 240, 300, 320]) {
      const q = cameraAt(f, 15);
      for (const s of [[112, 446], [768, 1026], [960, 540]] as const) {
        const w = screenToDesk(q, s, 52);
        const back = project(q, w);
        expect(Math.abs(back[0] - s[0]) + Math.abs(back[1] - s[1])).toBeLessThan(0.05);
      }
    }
  });
});

describe('the title card (1.2)', () => {
  const { frames, place } = TITLE_CARD;
  const outline = (f: number): P2[] => {
    const q = cardCorners(TITLE_CARD, cardAt(TITLE_CARD, f));
    return [q.nw, q.ne, q.se, q.sw].map((w) => project(cameraAt(f, 15), w));
  };
  const inside = (q: P2, poly: P2[]) => {
    let on = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      if (poly[i][1] > q[1] !== poly[j][1] > q[1] && q[0] < ((poly[j][0] - poly[i][0]) * (q[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) on = !on;
    return on;
  };
  it('is posted in from beyond the frame once C1 has gone, lands on the thump and is wholly off the frame by f380', () => {
    expect(frames.land).toBe(cue('title-thump').frame);
    expect(frames.enter).toBeGreaterThanOrEqual(cue('c1').end! + TEXT_OUT);
    for (const c of outline(frames.enter)) expect(c[1] > 1080 || c[0] < 0).toBe(true);
    expect(cardAt(TITLE_CARD, frames.enter - 1).present).toBe(false);
    expect(frames.gone).toBeLessThanOrEqual(380);
    expect(cardAt(TITLE_CARD, frames.gone).present).toBe(false);
    for (const c of outline(frames.gone - 1)) expect(c[0]).toBeLessThan(0);
    // it holds still on the desk while its title is read, and leaves as the title fades: its anticipation, then its slide
    expect(frames.leave + CARD_POST.anticFrames + CARD_POST.outFrames + 1).toBe(frames.gone);
    expect(cue('title').end! - frames.leave).toBeLessThanOrEqual(CARD_POST.anticFrames + 3);
    for (let f = frames.land; f < frames.leave; f++) expect(cardAt(TITLE_CARD, f).off).toEqual([0, 0, 0]);
  });
  it('leaves at a bounded pace (at most 120 px a frame), lifting off first and moving east before it goes west', () => {
    const c = (f: number) => {
      const q = outline(f);
      return [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
    };
    for (let f = frames.leave; f < frames.gone - 1; f++) {
      const a = c(f);
      const b = c(f + 1);
      expect(Math.hypot(b[0] - a[0], b[1] - a[1]), `f${f}`).toBeLessThanOrEqual(120);
    }
    // the anticipation: up off its place and a little east, its contact going as it lifts
    const antic = frames.leave + CARD_POST.anticFrames;
    expect(cardAt(TITLE_CARD, antic).off[0]).toBeGreaterThan(0);
    expect(cardAt(TITLE_CARD, antic).off[2]).toBeGreaterThan(2);
    expect(cardAt(TITLE_CARD, antic).contact).toBe(0);
    for (let f = frames.leave; f < antic; f++) {
      expect(cardAt(TITLE_CARD, f + 1).contact).toBeLessThanOrEqual(cardAt(TITLE_CARD, f).contact);
      expect(cardAt(TITLE_CARD, f).contact - cardAt(TITLE_CARD, f + 1).contact).toBeLessThanOrEqual(0.45);
    }
    // it moves west only once it is up over the calendar pad and the mail box west of it (never through them)
    for (let f = antic; f < frames.gone; f++) expect(place.z + cardAt(TITLE_CARD, f).off[2], `f${f}`).toBeGreaterThan(GENERIC_FEEDERS.mailH + 2);
    for (let f = frames.leave; f < antic; f++) expect(cardAt(TITLE_CARD, f).off[0]).toBeGreaterThanOrEqual(0);
  });
  it('comes to rest over its place with no vertical speed, lifts 3 f, then drops onto it, its contact shadow tightening over the last 4 f', () => {
    const z = (f: number) => cardAt(TITLE_CARD, f).off[2];
    const drop = frames.land - CARD_POST.dropFrames;
    const lift = drop - CARD_POST.liftFrames;
    expect(lift - frames.enter).toBeGreaterThanOrEqual(10);
    // the arc's last step is a fraction of its first: it slows into the hover
    expect(Math.abs(z(lift) - z(lift - 1))).toBeLessThan(Math.abs(z(frames.enter + 1) - z(frames.enter)) / 4);
    expect(Math.abs(cardAt(TITLE_CARD, lift).off[0] - cardAt(TITLE_CARD, lift - 1).off[0])).toBeLessThan(4);
    expect(z(drop)).toBeGreaterThan(z(lift));
    expect(z(lift)).toBeLessThan(30);
    for (let f = drop; f < frames.land; f++) {
      expect(z(f + 1)).toBeLessThan(z(f));
      expect(cardAt(TITLE_CARD, f + 1).contact).toBeGreaterThan(cardAt(TITLE_CARD, f).contact);
    }
    expect(cardAt(TITLE_CARD, frames.land).off).toEqual([0, 0, 0]);
    expect(cardAt(TITLE_CARD, frames.land).contact).toBeGreaterThanOrEqual(0.8);
    // low on the desk: its underside on the flat paper under it, its shadow a contact shadow
    expect(place.z).toBeLessThan(5);
    const fp = cardFootprint(TITLE_CARD, cardAt(TITLE_CARD, 200)) as { z0: number; z1: number };
    expect(fp.z0).toBeLessThan(5);
    expect(fp.z1 - fp.z0).toBeCloseTo(CARD_T, 6);
  });
  it('has a contact shadow on the desk round it that comes in over the drop, holds at rest and fades as it lifts off', () => {
    for (let f = frames.enter; f < frames.gone; f++) {
      const s = cardAt(TITLE_CARD, f);
      const c = cardContactFootprint(TITLE_CARD, s) as { kind: string; h: P2; z0: number; z1: number; contact: number } | null;
      // only while the card's contact is (the drop, the rest, the lift off), as strong as it
      expect(c === null, `f${f}`).toBe(s.contact <= 0);
      if (!c) continue;
      expect(c.contact).toBe(s.contact);
      // film-thin on the desk (only the desk receives it) and inside the card's outline (its own sliver of shade under it)
      expect(c.z0).toBe(0);
      expect(c.z1 - 0.5).toBeLessThanOrEqual(0.1);
      expect(c.h[0]).toBeCloseTo(place.w / 2 - CARD_CONTACT_INSET, 9);
      expect(c.h[1]).toBeCloseTo(place.d / 2 - CARD_CONTACT_INSET, 9);
      // and it is cast every frame it exists (actOneFrameFootprints)
      expect(actOneFrameFootprints(f).some((x) => x.kind === 'rect' && x.z0 === 0 && x.z1 === c.z1 && x.contact === c.contact), `f${f}`).toBe(true);
    }
    expect(cardContactFootprint(TITLE_CARD, cardAt(TITLE_CARD, frames.land - CARD_POST.dropFrames))).toBeNull();
    expect(cardContactFootprint(TITLE_CARD, cardAt(TITLE_CARD, frames.land))!.kind).toBe('rect');
    // a board, not a sticker: its edge shows under the 15° camera
    expect(CARD_T).toBeGreaterThanOrEqual(4);
  });
  it('grounds the credit on a halo that hugs its ink, as C28’s: no box, so no edge cuts the loop’s tape (L1-04)', () => {
    const g = NOTES_GROUND[CREDIT_CUE]!;
    const { top, ...halo } = g;
    expect(halo).toEqual(NOTES_GROUND.c28);
    // cut off just over the ascenders: the tape's lower edge lies a few px over them through the hold, and the halo's full
    // reach dented it (R-A6-halo-bites); whole to 2 px over them, gone 10 px over them
    expect(top).toBeDefined();
    const cut = notesHaloTop(g, TYPE.notesEn.size)!;
    const ascenders = NOTES.enBaseline - NOTES_ASCENT * TYPE.notesEn.size;
    expect(ascenders - cut.full).toBeGreaterThanOrEqual(2);
    expect(ascenders - cut.zero).toBeLessThanOrEqual(10);
    expect(notesHaloTop(NOTES_GROUND.c28!, TYPE.notesEn.size)).toBeNull();
    // dense enough under the glyphs for 4.5:1 over the brightest tape (sRGB mix with the slate), and a soft reach (no edge)
    const lum = (v: number) => ((v / 255 + 0.055) / 1.055) ** 2.4;
    const under = (1 - g.alpha) * 0xc8 + g.alpha * 0x21;
    expect((lum(0xe9) + 0.05) / (lum(under) + 0.05)).toBeGreaterThan(4.5);
    expect(g.blur).toBeGreaterThanOrEqual(5);
    // the halo merges the glyphs (no scalloped tape between them) and stays inside title-safe under the line
    expect(g.dilate).toBeGreaterThanOrEqual(8);
    expect(NOTES.enBaseline + 0.27 * TYPE.notesEn.size + notesHaloReach(g)).toBeLessThanOrEqual(1080);
  });
  it('lies on the desk in the world: it rides the camera move, the request’s corner in view beside it the whole time', () => {
    // world-locked: its outline on screen is the projection of one fixed place through each frame's camera
    const a = outline(170);
    const b = outline(300);
    expect(Math.abs(a[0][0] - b[0][0]) + Math.abs(a[0][1] - b[0][1])).toBeGreaterThan(100);
    const w = (q: P2[]) => q[1][0] - q[0][0];
    expect(w(b) / w(a)).toBeCloseTo(cameraAt(170, 15).focus / cameraAt(300, 15).focus, 1);
    const R = REQUEST_A;
    const corner: P3 = [R.c[0] + Math.cos(R.rot) * R.l * 0.42, R.c[1] + Math.sin(R.rot) * R.l * 0.42, requestZ() + 1];
    for (let f = frames.enter; f < frames.gone; f++) expect(inside(project(cameraAt(f, 15), corner), outline(f)), `f${f}`).toBe(false);
    // nothing under it but flat paper: clear of the calendar pad, the mail box's envelope, the request and your loop's clip
    expect(place.x0).toBeGreaterThan(GENERIC_FEEDERS.pad.x1);
    expect(place.y1).toBeLessThan(GENERIC_FEEDERS.envelope.c[1] - GENERIC_FEEDERS.envelope.d / 2 + 1);
    expect(place.x0 + place.w).toBeLessThan(LOOP_A.c[0] - LOOP_A.a - 26 - 12);
  });
  it('sets the title exactly, every line at least 36 px and at most 136 px wherever the camera is, inside title-safe and above the notes band', () => {
    const lines = TITLE_CARD.lines;
    const han = (t: string) => /[一-鿿]/.test(t);
    expect(lines.filter((l) => !han(l.text)).map((l) => l.text).join(' ')).toBe(WORDS.title.en);
    expect(lines.filter((l) => han(l.text)).map((l) => l.text).join('')).toBe(WORDS.title['zh-Hans']);
    for (const l of lines) expect(l.weight).toBe(han(l.text) ? TYPE.titleZh.weight : TYPE.titleEn.weight);
    for (let f = frames.land; f < frames.leave; f += 4) {
      const m = cardMatrix(TITLE_CARD, cardAt(TITLE_CARD, f), cameraAt(f, 15));
      const sx = Math.hypot(m[0], m[1]);
      const sy = Math.hypot(m[2], m[3]);
      for (const l of lines) {
        expect(l.size * Math.min(sx, sy), `f${f} ${l.text}`).toBeGreaterThanOrEqual(36);
        expect(l.size * Math.max(sx, sy)).toBeLessThanOrEqual(136);
        const p = (x: number, y: number): P2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
        const top = p(l.x, l.y - l.size);
        const bottom = p(l.x, l.y + l.size * 0.15);
        expect(top[0]).toBeGreaterThanOrEqual(96);
        expect(top[1]).toBeGreaterThanOrEqual(54);
        expect(bottom[1]).toBeLessThan(868);
      }
    }
    // the card's own words never run past its edge
    for (const l of lines) expect(l.x + l.text.length * l.size * (han(l.text) ? 1 : 0.6)).toBeLessThan(place.w - 8);
  });
});

describe('still (a)’s critic fixes', () => {
  it('keeps the lamp’s arm off the laptop’s screen on every frame (seen from the camera)', () => {
    const L = YOU.laptop;
    const lidTop = YOU.top + 8 + YOU.lidH * Math.cos(YOU.lidLean);
    const lidY = L.y1 + YOU.lidH * Math.sin(YOU.lidLean);
    const w = (q: readonly number[]): P3 => [q[0] + YOU_SHIFT_A[0], q[1] + YOU_SHIFT_A[1], q[2]];
    const p = deskCamera(FRAMING_A, 15);
    const a0 = project(p, w([L.x0 + 14, L.y1, YOU.top + 8]));
    const a1 = project(p, w([L.x1, lidY, lidTop]));
    for (let f = 320; f < 1400; f += 4) {
      const y = youPoseA(actOneAt(f));
      const el = project(p, w(y.lamp.elbow));
      expect(el[0] > a0[0] && el[0] < a1[0] && el[1] < a0[1] && el[1] > a1[1]).toBe(false);
    }
  });
  it('sets each tape note at its own folder’s tab on every frame (open or shut, slack or tight), the notes not overlapping', () => {
    expect(TAB_SHARE).toHaveLength(FOLDERS.length);
    for (let f = 0; f < 1400; f += 7) {
      const L = actOneAt(f).loop;
      const notes = loopNotesAt(L);
      const arc = loopArc(L);
      // no two notes touch: the gap between neighbours' ends is 4 u or more
      for (let i = 1; i < notes.length; i++) expect(Math.abs(notes[i] - notes[i - 1]) - (LOOP_NOTES[i].length * 9 + 4 + LOOP_NOTES[i - 1].length * 9 + 4) / 2, `notes ${i - 1}-${i} f${f}`).toBeGreaterThan(4);
      // every note whole on the tape, open or shut (F1's "reply ok" was cut by the open end)
      notes.forEach((u, i) => expect(u + (LOOP_NOTES[i].length * 9 + 4) / 2, `note ${i} f${f}`).toBeLessThan(arc.len - 6));
      FOLDERS.forEach((fl, i) => {
        let t = tabAt(L, fl);
        while (t < L.clipAt) t += Math.PI * 2;
        let k = 1;
        while (k < arc.t.length - 1 && arc.t[k] < t) k++;
        const s = arc.s[k - 1] + ((arc.s[k] - arc.s[k - 1]) * (t - arc.t[k - 1])) / (arc.t[k] - arc.t[k - 1]);
        expect(Math.abs(notes[i] - s), `F${fl.n} f${f}`).toBeLessThan(1);
      });
    }
  });
  it('keeps every folder’s outline, lifted pen and flag clear of its neighbours (F7 and F8 collided)', () => {
    const outline = (i: number) => {
      const fl = FOLDERS[i];
      const pts: P2[] = [];
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) pts.push(folderPoint(fl, [(x * fl.w) / 2, (y * fl.d) / 2]));
      const pen = penWorld(fl, { warmth: 0, pen: 1, stroke: 1, flag: 1, present: 1, lit: 0, card: true, clip: 1, tab: 1, note: 1 });
      pts.push([pen[0], pen[1]]);
      return pts;
    };
    const inside = (p: P2, i: number) => {
      const fl = FOLDERS[i];
      const d = [p[0] - fl.c[0], p[1] - fl.c[1]];
      const c = Math.cos(-fl.rot);
      const s = Math.sin(-fl.rot);
      const lx = c * d[0] - s * d[1];
      const ly = s * d[0] + c * d[1];
      return Math.abs(lx) < fl.w / 2 + 2 && Math.abs(ly) < fl.d / 2 + 2;
    };
    for (let i = 0; i < FOLDERS.length; i++) for (let j = 0; j < FOLDERS.length; j++) if (i !== j) for (const p of outline(i)) expect(inside(p, j), `F${i + 1} into F${j + 1}`).toBe(false);
  });
});

describe('your lamp’s swings (f0–1399)', () => {
  const moves = Array.from({ length: 1401 }, (_, i) => {
    const a = lampAimAt(i - 1);
    const b = lampAimAt(i);
    return { aim: Math.hypot(b.aim[0] - a.aim[0], b.aim[1] - a.aim[1]), head: Math.hypot(b.head[0] - a.head[0], b.head[1] - a.head[1]), b };
  });
  it('starts every swing from where the lamp is: its aim and head never jump in a frame, bar 11’s sixteenths included', () => {
    for (let i = 1; i < moves.length - 1; i++) {
      const f = i - 1;
      expect(moves[i].aim, `aim f${f}`).toBeLessThan(200);
      expect(moves[i].head, `head f${f}`).toBeLessThan(60);
      // a jump is one frame's move far beyond both its neighbours' (the swing cut short snapping back to its target)
      expect(moves[i].aim, `aim spike f${f}`).toBeLessThanOrEqual(Math.max(moves[i - 1].aim, moves[i + 1].aim) + 70);
    }
    for (let f = 800; f < 870; f++) expect(moves[f + 1].aim, `bar 11 f${f}`).toBeLessThan(150);
  });
  it('swings to each fix with its head leading and routed round its base, the bulb never flipping across the hood', () => {
    const foot = [LAMP.base[0] + YOU_SHIFT_A[0], LAMP.base[1] + YOU_SHIFT_A[1]];
    const bulb = (f: number) => {
      const a = lampAimAt(f);
      const d = [a.aim[0] - a.head[0], a.aim[1] - a.head[1], a.aim[2] - HEAD_A.z];
      const l = Math.hypot(d[0], d[1], d[2]);
      return [a.head[0] + (d[0] / l) * 76, a.head[1] + (d[1] / l) * 76, HEAD_A.z + (d[2] / l) * 76];
    };
    for (const v of Object.values(FIX_LAMP)) {
      // the light holds still while the head starts (the pool follows the head)
      const a0 = lampAimAt(v.from);
      const h1 = lampAimAt(v.from + AIM_LAG - 1);
      expect(Math.hypot(h1.head[0] - a0.head[0], h1.head[1] - a0.head[1])).toBeGreaterThan(5);
      for (let f = v.from - 2; f < v.from + 24; f++) {
        const h = lampAimAt(f).head;
        expect(Math.hypot(h[0] - foot[0], h[1] - foot[1]), `head f${f}`).toBeGreaterThan(50);
        expect(dist(bulb(f + 1), bulb(f)), `bulb f${f}`).toBeLessThan(80);
      }
    }
    // the swing leads the step-down by 5 f (the rest at Fix A, Fix A itself at Fix B)
    expect(actOneStep(FIX_LAMP.a.from + 4).own!.amount).toBeCloseTo(0, 9);
    expect(actOneStep(FIX_LAMP.a.from + 6).own!.amount).toBeGreaterThan(0);
    expect(actOneStepA(FIX_LAMP.b.from + 4)).toBeCloseTo(0, 9);
    expect(actOneStepA(FIX_LAMP.b.from + 6)).toBeGreaterThan(0);
  });
});
