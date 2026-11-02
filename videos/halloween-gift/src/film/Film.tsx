/**
 * The film: one Stage3D with the desk, the book and whatever set is on stage, the camera on its
 * keyed path, and a DOM layer for the words (captions, the email's face, the end card notice),
 * so type stays crisp and outside the grade. Every value is a function of the film frame.
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { PerspectiveCamera } from 'three';
import { useFilmFonts } from '../look/fonts.ts';
import { FilmPost } from '../look/Post.tsx';
import { Overlay } from '../overlay/Overlay.tsx';
import { Book } from '../world/Book.tsx';
import { Desk } from '../world/Desk.tsx';
import { Clawd, ClawdKey } from '../world/Clawd.tsx';
import { Sets } from '../world/Sets.tsx';
import { clawdAt } from './actors.ts';
import { shotPose } from './camera.ts';
import { onDesk, setsAt } from './timeline.ts';

export const NIGHT = '#0a1118';


function CameraRig({ f }: { f: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const p = shotPose(f);
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

export function Film() {
  const f = useCurrentFrame();
  const { fonts, ready } = useFilmFonts();
  const on = setsAt(f);
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Stage3D antialias={false} camera={{ fov: 30, near: 0.05, far: 80, position: [9, 7, 12] }}>
        <color attach="background" args={[NIGHT]} />
        {/* aerial perspective inside the book; the room around the desk stays clearer */}
        <fogExp2 attach="fog" args={["#163848", onDesk(f) ? 0.012 : 0.035]} />
        <CameraRig f={f} />
        <hemisphereLight args={['#6fa9c4', '#2a0f12', 0.55]} />
        <directionalLight
          castShadow
          position={[6, 14, -8]}
          intensity={2.2}
          color="#cfe6e8"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={11}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />
        {/* a soft cool fill from the front, so faces and paper read against the moonlit backdrop */}
        <directionalLight position={[-3, 5, 12]} intensity={0.75} color="#8fc3d4" />
        <Desk f={f} />
        <Book f={f} fonts={fonts} ready={ready}>
          <Sets f={f} on={on} fonts={fonts} ready={ready} />
        </Book>
        <Clawd pose={clawdAt(f)} f={f} />
        <ClawdKey pose={clawdAt(f)} />
        <FilmPost f={f} />
      </Stage3D>
      <Overlay f={f} fonts={fonts} />
    </AbsoluteFill>
  );
}
