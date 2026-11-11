/**
 * A counterfactual (TREATMENT element sheet, "Counterfactuals"): a grey-stock card that comes in over the scene for one
 * beat, plays, is struck through with an ink rule and goes away. Grey stock is the road not taken: never built,
 * proposed or open, so nothing on it is enamel, vellum or vermilion. In 12 f, strike 6 f, off 8 f (desk/beat4.ts
 * cardAt); where it plays is its caller's (beat4.ts cardPose: it slides in from beyond the frame's top edge and back
 * off it, never appearing or vanishing). Used at 4.3 (the request torn three ways) and 4.4 (the Register with a bench
 * bolted on, its backlog queuing at its throat); later 7.2, 7.3, 10.2 and 11.3.
 *
 * The card is a sheet of grey stock torn off along a perforation (its top edge torn, the perforation's holes under it),
 * and what plays on it are grey-stock miniatures of the film's own objects in plan, as the camera sees the real ones:
 * low cut-outs standing a few units off its face, a darker stock than the card, each a different silhouette (never boxes
 * standing in for things, never three equal cards in a row). The strike is a heavy ink rule laid corner to corner over
 * everything on it: ink, never a glow.
 */
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, Color, MeshBasicMaterial, Path, Shape, ShapeGeometry, SRGBColorSpace, type BufferGeometry, type Texture } from 'three';
import { textCanvas } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { extrude, merge } from '../geom.ts';
import { matte, paper, whiteTexture } from '../gl/materials.ts';
import { texture, tooth } from '../gl/text.ts';
import type { P2, P3 } from '../layout.ts';

/** Grey stock: the card a light stock, its miniatures darker stocks cut out of it (the torn request a mid grey, the bays and the Register a dark one), their print and the strike a dark graphite ink. */
export const CARD_STOCK = '#ABA79D';
export const CARD_RELIEF = '#66635E';
export const CARD_RELIEF_LIGHT = '#8C8880';
export const CARD_INK = '#34352F';

/** How high the miniatures stand off the card's face, and the strike's height over them. */
const RELIEF = 3;
const RULE_Z = RELIEF * 2 + 1;

export interface CardPose {
  c: P3;
  tilt: number;
}

// ------------------------------------------------------------------------------------------------
// The card

/** A deterministic jitter in -1..1 from an index (no randomness in frame code). */
const jitter = (i: number, k = 0): number => (((Math.imul(i * 7919 + k * 104729 + 13, 2654435761) >>> 0) % 2001) / 1000 - 1);

/** The card's outline (counter-clockwise from its south-west corner): its top edge torn, ragged, short steps a few units up and down. */
function cardOutline(w: number, h: number): P2[] {
  const top = h / 2 - 5;
  const pts: P2[] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, top],
  ];
  const n = Math.round(w / 7);
  for (let i = 1; i < n; i++) pts.push([w / 2 - (w * i) / n, top + 2.6 * jitter(i) + (i % 2 ? 1.2 : -0.6)]);
  pts.push([-w / 2, top]);
  return pts;
}
const polyShape = (pts: readonly P2[]): Shape => {
  const s = new Shape();
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return s;
};

