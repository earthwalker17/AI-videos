import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { youPoseAt } from './actOne.ts';
import { LIGHTS } from './DeskWorld.tsx';
import { YOU } from './layout.ts';
import { BAYS } from './layout.ts';
import {
  BEAD_FRAMES,
  DROP_SLOPE,
  EASE_OUT_D,
  FOCUS_LEAD,
  FRAMING_D,
  INK_HOLD,
  LEGS,
  QUERIES,
  REPLY_END,
  REPORT_PORT,
  ROUTE_HOME,
  ROUTE_OUT,
  RAMP_D,
  SPAN_D,
  STAMP,
  STAMP_F,
  TRACE_F,
  TRACE_INK,
  bedAt,
  inkAt,
  inkHold,
  inkLight,
  legAt,
  poseD,
  stampAt,
  summaryAt,
  summaryDeskState,
  summaryLabelAt,
  traceWidthAt,
} from './summary.ts';
import { FRAMING_B, deskCamera, project } from './camera.ts';
import { CHUTE, CHUTE_W, INDEX, KEY, LEG_R, LEG_STRUTS, PRINT_HEAD, RAMP, REEL, WINDOW, type P3 } from './layout.ts';
import { poolsAt } from './pools.ts';
import { DETENT } from './state.ts';
import { YOU_POSE_B } from './you.ts';

/** A leg sampled every `step` u of arc (its arc fraction, point and width). */
const sampled = (leg: (typeof LEGS)['out'], step: number) => {
  const n = Math.ceil(leg.length / step);
  return Array.from({ length: n + 1 }, (_, i) => ({ t: i / n, p: legAt(leg, i / n), w: traceWidthAt(i / n) }));
};
const turnDeg = (a: readonly number[], b: readonly number[], c: readonly number[]): number => {
  const u = [b[0] - a[0], b[1] - a[1]];
  const v = [c[0] - b[0], c[1] - b[1]];
  const d = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};
/** A leg as still D sees it, resampled every `step` px of its length on screen (a stretch along a sight line has none). */
const onScreen = (leg: (typeof LEGS)['out'], pose: ReturnType<typeof poseD>, step: number): number[][] => {
  const dense = sampled(leg, 0.5).map((s) => project(pose, s.p));
  const out = [dense[0]];
  let run = 0;
  for (let i = 1; i < dense.length; i++) {
    run += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    if (run >= step) {
      out.push(dense[i]);
      run = 0;
    }
  }
  return out;
};
/** The circumradius of three screen points (px; Infinity on a straight run). */
const circumR = (a: readonly number[], b: readonly number[], c: readonly number[]): number => {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
};
const linear = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

