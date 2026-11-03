/**
 * Motion QA: what a review of stills cannot see. The last film's walk had a 12 Hz judder (the
 * actors moved on twos under a camera moving on ones) that every reviewer missed, because reviews
 * look at frames one at a time. This measures the picture over time instead.
 *
 * One decode of the picture (the lossless mezzanine when it matches the delivery, else the
 * delivery) at a fixed analysis size (480 px wide, gray, area-averaged), streamed into
 * MotionMeter, which keeps one previous frame. Per frame: the mean luma Y, the mean absolute
 * difference to the previous frame D (whole picture and a 4x3 grid of tiles: judder often shows
 * only where the subject moves), the same difference after a 3x3 blur was taken away (H: the
 * fine detail that changes, boil and grain) and that of 4x4 block means (DC, picture and tiles:
 * what survives averaging, so motion rather than grain). A fixed analysis size keeps the
 * thresholds the same for a draft and a full-size render. All values are 8-bit code values (0-255).
 *
 * The analysis (pure, pinned by tests):
 *  - cadence: in sliding 12-frame windows that move (median D above a floor), the alternation
 *    index A = mean |D[i] - D[i+1]| / mean D, the parity ratio R = median D on even frames /
 *    median D on odd frames (or its inverse, whichever is above 1) and the consistency C (the
 *    share of frames that are a local peak or trough as their parity says). Motion on ones gives
 *    an even D; anything on twos under a picture on ones makes D alternate high/low every other
 *    frame. A window is flagged when R, A and C are all high, in the whole picture or in any tile;
 *    a flagged span is 'judder' when something else moves on the in-between frames, 'twos' when
 *    the whole picture holds there. A lossy delivery (measured when the mezzanine is gone or does
 *    not match) needs stronger evidence, because its encoder makes D alternate on its own (see
 *    lossyEvidence);
 *  - flashes: a jump of the mean luma that is not within ±2 frames of a cue sheet `hit`;
 *  - pops: a one- or two-frame spike of D over its neighbours, not on a `hit` or `cut`;
 *  - boil (information): the level of H on spans where the picture's edge tiles are still.
 * The checks are INFORMATION ONLY in this first version (like the audio prominence note in
 * docs/ROADMAP.md): they say where to look (the watch list, motion.png, one frame strip per
 * flagged span) and never fail QA.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QaCheck } from '@aiv/core';
import { ffmpeg, ffmpegBin } from '../media/bin.ts';
import { filterValue } from '../media/escape.ts';
import type { Log } from '../util/log.ts';
import { killTree, spawnTool } from '../util/proc.ts';
import type { DeliveryCue } from './audio.ts';
import { check } from './check.ts';
import { toRgbFilter } from './frames.ts';

/** the analysis picture's width (its height follows the aspect, even) */
export const MOTION_WIDTH = 480;
/** the tile grid */
export const GRID_COLS = 4;
export const GRID_ROWS = 3;

/** What MotionMeter measured, one value per frame (index 0: the first frame; its differences are 0). */
export interface MotionSeries {
  fps: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** mean luma */
  y: number[];
  /** mean |F[i] - F[i-1]| of the whole picture */
  d: number[];
  /** the same per tile, row-major (tiles[r * cols + c][i]) */
  tiles: number[][];
  /** mean |H[i] - H[i-1]|, H = F minus its 3x3 box blur: fine detail that changes */
  hf: number[];
  /**
   * mean |B[i] - B[i-1]|, B = the means of 4x4 blocks: the change that survives averaging. Grain
   * (independent per pixel) averages out to about a quarter; anything that moves keeps most of it
   */
  dc: number[];
  /** the same per tile (the 4x4 blocks whose centre lies in it), row-major like `tiles` */
  tilesDc: number[][];
}

/** The analysis size of a picture: MOTION_WIDTH wide (never wider than the source), even height. */
export function analysisSize(width: number, height: number): { width: number; height: number } {
  const w = Math.min(MOTION_WIDTH, width - (width % 2));
  return { width: w, height: Math.max(2, Math.round((w * height) / width / 2) * 2) };
}

/**
 * Streams gray frames (width × height bytes each) into the per-frame measures. Keeps one previous
 * frame and its high-pass, so memory does not grow with the film.
 */
export class MotionMeter {
  readonly y: number[] = [];
  readonly d: number[] = [];
  readonly hf: number[] = [];
  readonly dc: number[] = [];
  readonly tiles: number[][];
  readonly tilesDc: number[][];
  private prev: Uint8Array | null = null;
  private prevHp: Int16Array | null = null;
  private readonly tileOf: Uint8Array;
  private readonly tileArea: number[];
  private readonly rowSum: Uint16Array;
  private readonly hp: Int16Array;
  private readonly bw: number;
  private readonly bh: number;
  private readonly block: Uint16Array;
  private prevBlock: Uint16Array | null = null;
  private readonly blockTile: Uint8Array;
  private readonly blockCount: number[];

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cols = GRID_COLS,
    readonly rows = GRID_ROWS,
  ) {
    this.tiles = Array.from({ length: cols * rows }, () => []);
    this.tileOf = new Uint8Array(width * height);
    this.tileArea = new Array<number>(cols * rows).fill(0);
    for (let yy = 0; yy < height; yy++) {
      const r = Math.min(rows - 1, Math.floor((yy * rows) / height));
      for (let x = 0; x < width; x++) {
        const t = r * cols + Math.min(cols - 1, Math.floor((x * cols) / width));
        this.tileOf[yy * width + x] = t;
        this.tileArea[t]++;
      }
    }
    this.rowSum = new Uint16Array(width * height);
    this.hp = new Int16Array(width * height);
    this.bw = Math.max(1, width >> 2);
    this.bh = Math.max(1, height >> 2);
    this.block = new Uint16Array(this.bw * this.bh);
    // each 4x4 block belongs to the tile of its centre pixel
    this.tilesDc = Array.from({ length: cols * rows }, () => []);
    this.blockTile = new Uint8Array(this.bw * this.bh);
    this.blockCount = new Array<number>(cols * rows).fill(0);
    for (let by = 0; by < this.bh; by++)
      for (let bx = 0; bx < this.bw; bx++) {
        const t = this.tileOf[Math.min(height - 1, by * 4 + 2) * width + Math.min(width - 1, bx * 4 + 2)];
        this.blockTile[by * this.bw + bx] = t;
        this.blockCount[t]++;
      }
  }

  get frames(): number {
    return this.y.length;
  }

  /** One frame, gray, row-major. */
  push(f: Uint8Array): void {
    const { width: w, height: h } = this;
    const n = w * h;
    if (f.length !== n) throw new Error(`motion: a frame of ${f.length} bytes, expected ${n}`);
    let sumY = 0;
    for (let i = 0; i < n; i++) sumY += f[i];
    // the high-pass: 9·F minus the 3x3 box sum (edges clamped), in ninths of a code value
    const rs = this.rowSum;
    for (let yy = 0; yy < h; yy++) {
      const o = yy * w;
      for (let x = 0; x < w; x++) rs[o + x] = f[o + Math.max(0, x - 1)] + f[o + x] + f[o + Math.min(w - 1, x + 1)];
    }
    const hp = this.hp;
    for (let yy = 0; yy < h; yy++) {
      const up = Math.max(0, yy - 1) * w;
      const o = yy * w;
      const dn = Math.min(h - 1, yy + 1) * w;
      for (let x = 0; x < w; x++) hp[o + x] = 9 * f[o + x] - rs[up + x] - rs[o + x] - rs[dn + x];
    }
    // 4x4 block sums (a partial block at the right or bottom edge is left out)
    const bl = this.block;
    bl.fill(0);
    for (let yy = 0; yy < this.bh * 4 && yy < h; yy++) {
      const o = yy * w;
      const bo = (yy >> 2) * this.bw;
      for (let x = 0; x < this.bw * 4 && x < w; x++) bl[bo + (x >> 2)] += f[o + x];
    }
    this.y.push(sumY / n);
    const prev = this.prev;
    const prevHp = this.prevHp;
    if (!prev || !prevHp || !this.prevBlock) {
      this.d.push(0);
      this.hf.push(0);
      this.dc.push(0);
      this.prevBlock = Uint16Array.from(bl);
      for (const t of this.tiles) t.push(0);
      for (const t of this.tilesDc) t.push(0);
      this.prev = Uint8Array.from(f);
      this.prevHp = Int16Array.from(hp);
      return;
    }
    const tileSum = new Array<number>(this.tiles.length).fill(0);
    let sumD = 0;
    let sumH = 0;
    for (let i = 0; i < n; i++) {
      const dd = Math.abs(f[i] - prev[i]);
      sumD += dd;
      tileSum[this.tileOf[i]] += dd;
      sumH += Math.abs(hp[i] - prevHp[i]);
    }
    this.d.push(sumD / n);
    this.hf.push(sumH / 9 / n);
    let sumB = 0;
    const tileB = new Array<number>(this.tilesDc.length).fill(0);
    for (let k = 0; k < bl.length; k++) {
      const db = Math.abs(bl[k] - this.prevBlock[k]);
      sumB += db;
      tileB[this.blockTile[k]] += db;
    }
    this.dc.push(sumB / 16 / bl.length);
    // a tile without a whole block (a tiny picture) has no coarse difference
    tileB.forEach((s, t) => this.tilesDc[t].push(this.blockCount[t] ? s / 16 / this.blockCount[t] : 0));
    this.prevBlock.set(bl);
    tileSum.forEach((s, t) => this.tiles[t].push(s / this.tileArea[t]));
    prev.set(f);
    prevHp.set(hp);
  }

  series(fps: number): MotionSeries {
    return { fps, width: this.width, height: this.height, cols: this.cols, rows: this.rows, y: this.y, d: this.d, tiles: this.tiles, hf: this.hf, dc: this.dc, tilesDc: this.tilesDc };
  }
}

