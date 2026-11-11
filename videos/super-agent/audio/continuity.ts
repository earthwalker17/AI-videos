/**
 * The Router's layer, from the turn to the end card: the bowed pad (continuity), the sine-bass
 * pulse on beats 1 and 3 and the Router's memory ticks on 2 and 4. One plan for the whole film,
 * so a pad line holds across a chord change and across the seam into part two: bars 19-43 are
 * LEVELS_PLAN, bars 44-84 PART_TWO_PLAN.
 *
 * - The pad holds each pitch as one line from where it enters to where it leaves. It sinks to its
 *   rest level (LV.restPad) over the 1.5 beats before each rest (`rest-model`, `rest-signoff`)
 *   and comes back over the beat after it (QA wants a rest 20 dB under the mix). The silence
 *   before the intrusion (`silence-intrusion`) cuts it (index.ts); it re-enters after it as a
 *   drone swell. It fades out over bars 76-77 and ends at `dissolve`.
 * - Part two (TREATMENT Sound design, STORYBOARD 7.1-13.3): D major for beat 7; beat 8's evidence
 *   has no pad at all (a chord of no notes closes every line: the pulse thins to mallet and bass,
 *   evidence.ts), and the pad comes back on bar 58's B minor as the bass drops out. After the
 *   silence a drone swell on D carries B minor's colour, a suspension for the "?", then the
 *   borrowed iv (G minor over the drone, bar 65), in which the Router's chord detunes into two
 *   from BEAT_10.split (each line becomes two halves, a few cents apart and drifting apart
 *   across the image, until the next chord re-bows the pad); bar 67's suspension holds through
 *   bar 68 and resolves on the stamp (G4 to F♯4), and the rest holds a Dmaj9.
 * - The ticks are the index arm's detents (STORYBOARD 4.4: "detents on 2 and 4"). They start when
 *   the Register has locked and its first row prints (bar 21 beat 2), never sound inside a rest or
 *   a silence, and stand aside where another sound marks the same beat (`skip`). In bars 35-38 the
 *   Router batches: its ticks are held (keepUp.ts) and released as one chord. In bars 76-78 they
 *   are the frame-0 rhythm, one quiet tick a beat (STORYBOARD 12.1), fading through the dissolve.
 * - The bass pulse runs to bar 57, skipping the flyover (bar 45 beat 1: a Thread follow-up skips
 *   the Router's decision) and the dossier's thud (bar 49 beat 3), and comes back for bars 71-75.
 *
 * Bars 1-43 are as approved (2026-11-12): every line that starts in part one keeps the number
 * (its bow's noise) the approved render gave it, so part two's plan never moves a sample of them.
 */
import { SR, dbToGain, smooth } from '@aiv/pipeline/audio/kit';
import { BEAT_10 } from '../src/cues.ts';
import { LV, M, panned, type Desk } from './common.ts';
import { bowedNote, sineBass, woodTick } from './instruments.ts';

const { B2, D2, D3, E3, Fs3, G3, A3, Bb3, B3, Cs4, D4, E4, Fs4, G4, A4 } = M;

