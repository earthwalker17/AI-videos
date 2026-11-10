/**
 * Bars 19-29 (f1440-2319): the turn and the two levels (STORYBOARD 4.1-4.6, Sound column). The
 * pad, the bass pulse and the Router's ticks are continuity.ts's; this part places the events.
 *
 *   f1440 (`turn`)        every voice (mallet, marimba, pluck, felt piano) collapses into one
 *                         D-major unison arpeggio, centred; the ink is a soft spreading swell
 *   f1640 (`trait-continuous`)  the Continuous plate docks: an enamel tap
 *   f1680 (`request-in`)  the request is stamped in: a print tap and the motif's first station
 *   f1720 (`strike-split`) the counterfactual card is struck: a dry scratch
 *   f1760 (`dispatch-bug`) a hatch opens, the bug bay rises: a low wooden knock, the motif's second
 *                         station (into its Worker), and a beat later its marimba voice (A4)
 *   f1800 (`thread-row`)  the Thread's row inks in: an ink click; f1826 (`gauge`) a tiny click
 *   f1840-1920            the ghost Router (`ghost-router`): its backlog piles at its door as a
 *                         smeared cluster growing for a bar; f1920 (`strike-ghost`) a dry scratch,
 *                         and the cluster fades over a beat. The Router's ticks never miss
 *                         (rows 1 and 2 land on beats 2 and 4) while the bug voice thickens
 *   f1990, f2030          the index arm detents toward the hatches (`arm-tests`, `arm-docs`): a tick
 *   f2000, f2040          the test tower and the docs galley rise (`dispatch-tests`, `dispatch-docs`):
 *                         a knock each, then their voices, D5 and F♯4 (three voices at most; F♯5 is
 *                         the stamp's). The tests voice stops when its lamps go out (bar 27 beat 4)
 *   MT1                   `report-up` an ink click (the card ejects), `stamp-in` a print tap,
 *                         `reply-lands` one felt-piano note (you); from `stamp-in` the Workers are
 *                         heard through a wall (throughWall), their last notes a beat before the rest
 *   `rest-model`          the pad at its rest level and one pluck, on `dispatch-fresh` (the fresh bay
 *                         rises inside the rest: no knock)
 */
import { rand } from '@aiv/core';
import { Svf, dbToGain, smooth, type Mixer } from '@aiv/pipeline/audio/kit';
import { MT1 } from '../src/cues.ts';
import { LV, M, type Desk, type Marks } from './common.ts';
import { inkClick, inkSwell, plateTap, printTap, sketchScratch, woodKnock } from './foley.ts';
import { brightPluck, feltPiano, fmMallet, marimba, smear, woodTick } from './instruments.ts';

const { D4, Fs4, A4, D5, Fs5, A5 } = M;

/** The ghost Router's backlog: eight items pile at its door, an eighth apart, a semitone cluster round A3-E4. */
const BACKLOG = [57, 58, 59, 60, 61, 62, 63, 64];

/** The Workers: each a bay's marimba voice, its knock on its dispatch, its rhythm cell per bar (the bug's thickens through N2). */
export interface Worker {
  id: 'bug' | 'tests' | 'docs';
  midi: number;
  /** the dispatch cue */
  cue: string;
  pan: number;
  /** beats in the bar, by bars since the dispatch (the last repeats) */
  cells: readonly (readonly number[])[];
}
export const WORKERS: readonly Worker[] = [
  { id: 'bug', midi: A4, cue: 'dispatch-bug', pan: 0.3, cells: [[1.5, 3], [1.5, 3, 4.5], [1.5, 2.5, 3, 4.5]] },
  { id: 'tests', midi: D5, cue: 'dispatch-tests', pan: 0.5, cells: [[2, 3.5, 4]] },
  { id: 'docs', midi: Fs4, cue: 'dispatch-docs', pan: 0.65, cells: [[1, 2.5, 3.75]] },
];

/** The beat the test lamps start going out on (bar 27 beat 4: src/desk/state.ts EVENTS_B.lampsOut, f2140). */
export const TESTS_DONE = { bar: 27, beat: 4 } as const;

