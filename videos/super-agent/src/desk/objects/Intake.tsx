/**
 * Intake (synthesis §2, element sheet): where messages enter, west of the Register. Each feeder is its
 * channel's own form family, so at 25% no two read alike:
 * - chat: a ticker drum in the shape of a speech bubble (a round enamel drum, its spout the bubble's
 *   tail), its paper roll seen through the top, the slip coming out whole;
 * - CI: an open card hopper, a stack of punched cards between its cheeks, the top card fed out over a
 *   steel roller;
 * - mail: a letter box (generic in act one, graphite) whose lid carries an envelope's flap, the envelope
 *   in its mouth; calendar: a tear-off pad on a graphite base, a date grid on its top leaf, a torn leaf
 *   beside it. After the turn both are vellum plan drawings (proposed, FACTS l.115).
 * - the conversation spool beside the chat drum: a spool of cord (graphite until C17 pays the request's
 *   Thread out, vermilion after: design D1), its windings seen through the windows of its top flange.
 * - The Fast Path: a steel gate of fingers across the intake (code, not the Router); survivors ride
 *   the belt up into the Register's throat. Each finger is its own body: in beat 5 they flip the dropped slips onto
 *   the spike (desk/beat5.ts; the spike, the slips and the hand-over are objects/Filter.tsx).
 * In C12 all of it steps down (state.ts FOCUS_BEATS).
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Shape, type BufferGeometry, type Texture } from 'three';
import { cylinderZ, disc, dome, extrude, merge, piece, plane, planeOn, ringFlat, slab, sweep, tube } from '../geom.ts';
import { matte, paper } from '../gl/materials.ts';
import { texture, tooth } from '../gl/text.ts';
import { Step, WithMats, isStepped } from '../kit.tsx';
import type { Press } from '../turn.ts';
import { BELT, FEEDERS, FEEDER_H, FINGER_ROOT, FINGER_Y, GATE, SPOOL, rectC, type P2, type P3, type Rect } from '../layout.ts';
import { CORD_FROM, type DeskState } from '../state.ts';
import { ACT_ONE_END, GENERIC_FEEDERS } from '../actOne.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A speech bubble as one filled shape (a rounded body and its tail, never rules inside: glyph-line "text" is BANNED, the
 * critic's P0 on (b) and MT1). `x, y` its body's top-left, `bh` its body's height; the tail drops from the body's
 * lower-left toward the slip's west end.
 */
export function bubbleMark(g: CanvasRenderingContext2D, x: number, y: number, bh: number, color = '#3E3D3A'): void {
  const bw = bh * 1.32;
  const r = bh * 0.34;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + bw - r, y);
  g.quadraticCurveTo(x + bw, y, x + bw, y + r);
  g.lineTo(x + bw, y + bh - r);
  g.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
  g.lineTo(x + bh * 0.62, y + bh);
  g.lineTo(x + bh * 0.12, y + bh * 1.32);
  g.lineTo(x + bh * 0.3, y + bh);
  g.lineTo(x + r, y + bh);
  g.quadraticCurveTo(x, y + bh, x, y + bh - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.fill();
}

/**
 * A chat slip's print: the paper's tooth, its specks seeded so no two slips print alike, and the chat family's mark (the
 * spout's own slip in signed-off still (b)): one filled speech bubble near its west end, half the slip's height or more,
 * so it reads at 24 px or more where a slip is meant to be read (the notch at its leading end is its cut).
 */
export function chatSlipPrint(g: CanvasRenderingContext2D, w: number, h: number, seed = 0, mark = true): void {
  tooth(g, w, h);
  g.fillStyle = 'rgba(70,64,54,0.10)';
  const n = Math.round((w * h) / 40);
  for (let i = 0; i < n; i++) {
    const a = Math.imul(i + 1 + seed * 7919, 2654435761) >>> 0;
    const b = Math.imul(i + 13 + seed * 104729, 2246822519) >>> 0;
    g.fillRect(((a % 10007) / 10007) * w, ((b % 10009) / 10009) * h, 0.7, 0.7);
  }
  if (!mark) return;
  const bh = h * 0.5;
  bubbleMark(g, Math.max(3, h * 0.16), h * 0.16, bh);
}

