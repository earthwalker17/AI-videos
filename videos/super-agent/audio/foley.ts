/**
 * The film's soft UI sounds (TREATMENT.md, Sound design: UI sound palette): paper and ink, all
 * synthesised from filtered noise and small modal bodies. Each returns a clip whose sample peak
 * is 0 dBFS (a placement's gain is its level); the arrangement sets them 12-18 dB under the bed,
 * with no whoosh risers, beat drops or sub hits.
 *
 *   woodblockHop   your ring hopping between session tiles (act one)
 *   sketchScratch  a pencil stroke on paper; dry: the ink strike-through
 *   inkClick       a status dot setting
 *   paperThump     the title cartouche landing
 *   woodKnock      a new Worker platform
 *   inkSwell       the ink arriving at the turn: a soft noise swell that spreads (not a riser)
 *   sandTrickle    the sand-glass landing (chore "wait"): a dry granular trickle, thinning
 *   paperTear      a stub tearing off its card (Fix B's break)
 *   plateTap       an enamel plate docking (the traits)
 *   printTap       the print head coming down on the tape (a record stamped in)
 *   gateClack      a slip flipped onto the spike by the gate's fingers: muted
 *   detent         a small mechanism setting (the stress plate, the spike standing up)
 *   paperFold      a card folding along its crease
 *   pointerTick    the pointer tab landing in its drawer
 *   ratchet        the reel rewinding: a train of small clicks that speeds up and slows (not a whoosh)
 *   paperTick      a light slip landing in a tray (the older reply, f1656)
 *   unhook         a plate lifting off its hooks: two small dry clicks (the stress plate, f3040)
 *   cordRun        a cord paying out through its guide: a soft, twisted friction (beat 7)
 *   tickRain       a row of tiny ticks printing, some inked: a soft rain, each tick at its own pan (beat 8)
 *   lidClick       a laptop lid shutting: a soft latch over a small low thump (beat 9)
 *   vellumLay      a vellum sheet laid down flat: airy, filtered noise (beat 9)
 *   vellumTap      a vellum plate settling: a soft, papery tap (beat 9)
 *   softPop        a reply landing (beat 10): a small round pop, its pitch falling
 *
 * Deterministic: every noise stream is seeded from the film seed (the kit's seedOf, @aiv/core's hash).
 */
import { Biquad, ModalBank, SR, Svf, TAU, clamp, norm, seedOf, slowNoise, smooth, uni, whiteNoise, type Mode, type StereoClip } from '@aiv/pipeline/audio/kit';

/** A strike: a Hann pulse `ms` long, roughened with a little seeded noise. */
function strike(s: number, ms: number, grit: number): Float32Array {
  const w = Math.max(4, Math.round(ms * 0.001 * SR));
  const out = new Float32Array(w + 1);
  const noise = whiteNoise(s);
  for (let i = 0; i <= w; i++) out[i] = 0.5 - 0.5 * Math.cos((TAU * i) / w) + grit * noise() * (1 - i / w);
  return out;
}

/** A small body: modes [Hz, decay s, gain] rung by a strike, then low-passed. */
function body(s: number, modes: readonly (readonly [number, number, number])[], o: { ms: number; grit: number; len: number; lowpass: number }): Float32Array {
  const bank = new ModalBank(modes.map(([f, decay, gain]): Mode => ({ f, decay, gain })));
  const y = bank.render(strike(s, o.ms, o.grit), Math.ceil(o.len * SR));
  new Biquad('lowpass', o.lowpass, 0.7).run(y);
  return norm(y, 0);
}

/** A soft woodblock: three short wooden modes near `pitch` Hz (seeded within ±3 %). */
export function woodblockHop(seed: number, k: number, pitch = 820): Float32Array {
  const f = pitch * (0.97 + 0.06 * uni(seedOf(seed, 'hop-pitch'), k));
  return body(
    seedOf(seed, 'hop', k),
    [
      [f, 0.04, 1],
      [f * 2.37, 0.022, 0.45],
      [f * 4.1, 0.01, 0.2],
    ],
    { ms: 1.3, grit: 0.12, len: 0.16, lowpass: 4500 },
  );
}

