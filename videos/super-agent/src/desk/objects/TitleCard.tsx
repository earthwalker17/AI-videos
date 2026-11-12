/**
 * The title card (TREATMENT element sheet, "Title and end card"; STORYBOARD 1.2): a bone index card
 * with a punch hole and a "№" in the print face, lying on the desk in the world (lit by the key, its
 * footprint shadow under it), the title set on it as DOM text on its cue.
 *
 * The card is a body in the world: it lies low on the desk at a fixed place (`CardSpec.place`), so it
 * rides bar 3's camera move with the desk (it eases out with everything round it, never a panel held
 * on the screen), and its lettering is projected onto its top face every frame. Arriving, it is posted
 * in from beyond the frame's south-west edge on a low arc that comes to rest over its place with no
 * vertical speed, lifts a little (3 f, its anticipation) and drops onto its place on the thump
 * (title-thump, f160), its contact shadow tightening over those last 4 frames. Leaving, it lifts off (its own
 * anticipation) and slides out west at a bounded pace, wholly off the frame on its last frame. The paper never fades:
 * it is always either in the frame or not.
 *
 * Pure placement (`cardAt`, `cardCorners`, `cardFootprint`) and the two layers: `CardWorld` in the WebGL
 * world, `CardText` in a GREY_TEXT layer (every line projected from the card, at least 36 px wherever the
 * camera is, inside title-safe).
 */
import type { CamPose } from '@aiv/remotion-kit';
import { clamp, easings } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Path, type Shape, type Texture } from 'three';
import { Easing } from 'remotion';
import { GREY_TEXT, Label } from '../../kit/text.tsx';
import { cueReveal } from '../onScreen.ts';
import { project } from '../camera.ts';
import { extrude, fitUv, roundRect } from '../geom.ts';
import { paper, whiteTexture } from '../gl/materials.ts';
import { INK, print, texture, tooth } from '../gl/text.ts';
import type { Footprint } from '../footprints.ts';
import type { P2, P3 } from '../layout.ts';

/** One line of lettering on the card: its text, face and size (u), where its baseline starts (u from the card's north-west corner), the cue it shows on. */
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

/** A card: where it lies in the world, its frames, its lettering and its printed mark. */
export interface CardSpec {
  /** its north-west corner (world), its size (u) and the height its underside rests at (on the flat paper under it) */
  place: { x0: number; y1: number; w: number; d: number; z: number };
  frames: {
    /** it is posted in (its arc starts beyond the frame), lands (the thump), starts to lift away, and is gone */
    enter: number;
    land: number;
    leave: number;
    gone: number;
  };
  lines: readonly CardLine[];
  /** the code printed on it in the print face (micro-print: a mark, never information) */
  mark: string;
  /** the punch hole (u from the card's north-west corner) and its radius */
  hole: { x: number; y: number; r: number };
  /** its post and its leave, where they differ from the title card's (CARD_POST: the end card, desk/endCard.ts) */
  post?: Partial<CardPost>;
  /** the mark's em (u; default 13, the title card's): the end card's larger board prints it larger */
  markEm?: number;
}

/** The card's paper (a bone stock a step under lit paper, so it never outshines the lamp's pool), its cut edge (the board's core, a step darker) and its ink. */
export const CARD_HEX = { paper: '#CFC9BB', edge: '#A39D90', ink: '#2A2B2A', zh: '#4D4A44' } as const;
/**
 * The card stock's thickness (u) and the chamfer round its top and bottom edges: a heavy board, so it reads as a body
 * lying on the desk and never as a sticker (the critic's X3 P1-3). Its cut edge is the board's core (CARD_HEX.edge): the
 * chamfer on its north and west edges faces the key and catches it, its south face (the one the 15° camera sees) and
 * the chamfer on its south and east edges turn away and darken, a lit edge and a shaded band round the card; it stands
 * high enough that its cast shadow shows past its south and east edges. (On the slate no shadow goes deeper than about 5
 * codes: the desk's soft floor, gl/desk.ts.)
 */
export const CARD_T = 5;
export const CARD_BEVEL = 1;
/**
 * The post (world offsets from its place, u): from beyond the frame's south-west edge, a 12 f arc that comes to rest over
 * its place `hover` high with no vertical speed (and no speed across), a 3 f lift (the anticipation), then a 4 f drop onto
 * it: the contact is the land frame. Leaving: its own anticipation (3 f: it lifts off its place, clear of the calendar
 * pad and the mail box west of it, nudged east, its contact fading), then an 8 f slide out west over them that gathers
 * speed over its first 40% and holds it (at most about 110 px a frame at 1.2x): wholly off the frame on its last frame.
 */
export const CARD_POST = {
  from: [-300, -330, 80] as P3,
  hump: 60,
  hover: 18,
  lift: 4,
  liftFrames: 3,
  dropFrames: 4,
  antic: [6, 0, 30] as P3,
  anticFrames: 3,
  out: [-566, -50, 44] as P3,
  outFrames: 8,
  outRamp: 0.4,
} as const;
/** A card's post and leave (CARD_POST's fields). */
export type CardPost = { -readonly [K in keyof typeof CARD_POST]: (typeof CARD_POST)[K] extends readonly number[] ? P3 : number };
/** The contact shadow's strength at rest (the trays' and the folders'). */
const CONTACT = 0.8;
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));

