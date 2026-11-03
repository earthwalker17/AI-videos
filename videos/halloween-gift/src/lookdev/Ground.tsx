/**
 * Lookdev of the ground family: the terrain with its dirt track, the grass, and the dressing
 * (rocks, the root mass, cobwebs, leaves), in the film's stage (LookStage: sky, night rig,
 * post). The tree family's trees (world/Trees.tsx) and greybox stand-ins of the other
 * neighbouring families (stones, the big cross, the giant pumpkin and its candle's light at the
 * suggested range, the fence) stand at their layout places for context only, so the ground is
 * judged with what sits on it and lights it.
 *
 * GroundHero: the hero view. GroundClose: one close view per frame (0 the left foreground
 * rocks and the pop-up spot, 1 the root mass, 2 the track toward the cauldron, 3 the fence).
 * GroundNoGrass: the hero view without the grass (frame 0) and with it (frame 1), an A/B of
 * what the grass adds. GroundDolly: the hero view trucking 0.3 to the right over 24 frames (a
 * check for crawl and shimmer between neighbouring frames). The context pumpkin's own V1 light
 * (range 6) is off; a stand-in candle light at range 2.5, decay 2 lights the ground around it.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Composition } from 'remotion';
import { CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { FPS } from '../cues.ts';
import { CamPath } from '../film/campath.ts';
import { storybookMaterial } from '../look/materials.ts';
import { Dressing } from '../world/Dressing.tsx';
import { FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, LAND, onGround, STONES } from '../world/layout.ts';
import { Grass } from '../world/Grass.tsx';
import { Trees } from '../world/Trees.tsx';
import { Pumpkin } from '../world/Pumpkin.tsx';
import { Terrain } from '../world/Terrain.tsx';
import { HERO, HERO_PATH, LookStage } from './LookStage.tsx';

function stoneShape(kind: string): Shape {
  const s = new Shape();
  if (kind === 'cross') {
    s.moveTo(-0.12, 0).lineTo(0.12, 0).lineTo(0.12, 0.62).lineTo(0.34, 0.62).lineTo(0.34, 0.8).lineTo(0.12, 0.8).lineTo(0.12, 1).lineTo(-0.12, 1).lineTo(-0.12, 0.8).lineTo(-0.34, 0.8).lineTo(-0.34, 0.62).lineTo(-0.12, 0.62).closePath();
  } else if (kind === 'obelisk') {
    s.moveTo(-0.18, 0).lineTo(0.18, 0).lineTo(0.13, 0.85).lineTo(0, 1).lineTo(-0.13, 0.85).closePath();
  } else {
    s.moveTo(-0.32, 0).lineTo(0.32, 0).lineTo(0.32, 0.68).absarc(0, 0.68, 0.32, 0, Math.PI, false).closePath();
  }
  return s;
}

/** Greybox neighbours (context only). */
function Context({ f }: { f: number }) {
  const { stones, bar, stoneMat, ironMat } = useMemo(() => {
    const stones: Record<string, ExtrudeGeometry> = {};
    for (const k of ['round', 'cross', 'obelisk', 'gothic', 'slab', 'broken']) stones[k] = new ExtrudeGeometry(stoneShape(k), { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 16 }).translate(0, 0, -0.06);
    const bar = new CylinderGeometry(0.012, 0.014, 1, 6).translate(0, 0.5, 0);
    return {
      stones,
      bar,
      stoneMat: storybookMaterial({ kind: 'stone', color: '#6d7a80', color2: '#3f5a45', breakup: 0.35, scale: 0.12, bump: 1.4, topCoat: 0.7, rim: 1.2 }),
      ironMat: storybookMaterial({ kind: 'iron', color: '#15181b', metalness: 0.5, roughness: 0.55, rim: 1.6, breakup: 0.1, scale: 0.05 }),
    };
  }, []);
  useLayoutEffect(
    () => () => {
      Object.values(stones).forEach((g) => g.dispose());
      bar.dispose();
      stoneMat.dispose();
      ironMat.dispose();
    },
    [stones, bar, stoneMat, ironMat],
  );
  const candle = onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.5);
  const posts: [number, number, number, number][] = [];
  for (const line of [FENCE_LINE, FENCE_LINE_RIGHT])
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1];
      const [bx, bz] = line[i];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.11);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        posts.push([ax + (bx - ax) * t, az + (bz - az) * t, 0.75 + 0.12 * Math.sin(k * 1.7 + i), Math.sin(k * 2.3 + i * 5) * 0.06]);
      }
    }
  return (
    <>
      {STONES.map((s, i) => (
        <mesh key={i} geometry={stones[s.kind]} material={stoneMat} position={onGround(s.x, s.z, -0.04)} rotation={[0, s.yaw, s.lean]} scale={s.h} castShadow receiveShadow />
      ))}
      <mesh geometry={stones.round} material={stoneMat} position={onGround(LAND.ripStone.x, LAND.ripStone.z, -0.04)} rotation={[0, LAND.ripStone.yaw ?? 0, -0.08]} scale={0.85} castShadow receiveShadow />
      <mesh geometry={stones.cross} material={stoneMat} position={onGround(LAND.bigCross.x, LAND.bigCross.z, -0.06)} rotation={[0.05, 0.35, -0.2]} scale={2.4} castShadow receiveShadow />
      {posts.map(([x, z, h, lean], i) => (
        <mesh key={`p${i}`} geometry={bar} material={ironMat} position={onGround(x, z, -0.02)} scale={[1, h, 1]} rotation-z={lean} castShadow />
      ))}
      <Trees f={f} />
      <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.5)} scale={0.62} lit={1} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} light={false} />
      {/* the candle's light, at the range suggested to the pumpkin family (2.5, decay 2) */}
      <pointLight color="#ff9a3c" intensity={2.5} distance={2.5} decay={2} position={[candle[0] + 0.1, candle[1] + 0.5, candle[2] + 0.19]} />
    </>
  );
}

