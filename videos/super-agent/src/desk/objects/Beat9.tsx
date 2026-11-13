/**
 * The objects of beat 9 (desk/beat9.ts; STORYBOARD 9.1-9.2), drawn in act two's world (objects/World.tsx, last). The
 * summary's world mounts World too: there DeskState.e9 is null and the summary draws its own static `<Proposed />`
 * (still (d)), so nothing of the beat is drawn here from summary.ts SEAM_D on.
 * - the proposed parts (objects/Proposed.tsx) from beat9.ts proposedAt, from the first lay to the seam (beat 10's state
 *   rides in it: the etch, the pencil), ending exactly as still (d) draws them;
 * - the machines' slate hatches (objects/Dispatch.tsx Hatch) and their holes in the slate (gl/desk.ts DESK_HOLES 0 and 2);
 * - the lid strut from its lift off your tray (your desk's own strut, the same parts and materials, in the tray's pose on
 *   the lift frame: objects/YourDesk.tsx stops drawing it there) to its press into the loop's drawing;
 * - the queued slip (vellum) out of the loop's port, along the server's tether, into the server;
 * - the Watchdog's sightline: its own drawing, turning about the lens, drawn back into it once its marks are on the sheet.
 * The stuck bay's card drum steps in objects/Bay.tsx (FreshBay, from DeskState.e9.drum). No DOM text: the proposed tag is
 * a tag of the film's (beat9.ts TAGS_9).
 */
import type { CamPose } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, PlaneGeometry, type BufferGeometry } from 'three';
import { BEAT_9, WORDS } from '../../cues.ts';
import { MACHINE_RISE, PERSIST_WORDS, QUEUED, STRUT_LEN, persistWordsAt, proposedAt, watchInkAt, type Beam, type Beat9State, type QueuedSlip, type StrutPose } from '../beat9.ts';
import { cylinderZ, merge, slab, tube } from '../geom.ts';
import { DESK_HOLES } from '../gl/desk.ts';
import { SANS_CSS } from '../gl/print7.ts';
import { vellum } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { Step, isStepped, useDeskMats } from '../kit.tsx';
import type { Rect } from '../layout.ts';
import { MACHINES_9, SEAM } from '../proposed.ts';
import type { DeskState } from '../state.ts';
import { Hatch, deskHoles, holeOf } from './Dispatch.tsx';
import { Proposed, VELLUM_STEP, WATCH_LENS, beamSheet, persistWordsSheet, slipSheet, stepAmountOf, useVellumOpacity, useVellumStep } from './Proposed.tsx';

/** Each machine's base in plan (its hatch's box). */
const BASES: readonly Rect[] = MACHINES_9.map((m) => ({ x0: m.c[0] - m.w / 2, x1: m.c[0] + m.w / 2, y0: m.c[1] - m.d / 2, y1: m.c[1] + m.d / 2 }));

/**
 * Act two's proposed parts ride the step as one ('b9-proposed': the vellum and pencil fade with the set they ride, the
 * machines step with the kit's; objects/Proposed.tsx): beats 9-10 are about them, so only 10.2's Fix cards step them
 * (beat10.ts ALL_BUT_CARDS: everything but the cards).
 */
export const PROPOSED_STEP_ID = 'b9-proposed';
/**
 * The Watchdog (its station's sheet, the pencil flag it pins and its sightline) rides its own id in act two: 9.2 is about it
 * and the stuck bay, so beat9.ts's N8 hold steps the rest of the vellum and leaves these two at the frame's top contrast.
 */
export const WATCHDOG_STEP_ID = 'b9-watchdog';
/** The Watchdog's vellum opacity at a frame (its own id's step, as Proposed's useVellumOpacity does for the enclosing one). */
export const watchOpacityOf = (s: DeskState): number => (1 - VELLUM_STEP * stepAmountOf(isStepped(s.step, WATCHDOG_STEP_ID), s.step, s.testsStep)) * watchInkAt(s.f);