describe('the summary at the sign-off rest (still D, f5520)', () => {
  it('is posed inside its span, after the stamp', () => {
    expect(ROUND2.stillD).toBeGreaterThanOrEqual(SPAN_D[0]);
    expect(ROUND2.stillD).toBeLessThanOrEqual(SPAN_D[1]);
    expect(STAMP_F).toBe(cue('stamp').frame);
    expect(ROUND2.stillD).toBeGreaterThan(STAMP_F);
  });
  it('draws the route once, out then home, after its cause (the stamp), complete by still D', () => {
    expect(summaryAt(STAMP_F).out).toBeCloseTo(0, 9);
    expect(summaryAt(STAMP_F).home).toBeCloseTo(0, 9);
    for (let f = STAMP_F; f < ROUND2.stillD; f++) {
      const s = summaryAt(f);
      if (s.home > 0) expect(s.out).toBe(1);
    }
    const d = summaryAt(ROUND2.stillD);
    expect(d.out).toBe(1);
    expect(d.home).toBe(1);
    expect(d.ink).toBe(1);
    expect(summaryAt(ROUND2.stillD)).toEqual(d);
  });
  it('runs vermilion from the chat spout to the request bay, and green from its folder home to your in-tray', () => {
    expect(ROUTE_OUT[0][0]).toBeLessThan(-800);
    const inBay = (p: readonly number[]) => p[0] > BAYS.bug.box.x0 && p[0] < BAYS.bug.box.x1 && p[1] > BAYS.bug.box.y0 && p[1] < BAYS.bug.box.y1;
    expect(inBay(ROUTE_OUT[ROUTE_OUT.length - 1])).toBe(true);
    expect(ROUTE_HOME[0]).toEqual(REPORT_PORT);
    expect(inBay(REPORT_PORT)).toBe(true);
    const end = ROUTE_HOME[ROUTE_HOME.length - 1];
    expect(end[0]).toBeGreaterThan(YOU.inTray.x0);
    expect(end[0]).toBeLessThan(YOU.inTray.x1);
  });
  it('ends the reply on the signed slip, in its north margin, its nib clear of the ID', () => {
    const end = legAt(LEGS.home, 1);
    expect(end).toEqual(REPLY_END);
    // the slip (objects/Trace.tsx: 104 x 72 centred 44 u inside the tray's north edge, turned 0.06), in its own frame
    const c = [YOU.inTray.x0 + (YOU.inTray.x1 - YOU.inTray.x0) / 2, YOU.inTray.y1 - 44];
    const dx = end[0] - c[0];
    const dy = end[1] - c[1];
    const local = [dx * Math.cos(0.06) + dy * Math.sin(0.06), -dx * Math.sin(0.06) + dy * Math.cos(0.06)];
    const r = traceWidthAt(1) / 2;
    // inside the slip, below its north edge (36 u up) and above the ID's cap line (the ID's baseline 32 u down, its digits about 21 u tall)
    expect(Math.abs(local[0])).toBeLessThan(52 - r);
    expect(local[1] + r).toBeLessThan(36);
    expect(local[1] - r).toBeGreaterThan(36 - 32 + 21);
    // on the slip, not 50 u west along the tray
    expect(end[2]).toBeGreaterThan(YOU.top + 7.2);
    expect(end[2]).toBeLessThan(YOU.top + 9);
  });
  it('caps every bay (work lights out, stepped down) and empties your chore tray', () => {
    const s = summaryDeskState(ROUND2.stillD);
    expect(s.testsLight).toBe(0);
    expect(s.bugLight).toBe(0);
    expect(s.step.ids).toEqual(expect.arrayContaining(['bugBay', 'docsBay', 'freshBay', 'cord']));
    // W-07 is dead still: every pin passed, none flips during the trace
    for (let f = STAMP_F; f <= ROUND2.stillD; f++) expect(summaryDeskState(f).pins.every((p) => p === 1)).toBe(true);
    expect(youPoseAt(ROUND2.stillD).held).toEqual({ key: 0, glass: 0, strut: 0 });
    expect(youPoseAt(ROUND2.stillB)).toBe(YOU_POSE_B);
  });
  it('draws each open problem’s "?" at least 64 px at 1×', () => {
    for (const q of QUERIES) expect(q.size).toBeGreaterThanOrEqual(64);
  });
  it('runs the green home through the Register: up the groove and the ramp, along the window, through the print head, out along the index arm, down the chute', () => {
    const inBox = (p: readonly number[], b: { x0: number; x1: number; y0: number; y1: number }) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1;
    // up the ramp's quarter pipe (its south lane)
    expect(ROUTE_HOME.some((p) => p[0] > RAMP.x + 5 && p[0] < RAMP.x + RAMP.lip && p[1] < (RAMP.y0 + RAMP.y1) / 2)).toBe(true);
    // along the window's south bar, on its top
    expect(ROUTE_HOME.filter((p) => p[1] >= WINDOW.frame.y0 && p[1] <= WINDOW.frame.y0 + WINDOW.bar && p[2] >= WINDOW.z[1]).length).toBeGreaterThanOrEqual(3);
    // through the print head
    expect(ROUTE_HOME.some((p) => inBox(p, PRINT_HEAD.box))).toBe(true);
    // out along the index arm at your detent
    const along = (p: readonly number[]) => {
      const dx = p[0] - INDEX.pivot[0];
      const dy = p[1] - INDEX.pivot[1];
      const t = dx * Math.cos(DETENT.you) + dy * Math.sin(DETENT.you);
      return t > 10 && t <= INDEX.length && Math.abs(-dx * Math.sin(DETENT.you) + dy * Math.cos(DETENT.you)) < 6;
    };
    expect(ROUTE_HOME.filter(along).length).toBeGreaterThanOrEqual(2);
    expect(sampled(LEGS.home, 2).filter((s) => along(s.p)).length * 2).toBeGreaterThan(40);
    // down the reply chute's bed: through each of its bends from the second on, and inside its trough by the first
    for (const c of CHUTE.slice(2)) expect(ROUTE_HOME.some((p) => p[0] === c[0] && p[1] === c[1])).toBe(true);
    expect(Math.min(...sampled(LEGS.home, 2).map((s) => Math.hypot(s.p[0] - CHUTE[1][0], s.p[1] - CHUTE[1][1])))).toBeLessThan(CHUTE_W / 2);
    // no free arc: no stretch of the route leaps more than 130 u, and it never crosses the other bays' floors
    for (const route of [ROUTE_HOME, ROUTE_OUT]) {
      for (let i = 1; i < route.length; i++) expect(Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])).toBeLessThan(130);
    }
    for (const leg of [LEGS.home, LEGS.out]) {
      // (over their north walls only on the deck's south rail, a level above)
      for (const { p } of sampled(leg, 4)) for (const b of [BAYS.tests, BAYS.docs]) expect(inBox(p, b.box) && p[2] < 100).toBe(false);
    }
  });
  it('runs the vermilion out along the window’s north bar, round the reel’s rim where the tape winds on, then down the ramp', () => {
    const out = sampled(LEGS.out, 2);
    // along the north bar, on its top
    expect(out.filter((s) => s.p[1] >= WINDOW.frame.y1 - WINDOW.bar && s.p[1] <= WINDOW.frame.y1 && s.p[2] >= WINDOW.z[1]).length * 2).toBeGreaterThan(250);
    // on the reel's rim, outside the pack and inside the flange, for at least 100 u
    const onRim = out.filter((s) => {
      const r = Math.hypot(s.p[0] - REEL.x, s.p[1] - REEL.y);
      return r > REEL.packR && r < REEL.r;
    });
    expect(onRim.length * 2).toBeGreaterThan(100);
    expect(ROUTE_OUT.some((p) => p[0] > RAMP.x + 5 && p[0] < RAMP.x + RAMP.lip && p[1] > (RAMP.y0 + RAMP.y1) / 2)).toBe(true);
  });
  it('draws each leg as one smooth path: as still D sees it, no two consecutive 10 px steps turn more than 60°', () => {
    const pose = poseD(ROUND2.stillD, 15);
    for (const leg of [LEGS.out, LEGS.home]) {
      // on screen, step by screen length (where a leg passes from the rail onto the ramp's pipe along a line of sight, it has none)
      const s = onScreen(leg, pose, 10);
      for (let i = 1; i < s.length - 1; i++) expect(turnDeg(s[i - 1], s[i], s[i + 1])).toBeLessThan(60);
      // and in plan, where the 16 u steps are long enough to have a heading (not the drops along a sight line)
      const p = sampled(leg, 16).map((x) => x.p);
      const flat = (a: readonly number[], b: readonly number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let i = 1; i < p.length - 1; i++) if (flat(p[i - 1], p[i]) && flat(p[i], p[i + 1])) expect(turnDeg(p[i - 1], p[i], p[i + 1])).toBeLessThan(60);
    }
  });
  it('turns onto and off the ramp in round arcs as still D sees them: no hairpin, no elbow', () => {
    const pose = poseD(ROUND2.stillD, 15);
    // on screen: the ramp, the east rail and the gusset, above the groove's own bend at the ramp's foot
    const minR = (leg: (typeof LEGS)['out'], box: { x0: number; x1: number; y0: number; y1: number }) => {
      const s = onScreen(leg, pose, 3);
      let r = Infinity;
      for (let i = 3; i < s.length - 3; i++) if (s[i][0] > box.x0 && s[i][0] < box.x1 && s[i][1] > box.y0 && s[i][1] < box.y1) r = Math.min(r, circumR(s[i - 3], s[i], s[i + 3]));
      return r;
    };
    // the green: one arc of RAMP_D.home px off the groove over the pipe onto the rail, a bend of RAMP_D.corner px onto the south rail
    expect(RAMP_D.home).toBeGreaterThanOrEqual(22);
    expect(minR(LEGS.home, { x0: 1084, x1: 1140, y0: 425, y1: 482 })).toBeGreaterThan(RAMP_D.home - 1.5);
    expect(minR(LEGS.home, { x0: 1050, x1: 1084, y0: 425, y1: 490 })).toBeGreaterThan(RAMP_D.corner - 1.5);
    // the red: one arc round the green's, RAMP_D.out px
    expect(minR(LEGS.out, { x0: 1050, x1: 1140, y0: 425, y1: 482 })).toBeGreaterThan(RAMP_D.out - 2);
  });
  it('lays both legs in the ramp’s bed near its middle (red north of it, green south) and on the rails and gusset round the corner', () => {
    const mid = (RAMP.y0 + RAMP.y1) / 2;
    const onPipe = (p: P3) => p[0] > RAMP.x + 12 && p[0] < RAMP.foot - 4 && Math.abs(p[2] - bedAt(p[0], p[1]) - 1.5) < 0.6;
    const red = sampled(LEGS.out, 1).filter((s) => onPipe(s.p));
    const green = sampled(LEGS.home, 1).filter((s) => onPipe(s.p));
    expect(red.length).toBeGreaterThan(20);
    expect(green.length).toBeGreaterThan(20);
    // (until it turns into the groove at the foot)
    for (const s of red) if (s.p[0] < RAMP.foot - 20) expect(s.p[1] - mid).toBeGreaterThan(0);
    for (const s of red) expect(s.p[1] - mid).toBeLessThan(12);
    // the green's apex lies 3-8 u south of the middle (it leaves the pipe southward over its top edge)
    expect(Math.max(...green.map((s) => s.p[1])) - mid).toBeGreaterThan(-8);
    expect(Math.max(...green.map((s) => s.p[1])) - mid).toBeLessThan(-3);
    // round the deck's south-east corner both edges of the green lie on the east rail, the gusset or the south rail
    let side: number[] = [0, 1];
    const home = sampled(LEGS.home, 1);
    for (let i = 1; i < home.length; i++) {
      const [a, b] = [home[i - 1].p, home[i].p];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > 0.35 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])) side = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
      if (b[0] > 276 || b[1] > 160 || b[0] < 200 || Math.abs(b[2] - bedAt(b[0], b[1]) - 1.5) > 0.6) continue;
      for (const k of [1, -1]) expect(bedAt(b[0] + side[0] * k * (home[i].w / 2), b[1] + side[1] * k * (home[i].w / 2))).toBeGreaterThan(100);
    }
  });
  it('ramps every drop and climb: over any 12 u of plan, at most 35 u of fall (save along still D’s line of sight over the ramp’s top edge)', () => {
    expect(DROP_SLOPE).toBeCloseTo(35 / 12, 9);
    const pose = poseD(ROUND2.stillD, 15);
    for (const leg of [LEGS.out, LEGS.home]) {
      const s = sampled(leg, 1).map((x) => x.p);
      for (let i = 0; i < s.length; i++) {
        let plan = 0;
        for (let j = i + 1; j < s.length; j++) {
          plan += Math.hypot(s[j][0] - s[j - 1][0], s[j][1] - s[j - 1][1]);
          if (plan > 12) break;
          if (Math.abs(s[j][2] - s[i][2]) <= 35) continue;
          // a leg passes from the rail onto the ramp's pipe (or back) along the ray that grazes the top edge: unseen
          const [a, b] = [project(pose, s[i]), project(pose, s[j])];
          expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(2.5);
          expect(Math.abs(s[i][0] - RAMP.x)).toBeLessThan(8);
        }
      }
    }
  });
  it('never runs under the deck’s leg struts as still D sees it (the south-east one lands on the bay’s door)', () => {
    const cam = poseD(ROUND2.stillD, 15).pos;
    const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // the closest approach of two segments p1-q1 and p2-q2
    const segDist = (p1: readonly number[], q1: readonly number[], p2: readonly number[], q2: readonly number[]) => {
      const d1 = q1.map((v, i) => v - p1[i]);
      const d2 = q2.map((v, i) => v - p2[i]);
      const r = p1.map((v, i) => v - p2[i]);
      const a = dot(d1, d1);
      const e = dot(d2, d2);
      const b = dot(d1, d2);
      const c = dot(d1, r);
      const f = dot(d2, r);
      const den = a * e - b * b;
      let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      let t = (b * s + f) / e;
      if (t < 0) [t, s] = [0, Math.min(1, Math.max(0, -c / a))];
      else if (t > 1) [t, s] = [1, Math.min(1, Math.max(0, (b - c) / a))];
      return Math.hypot(...p1.map((v, i) => v + d1[i] * s - (p2[i] + d2[i] * t)));
    };
    for (const leg of [LEGS.out, LEGS.home])
      for (const { p } of sampled(leg, 2)) for (const l of LEG_STRUTS) expect(segDist(p, cam, l.top, [l.foot[0], l.foot[1], 0])).toBeGreaterThan(LEG_R + 1);
  });
  it('keeps red and green side by side, never touching or crossing (down the groove, through the door, on the ramp)', () => {
    const out = sampled(LEGS.out, 3);
    const home = sampled(LEGS.home, 3);
    // apart in the world, and apart as still D sees them (a line of sight can lay a raised stretch over the other leg in plan)
    const pose = poseD(ROUND2.stillD, 15);
    let gap = Infinity;
    let screenGap = Infinity;
    for (const a of out)
      for (const b of home) {
        gap = Math.min(gap, Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) - (a.w + b.w) / 2);
        const [pa, pb] = [project(pose, a.p), project(pose, b.p)];
        screenGap = Math.min(screenGap, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) - ((a.w + b.w) / 2) * FRAMING_D.zoom);
      }
    expect(gap).toBeGreaterThan(1);
    expect(screenGap).toBeGreaterThan(0.2);
    // and they do run side by side down the groove: within 16 u of each other for at least 100 u
    const near = out.filter((a) => a.p[2] < 45 && home.some((b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 16));
    expect(near.length * 3).toBeGreaterThan(100);
  });
  it('lands the green under your lamp no brighter than #B8E8C9, and leaves the ink as lit elsewhere', () => {
    const pools = poolsAt(summaryDeskState(ROUND2.stillD));
    const k = inkLight(LIGHTS.key, LIGHTS.fill, KEY);
    expect(k).toBeGreaterThan(0.6);
    expect(k).toBeLessThan(0.9);
    const albedo = linear(TRACE_INK.home);
    const cap = linear('#B8E8C9');
    const lit = (p: P3) => {
      const h = inkHold(p, pools, k);
      return albedo.map((a, c) => {
        let pool = 0;
        for (const q of pools) {
          if (p[2] < q.z[0] || p[2] > q.z[1]) continue;
          pool += q.rgb[c] * Math.exp(-0.5 * (((p[0] - q.c[0]) / q.sigma[0]) ** 2 + ((p[1] - q.c[1]) / q.sigma[1]) ** 2));
        }
        return a * h * (k + pool);
      });
    };
    // the last 200 u (down the chute onto the slip) is under your lamp: held at or below the cap in every channel
    const home = sampled(LEGS.home, 2);
    const tail = home.filter((s) => s.t > 1 - 200 / LEGS.home.length);
    for (const s of tail) lit(s.p).forEach((v, c) => expect(v).toBeLessThanOrEqual(cap[c]));
    // where it lands, the lamp would have washed it out without the hold
    expect(inkHold(REPLY_END, pools, k)).toBeLessThan(0.5);
    // on the deck's south rail no pool reaches it: the ink keeps its albedo as signed off
    expect(inkHold([100, 129, 123.5], pools, k)).toBe(1);
    expect(INK_HOLD).toBeGreaterThan(1);
  });
  it('eases the camera out over bar 69 from the Register at 0.85x to the whole desk at 0.64x, settled before still D', () => {
    expect(EASE_OUT_D.from).toBe(STAMP_F);
    expect(poseD(STAMP_F, 15)).toEqual(deskCamera(FRAMING_B, 15));
    expect(poseD(EASE_OUT_D.to, 15)).toEqual(deskCamera(FRAMING_D, 15));
    expect(poseD(ROUND2.stillD, 15)).toEqual(deskCamera(FRAMING_D, 15));
    expect(poseD(STAMP_F + 30, 15)).not.toEqual(deskCamera(FRAMING_D, 15));
  });
  it('presses your stamp on its cue: a 3 f lift, a 5 f press on spring-dock with a 4% squash, the green spreading from the contact over 6 f', () => {
    expect(stampAt(STAMP_F - 40).p).toEqual(STAMP.rest);
    // the lift: still until it starts, up over 3 f
    const lifts = Array.from({ length: 14 }, (_, i) => stampAt(STAMP_F - 13 + i).p[2]);
    const first = lifts.findIndex((z) => z > STAMP.rest[2] + 1e-9);
    expect(lifts[first + 2]).toBeCloseTo(STAMP.rest[2] + STAMP.lift, 6);
    expect(lifts[first + 1]).toBeLessThan(STAMP.rest[2] + STAMP.lift);
    // the press: 5 f on spring-dock from the top; first on the paper on the contact frame, over the mark, square to the reply
    expect(stampAt(STAMP_F - 4).p[2]).toBeCloseTo(STAMP.rest[2] + STAMP.lift, 6);
    expect(stampAt(STAMP_F - 1).p[2]).toBeGreaterThan(STAMP.paperZ + 1);
    const contact = stampAt(STAMP_F);
    expect(contact.p[2]).toBeCloseTo(STAMP.paperZ, 6);
    expect(contact.p[0]).toBeCloseTo(STAMP.mark[0], 6);
    expect(contact.p[1]).toBeCloseTo(STAMP.mark[1], 6);
    expect(contact.turn).toBeCloseTo(STAMP.turn, 6);
    const squash = Array.from({ length: 6 }, (_, i) => stampAt(STAMP_F + i).squash);
    expect(Math.max(...squash)).toBeCloseTo(0.04, 3);
    expect(squash[1]).toBe(Math.max(...squash));
    // the green: nothing before the contact, its first ink on it, whole 6 f on
    expect(inkAt(STAMP_F - 1)).toBe(0);
    expect(inkAt(STAMP_F)).toBeGreaterThan(0);
    expect(inkAt(STAMP_F + 4)).toBeLessThan(1);
    expect(inkAt(STAMP_F + 5)).toBe(1);
    // and back at its rest, still, by still D; no frame jumps (moves under 34 u a frame, squash and ink in steps)
    expect(stampAt(ROUND2.stillD).p).toEqual(STAMP.rest);
    for (let f = STAMP_F - 20; f < ROUND2.stillD; f++) {
      const [a, b] = [stampAt(f), stampAt(f + 1)];
      expect(Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2])).toBeLessThan(34);
      expect(Math.abs(b.squash - a.squash)).toBeLessThan(0.036);
      expect(inkAt(f + 1) - inkAt(f)).toBeLessThan(0.17);
    }
  });
  it('draws the route at an even pace on screen, at most 900 px/s through the camera’s ease-out, and never stalls', () => {
    const at = (f: number, k: 'out' | 'home', pose = poseD(f, 15)) => project(pose, legAt(LEGS[k], summaryAt(f)[k]));
    for (const k of ['out', 'home'] as const) {
      const [a, b] = TRACE_F[k];
      for (let f = a; f < b; f++) {
        const pose = poseD(f + 1, 15);
        // on the desk (both heads through one pose) and on the frame (each through its own)
        const [p, q] = [at(f, k, pose), at(f + 1, k, pose)];
        const desk = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const r = at(f, k);
        expect(desk).toBeLessThanOrEqual(30);
        expect(Math.hypot(q[0] - r[0], q[1] - r[1])).toBeLessThanOrEqual(31);
        // no stall: off its soft start and stop the head never drops below 75% of its pace
        if (f >= a + 5 && f < b - 5) expect(desk).toBeGreaterThan(20);
      }
    }
    // the score's scratching drag follows these frames: the red draws from the frame after the stamp, the green ends before still D
    expect(TRACE_F.out[0]).toBe(STAMP_F);
    expect(summaryAt(STAMP_F + 1).out).toBeGreaterThan(0);
    expect(TRACE_F.home[1]).toBeLessThan(ROUND2.stillD);
  });
  it('leads the camera with the focus pull by 4-6 f, and settles each nib’s bead over a few frames', () => {
    expect(FOCUS_LEAD).toBeGreaterThanOrEqual(4);
    expect(FOCUS_LEAD).toBeLessThanOrEqual(6);
    const own = (f: number) => summaryDeskState(f).step.own?.amount ?? 0;
    expect(own(EASE_OUT_D.from - FOCUS_LEAD)).toBeCloseTo(0, 9);
    expect(own(EASE_OUT_D.from - FOCUS_LEAD + 1)).toBeGreaterThan(0);
    for (let f = EASE_OUT_D.from - 10; f < EASE_OUT_D.from + 20; f++) expect(own(f + 1) - own(f)).toBeLessThan(0.15);
    // the bead: full while the leg draws, gone BEAD_FRAMES after, in steps
    for (const k of ['out', 'home'] as const) {
      expect(summaryAt(TRACE_F[k][1]).bead[k]).toBe(1);
      expect(summaryAt(TRACE_F[k][1] + BEAD_FRAMES).bead[k]).toBe(0);
      expect(BEAD_FRAMES).toBeGreaterThanOrEqual(2);
    }
  });
  it('takes the labels off for the move and lands them again, still, before still D', () => {
    for (let i = 0; i < 3; i++) {
      expect(summaryLabelAt(STAMP_F - 1, i)).toEqual({});
      expect(summaryLabelAt(STAMP_F + 3, i)?.opacity).toBeCloseTo(0.5, 6);
      expect(summaryLabelAt(STAMP_F + 10, i)).toBeNull();
      // no label is up while the camera moves
      for (let f = STAMP_F + 6; f < EASE_OUT_D.to; f++) expect(summaryLabelAt(f, i)).toBeNull();
      expect(summaryLabelAt(ROUND2.stillD, i)).toEqual({});
    }
  });
});