/**
 * A pencil (or pen) stroke on paper: band-passed noise whose centre moves along the stroke, its
 * level grained by the paper's tooth and the hand's pressure. `dry` is shorter-grained and
 * brighter, one quick stroke: the ink strike-through. `attack` (s, default 12 ms dry, 25 ms not) is the stroke's
 * raised-cosine onset: a struck card that is a hit starts in 2 ms, so its stroke carries the hit over a bass pulse.
 */
export function sketchScratch(seed: number, o: { len: number; k?: number; dry?: boolean; attack?: number }): Float32Array {
  const k = o.k ?? 0;
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'scratch', k));
  const tooth = slowNoise(seedOf(seed, 'scratch-tooth', k), o.dry ? 140 : 80);
  const hand = slowNoise(seedOf(seed, 'scratch-hand', k), 7);
  const bp = new Svf();
  const hp = new Biquad('highpass', 900, 0.7);
  const [c0, c1] = o.dry ? [3000, 4400] : [2300, 3300];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) bp.set(c0 + (c1 - c0) * (t / o.len), o.dry ? 1.4 : 1.0);
    bp.tick(noise());
    const env = smooth(t / (o.attack ?? (o.dry ? 0.012 : 0.025))) * smooth((o.len - t) / (o.dry ? 0.04 : 0.07)) * (0.75 + 0.25 * hand(t));
    out[i] = hp.tick(bp.bpn) * env * (0.5 + 0.5 * Math.abs(tooth(t)));
  }
  return norm(out, 0);
}

/** A small, high ink click with a little body under it. */
export function inkClick(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'ink-click', k),
    [
      [2600, 0.006, 1],
      [5100, 0.003, 0.4],
      [700, 0.012, 0.35],
    ],
    { ms: 0.4, grit: 0.3, len: 0.07, lowpass: 7000 },
  );
}

/** Paper landing on paper: a low-passed breath of noise over a soft, low body (no sub). */
export function paperThump(seed: number, k = 0): Float32Array {
  const s = seedOf(seed, 'paper-thump', k);
  const len = 0.45;
  const n = Math.ceil(len * SR);
  const y = body(
    s,
    [
      [92, 0.09, 1],
      [176, 0.05, 0.5],
      [310, 0.025, 0.25],
    ],
    { ms: 4, grit: 0.2, len, lowpass: 900 },
  );
  const noise = whiteNoise(seedOf(s, 'air'));
  const lp = new Biquad('lowpass', 320, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] = 0.7 * y[i] + 0.9 * lp.tick(noise()) * smooth(t / 0.003) * Math.exp(-t / 0.05);
  }
  return norm(y, 0);
}

/** A low wooden knock: four wooden modes from 168 Hz, a short soft strike. */
export function woodKnock(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'wood-knock', k),
    [
      [168, 0.1, 1],
      [395, 0.055, 0.55],
      [655, 0.03, 0.3],
      [1120, 0.014, 0.18],
    ],
    { ms: 1.8, grit: 0.2, len: 0.5, lowpass: 3200 },
  );
}

/**
 * The ink spreading: two decorrelated noise streams through band-passes that open (Q 5 → 0.7)
 * and rise (450 → 1500 Hz) while the image widens from the centre; the level swells over 60 % of
 * the clip and falls away. A spread, not a riser: no pitch sweep to a climax.
 */
