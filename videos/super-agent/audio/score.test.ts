// The score's building blocks: its landmarks on the cue sheet, its sync with the picture's
// schedules (every sound on its contact frame), the copies of the picture's layout part two's pans
// read, the mixed film's halves, rests and hits, and its voices. The full render is exercised by
// `aiv audio super-agent --verify` (two fresh processes, identical bytes); its levels are in
// out/super-agent/audio/audio.json and the stage's log (index.ts prints the report).
import { beforeAll, describe, expect, it } from 'vitest';
import { hashString } from '@aiv/core';
import type { ScoreContext } from '@aiv/pipeline/audio';
import { peakOf, smooth, timeline, type Place, type StereoClip } from '@aiv/pipeline/audio/kit';
import { BEAT_5, BEAT_6, BEAT_7, BEAT_8, BEAT_9, BEAT_10, BEAT_11, END, FIX_A, FIX_B, LAMP_VISITS, MT1, WARMTH, at, cues } from '../src/cues.ts';
import { FOLDERS, actOneAt } from '../src/desk/actOne.ts';
import { ACT_ONE_CAMERA, FOLDER_X, actOneFrameAt, flagSnaps, swings, warmthAt } from './actOne.ts';
import { ACT_ONE_MOVE, CAMERA_EASE, CAMERA_MOVES, FRAMING_B as DESK_B, FRAMING_HOOK as DESK_HOOK, cameraAt, moveFraming, project } from '../src/desk/camera.ts';
import { replyLandsB, replyPostedB } from '../src/desk/beat3.ts';
import { EVENTS_B, EVENTS_C } from '../src/desk/state.ts';
import { KICK_FLY, STRIKES } from '../src/desk/beat5.ts';
import { CI_MOUTH, E6 } from '../src/desk/beat6.ts';
import { OLDER_REPLY } from '../src/desk/turn.ts';
import { BAYS, CORDS, FEEDERS, FRESH, INDEX, LAMP, MAST, PRINT_HEAD, REEL, TAPE, THROAT, YOU, rectC } from '../src/desk/layout.ts';
import { DOCKED, FLAG, FRAMING_D as DESK_D, HANDLE, MACHINES, QUERIES, VELLUM, WATCHDOG, clipC } from '../src/desk/summary.ts';
import { OVAL } from '../src/desk/beat7.ts';
import { BAND, BRACKET, CAVEAT, CLAMP, NOTCH, ORIGIN_U, SHEET8, STACKS8, STAMPS8, stripLength, tickU } from '../src/desk/beat8.ts';
import { CARD_SPOT_11, KEY_SCREEN, TAGS_11 } from '../src/desk/beat11.ts';
import { E_END, SPOUT_SLIP, TICKS as BOOKEND_TICKS } from '../src/desk/end.ts';
import { arrange, marks } from './arrangement.ts';
import { BATCH_CHORDS, KEY_STRIKE_LEAD, PLATE_UNHOOK, TAB_LANDS } from './keepUp.ts';
import { REPLY_FLIGHT } from './fixes.ts';
import { OLDER_REPLY_LANDS, TESTS_DONE } from './levels.ts';
import { CAMERA_PLAN, FRAMING_B, FRAMING_D, FRAMING_HOOK, FRAMING_SHEET, SCREEN, SHEET_X, X, framingAt, panAt } from './places.ts';
import { RAIL_DISTANCE, capsuleAway, capsulePan } from './waiting.ts';
import { PULSE, STAMPS, STRIP_NOTES, stampFrame } from './evidence.ts';
import { stuckLoop } from './persistent.ts';
import { END_MOTIFS, LAST_NOTE } from './endCard.ts';
import { BOOKEND_TICK_DB, DETUNE, PART_TWO_PLAN, padLines, type PadLine } from './continuity.ts';
import { BOOKEND_STAMP, THEME, themeNotes } from './signoff.ts';
import { renderMix } from './index.ts';
import { LV, M, loudest400 } from './common.ts';
import { cordRun, detent, gateClack, inkClick, inkSwell, lidClick, paperFold, paperTear, paperThump, paperTick, plateTap, pointerTick, printTap, ratchet, sandTrickle, sketchScratch, softPop, tickRain, unhook, vellumLay, vellumTap, woodKnock, woodblockHop } from './foley.ts';
import { bowedNote, brightPluck, chirp, fallTone, feltPiano, fmMallet, hum, loupeBell, marimba, sineBass, smear, softPulse, stripTone, woodTick } from './instruments.ts';

const SR = 48_000;
const ctx: ScoreContext = {
  sampleRate: SR,
  cues,
  fps: cues.fps,
  filmSamples: Math.round((cues.filmFrames * SR) / cues.fps),
  frameToSample: (f) => Math.round((f * SR) / cues.fps),
  library: () => {
    throw new Error('the score plays no samples');
  },
  seed: 12345,
};
const S = (frame: number) => ctx.frameToSample(frame);
const T = timeline(ctx);

describe('the score on the cue sheet', () => {
  it('reads its landmarks by cue id', () => {
    const m = marks(T);
    expect(m.hub).toBe(S(at(12)));
    expect(m.hush).toEqual([S(at(12, 4)), S(at(13))]);
    expect(m.split).toBe(S(at(13)));
    expect(m.question).toBe(S(at(18)));
    expect(m.breath).toEqual([S(at(18, 3)), S(at(19))]);
    expect(m.turn).toBe(S(at(19)));
    expect(m.stepDown).toBe(S(MT1.stampIn));
    expect(m.rest).toEqual([S(at(29, 2)), S(at(30))]);
    expect(m.intrusion).toEqual([S(at(63)), S(at(63, 3))]);
    expect(m.signoff).toEqual([S(at(69, 3)), S(at(70, 3.5))]);
    expect(m.tail).toEqual([S(END.card.leave), S(cues.filmFrames)]);
    expect(m.two).toBe(S(at(44)));
    expect(m.end).toBe(ctx.filmSamples);
  });
});

