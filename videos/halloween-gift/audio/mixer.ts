/**
 * The mixing desk: two dry stereo buses (music, effects), one shared hall send and a short room
 * send. A clip placed on a bus is truncated at that bus's next cut after its onset (a hard stop
 * or the start of a digital silence), faded over the last few milliseconds, so nothing that
 * started before a cut sounds after it. Per-part statistics are kept for the score's report: the
 * sample peak, the RMS over the clips' lengths, and the loudest 400 ms (unweighted, like a
 * momentary meter's window) of any of its clips, the figure the calibration levels by.
 */
import { SR, balanceGains, dbToGain, panGains } from './dsp.ts';
import type { Stereo } from './sampler.ts';

export type BusId = 'music' | 'sfx';

export interface Place {
  /** gain in dB (default 0) */
  db?: number;
  /** -1 left .. +1 right */
  pan?: number;
  /** send levels (linear) to the hall and the room */
  hall?: number;
  room?: number;
  bus?: BusId;
  /** a name for the report */
  part: string;
}

interface Stat {
  peak: number;
  energy: number;
  samples: number;
  clips: number;
  /** the loudest 400 ms window's mean power (both channels averaged) */
  m400: number;
}

/** 100 ms hops; a window is four of them (400 ms) */
const HOP = SR / 10;

const FADE = Math.round(0.008 * SR);

export class Mixer {
  readonly music: Stereo;
  readonly sfx: Stereo;
  readonly hall: Stereo;
  readonly room: Stereo;
  readonly stats = new Map<string, Stat>();

  constructor(
    readonly n: number,
    private readonly cuts: Record<BusId, readonly number[]>,
  ) {
    const bus = (): Stereo => ({ l: new Float32Array(n), r: new Float32Array(n) });
    this.music = bus();
    this.sfx = bus();
    this.hall = bus();
    this.room = bus();
  }

  /** The first cut strictly after `at` on a bus (or the end of the film). */
  cutAfter(bus: BusId, at: number): number {
    for (const c of this.cuts[bus]) if (c > at) return c;
    return this.n;
  }

  /** Place a mono clip (equal-power pan) or a stereo clip (balance) at sample `at`. */
  add(at: number, clip: Float32Array | Stereo, p: Place): void {
    const busId = p.bus ?? 'music';
    const dst = busId === 'music' ? this.music : this.sfx;
    const mono = clip instanceof Float32Array;
    const srcL = mono ? clip : clip.l;
    const srcR = mono ? clip : clip.r;
    const g = dbToGain(p.db ?? 0);
    const [gl, gr] = mono ? panGains(p.pan ?? 0) : balanceGains(p.pan ?? 0);
    const end = this.cutAfter(busId, at);
    const from = Math.max(0, -at);
    const to = Math.min(srcL.length, end - at);
    const cut = at + srcL.length > end;
    const hall = p.hall ?? 0;
    const room = p.room ?? 0;
    let st = this.stats.get(p.part);
    if (!st) this.stats.set(p.part, (st = { peak: 0, energy: 0, samples: 0, clips: 0, m400: 0 }));
    st.clips++;
    const hops = new Float64Array(Math.max(1, Math.ceil((to - from) / HOP)));
    for (let i = from; i < to; i++) {
      let f = 1;
      if (cut && i >= to - FADE) f = (to - i) / FADE;
      const yl = srcL[i] * g * gl * f;
      const yr = srcR[i] * g * gr * f;
      const j = at + i;
      dst.l[j] += yl;
      dst.r[j] += yr;
      if (hall) {
        this.hall.l[j] += yl * hall;
        this.hall.r[j] += yr * hall;
      }
      if (room) {
        this.room.l[j] += yl * room;
        this.room.r[j] += yr * room;
      }
      const a = Math.max(Math.abs(yl), Math.abs(yr));
      if (a > st.peak) st.peak = a;
      const e = yl * yl + yr * yr;
      st.energy += e;
      hops[Math.floor((i - from) / HOP)] += e;
    }
    st.samples += Math.max(0, to - from);
    for (let h = 0; h < hops.length; h++) {
      let w = 0;
      for (let k = h; k < Math.min(hops.length, h + 4); k++) w += hops[k];
      st.m400 = Math.max(st.m400, w / (2 * 4 * HOP));
    }
  }

  /** One line per part: clips, peak, the RMS over its clips' lengths and the loudest 400 ms (dBFS, before the master). */
  report(): string[] {
    const rows = [...this.stats.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return rows.map(([name, s]) => {
      const rms = s.samples ? Math.sqrt(s.energy / (2 * s.samples)) : 0;
      const db = (x: number) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
      return `${name.padEnd(16)} ${String(s.clips).padStart(4)} clips  peak ${db(s.peak).padStart(6)}  rms ${db(rms).padStart(6)}  loudest 400 ms ${db(Math.sqrt(s.m400)).padStart(6)}`;
    });
  }
}