export interface CardState {
  /** the card is in the world */
  present: boolean;
  /** its offset in the world from its place (u) */
  off: P3;
  /** its contact shadow (0 in the air … CONTACT at rest) */
  contact: number;
}

/** Where the card is at film frame f (pure). */
export function cardAt(spec: CardSpec, f: number): CardState {
  const { enter, land, leave, gone } = spec.frames;
  const none: P3 = [0, 0, 0];
  if (f < enter || f >= gone) return { present: false, off: none, contact: 0 };
  const P = spec.post ? { ...CARD_POST, ...spec.post } : CARD_POST;
  const drop = land - P.dropFrames;
  const lift = drop - P.liftFrames;
  if (f < lift) {
    // the arc: in from beyond the south-west edge, slowing to a stop over its place (ease out across; its height comes
    // down to the hover with a small hump on the way and no vertical speed at the end)
    const u = (f - enter) / (lift - enter);
    const k = (1 - u) * (1 - u);
    return { present: true, off: [P.from[0] * k, P.from[1] * k, P.hover + (P.from[2] - P.hover) * k + P.hump * u * k], contact: 0 };
  }
  // the anticipation: it lifts a little over its place
  if (f < drop) return { present: true, off: [0, 0, P.hover + P.lift * MOVE(span01(f, lift, drop))], contact: 0 };
  // the drop (slow off, fast in), touching on the land frame: its shadow comes in and tightens over these frames
  if (f < land) {
    const u = (f - drop) / P.dropFrames;
    const z = (P.hover + P.lift) * (1 - u * u);
    return { present: true, off: [0, 0, z], contact: CONTACT * (1 - z / (P.hover + P.lift)) };
  }
  if (f < leave) return { present: true, off: none, contact: CONTACT };
  // leaving: its anticipation (it lifts off its place, nudged east, its contact going as it lifts), then it slides out
  // west gathering speed to a held pace, lifting (its shadow softening), wholly off the frame on its last frame (it is
  // never in the frame one frame and gone the next)
  const slide = leave + P.anticFrames;
  if (f < slide) {
    const e = easings.inOutSine(span01(f, leave, slide));
    const off: P3 = [P.antic[0] * e, P.antic[1] * e, P.antic[2] * e];
    // its contact goes over the first two thirds of the lift (by time: never cut whole)
    return { present: true, off, contact: CONTACT * clamp(1 - (1.5 * (f - leave)) / P.anticFrames) };
  }
  const u = span01(f, slide, gone - 1);
  const a = P.outRamp;
  const k = u < a ? (u * u) / (2 * a) / (1 - a / 2) : (u - a / 2) / (1 - a / 2);
  return { present: true, off: [P.antic[0] + (P.out[0] - P.antic[0]) * k, P.antic[1] + (P.out[1] - P.antic[1]) * k, P.antic[2] + (P.out[2] - P.antic[2]) * k], contact: 0 };
}

/** The top face's corners in the world (north-west, north-east, south-west, south-east), with the card's offset. */
export function cardCorners(spec: CardSpec, s: CardState): { nw: P3; ne: P3; sw: P3; se: P3 } {
  const { x0, y1, w, d, z } = spec.place;
  const t = z + CARD_T + s.off[2];
  const at = (x: number, y: number): P3 => [x + s.off[0], y + s.off[1], t];
  return { nw: at(x0, y1), ne: at(x0 + w, y1), sw: at(x0, y1 - d), se: at(x0 + w, y1 - d) };
}

/** The card's centre at rest (world plan). */
export const cardCentre = (spec: CardSpec): P2 => [spec.place.x0 + spec.place.w / 2, spec.place.y1 - spec.place.d / 2];

/** The card's footprint: its rectangle at its height, its contact coming in as it lands. */
export function cardFootprint(spec: CardSpec, s: CardState): Footprint | null {
  if (!s.present) return null;
  const c = cardCentre(spec);
  const z0 = spec.place.z + s.off[2];
  return { kind: 'rect', c: [c[0] + s.off[0], c[1] + s.off[1]], h: [spec.place.w / 2, spec.place.d / 2], r: 4, rot: 0, z0, z1: z0 + CARD_T, contact: s.contact };
}

/** How far the contact footprint lies inside the card's outline (u): its own sliver of cast shade stays under the card. */
export const CARD_CONTACT_INSET = 4;
/**
 * The card's contact shadow on the desk: the card's own footprint stands on the flat paper under it (its underside
 * `place.z` over the desk), too high for the shader's contact term to reach the desk round it, so a film-thin footprint
 * on the desk under the card carries it (inset, so the sliver of shade it casts stays under the card; at most
 * `h - 0.5` = 0.1 u high, it reaches only the desk). It is there only while the card's contact is (the drop, the rest,
 * the lift off: cardAt), and it is as strong as that contact, so the shadow comes in and darkens round the card over the
 * drop's 4 f as the card's cast shadow slides in under it and sharpens (its offset and penumbra go with the height), and
 * fades as it lifts off.
 */