describe('act one follows the picture', () => {
  it('swings on LAMP_VISITS, frame for frame, and never after f870', () => {
    const sw = swings(T);
    expect(sw.map((s) => [s.frame, s.folder])).toEqual(LAMP_VISITS.map(([f, n]) => [f, n]));
    expect(sw.every((s) => s.at === S(s.frame))).toBe(true);
    expect(sw[sw.length - 1].frame).toBe(870);
    expect(new Set(sw.map((s) => s.step))).toEqual(new Set([1, 0.5, 0.25]));
  });

  it('pans by the folders the picture lays out (src/desk/actOne.ts FOLDERS)', () => {
    expect(FOLDER_X).toEqual(FOLDERS.map((fl) => fl.c[0]));
  });

  it('pans through act one’s camera as the picture moves it (src/desk/camera.ts ACT_ONE_MOVE on the camera token)', () => {
    const { from, to, a, b } = ACT_ONE_MOVE;
    expect([from, to]).toEqual([ACT_ONE_CAMERA.from, ACT_ONE_CAMERA.to]);
    expect([a.x, a.zoom, b.x, b.zoom]).toEqual([ACT_ONE_CAMERA.hook.x, ACT_ONE_CAMERA.hook.zoom, ACT_ONE_CAMERA.a.x, ACT_ONE_CAMERA.a.zoom]);
    const ease = CAMERA_EASE;
    for (let f = 0; f <= 400; f += 5) {
      const fr = f <= from ? a : f >= to ? b : moveFraming(ACT_ONE_MOVE, ease((f - from) / (to - from)));
      const got = actOneFrameAt(f);
      expect(got.x, `f${f}`).toBeCloseTo(fr.x, 3);
      expect(got.halfW, `f${f}`).toBeCloseTo(960 / fr.zoom, 3);
    }
  });

  it('lands on the picture’s own contact frames where the cue sheet has none (beat3.ts, state.ts EVENTS_B/EVENTS_C, turn.ts, beat6.ts)', () => {
    // each reply is posted on its cue and lands REPLY_FLIGHT later, reply 7 included
    for (let k = 0; k < 8; k++) {
      expect(replyPostedB(k), `reply ${k}`).toBe(k === 7 ? FIX_B.reply7 : FIX_B.replies[k]);
      expect(replyLandsB(k) - replyPostedB(k), `reply ${k}`).toBe(REPLY_FLIGHT);
    }
    // the cache's pointer tab lands TAB_LANDS after the fold, on BEAT_6's fold
    expect(EVENTS_C.fold).toBe(BEAT_6.cacheFold);
    expect(EVENTS_C.tabDrop + EVENTS_C.tabFrames - EVENTS_C.fold).toBe(TAB_LANDS);
    // the tests voice stops as the test lamps go out
    expect(at(TESTS_DONE.bar, TESTS_DONE.beat)).toBe(EVENTS_B.lampsOut);
    // the older reply's paper tick and the stress plate's unhook (session 5)
    expect(OLDER_REPLY_LANDS).toBe(OLDER_REPLY.lands);
    expect(PLATE_UNHOOK).toBe(E6.plateExit);
  });

  it('lights each motif with the picture’s warmth, and sounds a falling tone where a flag snaps up', () => {
    for (let f = 0; f < 880; f += 3) {
      const st = actOneAt(f);
      for (const fl of FOLDERS) expect(warmthAt(fl.n, f)).toBeCloseTo(st.folders[fl.n - 1].warmth, 9);
    }
    // the picture's flags rising from tucked (between f and f + 1), before the hub and not on a folder's landing
    const rising: { f: number; n: number }[] = [];
    let prev = actOneAt(380);
    for (let f = 381; f < 870; f++) {
      const st = actOneAt(f);
      for (const fl of FOLDERS) if (prev.folders[fl.n - 1].flag === 0 && st.folders[fl.n - 1].flag > 0 && prev.folders[fl.n - 1].present) rising.push({ f: f - 1, n: fl.n });
      prev = st;
    }
    const snaps = flagSnaps(870);
    expect(snaps.length).toBeGreaterThan(0);
    expect(snaps.map((s) => ({ f: Math.floor(s.frame), n: s.folder }))).toEqual(rising);
    // and each lands where the warmth crosses the flag's threshold
    for (const s of snaps) expect(warmthAt(s.folder, s.frame)).toBeCloseTo(WARMTH.flagUp, 9);
  });
});

describe('part two pans by the picture’s layout and camera (audio/places.ts)', () => {
  it('copies the layout it reads, each copy equal to its source', () => {
    const mid = (a: number, b: number) => (a + b) / 2;
    expect(X.spool).toBe(CORDS.vermilion[0][0]);
    expect(X.mast).toBe(MAST.x);
    expect(X.terminal).toBe(CORDS.vermilion[CORDS.vermilion.length - 1][0]);
    expect(X.throat).toBe(mid(THROAT.box.x0, THROAT.box.x1));
    expect(X.printHead).toBe(mid(PRINT_HEAD.box.x0, PRINT_HEAD.box.x1));
    expect(X.tape).toBe(mid(TAPE.x0, TAPE.x1));
    expect(X.reel).toBe(REEL.x);
    expect(X.index).toBe(INDEX.pivot[0]);
    expect(X.bugBay).toBe(rectC(BAYS.bug.box)[0]);
    expect(X.bugDoor).toBe(mid(...BAYS.bug.door));
    expect(X.glassDocked).toBe(DOCKED.glass[0]);
    expect(X.inTray).toBe(rectC(YOU.inTray)[0]);
    expect(X.laptop).toBe(rectC(YOU.laptop)[0]);
    expect(X.lampHead).toBe(LAMP.head[0]);
    expect(X.chatFeeder).toBe(rectC(FEEDERS.chat)[0]);
    expect(X.repoPort).toBe(CI_MOUTH.to[0]);
    expect(X.stuckBay).toBe(rectC(FRESH.box)[0]);
    expect(X.flag).toBe(FLAG[0]);
    expect(X.machines).toEqual(MACHINES.map((mc) => mc.c[0]));
    expect(X.plan).toBe(VELLUM.plan.c[0]);
    expect(X.cabinet).toBe(VELLUM.cabinet.c[0]);
    expect(X.loop).toBe(mid(VELLUM.loop.x0, VELLUM.loop.x1));
    expect(X.tethers).toBeCloseTo(mid(VELLUM.loop.x1, MACHINES.reduce((s, mc) => s + clipC(mc)[0], 0) / MACHINES.length), 6);
    expect(X.watchdog).toBe(WATCHDOG.c[0]);
    expect(X.query).toBe(QUERIES[0].at[0]);
    expect(X.handle).toBe(HANDLE.c[0]);
    // session 5 wave 4, from the built picture
    expect(X.sideRail).toBe(mid(OVAL.c0[0], OVAL.c1[0]));
    expect(X.spoutSlip).toBe(SPOUT_SLIP[0]);
    const sx = (u: number) => SHEET8.x0 + u;
    expect(SHEET_X.row[0]).toBeCloseTo(sx(tickU(0)), 6);
    expect(SHEET_X.row[1]).toBeCloseTo(sx(tickU(BEAT_8.ticks.n - 1)), 6);
    expect(SHEET_X.caveat).toBe(sx(mid(CAVEAT.u0, CAVEAT.u1)));
    BEAT_8.lanes.forEach((_, i) => expect(SHEET_X.strips[i], `strip ${i}`).toBeCloseTo(sx(ORIGIN_U + stripLength(i) / 2), 1));
    [STAMPS8.half, STAMPS8.ten, STAMPS8.tokens].forEach((st, i) => {
      expect(st.cue).toBe(STAMPS[i]);
      expect(SHEET_X.stamps[i], st.cue).toBeCloseTo(sx(st.u + (st.em * st.adv) / 2), 1);
    });
    expect(SHEET_X.bracket).toBeCloseTo(sx(mid(BRACKET.a[0], BRACKET.b[0])), 6);
    expect(SHEET_X.notches).toEqual(NOTCH.s.map((n) => sx(ORIGIN_U + n)));
    expect(SHEET_X.longRun).toBeCloseTo(sx(mid(BAND.u0, BAND.u1)), 6);
    STACKS8.forEach((st, i) => expect(SHEET_X.stacks[i], `stack ${i}`).toBeCloseTo(sx(CLAMP.u1 + st.extent / 2), 1));
  });

  it('pans what the picture places on the screen where it stands: the idea labels’ feet, the act-one card, the key (beat11.ts)', () => {
    // each label's click where its leader's foot lands on its part, projected at its beat
    TAGS_11.forEach((tag, i) => expect(Math.abs(project(cameraAt(BEAT_11.ideas[i], 15), tag.foot)[0] - SCREEN.ideas[i]), tag.id).toBeLessThan(2));
    // the act-one card at rest (its whole beat), west of the Register
    const rest = BEAT_11.actOneCard.rise + 20;
    expect(Math.abs(project(cameraAt(rest, 15), CARD_SPOT_11.at)[0] - SCREEN.actOneCard)).toBeLessThan(2);
    // the key's block: from its samples' plate to its zh column (measured on the built frame f5730: x 1202-1823)
    expect(SCREEN.keyMap).toBeGreaterThan(KEY_SCREEN.x);
    expect(SCREEN.keyMap).toBeLessThan(KEY_SCREEN.zh);
  });

  it('moves the camera as the picture does: its framings, and every move from bar 44 on (src/desk/camera.ts)', () => {
    const same = (a: { x: number; zoom: number }, b: { x: number; zoom: number }) => [a.x, a.zoom, b.x, b.zoom];
    expect(same(FRAMING_B, FRAMING_HOOK)).toEqual(same(DESK_B, DESK_HOOK));
    expect([FRAMING_D.x, FRAMING_D.zoom]).toEqual([DESK_D.x, DESK_D.zoom]);
    const moves = CAMERA_MOVES.filter((mv) => mv.from >= at(44));
    expect(moves.map((mv) => [mv.from, mv.to, ...same(mv.a, mv.b)]), 'part two’s camera changed: re-derive the pans (audio/places.ts)').toEqual(CAMERA_PLAN.map((mv) => [mv.from, mv.to, ...same(mv.a, mv.b)]));
    expect(CAMERA_PLAN[0].b).toEqual(FRAMING_SHEET);
    for (const mv of moves)
      for (let f = mv.from; f <= mv.to; f += 4) {
        const fr = moveFraming(mv, CAMERA_EASE((f - mv.from) / (mv.to - mv.from)));
        expect(framingAt(f).x, `f${f}`).toBeCloseTo(fr.x, 3);
        expect(framingAt(f).zoom, `f${f}`).toBeCloseTo(fr.zoom, 6);
      }
  });

  it('pans the part-one sounds added in session 5 where the picture puts them', () => {
    // the older reply lands in your in-tray at FRAMING_B (levels.ts IN_TRAY_PAN -0.25)
    expect(panAt(X.inTray, OLDER_REPLY_LANDS)).toBeCloseTo(-0.25, 1);
  });
});

