/**
 * Lookdev of the props family (world/Pumpkins.tsx: the giant jack-o'-lantern, the small pumpkins,
 * Clawd's pail; world/Props2.tsx: the cauldron, the coffin and shovel, the fireflies), in the
 * whole world as built (lookdev/World.tsx WorldScene, its V1 pumpkin stand-in off) through the
 * film's stage (LookStage: sky, terrain, grass, the night rig, the post chain):
 *  PropsHero      the hero view (the reference's composition)
 *  PropsPumpkin   the giant, held close: 0 three-quarter from the path, 1 face on, 2 as 0 cold
 *                 (lit 0), 3 the hero eye on a long lens (the reference's crop), 4 from the low
 *                 front at the rocks (the warm pool)
 *  PropsCauldron  the cauldron: 0 three-quarter close, 1 from above (the brew), 2 the hero eye on a
 *                 long lens (with the RIP stone)
 *  PropsClose     0 the coffin and shovel close, 1 the hero eye on a long lens on them, 2 the
 *                 pumpkin stack by the gates, 3 the porch pumpkins, 4 Clawd's pail (set at the
 *                 shoo stop for the look), 5 the lane's fireflies from the gates
 *  PropsSnap      the cold snap on the giant (frames 0..7: lit 1, then dropping with one re-flare)
 *  PropsMotion    the cauldron's three-quarter close held, 12 frames (bubbles, steam, fireflies in motion: --span)
 *  PropsScale     the hero view with a stand-in Clawd (0.33 x 0.25, 0.4 with the hat) on the path at the
 *                 giant's depth, his pail beside him: 0 the hero eye, 1 a long lens on Clawd and the giant
 */
import { useMemo } from 'react';
import { BoxGeometry, ConeGeometry } from 'three';
import { Composition } from 'remotion';
import { FPS } from '../cues.ts';
import { CamPath, type CamKey } from '../film/campath.ts';
import { LAND, DOOR_FRONT, fromHouse, HERO, onGround, pathXZ, SMALL_PUMPKINS, STOPS } from '../world/layout.ts';
import { Cauldron, Coffin, COFFIN, Fireflies } from '../world/Props2.tsx';
import { BigPumpkin, PumpkinPail, PumpkinPatch } from '../world/Pumpkins.tsx';
import { storybookMaterial } from '../look/materials.ts';
import { LookStage } from './LookStage.tsx';
import { WorldScene } from './World.tsx';

type V3 = [number, number, number];
const hold = (f: number, k: Omit<CamKey, 'f' | 'hold'>): CamKey => ({ f, ...k, hold: true });
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const view = (f: number, pos: V3, look: V3, fov: number): CamKey => hold(f, { pos, look, fov, focus: dist(pos, look) });

const P = LAND.bigPumpkin;
const PC = onGround(P.x, P.z, 0.78);
const C = LAND.cauldron;
const CC = onGround(C.x, C.z, 0.22);
const K = onGround(COFFIN.x - 0.05, COFFIN.z, 0.08);
const stack = SMALL_PUMPKINS[2];
const [shooX, shooZ] = pathXZ(STOPS.shoo);
const PAIL_AT = onGround(shooX - 0.2, shooZ + 0.15, 0);

/** Every prop in the world (the pail only where a composition asks for it). */
function Props({ f, lit = 1, pail = false }: { f: number; lit?: number; pail?: boolean }) {
  return (
    <>
      <WorldScene f={f} standIns={false} />
      <BigPumpkin f={f} lit={lit} />
      <PumpkinPatch f={f} lit={1} />
      <Cauldron f={f} />
      <Coffin />
      <Fireflies f={f} />
      {pail && (
        <group position={PAIL_AT} rotation-y={0.6}>
          <PumpkinPail f={f} lit={1} />
        </group>
      )}
    </>
  );
}

function PropsHero() {
  return <LookStage>{(f) => <Props f={f} />}</LookStage>;
}

const PUMPKIN_PATH = new CamPath([
  view(0, [P.x + 1.45, PC[1] + 0.3, P.z + 1.75], [P.x, PC[1] + 0.05, P.z], 40),
  view(1, [P.x + 1.45, PC[1] + 0.05, P.z + 0.95], [P.x, PC[1] - 0.05, P.z], 38),
  view(2, [P.x + 1.25, PC[1] + 0.25, P.z + 1.55], [P.x, PC[1] - 0.05, P.z], 40),
  view(3, HERO.pos, [P.x + 0.05, PC[1] + 0.05, P.z], 19),
  view(4, [P.x + 0.75, PC[1] - 0.45, P.z + 1.55], [P.x - 0.05, PC[1] - 0.35, P.z + 0.3], 46),
]);
function PropsPumpkin() {
  return <LookStage path={PUMPKIN_PATH}>{(f) => <Props f={f} lit={f === 2 ? 0 : 1} />}</LookStage>;
}

const CAULDRON_PATH = new CamPath([
  view(0, [C.x - 0.45, CC[1] + 0.35, C.z + 1.05], [C.x, CC[1], C.z], 40),
  view(1, [C.x - 0.15, CC[1] + 0.85, C.z + 0.6], [C.x, CC[1] + 0.05, C.z], 40),
  view(2, HERO.pos, [C.x + 0.3, CC[1] + 0.1, C.z - 0.1], 12),
]);
function PropsCauldron() {
  return <LookStage path={CAULDRON_PATH}>{(f) => <Props f={f} />}</LookStage>;
}

