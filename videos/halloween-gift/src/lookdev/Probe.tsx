/**
 * The de-risk probe (lookdev): the world's foundation in greybox — the portal sky on the cover,
 * the terrain with its path, tens of thousands of grass blades, generated trees, stand-in stones,
 * fence, gates, house and crag — under the night rig, fog and the post chain, seen from the hero
 * view (frames 0–11, a hold) and on a 48-frame graveyard truck alongside a hopping stand-in
 * (frames 12–59). It answers: what does it cost per frame at 1080p, is it chunk-start stable,
 * does the truck read smooth, and how does the hero view's value structure compare with the
 * reference. Rendered with `aiv still --entry src/lookdev/index.ts --composition Probe`.
 */
import { PostChain, Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { BloomEffect, DepthOfFieldEffect, ToneMappingMode, type Effect } from 'postprocessing';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Shape, type BufferGeometry, type Camera, type PerspectiveCamera } from 'three';
import { FPS } from '../cues.ts';
import { CamPath } from '../film/campath.ts';
import { hopAt, type Walk } from '../film/gait.ts';
import { buildTree } from '../kit/tree.ts';
import { storybookMaterial } from '../look/materials.ts';
import { Night } from '../look/Night.tsx';
import { NightPost, type NightPostOptions } from '../look/NightPost.tsx';
import { StorybookGrade } from '../look/Post.tsx';
import { useSkyPortal } from '../look/SkyPortal.tsx';
import { Grass } from '../world/Grass.tsx';
import { Pumpkin } from '../world/Pumpkin.tsx';
import { BOOK, FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, groundHeight, LAND, onGround, PATH, STONES, STOPS } from '../world/layout.ts';
import { Terrain } from '../world/Terrain.tsx';

export const PROBE_FRAMES = 60;

const HERO = { pos: [0.3, 3.45, 7.6] as const, look: [1.0, 2.4, -4.0] as const, fov: 44, focus: 7.0 };

const camPath = new CamPath([
  { f: 0, ...HERO, hold: true },
  { f: 11, ...HERO, hold: true },
  { f: 12, pos: [-0.6, FLOOR + 0.75, 5.6], look: [-0.3, FLOOR + 0.55, 2.4], fov: 34, focus: 3.1 },
  { f: 59, pos: [1.9, FLOOR + 0.8, 4.7], look: [2.1, FLOOR + 0.55, 1.5], fov: 34, focus: 3.1 },
]);

const truckWalk: Walk = { from: 12, to: 60, s0: STOPS.valleyEnd, s1: STOPS.shoo };

function CameraRig({ f }: { f: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const p = camPath.at(f);
    camera.position.set(...p.pos);
    camera.fov = p.fov;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
    camera.lookAt(...p.look);
    camera.updateMatrixWorld();
  }, [camera, f]);
  return null;
}

function Sky() {
  const mat = useSkyPortal();
  // the inside of the standing cover, the backdrop
  return (
    <mesh material={mat} position={[0, FLOOR + BOOK.d / 2, -BOOK.d / 2 + 0.03]}>
      <planeGeometry args={[BOOK.w, BOOK.d]} />
    </mesh>
  );
}

function Trees() {
  const { geos, mat } = useMemo(() => {
    const mat = storybookMaterial({ kind: 'bark', color: '#2b2622', color2: '#1a1714', vertexColors: true, breakup: 0.3, scale: 0.25, bump: 1.2, rim: 1.3 });
    const ghostTree = buildTree({
      seed: 3,
      trunkLength: 2.4,
      trunkRadius: 0.2,
      lean: [-0.18, -0.06],
      hero: [{ at: 0.72, dir: [-1, 0.35, -0.25], length: 2.6, radius: 0.55, curl: 0.9, droop: 0.06, children: 6 }],
    });
    const oldTree = buildTree({ seed: 11, trunkLength: 2.8, trunkRadius: 0.17, lean: [0.12, 0.05] });
    const back = [21, 22, 23, 24].map((seed) => buildTree({ seed, trunkLength: 2.2 + (seed % 3) * 0.4, trunkRadius: 0.12, levels: 4 }));
    return { geos: { ghostTree, oldTree, back }, mat };
  }, []);
  useLayoutEffect(() => () => (Object.values(geos).flat().forEach((g) => (g as BufferGeometry).dispose()), mat.dispose()), [geos, mat]);
  const backSpots: [number, number, number][] = [
    [-6.2, -2.6, 0.3],
    [-4.8, -3.6, 1.2],
    [5.4, -1.6, 2.1],
    [6.4, -3.2, 0.7],
  ];
  return (
    <>
      <mesh geometry={geos.ghostTree} material={mat} position={onGround(LAND.ghostTree.x, LAND.ghostTree.z, -0.05)} castShadow />
      <mesh geometry={geos.oldTree} material={mat} position={onGround(LAND.oldTree.x, LAND.oldTree.z, -0.05)} rotation-y={0.8} castShadow />
      {geos.back.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} position={onGround(backSpots[i][0], backSpots[i][1], -0.05)} rotation-y={backSpots[i][2]} castShadow />
      ))}
    </>
  );
}

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

