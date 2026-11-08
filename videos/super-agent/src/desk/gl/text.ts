/**
 * The Register Desk's printed surfaces: micro-print and marks drawn once into CPU canvases (the
 * kit's `textCanvas`, `fillTextChecked`) and used as textures (docs/ARCHITECTURE.md decision 30,
 * "Text inside the world"). They are made only after every face is loaded: the Stage3D mounts only
 * once the fonts are ready (desk/DeskFrame.tsx), so each canvas is drawn once, with its face in.
 *
 * Every string comes from src/print.ts and is set at 21.5 u or more, at least 18 px on screen at
 * the 0.85× framing. Printed fields that carry information are marks at this distance (TREATMENT,
 * Type: ≥ 36 px fields only in planned close shots): the window's cells show the shape of what came
 * in, not its number. Canvases are drawn in world units (scaled by TEX texels per unit), white paper
 * with ink: the material's colour tints the paper.
 */
import { fillTextChecked, textCanvas, type FontSpec } from '@aiv/remotion-kit';
import mono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2';
import mono700 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2';
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { WORDS } from '../../cues.ts';
import { CELLS, DOSSIER, FANFOLD, GALLEY, IN_TRAY, NAMEPLATE, POLICY, PRINT_STRINGS, REPLY, REPORT, SLIPS } from '../../print.ts';
import { BAYS, CARD, CELLS_X, REEL, SLIP, TAPE, TAPE_FLAT_X1, TRAIT_PLATE, type BayId, type BayLayout } from '../layout.ts';

/** IBM Plex Mono's latin files (its unicode.json `latin` range), the two weights the print uses. */
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const PRINT_FONT: FontSpec = {
  family: 'Register Print',
  sources: [
    { url: mono500, unicodeRange: LATIN, weight: '500' },
    { url: mono700, unicodeRange: LATIN, weight: '700' },
  ],
  sample: PRINT_STRINGS.join(' '),
};

/** Texels per world unit (about 2.4 per screen pixel at 0.85×). */
export const TEX = 2.8;
/** The smallest print, in world units: 18 px on screen at 0.85×. */
export const PRINT_EM = 21.5;
const INK = '#2A2B2A';
const VERMILION = '#E8603F';

type Draw = (g: CanvasRenderingContext2D) => void;