/**
 * Decodes `file` once at the analysis size, gray (through full-range RGB: YUV files with their
 * tagged matrix and range, like the frame hashes, so a mezzanine and its delivery read alike) and
 * measures every frame as it arrives.
 */
export async function measureMotion(file: string, o: { width: number; height: number; fps: number; timeoutMs?: number }): Promise<MotionSeries> {
  const size = analysisSize(o.width, o.height);
  const meter = new MotionMeter(size.width, size.height);
  const vf = `${await toRgbFilter(file, 'rgb24')},scale=${size.width}:${size.height}:flags=area,format=gray`;
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', vf, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'];
  const frameBytes = size.width * size.height;
  const proc = spawnTool(ffmpegBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  let failure: Error | null = null;
  const buf = new Uint8Array(frameBytes);
  let fill = 0;
  proc.stdout!.on('data', (chunk: Buffer) => {
    let at = 0;
    while (at < chunk.length && !failure) {
      const take = Math.min(frameBytes - fill, chunk.length - at);
      buf.set(chunk.subarray(at, at + take), fill);
      fill += take;
      at += take;
      if (fill === frameBytes) {
        try {
          meter.push(buf);
        } catch (e) {
          failure = e as Error;
          killTree(proc.pid);
        }
        fill = 0;
      }
    }
  });
  proc.stderr!.on('data', (c: Buffer) => {
    err = (err + c.toString('utf8')).slice(-8192);
  });
  const timer = setTimeout(() => killTree(proc.pid), o.timeoutMs ?? 60 * 60_000);
  const code = await new Promise<number>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (c, signal) => resolve(c ?? (signal ? 1 : 0)));
  }).finally(() => clearTimeout(timer));
  if (failure) throw failure;
  if (code !== 0) throw new Error(`motion decode failed (exit ${code}): ${err.trim().split('\n').slice(-2).join(' ')}`);
  if (fill !== 0) throw new Error(`motion decode ended inside a frame (${fill} of ${frameBytes} bytes)`);
  return meter.series(o.fps);
}

// --- analysis (pure) ---------------------------------------------------------------------------

/** The thresholds, in code values of the analysis picture (see MOTION_THRESHOLDS for how each was chosen). */
export interface MotionThresholds {
  /** frames per cadence window */
  window: number;
  /** a window moves when its median D is at least this (grain alone stays under it) */
  motionFloor: number;
  /**
   * frames hold (only grain or compression noise changed) when their coarse difference DC is
   * under holdAbs, or under holdRatio × their D: grain averages out of the 4x4 blocks, motion does not
   */
  holdAbs: number;
  holdRatio: number;
  /** flagged: parity ratio R at least this … */
  parity: number;
  /** … and alternation index A at least this … */
  alternation: number;
  /** … and consistency C at least this */
  consistency: number;
  /** flash: |Y[i] - Y[i-1]| at least this … */
  flashAbs: number;
  /** … and at least this fraction of the darker of the two frames' luma */
  flashRel: number;
  /** flashes this close together are one event (a flicker) */
  flashGroup: number;
  /** a flash or pop this close to a hit (or a pop to a cut) is intended */
  cueSlack: number;
  /** pop: D[i] at least popK × the median D of its neighbours … */
  popK: number;
  /** … and at least popMin above it */
  popMin: number;
  /** boil: the edge tiles' mean D under which the camera counts as still */
  stillEdge: number;
  /** boil: shortest still span reported, frames */
  stillMin: number;
  /** lossy source: a flagged window counts only in a run of at least this many consecutive flagged windows of its source */
  lossyRun: number;
}

/**
 * Calibrated on 2026-11-04 against the V1 draft of *A Halloween Gift* (960x540, 24 fps, 1452
 * frames; its mezzanine and its H.264 delivery: actors on twos, camera, fog and light on ones, a
 * per-frame grain) and the Remotion template's draft (30 fps, everything on ones, no grain):
 *  - window 12: half a second at 24 fps, six steps of a twos cadence;
 *  - motionFloor 1.5: a held frame's grain is D 0.25-0.6 (mezzanine) or 0.1-0.8 (delivery); the
 *    walk's in-between frames move at D ≈ 6;
 *  - parity 1.2 and alternation 0.15: the walk's tiles alternate at R 1.25-1.45 (the whole
 *    picture at about 1.1), a pure alternation of R 1.2 has A = 2(R-1)/(R+1) = 0.18; the template's
 *    camera move and instanced bars on ones stay under R 1.1 and C 0.75 (no window flagged even at
 *    R 1.1, A 0.1, floor 1.0);
 *  - consistency 0.75: twos give C = 1; the template's bars, which rise and fall in uneven pairs,
 *    reached R 2 and A 0.6 by chance, at C about 1/3;
 *  - holdAbs 0.75, holdRatio 0.65: DC/D of held frames 0.32-0.48 (mezzanine), up to 0.77 with DC
 *    at most 0.56 (delivery: the encode correlates the grain); 0.8-0.96 wherever anything moved,
 *    also for a synthetic pan of a sharp test pattern (where H moves as much as D);
 *  - flashAbs 12, flashRel 0.25: the lightning (+92) and the book slam (+24) on their hits, the
 *    ghost leaving the frame in one frame (-15 at 48.9 s, on no hit); the next largest jumps
 *    (10-11: the cover burst, the door creak, the pull-back at 43 s) stay under it;
 *  - popK 3, popMin 4, judged against same-parity neighbours and with bursts of three frames or
 *    more left out: the film start, the door cut and the knocks on their cues, nothing else; the
 *    template's light pulse (a five-frame bump) is no pop;
 *  - stillEdge 1.2: edge tiles hold at D 0.1-0.9 on a still camera with grain;
 *  - lossyRun 3 (lossy sources only, with lossyEvidence), measured 2026-11-04 on this host's
 *    ffmpeg: 110 lossy encodings of a test pattern panned on ones (an even 2-12 px a frame, still
 *    or animated, temporal grain 2-12, 640x360, 144 frames; h264_qsv -global_quality 23 (the draft
 *    preset) and 30, libx264 crf 23, 28, 30 -bf 1 and 32 -bf 1), whose lossless sources flag
 *    nothing, made 45 false spans in 34 files with the plain rule, nearly all in single tiles and
 *    single windows; with lossyEvidence 3 were left, their longest runs 1, 1 and 2. Every span
 *    of the V1 delivery keeps a run of 6 or more.
 * The judder of the graveyard walk (video seconds 13-18) is one judder span, 11.2-19.4 s on the
 * mezzanine (and 11.2-16.0 plus 16.6-19.4 s on the delivery).
 */
