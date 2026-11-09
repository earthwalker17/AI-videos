/**
 * The title card (TREATMENT element sheet, "Title and end card"; STORYBOARD 1.2, reused for 13.2):
 * a bone index card with a punch hole and a "No." mark in the print face, lying in the world over
 * the desk's lower-left, lit by the key and casting its footprint shadow, with the title and its
 * credit set over it as DOM text on their cues.
 *
 * The card is placed every frame from a fixed screen rectangle through the camera's pose
 * (camera.ts screenToDesk), so it holds dead still on screen while the camera eases out under it
 * and the words on it never move while they are read. It hovers clear of everything under it (the
 * feeders' tops); arriving, it slides in from off the frame's west edge on the move curve, then
 * settles on spring-heavy toward the desk, so only its shadow tightens; leaving, it lifts and
 * slides out on the exit curve. The paper never fades: it is always either in the frame or not.
 *
 * Pure placement (`cardAt`, `cardQuad`) and the two layers: `CardWorld` in the WebGL world, `CardText`
 * in a GREY_TEXT layer (every line ≤ 136 px, inside title-safe).
 */
import type { CamPose } from '@aiv/remotion-kit';
import { clamp } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Path, Shape, Vector2, type Texture } from 'three';
import { Easing } from 'remotion';
import { GREY_TEXT, Label } from '../../kit/text.tsx';
import { cueReveal } from '../onScreen.ts';
import { project, screenToDesk } from '../camera.ts';
import { extrude } from '../geom.ts';
import { paper } from '../gl/materials.ts';
import { INK, print, rule, texture, tooth } from '../gl/text.ts';
import type { Footprint } from '../footprints.ts';
import type { P2, P3 } from '../layout.ts';
import { SPRING, springAt } from '../state.ts';

/** One line of lettering on the card: its text, face and size, where its baseline starts (px from the card's top left), the cue it shows on. */
export interface CardLine {
  text: string;
  size: number;
  weight: number;
  cjkWeight?: number;
  color: string;
  x: number;
  y: number;
  cue: string;
}

/** A card: its screen rectangle (px, title-safe), its frames, its lettering and its printed mark. */
export interface CardSpec {
  rect: { x: number; y: number; w: number; h: number };
  frames: {
    /** it starts to slide in, lands (the thump: it starts to settle), starts to lift away, and is gone */
    enter: number;
    land: number;
    leave: number;
    gone: number;
  };
  lines: readonly CardLine[];
  /** the code printed on it in the print face (micro-print: a mark, never information) */
  mark: string;
  /** where the punch hole is (px from the card's top left) and its radius */
  hole: { x: number; y: number; r: number };
}

/** The card's paper (a bone stock a step under lit paper, so it never outshines the lamp's pool) and its ink. */
export const CARD_HEX = { paper: '#CFC9BB', ink: '#2A2B2A', zh: '#4D4A44' } as const;
/** The card stock's thickness (u). */
const CARD_T = 3;
/** How high the card hovers while it slides (clear of the feeders' tops) and where it settles (still clear of them: the mail box is 34 u). */
export const CARD_Z = { high: 112, rest: 52 } as const;
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const EXIT = Easing.bezier(0.3, 0, 0.8, 0.15);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));

export interface CardState {
  /** the card is in the world */
  present: boolean;
  /** its screen offset (px; it slides in from and out to the west) and its height over the desk */
  dx: number;
  z: number;
}

/** Where the card is at film frame f (pure). */
export function cardAt(spec: CardSpec, f: number): CardState {
  const { enter, land, leave, gone } = spec.frames;
  if (f < enter || f >= gone) return { present: false, dx: 0, z: CARD_Z.high };
  const off = -(spec.rect.x + spec.rect.w + 60);
  // it slides in on the move curve (its first frames barely in: a card this size on the enter curve lands in one frame)
  if (f < land) return { present: true, dx: off * (1 - MOVE(span01(f, enter, land))), z: CARD_Z.high };
  if (f < leave) return { present: true, dx: 0, z: CARD_Z.high + (CARD_Z.rest - CARD_Z.high) * springAt(f, land, SPRING.heavy) };
  // leaving: it lifts (its shadow softening) as it slides out west on the exit curve
  const k = EXIT(span01(f, leave, gone));
  const z0 = CARD_Z.high + (CARD_Z.rest - CARD_Z.high) * springAt(leave, land, SPRING.heavy);
  return { present: true, dx: off * k, z: z0 + (CARD_Z.high - z0) * k };
}

