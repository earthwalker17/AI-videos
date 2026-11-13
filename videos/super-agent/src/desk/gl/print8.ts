/**
 * Beat 8's printed sheet (STORYBOARD 8.1-8.5; desk/beat8.ts): every mark and word on the test sheet, drawn once into CPU
 * canvases (the kit's textCanvas, fillTextChecked) by objects/Evidence.tsx when the sheet first comes into the world.
 * Every word is a cues.ts WORDS string set as it reads (never re-worded, never broken), in the film's sans (IBM Plex Sans
 * SemiBold), its EN alone: the zh policy (look/zhInPicture.ts, the user, 2026-11-14) keeps no zh on the sheet; a string
 * whose zh it kept would be set "EN · zh" on its one line, its Han a step lighter, at least 36 px on screen at FRAMING_SHEET
 * (beat8.test holds every em). The hero stamps are the film's numbers face (the print stack's IBM Plex Mono, bold),
 * 160-220 px; "~½" is set as a tilde and a built fraction (a raised 1, a continuous solidus, a lowered 2), since the
 * face's ½ glyph splits its slash. Ink is never an alpha fade: each print inks in over 3 f (gl/text.ts stagedInk: the
 * strokes' cores in a speckle, the cores, the whole), the stamps carrying a little of the rubber's wear.
 *
 * - the load line: 300 ticks in two staggered rows (the work requests' 20 bold in full ink, the rest a faint rain, each
 *   its own length), on a transparent decal the carriage's print edge uncovers;
 * - the caveat stamp; the legend with its two samples (a strip's hole for typical, a strip's cut for slowest); each
 *   lane's name (the two baselines in a lighter ink, "two levels" in full); the bracket's rings round both holes; the
 *   token header; the hero stamps (drawn white: Evidence.tsx sets their ink colour, so a stamp can step to the light
 *   print when the next one lands);
 * - each lane's paper strip in its stock (the two baselines a mid stock, "two levels" dark), its slowest run its length:
 *   the typical run's hole (cut out, with a printed ring), the cut's end bar, its delegation notches (cut out, a shade
 *   line round each cut edge): none on the single session's, the told-to-delegate strip by how many are punched, the
 *   two-level strip with all five; the long run's band; a punched chad; a stack's sheet in each lane's stock (blank, an
 *   edge rule and its edge's shade only).
 *
 * Every canvas draws in sheet units (u east, v south), so a decal lies on its box the right way up. A string wider than
 * the box it was planned for throws (the render fails), so no word ever runs off its place.
 */
import { fillTextChecked } from '@aiv/remotion-kit';
import type { Texture } from 'three';
import { BEAT_8, WORDS } from '../../cues.ts';
import { NOTO_SC, PLEX } from '../../look/fonts.ts';
import { zhInPicture } from '../../look/zhInPicture.ts';
import { BAND, BRACKET, CAVEAT, CLAMP, HOLE_R, LANE_EM, LANES8, LEGEND, NAME_U, NOTCH, ORIGIN_U, STAMPS8, STRIP_W, TICKS, TOKENS, holeAt, stripLength, tickFrac, tickU } from '../beat8.ts';
import { INK, PRINT_FONT, rule, stagedInk, texture, tooth, toothUnder, type Draw } from './text.ts';

