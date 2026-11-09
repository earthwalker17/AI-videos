/**
 * Act one's objects (desk/actOne.ts): the eight folders, the notes loop round your desk and the
 * heap of messages west of it, the request in it, the pieces the feeders post onto it, the event
 * slips that spawn F6–F8. Your desk (YourDesk.tsx) and the feeders (Intake.tsx) pose themselves for
 * act one from the frame.
 *
 * Folders are one family and never identical instances: each has its own size, stack (context is
 * paper: 0.8 u a sheet, its edges staggered so thickness reads from above), tab, task card (the
 * message that started it, clipped to the stack), top-sheet notes and wear. Warmth is paper value:
 * only the folder under the lamp is lit paper; warm folders sit at paper idle, cold ones a step
 * darker and greyer with fainter ink, still paper (design D4). A working pen rests on its newest
 * line; a waiting folder's pen is lifted and parked and its flag stands. A folder that arrives in
 * beat 2 unfolds out from under its event slip, which becomes its task card.
 *
 * Printed surfaces use the desk's canvas print (gl/text.ts) and paper material (gl/materials.ts);
 * the heap is drawn in the stepped set, so the intake's focus steps it down with the feeders. The
 * folders, the loop and its tabs draw on the kit's `own` ramp, which beat 3 steps down (actOne.ts
 * FOCUS_A); at the turn that ramp is 0, so they draw as the full set.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Path, Quaternion, Shape, Vector3, type MeshStandardMaterial, type Texture } from 'three';
import { FOLDER_PRINT, LOOP_NOTES } from '../../print.ts';
import { chatSlipPrint, leafPrint } from './Intake.tsx';
import {
  CARD,
  COVER_Z,
  FLAG,
  FOLDERS,
  HEAP,
  PEN,
  PIECE,
  REQUEST_A,
  SHEET,
  SHEET_PRINT,
  TAB,
  TAB_SHARE,
  cardLocal,
  flagHinge,
  flagLocal,
  loopNormal,
  loopPoint,
  penLocal,
  penPivot,
  requestZ,
  sheetSize,
  stackTop,
  tabAt,
  type ActOneState,
  type FolderLayout,
  type FolderState,
  type LoopPose,
  type PieceKind,
} from '../actOne.ts';
import { cylinderZ, extrude, fitUv, merge, piece, slab, slipShape, tube } from '../geom.ts';
import type { Press } from '../turn.ts';
import { HEX, paper, whiteTexture } from '../gl/materials.ts';
import { INK, print, texture, tooth } from '../gl/text.ts';
import { Step, isStepped, useDeskMats } from '../kit.tsx';
import type { P2, P3 } from '../layout.ts';

// the slip helpers live in geom.ts (Intake.tsx needs them too); the turn imports them from here
export { fitUv, piece, slipShape };

/** Folder paper by warmth: the folder under the lamp is lit paper, warm ones paper idle, cold ones a greyer step down (still paper). */
const FOLDER_HEX = {
  lit: { sheet: HEX.paperLit, cover: HEX.paper },
  warm: { sheet: '#BBB5A9', cover: '#8F897E' },
  cold: { sheet: '#88837A', cover: '#76726A' },
} as const;
/** The tape's paper and its tabs (an index stock a step darker). */
export const TAPE_HEX = { tape: '#B2AC9F', tab: '#9A9488' } as const;
/** The heap's paper stocks per kind (two each: no two pieces alike), and the request's before it turns vermilion. */
const HEAP_HEX: Readonly<Record<PieceKind, readonly [string, string]>> = { chat: ['#8E897F', '#9C968A'], ci: ['#8B877E', '#98938A'], mail: ['#948F85', '#A29D92'], leaf: ['#918C82', '#9F9A8F'] };
const REQUEST_PAPER = '#A39D91';
const REQUEST_PAPER_SHADE = '#8A857B';
/** Printed variants per kind of heap piece. */
const VARIANTS: Readonly<Record<PieceKind, number>> = { chat: 6, ci: 6, mail: 2, leaf: 2 };

// ------------------------------------------------------------------------------------------------
// Printed surfaces

export interface ActOnePrint {
  /** each folder's top sheet, its task card */
  top: Texture[];
  card: Texture[];
  /** the notes loop's tape */
  tape: Texture;
  /** the heap's pieces: chat slips (the paper's tooth), CI cards (punch patterns), envelopes, calendar leaves */
  chat: Texture[];
  ci: Texture[];
  mail: Texture[];
  leaf: Texture[];
}

/** A CI card's punch pattern (deterministic per seed): two rows of slots. */
function punches(g: CanvasRenderingContext2D, seed: number, x0: number, y0: number, cols: number, pitch: number): void {
  g.fillStyle = INK;
  for (let r = 0; r < 2; r++) for (let i = 0; i < cols; i++) if (rand(0x0c1, seed, r * 31 + i) < 0.62) g.fillRect(x0 + i * pitch, y0 + r * 9, 3, 6);
}