/** A placement as the recorder saw it. */
interface Placed {
  at: number;
  part: string;
  bus: string;
  len: number;
  db: number;
  pan: number;
  until?: number;
  sum: number;
}
/** A pad line's bow envelope at sample s (instruments.ts bowedNote: a raised-cosine attack, held, a raised-cosine release after `to`), 0-1. */
function padEnv(ln: PadLine, s: number): number {
  const t = (s - ln.from) / SR;
  const len = (ln.to - ln.from) / SR + ln.release;
  if (t < 0 || t >= len) return 0;
  return smooth(t / ln.attack) * (t > len - ln.release ? smooth((len - t) / ln.release) : 1);
}
function record(): Placed[] {
  const calls: Placed[] = [];
  arrange(T, {
    add(at: number, clip: Float32Array | StereoClip, p: Place) {
      const l = clip instanceof Float32Array ? clip : clip.l;
      let sum = 0;
      for (let i = 0; i < l.length; i += 97) sum += l[i] * ((i % 7) + 1);
      calls.push({ at, part: p.part, bus: p.bus, len: l.length, db: p.db ?? 0, pan: p.pan ?? 0, ...(p.until !== undefined ? { until: p.until } : {}), sum });
    },
  });
  return calls;
}

describe('every sound on its contact frame', () => {
  const placed = record();
  const partsAt = (s: number) => placed.filter((p) => p.at === s).map((p) => p.part);
  const has = (part: string, s: number) => placed.some((p) => p.part === part && p.at === s);
  const of = (part: string, a = 0, b = Infinity) => placed.filter((p) => p.part === part && p.at >= a && p.at < b);
  const ROUTER = ['pad', 'bass', 'ticks'];

  it('places a sound on every hit in bars 1-43, and on the marks with a picture event', () => {
    const hits = cues.events.filter((e) => e.kind === 'hit' && e.frame < at(44));
    expect(hits.length).toBeGreaterThan(15);
    for (const e of hits) expect(partsAt(S(e.frame)), e.id).not.toEqual([]);
    const marked = ['fix-a', 'fix-b', 'fix-b-break', 'trait-continuous', 'thread-row', 'gauge', 'ghost-router', 'arm-tests', 'arm-docs', 'report-up', 'stamp-in', 'reply-lands', 'dispatch-fresh', 'key-dock', 'plate-proactive', 'spike-in', 'cache-eject', 'review-card', 'review-in', 'hop-1', 'hop-2', 'hop-3', 'recall-answer'];
    for (const id of marked) expect(partsAt(T.cue(id)), id).not.toEqual([]);
  });

  it('places a sound on every hit in bars 44-84 and on part two’s marks with a picture event; the silent ones stay silent', () => {
    const hits = cues.events.filter((e) => e.kind === 'hit' && e.frame >= at(44));
    expect(hits.length).toBe(16);
    for (const e of hits) expect(partsAt(S(e.frame)).filter((p) => !ROUTER.includes(p)), e.id).not.toEqual([]);
    // (the stacks sound as each is done, BEAT_8.stacks[].done: the beat-8 test below)
    const sounded = ['cord-out', 'clip-on', 'tally', 'door-ghost-strike', 'job-receipt', 'glass-dock', 'plate-productive', 'sheet-ticks', 'strips', 'bracket', 'notches', 'lid', 'vellum', 'trait-persistent', 'machine-lamp', 'slip-drop', 'watchdog', 'flag', 'query-open', 'tear', 'fix-cards', 'windings', 'reach', 'handle', 'report-68', 'act-one-card', ...BEAT_11.ideas.map((_, i) => `idea-${i + 1}`), 'lamp-turn-1'];
    for (const id of sounded) expect(partsAt(T.cue(id)).filter((p) => !ROUTER.includes(p)), id).not.toEqual([]);
    // the hatched slip glides in silence, the plates retire inside the rest, the split is the pad's (no onset), the rest is the picture's alone
    // (the second rider arrives on the peel's frame, whose capsule is the sound there)
    const silent = ['hatch', 'tally-ghost', 'rider-arrives', 'door-ghost', 'strut-lift', 'split', 'pins-68', 'plates-retire', 'step-down', 'lamp-turn-2', 'card-leaves'];
    for (const id of silent) expect(partsAt(T.cue(id)).filter((p) => !ROUTER.includes(p)), id).toEqual([]);
    // the picture's events with no cue of their own stay silent too: the Proactive plate's swap out, N8's focus steps, Persistent's words
    // rolled up, the Fix cards' exit and the step back, the role labels' return, the key plate's exit, the heap pressed into the slate
    const quiet: [number, number][] = [[3921, 3928], [4781, 4794], [5121, 5127], [5232, 5247], [5272, 5272], [5989, 5998], [6016, 6056]];
    for (const [a, b] of quiet) expect(placed.filter((p) => p.at >= S(a) && p.at <= S(b) && !ROUTER.includes(p.part)).map((p) => `${p.part} f${p.at / S(1)}`), `f${a}-${b}`).toEqual([]);
    // the dissolve's first frame: the print head stamps the bookend slip in (end.ts E_END.stamp), the last mechanical sound
    expect(partsAt(T.cue('dissolve')).filter((p) => !ROUTER.includes(p))).toEqual(['print']);
  });

  it('taps a woodblock on every swing of your lamp but the one that began before the film', () => {
    expect(placed.filter((p) => p.part === 'hop').map((p) => p.at)).toEqual(LAMP_VISITS.slice(1).map(([f]) => S(f)));
  });

  it('follows the schedules: Fix A’s steps, Fix B’s replies, the gate’s slips, the batches, the cache', () => {
    const m = marks(T);
    for (const f of FIX_A.steps) expect(has('plod', S(f)), `plod f${f}`).toBe(S(f) < m.question);
    [...FIX_B.replies, FIX_B.reply7].forEach((f) => {
      expect(has('stubs', S(f)), `stub f${f}`).toBe(true);
      expect(has('replies', S(f + REPLY_FLIGHT)), `reply f${f + REPLY_FLIGHT}`).toBe(true);
    });
    for (const f of BEAT_5.trips) expect(has('trip', S(f)), `trip f${f}`).toBe(true);
    // every strike on the docked key sounds, and only those: the trips and each kept ask's strike (the picture's own frames)
    expect(KEY_STRIKE_LEAD).toBe(KICK_FLY);
    const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
    expect(sorted(placed.filter((p) => p.part === 'trip').map((p) => p.at))).toEqual(sorted(STRIKES.map(S)));
    for (const { f, keep } of BEAT_5.slips) {
      expect(has('clack', S(f + BEAT_5.impale)), `clack f${f}`).toBe(!keep);
      expect(has('bell', S(f + BEAT_5.notchAfter)), `bell f${f}`).toBe(keep);
    }
    BEAT_6.batches.forEach(({ sweep, slips }, b) => {
      for (const s of slips) expect(has('held-tick', S(s)), `held tick f${s}`).toBe(true);
      // the chord is thicker for the longer strip: more notes, and mallets on its top
      const chord = placed.filter((p) => p.part === 'batch' && p.at >= S(sweep) && p.at < S(sweep) + T.s(0.03));
      expect(chord.length).toBe(BATCH_CHORDS[b].length * 2 + (b === 1 ? 3 : 0));
      expect(Math.min(...chord.map((p) => p.at))).toBe(S(sweep));
      expect(placed.filter((p) => p.part === 'held-tone' && p.at >= S(slips[0]) && p.at < S(sweep)).length).toBe(slips.length);
    });
    expect(has('pointer', S(BEAT_6.cacheFold + TAB_LANDS))).toBe(true);
    expect(placed.filter((p) => p.part === 'hop-note').map((p) => p.at)).toEqual(BEAT_6.recall.hops.map(S));
    // session 5: the older reply's paper tick, the stress plate's dry unhook; beat 6's asks stay silent
    expect(of('paper-tick').map((p) => p.at)).toEqual([S(OLDER_REPLY_LANDS)]);
    expect(of('unhook').map((p) => p.at)).toEqual([S(PLATE_UNHOOK)]);
  });

  it('beat 7: the cord and its flyover, the tally, the capsule out and back, the two replies (BEAT_7)', () => {
    const B = BEAT_7;
    expect(of('cord-run').map((p) => [p.at, p.len])).toEqual([[S(B.cordOut), Math.ceil(((B.cordTaut - B.cordOut) / 30) * SR)]]);
    expect(of('cord-pluck').map((p) => p.at)).toEqual(B.riders.map((r) => S(r.clipOn)));
    // the flyover: the motif an octave up over the bar line, A5 a sixteenth before the guide, D6 on it; the Router's pulse skipped there
    const guide = S(B.riders[0].guide);
    expect(of('motif', guide - T.beats(0.25), guide + 1).map((p) => p.at)).toEqual([guide - T.beats(0.25), guide]);
    expect(has('bass', guide)).toBe(false);
    expect(has('bass', T.beat(45, 3))).toBe(true);
    // the notice row prints in silence: the D6 alone on the guide
    expect(partsAt(guide)).toEqual(['motif']);
    expect(has('tally', S(B.tally.print))).toBe(true);
    expect(of('strike', S(B.tally.ghostStrike), S(B.tally.ghostStrike) + 1).length).toBe(2);
    expect(has('strike', S(B.doorGhost.strike))).toBe(true);
    // the capsule: struck and held from the peel, out to the side rail over its arc, held there, back over the dock's 8 f
    expect(of('capsule').map((p) => p.at)).toEqual([S(B.peel.lift), S(B.peel.lift)]);
    expect(capsulePan(B.peel.lift)).toBeCloseTo(capsulePan(B.peel.dock), 9);
    // the side rail lies under the bay on screen (beat7.ts OVAL): the tone recedes rather than travels
    expect(Math.abs(capsulePan(B.peel.rail) - capsulePan(B.peel.lift))).toBeLessThan(0.05);
    expect(capsulePan((B.peel.rail + B.peel.dockFrom) / 2)).toBeCloseTo(capsulePan(B.peel.rail), 9);
    // on the rail it is further off, not just further right: out and back as smoothly as it moves (no step of more than a seventh a frame)
    expect(RAIL_DISTANCE.db).toBeLessThanOrEqual(-4);
    expect([B.peel.lift, B.peel.rail, B.peel.dockFrom, B.peel.dock].map(capsuleAway)).toEqual([0, 1, 1, 0]);
    for (let f = B.peel.lift; f < B.peel.dock; f += 0.5) expect(Math.abs(capsuleAway(f + 1) - capsuleAway(f)), `f${f}`).toBeLessThanOrEqual(1 / 7 + 1e-9);
    expect(has('receipt', S(B.peel.receipt))).toBe(true);
    expect(has('trickle', S(B.glass.dock))).toBe(true);
    expect(has('plate', S(B.glass.plateDock))).toBe(true);
    // the capsule docks back as a chord, strummed in under 10 ms
    const chord = of('dock-chord');
    expect(chord.length).toBe(3);
    expect(chord[0].at).toBe(S(B.peel.dock));
    expect(chord[2].at - chord[0].at).toBeLessThan(T.s(0.01));
    // 7.4: the index turns west off the beat with its own detent, and the Router's tick keeps its beat after it; the chat reply, one
    // felt-piano note; the dossier, its slap and thump, the pulse aside
    expect(of('arm-tick', S(at(44)), S(at(50))).map((p) => p.at)).toEqual([S(B.reply.indexWest)]);
    expect(has('ticks', S(B.reply.indexWest))).toBe(false);
    expect(B.reply.indexWest).toBeGreaterThan(at(48, 3));
    expect(B.reply.indexWest).toBeLessThan(at(48, 4));
    expect(has('ticks', T.beat(48, 4))).toBe(true);
    expect(has('ticks', S(B.glass.dock))).toBe(false);
    expect(of('reply', S(B.reply.lands), S(B.reply.lands) + 1).length).toBe(1);
    expect(of('dossier').map((p) => p.at)).toEqual([S(B.dossier.lands), S(B.dossier.lands)]);
    expect(has('bass', S(B.dossier.lands))).toBe(false);
  });

  it('beat 8: no pad, the thinned pulse, the rain, strips exactly as long as their slides, the bracket, notches, stacks (BEAT_8)', () => {
    const B = BEAT_8;
    const [b50, b58] = [T.beat(50), T.beat(58)];
    // no pad starts in bars 50-57, and every line before them has released by a second into bar 50
    expect(of('pad', b50, b58)).toEqual([]);
    for (const p of of('pad', 0, b50)) expect(p.at + p.len, `pad at f${p.at / 1600}`).toBeLessThanOrEqual(b50 + T.s(0.8) + 1);
    // the mallet stands aside for bar 51 (the strips sound alone), the unpunched notch (a gap, with the bass) and the last stack
    const gap = S(B.notches.find((n) => !n.punched)!.f);
    expect(gap).toBe(T.beat(55));
    const aside = [T.beat(51), gap, S(B.stacks[2].done)];
    for (let bar = 50; bar <= 57; bar++)
      for (const b of [1, 3]) {
        expect(has('bass', T.beat(bar, b)), `bass ${bar}.${b}`).toBe(T.beat(bar, b) !== gap);
        expect(has('pulse-mallet', T.beat(bar, b)), `mallet ${bar}.${b}`).toBe(!aside.includes(T.beat(bar, b)));
      }
    expect(partsAt(gap)).toEqual([]);
    // no pad above it, so each bass stroke holds to the next (two beats, ending on it; the one before the notch's gap ends on the gap),
    // where elsewhere a stroke is a second long
    for (const p of of('bass', b50, b58)) expect(p.len, `bass f${p.at / 1600}`).toBe(T.beats(2));
    for (const p of [...of('bass', T.beat(44), b50), ...of('bass', b58)]) expect(p.len, `bass f${p.at / 1600}`).toBe(SR);
    expect(of('bass', b50, b58).at(-1)!.at + T.beats(2)).toBe(S(B.away));
    // the pulse's last stroke lands bar 58's B minor as the sheet slides away (the bass out on it)
    expect(of('pulse-mallet', S(B.away), S(B.away) + 1).length).toBe(2);
    expect(of('rain').map((p) => p.at)).toEqual([S(B.ticks.from)]);
    expect(of('rain')[0].len / SR).toBeCloseTo((B.ticks.to - B.ticks.from) / 30, 1);
    // the strips: each as long as its slide (stripFrames x p95), so the halving is heard
    const strips = of('strip');
    B.lanes.forEach((lane, i) => {
      expect(strips[i].at).toBe(S(lane.slide));
      expect(strips[i].len).toBe(S(lane.slide + lane.p95 * B.stripFrames) - S(lane.slide));
    });
    expect(strips[2].len / strips[0].len).toBeCloseTo(B.lanes[2].p95 / B.lanes[0].p95, 3);
    expect(strips[3].at).toBe(S(B.longRun.from));
    expect(strips[3].len).toBe(S(B.longRun.from + B.longRun.frames) - S(B.longRun.from));
    expect(of('stamp-8').map((p) => p.at)).toEqual([S(B.caveat), ...STAMPS.map((id) => S(stampFrame(id)))]);
    expect(of('bracket').map((p) => p.at)).toEqual([S(B.bracket), S(B.bracket)]);
    expect(of('notch').map((p) => p.at)).toEqual(B.notches.filter((n) => n.punched).map((n) => S(n.f)));
    expect(has('ticks', S(B.notches[1].f))).toBe(false);
    expect(has('ticks', S(B.longRun.from))).toBe(false);
    const stacks = of('stack');
    expect(stacks.map((p) => p.at)).toEqual([...B.stacks.map((s) => S(s.done)), S(B.stacks[2].done)]);
    // the stack done on a beat of the Router's ticks stands in for it
    for (const st of B.stacks) expect(has('ticks', S(st.done)), `tick f${st.done}`).toBe(false);
    // bar 51: the pulse comes back on beat 3 once every strip has stopped, on a pitch none of them held
    for (const st of strips.slice(0, 3)) expect(st.at + st.len).toBeLessThanOrEqual(T.beat(51, 3));
    expect(PULSE[1][1]).toEqual([M.A3]);
    expect(STRIP_NOTES).not.toContain(M.A3);
    expect(of('pulse-mallet', T.beat(51, 3), T.beat(51, 3) + 1).map((p) => p.db)).toEqual([LV.pulseMallet]);
    // bar 55: its downbeat is the notch's gap, so beat 3 states the G chord whole with the bass's return
    expect(PULSE[5][1]).toEqual([M.G3, M.B3]);
    expect(of('pulse-mallet', T.beat(55, 3), T.beat(55, 3) + 1).length).toBe(2);
    expect(has('bass', T.beat(55, 3))).toBe(true);
  });

  it('beat 9: the lid, the vellum laid, the strut handed over, the Watchdog’s sweeps over the stuck loop, the bass out (BEAT_9)', () => {
    const B = BEAT_9;
    expect(of('lid').map((p) => p.at)).toEqual([S(B.lidClick)]);
    expect(of('vellum').map((p) => p.at)).toEqual([...B.lays, B.watchdog].map(S));
    expect(has('strut-hum', S(B.strut.dock))).toBe(true);
    expect(has('vellum-tap', S(B.strut.plateDock))).toBe(true);
    expect(has('lamp-on', S(B.machineLamp))).toBe(true);
    expect(has('slip-drop', S(B.slipDrop))).toBe(true);
    expect(of('sweep').map((p) => p.at)).toEqual(B.sweeps.flatMap((f) => [S(f), S(f)]));
    expect(of('stuck').map((p) => p.at)).toEqual(stuckLoop().map(([f]) => S(f)));
    expect(stuckLoop().length).toBe(16);
    expect(has('pencil', S(B.flag))).toBe(true);
    // the first lay is on bar 58's beat 2: a breath with no onset of its own, so the Router's tick sounds with it (the bar's beat 4 is the strut's hum)
    expect(B.lays[0]).toBe(at(58, 2));
    expect(has('ticks', S(B.lays[0]))).toBe(true);
    expect(has('ticks', S(B.strut.dock))).toBe(false);
    expect(of('bass', T.beat(58), T.beat(71))).toEqual([]);
    expect(of('pad', T.beat(58), T.beat(58) + 1).length).toBe(4);
  });

  it('beat 10: the minor second, one etch note per machine after it, the pencil marks, the split into two, bar 68’s handshake (BEAT_10)', () => {
    const B = BEAT_10;
    const intr = S(B.hatch.register);
    expect(of('intrusion').map((p) => p.at)).toEqual([intr, intr + T.s(0.012)]);
    // the first machine's note comes on its own beat, after the D-E♭
    expect(of('etch').map((p) => p.at)).toEqual(B.etch.map(S));
    expect(S(B.etch[0])).toBeGreaterThan(intr);
    expect(of('pencil', S(B.etch[0])).map((p) => p.at)).toEqual([B.query, B.windings, B.handle].map(S));
    expect(has('tear', S(B.tear))).toBe(true);
    expect(of('fix-echo').map((p) => [p.at, p.pan])).toEqual([
      [S(B.cards.rise), -0.9],
      [S(B.cards.rise), 0.9],
    ]);
    // the split: every pad line held through it (not just releasing) is two halves, placed as stereo clips (centred: they pan themselves)
    const split = S(B.split);
    const through = of('pad').filter((p) => p.at < split && p.at + p.len > split + T.s(0.8));
    expect(through.length).toBe(8);
    expect(through.every((p) => p.pan === 0)).toBe(true);
    const halves = new Map<string, number>();
    for (const p of through) halves.set(`${p.at}:${p.len}`, (halves.get(`${p.at}:${p.len}`) ?? 0) + 1);
    expect([...halves.values()].every((n) => n % 2 === 0)).toBe(true);
    expect(DETUNE.cents).toBeGreaterThan(0);
    // the split is the pad's, with no onset of its own: the Router's tick sounds on its beat
    expect(has('ticks', split)).toBe(true);
    // the windings, drawn once the cards have gone (bar 66 beat 4): a soft scratch with no onset, so the Router's tick sounds with it
    expect(B.windings).toBeGreaterThan(B.cards.exit);
    expect(B.windings).toBe(at(66, 4));
    expect(has('ticks', S(B.windings))).toBe(true);
    expect(has('reach', S(B.reach))).toBe(true);
    expect(has('ink-click', S(B.reportUp))).toBe(true);
    expect(has('print', S(B.stampIn))).toBe(true);
    // reporting back falls D5 to A4
    expect(of('report').map((p) => p.at)).toEqual([S(B.stampIn), S(B.stampIn) + T.beats(0.5)]);
    expect(has('pop', S(B.replyLands))).toBe(true);
    // then everything holds until the stamp: nothing new starts in the 20 f before it
    expect(placed.filter((p) => p.at > S(B.replyLands) && p.at < S(BEAT_11.stamp))).toEqual([]);
  });

  it('beats 11-13: the stamp and the drag, the labels on their beats, the theme, the half-speed motif, the bookend alone, the end card’s mallet (BEAT_11, END)', () => {
    const B = BEAT_11;
    const m = marks(T);
    const stamp = S(B.stamp);
    expect(has('stamp', stamp)).toBe(true);
    const done = of('motif', stamp, stamp + T.beats(2));
    expect(done.map((p) => p.at)).toEqual([0, 0.5, 1].map((b) => stamp + T.beats(b)));
    expect(done.every((p) => p.until === m.signoff[0])).toBe(true);
    // the drag follows the trace out and home: it starts on the stamp (outside the rest) and ends where the trace does
    expect(of('drag').map((p) => [p.at, p.len])).toEqual([[S(B.trace.out[0]), Math.ceil(((B.trace.home[1] - B.trace.out[0]) / 30) * SR)]]);
    expect(of('label').map((p) => p.at)).toEqual(B.ideas.map(S));
    for (const f of B.ideas) expect(has('ticks', S(f)), `tick f${f}`).toBe(false);
    expect(has('key', S(B.keyMap))).toBe(true);
    const theme = of('theme');
    expect(theme.length).toBe(7);
    expect(theme[0].at).toBe(S(B.actOneCard.rise));
    expect(Math.max(...theme.map((p) => p.at))).toBeLessThan(S(B.actOneCard.rise) + T.beats(2));
    // the theme sounds over no pad note in unison with one of its own (they phase), nor a semitone from one in any octave, nor a whole
    // tone from one in the same octave (bar 73: A2 and F3), each note levelled to the first on its loudest 400 ms
    const under = PART_TWO_PLAN.chords.filter((c) => T.beat(c.bar, c.beat ?? 1) < S(B.actOneCard.rise) + T.beats(2));
    const sounding = under[under.length - 1].notes;
    expect(T.beat(under[under.length - 1].bar, under[under.length - 1].beat ?? 1)).toBe(S(B.actOneCard.rise));
    for (const t of THEME.flatMap((v) => v.notes))
      for (const p of sounding) {
        expect(t, `theme ${t} in unison with the pad`).not.toBe(p);
        expect((t - p + 120) % 12 === 1 || (p - t + 120) % 12 === 1, `theme ${t} a semitone from pad ${p}`).toBe(false);
        expect(Math.abs(t - p), `theme ${t} a whole tone from pad ${p}`).not.toBe(2);
      }
    // nor over a line still in its bow's attack or release, within 20 dB of its held level, over each theme note's first 400 ms (the bar-71
    // chord's D3 and D4 leave a beat early, the G and B in 0.6 s: a released D3 under the theme's D3 phases, a B3 under its C5 is a minor ninth)
    const lines = padLines(T, m).flat();
    const card = S(B.actOneCard.rise);
    const onsets = THEME.flatMap((v) => v.notes.map((midi, j) => ({ midi, at: card + T.beats((j * 4) / v.perBar) })));
    const order = (xs: number[]) => [...xs].sort((a, b) => a - b);
    expect(order(onsets.map((o) => o.at))).toEqual(order(theme.map((p) => p.at)));
    for (const o of onsets)
      for (const ln of lines) {
        const loud = Array.from({ length: 9 }, (_, q) => padEnv(ln, o.at + q * T.s(0.05))).some((g) => g > 0.1);
        if (!loud) continue;
        const [t, p] = [o.midi, ln.midi];
        const name = `theme ${t} at f${o.at / 1600} over pad ${p} (f${ln.from / 1600}-${ln.to / 1600})`;
        expect(t === p || (t - p + 120) % 12 === 1 || (p - t + 120) % 12 === 1 || Math.abs(t - p) === 2, name).toBe(false);
      }
    // into and out of the card's colour (bars 72-74) no line releasing and line swelling a semitone apart (in any octave: F♮3 and F♯4)
    // sound together within 20 dB of their held levels
    const [c0, c1] = [T.beat(72), T.beat(75)];
    const near = lines.filter((ln) => ln.from < c1 && ln.to + T.s(ln.release) > c0);
    for (const x of near)
      for (const y of near) {
        if (!((x.midi - y.midi + 120) % 12 === 1)) continue;
        const both = Array.from({ length: (c1 - c0) / S(1) }, (_, q) => c0 + q * S(1)).filter((s0) => padEnv(x, s0) > 0.1 && padEnv(y, s0) > 0.1);
        expect(both.map((s0) => s0 / 1600), `pad ${x.midi} with ${y.midi}`).toEqual([]);
      }
    const levels = themeNotes(12345).map((n) => 10 * Math.log10(loudest400(n.clip)) + n.db);
    for (const l of levels) expect(l).toBeCloseTo(levels[0], 6);
    expect(Math.max(...themeNotes(12345).map((n) => n.db))).toBeLessThan(9);
    // the collar seats on bar 73 beat 4 with a detent: it stands in for the Router's tick (no two clicks on one frame)
    expect(has('collar', S(B.collar.to))).toBe(true);
    expect(B.collar.to).toBe(at(73, 4));
    expect(has('ticks', S(B.collar.to))).toBe(false);
    expect(of('motif', S(B.lampTurns[0]), S(B.lampTurns[0]) + T.beats(2)).map((p) => p.at)).toEqual([S(B.lampTurns[0]), S(B.lampTurns[0]) + T.beats(1)]);
    // the bookend: the motif once where the slip lies, with no felt-piano answer; then only the print head stamping it in (end.ts E_END.stamp, the dissolve's first frame)
    const turn = S(END.bookend.turn);
    expect(of('motif', turn, turn + T.beats(4)).map((p) => p.at)).toEqual([turn, turn + T.beats(0.5)]);
    expect(of('motif', turn, turn + 1)[0].pan).toBeCloseTo(panAt(X.spoutSlip, END.bookend.turn), 9);
    expect(END.bookend.out + BOOKEND_STAMP.after).toBe(E_END.stamp);
    expect(E_END.stamp).toBe(END.dissolve[0]);
    expect(BOOKEND_STAMP.db).toBeLessThan(0);
    expect(placed.filter((p) => p.at >= turn && p.at < turn + T.beats(4) && !['motif', 'pad', 'ticks'].includes(p.part)).map((p) => [p.part, p.at, p.db])).toEqual([['print', S(E_END.stamp), LV.print + BOOKEND_STAMP.db]]);
    // the frame-0 rhythm: one tick a beat with the feeders' from bar 76 (end.ts TICKS), softer and softer, none after the picture's last;
    // the turn's beat has the motif, not a tick
    const ticks = of('ticks', T.beat(76));
    expect(ticks.map((p) => p.at)).toEqual(BOOKEND_TICKS.filter((f) => f !== END.bookend.turn).map(S));
    expect(BOOKEND_TICK_DB.length).toBe(BOOKEND_TICKS.length);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].db).toBeLessThanOrEqual(ticks[i - 1].db);
    expect(ticks[ticks.length - 1].at).toBeLessThan(S(E_END.stamp));
    // the end card: the solo mallet from its landing, never more than 3.5 beats between notes, the last decaying before the tail
    const land = S(END.card.land);
    const solo = of('motif', land).map((p) => p.at);
    expect(solo[0]).toBe(land);
    expect(solo.length).toBe(END_MOTIFS.length * 2 + 1);
    for (let i = 1; i < solo.length; i++) expect(solo[i] - solo[i - 1]).toBeLessThanOrEqual(T.beats(3.5));
    expect(solo[solo.length - 1]).toBe(land + T.beats(LAST_NOTE));
    expect(placed.filter((p) => p.at >= land && p.part !== 'motif')).toEqual([]);
  });

  it('keeps the rests and silences: nothing starts in a silence, and only their own quiet sounds in a rest', () => {
    for (const [a, b] of T.silences) expect(placed.filter((p) => p.at >= a && p.at < b)).toEqual([]);
    const inSpan = (id: string) => {
      const [a, b] = T.span(id);
      return [...new Set(placed.filter((p) => p.at >= a && p.at < b).map((p) => p.part))].sort();
    };
    expect(inSpan('rest-breath')).toEqual([]);
    expect(inSpan('rest-model')).toEqual(['rest-pluck']);
    expect(inSpan('rest-signoff')).toEqual(['pad']);
    expect(inSpan('rest-tail')).toEqual([]);
    // the fresh bay rises inside the rest: its pluck, no knock
    expect(partsAt(S(MT1.dispatchFresh))).toEqual(['rest-pluck']);
  });

  it('keeps part two’s sounds off the Workers’ bus, which is behind its wall from MT1 on', () => {
    expect(placed.filter((p) => p.bus === 'workers' && p.at >= S(at(44)))).toEqual([]);
  });

  it('lets the tests voice stop as its lamps go out, and gives the Router’s tick on 2 and 4 from bar 21', () => {
    const testsDone = T.beat(TESTS_DONE.bar, TESTS_DONE.beat);
    const workers = placed.filter((p) => p.part === 'workers');
    expect(workers.length).toBeGreaterThan(20);
    expect(workers.every((p) => p.at < marks(T).rest[0] - T.beats(1) + 1)).toBe(true);
    const ticks = placed.filter((p) => p.part === 'ticks').map((p) => p.at);
    expect(ticks[0]).toBe(T.beat(21, 2));
    expect(ticks).toContain(S(BEAT_6.recall.stampIn) - T.beats(2));
    expect(ticks).not.toContain(S(BEAT_6.recall.stampIn));
    expect(testsDone).toBe(S(2140));
  });

  it('is the same placement, clip for clip, every time', () => {
    expect(record()).toEqual(placed);
  }, 180_000);
});