/** The CSS families as the kit's useFont registers them ("AIV <family>"): the sans stack, and the print stack's mono. */
const SANS = `${JSON.stringify(`AIV ${PLEX.family}`)}, ${JSON.stringify(`AIV ${NOTO_SC.family}`)}`;
const MONO = JSON.stringify(`AIV ${PRINT_FONT.family}`);
/** Texels per unit: the print read at FRAMING_SHEET (about 0.7 px a unit: 3.4 texels a pixel); the ticks and strips finer. */
const TEX8 = 2.4;
const TEX_FINE = 4;
const TEX_STRIP = 3;
/** The two baselines' lighter print (their names), the light print a stamp steps to; INK for "two levels", the stamps and the key. */
export const INK_LIGHT = '#5E5B55';
/** The faint print: the load line's rain, the reach tracks. */
const PRINT_LIGHT = '#8E8A82';
/** Print on the dark stock (the two-level strip's ring and cut, its stack's edge): a light ink. */
const INK_ON_DARK = '#E6E1D5';
/** Each lane's paper stock (a strip, its stack's sheets): the two baselines a mid stock, "two levels" dark; the long run's band a step under the told-to-delegate stock. */
export const STOCK = ['#9E988B', '#9E988B', '#4F4D48'] as const;
const BAND_STOCK = '#6C675E';
/** The marks on each stock (its hole's ring, its cut's end bar, its edges). */
const MARK = [INK, INK, INK_ON_DARK] as const;
/** A cut edge's shade line (the paper's thickness at a hole or a notch). */
const CUT_SHADE = 'rgba(56,53,47,0.6)';
/** A sheet-local box: u0..u1 east, v0..v1 south. */
export interface Box8 {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** One line of the sheet's words: a WORDS string's EN, and its zh only where the zh policy keeps it (it keeps none here). */
interface SheetLine {
  en: string;
  zh?: string;
}
const sheetLine = (w: { en: string; 'zh-Hans': string }): SheetLine => {
  const zh = zhInPicture(w);
  return zh === null ? { en: w.en } : { en: w.en, zh };
};
/** Each lane's name: one line (LANES8's names). */
export const NAME_LINES: readonly SheetLine[][] = [[sheetLine(WORDS.laneOne)], [sheetLine(WORDS.laneTold)], [sheetLine(WORDS.laneTwo)]];
/** The caveat stamp's line, the legend's two entries, the token header's line. */
export const CAVEAT_LINE = sheetLine(WORDS.tagChart);
export const LEGEND_LINES = [sheetLine(WORDS.legendTypical), sheetLine(WORDS.legendSlowest)] as const;
export const HEAD_LINE = sheetLine(WORDS.tokenHead);
/** Every line of words the sheet sets (the hero stamps are numbers), as it reads: the tests hold it to the zh policy. */
export const SHEET_TEXT: readonly string[] = [CAVEAT_LINE, ...NAME_LINES.flat(), ...LEGEND_LINES, HEAD_LINE].map((l) => (l.zh ? `${l.en} · ${l.zh}` : l.en));

/** Set a line of words at an em: EN (and the dot) at 600, a kept zh at 500 (the labels' weights), left-aligned from x; returns its width. */
function setLine(g: CanvasRenderingContext2D, line: SheetLine, x: number, y: number, em: number, colour: string, measureOnly = false): number {
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = colour;
  let w = 0;
  const run = (text: string, weight: number) => {
    g.font = `${weight} ${em}px ${SANS}`;
    if (!measureOnly) fillTextChecked(g, text, x + w, y);
    w += g.measureText(text).width;
  };
  if (line.zh) {
    run(`${line.en} · `, 600);
    run(line.zh, 500);
  } else run(line.en, 600);
  return w;
}

/** Every string set wider than the `room` it was planned for (beat8Textures throws with all of them: the render fails). */
const overruns: string[] = [];
function fits(what: string, w: number, room: number): void {
  if (w > room + 0.01) overruns.push(`"${what}" is ${w.toFixed(1)} u wide, its place has ${room.toFixed(1)} u`);
}

/** The rubber's wear on a stamp: a few small specks of the paper lifted out of the ink, at low contrast (index-hashed, seeded per stamp). */
function wear(g: CanvasRenderingContext2D, w: number, h: number, seed: number, density = 0.012): void {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,0.4)';
  const n = Math.round(w * h * density);
  for (let i = 0; i < n; i++) {
    const a = Math.imul(i + 1 + seed * 7919, 2654435761) >>> 0;
    const b = Math.imul(i + 17 + seed * 104729, 2246822519) >>> 0;
    const s = 0.6 + ((a >>> 20) % 7) / 10;
    g.fillRect(((a % 10007) / 10007) * w, ((b % 10009) / 10009) * h, s, s);
  }
  g.restore();
}