export function Beat9({ s }: { s: DeskState }) {
  // act two only: the summary draws its own static Proposed (still (d))
  const p = s.f < SEAM ? proposedAt(s.f) : null;
  return (
    <>
      <Step on={isStepped(s.step, PROPOSED_STEP_ID)}>
        {p && <Proposed state={p} step={s.step} late={s.testsStep} watchOpacity={watchOpacityOf(s)} />}
        {s.e9 && <Beat9Movers s={s} e={s.e9} />}
        {s.f < SEAM && persistWordsAt(s.f) > 0 && <PersistWords s={s} k={persistWordsAt(s.f)} />}
      </Step>
      {s.f >= HOLES_FROM && s.f < SEAM && <MachineHoles s={s} rise={s.e9?.machines ?? null} />}
    </>
  );
}

/**
 * From bar 58's downbeat to the seam this beat writes the slate's hole slots 0 and 2 every frame (its machines' hatches,
 * else the frame's own), so a page that seeks back from inside the hatches' frames to before them keeps no hole either.
 */
const HOLES_FROM = BEAT_9.away;

function Beat9Movers({ s, e }: { s: DeskState; e: Beat9State }) {
  return (
    <>
      {e.machines && <MachineHatches rise={e.machines} />}
      {e.strut && (
        <Step on={false}>
          <Strut pose={e.strut} />
        </Step>
      )}
      {e.queued && <Queued q={e.queued} s={s} />}
      {e.beam && (
        <Step on={isStepped(s.step, WATCHDOG_STEP_ID)}>
          <Sightline beam={e.beam} s={s} />
        </Step>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// The machines' hatches

/**
 * The slate's hole slots 0 and 2: a machine's while its hole is cut, else what the frame's own holes are (objects/Dispatch.tsx
 * deskHoles), written every frame from the first hatch to the seam, after DeskUniforms (which writes on change only), so a
 * page that starts anywhere draws what one running through does (no hole left behind once the machines are up).
 */
function MachineHoles({ s, rise }: { s: DeskState; rise: Beat9State['machines'] }) {
  const holes = deskHoles(s);
  const mine = MACHINE_RISE.map((M, i) => (rise?.[i]?.hole ? { slot: M.slot, box: BASES[i]! } : null));
  useLayoutEffect(() => {
    for (const slot of [0, 2]) {
      const m = mine.find((x) => x?.slot === slot);
      DESK_HOLES.value[slot] = m ? holeOf(m.box) : holes[slot]!;
    }
  });
  return null;
}

function MachineHatches({ rise }: { rise: NonNullable<Beat9State['machines']> }) {
  return (
    <>
      {rise.map((r, i) => (r.hole ? <Hatch key={i} box={BASES[i]!} open={r.leaves} depth={MACHINES_9[i]!.h + 10} look="slate" /> : null))}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// The lid strut (your desk's own: objects/YourDesk.tsx strutParts and STRUT, the same numbers)

const STRUT = { tube: 4.6, rod: 2.8, collar: 7.6, collarL: 7, clevis: [18, 11] as const } as const;
const strutOuter = (len: number) => Math.min(46, len * 0.6);
/** The lid strut along +y from 0 to `len`: an outer tube, the inner rod, an enamel collar and a clevis at each end (YourDesk.tsx's own geometry). */
function strutParts(len: number) {
  const outer = strutOuter(len);
  const [cw, cl] = STRUT.clevis;
  return {
    tube: tube(
      [
        [0, cl - 2, 0],
        [0, outer, 0],
      ],
      STRUT.tube,
      4,
      16,
    ),
    rod: tube(
      [
        [0, outer - 2, 0],
        [0, len - cl + 2, 0],
      ],
      STRUT.rod,
      4,
      12,
    ),
    collar: (() => {
      const g = merge([cylinderZ(STRUT.collar, -STRUT.collarL / 2, STRUT.collarL / 2, 0, 0, 24), cylinderZ(STRUT.collar + 1, -1, 1, 0, 0, 24)]);
      g.rotateX(Math.PI / 2);
      g.translate(0, outer, 0);
      return g;
    })(),
    clevis: merge(
      [0, len].map((y) => {
        const s = y === 0 ? 1 : -1;
        const a = Math.min(y, y + s * cl);
        const b = Math.max(y, y + s * cl);
        // a forked block: two cheeks and the bridge between them
        return merge([
          slab({ x0: -cw / 2, x1: -cw / 2 + 5, y0: a, y1: b }, -5.5, 5.5, 1.6, 1),
          slab({ x0: cw / 2 - 5, x1: cw / 2, y0: a, y1: b }, -5.5, 5.5, 1.6, 1),
          slab({ x0: -cw / 2, x1: cw / 2, y0: Math.min(y + s * (cl - 4), y + s * cl), y1: Math.max(y + s * (cl - 4), y + s * cl) }, -5.5, 5.5, 1.6, 1),
        ]);
      }),
    ),
    pins: merge(
      [4, len - 4].map((y) =>
        tube(
          [
            [-cw / 2 - 2, y, 0],
            [cw / 2 + 2, y, 0],
          ],
          1.9,
          2,
          10,
        ),
      ),
    ),
  };
}

/** How far the docked strut sinks as it presses into the drawing (u: its clevises' 5.5 u half height wholly under the slate's top), and how flat it is pressed. */
const PRESS = { sink: 13, flat: 0.7 } as const;

/**
 * The strut at its pose: in flight (turning east as it goes, pitched over the arc), docked lying east-west on the loop's
 * sheet over its drawing, then pressed flat down into the drawing (under the vellum, then the slate: it pales into it as
 * the drawn strut inks in over it). On the lift frame it is exactly your tray's strut (its end `a` at the tray's).
 */
function Strut({ pose }: { pose: StrutPose }) {
  const m = useDeskMats();
  const g = useMemo(() => strutParts(STRUT_LEN), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const sq = pose.squash;
  const k = pose.morph;
  const flat = 1 - PRESS.flat * k;
  return (
    <group position={[pose.c[0], pose.c[1], pose.c[2] - PRESS.sink * k]} rotation={[0, 0, pose.yaw]}>
      <group rotation={[pose.tilt, 0, 0]} scale={[1 + sq / 2, 1 + sq / 2, (1 - sq) * flat]}>
        <group position={[0, -STRUT_LEN / 2, 0]}>
          <mesh geometry={g.tube} material={m.steel} />
          <mesh geometry={g.rod} material={m.steel} />
          <mesh geometry={g.collar} material={m.enamel} />
          <mesh geometry={g.clevis} material={m.enamelShade} />
          <mesh geometry={g.pins} material={m.graphiteDark} />
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The queued slip

function useSlipMat() {
  const gl = useThree((x) => x.gl);
  const mat = useMemo(() => vellum(texture(QUEUED.l, QUEUED.w, (c) => slipSheet(c, QUEUED.l, QUEUED.w), Math.min(8, gl.capabilities.getMaxAnisotropy()), 'transparent')), [gl]);
  useLayoutEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
    },
    [mat],
  );
  return mat;
}
/** A plane `l` × `w` about its centre showing only its east `out` of its length (its west part still inside the port): its plane and its UVs cut. */
function eastPart(l: number, w: number, out: number): BufferGeometry {
  const g = new PlaneGeometry(l * out, w);
  const uv = g.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - out + uv.getX(i) * out);
  uv.needsUpdate = true;
  g.translate(l / 2 - (l * out) / 2, 0, 0);
  return g;
}

/** The queued slip (proposed work, vellum): out of the loop's port, along the server's tether, stood up and dropped into the server's top. Vellum: no shadow. */
function Queued({ q, s }: { q: QueuedSlip; s: DeskState }) {
  const mat = useSlipMat();
  useVellumStep([mat], useVellumOpacity(s.step, s.testsStep));
  const out = Math.round(q.out * 1000) / 1000;
  const g = useMemo(() => eastPart(QUEUED.l, QUEUED.w, Math.max(0.001, out)), [out]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return (
    <group position={q.p} rotation={[q.stand, 0, 0]}>
      <mesh geometry={g} material={mat} renderOrder={3} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The Persistent plate's words (vellum)

/** The plate's west part, `k` of its width (its UVs cut with it): it unrolls from its west edge and rolls back up to it. */
function westPart(l: number, w: number, k: number): BufferGeometry {
  const g = new PlaneGeometry(l * k, w);
  const uv = g.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  uv.needsUpdate = true;
  g.translate(-l / 2 + (l * k) / 2, 0, 0);
  return g;
}
/** "Persistent · 持久" in vellum on the loop's sheet's north edge (beat9.ts PERSIST_WORDS): laid as the strut docks, rolled up under bar 65's dolly. Vellum: no shadow. */
function PersistWords({ s, k }: { s: DeskState; k: number }) {
  const P = PERSIST_WORDS;
  const gl = useThree((x) => x.gl);
  const mat = useMemo(() => vellum(texture(P.w, P.d, (c) => persistWordsSheet(c, P.w, P.d, SANS_CSS, WORDS.traitPersistent), Math.min(8, gl.capabilities.getMaxAnisotropy()), 'transparent')), [gl, P]);
  useLayoutEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
    },
    [mat],
  );
  useVellumStep([mat], useVellumOpacity(s.step, s.testsStep));
  const q = Math.round(k * 1000) / 1000;
  const g = useMemo(() => westPart(P.w, P.d, Math.max(0.001, q)), [q, P]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return <mesh geometry={g} material={mat} position={P.c} renderOrder={3} />;
}

// ------------------------------------------------------------------------------------------------
// The Watchdog's sightline

/** The sightline's drawing: its reach out to the flag's ring and a margin, its height the wedge's at that reach. */
const BEAM_TEX = { l: Math.ceil(WATCH_LENS.reach) + 4, h: Math.ceil(2 * Math.tan(WATCH_LENS.spread) * (WATCH_LENS.reach + 4)) + 8 } as const;

function useBeamMat() {
  const gl = useThree((x) => x.gl);
  const mat = useMemo(() => vellum(texture(BEAM_TEX.l, BEAM_TEX.h, (c) => beamSheet(c, BEAM_TEX.l - 22, BEAM_TEX.h), Math.min(8, gl.capabilities.getMaxAnisotropy()), 'transparent')), [gl]);
  useLayoutEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
    },
    [mat],
  );
  return mat;
}
/** The sightline out of the lens to `len` of its reach (its plane and UVs cut at its tip), turned `a` about the lens off still (d)'s aim. Vellum: no shadow. */
function Sightline({ beam, s }: { beam: Beam; s: DeskState }) {
  const mat = useBeamMat();
  // (it inks up with the Watchdog's sheet under N8's hold: beat9.ts watchInkAt)
  useVellumStep([mat], useVellumOpacity(s.step, s.testsStep) * watchInkAt(s.f));
  const len = Math.round(beam.len * 1000) / 1000;
  const g = useMemo(() => {
    const k = Math.max(0.001, len);
    const geo = new PlaneGeometry(BEAM_TEX.l * k, BEAM_TEX.h);
    const uv = geo.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
    uv.needsUpdate = true;
    geo.translate((BEAM_TEX.l * k) / 2, 0, 0);
    return geo;
  }, [len]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  if (len <= 0) return null;
  return <mesh geometry={g} material={mat} position={[WATCH_LENS.p[0], WATCH_LENS.p[1], 0.6]} rotation={[0, 0, WATCH_LENS.a + beam.a]} renderOrder={2} />;
}

export function Beat9Text(_props: { f: number; pose: CamPose }) {
  return null;
}
