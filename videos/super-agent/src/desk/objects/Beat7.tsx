/**
 * The objects of beat 7 (desk/beat7.ts; STORYBOARD 7.1-7.4), drawn in act two's world (objects/World.tsx, last: its holes in
 * the slate are written after the rest). The summary's world mounts World too: there DeskState.e7 is null and nothing of
 * the beat is drawn here (objects/Trace.tsx and Links.tsx draw its end state).
 * - the Thread cord, its guide, its terminal and the Thread's gate on the bay's north wall (objects/Thread.tsx);
 * - the follow-ups: chat slips of the spout's size, the request's ID (#0405) on them and the Thread's vermilion rim, each
 *   hung on its clip (a steel rod and a hook over the cord), posted up from the chat spout, riding the cord, through the
 *   gate onto the work slot, fed into its slit; the clip's rod folds flat as it lets go of the cord;
 * - the notices on the tape beside the Thread's row (a row rule and a vermilion bubble per follow-up, inked over 3 f as each
 *   crosses the guide), stepped with the deck;
 * - the decision tally, a strip of its own paper raised over the reel frame's north member, and its ghost (TallyPlay);
 * - the door ghost (DoorPlay): the bay with its long job in the slot, the gate shut, a follow-up waiting outside;
 * - the job rail rising out of its slate hatch, the oval sinking into its own hatch after, the long test (its capsule), the
 *   receipt, the sand-glass, the Productive plate and its hatch (objects/Jobs.tsx);
 * - the dossier: a thick tabbed stack pushed out from under the deck to the card feeder's mouth.
 * The chat reply is drawn with every reply (objects/Handshake.tsx Reply, objects/Replies.tsx). Cargo in motion never steps
 * down; what lies still steps with its part (`b7-...`, the cord with 'cord', the notices with 'deck').
 */
import type { CamPose } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, PlaneGeometry, Shape, type BufferGeometry } from 'three';
import { DOOR_CARD, DOSSIER, NOTICES, OVAL_AWAY, OVAL_HATCH, PLATE_RISE, PRODUCTIVE_PLATE, RAIL, RAIL_HATCH, RIDER, SLOT_7, SPOT_7, TALLY, TALLY_CARD, card7At, tallyLength, type Beat7State, type DossierPose, type RiderPose } from '../beat7.ts';
import { cardSize } from '../beat4.ts';
import { FRAMING_B, deskCamera, project } from '../camera.ts';
import { extrude, merge, slab, tube } from '../geom.ts';
import { DESK_HOLES } from '../gl/desk.ts';
import { HEX, paper } from '../gl/materials.ts';
import { PRINT_CSS, SANS_CSS, TALLY_MAX, beat7Textures, type Beat7Textures } from '../gl/print7.ts';
import { Step, isStepped, useDeskMats, useStepMode } from '../kit.tsx';
import { TAPE, type P2, type P3, type Rect } from '../layout.ts';
import type { DeskState } from '../state.ts';
import { Counterfactual, RELIEF, circle, polyShape, rect, solid, useReliefMats } from './Counterfactual.tsx';
import { holeOf } from './Dispatch.tsx';
import { Capsule, Glass, JobRail, OvalTrack, PlateHatch, ProductivePlate, RailHatch, Receipt } from './Jobs.tsx';
import { Gate, Thread } from './Thread.tsx';

/** A notice's height over the tape (objects/Cache.tsx Z_CARD: the window's rows lie 0.35 over the tape). */
const NOTICE_Z = TAPE.z + 0.47;

/** Beat 7's printed textures, once per world. */
function useTextures(): Beat7Textures {
  const gl = useThree((st) => st.gl);
  const t = useMemo(() => beat7Textures(SANS_CSS, PRINT_CSS, Math.min(8, gl.capabilities.getMaxAnisotropy())), [gl]);
  useLayoutEffect(() => () => Object.values(t).forEach((x) => (Array.isArray(x) ? x.forEach((y) => y.dispose()) : x.dispose())), [t]);
  return t;
}

export function Beat7({ s }: { s: DeskState }) {
  const e = s.e7;
  if (!e) return null;
  return <Beat7Body s={s} e={e} />;
}

