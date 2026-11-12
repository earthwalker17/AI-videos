/**
 * Beat 7's printed surfaces (desk/beat7.ts; objects/Beat7.tsx, Thread.tsx, Jobs.tsx, Replies.tsx), drawn once into CPU
 * canvases as gl/text.ts draws the film's print: world units scaled by TEX texels per unit, white paper with ink, the
 * material's colour tinting the paper. Marks and IDs, never dash or glyph lines (TREATMENT BANNED): the follow-ups carry
 * the request's ID (#0405, at the reply #0408's size, at least 18 px), the receipt a bold start mark, the dossier its
 * header band and binding, the chat reply the chat slip's own mark and its stop tab "≤ 100" (WORDS.tag100's limit, in the
 * film's sans: the print face has no ≤), the Productive plate its words (gl/plate.ts, as every trait plate).
 */
import { fillTextChecked } from '@aiv/remotion-kit';
import type { Texture } from 'three';
import { WORDS } from '../../cues.ts';
import { NOTO_SC, PLEX } from '../../look/fonts.ts';
import { DOSSIER, NOTICES, RECEIPT, RIDER, STOP_TAB, TALLY, TAB_WORDS, tallyLength } from '../beat7.ts';
import { SLIP } from '../layout.ts';
import { plateTexture } from './plate.ts';
import { INK, PRINT_FONT, cargoMark, print, texture } from './text.ts';

const VERMILION = '#E8603F';
/** The notice's row rule (gl/print6.ts's stubs' rule, a step darker so its print shows on the tape). */
const RULE = '#55534D';

export interface Beat7Textures {
  followUp: Texture;
  /** the notice row (its first mark low on it), the second mark */
  notice: Texture[];
  tally: Texture;
  receipt: Texture;
  dossier: Texture;
  productive: Texture;
}

/** The film's sans stack as the kit registers it (look/fonts.ts useFilmFonts: `"AIV <family>"` per face). */
export const SANS_CSS = `${JSON.stringify(`AIV ${PLEX.family}`)}, ${JSON.stringify(`AIV ${NOTO_SC.family}`)}`;
/** The print face as the kit registers it (FilmFrame.tsx PRINT_CSS). */
export const PRINT_CSS = `"AIV ${PRINT_FONT.family}"`;

/** The longest the tally strip gets (u): its first ticks and one a beat after (beat7.ts TALLY). */
export const TALLY_MAX = tallyLength(TALLY.first + TALLY.ticks.length);
/** The Productive plate's face (the plate's box inset 5 all round: objects/Jobs.tsx). */
export const PRODUCTIVE_FACE = [334, 54] as const;
/** The follow-up's ID (the request's: its Thread) and its size (the reply #0408's family, gl/text.ts ID_EM 30, fitted to the slip). */
export const FOLLOW_UP_ID = '#0405';
const FOLLOW_UP_EM = 27;

/** A speech bubble (a ring and its tail), the follow-up's notice mark. */
function bubble(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw: number): void {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.arc(x, y, r, Math.PI * 0.65, Math.PI * 2.45);
  g.lineTo(x - r * 0.95, y + r * 1.25);
  g.closePath();
  g.stroke();
}

/** The tally's ticks along a strip (its leading end at x = 0): four strokes and the fifth across them, a gap between groups. */
export function tallyTicks(g: CanvasRenderingContext2D, n: number, h: number, pitch: number, gap: number, lead: number, color: string, lw: number, scale = 1): void {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  const p = pitch * scale;
  const span = (5 * pitch + gap) * scale;
  const y0 = h * 0.14;
  const y1 = h * 0.86;
  for (let k = 0; k < n; k++) {
    const x = lead * scale + Math.floor(k / 5) * span;
    const j = k % 5;
    g.beginPath();
    if (j < 4) {
      g.moveTo(x + (j + 0.5) * p, y0);
      g.lineTo(x + (j + 0.5) * p, y1);
    } else {
      g.moveTo(x - 0.2 * p, y1 - 0.5);
      g.lineTo(x + 4.2 * p, y0 + 0.5);
    }
    g.stroke();
  }
}

