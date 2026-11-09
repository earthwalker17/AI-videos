/**
 * The relationships that are things (synthesis §2, Relationships): never a bare connector.
 * - Cords: the request's Thread, one overhead twisted cord in a single arch from the conversation
 *   spool, north of the reel, over the deck's pulley (its touch is the notice: the Router hears of the
 *   Thread without deciding) and down east of the deck to the bug bay. Stepped down in C12: Threads
 *   are explained at C17.
 * - Chute: the reply chute, the only path down to you, from the deck's south-west corner to your
 *   in-tray.
 * - Cargo: the report card (in flight under the one transit light, through its punched hole; then
 *   docked in the deck's mouth, its body folded into a tab that drops into the spill drawer), and the
 *   reply that cites it (out of the slot under the index sector, down the chute, into your in-tray
 *   beside #0403). A reply carries no transit light: the treatment lists report cards and dispatch
 *   folders only.
 * (Grooves, the whole hand-overs, are engraved in the desk itself: gl/desk.ts.)
 */
import { clamp, easings } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, TorusGeometry } from 'three';
import { cylinderZ, disc, merge, plane, ringFlat, slab, sweep, tube, twistedPair } from '../geom.ts';
import { EMIT, Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { CARD, CHUTE, CHUTE_POSTS, CHUTE_W, CORDS, DECK, INDEX, MAST, MOUTH, SLIP, YOU, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import { CARD_FROM, CORD_FROM, polylineAt, slipPose, tabArc, type DeskState } from '../state.ts';

function useCordGeometry() {
  return useMemo(() => {
    const [v0, v1] = twistedPair(CORDS.vermilion, 2.4, 2.1, 16, 420);
    // the deck's pulley: an arm off the east rail, a post, a sheave the cord rests on
    const z0 = DECK.top - 4;
    const bracket = merge([
      tube(
        [
          [MAST.arm[0] - 6, MAST.arm[1], z0],
          [MAST.x, MAST.y, z0],
        ],
        4,
        4,
        8,
      ),
      tube(
        [
          [MAST.x, MAST.y, z0],
          [MAST.x, MAST.y, MAST.h - 12],
        ],
        4.5,
        4,
        10,
      ),
    ]);
    const sheave = (() => {
      const g = new TorusGeometry(10, 3, 10, 32);
      g.rotateX(Math.PI / 2);
      g.rotateZ(-0.6);
      g.translate(MAST.x, MAST.y, MAST.h - 9);
      return g;
    })();
    const t = CORDS.vermilion[CORDS.vermilion.length - 1];
    const terminal = merge([cylinderZ(5, t[2] - 16, t[2] + 2, t[0], t[1], 14), ringFlat(6, 1.8, t[0], t[1], t[2] + 2)]);
    return { cord: merge([v0, v1]), bracket, sheave, terminal };
  }, []);
}

export function Cords({ s }: { s: DeskState }) {
  const g = useCordGeometry();
  // no Thread cord before C17's beat (design D1): it first pays out at 7.1
  if (s.f < CORD_FROM) return null;
  return (
    <Step on={isStepped(s.step, 'cord')}>
      <WithMats>
        {(m) => (
          <group>
            <mesh geometry={g.bracket} material={m.graphite} />
            <mesh geometry={g.sheave} material={m.steel} />
            <mesh geometry={g.cord} material={m.cordVermilion} />
            <mesh geometry={g.terminal} material={m.steel} />
          </group>
        )}
      </WithMats>
    </Step>
  );
}

function useChuteGeometry() {
  return useMemo(() => {
    const w = CHUTE_W / 2;
    // a U trough (clockwise in (across, up), so its faces point out of the wall)
    const trough = sweep(
      CHUTE,
      [
        [-w, 15],
        [-w + 3, 15],
        [-w + 3, 3],
        [w - 3, 3],
        [w - 3, 15],
        [w, 15],
        [w, 0],
        [-w, 0],
        [-w, 15],
      ],
      40,
    );
    const lip = (a: number, b: number) =>
      sweep(
        CHUTE,
        [
          [a, 17],
          [b, 17],
          [b, 14],
          [a, 14],
          [a, 17],
        ],
        40,
      );
    const posts = merge(
      CHUTE_POSTS.map(([x, y]) => {
        let best = { d: 1e9, z: 0 };
        for (let i = 0; i <= 100; i++) {
          const p = polylineAt(CHUTE, i / 100).p;
          const d = Math.hypot(p[0] - x, p[1] - y);
          if (d < best.d) best = { d, z: p[2] };
        }
        return merge([cylinderZ(5, 0, best.z - 2, x, y, 14), disc(12, 0, 3, { cx: x, cy: y, bevel: 1 })]);
      }),
    );
    return { trough, lips: merge([lip(-w - 1.5, -w + 4), lip(w - 4, w + 1.5)]), posts };
  }, []);
}

/** The reply chute; during the turn its posts telescope down to the desk as it lowers (`posts`, 0..1; desk/turn.ts). */
/** Where the chute's posts meet its trough (they telescope down from here). */
const POST_TOP = 92;

export function Chute({ posts }: { posts?: number } = {}) {
  const m = useDeskMats();
  const g = useChuteGeometry();
  if (posts !== undefined)
    return (
      <group>
        <mesh geometry={g.trough} material={m.graphite} />
        <mesh geometry={g.lips} material={m.steel} />
        {posts > 0.02 && (
          <group position={[0, 0, POST_TOP]} scale={[1, 1, posts]}>
            <mesh geometry={g.posts} material={m.graphite} position={[0, 0, -POST_TOP]} />
          </group>
        )}
      </group>
    );
  return (
    <group>
      <mesh geometry={g.trough} material={m.graphite} />
      <mesh geometry={g.lips} material={m.steel} />
      <mesh geometry={g.posts} material={m.graphite} />
    </group>
  );
}

/** Where the landed reply rests: in the in-tray's north half, beside #0403 (not on it). */
const IN_TRAY_REST: P3 = [rectC(YOU.inTray)[0], YOU.inTray.y1 - 28, YOU.top + 5];
/** The slot under the index sector the reply emerges from. */
const SLOT_OUT: P3 = [INDEX.pivot[0] - 24, INDEX.pivot[1] - 26, DECK.top - 6];

function useCargoGeometry() {
  return useMemo(() => {
    const card = new BoxGeometry(CARD.w, CARD.d, 1.8);
    const cardFace = plane(CARD.w, CARD.d, 0, 0, 1.0);
    // the transit light through the card's punched hole (texture: 10 u from its east edge, 46 u down)
    const cardLight = (() => {
      const g = new CircleGeometry(4.8, 24);
      g.translate(CARD.w / 2 - 10, CARD.d / 2 - 46, 1.15);
      return g;
    })();
    const slip = new BoxGeometry(SLIP.l, SLIP.w, 1.2);
    const slipFace = plane(SLIP.l, SLIP.w, 0, 0, 0.9);
    // the enamel stop tab, at the slip's east end
    const tab = slab({ x0: SLIP.l / 2 - 4, x1: SLIP.l / 2 + 8, y0: -9, y1: 9 }, -0.6, 2.2, 2, 0.6);
    // the header strip: the card's top band (its texture's top 40%) as a narrow slip
    const header = (() => {
      const g = plane(CARD.w, CARD.d * 0.4, 0, 0, 0);
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setY(i, 0.6 + uv.getY(i) * 0.4);
      return g;
    })();
    return { card, cardFace, cardLight, slip, slipFace, tab, header };
  }, []);
}

const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Where the header enters the print head. */
const HEAD_IN: P3 = [-300, 225, 128];

export function Cargo({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useCargoGeometry();
  useLayoutEffect(() => {
    // the one transit light, on the report card in flight: faded in and out over 4 f, dark in its dock frame
    // (one carrier at a time: the report card, MT1's dispatch folder, or still (c)'s report)
    m.transit.color.set(LIGHT_HEX.work).multiplyScalar(EMIT.transit * Math.max(s.transit, s.next.folderTransit, s.cache?.transit ?? 0));
  }, [m, s.transit, s.next.folderTransit, s.cache?.transit]);
  const card = s.card;
  const d = s.dock;
  // the reply: out from under the index sector, down the chute (its text reading up-chute), then
  // turning along the exit curve to lie as it will in the tray, and landing on spring-dock
  let slipPose3: { p: P3; rot: [number, number, number, 'ZYX'] } | null = null;
  if (s.slip) {
    const { emerge, s: k, settle, squash } = s.slip;
    const start = slipPose(0);
    if (emerge < 1) {
      slipPose3 = { p: lerp3(SLOT_OUT, [start.p[0], start.p[1], start.p[2] + 6], emerge), rot: [0, start.slope, start.heading + Math.PI, 'ZYX'] };
    } else if (k < 1) {
      const pose = slipPose(k);
      const turn = clamp((k - 0.7) / 0.3);
      const heading = pose.heading + Math.PI + (0.08 - (pose.heading + Math.PI)) * easings.inOutSine(turn);
      slipPose3 = { p: [pose.p[0], pose.p[1], pose.p[2] + 6], rot: [0, pose.slope * (1 - turn), heading, 'ZYX'] };
    } else {
      const end = CHUTE[CHUTE.length - 1];
      const p = lerp3([end[0], end[1], end[2] + 6], IN_TRAY_REST, settle);
      slipPose3 = { p: [p[0], p[1], p[2] - squash * 0.4], rot: [0, 0, 0.08, 'ZYX'] };
    }
  }
  const squash = 1 - 0.03 * (s.slip?.squash ?? 0);
  const out = s.cardOut;
  const headerAt = lerp3([MOUTH.land[0], MOUTH.land[1] + 10, MOUTH.land[2] + 4], HEAD_IN, s.header);
  return (
    <group>
      {out !== null && (
        // rising out of the slot in the tower's cap: its lower part still inside the cap
        <group position={[CARD_FROM[0], CARD_FROM[1], CARD_FROM[2] - CARD.d * 0.5 * (1 - out)]} rotation={[Math.PI / 2 - 0.2, 0, 0]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
        </group>
      )}
      {s.header > 0 && s.header < 1 && (
        // the report's header strip, sliding up from the holder into the print head
        <mesh geometry={g.header} material={m.printed.report} position={headerAt} />
      )}
      {card && (
        <group position={[card.pos[0], card.pos[1], card.pos[2]]} rotation={[0.18 - 0.36 * card.s, -0.12, 0.06]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
          {s.transit > 0 && <mesh geometry={g.cardLight} material={m.transit} />}
        </group>
      )}
      {d && !d.gone && (
        // at the mouth: settles on spring-dock, its body folds up into a tab, the tab drops into the spill drawer
        <group position={d.drop > 0 ? tabArc(d.drop) : [MOUTH.land[0], MOUTH.land[1], MOUTH.land[2] + (1 - d.settle) * 6]} rotation={[0.28 + 1.1 * d.fold, 0, 0.6 * d.drop]} scale={[1 - 0.35 * d.fold, 1 - 0.7 * d.fold, 1]}>
          <mesh geometry={g.card} material={m.paperLit} />
          {d.fold < 0.5 && <mesh geometry={g.cardFace} material={m.printed.report} />}
        </group>
      )}
      {slipPose3 && (
        <group position={slipPose3.p} rotation={slipPose3.rot} scale={[1, 1, squash]}>
          <mesh geometry={g.slip} material={m.paperLit} />
          <mesh geometry={g.slipFace} material={m.printed.reply} />
          <mesh geometry={g.tab} material={m.enamel} />
        </group>
      )}
    </group>
  );
}
