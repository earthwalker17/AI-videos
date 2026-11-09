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
import { CACHE_CELLS, CELLS, CELLS_BEFORE, CELLS_NEXT, DOSSIER, DOSSIER_FINE, FANFOLD, FANFOLD_FINE, GALLEY, GALLEY_FINE, IN_TRAY, NAMEPLATE, NEXT_WORD, POLICY, PRINT_STRINGS, REPLY, REPORT, REPORT_C, SLIPS } from '../../print.ts';
import { BAYS, CACHE_WINDOW, CARD, CARD_C, CELLS_X, FILED_TABS, TAB_C, DISPATCH, FRESH, NEXT_SLIP, REEL, SLIP, TAPE, TAPE_FLAT_X1, TRAIT_PLATE, type BayLayout, type WorkerId } from '../layout.ts';

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
/** The smallest print, in world units: about 21 px on screen at 0.85× (its capitals at least 15 px). */
export const PRINT_EM = 25;
/** An ID in the report's chain (bay → Router → you): at least 24 px on screen. */
export const ID_EM = 30;
export const INK = '#2A2B2A';
const VERMILION = '#E8603F';

export type Draw = (g: CanvasRenderingContext2D) => void;

/** Texels per world unit for what the close shot (still (c), 2.0x) reads: about 2.8 per screen pixel there. */
export const TEX_CLOSE = 6;