describe('the mastered film (index.ts renderMix), as the stage renders it', () => {
  // the stage's own seed (render.ts scoreContext: FNV-1a of the slug), so this is the mix that ships, read off its report as aiv audio prints it
  const stage: ScoreContext = { ...ctx, seed: hashString('super-agent') };
  let lines: string[] = [];
  let film: { l: Float32Array; r: Float32Array } = { l: new Float32Array(0), r: new Float32Array(0) };
  beforeAll(() => {
    const out = renderMix(stage);
    lines = out.lines;
    film = { l: out.l, r: out.r };
  }, 400_000);

  it('balances its halves: bars 44-84 alone near -14.3 LUFS, so bars 1-43 stay where they were approved', () => {
    const m = lines.find((l) => l.startsWith('loudness:'))!.match(/bars 1-43 alone (-?[\d.]+) LUFS.*bars 44-84 alone (-?[\d.]+) LUFS/)!;
    const [one, two] = [Number(m[1]), Number(m[2])];
    expect(two).toBeGreaterThan(-14.8);
    expect(two).toBeLessThan(-13.8);
    // the approved master had bars 1-43 alone at -13.79 LUFS (2026-11-12)
    expect(Math.abs(one - -13.79)).toBeLessThan(0.3);
  });

  it('keeps every rest 20 dB under the mix and every silence silent, as QA measures them', () => {
    const rests = lines.filter((l) => l.startsWith('qa: rest') || l.startsWith('qa: silence'));
    expect(rests.length).toBe(6);
    for (const l of rests) expect(l, l).toMatch(/ ok$/);
  });

  it('leaves no hole from bar 44 on: no beat (a window of one, every 5 f) sits more than 12 dB under the beats either side, outside the rests, the silences and the dissolve', () => {
    const { l, r } = film;
    // power in 5 f blocks; a beat is four of them
    const block = S(5);
    const from = T.beat(44);
    const blocks = Array.from({ length: Math.floor((l.length - from) / block) }, (_, k) => {
      let s = 0;
      for (let i = from + k * block; i < from + (k + 1) * block; i++) s += (l[i] * l[i] + r[i] * r[i]) / 2;
      return s / block;
    });
    const beat = (k: number) => 10 * Math.log10((blocks[k] + blocks[k + 1] + blocks[k + 2] + blocks[k + 3]) / 4 + 1e-30);
    const out: [number, number][] = [...T.spans('rest'), ...T.silences, [S(END.dissolve[0]), S(END.dissolve[1])]];
    const clear = (k: number) => !out.some(([a, b]) => from + k * block < b && from + (k + 4) * block > a);
    const holes: string[] = [];
    for (let k = 4; k + 8 <= blocks.length; k++) {
      if (!clear(k - 4) || !clear(k) || !clear(k + 4)) continue;
      const under = Math.min(beat(k - 4), beat(k + 4)) - beat(k);
      if (under > 12) holes.push(`f${(from + k * block) / S(1)}: ${under.toFixed(1)} dB`);
    }
    expect(holes).toEqual([]);
  });

  it('leaves no near-silence from bar 44 on: no 250 ms window (every 2.5 f) is more than 25 dB under the second round it or under -50 dBFS, outside the rests, the silences, the dissolve and the unpunched notch', () => {
    // (wave 4: a 0.34 s hole at f4070-4080 read -78 dBFS, 61 dB under its second; and the thinned pulse's half-bar breaths in beat 8, a 1 s bass
    // stroke on a 1.33 s spacing, read 25-29 dB under theirs until each stroke held to the next)
    const { l, r } = film;
    const pre = new Float64Array(l.length + 1);
    for (let i = 0; i < l.length; i++) pre[i + 1] = pre[i] + (l[i] * l[i] + r[i] * r[i]) / 2;
    const db = (a: number, b: number) => 10 * Math.log10((pre[Math.min(b, l.length)] - pre[Math.max(0, a)]) / (Math.min(b, l.length) - Math.max(0, a)) + 1e-30);
    const w = SR / 4;
    // a window whose second reaches into a rest, a silence or the dissolve is not measured; nor one inside the unpunched notch's gap
    // (from the missing eighth to the long run's slide: the gap in the eighths is the point, STORYBOARD 8.4)
    const out: [number, number][] = [...T.spans('rest'), ...T.silences, [S(END.dissolve[0]), S(END.dissolve[1])]];
    const notch: [number, number] = [S(BEAT_8.notches.find((n) => !n.punched)!.f), S(BEAT_8.longRun.from)];
    const holes: string[] = [];
    for (let s0 = T.beat(44); s0 + w <= l.length; s0 += S(2.5)) {
      const [a, b] = [s0 + w / 2 - SR / 2, s0 + w / 2 + SR / 2];
      if (out.some(([x, y]) => a < y && b > x) || (s0 < notch[1] && s0 + w > notch[0])) continue;
      const [win, round] = [db(s0, s0 + w), db(a, b)];
      if (round - win > 25 || win < -50) holes.push(`f${(s0 / S(1)).toFixed(1)}: ${win.toFixed(1)} dBFS, ${(round - win).toFixed(1)} dB under`);
    }
    expect(holes).toEqual([]);
  });

  it('gives every hit of bars 44-84 a contact QA’s onset finder hears within a frame', () => {
    const hits = lines.find((l) => l.startsWith('qa: hits'))!;
    const missed = [...hits.matchAll(/([\w-]+) \(f(\d+)\)/g)].filter((mm) => Number(mm[2]) >= at(44)).map((mm) => mm[1]);
    expect(missed, hits).toEqual([]);
  });
});

