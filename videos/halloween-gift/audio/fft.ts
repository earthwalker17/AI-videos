/**
 * A radix-2 complex FFT and stereo FFT convolution (overlap-add, the input cut into blocks), used
 * by the hall and the room. Two real channels share one complex transform: the left signal is
 * the real part, the right the imaginary part, and the two spectra are separated by symmetry.
 *
 * Convolution runs per segment between "cuts" (hard stops and digital silences): a segment's
 * output is truncated at its end, with a short fade, so no reverb tail survives into a silence.
 */

interface Table {
  cos: Float64Array;
  sin: Float64Array;
  rev: Uint32Array;
}
const tables = new Map<number, Table>();

function table(n: number): Table {
  let t = tables.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / n);
      sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    const bits = Math.round(Math.log2(n));
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b);
      rev[i] = r >>> 0;
    }
    t = { cos, sin, rev };
    tables.set(n, t);
  }
  return t;
}

/** In-place complex FFT of length n (a power of two); the inverse is scaled by 1/n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error(`fft: ${n} is not a power of two`);
  const { cos, sin, rev } = table(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0, w = 0; k < half; k++, w += step) {
        const wr = cos[w];
        const wi = sgn * sin[w];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  if (inverse) {
    const s = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= s;
      im[i] *= s;
    }
  }
}

export interface StereoIr {
  l: Float32Array;
  r: Float32Array;
}

export interface Prepared {
  n: number;
  block: number;
  /** spectra of the left and right impulse responses */
  hlr: Float64Array;
  hli: Float64Array;
  hrr: Float64Array;
  hri: Float64Array;
}

/** Transform a stereo impulse response once for blocks of FFT size n ≥ 2·length. */
export function prepareIr(ir: StereoIr): Prepared {
  const m = ir.l.length;
  let n = 1;
  while (n < 2 * m) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < m; i++) {
    re[i] = ir.l[i];
    im[i] = ir.r[i];
  }
  fft(re, im);
  const hlr = new Float64Array(n);
  const hli = new Float64Array(n);
  const hrr = new Float64Array(n);
  const hri = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const j = (n - k) & (n - 1);
    // P = Hl + i·Hr; Hl = (P[k] + conj P[-k]) / 2, Hr = (P[k] - conj P[-k]) / 2i
    hlr[k] = (re[k] + re[j]) / 2;
    hli[k] = (im[k] - im[j]) / 2;
    hrr[k] = (im[k] + im[j]) / 2;
    hri[k] = -(re[k] - re[j]) / 2;
  }
  return { n, block: n - m + 1, hlr, hli, hrr, hri };
}

/**
 * Convolve the stereo input (left with the IR's left, right with its right) and add the result
 * into out, segment by segment: input in [cut_k, cut_k+1) produces output only up to cut_k+1,
 * whose last `fade` samples are faded to zero. Blocks of silence are skipped.
 */
export function convolveInto(
  inL: Float32Array,
  inR: Float32Array,
  p: Prepared,
  outL: Float32Array,
  outR: Float32Array,
  cuts: readonly number[],
  fade: number,
): void {
  const total = inL.length;
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < total), total];
  const re = new Float64Array(p.n);
  const im = new Float64Array(p.n);
  for (let s = 0; s + 1 < bounds.length; s++) {
    const a = bounds[s];
    const b = bounds[s + 1];
    const accL = new Float64Array(b - a);
    const accR = new Float64Array(b - a);
    let any = false;
    for (let start = a; start < b; start += p.block) {
      const end = Math.min(b, start + p.block);
      let live = false;
      for (let i = start; i < end; i++) {
        if (inL[i] !== 0 || inR[i] !== 0) {
          live = true;
          break;
        }
      }
      if (!live) continue;
      any = true;
      re.fill(0);
      im.fill(0);
      for (let i = start; i < end; i++) {
        re[i - start] = inL[i];
        im[i - start] = inR[i];
      }
      fft(re, im);
      const n = p.n;
      // W = ((A + B)·Hl + (A − B)·Hr) / 2 with A = Z[k], B = conj Z[-k]; ifft(W) = yl + i·yr
      // computed in place pairwise (k, n−k) so both read the original Z
      for (let k = 0; k <= n / 2; k++) {
        const j = (n - k) & (n - 1);
        const ar = re[k];
        const ai = im[k];
        const br = re[j];
        const bi = -im[j];
        // at k
        const sr = ar + br;
        const si = ai + bi;
        const dr = ar - br;
        const di = ai - bi;
        const wkr = (sr * p.hlr[k] - si * p.hli[k] + dr * p.hrr[k] - di * p.hri[k]) / 2;
        const wki = (sr * p.hli[k] + si * p.hlr[k] + dr * p.hri[k] + di * p.hrr[k]) / 2;
        if (j !== k) {
          // at j: A' = Z[j] = conj(B), B' = conj Z[k] = conj(A)
          const a2r = br;
          const a2i = -bi;
          const b2r = ar;
          const b2i = -ai;
          const s2r = a2r + b2r;
          const s2i = a2i + b2i;
          const d2r = a2r - b2r;
          const d2i = a2i - b2i;
          re[j] = (s2r * p.hlr[j] - s2i * p.hli[j] + d2r * p.hrr[j] - d2i * p.hri[j]) / 2;
          im[j] = (s2r * p.hli[j] + s2i * p.hlr[j] + d2r * p.hri[j] + d2i * p.hrr[j]) / 2;
        }
        re[k] = wkr;
        im[k] = wki;
      }
      fft(re, im, true);
      const lim = Math.min(b, start + p.n);
      for (let i = start; i < lim; i++) {
        accL[i - a] += re[i - start];
        accR[i - a] += im[i - start];
      }
    }
    if (!any) continue;
    const len = b - a;
    const f = Math.min(fade, len);
    // the last segment runs to the end of the film: nothing to cut there
    if (b < total)
      for (let k = 0; k < f; k++) {
        const g = 0.5 - 0.5 * Math.cos((Math.PI * k) / f);
        accL[len - 1 - k] *= g;
        accR[len - 1 - k] *= g;
      }
    for (let i = 0; i < len; i++) {
      outL[a + i] += accL[i];
      outR[a + i] += accR[i];
    }
  }
}
