/**
 * The door spread (bars 17-34): the last house's front with its door cut through, the room
 * behind, a door flap that lifts on its top hinge, the upright 福 on the door, the spring
 * couplets either side and the 横批 above, two unlit red lanterns, the neighbour in a sheet,
 * the pop-up letter between them, and a far window down the lane for the last laugh.
 */
import { clamp, progress } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, LatheGeometry, Object3D, PlaneGeometry, SRGBColorSpace, Vector2 } from 'three';
import { at } from '../cues.ts';
import { clawdAt, pailWorld, userAt } from '../film/actors.ts';
import { FLOOR, rise, twos } from '../film/timeline.ts';
import { drawDoor, drawFacade, drawRoom } from '../look/house.ts';
import { canvas, cardMaterial } from '../look/paper.ts';
import { Ground } from './Ground.tsx';
import { Letter, type LetterFonts } from './Letter.tsx';
import { Sheet } from './Sheet.tsx';

/** the door opening, world units: centre x, width, height (the house front stands at z = -1.5) */
export const DOOR = { x: -0.25, z: -1.5, w: 1.3, h: 2.35 };
const FRONT = { w: 8.8, h: 5.4 };
/** the letter's base centre: x, height above the floor of its bottom edge, z */
export const LETTER_AT: [number, number, number] = [-0.05, 0.06, -0.15];

function useArt(w: number, h: number, ppu: number, draw: (g: CanvasRenderingContext2D, W: number, H: number, e: CanvasRenderingContext2D) => void, opts: Parameters<typeof cardMaterial>[1] = {}, emissiveFromE = false) {
  const res = useMemo(() => {
    const W = Math.round(w * ppu);
    const H = Math.round(h * ppu);
    const a = canvas(W, H);
    const e = canvas(W, H);
    e.g.fillStyle = '#000';
    e.g.fillRect(0, 0, W, H);
    draw(a.g, W, H, e.g);
    const material = cardMaterial(a.c, emissiveFromE ? { ...opts, emissive: e.c } : opts);
    const geometry = new PlaneGeometry(w, h).translate(0, h / 2, 0);
    return { material, geometry };
    // drawn once per mount
  }, [w, h, ppu]);
  useLayoutEffect(() => () => (res.geometry.dispose(), res.material.map?.dispose(), res.material.dispose()), [res]);
  return res;
}

