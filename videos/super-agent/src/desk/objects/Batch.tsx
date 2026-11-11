/**
 * Beat 6.1-6.2, batching (STORYBOARD 6.1-6.2; desk/beat6.ts): the moving parts of the gulp and the stress plate.
 * - The gather tray on the deck plate along the reading window's south edge: two graphite rims and a low hood at each
 *   end (the slips come out from under the east one and are drawn in under the west one, toward the print head).
 * - The batch's events (beat6.ts STRIP_KINDS): a chat ask rides as a chat slip (its tail cut in a swallow notch), a CI
 *   event as the card feeder's punched card; each is posted over the gate, rides the belt and hops into the throat, is fed
 *   under the head and comes out from under the tray's west hood as a strip slip (its kind at its nose: gl/print6.ts),
 *   sliding east and shingling onto the strip; read (their paper lit: a colour, never emission) as the reading bar sweeps
 *   the strip on the batch's downbeat; drawn in under the west hood together. In the tray a slip is a flat card, nose
 *   east, cropped at the hoods' middles (what is under a hood is not drawn).
 * - The reading bar: a steel bar across the tray, its shoes on the rims, parked by the east hood; it comes up out of the
 *   deck plate with the tray.
 * - The decode slip: out of the slot in the head's south face, one punched cell per decodeCell frames; torn off, it swings
 *   nose down and drops straight into the dispatch slot under it (the decision leaves as dispatches). The slot is the deck
 *   plate's own: its cover slides aside before the first decision.
 * - The stress plate: in from the east, pressed onto the deck's south rail on its two hooks on `plate-detent`, its face
 *   engraved (gl/plate.ts stressTexture); it steps down with N5's focus and stays down (the late set from STRESS_LATE).
 */
