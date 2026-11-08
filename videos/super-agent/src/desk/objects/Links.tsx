/**
 * The relationships that are things (synthesis §2, Relationships): never a bare connector.
 * - Cords: Thread subscriptions, overhead twisted cords from the conversation spool to the bay
 *   that holds the Thread, arched north of the reel on a mast so their shadows miss its face; the
 *   vermilion one is the request's Thread, to the bug bay. Pass-through: the reel makes no detent.
 * - Chute: the reply chute, the only path down to you, from the deck's south-west corner to your
 *   in-tray.
 * - Cargo: the report card in flight up to the hopper with its transit light (the second bloom),
 *   and the reply slip riding the chute down (70% of the way at f2200).
 * (Grooves, the whole hand-overs, are engraved in the desk itself: gl/desk.ts.)
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
import { cylinderZ, disc, dome, merge, plane, ringFlat, slab, sweep, twistedPair } from '../geom.ts';
import { EMIT, useDeskMats } from '../kit.tsx';
import { LIGHT_HEX } from '../pools.ts';
import { CARD, CHUTE, CHUTE_POSTS, CHUTE_W, CORDS, HOPPER, MAST, SLIP, YOU, rectC, type P3 } from '../layout.ts';

/** Where the landed reply rests: on top of the slips already in your in-tray. */
const IN_TRAY_REST: P3 = [rectC(YOU.inTray)[0], rectC(YOU.inTray)[1] - 4, YOU.top + 6];
import { polylineAt, slipPose, type DeskState } from '../state.ts';

function useCordGeometry() {
  return useMemo(() => {
    const [v0, v1] = twistedPair(CORDS.vermilion, 2.4, 2.1, 16, 420);
    const [g0, g1] = twistedPair(CORDS.graphite, 2.4, 2.1, 16, 420);
    const mast = merge([cylinderZ(6.5, 0, MAST.h - 10, MAST.x, MAST.y, 16), disc(20, 0, 5, { cx: MAST.x, cy: MAST.y, bevel: 1.5 })]);
    // the mast's head: a saddle the two cords pass over
    const saddle = merge([slab({ x0: MAST.x - 12, x1: MAST.x + 12, y0: MAST.y - 18, y1: MAST.y + 20 }, MAST.h - 12, MAST.h - 4, 3, 1.5), dome(5, MAST.x, MAST.y + 1, MAST.h - 4)]);
    // terminals where each cord comes down onto its bay's wall
    const term = (p: P3) => merge([cylinderZ(5, p[2] - 18, p[2] + 2, p[0], p[1], 14), ringFlat(6, 1.8, p[0], p[1], p[2] + 2)]);
    const tv = CORDS.vermilion[CORDS.vermilion.length - 1];
    const tg = CORDS.graphite[CORDS.graphite.length - 1];
    const terminals = merge([term(tv), term(tg)]);
    return { vermilion: merge([v0, v1]), graphite: merge([g0, g1]), mast, saddle, terminals };
  }, []);
}

