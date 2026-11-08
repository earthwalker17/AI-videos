/**
 * The mixing desk: named dry buses, named send buses (a reverb, a delay) with their returns,
 * cut-aware clip placement, sidechain ducking and level statistics.
 *
 * A clip placed on a bus is truncated at that bus's next cut after its onset (a hard stop or the
 * start of a digital silence; Timeline.cuts builds the list), or earlier at `until`, and faded
 * over the last few milliseconds, so nothing that started before a cut sounds after it. Its
 * sends are taken from the same truncated clip. A send's return (Return.process) gets the send
 * bus and the send's own cuts, so its tail stops at them too.
 *
 * Statistics, for the score's report: per part (a name the score gives each kind of clip) the
 * sample peak, the RMS over the clips' lengths and the loudest 400 ms (unweighted, like a
 * momentary meter's window) of any one clip; per bus the same three read from the bus itself.
 * The figure calibration levels by is the loudest 400 ms.
 *
 * Generalised from the score of "A Halloween Gift" (videos/halloween-gift/audio/mixer.ts,
 * frozen), whose desk had two fixed buses and two fixed sends. A bus's buffers are allocated on
 * first use: a long film's buses are large (a 3-minute stereo bus is about 70 MB).
 */
import { SR, balanceGains, dbToGain, panGains, type StereoClip } from './dsp.ts';
import { duckGain, type DuckOptions } from './duck.ts';

export interface MixerOptions {
  /** samples in the film (every bus is this long) */
  n: number;
  /** dry buses: name → cut points (samples) */
  buses: Readonly<Record<string, readonly number[]>>;
  /** send buses: name → cut points (samples), given to the send's return */
  sends?: Readonly<Record<string, readonly number[]>>;
  /** the fade at a cut or at `until`, s (default 8 ms) */
  cutFade?: number;
}

export interface Place {
  /** the dry bus */
  bus: string;
  /** a name for the report */
  part: string;
  /** gain in dB (default 0) */
  db?: number;
  /** -1 left .. +1 right: equal-power for a mono clip, balance for a stereo one */
  pan?: number;
  /** send levels (linear), by send name */
  sends?: Readonly<Record<string, number>>;
  /** stop here (samples) if that is before the bus's next cut, with the same fade */
  until?: number;
}

/** A send's return: what it does to the send bus, and how loud it comes back. */
export interface Return {
  /** the wet signal for the send bus (l, r) and the send's cut points, as long as the input */
  process: (l: Float32Array, r: Float32Array, cuts: readonly number[]) => StereoClip;
  /** return level (linear) */
  level: number;
}

export interface Levels {
  /** sample peak, linear */
  peak: number;
  /** RMS (both channels), linear */
  rms: number;
  /** the loudest 400 ms window's RMS (both channels), linear */
  loudest400: number;
}

interface PartStat {
  peak: number;
  energy: number;
  samples: number;
  clips: number;
  /** the loudest 400 ms window's mean power (both channels averaged) */
  m400: number;
}

interface Duck {
  target: string;
  by: string;
  o: DuckOptions;
  /** the most reduction applied, dB (after mixdown) */
  maxDb: number;
}

/** 100 ms hops; a window is four of them (400 ms) */
const HOP = SR / 10;

/** The loudest 400 ms window's mean power of a stereo signal from 100 ms hop energies. */
function loudest(hops: Float64Array): number {
  let m = 0;
  for (let h = 0; h < hops.length; h++) {
    let w = 0;
    for (let k = h; k < Math.min(hops.length, h + 4); k++) w += hops[k];
    m = Math.max(m, w / (2 * 4 * HOP));
  }
  return m;
}

const db = (x: number) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');

export class Mixer {
  readonly n: number;
  readonly stats = new Map<string, PartStat>();
  private readonly cuts = new Map<string, readonly number[]>();
  private readonly sendNames: ReadonlySet<string>;
  private readonly buffers = new Map<string, StereoClip>();
  private readonly ducks: Duck[] = [];
  private readonly fade: number;
  private mixed = false;

