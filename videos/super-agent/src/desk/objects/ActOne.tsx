/**
 * Act one's objects (desk/actOne.ts): the eight folders, the notes loop round your desk and the
 * heap of messages west of it, the request buried in it, one chat slip in flight. Your desk
 * (YourDesk.tsx) and the feeders (Intake.tsx) pose themselves for act one from the frame.
 *
 * Folders are one family and never identical instances: each has its own size, stack (context is
 * paper: 0.8 u a sheet, its edges staggered so thickness reads from above), tab, task card (the
 * message that started it, clipped to the stack), top-sheet notes and wear. Warmth is paper value:
 * only the folder under the lamp is lit paper; warm folders sit at paper idle, cold ones a step
 * darker and greyer with fainter ink, still paper (design D4). A working pen rests on its newest
 * line; a waiting folder's pen is lifted and parked and its flag stands.
 *
 * Printed surfaces use the desk's canvas print (gl/text.ts) and paper material (gl/materials.ts);
 * the heap is drawn in the stepped set, so C4's focus steps it down with the feeders.
 */
import { rand } from '@aiv/core';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Path, Quaternion, Shape, Vector3, type MeshStandardMaterial, type Texture } from 'three';
import { FOLDER_PRINT, HEAP_CLOCKS, LOOP_NOTES } from '../../print.ts';
import { COVER_Z, FLAG, FOLDERS, cardEast, HEAP, PEN, PIECE, REQUEST_A, SHEET, SHEET_INSET, SHEET_PRINT, TAB, flagHinge, flagLocal, loopNormal, loopPoint, penLocal, penPivot, stackTop, tabAt, type ActOneState, type CardKind, type FolderLayout, type FolderState, type LoopPose } from '../actOne.ts';
import { cylinderZ, extrude, merge, slab, tube } from '../geom.ts';
import { HEX, paper, whiteTexture } from '../gl/materials.ts';
import { INK, print, texture, tooth } from '../gl/text.ts';
import { useDeskSets, useDeskMats } from '../kit.tsx';
import type { P2, P3 } from '../layout.ts';

/** Folder paper by warmth: the folder under the lamp is lit paper, warm ones paper idle, cold ones a greyer step down (still paper). */
const FOLDER_HEX = {
  lit: { sheet: HEX.paperLit, cover: HEX.paper },
  warm: { sheet: '#BBB5A9', cover: '#8F897E' },
  cold: { sheet: '#88837A', cover: '#76726A' },
} as const;
/** The tape's paper and its tabs (an index stock a step darker). */
const TAPE_HEX = { tape: '#B2AC9F', tab: '#9A9488' } as const;
/** Task card sizes (folder-local, u): a notched chat slip, a punched CI card with a clipped corner. */
const CARD: Record<CardKind, P2> = { chat: [66, 28], ci: [58, 36] };

/** A slip's outline centred on the origin: a chat slip's notched east end, a CI card's clipped north-west corner. */
function slipShape(kind: CardKind, w: number, d: number): Shape {
  const s = new Shape();
  const x = w / 2;
  const y = d / 2;
  if (kind === 'chat') {
    s.moveTo(-x, -y);
    s.lineTo(x, -y);
    s.lineTo(x - d * 0.28, 0);
    s.lineTo(x, y);
    s.lineTo(-x, y);
  } else {
    const k = Math.min(w, d) * 0.22;
    s.moveTo(-x, -y);
    s.lineTo(x, -y);
    s.lineTo(x, y);
    s.lineTo(-x + k, y);
    s.lineTo(-x, y - k);
  }
  s.closePath();
  return s;
}