/** A calendar leaf's print: a header bar and a 7 × 4 grid of day cells, one ringed (marks, never dates). */
export function leafPrint(g: CanvasRenderingContext2D, w: number, h: number, ringed = 17): void {
  tooth(g, w, h);
  const sx = w / 96;
  const sy = h / 52;
  g.fillStyle = '#4E4C47';
  g.fillRect(6 * sx, 5 * sy, 84 * sx, 6 * sy);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 7; c++) {
      g.fillStyle = '#7A766E';
      g.fillRect((8 + c * 11.6) * sx, (15 + r * 8.6) * sy, 7.6 * sx, 5.2 * sy);
    }
  g.strokeStyle = '#2A2B2A';
  g.lineWidth = 1.4;
  g.strokeRect((8 + (ringed % 7) * 11.6 - 1.6) * sx, (15 + Math.floor(ringed / 7) * 8.6 - 1.6) * sy, 10.8 * sx, 8.4 * sy);
}

/** The chat feeder's slip and its roll's top (marks only), and the calendar's top leaf (a date grid). */
function useFeederPrint(): { slip: Texture; roll: Texture; leaf: Texture } {
  const t = useMemo(
    () => ({
      slip: texture(96, 40, (g) => chatSlipPrint(g, 96, 40, 11), 4),
      // the paper roll seen from above: its wound turns
      roll: texture(
        60,
        60,
        (g) => {
          for (let k = 0; k < 14; k++) {
            g.strokeStyle = k % 2 ? '#D8D3C8' : '#C4BEB2';
            g.lineWidth = 1.6;
            g.beginPath();
            g.arc(30, 30, 9 + k * 1.5, 0, Math.PI * 2);
            g.stroke();
          }
          g.fillStyle = '#7D786F';
          g.beginPath();
          g.arc(30, 30, 8, 0, Math.PI * 2);
          g.fill();
        },
        4,
      ),
      // a month's leaf: a header bar and a 7 x 4 grid of day cells, one ringed
      leaf: texture(96, 52, (g) => leafPrint(g, 96, 52), 4),
    }),
    [],
  );
  useLayoutEffect(() => () => Object.values(t).forEach((x) => x.dispose()), [t]);
  return t;
}

/**
 * Act one's mail and calendar feeders: generic, so graphite and paper (no enamel: not the
 * prototype's built channels). A letter box whose lid carries an envelope's flap, an envelope in its
 * mouth; a tear-off pad on a graphite base, its binding along the north edge, one torn leaf beside it.
 */
