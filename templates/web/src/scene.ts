/**
 * The 3D layer: a lit hero object, a seeded scatter of small shapes and an eased camera move,
 * rendered with a three.js WebGLRenderer into an offscreen canvas. render(i) poses everything
 * from the frame index alone; nothing reads a clock and nothing carries over between frames.
 */
import { easings, lerp, progress, rand, randInt } from '@aiv/core';
import {
  ACESFilmicToneMapping,
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  TorusKnotGeometry,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SEED = 20261101;
const SCATTER = 160;
const PALETTE = ['#3fb8af', '#ff6f59', '#f4e9cd', '#5a7bd8', '#ffb547'];

export interface SceneLayer {
  canvas: HTMLCanvasElement;
  render(i: number): void;
}

/** Frames [start, end) of the camera move; `fps` turns frames into seconds for spin rates. */
export function createScene(width: number, height: number, fps: number, start: number, end: number): SceneLayer {
  const canvas = document.createElement('canvas');
  // preserveDrawingBuffer: the 2D compositor reads this canvas after render() returns
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color('#1b2436');
  scene.fog = new Fog('#1b2436', 14, 32);
  // image-based light for the metal; prefiltered once at setup, so every frame sees the same maps
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.add(new HemisphereLight('#a9bdff', '#3a2a20', 0.6));
  const key = new DirectionalLight('#fff1dc', 2.6);
  key.position.set(5, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -8;
  key.shadow.camera.right = key.shadow.camera.top = 8;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new PointLight('#5ad1ff', 40, 20, 2);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);

  const ground = new Mesh(new CircleGeometry(16, 96), new MeshStandardMaterial({ color: '#2b3448', roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const hero = new Mesh(new TorusKnotGeometry(1, 0.32, 320, 48), new MeshStandardMaterial({ color: '#e8a33d', metalness: 0.55, roughness: 0.28 }));
  hero.castShadow = true;
  scene.add(hero);

  // the scatter: every property is rand(SEED, k, property), so instance k is the same in every frame
  const bits = new InstancedMesh(new IcosahedronGeometry(0.13, 0), new MeshStandardMaterial({ roughness: 0.5, flatShading: true }), SCATTER);
  bits.castShadow = true;
  // three caches an InstancedMesh's bounding sphere from the instances of the FIRST frame it
  // renders; culling with it would make a frame depend on which frame came first
  bits.frustumCulled = false;
  const color = new Color();
  for (let k = 0; k < SCATTER; k++) bits.setColorAt(k, color.set(PALETTE[randInt(SEED, k, 0, 0, PALETTE.length - 1)]));
  scene.add(bits);
  const pose = new Object3D();

  const camera = new PerspectiveCamera(35, width / height, 0.1, 60);
  // frame the subject at 63 % of the width, clear of the title on the left
  camera.setViewOffset(width, height, -Math.round(width * 0.13), 0, width, height);

  return {
    canvas,
    render(i) {
      const s = i / fps;
      const move = progress(i, start, end - 1, easings.inOutCubic);
      const angle = lerp(-0.8, 0.5, move);
      const radius = lerp(12.5, 9.2, move);
      camera.position.set(Math.sin(angle) * radius, lerp(3.9, 2.4, move), Math.cos(angle) * radius);
      camera.lookAt(0, 1.25, 0);

      hero.position.y = 1.35 + 0.12 * Math.sin(s * 1.6);
      hero.rotation.set(0.35 * Math.sin(s * 0.7), s * 0.9, 0.2);

      for (let k = 0; k < SCATTER; k++) {
        const r = 2.4 + 4.2 * rand(SEED, k, 1);
        const a = Math.PI * 2 * rand(SEED, k, 2) + s * (0.05 + 0.12 * rand(SEED, k, 3));
        const y = 0.2 + 2.8 * rand(SEED, k, 4) ** 1.5 + 0.1 * Math.sin(Math.PI * 2 * (s * 0.4 + rand(SEED, k, 5)));
        pose.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        const spin = s * (0.6 + 1.4 * rand(SEED, k, 6));
        pose.rotation.set(Math.PI * 2 * rand(SEED, k, 7) + spin, Math.PI * 2 * rand(SEED, k, 8) + spin * 0.7, 0);
        pose.scale.setScalar(0.55 + 0.8 * rand(SEED, k, 9));
        pose.updateMatrix();
        bits.setMatrixAt(k, pose.matrix);
      }
      bits.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
    },
  };
}
