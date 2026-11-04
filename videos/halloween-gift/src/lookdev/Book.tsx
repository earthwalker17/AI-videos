/**
 * The book family's lookdev (world/Book2 the storybook, world/Desk2 the desk and the room's
 * light), in the film's own light rig and post, through the film's own cameras where it has them:
 *  - BookDesk   the opening on the desk: 0 a pulled-back view (the book ~70 % of the width),
 *               1 the film's first frame (journeyAt 0), 2 the lightning's first peak, 3 the push
 *               before the burst, 4 back on the desk at the end;
 *  - BookOpen   0 the cover half open (coverAt 0.5) over the flat page, 1 the cover standing as the
 *               world grows (the film's crane over the book), 2 the hero view inside the story
 *               (the cover's print against the dome: its edge must disappear);
 *  - BookEdge   0 close on the fore-edge, the cover lifted to the crack; 1 the cover's corner,
 *               foil and brass; 2 the spine and the head;
 *  - BookBurst  the bats squeezing out of the crack (world/Bats BatBurst from BOOK_EDGE) on the
 *               opening's desk camera, a few frames from the burst's start (the bats darkened as
 *               proposed for Bats.tsx: less ambient, a darker albedo, so they read as silhouettes);
 *  - BookFade   the cover rising through 0.10 .. 0.34 on the half-open camera: its moon shadow
 *               fades out (Book2's dithered shadow pass) instead of switching off.
 * The desk shots have no sky dome (the room shows round the book), no storybook fog and no foot
 * band (as the film: footAt and immersionAt are 0 on the desk); the crane has the fog the film
 * gives it (FilmV2's FogAmount: the immersion).
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import { Mesh, type Group, type MeshStandardMaterial, type PerspectiveCamera } from 'three';
import { at, FPS } from '../cues.ts';
import { coverAt, immersionAt } from '../film/beats.ts';
import { type CamPose } from '../film/campath.ts';
import { journeyAt } from '../film/journey.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { NIGHT } from '../look/materials.ts';
import { Night } from '../look/Night.tsx';
import { NightPost, type NightPostOptions } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { BatBurst } from '../world/Bats.tsx';
import { Book2, BOOK_EDGE } from '../world/Book2.tsx';
import { Desk2 } from '../world/Desk2.tsx';
import { Grass } from '../world/Grass.tsx';
import { HERO } from '../world/layout.ts';
import { Terrain } from '../world/Terrain.tsx';
import { LOOK_POST } from './LookStage.tsx';
import { WorldScene } from './World.tsx';

const DESK_POST: NightPostOptions = { ...LOOK_POST, foot: 0 };
const DESK_SHADOW = { x: 0, z: 0, hw: 15, hd: 8 };
const WIDE_SHADOW = { x: 0, z: 0, hw: 8.5, hd: 6 };

function Rig({ pose }: { pose: CamPose }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pose.pos);
    camera.fov = pose.fov;
    camera.near = 0.05;
    camera.far = 120;
    camera.updateProjectionMatrix();
    camera.lookAt(...pose.look);
    camera.updateMatrixWorld();
  }, [camera, pose]);
  return null;
}

/** The storybook fog's amount (0 on the desk; the film fades it in with the immersion), restored on unmount. */
function Fog({ amount }: { amount: number }) {
  useLayoutEffect(() => {
    const was = NIGHT.uSbFogOn.value;
    NIGHT.uSbFogOn.value = amount;
    return () => {
      NIGHT.uSbFogOn.value = was;
    };
  }, [amount]);
  return null;
}

/**
 * The burst's bats as proposed for world/Bats.tsx in the desk shots: a quarter of the storybook
 * ambient and a darker albedo (the ambient made them pale lavender cut-outs against the dark
 * fore-edge). Applied once to the burst's own materials.
 */
function DarkBats({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]) as MeshStandardMaterial[];
      for (const m of mats) {
        const ud = m.userData as { sb?: { uSbAmbMul: { value: number } }; darkened?: boolean };
        if (!ud.sb || ud.darkened) continue;
        ud.sb.uSbAmbMul.value *= 0.25;
        m.color.multiplyScalar(0.6);
        ud.darkened = true;
      }
    });
  });
  return <group ref={ref}>{children}</group>;
}

