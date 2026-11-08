/**
 * The Register Desk's printed surfaces: micro-print and marks drawn once into CPU canvases (the
 * kit's `textCanvas`, `fillTextChecked`) and used as textures (docs/ARCHITECTURE.md decision 30,
 * "Text inside the world"). They are made only after every face is loaded: the Stage3D mounts only
 * once the fonts are ready (desk/DeskFrame.tsx), so each canvas is drawn once, with its face in.
 *
 * Every string comes from src/print.ts and is set at 21.5 u or more, at least 18 px on screen at
 * the 0.85× framing. Canvases are drawn in world units (scaled by TEX texels per unit), white paper
 * with ink: the material's colour tints the paper.
 */
import { fillTextChecked, textCanvas, type FontSpec } from '@aiv/remotion-kit';
import monoLatin from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2';
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { CELLS, DOSSIER, FANFOLD, GALLEY, IN_TRAY, LAPTOP, NAMEPLATE, POLICY, PRINT_STRINGS, REPLY, REPORT, SLIPS, SPIKE, TAPE_ROWS } from '../../print.ts';
import { WORDS } from '../../cues.ts';
import { CELLS_X, REEL, TAPE, TAPE_FLAT_X1, TRAIT_PLATE, type BayId } from '../layout.ts';

/** JetBrains Mono's latin file (the font plan's `latin` range), for the micro-print only. */
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const PRINT_FONT: FontSpec = { family: 'Register Print', sources: [{ url: monoLatin, unicodeRange: LATIN, weight: '100 800' }], sample: PRINT_STRINGS.join(' ') };

/** Texels per world unit (about 2.4 per screen pixel at 0.85×). */
export const TEX = 2.8;
/** The smallest print, in world units: 18 px on screen at 0.85×. */
export const PRINT_EM = 21.5;
const INK = '#2A2B2A';

type Draw = (g: CanvasRenderingContext2D) => void;

