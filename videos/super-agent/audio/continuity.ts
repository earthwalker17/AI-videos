/**
 * The Router's layer, from the turn to the end card: the bowed pad (continuity), the sine-bass
 * pulse on beats 1 and 3 and the Router's memory ticks on 2 and 4. One plan for the whole film,
 * so a pad line holds across a chord change and across the seam into the animatic bed: bars
 * 19-43 are planned here, bars 44-84 come from bed.ts (BED_PLAN, replaced in session 5).
 *
 * - The pad holds each pitch as one line from where it enters to where it leaves. It sinks to its
 *   rest level (LV.restPad) over the 1.5 beats before each rest (`rest-model`, `rest-signoff`)
 *   and comes back over the beat after it (QA wants a rest 20 dB under the mix). The silence
 *   before the intrusion (`silence-intrusion`) cuts it (index.ts); it re-enters after it as a
 *   drone swell. It fades out over bars 76-77 and ends at `dissolve`.
 * - The ticks are the index arm's detents (STORYBOARD 4.4: "detents on 2 and 4"). They start when
 *   the Register has locked and its first row prints (bar 21 beat 2), never sound inside a rest or
 *   a silence, and stand aside where another sound marks the same beat (`skip`). In bars 35-38 the
 *   Router batches: its ticks are held (keepUp.ts) and released as one chord.
 */
import { SR, dbToGain, smooth } from '@aiv/pipeline/audio/kit';
import { BED_PLAN } from './bed.ts';
import { LV, M, type Desk } from './common.ts';
import { bowedNote, sineBass, woodTick } from './instruments.ts';

const { D2, D3, G3, A3, B3, Cs4, D4, E4, Fs4, G4, A4 } = M;

/** A pad chord from a bar (and beat) on. */
export interface Chord {
  bar: number;
  beat?: number;
  notes: readonly number[];
}

