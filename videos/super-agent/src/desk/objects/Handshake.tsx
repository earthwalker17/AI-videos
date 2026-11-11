/**
 * The handshake's cargo round C12 (STORYBOARD 4.6, state.ts EVENTS_B): the test tower's report card and
 * the reply that cites it, each a sheet of its own form.
 * - The report card: a punched card with its clipped corner, a punch row along its foot and a round cut
 *   its transit light shows through (cut in its geometry, never a dot on its face). It rises standing out
 *   of the slot in the tower's cap, flies an arc up over the deck's rail turning to lie at the mouth's tilt
 *   and docks there; once the print head has inked its header into the newest cell it folds in half along
 *   its crease (8 f; its south half turns up over the north, its back coming up with the ID), and the tab
 *   drops into the spill drawer (6 f), where it stays, standing on its fold, #0408 face up.
 * - The reply: a slip with an enamel stop tab, sliding out from under the deck's south-west corner along
 *   the chute's line and on down the chute in one motion, turning along the exit curve to lie in your
 *   in-tray, landing on spring-dock with a 3% squash. It carries no transit light.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Path, Shape, ShapeGeometry, type BufferGeometry, type Material } from 'three';
import { extrude, plane, slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { CARD, SLIP } from '../layout.ts';
import { CARD_DOCK_TILT, CARD_STAND, DOCK_B, TAB_B, TAB_LEAN_B, TAB_REST_B, cardRise, cardTilt, replyPose, tabArc, type DeskState } from '../state.ts';

const W = CARD.w;
const D = CARD.d;
/** The clipped corner (north-west), the punch row along the foot, the round cut the transit light shows through (card frame: centre origin, +y north). */
const CLIP = 12;
const PUNCH_ROW = { y0: -D / 2 + 3.5, y1: -D / 2 + 8.5, x0: -W / 2 + 12, n: 9, dx: 8.2, w: 3.2 } as const;
export const LIGHT_CUT = { x: W / 2 - 12, y: -D / 2 + 20, r: 5 } as const;

/** One half of the card about its crease (y = 0): its outline, the corner cut in the north half, the punches and the light's cut in the south. */
function halfShape(which: 'north' | 'south'): Shape {
  const s = new Shape();
  if (which === 'north') {
    s.moveTo(-W / 2, 0);
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, D / 2);
    s.lineTo(-W / 2 + CLIP, D / 2);
    s.lineTo(-W / 2, D / 2 - CLIP);
    s.closePath();
    return s;
  }
  s.moveTo(-W / 2, -D / 2);
  s.lineTo(W / 2, -D / 2);
  s.lineTo(W / 2, 0);
  s.lineTo(-W / 2, 0);
  s.closePath();
  for (let i = 0; i < PUNCH_ROW.n; i++) {
    const x = PUNCH_ROW.x0 + i * PUNCH_ROW.dx;
    const h = new Path();
    h.moveTo(x, PUNCH_ROW.y0);
    h.lineTo(x, PUNCH_ROW.y1);
    h.lineTo(x + PUNCH_ROW.w, PUNCH_ROW.y1);
    h.lineTo(x + PUNCH_ROW.w, PUNCH_ROW.y0);
    h.closePath();
    s.holes.push(h);
  }
  const c = new Path();
  c.absarc(LIGHT_CUT.x, LIGHT_CUT.y, LIGHT_CUT.r, 0, Math.PI * 2, true);
  s.holes.push(c);
  return s;
}

/** A face over a shape (+z, at height z), its UVs from the card's extents: the front's print across both halves. */
function faceOf(shape: Shape, z: number): BufferGeometry {
  const g = new ShapeGeometry(shape, 6);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / D + 0.5);
  uv.needsUpdate = true;
  g.translate(0, 0, z);
  return g;
}

/** The south half's back (facing -z, at -z): the tab's face once folded, its UVs so the ID reads upright after the fold. */
function backOf(shape: Shape, z: number): BufferGeometry {
  const mirrored = new Shape(shape.getPoints(6).map((p) => p.clone().setY(-p.y)));
  mirrored.holes = shape.holes.map((h) => new Path(h.getPoints(6).map((p) => p.clone().setY(-p.y))));
  const g = new ShapeGeometry(mirrored, 6);
  // turned over about x: back at the half's own y, facing down
  g.rotateX(Math.PI);
  g.translate(0, 0, -z);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, -pos.getY(i) / (D / 2));
  uv.needsUpdate = true;
  return g;
}