export function inkSwell(seed: number, o: { len: number }): StereoClip {
  const n = Math.ceil(o.len * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const mid = whiteNoise(seedOf(seed, 'ink-swell', 0));
  const side = whiteNoise(seedOf(seed, 'ink-swell', 1));
  const fl = new Svf();
  const fr = new Svf();
  const tilt = [new Biquad('lowpass', 4000, 0.7), new Biquad('lowpass', 4000, 0.7)];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 31) === 0) {
      const f = 450 * (1500 / 450) ** smooth(u);
      const q = 5 * (0.7 / 5) ** smooth(u / 0.8);
      fl.set(f, q);
      fr.set(f * 1.06, q);
    }
    const width = 0.15 + 0.85 * smooth(u / 0.7);
    const m = mid();
    const sd = side();
    fl.tick(m + width * sd);
    fr.tick(m - width * sd);
    const env = u < 0.6 ? smooth(u / 0.6) : smooth((1 - u) / 0.4);
    l[i] = tilt[0].tick(fl.bpn) * env;
    r[i] = tilt[1].tick(fr.bpn) * env;
  }
  return norm({ l, r }, 0);
}

// --- the build's sounds (session 4) ---------------------------------------------------------------

/**
 * Sand running in a glass: a stream of grains (0.4-1.2 ms bursts of noise) whose rate falls from
 * a rush of about 900 a second to a thin 50, through a 4.5 kHz band-pass. Dry and granular; each
 * grain's start and size are drawn per sample from a counter-based seeded stream.
 */
export function sandTrickle(seed: number, o: { len: number; k?: number }): Float32Array {
  const s = seedOf(seed, 'sand', o.k ?? 0);
  const n = Math.ceil(o.len * SR);
  const raw = new Float32Array(n);
  const noise = whiteNoise(seedOf(s, 'grain-noise'));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const rate = 50 + 850 * Math.exp(-t / (o.len * 0.22));
    if (uni(s, i) >= rate / SR) continue;
    const g = uni(seedOf(s, 'grain'), i);
    const w = Math.round((0.0004 + 0.0008 * g) * SR);
    const a = 0.25 + 0.75 * uni(seedOf(s, 'grain-amp'), i);
    for (let j = 0; j < w && i + j < n; j++) raw[i + j] += a * noise() * Math.sin((Math.PI * j) / w);
  }
  const bp = new Svf();
  bp.set(4500, 0.9);
  const hp = new Biquad('highpass', 1500, 0.7);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    bp.tick(raw[i]);
    out[i] = hp.tick(bp.bp) * smooth(t / 0.008) * Math.exp(-t / (o.len * 0.5)) * smooth((o.len - t) / 0.1);
  }
  return norm(out, 0);
}

/** A stub tearing off: 0.14 s of high-passed noise, its level grained fast by the paper's fibres. */
export function paperTear(seed: number, k = 0): Float32Array {
  const len = 0.14;
  const n = Math.ceil(len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'tear', k));
  const fibre = slowNoise(seedOf(seed, 'tear-fibre', k), 420);
  const hp = new Biquad('highpass', 1300, 0.7);
  const lp = new Biquad('lowpass', 7500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = smooth(t / 0.006) * smooth((len - t) / 0.03) * (0.7 + 0.3 * (1 - t / len));
    out[i] = lp.tick(hp.tick(noise())) * env * (0.25 + 0.75 * Math.abs(fibre(t)));
  }
  return norm(out, 0);
}

/** An enamel plate docking: a hard, glassy body round 1.25 kHz with a low knock under it. */
export function plateTap(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'plate-tap', k),
    [
      [1250, 0.05, 1],
      [2950, 0.025, 0.45],
      [4800, 0.012, 0.2],
      [430, 0.03, 0.35],
    ],
    { ms: 1.0, grit: 0.1, len: 0.25, lowpass: 6000 },
  );
}

/** The print head coming down: a soft wooden tap round 900 Hz with a little paper in it. */
export function printTap(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'print-tap', k),
    [
      [900, 0.02, 1],
      [2100, 0.01, 0.4],
      [300, 0.03, 0.4],
    ],
    { ms: 1.2, grit: 0.25, len: 0.15, lowpass: 4000 },
  );
}