describe('the voices', () => {
  const seed = 7;
  const mono: [string, () => Float32Array, number][] = [
    ['fmMallet', () => fmMallet(69, { vel: 0.8 }), 0.8],
    ['fmMallet with a droop', () => fmMallet(77, { vel: 0.5, droop: 40, droopTime: 0.6, tau: 0.28 }), 0.5],
    ['marimba', () => marimba(62, { seed, k: 1, vel: 0.7, cents: 12 }), 0.7],
    ['feltPiano', () => feltPiano(38, { seed, k: 1, vel: 0.75, hold: 1 }), 0.75],
    ['sineBass', () => sineBass(38, { len: 1, vel: 0.9 }), 0.9],
    ['woodTick', () => woodTick(1250, { seed, k: 1 }), 0.7],
    ['brightPluck', () => brightPluck(81, { seed, k: 1 }), 0.7],
    ['smear', () => smear(51, 50, { len: 0.55, glide: 0.35 }), 0.7],
    ['smear, held', () => smear(60, 59, { len: 2.5, glide: 0.4, vel: 0.6, attack: 0.3, release: 0.67 }), 0.6],
    ['chirp', () => chirp({ f0: 1500, f1: 2200, len: 0.06 }), 0.6],
    ['fallTone', () => fallTone(74), 0.6],
    ['hum', () => hum(38, { len: 4.7, attack: 0.25 }), 0.7],
    ['softPulse', () => softPulse(62, { vel: 0.6 }), 0.6],
    ['loupeBell', () => loupeBell(81, { vel: 0.55 }), 0.55],
    ['stripTone', () => stripTone(66, { n: 46_400, vel: 0.6 }), 0.6],
    ['woodblockHop', () => woodblockHop(seed, 1), 1],
    ['sketchScratch', () => sketchScratch(seed, { len: 0.3 }), 1],
    ['sketchScratch, dry', () => sketchScratch(seed, { len: 0.22, k: 2, dry: true }), 1],
    ['inkClick', () => inkClick(seed, 1), 1],
    ['paperThump', () => paperThump(seed), 1],
    ['woodKnock', () => woodKnock(seed, 1), 1],
    ['sandTrickle', () => sandTrickle(seed, { len: 1.1 }), 1],
    ['paperTear', () => paperTear(seed), 1],
    ['plateTap', () => plateTap(seed, 0), 1],
    ['printTap', () => printTap(seed, 0), 1],
    ['gateClack', () => gateClack(seed, 3), 1],
    ['detent', () => detent(seed, 0), 1],
    ['paperFold', () => paperFold(seed), 1],
    ['pointerTick', () => pointerTick(seed, 0), 1],
    ['ratchet', () => ratchet(seed, { len: 0.8 }), 1],
    ['paperTick', () => paperTick(seed, 0), 1],
    ['unhook', () => unhook(seed, 0), 1],
    ['cordRun', () => cordRun(seed, { len: 1.1 }), 1],
    ['lidClick', () => lidClick(seed, 0), 1],
    ['vellumLay', () => vellumLay(seed, { len: 0.4 }), 1],
    ['vellumTap', () => vellumTap(seed, 0), 1],
    ['softPop', () => softPop(seed, 0), 1],
  ];
  it.each(mono)('%s is finite, peaks at its velocity and is the same every time', (_, make, vel) => {
    const a = make();
    expect(a.every((x) => Number.isFinite(x))).toBe(true);
    expect(peakOf(a)).toBeCloseTo(vel, 5);
    expect(make()).toEqual(a);
  });

  it('starts the ratchet on its hit: its first click within 2 ms of the clip’s start', () => {
    const r = ratchet(seed, { len: 0.8 });
    const first = r.findIndex((x) => Math.abs(x) > 0.05 * peakOf(r));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first / 48000).toBeLessThan(0.002);
  });

  it('keeps the sketch’s smear when no attack or release is given', () => {
    expect(smear(51, 50, { len: 0.55, glide: 0.35, vel: 0.7, attack: 0.07, release: 0.18 })).toEqual(smear(51, 50, { len: 0.55, glide: 0.35, vel: 0.7 }));
  });

  it('a bowed note keeps its fixed scale whatever its pitch; the ink swell is a stereo spread', () => {
    for (const midi of [50, 66]) {
      const a = bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 });
      expect(a.every((x) => Number.isFinite(x))).toBe(true);
      expect(peakOf(a)).toBeGreaterThan(0.5);
      expect(peakOf(a)).toBeLessThan(1.4);
      expect(bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 })).toEqual(a);
    }
    const swell = inkSwell(seed, { len: 1 });
    expect(Math.max(peakOf(swell.l), peakOf(swell.r))).toBeCloseTo(1, 5);
    expect(swell.l).not.toEqual(swell.r);
  });

  it('a bowed note with no bend is the note it always was; a bend of zero changes nothing, and its halves sum to the whole', () => {
    const o = { seed, k: 3, len: 1.5, attack: 0.3, release: 0.4 };
    const a = bowedNote(57, o);
    expect(bowedNote(57, { ...o, bend: () => 0 })).toEqual(a);
    const half = bowedNote(57, { ...o, amp: () => 0.5 });
    for (let i = 0; i < a.length; i += 101) expect(half[i] * 2).toBeCloseTo(a[i], 6);
    expect(bowedNote(57, { ...o, bend: (t) => 9 * t })).not.toEqual(a);
  });

  it('holds a strip’s tone for exactly its samples, ending on silence; rains its ticks at their pans', () => {
    const s = stripTone(62, { n: 25_120 });
    expect(s.length).toBe(25_120);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(1e-3);
    expect(Math.abs(s[Math.floor(s.length / 2)])).toBeGreaterThan(0);
    const rain = tickRain(seed, [
      { t: 0, amp: 1, pan: -1 },
      { t: 0.1, amp: 1, pan: 1 },
    ]);
    const at = (i: number, c: Float32Array) => peakOf(c.subarray(i, i + 480));
    expect(at(0, rain.l)).toBeGreaterThan(10 * at(0, rain.r));
    expect(at(4800, rain.r)).toBeGreaterThan(10 * at(4800, rain.l));
  });
});