function Lantern({ position }: { position: [number, number, number] }) {
  const geo = useMemo(() => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new Vector2(0.03 + 0.2 * Math.sin(t * Math.PI), -0.17 + 0.34 * t));
    }
    return new LatheGeometry(pts, 20);
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#8a2228" roughness={0.75} emissive="#3a0a0c" emissiveIntensity={0.25} />
      </mesh>
      {[0.18, -0.18].map((y) => (
        <mesh key={y} position-y={y}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
          <meshStandardMaterial color="#b08a3a" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <mesh position-y={-0.33}>
        <cylinderGeometry args={[0.012, 0.03, 0.22, 6]} />
        <meshStandardMaterial color="#c9a24a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** A 福 diamond and couplet strips: red paper with black brush characters (drawn once the font is ready). */
function useRedPaper(kind: 'fu' | 'upper' | 'lower' | 'horizontal', cjk: string, ready: boolean) {
  const res = useMemo(() => {
    const vertical = kind === 'upper' || kind === 'lower';
    const W = kind === 'fu' ? 512 : vertical ? 220 : 880;
    const H = kind === 'fu' ? 512 : vertical ? 1540 : 220;
    const { c, g } = canvas(W, H);
    g.fillStyle = '#B5332B';
    g.fillRect(0, 0, W, H);
    // gold flecks
    g.fillStyle = 'rgba(214,170,80,0.5)';
    for (let i = 0; i < 40; i++) g.fillRect(((i * 97) % W) + 3, ((i * 211) % H) + 3, 4, 4);
    g.fillStyle = '#141010';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const text = kind === 'fu' ? '福' : kind === 'upper' ? '代码千行一次过' : kind === 'lower' ? '账号百年永不封' : '一路绿灯';
    if (kind === 'fu') {
      // the square hangs as a diamond (turned 45°); the character stays upright
      g.save();
      g.translate(W / 2, H / 2);
      g.rotate(-Math.PI / 4);
      g.font = `900 ${Math.round(W * 0.56)}px ${cjk}`;
      g.fillText(text, 0, H * 0.03);
      g.restore();
    } else if (vertical) {
      const n = [...text].length;
      g.font = `700 ${Math.round(W * 0.66)}px ${cjk}`;
      [...text].forEach((ch, i) => g.fillText(ch, W / 2, H * ((i + 0.55) / n)));
    } else {
      g.font = `700 ${Math.round(H * 0.62)}px ${cjk}`;
      // a modern 横批 reads left to right
      [...text].forEach((ch, i) => g.fillText(ch, W * ((i + 0.5) / 4), H * 0.54));
    }
    const map = new CanvasTexture(c);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    return map;
  }, [kind, cjk, ready]);
  useLayoutEffect(() => () => res.dispose(), [res]);
  return res;
}

export function DoorSet({ f, fonts, ready }: { f: number; fonts: LetterFonts & { cjk: string }; ready: boolean }) {
  const t = twos(f);
  const user = userAt(f);
  const porchTarget = useMemo(() => {
    const o = new Object3D();
    o.position.set(DOOR.x, FLOOR + 1.2, DOOR.z);
    o.updateMatrixWorld();
    return o;
  }, []);
  const front = useArt(FRONT.w, FRONT.h, 150, (g, W, H, e) => drawFacade(g, e, W, H, 31, { door: { cx: 0.5, w: DOOR.w / FRONT.w, h: DOOR.h / FRONT.h } }), { emissiveIntensity: 1.6 }, true);
  const door = useArt(DOOR.w, DOOR.h, 300, (g, W, H) => drawDoor(g, W, H, 33));
  const room = useArt(3.2, 2.6, 160, (g, W, H, e) => drawRoom(g, e, W, H), { emissiveIntensity: 1.4 }, true);
  const fu = useRedPaper('fu', fonts.cjk, ready);
  const upper = useRedPaper('upper', fonts.cjk, ready);
  const lower = useRedPaper('lower', fonts.cjk, ready);
  const horizontal = useRedPaper('horizontal', fonts.cjk, ready);
  // the door flap lifts on twos when the neighbour answers, and drops when they close it
  const flap = progress(t, at(20), at(20) + 10, 'outCubic') * (1 - progress(t, at(33), at(33) + 8, 'inCubic'));
  const letterRise = rise(f, at(23), 14) * (1 - progress(t, at(29, 3), at(30), 'inCubic'));
  const flip = progress(t, at(25, 2), at(25, 2) + 18, 'linear');
  const farCold = t >= at(33, 3);
  return (
    <group>
      <Ground seed={41} path={[[0.46, 1.0], [0.47, 0.6], [0.47, 0.35]]} earth="#1a1c1c" />
      {/* the house front (door opening cut through) */}
      <mesh geometry={front.geometry} material={front.material} position={[DOOR.x, FLOOR, DOOR.z]} castShadow receiveShadow />
      {/* the room behind the opening */}
      <mesh geometry={room.geometry} material={room.material} position={[DOOR.x, FLOOR, DOOR.z - 1.0]} />
      <pointLight color="#57CEE2" intensity={2.2 * (1 - 0.7 * clamp(user.ghosted))} distance={4} decay={2} position={[DOOR.x + 0.3, FLOOR + 1.3, DOOR.z - 0.6]} />
      {/* the door flap on its top hinge, the upright 福 on it */}
      <group position={[DOOR.x, FLOOR + DOOR.h, DOOR.z + 0.02]} rotation-x={flap * 1.5}>
        <mesh geometry={door.geometry} material={door.material} position-y={-DOOR.h} castShadow />
        <mesh position={[0, -DOOR.h * 0.42, 0.012]} rotation-z={Math.PI / 4}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshStandardMaterial map={fu} roughness={0.85} />
        </mesh>
      </group>
      {/* couplets: 上联 on the right, 下联 on the left (as one faces the door), 横批 above */}
      <mesh position={[DOOR.x + DOOR.w / 2 + 0.22, FLOOR + 1.2, DOOR.z + 0.02]}>
        <planeGeometry args={[0.26, 1.85]} />
        <meshStandardMaterial map={upper} roughness={0.85} />
      </mesh>
      <mesh position={[DOOR.x - DOOR.w / 2 - 0.22, FLOOR + 1.2, DOOR.z + 0.02]}>
        <planeGeometry args={[0.26, 1.85]} />
        <meshStandardMaterial map={lower} roughness={0.85} />
      </mesh>
      <mesh position={[DOOR.x, FLOOR + DOOR.h + 0.24, DOOR.z + 0.02]}>
        <planeGeometry args={[1.05, 0.26]} />
        <meshStandardMaterial map={horizontal} roughness={0.85} />
      </mesh>
      {/* moonlight on the porch: a cool spot from the upper right */}
      <primitive object={porchTarget} />
      <spotLight position={[3.5, FLOOR + 5.5, 2.5]} target={porchTarget} intensity={14} angle={0.55} penumbra={0.9} decay={1.4} distance={14} color="#a9d6df" />
      <Lantern position={[DOOR.x - 1.15, FLOOR + 2.55, DOOR.z + 0.45]} />
      <Lantern position={[DOOR.x + 1.15, FLOOR + 2.55, DOOR.z + 0.45]} />
      {/* the neighbour */}
      {user.visible && <Sheet pose={user} f={f} />}
      {/* grace: the ghosted neighbour still drops a candy into Clawd's pail (bar 31), and it relights */}
      {t >= at(31) - 10 && t < at(31) && (() => {
        const k = (t - (at(31) - 10)) / 10;
        const from: [number, number, number] = [user.pos[0], user.pos[1] + 0.95, user.pos[2] + 0.5];
        const to = pailWorld(clawdAt(at(31)));
        const x = from[0] + (to[0] - from[0]) * k;
        const z = from[2] + (to[2] - from[2]) * k;
        const y = from[1] + (to[1] - from[1]) * k + 0.6 * Math.sin(k * Math.PI);
        return (
          <mesh position={[x, y, z]} scale={[0.09, 0.05, 0.05]} rotation-z={k * 6}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#e9862e" roughness={0.3} emissive="#7a3a10" emissiveIntensity={0.4} />
          </mesh>
        );
      })()}
      {/* the letter rises from a pull-tab in the floor between them */}
      <group position={[LETTER_AT[0], FLOOR, LETTER_AT[2]]}>
        <Letter rise={letterRise} flip={flip} fonts={fonts} ready={ready} />
      </group>
      {/* a far house down the lane: its window flips cold with a faint ding-ding */}
      <mesh position={[4.4, FLOOR + 1.1, -3.4]}>
        <planeGeometry args={[0.32, 0.42]} />
        <meshBasicMaterial color={farCold ? [0.5, 1.7, 1.9] : [2.0, 1.1, 0.35]} toneMapped={false} />
      </mesh>
      <mesh position={[4.4, FLOOR + 0.7, -3.45]}>
        <boxGeometry args={[1.2, 1.4, 0.05]} />
        <meshStandardMaterial color="#14262f" roughness={1} />
      </mesh>
    </group>
  );
}