function Beat7Body({ s, e }: { s: DeskState; e: Beat7State }) {
  const t = useTextures();
  const face = useMemo(() => paper(t.followUp, HEX.paperLit), [t]);
  useLayoutEffect(() => () => face.dispose(), [face]);
  const rail = e.rail;
  const oval = e.oval;
  const plate = e.plate;
  // the slate's third hatch hole (gl/desk.ts DESK_HOLES[2]): the station's while it rises, the plate's, then the oval's as it sinks (never two at once)
  const hole: Rect | null = rail?.hole ? RAIL_HATCH : plate?.hole ? PRODUCTIVE_PLATE.box : oval?.hole ? OVAL_HATCH : null;
  return (
    <>
      <Thread s={s} e={e} />
      <Step on={isStepped(s.step, 'bugBay')}>
        <Gate rise={e.gate.rise} open={e.gate.open} />
      </Step>
      {e.riders.map((r) => (
        <Rider key={r.i} r={r} face={face} />
      ))}
      <Step on={isStepped(s.step, 'deck')}>
        <Notices ink={e.notices} t={t} />
      </Step>
      {e.tally && <Tally len={e.tally.len} t={t} />}
      <Cards s={s} />
      {rail && (
        <Step on={isStepped(s.step, 'b7-rail')}>
          {rail.hole && <RailHatch open={rail.leaves} />}
          {oval && <RailHatch open={oval.leaves} box={OVAL_HATCH} />}
          {/* the station: drawn once its leaves part; the oval until its own hatch has shut over it */}
          {rail.dz > -RAIL.depth + 0.01 || rail.leaves > 0 ? (
            <>
              <JobRail dz={rail.dz} />
              {ovalDrawn(e.f) && (
                <Step on={isStepped(s.step, 'b7-oval')}>
                  <OvalTrack dz={rail.dz + (oval?.dz ?? 0)} />
                </Step>
              )}
            </>
          ) : null}
          {e.receipt !== null && e.receipt > 0 && <Receipt up={e.receipt} face={t.receipt} />}
          {e.glass && <Glass pose={e.glass} />}
        </Step>
      )}
      <RailHole box={hole} />
      {e.capsule && <Capsule c={e.capsule} />}
      {plate && (
        <Step on={isStepped(s.step, 'b7-plate')}>
          {plate.hole && <PlateHatch open={plate.leaves} />}
          {plate.dz > -PLATE_RISE.depth + 0.01 || plate.leaves > 0 ? <ProductivePlate dz={plate.dz} face={t.productive} words={plate.words} /> : null}
        </Step>
      )}
      {e.dossier && <Dossier d={e.dossier} t={t} />}
    </>
  );
}
/** The oval is drawn from the station's rise until its own hatch has shut over it (beat7.ts OVAL_AWAY). */
const ovalDrawn = (f: number): boolean => f < OVAL_AWAY.down + 5;

/** The slate's hatch hole for beat 7's risers: gl/desk.ts DESK_HOLES' third slot (the docs bay's, shut long before), after objects/Filter.tsx FilterHoles. */
function RailHole({ box }: { box: Rect | null }) {
  useLayoutEffect(() => {
    if (box) DESK_HOLES.value[2] = holeOf(box);
  });
  return null;
}

// ------------------------------------------------------------------------------------------------
// The follow-ups