function genericFeeders() {
  const G = GENERIC_FEEDERS;
  const B = G.mailBox;
  const [bx, by] = rectC(B);
  const box = slab(B, 0, G.mailH, 6, 2.5);
  const plate = slab(inset(B, 7), G.mailH - 0.5, G.mailH + 2, 4, 1);
  // the lid's envelope flap: a raised V across the plate (mail by its silhouette), and the hooded mouth's lip
  const flapV = (() => {
    const t = new Shape();
    const hw = (B.x1 - B.x0) / 2 - 12;
    const hd = (B.y1 - B.y0) / 2 - 12;
    t.moveTo(bx - hw, by + hd);
    t.lineTo(bx + hw, by + hd);
    t.lineTo(bx, by - hd * 0.25);
    t.closePath();
    return extrude(t, G.mailH + 2, G.mailH + 4.2, 0.6);
  })();
  const slot = merge([slab({ x0: bx - hw0(B), x1: bx + hw0(B), y0: B.y0 + 9, y1: B.y0 + 13 }, G.mailH + 2, G.mailH + 3, 1, 0.3)]);
  const mouth = merge([slab({ x0: B.x1 - 2, x1: B.x1 + 16, y0: by - 28, y1: by + 28 }, 0, G.envelope.z, 2, 1), slab({ x0: B.x1 - 2, x1: B.x1 + 14, y0: by - 30, y1: by + 30 }, G.envelope.z + 6, G.envelope.z + 10, 2, 1)]);
  const E = G.envelope;
  const place = (g: ReturnType<typeof slab>, c: P2, rot: number) => {
    g.rotateZ(rot);
    g.translate(c[0], c[1], 0);
    return g;
  };
  const envelope = place(slab({ x0: -E.w / 2, x1: E.w / 2, y0: -E.d / 2, y1: E.d / 2 }, E.z, E.z + 0.7, 1.5, 0.2), E.c, E.rot);
  const flap = (() => {
    const t = new Shape();
    t.moveTo(-E.w / 2 + 2, E.d / 2 - 2);
    t.lineTo(E.w / 2 - 2, E.d / 2 - 2);
    t.lineTo(0, -E.d * 0.08);
    t.closePath();
    return place(extrude(t, E.z + 0.7, E.z + 1.3, 0.2), E.c, E.rot);
  })();
  const P = G.pad;
  const base = slab(P, 0, 8, 6, 2);
  const leaves = slab(inset(P, 8), 8, G.padH, 3, 0.6);
  const leafTop = planeOn({ x0: P.x0 + 14, x1: P.x1 - 14, y0: P.y0 + 10, y1: P.y1 - 18 }, G.padH + 0.15);
  const binding = slab({ x0: P.x0 + 6, x1: P.x1 - 6, y0: P.y1 - 16, y1: P.y1 - 6 }, G.padH - 1, G.padH + 4, 3, 1.2);
  const rings = merge([0.3, 0.7].map((k) => tube([[P.x0 + (P.x1 - P.x0) * k, P.y1 - 20, G.padH], [P.x0 + (P.x1 - P.x0) * k, P.y1 - 11, G.padH + 6], [P.x0 + (P.x1 - P.x0) * k, P.y1 - 2, G.padH + 1]], 1.6, 10, 8)));
  const L = G.leaf;
  const leaf = (() => {
    // a torn leaf: its top edge ragged where it left the pad
    const t = new Shape();
    t.moveTo(-L.w / 2, -L.d / 2);
    t.lineTo(L.w / 2, -L.d / 2);
    t.lineTo(L.w / 2, L.d / 2 - 4);
    for (let i = 1; i <= 8; i++) t.lineTo(L.w / 2 - (L.w * i) / 8, L.d / 2 - (i % 2 ? 0 : 4));
    t.closePath();
    return place(extrude(t, 0.2, 0.9, 0.15), L.c, L.rot);
  })();
  return { box, plate, flapV, slot, mouth, envelope, flap, base, leaves, leafTop, binding, rings, leaf };
}
const hw0 = (B: Rect) => (B.x1 - B.x0) / 2 - 18;