/** A print's three ink stages (stagedInk) on a transparent decal of `box`. */
function inked(box: Box8, ink: Draw, scale = TEX8, aniso = 8): Texture[] {
  const w = box.u1 - box.u0;
  const h = box.v1 - box.v0;
  return [0, 1, 2].map((stage) => texture(w, h, (g) => stagedInk(g, w, h, scale, stage, ink), aniso, 'transparent', scale));
}

// ------------------------------------------------------------------------------------------------
// The decals' boxes (sheet units), shared with objects/Evidence.tsx

/** The longest run's reach (the single session's cut): the lanes' tracks run to it. */
const REACH = ORIGIN_U + stripLength(0);
/** The lanes' printed tracks (on the sheet from the start: no words): the origin rule by the clamp, each lane's dotted track to the longest run's reach. */
export const TRACKS_BOX: Box8 = { u0: ORIGIN_U - 6, u1: REACH + 8, v0: CLAMP.v0, v1: CLAMP.v1 };
export const TICKS_BOX: Box8 = { u0: TICKS.u0 - 4, u1: tickU(BEAT_8.ticks.n - 1) + 4, v0: TICKS.inked[0] - 2, v1: TICKS.inked[1] + 2 };
export const CAVEAT_BOX: Box8 = { u0: CAVEAT.u0, u1: CAVEAT.u1, v0: CAVEAT.v0, v1: CAVEAT.v1 };
/** Each lane name's box: from NAME_U to where its line may run (the stamps' column starts east of it). */
export const NAME_BOX: readonly Box8[] = LANES8.map((l, i) => {
  const vs = l.names.map((n) => n.v);
  return { u0: NAME_U - 2, u1: i === 1 ? NAME_U + 760 : NAME_U + 640, v0: Math.min(...vs) - LANE_EM, v1: Math.max(...vs) + 0.3 * LANE_EM };
});
export const LEGEND_BOX: Box8 = { u0: LEGEND.u - 4, u1: LEGEND.u + 860, v0: LEGEND.v - LEGEND.em, v1: LEGEND.v + 0.3 * LEGEND.em };
/** The bracket's rings round both holes and their leaders down (and up) to its serifs (the serifs and bar are Evidence.tsx's, on a spring). */
const RING_R = HOLE_R + 4.6;
export const RINGS_BOX: Box8 = { u0: BRACKET.b[0] - RING_R - 6, u1: BRACKET.a[0] + RING_R + 6, v0: BRACKET.a[1] - RING_R - 6, v1: BRACKET.b[1] + RING_R + 6 };
export const HEAD_BOX: Box8 = { u0: TOKENS.head.u - 2, u1: TOKENS.head.u + 720, v0: TOKENS.head.v - TOKENS.head.em, v1: TOKENS.head.v + 0.3 * TOKENS.head.em };
/** A hero stamp's box: its glyphs' advance (its `adv` ems) and its height above the baseline, a margin round them. */
export const stampBox = (id: keyof typeof STAMPS8): Box8 => {
  const s = STAMPS8[id];
  return { u0: s.u - 10, u1: s.u + s.adv * s.em + 10, v0: s.v - 0.82 * s.em, v1: s.v + 0.12 * s.em };
};
/** The long run's band, a chad, a stack's sheet (u x v). */
export const BAND_SIZE = [BAND.u1 - BAND.u0, BAND.v1 - BAND.v0] as const;
export const CHAD_SIZE = [NOTCH.w - 2, NOTCH.d] as const;
export const SHEET_SIZE = [TOKENS.sheetW, TOKENS.rows[0][1] - TOKENS.rows[0][0]] as const;

export interface Beat8Textures {
  tracks: Texture;
  ticks: Texture;
  caveat: Texture[];
  names: Texture[][];
  legend: Texture[];
  rings: Texture[];
  head: Texture[];
  /** white glyphs: their material's colour is the ink */
  stamps: Record<keyof typeof STAMPS8, Texture[]>;
  /** each lane's strip: one, the told-to-delegate strip by punched notches (0..4) */
  strips: Texture[][];
  band: Texture;
  chad: Texture;
  /** each lane's stack sheet, in two prints */
  sheets: Texture[][];
}