export const MOTION_THRESHOLDS: MotionThresholds = {
  window: 12,
  motionFloor: 1.5,
  holdAbs: 0.75,
  holdRatio: 0.65,
  parity: 1.2,
  alternation: 0.15,
  consistency: 0.75,
  flashAbs: 12,
  flashRel: 0.25,
  flashGroup: 6,
  cueSlack: 2,
  popK: 3,
  popMin: 4,
  stillEdge: 1.2,
  stillMin: 24,
  lossyRun: 3,
};

/** One cadence window over D[start, start + n). */
export interface CadenceWindow {
  start: number;
  /** mean D */
  mean: number;
  /** median D: whether the window moves (a cut or a pop inside it does not make it move) */
  med: number;
  /** alternation index: mean |D[i] - D[i+1]| / mean D */
  a: number;
  /** parity ratio: median D of the even frames over that of the odd ones, or its inverse (≥ 1) */
  r: number;
  /** whether the even frames are the high ones */
  evenHigh: boolean;
  /**
   * consistency: the share of the window's inner frames that are a local maximum (high parity)
   * or minimum (low parity) as the parity says. Steps on twos give 1; a fluctuation that happens
   * to pair up gives about 1/3 (a random sequence's chance of a turning point at a given parity)
   */
  c: number;
}

// a held frame without grain has D = 0: the parity ratio's floor, so R stays finite
const R_FLOOR = 0.05;

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The cadence windows of a D series: every start from `from` (D[0] has no previous frame). The
 * parity ratio uses medians, so one spike (a pop) in a window does not pass for a cadence.
 */
export function cadenceWindows(d: readonly number[], n: number, from = 1): CadenceWindow[] {
  const out: CadenceWindow[] = [];
  for (let s = Math.max(1, from); s + n <= d.length; s++) {
    const w = d.slice(s, s + n);
    const m = mean(w);
    let steps = 0;
    for (let k = 0; k + 1 < n; k++) steps += Math.abs(w[k + 1] - w[k]);
    const even = median(w.filter((_, k) => (s + k) % 2 === 0));
    const odd = median(w.filter((_, k) => (s + k) % 2 === 1));
    const evenHigh = even >= odd;
    let agree = 0;
    for (let k = 1; k + 1 < n; k++) {
      const high = ((s + k) % 2 === 0) === evenHigh;
      if (high ? w[k] > w[k - 1] && w[k] > w[k + 1] : w[k] < w[k - 1] && w[k] < w[k + 1]) agree++;
    }
    out.push({
      start: s,
      mean: m,
      med: median(w),
      a: m > 0 ? steps / (n - 1) / m : 0,
      r: Math.max(even, odd, R_FLOOR) / Math.max(Math.min(even, odd), R_FLOOR),
      evenHigh,
      c: n > 2 ? agree / (n - 2) : 0,
    });
  }
  return out;
}

/** A [start, end) span of frames. */
export type FrameSpan = readonly [number, number];

/**
 * What alternates. 'judder': a part of the picture steps on twos while the rest still moves on
 * the frames in between (the walk: actors on twos under a camera on ones). 'twos': the whole
 * picture holds every other frame (only grain changes then), a 12 fps step at 24 fps: a style
 * when meant, a stutter when not.
 */
export type CadenceKind = 'judder' | 'twos';

/** Where the picture alternates: one span of overlapping flagged windows of one kind. */
export interface CadenceSpan {
  kind: CadenceKind;
  start: number;
  end: number;
  /** where it was seen: 'picture' and/or tiles 'r<row>c<col>' (row 0 at the top) */
  sources: string[];
  /** the strongest window: its start, R and A, and where */
  peak: { start: number; r: number; a: number; source: string };
  /** the window a strip shows: the middle of the longest unbroken run of flagged windows (the steadiest part, where the peak may be a moment) */
  steady: number;
}

export const tileName = (t: number, cols: number): string => `r${Math.floor(t / cols)}c${t % cols}`;

/**
 * Whether a flagged window of a LOSSY source shows what a real cadence leaves. An encoder makes
 * D alternate on its own (its frame types quantise a panned picture and its grain differently
 * every other frame), and on the lossy encodings of a pan on ones (see lossyRun) the false
 * windows were of two kinds: a level step inside the window (a part entering or leaving a tile),
 * where each parity's median of six falls on another side of the step while the encoder's small
 * rhythm supplies the consistency; and an alternation of the grain alone in a flat tile. So the
 * window must keep its parity in both of its halves (a step leaves one half even), and its high
 * frames must move coarsely in the source's own DC (at least holdAbs and holdRatio × their D,
 * as motion does and grain does not).
 */
export function lossyEvidence(w: CadenceWindow, src: { d: readonly number[]; dc: readonly number[] }, halves: ReadonlyMap<number, CadenceWindow>, th: MotionThresholds = MOTION_THRESHOLDS): boolean {
  const half = th.window >> 1;
  const both = [halves.get(w.start), halves.get(w.start + th.window - half)].every((h) => h !== undefined && h.r >= th.parity && h.evenHigh === w.evenHigh);
  if (!both) return false;
  const high = Array.from({ length: th.window }, (_, k) => w.start + k).filter((i) => (i % 2 === 0) === w.evenHigh);
  const dc = median(high.map((i) => src.dc[i] ?? 0));
  return dc >= th.holdAbs && dc >= th.holdRatio * median(high.map((i) => src.d[i]));
}

/** The windows (in start order) that lie in a run of at least `n` consecutive starts. */
function inRuns<T extends { start: number }>(xs: readonly T[], n: number): T[] {
  const out: T[] = [];
  let run: T[] = [];
  const flush = () => {
    if (run.length >= n) out.push(...run);
  };
  for (const x of xs) {
    if (run.length && x.start !== run.at(-1)!.start + 1) {
      flush();
      run = [];
    }
    run.push(x);
  }
  flush();
  return out;
}