const F = FLOOR;
/** Close views, one per frame. */
export const GROUND_CLOSE = new CamPath([
  { f: 0, pos: [-0.2, F + 0.95, 5.3], look: [-1.0, F + 0.25, 2.6], fov: 42, focus: 2.6, hold: true },
  { f: 1, pos: [1.0, F + 0.85, 6.2], look: [2.5, F + 0.45, 4.0], fov: 40, focus: 2.4, hold: true },
  { f: 2, pos: [0.4, F + 0.8, 4.6], look: [1.9, F + 0.1, 1.6], fov: 40, focus: 3.0, hold: true },
  { f: 3, pos: [-0.6, F + 1.0, 4.2], look: [-0.3, F + 0.55, 1.0], fov: 40, focus: 3.0, hold: true },
]);

/** The hero view trucking 0.3 to the right over 24 frames (crawl and shimmer check). */
export const GROUND_DOLLY = new CamPath([
  { f: 0, ...HERO },
  { f: 23, ...HERO, pos: [HERO.pos[0] + 0.3, HERO.pos[1], HERO.pos[2] - 0.1] },
]);

function GroundDolly() {
  return (
    <LookStage path={GROUND_DOLLY}>
      {(f) => (
        <>
          <Context f={f} />
          <Dressing f={f} />
        </>
      )}
    </LookStage>
  );
}

function GroundHero() {
  return (
    <LookStage path={HERO_PATH}>
      {(f) => (
        <>
          <Context f={f} />
          <Dressing f={f} />
        </>
      )}
    </LookStage>
  );
}

function GroundClose() {
  return (
    <LookStage path={GROUND_CLOSE}>
      {(f) => (
        <>
          <Context f={f} />
          <Dressing f={f} />
        </>
      )}
    </LookStage>
  );
}

/** Debug: the hero view without the grass (frame 0) and with it (frame 1), the same terrain. */
function GroundNoGrass() {
  return (
    <LookStage path={HERO_PATH} bare>
      {(f) => (
        <>
          <Terrain />
          {f > 0 && <Grass />}
          <Context f={f} />
          <Dressing f={f} />
        </>
      )}
    </LookStage>
  );
}

export function GroundRoot() {
  return (
    <>
      <Composition id="GroundHero" component={GroundHero} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="GroundClose" component={GroundClose} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="GroundNoGrass" component={GroundNoGrass} width={1920} height={1080} fps={FPS} durationInFrames={2} />
      <Composition id="GroundDolly" component={GroundDolly} width={1920} height={1080} fps={FPS} durationInFrames={24} />
    </>
  );
}