/** Map a flat piece's UVs to its own bounds (the print lies on its top face). */
function fitUv(g: BufferGeometry, w: number, d: number): BufferGeometry {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / w + 0.5;
    uv[2 * i + 1] = pos.getY(i) / d + 0.5;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** A thin paper piece of a kind, its print on top. */
const piece = (kind: CardKind, w: number, d: number, t = 0.8): BufferGeometry => fitUv(extrude(slipShape(kind, w, d), 0, t, 0.25), w, d);

// ------------------------------------------------------------------------------------------------
// Printed surfaces

interface ActOnePrint {
  /** each folder's top sheet, its task card */
  top: Texture[];
  card: Texture[];
  /** the notes loop's tape */
  tape: Texture;
  /** the heap's chat slips (clocks) and CI cards (punch patterns) */
  chat: Texture[];
  ci: Texture[];
}

const sheetSize = (fl: FolderLayout): P2 => [fl.w - 2 * SHEET_INSET, fl.d - 2 * SHEET_INSET];

/** A CI card's punch pattern (deterministic per seed): two rows of slots. */
function punches(g: CanvasRenderingContext2D, seed: number, x0: number, y0: number, cols: number, pitch: number): void {
  g.fillStyle = INK;
  for (let r = 0; r < 2; r++) for (let i = 0; i < cols; i++) if (rand(0x0c1, seed, r * 31 + i) < 0.62) g.fillRect(x0 + i * pitch, y0 + r * 9, 3, 6);
}

function makeActOnePrint(family: string, aniso: number, tapeLen: number, tapeNotes: readonly number[]): ActOnePrint {
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
        tooth(g, w, h);
        const clock = FOLDER_PRINT[fl.n - 1].clock;
        if (fl.card === 'chat' && clock) print(g, family, clock, 6, h * 0.72, 16, 500, '#6A6862');
        else punches(g, fl.n, 10, 9, 8, 6);
      },
      aniso,
    );
  });
  const tape = texture(
    tapeLen,
    24,
    (g) => {
      tooth(g, tapeLen, 24);
      tapeNotes.forEach((s, i) => print(g, family, LOOP_NOTES[i], s, 17, 15, 500, '#3E3E3A', 'center'));
    },
    aniso,
  );
  const chat = HEAP_CLOCKS.map((clock, i) =>
    texture(
      PIECE.chat[0],
      PIECE.chat[1],
      (g) => {
        tooth(g, PIECE.chat[0], PIECE.chat[1]);
        print(g, family, clock, 16 + (i % 3) * 5, 26, 17, 500, '#6E6B64');
      },
      aniso,
    ),
  );
  const ci = Array.from({ length: 6 }, (_, i) =>
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
  return { top, card, tape, chat, ci };
}

// ------------------------------------------------------------------------------------------------
// The notes loop

/** The loop's span of parameter angle from the clip: a little over a turn when shut (the ends overlap under the clip), short of one when open. */
const loopSpan = (L: LoopPose): number => Math.PI * 2 + 0.1 * L.closed - 0.4 * (1 - L.closed);
const LOOP_N = 260;

