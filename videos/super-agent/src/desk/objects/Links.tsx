/**
 * The relationships that are things (synthesis §2, Relationships): never a bare connector.
 * - Cords: the request's Thread, one overhead twisted cord in a single arch from the conversation
 *   spool, north of the reel, over the deck's pulley (its touch is the notice: the Router hears of the
 *   Thread without deciding) and down east of the deck to the bug bay. Stepped down in C12: Threads
 *   are explained at C17.
 * - Chute: the reply chute, the only path down to you, from the deck's south-west corner to your
 *   in-tray.
 * - Cargo: the report card (in flight under the one transit light, through the cut in it; then docked
 *   in the deck's mouth, folded in half into a tab that drops into the spill drawer and stays), and the
 *   reply that cites it (out from under the deck down the chute into your in-tray): objects/Handshake.tsx.
 *   A reply carries no transit light: the treatment lists report cards and dispatch folders only.
 * (Grooves, the whole hand-overs, are engraved in the desk itself: gl/desk.ts.)
 */
import { useLayoutEffect, useMemo } from 'react';
import { TorusGeometry, type BufferGeometry } from 'three';
import { cylinderZ, disc, dome, merge, ringFlat, slab, sweep, tube, twistedPair } from '../geom.ts';
import { EMIT, Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { CHUTE, CHUTE_POSTS, CHUTE_W, CORDS, DECK, MAST, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import { CORD_FROM, polylineAt, type DeskState } from '../state.ts';
import { Reply, ReportCard } from './Handshake.tsx';

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

/** The chute's trough (a U, clockwise in (across, up), so its faces point out of the wall) and its steel lips along a path. */
function chuteTrough(path0: readonly P3[], samples = 40): { trough: BufferGeometry; lips: BufferGeometry } {
  const w = CHUTE_W / 2;
  // a bend tighter than the trough is wide folds its inner side over itself (a fan of facets at the mouth):
  // the sweep passes over a corner whose two segments are both shorter than the trough is wide
  const seg = (a: P3, b: P3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const path = path0.filter((p, i) => i === 0 || i === path0.length - 1 || !(seg(path0[i - 1], p) < CHUTE_W * 0.6 && seg(p, path0[i + 1]) < CHUTE_W * 0.6));
  const trough = sweep(
    path,
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
    samples,
  );
  const lip = (a: number, b: number) =>
    sweep(
      path,
      [
        [a, 17],
        [b, 17],
        [b, 14],
        [a, 14],
        [a, 17],
      ],
      samples,
    );
  return { trough, lips: merge([lip(-w - 1.5, -w + 4), lip(w - 4, w + 1.5)]) };
}

/**
 * The chute's posts, finished: a steel rod from a bolted graphite foot up to an enamel collar and a graphite
 * saddle whose two cheeks hug the trough's sides (each post's parts in its own frame: its top is the origin, so
 * it can telescope down from under the trough).
 */
function chutePosts(): { x: number; y: number; top: number; rod: BufferGeometry; collar: BufferGeometry; saddle: BufferGeometry; foot: BufferGeometry }[] {
  return CHUTE_POSTS.map(([x, y]) => {
    let best = { d: 1e9, z: 0, t: 0 };
    for (let i = 0; i <= 100; i++) {
      const p = polylineAt(CHUTE, i / 100).p;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < best.d) best = { d, z: p[2], t: i / 100 };
    }
    const a = polylineAt(CHUTE, Math.max(0, best.t - 0.02)).p;
    const b = polylineAt(CHUTE, Math.min(1, best.t + 0.02)).p;
    const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const top = best.z - 1;
    const rod = cylinderZ(3.4, -top, -6, 0, 0, 14);
    const collar = cylinderZ(6.2, -8, -2, 0, 0, 18);
    // the saddle: a cross bar under the trough and a cheek either side of it, turned across the chute
    const w = CHUTE_W / 2;
    const saddle = merge([slab({ x0: -5, x1: 5, y0: -w - 4, y1: w + 4 }, -3, 0.5, 1.2, 0.5), slab({ x0: -5, x1: 5, y0: -w - 4, y1: -w - 0.5 }, -3, 10, 1, 0.5), slab({ x0: -5, x1: 5, y0: w + 0.5, y1: w + 4 }, -3, 10, 1, 0.5)]);
    saddle.rotateZ(heading);
    const foot = merge([disc(13, -top, -top + 3.2, { bevel: 1.2 }), ...[0, 1, 2].map((k) => dome(1.8, 9 * Math.cos(k * 2.1 + 0.4), 9 * Math.sin(k * 2.1 + 0.4), -top + 3.2))]);
    return { x, y, top, rod, collar, saddle, foot };
  });
}

function useChuteGeometry() {
  return useMemo(() => ({ ...chuteTrough(CHUTE), posts: chutePosts() }), []);
}

function Posts({ posts, k = 1 }: { posts: ReturnType<typeof chutePosts>; k?: number }) {
  const m = useDeskMats();
  return (
    <>
      {posts.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.top]} scale={[1, 1, Math.max(k, 1e-3)]}>
          <mesh geometry={p.rod} material={m.steel} />
          <mesh geometry={p.collar} material={m.enamelShade} />
          <mesh geometry={p.foot} material={m.graphiteDark} />
        </group>
      ))}
      {/* the saddles open out from under the trough as their posts drop */}
      {posts.map((p, i) => (
        <mesh key={`s${i}`} geometry={p.saddle} material={m.graphite} position={[p.x, p.y, p.top]} scale={[1, Math.max(Math.min(1, 0.4 + k), 1e-3), Math.max(Math.min(1, k * 1.5), 1e-3)]} />
      ))}
    </>
  );
}

