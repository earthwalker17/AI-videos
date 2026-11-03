/**
 * The sampler: an SFZ instrument from a pinned library, played note by note. A note picks its
 * region by key and velocity, its round robin (seq_position or lorand/hirand) from
 * rand(seed, instrument, key, start), and resamples the 44.1 kHz recording to 48 kHz with
 * 4-point Hermite interpolation, the rate change folded into the pitch ratio (and any bend).
 * Only the zones a note triggers are read (and so pinned).
 */
import { hash32, rand } from '@aiv/core';
import type { Library, WavData } from '@aiv/pipeline/audio';
import { SR, centsRatio, dbToGain } from './dsp.ts';
import { parseSfz, type SfzRegion } from './sfz.ts';

export interface Stereo {
  l: Float32Array;
  r: Float32Array;
}

export interface NoteOptions {
  /** MIDI key; a fraction detunes */
  key: number;
  /** 1..127 */
  vel: number;
  /** seconds until the release starts; omitted: the sample plays out (one-shot) */
  dur?: number;
  /** release time (s, to -60 dB); default the region's */
  release?: number;
  /** attack (s); default the region's */
  attack?: number;
  /** pitch bend in cents over the note's time (s) */
  bend?: (t: number) => number;
  /** gain over the note's time (s) */
  amp?: (t: number) => number;
  /** start this many seconds into the recording */
  offset?: number;
  /** hard length cap (s), faded over 30 ms */
  maxLen?: number;
  /** the note's start (sample): with the key it seeds the round robin */
  at: number;
}

/** Leading silence is skipped up to the first sample this far under the recording's peak. */
export const ONSET_DB = -40;

/**
 * Where a recording starts sounding: the first frame above ONSET_DB of its peak (over all
 * channels), less half a millisecond. Some VSCO recordings (the harp, a gong) carry 20-60 ms of
 * silence before the attack, which would land those notes late.
 */
export function onsetFrame(w: WavData): number {
  let pk = 0;
  for (const c of w.channels) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  const th = pk * 10 ** (ONSET_DB / 20);
  const n = w.channels[0].length;
  for (let i = 0; i < n; i++) for (const c of w.channels) if (Math.abs(c[i]) > th) return Math.max(0, i - Math.round(0.0005 * w.sampleRate));
  return 0;
}

/** 4-point, 3rd-order Hermite interpolation between x0 and x1 at fraction f. */
export function hermite(xm1: number, x0: number, x1: number, x2: number, f: number): number {
  const c1 = 0.5 * (x1 - xm1);
  const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
  const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * f + c2) * f + c1) * f + x0;
}

/** A fresh per-sample rate function: the bend is evaluated every 32 samples and held. */
function rateFn(ratio0: number, bend?: (t: number) => number): (i: number) => number {
  if (!bend) return () => ratio0;
  let at = -Infinity;
  let r = ratio0;
  return (i: number) => {
    if (i >= at + 32) {
      at = i;
      r = ratio0 * centsRatio(bend(i / SR));
    }
    return r;
  };
}

/**
 * Resample `src` from position `pos0` with a per-sample rate (source samples per output sample)
 * into `n` output samples, with an envelope `env(i)`. Returns how many samples were written
 * (fewer than `n` when the recording ends first).
 */
function play(src: Float32Array, pos0: number, rate: (i: number) => number, n: number, env: (i: number) => number, out: Float32Array, gain: number): number {
  const len = src.length;
  let pos = pos0;
  let i = 0;
  for (; i < n; i++) {
    const ip = Math.floor(pos);
    if (ip + 2 >= len) break;
    const f = pos - ip;
    const xm1 = ip > 0 ? src[ip - 1] : 0;
    out[i] = gain * env(i) * hermite(xm1, src[ip], src[ip + 1], src[ip + 2], f);
    pos += rate(i);
  }
  return i;
}

/**
 * Corrections for an instrument whose recordings do not sound at their mapped keys (measured;
 * see CAL in music.ts): `shift` semitones are added to a note's key before its region is chosen
 * and its ratio computed (VSCO 2 CE maps the glockenspiel and the xylophone an octave under
 * where they sound: shift -12), and `retune` cents are added per recording (by file name).
 */