function texture(w: number, h: number, draw: Draw, aniso: number, bg = '#FFFFFF'): Texture {
  const { c, g } = textCanvas(Math.ceil(w * TEX), Math.ceil(h * TEX));
  g.scale(TEX, TEX);
  if (bg === 'transparent') g.clearRect(0, 0, w, h);
  else {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Text in a face at `size` world units (weight 500 or 700), ink colour. */
function print(g: CanvasRenderingContext2D, family: string, text: string, x: number, y: number, size = PRINT_EM, weight: 500 | 700 = 500, color = INK, align: CanvasTextAlign = 'left'): void {
  g.font = `${weight} ${size}px ${family}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  fillTextChecked(g, text, x, y);
}

/** A thin rule (ink at a weight). */
function rule(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1.2, color = INK): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

/**
 * A cell's mark: the silhouette of what came in, in the film's own cargo shapes (not app icons),
 * about 30 u wide (25 px): a notched chat slip, a punched CI card with its clipped corner, a docs
 * report (a sheet with a folded corner), a test report (a card with its punched hole).
 */
function cargoMark(g: CanvasRenderingContext2D, kind: string, x: number, y: number, color = INK): void {
  g.fillStyle = color;
  g.beginPath();
  if (kind === 'chat') {
    g.moveTo(x, y);
    g.lineTo(x + 34, y);
    g.lineTo(x + 34, y + 20);
    g.lineTo(x + 26, y + 14);
    g.lineTo(x + 18, y + 20);
    g.lineTo(x, y + 20);
  } else if (kind === 'ci') {
    g.moveTo(x + 7, y);
    g.lineTo(x + 34, y);
    g.lineTo(x + 34, y + 21);
    g.lineTo(x, y + 21);
    g.lineTo(x, y + 7);
  } else if (kind === 'docs') {
    g.moveTo(x + 4, y - 3);
    g.lineTo(x + 22, y - 3);
    g.lineTo(x + 30, y + 5);
    g.lineTo(x + 30, y + 24);
    g.lineTo(x + 4, y + 24);
  } else {
    g.moveTo(x, y);
    g.lineTo(x + 34, y);
    g.lineTo(x + 34, y + 22);
    g.lineTo(x, y + 22);
  }
  g.closePath();
  g.fill();
  // what is punched out shows the paper: CI punch holes, the report card's hole, the docs fold
  g.fillStyle = '#FFFFFF';
  if (kind === 'ci') for (let i = 0; i < 4; i++) g.fillRect(x + 9 + i * 6, y + 8, 3, 6);
  if (kind === 'test') {
    g.beginPath();
    g.arc(x + 27, y + 11, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  if (kind === 'docs') {
    g.beginPath();
    g.moveTo(x + 22, y - 3);
    g.lineTo(x + 22, y + 5);
    g.lineTo(x + 30, y + 5);
    g.closePath();
    g.fill();
  }
}

/** Every printed texture of the frame. */
export interface PrintTextures {
  tape: Texture;
  reelTop: Texture;
  nameplate: Record<BayId, Texture>;
  dossier: Record<BayId, Texture>;
  policy: Texture;
  fanfold: Texture;
  fanfoldSide: Texture;
  report: Texture;
  galley: Texture;
  reply: Texture;
  inTray: Texture[];
  chat: Texture;
  ciCard: Texture;
  request: Texture;
  folder: Texture;
  vellumMail: Texture;
  vellumCalendar: Texture;
  gauge: Texture;
  lockFace: Texture;
  trait: Texture;
}

/** The nameplate band on a bay's south wall (its top, inset 2). */
export const bandSize = (b: BayLayout): [number, number] => [b.box.x1 - b.box.x0 - 2 * b.wall - 4, b.southWall - 4];

/** Sizes the objects lay these textures on (world units). */
export const PRINT_SIZE = {
  tape: [TAPE_FLAT_X1 - TAPE.x0, TAPE.y1 - TAPE.y0],
  trait: [TRAIT_PLATE.box.x1 - TRAIT_PLATE.box.x0 - 10, TRAIT_PLATE.box.y1 - TRAIT_PLATE.box.y0 - 10],
  dossier: [82, 66],
  policy: [74, 86],
  fanfold: [170, 80],
  report: [CARD.w, CARD.d],
  galley: [228, 82],
  reply: [SLIP.l, SLIP.w],
  inTray: [80, 52],
  chat: [80, 40],
  ciCard: [84, 50],
  request: [114, 52],
  folder: [136, 84],
  vellumMail: [124, 80],
  vellumCalendar: [124, 80],
} as const satisfies Record<string, readonly [number, number]>;

export function makePrintTextures(family: string, sans: string, aniso: number): PrintTextures {
  const S = PRINT_SIZE;
  const tex = (size: readonly [number, number], draw: Draw, bg?: string) => texture(size[0], size[1], draw, aniso, bg);

  // the tape: the five inline cells under the window as marks (the newest west, by the print head)
  const tape = tex(S.tape, (g) => {
    const [, h] = S.tape;
    CELLS.forEach((cell, i) => {
      const x = CELLS_X[i][0] - TAPE.x0;
      const w = CELLS_X[i][1] - CELLS_X[i][0];
      g.strokeStyle = INK;
      g.lineWidth = i === 0 ? 2.4 : 1.2;
      g.strokeRect(x + 2, 4, w - 4, h - 8);
      cargoMark(g, cell.kind, x + 12, 16);
      // read: the cell's punch; the request's own row carries its vermilion stub
      g.fillStyle = cell.request ? VERMILION : INK;
      g.fillRect(x + 12, 46, cell.request ? 22 : 10, 5);
    });
    // perforations along both edges; past the window the tape runs on clean onto the reel
    for (let x = 4; x < S.tape[0]; x += 9) {
      g.fillStyle = '#C9C4B8';
      g.fillRect(x, 1, 3, 1.6);
      g.fillRect(x, h - 2.6, 3, 1.6);
    }
  });

  // the reel's top: the wound tape seen edge-on, one ring per turn
  const reelTop = (() => {
    const R = REEL.packR;
    const size: [number, number] = [2 * R, 2 * R];
    return tex(
      size,
      (g) => {
        g.clearRect(0, 0, size[0], size[1]);
        const turns = 58;
        for (let k = 0; k < turns; k++) {
          const r = REEL.hubR + 2 + ((R - REEL.hubR - 2) * (k + 0.5)) / turns;
          const v = 200 + ((k * 37) % 11) * 2 - (turns - k) * 0.25;
          g.strokeStyle = `rgb(${v},${v - 4},${v - 12})`;
          g.lineWidth = ((R - REEL.hubR) / turns) * 0.86;
          g.beginPath();
          g.arc(R, R, r, 0, Math.PI * 2);
          g.stroke();
        }
        // the request's stub: a vermilion tear-off on the outer turns
        g.strokeStyle = VERMILION;
        g.lineWidth = 3.2;
        g.beginPath();
        g.arc(R, R, R - 6, -0.55, -0.35);
        g.stroke();
      },
      '#E9E4D8',
    );
  })();

  const nameplate = Object.fromEntries(
    (Object.keys(NAMEPLATE) as BayId[]).map((id) => {
      const size = bandSize(BAYS[id]);
      return [id, tex(size, (g) => print(g, family, NAMEPLATE[id], size[0] / 2, size[1] * 0.8, PRINT_EM, 700, INK, 'center'))];
    }),
  ) as Record<BayId, Texture>;

  const dossier = Object.fromEntries(
    (Object.keys(DOSSIER) as BayId[]).map((id) => [
      id,
      tex(S.dossier, (g) => {
        DOSSIER[id].forEach((line, i) => print(g, family, line, 5, 21 + i * 20, PRINT_EM, i === 0 ? 700 : 500));
      }),
    ]),
  ) as Record<BayId, Texture>;

  const policy = tex(S.policy, (g) => {
    POLICY.forEach((line, i) => print(g, family, line, 37, 24 + i * 20, PRINT_EM, i === 0 ? 700 : 500, INK, 'center'));
    rule(g, 8, 29, 66, 29, 1.2);
  });

  const fanfold = tex(S.fanfold, (g) => {
    FANFOLD.forEach((line, i) => print(g, family, line, 8, 26 + i * 25, PRINT_EM, 500, '#A29E94'));
    for (let y = 2; y < S.fanfold[1]; y += 25) rule(g, 0, y + 4, S.fanfold[0], y + 4, 0.6, '#D8D3C6');
  });
  const fanfoldSide = texture(
    170,
    30,
    (g) => {
      for (let i = 0; i < 36; i++) {
        g.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#CFCABE';
        g.fillRect(0, i * 0.83, 170, 0.83);
      }
    },
    aniso,
  );

  // the report card: its code and result, and the punched hole its transit light shines through
  const report = tex(S.report, (g) => {
    print(g, family, REPORT[0], 8, 26, PRINT_EM, 700);
    print(g, family, REPORT[1], 8, 52, PRINT_EM, 500);
    g.fillStyle = '#6E6A62';
    g.beginPath();
    g.arc(S.report[0] - 14, S.report[1] / 2, 6, 0, Math.PI * 2);
    g.fill();
  });

  // the galley: type set in lines, ink on enamel, whole lines only
  const galley = tex(S.galley, (g) => {
    GALLEY.forEach((line, i) => print(g, family, line, 10, 24 + i * 25, PRINT_EM, i === 0 ? 700 : 500, INK));
  });

  // the reply cites the report it answers; its punched hole at the trailing end carries the transit light
  const reply = tex(S.reply, (g) => {
    print(g, family, REPLY[0], 6, 19, PRINT_EM, 700);
    print(g, family, REPLY[1], 6, 37, PRINT_EM, 500);
    g.fillStyle = '#6E6A62';
    g.beginPath();
    g.arc(S.reply[0] - 9, S.reply[1] / 2, 4.5, 0, Math.PI * 2);
    g.fill();
  });

  const inTray = IN_TRAY.map((pair) =>
    tex(S.inTray, (g) => {
      print(g, family, pair[0], 6, 23, PRINT_EM, 700, '#4A4A45');
      print(g, family, pair[1], 6, 45, PRINT_EM, 500, '#4A4A45');
    }),
  );

  const chat = tex(S.chat, (g) => {
    print(g, family, SLIPS.chat, 13, 27, PRINT_EM, 500);
  });

  // the CI card: a punched card with its clipped corner (no display, no big number)
  const ciCard = tex(S.ciCard, (g) => {
    const [w, h] = S.ciCard;
    g.fillStyle = '#2A2B2A';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(12, 0);
    g.lineTo(0, 12);
    g.closePath();
    g.fill();
    print(g, family, SLIPS.card, w - 6, 22, PRINT_EM, 500, '#5A5850', 'right');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) if ((i * 7 + r * 3) % 4 !== 0) g.fillRect(8 + i * 8, 30 + r * 9, 3, 6);
    rule(g, 4, h - 4, w - 4, h - 4, 0.8, '#B5AFA3');
  });

  // the request: vermilion paper with its beetle cut-out (the folder under it shows through, darker)
  const request = tex(S.request, (g) => {
    print(g, family, SLIPS.request, 8, 24, PRINT_EM, 700, '#5E2214');
    beetle(g, 84, 26, 15);
  });

  const folder = tex(S.folder, (g) => {
    rule(g, 0, 10, S.folder[0], 10, 1.4, '#C9B6AE');
  });

  const vellumMail = texture(S.vellumMail[0], S.vellumMail[1], (g) => vellumFeeder(g, 'mail', S.vellumMail), aniso, 'transparent');
  const vellumCalendar = texture(S.vellumCalendar[0], S.vellumCalendar[1], (g) => vellumFeeder(g, 'calendar', S.vellumCalendar), aniso, 'transparent');

  // the neck-collar gauge's face: an arc of ticks, low to high
  const gauge = texture(
    32,
    32,
    (g) => {
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.75 + (1.5 * i) / 8);
        rule(g, 16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, i % 4 === 0 ? 1.6 : 0.9);
      }
    },
    aniso,
  );
  // the lock plate's face: a keyhole and its border
  const lockFace = texture(
    52,
    58,
    (g) => {
      g.fillStyle = INK;
      g.beginPath();
      g.arc(26, 22, 6.5, 0, Math.PI * 2);
      g.fill();
      g.fillRect(24, 25, 4, 15);
      g.strokeStyle = INK;
      g.lineWidth = 1.2;
      g.strokeRect(5, 5, 42, 48);
    },
    aniso,
  );

  // the trait plate along the deck's front apron: texture-size now (it was read when it docked, at C9)
  const trait = tex(S.trait, (g) => {
    const em = PRINT_EM;
    const t = `${WORDS.traitContinuous.en} · ${WORDS.traitContinuous['zh-Hans']}`;
    g.font = `600 ${em}px ${sans}`;
    g.fillStyle = INK;
    g.textAlign = 'center';
    fillTextChecked(g, t, S.trait[0] / 2, S.trait[1] * 0.78);
  });

  return { trait, tape, reelTop, nameplate, dossier, policy, fanfold, fanfoldSide, report, galley, reply, inTray, chat, ciCard, request, folder, vellumMail, vellumCalendar, gauge, lockFace };
}

/** The beetle cut-out: a small bug silhouette (the request's mark), drawn as the hole's shade. */
function beetle(g: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  g.fillStyle = '#7A2A18';
  g.beginPath();
  g.ellipse(cx, cy + 0.15 * s, 0.55 * s, 0.75 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx, cy - 0.75 * s, 0.32 * s, 0.26 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#7A2A18';
  g.lineWidth = 0.14 * s;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = cy - 0.25 * s + i * 0.42 * s;
      g.beginPath();
      g.moveTo(cx + side * 0.45 * s, y);
      g.lineTo(cx + side * 0.95 * s, y + (i - 1) * 0.3 * s);
      g.stroke();
    }
  }
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 0.08 * s;
  g.beginPath();
  g.moveTo(cx, cy - 0.5 * s);
  g.lineTo(cx, cy + 0.85 * s);
  g.stroke();
}

/**
 * A vellum feeder: a plan drawing of the feeder itself, the enamel feeders' box-and-mouth family,
 * in vellum line (dashed 14/10 at 2.5 over a 14% fill) with construction ticks: corner marks, centre
 * lines and the mouth's outline. Mail has a letter slot on its top plate; the calendar a pad with
 * its ring holes. Proposed parts exist only as drawings.
 */
function vellumFeeder(g: CanvasRenderingContext2D, kind: 'mail' | 'calendar', size: readonly [number, number]): void {
  const [w, h] = size;
  const line = 'rgba(226,224,217,0.78)';
  const faint = 'rgba(226,224,217,0.42)';
  // the box (west part) and its mouth (east), as one outline
  const bx = 10;
  const by = 12;
  const bw = w - 44;
  const bh = h - 24;
  g.fillStyle = 'rgba(217,219,213,0.14)';
  g.fillRect(bx, by, bw, bh);
  g.strokeStyle = line;
  g.lineWidth = 2.5;
  g.setLineDash([14, 10]);
  g.strokeRect(bx, by, bw, bh);
  // the mouth: a short trough off the east face
  g.beginPath();
  g.moveTo(bx + bw, by + bh * 0.3);
  g.lineTo(w - 6, by + bh * 0.36);
  g.lineTo(w - 6, by + bh * 0.64);
  g.lineTo(bx + bw, by + bh * 0.7);
  g.stroke();
  g.setLineDash([]);
  // the top plate, inset
  g.lineWidth = 1.4;
  g.strokeStyle = faint;
  g.strokeRect(bx + 8, by + 8, bw - 16, bh - 16);
  // construction: corner marks outside the box, centre lines through it
  g.strokeStyle = faint;
  g.lineWidth = 1;
  for (const [cx, cy, sx, sy] of [
    [bx, by, -1, -1],
    [bx + bw, by, 1, -1],
    [bx, by + bh, -1, 1],
    [bx + bw, by + bh, 1, 1],
  ]) {
    rule(g, cx + sx * 2, cy, cx + sx * 8, cy, 1, faint);
    rule(g, cx, cy + sy * 2, cx, cy + sy * 8, 1, faint);
  }
  rule(g, bx + bw / 2, by - 8, bx + bw / 2, by + bh + 8, 0.8, faint);
  rule(g, bx - 8, by + bh / 2, w - 2, by + bh / 2, 0.8, faint);
  g.strokeStyle = line;
  g.lineWidth = 2;
  if (kind === 'mail') {
    // the letter slot across the top plate
    g.strokeRect(bx + 18, by + bh / 2 - 4, bw - 36, 8);
  } else {
    // the pad: its leaf and two ring holes along its top edge
    g.strokeRect(bx + 18, by + 16, bw - 36, bh - 30);
    for (const k of [0.35, 0.65]) {
      g.beginPath();
      g.arc(bx + 18 + (bw - 36) * k, by + 16, 3.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
