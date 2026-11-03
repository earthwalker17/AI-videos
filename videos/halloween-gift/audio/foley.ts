/**
 * The sound effects, placed on their cues. Every sound here is synthesised (sfx.ts); positions
 * come from the cue sheet (T.cue) or from the bar grid where the picture moves on a beat.
 */
import { at } from '../src/cues.ts';
import { Biquad, SR, dbToGain, peakOf, scale, seedOf } from './dsp.ts';
import type { Stereo } from './sampler.ts';
import type { Mixer, Place } from './mixer.ts';
import { footfalls } from './timeline.ts';
import type { Timeline } from './timeline.ts';
import {
  batChirps,
  bookSlam,
  boing,
  candyPlink,
  ding,
  doorCreak,
  doorFlap,
  fwip,
  fwoomps,
  gateClang,
  gateCreak,
  gravelStep,
  ignite,
  knock,
  laptopDown,
  owl,
  pageTurn,
  paperSlide,
  popSnap,
  riffle,
  slipper,
  sparkle,
  stampThunk,
  thunder,
  waxCrack,
  whoosh,
  wind,
  wingFlutter,
} from './sfx.ts';

/** the door knocks' room send */
const KNOCK_ROOM = 0.45;

/** every effect ends on a raised-cosine fade this long, so none stops while it still rings */
const END_FADE = 0.025;

/**
 * Scale a clip so its sample peak is `peakDb` dBFS (effects are levelled by their peaks), and
 * fade its last END_FADE s out (a raised cosine).
 */
function norm<C extends Float32Array | Stereo>(clip: C, peakDb: number): C {
  const chans = clip instanceof Float32Array ? [clip] : [clip.l, clip.r];
  let p = 0;
  for (const c of chans) p = Math.max(p, peakOf(c));
  if (p > 0) for (const c of chans) scale(c, dbToGain(peakDb) / p);
  for (const c of chans) {
    const m = Math.min(c.length, Math.round(END_FADE * SR));
    for (let k = 0; k < m; k++) c[c.length - 1 - k] *= 0.5 - 0.5 * Math.cos((Math.PI * k) / m);
  }
  return clip;
}