interface Shot {
  /** the film frame the world's animation and the cover run on */
  film: number;
  pose: CamPose;
  cover?: number;
  immersion?: number;
  /** the storybook fog's amount (default 0, the desk) */
  fog?: number;
  shadow?: { x: number; z: number; hw: number; hd: number };
  post?: NightPostOptions;
  /** what else stands in the shot */
  world?: 'none' | 'flat' | 'full';
  props?: boolean;
  burst?: boolean;
}

/** the burst's first bat and the crack's rise and fall round it */
const BURST_START = at(3);
/** the burst as judged against the real book from the opening's camera (world/Bats BatBurst) */
const BURST = { count: 14, size: 1.45, speed: 6.0, scatter: 0.6, rise: 1.4, stagger: 22 } as const;
const crackAt = (f: number) => {
  const up = Math.min(1, Math.max(0, (f - (BURST_START - 6)) / 6));
  const down = Math.min(1, Math.max(0, (f - (BURST_START + 24)) / 8));
  return BOOK_EDGE.crack * (up * up * (3 - 2 * up)) * (1 - down * down * (3 - 2 * down));
};

function BookStage({ shots }: { shots: Shot[] }) {
  const i = useCurrentFrame();
  // mount the stage only once the fonts are in: its text canvases are drawn once, at mount (look/fonts.ts)
  const { ready } = useFilmFonts();
  const s = shots[Math.min(i, shots.length - 1)];
  const imm = s.immersion ?? 0;
  const cover = s.cover ?? coverAt(s.film);
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      {ready && (
        <Stage3D antialias={false} camera={{ fov: 30, near: 0.05, far: 120, position: [0, 3, 8] }}>
          <color attach="background" args={['#0a1118']} />
          <Rig pose={s.pose} />
          <Night f={s.film} fps={FPS} shadow={s.shadow ?? DESK_SHADOW} />
          <Fog amount={s.fog ?? 0} />
          <SkyDome immersion={imm} />
          <Desk2 f={s.film} props={s.props ?? true} beam={1 - imm} />
          <Book2 cover={cover} f={s.film} immersion={imm} />
          {s.world === 'flat' && <Terrain grow={0} />}
          {s.world === 'full' && (
            <>
              <Terrain />
              <Grass />
              <WorldScene f={s.film} camPos={s.pose.pos} />
            </>
          )}
          {s.burst && (
            <DarkBats>
              <BatBurst f={s.film} start={BURST_START} origin={BOOK_EDGE.origin} dir={BOOK_EDGE.dir} count={BURST.count} size={BURST.size} gap={BOOK_EDGE.gap} speed={BURST.speed} scatter={BURST.scatter} rise={BURST.rise} stagger={BURST.stagger} />
            </DarkBats>
          )}
          <NightPost f={s.film} focus={s.pose.focus} {...(s.post ?? DESK_POST)} />
        </Stage3D>
      )}
    </AbsoluteFill>
  );
}

const pose = (pos: [number, number, number], look: [number, number, number], fov: number): CamPose => ({ pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) });
/** the opening's framing pulled back so the book fills about 70 % of the width (journey DESK_A × 1.21) */
const DESK_WIDE = (() => {
  const a = journeyAt(0);
  const k = 1.21;
  const p: [number, number, number] = [a.look[0] + (a.pos[0] - a.look[0]) * k, a.look[1] + (a.pos[1] - a.look[1]) * k, a.look[2] + (a.pos[2] - a.look[2]) * k];
  return pose(p, [a.look[0], a.look[1], a.look[2]], a.fov);
})();

const DESK_SHOTS: Shot[] = [
  { film: 0, pose: DESK_WIDE },
  { film: 0, pose: journeyAt(0) },
  { film: 4, pose: journeyAt(4) },
  { film: at(4) - 6, pose: journeyAt(at(4) - 6) },
  { film: at(36), pose: journeyAt(at(36)) },
];