function Stones() {
  const { geos, mat } = useMemo(() => {
    const mat = storybookMaterial({ kind: 'stone', color: '#6d7a80', color2: '#3f5a45', breakup: 0.35, scale: 0.12, bump: 1.4, topCoat: 0.7, rim: 1.2 });
    const geos: Record<string, ExtrudeGeometry> = {};
    for (const k of ['round', 'cross', 'obelisk', 'gothic', 'slab', 'broken']) geos[k] = new ExtrudeGeometry(stoneShape(k), { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 16 }).translate(0, 0, -0.06);
    return { geos, mat };
  }, []);
  useLayoutEffect(() => () => (Object.values(geos).forEach((g) => g.dispose()), mat.dispose()), [geos, mat]);
  return (
    <>
      {STONES.map((s, i) => (
        <mesh key={i} geometry={geos[s.kind]} material={mat} position={onGround(s.x, s.z, -0.04)} rotation={[0, s.yaw, s.lean]} scale={s.h} castShadow receiveShadow />
      ))}
      <mesh geometry={geos.round} material={mat} position={onGround(LAND.ripStone.x, LAND.ripStone.z, -0.04)} rotation={[0, LAND.ripStone.yaw ?? 0, -0.08]} scale={0.85} castShadow receiveShadow />
      <mesh geometry={geos.cross} material={mat} position={onGround(LAND.bigCross.x, LAND.bigCross.z, -0.06)} rotation={[0.05, 0.35, -0.2]} scale={2.4} castShadow receiveShadow />
    </>
  );
}

function Fence() {
  const { bar, mat } = useMemo(() => ({ bar: new CylinderGeometry(0.012, 0.014, 1, 6).translate(0, 0.5, 0), mat: storybookMaterial({ kind: 'iron', color: '#15181b', metalness: 0.5, roughness: 0.55, rim: 1.6, breakup: 0.1, scale: 0.05 }) }), []);
  useLayoutEffect(() => () => (bar.dispose(), mat.dispose()), [bar, mat]);
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
      {posts.map(([x, z, h, lean], i) => (
        <mesh key={i} geometry={bar} material={mat} position={onGround(x, z, -0.02)} scale={[1, h, 1]} rotation-z={lean} castShadow />
      ))}
    </>
  );
}