/** A follow-up slip (RIDER's size): a thin paper body, its tail cut in a swallow notch (the chat slip's form), its print's UVs from its outline; its clip. */
function useRiderGeometry() {
  const g = useMemo(() => {
    const hl = RIDER.l / 2;
    const hw = RIDER.w / 2;
    const sh = new Shape();
    sh.moveTo(-hl, -hw);
    sh.lineTo(hl, -hw);
    sh.lineTo(hl, hw);
    sh.lineTo(-hl, hw);
    sh.lineTo(-hl + 8, 0);
    sh.closePath();
    const slip = extrude(sh, -0.5, 0.5, 0);
    const pos = slip.getAttribute('position');
    const uv = slip.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + hl) / RIDER.l, (pos.getY(i) + hw) / RIDER.w);
    uv.needsUpdate = true;
    // its clip: a rod up from the slip's left edge at the hook's x (its foot the fold's hinge), a short bar out to the hook
    const [hx, hy] = RIDER.hook;
    const foot = hw - 2;
    const rod = merge([
      tube(
        [
          [0, 0, 0],
          [0, 0, RIDER.hang],
        ],
        1.3,
        2,
        6,
      ),
      tube(
        [
          [0, 0, RIDER.hang],
          [0, hy - foot - 5.5, RIDER.hang],
        ],
        1.3,
        2,
        6,
      ),
    ]);
    const plate = slab({ x0: -5, x1: 5, y0: -2.5, y1: 2.5 }, 0, 1.6, 1, 0.4);
    // the hook in its pivot's frame (the bar's end at the origin): a loop over the cord (radius 5.5 round it), opening up
    const hook = tube(
      Array.from({ length: 13 }, (_, k): P3 => {
        const a = Math.PI - (k / 12) * (Math.PI + 0.55);
        return [0, 5.5 + 5.5 * Math.cos(a), 5.5 * Math.sin(a)];
      }),
      1.3,
      14,
      6,
    );
    return { slip, rod, plate, hook, foot: [hx, foot, 0.5] as P3, pivot: [0, hy - foot - 5.5, RIDER.hang] as P3 };
  }, []);
  useLayoutEffect(() => () => [g.slip, g.rod, g.plate, g.hook].forEach((x) => x.dispose()), [g]);
  return g;
}