export function cardContactFootprint(spec: CardSpec, s: CardState): Footprint | null {
  if (!s.present || s.contact <= 0) return null;
  const c = cardCentre(spec);
  const i = CARD_CONTACT_INSET;
  return { kind: 'rect', c: [c[0] + s.off[0], c[1] + s.off[1]], h: [spec.place.w / 2 - i, spec.place.d / 2 - i], r: 2, rot: 0, z0: 0, z1: 0.6, contact: s.contact };
}

/** The card's solid (centred on its place, at its resting height): a rounded board with its punch hole, chamfered, its print mapped over the top face. */
export function cardGeometry(spec: CardSpec): BufferGeometry {
  const { w, d, z } = spec.place;
  const shape = roundRect(w, d, 5) as Shape;
  const hole = new Path();
  hole.absarc(-w / 2 + spec.hole.x, d / 2 - spec.hole.y, spec.hole.r, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return fitUv(extrude(shape, z, z + CARD_T, CARD_BEVEL, 3), w, d);
}

/** The card's print: its paper's tooth and the "№" mark (the lettering is DOM text on its cue). */
export function useCardTexture(spec: CardSpec, printFamily: string): Texture {
  const { w, d } = spec.place;
  const t = useMemo(
    () =>
      texture(
        w,
        d,
        (g) => {
          tooth(g, w, d);
          // the code at the card's top right, beside the punch hole (alone: a blank field rule before it read as a form's
          // "___ №", the critic's X3 P1-3)
          const em = spec.markEm ?? 13;
          const mx = spec.hole.x - spec.hole.r - 6 - spec.mark.length * em * 0.6;
          print(g, printFamily, spec.mark, mx, spec.hole.y + em * 0.35, em, 500, INK);
        },
        4,
        '#FFFFFF',
      ),
    [w, d, printFamily, spec.mark, spec.markEm, spec.hole.x, spec.hole.y, spec.hole.r],
  );
  useLayoutEffect(() => () => t.dispose(), [t]);
  return t;
}

/** The card in the world (inside DeskWorld). */
export function CardWorld({ spec, f, printFamily }: { spec: CardSpec; f: number; printFamily: string }) {
  const s = cardAt(spec, f);
  const tex = useCardTexture(spec, printFamily);
  // the faces (group 0 of the extrusion) in the printed stock, the sides and chamfers (group 1) in the board's core
  const mat = useMemo(() => [paper(tex, CARD_HEX.paper, { roughness: 0.86 }), paper(whiteTexture(), CARD_HEX.edge, { roughness: 0.9 })], [tex]);
  useLayoutEffect(() => () => mat.forEach((m) => m.dispose()), [mat]);
  const geo = useMemo(() => cardGeometry(spec), [spec]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  if (!s.present) return null;
  const c = cardCentre(spec);
  return <mesh geometry={geo} material={mat} position={[c[0] + s.off[0], c[1] + s.off[1], s.off[2]]} />;
}

/**
 * The SVG transform that sets card-local units (x east from its west edge, y south from its north edge) onto the screen
 * through a pose: an affine fit to the projected corners of its top face (the long lens keeps the perspective across the
 * card well under a pixel).
 */
export function cardMatrix(spec: CardSpec, s: CardState, pose: CamPose): [number, number, number, number, number, number] {
  const q = cardCorners(spec, s);
  const nw = project(pose, q.nw);
  const ne = project(pose, q.ne);
  const sw = project(pose, q.sw);
  const { w, d } = spec.place;
  return [(ne[0] - nw[0]) / w, (ne[1] - nw[1]) / w, (sw[0] - nw[0]) / d, (sw[1] - nw[1]) / d, nw[0], nw[1]];
}

/** The card's lettering (the DOM layer): each line on its cue's window, a 6 f wipe in left to right and a 6 f fade out, set on the card through the camera. */
export function CardText({ spec, f, family, pose }: { spec: CardSpec; f: number; family: string; pose: CamPose }) {
  const s = cardAt(spec, f);
  // lettering only on the card once it has landed (the cue opens on the thump)
  if (!s.present || f < spec.frames.land) return null;
  const m = cardMatrix(spec, s, pose);
  return (
    <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <g transform={`matrix(${m.map((v) => v.toFixed(5)).join(' ')})`}>
        {spec.lines.map((l, i) => {
          const r = cueReveal(l.cue, f);
          if (!r.visible) return null;
          const id = `card-wipe-${i}`;
          return (
            <g key={i} opacity={r.opacity}>
              <defs>
                <clipPath id={id}>
                  <rect x={l.x - 4} y={l.y - l.size * 1.2} width={(spec.place.w - l.x + 8) * r.wipe} height={l.size * 1.6} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${id})`}>
                <Label x={l.x} y={l.y} text={l.text} family={family} size={l.size} weight={l.weight} cjkWeight={l.cjkWeight ?? l.weight} color={l.color} />
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