export function levels(d: Desk): void {
  const { T, seed, m, music, foley } = d;

  // ===== the turn ===================================================================================
  [D4, Fs4, A4, D5, Fs5, A5].forEach((midi, j, arp) => {
    const at = m.turn + j * T.beats(0.5);
    const p = { pan: 0, sends: { hall: 0.3, echo: 0.12 } };
    const last = j === arp.length - 1;
    music(at, fmMallet(midi, { vel: 0.75 }), { part: 'arp-mallet', db: LV.arp, ...p });
    music(at, marimba(midi, { seed, k: 6000 + j, vel: 0.75, bright: 0.6 }), { part: 'arp-marimba', db: LV.arp, ...p });
    music(at, brightPluck(midi, { seed, k: 6100 + j, vel: 0.7, t60: 1.4, bright: 0.7 }), { part: 'arp-pluck', db: LV.arp - 3, ...p });
    music(at, feltPiano(midi, { seed, k: 6200 + j, vel: 0.6, hold: last ? 2.5 : 0.9 }), { part: 'arp-piano', db: LV.arp, ...p });
  });
  foley(m.turn, inkSwell(seed, { len: T.beats(4) / T.ctx.sampleRate }), { part: 'ink-swell', db: LV.swell, pan: 0, sends: { hall: 0.2 } });

  // ===== 4.2-4.3: the request stamped in, the split struck, the first dispatch ========================
  foley(T.cue('trait-continuous'), plateTap(seed, 0), { part: 'plate', db: LV.plate, pan: -0.1, sends: { hall: 0.2 } });
  const reqIn = T.cue('request-in');
  foley(reqIn, printTap(seed, 0), { part: 'print', db: LV.print, pan: -0.05, sends: { hall: 0.1 } });
  d.motif(reqIn, { pan: -0.2, db: LV.motif - 3 });
  foley(T.cue('strike-split'), sketchScratch(seed, { len: 0.22, k: 2, dry: true }), { part: 'strike', db: LV.strike, pan: 0.05, sends: { hall: 0.1 } });
  d.motif(T.cue('dispatch-bug'), { pan: 0.3, db: LV.motif - 4 });
  foley(T.cue('thread-row'), inkClick(seed, 2), { part: 'ink-click', db: LV.click - 2, pan: -0.05 });
  foley(T.cue('gauge'), inkClick(seed, 3), { part: 'gauge', db: LV.gauge, pan: 0 });

  // ===== 4.4: the ghost Router, its backlog a smeared cluster that grows for a bar and fades ===========
  const ghost = T.cue('ghost-router');
  const struck = T.cue('strike-ghost');
  const fade = T.beats(1);
  BACKLOG.forEach((midi, j) => {
    const at = ghost + j * T.beats(0.5);
    const len = (struck + fade - at) / T.ctx.sampleRate;
    music(at, smear(midi + 1, midi, { len, glide: 0.4, vel: 0.6, attack: 0.3, release: fade / T.ctx.sampleRate }), { part: 'ghost', db: LV.ghost - 4 + 0.6 * j, pan: 0.05 + 0.02 * j, sends: { hall: 0.25 } });
  });
  foley(struck, sketchScratch(seed, { len: 0.22, k: 5, dry: true }), { part: 'strike', db: LV.strike, pan: 0.1, sends: { hall: 0.1 } });

  // ===== 4.5: the other dispatches; the index arm detents toward each hatch first =======================
  for (const [k, id] of (['arm-tests', 'arm-docs'] as const).entries())
    music(T.cue(id), woodTick(1180 + 70 * k, { seed, k: 500 + k, vel: 0.7 }), { part: 'arm-tick', db: LV.armTick, pan: 0.15, sends: { hall: 0.15 } });

  // ===== the Workers: a knock on the dispatch, the voice a beat later ===================================
  const testsDone = T.beat(TESTS_DONE.bar, TESTS_DONE.beat);
  const last = m.rest[0] - T.beats(1);
  WORKERS.forEach((w, wi) => {
    const knock = T.cue(w.cue);
    foley(knock, woodKnock(seed, wi), { part: 'knock', db: LV.knock, pan: w.pan, sends: { hall: 0.2 } });
    const from = knock + T.beats(1);
    const until = w.id === 'tests' ? testsDone : last;
    const bar0 = T.position(knock).bar;
    let c = 0;
    for (let bar = bar0; T.beat(bar) < until; bar++)
      for (const b of w.cells[Math.min(w.cells.length - 1, bar - bar0)]) {
        const at = T.beat(bar, b);
        if (at < from || at >= until) continue;
        const key = wi * 100 + c++;
        const wall = smooth((at - m.stepDown) / (m.rest[0] - m.stepDown));
        const clip = marimba(w.midi, { seed, k: 7000 + key, vel: 0.55 + 0.2 * rand(seed, 'worker-vel', key), bright: 0.5, cents: 4 * (rand(seed, 'worker-cents', key) - 0.5) });
        d.workers(at, clip, { part: 'workers', db: LV.workers, pan: w.pan, sends: { hall: 0.22 * (1 - 0.8 * wall) } });
      }
  });

  // ===== MT1: the report goes up, is stamped in, and the Router's one reply reaches you ===================
  foley(d.f(MT1.reportUp), inkClick(seed, 4), { part: 'ink-click', db: LV.click, pan: 0.5 });
  foley(d.f(MT1.stampIn), printTap(seed, 1), { part: 'print', db: LV.print, pan: -0.05, sends: { hall: 0.1 } });
  // damped before the rest (it lands 26 f before it; left to ring, it held the rest only 13 dB under the mix)
  const reply = d.f(MT1.replyLands);
  music(reply, feltPiano(D4, { seed, k: 30, vel: 0.65, hold: (m.rest[0] - reply) / T.ctx.sampleRate - 0.2, damp: 0.1 }), { part: 'reply', db: LV.piano - 3, pan: -0.5, sends: { hall: 0.35 } });

  // ===== the model rest: the pad (continuity.ts) and one pluck, as the fresh bay rises ====================
  music(d.f(MT1.dispatchFresh), brightPluck(D5, { seed, k: 41, vel: 0.6, t60: 1.5, bright: 0.55 }), { part: 'rest-pluck', db: LV.restPluck, pan: 0.6, sends: { hall: 0.35, echo: 0.15 } });
}

/**
 * The Workers' bus through a wall: from `stamp-in` to the rest a low-pass closes from 16 kHz to
 * 650 Hz and the level falls 8 dB (in place, before the mixdown). The filter runs over the whole
 * bus, open before the step-down, so it never starts mid-note.
 */
export function throughWall(mx: Mixer, m: Marks): void {
  const bus = mx.bus('workers');
  const fl = new Svf();
  const fr = new Svf();
  const span = m.rest[0] - m.stepDown;
  let g = 1;
  for (let i = 0; i < bus.l.length; i++) {
    if ((i & 31) === 0) {
      const u = smooth((i - m.stepDown) / span);
      const fc = 16000 * (650 / 16000) ** u;
      fl.set(fc, Math.SQRT1_2);
      fr.set(fc, Math.SQRT1_2);
      g = dbToGain(-8 * u);
    }
    fl.tick(bus.l[i]);
    fr.tick(bus.r[i]);
    bus.l[i] = fl.lp * g;
    bus.r[i] = fr.lp * g;
  }
}
