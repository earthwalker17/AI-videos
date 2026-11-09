/**
 * A counterfactual (TREATMENT element sheet, "Counterfactuals"): a grey-stock card that rises over the scene for one
 * beat, plays, is struck through with an ink rule and goes away. Grey stock is the road not taken: never built,
 * proposed or open, so nothing on it is enamel, vellum or vermilion. Rise 12 f, strike 6 f, exit 8 f (desk/beat4.ts
 * cardAt); where it rises and hovers is its caller's (beat4.ts cardPose). Used at 4.3 (the request torn three ways)
 * and 4.4 (a Router with a bench, its backlog piling at its door); later 7.2, 7.3, 10.2 and 11.3.
 *
 * The card is paper with a canvas-drawn face (ink on grey stock, drawn once); what plays on it (pieces drifting, a
 * backlog piling) is its children, in the card's face coordinates (x right, y up, z out of the face, from its centre).
 * The strike is a heavy ink rule laid corner to corner as the card is struck: ink, never a glow.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { PlaneGeometry, Shape, type BufferGeometry, type Texture } from 'three';
import { extrude, slab } from '../geom.ts';
import { matte, paper } from '../gl/materials.ts';
import { texture, tooth } from '../gl/text.ts';
import { useThree } from '@react-three/fiber';
import type { P3 } from '../layout.ts';

/** Grey stock (Turn.tsx's GREY family): the card a step lighter than the desk's grey props, its ink a dark graphite. */
export const CARD_STOCK = '#8E8B84';
export const CARD_INK = '#34352F';

export interface CounterfactualProps {
  /** its centre (world), its tilt from flat (pi/2 standing), its size (u) */
  pose: { c: P3; tilt: number };
  w: number;
  h: number;
  /** the face, drawn on grey stock (an ink drawing) */
  face: Texture;
  /** the ink rule laid across it (0..1 of its length) */
  strike: number;
  children?: ReactNode;
}

/** A card's face texture: grey stock with its tooth, and `draw`'s ink (face coordinates in u, y down from its top edge as the canvas has it). */
export function cardFace(w: number, h: number, aniso: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  return texture(
    w,
    h,
    (g) => {
      tooth(g, w, h);
      // a border rule a little in from the edge: a printed card, not a panel
      g.strokeStyle = CARD_INK;
      g.lineWidth = 1.4;
      g.strokeRect(6, 6, w - 12, h - 12);
      draw(g);
    },
    aniso,
    CARD_STOCK,
  );
}

