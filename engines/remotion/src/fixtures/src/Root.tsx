/**
 * Fixture compositions:
 *  - Main: DOM halves in frame-derived colours (values and orientation);
 *  - Gl: a Stage3D whose clear colour comes from the frame, rendered through a PostChain with no
 *    effects and identity tone mapping: every chunk's first frame must show its colour, not black;
 *  - Anim: what can make a frame depend on where its page started: an animated InstancedMesh,
 *    room light (PMREM at mount), shadows, and a PostChain with mipmap bloom (HDR emissive);
 *  - WrongFps: 12 fps where video.json says 10 (refused);
 *  - Clear: a transparent frame (the mezzanine has no alpha: refused).
 */
import { PostChain, Stage3D, useRoomEnvironment } from '@aiv/remotion-kit';
import { BloomEffect, ToneMappingMode } from 'postprocessing';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import { BoxGeometry, NoToneMapping, Object3D, type InstancedMesh } from 'three';
import { bottomColor, css, FIXTURE_FPS, FIXTURE_FRAMES, glColor, H, hex, topColor, W } from './fixtures.ts';

function Halves() {
  const i = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H / 2, background: css(topColor(i)) }} />
      <div style={{ position: 'absolute', left: 0, top: H / 2, width: W, height: H / 2, background: css(bottomColor(i)) }} />
    </AbsoluteFill>
  );
}

const noEffects = () => [];

function Gl() {
  const i = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Stage3D shadows={false} antialias={false} toneMapping={NoToneMapping}>
        <color attach="background" args={[hex(glColor(i))]} />
        <PostChain effects={noEffects} multisampling={0} toneMapping={ToneMappingMode.LINEAR} />
      </Stage3D>
    </AbsoluteFill>
  );
}

const BOXES = 24;
const bloom = () => [new BloomEffect({ mipmapBlur: true, levels: 3, luminanceThreshold: 0.8, intensity: 1.4 })];

function Boxes({ i }: { i: number }) {
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new BoxGeometry(0.35, 0.35, 0.35), []);
  useRoomEnvironment();
  useLayoutEffect(() => {
    const o = new Object3D();
    for (let k = 0; k < BOXES; k++) {
      const a = (k / BOXES) * Math.PI * 2 + i * 0.21;
      o.position.set(Math.cos(a) * 2.2, Math.sin(a * 2 + i * 0.1) * 0.9, Math.sin(a) * 1.4);
      o.rotation.set(i * 0.13, k * 0.7, 0);
      o.scale.setScalar(0.6 + 0.4 * Math.sin(i * 0.5 + k));
      o.updateMatrix();
      ref.current!.setMatrixAt(k, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [i]);
  return (
    <>
      <color attach="background" args={['#05070d']} />
      <directionalLight castShadow position={[3, 4, 5]} intensity={2} />
      <instancedMesh ref={ref} args={[geo, undefined, BOXES]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial color="#8899ff" emissive="#ff8040" emissiveIntensity={2.5} roughness={0.3} metalness={0.5} />
      </instancedMesh>
      <mesh position={[0, -1.3, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#202838" />
      </mesh>
    </>
  );
}

function Anim() {
  const i = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Stage3D antialias={false} camera={{ fov: 40, position: [0, 1, 6] }}>
        <Boxes i={i} />
        <PostChain effects={bloom} />
      </Stage3D>
    </AbsoluteFill>
  );
}

function Clear() {
  return <AbsoluteFill />;
}

export function FixtureRoot() {
  const common = { width: W, height: H, durationInFrames: FIXTURE_FRAMES } as const;
  return (
    <>
      <Composition id="Main" component={Halves} fps={FIXTURE_FPS} {...common} />
      <Composition id="Gl" component={Gl} fps={FIXTURE_FPS} {...common} />
      <Composition id="Anim" component={Anim} fps={FIXTURE_FPS} {...common} />
      <Composition id="WrongFps" component={Halves} fps={12} {...common} />
      <Composition id="Clear" component={Clear} fps={FIXTURE_FPS} {...common} />
    </>
  );
}