/** A note's printed width on the tape (15 u mono, 0.6 em advance). */
const noteWidth = (s: string): number => s.length * 9 + 4;

/**
 * Act one's prints. `written` (0..1 per folder; default all 1) is how much of each note has been written along the
 * tape: a new folder's note wipes in left to right as read, after its tab is out.
 */
export function makeActOnePrint(family: string, aniso: number, tapeLen: number, tapeNotes: readonly number[], flips: readonly boolean[] = [], written: readonly number[] = []): ActOnePrint {
  const top = FOLDERS.map((fl) => {
    const [w, h] = sheetSize(fl);
    return texture(
      w,
      h,
      (g) => {
        tooth(g, w, h);
        FOLDER_PRINT[fl.n - 1].lines.forEach((line, i) => print(g, family, line, SHEET_PRINT.x, h * SHEET_PRINT.first + i * SHEET_PRINT.pitch, SHEET_PRINT.em, i === 0 ? 700 : 500, INK));
      },
      aniso,
    );
  });
  const card = FOLDERS.map((fl) => {
    const [w, h] = CARD[fl.card];
    return texture(
      w,
      h,
      (g) => {
        if (fl.card === 'chat') chatSlipPrint(g, w, h, fl.n);
        else {
          tooth(g, w, h);
          punches(g, fl.n, 10, 9, 8, 6);
        }
      },
      aniso,
    );
  });
  const tape = texture(
    tapeLen,
    24,
    (g) => {
      tooth(g, tapeLen, 24);
      tapeNotes.forEach((s, i) => {
        const k = written[i] ?? 1;
        if (k <= 0) return;
        const w = noteWidth(LOOP_NOTES[i]);
        g.save();
        g.beginPath();
        // a note on the loop's far (north) side is turned over to read upright: its start is at the texture's +x end
        if (flips[i]) g.rect(s + w / 2 - w * k, 0, w * k, 24);
        else g.rect(s - w / 2, 0, w * k, 24);
        g.clip();
        if (!flips[i]) print(g, family, LOOP_NOTES[i], s, 17, 15, 500, '#3E3E3A', 'center');
        else {
          g.translate(s, 12);
          g.rotate(Math.PI);
          print(g, family, LOOP_NOTES[i], 0, 5, 15, 500, '#3E3E3A', 'center');
        }
        g.restore();
      });
    },
    aniso,
  );
  const chat = Array.from({ length: VARIANTS.chat }, (_, i) => texture(PIECE.chat[0], PIECE.chat[1], (g) => chatSlipPrint(g, PIECE.chat[0], PIECE.chat[1], 3 + i * 5), aniso));
  const ci = Array.from({ length: VARIANTS.ci }, (_, i) =>
    texture(
      PIECE.ci[0],
      PIECE.ci[1],
      (g) => {
        tooth(g, PIECE.ci[0], PIECE.ci[1]);
        punches(g, 40 + i, 14, 14 + (i % 2) * 6, 9, 7);
      },
      aniso,
    ),
  );
  // an envelope: its paper and the shadowed edges of its back flaps (a V from the corners), as marks
  const mail = Array.from({ length: VARIANTS.mail }, (_, i) =>
    texture(
      PIECE.mail[0],
      PIECE.mail[1],
      (g) => {
        const [w, h] = PIECE.mail;
        chatSlipPrint(g, w, h, 60 + i);
        g.strokeStyle = 'rgba(62,60,56,0.55)';
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(2, 2);
        g.lineTo(w / 2, h * (0.55 + 0.06 * i));
        g.lineTo(w - 2, 2);
        g.stroke();
      },
      aniso,
    ),
  );
  const leaf = Array.from({ length: VARIANTS.leaf }, (_, i) => texture(PIECE.leaf[0], PIECE.leaf[1], (g) => leafPrint(g, PIECE.leaf[0], PIECE.leaf[1], 9 + i * 11), aniso));
  return { top, card, tape, chat, ci, mail, leaf };
}

// ------------------------------------------------------------------------------------------------
// The notes loop

/** The loop's span of parameter angle from the clip: a little over a turn when shut (the ends overlap under the clip), short of one when open. */
export const loopSpan = (L: LoopPose): number => Math.PI * 2 + 0.1 * L.closed - 0.4 * (1 - L.closed);
const LOOP_N = 260;