export function beat7Textures(sans: string, printFamily: string, aniso: number): Beat7Textures {
  void sans;
  // the follow-up: a chat slip of the spout's size, the Thread's vermilion rim, the request's ID set as the reply #0408's
  const followUp = texture(
    RIDER.l,
    RIDER.w,
    (g) => {
      g.strokeStyle = VERMILION;
      g.lineWidth = 2;
      g.strokeRect(2.4, 2.4, RIDER.l - 4.8, RIDER.w - 4.8);
      // set a little west and north of the middle: the cord crosses the slip's east end (its hook) and the bay's pins stand in front of its south edge as it lies on the slot
      print(g, printFamily, FOLLOW_UP_ID, RIDER.l / 2 - 3, RIDER.w / 2 - 4 + FOLLOW_UP_EM * 0.36, FOLLOW_UP_EM, 700, INK, 'center');
    },
    aniso,
  );
  // the notices: a graphite row frame beside the Thread's row, each follow-up's vermilion bubble on it (the Thread's colour)
  const [row, mark] = NOTICES;
  const notice = [
    texture(
      row.w,
      row.h,
      (g) => {
        g.strokeStyle = RULE;
        g.lineWidth = 1.4;
        g.strokeRect(1.2, 3, row.w - 2.4, row.h - 6);
        bubble(g, row.w / 2, row.h - 15, 5, VERMILION, 2.4);
      },
      aniso,
      'transparent',
    ),
    texture(mark.w, mark.h, (g) => bubble(g, mark.w / 2, mark.h / 2 - 1, 5, VERMILION, 2.4), aniso, 'transparent'),
  ];
  // the decision tally: its ticks from its leading end (the first printed), ink on its own paper, a rule along each edge
  const tally = texture(
    TALLY_MAX,
    TALLY.w,
    (g) => {
      g.strokeStyle = '#8E8A82';
      g.lineWidth = 0.8;
      for (const y of [1.4, TALLY.w - 1.4]) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(TALLY_MAX, y);
        g.stroke();
      }
      tallyTicks(g, TALLY.first + TALLY.ticks.length, TALLY.w, TALLY.pitch, TALLY.gap, TALLY.lead, INK, 1.7);
    },
    aniso,
  );
  // the "started" receipt: a bold start mark (a pictogram, never words) under a perforation torn off the roll
  const receipt = texture(
    RECEIPT.w,
    RECEIPT.h,
    (g) => {
      g.fillStyle = INK;
      const h = RECEIPT.h * 0.56;
      const x = RECEIPT.w / 2 - h * 0.42;
      const y = RECEIPT.h * 0.56;
      g.beginPath();
      g.moveTo(x, y - h / 2);
      g.lineTo(x + h * 0.86, y);
      g.lineTo(x, y + h / 2);
      g.closePath();
      g.fill();
      g.fillStyle = '#9C978D';
      for (let k = 0; k < 9; k++) {
        g.beginPath();
        g.arc(3 + k * ((RECEIPT.w - 6) / 8), 3, 0.9, 0, Math.PI * 2);
        g.fill();
      }
    },
    aniso,
  );
  // the dossier's cover: a heavy header band, its binding's two punched holes (no sender line, no words)
  const dossier = texture(
    DOSSIER.l,
    DOSSIER.w,
    (g) => {
      g.fillStyle = '#4A4844';
      g.fillRect(8, 7, DOSSIER.l - 16, 9);
      g.fillStyle = '#6E6A62';
      g.fillRect(8, 19, DOSSIER.l * 0.42, 3);
      g.fillStyle = '#3A3936';
      for (const y of [DOSSIER.w * 0.38, DOSSIER.w * 0.72]) {
        g.beginPath();
        g.arc(DOSSIER.l - 10, y, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    },
    aniso,
  );
  const productive = plateTexture(sans, WORDS.traitProductive, PRODUCTIVE_FACE, aniso);
  return { followUp, notice, tally, receipt, dossier, productive };
}

/** 7.4's chat reply: its print, and its stop tab's face (objects/Replies.tsx). */
export function chatReplyTextures(sans: string, aniso: number): { reply: Texture; tab: Texture } {
  // the chat reply: the chat slip's own mark (gl/text.ts cargoMark, as the tape's cells print it), large, on its leading
  // part (its trailing part under the stop tab)
  const reply = texture(
    SLIP.l,
    SLIP.w,
    (g) => {
      g.save();
      g.translate(7, SLIP.w / 2 - 11);
      g.scale(1.1, 1.1);
      cargoMark(g, 'chat', 0, 0, '#4A4A45');
      g.restore();
    },
    aniso,
  );
  // the stop tab: "≤ 100" (WORDS.tag100's limit) in the film's sans on enamel (the material's colour), its digits at least 18 px
  const tab = texture(
    STOP_TAB.w,
    STOP_TAB.h,
    (g) => {
      // (its ink, measured, ends STOP_TAB.clear short of the tab's east end: tag-100's leader foot and its dot sit there, never on a glyph)
      let em = STOP_TAB.em;
      g.font = `700 ${em}px ${sans}`;
      const ink = () => {
        const m = g.measureText(TAB_WORDS);
        return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight };
      };
      while (ink().l + ink().r > STOP_TAB.w - STOP_TAB.clear - 6 && em > 26) {
        em -= 0.25;
        g.font = `700 ${em}px ${sans}`;
      }
      g.fillStyle = INK;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      fillTextChecked(g, TAB_WORDS, STOP_TAB.w - STOP_TAB.clear - ink().r, STOP_TAB.h / 2 + em * 0.36);
    },
    aniso,
  );
  return { reply, tab };
}