export interface SamplerFix {
  shift?: number;
  retune?: Readonly<Record<string, number>>;
}

export class Sampler {
  readonly regions: SfzRegion[];
  private readonly cache = new Map<string, { w: WavData; onset: number }>();
  private readonly shift: number;
  private readonly retune: Readonly<Record<string, number>>;

  /**
   * @param name   stable instrument id (seeds the round robins)
   * @param calDb  calibration gain (dB) that brings the instrument to the score's reference level
   */
  constructor(
    private readonly lib: Library,
    sfzPath: string,
    readonly name: string,
    readonly calDb: number,
    private readonly seed: number,
    fix: SamplerFix = {},
  ) {
    this.regions = parseSfz(lib.readText(sfzPath));
    if (!this.regions.length) throw new Error(`${sfzPath}: no regions`);
    this.shift = fix.shift ?? 0;
    this.retune = fix.retune ?? {};
  }

  /** The cents a recording is corrected by (its file name in `retune`, else 0). */
  private cents(sample: string): number {
    return this.retune[sample.slice(sample.lastIndexOf('/') + 1)] ?? 0;
  }

  private wav(path: string): { w: WavData; onset: number } {
    let e = this.cache.get(path);
    if (!e) {
      const w = this.lib.readWav(path);
      e = { w, onset: onsetFrame(w) };
      this.cache.set(path, e);
    }
    return e;
  }

  /** The region a note plays: key and velocity range (nearest key when outside), then the round robin. */
  pick(key: number, vel: number, at: number): SfzRegion {
    const k = Math.round(key);
    const v = Math.round(Math.max(1, Math.min(127, vel)));
    let c = this.regions.filter((r) => k >= r.lokey && k <= r.hikey && v >= r.lovel && v <= r.hivel);
    if (!c.length) {
      const byVel = this.regions.filter((r) => v >= r.lovel && v <= r.hivel);
      const pool = byVel.length ? byVel : this.regions;
      const dist = (r: SfzRegion) => (k < r.lokey ? r.lokey - k : k > r.hikey ? k - r.hikey : 0);
      const best = Math.min(...pool.map(dist));
      c = pool.filter((r) => dist(r) === best);
    }
    const u = rand(this.seed, `${this.name}:rr`, hash32(k, at));
    const seq = c.find((r) => r.seqLength > 1);
    if (seq) {
      const pos = 1 + Math.min(seq.seqLength - 1, Math.floor(u * seq.seqLength));
      const s = c.filter((r) => r.seqPosition === pos);
      if (s.length) c = s;
    }
    const byRand = c.filter((r) => u >= r.lorand && u < r.hirand);
    if (byRand.length) c = byRand;
    return c[0];
  }

