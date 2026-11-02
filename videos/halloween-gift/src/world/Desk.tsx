/**
 * The desk the storybook lies on (the hook and the end): dark wood, moonlight through a gothic
 * window projected across it (a spot light with a window-shaped gobo), a small jack-o'-lantern
 * beside the book, a lightning flash on the first frames, and the cover's printed title.
 */
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, LinearSRGBColorSpace, Object3D, SRGBColorSpace } from 'three';
import { at } from '../cues.ts';
import { twos } from '../film/timeline.ts';
import { canvas, seq } from '../look/paper.ts';
import { Pumpkin } from './Pumpkin.tsx';

function woodArt() {
  const W = 1024;
  const H = 1024;
  const { c, g } = canvas(W, H);
  const r = seq(61, 'wood');
  g.fillStyle = '#2b1a14';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const y = r() * H;
    g.strokeStyle = `rgba(${r() < 0.5 ? '18,10,8' : '60,38,28'},${0.25 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 4);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A gothic window's light: two lancets and a round head, mullions dark (a gobo for the moon spot). */
function windowGobo() {
  const W = 512;
  const { c, g } = canvas(W, W);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, W);
  g.fillStyle = '#fff';
  const lancet = (x: number) => {
    g.beginPath();
    g.moveTo(x - 60, 440);
    g.lineTo(x - 60, 220);
    g.quadraticCurveTo(x - 60, 120, x, 90);
    g.quadraticCurveTo(x + 60, 120, x + 60, 220);
    g.lineTo(x + 60, 440);
    g.closePath();
    g.fill();
  };
  lancet(186);
  lancet(326);
  g.fillStyle = '#000';
  for (const x of [186, 326]) g.fillRect(x - 5, 90, 10, 360);
  g.fillRect(100, 300, 312, 10);
  const t = new CanvasTexture(c);
  t.colorSpace = LinearSRGBColorSpace;
  return t;
}

export function Desk({ f }: { f: number }) {
  const { wood, gobo, target } = useMemo(() => {
    const target = new Object3D();
    target.position.set(0.5, 0, 0.5);
    target.updateMatrixWorld();
    return { wood: woodArt(), gobo: windowGobo(), target };
  }, []);
  useLayoutEffect(() => () => (wood.dispose(), gobo.dispose()), [wood, gobo]);
  wood.repeat.set(3, 3);
  const t = twos(f);
  // lightning: two flashes on the first frames, then once more as the book slams (on twos)
  const flash = (from: number) => (t === from || t === from + 4 ? 1 : t === from + 2 ? 0.35 : 0);
  const lightning = Math.max(flash(4), t === at(35) + 2 ? 0.25 : 0);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial map={wood} roughness={0.7} color="#c8b4a4" />
      </mesh>
      <primitive object={target} />
      {/* moonlight through a gothic window, from the back left */}
      <spotLight position={[-9, 14, -10]} target={target} map={gobo} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} intensity={420} angle={0.32} penumbra={0.25} decay={2} distance={60} color="#a8d4dc" />
      {lightning > 0 && <directionalLight position={[-8, 12, -4]} intensity={16 * lightning} color="#dff4ff" />}
      {/* a small jack-o'-lantern beside the book */}
      <Pumpkin position={[7.2, 0, -3.4]} scale={1.2} lit={1} f={f} seed={12} rotation={-0.9} />
      <pointLight color="#ff9a3c" intensity={14} distance={12} decay={2} position={[6.7, 1.4, -2.6]} />
    </group>
  );
}