function useFeederGeometry() {
  return useMemo(() => {
    // the chat ticker: an enamel drum whose spout is a speech bubble's tail; its paper roll in the open top; the slip
    const C = FEEDERS.chat;
    const [cx, cy] = rectC(C);
    const r = (C.y1 - C.y0) / 2;
    const drum = merge([cylinderZ(r, 0, FEEDER_H.chat - 4, cx, cy, 56), disc(r + 2, FEEDER_H.chat - 6, FEEDER_H.chat, { cx, cy, bevel: 1.6, inner: r - 12 })]);
    const rollWell = disc(r - 12, FEEDER_H.chat - 10, FEEDER_H.chat - 9, { cx, cy });
    const roll = cylinderZ(r - 15, FEEDER_H.chat - 10, FEEDER_H.chat - 3, cx, cy, 40);
    const rollTop = plane(2 * (r - 15), 2 * (r - 15), cx, cy, FEEDER_H.chat - 2.8);
    const spoutY = cy - 4;
    // the tail: wide at the drum, narrowing to the mouth where the slip comes out (a bubble's tail from above)
    const spout = (() => {
      const t = new Shape();
      t.moveTo(cx + r - 14, spoutY + 30);
      t.quadraticCurveTo(cx + r + 16, spoutY + 26, cx + r + 34, spoutY + 22);
      t.lineTo(cx + r + 34, spoutY - 22);
      t.quadraticCurveTo(cx + r + 10, spoutY - 30, cx + r - 14, spoutY - 30);
      t.closePath();
      return extrude(t, 0, 16, 1.4);
    })();
    const spoutMouth = slab({ x0: cx + r + 28, x1: cx + r + 35, y0: spoutY - 22, y1: spoutY + 22 }, 2, 12, 1, 0.5);
    // the slip: its west end in the spout's mouth, the rest lying out on the desk in front of it, whole, notched at its
    // leading (east) end like every chat slip (the cut is its mark)
    const slip = piece('chat', 96, 40, 0.8);
    slip.translate(cx + r + 80, spoutY, 0);
    // the conversation spool: a post on a foot, two flanges, the cord wound between (its turns as ridges), windows in the top flange
    const spoolPost = merge([cylinderZ(6, 0, SPOOL.z[0], SPOOL.x, SPOOL.y, 16), disc(18, 0, 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1 })]);
    const win = [0, 1, 2, 3].map((k) => ({ c: [SPOOL.x + 17 * Math.cos(k * (Math.PI / 2) + 0.4), SPOOL.y + 17 * Math.sin(k * (Math.PI / 2) + 0.4)] as P2, r: 7 }));
    const flanges = merge([disc(SPOOL.r, SPOOL.z[0], SPOOL.z[0] + 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2 }), disc(SPOOL.r, SPOOL.z[1] - 4, SPOOL.z[1], { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2, holes: win })]);
    const barrel = cylinderZ(12, SPOOL.z[0] + 4, SPOOL.z[1] - 4, SPOOL.x, SPOOL.y, 24);
    const turns = 9;
    const wound = merge([cylinderZ(24.5, SPOOL.z[0] + 5, SPOOL.z[1] - 5, SPOOL.x, SPOOL.y, 40), ...Array.from({ length: turns }, (_, i) => ringFlat(25, 1.7, SPOOL.x, SPOOL.y, SPOOL.z[0] + 7 + ((SPOOL.z[1] - SPOOL.z[0] - 14) * i) / (turns - 1)))]);
    // the cord's loose end, tucked under a clip on the post's foot
    const tail = tube(
      [
        [SPOOL.x + 24, SPOOL.y - 6, SPOOL.z[0] + 9],
        [SPOOL.x + 30, SPOOL.y - 16, SPOOL.z[0] - 10],
        [SPOOL.x + 22, SPOOL.y - 20, 2.5],
        [SPOOL.x + 12, SPOOL.y - 16, 2.5],
      ],
      1.7,
      16,
      6,
    );
    const spoolCap = dome(6, SPOOL.x, SPOOL.y, SPOOL.z[1]);

    // the CI feeder: an open hopper (a back plate and two cheeks), its stack of punched cards staggered, a roller at the mouth
    const F = FEEDERS.ci;
    const [fx, fy] = rectC(F);
    const ciBase = slab(F, 0, 8, 6, 2);
    const ciBack = slab({ x0: F.x0, x1: F.x0 + 10, y0: F.y0, y1: F.y1 }, 8, FEEDER_H.ci, 3, 1.5);
    const ciCheeks = merge([slab({ x0: F.x0, x1: F.x1 - 8, y0: F.y0, y1: F.y0 + 8 }, 8, FEEDER_H.ci - 10, 3, 1.5), slab({ x0: F.x0, x1: F.x1 - 8, y0: F.y1 - 8, y1: F.y1 }, 8, FEEDER_H.ci - 10, 3, 1.5)]);
    // the deck shingled toward the mouth: each card a punched card with its clipped corner, a little east of the one under it
    const cw = F.x1 - F.x0 - 30;
    const cd = F.y1 - F.y0 - 26;
    const card = (i: number) => {
      const c = new Shape();
      const x = cw / 2;
      const y = cd / 2;
      const k = 12;
      c.moveTo(-x + k, y);
      c.lineTo(x, y);
      c.lineTo(x, -y);
      c.lineTo(-x, -y);
      c.lineTo(-x, y - k);
      c.closePath();
      const g = extrude(c, 8 + i * 4.2, 8 + i * 4.2 + 3.4, 0.4);
      g.rotateZ((i % 2 ? 1 : -1) * 0.025 * (5 - i));
      g.translate(fx - 4 + i * 3.4, fy - 1 + (i % 2) * 2, 0);
      return g;
    };
    const cards = merge(Array.from({ length: 5 }, (_, i) => card(i)));
    const topCard = (() => {
      const g = plane(cw, cd, 0, 0, 0);
      g.translate(fx - 4 + 5 * 3.4, fy - 1 + 2, 8 + 5 * 4.2 + 3.4 + 0.25);
      return g;
    })();
    const topCardBody = card(5);
    const roller = (() => {
      const g = cylinderZ(6, 0, 70, 0, 0, 20);
      g.rotateX(Math.PI / 2);
      g.translate(F.x1 - 2, fy + 35, 12);
      return g;
    })();
    const ciMouth = slab({ x0: F.x1 - 4, x1: F.x1 + 22, y0: fy - 32, y1: fy + 32 }, 0, 6, 2, 1);
    const ciCard = plane(84, 50, F.x1 + 30, fy - 2, 8.6);

    // vellum drawings: the mail and calendar feeders, proposed
    const mail = planeOn(FEEDERS.mail, 0.4);
    const calendar = planeOn(FEEDERS.calendar, 0.4);
    return { drum, rollWell, roll, rollTop, spout, spoutMouth, slip, spoolPost, flanges, barrel, wound, tail, spoolCap, ciBase, ciBack, ciCheeks, cards, topCard, topCardBody, roller, ciMouth, ciCard, mail, calendar, generic: genericFeeders() };
  }, []);
}