/** A pad chord from a bar (and beat) on; `fresh` re-bows every line, held notes too. */
export interface Chord {
  bar: number;
  beat?: number;
  notes: readonly number[];
  fresh?: boolean;
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
  /** a further lift, dB, ramped from bar `from` to bar `to` (where no pad sounds, so the ramp is never heard) */
  padLift?: { from: number; to: number; db: number };
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

/** Bars 44-84 (beats 7-13). */
export const PART_TWO_PLAN: RouterPlan = {
  chords: [
    // beat 7: waiting, handed over
    { bar: 44, notes: [D3, A3, D4, Fs4] },
    { bar: 46, notes: [D3, G3, B3, E4] },
    { bar: 48, notes: [D3, A3, E4, Fs4] },
    // beat 8: the evidence, no pad
    { bar: 50, notes: [] },
    // beat 9: B minor, the bass out
    { bar: 58, notes: [B2, Fs3, B3, D4] },
    { bar: 60, notes: [B2, E3, G3, B3] },
    { bar: 62, notes: [B2, Fs3, A3, D4] },
    // beat 10, after the silence: the drone swell under the minor second, the "?" on a suspension, the borrowed iv (detuned into two from the split), bar 67's suspension
    { bar: 63, beat: 3, notes: [D3, A3, B3, D4] },
    { bar: 64, beat: 4, notes: [D3, A3, D4, E4] },
    { bar: 65, notes: [D3, G3, Bb3, D4] },
    { bar: 67, notes: [D3, A3, D4, G4], fresh: true },
    // beat 11: the stamp resolves it, the held Dmaj9 through the rest; the labels, the act-one card, the half-speed motif
    { bar: 69, notes: [D3, A3, D4, Fs4] },
    { bar: 69, beat: 3, notes: [D3, A3, Cs4, E4, Fs4] },
    { bar: 71, notes: [D3, G3, B3, D4] },
    { bar: 73, notes: [D3, A3, D4, E4] },
    { bar: 74, notes: [D3, A3, D4, Fs4] },
    { bar: 75, notes: [D3, G3, B3, D4] },
    // beat 12: the bookend, fading to the dissolve
    { bar: 76, notes: [D3, A3, D4, Fs4] },
  ],
  bass: [...range(44, 57), ...range(71, 75)],
  // f3520: the follow-up skips the Router's decision; f3880: the dossier's thud stands alone
  bassSkip: [
    [45, 1],
    [49, 3],
  ],
  // the pad comes back from beat 8's gap a dB fuller (part two alone near -14.3 LUFS, so bars 1-43 keep their level in the master)
  padLift: { from: 51, to: 57, db: 1 },
  ticks: [
    ...on24(range(44, 75), -2),
    // bars 76-78: one quiet tick a beat (the frame-0 rhythm), fading through the dissolve to about f6200
    ...[-4, -4, -4, -4, -5, -6, -8, -10, -13, -17].map((db, k) => [76 + Math.floor(k / 4), 1 + (k % 4), db] as const),
  ],
  padDb: 2,
};

/** N9: from BEAT_10.split each pad line sounding then splits into two halves, `cents` sharp and flat after a `glide` (beats), drifting `spread` apart across the image. */
export const DETUNE = { cents: 9, glide: 1.5, spread: 0.3 } as const;

/**
 * The pad lines that run from part one across the seam into part two keep the numbers the approved render of
 * bars 1-43 gave them (2026-11-12: the animatic bed's plan numbered them), so their bow's noise, and every
 * sample of bars 1-43, stays as approved. The lines that close by the seam keep theirs by close order, as built.
 */
const SEAM_VOICES: readonly { midi: number; k: number }[] = [
  { midi: D3, k: 39 },
  { midi: A3, k: 26 },
];

export function routerLayer(d: Desk, o: { skip: readonly number[] }): void {
  const { T, seed, m, music, pad } = d;
  const plans = [LEVELS_PLAN, PART_TWO_PLAN];
  const chords = plans.flatMap((p) => p.chords).map((c) => ({ at: Math.max(m.turn, T.beat(c.bar, c.beat ?? 1)), notes: c.notes, fresh: c.fresh ?? false }));
  const padEnd = T.cue('dissolve');
  const fadeFrom = T.beat(76);
  const twoFrom = T.beat(PART_TWO_PLAN.chords[0].bar);
  const twoDb = PART_TWO_PLAN.padDb ?? 0;
  const lift = PART_TWO_PLAN.padLift;
  const [liftFrom, liftTo] = lift ? [T.beat(lift.from), T.beat(lift.to)] : [0, 1];

  // ===== the pad ===================================================================================
  const dips: [number, number][] = [m.rest, m.signoff];
  const down = T.beats(1.5);
  const up = T.beats(1);
  const level = (s: number) => {
    let db = twoDb * smooth((s - (twoFrom - T.beats(4))) / T.beats(4));
    if (lift && s > liftFrom) db += lift.db * smooth((s - liftFrom) / (liftTo - liftFrom));
    for (const [a, b] of dips) {
      if (s < a - down || s >= b + up) continue;
      db += s < b ? LV.restPad * smooth((s - (a - down)) / down) : LV.restPad * (1 - smooth((s - b) / up));
    }
    return dbToGain(db) * (1 - smooth((s - fadeFrom) / (padEnd - fadeFrom)));
  };
  // N9's split: from the split to the next chord (which re-bows the pad)
  const split = d.f(BEAT_10.split);
  const healed = chords.find((c) => c.at > split)?.at ?? padEnd;
  const glide = T.beats(DETUNE.glide);
  const apart = (s: number) => (s < split ? 0 : smooth((s - split) / glide));
  // two segments: the turn to the silence before the intrusion, and from its end to the dissolve
  const segments: { from: number; to: number; attack: number; chords: typeof chords }[] = [
    { from: m.turn, to: m.intrusion[0], attack: 2.0, chords: chords.filter((c) => c.at < m.intrusion[0]) },
    { from: m.intrusion[1], to: padEnd, attack: 1.5, chords: chords.filter((c) => c.at >= m.intrusion[1]) },
  ];
  let k = 0;
  let k2 = 100;
  for (const seg of segments) {
    const lines: { midi: number; from: number; to: number; attack: number }[] = [];
    const open = new Map<number, { from: number; attack: number }>();
    let prevEmpty = false;
    for (const c of seg.chords) {
      for (const [midi, ln] of [...open])
        if (c.fresh || !c.notes.includes(midi)) {
          lines.push({ midi, from: ln.from, to: c.at, attack: ln.attack });
          open.delete(midi);
        }
      // a line opening the segment swells in; one coming back after a chord of no notes re-enters over 1.2 s
      const attack = c.at === seg.from ? seg.attack : prevEmpty ? 1.2 : 0.8;
      for (const midi of c.notes) if (!open.has(midi)) open.set(midi, { from: c.at, attack });
      prevEmpty = c.notes.length === 0;
    }
    for (const [midi, ln] of open) lines.push({ midi, from: ln.from, to: seg.to, attack: ln.attack });
    for (const ln of lines) {
      const kept = SEAM_VOICES.find((v) => v.midi === ln.midi);
      let kk: number;
      if (ln.from >= m.two) kk = k2++;
      else if (ln.to <= m.two) kk = k++;
      else if (kept) kk = kept.k;
      else throw new Error(`continuity: pad line ${ln.midi} crosses the seam without a kept number`);
      // a line that runs to the segment's end: its release is the pad's (to the dissolve) or the cut's (the silence)
      const release = ln.to === seg.to ? 1.6 : 0.8;
      const len = (ln.to - ln.from) / SR + release;
      const pan = (((ln.midi * 7) % 5) - 2) * 0.15;
      const sends = { hall: 0.35 };
      if (ln.from < healed && ln.to > split) {
        // the Router's chord detunes into two: two coherent halves of the line until the split, then a few cents apart, drifting apart
        for (const h of [-1, 1]) {
          const clip = bowedNote(ln.midi, { seed, k: kk, len, attack: ln.attack, release, amp: (t) => 0.5 * level(ln.from + t * SR), bend: (t) => h * DETUNE.cents * apart(ln.from + t * SR) });
          pad(ln.from, panned(clip, (t) => pan + h * DETUNE.spread * apart(ln.from + t * SR)), { part: 'pad', db: LV.pad, pan: 0, sends });
        }
        continue;
      }
      const clip = bowedNote(ln.midi, { seed, k: kk, len, attack: ln.attack, release, amp: (t) => level(ln.from + t * SR) });
      pad(ln.from, clip, { part: 'pad', db: LV.pad, pan, sends });
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