export function texture(w: number, h: number, draw: Draw, aniso: number, bg = '#FFFFFF', scale = TEX): Texture {
  const { c, g } = textCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  g.scale(scale, scale);
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
export function print(g: CanvasRenderingContext2D, family: string, text: string, x: number, y: number, size = PRINT_EM, weight: 500 | 700 = 500, color = INK, align: CanvasTextAlign = 'left'): void {
  g.font = `${weight} ${size}px ${family}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  fillTextChecked(g, text, x, y);
}

/** A thin rule (ink at a weight). */
export function rule(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1.2, color = INK): void {
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
export function cargoMark(g: CanvasRenderingContext2D, kind: string, x: number, y: number, color = INK): void {
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
  tapeBefore: Texture;
  reelTop: Texture;
  nameplate: Record<WorkerId, Texture>;
  dossier: Record<WorkerId, Texture>;
  /** MT1: the tape after the chat slip is stamped in, the chat slip, the dispatch folder's cover */
  tape2: Texture;
  chatNext: Texture;
  folderFresh: Texture;
  /** still (c): the tape without cells, the older cards (each with its stub at its west end), the inline record, the report card's face and back */
  tapeBlank: Texture;
  /** the turn (MT2): the tape with its first row only, a chat slip's mark (design D2: no number); the reel's top before the request's stub */
  tapeFirst: Texture;
  reelTopBare: Texture;
  cacheCells: Texture[];
  record: Texture;
  /** the record's 3 f ink spread (stamp-in): its three stages, the last the record itself */
  recordInk: Texture[];
  cardC: Texture;
  cardCBack: Texture;
  /** the older pointer tabs filed in the spill drawer (layout.ts FILED_TABS), each with its cargo mark */
  filedTabs: Texture[];
  /** the close shot's fine print on the fanfold, the galley and the dossiers */
  fanfoldFine: Texture;
  galleyFine: Texture;
  dossierFine: Record<WorkerId, Texture>;
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
/** A dossier's top sheet (its tray inset 5). */
export const dossierSize = (b: BayLayout): [number, number] => [b.dossier.x1 - b.dossier.x0 - 10, b.dossier.y1 - b.dossier.y0 - 10];

/** Sizes the objects lay these textures on (world units). */
export const PRINT_SIZE = {
  tape: [TAPE_FLAT_X1 - TAPE.x0, TAPE.y1 - TAPE.y0],
  trait: [TRAIT_PLATE.box.x1 - TRAIT_PLATE.box.x0 - 10, TRAIT_PLATE.box.y1 - TRAIT_PLATE.box.y0 - 10],
  policy: [74, 86],
  fanfold: [170, 80],
  report: [CARD.w, CARD.d],
  galley: [172, 80],
  reply: [SLIP.l, SLIP.w],
  inTray: [80, 52],
  chat: [96, 40],
  ciCard: [84, 50],
  request: [114, 52],
  folder: [136, 84],
  vellumMail: [124, 80],
  vellumCalendar: [124, 80],
  chatNext: [NEXT_SLIP.l, NEXT_SLIP.w],
  folderFresh: [DISPATCH.w, DISPATCH.d],
  record: [CACHE_WINDOW.record[1] - CACHE_WINDOW.record[0], TAPE.y1 - TAPE.y0],
  cardC: [CARD_C.w, CARD_C.d],
  cardCBack: [TAB_C.w, TAB_C.d],
} as const satisfies Record<string, readonly [number, number]>;

/** The module's printer, for the keep filter below. */
const printText = print;

/**
 * Every printed texture. `keep` (optional) says which strings are printed: a planned shot prints the
 * rest as marks only (TREATMENT Type: printed fields are marks except in planned close shots), so a
 * string it drops leaves the paper and its rules (still (c): the bays' print; still (d): everything).
 */
export function makePrintTextures(family: string, sans: string, aniso: number, keep?: (text: string) => boolean): PrintTextures {
  // the one printer every texture below draws with, filtered by `keep`
  const print: typeof printText = keep ? (g, fam, text, ...rest) => (keep(text) ? printText(g, fam, text, ...rest) : undefined) : printText;
  const S = PRINT_SIZE;
  const tex = (size: readonly [number, number], draw: Draw, bg?: string) => texture(size[0], size[1], draw, aniso, bg);

  // the tape: five inline cells under the window, printed ink with its tooth. The newest (west, by the
  // print head) carries its report's ID at >= 24 px and its mark; older cells print a step dimmer
  // once a new report has stamped in (the stamp-in swaps `tapeBefore` for `tape`)
  const tapeOf = (cells: readonly { code: string; kind: string; request: boolean }[], fresh: boolean, notch = false) =>
    tex(S.tape, (g) => {
      const [, h] = S.tape;
      cells.forEach((cell, i) => {
        const x = CELLS_X[i][0] - TAPE.x0;
        const w = CELLS_X[i][1] - CELLS_X[i][0];
        const ink = i === 0 ? INK : fresh ? '#7E7A71' : '#55534D';
        // once a new report has stamped in, the older cells dim a step (their paper greys by ~25 codes)
        if (i > 0 && fresh) {
          g.fillStyle = '#C8C3B8';
          g.fillRect(x + 2, 4, w - 4, h - 8);
        }
        g.strokeStyle = ink;
        g.lineWidth = i === 0 ? 2.2 : 1.2;
        g.strokeRect(x + 2, 4, w - 4, h - 8);
        g.filter = 'blur(0.35px)';
        // only the teaching chain's ID is printed as a number (#0408, once stamped in); everything else is a mark
        if (i === 0 && fresh && cell.code) {
          print(g, family, cell.code, x + 4, 32, ID_EM, 700, ink);
          cargoMark(g, cell.kind, x + 8, 38, ink);
        } else if (i === 0 && fresh) {
          // a mark only (one ID chain): the accepted slip, larger, with the loupe's notch cut in its edge
          g.save();
          g.translate(x + 14, 12);
          g.scale(1.6, 1.6);
          cargoMark(g, cell.kind, 0, 0, ink);
          g.restore();
          if (notch) {
            g.fillStyle = '#FFFFFF';
            g.beginPath();
            g.moveTo(x + 14 + 22, 12);
            g.lineTo(x + 14 + 30, 12);
            g.lineTo(x + 14 + 26, 19);
            g.closePath();
            g.fill();
          }
        } else cargoMark(g, cell.kind, x + 8, 20, ink);
        g.filter = 'none';
        if (cell.request) {
          g.fillStyle = VERMILION;
          g.fillRect(x + 8, 48, 26, 5);
        }
      });
      tooth(g, S.tape[0], h);
      for (let x = 4; x < S.tape[0]; x += 9) {
        g.fillStyle = '#C9C4B8';
        g.fillRect(x, 1, 3, 1.6);
        g.fillRect(x, h - 2.6, 3, 1.6);
      }
    });
  const tape = tapeOf(CELLS, true);
  const tapeBefore = tapeOf(CELLS_BEFORE, false);
  const tape2 = tapeOf(CELLS_NEXT, true, true);
  const tapeFirst = tapeOf([{ code: '', kind: 'chat', request: false }], true);

  // the reel's top: the wound tape seen edge-on, one ring per turn
  // the reel's top; `stub`: the request's tear-off on its outer turns (once the request is stamped in: not yet at the turn)
  const reelTopOf = (stub: boolean) => {
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
        if (!stub) return;
        g.strokeStyle = VERMILION;
        g.lineWidth = 3.2;
        g.beginPath();
        g.arc(R, R, R - 6, -0.55, -0.35);
        g.stroke();
      },
      '#E9E4D8',
    );
  };
  const reelTop = reelTopOf(true);
  const reelTopBare = reelTopOf(false);

  // each bay's nameplate carries its task's ID at >= 24 px (the report's chain starts here)
  const WORKERS: Record<WorkerId, BayLayout> = { ...BAYS, fresh: FRESH };
  const nameplate = Object.fromEntries(
    (Object.keys(NAMEPLATE) as WorkerId[]).map((id) => {
      const size = bandSize(WORKERS[id]);
      return [id, tex(size, (g) => print(g, family, NAMEPLATE[id], size[0] / 2, size[1] * 0.82, ID_EM - 2, 700, INK, 'center'))];
    }),
  ) as Record<WorkerId, Texture>;

  const dossier = Object.fromEntries(
    (Object.keys(DOSSIER) as WorkerId[]).map((id) => [
      id,
      tex(dossierSize(WORKERS[id]), (g) => {
        DOSSIER[id].forEach((line, i) => print(g, family, line, 4, 22 + i * 24, PRINT_EM, i === 0 ? 700 : 500));
      }),
    ]),
  ) as Record<WorkerId, Texture>;

  const policy = tex(S.policy, (g) => {
    POLICY.forEach((line, i) => print(g, family, line, 37, 26 + i * 24, PRINT_EM, i === 0 ? 700 : 500, INK, 'center'));
    rule(g, 8, 31, 66, 31, 1.2);
  });

  const fanfold = tex(S.fanfold, (g) => {
    // folded sheets: a fold line between rows, the print a little grey (it recedes)
    FANFOLD.forEach((line, i) => print(g, family, line, 4, 24 + i * 26, PRINT_EM, 500, '#7E7A71'));
    for (let y = 1; y < 3; y++) rule(g, 0, y * 26 + 3, S.fanfold[0], y * 26 + 3, 1, '#C2BCB0');
    tooth(g, S.fanfold[0], S.fanfold[1]);
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
    print(g, family, REPORT[0], 4, 30, ID_EM, 700);
    print(g, family, REPORT[1], 4, 60, PRINT_EM, 500);
    // the punched hole its transit light shines through, clear of the print
    g.fillStyle = '#6E6A62';
    g.beginPath();
    g.arc(S.report[0] - 10, 46, 5, 0, Math.PI * 2);
    g.fill();
  });

  // the galley: type set in lines, ink on paper with its tooth, whole lines only
  const galley = tex(S.galley, (g) => {
    g.filter = 'blur(0.35px)';
    GALLEY.forEach((line, i) => print(g, family, line, 4, 24 + i * 25, PRINT_EM, i === 0 ? 700 : 500, INK));
    g.filter = 'none';
    tooth(g, S.galley[0], S.galley[1]);
  });

  // the reply cites the report it answers; its punched hole at the trailing end carries the transit light
  const reply = tex(S.reply, (g) => {
    print(g, family, REPLY[0], 5, 32, ID_EM, 700);
  });

  const inTray = IN_TRAY.map((pair) =>
    tex(S.inTray, (g) => {
      print(g, family, pair[0], 4, 23, PRINT_EM, 700, '#4A4A45');
      print(g, family, pair[1], 4, 47, PRINT_EM, 500, '#4A4A45');
    }),
  );

  const chat = tex(S.chat, (g) => {
    print(g, family, SLIPS.chat, 18, 29, PRINT_EM, 500);
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
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) if ((i * 7 + r * 3) % 4 !== 0) g.fillRect(8 + i * 8, 30 + r * 9, 3, 6);
    rule(g, 4, h - 4, w - 4, h - 4, 0.8, '#B5AFA3');
  });

  // the request: vermilion paper with its beetle cut-out (the folder under it shows through, darker)
  const request = tex(S.request, (g) => {
    // the beetle is a die-cut window in the slip's geometry (objects/Bay.tsx); no code on it (one ID chain)
    rule(g, 6, 40, 74, 40, 1.2, '#C9A89C');
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

  // the Continuous plate: its notes loop engraved as a mark (it was read at C9, when it docked)
  const trait = tex(S.trait, (g) => {
    const [w, h] = S.trait;
    g.strokeStyle = INK;
    g.lineWidth = 2.6;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = INK;
    g.fillRect(w / 2 + w * 0.36 - 4, h / 2 - 5, 8, 10);
  });

  // MT1: the next chat slip (its word, no clock or ID) and the dispatch folder's cover (its kind and the loupe's notch: accepted)
  const chatNext = tex(S.chatNext, (g) => {
    print(g, family, NEXT_WORD, 18, 29, PRINT_EM, 500);
    rule(g, 64, 24, 88, 24, 1.2, '#9E988C');
  });
  const folderFresh = tex(S.folderFresh, (g) => {
    // a label: the kind's mark, small, at the leading corner; the cover's rules
    const [w, h] = S.folderFresh;
    g.strokeStyle = '#8E887D';
    g.lineWidth = 1.2;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.save();
    g.translate(w - 30, 8);
    g.scale(0.6, 0.6);
    cargoMark(g, 'chat', 0, 0, '#4A4A45');
    g.restore();
    tooth(g, w, h);
  });

  const close = (size: readonly [number, number], draw: Draw, bg?: string) => texture(size[0], size[1], draw, aniso, bg, TEX_CLOSE);
  const tapeH = TAPE.y1 - TAPE.y0;
  // still (c): the tape itself, its tooth and sprocket ticks, without cells (the cells are cards in the window)
  const tapeBlank = tex(S.tape, (g) => {
    tooth(g, S.tape[0], tapeH);
    for (let x = 4; x < S.tape[0]; x += 9) {
      g.fillStyle = '#C9C4B8';
      g.fillRect(x, 1, 3, 1.6);
      g.fillRect(x, tapeH - 2.6, 3, 1.6);
    }
  });
  // the older cards in the window, newest first: a stub at the west end (a small mark of their kind over a
  // perforation; the request's carries its vermilion), the body east of it (the full mark and two lines of
  // print), which the shrink tears away. The newest is the wide cell (CELLS_X[0])
  const stubW = CACHE_WINDOW.stub;
  const cacheCells = CACHE_CELLS.map((cell, i) => {
    const w = CELLS_X[i][1] - CELLS_X[i][0];
    return close([w, tapeH], (g) => {
      toothUnder(g, w, tapeH);
      g.strokeStyle = '#55534D';
      g.lineWidth = 1.2;
      g.strokeRect(1, 4, w - 2, tapeH - 8);
      // the stub: its kind as a small mark, a column of ticks, the perforation
      g.save();
      g.translate(3, 10);
      g.scale(0.36, 0.36);
      cargoMark(g, cell.kind, 0, 0, '#3E3D39');
      g.restore();
      // two punched holes: a stub, as torn off a ticket
      g.fillStyle = '#5A5852';
      for (const y of [30, 40]) {
        g.beginPath();
        g.arc(9, y, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      if (cell.request) {
        g.fillStyle = VERMILION;
        g.fillRect(3, 50, 12, 6);
      }
      g.setLineDash([1.6, 1.6]);
      rule(g, stubW - 0.6, 5, stubW - 0.6, tapeH - 5, 0.9, '#6E6A62');
      g.setLineDash([]);
      // the body: its kind's mark, torn away as the card shrinks
      g.filter = 'blur(0.2px)';
      cargoMark(g, cell.kind, stubW + 6, 20, '#55534D');
      g.filter = 'none';
    });
  });
  // the inline record, as the head prints it (west to east): the three summary lines, then the header (the
  // teaching ID and its vermilion bar) over the pointer, a folded tab's outline and an arrow down: the header
  // column stands over the spill drawer, so the arrow points at the drawer the tab lies in. Tooth under the
  // ink; the ink stamps in over three stages (a 3 f spread, never an alpha fade)
  const recordInk = inkSpread(
    S.record,
    aniso,
    (g) => toothUnder(g, S.record[0], S.record[1]),
    (g) => {
      const [w, h] = S.record;
      g.strokeStyle = INK;
      g.lineWidth = 1.6;
      g.strokeRect(1.5, 3.5, w - 3, h - 7);
      REPORT_C.summary.forEach((line, i) => print(g, family, line, 8, 18.5 + i * 18.6, 17.5, 500));
      const cx = RECORD_HEAD_X;
      rule(g, cx - 6, 8, cx - 6, h - 8, 1.1, '#7E7A71');
      print(g, family, REPORT_C.id, cx, 25, 21, 700);
      g.fillStyle = VERMILION;
      g.fillRect(cx + 1, 31, 38, 4.5);
      // the pointer: the tab in the real one's proportions, its dog-ear about 10 u across, and the arrow down into the drawer
      pointerTab(g, cx + 1, 40, 46, 15.5, 8);
      g.strokeStyle = INK;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx + 62, 38);
      g.lineTo(cx + 62, 51);
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(cx + 55, 49);
      g.lineTo(cx + 69, 49);
      g.lineTo(cx + 62, 59);
      g.closePath();
      g.fill();
    },
  );
  const record = recordInk[2];
  // the report card: its header strip (the top half: the ID and its bar, the three summary lines the head will
  // print), a perforation, then the body (the rest, as print texture) with the crease it folds along
  const cardC = close(S.cardC, (g) => {
    const [w, h] = S.cardC;
    const hy = h * CARD_C.header;
    toothUnder(g, w, h);
    print(g, family, REPORT_C.id, 4, 10, 9, 700);
    g.fillStyle = VERMILION;
    g.fillRect(40, 5, 34, 3.2);
    REPORT_C.summary.forEach((line, i) => print(g, family, line, 4, 18.5 + i * 7.4, 7, 500, '#3A3B39'));
    g.setLineDash([2, 2]);
    rule(g, 2, hy, w - 2, hy, 1, '#8E887D');
    g.setLineDash([]);
    REPORT_C.body.forEach((line, i) => {
      const x = i % 2 === 0 ? 4 : w / 2 + 4;
      const y = hy + 8 + Math.floor(i / 2) * 18;
      print(g, family, line, x, y, 7.5, 500, '#4A4A45');
    });
    // the crease the body folds along (its middle)
    rule(g, 3, hy + (h - hy) / 2, w - 3, hy + (h - hy) / 2, 0.6, '#C2BCB0');
  });
  // the pointer tab's face (the back of the body's folded half): the ID it points by, the request's vermilion tick, its dog-ear and crease
  const cardCBack = close(
    S.cardCBack,
    (g) => {
      const [w, h] = S.cardCBack;
      tabPaper(g, w, h, 'e');
      print(g, family, REPORT_C.id, 6, h - 4.5, 16, 700);
      g.fillStyle = VERMILION;
      g.fillRect(58, 5, 3.4, h - 10);
    },
    'transparent',
  );
  // the older pointer tabs in the drawer: the same family, each with the mark of what it points to (no numbers)
  const filedTabs = FILED_TABS.map((t) =>
    close(
      [t.w, TAB_C.d],
      (g) => {
        const h = TAB_C.d;
        tabPaper(g, t.w, h, t.end === 'w' ? 'e' : 'w');
        g.save();
        g.translate(t.end === 'w' ? 5 : t.w - 20, 1.6);
        g.scale(0.42, 0.42);
        cargoMark(g, t.kind, 0, t.kind === 'docs' ? 4 : 0, '#4A4A45');
        g.restore();
        rule(g, t.end === 'w' ? 28 : 6, h - 6.5, t.end === 'w' ? t.w - 10 : t.w - 30, h - 6.5, 1, '#B5AFA3');
      },
      'transparent',
    ),
  );

  // the close shot's fine print: the same kinds of print at about 9.5 u (20 px at 2.0x), so they stay texture
  const FINE = 9.5;
  const fanfoldFine = close(S.fanfold, (g) => {
    const [w, h] = S.fanfold;
    FANFOLD_FINE.forEach((line, i) => print(g, family, line, 4 + (i % 2) * 86, 12 + Math.floor(i / 2) * 15.5, FINE, 500, '#7E7A71'));
    for (let y = 1; y < 5; y++) rule(g, 0, y * 15.5 + 3, w, y * 15.5 + 3, 0.8, '#C2BCB0');
    tooth(g, w, h);
  });
  const galleyFine = close(S.galley, (g) => {
    const [w, h] = S.galley;
    g.filter = 'blur(0.2px)';
    GALLEY_FINE.forEach((line, i) => print(g, family, line, 4 + (i % 2) * 88, 13 + Math.floor(i / 2) * 17, FINE, i % 2 === 0 ? 700 : 500, INK));
    g.filter = 'none';
    tooth(g, w, h);
  });
  const dossierFine = Object.fromEntries(
    (Object.keys(DOSSIER) as WorkerId[]).map((id) => {
      const size = dossierSize(WORKERS[id]);
      return [id, close(size, (g) => DOSSIER_FINE.slice(0, Math.max(2, Math.floor((size[1] - 4) / 12))).forEach((line, i) => print(g, family, line, 3, 11 + i * 12, FINE, i === 0 ? 700 : 500)))];
    }),
  ) as Record<WorkerId, Texture>;

  return { trait, tape, tapeBefore, reelTop, nameplate, dossier, policy, fanfold, fanfoldSide, report, galley, reply, inTray, chat, ciCard, request, folder, vellumMail, vellumCalendar, gauge, lockFace, tape2, chatNext, folderFresh, tapeBlank, tapeFirst, reelTopBare, cacheCells, record, recordInk, cardC, cardCBack, filedTabs, fanfoldFine, galleyFine, dossierFine };
}

/** Paper tooth over ink: small deterministic specks in the paper's colour (index-hashed, no randomness). */
export function tooth(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = 'rgba(255,255,255,0.55)';
  const n = Math.round((w * h) / 9);
  for (let i = 0; i < n; i++) {
    const a = Math.imul(i + 1, 2654435761) >>> 0;
    const b = Math.imul(i + 7, 2246822519) >>> 0;
    g.fillRect((a % 10007) / 10007 * w, (b % 10009) / 10009 * h, 0.45, 0.45);
  }
}

/** Where the record's header column starts (u from its west edge): over the spill drawer (layout.ts DRAWER), so its arrow points down into it. */
export const RECORD_HEAD_X = 136;

/** Paper tooth under the ink: faint deterministic specks of the paper's own grain, drawn before any print (index-hashed, no randomness). */
export function toothUnder(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = 'rgba(60,56,48,0.07)';
  const n = Math.round((w * h) / 5);
  for (let i = 0; i < n; i++) {
    const a = Math.imul(i + 3, 2654435761) >>> 0;
    const b = Math.imul(i + 11, 2246822519) >>> 0;
    g.fillRect(((a % 10007) / 10007) * w, ((b % 10009) / 10009) * h, 0.42, 0.42);
  }
}

/** A pointer tab's outline as ink (the record's mark for it): the folded tab with its dog-ear turned over at the north-east corner, its crease along the south edge. */
function pointerTab(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ear: number): void {
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w - ear, y);
  g.lineTo(x + w, y + ear);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fill();
  // the turned-over corner shows the paper inside its fold edge
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.moveTo(x + w - ear + 1.3, y + 1.3);
  g.lineTo(x + w - ear + 1.3, y + ear - 1.3);
  g.lineTo(x + w - 1.3, y + ear - 1.3);
  g.closePath();
  g.fill();
  g.fillRect(x + 2.5, y + h - 3.4, w - 5, 1.1);
}

/**
 * A pointer tab's paper (its face, the folded half's back): the sheet with one top corner dog-eared
 * (the corner turned over onto the face: its underside a step darker, the cut-away corner clear), the
 * crease along the south edge as a soft roll, the tooth under it all.
 */
function tabPaper(g: CanvasRenderingContext2D, w: number, h: number, ear: 'w' | 'e'): void {
  const e = 6.5;
  const mirror = () => {
    if (ear === 'w') {
      g.translate(w, 0);
      g.scale(-1, 1);
    }
  };
  // the sheet, its cut-away corner clear; the tooth inside it
  g.save();
  mirror();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w - e, 0);
  g.lineTo(w, e);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fillStyle = '#FFFFFF';
  g.fill();
  g.clip();
  toothUnder(g, w, h);
  g.restore();
  g.save();
  mirror();
  // the turned-over corner: the paper's underside, its fold edge, the hairline shadow it casts on the face
  g.fillStyle = '#D6D0C4';
  g.beginPath();
  g.moveTo(w - e, 0);
  g.lineTo(w, e);
  g.lineTo(w - e, e);
  g.closePath();
  g.fill();
  rule(g, w - e, 0, w, e, 0.7, 'rgba(120,114,104,0.9)');
  rule(g, w - e - 0.6, 0.4, w - e - 0.6, e + 0.6, 0.8, 'rgba(60,56,48,0.18)');
  rule(g, w - e - 0.6, e + 0.6, w - 0.4, e + 0.6, 0.8, 'rgba(60,56,48,0.18)');
  g.restore();
  // the crease: the fold rolls away at the south edge
  const roll = g.createLinearGradient(0, h - 3, 0, h);
  roll.addColorStop(0, 'rgba(60,56,48,0)');
  roll.addColorStop(1, 'rgba(60,56,48,0.22)');
  g.fillStyle = roll;
  g.fillRect(0, h - 3, w, 3);
}

/**
 * A 3 f ink spread (TREATMENT Relationships, stamp-in): the ink's three stages as textures. The
 * strokes' cores come first, then their full width; never an alpha fade. `paper` draws under the
 * ink (its tooth); `ink` draws every mark the head prints.
 */
function inkSpread(size: readonly [number, number], aniso: number, paper: Draw, ink: Draw): Texture[] {
  const [w, h] = size;
  const W = Math.ceil(w * TEX_CLOSE);
  const H = Math.ceil(h * TEX_CLOSE);
  const { c: inkC, g: ig } = textCanvas(W, H);
  ig.scale(TEX_CLOSE, TEX_CLOSE);
  ig.clearRect(0, 0, w, h);
  ink(ig);
  const src = ig.getImageData(0, 0, W, H);
  // how deep in a stroke each texel is: its coverage blurred twice by a box of 9 texels (about 1.5 u)
  let cov: Float32Array = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) cov[i] = src.data[i * 4 + 3] / 255;
  for (let pass = 0; pass < 2; pass++) cov = boxBlur(cov, W, H, 4);
  const stage =
    (t: number): Draw =>
    (g) => {
      paper(g);
      if (t <= 0) {
        g.drawImage(inkC, 0, 0, w, h);
        return;
      }
      const { c: sc, g: sg } = textCanvas(W, H);
      const out = sg.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const k = Math.min(1, Math.max(0, (cov[i] - t) / 0.12 + 0.5));
        out.data[i * 4] = src.data[i * 4];
        out.data[i * 4 + 1] = src.data[i * 4 + 1];
        out.data[i * 4 + 2] = src.data[i * 4 + 2];
        out.data[i * 4 + 3] = src.data[i * 4 + 3] * k * k * (3 - 2 * k);
      }
      sg.putImageData(out, 0, 0);
      g.drawImage(sc, 0, 0, w, h);
    };
  return [0.62, 0.36, 0].map((t) => texture(w, h, stage(t), aniso, '#FFFFFF', TEX_CLOSE));
}

/** A separable box blur of radius r texels (clamped at the edges). */
function boxBlur(a: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += a[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / n;
      acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
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
