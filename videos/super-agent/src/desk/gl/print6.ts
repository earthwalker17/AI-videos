/**
 * Beat 6's printed textures (STORYBOARD 6.1-6.4; desk/beat6.ts), made once per world with the rest of the print
 * (gl/text.ts makePrintTextures calls `beat6Textures`):
 * - the window's cards from the close on (beat6.ts WINDOW_CARDS): the cells the tape held after MT1, newest first, in
 *   still (c)'s card style (a stub at the west end: its kind as a small mark over two punched holes and a perforation,
 *   the body with its full mark), so the shrink to stubs tears the bodies away from what was there;
 * - the batch's slips (the chat slip with its kind marked at its nose: the band each shows in the shingled strip);
 * - the decode slip and the answer: punched cells, a hole cut through each as it is punched (cut out, never drawn);
 * - the review's stub, the request's Thread's row (its vermilion Thread mark), the "№" tab each hop opens.
 * Readable marks are drawn as set (fillTextChecked): they never pass the shot's keep filter (marks.ts), which is for
 * micro-print.
 */
import { fillTextChecked } from '@aiv/remotion-kit';
import type { Texture } from 'three';
import { DECODE, THREAD_ROW, WINDOW_CARDS } from '../beat6.ts';
import { CACHE_WINDOW, TAPE } from '../layout.ts';
import { INK, TEXTURE_INK, TEX_CLOSE, cargoMark, rule, texture, threadMark, tooth, toothUnder, type Draw } from './text.ts';

const VERMILION = '#E8603F';
const TAPE_H = TAPE.y1 - TAPE.y0;

export interface Beat6Textures {
  /** the window's cards from the close on (beat6.ts WINDOW_CARDS), newest first */
  windowCards: Texture[];
  /** a slip of the batch (96 x 40) */
  stripSlip: Texture;
  /** the decode slip (3 cells) and the answer (2 cells), by how many cells are punched */
  decode: Texture[];
  answer: Texture[];
  /** the review's stub (a new row), the request's Thread's row */
  reviewStub: Texture;
  threadRow: Texture;
  /** a "№" tab */
  numberTab: Texture;
}