/**
 * The cadence spans of a series: windows that move, alternate (A) and keep a parity (R), in the
 * whole picture or in any tile, joined while they are of one kind and less than a window apart
 * (a shot that judders does not stop judging for half a second). The kind comes from the frames
 * on which the alternating part holds: when the whole picture's coarse difference DC there stays
 * under holdAbs or under holdRatio × its D (a held frame still changes by its grain, which the
 * 4x4 blocks average out; measured on the V1 draft: DC/D 0.32-0.48 on held frames of the
 * mezzanine, up to 0.77 but DC ≤ 0.56 on those of its H.264 delivery, 0.8-0.96 where anything
 * moves), everything held: 'twos'; otherwise something else moved: 'judder'. `exclude`: spans
 * (cuts, flashes, pops) whose windows are not judged, as they alternate for reasons of their own.
 * `lossy`: the series is of a lossy file (the delivery): a window also needs lossyEvidence, and
 * counts only in a run of at least lossyRun consecutive flagged windows of its source (a cadence
 * held for 14 frames, not one window that happened to pair up).
 */
export function cadenceSpans(s: Pick<MotionSeries, 'd' | 'tiles' | 'cols' | 'dc' | 'tilesDc'>, th: MotionThresholds = MOTION_THRESHOLDS, exclude: readonly FrameSpan[] = [], o: { lossy?: boolean } = {}): CadenceSpan[] {
  const sources: { name: string; d: readonly number[]; dc: readonly number[] }[] = [{ name: 'picture', d: s.d, dc: s.dc }, ...s.tiles.map((d, t) => ({ name: tileName(t, s.cols), d, dc: s.tilesDc[t] }))];
  type Hit = { kind: CadenceKind; start: number; end: number; r: number; a: number; source: string };
  const hits: Hit[] = [];
  for (const src of sources) {
    const halves = o.lossy ? new Map(cadenceWindows(src.d, th.window >> 1).map((h) => [h.start, h])) : null;
    const own: Hit[] = [];
    for (const w of cadenceWindows(src.d, th.window)) {
      const end = w.start + th.window;
      if (w.med < th.motionFloor || w.r < th.parity || w.a < th.alternation || w.c < th.consistency) continue;
      if (exclude.some(([a, b]) => w.start < b && a < end)) continue;
      if (halves && !lossyEvidence(w, src, halves, th)) continue;
      // the frames on which the alternating part holds
      const low = Array.from({ length: th.window }, (_, k) => w.start + k).filter((i) => (i % 2 === 0) !== w.evenHigh);
      const dc = median(low.map((i) => s.dc[i]));
      const moved = dc >= th.holdAbs && dc >= th.holdRatio * median(low.map((i) => s.d[i]));
      own.push({ kind: moved ? 'judder' : 'twos', start: w.start, end, r: w.r, a: w.a, source: src.name });
    }
    hits.push(...(o.lossy ? inRuns(own, th.lossyRun) : own));
  }
  hits.sort((x, y) => x.start - y.start);
  const out: { span: CadenceSpan; starts: Set<number> }[] = [];
  const open: Partial<Record<CadenceKind, { span: CadenceSpan; starts: Set<number> }>> = {};
  for (const h of hits) {
    const last = open[h.kind];
    if (last && h.start <= last.span.end + th.window) {
      const s = last.span;
      s.end = Math.max(s.end, h.end);
      if (!s.sources.includes(h.source)) s.sources.push(h.source);
      if (h.r > s.peak.r) s.peak = { start: h.start, r: h.r, a: h.a, source: h.source };
      last.starts.add(h.start);
    } else {
      const span: CadenceSpan = { kind: h.kind, start: h.start, end: h.end, sources: [h.source], peak: { start: h.start, r: h.r, a: h.a, source: h.source }, steady: h.start };
      open[h.kind] = { span, starts: new Set([h.start]) };
      out.push(open[h.kind]!);
    }
  }
  for (const { span, starts } of out) {
    const sorted = [...starts].sort((a, b) => a - b);
    let best: [number, number] = [sorted[0], sorted[0]];
    let run: [number, number] = [sorted[0], sorted[0]];
    for (const st of sorted.slice(1)) {
      run = st === run[1] + 1 ? [run[0], st] : [st, st];
      if (run[1] - run[0] > best[1] - best[0]) best = run;
    }
    span.steady = Math.round((best[0] + best[1]) / 2);
  }
  return out.map((o) => o.span).sort((x, y) => x.start - y.start);
}

/** A flash or a pop: frames [frame, end), and the cue it belongs to when it is intended. */
export interface MotionEvent {
  frame: number;
  end: number;
  /** flash: the largest |ΔY| in it; pop: the largest D over its neighbours' median */
  size: number;
  /** the hit (or, for a pop, the cut) within cueSlack frames of its first frame */
  cue?: string;
}

/** The cue points a motion event may sit on: id and delivery frame. */
export interface MotionCue {
  id: string;
  frame: number;
}

const nearCue = (frame: number, cues: readonly MotionCue[], slack: number): string | undefined => cues.find((c) => Math.abs(c.frame - frame) <= slack)?.id;

/** Frames closer than `gap` joined into [first, last + 1) groups. */
function group(frames: readonly number[], gap: number): FrameSpan[] {
  const out: [number, number][] = [];
  for (const f of frames) {
    const last = out.at(-1);
    if (last && f - (last[1] - 1) <= gap) last[1] = f + 1;
    else out.push([f, f + 1]);
  }
  return out;
}

/**
 * Flashes: frames whose mean luma jumps by at least flashAbs and flashRel of the darker frame,
 * except on a cut. Jumps less than flashGroup frames apart are one flash (a flicker); it is
 * intended (`cue`) when its first frame lies within cueSlack frames of a hit.
 */
export function flashEvents(y: readonly number[], o: { hits: readonly MotionCue[]; cuts: readonly number[] }, th: MotionThresholds = MOTION_THRESHOLDS): MotionEvent[] {
  const jumps: number[] = [];
  for (let i = 1; i < y.length; i++) {
    const dy = Math.abs(y[i] - y[i - 1]);
    if (dy >= th.flashAbs && dy >= th.flashRel * Math.min(y[i], y[i - 1]) && !o.cuts.some((c) => Math.abs(c - i) <= 1)) jumps.push(i);
  }
  return group(jumps, th.flashGroup).map(([a, b]) => {
    let size = 0;
    for (let i = a; i < b; i++) size = Math.max(size, Math.abs(y[i] - y[i - 1]));
    const cue = nearCue(a, o.hits, th.cueSlack);
    return { frame: a, end: b, size, ...(cue ? { cue } : {}) };
  });
}

/**
 * Pops: a frame whose D stands at least popK times, and popMin above, the median D of the frames
 * 2 and 4 away (the same parity, so the steps of an animation on twos do not pop one another),
 * and that is no part of a burst: at most two frames in a row (a single bad frame shows on the
 * way in and out) stand popK times over the frames 3 to 6 away, so a light pulse or a fast move
 * over three frames or more is motion, not a pop. Pops inside a flash are left to the flash; a
 * pop on a cut or within cueSlack of a hit is intended.
 */