/** A muted clack: a short, damped plastic-and-wood body under a 2.4 kHz low-pass. */
export function gateClack(seed: number, k: number): Float32Array {
  const f = 0.94 + 0.12 * uni(seedOf(seed, 'clack-pitch'), k);
  return body(
    seedOf(seed, 'clack', k),
    [
      [620 * f, 0.012, 1],
      [1450 * f, 0.008, 0.6],
      [2700 * f, 0.005, 0.35],
    ],
    { ms: 0.8, grit: 0.25, len: 0.08, lowpass: 2400 },
  );
}

/** A mechanical detent: a small metallic click, a low thunk under it, and the spring's smaller click back 18 ms later. */
export function detent(seed: number, k: number): Float32Array {
  const click = (s: number, g: number) =>
    body(
      s,
      [
        [2400, 0.006, 1],
        [3900, 0.004, 0.6],
        [1150, 0.01, 0.5],
        [240, 0.03, 0.5 * g],
      ],
      { ms: 0.5, grit: 0.3, len: 0.1, lowpass: 7000 },
    );
  const a = click(seedOf(seed, 'detent', k), 1);
  const b = click(seedOf(seed, 'detent-back', k), 0.3);
  const lag = Math.round(0.018 * SR);
  const out = new Float32Array(a.length + lag);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  for (let i = 0; i < b.length; i++) out[i + lag] += 0.35 * b[i];
  return norm(out, 0);
}

/** A card folding along its crease: a short crackle (sparse clicks, 2-6 kHz) and the soft flap of the half coming down. */
export function paperFold(seed: number, k = 0): Float32Array {
  const s = seedOf(seed, 'fold', k);
  const len = 0.32;
  const n = Math.ceil(len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(s, 'noise'));
  const crackle = new Svf();
  crackle.set(3800, 0.8);
  const flap = new Biquad('lowpass', 650, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = noise();
    // the crease: a click wherever the stream draws one, densest early
    const c = uni(s, i) < 0.004 * Math.exp(-t / 0.07) ? 1 : 0;
    crackle.tick(c * (0.5 + 0.5 * uni(seedOf(s, 'c-amp'), i)) + 0.04 * x * Math.exp(-t / 0.06));
    // the flap: a breath of low noise as the half lands, 0.16 s in
    const fl = flap.tick(x) * Math.exp(-Math.max(0, t - 0.16) / 0.035) * smooth((t - 0.15) / 0.012);
    out[i] = crackle.bp * smooth((len - t) / 0.03) + 0.9 * fl;
  }
  return norm(out, 0);
}

/** The pointer tab landing in its drawer: a small, hard tick. */
export function pointerTick(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'pointer-tick', k),
    [
      [3400, 0.004, 1],
      [1900, 0.007, 0.5],
      [700, 0.012, 0.3],
    ],
    { ms: 0.35, grit: 0.2, len: 0.05, lowpass: 8000 },
  );
}

/**
 * The reel rewinding over `len` s: a ratchet whose click rate rises from 10 a second to 50 and
 * falls again (the reel spins up and stops), each click a tiny body with its own small pitch.
 */
export function ratchet(seed: number, o: { len: number; k?: number }): Float32Array {
  const s = seedOf(seed, 'ratchet', o.k ?? 0);
  const n = Math.ceil((o.len + 0.03) * SR);
  const out = new Float32Array(n);
  // the first click lands on the clip's first sample, so the ratchet starts on its hit
  let phase = 1;
  let c = 0;
  for (let i = 0; i < Math.ceil(o.len * SR); i++) {
    const u = i / (o.len * SR);
    phase += (10 + 40 * Math.sin(Math.PI * u)) / SR;
    if (phase < 1) continue;
    phase -= 1;
    const f = 2600 * (0.92 + 0.16 * uni(s, c));
    const clip = body(seedOf(s, 'click', c), [
      [f, 0.003, 1],
      [f * 1.7, 0.002, 0.4],
      [520, 0.008, 0.25],
    ], { ms: 0.3, grit: 0.2, len: 0.025, lowpass: 8000 });
    const a = 0.55 + 0.45 * Math.sin(Math.PI * u);
    for (let j = 0; j < clip.length && i + j < n; j++) out[i + j] += a * clip[j];
    c++;
  }
  return norm(out, 0);
}

