import { describe, expect, it } from 'vitest';
// actOne.ts first: it is the module the film's frame code reaches the beat modules through (its tables read state.ts's)
import { youPoseAt } from './actOne.ts';
import { BEAT_9, BEAT_10, cue } from '../cues.ts';
import { FRAMING_D, TO_REGISTER, cameraAt, deskCamera, project, projectBox } from './camera.ts';
import { DRUM, DRUM_MARK, LAYS, LAY_FRAMES, LID, MACHINE_RISE, MARCH, N8_HOLD, PERSIST_WORDS, QUEUED, READING_9, SHEET_CLEARS, STRUT_DOCK, STRUT_LEN, STUCK_PULSE, SUBJECT_TO, TAGS_9, WATCH_INK, beamAt, beat9At, dimLabels9, domDimAt, drumAt, drumMarkAt, readingStep9, flagAt, layAt, lidShutAt, machineLampAt, machineRiseAt, marchAt, persistWordsAt, proposedAt, strutAt, stuckLightAt, watchInkAt } from './beat9.ts';
import { EMIT } from './fpKit.ts';
import { LABELS_AFTER_CARDS, act2LabelsAt } from './film.ts';
import { LAMP_STEPS, STEP_FRAMES, deskStateAt, lampAt, stepAt, type FocusId } from './state.ts';
import { DECK, FRESH, YOU } from './layout.ts';
import { LOOP_SHEET, MACHINES_9, RELEASE, SEAM } from './proposed.ts';
import { FLAG, FLAG_SHAPE, MACHINES, QUERIES, VELLUM } from './summary.ts';
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

  it('shuts your laptop’s lid in frame, meeting the base on the click frame, the frame before the strut lifts', () => {
    const L = YOU.laptop;
    // open until its first frame of motion, gathering speed every frame, shut exactly on the click and after
    expect(lidShutAt(LID.click - LID.frames)).toBe(0);
    for (let f = LID.click - LID.frames; f < LID.click; f++) {
      expect(lidShutAt(f + 1), `f${f + 1}`).toBeGreaterThan(lidShutAt(f));
      if (f > LID.click - LID.frames) expect(lidShutAt(f + 1) - lidShutAt(f), `f${f + 1}`).toBeGreaterThan(lidShutAt(f) - lidShutAt(f - 1));
    }
    expect(lidShutAt(LID.click - 1)).toBeLessThan(0.9);
    expect(lidShutAt(LID.click)).toBe(1);
    expect(lidShutAt(LID.click + 40)).toBe(1);
    expect(youPoseAt(LID.click).lidShut).toBe(1);
    expect(youPoseAt(LID.click - LID.frames).lidShut ?? 0).toBe(0);
    expect(youPoseAt(BEAT_9.away + 10).lidShut ?? 0).toBe(0);
    expect(BEAT_9.strut.lift).toBe(LID.click + 1);
    // the whole laptop (its base and its open lid's top) inside the frame from the lid's first move on
    for (let f = LID.click - LID.frames + 1; f <= LID.click + 10; f++) {
      const b = projectBox(cameraAt(f, 15), [
        [L.x0, L.y0, YOU.top],
        [L.x1, L.y1, YOU.top],
        [L.x0, L.y1, YOU.top + YOU.lidH],
      ]);
      expect(b.x0, `f${f}`).toBeGreaterThanOrEqual(0);
      expect(b.y1, `f${f}`).toBeLessThanOrEqual(1080);
    }
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

  it('flies the strut on an arc 200 u or more over the deck, paced on screen under 1000 px/s with bar 58’s move', () => {
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
    expect(fastest).toBeLessThan(1000);
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

  it('pins the pencil flag on its cue, standing clear of the stuck bay over the bare slate, 64 px or more at 0.64x', () => {
    // pinned on the cue (the staff drawn down to its foot over the 4 f before), inside N8's line
    expect(flagAt(BEAT_9.flag - 5)).toBe(0);
    expect(flagAt(BEAT_9.flag - 1)).toBeLessThan(0.4);
    expect(flagAt(BEAT_9.flag)).toBeCloseTo(0.4, 9);
    expect(BEAT_9.flag).toBeLessThan(cue('n8').end!);
    // its foot on the bay's south-east corner (the nameplate band, under the east wall), its staff up the east wall's top;
    // its pennant east of the bay over the slate, clear of the loop's sheet
    const [fx, fy] = FLAG;
    expect(fx).toBeGreaterThan(FRESH.box.x1 - FRESH.wall);
    expect(fx).toBeLessThan(FRESH.box.x1);
    expect(fy).toBeGreaterThan(FRESH.box.y0);
    expect(fy + FLAG_SHAPE.band).toBe(FRESH.box.y0 + FRESH.southWall);
    expect(fx + FLAG_SHAPE.pennant[0]).toBeLessThanOrEqual(LOOP_SHEET.x0 - 8);
    expect(fx + FLAG_SHAPE.pennant[0] / 2).toBeGreaterThan(FRESH.box.x1 + 10);
    // its staff 64 px or more on screen at still (d)'s framing
    const pose = deskCamera(FRAMING_D, 15);
    const a = project(pose, FLAG);
    const b = project(pose, [fx, fy + FLAG_SHAPE.staff, FLAG[2]]);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThanOrEqual(64);
  });

  it('steps the stuck bay’s drum out and back on every beat, never round, and still outside its loop', () => {
    expect(drumAt(BEAT_9.stuck.from - 1)).toBe(0);
    // each step's first move on its beat
    for (let b = BEAT_9.stuck.from; b < BEAT_9.stuck.to; b += 20) expect(drumAt(b)).toBeGreaterThan(drumAt(b - 1) + 0.02);
    expect(drumAt(BEAT_9.stuck.to + 20)).toBe(0);
    for (let f = BEAT_9.stuck.from; f < BEAT_9.stuck.to; f++) expect(Math.abs(drumAt(f))).toBeLessThanOrEqual(DRUM.step + 1e-9);
    expect(drumAt(BEAT_9.stuck.from + 6)).toBeGreaterThan(0.2);
  });

  it('steps the drum far enough to read at 0.64x, and slowly enough that its cards never alias (under half their pitch a frame)', () => {
    // its top face carried 8 px or more at 1080 (r 32 u at FRAMING_D's 0.64), each frame's turn under half the 28 cards' pitch
    expect(32 * DRUM.step * 0.64).toBeGreaterThanOrEqual(8);
    const pitch = (Math.PI * 2) / 28;
    for (let f = BEAT_9.stuck.from - 2; f < BEAT_9.stuck.to + 2; f++) expect(Math.abs(drumAt(f + 1) - drumAt(f)), `f${f}`).toBeLessThan(0.53 * pitch);
  });

  it('pulses the stuck bay’s work light on every beat of the stuck span, whole on each beat and at both ends (no step)', () => {
    const { from, to } = BEAT_9.stuck;
    expect(stuckLightAt(from - 1)).toBe(1);
    expect(stuckLightAt(to)).toBe(1);
    for (let b = from; b < to; b += 20) {
      expect(stuckLightAt(b), `beat ${b}`).toBe(1);
      expect(stuckLightAt(b + 12), `beat ${b}`).toBeCloseTo(STUCK_PULSE.low, 9);
    }
    for (let f = from - 2; f < to + 2; f++) expect(Math.abs(stuckLightAt(f + 1) - stuckLightAt(f)), `f${f}`).toBeLessThan(0.1);
    expect(deskStateAt(from + 12).next.light).toBeCloseTo(STUCK_PULSE.low * deskStateAt(from).next.light, 9);
  });

  it('steps your desk, your lamp and the DOM’s labels and tag down under N8’s hold (on the focus ramp) and holds them through 10.1', () => {
    // your desk rides the hold from its start (the hand-over adds it on the own set, then the main), never popping
    const on = (f: number) => {
      const st = stepAt(f);
      return st.ids.includes('you') ? st.amount : st.own?.ids.includes('you') ? st.own.amount : 0;
    };
    expect(on(N8_HOLD.from - 1)).toBe(0);
    for (let f = N8_HOLD.from - 1; f < RELEASE + STEP_FRAMES + 1; f++) expect(Math.abs(on(f + 1) - on(f)), `f${f}`).toBeLessThan(0.15);
    for (let f = N8_HOLD.from + STEP_FRAMES; f < RELEASE; f++) expect(on(f), `f${f}`).toBe(1);
    expect(on(RELEASE + STEP_FRAMES)).toBe(0);
    // the lamp two steps down on the same ramp (from LAMP_STEPS.dim to nearly out), back as the hold releases
    const base = lampAt(N8_HOLD.from - 1);
    const low = LAMP_STEPS.dim - 2 * (LAMP_STEPS.up - LAMP_STEPS.dim);
    expect(base).toBeCloseTo(LAMP_STEPS.dim, 9);
    expect(lampAt(N8_HOLD.from + STEP_FRAMES)).toBeCloseTo(low, 9);
    expect(low).toBeGreaterThan(0);
    for (let f = N8_HOLD.from; f < RELEASE + STEP_FRAMES; f++) expect(lampAt(f), `f${f}`).toBeCloseTo(base + (low - base) * on(f), 2);
    expect(lampAt(RELEASE + STEP_FRAMES)).toBeCloseTo(base, 9);
    // the DOM: the role labels' and the proposed tag's opacity on the same ramp, to 55%
    expect(domDimAt(N8_HOLD.from - 1)).toBe(1);
    expect(domDimAt(N8_HOLD.from + STEP_FRAMES)).toBeCloseTo(0.55, 9);
    for (let f = N8_HOLD.from - 1; f <= RELEASE; f++) expect(domDimAt(f), `f${f}`).toBeCloseTo(1 - 0.45 * on(f), 9);
    // ... and holds at 55% past the release until act two's labels have left under bar 65's dolly (review C-R2: no pump),
    // back to 1 by the time they re-enter after 10.2's cards
    for (let f = RELEASE; f < TO_REGISTER.from + 6; f++) expect(domDimAt(f), `f${f}`).toBeCloseTo(0.55, 9);
    expect(domDimAt(LABELS_AFTER_CARDS)).toBe(1);
    const shown = (f: number) => dimLabels9(f, act2LabelsAt(f)).map((l) => l.opacity ?? 1);
    for (let f = RELEASE - 2; f < TO_REGISTER.from + 8; f++) {
      const [a, b] = [shown(f), shown(f + 1)];
      if (b.length === a.length) b.forEach((o, i) => expect(o, `f${f + 1} label ${i}`).toBeLessThanOrEqual(a[i]! + 1e-9));
      else expect(b.length, `f${f + 1}`).toBe(0);
    }
    expect(TAGS_9[0]!.dim).toBe(domDimAt);
    const labels = act2LabelsAt(4850);
    expect(labels.length).toBe(3);
    expect(dimLabels9(4850, labels).map((l) => l.opacity)).toEqual(labels.map((l) => (l.opacity ?? 1) * 0.55));
    expect(dimLabels9(4700, labels)).toEqual(labels);
    // the Watchdog inks up on the same ramp (its lines from 75% to full), back as N8's hold releases
    expect(watchInkAt(N8_HOLD.from - 1)).toBe(1);
    expect(watchInkAt(N8_HOLD.from + STEP_FRAMES)).toBeCloseTo(WATCH_INK.up, 9);
    expect(0.75 * WATCH_INK.up).toBeLessThanOrEqual(0.95);
    // ... and holds it until N8's line has ended and the hand-over after it is done (review C-R8), with the stuck bay
    expect(N8_HOLD.to).toBe(BEAT_9.stuck.to);
    expect(N8_HOLD.to).toBeGreaterThanOrEqual(cue('n8').end!);
    for (let f = N8_HOLD.from + STEP_FRAMES; f <= SUBJECT_TO; f++) expect(watchInkAt(f), `f${f}`).toBeCloseTo(WATCH_INK.up, 9);
    expect(watchInkAt(SUBJECT_TO + STEP_FRAMES)).toBe(1);
    for (let f = N8_HOLD.from - 1; f < SUBJECT_TO + STEP_FRAMES + 1; f++) expect(Math.abs(watchInkAt(f + 1) - watchInkAt(f)), `f${f}`).toBeLessThan(0.05);
    const ids = (f: number) => {
      const st = stepAt(f);
      return [...st.ids, ...(st.own?.ids ?? []), ...(st.late ?? [])];
    };
    for (let f = N8_HOLD.from; f < SUBJECT_TO; f++) expect(ids(f), `f${f}`).not.toContain('freshBay');
    // the vellum and the hatched slip's path come up as N8 ends (one hand-over), done before the slip is posted; the
    // stuck bay steps down after them, done as it is posted
    const level = (f: number, id: FocusId) => {
      const st = stepAt(f);
      return st.ids.includes(id) ? st.amount : st.own?.ids.includes(id) ? st.own.amount : st.late?.includes(id) ? 1 : 0;
    };
    for (const id of ['b9-proposed', 'intake', 'belt', 'head'] as const) {
      expect(level(N8_HOLD.to - 1, id), id).toBe(1);
      expect(level(SUBJECT_TO, id), id).toBe(0);
    }
    expect(level(SUBJECT_TO - 1, 'freshBay')).toBe(0);
    expect(level(SUBJECT_TO + STEP_FRAMES, 'freshBay')).toBe(1);
    expect(SUBJECT_TO + STEP_FRAMES).toBeLessThanOrEqual(BEAT_10.hatch.spout + 6);
  });

  it('turns the Register’s reading lamp down with the hold and back up at the release, on the focus ramp (review C-R3)', () => {
    expect(readingStep9(READING_9.from - 1)).toBe(1);
    for (let f = READING_9.from + STEP_FRAMES; f <= READING_9.to; f++) expect(readingStep9(f), `f${f}`).toBeCloseTo(READING_9.k, 9);
    expect(readingStep9(READING_9.to + STEP_FRAMES)).toBe(1);
    for (let f = READING_9.from - 1; f < READING_9.to + STEP_FRAMES + 1; f++) expect(Math.abs(readingStep9(f + 1) - readingStep9(f)), `f${f}`).toBeLessThan(0.07);
    // nowhere near a key
    for (const f of [915, 2225, 3150, 3439, 5420, 5520]) expect(readingStep9(f)).toBe(1);
  });

  it('marks the stuck card while the stuck bay is the subject, inking in and out on the focus ramp (no still carries it; review C-R4)', () => {
    expect(drumMarkAt(N8_HOLD.from - 1)).toBe(0);
    for (let f = N8_HOLD.from + STEP_FRAMES; f <= SUBJECT_TO; f++) expect(drumMarkAt(f), `f${f}`).toBe(1);
    expect(drumMarkAt(SUBJECT_TO + STEP_FRAMES)).toBe(0);
    for (let f = N8_HOLD.from - 1; f < SUBJECT_TO + STEP_FRAMES + 1; f++) expect(Math.abs(drumMarkAt(f + 1) - drumMarkAt(f)), `f${f}`).toBeLessThan(0.12);
    // inked before the first step and held through the last
    expect(N8_HOLD.from + STEP_FRAMES).toBeLessThanOrEqual(BEAT_9.stuck.from);
    for (const f of [915, 2225, 3150, 3439, 5420, 5520]) expect(drumMarkAt(f)).toBe(0);
    // it faces the camera at rest (south of the top, a card pitch either side) and stays on the drum's upper half while stepped out
    expect(DRUM_MARK.a + DRUM_MARK.half + DRUM.step).toBeLessThan(Math.PI / 2);
    expect(DRUM_MARK.a - DRUM_MARK.half).toBeGreaterThan(0);
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

describe('beat 9: Persistent’s words, in vellum', () => {
  it('lays "Persistent · 持久" from the strut’s dock (its contact) and rolls it up under bar 65’s dolly, whole in the frame and clear of the sheets and the "?"', () => {
    const P = PERSIST_WORDS;
    expect(persistWordsAt(BEAT_9.strut.dock - 1)).toBe(0);
    expect(persistWordsAt(BEAT_9.strut.dock)).toBeGreaterThan(0);
    expect(persistWordsAt(BEAT_9.strut.dock + 7)).toBe(1);
    expect(persistWordsAt(TO_REGISTER.from)).toBe(1);
    expect(persistWordsAt(TO_REGISTER.from + 8)).toBe(0);
    const corners = (k: number): [number, number, number][] => [-1, 1].flatMap((b) => [[P.c[0] - P.w / 2, P.c[1] + (b * P.d) / 2, P.c[2]], [P.c[0] - P.w / 2 + P.w * k, P.c[1] + (b * P.d) / 2, P.c[2]]] as [number, number, number][]);
    const gap = (a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
    const sheet = (x0: number, x1: number, y0: number, y1: number, z = 0.4): [number, number, number][] => [[x0, y0, z], [x1, y0, z], [x0, y1, z], [x1, y1, z]];
    const L = VELLUM.loop;
    const PL = VELLUM.plan;
    const q = QUERIES[0]!;
    for (let f = BEAT_9.strut.dock; f < TO_REGISTER.from + 8; f++) {
      const k = persistWordsAt(f);
      const pose = cameraAt(f, 15);
      const b = projectBox(pose, corners(k));
      // whole in the frame (title-safe's margin) while it shows
      expect(b.x1, `f${f}`).toBeLessThan(1920 - 96);
      expect(b.x0, `f${f}`).toBeGreaterThan(96);
      // never on the plan of the deck; north of the loop's drawing (its sheet's top margin only); clear of the "?" once it is drawn
      expect(gap(b, projectBox(pose, sheet(PL.c[0] - PL.w / 2, PL.c[0] + PL.w / 2, PL.c[1] - PL.d / 2, PL.c[1] + PL.d / 2))), `f${f} plan`).toBeGreaterThanOrEqual(8);
      expect(b.y1 - projectBox(pose, sheet(L.x0, L.x1, L.y0, L.y1)).y0, `f${f} loop`).toBeLessThanOrEqual(20);
      if (f >= BEAT_9.sweeps[1]) expect(gap(b, projectBox(pose, sheet(q.at[0] - q.size / 2, q.at[0] + q.size / 2, q.at[1] - q.size / 2, q.at[1] + q.size / 2, q.at[2]))), `f${f} ?`).toBeGreaterThanOrEqual(8);
    }
  });
});