export function popEvents(d: readonly number[], o: { hits: readonly MotionCue[]; cuts: readonly MotionCue[]; flashes: readonly MotionEvent[] }, th: MotionThresholds = MOTION_THRESHOLDS): MotionEvent[] {
  const n = d.length;
  const around = (i: number, ks: readonly number[]) => ks.map((k) => i + k).filter((k) => k >= 1 && k < n).map((k) => d[k]);
  const ratio: number[] = new Array<number>(n).fill(0);
  const high: boolean[] = new Array<boolean>(n).fill(false);
  const frames: number[] = [];
  for (let i = 1; i < n; i++) {
    const wide = median(around(i, [-6, -5, -4, -3, 3, 4, 5, 6]));
    high[i] = d[i] >= th.popK * wide && d[i] - wide >= th.popMin;
    const same = around(i, [-4, -2, 2, 4]);
    const m = median(same);
    ratio[i] = d[i] / Math.max(m, R_FLOOR);
    if (same.length >= 2 && d[i] >= th.popK * m && d[i] - m >= th.popMin) frames.push(i);
  }
  // the length of the run of `high` frames through i
  const burst = (i: number) => {
    if (!high[i]) return 0;
    let a = i;
    let b = i;
    while (a > 1 && high[a - 1]) a--;
    while (b + 1 < n && high[b + 1]) b++;
    return b - a + 1;
  };
  const runs = group(
    frames.filter((i) => burst(i) <= 2),
    1,
  ).filter(([a, b]) => !o.flashes.some((f) => a <= f.end && b >= f.frame - 1));
  return runs.map(([a, b]) => {
    let size = 0;
    for (let i = a; i < b; i++) size = Math.max(size, ratio[i]);
    const cue = o.cuts.find((c) => c.frame >= a - 1 && c.frame <= b)?.id ?? nearCue(a, o.hits, th.cueSlack);
    return { frame: a, end: b, size, ...(cue ? { cue } : {}) };
  });
}

/** A still-camera span and the fine-detail change on it (grain, boil, flicker of texture). */
export interface BoilSpan {
  start: number;
  end: number;
  /** mean H over the span, code values */
  level: number;
}

/** The edge tiles of the grid (the outer ring): where the camera shows and the subject seldom is. */
export const edgeTiles = (cols: number, rows: number): number[] =>
  Array.from({ length: cols * rows }, (_, t) => t).filter((t) => {
    const r = Math.floor(t / cols);
    const c = t % cols;
    return r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
  });

/**
 * Boil (information): spans of at least stillMin frames on which every edge tile's D stays under
 * stillEdge (the camera is still), with the mean fine-detail change H there.
 */