/** The belt from its throat end out to `e` of its run (1: down to its foot by the gate), its rails, ribs and legs. */
function beltGeometry(e: number): { belt: BufferGeometry; rails: BufferGeometry; ribs: BufferGeometry | null; legs: BufferGeometry | null } {
  const from = lerp3(BELT.to, BELT.from, e);
  const mid = lerp3(from, BELT.to, 0.5);
  const path: P3[] = [from, [mid[0], mid[1], mid[2] + 2 * e], BELT.to];
  const w = BELT.w / 2;
  const belt = sweep(
    path,
    [
      [-w, 0],
      [w, 0],
      [w, -4],
      [-w, -4],
      [-w, 0],
    ],
    20,
  );
  const d = [BELT.to[0] - BELT.from[0], BELT.to[1] - BELT.from[1]];
  const l = Math.hypot(d[0], d[1]);
  const rails = merge(
    [-1, 1].map((k) => {
      const side: P2 = [(-d[1] / l) * (w + 3) * k, (d[0] / l) * (w + 3) * k];
      return tube(
        path.map((p) => [p[0] + side[0], p[1] + side[1], p[2] + 5] as P3),
        3,
        20,
        8,
      );
    }),
  );
  const ang = Math.atan2(BELT.to[1] - BELT.from[1], BELT.to[0] - BELT.from[0]);
  const ribList = Array.from({ length: 9 }, (_, i) => (i + 0.5) / 9)
    .filter((t) => t >= 1 - e)
    .map((t) => {
      const p = lerp3(BELT.from, BELT.to, t);
      const s = new Shape();
      s.moveTo(-2, -w + 3);
      s.lineTo(2, -w + 3);
      s.lineTo(2, w - 3);
      s.lineTo(-2, w - 3);
      s.closePath();
      const g = extrude(s, 0, 2.2, 0.4);
      g.rotateZ(ang);
      g.translate(p[0], p[1], p[2] + 0.6);
      return g;
    });
  // each leg drops from under the belt to the desk once the belt has run out past it (over a sixth of the run)
  const legList = [0.25, 0.7]
    .map((t) => ({ t, k: Math.min(1, Math.max(0, (e - (1 - t)) / 0.16)) }))
    .filter((x) => x.k > 0.002)
    .map(({ t, k }) => {
      const p = lerp3(BELT.from, BELT.to, t);
      const top = p[2] - 4;
      const bottom = top * (1 - k);
      return merge([cylinderZ(4, bottom, top, p[0], p[1], 12), disc(10, bottom, bottom + 3, { cx: p[0], cy: p[1], bevel: 0.8 })]);
    });
  return { belt, rails, ribs: ribList.length ? merge(ribList) : null, legs: legList.length ? merge(legList) : null };
}

function useGateGeometry() {
  return useMemo(() => {
    const G = GATE.bar;
    const gateBar = slab(G, 0, GATE.h, 3, 1.5);
    const gateCap = slab(inset(G, 2), GATE.h, GATE.h + 3, 2, 0.8);
    // each finger its own body (beat 5 flips them, desk/beat5.ts fingersAt), built where it stands at rest
    const fingers = FINGER_Y.map((y) =>
      merge([
        tube(
          [
            [G.x0 + 2, y, GATE.h - 10],
            [G.x0 - GATE.fingerL * 0.6, y, GATE.h - 12],
            [G.x0 - GATE.fingerL, y, GATE.h - 18],
          ],
          2.6,
          10,
          8,
        ),
        dome(3, G.x0 - GATE.fingerL, y, GATE.h - 20),
      ]),
    );
    // (the spike stands up beside it at 5.2, f2470: objects/Filter.tsx)
    return { gateBar, gateCap, fingers };
  }, []);
}