// --- part two's sounds (session 5) ------------------------------------------------------------------

/** A light slip landing in a tray: a 3 ms breath of paper (1.5-6 kHz) over a small body round 1.9 kHz. */
export function paperTick(seed: number, k: number): Float32Array {
  const y = body(
    seedOf(seed, 'paper-tick', k),
    [
      [1900, 0.006, 0.5],
      [3300, 0.003, 0.3],
      [640, 0.01, 0.25],
    ],
    { ms: 0.6, grit: 0.4, len: 0.06, lowpass: 6500 },
  );
  const noise = whiteNoise(seedOf(seed, 'paper-tick-air', k));
  const hp = new Biquad('highpass', 1500, 0.7);
  const lp = new Biquad('lowpass', 6000, 0.7);
  for (let i = 0; i < y.length; i++) y[i] += 0.8 * lp.tick(hp.tick(noise())) * Math.exp(-i / (0.003 * SR));
  return norm(y, 0);
}

/** A plate lifting off its hooks: two small, dry metallic clicks 9 ms apart (the second softer) and a 12 ms scrape. */
export function unhook(seed: number, k: number): Float32Array {
  const click = (s: number) =>
    body(
      s,
      [
        [3100, 0.003, 1],
        [4700, 0.002, 0.5],
        [1400, 0.006, 0.4],
      ],
      { ms: 0.3, grit: 0.3, len: 0.05, lowpass: 8000 },
    );
  const a = click(seedOf(seed, 'unhook', k));
  const b = click(seedOf(seed, 'unhook-2', k));
  const lag = Math.round(0.009 * SR);
  const out = new Float32Array(a.length + lag);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  for (let i = 0; i < b.length; i++) out[i + lag] += 0.6 * b[i];
  const noise = whiteNoise(seedOf(seed, 'unhook-scrape', k));
  const hp = new Biquad('highpass', 2500, 0.7);
  const n = Math.round(0.012 * SR);
  for (let i = 0; i < n; i++) out[i + lag] += 0.12 * hp.tick(noise()) * Math.sin((Math.PI * i) / n);
  return norm(out, 0);
}

/** A cord paying out through its guide over `len` s: noise band-passed round 1.1 kHz, its level twisted (the cord's lay), eased in and out. */
export function cordRun(seed: number, o: { len: number; k?: number }): Float32Array {
  const k = o.k ?? 0;
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'cord-run', k));
  const twist = slowNoise(seedOf(seed, 'cord-twist', k), 34);
  const bp = new Svf();
  bp.set(1100, 1.6);
  const hp = new Biquad('highpass', 400, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    bp.tick(noise());
    out[i] = hp.tick(bp.bpn) * smooth(t / 0.05) * smooth((o.len - t) / 0.12) * (0.6 + 0.4 * Math.abs(twist(t)));
  }
  return norm(out, 0);
}