/** A follow-up at its pose: its slip, its clip's rod (folding flat onto the slip as it lets go of the cord), the hook. Cargo in motion: never stepped down. */
function Rider({ r, face }: { r: RiderPose; face: ReturnType<typeof paper> }) {
  const g = useRiderGeometry();
  const m = useDeskMats();
  const q = r.squash;
  return (
    <group position={r.p} rotation={[r.roll, -r.slope, r.heading, 'ZYX']} scale={[1 + q / 2, 1 + q / 2, 1 - q]}>
      <mesh geometry={g.slip} material={face} />
      <group position={g.foot}>
        <mesh geometry={g.plate} material={m.steel} />
        <group rotation={[0, (Math.PI / 2) * r.fold, 0]}>
          <mesh geometry={g.rod} material={m.steel} />
          <group position={g.pivot} rotation={[-(1 - r.close) * 1.4, 0, 0]}>
            <mesh geometry={g.hook} material={m.steel} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** The notices: a row rule and a vermilion bubble beside the Thread's row, each inked over 3 f from its follow-up's crossing (no detent); stepped with the deck. */
function Notices({ ink, t }: { ink: number[]; t: Beat7Textures }) {
  const mode = useStepMode();
  const g = useMemo(() => NOTICES.map((n) => new PlaneGeometry(n.w, n.h)), []);
  useLayoutEffect(() => () => g.forEach((x) => x.dispose()), [g]);
  // each notice its own material (its ink's opacity: objects/Cache.tsx's pointer's transparent paper program), in this set's mode
  const mats = useMemo(
    () =>
      NOTICES.map((_, i) => {
        const x = paper(t.notice[i]!, HEX.paper, { stepped: mode });
        x.transparent = true;
        x.depthWrite = false;
        return x;
      }),
    [t, mode],
  );
  useLayoutEffect(() => () => mats.forEach((x) => x.dispose()), [mats]);
  useLayoutEffect(() => {
    ink.forEach((k, i) => (mats[i]!.opacity = k));
  });
  return <>{ink.map((k, i) => (k > 0 ? <mesh key={i} geometry={g[i]} material={mats[i]} position={[NOTICES[i]!.x, NOTICES[i]!.y, NOTICE_Z + 0.02 * i]} /> : null))}</>;
}

// ------------------------------------------------------------------------------------------------
// 7.2 the tally and its ghost

/** The tally strip: a strip of its own paper raised over the cap, fed `len` out of the boss, its leading end east (the texture's u 0), its newest tick at the boss. */
function Tally({ len, t }: { len: number; t: Beat7Textures }) {
  const m = useDeskMats();
  const g = useMemo(() => {
    const top = new PlaneGeometry(1, TALLY.w);
    const uv = top.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    uv.needsUpdate = true;
    const body = new BoxGeometry(1, TALLY.w, TALLY.t);
    body.translate(0, 0, -TALLY.t / 2);
    return { top, body };
  }, []);
  useLayoutEffect(() => () => [g.top, g.body].forEach((x) => x.dispose()), [g]);
  const mat = useMemo(() => paper(t.tally, HEX.paper), [t]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  useLayoutEffect(() => {
    t.tally.repeat.set(Math.max(1e-3, len / TALLY_MAX), 1);
  }, [t, len]);
  if (len < 0.05) return null;
  return (
    <group position={[TALLY.x0 + len / 2, TALLY.y, TALLY.z]} scale={[len, 1, 1]}>
      <mesh geometry={g.body} material={m.paperShade} />
      <mesh geometry={g.top} material={mat} position={[0, 0, 0.03]} />
    </group>
  );
}

/**
 * The ghost strip on its card (beat7.ts TALLY_CARD: card units, x east, y up its face), its tick pitch scaled so that on
 * screen it matches the real strip's (FRAMING_B, the film's 15° pitch; the card faces the camera to within 2°): the card
 * lies so that the ghost's west end sits under the real tally's (beat7.ts SPOT_7).
 */
const GHOST = (() => {
  const pose = deskCamera(FRAMING_B, 15);
  const at = SPOT_7.tally.at;
  const kx = (project(pose, [at[0] + 100, at[1], at[2]])[0] - project(pose, at)[0]) / 100;
  const real = project(pose, [TALLY.x0, TALLY.y, TALLY.z]);
  const realK = (project(pose, [TALLY.x0 + 100, TALLY.y, TALLY.z])[0] - real[0]) / 100;
  return { x0: TALLY_CARD.strip.x0, y: TALLY_CARD.strip.y, scale: realK / kx };
})();
/** The ghost tally's ticks and its strip, as grey-stock relief: the count without pass-through (TALLY.ghost), the follow-ups' decisions ringed under it. */
function useGhostGeometry() {
  const g = useMemo(() => {
    const k = GHOST.scale;
    const p = TALLY.pitch * k;
    const span = (5 * TALLY.pitch + TALLY.gap) * k;
    const len = tallyLength(TALLY.ghost) * k;
    const h = TALLY.w * k;
    const x0 = GHOST.x0;
    const y = GHOST.y;
    const strip = solid([rect(x0, y - h / 2, x0 + len, y + h / 2, 1)], 0, RELIEF * 0.6);
    // each tick as the real strip draws it (its leading end east: the first tick farthest from the boss's side, x0)
    const tickAt = (n: number): BufferGeometry => {
      const x = x0 + len - (TALLY.lead * k + Math.floor(n / 5) * span);
      const j = n % 5;
      if (j < 4) return solid([rect(x - (j + 0.5) * p - 0.9, y - h * 0.36, x - (j + 0.5) * p + 0.9, y + h * 0.36, 0.3)], RELIEF * 0.6, RELIEF * 0.6 + 1);
      return solid([polyShape([[x + 0.2 * p + 0.9, y - h * 0.34], [x + 0.2 * p - 0.9, y - h * 0.34], [x - 4.2 * p - 0.9, y + h * 0.34], [x - 4.2 * p + 0.9, y + h * 0.34]])], RELIEF * 0.6, RELIEF * 0.6 + 1);
    };
    const ticks = merge(Array.from({ length: TALLY.ghost }, (_, n) => tickAt(n)));
    // the decisions follow-ups would have cost (the 30%): a small ring under every fourth tick from the first
    const rings = Array.from({ length: TALLY.ghost }, (_, n) => n)
      .filter((n) => n % 4 === 3)
      .map((n) => {
        const x = x0 + len - (TALLY.lead * k + Math.floor(n / 5) * span) - ((n % 5 < 4 ? n % 5 : 2) + 0.5) * p;
        return solid([circle(x, y - h / 2 - 6, 3.2, 1.6)], 0, RELIEF * 0.9);
      });
    return { strip, ticks, rings: rings.length ? merge(rings) : null };
  }, []);
  useLayoutEffect(
    () => () => {
      g.strip.dispose();
      g.ticks.dispose();
      g.rings?.dispose();
    },
    [g],
  );
  return g;
}
/** The ghost tally's play: its strip under the real one, west ends together, its count 1.3x the real one's. */
function TallyPlay() {
  const m = useReliefMats();
  const g = useGhostGeometry();
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.strip} material={m.light} />
      <mesh geometry={g.ticks} material={m.ink} />
      {g.rings && <mesh geometry={g.rings} material={m.dark} />}
    </group>
  );
}

/**
 * The door ghost's play (card units, beat7.ts DOOR_CARD 280 x 200, y up its face): the request's bay in plan, half-duplex:
 * its long job fills its work slot, the Thread's gate on its north wall is shut (a heavy ink bar), and a follow-up waits
 * outside on the cord, hung at the gate. Each part at least 40 px on screen.
 */
const DOOR = { W: { x0: -118, x1: 60, y0: -92, y1: 36 }, wall: 10, gate: { x0: -46, x1: 44 } } as const;
function useDoorGeometry() {
  const g = useMemo(() => {
    const { W, wall, gate } = DOOR;
    // the walls: the north wall open where the gate stands
    const walls = solid(
      [
        rect(W.x0, W.y0, W.x1, W.y0 + wall + 6, 1.5),
        rect(W.x0, W.y0, W.x0 + wall, W.y1, 1.5),
        rect(W.x1 - wall, W.y0, W.x1, W.y1, 1.5),
        rect(W.x0, W.y1 - wall, gate.x0, W.y1, 1.5),
      ],
      0,
      RELIEF * 1.4,
    );
    // the work slot along the north wall and the long job lying in it (its band in ink)
    const slot = solid([rect(gate.x0 - 30, W.y1 - wall - 30, gate.x1 + 4, W.y1 - wall - 4, 2)], 0, RELIEF * 0.8);
    const job = solid([rect(gate.x0 - 22, W.y1 - wall - 25, gate.x1 - 4, W.y1 - wall - 9, 8)], RELIEF * 0.8, RELIEF * 2);
    const band = solid([rect(-14, W.y1 - wall - 25.5, -2, W.y1 - wall - 8.5, 0.5)], RELIEF * 2, RELIEF * 2 + 0.6);
    // the gate, shut: a heavy ink bar along the wall's top between its post and the terminal
    const bar = solid([rect(gate.x0, W.y1 - wall + 1, gate.x1, W.y1 - 1, 1)], RELIEF * 1.4, RELIEF * 1.4 + 2.4);
    const posts = solid([circle(gate.x0, W.y1 - wall / 2, 6), circle(gate.x1 + 4, W.y1 - wall / 2, 7)], 0, RELIEF * 2.4);
    // the cord in from the card's north-east down to the terminal
    const cordPts: P2[] = [
      [132, 94],
      [104, 88],
      [70, 74],
      [gate.x1 + 4, W.y1 - wall / 2 + 4],
    ];
    const cord = merge(cordPts.slice(1).map((b, i) => strip2(cordPts[i]!, b, 3)));
    // the follow-up waiting outside: a slip (its rim in ink) hung under the cord at the shut gate
    const slip = solid([rect(-34, -13, 34, 13, 1.5)], 0, 1.6);
    const rim = solid([rect(-30, -9, -22, 9, 0.6), rect(22, -9, 30, 9, 0.6)], 1.6, 2.2);
    return { walls, slot, job, band, bar, posts, cord, slip, rim };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of Object.values(g)) x.dispose();
    },
    [g],
  );
  return g;
}
/** A flat strip from a to b (width w), standing RELIEF high: a line on the card. */
function strip2(a: P2, b: P2, w: number): BufferGeometry {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = (-(b[1] - a[1]) / d) * (w / 2);
  const ny = ((b[0] - a[0]) / d) * (w / 2);
  return solid([polyShape([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]])], RELIEF, RELIEF + 0.8);
}
function DoorPlay({ play }: { play: number }) {
  const m = useReliefMats();
  const g = useDoorGeometry();
  // the follow-up rides in along the cord's last stretch over 6 f and stops at the shut gate, waiting
  const k = Math.min(1, Math.max(0, (play + 8) / 6));
  const e = 1 - (1 - k) ** 2;
  const at: P2 = [24 + (62 - 24) * (1 - e), DOOR.W.y1 + 22 + 22 * (1 - e)];
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.walls} material={m.dark} />
      <mesh geometry={g.slot} material={m.dark} />
      <mesh geometry={g.job} material={m.light} />
      <mesh geometry={g.band} material={m.ink} />
      <mesh geometry={g.posts} material={m.dark} />
      <mesh geometry={g.bar} material={m.ink} />
      <mesh geometry={g.cord} material={m.ink} />
      <group position={[at[0], at[1], RELIEF * 1.6]} rotation={[0, 0, -0.12]}>
        <mesh geometry={g.slip} material={m.light} />
        <mesh geometry={g.rim} material={m.ink} />
      </group>
    </group>
  );
}