  constructor(o: MixerOptions) {
    this.n = o.n;
    this.fade = Math.max(1, Math.round((o.cutFade ?? 0.008) * SR));
    for (const [name, c] of Object.entries(o.buses)) this.cuts.set(name, [...c].sort((a, b) => a - b));
    for (const [name, c] of Object.entries(o.sends ?? {})) {
      if (this.cuts.has(name)) throw new Error(`mixer: '${name}' is both a bus and a send`);
      this.cuts.set(name, [...c].sort((a, b) => a - b));
    }
    this.sendNames = new Set(Object.keys(o.sends ?? {}));
  }

  /** A bus or send's buffers (allocated on first use). */
  bus(name: string): StereoClip {
    if (!this.cuts.has(name)) throw new Error(`mixer: no bus or send '${name}' (have ${[...this.cuts.keys()].join(', ')})`);
    let b = this.buffers.get(name);
    if (!b) this.buffers.set(name, (b = { l: new Float32Array(this.n), r: new Float32Array(this.n) }));
    return b;
  }

  /** The first cut strictly after `at` on a bus or send (or the end of the film). */
  cutAfter(name: string, at: number): number {
    for (const c of this.cuts.get(name) ?? []) if (c > at) return c;
    return this.n;
  }

  /** Place a mono clip (equal-power pan) or a stereo clip (balance) at sample `at` (a whole number). */
  add(at: number, clip: Float32Array | StereoClip, p: Place): void {
    // a fractional index into a typed array is a silent no-op: the clip would vanish
    if (!Number.isInteger(at)) throw new Error(`mixer: clip '${p.part}' placed at ${at}: expected a whole sample (Timeline.s, frame and beat give one)`);
    if (this.sendNames.has(p.bus)) throw new Error(`mixer: '${p.bus}' is a send; place clips on a bus and send to it`);
    const dst = this.bus(p.bus);
    const sends = Object.entries(p.sends ?? {})
      .filter(([, level]) => level !== 0)
      .map(([name, level]) => {
        if (!this.sendNames.has(name)) throw new Error(`mixer: no send '${name}'`);
        return { buf: this.bus(name), level };
      });
    const mono = clip instanceof Float32Array;
    const srcL = mono ? clip : clip.l;
    const srcR = mono ? clip : clip.r;
    const g = dbToGain(p.db ?? 0);
    const [gl, gr] = mono ? panGains(p.pan ?? 0) : balanceGains(p.pan ?? 0);
    const end = Math.min(this.cutAfter(p.bus, at), p.until ?? Infinity);
    const from = Math.max(0, -at);
    const to = Math.min(srcL.length, end - at);
    const cut = at + srcL.length > end;
    let st = this.stats.get(p.part);
    if (!st) this.stats.set(p.part, (st = { peak: 0, energy: 0, samples: 0, clips: 0, m400: 0 }));
    st.clips++;
    const hops = new Float64Array(Math.max(1, Math.ceil((to - from) / HOP)));
    for (let i = from; i < to; i++) {
      let f = 1;
      if (cut && i >= to - this.fade) f = (to - i) / this.fade;
      const yl = srcL[i] * g * gl * f;
      const yr = srcR[i] * g * gr * f;
      const j = at + i;
      dst.l[j] += yl;
      dst.r[j] += yr;
      for (const s of sends) {
        s.buf.l[j] += yl * s.level;
        s.buf.r[j] += yr * s.level;
      }
      const a = Math.max(Math.abs(yl), Math.abs(yr));
      if (a > st.peak) st.peak = a;
      const e = yl * yl + yr * yr;
      st.energy += e;
      hops[Math.floor((i - from) / HOP)] += e;
    }
    st.samples += Math.max(0, to - from);
    st.m400 = Math.max(st.m400, loudest(hops));
  }

  /**
   * Duck `target` (a bus or a send) under `by` (a bus or a send, the sidechain) when the mix is
   * summed. Ducks apply in the order they were added, each reading its sidechain as it is then.
   * A clip's sends were taken when it was placed, so ducking a bus leaves what it sent to a
   * reverb or a delay untouched: duck that send as well to duck its return.
   */
  duck(target: string, by: string, o: DuckOptions): void {
    this.bus(target);
    this.bus(by);
    if (target === by) throw new Error(`mixer: '${target}' cannot duck under itself`);
    this.ducks.push({ target, by, o, maxDb: 0 });
  }

