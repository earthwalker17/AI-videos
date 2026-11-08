/**
 * The 3D layer: a faceted iridescent chrome crystal reflecting a procedural room, two glowing
 * rings, and a seeded ring of instanced bars that rise and fall like an equalizer, on a dark
 * floor that takes their shadows; the camera dollies in on an eased orbit; bloom and a vignette
 * run in the kit's synchronous post chain. Everything is posed from the frame index alone (JSX
 * props, or useLayoutEffect for the camera and the instance matrices: both land before the frame
 * is drawn).
 */
import { easings, lerp, progress, rand, randInt } from '@aiv/core';
import { PostChain, Stage3D, useRoomEnvironment } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { BloomEffect, VignetteEffect } from 'postprocessing';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { BoxGeometry, Color, IcosahedronGeometry, InstancedMesh, LinearSRGBColorSpace, Object3D, type Texture } from 'three';

export const BACKGROUND = '#070b16';
const SEED = 20261102;
const BARS = 168;
const PALETTE = ['#46e0ff', '#ff5aa8', '#9b87ff', '#ffc75a'];
// HDR colours (linear, above 1): only these reach the bloom threshold
const hdr = (hex: string, k: number) => new Color(hex).multiplyScalar(k);
const RING_A = hdr('#5ee7ff', 3.2);
const RING_B = hdr('#ff7ac0', 2.6);
const CAP = new Color().setRGB(2.6, 2.6, 2.6, LinearSRGBColorSpace);

// stable: the post chain is built once (a new factory per render would rebuild it every frame)
const effects = () => [new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1, luminanceSmoothing: 0.25, intensity: 1.15, radius: 0.7 }), new VignetteEffect({ offset: 0.3, darkness: 0.6 })];

export function Scene({ start }: { start: number }) {
  return (
    <Stage3D antialias={false} camera={{ fov: 30, near: 0.1, far: 80, position: [0, 3, 13] }}>
      <SceneContent start={start} />
      <PostChain effects={effects} />
    </Stage3D>
  );
}

function SceneContent({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // dim room light for the floor and bars; the crystal takes the same map at its own intensity
  const env = useRoomEnvironment({ intensity: 0.3 });
  const s = frame / fps;
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 15, 34]} />
      <CameraRig start={start} />
      <hemisphereLight args={['#9fb4ff', '#1a1020', 0.35]} />
      <directionalLight
        castShadow
        position={[4, 9, 5]}
        intensity={2.3}
        color="#fff1dc"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <pointLight position={[0, 1.6, 0]} color="#5ee7ff" intensity={18} distance={10} decay={2} />
      <Crystal s={s} env={env} />
      <Bars s={s} />
      {/* mostly diffuse, so the key light (and with it the bars' shadows) reads on it */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[30, 128]} />
        <meshStandardMaterial color="#131a2c" roughness={0.5} metalness={0.2} />
      </mesh>
    </>
  );
}

/** An eased orbit from wide to close, framing the subject right of the title. */
function CameraRig({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  useLayoutEffect(() => {
    const m = progress(frame, start, durationInFrames - 1, easings.inOutCubic);
    const angle = lerp(0.85, -0.3, m);
    const radius = lerp(16, 12, m);
    camera.position.set(Math.sin(angle) * radius, lerp(5.6, 3.6, m), Math.cos(angle) * radius);
    camera.lookAt(0, 1.2, 0);
    camera.setViewOffset(size.width, size.height, -Math.round(size.width * 0.12), 0, size.width, size.height);
    camera.updateMatrixWorld();
  }, [camera, size.width, size.height, frame, start, durationInFrames]);
  return null;
}

function Crystal({ s, env }: { s: number; env: Texture }) {
  const geometry = useMemo(() => new IcosahedronGeometry(1.15, 0), []);
  return (
    <group position={[0, 1.55 + 0.1 * Math.sin(s * 1.4), 0]}>
      <mesh geometry={geometry} castShadow rotation={[0.35 * Math.sin(s * 0.6), s * 0.5, 0.2]}>
        {/* envMap set explicitly: with only scene.environment, three ignores envMapIntensity */}
        <meshPhysicalMaterial
          color="#d4dcf5"
          metalness={1}
          roughness={0.06}
          envMap={env}
          envMapIntensity={1.35}
          iridescence={1}
          iridescenceIOR={1.4}
          iridescenceThicknessRange={[180, 620]}
          flatShading
        />
      </mesh>
      <mesh rotation={[Math.PI / 2 + 0.35, 0, s * 0.4]}>
        <torusGeometry args={[2.05, 0.018, 12, 256]} />
        <meshBasicMaterial color={RING_A} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2 - 0.5, 0.4, -s * 0.3]}>
        <torusGeometry args={[2.45, 0.012, 12, 256]} />
        <meshBasicMaterial color={RING_B} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A seeded ring of bars: every property is rand(SEED, k, property), heights a function of time. */
function Bars({ s }: { s: number }) {
  const bars = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const [barGeo, capGeo] = useMemo(() => [new BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0), new BoxGeometry(0.15, 0.05, 0.15)], []);
  // colours once per mount; instance k gets the same colour in every frame
  useLayoutEffect(() => {
    const c = new Color();
    for (let k = 0; k < BARS; k++) {
      c.set(PALETTE[randInt(SEED, k, 4, 0, PALETTE.length - 1)]);
      bars.current!.setColorAt(k, c);
      caps.current!.setColorAt(k, c);
    }
    bars.current!.instanceColor!.needsUpdate = true;
    caps.current!.instanceColor!.needsUpdate = true;
  }, []);
  useLayoutEffect(() => {
    const pose = new Object3D();
    for (let k = 0; k < BARS; k++) {
      const a = (Math.PI * 2 * (k + 0.6 * rand(SEED, k, 0))) / BARS;
      const r = 3.3 + 2.6 * rand(SEED, k, 1);
      const h = (0.15 + 1.05 * rand(SEED, k, 2) ** 2) * (0.55 + 0.45 * Math.sin(Math.PI * 2 * (s * 0.45 + rand(SEED, k, 3))));
      pose.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      pose.rotation.set(0, -a, 0);
      pose.scale.set(1, h, 1);
      pose.updateMatrix();
      bars.current!.setMatrixAt(k, pose.matrix);
      pose.position.y = h + 0.04;
      pose.scale.set(1, 1, 1);
      pose.updateMatrix();
      caps.current!.setMatrixAt(k, pose.matrix);
    }
    bars.current!.instanceMatrix.needsUpdate = true;
    caps.current!.instanceMatrix.needsUpdate = true;
  }, [s]);
  // frustumCulled off: three caches an InstancedMesh's bounding sphere from the first frame it
  // renders, so culling would make a frame depend on which frame a chunk started at
  return (
    <>
      <instancedMesh ref={bars} args={[barGeo, undefined, BARS]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.4} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[capGeo, undefined, BARS]} frustumCulled={false}>
        <meshBasicMaterial color={CAP} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