function texture(w: number, h: number, draw: Draw, aniso: number, bg = '#FFFFFF'): Texture {
  const { c, g } = textCanvas(Math.ceil(w * TEX), Math.ceil(h * TEX));
  g.scale(TEX, TEX);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Text in the print face at `size` world units (weight 500 unless given), ink colour. */
function print(g: CanvasRenderingContext2D, family: string, text: string, x: number, y: number, size = PRINT_EM, weight = 500, color = INK, align: CanvasTextAlign = 'left'): void {
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

/** A kind mark for an inline cell: the shape of the event that came in (24 u). */
function kindMark(g: CanvasRenderingContext2D, kind: string, x: number, y: number): void {
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineWidth = 2;
  if (kind === 'chat') {
    // a slip with a notch
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 26, y);
    g.lineTo(x + 26, y + 14);
    g.lineTo(x + 20, y + 10);
    g.lineTo(x + 14, y + 14);
    g.lineTo(x, y + 14);
    g.closePath();
    g.stroke();
  } else if (kind === 'ci') {
    // a punched card with a clipped corner
    g.beginPath();
    g.moveTo(x + 5, y);
    g.lineTo(x + 26, y);
    g.lineTo(x + 26, y + 15);
    g.lineTo(x, y + 15);
    g.lineTo(x, y + 5);
    g.closePath();
    g.stroke();
    for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i * 5, y + 6, 2.4, 4);
  } else if (kind === 'docs') {
    g.strokeRect(x + 4, y - 2, 18, 18);
    rule(g, x + 8, y + 4, x + 18, y + 4, 1.6);
    rule(g, x + 8, y + 9, x + 18, y + 9, 1.6);
  } else if (kind === 'test') {
    // six pins, all up
    for (let i = 0; i < 6; i++) g.fillRect(x + i * 4.6, y + 2, 2.4, 12);
  } else {
    // a reply: a slip with a stop tab
    g.strokeRect(x, y + 2, 20, 12);
    g.fillRect(x + 20, y + 4, 6, 8);
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
  spike: Texture[];
  laptop: Texture;
  reply: Texture;
  inTray: Texture[];
  chat: Texture;
  card: Texture;
  request: Texture;
  folder: Texture;
  vellumMail: Texture;
  vellumCalendar: Texture;
  gauge: Texture;
  detent: Texture;
  lockFace: Texture;
  trait: Texture;
}

/** Sizes the objects lay these textures on (world units). */
export const PRINT_SIZE = {
  tape: [TAPE_FLAT_X1 - TAPE.x0, TAPE.y1 - TAPE.y0],
  trait: [TRAIT_PLATE.box.x1 - TRAIT_PLATE.box.x0 - 10, TRAIT_PLATE.box.y1 - TRAIT_PLATE.box.y0 - 10],
  nameplate: [212, 22],
  dossier: [82, 66],
  policy: [74, 86],
  fanfold: [170, 150],
  report: [75, 52],
  galley: [290, 126],
  spike: [56, 64],
  laptop: [124, 88],
  reply: [88, 40],
  inTray: [80, 52],
  chat: [80, 40],
  card: [84, 50],
  request: [114, 52],
  folder: [136, 88],
  vellumMail: [130, 70],
  vellumCalendar: [104, 90],
} as const satisfies Record<string, readonly [number, number]>;

export function makePrintTextures(family: string, sans: string, aniso: number): PrintTextures {
  const S = PRINT_SIZE;
  const tex = (size: readonly [number, number], draw: Draw, bg?: string) => texture(size[0], size[1], draw, aniso, bg);

  // the tape: the five inline cells under the window, then the rows already past it, winding on
  const tape = tex(S.tape, (g) => {
    const [, h] = S.tape;
    CELLS.forEach((cell, i) => {
      const x = CELLS_X[i][0] - TAPE.x0;
      const w = CELLS_X[i][1] - CELLS_X[i][0];
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.strokeRect(x + 2, 4, w - 4, h - 8);
      print(g, family, cell.code, x + 4, 28, PRINT_EM, 600);
      kindMark(g, cell.kind, x + 6, 38);
      // the punch: the report's mark that it was read
      g.fillStyle = INK;
      g.beginPath();
      g.arc(x + w - 11, 46, 4, 0, Math.PI * 2);
      g.fill();
    });
    // past the window: older rows, then the tape runs onto the reel
    const after = CELLS_X[4][1] - TAPE.x0 + 10;
    print(g, family, TAPE_ROWS[TAPE_ROWS.length - 1], after, 38, PRINT_EM, 500, '#55554F');
    // perforations along both edges
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
          // a seeded-free, index-driven variation in tone: older turns (inside) a touch darker
          const v = 200 + ((k * 37) % 11) * 2 - (turns - k) * 0.25;
          g.strokeStyle = `rgb(${v},${v - 4},${v - 12})`;
          g.lineWidth = ((R - REEL.hubR) / turns) * 0.86;
          g.beginPath();
          g.arc(R, R, r, 0, Math.PI * 2);
          g.stroke();
        }
        // the request's stub: a vermilion tear-off on the outer turns
        g.strokeStyle = '#E8603F';
        g.lineWidth = 3.2;
        g.beginPath();
        g.arc(R, R, R - 6, -0.55, -0.35);
        g.stroke();
      },
      '#E9E4D8',
    );
  })();

  const nameplate = Object.fromEntries(
    (Object.keys(NAMEPLATE) as BayId[]).map((id) => [
      id,
      tex(S.nameplate, (g) => {
        print(g, family, NAMEPLATE[id], 8, 18.5, PRINT_EM, 700);
      }),
    ]),
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
    POLICY.forEach((line, i) => print(g, family, line, 37, 21 + i * 20, PRINT_EM, i === 0 ? 700 : 500, INK, 'center'));
    rule(g, 8, 26, 66, 26, 1.2);
  });

  const fanfold = tex(S.fanfold, (g) => {
    FANFOLD.forEach((line, i) => print(g, family, line, 8, 28 + i * 26, PRINT_EM, 500, '#A29E94'));
    for (let y = 2; y < S.fanfold[1]; y += 26) rule(g, 0, y + 6, S.fanfold[0], y + 6, 0.6, '#D8D3C6');
  });
  const fanfoldSide = texture(
    170,
    30,
    (g) => {
      // folded edges, one per sheet, alternating light and shade
      for (let i = 0; i < 36; i++) {
        g.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#CFCABE';
        g.fillRect(0, i * 0.83, 170, 0.83);
      }
    },
    aniso,
  );

  const report = tex(S.report, (g) => {
    print(g, family, REPORT[0], 6, 22, PRINT_EM, 700);
    print(g, family, REPORT[1], 6, 44, PRINT_EM, 500);
  });

  const galley = tex(
    S.galley,
    (g) => {
      GALLEY.forEach((line, i) => print(g, family, line, 10, 26 + i * 26, PRINT_EM, i === 0 ? 700 : 500, '#E8E4DA'));
    },
    '#5A5D5B',
  );

  const spike = SPIKE.map((t) =>
    tex(S.spike, (g) => {
      print(g, family, t, 5, 26, PRINT_EM, 600);
      g.fillStyle = '#9D978B';
      g.beginPath();
      g.arc(20, 44, 3.5, 0, Math.PI * 2);
      g.fill();
    }),
  );

  const laptop = tex(
    S.laptop,
    (g) => {
      LAPTOP.forEach((line, i) => print(g, family, line, 7, 21 + i * 20, PRINT_EM, i === 0 || i === 3 ? 700 : 500, i >= 3 ? '#B9B5AB' : '#8E8A82'));
    },
    '#262928',
  );

  const reply = tex(S.reply, (g) => {
    print(g, family, REPLY[0], 5, 23, PRINT_EM, 700);
    print(g, family, REPLY[1], 5, 38, PRINT_EM, 500);
  });

  const inTray = IN_TRAY.map((t) =>
    tex(S.inTray, (g) => {
      print(g, family, t, 6, 26, PRINT_EM, 600, '#4A4A45');
    }),
  );

  const chat = tex(S.chat, (g) => {
    print(g, family, SLIPS.chat, 6, 27, PRINT_EM, 600);
  });

  const card = tex(S.card, (g) => {
    print(g, family, SLIPS.card, 18, 24, PRINT_EM, 600);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) if ((i * 7 + r * 3) % 4 !== 0) g.fillRect(8 + i * 8, 32 + r * 8, 3, 5);
  });

  // the request: vermilion paper with its beetle cut-out (the folder under it shows through, darker)
  const request = tex(
    S.request,
    (g) => {
      print(g, family, SLIPS.request, 8, 24, PRINT_EM, 700, '#5E2214');
      beetle(g, 84, 26, 15);
    },
    '#FFFFFF',
  );

  const folder = tex(S.folder, (g) => {
    // the folder's crease
    rule(g, 0, 10, S.folder[0], 10, 1.4, '#C9B6AE');
  });

  const vellumMail = texture(S.vellumMail[0], S.vellumMail[1], (g) => vellumDrawing(g, 'mail', S.vellumMail), aniso, 'rgba(0,0,0,0)');
  const vellumCalendar = texture(S.vellumCalendar[0], S.vellumCalendar[1], (g) => vellumDrawing(g, 'calendar', S.vellumCalendar), aniso, 'rgba(0,0,0,0)');

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
  // the index arm's detent plate: a notch for each party it can face
  const detent = texture(
    128,
    128,
    (g) => {
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(64, 64, 52, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * (0.1 + 0.25 * i);
        rule(g, 64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44, 64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58, 2.2);
      }
    },
    aniso,
  );
  const lockFace = texture(
    42,
    48,
    (g) => {
      g.fillStyle = INK;
      g.beginPath();
      g.arc(21, 20, 5, 0, Math.PI * 2);
      g.fill();
      g.fillRect(19.5, 22, 3, 10);
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.strokeRect(4, 4, 34, 40);
    },
    aniso,
  );

  // the trait plate: its words are meant to be read, so 36 px or more on screen (43 u at 0.85x), in the film's sans
  const trait = tex(S.trait, (g) => {
    const em = 43;
    print(g, sans, WORDS.traitContinuous.en, 12, em * 0.95, em, 600, INK);
    print(g, sans, WORDS.traitContinuous['zh-Hans'], 12, em * 1.98, em, 500, '#4A4A45');
    rule(g, 12, em * 1.15, S.trait[0] - 12, em * 1.15, 1.2, '#9C978C');
  });

  return { trait, tape, reelTop, nameplate, dossier, policy, fanfold, fanfoldSide, report, galley, spike, laptop, reply, inTray, chat, card, request, folder, vellumMail, vellumCalendar, gauge, detent, lockFace };
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
  // the seam between the wing cases, in the slip's own colour
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 0.08 * s;
  g.beginPath();
  g.moveTo(cx, cy - 0.5 * s);
  g.lineTo(cx, cy + 0.85 * s);
  g.stroke();
}

/** A vellum drawing: a dashed outline (14/10 at 2.5) over a 14% fill, of a mail slot or a calendar pad. */
function vellumDrawing(g: CanvasRenderingContext2D, kind: 'mail' | 'calendar', size: readonly [number, number]): void {
  const [w, h] = size;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(217,219,213,0.14)';
  g.fillRect(3, 3, w - 6, h - 6);
  g.strokeStyle = 'rgba(226,224,217,0.75)';
  g.lineWidth = 2.5;
  g.setLineDash([14, 10]);
  g.strokeRect(3, 3, w - 6, h - 6);
  g.setLineDash([]);
  g.lineWidth = 2;
  if (kind === 'mail') {
    // the slot and an envelope half through it
    g.strokeRect(18, 24, w - 36, 10);
    g.beginPath();
    g.moveTo(34, 34);
    g.lineTo(w / 2, 52);
    g.lineTo(w - 34, 34);
    g.stroke();
  } else {
    // a tear-off pad: rings along the top, a grid of days
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(18 + i * 17, 14, 3.5, 0, Math.PI * 2);
      g.stroke();
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.strokeRect(14 + c * 20, 30 + r * 18, 14, 12);
  }
}
