/**
 * Lookdev of the tree family (world/Trees.tsx) in the film's own sky, ground, grass, light and
 * post: the hero view (TreesHero), and close views (TreesClose, one held key per frame: the
 * ghost tree's trunk and roots, the hero limb and its rope hooks from below, the old tree, the
 * back of the hill with the pines, the old tree's knot holes, the ghost tree's base). Stand-in
 * ropes and sheets hang from GHOST_HOOKS so the limb can be judged with its load.
 *
 * LOOKDEV-ONLY STAND-INS (never the film):
 *  - WideSky: the film's sky plane (the standing cover, BOOK.w wide) ends inside the hero frame,
 *    right of the moon, and close views see past it; until the sky's owner widens it, a wider
 *    plane with the same portal sky stands behind it so the trees' right edge can be judged;
 *  - TreesHeroOld: the old tree on the spot proposed for LAND.oldTree (layout.ts is not this
 *    family's file), clear of the big cross and the pumpkin;
 *  - TreesHeroRig: the film's rig with the hemisphere at 3× (a change proposed to the rig's
 *    owner), to see how the bark's camera side reads once the shadows are lifted;
 *  - TreesLitDebug: an extra front light on the close views, to inspect the bark relief.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Composition } from 'remotion';
import { CylinderGeometry, ConeGeometry } from 'three';
import { FPS } from '../cues.ts';
import { CamPath } from '../film/campath.ts';
import { storybookMaterial } from '../look/materials.ts';
import { useSkyPortal } from '../look/SkyPortal.tsx';
import { FLOOR, LAND } from '../world/layout.ts';
import { GHOST_HOOKS, Trees, type Spot2 } from '../world/Trees.tsx';
import { LOOK_POST, LookStage } from './LookStage.tsx';

/** the lookdev post without the moon's god rays (they smear a near occluder across the moon) */
const NO_RAYS = { ...LOOK_POST, rays: false };

/** The spot proposed for LAND.oldTree: on the hill behind the fence, its trunk clear of the cross and the pumpkin in the hero view. */
export const OLD_TREE_PROPOSED: Spot2 = { x: -1.6, z: 0.35 };

const CLOSE = new CamPath([
  // 0: the ghost tree's trunk, its roots in the mound, the hero limb leaving it
  { f: 0, pos: [2.15, FLOOR + 0.95, 5.5], look: [3.7, FLOOR + 1.55, 2.7], fov: 46, focus: 3.3, hold: true },
  // 1: the hero limb from the path below: the stepping run, the knobs and the ropes
  { f: 1, pos: [0.9, FLOOR + 0.95, 4.4], look: [2.0, FLOOR + 2.9, 1.8], fov: 46, focus: 3.3, hold: true },
  // 2: the old tree at the fence
  { f: 2, pos: [-1.3, FLOOR + 0.95, 4.7], look: [-2.55, FLOOR + 1.75, 1.25], fov: 46, focus: 3.6, hold: true },
  // 3: the back of the hill: background trees and the pines, on a long lens
  { f: 3, pos: [0.3, 3.45, 7.6], look: [-3.8, FLOOR + 2.2, -2.0], fov: 30, focus: 10, hold: true },
  // 4: the old tree's sleepy knot holes, close
  { f: 4, pos: [-2.25, FLOOR + 1.2, 2.75], look: [-2.75, FLOOR + 1.0, 1.3], fov: 40, focus: 1.6, hold: true },
  // 5: the ghost tree's base and roots, from the hero side
  { f: 5, pos: [2.7, FLOOR + 1.1, 5.7], look: [4.0, FLOOR + 0.45, 3.0], fov: 40, focus: 3.0, hold: true },
]);

/** LOOKDEV ONLY: a sky all round behind the film's sky plane, the same portal sky (see the file's header). */
function WideSky() {
  const mat = useSkyPortal();
  return (
    <mesh material={mat} position={[0, FLOOR, 0]}>
      <sphereGeometry args={[36, 48, 24]} />
    </mesh>
  );
}

