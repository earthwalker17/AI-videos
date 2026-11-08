/**
 * The relationships that are things (synthesis §2, Relationships): never a bare connector.
 * - Cords: the request's Thread, one overhead twisted cord in a single arch from the conversation
 *   spool, north of the reel, over the deck's pulley (its touch is the notice: the Router hears of the
 *   Thread without deciding) and down east of the deck to the bug bay. Stepped down in C12: Threads
 *   are explained at C17.
 * - Chute: the reply chute, the only path down to you, from the deck's south-west corner to your
 *   in-tray.
 * - Cargo: the report card (in flight under the transit light, then docked in the deck's mouth),
 *   and the reply slip that cites it (riding the chute under the transit light, then resting in your
 *   in-tray). Only one carrier flies at a time, and it carries the one transit light, shining
 *   through its punched hole.
 * (Grooves, the whole hand-overs, are engraved in the desk itself: gl/desk.ts.)
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, TorusGeometry } from 'three';
import { cylinderZ, disc, merge, plane, ringFlat, slab, sweep, tube, twistedPair } from '../geom.ts';
import { EMIT, Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { CARD, CHUTE, CHUTE_POSTS, CHUTE_W, CORDS, DECK, MAST, MOUTH, SLIP, YOU, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import { polylineAt, slipPose, type DeskState } from '../state.ts';

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

export function Chute() {
  const m = useDeskMats();
  const g = useChuteGeometry();
  return (
    <group>
      <mesh geometry={g.trough} material={m.graphite} />
      <mesh geometry={g.lips} material={m.steel} />
      <mesh geometry={g.posts} material={m.graphite} />
    </group>
  );
}

/** Where the landed reply rests: on top of the slips already in your in-tray. */
const IN_TRAY_REST: P3 = [rectC(YOU.inTray)[0], rectC(YOU.inTray)[1] - 4, YOU.top + 6];

function useCargoGeometry() {
  return useMemo(() => {
    const card = new BoxGeometry(CARD.w, CARD.d, 1.8);
    const cardFace = plane(CARD.w, CARD.d, 0, 0, 1.0);
    // the transit light through the card's punched hole (texture: 14 u from its east end)
    const cardLight = (() => {
      const g = new CircleGeometry(5.5, 24);
      g.translate(CARD.w / 2 - 14, 0, 1.15);
      return g;
    })();
    const slip = new BoxGeometry(SLIP.l, SLIP.w, 1.2);
    const slipFace = plane(SLIP.l, SLIP.w, 0, 0, 0.9);
    // the slip's punched hole is at its trailing end (texture: 9 u from its east end, which rides up-chute)
    const slipLight = (() => {
      const g = new CircleGeometry(4.2, 20);
      g.translate(SLIP.l / 2 - 9, 0, 1.0);
      return g;
    })();
    // the enamel stop tab, at the leading end
    const tab = slab({ x0: SLIP.l / 2 - 4, x1: SLIP.l / 2 + 8, y0: -9, y1: 9 }, -0.6, 2.2, 2, 0.6);
    return { card, cardFace, cardLight, slip, slipFace, slipLight, tab };
  }, []);
}

export function Cargo({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useCargoGeometry();
  const level = s.transit.level;
  useLayoutEffect(() => {
    // the one transit light: on whichever carrier is in flight, eased in and out at either end of its ride
    m.transit.color.set(LIGHT_HEX.work).multiplyScalar(EMIT.transit * level);
  }, [m, level]);
  const card = s.card;
  const riding = s.slip && s.slip.s < 1 ? slipPose(s.slip.s) : null;
  const landed = s.slip !== null && s.slip.s >= 1;
  const squash = 1 - 0.03 * (s.slip?.squash ?? 0);
  return (
    <group>
      {card && (
        <group position={[card.pos[0], card.pos[1], card.pos[2]]} rotation={[0.18 - 0.36 * card.s, -0.12, 0.06]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
          {s.transit.on === 'card' && <mesh geometry={g.cardLight} material={m.transit} />}
        </group>
      )}
      {s.cardDocked && (
        <group position={[MOUTH.land[0], MOUTH.land[1], MOUTH.land[2]]} rotation={[0.28, 0, 0]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
        </group>
      )}
      {riding && (
        // the slip's text reads up-chute (its +x points back up the chute), so its hole trails
        <group position={[riding.p[0], riding.p[1], riding.p[2] + 6]} rotation={[0, riding.slope, riding.heading + Math.PI, 'ZYX']}>
          <mesh geometry={g.slip} material={m.paperLit} />
          <mesh geometry={g.slipFace} material={m.printed.reply} />
          <mesh geometry={g.tab} material={m.enamel} />
          {s.transit.on === 'slip' && <mesh geometry={g.slipLight} material={m.transit} />}
        </group>
      )}
      {landed && (
        <group position={[IN_TRAY_REST[0], IN_TRAY_REST[1], IN_TRAY_REST[2]]} rotation={[0, 0, 0.08]} scale={[1, 1, squash]}>
          <mesh geometry={g.slip} material={m.paperLit} />
          <mesh geometry={g.slipFace} material={m.printed.reply} />
          <mesh geometry={g.tab} material={m.enamel} />
        </group>
      )}
    </group>
  );
}