/** One tick of the rain: when (s from the clip's start), how loud (0..1) and where (pan). */
export interface RainTick {
  t: number;
  amp: number;
  pan: number;
}
/** A row of tiny ticks printing (STORYBOARD 8.1, "a soft rain"): each a 2 ms body of its own pitch round 3 kHz, placed at its own pan. */
export function tickRain(seed: number, ticks: readonly RainTick[]): StereoClip {
  const s = seedOf(seed, 'tick-rain');
  const end = Math.max(...ticks.map((tk) => tk.t)) + 0.03;
  const n = Math.ceil(end * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  ticks.forEach((tk, c) => {
    const f = 3000 * (0.9 + 0.2 * uni(s, c));
    const clip = body(
      seedOf(s, 'tick', c),
      [
        [f, 0.002, 1],
        [f * 1.8, 0.0012, 0.35],
        [900, 0.004, 0.2],
      ],
      { ms: 0.25, grit: 0.25, len: 0.02, lowpass: 9000 },
    );
    const a = ((clamp(tk.pan, -1, 1) + 1) * Math.PI) / 4;
    const gl = Math.cos(a) * tk.amp;
    const gr = Math.sin(a) * tk.amp;
    const i0 = Math.round(tk.t * SR);
    for (let j = 0; j < clip.length && i0 + j < n; j++) {
      l[i0 + j] += gl * clip[j];
      r[i0 + j] += gr * clip[j];
    }
  });
  return norm({ l, r }, 0);
}

/** A laptop lid shutting: a soft plastic latch (1.6 kHz) over a small, low thump of the lid's mass. */
export function lidClick(seed: number, k: number): Float32Array {
  return body(
    seedOf(seed, 'lid-click', k),
    [
      [1600, 0.01, 1],
      [2900, 0.005, 0.45],
      [380, 0.03, 0.6],
      [120, 0.05, 0.5],
    ],
    { ms: 1.4, grit: 0.2, len: 0.22, lowpass: 5000 },
  );
}

/** A vellum sheet laid down flat over `len` s: a breath of air (3-7 kHz, falling) as it comes down, and a smaller one as it settles; no landing thump. */
export function vellumLay(seed: number, o: { len: number; k?: number }): Float32Array {
  const k = o.k ?? 0;
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'vellum-lay', k));
  const grain = slowNoise(seedOf(seed, 'vellum-grain', k), 60);
  const bp = new Svf();
  const hp = new Biquad('highpass', 2000, 0.7);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 31) === 0) bp.set(5200 - 1600 * u, 0.7);
    bp.tick(noise());
    const fall = u < 0.85 ? Math.sin((Math.PI * u) / 0.85) ** 1.5 : 0;
    const settle = 0.35 * smooth((u - 0.72) / 0.08) * Math.exp(-Math.max(0, u - 0.8) * 30);
    out[i] = hp.tick(bp.bpn) * (fall + settle) * (0.75 + 0.25 * grain(i / SR)) * smooth((1 - u) / 0.04);
  }
  return norm(out, 0);
}

/** A vellum plate settling: a soft, papery tap (a 12 ms breath under 2.2 kHz over a small body round 520 Hz). */
export function vellumTap(seed: number, k: number): Float32Array {
  const y = body(
    seedOf(seed, 'vellum-tap', k),
    [
      [520, 0.02, 0.6],
      [1300, 0.01, 0.3],
    ],
    { ms: 2, grit: 0.3, len: 0.12, lowpass: 3000 },
  );
  const noise = whiteNoise(seedOf(seed, 'vellum-tap-air', k));
  const lp = new Biquad('lowpass', 2200, 0.7);
  for (let i = 0; i < y.length; i++) y[i] += 0.7 * lp.tick(noise()) * smooth(i / (0.001 * SR)) * Math.exp(-i / (0.012 * SR));
  return norm(y, 0);
}

/** A reply landing (STORYBOARD 10.3, "a soft pop"): a round sine whose pitch falls 820 → 480 Hz in about 30 ms, a 1 ms attack, an 18 ms decay, a breath of noise on its front. */
export function softPop(seed: number, k: number): Float32Array {
  const len = 0.12;
  const n = Math.ceil(len * SR);
  const out = new Float32Array(n);
  const noise = whiteNoise(seedOf(seed, 'soft-pop', k));
  const lp = new Biquad('lowpass', 3000, 0.7);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 480 + 340 * Math.exp(-t / 0.012);
    out[i] = lp.tick(smooth(t / 0.001) * Math.exp(-t / 0.018) * (Math.sin(p) + 0.25 * noise() * Math.exp(-t / 0.002)));
    p += (TAU * f) / SR;
  }
  return norm(out, 0);
}
