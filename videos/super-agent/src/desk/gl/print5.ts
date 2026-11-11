/**
 * Beat 5's printed textures (STORYBOARD 5.1-5.2; desk/beat5.ts), made once per world with the rest of the print
 * (gl/text.ts makePrintTextures calls `beat5Textures`): the filter's chat slips, 96 x 40 u, laid on objects/Filter.tsx's
 * slip by its outline (x from its swallow-notched tail to its nose).
 * - An ask (5.1's trips and the slips the gate keeps) is plain: MT1's next slip (gl/text.ts chatNext), its word as faint
 *   as act two keeps micro-print (marks.ts keepFilm) and the paper's tooth, its specks seeded so no two print alike.
 * - Noise (each slip the gate drops onto the spike) carries one heavy ink stamp, 30 u or more across (24 px and more at
 *   0.85x), that says which rule matched it: a bot's post (BOT), a reaction and nothing else (+1), a duplicate (DUP, its
 *   twin's outline behind it), a CI status ping (CI, on its card's clipped corner). Each stamp is set at its own slant and
 *   place on its slip, so the twelve on the pile are twelve different slips; the asks never carry one, so the gate's
 *   choice reads with the sound off.
 * Stamps are drawn as set (fillTextChecked), knocked out of the ink in the paper's own tone: they never pass the shot's
 * keep filter, which is for micro-print. The stamp's ink is well lighter than the print's, so a stamp on a slip, even
 * tilted away from the light across the gate's fingers, stays over the desk's floor tone.
 */
import { fillTextChecked } from '@aiv/remotion-kit';
import type { Texture } from 'three';
import { NEXT_WORD, NOISE_STAMPS } from '../../print.ts';
import { ASK_PRINTS, SLIPS_5, type NoiseKind } from '../beat5.ts';
import { NEXT_SLIP } from '../layout.ts';
import { TEXTURE_INK, PRINT_EM, texture, tooth, type Draw } from './text.ts';

const W = NEXT_SLIP.l;
const H = NEXT_SLIP.w;
/** A stamp's ink (well lighter than the print's INK: lit on a slip tilted across the fingers it stays over the slate's floor tone) and its knocked-out letters (the paper's own tone). */
const STAMP_INK = '#77746B';
const KNOCKOUT = '#E4E0D7';

export interface Beat5Textures {
  /** the asks' prints (beat5.ts ASK_PRINTS variants) */
  ask: Texture[];
  /** each dropped slip's own print, by its place on the pile (beat5.ts Slip5.print.v) */
  noise: Texture[];
}

/** The paper's specks, seeded per slip (as Intake.tsx chatSlipPrint), so no two slips print alike. */
function specks(g: CanvasRenderingContext2D, seed: number): void {
  g.fillStyle = 'rgba(70,64,54,0.10)';
  const n = Math.round((W * H) / 40);
  for (let i = 0; i < n; i++) {
    const a = Math.imul(i + 1 + seed * 7919, 2654435761) >>> 0;
    const b = Math.imul(i + 13 + seed * 104729, 2246822519) >>> 0;
    g.fillRect(((a % 10007) / 10007) * W, ((b % 10009) / 10009) * H, 0.7, 0.7);
  }
}

/** A deterministic value in [0, 1) for slip `v`'s detail `k`. */
const hash = (v: number, k: number): number => ((Math.imul(v * 31 + k * 977 + 7, 2654435761) >>> 0) % 10007) / 10007;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/** The stamp's word, knocked out of its ink, centred on (0, 0) of the stamp's frame. */
function knockout(g: CanvasRenderingContext2D, family: string, text: string, size: number, dx = 0): void {
  g.font = `700 ${size}px ${family}`;
  g.fillStyle = KNOCKOUT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fillTextChecked(g, text, dx, size * 0.04);
}

/** One rule's stamp, its centre at the stamp frame's origin (about 30 u tall: 24 px at 0.85x). */
function stamp(g: CanvasRenderingContext2D, family: string, kind: NoiseKind): void {
  g.fillStyle = STAMP_INK;
  g.strokeStyle = STAMP_INK;
  if (kind === 'bot') {
    roundRect(g, -28, -15, 56, 30, 6);
    g.fill();
    knockout(g, family, NOISE_STAMPS.bot, 20);
  } else if (kind === 'react') {
    // a reaction alone: a round badge, nothing else on the slip
    g.beginPath();
    g.arc(0, 0, 16.5, 0, Math.PI * 2);
    g.fill();
    knockout(g, family, NOISE_STAMPS.react, 20, -0.5);
  } else if (kind === 'dup') {
    // a duplicate: its twin's outline behind it, offset up and along
    g.lineWidth = 2.6;
    roundRect(g, -20, -17, 46, 27, 5);
    g.stroke();
    roundRect(g, -26, -11, 46, 27, 5);
    g.fill();
    knockout(g, family, NOISE_STAMPS.dup, 17, -3);
  } else {
    // a CI ping: its card's clipped corner (the CI feeder's cards, objects/Intake.tsx)
    g.beginPath();
    g.moveTo(-24 + 10, -15);
    g.lineTo(24, -15);
    g.lineTo(24, 15);
    g.lineTo(-24, 15);
    g.lineTo(-24, -15 + 10);
    g.closePath();
    g.fill();
    knockout(g, family, NOISE_STAMPS.ci, 21, 2);
  }
}

/** An ask's print: its word, faint (act two's micro-print), at a shifted place per variant, over the paper's tooth and specks. */
function askPrint(family: string, v: number): Draw {
  return (g) => {
    g.font = `500 ${PRINT_EM}px ${family}`;
    g.fillStyle = TEXTURE_INK;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    fillTextChecked(g, NEXT_WORD, 16 + 4 * v, 29 - (v % 2) * 3);
    tooth(g, W, H);
    specks(g, 101 + v);
  };
}

/** A dropped slip's print: its rule's stamp at its own slant and place, over the paper's tooth and specks. */
function noisePrint(family: string, kind: NoiseKind, v: number): Draw {
  return (g) => {
    tooth(g, W, H);
    specks(g, 11 + v * 3);
    g.save();
    g.translate(46 + 16 * hash(v, 1), H / 2 + 3 * (hash(v, 2) - 0.5));
    g.rotate((hash(v, 3) - 0.5) * 0.3);
    stamp(g, family, kind);
    g.restore();
  };
}

export function beat5Textures(family: string, aniso: number): Beat5Textures {
  const tex = (draw: Draw) => texture(W, H, draw, aniso);
  const ask = Array.from({ length: ASK_PRINTS }, (_, v) => tex(askPrint(family, v)));
  const noise = SLIPS_5.flatMap((s) => (s.print.kind === 'noise' ? [tex(noisePrint(family, s.print.noise, s.print.v))] : []));
  return { ask, noise };
}