import { useLayoutEffect, useMemo } from 'react';
import { Color, PlaneGeometry, Shape, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { BATCHES, BAR_RIDE, DECODE, DISPATCH_SLOT, E6, REVIEW, STRESS_PLATE, TRAY, TRAY_Y, slotOpenAt, trayUp, type DecodeSlip, type StripSlip } from '../beat6.ts';
import { dome, extrude, merge, planeOn, slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { Step, WithMats, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { DECK, NEXT_SLIP, type Rect } from '../layout.ts';
import { STRESS_LATE, type DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/** The chat slip (NEXT_SLIP's size): a thin paper body, its tail cut in a swallow notch; its print's UVs from its outline. */
function stripSlipGeometry(): BufferGeometry {
  const hl = NEXT_SLIP.l / 2;
  const hw = NEXT_SLIP.w / 2;
  const s = new Shape();
  s.moveTo(-hl, -hw);
  s.lineTo(hl, -hw);
  s.lineTo(hl, hw);
  s.lineTo(-hl, hw);
  s.lineTo(-hl + 9, 0);
  s.closePath();
  const g = extrude(s, -0.4, 0.4, 0);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + hl) / NEXT_SLIP.l, (pos.getY(i) + hw) / NEXT_SLIP.w);
  uv.needsUpdate = true;
  return g;
}

/** The card feeder's punched card (Dispatch.tsx ciGeometry's form, 84 x 50): its clipped corner at its north-west, print UVs from its outline (a CI event on the belt, the review card). */
export function ciCardGeometry(): BufferGeometry {
  const hl = REVIEW.l / 2;
  const hw = REVIEW.w / 2;
  const s = new Shape();
  s.moveTo(-hl + 9, hw);
  s.lineTo(hl, hw);
  s.lineTo(hl, -hw);
  s.lineTo(-hl, -hw);
  s.lineTo(-hl, hw - 9);
  s.closePath();
  const g = extrude(s, -0.4, 0.4, 0);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / REVIEW.l + 0.5, pos.getY(i) / REVIEW.w + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** The reading bar (across the tray, along y) and its two shoes. */
const BAR = { l: TRAY.y1 - TRAY.y0 + 12, w: 5, h: 4, shoe: BAR_RIDE - 1 } as const;
/** The tray's hoods: low graphite housings over each end, their lips enamel. */
const HOOD_Z = 9;

function useBatchGeometry() {
  const g = useMemo(() => {
    const slip = stripSlipGeometry();
    const card = ciCardGeometry();
    const bar = merge([
      slab({ x0: -BAR.w / 2, x1: BAR.w / 2, y0: -BAR.l / 2, y1: BAR.l / 2 }, -BAR.h / 2, BAR.h / 2, 1.2, 0.6),
      ...[-1, 1].map((k) => slab({ x0: -BAR.w / 2 - 1, x1: BAR.w / 2 + 1, y0: k * (BAR.l / 2 - 3) - 3, y1: k * (BAR.l / 2 - 3) + 3 }, -BAR.shoe, -BAR.h / 2, 1, 0.4)),
    ]);
    const T = TRAY;
    const rims = merge([
      slab({ x0: T.x0, x1: T.x1, y0: T.y0 - 3, y1: T.y0 }, T.floor, T.floor + T.rim, 0.6, 0.3),
      slab({ x0: T.x0, x1: T.x1, y0: T.y1, y1: T.y1 + 1.5 }, T.floor, T.floor + T.rim, 0.4, 0.2),
    ]);
    const hoods = merge(
      [
        { x0: T.x0, x1: T.x0 + T.hood },
        { x0: T.x1 - T.hood, x1: T.x1 },
      ].map((h) => slab({ ...h, y0: T.y0 - 3, y1: T.y1 + 1.5 }, T.floor + 2.4, T.floor + HOOD_Z, 2.5, 1)),
    );
    const lips = merge([slab({ x0: T.x0 + T.hood - 1.6, x1: T.x0 + T.hood, y0: T.y0 - 2, y1: T.y1 + 0.5 }, T.floor + 2.4, T.floor + HOOD_Z + 0.6, 0.4, 0.2), slab({ x0: T.x1 - T.hood, x1: T.x1 - T.hood + 1.6, y0: T.y0 - 2, y1: T.y1 + 0.5 }, T.floor + 2.4, T.floor + HOOD_Z + 0.6, 0.4, 0.2)]);
    // a slip lying in the tray: a unit card, cropped per frame
    const S = DISPATCH_SLOT;
    const slotBox: Rect = { x0: S.x - S.w / 2, x1: S.x + S.w / 2, y0: S.y - S.d / 2, y1: S.y + S.d / 2 };
    const slot = {
      mouth: planeOn(slotBox, S.z + 0.05),
      lips: merge([-1, 1].map((k) => slab({ x0: slotBox.x0 - 2, x1: slotBox.x1 + 2, y0: S.y + k * (S.d / 2 + 1) - 1, y1: S.y + k * (S.d / 2 + 1) + 1 }, S.z, S.z + 1.2, 0.4, 0.2))),
      cover: slab(inset(slotBox, -0.5), S.z + 0.08, S.z + 0.4, 0.4, 0.1),
    };
    const P = STRESS_PLATE.box;
    const [z0, z1] = STRESS_PLATE.z;
    const plate = {
      back: slab(P, z0, z0 + 2, 4, 0.8),
      body: slab(inset(P, 3), z0 + 2, z1, 3, 1),
      face: planeOn(inset(P, 5), z1 + 0.2),
      bolts: merge([P.x0 + 8, P.x1 - 8].flatMap((x) => [P.y0 + 8, P.y1 - 8].map((y) => dome(2.4, x, y, z1)))),
      // its two hooks: from its north edge over the rail's top, curling down its far side
      hooks: merge(STRESS_PLATE.hooks.map((x) => merge([slab({ x0: x - 7, x1: x + 7, y0: P.y1 - 8, y1: DECK.y0 + DECK.rail - 2 }, DECK.top, DECK.top + 2.4, 1, 0.5), slab({ x0: x - 7, x1: x + 7, y0: DECK.y0 + DECK.rail - 4, y1: DECK.y0 + DECK.rail - 1.5 }, DECK.top - 8, DECK.top + 2.4, 0.8, 0.4)]))),
    };
    return { slip, card, bar, rims, hoods, lips, slot, plate };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of [g.slip, g.card, g.bar, g.rims, g.hoods, g.lips, ...Object.values(g.slot), ...Object.values(g.plate)]) x.dispose();
    },
    [g],
  );
  return g;
}

/** A slip's index among all the beat's slips. */
const FIRST = BATCHES.map((_, k) => BATCHES.slice(0, k).reduce((a, b) => a + b.n, 0));
const SLIPS = BATCHES.reduce((a, b) => a + b.n, 0);

/** The batches' slips' own materials (each lights as it is read: its paper's colour, never emission) by kind, their flat cards in the tray, and a CI event's card on the belt. */
function useSlips(): { mats: MeshStandardMaterial[]; cards: PlaneGeometry[]; ciCard: MeshStandardMaterial } {
  const { textures } = useDeskSets();
  const mats = useMemo(
    () =>
      BATCHES.flatMap((b) =>
        b.kinds.map((k) => {
          const m = paper(k.kind === 'chat' ? textures.b6.tray.chat[k.v % textures.b6.tray.chat.length]! : textures.b6.tray.ci, HEX.paper);
          m.alphaTest = 0.5;
          return m;
        }),
      ),
    [textures],
  );
  const ciCard = useMemo(() => paper(textures.ciCard, HEX.paper), [textures]);
  const cards = useMemo(() => Array.from({ length: SLIPS }, () => new PlaneGeometry(1, 1)), []);
  useLayoutEffect(
    () => () => {
      for (const m of [...mats, ciCard]) m.dispose();
      for (const c of cards) c.dispose();
    },
    [mats, cards, ciCard],
  );
  return { mats, cards, ciCard };
}

const IDLE = new Color(HEX.paper);
const LIT = new Color(HEX.paperLit);

function StripSlips({ strip, geometry, card }: { strip: StripSlip[]; geometry: BufferGeometry; card: BufferGeometry }) {
  const { mats, cards, ciCard } = useSlips();
  const key = strip.map((x) => `${x.b}.${x.i}:${x.lit.toFixed(3)}:${x.view ? x.view.map((v) => v.toFixed(2)).join('/') : ''}:${x.pose.p[0].toFixed(2)}`).join(',');
  useLayoutEffect(() => {
    // every slip's paper from its own read state, every frame (an unread slip idle, a read one lit)
    for (const m of mats) m.color.copy(IDLE);
    for (const x of strip) {
      const k = FIRST[x.b]! + x.i;
      mats[k]!.color.copy(IDLE).lerp(LIT, x.lit);
      if (!x.view) continue;
      // the card's crop: nose east (u 1), tail west (u 0), its print upright to the camera (north edge v 1)
      const c = x.pose.p[0];
      const u0 = (x.view[0] - (c - NEXT_SLIP.l / 2)) / NEXT_SLIP.l;
      const u1 = (x.view[1] - (c - NEXT_SLIP.l / 2)) / NEXT_SLIP.l;
      const uv = cards[k]!.getAttribute('uv');
      // a plane's uv order: (0,1) (1,1) (0,0) (1,0): top-left, top-right, bottom-left, bottom-right
      uv.setXY(0, u0, 1);
      uv.setXY(1, u1, 1);
      uv.setXY(2, u0, 0);
      uv.setXY(3, u1, 0);
      uv.needsUpdate = true;
    }
  }, [mats, cards, strip, key]);
  return (
    <>
      {strip.map((x) => {
        if (x.hidden) return null;
        const k = FIRST[x.b]! + x.i;
        if (x.inTray && x.view)
          return <mesh key={`${x.b}.${x.i}`} geometry={cards[k]} material={mats[k]} position={[(x.view[0] + x.view[1]) / 2, TRAY_Y, x.pose.p[2]]} scale={[x.view[1] - x.view[0], NEXT_SLIP.w * (1 - 0.01 * x.squash), 1]} />;
        // on the intake: a chat ask as its slip, a CI event as its punched card
        const ci = x.kind.kind === 'ci';
        return (
          <group key={`${x.b}.${x.i}`} position={x.pose.p} rotation={[0, -x.pose.slope, x.pose.heading, 'ZYX']} scale={[1 + 0.015 * x.squash, 1, 1 - 0.03 * x.squash]}>
            <mesh geometry={ci ? card : geometry} material={ci ? ciCard : mats[k]} />
          </group>
        );
      })}
    </>
  );
}

/** A slip printed out of the head's slot (the decode, the answer): its north edge at `p`, hanging `pitch` down, turned `yaw`; the cells out so far, cropped from its leading end. */
export function PrintedSlip({ x, mats, geometry }: { x: DecodeSlip; mats: readonly MeshStandardMaterial[]; geometry: BufferGeometry }) {
  const len = DECODE.cell * x.out;
  const v1 = x.out / x.cells;
  useLayoutEffect(() => {
    const uv = geometry.getAttribute('uv');
    // a plane's uv: (0,1) (1,1) (0,0) (1,0): its top row (the slot's end) at the cells out so far
    uv.setXY(0, 0, v1);
    uv.setXY(1, 1, v1);
    uv.needsUpdate = true;
  }, [geometry, v1]);
  if (len <= 0.01) return null;
  return (
    <group position={x.p} rotation={[-x.pitch, 0, x.yaw, 'ZXY']}>
      <mesh geometry={geometry} material={mats[Math.min(mats.length - 1, x.punched)]} scale={[DECODE.w, len, 1]} />
    </group>
  );
}

/** A punched slip's materials by how many cells are punched (the holes cut, never drawn). */
export function usePunchedMats(which: 'decode' | 'answer'): MeshStandardMaterial[] {
  const { textures } = useDeskSets();
  const mats = useMemo(
    () =>
      textures.b6[which].map((t) => {
        const m = paper(t, HEX.paperLit);
        m.alphaTest = 0.5;
        return m;
      }),
    [textures, which],
  );
  useLayoutEffect(
    () => () => {
      for (const m of mats) m.dispose();
    },
    [mats],
  );
  return mats;
}


export function Batch({ s }: { s: DeskState }) {
  const g = useBatchGeometry();
  const decodeMats = usePunchedMats('decode');
  const decodeQuad = useMemo(() => new PlaneGeometry(1, 1).translate(0, -0.5, 0), []);
  useLayoutEffect(() => () => decodeQuad.dispose(), [decodeQuad]);
  const m = useDeskMats();
  const e = s.e6;
  const bar = e.bar;
  const act = s.f < E6.until;
  // the dispatch slot's cover: aside for the batches' decisions, back once the last has dropped through (beat6.ts slotOpenAt)
  const opened = slotOpenAt(s.f);
  // the tray rises out of the deck plate over 8 f on the dolly's way in (flush, inside the plate, before) and sinks back into it once the queue is clear
  const up = trayUp(s.f);
  const rise = -(HOOD_Z + 0.6) * (1 - up);
  const plate = e.plate;
  const pc: [number, number] = [(STRESS_PLATE.box.x0 + STRESS_PLATE.box.x1) / 2, (STRESS_PLATE.box.y0 + STRESS_PLATE.box.y1) / 2];
  return (
    <>
      <StripSlips strip={e.strip} geometry={g.slip} card={g.card} />
      {bar && bar.up > 0 && (
        // it rises with the tray: wholly inside the deck plate before, riding over the strip on its shoes after
        <group position={[bar.x, TRAY_Y - 1, TRAY.floor - BAR.h / 2 + (BAR_RIDE + BAR.h / 2) * bar.up]}>
          <mesh geometry={g.bar} material={m.steel} />
        </group>
      )}
      {e.decode && <PrintedSlip x={e.decode} mats={decodeMats} geometry={decodeQuad} />}
      {act && (
        <Step on={isStepped(s.step, 'deck')}>
          <WithMats>
            {(d) => (
              <>
                {/* the gather tray: its rims, its hoods and their lips */}
                {up > 0 && (
                  <group position={[0, 0, rise]}>
                    <mesh geometry={g.rims} material={d.graphite} />
                    <mesh geometry={g.hoods} material={d.graphite} />
                    <mesh geometry={g.lips} material={d.graphiteDark} />
                  </group>
                )}
                {/* the dispatch slot under the head's slot: its cover, the deck plate's own, slides aside before the first decision and back after the last */}
                {opened > 0 && <mesh geometry={g.slot.mouth} material={d.graphiteDark} />}
                {opened > 0 && <mesh geometry={g.slot.lips} material={d.graphite} position={[0, 0, -1.2 * (1 - opened)]} />}
                {up > 0 && <mesh geometry={g.slot.cover} material={d.graphiteDeck} position={[(DISPATCH_SLOT.w + 2) * opened, 0, -0.5 * (1 - up)]} />}
              </>
            )}
          </WithMats>
        </Step>
      )}
      {plate && (
        <Step on={s.f >= STRESS_LATE ? 'late' : isStepped(s.step, 'stress')}>
          <WithMats>
            {(n) => (
              // in flight, pressed down, seated: posed about its own centre, squashed as it seats
              <group position={[pc[0] + plate.d[0], pc[1] + plate.d[1], STRESS_PLATE.z[0] + plate.d[2]]} rotation={[plate.tilt, 0, plate.turn]} scale={[1 + plate.squash / 2, 1 + plate.squash / 2, 1 - plate.squash]}>
                <group position={[-pc[0], -pc[1], -STRESS_PLATE.z[0]]}>
                  <mesh geometry={g.plate.back} material={n.graphiteDark} />
                  <mesh geometry={g.plate.body} material={n.enamel} />
                  <mesh geometry={g.plate.face} material={n.printed.stress} />
                  <mesh geometry={g.plate.bolts} material={n.steel} />
                  <mesh geometry={g.plate.hooks} material={n.steel} />
                </group>
              </group>
            )}
          </WithMats>
        </Step>
      )}
    </>
  );
}