/** the frame the cover stands half open */
const HALF = (() => {
  let f = at(4);
  while (coverAt(f) < 0.5) f++;
  return f;
})();
const OPEN_SHOTS: Shot[] = [
  { film: HALF, pose: journeyAt(HALF), world: 'flat' },
  { film: at(4) + 22, pose: journeyAt(at(4) + 22), immersion: immersionAt(at(4) + 22), world: 'full', fog: immersionAt(at(4) + 22), shadow: WIDE_SHADOW, post: { ...LOOK_POST, foot: immersionAt(at(4) + 22) } },
  { film: at(6), pose: { pos: HERO.pos, look: HERO.look, fov: HERO.fov, focus: HERO.focus }, cover: 1, immersion: 1, world: 'full', fog: 1, shadow: WIDE_SHADOW, post: LOOK_POST, props: false },
];

/** the corner close: foil and brass in the candle (frames 1, 3, 4: the glints move with the flame) */
const CORNER = pose([10.8, 6.2, 10.6], [6.2, 1.5, 4.4], 30);
const EDGE_SHOTS: Shot[] = [
  { film: BURST_START + 30, pose: pose([9.2, 3.6, 13.2], [2.6, 1.05, 5.2], 30), cover: BOOK_EDGE.crack },
  { film: BURST_START + 30, pose: CORNER, cover: 0 },
  { film: BURST_START + 30, pose: pose([-13.5, 3.6, -11.5], [-6.5, 0.9, -5.6], 30), cover: 0 },
  { film: BURST_START + 33, pose: CORNER, cover: 0 },
  { film: BURST_START + 37, pose: CORNER, cover: 0 },
];

const BURST_FRAMES = [BURST_START + 2, BURST_START + 5, BURST_START + 8, BURST_START + 12, BURST_START + 18, BURST_START + 26];
const BURST_SHOTS: Shot[] = BURST_FRAMES.map((f) => ({ film: f, pose: journeyAt(f), cover: crackAt(f), burst: true }));

/** the desk's props close: the inkwell and quill, the candle, the leaves by the pumpkin */
const PROP_SHOTS: Shot[] = [
  { film: 30, pose: pose([-8.2, 3.2, 5.2], [-12.4, 1.9, -1.9], 30) },
  { film: 30, pose: pose([10.5, 3.4, -1.2], [6.6, 1.0, -8.0], 30) },
  { film: 30, pose: pose([-4.2, 4.8, 15.5], [-8.2, 0.2, 8.0], 30) },
];

/** the cover rising through the shadow's fade, on the half-open camera */
const FADE_SHOTS: Shot[] = [0.1, 0.16, 0.2, 0.24, 0.28, 0.34].map((c) => ({ film: HALF, pose: journeyAt(HALF), cover: c, world: 'flat' as const }));

function BookDesk() {
  return <BookStage shots={DESK_SHOTS} />;
}
function BookOpen() {
  return <BookStage shots={OPEN_SHOTS} />;
}
function BookEdge() {
  return <BookStage shots={EDGE_SHOTS} />;
}
function BookBurst() {
  return <BookStage shots={BURST_SHOTS} />;
}
function BookProps() {
  return <BookStage shots={PROP_SHOTS} />;
}
function BookFade() {
  return <BookStage shots={FADE_SHOTS} />;
}

export function BookRoot(): ReactNode {
  return (
    <>
      <Composition id="BookDesk" component={BookDesk} width={1920} height={1080} fps={FPS} durationInFrames={DESK_SHOTS.length} />
      <Composition id="BookOpen" component={BookOpen} width={1920} height={1080} fps={FPS} durationInFrames={OPEN_SHOTS.length} />
      <Composition id="BookEdge" component={BookEdge} width={1920} height={1080} fps={FPS} durationInFrames={EDGE_SHOTS.length} />
      <Composition id="BookBurst" component={BookBurst} width={1920} height={1080} fps={FPS} durationInFrames={BURST_SHOTS.length} />
      <Composition id="BookProps" component={BookProps} width={1920} height={1080} fps={FPS} durationInFrames={PROP_SHOTS.length} />
      <Composition id="BookFade" component={BookFade} width={1920} height={1080} fps={FPS} durationInFrames={FADE_SHOTS.length} />
    </>
  );
}