/** The card's sheet: its torn outline, the perforation's holes in a row under the tear. */
function cardShape(w: number, h: number): Shape {
  const s = polyShape(cardOutline(w, h));
  const top = h / 2 - 5;
  for (let x = -w / 2 + 9; x < w / 2 - 5; x += 10) {
    const p = new Path();
    p.absarc(x, top - 9, 1.9, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return s;
}

/** How wide the card's rim is (its cut and torn edge, a darker stock than its face), and its colour. */
const RIM = 2.4;
const RIM_HEX = '#77736B';

/** The rim: a band round the card's outline, its inner edge the outline drawn in by RIM. */
function rimShape(w: number, h: number): Shape {
  const out = cardOutline(w, h);
  const sx = (w / 2 - RIM) / (w / 2);
  const sy = (h / 2 - RIM) / (h / 2);
  const s = polyShape(out);
  const hole = new Path();
  const inner = out.map(([x, y]): P2 => [x * sx, y * sy]).reverse();
  hole.moveTo(...inner[0]);
  for (const p of inner.slice(1)) hole.lineTo(...p);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

/**
 * The card's contact shadow on whatever lies behind it as the camera sees it: its outline grown and offset down and to
 * the right of the light, a soft dark sheet just behind the card (it only shows round the card's edges). Light enough
 * that nothing under it goes below the slate's floor tone.
 */
const SHADOW = { grow: 7, dx: 6, dy: -9, opacity: 0.32 } as const;
function shadowTexture(w: number, h: number): Texture {
  const pad = SHADOW.grow * 2;
  const W = w + 2 * pad;
  const H = h + 2 * pad;
  const k = 2;
  const { c, g } = textCanvas(Math.ceil(W * k), Math.ceil(H * k));
  g.scale(k, k);
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  g.filter = 'blur(' + SHADOW.grow * 0.8 * k + 'px)';
  g.fillStyle = '#FFFFFF';
  g.fillRect(pad, pad, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The card's face print: grey stock with its tooth and a ruled border a little in from the edge (a printed card, not a panel). */
function cardFace(w: number, h: number, aniso: number): Texture {
  return texture(
    w,
    h,
    (g) => {
      tooth(g, w, h);
      g.strokeStyle = CARD_INK;
      g.lineWidth = 1.4;
      // under the perforation, the card's own field (the torn strip above it is bare stock)
      g.strokeRect(8, 24, w - 16, h - 32);
    },
    aniso,
    CARD_STOCK,
  );
}

/** Face UVs from the outline's extents. */
function faceUv(g: BufferGeometry, w: number, h: number): BufferGeometry {
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

/**
 * A counterfactual card at its pose; `inFrame`: how far it is in (beat4.ts cardIn, 0 off frame .. 1 at its place): its contact
 * shadow, which reaches past the card's lowest edge, comes in and goes with it, so on the last frame the card is drawn
 * (wholly beyond the frame's top) nothing of its shadow is left at the frame's edge to vanish the frame after.
 */
export function Counterfactual({ pose, w, h, strike, inFrame = 1, children }: { pose: CardPose; w: number; h: number; strike: number; inFrame?: number; children?: React.ReactNode }) {
  const gl = useThree((st) => st.gl);
  const mats = useMemo(() => {
    const face = cardFace(w, h, Math.min(8, gl.capabilities.getMaxAnisotropy()));
    const white = whiteTexture();
    const shade = shadowTexture(w, h);
    return {
      face,
      white,
      shade,
      card: paper(face, '#FFFFFF', { roughness: 0.92 }),
      rim: paper(white, RIM_HEX, { roughness: 0.9 }),
      shadow: new MeshBasicMaterial({ color: new Color('#000000'), alphaMap: shade, transparent: true, opacity: SHADOW.opacity, depthWrite: false }),
      ink: matte(CARD_INK, 0.85, 0, false),
    };
  }, [w, h, gl]);
  useLayoutEffect(
    () => () => {
      for (const x of [mats.face, mats.white, mats.shade, mats.card, mats.rim, mats.shadow, mats.ink]) x.dispose();
    },
    [mats],
  );
  const g = useMemo(() => {
    const sheet = faceUv(extrude(cardShape(w, h), -1.4, 0, 0.3, 1), w, h);
    const rim = extrude(rimShape(w, h), 0, 0.12, 0);
    const pad = SHADOW.grow * 2;
    const shadow = faceUv(
      new ShapeGeometry(
        polyShape([
          [-w / 2 - pad, -h / 2 - pad],
          [w / 2 + pad, -h / 2 - pad],
          [w / 2 + pad, h / 2 + pad],
          [-w / 2 - pad, h / 2 + pad],
        ]),
      ),
      w + 2 * pad,
      h + 2 * pad,
    );
    const rule = new Shape();
    rule.moveTo(0, -3.5);
    rule.lineTo(1, -3.5);
    rule.lineTo(1, 3.5);
    rule.lineTo(0, 3.5);
    rule.closePath();
    return { sheet, rim, shadow, rule: extrude(rule, 0, 0.6, 0) };
  }, [w, h]);
  useLayoutEffect(() => () => Object.values(g).forEach((x: BufferGeometry) => x.dispose()), [g]);
  // (written every frame)
  const shadowK = Math.min(1, Math.max(0, inFrame / 0.2));
  useLayoutEffect(() => {
    mats.shadow.opacity = SHADOW.opacity * shadowK * shadowK * (3 - 2 * shadowK);
  }, [mats, shadowK]);
  // the strike: from the top-left corner to the bottom-right, inset, laid as it is drawn (its pen's end leads)
  const a: P2 = [-w / 2 + 18, h / 2 - 30];
  const b: P2 = [w / 2 - 18, -h / 2 + 14];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * strike;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={pose.c} rotation={[pose.tilt, 0, 0]}>
      <mesh geometry={g.shadow} material={mats.shadow} position={[SHADOW.dx, SHADOW.dy, -3]} />
      <mesh geometry={g.sheet} material={mats.card} />
      <mesh geometry={g.rim} material={mats.rim} />
      {children}
      {strike > 0 && <mesh geometry={g.rule} material={mats.ink} position={[a[0], a[1], RULE_Z]} rotation={[0, 0, ang]} scale={[L, 1, 1]} />}
    </group>
  );
}

/** The miniatures' grey stock: the darker cut-outs, the lighter (the torn request), their ink. */
function useReliefMats() {
  const mats = useMemo(() => {
    const white = whiteTexture();
    return { white, dark: paper(white, CARD_RELIEF, { roughness: 0.9 }), light: paper(white, CARD_RELIEF_LIGHT, { roughness: 0.9 }), ink: matte(CARD_INK, 0.85, 0, false) };
  }, []);
  useLayoutEffect(
    () => () => {
      mats.white.dispose();
      mats.dark.dispose();
      mats.light.dispose();
      mats.ink.dispose();
    },
    [mats],
  );
  return mats;
}

// ------------------------------------------------------------------------------------------------
// Shapes of the miniatures (plan, face units)

function rect(x0: number, y0: number, x1: number, y1: number, r = 1.2): Shape {
  const s = new Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function circle(x: number, y: number, r: number, hole = 0): Shape {
  const s = new Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  if (hole > 0) {
    const p = new Path();
    p.absarc(x, y, hole, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return s;
}
const solid = (shapes: Shape[], z0: number, z1: number): BufferGeometry => merge(shapes.map((s) => extrude(s, z0, z1, 0.4, 1)));

/** The bug bay's bench in plan: its top, the six test pins along its north edge (each a disc standing proud). */
function benchMini(x: number, y: number, k = 1): { body: BufferGeometry; ink: BufferGeometry } {
  const w = 84 * k;
  const d = 30 * k;
  const body = solid([rect(x - w / 2, y - d / 2, x + w / 2, y + d / 2, 2)], 0, RELIEF * 1.2);
  const pins = solid(
    Array.from({ length: 6 }, (_, i) => circle(x - w / 2 + 9 * k + i * ((w - 18 * k) / 5), y + d / 2 - 6 * k, 3.2 * k)),
    RELIEF,
    RELIEF + 2.5,
  );
  return { body, ink: pins };
}
/** The test tower in plan: its stack (a disc standing tallest), its stepped cap on it, the hinge along its north edge, the cap's slot. */
function towerMini(x: number, y: number, r: number): { body: BufferGeometry; ink: BufferGeometry } {
  const body = solid([circle(x, y, r), circle(x, y + 1, r * 0.72)], 0, RELIEF * 2.2);
  const ink = solid([rect(x - r * 0.75, y + r * 0.78, x + r * 0.75, y + r * 0.96, 0.8), rect(x - r * 0.45, y - r * 0.38 - 1.3, x + r * 0.45, y - r * 0.38 + 1.3, 0.5)], RELIEF * 2.2, RELIEF * 2.2 + 1.2);
  return { body, ink };
}
/**
 * The docs galley in plan, as the real one lies in its bay: a wide low tray, its rails on three sides (open at its east
 * end), the set matter in it as solid slugs (a line of type cast whole: each a bar the line's measure, the last line short),
 * locked up by a quoin at the open end.
 */
function galleyMini(x: number, y: number): { body: BufferGeometry; ink: BufferGeometry; light: BufferGeometry } {
  const w = 92;
  const d = 30;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const body = solid([rect(x0, y - d / 2, x1, y + d / 2, 1.5)], 0, RELIEF * 0.8);
  const rail = 2.2;
  const rails = solid([rect(x0, y + d / 2 - rail, x1 - 2, y + d / 2), rect(x0, y - d / 2, x1 - 2, y - d / 2 + rail), rect(x0, y - d / 2, x0 + rail, y + d / 2)], RELIEF * 0.8, RELIEF * 0.8 + 1.4);
  // the slugs, top line first, between the rails
  const n = 4;
  const gap = 1.1;
  const t = (d - 2 * rail - 2 - (n - 1) * gap) / n;
  const measure = [x1 - 14, x1 - 14, x1 - 14, x0 + rail + 1 + (w - 2 * rail - 16) * 0.58];
  const slugs = Array.from({ length: n }, (_, i) => {
    const top = y + d / 2 - rail - 1 - i * (t + gap);
    return rect(x0 + rail + 1, top - t, measure[i], top, 0.5);
  });
  const quoin = rect(x1 - 12, y - d / 2 + rail + 1, x1 - 6, y + d / 2 - rail - 1, 0.6);
  return { body, ink: merge([rails, solid([quoin], RELIEF * 0.8, RELIEF * 0.8 + 1.6)]), light: solid(slugs, RELIEF * 0.8, RELIEF * 0.8 + 1.2) };
}

// ------------------------------------------------------------------------------------------------
// 4.3: the request torn three ways

/** The request's outline on the card (plan, face units), the beetle cut through its west end, its east end notched. */
const SLIP = { c: [-6, 42] as P2, l: 112, w: 46 } as const;
/** Where the two tears run across it (x from its west end): three unequal pieces. */
const TEARS = [34, 80] as const;
/** Each piece's destination: the bench, the tower, the galley (each its own size and place: never three in a row). */
const DEST: readonly P2[] = [
  [-88, -34],
  [10, -58],
  [94, -28],
];

function tornPieces(): BufferGeometry[] {
  const x0 = SLIP.c[0] - SLIP.l / 2;
  const yb = SLIP.c[1] - SLIP.w / 2;
  const yt = SLIP.c[1] + SLIP.w / 2;
  // a tear: ragged, from the top edge to the bottom (fixed jitter)
  const tear = (x: number, k: number): P2[] => Array.from({ length: 8 }, (_, i) => [x0 + x + 3.4 * jitter(i, k), yt - (i * SLIP.w) / 7] as P2);
  const t1 = tear(TEARS[0], 1);
  const t2 = tear(TEARS[1], 2);
  const piece = (left: P2[] | null, right: P2[] | null): Shape => {
    const s = new Shape();
    if (left) s.moveTo(left[0][0], yt);
    else s.moveTo(x0, yt);
    if (right) for (const [x, y] of right) s.lineTo(x, y);
    else {
      const x1 = x0 + SLIP.l;
      s.lineTo(x1, yt);
      // the chat slip's notch at its east end, as the real request's
      s.lineTo(x1 - SLIP.w * 0.28, SLIP.c[1]);
      s.lineTo(x1, yb);
    }
    if (left) for (const [x, y] of [...left].reverse()) s.lineTo(x, y);
    else s.lineTo(x0, yb);
    s.closePath();
    return s;
  };
  const west = piece(null, t1);
  // the beetle, cut through the west piece: its body, head and legs (as the request's die-cut)
  const bx = x0 + 18;
  const by = SLIP.c[1];
  const hole = (cx: number, cy: number, rx: number, ry: number) => {
    const p = new Path();
    p.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true, 0);
    west.holes.push(p);
  };
  hole(bx, by, 8, 6.4);
  hole(bx - 11, by, 3.2, 3.6);
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) hole(bx + k * 5, by + side * 9.4, 1.2, 2.8);
  return [west, piece(t1, t2), piece(t2, null)].map((s) => extrude(s, 0, RELIEF * 0.7, 0.3, 1));
}

/** The split card's play: the torn request over the throat, its three pieces parting toward the bench, the tower and the galley. */
export function SplitPlay({ play }: { play: number }) {
  const m = useReliefMats();
  const g = useMemo(() => {
    const bench = benchMini(DEST[0][0], DEST[0][1]);
    const tower = towerMini(DEST[1][0], DEST[1][1], 20);
    const galley = galleyMini(DEST[2][0], DEST[2][1]);
    return { pieces: tornPieces(), body: merge([bench.body, tower.body, galley.body]), ink: merge([bench.ink, tower.ink, galley.ink]), slugs: galley.light };
  }, []);
  useLayoutEffect(
    () => () => {
      g.pieces.forEach((x) => x.dispose());
      g.body.dispose();
      g.ink.dispose();
      g.slugs.dispose();
    },
    [g],
  );
  // once the card has settled, the tears open and each piece heads for its own destination (unequal, on the move curve)
  const k = Math.min(1, Math.max(0, play / 10));
  const e = 1 - (1 - k) ** 3;
  const centres = [TEARS[0] / 2, (TEARS[0] + TEARS[1]) / 2, (TEARS[1] + SLIP.l) / 2].map((x) => SLIP.c[0] - SLIP.l / 2 + x);
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.body} material={m.dark} />
      <mesh geometry={g.ink} material={m.ink} />
      <mesh geometry={g.slugs} material={m.light} />
      {g.pieces.map((x, i) => {
        const dx = (DEST[i][0] - centres[i]) * 0.42 * e;
        const dy = (DEST[i][1] - SLIP.c[1]) * 0.42 * e;
        return <mesh key={i} geometry={x} material={m.light} position={[dx, dy, 0]} rotation={[0, 0, (i - 1) * -0.09 * e]} />;
      })}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// 4.4: the Register with a bench bolted on, doing the work, its backlog queuing at its throat

/** The ghost Register in plan (face units): its deck, its reel, its window, its head and throat; the bench under it. */
const GHOST = { deck: [-34, -22, 118, 54] as const, reel: [76, 16, 30] as const, throat: [-48, 14, -34, 38] as const } as const;
/** Each queued slip's place: piling west of the throat, the newer ones on the older (a backlog grows into a pile). */
const QUEUE: readonly [number, number, number][] = [
  [-62, 26, 0],
  [-87, 23, 0],
  [-73, 31, 1],
  [-95, 29, 1],
  [-80, 22, 2],
  [-66, 34, 2],
  [-89, 32, 3],
];
/** Where a slip comes from: out from under the spout at the card's west edge (wider and deeper than a slip, so one waits wholly under it). */
const SPOUT: readonly [number, number, number, number] = [-149, 16, -113, 40];

function ghostGeometry() {
  const [x0, y0, x1, y1] = GHOST.deck;
  const deck = solid([rect(x0, y0, x1, y1, 2)], 0, RELIEF);
  const [rx, ry, rr] = GHOST.reel;
  const reel = solid([circle(rx, ry, rr, 5)], RELIEF, RELIEF * 2);
  const spokes = solid([0, 1, 2].map((i) => {
    const a = (i * 2 * Math.PI) / 3 + 0.3;
    const s = new Shape();
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pts: P2[] = [
      [rx + 6 * c - 1.8 * sn, ry + 6 * sn + 1.8 * c],
      [rx + (rr - 3) * c - 1.8 * sn, ry + (rr - 3) * sn + 1.8 * c],
      [rx + (rr - 3) * c + 1.8 * sn, ry + (rr - 3) * sn - 1.8 * c],
      [rx + 6 * c + 1.8 * sn, ry + 6 * sn - 1.8 * c],
    ];
    s.moveTo(...pts[0]);
    for (const p of pts.slice(1)) s.lineTo(...p);
    s.closePath();
    return s;
  }), RELIEF * 2, RELIEF * 2 + 0.8);
  // the window strip with its cells, the head at its west end, the throat beyond it
  const cells = solid(Array.from({ length: 4 }, (_, i) => rect(-24 + i * 13, 28, -14 + i * 13, 40, 0.6)), RELIEF, RELIEF + 0.8);
  const head = solid([rect(-34, 22, -26, 46, 1)], RELIEF, RELIEF * 2.2);
  const [tx0, ty0, tx1, ty1] = GHOST.throat;
  const throat = solid([rect(tx0, ty0, tx1, ty1, 1)], 0, RELIEF * 1.4);
  // the bench it should not have, bolted to its south rail: two brackets, the bench, its pins
  const bench = benchMini(30, -42, 0.95);
  const brackets = solid([rect(-6, -30, 2, -21, 0.5), rect(58, -30, 66, -21, 0.5)], 0, RELIEF * 1.2);
  const spout = solid([rect(...SPOUT, 3)], 0, RELIEF * 1.6);
  return { body: merge([deck, reel, throat, bench.body, brackets, spout]), ink: merge([spokes, cells, head, bench.ink]) };
}

/** A queued chat slip in plan (its east end notched, as every slip out of the spout). */
function queueSlip(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-17, -7);
  s.lineTo(17, -7);
  s.lineTo(12, 0);
  s.lineTo(17, 7);
  s.lineTo(-17, 7);
  s.closePath();
  return extrude(s, 0, 0.7, 0.2, 1);
}

/** The ghost card's play: the Register silhouette with its bench, its backlog piling at its throat, one slip every 10 f over the bar before the strike. */
export function GhostPlay({ play }: { play: number }) {
  const m = useReliefMats();
  const g = useMemo(() => ({ ...ghostGeometry(), slip: queueSlip() }), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const n = Math.max(0, Math.min(QUEUE.length, Math.floor(play / 10) + 1));
  const [sx0, sy0, sx1, sy1] = SPOUT;
  const from: P2 = [(sx0 + sx1) / 2, (sy0 + sy1) / 2];
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.body} material={m.dark} />
      <mesh geometry={g.ink} material={m.ink} />
      {play >= 0 &&
        Array.from({ length: n }, (_, i) => {
          // the newest slides out from under the spout (hidden under it at first) to its place on the pile over 4 f
          const t = Math.min(1, Math.max(0, (play - i * 10) / 4));
          const e = 1 - (1 - t) ** 2;
          const [qx, qy, layer] = QUEUE[i];
          const x = from[0] + (qx - from[0]) * e;
          const y = from[1] + (qy - from[1]) * e;
          // on the pile at its layer's height all the way (it slides out over the older ones, never through them); it turns to
          // lie askew as it comes out (square to the spout while under it, so no corner shows before it moves)
          const z = 0.2 + layer * 0.75;
          return <mesh key={i} geometry={g.slip} material={m.light} position={[x, y, z]} rotation={[0, 0, jitter(i, 5) * 0.18 * e]} />;
        })}
    </group>
  );
}