/** The turn's pose of the feeders (desk/turn.ts): the spool sliding in from the north (u north of its seat, null: not there), mail and calendar pressed into the desk, leaving their vellum drawings. */
export interface FeedersTurn {
  spool: number | null;
  mail: Press;
  calendar: Press;
}

export function Feeders({ s, turn }: { s: DeskState; turn?: FeedersTurn }) {
  const g = useFeederGeometry();
  const tex = useFeederPrint();
  // their own prints and the mail slot's dark, in every mode the kit steps (full, the beat's, its own ramp, the late
  // one): each binds that mode's step amount, so the intake steps down by its amount over the ramp, never by swapping
  // to a set at another amount in one frame (the summary critic's P0: the spout's mouth popped)
  const sets = useMemo(() => {
    const make = (stepped: boolean | 'own' | 'late') => ({
      slip: paper(tex.slip, undefined, { stepped }),
      roll: paper(tex.roll, undefined, { stepped }),
      leaf: paper(tex.leaf, '#A29C90', { stepped }),
      slot: matte('#161817', 1, 0, stepped),
    });
    return { full: make(false), stepped: make(true), own: make('own'), late: make('late') };
  }, [tex]);
  useLayoutEffect(() => () => Object.values(sets).forEach((set) => Object.values(set).forEach((m) => m.dispose())), [sets]);
  const on = isStepped(s.step, 'intake');
  const mats = on === 'own' ? sets.own : on ? sets.stepped : sets.full;
  // the conversation spool belongs to the Threads: it is not on the desk in act one (nor are the mail and calendar
  // drawings: those feeders are generic until the turn); its cord is graphite until the request's Thread first pays
  // out (state.ts CORD_FROM, design D1), then vermilion
  const spool = turn ? turn.spool !== null : s.f >= ACT_ONE_END;
  const vermilion = s.f >= CORD_FROM;
  // the turn: the generic boxes are pressed flat and into the desk as one body each (desk/turn.ts pressAt), leaving the vellum drawings
  const pressed = (p: Press, r: Rect, body: ReactNode) => {
    if (p.k >= 1) return null;
    const [cx, cy] = rectC(r);
    return (
      <group position={[cx, cy, -p.sink]} rotation={[-p.tilt, 0, 0]} scale={[1, 1, Math.max(p.scaleZ, 1e-3)]}>
        <group position={[-cx, -cy, 0]}>{body}</group>
      </group>
    );
  };
  return (
    <Step on={on}>
      <WithMats>
        {(m) => {
          const mail = (
            <>
              <mesh geometry={g.generic.box} material={m.graphite} />
              <mesh geometry={g.generic.plate} material={m.graphiteDark} />
              <mesh geometry={g.generic.flapV} material={m.graphite} />
              <mesh geometry={g.generic.slot} material={mats.slot} />
              <mesh geometry={g.generic.mouth} material={m.graphite} />
              <mesh geometry={g.generic.envelope} material={m.paper} />
              <mesh geometry={g.generic.flap} material={m.paperShade} />
            </>
          );
          const pad = (
            <>
              <mesh geometry={g.generic.base} material={m.graphite} />
              <mesh geometry={g.generic.leaves} material={m.paper} />
              <mesh geometry={g.generic.leafTop} material={mats.leaf} />
              <mesh geometry={g.generic.binding} material={m.graphiteDark} />
              <mesh geometry={g.generic.rings} material={m.steel} />
              <mesh geometry={g.generic.leaf} material={m.paper} />
            </>
          );
          return (
            <group>
              <mesh geometry={g.drum} material={m.enamel} />
              <mesh geometry={g.rollWell} material={m.graphiteDark} />
              <mesh geometry={g.roll} material={m.paperShade} />
              <mesh geometry={g.rollTop} material={mats.roll} />
              <mesh geometry={g.spout} material={m.enamelShade} />
              <mesh geometry={g.spoutMouth} material={m.graphiteDark} />
              <mesh geometry={g.slip} material={mats.slip} />
              {spool && (
                <group position={[0, turn?.spool ?? 0, 0]}>
                  <mesh geometry={g.spoolPost} material={m.graphite} />
                  <mesh geometry={g.flanges} material={m.enamel} />
                  <mesh geometry={g.barrel} material={m.graphiteDark} />
                  <mesh geometry={g.wound} material={vermilion ? m.cordVermilion : m.rubber} />
                  <mesh geometry={g.tail} material={vermilion ? m.cordVermilion : m.rubber} />
                  <mesh geometry={g.spoolCap} material={m.steel} />
                </group>
              )}
              <mesh geometry={g.ciBase} material={m.graphite} />
              <mesh geometry={g.ciBack} material={m.enamel} />
              <mesh geometry={g.ciCheeks} material={m.enamel} />
              <mesh geometry={g.cards} material={m.paperShade} />
              <mesh geometry={g.topCardBody} material={m.paper} />
              <mesh geometry={g.topCard} material={m.printed.ciCard} />
              <mesh geometry={g.roller} material={m.steel} />
              <mesh geometry={g.ciMouth} material={m.enamelShade} />
              <mesh geometry={g.ciCard} material={m.printed.ciCard} />
              {turn ? (
                <>
                  {turn.mail.k > 0 && <mesh geometry={g.mail} material={m.vellumMail} />}
                  {turn.calendar.k > 0 && <mesh geometry={g.calendar} material={m.vellumCalendar} />}
                  {pressed(turn.mail, FEEDERS.mail, mail)}
                  {pressed(turn.calendar, FEEDERS.calendar, pad)}
                </>
              ) : spool ? (
                <>
                  <mesh geometry={g.mail} material={m.vellumMail} />
                  <mesh geometry={g.calendar} material={m.vellumCalendar} />
                </>
              ) : (
                <>
                  {mail}
                  {pad}
                </>
              )}
            </group>
          );
        }}
      </WithMats>
    </Step>
  );
}