function HouseAndCrag({ f }: { f: number }) {
  const { mats, roof, crag } = useMemo(
    () => ({
      mats: {
        wall: storybookMaterial({ kind: 'stone', color: '#4a4f57', color2: '#2f3a3a', breakup: 0.35, scale: 0.2, bump: 0.8 }),
        roof: storybookMaterial({ kind: 'shingle', color: '#2a2b33', color2: '#1a1b22', breakup: 0.3, scale: 0.25, bump: 1.2, rim: 1.4 }),
        rock: storybookMaterial({ kind: 'stone', color: '#3d4a52', color2: '#2a3a3a', breakup: 0.4, scale: 0.5, bump: 1.0, rim: 1.2 }),
        glow: storybookMaterial({ color: '#000000', emissive: '#5fe6ff', emissiveIntensity: 3.0, fog: 0.4, rim: 0 }),
      },
      roof: new ConeGeometry(1.25, 1.5, 4, 1).rotateY(Math.PI / 4),
      crag: new ConeGeometry(1.5, 3.2, 9, 6),
    }),
    [],
  );
  useLayoutEffect(() => () => (Object.values(mats).forEach((m) => m.dispose()), roof.dispose(), crag.dispose()), [mats, roof, crag]);
  const h = LAND.house;
  const base = onGround(h.x, h.z, 0);
  // the crag and the castle ride a parallax offset: they move as if far beyond the page
  const cam = camPath.at(f).pos;
  const k = 0.75;
  const ref = HERO.pos;
  const par: [number, number, number] = [(cam[0] - ref[0]) * k, (cam[1] - ref[1]) * k * 0.6, 0];
  const c = onGround(LAND.crag.x, LAND.crag.z, -0.3);
  return (
    <>
      <group position={base} rotation-y={h.yaw ?? 0}>
        <mesh material={mats.wall} position-y={0.75} castShadow receiveShadow>
          <boxGeometry args={[1.6, 1.5, 1.2]} />
        </mesh>
        <mesh geometry={roof} material={mats.roof} position-y={2.2} scale={[1, 1, 0.8]} castShadow />
        <mesh material={mats.glow} position={[0.45, 0.85, 0.61]}>
          <planeGeometry args={[0.22, 0.42]} />
        </mesh>
      </group>
      <group position={[c[0] + par[0], c[1] + par[1], c[2]]}>
        <mesh geometry={crag} material={mats.rock} position-y={1.4} castShadow receiveShadow />
        {[
          [0, 3.1, 0, 0.22, 1.6],
          [0.35, 2.9, 0.1, 0.16, 1.3],
          [-0.3, 2.85, -0.1, 0.18, 1.1],
          [0.15, 3.0, -0.3, 0.12, 1.9],
        ].map(([x, y, z, r, hh], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh material={mats.wall} position-y={hh / 2}>
              <cylinderGeometry args={[r, r * 1.05, hh, 10]} />
            </mesh>
            <mesh material={mats.roof} position-y={hh + 0.35}>
              <coneGeometry args={[r * 1.35, 0.8, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

function Marker({ f }: { f: number }) {
  const geo = useMemo(() => new BoxGeometry(0.65, 0.4, 0.3), []);
  const mat = useMemo(() => storybookMaterial({ color: '#D77757', breakup: 0.05, rim: 0.6 }), []);
  useLayoutEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const st = hopAt(truckWalk, f);
  const p = PATH.pointAt(st.s);
  const t = PATH.tangentAt(st.s);
  const y = FLOOR + groundHeight(p[0], p[1]);
  return <mesh geometry={geo} material={mat} position={[p[0], y + 0.3 + st.lift, p[1]]} rotation-y={Math.atan2(t[0], t[1]) + Math.PI / 2} scale={[st.sxz, st.sy, st.sxz]} castShadow />;
}

/** `post`: the V2 chain (look/NightPost.tsx) with these options; absent, the first lookdev chain. */
export function Probe({ post }: { post?: NightPostOptions }) {
  const f = useCurrentFrame();
  const effects = useCallback((camera: Camera): Effect[] => {
    const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.75, luminanceSmoothing: 0.25, intensity: 0.9, radius: 0.8 });
    const dof = new DepthOfFieldEffect(camera, { focusDistance: 6, focusRange: 3, bokehScale: 2.0, resolutionScale: 0.5 });
    probeDof.current = dof;
    const grade = new StorybookGrade();
    // the reference's shadows: plum-maroon near the lens, steel blue in the depth
    (grade.uniforms.get('uNear')!.value as Color).set('#4a1a2e');
    (grade.uniforms.get('uFar')!.value as Color).set('#2a5c80');
    return [bloom, dof, grade];
  }, []);
  useLayoutEffect(() => {
    const p = camPath.at(f);
    const d = probeDof.current;
    if (d) {
      d.cocMaterial.focusDistance = p.focus;
      d.cocMaterial.focusRange = Math.max(1.2, p.focus * 0.55);
    }
  });
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      <Stage3D antialias={false} camera={{ fov: 40, near: 0.05, far: 80, position: [0, 3, 8] }}>
        <color attach="background" args={['#0a1118']} />
        <CameraRig f={f} />
        <Night f={f} fps={FPS} />
        <Sky />
        <Terrain />
        <Grass />
        <Trees />
        <Stones />
        <Fence />
        <HouseAndCrag f={f} />
        <Marker f={f} />
        <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55)} scale={0.62} lit={1} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} />
        {post ? <NightPost f={f} focus={camPath.at(f).focus} {...post} /> : <PostChain effects={effects} toneMapping={ToneMappingMode.NEUTRAL} />}
      </Stage3D>
    </AbsoluteFill>
  );
}

const probeDof: { current: DepthOfFieldEffect | null } = { current: null };