/** Beat 7's counterfactual cards (beat7.ts card7At, SPOT_7, SLOT_7): each slides out of its slot beside what it qualifies, plays, is struck and goes back in. */
function Cards({ s }: { s: DeskState }) {
  return (
    <>
      {(['tally', 'door'] as const).map((k) => {
        const card = card7At(s.f, k);
        if (!card) return null;
        const size = cardSize(SPOT_7[k]);
        return (
          <Counterfactual key={k} pose={card} w={size.w} h={size.h} strike={card.strike} inFrame={card.travel} clip={SLOT_7[k].plane}>
            {k === 'tally' ? <TallyPlay /> : <DoorPlay play={card.play} />}
          </Counterfactual>
        );
      })}
    </>
  );
}
void DOOR_CARD;

// ------------------------------------------------------------------------------------------------
// 7.4 the dossier

function useDossierGeometry() {
  const g = useMemo(() => {
    const { l, w, t } = DOSSIER;
    const body = new BoxGeometry(l, w, t);
    const cover = new PlaneGeometry(l - 2, w - 2);
    cover.translate(0, 0, t / 2 + 0.05);
    // the stack's edge: its sheets as faint steps along its south face (a few slabs a hair proud), the three index tabs along its north edge
    const sheets = merge([0, 1, 2, 3].map((i) => slab({ x0: -l / 2 + 1, x1: l / 2 - 1, y0: -w / 2 - 0.6, y1: -w / 2 + 2 }, -t / 2 + 1 + i * 3.6, -t / 2 + 2.4 + i * 3.6, 0.4, 0.2)));
    const tabs = merge([-30, 0, 30].map((x, i) => slab({ x0: x - 14, x1: x + 14, y0: w / 2 - 3, y1: w / 2 + 10 }, -t / 2 + 2 + i * 4, -t / 2 + 4.2 + i * 4, 2, 0.5)));
    return { body, cover, sheets, tabs };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** The dossier at its pose: pushed out from under the deck, in its heavy flight, thudding onto the mouth, pushed in. */
function Dossier({ d, t }: { d: DossierPose; t: Beat7Textures }) {
  const g = useDossierGeometry();
  const m = useDeskMats();
  const cover = useMemo(() => paper(t.dossier, HEX.paperLit), [t]);
  useLayoutEffect(() => () => cover.dispose(), [cover]);
  const q = d.squash;
  return (
    <group position={d.p} rotation={[0, -d.slope, d.heading, 'ZYX']} scale={[1 + q / 2, 1 + q / 2, 1 - q]}>
      <mesh geometry={g.body} material={[m.paperShade, m.paperShade, m.paperShade, m.paperShade, m.paper, m.paperShade]} />
      <mesh geometry={g.cover} material={cover} />
      <mesh geometry={g.sheets} material={m.paperLit} />
      <mesh geometry={g.tabs} material={m.enamelShade} />
    </group>
  );
}

export function Beat7Text(_props: { f: number; pose: CamPose }) {
  return null;
}