/**
 * The gate and the belt. In the turn the belt runs out of the throat down to its foot (`belt`: 0..1 of its run;
 * null: still stowed in the throat), carrying the gate at its foot; at rest both stand in place.
 */
export function Gate({ s, belt }: { s: DeskState; belt?: number | null }) {
  const g = useGateGeometry();
  const e = belt === undefined ? 1 : belt;
  const b = useMemo(() => (e === null || e <= 0.002 ? null : beltGeometry(e)), [e]);
  useLayoutEffect(
    () => () => {
      if (b) Object.values(b).forEach((x) => x?.dispose());
    },
    [b],
  );
  // beat 5: each finger turned about its root's N-S axis, tips up (0 at rest: the gate as still (b) draws it)
  const turn = s.e5.fingers;
  if (!b || e === null) return null;
  const end = lerp3(BELT.to, BELT.from, e);
  const off: P3 = [end[0] - BELT.from[0], end[1] - BELT.from[1], end[2] - BELT.from[2]];
  return (
    <>
      <Step on={isStepped(s.step, 'gate')}>
        <WithMats>
          {(m) => (
            <group position={off}>
              <mesh geometry={g.gateBar} material={m.graphite} />
              <mesh geometry={g.gateCap} material={m.enamelShade} />
              {g.fingers.map((geo, i) => (
                <group key={i} position={[FINGER_ROOT.x, FINGER_Y[i]!, FINGER_ROOT.z]} rotation={[0, turn[i] ?? 0, 0]}>
                  <mesh geometry={geo} material={m.steel} position={[-FINGER_ROOT.x, -FINGER_Y[i]!, -FINGER_ROOT.z]} />
                </group>
              ))}
            </group>
          )}
        </WithMats>
      </Step>
      <Step on={isStepped(s.step, 'belt')}>
        <WithMats>
          {(m) => (
            <group>
              <mesh geometry={b.belt} material={m.graphiteDark} />
              <mesh geometry={b.rails} material={m.enamelShade} />
              {b.ribs && <mesh geometry={b.ribs} material={m.graphite} />}
              {b.legs && <mesh geometry={b.legs} material={m.graphite} />}
            </group>
          )}
        </WithMats>
      </Step>
    </>
  );
}