export function Cords() {
  const m = useDeskMats();
  const g = useCordGeometry();
  return (
    <group>
      <mesh geometry={g.mast} material={m.graphite} />
      <mesh geometry={g.saddle} material={m.enamelShade} />
      <mesh geometry={g.vermilion} material={m.cordVermilion} />
      <mesh geometry={g.graphite} material={m.cordGraphite} />
      <mesh geometry={g.terminals} material={m.steel} />
    </group>
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
    const lips = sweep(
      CHUTE,
      [
        [-w - 1.5, 17],
        [-w + 4, 17],
        [-w + 4, 14],
        [-w - 1.5, 14],
        [-w - 1.5, 17],
      ],
      40,
    );
    const lipsR = sweep(
      CHUTE,
      [
        [w - 4, 17],
        [w + 1.5, 17],
        [w + 1.5, 14],
        [w - 4, 14],
        [w - 4, 17],
      ],
      40,
    );
    const posts = merge(
      CHUTE_POSTS.map(([x, y]) => {
        // the chute's height over this post
        let best = { d: 1e9, z: 0 };
        for (let i = 0; i <= 100; i++) {
          const p = polylineAt(CHUTE, i / 100).p;
          const d = Math.hypot(p[0] - x, p[1] - y);
          if (d < best.d) best = { d, z: p[2] };
        }
        return merge([cylinderZ(5, 0, best.z - 2, x, y, 14), disc(12, 0, 3, { cx: x, cy: y, bevel: 1 })]);
      }),
    );
    return { trough, lips: merge([lips, lipsR]), posts };
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

function useCargoGeometry() {
  return useMemo(() => {
    const card = new BoxGeometry(CARD.w, CARD.d, 1.6);
    const cardFace = plane(CARD.w, CARD.d, 0, 0, 0.85);
    const transit = dome(5.5, CARD.w / 2 - 10, 0, 0.8);
    const bezel = ringFlat(6.5, 1.4, CARD.w / 2 - 10, 0, 1);
    const slip = new BoxGeometry(SLIP.l, SLIP.w, 1.2);
    const slipFace = plane(SLIP.l, SLIP.w, 0, 0, 0.65);
    // the enamel stop tab ("≤ 100" in the film; a plain tab here)
    const tab = slab({ x0: SLIP.l / 2 - 4, x1: SLIP.l / 2 + 8, y0: -9, y1: 9 }, -0.6, 2.2, 2, 0.6);
    return { card, cardFace, transit, bezel, slip, slipFace, tab };
  }, []);
}

export function Cargo({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useCargoGeometry();
  const card = s.card;
  const light = card?.light ?? 0;
  useLayoutEffect(() => {
    // the one transit light: on while the card flies, eased in and out at either end of the flight
    m.transit.color.set(LIGHT_HEX.work).multiplyScalar(EMIT.transit * light);
  }, [m, light]);
  const slip = s.slip && s.slip.s < 1 ? slipPose(s.slip.s) : null;
  // once landed, the slip lies in your in-tray (3% squash as it lands) and the card in the hopper: nothing vanishes
  const landed = s.slip !== null && s.slip.s >= 1;
  const squash = 1 - 0.03 * (s.slip?.squash ?? 0);
  return (
    <group>
      {landed && (
        <group position={[IN_TRAY_REST[0], IN_TRAY_REST[1], IN_TRAY_REST[2]]} rotation={[0, 0, 0.08]} scale={[1, 1, squash]}>
          <mesh geometry={g.slip} material={m.paperLit} />
          <mesh geometry={g.slipFace} material={m.printed.reply} />
          <mesh geometry={g.tab} material={m.enamel} />
        </group>
      )}
      {s.cardDocked && (
        <group position={[HOPPER.land[0], HOPPER.land[1], HOPPER.z[0] + 4]} rotation={[0, 0, 0.05]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
          <mesh geometry={g.bezel} material={m.steel} />
        </group>
      )}
      {card && (
        <group position={[card.pos[0], card.pos[1], card.pos[2]]} rotation={[0.16 - 0.3 * card.s, 0.1, 0.12 - 0.2 * card.s]}>
          <mesh geometry={g.card} material={m.paperLit} />
          <mesh geometry={g.cardFace} material={m.printed.report} />
          <mesh geometry={g.bezel} material={m.steel} />
          <mesh geometry={g.transit} material={m.transit} />
        </group>
      )}
      {slip && (
        <group position={[slip.p[0], slip.p[1], slip.p[2] + 4]} rotation={[0, slip.slope, slip.heading + Math.PI, 'ZYX']}>
          <mesh geometry={g.slip} material={m.paperLit} />
          <mesh geometry={g.slipFace} material={m.printed.reply} />
          <mesh geometry={g.tab} material={m.enamel} />
        </group>
      )}
    </group>
  );
}