export function boilSpans(s: Pick<MotionSeries, 'tiles' | 'cols' | 'rows' | 'hf'>, th: MotionThresholds = MOTION_THRESHOLDS, exclude: readonly FrameSpan[] = []): BoilSpan[] {
  const edges = edgeTiles(s.cols, s.rows);
  const n = s.hf.length;
  const still = (i: number) => i >= 1 && edges.every((t) => s.tiles[t][i] < th.stillEdge) && !exclude.some(([a, b]) => i >= a && i < b);
  const out: BoilSpan[] = [];
  for (let i = 1; i < n; ) {
    if (!still(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && still(j)) j++;
    if (j - i >= th.stillMin) out.push({ start: i, end: j, level: mean(s.hf.slice(i, j)) });
    i = j;
  }
  return out;
}

/** One point of the watch list: where a reviewer should play the picture at speed. */
export interface WatchPoint {
  /** seconds from the file's first frame */
  t: number;
  frame: number;
  end: number;
  what: string;
}

export interface MotionAnalysis {
  thresholds: MotionThresholds;
  /** measured on a lossy file (the delivery): the cadence needed lossyEvidence and runs of lossyRun windows */
  lossy: boolean;
  cadence: CadenceSpan[];
  /** flashes not on a hit, and those on one */
  flashes: MotionEvent[];
  pops: MotionEvent[];
  boil: BoilSpan[];
  watch: WatchPoint[];
}

const secs = (frame: number, fps: number): number => Math.round((frame / fps) * 1000) / 1000;

/**
 * The whole analysis of a series against the cue sheet's events on the file: hits (flashes and
 * pops on them are intended) and transitions (`cut` cues, the start of the film after the
 * leader, the edges of black and card spans), which are judged by none of the measures. `lossy`:
 * the series is of a lossy file (cadenceSpans).
 */
export function analyseMotion(s: MotionSeries, cues: readonly DeliveryCue[], o: { filmStart?: number; thresholds?: MotionThresholds; lossy?: boolean } = {}): MotionAnalysis {
  const th = o.thresholds ?? MOTION_THRESHOLDS;
  const hits = cues.filter((c) => c.kind === 'hit').map((c) => ({ id: c.id, frame: c.frame }));
  const cuts: MotionCue[] = [
    ...(o.filmStart !== undefined && o.filmStart > 0 ? [{ id: 'film', frame: o.filmStart }] : []),
    ...cues.filter((c) => c.kind === 'cut').map((c) => ({ id: c.id, frame: c.frame })),
    ...cues.filter((c) => (c.kind === 'black' || c.kind === 'card') && c.end !== undefined).flatMap((c) => [
      { id: `${c.id} start`, frame: c.frame },
      { id: `${c.id} end`, frame: c.end! },
    ]),
  ].filter((c) => c.frame > 0 && c.frame < s.d.length);
  const flashes = flashEvents(s.y, { hits, cuts: cuts.map((c) => c.frame) }, th);
  const pops = popEvents(s.d, { hits, cuts, flashes }, th);
  // a cut, a flash or a pop alternates, holds or jumps for reasons of its own
  const exclude: FrameSpan[] = [...cuts.map((c) => [c.frame - 1, c.frame + 2] as const), ...flashes.map((f) => [f.frame - 1, f.end + 1] as const), ...pops.map((p) => [p.frame - 1, p.end + 1] as const)];
  const lossy = o.lossy === true;
  const cadence = cadenceSpans(s, th, exclude, { lossy });
  const boil = boilSpans(s, th, exclude);
  const fps = s.fps;
  const watch: WatchPoint[] = [
    ...cadence.map((c) => ({
      t: secs(c.start, fps),
      frame: c.start,
      end: c.end,
      what:
        c.kind === 'judder'
          ? `judder ${secs(c.end - c.start, fps)} s: part of the picture steps on twos while the rest moves on ones (R ${c.peak.r.toFixed(2)} in ${c.peak.source})`
          : `on twos ${secs(c.end - c.start, fps)} s: the picture holds every other frame (R ${c.peak.r.toFixed(2)} in ${c.peak.source})`,
    })),
    ...flashes.filter((f) => !f.cue).map((f) => ({ t: secs(f.frame, fps), frame: f.frame, end: f.end, what: `flash: mean luma jumps ${f.size.toFixed(1)} code values, on no hit` })),
    ...pops.filter((p) => !p.cue).map((p) => ({ t: secs(p.frame, fps), frame: p.frame, end: p.end, what: `pop: the picture changes ${p.size.toFixed(1)}x more than around it, on no hit or cut` })),
  ].sort((a, b) => a.frame - b.frame);
  return { thresholds: th, lossy, cadence, flashes, pops, boil, watch };
}

const spanS = (a: number, b: number, fps: number) => `${(a / fps).toFixed(2)}-${(b / fps).toFixed(2)} s`;
const list = (xs: readonly string[], max = 8) => (xs.length > max ? `${xs.slice(0, max).join(', ')} … (+${xs.length - max})` : xs.join(', '));

/** The report's checks. INFORMATION ONLY: they point at where to look and never fail QA. */
export function motionChecks(m: MotionAnalysis, fps: number, source: string): QaCheck[] {
  const judder = m.cadence.filter((c) => c.kind === 'judder');
  const twos = m.cadence.filter((c) => c.kind === 'twos');
  const offFlash = m.flashes.filter((f) => !f.cue);
  const offPop = m.pops.filter((p) => !p.cue);
  const cad = [
    judder.length ? `${judder.length} judder span(s), a part on twos under motion on ones: ${list(judder.map((c) => spanS(c.start, c.end, fps)))}` : 'no judder',
    twos.length ? `${twos.length} span(s) on twos: ${list(twos.map((c) => spanS(c.start, c.end, fps)))}` : 'nothing on twos',
  ].join('; ');
  const onHit = (xs: readonly MotionEvent[]) => xs.filter((x) => x.cue).length;
  // a lossy file's encoder makes the picture alternate and jump on its own: say how far to trust it
  const tileOnly = m.cadence.filter((c) => !c.sources.includes('picture')).length;
  const lossyCad = m.lossy
    ? `, a lossy file: a span needed its parity in both window halves, coarse motion and ${m.thresholds.lossyRun} windows in a row${tileOnly ? `; ${tileOnly} seen only in tiles may still come from the codec: look at the strip, or measure the mezzanine` : ''}`
    : '';
  const lossyPop = m.lossy && offPop.length ? ' (a lossy file: one may come from the encoder)' : '';
  return [
    check('motion.cadence', true, `${cad} (measured on ${source}${lossyCad})`, { thresholds: m.thresholds, lossy: m.lossy, spans: m.cadence }, true),
    check('motion.flash', true, offFlash.length ? `${offFlash.length} flash(es) on no hit: ${list(offFlash.map((f) => `${(f.frame / fps).toFixed(2)} s`))}${onHit(m.flashes) ? ` (${onHit(m.flashes)} on hits)` : ''}` : `no flash off the hits${m.flashes.length ? ` (${m.flashes.length} on hits)` : ''}`, m.flashes, true),
    check('motion.pop', true, offPop.length ? `${offPop.length} pop(s) on no hit or cut: ${list(offPop.map((p) => `${(p.frame / fps).toFixed(2)} s`))}${onHit(m.pops) ? ` (${onHit(m.pops)} on cues)` : ''}${lossyPop}` : `no pop off the cues${m.pops.length ? ` (${m.pops.length} on cues)` : ''}`, m.pops, true),
    check('motion.boil', true, m.boil.length ? `fine-detail change where the camera is still: ${list(m.boil.map((b) => `${spanS(b.start, b.end, fps)} ${b.level.toFixed(2)}`))}` : 'no still-camera span', m.boil, true),
    check('motion.watch', true, m.watch.length ? `play at speed: ${list(m.watch.map((w) => `${w.t.toFixed(2)} s`), 12)}` : 'nothing to watch', m.watch, true),
  ];
}

// --- motion.png --------------------------------------------------------------------------------

type Rgb = readonly [number, number, number];
const hex = (h: number): Rgb => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const ffHex = (c: Rgb): string => `0x${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const C = {
  bg: hex(0x101214),
  panel: hex(0x181b1f),
  grid: hex(0x2a2f36),
  text: hex(0xc8d2e0),
  y: hex(0xc8d2e0),
  d: hex(0xf0f0f0),
  tile: hex(0x7d8794),
  picture: hex(0x5ee7ff),
  tiles: hex(0xff9a3c),
  threshold: hex(0xff5a3c),
  hf: hex(0xc07aff),
  judder: hex(0xff7a1a),
  twos: hex(0x4a8cff),
  flash: hex(0xffd84a),
  pop: hex(0xff4fd8),
  boil: hex(0x6ee08a),
  hit: hex(0xff5a3c),
  cut: hex(0xffffff),
  cue: hex(0x7d8794),
};

/** An RGB picture for the plots; ffmpeg's drawtext adds the words. */
class Canvas {
  readonly px: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
    bg: Rgb,
  ) {
    this.px = new Uint8Array(w * h * 3);
    this.rect(0, 0, w, h, bg);
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb, alpha = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) {
        const o = (yy * this.w + xx) * 3;
        for (let k = 0; k < 3; k++) this.px[o + k] = Math.round(this.px[o + k] * (1 - alpha) + c[k] * alpha);
      }
  }
}

/** A text label for drawtext: position in pixels, colour, size. */
export interface SheetLabel {
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

/** A panel of motion.png: its rows, its scale and what it is called. */
interface Panel {
  y: number;
  h: number;
  max: number;
  min: number;
  name: string;
}

const LEFT = 96;
const RIGHT = 24;
const CUE_BAND = 3 * 15 + 8;
const AXIS_H = 26;
const LEGEND_H = 20;
const GAP = 10;

/** The per-frame cadence curves: per window centre, R - 1 and A of the picture and the strongest tile. */
export function cadenceCurves(s: Pick<MotionSeries, 'd' | 'tiles'>, th: MotionThresholds): { rPicture: number[]; rTiles: number[]; aPicture: number[] } {
  const n = s.d.length;
  const half = th.window >> 1;
  const curve = (d: readonly number[]) => {
    const r = new Array<number>(n).fill(0);
    const a = new Array<number>(n).fill(0);
    for (const w of cadenceWindows(d, th.window)) {
      const i = w.start + half;
      if (w.med >= th.motionFloor) a[i] = w.a;
      if (w.med >= th.motionFloor && w.c >= th.consistency) r[i] = w.r - 1;
    }
    return { r, a };
  };
  const pic = curve(s.d);
  const tiles = s.tiles.map((t) => curve(t).r);
  return { rPicture: pic.r, rTiles: Array.from({ length: n }, (_, i) => Math.max(...tiles.map((t) => t[i]))), aPicture: pic.a };
}

/**
 * motion.png's pixels and labels (pure): the mean luma, the frame difference (picture and the
 * strongest tile), the cadence curves (R - 1 where a window moves and alternates consistently,
 * the alternation index A of the picture where it moves) with their thresholds, and the
 * fine-detail change H, over the whole file; flagged spans shaded through every panel (judder
 * orange, on twos blue), flashes yellow and pops magenta, every cue a line with its id above, and
 * seconds along the bottom.
 */
export function drawMotionSheet(s: MotionSeries, m: MotionAnalysis, cues: readonly DeliveryCue[], o: { plotWidth?: number } = {}): { width: number; height: number; rgb: Uint8Array; labels: SheetLabel[] } {
  const n = Math.max(1, s.d.length);
  const plotW = o.plotWidth ?? 1600;
  const width = LEFT + plotW + RIGHT;
  const th = m.thresholds;
  const quant = (xs: readonly number[], q: number) => {
    const v = [...xs].sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : 0;
  };
  const tileMax = s.d.map((_, i) => Math.max(0, ...s.tiles.map((t) => t[i])));
  const curves = cadenceCurves(s, th);
  const dMax = Math.max(4, Math.ceil(quant(tileMax, 0.99)));
  const hfMax = Math.max(1, Math.ceil(quant(s.hf, 0.99) * 2) / 2);
  const specs: Omit<Panel, 'y'>[] = [
    { h: 90, min: 0, max: 255, name: 'Y mean luma' },
    { h: 130, min: 0, max: dMax, name: 'D frame diff' },
    { h: 100, min: 0, max: 2, name: 'R - 1 parity' },
    { h: 80, min: 0, max: 1, name: 'A alternation' },
    { h: 70, min: 0, max: hfMax, name: 'H fine detail' },
  ];
  let y = CUE_BAND;
  const panels: Panel[] = specs.map((p) => {
    const out = { ...p, y };
    y += p.h + GAP;
    return out;
  });
  const height = y - GAP + AXIS_H + LEGEND_H;
  const cv = new Canvas(width, height, C.bg);
  const xOf = (frame: number) => LEFT + Math.min(plotW - 1, Math.max(0, Math.floor((frame / n) * plotW)));
  const yOf = (p: Panel, v: number) => p.y + p.h - 1 - Math.round(((Math.min(Math.max(v, p.min), p.max) - p.min) / (p.max - p.min)) * (p.h - 1));
  const top = panels[0].y;
  const bottom = panels.at(-1)!.y + panels.at(-1)!.h;
  for (const p of panels) cv.rect(LEFT, p.y, plotW, p.h, C.panel);
  // spans first, lines over them
  for (const c of m.cadence) cv.rect(xOf(c.start), top, Math.max(1, xOf(c.end) - xOf(c.start)), bottom - top, c.kind === 'judder' ? C.judder : C.twos, 0.24);
  const hfPanel = panels[4];
  for (const b of m.boil) cv.rect(xOf(b.start), hfPanel.y, Math.max(1, xOf(b.end) - xOf(b.start)), hfPanel.h, C.boil, 0.18);
  // one line per second, brighter every labelled step
  const fps = s.fps;
  const durS = n / fps;
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((k) => (k / durS) * plotW >= 70) ?? 600;
  const labels: SheetLabel[] = [];
  for (let t = 0; t <= durS; t += step) {
    const x = xOf(t * fps);
    for (const p of panels) cv.rect(x, p.y, 1, p.h, C.grid);
    labels.push({ text: `${t} s`, x: Math.max(LEFT, x - 10), y: bottom + 6, color: ffHex(C.text), size: 13 });
  }
  // thresholds
  const hline = (p: Panel, v: number, c: Rgb) => {
    const yy = yOf(p, v);
    for (let x = LEFT; x < LEFT + plotW; x += 6) cv.rect(x, yy, 3, 1, c, 0.8);
  };
  hline(panels[2], th.parity - 1, C.threshold);
  hline(panels[3], th.alternation, C.threshold);
  // a series as one vertical segment per column (min to max of its frames, joined to the previous column)
  const plot = (p: Panel, v: readonly number[], c: Rgb) => {
    let prev: number | null = null;
    for (let x = 0; x < plotW; x++) {
      const f0 = Math.floor((x * n) / plotW);
      const f1 = Math.max(f0 + 1, Math.floor(((x + 1) * n) / plotW));
      let lo = Infinity;
      let hi = -Infinity;
      for (let f = f0; f < Math.min(f1, v.length); f++) {
        lo = Math.min(lo, v[f]);
        hi = Math.max(hi, v[f]);
      }
      if (lo === Infinity) continue;
      const ya = yOf(p, hi);
      const yb = yOf(p, lo);
      const y0 = prev === null ? ya : Math.min(ya, prev);
      const y1 = prev === null ? yb : Math.max(yb, prev);
      cv.rect(LEFT + x, y0, 1, y1 - y0 + 1, c);
      prev = yOf(p, v[Math.min(f1, v.length) - 1]);
    }
  };
  plot(panels[0], s.y, C.y);
  plot(panels[1], tileMax, C.tile);
  plot(panels[1], s.d, C.d);
  plot(panels[2], curves.rTiles, C.tiles);
  plot(panels[2], curves.rPicture, C.picture);
  plot(panels[3], curves.aPicture, C.picture);
  plot(panels[4], s.hf, C.hf);
  // events: flashes and pops (off their cues bright, on them dim), then the cues
  for (const f of m.flashes) cv.rect(xOf(f.frame), top, 2, bottom - top, C.flash, f.cue ? 0.35 : 0.9);
  for (const p of m.pops) cv.rect(xOf(p.frame), top, 2, bottom - top, C.pop, p.cue ? 0.35 : 0.9);
  cues.forEach((c, k) => {
    const color = c.kind === 'hit' ? C.hit : c.kind === 'cut' ? C.cut : C.cue;
    const x = xOf(c.frame);
    cv.rect(x, 4 + (k % 3) * 15, 1, top - 4 - (k % 3) * 15, color, 0.9);
    for (let yy = top; yy < bottom; yy += 4) cv.rect(x, yy, 1, 2, color, 0.55);
    // near the right edge the label goes left of its line
    labels.push({ text: c.id, x: x > LEFT + plotW * 0.92 ? x - 6 - c.id.length * 7 : x + 3, y: 3 + (k % 3) * 15, color: ffHex(color), size: 12 });
  });
  const legend = ['judder', 'on twos', 'flash', 'pop'];
  const legendColors = [C.judder, C.twos, C.flash, C.pop];
  panels.forEach((p) => {
    labels.push({ text: p.name, x: 6, y: p.y + 4, color: ffHex(C.text), size: 12 });
    // the scale at the right end, where a film is usually quieter than at its start
    labels.push({ text: `max ${p.max}`, x: LEFT + plotW - 60, y: p.y + 3, color: ffHex(C.tile), size: 11 });
  });
  // the legend, along the bottom
  const legendY = bottom + AXIS_H;
  legend.forEach((t, k) => {
    cv.rect(LEFT + k * 100, legendY + 4, 10, 10, legendColors[k]);
    labels.push({ text: t, x: LEFT + k * 100 + 14, y: legendY + 2, color: ffHex(legendColors[k]), size: 12 });
  });
  labels.push({ text: 'D: white the picture, grey the strongest tile. R, A: cyan the picture, orange the strongest tile. Dashed: thresholds. Lines: cues (red hits, white cuts).', x: LEFT + legend.length * 100 + 10, y: legendY + 2, color: ffHex(C.tile), size: 12 });
  return { width, height, rgb: cv.px, labels };
}

/** Writes motion.png: the plots from TS (raw RGB on stdin), the words with drawtext (left out when it fails). Returns whether the labels were drawn. */
export async function motionSheet(out: string, sheet: ReturnType<typeof drawMotionSheet>, log?: Log): Promise<{ labels: boolean }> {
  const script = `${out}.graph.txt`;
  const input = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${sheet.width}x${sheet.height}`, '-i', 'pipe:0'];
  try {
    const draw = sheet.labels.map((l) => `drawtext=text=${filterValue(l.text)}:x=${l.x}:y=${l.y}:fontsize=${l.size}:fontcolor=${l.color}`);
    // many cues make a long graph: it goes through a file, past the command-line limit
    writeFileSync(script, `[0:v]${draw.length ? draw.join(',') : 'null'},format=rgb24[out]`);
    try {
      await ffmpeg(['-loglevel', 'error', ...input, '-/filter_complex', script, '-map', '[out]', '-frames:v', '1', '-update', '1', out], 'motion sheet', { input: sheet.rgb, timeoutMs: 120_000 });
      return { labels: true };
    } catch {
      log?.warn('motion sheet: drawtext unavailable, the plots are unlabelled');
      await ffmpeg(['-loglevel', 'error', ...input, '-frames:v', '1', '-update', '1', out], 'motion sheet', { input: sheet.rgb, timeoutMs: 120_000 });
      return { labels: false };
    }
  } finally {
    rmSync(script, { force: true });
  }
}