/** A notch's outline (a U bitten into an edge at y = 0 going +y, its width w, depth d), centred on s. */
function notchPath(g: CanvasRenderingContext2D, s: number, w: number, d: number): void {
  const r = w / 2;
  g.beginPath();
  g.moveTo(s - r, -2);
  g.lineTo(s - r, d - r * 0.55);
  g.quadraticCurveTo(s - r, d, s - r * 0.45, d);
  g.lineTo(s + r * 0.45, d);
  g.quadraticCurveTo(s + r, d, s + r, d - r * 0.55);
  g.lineTo(s + r, -2);
  g.closePath();
}

/**
 * A lane's strip, its tail at s 0 (the run's start, under the clamp) and its cut at s L (its slowest run): its stock to the
 * cut, a hair of shade along its edges, the typical run's hole with a printed ring, the cut's end bar, and `cut` notch
 * places cut out of its notched edge (north: the told-to-delegate strip; south: the two-level strip), each with a shade
 * line round its cut edge.
 */
function stripDraw(i: number, cut: readonly number[]): Draw {
  const L = stripLength(i);
  const H = STRIP_W;
  const lane = LANES8[i]!;
  const mark = MARK[i]!;
  return (g) => {
    g.fillStyle = STOCK[i]!;
    g.fillRect(0, 0, L, H);
    toothUnder(g, L, H);
    // the paper's cut edges, a hair of shade (each strip reads as its own piece on the sheet)
    g.strokeStyle = 'rgba(52,49,44,0.55)';
    g.lineWidth = 1.4;
    g.strokeRect(0.7, 0.7, L - 1.4, H - 1.4);
    // the typical run's hole: a printed ring round it (the hole itself is cut below)
    const hs = holeAt(i);
    g.strokeStyle = mark;
    g.lineWidth = 2.8;
    g.beginPath();
    g.arc(hs, lane.hole, HOLE_R + 2.6, 0, Math.PI * 2);
    g.stroke();
    // the cut: the slowest run's end bar
    g.fillStyle = mark;
    g.fillRect(L - 10, 0, 6, H);
    tooth(g, L, H);
    // the cut-outs (alpha: the strip's material is alpha-tested, never blended): the hole, each cut notch on its edge
    const onEdge = (fn: () => void) => {
      g.save();
      if (lane.notches === 'south') {
        g.translate(0, H);
        g.scale(1, -1);
      }
      fn();
      g.restore();
    };
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(hs, lane.hole, HOLE_R, 0, Math.PI * 2);
    g.fill();
    onEdge(() => {
      for (const k of cut) {
        notchPath(g, NOTCH.s[k]!, NOTCH.w, NOTCH.d);
        g.fill();
      }
    });
    g.restore();
    // each cut edge's shade line (the paper's thickness)
    g.strokeStyle = CUT_SHADE;
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(hs, lane.hole, HOLE_R + 0.8, 0, Math.PI * 2);
    g.stroke();
    onEdge(() => {
      for (const k of cut) {
        notchPath(g, NOTCH.s[k]!, NOTCH.w + 1.6, NOTCH.d + 0.8);
        g.stroke();
      }
    });
  };
}

/** "~½" as the stamp sets it, at em from x on the baseline y: the tilde, then a raised 1, a continuous solidus and a lowered 2 (returns its advance). */
function halfStamp(g: CanvasRenderingContext2D, x: number, y: number, em: number, measureOnly = false): number {
  const [tilde] = [...WORDS.stampHalf.en];
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `700 ${em}px ${MONO}`;
  const tw = g.measureText(tilde!).width;
  const small = 0.54 * em;
  const fx = x + tw - 0.04 * em;
  if (!measureOnly) {
    fillTextChecked(g, tilde!, x, y);
    g.font = `700 ${small}px ${MONO}`;
    // the numerator's cap top on the face's cap height, the denominator on the baseline
    fillTextChecked(g, '1', fx, y - 0.7 * em + 0.7 * small);
    fillTextChecked(g, '2', fx + 0.34 * em, y);
    g.lineCap = 'butt';
    rule(g, fx + 0.12 * em, y + 0.02 * em, fx + 0.5 * em, y - 0.74 * em, 0.085 * em, g.fillStyle as string);
  }
  return tw - 0.04 * em + 0.34 * em + 0.6 * small;
}