/** Stand-in ghosts: a rope and a dark sheet cone under each hook (lookdev only). */
function StandIns() {
  const { rope, sheet, mat } = useMemo(
    () => ({
      rope: new CylinderGeometry(0.008, 0.008, 1, 5).translate(0, -0.5, 0),
      sheet: new ConeGeometry(0.2, 0.75, 14, 1, true).translate(0, -0.375, 0),
      mat: storybookMaterial({ kind: 'cloth', color: '#2a2630', color2: '#1a1820', breakup: 0.3, scale: 0.2, rim: 1.4 }),
    }),
    [],
  );
  useLayoutEffect(() => () => (rope.dispose(), sheet.dispose(), mat.dispose()), [rope, sheet, mat]);
  const ropes = [0.22, 0.3, 0.18];
  return (
    <>
      {GHOST_HOOKS.map((h, i) => (
        <group key={i} position={h}>
          <mesh geometry={rope} material={mat} scale={[1, ropes[i], 1]} />
          <mesh geometry={sheet} material={mat} position-y={-ropes[i] + 0.05} castShadow />
        </group>
      ))}
    </>
  );
}

function TreesHero() {
  return (
    <LookStage>
      {(f) => (
        <>
          <WideSky />
          <Trees f={f} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

/** The hero view exactly as the film's stage has it today (no wide sky). */
function TreesHeroFilm() {
  return (
    <LookStage>
      {(f) => (
        <>
          <Trees f={f} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

function TreesHeroFlat() {
  return (
    <LookStage post={NO_RAYS}>
      {(f) => (
        <>
          <WideSky />
          <Trees f={f} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

/** LOOKDEV ONLY: the old tree on the proposed spot. */
function TreesHeroOld() {
  return (
    <LookStage>
      {(f) => (
        <>
          <WideSky />
          <Trees f={f} oldTree={OLD_TREE_PROPOSED} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

/** LOOKDEV ONLY: the proposed rig (hemisphere 3×: the film's 0.66 plus 1.32) with the old tree on the proposed spot. */
function TreesHeroRig() {
  return (
    <LookStage>
      {(f) => (
        <>
          <hemisphereLight args={['#4a7fa3', '#2c1628', 1.32]} />
          <WideSky />
          <Trees f={f} oldTree={OLD_TREE_PROPOSED} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

function TreesClose() {
  return (
    <LookStage path={CLOSE} post={NO_RAYS}>
      {(f) => (
        <>
          <WideSky />
          <Trees f={f} />
          <StandIns />
        </>
      )}
    </LookStage>
  );
}

/**
 * DIAGNOSTIC ONLY (never the film's light): the close views with an extra front light, to
 * inspect the bark relief, the furrows and the knot holes that the film's backlit rig leaves
 * in the dark.
 */
function TreesLitDebug() {
  return (
    <LookStage path={CLOSE} post={NO_RAYS}>
      {(f) => (
        <>
          <directionalLight position={[2, FLOOR + 3, 12]} intensity={3} color="#d8e4ea" />
          <WideSky />
          <Trees f={f} />
        </>
      )}
    </LookStage>
  );
}

export function TreesRoot() {
  return (
    <>
      <Composition id="TreesHero" component={TreesHero} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="TreesHeroFilm" component={TreesHeroFilm} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="TreesHeroFlat" component={TreesHeroFlat} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="TreesHeroOld" component={TreesHeroOld} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="TreesHeroRig" component={TreesHeroRig} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="TreesClose" component={TreesClose} width={1920} height={1080} fps={FPS} durationInFrames={6} />
      <Composition id="TreesLitDebug" component={TreesLitDebug} width={1920} height={1080} fps={FPS} durationInFrames={6} />
    </>
  );
}

/** the old tree's spot in the film (re-exported for the report) */
export const OLD_TREE_FILM: Spot2 = { x: LAND.oldTree.x, z: LAND.oldTree.z };