// --- frame strips ------------------------------------------------------------------------------

/** One strip to cut: 12 consecutive frames from `start`, and what they show. */
export interface StripPlan {
  start: number;
  title: string;
  file: string;
}

/**
 * The strips worth cutting, at most `max`: judder spans first (strongest first), then flashes
 * and pops off their cues, then spans on twos. A cadence strip is the window in the middle of the
 * span's longest unbroken flagged run (twelve frames that were judged), a flash or pop strip puts
 * the event sixth.
 */
export function planStrips(m: MotionAnalysis, frames: number, fps: number, max = 12): StripPlan[] {
  const n = 12;
  const clampStart = (f: number) => Math.max(0, Math.min(frames - n, f));
  const t = (f: number) => (f / fps).toFixed(2);
  const byR = (k: CadenceKind) => m.cadence.filter((c) => c.kind === k).sort((a, b) => b.peak.r - a.peak.r);
  const cadence = (c: CadenceSpan) => ({ kind: c.kind, start: clampStart(c.steady), title: `${c.kind === 'judder' ? 'judder' : 'on twos'} ${t(c.start)}-${t(c.end)} s, frames from ${c.steady} (${t(c.steady)} s); strongest R ${c.peak.r.toFixed(2)} in ${c.peak.source} at ${t(c.peak.start)} s` });
  const picks = [
    ...byR('judder').map(cadence),
    ...m.flashes.filter((f) => !f.cue).map((f) => ({ kind: 'flash', start: clampStart(f.frame - 5), title: `flash at ${t(f.frame)} s (frame ${f.frame}), on no hit` })),
    ...m.pops.filter((p) => !p.cue).map((p) => ({ kind: 'pop', start: clampStart(p.frame - 5), title: `pop at ${t(p.frame)} s (frame ${p.frame}), on no hit or cut` })),
    ...byR('twos').map(cadence),
  ].slice(0, Math.max(0, max));
  return picks.map((p, k) => ({ start: p.start, title: p.title, file: `${String(k + 1).padStart(2, '0')}-${p.kind}-f${String(p.start).padStart(5, '0')}.png` }));
}