/** Every texture of the test sheet (once per world, when the sheet first comes in: the faces are in by then). */
export function beat8Textures(aniso: number): Beat8Textures {
  overruns.length = 0;
  // ---- the lanes' tracks: the origin rule, each lane's dotted track to the longest run's reach (the scale the strips are cut on)
  const kb = TRACKS_BOX;
  const tracks = texture(
    kb.u1 - kb.u0,
    kb.v1 - kb.v0,
    (g) => {
      const x0 = ORIGIN_U - kb.u0;
      const reach = REACH - kb.u0;
      rule(g, x0 - 2, 2, x0 - 2, kb.v1 - kb.v0 - 2, 1.2, '#A9A397');
      g.setLineDash([3, 5]);
      for (const l of LANES8) {
        const y = (l.strip[0] + l.strip[1]) / 2 - kb.v0;
        rule(g, x0, y, reach, y, 1.2, '#B3ADA1');
      }
      g.setLineDash([]);
      for (const l of LANES8) {
        const y = (l.strip[0] + l.strip[1]) / 2 - kb.v0;
        rule(g, reach, y - 12, reach, y + 12, 1.4, '#A9A397');
      }
    },
    aniso,
    'transparent',
    1.6,
  );

  // ---- the load line: the 20 bold in full ink across both rows, the rest a faint rain (each its own length from its row's outer edge)
  const tb = TICKS_BOX;
  const inkedSet = new Set<number>(BEAT_8.ticks.inked);
  const ticks = texture(
    tb.u1 - tb.u0,
    tb.v1 - tb.v0,
    (g) => {
      for (let i = 0; i < BEAT_8.ticks.n; i++) {
        const x = tickU(i) - tb.u0;
        if (inkedSet.has(i)) {
          g.fillStyle = INK;
          g.fillRect(x - TICKS.inkedW / 2, TICKS.inked[0] - tb.v0, TICKS.inkedW, TICKS.inked[1] - TICKS.inked[0]);
        } else {
          const [a, b] = TICKS.rows[i % 2]!;
          const len = (b - a) * tickFrac(i);
          const y0 = i % 2 === 0 ? a : b - len;
          g.fillStyle = PRINT_LIGHT;
          g.fillRect(x - TICKS.w / 2, y0 - tb.v0, TICKS.w, len);
        }
      }
    },
    aniso,
    'transparent',
    TEX_FINE,
  );

  // ---- the caveat stamp: a rubber stamp's frame across the sheet, its line
  const cb = CAVEAT_BOX;
  const caveat = inked(cb, (g) => {
    const w = cb.u1 - cb.u0;
    const h = cb.v1 - cb.v0;
    g.strokeStyle = INK;
    g.lineWidth = 3.2;
    g.beginPath();
    g.roundRect(3, 3, w - 6, h - 6, 12);
    g.stroke();
    g.lineWidth = 1.1;
    g.beginPath();
    g.roundRect(9, 9, w - 18, h - 18, 8);
    g.stroke();
    const pad = 22;
    fits(WORDS.tagChart.en, setLine(g, CAVEAT_LINE, 0, 0, CAVEAT.em, INK, true), w - 2 * pad);
    setLine(g, CAVEAT_LINE, pad, CAVEAT.en - cb.v0, CAVEAT.em, INK);
    wear(g, w, h, 81, 0.01);
  });

  // ---- the lane names: the two baselines in the lighter ink, "two levels" in full
  const names = LANES8.map((lane, i) => {
    const b = NAME_BOX[i]!;
    return inked(b, (g) => {
      lane.names.forEach((n, k) => {
        const line = NAME_LINES[i]![k]!;
        const colour = i === 2 ? INK : INK_LIGHT;
        fits(line.en, setLine(g, line, 0, 0, LANE_EM, colour, true), b.u1 - b.u0 - 4);
        setLine(g, line, 2, n.v - b.v0, LANE_EM, colour);
      });
    });
  });

  // ---- the legend: a strip's stub with its hole (typical), a strip's stub with its cut (slowest), in a baseline's stock
  const lb = LEGEND_BOX;
  const legend = inked(lb, (g) => {
    const y = LEGEND.v - lb.v0;
    const mid = y - 0.34 * LEGEND.em;
    const stub = (x: number, end: boolean) => {
      g.fillStyle = STOCK[0];
      g.fillRect(x, mid - 15, 58, 30);
      g.strokeStyle = 'rgba(52,49,44,0.55)';
      g.lineWidth = 1.4;
      g.strokeRect(x + 0.7, mid - 14.3, 56.6, 28.6);
      g.fillStyle = INK;
      if (end) g.fillRect(x + 48, mid - 15, 6, 30);
      else {
        g.strokeStyle = INK;
        g.lineWidth = 2.8;
        g.beginPath();
        g.arc(x + 29, mid, 9.5, 0, Math.PI * 2);
        g.stroke();
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.arc(x + 29, mid, 7, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    };
    stub(4, false);
    const a = setLine(g, LEGEND_LINES[0], 76, y, LEGEND.em, INK);
    const x2 = 76 + a + 56;
    stub(x2, true);
    const b2 = setLine(g, LEGEND_LINES[1], x2 + 72, y, LEGEND.em, INK);
    fits('legend', x2 + 72 + b2, lb.u1 - lb.u0);
  });

  // ---- the bracket's rings round both holes (full ink on the mid stock, the light ink on the dark), their leaders to the serifs
  const rb = RINGS_BOX;
  const rings = inked(rb, (g) => {
    const [ax, ay] = [BRACKET.a[0] - rb.u0, BRACKET.a[1] - rb.v0];
    const [bx, by] = [BRACKET.b[0] - rb.u0, BRACKET.b[1] - rb.v0];
    const bar = BRACKET.bar - rb.v0;
    g.lineCap = 'butt';
    g.lineWidth = 4.6;
    g.strokeStyle = INK;
    g.beginPath();
    g.arc(ax, ay, RING_R - 2.3, 0, Math.PI * 2);
    g.stroke();
    rule(g, ax, ay + RING_R, ax, bar - BRACKET.serif + 1, 4.6, INK);
    g.strokeStyle = INK_ON_DARK;
    g.beginPath();
    g.arc(bx, by, RING_R - 2.3, 0, Math.PI * 2);
    g.stroke();
    rule(g, bx, by - RING_R, bx, bar + BRACKET.serif - 1, 4.6, INK);
  });

  // ---- the token header: one line over the stacks
  const hb = HEAD_BOX;
  const head = inked(hb, (g) => {
    fits(HEAD_LINE.en, setLine(g, HEAD_LINE, 0, 0, TOKENS.head.em, INK, true), hb.u1 - hb.u0 - 4);
    setLine(g, HEAD_LINE, 2, TOKENS.head.v - hb.v0, TOKENS.head.em, INK);
  });

  // ---- the hero stamps: the numbers face, bold, in white (the material's colour is the ink), a little of the rubber's wear
  const stamp = (id: keyof typeof STAMPS8, seed: number): Texture[] => {
    const b = stampBox(id);
    const s = STAMPS8[id];
    return inked(b, (g) => {
      g.fillStyle = '#FFFFFF';
      g.font = `700 ${s.em}px ${MONO}`;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      if (id === 'half') {
        fits(WORDS.stampHalf.en, halfStamp(g, 0, 0, s.em, true), b.u1 - b.u0 - 20);
        halfStamp(g, 10, s.v - b.v0, s.em);
      } else {
        const text = id === 'ten' ? WORDS.stampTen.en : WORDS.stampTokens.en;
        fits(text, g.measureText(text).width, b.u1 - b.u0 - 20);
        fillTextChecked(g, text, 10, s.v - b.v0);
      }
      wear(g, b.u1 - b.u0, b.v1 - b.v0, seed);
    });
  };
  const stamps = { half: stamp('half', 11), ten: stamp('ten', 12), tokens: stamp('tokens', 13) };

  // ---- the strips: one blank (it never delegated), the told-to-delegate strip by punched notches (its punches in BEAT_8.notches' order), two levels with all five cut
  const told = BEAT_8.notches.map((n, k) => (n.punched ? k : -1)).filter((k) => k >= 0);
  const strip = (i: number, cut: readonly number[]) => texture(stripLength(i), STRIP_W, stripDraw(i, cut), aniso, '#FFFFFF', TEX_STRIP);
  const strips = [[strip(0, [])], told.map((_, n) => strip(1, told.slice(0, n))).concat([strip(1, told)]), [strip(2, [0, 1, 2, 3, 4])]];

  // ---- the long run's band: the run the model did itself, a step under the told-to-delegate stock, its end bar at the cut
  const [BL, BH] = BAND_SIZE;
  const band = texture(
    BL,
    BH,
    (g) => {
      g.fillStyle = BAND_STOCK;
      g.fillRect(0, 0, BL, BH);
      toothUnder(g, BL, BH);
      g.strokeStyle = 'rgba(40,38,34,0.6)';
      g.lineWidth = 1.4;
      g.strokeRect(0.7, 0.7, BL - 1.4, BH - 1.4);
      g.fillStyle = INK;
      g.fillRect(BL - 10, 0, 6, BH);
      tooth(g, BL, BH);
    },
    aniso,
    '#FFFFFF',
    TEX_STRIP,
  );

  // ---- a punched chad: the notch's own shape in the told-to-delegate stock (alpha outside it), its cut edge's shade
  const [CW, CH] = CHAD_SIZE;
  const chad = texture(
    CW,
    CH,
    (g) => {
      g.clearRect(0, 0, CW, CH);
      g.save();
      notchPath(g, CW / 2, CW - 1, CH - 0.6);
      g.clip();
      g.fillStyle = STOCK[1];
      g.fillRect(0, 0, CW, CH);
      toothUnder(g, CW, CH);
      g.restore();
      g.strokeStyle = CUT_SHADE;
      g.lineWidth = 1.4;
      notchPath(g, CW / 2, CW - 2, CH - 1.2);
      g.stroke();
    },
    aniso,
    'transparent',
    TEX_STRIP,
  );

  // ---- a stack's sheet in each lane's stock: blank, an edge rule, its east edge's shade (the sheet's thickness over the one under it)
  const [SW, SH] = SHEET_SIZE;
  const sheets = STOCK.map((stock, i) =>
    [0, 1].map((v) =>
      texture(
        SW,
        SH,
        (g) => {
          g.fillStyle = stock;
          g.fillRect(0, 0, SW, SH);
          toothUnder(g, SW, SH);
          const edge = g.createLinearGradient(SW - 4, 0, SW, 0);
          edge.addColorStop(0, 'rgba(30,28,25,0)');
          edge.addColorStop(1, i === 2 ? 'rgba(20,19,17,0.55)' : 'rgba(40,38,34,0.5)');
          g.fillStyle = edge;
          g.fillRect(SW - 4, 0, 4, SH);
          g.strokeStyle = i === 2 ? 'rgba(230,225,213,0.35)' : 'rgba(52,49,44,0.5)';
          g.lineWidth = 1 + 0.2 * v;
          g.strokeRect(0.6, 0.6, SW - 1.2, SH - 1.2);
          tooth(g, SW, SH);
        },
        aniso,
        '#FFFFFF',
        TEX_STRIP,
      ),
    ),
  );

  if (overruns.length) throw new Error(`print8: ${overruns.join('; ')} (desk/beat8.ts)`);
  return { tracks, ticks, caveat, names, legend, rings, head, stamps, strips, band, chad, sheets };
}