export function Counterfactual({ pose, w, h, face, strike, children }: CounterfactualProps) {
  const mats = useMemo(() => ({ card: paper(face, '#FFFFFF', { roughness: 0.92 }), ink: matte(CARD_INK, 0.85, 0, false) }), [face]);
  useLayoutEffect(
    () => () => {
      mats.card.dispose();
      mats.ink.dispose();
    },
    [mats],
  );
  const g = useMemo(() => {
    const body = slab({ x0: -w / 2, x1: w / 2, y0: -h / 2, y1: h / 2 }, -1.2, 0, 1.5, 0.3);
    const top = new PlaneGeometry(w, h);
    top.translate(0, 0, 0.05);
    return { body, top, rule: new PlaneGeometry(1, 1) };
  }, [w, h]);
  useLayoutEffect(() => () => Object.values(g).forEach((x: BufferGeometry) => x.dispose()), [g]);
  // the strike: from the top-left corner to the bottom-right, inset, laid as it is drawn
  const a: [number, number] = [-w / 2 + 16, h / 2 - 14];
  const b: [number, number] = [w / 2 - 16, -h / 2 + 14];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * strike;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={pose.c} rotation={[pose.tilt, 0, 0]}>
      <mesh geometry={g.body} material={mats.ink} />
      <mesh geometry={g.top} material={mats.card} />
      {children}
      {strike > 0 && <mesh geometry={g.rule} material={mats.ink} position={[a[0] + (Math.cos(ang) * L) / 2, a[1] + (Math.sin(ang) * L) / 2, 0.5]} rotation={[0, 0, ang]} scale={[L, 7, 1]} />}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Beat 4's two cards

/** The request's outline on the card (u, face coordinates), torn in three along two ragged tears. */
const SLIP = { w: 168, h: 62 } as const;
function tornPieces(): BufferGeometry[] {
  const x0 = -SLIP.w / 2;
  const x1 = SLIP.w / 2;
  const y0 = -SLIP.h / 2;
  const y1 = SLIP.h / 2;
  // two tears, ragged (fixed zigzags: no randomness)
  const tear = (x: number, k: number): [number, number][] => Array.from({ length: 7 }, (_, i) => [x + ((i * 7 + k * 3) % 5) * 2.2 - 4.4, y1 - (i * SLIP.h) / 6] as [number, number]);
  const t1 = tear(-SLIP.w / 6, 1);
  const t2 = tear(SLIP.w / 6, 2);
  const shape = (left: [number, number][] | null, right: [number, number][] | null, xl: number, xr: number) => {
    const s = new Shape();
    // top edge from left to right, down the right tear (or edge), back along the bottom, up the left tear (or edge)
    if (left) s.moveTo(left[0][0], y1);
    else s.moveTo(xl, y1);
    if (right) for (const [x, y] of right) s.lineTo(x, y);
    else {
      s.lineTo(xr, y1);
      // the chat slip's notch at its east end
      s.lineTo(xr, 10);
      s.lineTo(xr - 12, 0);
      s.lineTo(xr, -10);
      s.lineTo(xr, y0);
    }
    if (left) for (const [x, y] of [...left].reverse()) s.lineTo(x, y);
    else {
      s.lineTo(xl, y0);
    }
    s.closePath();
    return extrude(s, 0, 0.6, 0);
  };
  return [shape(null, t1, x0, 0), shape(t1, t2, 0, 0), shape(t2, null, 0, x1)];
}

/** The split card's face: three bays' doors along its foot, where the torn request would go (ink on grey stock). */
export function useSplitFace(w: number, h: number): Texture {
  const gl = useThree((st) => st.gl);
  const t = useMemo(
    () =>
      cardFace(w, h, Math.min(8, gl.capabilities.getMaxAnisotropy()), (g) => {
        g.strokeStyle = CARD_INK;
        g.lineWidth = 2;
        // three small bays (open boxes), one under each piece
        for (const i of [-1, 0, 1]) {
          const cx = w / 2 + (i * w) / 3.2;
          g.strokeRect(cx - 26, h - 46, 52, 30);
          g.beginPath();
          g.moveTo(cx - 8, h - 46);
          g.lineTo(cx + 8, h - 46);
          g.strokeStyle = CARD_STOCK;
          g.stroke();
          g.strokeStyle = CARD_INK;
        }
      }),
    [w, h, gl],
  );
  useLayoutEffect(() => () => t.dispose(), [t]);
  return t;
}

/** The request torn three ways (4.3): its three pieces drift apart over the card's play, each toward a bay drawn under it. */
export function SplitPieces({ play, h }: { play: number; h: number }) {
  const g = useMemo(() => tornPieces(), []);
  useLayoutEffect(() => () => g.forEach((x) => x.dispose()), [g]);
  const ink = useMemo(() => matte(CARD_INK, 0.85, 0, false), []);
  useLayoutEffect(() => () => ink.dispose(), [ink]);
  // the tear opens over 8 f after the card is up: the outer pieces part sideways and down a little toward their bays
  const k = Math.min(1, Math.max(0, play / 8));
  const e = k * k * (3 - 2 * k);
  return (
    <group position={[0, h / 2 - 58, 0.3]}>
      {g.map((x, i) => (
        <mesh key={i} geometry={x} material={ink} position={[(i - 1) * 26 * e, -10 * e * Math.abs(i - 1), 0]} rotation={[0, 0, (i - 1) * -0.08 * e]} />
      ))}
    </group>
  );
}

/** The ghost card's face (4.4): a Router drawn with a bench under it, a tool on the bench, its door at the east. */
export function useGhostFace(w: number, h: number): Texture {
  const gl = useThree((st) => st.gl);
  const t = useMemo(
    () =>
      cardFace(w, h, Math.min(8, gl.capabilities.getMaxAnisotropy()), (g) => {
        g.strokeStyle = CARD_INK;
        g.fillStyle = CARD_INK;
        g.lineWidth = 2.4;
        // the Router: a deck with its reel, its frame round it
        g.strokeRect(34, 26, 120, 58);
        g.beginPath();
        g.arc(122, 55, 20, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(122, 55, 4, 0, Math.PI * 2);
        g.fill();
        // the bench it should not have: a table under it, a wrench lying on it
        g.fillRect(40, 108, 108, 6);
        g.fillRect(48, 114, 6, 26);
        g.fillRect(134, 114, 6, 26);
        g.fillRect(70, 98, 44, 5);
        g.beginPath();
        g.arc(118, 100.5, 7, 0, Math.PI * 2);
        g.fill();
        // its one door, east, where its backlog waits
        g.fillRect(176, 30, 5, 112);
      }),
    [w, h, gl],
  );
  useLayoutEffect(() => () => t.dispose(), [t]);
  return t;
}

/** The ghost's backlog (4.4): slips piling up at its door, one every 10 f over the bar before the strike. */
export function GhostBacklog({ play, w, h }: { play: number; w: number; h: number }) {
  const ink = useMemo(() => matte(CARD_INK, 0.85, 0, false), []);
  useLayoutEffect(() => () => ink.dispose(), [ink]);
  const g = useMemo(() => slab({ x0: -15, x1: 15, y0: -5, y1: 5 }, 0, 0.6, 1, 0.2), []);
  useLayoutEffect(() => () => g.dispose(), [g]);
  const n = Math.min(7, Math.floor(play / 10) + 1);
  // each lands at the door's foot, stacking up and leaning (fixed offsets)
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        // the newest slides in from the card's east edge over its first 3 f
        const age = play - i * 10;
        const t = Math.min(1, Math.max(0, age / 3));
        const x = w / 2 - 60 + (i % 2) * 8 + (1 - t) * 30;
        const y = -h / 2 + 34 + i * 11;
        return <mesh key={i} geometry={g} material={ink} position={[x, y, 0.3]} rotation={[0, 0, ((i * 5) % 3) * 0.06 - 0.06]} />;
      })}
    </group>
  );
}