function useCardGeometry() {
  return useMemo(() => {
    const n = halfShape('north');
    const s = halfShape('south');
    return {
      northBody: extrude(n, -0.8, 0.8, 0),
      southBody: extrude(s, -0.8, 0.8, 0),
      northFace: faceOf(n, 0.85),
      southFace: faceOf(s, 0.85),
      southBack: backOf(s, 0.85),
      light: (() => {
        const g = new CircleGeometry(LIGHT_CUT.r - 0.6, 24);
        g.translate(LIGHT_CUT.x, LIGHT_CUT.y, 0);
        return g;
      })(),
    };
  }, []);
}

/** The card as its two halves about the crease (group origin), the south half turned `fold` of the way over onto the north. */
export function CardHalves({ fold, light, faces }: { fold: number; light: boolean; faces: { body: Material; front: Material; back: Material; transit: Material } }) {
  const g = useCardGeometry();
  return (
    <>
      <mesh geometry={g.northBody} material={faces.body} />
      <mesh geometry={g.northFace} material={faces.front} />
      <group rotation={[-Math.PI * fold, 0, 0]}>
        <mesh geometry={g.southBody} material={faces.body} />
        <mesh geometry={g.southFace} material={faces.front} />
        <mesh geometry={g.southBack} material={faces.back} />
        {light && <mesh geometry={g.light} material={faces.transit} />}
      </group>
    </>
  );
}

/** The test tower's report card #0408, from the cap's slot to its tab in the spill drawer. */
export function ReportCard({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const { textures } = useDeskSets();
  const back = useMemo(() => paper(textures.reportTab, HEX.paperLit), [textures]);
  useLayoutEffect(() => () => back.dispose(), [back]);
  const faces = { body: m.paperLit, front: m.printed.report, back, transit: m.transit };
  const d = s.dock;
  if (s.cardOut !== null)
    return (
      // standing in the cap's slot, rising out of it (its lower part inside the tower)
      <group position={cardRise(s.cardOut)} rotation={[CARD_STAND, 0, 0]}>
        <CardHalves fold={0} light={false} faces={faces} />
      </group>
    );
  if (s.card)
    return (
      // in flight: turning from standing to the mouth's tilt over its first two thirds, a little yaw at the top of the arc
      <group position={s.card.pos} rotation={[cardTilt(s.card.s), -0.1 * Math.sin(Math.PI * s.card.s), 0.04 * Math.sin(Math.PI * s.card.s)]}>
        <CardHalves fold={0} light={s.transit > 0} faces={faces} />
      </group>
    );
  if (!d) return null;
  // docked (settling), folding; then the tab across and down into the drawer, landing on spring-dock with a 3% squash
  const dockP: [number, number, number] = [DOCK_B[0], DOCK_B[1], DOCK_B[2] + (1 - d.settle) * 6];
  let pos = dockP;
  let tilt = CARD_DOCK_TILT;
  if (d.landed !== null) {
    pos = [TAB_REST_B[0], TAB_REST_B[1], TAB_REST_B[2] + 2.2 * (1 - d.landed)];
    tilt = TAB_LEAN_B + 0.05 * (1 - d.landed);
  } else if (d.drop > 0) {
    pos = tabArc(d.drop) as [number, number, number];
    tilt = CARD_DOCK_TILT + (TAB_LEAN_B - CARD_DOCK_TILT) * d.drop;
  }
  const sq = 0.03 * d.squash;
  return (
    <group position={pos} rotation={[tilt, 0, 0]} scale={[1 + sq, 1 - sq, 1]}>
      <CardHalves fold={d.fold} light={false} faces={faces} />
    </group>
  );
}

/** The folded tab's footprint (its crease at the origin, lying `tilt` up from the desk): half the card's depth. */
export const TAB_DEPTH = TAB_B.d;

function useReplyGeometry() {
  return useMemo(() => {
    const slip = new BoxGeometry(SLIP.l, SLIP.w, 1.2);
    const face = plane(SLIP.l, SLIP.w, 0, 0, 0.9);
    // the enamel stop tab, at the slip's trailing end
    const tab = slab({ x0: SLIP.l / 2 - 4, x1: SLIP.l / 2 + 8, y0: -9, y1: 9 }, -0.6, 2.2, 2, 0.6);
    return { slip, face, tab };
  }, []);
}

/** The reply #0408: out from under the deck along the chute's line, down the chute, into your in-tray (its text reading up-chute). */
export function Reply({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useReplyGeometry();
  if (!s.slip) return null;
  const pose = replyPose(s.slip);
  const squash = 1 - 0.03 * s.slip.squash;
  return (
    <group position={[pose.p[0], pose.p[1], pose.p[2] - 0.4 * s.slip.squash]} rotation={[0, pose.slope, pose.heading, 'ZYX']} scale={[1, 1, squash]}>
      <mesh geometry={g.slip} material={m.paperLit} />
      <mesh geometry={g.face} material={m.printed.reply} />
      <mesh geometry={g.tab} material={m.enamel} />
    </group>
  );
}