/** Arc length along the loop from the clip to each parameter angle (samples). */
function loopArc(L: LoopPose): { t: number[]; s: number[]; len: number } {
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

/** Each folder's tab on the loop: a paper flag off the tape's outer edge, turned to face its folder. */
function tabsGeometry(L: LoopPose): BufferGeometry {
  return merge(
    FOLDERS.map((fl) => {
      const t = tabAt(L, fl);
      const p = loopPoint(L, t);
      const n = loopNormal(L, t);
      const base: P2 = [p[0] + n[0] * (L.w / 2 - 3), p[1] + n[1] * (L.w / 2 - 3)];
      const d: P2 = [fl.c[0] - base[0], fl.c[1] - base[1]];
      const ang = Math.atan2(d[1], d[0]) - Math.PI / 2;
      const s = new Shape();
      const hw = TAB.w / 2;
      s.moveTo(-hw, 0);
      s.lineTo(hw, 0);
      s.lineTo(hw, TAB.l - 5);
      s.quadraticCurveTo(hw, TAB.l, hw - 5, TAB.l);
      s.lineTo(-hw + 5, TAB.l);
      s.quadraticCurveTo(-hw, TAB.l, -hw, TAB.l - 5);
      s.closePath();
      const hole = new Path();
      hole.absarc(0, TAB.l - 8, 2.6, 0, Math.PI * 2, true);
      s.holes.push(hole);
      const g = extrude(s, L.z - 0.2, L.z + 0.5, 0.2);
      g.rotateZ(ang);
      g.translate(base[0], base[1], 0);
      return g;
    }),
  );
}

/** The enamel clip that closes the loop: a body over the overlapping ends, a graphite spine, two wire arms folded outward. */
function clipGeometry(L: LoopPose): { body: BufferGeometry; spine: BufferGeometry; wire: BufferGeometry } {
  const p = loopPoint(L, L.clipAt + 0.05);
  const n = loopNormal(L, L.clipAt + 0.05);
  const ang = Math.atan2(n[1], n[0]);
  const place = (g: BufferGeometry) => {
    g.rotateZ(ang);
    g.translate(p[0], p[1], 0);
    return g;
  };
  // local x: outward across the tape; y: along it
  const body = place(slab({ x0: -23, x1: 23, y0: -21, y1: 21 }, L.z + 0.9, L.z + 8, 5, 2));
  const spine = place(slab({ x0: -24, x1: 24, y0: -4, y1: 4 }, L.z + 7.2, L.z + 10.6, 1.6, 0.8));
  const wire = place(
    merge(
      [-1, 1].map((k) =>
        tube(
          [
            [16, k * 3, L.z + 10.2],
            [30, k * 13, L.z + 10.8],
            [44, k * 12, L.z + 7],
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

/** A folder's still parts (folder-local): the cover and its tab, the stack's staggered layers, the top sheet, the task card and its clip, the pen's post. */
function folderGeometry(fl: FolderLayout) {
  const { w, d } = fl;
  const [sw, sd] = sheetSize(fl);
  const cover = slab({ x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 }, 0, COVER_Z, 3, 0.5);
  const tw = 36 + ((fl.n * 7) % 3) * 4;
  const tx = -w / 2 + tw / 2 + 8 + (w - tw - 16) * fl.tab;
  const tab = slab({ x0: tx - tw / 2, x1: tx + tw / 2, y0: d / 2 - 6, y1: d / 2 + 13 }, 0, COVER_Z, 4, 0.4);
  // the stack: layers whose edges stagger (a thick stack shows many), cut as its contents are
  const K = Math.max(2, Math.min(6, Math.round(fl.sheets / 4)));
  const h = fl.sheets * SHEET;
  const layers: BufferGeometry[] = [];
  for (let j = 0; j < K; j++) {
    const top = j === K - 1;
    const jx = top ? 0 : (rand(0xf01d, fl.n, j) * 2 - 1) * (fl.contents === 'slips' ? 5 : 2.4);
    const jy = top ? 0 : (rand(0xf01d, fl.n, j + 9) * 2 - 1) * (fl.contents === 'slips' ? 4 : 2);
    const g = extrude(sheetShape(fl), COVER_Z + (j * h) / K, COVER_Z + ((j + 1) * h) / K, 0.3);
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
  // the task card, clipped near the sheet's north-west corner, turned a little
  const [cw, cd] = CARD[fl.card];
  // clipped at the north-west or north-east corner, by folder
  const east = cardEast(fl);
  const cc: P2 = [east ? sw / 2 - cw / 2 - 4 : -sw / 2 + cw / 2 + 4, sd / 2 - cd / 2 - 6];
  const turn = (rand(0xc4d, fl.n, 0) * 2 - 1) * 0.06;
  const card = (() => {
    const g = piece(fl.card, cw, cd, 0.7);
    g.rotateZ(turn);
    g.translate(cc[0], cc[1], stackTop(fl) + 0.2);
    return g;
  })();
  const clip = (() => {
    const g = merge([slab({ x0: -9, x1: 9, y0: -5, y1: 5 }, 0, 4.5, 1.5, 0.8)]);
    g.rotateZ(turn);
    g.translate(cc[0] + (east ? 6 : -6), cc[1] + cd / 2 - 1, stackTop(fl) + 0.9);
    return g;
  })();
  const clipWire = (() => {
    const g = tube(
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
    g.rotateZ(turn);
    g.translate(cc[0] + (east ? 6 : -6), cc[1] + cd / 2 - 1, stackTop(fl) + 0.9);
    return g;
  })();
  const pv = penPivot(fl);
  const post = merge([cylinderZ(4.5, COVER_Z, COVER_Z + 2, pv[0], pv[1], 18), cylinderZ(2.4, COVER_Z, stackTop(fl) + PEN.post, pv[0], pv[1], 12)]);
  return { cover, tab, layers: merge(layers), topSheet, dogEar, card, clip, clipWire, post };
}

/** The pen arm from its post to the nib holder, and the nib (folder-local). */
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

function Folder({ fl, s, lit, mats }: { fl: FolderLayout; s: FolderState; lit: number; mats: FolderMats }) {
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
  if (s.present <= 0) return null;
  const drop = (1 - s.present) * 60;
  return (
    <group position={[fl.c[0], fl.c[1], drop]} rotation={[0, 0, fl.rot]}>
      <mesh geometry={g.cover} material={mats.cover} />
      <mesh geometry={g.tab} material={mats.cover} />
      <mesh geometry={g.layers} material={mats.sheet} />
      <mesh geometry={g.topSheet} material={mats.top} />
      {g.dogEar && <mesh geometry={g.dogEar} material={mats.cover} />}
      <mesh geometry={g.card} material={mats.card} />
      <mesh geometry={g.clip} material={m.graphiteDark} />
      <mesh geometry={g.clipWire} material={m.steel} />
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
  );
}

// ------------------------------------------------------------------------------------------------
// The heap and the request

/** The request, creased while buried: its body (the beetle cut through at the west end, under the heap) and the east flap, folded up along the crease. */
function requestGeometry(): { body: BufferGeometry; flap: BufferGeometry; crease: BufferGeometry } {
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
  flap.rotateY(-R.lift);
  flap.translate(xc, 0, 0.2);
  const crease = slab({ x0: xc - 1.2, x1: xc + 1.2, y0: -hw + 1, y1: hw - 1 }, 0.2, 0.9, 0.4, 0.1);
  const place = (g: BufferGeometry) => {
    g.rotateZ(R.rot);
    g.translate(R.c[0], R.c[1], R.z);
    return g;
  };
  return { body: place(bodyG), flap: place(flap), crease: place(crease) };
}

function Heap({ a, print: tex }: { a: ActOneState; print: ActOnePrint }) {
  const { full } = useDeskSets();
  const geo = useMemo(() => ({ chat: piece('chat', ...PIECE.chat), ci: piece('ci', ...PIECE.ci), request: requestGeometry() }), []);
  // the heap's paper, in the stepped set (C4 steps the intake down): one material per print and stock
  const mats = useMemo(() => {
    const out: Record<string, MeshStandardMaterial> = {};
    for (const kind of ['chat', 'ci'] as const)
      (kind === 'chat' ? tex.chat : tex.ci).forEach((t, v) => {
        for (const tone of [0, 1]) out[`${kind}${v}${tone}`] = paper(t, tone ? '#9C968A' : '#8E897F', { stepped: true });
      });
    return out;
  }, [tex]);
  useLayoutEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const keyOf = (kind: CardKind, v: number, tone: number) => `${kind}${v % (kind === 'chat' ? tex.chat.length : tex.ci.length)}${tone > 0.45 ? 1 : 0}`;
  return (
    <group>
      {/* the request keeps its vermilion when the intake steps down: it is the film's tracer */}
      <mesh geometry={geo.request.body} material={full.vermilionPaper} />
      <mesh geometry={geo.request.flap} material={full.vermilionPaper} />
      <mesh geometry={geo.request.crease} material={full.vermilionShade} />
      {HEAP.map((p, i) => (
        <mesh key={i} geometry={geo[p.kind]} material={mats[keyOf(p.kind, p.v, p.tone)]} position={[p.c[0], p.c[1], p.z]} rotation={[0, 0, p.rot]} />
      ))}
      {a.flight && <mesh geometry={geo.chat} material={mats[keyOf('chat', 3, 1)]} position={a.flight.pos} rotation={[a.flight.tilt, 0.12, -0.5]} />}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------

function NotesLoop({ a, tape }: { a: ActOneState; tape: MeshStandardMaterial }) {
  const m = useDeskMats();
  const L = a.loop;
  const g = useMemo(() => ({ ribbon: ribbonGeometry(L), tabs: tabsGeometry(L), clip: clipGeometry(L) }), [L]);
  const tabMat = useMemo(() => paper(whiteTexture(), TAPE_HEX.tab), []);
  useLayoutEffect(() => () => tabMat.dispose(), [tabMat]);
  return (
    <group>
      <mesh geometry={g.ribbon} material={tape} />
      <mesh geometry={g.tabs} material={tabMat} />
      {L.closed > 0.5 && (
        <>
          <mesh geometry={g.clip.body} material={m.enamel} />
          <mesh geometry={g.clip.spine} material={m.graphiteDark} />
          <mesh geometry={g.clip.wire} material={m.steel} />
        </>
      )}
    </group>
  );
}

/** How lit each folder is: the lamp's aim near its centre. */
const litOf = (a: ActOneState, fl: FolderLayout): number => Math.exp(-((a.lamp.aim[0] - fl.c[0]) ** 2 + (a.lamp.aim[1] - fl.c[1]) ** 2) / (2 * 50 * 50));

/** Act one's own objects (the desk and feeders pose themselves). */
export function ActOneObjects({ a, printFamily }: { a: ActOneState; printFamily: string }) {
  const gl = useThree((s) => s.gl);
  const L0 = a.loop;
  const arc = useMemo(() => loopArc(L0), [L0]);
  const notes = useMemo(
    () =>
      // one note per session, evenly along the tape, clear of the clip's overlap and of the east point (where your label's leader crosses)
      FOLDERS.map((_, i) => 60 + ((arc.len - 120) * (i + 1)) / FOLDERS.length - 40),
    [L0, arc],
  );
  const print = useMemo(() => makeActOnePrint(printFamily, Math.min(8, gl.capabilities.getMaxAnisotropy()), Math.ceil(arc.len), notes), [printFamily, gl, arc.len, notes]);
  const mats = useMemo(() => {
    const white = whiteTexture();
    return {
      tape: paper(print.tape, TAPE_HEX.tape),
      folders: FOLDERS.map((_, i): FolderMats => ({ cover: paper(white), sheet: paper(white), top: paper(print.top[i]), card: paper(print.card[i]) })),
    };
  }, [print]);
  useLayoutEffect(
    () => () => {
      mats.tape.dispose();
      for (const f of mats.folders) for (const m of Object.values(f)) m.dispose();
      for (const t of [...print.top, ...print.card, print.tape, ...print.chat, ...print.ci]) t.dispose();
    },
    [mats, print],
  );
  return (
    <>
      {FOLDERS.map((fl, i) => (
        <Folder key={fl.n} fl={fl} s={a.folders[i]} lit={litOf(a, fl)} mats={mats.folders[i]} />
      ))}
      <NotesLoop a={a} tape={mats.tape} />
      <Heap a={a} print={print} />
    </>
  );
}