/** A card in the window as still (c) draws them (gl/text.ts cacheCells): the stub at its west end, the body's full mark east of it. */
function windowCard(w: number, kind: string, request: boolean, thread: boolean): Draw {
  const stubW = CACHE_WINDOW.stub;
  return (g) => {
    toothUnder(g, w, TAPE_H);
    g.strokeStyle = '#55534D';
    g.lineWidth = 1.2;
    g.strokeRect(1, 4, w - 2, TAPE_H - 8);
    g.save();
    g.translate(3, 10);
    g.scale(0.36, 0.36);
    cargoMark(g, kind, 0, 0, '#3E3D39');
    g.restore();
    g.fillStyle = '#5A5852';
    for (const y of [30, 40]) {
      g.beginPath();
      g.arc(9, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    if (request) {
      g.fillStyle = VERMILION;
      g.fillRect(3, 50, 12, 6);
    }
    g.setLineDash([1.6, 1.6]);
    rule(g, stubW - 0.6, 5, stubW - 0.6, TAPE_H - 5, 0.9, '#6E6A62');
    g.setLineDash([]);
    g.filter = 'blur(0.2px)';
    cargoMark(g, kind, stubW + 6, 20, '#55534D');
    g.filter = 'none';
    if (thread) {
      g.save();
      g.translate(stubW + 2, 2);
      g.scale(0.62, 0.62);
      threadMark(g, 0);
      g.restore();
    }
  };
}

/** A punched slip pointing south (its length down the texture, cell 0 the leading, southern one), `punched` of its cells cut through. */
function punchedSlip(cells: number, punched: number): Draw {
  const w = DECODE.w;
  const c = DECODE.cell;
  return (g) => {
    tooth(g, w, c * cells);
    for (let k = 0; k < cells; k++) {
      // cell k from the leading edge (v = 1 is the leading end: the texture's bottom row is the south end)
      const y0 = c * (cells - 1 - k);
      rule(g, 2, y0 + 0.6, w - 2, y0 + 0.6, 0.7, '#B9B3A7');
      // the print beside each hole: a short bar of ink, a different length each (a token, never a word)
      g.fillStyle = '#4A4A45';
      g.fillRect(4, y0 + c / 2 - 1.2, 6 + ((k * 7) % 9), 2.4);
      if (k < punched) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.arc(w - 8, y0 + c / 2, 3, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        g.strokeStyle = '#C9C3B6';
        g.lineWidth = 0.6;
        g.beginPath();
        g.arc(w - 8, y0 + c / 2, 3, 0, Math.PI * 2);
        g.stroke();
      }
    }
  };
}

export function beat6Textures(family: string, aniso: number): Beat6Textures {
  const close = (size: readonly [number, number], draw: Draw, bg?: string) => texture(size[0], size[1], draw, aniso, bg, TEX_CLOSE);
  const windowCards = WINDOW_CARDS.map((card) => close([card.x1 - card.x0, TAPE_H], windowCard(card.x1 - card.x0, card.kind, card.request, false)));
  const stripSlip = texture(
    96,
    40,
    (g) => {
      // the chat slip's word, as faint as the shot keeps it (marks.ts), and its kind marked at its nose: the band the shingled strip shows
      g.font = `500 25px ${family}`;
      g.fillStyle = TEXTURE_INK;
      g.textBaseline = 'alphabetic';
      fillTextChecked(g, 'ask', 18, 29);
      g.save();
      g.translate(77, 12);
      g.scale(0.46, 0.8);
      cargoMark(g, 'chat', 0, 0, '#4E4C46');
      g.restore();
      rule(g, 74.5, 3, 74.5, 37, 0.6, '#C4BEB2');
      tooth(g, 96, 40);
      // its tail's swallow notch, cut out (the tray draws the slip as a flat card: alpha-tested, never blended)
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(-1, -1);
      g.lineTo(9, 20);
      g.lineTo(-1, 41);
      g.closePath();
      g.fill();
      g.restore();
    },
    aniso,
  );
  const decode = [0, 1, 2, 3].map((p) => close([DECODE.w, DECODE.cell * 3], punchedSlip(3, p), '#FFFFFF'));
  const answer = [0, 1, 2].map((p) => close([DECODE.w, DECODE.cell * 2], punchedSlip(2, p), '#FFFFFF'));
  const reviewStub = close([CACHE_WINDOW.stub, TAPE_H], (g) => {
    const w = CACHE_WINDOW.stub;
    toothUnder(g, w, TAPE_H);
    g.strokeStyle = '#55534D';
    g.lineWidth = 1.2;
    g.strokeRect(1, 4, w - 2, TAPE_H - 8);
    g.save();
    g.translate(3, 10);
    g.scale(0.36, 0.36);
    cargoMark(g, 'ci', 0, 0, INK);
    g.restore();
    g.fillStyle = '#5A5852';
    for (const y of [30, 40]) {
      g.beginPath();
      g.arc(9, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    // its stamp: one bold rule (the new row's fresh ink)
    g.fillStyle = INK;
    g.fillRect(4, 50, 10, 3);
  });
  const threadRow = close([THREAD_ROW.w, TAPE_H], (g) => {
    const w = THREAD_ROW.w;
    toothUnder(g, w, TAPE_H);
    g.strokeStyle = '#55534D';
    g.lineWidth = 1.2;
    g.strokeRect(1, 4, w - 2, TAPE_H - 8);
    // the Thread's mark, set low on the row (its north half lies under the reel's flange)
    g.save();
    g.translate(-10, 6);
    g.scale(0.78, 0.78);
    threadMark(g, 0);
    g.restore();
  });
  const numberTab = close(
    [24, 22],
    (g) => {
      g.strokeStyle = '#8E887D';
      g.lineWidth = 0.9;
      g.strokeRect(1.5, 1.5, 21, 19);
      g.font = `500 17px ${family}`;
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      fillTextChecked(g, '№', 12, 17);
    },
    '#FFFFFF',
  );
  return { windowCards, stripSlip, decode, answer, reviewStub, threadRow, numberTab };
}