  /**
   * Sum the mix: apply the ducks, add every dry bus, then every send's return. Every send that
   * received a clip needs a return. Float64, ready for the master.
   */
  mixdown(returns: Readonly<Record<string, Return>> = {}): { l: Float64Array; r: Float64Array } {
    if (this.mixed) throw new Error('mixer: mixdown runs once (it ducks the buses in place)');
    this.mixed = true;
    for (const name of Object.keys(returns)) if (!this.sendNames.has(name)) throw new Error(`mixer: a return for '${name}', which is not a send`);
    for (const d of this.ducks) {
      const g = duckGain(this.bus(d.by), d.o);
      const t = this.bus(d.target);
      let min = 1;
      for (let i = 0; i < this.n; i++) {
        t.l[i] *= g[i];
        t.r[i] *= g[i];
        if (g[i] < min) min = g[i];
      }
      d.maxDb = -20 * Math.log10(min);
    }
    const L = new Float64Array(this.n);
    const R = new Float64Array(this.n);
    // in name order, so the sum does not depend on which bus happened to be used first
    const used = [...this.buffers].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const [name, b] of used) {
      if (this.sendNames.has(name)) continue;
      for (let i = 0; i < this.n; i++) {
        L[i] += b.l[i];
        R[i] += b.r[i];
      }
    }
    for (const [name, b] of used.filter(([k]) => this.sendNames.has(k))) {
      const ret = returns[name];
      if (!ret) throw new Error(`mixer: send '${name}' has clips but no return`);
      const wet = ret.process(b.l, b.r, this.cuts.get(name) ?? []);
      if (wet.l.length !== this.n || wet.r.length !== this.n) throw new Error(`mixer: the return of '${name}' is not ${this.n} samples long`);
      for (let i = 0; i < this.n; i++) {
        L[i] += ret.level * wet.l[i];
        R[i] += ret.level * wet.r[i];
      }
    }
    return { l: L, r: R };
  }

  /** A bus's or send's levels as it is now (after mixdown: ducked); silence if nothing was placed on it. */
  levels(name: string): Levels {
    // an unknown name throws (bus() names the ones there are)
    if (!this.cuts.has(name)) this.bus(name);
    const b = this.buffers.get(name);
    // nothing placed on it: silence, without allocating its buffers
    if (!b) return { peak: 0, rms: 0, loudest400: 0 };
    const hops = new Float64Array(Math.max(1, Math.ceil(this.n / HOP)));
    let peak = 0;
    let energy = 0;
    for (let i = 0; i < this.n; i++) {
      const a = Math.max(Math.abs(b.l[i]), Math.abs(b.r[i]));
      if (a > peak) peak = a;
      const e = b.l[i] * b.l[i] + b.r[i] * b.r[i];
      energy += e;
      hops[Math.floor(i / HOP)] += e;
    }
    return { peak, rms: this.n ? Math.sqrt(energy / (2 * this.n)) : 0, loudest400: Math.sqrt(loudest(hops)) };
  }

  /** The most gain reduction each duck applied, dB (0 before mixdown). */
  duckReport(): { target: string; by: string; maxDb: number }[] {
    return this.ducks.map((d) => ({ target: d.target, by: d.by, maxDb: d.maxDb }));
  }

  /**
   * One line per bus and send that was used, per duck, and per part: clips, peak, the RMS over
   * its clips' lengths and the loudest 400 ms (dBFS, before the master).
   */
  report(): string[] {
    const buses = [...this.buffers.keys()].sort().map((name) => {
      const v = this.levels(name);
      const kind = this.sendNames.has(name) ? 'send' : 'bus';
      return `${kind} ${name.padEnd(12)} peak ${db(v.peak).padStart(6)}  rms ${db(v.rms).padStart(6)}  loudest 400 ms ${db(v.loudest400).padStart(6)}`;
    });
    const ducks = this.ducks.map((d) => `duck ${d.target} under ${d.by}: up to ${d.maxDb.toFixed(1)} dB`);
    const parts = [...this.stats.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([name, s]) => {
        const rms = s.samples ? Math.sqrt(s.energy / (2 * s.samples)) : 0;
        return `part ${name.padEnd(16)} ${String(s.clips).padStart(4)} clips  peak ${db(s.peak).padStart(6)}  rms ${db(rms).padStart(6)}  loudest 400 ms ${db(Math.sqrt(s.m400)).padStart(6)}`;
      });
    return [...buses, ...ducks, ...parts];
  }
}