/**
 * One strip: 12 consecutive full-colour frames of `file` from `start`, 6 wide and 2 high, each
 * labelled with its frame number, under a title. Without a usable drawtext font, unlabelled.
 */
export async function frameStrip(file: string, o: { start: number; fps: number; title: string; out: string; tileWidth?: number; log?: Log }): Promise<{ labels: boolean }> {
  const tw = o.tileWidth ?? 320;
  // seek just before the frame's timestamp: the first frame at or after it is frame `start`
  const ss = Math.max(0, (o.start - 0.25) / o.fps).toFixed(6);
  const vf = (labels: boolean) =>
    [
      `scale=${tw}:-2`,
      ...(labels ? [`drawtext=text=${filterValue(`%{eif:n+${o.start}:d}`)}:x=w-text_w-6:y=6:fontsize=${Math.round(tw / 20)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=3`] : []),
      'tile=6x2:padding=4:color=0x101214',
      ...(labels ? ['pad=iw:ih+30:0:30:color=0x101214', `drawtext=text=${filterValue(o.title)}:x=8:y=7:fontsize=17:fontcolor=0xc8d2e0`] : []),
    ].join(',');
  const args = (labels: boolean) => ['-loglevel', 'error', '-ss', ss, '-i', file, '-map', '0:v:0', '-vf', vf(labels), '-frames:v', '1', '-update', '1', o.out];
  try {
    await ffmpeg(args(true), 'motion strip', { timeoutMs: 120_000 });
    return { labels: true };
  } catch {
    o.log?.warn('motion strip: drawtext unavailable, the strip is unlabelled');
    await ffmpeg(args(false), 'motion strip', { timeoutMs: 120_000 });
    return { labels: false };
  }
}

// --- the QA step -------------------------------------------------------------------------------

/**
 * What measureMotion gets through on the reference host (docs/ENVIRONMENT.md), in source
 * megapixels per second, measured 2026-11-04 on the V1 draft of A Halloween Gift (960x540, 1452
 * frames, the files in the OS cache): 56 from its FFV1 RGB mezzanine (13.3 s), 96 from its H.264
 * delivery (7.9 s). An earlier QA run took up to 3x longer on the mezzanine (cold disk, other
 * load). The analysis size is fixed, so the decode is what grows with the render size: a 1080p24
 * mezzanine takes about a second per second of film.
 */
export const MOTION_MPX_PER_S = { lossless: 56, lossy: 96 } as const;

/** The seconds measureMotion should take on the reference host: [in the OS cache, up to 3x that]. */
export function motionEstimateS(frames: number, width: number, height: number, lossy: boolean): [number, number] {
  const s = (frames * width * height) / 1e6 / (lossy ? MOTION_MPX_PER_S.lossy : MOTION_MPX_PER_S.lossless);
  return [s, 3 * s];
}

export interface MotionQaOptions {
  /** the delivery: the strips come from it */
  delivery: string;
  /** the picture measured: the lossless mezzanine when it matches the delivery, else the delivery */
  source: string;
  /** the source is lossy (the delivery): the cadence needs stronger evidence (cadenceSpans) */
  lossy?: boolean;
  /** the source's frame count, for the time estimate in the log */
  frames?: number;
  width: number;
  height: number;
  fps: number;
  /** the delivery's cues (deliveryCues) and the delivery frame where the film starts after the leader */
  cues: readonly DeliveryCue[];
  filmStart?: number;
  /** motion.png, motion.json and strips/ go here (with `name`: motion-<name>.png, …) */
  outDir: string;
  name?: string;
  /** how the source reads in the report (a repository path) */
  sourceLabel: string;
  maxStrips?: number;
  thresholds?: MotionThresholds;
  log?: Log;
}

const round3 = (xs: readonly number[]) => xs.map((x) => Math.round(x * 1000) / 1000);

/**
 * Measures the source, analyses it against the cues, and writes motion.png, motion.json (the
 * series and the analysis) and the strips. Returns the information checks and the files.
 */
export async function motionQa(o: MotionQaOptions): Promise<{ checks: QaCheck[]; analysis: MotionAnalysis; series: MotionSeries; files: { sheet: string; json: string; strips: string[] }; labels: boolean }> {
  const lossy = o.lossy === true;
  // a long film at full size makes this the longest decode of QA: say so before it starts
  if (o.frames) {
    const [lo, hi] = motionEstimateS(o.frames, o.width, o.height, lossy);
    const fmt = (s: number) => (s < 90 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`);
    o.log?.info(`motion: measuring ${o.sourceLabel} (${o.frames} frames ${o.width}x${o.height}): about ${fmt(lo)}-${fmt(hi)} on the reference host; aiv qa --no-motion skips it`);
  }
  const t0 = performance.now();
  const series = await measureMotion(o.source, { width: o.width, height: o.height, fps: o.fps });
  o.log?.info(`motion: measured in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  const analysis = analyseMotion(series, o.cues, { filmStart: o.filmStart, thresholds: o.thresholds, lossy });
  const suffix = o.name ? `-${o.name}` : '';
  mkdirSync(o.outDir, { recursive: true });
  const sheet = join(o.outDir, `motion${suffix}.png`);
  const { labels } = await motionSheet(sheet, drawMotionSheet(series, analysis, o.cues), o.log);
  const json = join(o.outDir, `motion${suffix}.json`);
  writeFileSync(
    json,
    `${JSON.stringify({ source: o.sourceLabel, lossy, fps: o.fps, size: [series.width, series.height], grid: [series.cols, series.rows], analysis, series: { y: round3(series.y), d: round3(series.d), hf: round3(series.hf), dc: round3(series.dc), tiles: series.tiles.map(round3), tilesDc: series.tilesDc.map(round3) } })}\n`,
  );
  const dir = join(o.outDir, `strips${suffix}`);
  rmSync(dir, { recursive: true, force: true });
  const plans = planStrips(analysis, series.d.length, o.fps, o.maxStrips ?? 12);
  const strips: string[] = [];
  if (plans.length) mkdirSync(dir, { recursive: true });
  for (const p of plans) {
    const out = join(dir, p.file);
    await frameStrip(o.delivery, { start: p.start, fps: o.fps, title: p.title, out, log: o.log });
    strips.push(out);
  }
  return { checks: motionChecks(analysis, o.fps, o.sourceLabel), analysis, series, files: { sheet, json, strips }, labels };
}