/** Arc length along the loop from the clip to each parameter angle (samples). */
export function loopArc(L: LoopPose): { t: number[]; s: number[]; len: number } {
  const span = loopSpan(L);
  const t: number[] = [];
  const s: number[] = [];
  let acc = 0;
  for (let i = 0; i <= LOOP_N; i++) {
    const ti = L.clipAt + (span * i) / LOOP_N;
    if (i > 0) {
      const p = loopPoint(L, t[i - 1]);
      const q = loopPoint(L, ti);
      acc += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    t.push(ti);
    s.push(acc);
  }
  return { t, s, len: acc };
}

/** The tape: a flat ribbon along the loop; its overlapping end rises onto its start under the clip. Text reads upright on the near (south) side. */
function ribbonGeometry(L: LoopPose): BufferGeometry {
  const { t, s, len } = loopArc(L);
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const end = t[t.length - 1];
  t.forEach((ti, i) => {
    const p = loopPoint(L, ti);
    const n = loopNormal(L, ti);
    const rise = Math.min(Math.max((ti - (end - 0.22)) / 0.12, 0), 1);
    const z = L.z + 0.9 * rise;
    for (const k of [-1, 1]) {
      pos.push(p[0] + (n[0] * k * L.w) / 2, p[1] + (n[1] * k * L.w) / 2, z);
      uv.push(s[i] / len, k < 0 ? 1 : 0);
      nrm.push(0, 0, 1);
    }
    if (i > 0) {
      const a = 2 * (i - 1);
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Each folder's tab on the loop: a paper flag off the tape's outer edge, turned to face its folder; a tab that is
 * coming out (F6–F8 in beat 2) slides out from under the tape's edge, its length growing from its base.
 */
function tabsGeometry(L: LoopPose, out: readonly number[]): BufferGeometry | null {
  const parts = FOLDERS.flatMap((fl, i) => {
    const k = out[i] ?? 1;
    if (k <= 0.01) return [];
    const t = tabAt(L, fl);
    const p = loopPoint(L, t);
    const n = loopNormal(L, t);
    const base: P2 = [p[0] + n[0] * (L.w / 2 - 3), p[1] + n[1] * (L.w / 2 - 3)];
    const d: P2 = [fl.c[0] - base[0], fl.c[1] - base[1]];
    const ang = Math.atan2(d[1], d[0]) - Math.PI / 2;
    const s = new Shape();
    const hw = TAB.w / 2;
    const l = Math.max(TAB.l * Math.min(k, 1), 3);
    const r = Math.min(5, l / 2);
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, l - r);
    s.quadraticCurveTo(hw, l, hw - r, l);
    s.lineTo(-hw + r, l);
    s.quadraticCurveTo(-hw, l, -hw, l - r);
    s.closePath();
    if (l >= TAB.l - 0.01) {
      const hole = new Path();
      hole.absarc(0, TAB.l - 8, 2.6, 0, Math.PI * 2, true);
      s.holes.push(hole);
    }
    const g = extrude(s, L.z - 0.2, L.z + 0.5, 0.2);
    g.rotateZ(ang);
    g.translate(base[0], base[1], 0);
    return [g];
  });
  return parts.length ? merge(parts) : null;
}

/** The enamel clip that closes the loop: a body over the overlapping ends, a graphite spine, two wire arms folded outward. */
export function clipGeometry(L: LoopPose): { body: BufferGeometry; spine: BufferGeometry; wire: BufferGeometry } {
  const p = loopPoint(L, L.clipAt + 0.05);
  const n = loopNormal(L, L.clipAt + 0.05);
  const ang = Math.atan2(n[1], n[0]);
  const place = (g: BufferGeometry) => {
    g.rotateZ(ang);
    g.translate(p[0], p[1], 0);
    return g;
  };
  // local x: outward across the tape; y: along it
  const body = place(slab({ x0: -27, x1: 27, y0: -24, y1: 24 }, L.z + 0.9, L.z + 8, 5, 2));
  const spine = place(slab({ x0: -28, x1: 28, y0: -4.5, y1: 4.5 }, L.z + 7.2, L.z + 10.6, 1.6, 0.8));
  const wire = place(
    merge(
      [-1, 1].map((k) =>
        tube(
          [
            [20, k * 3, L.z + 10.2],
            [34, k * 14, L.z + 10.8],
            [48, k * 13, L.z + 7],
          ],
          1.3,
          8,
          6,
        ),
      ),
    ),
  );
  return { body, spine, wire };
}
/** How high the open clip stands on the tape's start end before it snaps shut on `hub` (its jaw held open). */
export const CLIP_OPEN = 3.2;

// ------------------------------------------------------------------------------------------------
// A folder

/** A sheet's outline: plain paper, or a punched card's with its clipped corner. */
function sheetShape(fl: FolderLayout): Shape {
  const [sw, sd] = sheetSize(fl);
  if (fl.contents === 'cards') return slipShape('ci', sw, sd);
  const s = new Shape();
  s.moveTo(-sw / 2, -sd / 2);
  s.lineTo(sw / 2, -sd / 2);
  s.lineTo(sw / 2, sd / 2);
  s.lineTo(-sw / 2, sd / 2);
  s.closePath();
  return s;
}

/** A folder's still parts (folder-local): the cover and its tab, the stack's staggered layers, the top sheet, the pen's post; its task card, clip and wire (card-local: they ride the card). */
function folderGeometry(fl: FolderLayout) {
  const { w, d } = fl;
  const [sw, sd] = sheetSize(fl);
  const cover = slab({ x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 }, 0, COVER_Z, 3, 0.5);
  const tw = 36 + ((fl.n * 7) % 3) * 4;
  const tx = -w / 2 + tw / 2 + 8 + (w - tw - 16) * fl.tab;
  const tab = slab({ x0: tx - tw / 2, x1: tx + tw / 2, y0: d / 2 - 6, y1: d / 2 + 13 }, 0, COVER_Z, 4, 0.4);
  // the stack: layers whose edges stagger (a thick stack shows many), cut as its contents are. A chat thread's
  // slips fan out past the cover's east edge, their notched ends showing; punched cards stand proud of its north-west
  // corner with their clipped corners and punch rows; plain sheets stay square
  const K = Math.max(2, Math.min(6, Math.round(fl.sheets / 4)));
  const h = fl.sheets * SHEET;
  const layers: BufferGeometry[] = [];
  for (let j = 0; j < K; j++) {
    const top = j === K - 1;
    const z0 = COVER_Z + (j * h) / K;
    const z1 = COVER_Z + ((j + 1) * h) / K;
    if (!top && fl.contents === 'slips') {
      const sl = slipShape('chat', sw * 0.62, 24);
      const g = extrude(sl, z0, z1, 0.3);
      g.rotateZ((rand(0xf01d, fl.n, j + 19) * 2 - 1) * 0.08);
      g.translate(sw * 0.5 - sw * 0.31 + 14 + 9 * ((j * 3) % 4), -sd / 2 + 22 + ((sd - 44) * j) / Math.max(1, K - 2), 0);
      layers.push(g);
      continue;
    }
    if (!top && fl.contents === 'cards') {
      const c = slipShape('ci', sw, sd);
      for (let i = 0; i < 6; i++) {
        const ph = new Path();
        const px = -sw / 2 + 12 + i * 7;
        ph.moveTo(px, sd / 2 - 4);
        ph.lineTo(px + 2.6, sd / 2 - 4);
        ph.lineTo(px + 2.6, sd / 2 - 9);
        ph.lineTo(px, sd / 2 - 9);
        ph.closePath();
        if ((i + j) % 3 !== 0) c.holes.push(ph);
      }
      const g = extrude(c, z0, z1, 0.3);
      g.translate(-6 - 3 * (j % 2), 8 + 2 * (j % 3), 0);
      layers.push(g);
      continue;
    }
    const jx = top ? 0 : (rand(0xf01d, fl.n, j) * 2 - 1) * 2.4;
    const jy = top ? 0 : (rand(0xf01d, fl.n, j + 9) * 2 - 1) * 2;
    const g = extrude(sheetShape(fl), z0, z1, 0.3);
    g.rotateZ(top ? 0 : (rand(0xf01d, fl.n, j + 19) * 2 - 1) * 0.02);
    g.translate(jx, jy, 0);
    layers.push(g);
  }
  const topSheet = (() => {
    const g = fitUv(extrude(sheetShape(fl), 0, 0.05, 0), sw, sd);
    g.translate(0, 0, stackTop(fl) + 0.05);
    return g;
  })();
  // a worn folder's top sheet has a dog-eared corner (the long-running ones)
  const dogEar = (() => {
    if (fl.sheets < 14 || fl.contents === 'cards') return null;
    const s = new Shape();
    const k = 16;
    s.moveTo(sw / 2, -sd / 2 + k);
    s.lineTo(sw / 2 - k, -sd / 2);
    s.lineTo(sw / 2 - k * 0.15, -sd / 2 + k * 0.15);
    s.closePath();
    return extrude(s, stackTop(fl) + 0.1, stackTop(fl) + 0.6, 0);
  })();
  // the task card (card-local, its centre at the origin), and the clip holding it at its north edge
  const [cw, cd] = CARD[fl.card];
  const east = cardLocal(fl).c[0] > 0;
  const card = piece(fl.card, cw, cd, 0.7);
  const clip = merge([slab({ x0: -9, x1: 9, y0: -5, y1: 5 }, 0, 4.5, 1.5, 0.8)]);
  clip.translate(east ? 6 : -6, cd / 2 - 1, 0.7);
  const clipWire = tube(
    [
      [-6, 4, 4.5],
      [-6, 12, 4],
      [6, 12, 4],
      [6, 4, 4.5],
    ],
    1,
    12,
    6,
  );
  clipWire.translate(east ? 6 : -6, cd / 2 - 1, 0.7);
  const pv = penPivot(fl);
  const post = merge([cylinderZ(4.5, COVER_Z, COVER_Z + 2, pv[0], pv[1], 18), cylinderZ(2.4, COVER_Z, stackTop(fl) + PEN.post, pv[0], pv[1], 12)]);
  return { cover, tab, layers: merge(layers), topSheet, dogEar, card, clip, clipWire, post };
}

/** A tapered rod from a (radius ra) to b (radius rb). */
function rod(a: P3, b: P3, ra: number, rb: number, radial = 12): BufferGeometry {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new CylinderGeometry(rb, ra, len, radial, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
  g.translate(a[0], a[1], a[2]);
  return g;
}

/**
 * The pen (folder-local): its nib on the newest line, the body leaning back toward its post at a
 * writing angle, an enamel cap, and a short arm from the post holding it. Lifted, the whole pen
 * rises and swings off the sheet (actOne.ts penLocal).
 */
function penGeometry(fl: FolderLayout, s: FolderState): { body: BufferGeometry; cap: BufferGeometry; nib: BufferGeometry } {
  const pv = penPivot(fl);
  const tip = penLocal(fl, s);
  const hx = pv[0] - tip[0];
  const hy = pv[1] - tip[1];
  const hl = Math.hypot(hx, hy) || 1;
  const el = 0.62 + 0.3 * s.pen;
  const dir: P3 = [(hx / hl) * Math.cos(el), (hy / hl) * Math.cos(el), Math.sin(el)];
  const at = (k: number): P3 => [tip[0] + dir[0] * k, tip[1] + dir[1] * k, tip[2] + dir[2] * k];
  const post: P3 = [pv[0], pv[1], stackTop(fl) + PEN.post];
  const body = merge([rod(at(7), at(36), 2.6, 3.4), tube([post, at(30)], 1.6, 6, 8)]);
  const cap = rod(at(35), at(50), 3.7, 3.4);
  const nib = rod(tip, at(7.5), 0.5, 2.6);
  return { body, cap, nib };
}

/** The flag: a steel staff from its hinge and a swallowtail enamel pennant at its top (folder-local). */
function flagGeometry(fl: FolderLayout, up: number): { staff: BufferGeometry; pennant: BufferGeometry } {
  const h = flagHinge(fl);
  const top = flagLocal(fl, up);
  const staff = tube([[h[0], h[1], stackTop(fl) + 1], top], 1.5, 4, 8);
  const [pw, ph] = FLAG.plate;
  const s = new Shape();
  s.moveTo(0, -ph / 2);
  s.lineTo(pw, -ph / 2);
  s.lineTo(pw - 7, 0);
  s.lineTo(pw, ph / 2);
  s.lineTo(0, ph / 2);
  s.closePath();
  const pennant = extrude(s, -0.7, 0.7, 0.3);
  // it flies north from the staff's top (clear of the next folder), tipped toward you so its face is seen
  pennant.rotateZ(Math.PI / 2);
  pennant.rotateX(-0.35 * up);
  pennant.translate(top[0], top[1] + 1, top[2] - 2);
  return { staff, pennant };
}

interface FolderMats {
  cover: MeshStandardMaterial;
  sheet: MeshStandardMaterial;
  top: MeshStandardMaterial;
  card: MeshStandardMaterial;
}

const mix = (a: string, b: string, t: number): Color => new Color(a).lerp(new Color(b), t);

function Folder({ fl, s, lit, mats, press }: { fl: FolderLayout; s: FolderState; lit: number; mats: FolderMats; press?: Press }) {
  const m = useDeskMats();
  const g = useMemo(() => folderGeometry(fl), [fl]);
  const pen = useMemo(() => penGeometry(fl, s), [fl, s]);
  const flag = useMemo(() => (s.flag > 0.05 ? flagGeometry(fl, s.flag) : null), [fl, s.flag]);
  useLayoutEffect(() => {
    // warm: how far above the cold step (warmth decays over τ 120 f); lit: under the lamp
    const warm = Math.min(Math.max((s.warmth - 0.15) / 0.35, 0), 1);
    const sheet = mix(FOLDER_HEX.cold.sheet, FOLDER_HEX.warm.sheet, warm).lerp(new Color(FOLDER_HEX.lit.sheet), lit);
    const cover = mix(FOLDER_HEX.cold.cover, FOLDER_HEX.warm.cover, warm).lerp(new Color(FOLDER_HEX.lit.cover), lit);
    mats.sheet.color.copy(sheet).multiplyScalar(0.93);
    mats.top.color.copy(sheet);
    mats.cover.color.copy(cover);
    mats.card.color.copy(sheet).lerp(new Color(HEX.paperLit), 0.12 * (1 - lit));
  }, [mats, s.warmth, lit]);
  if (s.present <= 0 || (press && press.k >= 1)) return null;
  // unfolding (F6–F8): the folder grows out from under its card, from the card's own outline to the whole cover and
  // stack, about the card's centre; the card stays its size and rides up with the stack's top
  const { c: cc, turn } = cardLocal(fl);
  const [cw, cd] = CARD[fl.card];
  const k = s.present;
  const sx = cw / fl.w + (1 - cw / fl.w) * k;
  const sy = cd / fl.d + (1 - cd / fl.d) * k;
  const sz = 0.04 + 0.96 * k;
  const cardZ = (stackTop(fl) + 0.2) * sz;
  // pressed into the desk at the turn as one body (desk/turn.ts pressAt): squashed flat with its pen, flag and clip, then
  // sunk north edge first into its imprint
  const drop = -(press?.sink ?? 0);
  return (
    <group position={[fl.c[0], fl.c[1], drop]} rotation={[0, 0, fl.rot]}>
      <group rotation={[-(press?.tilt ?? 0), 0, 0]} scale={[1, 1, press?.scaleZ ?? 1]}>
        <group position={[cc[0], cc[1], 0]} scale={[sx, sy, sz]}>
          <group position={[-cc[0], -cc[1], 0]}>
            <mesh geometry={g.cover} material={mats.cover} />
            <mesh geometry={g.tab} material={mats.cover} />
            <mesh geometry={g.layers} material={mats.sheet} />
            <mesh geometry={g.topSheet} material={mats.top} />
            {g.dogEar && <mesh geometry={g.dogEar} material={mats.cover} />}
            <mesh geometry={g.post} material={m.graphite} />
            <mesh geometry={pen.body} material={m.graphiteDark} />
            <mesh geometry={pen.cap} material={m.enamel} />
            <mesh geometry={pen.nib} material={m.steel} />
            {flag && (
              <>
                <mesh geometry={flag.staff} material={m.steel} />
                <mesh geometry={flag.pennant} material={m.enamel} />
              </>
            )}
          </group>
        </group>
        <group position={[cc[0], cc[1], cardZ]} rotation={[0, 0, turn]}>
          <mesh geometry={g.card} material={mats.card} />
          {k >= 1 && (
            <>
              <mesh geometry={g.clip} material={m.graphiteDark} />
              <mesh geometry={g.clipWire} material={m.steel} />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The heap and the request

/** The request, creased while buried: its body (the beetle cut through at the west end, under the heap) and the east flap, folded up along the crease by `lift`. */
export function requestGeometry(lift: number = REQUEST_A.lift): { body: BufferGeometry; flap: BufferGeometry; crease: BufferGeometry } {
  const R = REQUEST_A;
  const hl = R.l / 2;
  const hw = R.w / 2;
  const xc = hl - R.crease;
  const s = new Shape();
  s.moveTo(-hl, -hw);
  s.lineTo(xc, -hw);
  s.lineTo(xc, hw);
  s.lineTo(-hl, hw);
  s.closePath();
  const bx = -hl + 19;
  const body = new Path();
  body.absellipse(bx, 1, 10, 8, 0, Math.PI * 2, true);
  s.holes.push(body);
  const head = new Path();
  head.absellipse(bx - 14, 1, 4, 4.5, 0, Math.PI * 2, true);
  s.holes.push(head);
  for (const side of [-1, 1])
    for (const k of [-1, 0, 1]) {
      const leg = new Path();
      leg.absellipse(bx + k * 6, 1 + side * 11.5, 1.4, 3.6, 0, Math.PI * 2, true);
      s.holes.push(leg);
    }
  const bodyG = extrude(s, 0, 0.7, 0);
  // the flap: hinged on the crease, lifted
  const flap = slab({ x0: 0, x1: R.crease, y0: -hw, y1: hw }, 0, 0.7, 0.6, 0.2);
  flap.rotateY(-lift);
  flap.translate(xc, 0, 0.2 * (lift / R.lift));
  const crease = slab({ x0: xc - 1.2, x1: xc + 1.2, y0: -hw + 1, y1: hw - 1 }, 0.2, 0.9, 0.4, 0.1);
  const place = (g: BufferGeometry) => {
    g.rotateZ(R.rot);
    g.translate(R.c[0], R.c[1], requestZ());
    return g;
  };
  return { body: place(bodyG), flap: place(flap), crease: place(crease) };
}

/** A heap piece's geometry per kind: the message family's cuts (an envelope with its back flap raised, a leaf torn along its top). */
function heapGeometry(): Record<PieceKind, BufferGeometry> & { mailFlap: BufferGeometry } {
  const [mw, md] = PIECE.mail;
  const flapS = new Shape();
  flapS.moveTo(-mw / 2 + 2, md / 2 - 2);
  flapS.lineTo(mw / 2 - 2, md / 2 - 2);
  flapS.lineTo(0, -md * 0.08);
  flapS.closePath();
  const [lw, ld] = PIECE.leaf;
  const leafS = new Shape();
  leafS.moveTo(-lw / 2, -ld / 2);
  leafS.lineTo(lw / 2, -ld / 2);
  leafS.lineTo(lw / 2, ld / 2 - 4);
  for (let i = 1; i <= 8; i++) leafS.lineTo(lw / 2 - (lw * i) / 8, ld / 2 - (i % 2 ? 0 : 4));
  leafS.closePath();
  return {
    chat: piece('chat', ...PIECE.chat),
    ci: piece('ci', ...PIECE.ci),
    mail: fitUv(slab({ x0: -mw / 2, x1: mw / 2, y0: -md / 2, y1: md / 2 }, 0, 0.7, 1.5, 0.2), mw, md),
    mailFlap: extrude(flapS, 0.7, 1.2, 0.15),
    leaf: fitUv(extrude(leafS, 0, 0.7, 0.15), lw, ld),
  };
}

function Heap({ a, print: tex, stepRequest = false }: { a: ActOneState; print: ActOnePrint; stepRequest?: boolean }) {
  const geo = useMemo(() => heapGeometry(), []);
  const lift = Math.round(a.request.lift * 400) / 400;
  const req = useMemo(() => requestGeometry(lift), [lift]);
  useLayoutEffect(() => () => Object.values(req).forEach((g) => g.dispose()), [req]);
  useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  // the heap's paper, in the stepped set (the intake's focus steps it down): one material per print and stock
  const mats = useMemo(() => {
    const out: Record<string, MeshStandardMaterial> = {};
    for (const kind of ['chat', 'ci', 'mail', 'leaf'] as const)
      tex[kind].forEach((t, v) => {
        for (const tone of [0, 1]) out[`${kind}${v}${tone}`] = paper(t, HEAP_HEX[kind][tone], { stepped: true });
      });
    out.flap0 = paper(whiteTexture(), '#86817A', { stepped: true });
    out.flap1 = paper(whiteTexture(), '#938E85', { stepped: true });
    return out;
  }, [tex]);
  useLayoutEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  // the request's own paper: a chat slip's stock until its cue, then vermilion (the request motif), over spring-effects; it
  // keeps its colour when the intake steps down (it is the film's tracer), and steps down with the heap in the turn's pull
  const reqMats = useMemo(() => {
    const white = whiteTexture();
    return { paper: paper(white, REQUEST_PAPER, { roughness: 0.82, stepped: stepRequest }), shade: paper(white, REQUEST_PAPER_SHADE, { roughness: 0.85, stepped: stepRequest }) };
  }, [stepRequest]);
  useLayoutEffect(() => () => Object.values(reqMats).forEach((m) => m.dispose()), [reqMats]);
  useLayoutEffect(() => {
    reqMats.paper.color.set(REQUEST_PAPER).lerp(new Color(HEX.vermilion), a.request.ink);
    reqMats.shade.color.set(REQUEST_PAPER_SHADE).lerp(new Color(HEX.vermilionShade), a.request.ink);
  }, [reqMats, a.request.ink]);
  const keyOf = (kind: PieceKind, v: number, tone: number) => `${kind}${v % VARIANTS[kind]}${tone > 0.45 ? 1 : 0}`;
  const mesh = (kind: PieceKind, v: number, tone: number, key: string | number, p: P3, rot: number, tilt = 0, flip = 0) => (
    <group key={key} position={p} rotation={[0, 0, rot]}>
      <group rotation={[tilt + flip, 0, 0]}>
        <mesh geometry={geo[kind]} material={mats[keyOf(kind, v, tone)]} />
        {kind === 'mail' && <mesh geometry={geo.mailFlap} material={mats[`flap${tone > 0.45 ? 1 : 0}`]} />}
      </group>
    </group>
  );
  return (
    <group>
      <mesh geometry={req.body} material={reqMats.paper} />
      <mesh geometry={req.flap} material={reqMats.paper} />
      <mesh geometry={req.crease} material={reqMats.shade} />
      {HEAP.slice(0, a.landed).map((p, i) => mesh(p.kind, p.v, p.tone, i, [p.c[0], p.c[1], p.z], p.rot))}
      {a.posts.map((q) => {
        const p = HEAP[q.i];
        return mesh(p.kind, p.v, p.tone, `post${q.i}`, q.p, q.rot, q.tilt, q.flip);
      })}
    </group>
  );
}

/** The event slips that spawn F6–F8, in the air and lying where their folders unfold: each as its folder's task card. */
function EventSlips({ a, mats }: { a: ActOneState; mats: FolderMats[] }) {
  const geo = useMemo(() => ({ chat: piece('chat', ...CARD.chat, 0.7), ci: piece('ci', ...CARD.ci, 0.7) }), []);
  useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      {a.events.map((e) => {
        const fl = FOLDERS[e.n - 1];
        return (
          <group key={e.n} position={e.p} rotation={[0, 0, e.rot]}>
            <mesh geometry={geo[fl.card]} material={mats[e.n - 1].card} rotation={[e.tilt, 0, 0]} />
          </group>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------------------------------------

function NotesLoop({ a, tape, tabMat }: { a: ActOneState; tape: MeshStandardMaterial; tabMat: MeshStandardMaterial }) {
  const m = useDeskMats();
  const L = a.loop;
  // keyed by the tabs' lengths (quantised), so their geometry is rebuilt only while one is coming out
  const outKey = a.folders.map((s) => Math.round(s.tab * 200) / 200).join(',');
  const g = useMemo(() => ({ ribbon: ribbonGeometry(L), clip: clipGeometry(L) }), [L]);
  const tabs = useMemo(() => tabsGeometry(L, outKey.split(',').map(Number)), [L, outKey]);
  useLayoutEffect(() => () => [g.ribbon, ...Object.values(g.clip), tabs].forEach((x) => x?.dispose()), [g, tabs]);
  // the clip rides the tape's start end from the first frame, its jaw held open; on the hit it snaps shut over both ends
  const lift = CLIP_OPEN * (1 - L.closed);
  return (
    <group>
      <mesh geometry={g.ribbon} material={tape} />
      {tabs && <mesh geometry={tabs} material={tabMat} />}
      <group position={[0, 0, lift]}>
        <mesh geometry={g.clip.body} material={m.enamel} />
        <mesh geometry={g.clip.spine} material={m.graphiteDark} />
        <mesh geometry={g.clip.wire} material={m.steel} />
      </group>
    </group>
  );
}

/** How lit each folder is: the lamp's aim near its centre. */
const litOf = (a: ActOneState, fl: FolderLayout): number => Math.exp(-((a.lamp.aim[0] - fl.c[0]) ** 2 + (a.lamp.aim[1] - fl.c[1]) ** 2) / (2 * 50 * 50));

/** Where each folder's note is printed along the tape (u from the clip): at its own tab (actOne.ts TAB_SHARE), so a note and its tab always pair up. */
export const loopNotes = (len: number): number[] => TAB_SHARE.map((k) => k * len);
/** Whether each note lies on the loop's north half (it is turned over there, to read upright from the camera). */
export function loopNoteFlips(L: LoopPose, notes: readonly number[]): boolean[] {
  const { t, s: arc } = loopArc(L);
  return notes.map((u) => {
    let i = 0;
    while (i < arc.length - 1 && arc[i] < u) i++;
    return loopPoint(L, t[i])[1] > L.c[1] + L.b * 0.25;
  });
}

/**
 * Act one's own objects (the desk and feeders pose themselves). The turn (desk/turn.ts) presses the folders into the
 * desk (`press`, one per folder), draws the notes loop itself (`loop` false) and steps the request down with the heap.
 */
export function ActOneObjects({ a, printFamily, press, loop = true, stepRequest = false }: { a: ActOneState; printFamily: string; press?: readonly Press[]; loop?: boolean; stepRequest?: boolean }) {
  const L0 = a.loop;
  const arc = useMemo(() => loopArc(L0), [L0]);
  const notes = useMemo(() => loopNotes(arc.len), [arc]);
  const flips = useMemo(() => loopNoteFlips(L0, notes), [L0, notes]);
  // each note as written so far (quantised to 1/6, the 6 f wipe, so the tape's texture is rebuilt only on those frames)
  const writtenKey = a.folders.map((s) => Math.round(s.note * 6) / 6).join(',');
  const print = useMemo(() => makeActOnePrint(printFamily, 4, Math.ceil(arc.len), notes, flips, writtenKey.split(',').map(Number)), [printFamily, arc.len, notes, flips, writtenKey]);
  const mats = useMemo(() => {
    const white = whiteTexture();
    // the folders, the loop and its tabs on the kit's own ramp: beat 3's focus steps them down (actOne.ts FOCUS_A)
    const own = { stepped: 'own' as const };
    return {
      tape: paper(print.tape, TAPE_HEX.tape, own),
      tab: paper(white, TAPE_HEX.tab, own),
      folders: FOLDERS.map((_, i): FolderMats => ({ cover: paper(white, undefined, own), sheet: paper(white, undefined, own), top: paper(print.top[i], undefined, own), card: paper(print.card[i], undefined, own) })),
    };
  }, [print]);
  useLayoutEffect(
    () => () => {
      mats.tape.dispose();
      mats.tab.dispose();
      for (const f of mats.folders) for (const m of Object.values(f)) m.dispose();
      for (const t of [...print.top, ...print.card, print.tape, ...print.chat, ...print.ci, ...print.mail, ...print.leaf]) t.dispose();
    },
    [mats, print],
  );
  const stepFolders = isStepped(a.step, 'folders');
  const stepLoop = isStepped(a.step, 'loop');
  return (
    <>
      <Step on={stepFolders}>
        {FOLDERS.map((fl, i) => (
          <Folder key={fl.n} fl={fl} s={a.folders[i]} lit={litOf(a, fl)} mats={mats.folders[i]} press={press?.[i]} />
        ))}
      </Step>
      <EventSlips a={a} mats={mats.folders} />
      {loop && (
        <Step on={stepLoop}>
          <NotesLoop a={a} tape={mats.tape} tabMat={mats.tab} />
        </Step>
      )}
      <Heap a={a} print={print} stepRequest={stepRequest} />
    </>
  );
}

/** Beat 3's follow-up (desk/beat3.ts FOLLOW_UP): an event card in grey stock, as Fix B's trays' own event cards. */
export function FollowUpCard({ p, rot, tilt, w, d, hex }: { p: P3; rot: number; tilt: number; w: number; d: number; hex: string }) {
  const g = useMemo(() => slab({ x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 }, 0, 0.7, 1.5, 0.2), [w, d]);
  const mat = useMemo(() => paper(whiteTexture(), hex), [hex]);
  useLayoutEffect(
    () => () => {
      g.dispose();
      mat.dispose();
    },
    [g, mat],
  );
  return (
    <group position={p} rotation={[0, 0, rot]}>
      <mesh geometry={g} material={mat} rotation={[tilt, 0, 0]} />
    </group>
  );
}