  /** Render one note into a fresh stereo clip (the clip starts at the note's onset). */
  note(o: NoteOptions): Stereo {
    const key = o.key + this.shift;
    const reg = this.pick(key, o.vel, o.at);
    const { w, onset } = this.wav(reg.sample);
    const ratio0 = (w.sampleRate / SR) * 2 ** ((key - reg.keycenter + reg.transpose) / 12 + (reg.tune + this.cents(reg.sample)) / 1200);
    const vel = Math.max(1, Math.min(127, o.vel)) / 127;
    const vt = reg.ampVeltrack / 100;
    const gain = dbToGain(this.calDb + reg.volume) * (1 - vt + vt * vel * vel);
    const attack = Math.max(0.0005, o.attack ?? reg.attack);
    const release = Math.max(0.005, o.release ?? reg.release);
    const pos0 = (o.offset ?? 0) * w.sampleRate + reg.offset + onset;
    // how long the recording lasts at this pitch (an upper bound when bent; the clip is trimmed
    // to what was played, so no clip carries trailing zeros)
    const srcLeft = w.channels[0].length - pos0;
    let n = o.bend ? Math.ceil(srcLeft / (ratio0 * 0.5)) : Math.ceil(srcLeft / ratio0) + 4;
    if (o.dur !== undefined) n = Math.min(n, Math.ceil((o.dur + release) * SR));
    if (o.maxLen !== undefined) n = Math.min(n, Math.ceil(o.maxLen * SR));
    n = Math.max(1, n);
    const aN = attack * SR;
    const durN = o.dur !== undefined ? o.dur * SR : Infinity;
    const relK = -3 / (release * SR); // -60 dB over the release, in log10 units
    const capN = o.maxLen !== undefined ? o.maxLen * SR : Infinity;
    const fadeN = 0.03 * SR;
    const amp = o.amp;
    const env = (i: number) => {
      let g = i < aN ? i / aN : 1;
      if (i > durN) g *= 10 ** (relK * (i - durN));
      if (i > capN - fadeN) g *= Math.max(0, (capN - i) / fadeN);
      return amp ? g * amp(i / SR) : g;
    };
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    let m = play(w.channels[0], pos0, rateFn(ratio0, o.bend), n, env, l, gain);
    if (w.channels.length > 1) m = Math.max(m, play(w.channels[1], pos0, rateFn(ratio0, o.bend), n, env, r, gain));
    else r.set(l);
    m = Math.max(1, m);
    return m < n ? { l: l.slice(0, m), r: r.slice(0, m) } : { l, r };
  }

  /** Drop the decoded recordings (call when the part is done). */
  release(): void {
    this.cache.clear();
  }
}

/** A single recording played as a one-shot (gongs, cymbals, drums): no SFZ, no pitch unless asked. */
export class OneShot {
  private w: WavData | null = null;
  constructor(
    private readonly lib: Library,
    private readonly path: string,
    readonly gainDb: number,
  ) {}

  get data(): WavData {
    if (!this.w) this.w = this.lib.readWav(this.path);
    return this.w;
  }

  /** The time (s) of the recording's loudest 50 ms (where a swell lands). */
  peakTime(): number {
    const w = this.data;
    const c = w.channels[0];
    const win = Math.round(0.05 * w.sampleRate);
    let best = 0;
    let at = 0;
    for (let s = 0; s + win <= c.length; s += win) {
      let e = 0;
      for (let i = s; i < s + win; i++) e += c[i] * c[i];
      if (e > best) {
        best = e;
        at = s;
      }
    }
    return at / w.sampleRate;
  }

  /**
   * Play from `offset` s (default: where the recording starts sounding) for at most `maxLen` s,
   * transposed by `semis`, with an optional gain curve. The end (the cap, or the recording's
   * end) is a raised-cosine fade over `fade` s: 50 ms by default, longer for a recording that
   * still rings where it is capped (the gongs).
   */
  play(o: { offset?: number; maxLen?: number; fade?: number; semis?: number; amp?: (t: number) => number; gainDb?: number } = {}): Stereo {
    const w = this.data;
    const ratio = (w.sampleRate / SR) * 2 ** ((o.semis ?? 0) / 12);
    const pos0 = o.offset !== undefined ? o.offset * w.sampleRate : onsetFrame(w);
    let n = Math.max(1, Math.floor((w.channels[0].length - pos0 - 3) / ratio));
    if (o.maxLen !== undefined) n = Math.min(n, Math.ceil(o.maxLen * SR));
    const fadeN = Math.max(1, Math.min(n, Math.round((o.fade ?? 0.05) * SR)));
    const amp = o.amp;
    const env = (i: number) => {
      const g = i > n - fadeN ? 0.5 - 0.5 * Math.cos((Math.PI * (n - i)) / fadeN) : 1;
      return amp ? g * amp(i / SR) : g;
    };
    const g = dbToGain(this.gainDb + (o.gainDb ?? 0));
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    play(w.channels[0], pos0, () => ratio, n, env, l, g);
    if (w.channels.length > 1) play(w.channels[1], pos0, () => ratio, n, env, r, g);
    else r.set(l);
    return { l, r };
  }
}