/** The card's outline on screen (px): a rounded rectangle, its corners sampled, and the punch hole. */
function screenOutline(spec: CardSpec, dx: number): { outer: P2[]; hole: P2[] } {
  const { x, y, w, h } = spec.rect;
  const r = 10;
  const outer: P2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      outer.push([cx + dx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  // clockwise on screen (y down) is counter-clockwise on the desk (y north): the shape's outer winding
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  corner(x + w - r, y + r, (3 * Math.PI) / 2);
  const hole: P2[] = Array.from({ length: 20 }, (_, i) => {
    const a = (-i / 20) * Math.PI * 2;
    return [x + dx + spec.hole.x + spec.hole.r * Math.cos(a), y + spec.hole.y + spec.hole.r * Math.sin(a)];
  });
  return { outer, hole };
}

/** The card on the desk plane at its height: its outline's world points (each the desk point its screen point sees). */
export function cardQuad(spec: CardSpec, s: CardState, pose: CamPose): { outer: P3[]; hole: P3[] } {
  const o = screenOutline(spec, s.dx);
  return { outer: o.outer.map((p) => screenToDesk(pose, p, s.z)), hole: o.hole.map((p) => screenToDesk(pose, p, s.z)) };
}

/** The card's footprint: a rectangle over its world outline at its height (it hovers, so no contact shadow). */
export function cardFootprint(spec: CardSpec, s: CardState, pose: CamPose): Footprint | null {
  if (!s.present) return null;
  const { x, y, w, h } = spec.rect;
  const c = screenToDesk(pose, [x + s.dx + w / 2, y + h / 2], s.z);
  const l = screenToDesk(pose, [x + s.dx, y + h / 2], s.z);
  const r = screenToDesk(pose, [x + s.dx + w, y + h / 2], s.z);
  const t = screenToDesk(pose, [x + s.dx + w / 2, y], s.z);
  const b = screenToDesk(pose, [x + s.dx + w / 2, y + h], s.z);
  return { kind: 'rect', c: [c[0], c[1]], h: [(r[0] - l[0]) / 2, (t[1] - b[1]) / 2], r: 6, rot: 0, z0: s.z - CARD_T, z1: s.z, contact: 0 };
}

/** The card's solid: its world outline extruded down 0.8 u (paper stock), its top face's print mapped by screen position. */
function cardGeometry(spec: CardSpec, s: CardState, pose: CamPose): BufferGeometry {
  const q = cardQuad(spec, s, pose);
  const shape = new Shape(q.outer.map((p) => new Vector2(p[0], p[1])));
  shape.closePath();
  const hole = new Path(q.hole.map((p) => new Vector2(p[0], p[1])));
  hole.closePath();
  shape.holes.push(hole);
  // card stock with a little body: its bevelled rim catches the key on the north-west edges and falls off south-east
  const g = extrude(shape, s.z - CARD_T, s.z, 1.1, 2);
  // the print rides the card: each vertex's UV is where it falls on the card's screen rectangle
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const { x, y, w, h } = spec.rect;
  for (let i = 0; i < pos.count; i++) {
    const sp = project(pose, [pos.getX(i), pos.getY(i), s.z]);
    uv.setXY(i, (sp[0] - x - s.dx) / w, 1 - (sp[1] - y) / h);
  }
  uv.needsUpdate = true;
  return g;
}

/** The card's print: its paper's tooth, the "No." mark and its field rule, one texel per screen pixel. */
function useCardTexture(spec: CardSpec, printFamily: string): Texture {
  const { w, h } = spec.rect;
  const t = useMemo(
    () =>
      texture(
        w,
        h,
        (g) => {
          tooth(g, w, h);
          print(g, printFamily, spec.mark, 52, 56, 30, 500, INK);
          rule(g, 52 + spec.mark.length * 18 + 12, 58, 52 + spec.mark.length * 18 + 170, 58, 1.6, '#5E5B55');
        },
        4,
        '#FFFFFF',
        1,
      ),
    [w, h, printFamily, spec.mark],
  );
  useLayoutEffect(() => () => t.dispose(), [t]);
  return t;
}

/** The card in the world (inside DeskWorld): posed from its screen rectangle through this frame's camera. */
export function CardWorld({ spec, f, pose, printFamily }: { spec: CardSpec; f: number; pose: CamPose; printFamily: string }) {
  const s = cardAt(spec, f);
  const tex = useCardTexture(spec, printFamily);
  const mat = useMemo(() => paper(tex, CARD_HEX.paper, { roughness: 0.86 }), [tex]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  const geo = useMemo(() => (s.present ? cardGeometry(spec, s, pose) : null), [spec, s.present, s.dx, s.z, pose]);
  useLayoutEffect(() => () => geo?.dispose(), [geo]);
  return geo ? <mesh geometry={geo} material={mat} /> : null;
}

/** The card's lettering (the DOM layer): each line on its cue's window, a 6 f wipe in left to right and a 6 f fade out; it rides the card's slide. */
export function CardText({ spec, f, family }: { spec: CardSpec; f: number; family: string }) {
  const s = cardAt(spec, f);
  if (!s.present) return null;
  const { x, y, w } = spec.rect;
  return (
    <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {spec.lines.map((l, i) => {
        const r = cueReveal(l.cue, f);
        if (!r.visible) return null;
        const id = `card-wipe-${i}`;
        return (
          <g key={i} opacity={r.opacity}>
            <defs>
              <clipPath id={id}>
                <rect x={x + s.dx + l.x - 8} y={y + l.y - l.size * 1.2} width={(w - l.x + 16) * r.wipe} height={l.size * 1.6} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${id})`}>
              <Label x={x + s.dx + l.x} y={y + l.y} text={l.text} family={family} size={l.size} weight={l.weight} cjkWeight={l.cjkWeight ?? l.weight} color={l.color} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