const porch = DOOR_FRONT.porchPumpkins.map((p) => fromHouse(p));
const CLOSE_PATH = new CamPath([
  view(0, [K[0] + 0.4, K[1] + 0.38, K[2] + 0.85], K, 42),
  view(1, HERO.pos, K, 14),
  view(2, onGround(stack.x - 0.35, stack.z + 0.95, 0.35), onGround(stack.x, stack.z, 0.12), 36),
  view(3, fromHouse([0.1, 0.5, 1.35]), [(porch[0][0] + porch[1][0]) / 2, porch[0][1] + 0.12, (porch[0][2] + porch[1][2]) / 2], 44),
  view(4, [PAIL_AT[0] + 0.15, PAIL_AT[1] + 0.22, PAIL_AT[2] + 0.5], [PAIL_AT[0], PAIL_AT[1] + 0.06, PAIL_AT[2]], 36),
  view(5, onGround(1.1, -0.3, 0.7), onGround(2.6, -1.3, 0.4), 50),
]);
function PropsClose() {
  return <LookStage path={CLOSE_PATH}>{(f) => <Props f={f} pail={f === 4} />}</LookStage>;
}

/** The cold snap: lit 1 → off over six frames with one tiny re-flare, then black. */
const SNAP = [1, 1, 0.72, 0.38, 0.5, 0.18, 0.05, 0];
const SNAP_PATH = new CamPath([view(0, [P.x + 1.25, PC[1] + 0.25, P.z + 1.55], [P.x, PC[1] - 0.05, P.z], 40), view(100, [P.x + 1.25, PC[1] + 0.25, P.z + 1.55], [P.x, PC[1] - 0.05, P.z], 40)]);
function PropsSnap() {
  return <LookStage path={SNAP_PATH}>{(f) => <Props f={f} lit={SNAP[Math.min(f, SNAP.length - 1)]} />}</LookStage>;
}

const MOTION_PATH = new CamPath([view(0, [C.x - 0.45, CC[1] + 0.35, C.z + 1.05], [C.x, CC[1], C.z], 40), view(100, [C.x - 0.45, CC[1] + 0.35, C.z + 1.05], [C.x, CC[1], C.z], 40)]);
function PropsMotion() {
  return <LookStage path={MOTION_PATH}>{(f) => <Props f={f} />}</LookStage>;
}

/** A stand-in for Clawd at his V2 size (13 x 8 cells: 0.33 x 0.25, a 0.15 hat), for scale only. */
function ClawdStandIn({ at, yaw }: { at: V3; yaw: number }) {
  const s = useMemo(() => ({ body: new BoxGeometry(0.33, 0.25, 0.15), hat: new ConeGeometry(0.075, 0.15, 16), mat: storybookMaterial({ color: '#D77757', roughness: 0.9 }), hatMat: storybookMaterial({ color: '#2B1830', roughness: 0.9 }) }), []);
  return (
    <group position={at} rotation-y={yaw}>
      <mesh geometry={s.body} material={s.mat} position-y={0.125} castShadow />
      <mesh geometry={s.hat} material={s.hatMat} position={[0.03, 0.325, 0]} rotation-z={-0.15} castShadow />
    </group>
  );
}
const [cwX, cwZ] = pathXZ(1.25);
const CLAWD_AT = onGround(cwX, cwZ, 0);
const SCALE_PATH = new CamPath([view(0, HERO.pos, HERO.look, HERO.fov), view(1, HERO.pos, [(CLAWD_AT[0] + P.x) / 2, CLAWD_AT[1] + 0.35, (CLAWD_AT[2] + P.z) / 2], 16)]);
function PropsScale() {
  return (
    <LookStage path={SCALE_PATH}>
      {(f) => (
        <>
          <Props f={f} />
          <ClawdStandIn at={CLAWD_AT} yaw={0.4} />
          <group position={[CLAWD_AT[0] + 0.24, CLAWD_AT[1], CLAWD_AT[2] + 0.05]} rotation-y={0.5}>
            <PumpkinPail f={f} lit={1} />
          </group>
        </>
      )}
    </LookStage>
  );
}

export function PropsRoot() {
  return (
    <>
      <Composition id="PropsHero" component={PropsHero} width={1920} height={1080} fps={FPS} durationInFrames={24} />
      <Composition id="PropsPumpkin" component={PropsPumpkin} width={1920} height={1080} fps={FPS} durationInFrames={5} />
      <Composition id="PropsCauldron" component={PropsCauldron} width={1920} height={1080} fps={FPS} durationInFrames={3} />
      <Composition id="PropsClose" component={PropsClose} width={1920} height={1080} fps={FPS} durationInFrames={6} />
      <Composition id="PropsSnap" component={PropsSnap} width={1920} height={1080} fps={FPS} durationInFrames={SNAP.length} />
      <Composition id="PropsMotion" component={PropsMotion} width={1920} height={1080} fps={FPS} durationInFrames={12} />
      <Composition id="PropsScale" component={PropsScale} width={1920} height={1080} fps={FPS} durationInFrames={2} />
    </>
  );
}