/** The Router's layer over a stretch of the film. */
export interface RouterPlan {
  /** pad chords in time order */
  chords: readonly Chord[];
  /** bars whose beats 1 and 3 carry the bass pulse, and single [bar, beat]s it skips */
  bass: readonly number[];
  bassSkip?: readonly (readonly [number, number])[];
  /** the ticks: [bar, beat, dB relative to LV.ticks] */
  ticks: readonly (readonly [number, number, number])[];
  /** the pad's lift over LV.pad, dB, reached at the plan's first bar (ramped over the bar before) */
  padDb?: number;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const on24 = (bars: readonly number[], db = 0) => bars.flatMap((bar) => [[bar, 2, db] as const, [bar, 4, db] as const]);

/** Bars 19-43: the turn, the two levels, the model rest, beats 5 and 6. */
export const LEVELS_PLAN: RouterPlan = {
  chords: [
    { bar: 19, notes: [D3, A3, D4, Fs4] },
    { bar: 21, notes: [D3, G3, B3, D4] },
    { bar: 23, notes: [D3, A3, Fs4, A4] },
    { bar: 25, notes: [D3, B3, D4, Fs4] },
    { bar: 27, notes: [D3, G3, B3, E4] },
    { bar: 29, notes: [D3, A3, E4, Fs4] },
    { bar: 30, notes: [D3, A3, D4, Fs4] },
    { bar: 32, notes: [D3, B3, D4, G4] },
    { bar: 34, notes: [D3, A3, E4, Fs4] },
    { bar: 36, notes: [D3, A3, D4, Fs4] },
    { bar: 38, notes: [D3, A3, D4, E4] },
    { bar: 40, notes: [D3, G3, B3, D4] },
    { bar: 42, notes: [D3, A3, Cs4, E4] },
  ],
  bass: [...range(19, 29), ...range(30, 43)],
  // bar 21 beat 2: the Register's first row prints (STORYBOARD 4.2); bars 35-38: the ticks are held (keepUp.ts)
  ticks: [...on24([21, 22, 23, 24, 25, 26, 27, 28, 29]), ...on24(range(30, 34)), ...on24(range(39, 43))],
};

export function routerLayer(d: Desk, o: { skip: readonly number[] }): void {
  const { T, seed, m, music, pad } = d;
  const plans = [LEVELS_PLAN, BED_PLAN];
  const chords = plans.flatMap((p) => p.chords).map((c) => ({ at: Math.max(m.turn, T.beat(c.bar, c.beat ?? 1)), notes: c.notes }));
  const padEnd = T.cue('dissolve');
  const fadeFrom = T.beat(76);
  const bedFrom = T.beat(BED_PLAN.chords[0].bar);
  const bedDb = BED_PLAN.padDb ?? 0;

  // ===== the pad ===================================================================================
  const dips: [number, number][] = [m.rest, m.signoff];
  const down = T.beats(1.5);
  const up = T.beats(1);
  const level = (s: number) => {
    let db = bedDb * smooth((s - (bedFrom - T.beats(4))) / T.beats(4));
    for (const [a, b] of dips) {
      if (s < a - down || s >= b + up) continue;
      db += s < b ? LV.restPad * smooth((s - (a - down)) / down) : LV.restPad * (1 - smooth((s - b) / up));
    }
    return dbToGain(db) * (1 - smooth((s - fadeFrom) / (padEnd - fadeFrom)));
  };
  // two segments: the turn to the silence before the intrusion, and from its end to the dissolve
  const segments: { from: number; to: number; attack: number; chords: typeof chords }[] = [
    { from: m.turn, to: m.intrusion[0], attack: 2.0, chords: chords.filter((c) => c.at < m.intrusion[0]) },
    { from: m.intrusion[1], to: padEnd, attack: 1.5, chords: chords.filter((c) => c.at >= m.intrusion[1]) },
  ];
  let k = 0;
  for (const seg of segments) {
    const lines: { midi: number; from: number; to: number }[] = [];
    const open = new Map<number, number>();
    for (const c of seg.chords) {
      for (const [midi, from] of [...open])
        if (!c.notes.includes(midi)) {
          lines.push({ midi, from, to: c.at });
          open.delete(midi);
        }
      for (const midi of c.notes) if (!open.has(midi)) open.set(midi, c.at);
    }
    for (const [midi, from] of open) lines.push({ midi, from, to: seg.to });
    for (const ln of lines) {
      const attack = ln.from === seg.from ? seg.attack : 0.8;
      // a line that runs to the segment's end: its release is the pad's (to the dissolve) or the cut's (the silence)
      const release = ln.to === seg.to ? 1.6 : 0.8;
      const clip = bowedNote(ln.midi, { seed, k: k++, len: (ln.to - ln.from) / SR + release, attack, release, amp: (t) => level(ln.from + t * SR) });
      pad(ln.from, clip, { part: 'pad', db: LV.pad, pan: (((ln.midi * 7) % 5) - 2) * 0.15, sends: { hall: 0.35 } });
    }
  }

  // ===== the bass pulse: a sine-bass D on beats 1 and 3 ==============================================
  const pulse = sineBass(D2, { len: 1.0, vel: 0.9 });
  const skipBass = new Set(plans.flatMap((p) => p.bassSkip ?? []).map(([bar, beat]) => T.beat(bar, beat)));
  const inRest = (s: number, tail = 0) => T.spans('rest').some(([a, b]) => s + tail > a && s < b) || T.silences.some(([a, b]) => s + tail > a && s < b);
  for (const bar of plans.flatMap((p) => p.bass))
    for (const b of [1, 3]) {
      const at = T.beat(bar, b);
      // the pulse never starts inside a rest or a silence, nor rings into one
      if (at < m.turn || skipBass.has(at) || inRest(at, T.beats(1.4))) continue;
      music(at, pulse, { part: 'bass', db: LV.bass, pan: 0 });
    }

  // ===== the Router's memory: a soft tick on 2 and 4 ===================================================
  const skip = new Set(o.skip);
  let tk = 0;
  for (const [bar, b, db] of plans.flatMap((p) => p.ticks)) {
    const at = T.beat(bar, b);
    if (skip.has(at) || inRest(at, T.beats(0.2))) continue;
    music(at, woodTick(1250 + 60 * (tk % 3), { seed, k: tk, vel: 0.7 }), { part: 'ticks', db: LV.ticks + db, pan: 0.05, sends: { hall: 0.15 } });
    tk++;
  }
}
