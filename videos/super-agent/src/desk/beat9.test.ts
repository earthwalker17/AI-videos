import { describe, expect, it } from 'vitest';
// actOne.ts first: it is the module the film's frame code reaches the beat modules through (its tables read state.ts's)
import { youPoseAt } from './actOne.ts';
import { BEAT_9 } from '../cues.ts';
import { cameraAt, project } from './camera.ts';
import { LAYS, LAY_FRAMES, MACHINE_RISE, MARCH, QUEUED, SHEET_CLEARS, STRUT_DOCK, STRUT_LEN, TAGS_9, beamAt, beat9At, drumAt, layAt, machineLampAt, machineRiseAt, marchAt, proposedAt, strutAt } from './beat9.ts';
import { EMIT } from './fpKit.ts';
import { DECK } from './layout.ts';
import { LOOP_SHEET, MACHINES_9, SEAM } from './proposed.ts';
import { MACHINES, VELLUM } from './summary.ts';
import { CHORES, strutInTray } from './you.ts';

describe('beat 9: the vellum laid, the machines, the strut', () => {
  it('restates still (d)’s layout exactly (proposed.ts copies summary.ts)', () => {
    expect(MACHINES_9).toEqual(MACHINES);
    expect(LOOP_SHEET).toEqual(VELLUM.loop);
    expect(SEAM).toBe(5424);
  });

  it('lays each sheet in 12 f from its edge, the first once beat 8’s sheet has cleared its ground', () => {
    expect(LAY_FRAMES).toBe(12);
    expect(LAYS.plan).toBeGreaterThanOrEqual(SHEET_CLEARS.x1050);
    for (const from of Object.values(LAYS)) {
      expect(layAt(from - 1, from)).toBe(0);
      expect(layAt(from, from)).toBeGreaterThan(0);
      expect(layAt(from + LAY_FRAMES - 1, from)).toBe(1);
      for (let f = from; f < from + LAY_FRAMES; f++) expect(layAt(f + 1, from)).toBeGreaterThanOrEqual(layAt(f, from));
    }
  });

  it('raises the machines only once the sheet has passed their ground, never two holes in one slot', () => {
    for (const M of MACHINE_RISE) expect(M.open).toBeGreaterThanOrEqual(SHEET_CLEARS.x1325);
    for (let f = 4580; f < 4640; f++) {
      const open = MACHINE_RISE.map((M, i) => (machineRiseAt(i, f).hole ? M.slot : -1)).filter((x) => x >= 0);
      expect(new Set(open).size).toBe(open.length);
    }
    // before its hatch opens a machine is wholly under the slate; it ends on the slate as still (d) draws it
    MACHINES_9.forEach((m, i) => {
      expect(machineRiseAt(i, MACHINE_RISE[i]!.open).dz).toBeLessThanOrEqual(-m.h);
      expect(machineRiseAt(i, 4640)).toEqual({ leaves: 0, hole: false, dz: 0 });
    });
  });

  it('lifts the strut off your tray as your tray drew it (an identity on the lift frame) and docks it on the loop on its cue', () => {
    const T = strutInTray();
    const lift = strutAt(BEAT_9.strut.lift)!;
    expect(lift.c).toEqual([(T.a[0] + T.b[0]) / 2, (T.a[1] + T.b[1]) / 2, T.a[2]]);
    expect([lift.yaw, lift.tilt, lift.lift, lift.morph]).toEqual([0, 0, 0, 0]);
    expect(STRUT_LEN).toBe(Math.round(Math.hypot(T.b[1] - T.a[1]) * 4) / 4);
    expect(strutAt(BEAT_9.strut.lift - 1)).toBeNull();
    const dock = strutAt(BEAT_9.strut.dock)!;
    expect(dock.c).toEqual(STRUT_DOCK);
    expect(dock.squash).toBeGreaterThan(0);
    expect(CHORES.strut.c[0]).toBe(T.a[0]);
  });

  it('flies the strut on an arc 200 u or more over the deck, never faster on screen than beat 5’s key (2410 px/s)', () => {
    let top = 0;
    let fastest = 0;
    for (let f = BEAT_9.strut.lift; f < BEAT_9.strut.dock; f++) {
      const a = strutAt(f)!;
      const b = strutAt(f + 1)!;
      top = Math.max(top, a.c[2]);
      const pa = project(cameraAt(f, 15), a.c);
      const pb = project(cameraAt(f + 1, 15), b.c);
      fastest = Math.max(fastest, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 30);
    }
    expect(top - DECK.top).toBeGreaterThanOrEqual(200);
    expect(fastest).toBeLessThan(2410);
  });

  it('keeps the server’s lamp under the bloom (EMIT.slotDocs at most) and lights it on its cue', () => {
    expect(machineLampAt(BEAT_9.machineLamp - 1)).toBe(0);
    expect(machineLampAt(BEAT_9.machineLamp)).toBeGreaterThan(0);
    expect(machineLampAt(BEAT_9.machineLamp + 8)).toBeGreaterThan(0.9);
    expect(EMIT.slotDocs).toBeLessThan(1);
  });

  it('drops the queued slip into the server on its cue, half in on the contact frame', () => {
    const q = (f: number) => beat9At(f)!.queued;
    expect(q(BEAT_9.slipDrop - 1)!.p[2]).toBeGreaterThan(MACHINES_9[0]!.h);
    expect(q(BEAT_9.slipDrop)!.p[2]).toBe(MACHINES_9[0]!.h);
    expect(q(QUEUED.gone)).toBeNull();
  });

  it('sweeps the sightline 20 f on each sweep and settles it on the flag, then draws it back into the lens', () => {
    const [s1, s2] = BEAT_9.sweeps;
    expect(beamAt(s1)!.a).toBeLessThan(0);
    expect(beamAt(s1 + BEAT_9.sweepFrames)!.a).toBeGreaterThan(0);
    expect(Math.abs(beamAt(s2 + BEAT_9.sweepFrames)!.a)).toBeLessThan(1e-9);
    expect(beamAt(BEAT_9.flag + 20)).toBeNull();
  });

  it('lands each of its events on its cue frame (the first visible change is on the cue)', () => {
    for (const s of BEAT_9.sweeps) {
      // a visible first step on the cue (a pixel or more at the beam's tip), easing in from rest (never a start at full speed)
      const d0 = Math.abs(beamAt(s)!.a - beamAt(s - 1)!.a);
      const d1 = Math.abs(beamAt(s + 1)!.a - beamAt(s)!.a);
      expect(d0).toBeGreaterThan(0.004);
      expect(d0).toBeLessThan(d1);
      expect(beamAt(s - 1)!.a).toBe(beamAt(s - 2)!.a);
    }
    expect(layAt(BEAT_9.watchdog, BEAT_9.watchdog)).toBeGreaterThan(0);
    expect(strutAt(BEAT_9.strut.lift)).not.toBeNull();
  });

  it('steps the stuck bay’s drum out and back on every beat, never round, and still outside its loop', () => {
    expect(drumAt(BEAT_9.stuck.from - 1)).toBe(0);
    // each step's first move on its beat
    for (let b = BEAT_9.stuck.from; b < BEAT_9.stuck.to; b += 20) expect(drumAt(b)).toBeGreaterThan(drumAt(b - 1) + 0.02);
    expect(drumAt(BEAT_9.stuck.to + 20)).toBe(0);
    for (let f = BEAT_9.stuck.from; f < BEAT_9.stuck.to; f++) expect(Math.abs(drumAt(f))).toBeLessThanOrEqual((Math.PI * 2) / 16 + 1e-9);
    expect(drumAt(BEAT_9.stuck.from + 6)).toBeGreaterThan(0.2);
  });

  it('stops each tether’s march on a whole number of its dash patterns (still (d)’s dashes)', () => {
    for (let i = 0; i < 3; i++) expect(marchAt(i, 5420) % MARCH.period).toBe(0);
  });

  it('ends every proposed part exactly as still (d) draws it by the seam', () => {
    const p = proposedAt(SEAM - 1)!;
    expect(p.lay).toEqual({ plan: 1, cabinet: 1, loop: 1, tethers: 1, watch: 1 });
    expect(p.dz).toEqual([0, 0, 0]);
    expect([p.strutInk, p.plate, p.lamp, p.lampOpen, p.marks, p.flag, p.handle]).toEqual([1, 0, 0, 0, 1, 1, 1]);
    expect(p.etch).toBeNull();
    expect(p.gloss).toEqual([0, 0, 0]);
    expect(p.queries).toEqual([1, 1]);
    expect(p.split).toEqual({ crack: 1, shard: 1, tear: 1, windings: 1, windingsQ: 1 });
    expect(proposedAt(SEAM)).toBeNull();
    expect(proposedAt(LAYS.plan - 1)).toBeNull();
  });

  it('places the proposed tag inside title-safe once bar 58’s ease-out has settled', () => {
    expect(TAGS_9).toHaveLength(1);
    const t = TAGS_9[0]!;
    expect(t.cue).toBe('tag-proposed');
    expect(t.at[0]).toBeLessThanOrEqual(1920 - 96);
    expect(t.at[1]).toBeGreaterThanOrEqual(54 + 36);
    // its foot on the vellum plan of the deck
    const [x, y] = [t.foot[0], t.foot[1]];
    expect(Math.abs(x - VELLUM.plan.c[0])).toBeLessThan(VELLUM.plan.w / 2);
    expect(Math.abs(y - VELLUM.plan.c[1])).toBeLessThan(VELLUM.plan.d / 2);
  });

  it('leaves your desk’s pose to the other beats outside its frames (no reach of its own)', () => {
    expect(youPoseAt(4700).lamp).toEqual(youPoseAt(4559).lamp);
  });
});