export function foley(T: Timeline, mx: Mixer): void {
  const seed = T.ctx.seed;
  const S = (id: string, k = 0) => seedOf(seed, id, k);
  const B = T.beat;
  const F = T.frame;
  const fx = { bus: 'sfx' as const };
  /** place an effect at `peak` dBFS (its sample peak, before the pan law) */
  const put = (at: number, clip: Float32Array | Stereo, p: Omit<Place, 'db'> & { peak: number }) => mx.add(at, norm(clip, p.peak), { ...p, db: 0 });

  // --- weather: thunder on the lightning, wind until the knock's silence, wind again at the end
  put(T.cue('lightning'), thunder(S('thunder'), { len: 4.6, rolls: 4 }), { ...fx, part: 'thunder', peak: -4, hall: 0.2 });
  {
    const end = T.silences[0][0];
    const len = end / 48000;
    const level = (t: number) => {
      const b = t / 1.5 + 1; // bar number
      if (b < 4) return 0.9;
      if (b < 5) return 0.9 - 0.5 * (b - 4);
      if (b < 17) return 0.32;
      // bars 17-18: faint, gone before the silence
      const fadeAt = (F(at(18, 1)) + T.s(0.25)) / 48000;
      return t < fadeAt ? 0.22 : Math.max(0, 0.22 * (1 - (t - fadeAt) / 0.45));
    };
    const howls = [
      { t: 0.7, dur: 2.2, f0: 420, f1: 820, amp: 1 },
      { t: 2.9, dur: 1.9, f0: 520, f1: 960, amp: 0.8 },
      { t: 13.1, dur: 2.4, f0: 380, f1: 700, amp: 0.55 },
      { t: 19.4, dur: 2.0, f0: 450, f1: 760, amp: 0.45 },
    ];
    mx.add(0, wind(S('wind-a'), { len, level, howls }), { ...fx, part: 'wind', db: -14 });
    const a = T.cue('book-slam');
    const b = T.silences[T.silences.length - 1][0];
    const len2 = (b - a) / 48000;
    const level2 = (t: number) => 0.3 * Math.min(1, t / 0.8) * Math.max(0, 1 - Math.max(0, t - (len2 - 1.4)) / 1.3);
    mx.add(a, wind(S('wind-b'), { len: len2, level: level2, howls: [{ t: 2.0, dur: 2.2, f0: 400, f1: 720, amp: 0.5 }] }), { ...fx, part: 'wind', db: -14 });
  }

  // --- the closed book knocks from inside (muffled), bars 2 and 38
  for (const id of ['book-knock-1', 'book-knock-2', 'book-knock-3', 'book-knock-4'])
    put(T.cue(id), knock(S(id), { muffled: true }), { ...fx, part: 'knock-muffled', peak: -8, room: 0.35 });

  // --- the cover bursts: paper riffle and the pop-up flats snapping up one by one
  put(T.cue('cover-burst'), riffle(S('burst-riffle'), { len: 0.5, count: 34, air: 0.5 }), { ...fx, part: 'paper', peak: -8, hall: 0.15 });
  put(T.cue('cover-burst'), popSnap(S('burst-pop'), 1), { ...fx, part: 'paper', peak: -6, hall: 0.15 });
  put(T.cue('cover-burst'), doorFlap(S('burst-whump')), { ...fx, part: 'paper', peak: -12, room: 0.2 });
  for (let k = 0; k < 6; k++) put(F(at(4) + 6 + k * 3), popSnap(S('valley-pop', k), 0.6), { ...fx, part: 'paper', peak: -20, pan: -0.5 + k * 0.2, hall: 0.15 });

  // --- valley: the jack-o'-lantern catches; Clawd pops up (a spring and a paper snap)
  put(T.cue('pumpkin-light'), fwip(S('light-fwip')), { ...fx, part: 'fire', peak: -11, pan: -0.35, hall: 0.12 });
  put(T.cue('pumpkin-light'), ignite(S('ignite')), { ...fx, part: 'fire', peak: -20, pan: -0.35, hall: 0.1 });
  put(T.cue('clawd-pop'), popSnap(S('clawd-pop'), 1), { ...fx, part: 'paper', peak: -11, hall: 0.1 });
  put(T.cue('clawd-pop') + T.s(0.01), boing(S('boing'), 240), { ...fx, part: 'boing', peak: -20, hall: 0.15 });

  // --- Clawd's footsteps on the gravel paths
  // where each walk goes across the stereo field: the valley exit screen-right, the graveyard
  // left to right (two walks around the shoo), the lane receding up the path, the exit right
  const walkPan = (walk: number, u: number) => [0.1 + 0.4 * u, -0.6 + 0.55 * u, 0.05 + 0.55 * u, 0, 0.2 + 0.6 * u][walk];
  footfalls().forEach(({ frame, walk, u }, k) => {
    const far = walk === 3 ? -3 * u : 0;
    put(F(frame), gravelStep(S('step', k), 0.9), { ...fx, part: 'steps', peak: -24 + far, pan: walkPan(walk, u), room: 0.12 });
  });

  // --- graveyard: the page turns; bats; the shoo
  put(T.cue('page-turn'), pageTurn(S('page-turn')), { ...fx, part: 'paper', peak: -9, hall: 0.12 });
  for (const [f, pan, n] of [
    [at(9, 2) + 6, 0.5, 3],
    [at(10, 2), 0.7, 2],
    [at(12, 1) + 6, 0.35, 4],
  ] as const)
    put(F(f), batChirps(S('bats', f), n), { ...fx, part: 'bats', peak: -24, pan, hall: 0.3 });
  put(F(at(10, 2) - 6), wingFlutter(S('bat-wings', 1), 0.5, 12), { ...fx, part: 'bats', peak: -22, pan: 0.6, hall: 0.2 });
  {
    const shoo = T.cue('ghost-shoo');
    const notes = [74, 76, 78, 81, 83, 86, 88, 90, 93];
    put(shoo, sparkle(S('shoo-sparkle'), { notes, gap: 0.045, pan: 0.1, spread: 0.45 }), { ...fx, part: 'sparkle', peak: -10, hall: 0.4 });
    put(shoo - T.s(0.03), whoosh(S('shoo-whoosh'), { len: 0.4, f0: 500, f1: 2600, panFrom: -0.3, panTo: 0.6, peak: 0.25 }), { ...fx, part: 'whoosh', peak: -16, hall: 0.15 });
  }

  // --- lane: the flats slide away; the gates creak and clang
  put(T.cue('slide'), paperSlide(S('slide'), 0.75), { ...fx, part: 'paper', peak: -15, pan: 0.3, hall: 0.12 });
  put(T.cue('gate-creak'), gateCreak(S('gate-creak'), 1.15), { ...fx, part: 'gate', peak: -11, pan: -0.15, hall: 0.3 });
  // the clang rings until the knock: its fade ends on the hard stop (the effects bus is not cut there)
  put(T.cue('gate-clang'), gateClang(S('gate-clang'), 155.56, (T.hardStop - T.cue('gate-clang')) / SR), { ...fx, part: 'gate', peak: -8, pan: 0.1, hall: 0.4 });

  // --- the door: five knocks in the short room ("shave and a haircut"), then nothing
  for (let k = 1; k <= 5; k++) put(T.cue(`knock-${k}`), knock(S('knock', k)), { ...fx, part: 'knock', peak: k === 5 ? -4 : -5, pan: -0.08, room: KNOCK_ROOM });

  // --- bar 20: the door flap lifts with a long comic creak; slippers
  put(T.cue('door-creak'), doorCreak(S('door-creak'), 1.35), { ...fx, part: 'door', peak: -13, pan: -0.05, room: 0.3, hall: 0.06 });
  for (const [f, pan] of [
    [at(20, 2) + 2, 0.1],
    [at(20, 3), -0.05],
    [at(21) + 2, 0.08],
  ] as const)
    put(F(f), slipper(S('slipper', f)), { ...fx, part: 'slipper', peak: -24, pan, room: 0.25 });

  // --- ta-da and the seal: sparkle, the wax cracks, the letter pops up
  put(T.cue('ta-da'), sparkle(S('ta-da'), { notes: [81, 86, 90, 93, 98], gap: 0.05, pan: 0, spread: 0.35 }), { ...fx, part: 'sparkle', peak: -12, hall: 0.4 });
  put(T.cue('seal-crack'), waxCrack(S('wax')), { ...fx, part: 'wax', peak: -10, pan: -0.05, room: 0.15 });
  put(T.cue('seal-crack') + T.s(0.04), popSnap(S('letter-pop'), 1), { ...fx, part: 'paper', peak: -13, room: 0.1, hall: 0.1 });

  // --- the ding pair: the missing "two bits"; the slats flip with a paper swish
  put(T.cue('ding-1'), ding(85), { ...fx, part: 'ding', peak: -8, hall: 0.18 });
  put(T.cue('ding-2'), ding(86), { ...fx, part: 'ding', peak: -8, hall: 0.18 });
  put(B(25, 3), whoosh(S('slat-swish'), { len: 0.3, f0: 1500, f1: 5000, q: 1.1, panFrom: -0.2, panTo: 0.3, peak: 0.35 }), { ...fx, part: 'paper', peak: -20, hall: 0.1 });

  // --- seal-thunk: the stamp, and every pumpkin in the world gutters out
  put(T.cue('seal-thunk'), stampThunk(S('stamp')), { ...fx, part: 'stamp', peak: -5, room: 0.2 });
  put(T.cue('seal-thunk') + T.s(0.02), fwoomps(S('fwoomp'), 6), { ...fx, part: 'fire', peak: -12, hall: 0.2 });

  // --- appeal-snatch: a bat swoops in from the left, grabs the tab, flaps off to the right
  {
    const grab = T.cue('appeal-snatch');
    const w = wingFlutter(S('snatch-wings'), 1.6, 14);
    put(grab - T.s(0.5), { l: w, r: w.slice() }, { ...fx, part: 'bats', peak: -18, pan: 0.1, hall: 0.15 });
    put(grab, batChirps(S('snatch-chirp'), 3), { ...fx, part: 'bats', peak: -18, pan: 0.15, hall: 0.25 });
    put(grab - T.s(0.35), whoosh(S('snatch-whoosh'), { len: 0.7, f0: 400, f1: 2200, panFrom: -0.8, panTo: 0.8, peak: 0.5 }), { ...fx, part: 'whoosh', peak: -16, hall: 0.15 });
  }

  // --- bars 29-30: the letter folds away; the laptop powers down
  put(F(at(29, 3)), paperSlide(S('fold'), 0.45, 1800), { ...fx, part: 'paper', peak: -24, hall: 0.1 });
  put(F(at(29, 2) + 6), laptopDown(S('laptop'), 1.5), { ...fx, part: 'laptop', peak: -19, pan: 0.25, hall: 0.12 });

  // --- bar 31: the candy, the pail relights
  put(T.cue('candy-drop'), candyPlink(S('candy')), { ...fx, part: 'candy', peak: -12, pan: -0.15, room: 0.2 });
  put(T.cue('pail-relight'), fwip(S('fwip')), { ...fx, part: 'fire', peak: -15, pan: -0.15, hall: 0.1 });

  // --- bar 33: the door flap falls shut; a far window flips cold with its own ding-ding
  put(T.cue('door-close'), doorFlap(S('door-close')), { ...fx, part: 'door', peak: -11, pan: -0.1, room: 0.3 });
  for (const [id, m] of [
    ['far-ding-1', 85],
    ['far-ding-2', 86],
  ] as const) {
    const d = ding(m);
    new Biquad('lowpass', 1900, 0.7).run(d);
    new Biquad('lowpass', 2400, 0.7).run(d);
    put(T.cue(id), d, { ...fx, part: 'ding-far', peak: -20, pan: 0.6, hall: 1.1 });
  }

  // --- bars 34-35: the cover closes over riffling pages and slams; thunder
  put(F(at(34, 2)), riffle(S('close-riffle'), { len: 0.95, count: 44, air: 0.6, pan: 0.1 }), { ...fx, part: 'paper', peak: -12, hall: 0.12 });
  put(T.cue('book-slam'), bookSlam(S('slam')), { ...fx, part: 'slam', peak: -5, room: 0.15, hall: 0.12 });
  // a short clap: its rumble is gone before the end seal, 1.5 s later
  put(T.cue('book-slam') + T.s(0.01), thunder(S('slam-thunder'), { len: 1.3, crack: 1, rumble: 0.9, rolls: 1 }), { ...fx, part: 'thunder', peak: -9, hall: 0.2 });

  // --- bar 36: the 完 seal is stamped on the end card, lighter than the 封号 stamp
  put(T.cue('end-seal'), stampThunk(S('end-seal'), 0.6), { ...fx, part: 'stamp', peak: -12, room: 0.2 });

  // --- bars 36-39: an owl far off
  put(F(at(37, 1) + 4), owl(S('owl')), { ...fx, part: 'owl', peak: -21, pan: 0.55, hall: 0.6 });
}