/** The reply chute: the only path down to you (stepped down with the deck while a counterfactual is up). */
export function Chute({ s }: { s?: DeskState }) {
  const g = useChuteGeometry();
  return (
    <Step on={s ? isStepped(s.step, 'chute') : false}>
      <WithMats>
        {(m) => (
          <group>
            <mesh geometry={g.trough} material={m.graphite} />
            <mesh geometry={g.lips} material={m.steel} />
            <Posts posts={g.posts} />
          </group>
        )}
      </WithMats>
    </Step>
  );
}

/**
 * The turn's chute (desk/turn.ts): it extends out of the deck's south-west corner along its own path to your in-tray
 * (`path`, as far as it has come), then its posts telescope down from their saddles to the desk (`posts`, 0..1).
 */
export function TurnChute({ path, posts }: { path: readonly P3[]; posts: number }) {
  const m = useDeskMats();
  const g = useMemo(() => (path.length >= 2 ? chuteTrough(path, Math.max(4, Math.round(40 * (path.length / CHUTE.length)))) : null), [path]);
  useLayoutEffect(
    () => () => {
      if (g) Object.values(g).forEach((x) => x.dispose());
    },
    [g],
  );
  const p = useMemo(() => chutePosts(), []);
  if (!g) return null;
  return (
    <group>
      <mesh geometry={g.trough} material={m.graphite} />
      <mesh geometry={g.lips} material={m.steel} />
      {posts > 0.002 && <Posts posts={p} k={posts} />}
    </group>
  );
}

export function Cargo({ s }: { s: DeskState }) {
  const m = useDeskMats();
  useLayoutEffect(() => {
    // the one transit light, on the carrier in flight: ramped in and out (state.ts transitRamp), dark in its dock frame
    // (one carrier at a time: the report card, MT1's dispatch folder, or still (c)'s report; the request's beetle has its own,
    // objects/Bay.tsx BeetleLight)
    m.transit.color.set(LIGHT_HEX.work).multiplyScalar(EMIT.transit * Math.max(s.transit, s.next.folderTransit, s.cache?.transit ?? 0));
  }, [m, s.transit, s.next.folderTransit, s.cache?.transit]);
  // the report card and the reply, each a sheet of its own form (objects/Handshake.tsx)
  return (
    <group>
      <ReportCard s={s} />
      <Reply s={s} />
    </group>
  );
}
