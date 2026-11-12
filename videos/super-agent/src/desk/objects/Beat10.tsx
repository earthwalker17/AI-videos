/**
 * The objects of beat 10 (desk/beat10.ts; STORYBOARD 10.1-10.3), drawn in act two's world (objects/World.tsx, last). The
 * summary's world mounts World too: there DeskState.e10 is null and nothing of the beat is drawn (still (d)'s cap and
 * signed reply are objects/Trace.tsx's; the pencil and the vellum are objects/Proposed.tsx's, from beat9.ts proposedAt).
 * - 10.1: the hatched slip: a chat slip of the spout's size cross-hatched in graphite (45°, 2 px at an 8 px pitch at
 *   0.64×), its tail swallow-notched as every slip, from the chat spout over the gate up the belt into the throat;
 * - 10.2: the shard's reading window (vellum): fed out of the print head over the real one, slid south beside it, its
 *   record cell carrying a № one behind the real one's, right under it (the two disagree), then back and fed in again; Fix A's and Fix
 *   B's grey-stock cards (objects/FixCards.tsx) either side for one beat, never struck;
 * - 10.3: the request's report card #0405 (objects/Handshake.tsx CardHalves, its own face) out of the bug bay's work slit,
 *   flown under its transit light into the mouth and taken in under the deck; the bay's cap rising out of its slot and
 *   swinging shut over the slit, landing as still (d)'s cap (objects/Trace.tsx: the same body, place and material); the
 *   capped slot's glass unlit (Trace's dark); the reply #0405 (objects/Replies.tsx SignedReply) down the chute, its sides
 *   curled up the trough's walls, opening flat as it drops into your in-tray, at rest from `replyLands` exactly as still
 *   (d) lays it.
 * Cargo in motion never steps down; the cap steps with its bay.
 */
import type { CamPose } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, Color, MeshBasicMaterial, PlaneGeometry, Shape } from 'three';
import { CAP_10, CARDS_10, SHARD_WINDOW, SPOT_10, capLanded, pose0405, type Beat10State, type CapPose, type HijackPose, type ReportPose, type ShardWindow } from '../beat10.ts';
import { cardAt, cardIn, cardPose, cardSize } from '../beat4.ts';
import { extrude, slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { PRINT_CSS } from '../gl/print7.ts';
import { PRINT_EM, print, rule, texture, tooth } from '../gl/text.ts';
import { EMIT, Step, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, CACHE_WINDOW, CARD, NEXT_SLIP, PRINT_HEAD, WINDOW, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';
import { Counterfactual } from './Counterfactual.tsx';
import { FixAPlay, FixBPlay } from './FixCards.tsx';
import { CardHalves } from './Handshake.tsx';
import { VELLUM_INK } from './Proposed.tsx';
import { SignedReply } from './Replies.tsx';

export function Beat10({ s }: { s: DeskState }) {
  const e = s.e10;
  if (!e) return null;
  return <Beat10Body s={s} e={e} />;
}

function Beat10Body({ s, e }: { s: DeskState; e: Beat10State }) {
  return (
    <>
      {e.hijack && <Hijack h={e.hijack} />}
      {e.window && <ShardWindowSheet w={e.window} />}
      <FixCards s={s} />
      {e.report && <Report r={e.report} />}
      <CapSlot s={s} />
      {e.cap && (
        <Step on={isStepped(s.step, 'bugBay')}>
          <Cap c={e.cap} />
        </Step>
      )}
      {e.reply && <Reply0405 e={e} />}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// 10.1 the hatched slip

/** The hatching: 45° graphite strokes on the slip's paper (3.1 u at a 12.5 u pitch: 2 px at 8 px at 0.64×). */
function hatchedSlip(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.strokeStyle = '#3A3C3B';
  g.lineWidth = 3.1;
  g.lineCap = 'butt';
  g.beginPath();
  for (let c = -h; c < w + h; c += 12.5) {
    g.moveTo(c, h);
    g.lineTo(c + h, 0);
  }
  g.stroke();
  tooth(g, w, h);
}

function useHijackSlip() {
  const gl = useThree((x) => x.gl);
  const g = useMemo(() => {
    const hl = NEXT_SLIP.l / 2;
    const hw = NEXT_SLIP.w / 2;
    const sh = new Shape();
    sh.moveTo(-hl, -hw);
    sh.lineTo(hl, -hw);
    sh.lineTo(hl, hw);
    sh.lineTo(-hl, hw);
    sh.lineTo(-hl + 9, 0);
    sh.closePath();
    const slip = extrude(sh, -0.5, 0.5, 0);
    const pos = slip.getAttribute('position');
    const uv = slip.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + hl) / NEXT_SLIP.l, (pos.getY(i) + hw) / NEXT_SLIP.w);
    uv.needsUpdate = true;
    return slip;
  }, []);
  const mat = useMemo(() => paper(texture(NEXT_SLIP.l, NEXT_SLIP.w, (c) => hatchedSlip(c, NEXT_SLIP.l, NEXT_SLIP.w), Math.min(8, gl.capabilities.getMaxAnisotropy())), HEX.paperLit), [gl]);
  useLayoutEffect(
    () => () => {
      g.dispose();
      mat.map?.dispose();
      mat.dispose();
    },
    [g, mat],
  );
  return { g, mat };
}

/** The hatched slip at its pose: cargo in motion, never stepped; no transit light (it slips in unannounced). */
function Hijack({ h }: { h: HijackPose }) {
  const { g, mat } = useHijackSlip();
  return <mesh geometry={g} material={mat} position={h.p} rotation={[0, -h.slope, h.heading, 'ZYX']} />;
}

// ------------------------------------------------------------------------------------------------
// 10.2 the shard's reading window

const WIN = { w: WINDOW.frame.x1 - WINDOW.frame.x0, h: WINDOW.frame.y1 - WINDOW.frame.y0 } as const;
/** Vellum on the desk (objects/Proposed.tsx VELLUM_INK). */
const { fill: V_FILL, line: V_LINE, faint: V_FAINT } = VELLUM_INK;
/**
 * The shard's window in vellum, the real window's layout (layout.ts WINDOW, CACHE_WINDOW at this point of the film): its
 * frame (dashed), the record's cell and the stubs east of it; in the record's cell, right where the real window prints the
 * request's № (#0405), the shard's newest №, one behind it, with its rule under it: the two windows disagree on the same
 * cell. Canvas x is world x from the frame's west edge, canvas y world y down from its north edge.
 */
const SHARD_NO = { text: '#0404', cx: 181, base: 42, em: 26 } as const;
function shardSheet(g: CanvasRenderingContext2D, w: number, h: number): void {
  const x0 = WINDOW.frame.x0;
  g.fillStyle = V_FILL;
  g.fillRect(2, 2, w - 4, h - 4);
  g.strokeStyle = V_LINE;
  g.lineWidth = 3;
  g.setLineDash([16, 11]);
  g.strokeRect(4, 4, w - 8, h - 8);
  // the record's cell and the stubs that fit in the frame (their outlines faint)
  g.setLineDash([8, 6]);
  g.strokeStyle = V_FAINT;
  g.lineWidth = 2;
  const [r0, r1] = CACHE_WINDOW.record;
  g.strokeRect(r0 - x0, 12, r1 - r0, h - 24);
  for (const s of CACHE_WINDOW.stubX0) if (s + CACHE_WINDOW.stub <= WINDOW.frame.x1 - 4) g.strokeRect(s - x0, 12, CACHE_WINDOW.stub, h - 24);
  g.setLineDash([]);
  // the shard's №, where the real one is, and its rule
  print(g, PRINT_CSS, SHARD_NO.text, SHARD_NO.cx, SHARD_NO.base, SHARD_NO.em, 700, V_LINE, 'center');
  rule(g, SHARD_NO.cx - 34, SHARD_NO.base + 6, SHARD_NO.cx + 34, SHARD_NO.base + 6, 2.6, V_LINE);
}
function useShardMat() {
  const gl = useThree((x) => x.gl);
  const mat = useMemo(() => new MeshBasicMaterial({ map: texture(WIN.w, WIN.h, (c) => shardSheet(c, WIN.w, WIN.h), Math.min(8, gl.capabilities.getMaxAnisotropy()), 'transparent'), transparent: true, depthWrite: false }), [gl]);
  useLayoutEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
    },
    [mat],
  );
  return mat;
}
/** The shard's window: fed out of the print head's east face (only what is out of it drawn: its plane and UVs cut there), lying over the real window, slid south beside it. Vellum: no shadow. */
function ShardWindowSheet({ w }: { w: ShardWindow }) {
  const mat = useShardMat();
  const out = Math.round(w.out * 1000) / 1000;
  const g = useMemo(() => {
    const k = Math.max(0.001, out);
    const geo = new PlaneGeometry(WIN.w * k, WIN.h);
    const uv = geo.getAttribute('uv') as BufferAttribute;
    // the head feeds it out east: its east end leads, so what shows is the texture's east `out`
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - k + uv.getX(i) * k);
    uv.needsUpdate = true;
    geo.translate(PRINT_HEAD.box.x1 + (WIN.w * k) / 2, rectC(WINDOW.frame)[1], SHARD_WINDOW.z);
    return geo;
  }, [out]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  if (out <= 0) return null;
  return <mesh geometry={g} material={mat} position={[0, w.dy, 0]} renderOrder={2} />;
}

// ------------------------------------------------------------------------------------------------
// 10.2 Fix A's and Fix B's cards

function FixCards({ s }: { s: DeskState }) {
  const c = cardAt(s.f, CARDS_10);
  if (!c) return null;
  return (
    <>
      <Counterfactual pose={cardPose(c, SPOT_10.fixA)} w={cardSize(SPOT_10.fixA).w} h={cardSize(SPOT_10.fixA).h} strike={0} inFrame={cardIn(c)}>
        <FixAPlay play={c.play} />
      </Counterfactual>
      <Counterfactual pose={cardPose(c, SPOT_10.fixB)} w={cardSize(SPOT_10.fixB).w} h={cardSize(SPOT_10.fixB).h} strike={0} inFrame={cardIn(c)}>
        <FixBPlay play={c.play} />
      </Counterfactual>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// 10.3 the report card #0405, the cap, the reply

/** The report card's face: the request's ID and its result (gl/text.ts's report card, #0405's), the crease it would fold along. */
function reportFace(g: CanvasRenderingContext2D, w: number, h: number): void {
  print(g, PRINT_CSS, '#0405', 3, 30, 28, 700);
  print(g, PRINT_CSS, 'pins pass', 4, 58, PRINT_EM, 500);
  g.setLineDash([2.4, 2.4]);
  rule(g, 3, h / 2, w - 3, h / 2, 0.8, '#B5AFA3');
  g.setLineDash([]);
  tooth(g, w, h);
}
function useReportFaces() {
  const gl = useThree((x) => x.gl);
  const m = useDeskMats();
  const own = useMemo(() => {
    const front = paper(texture(CARD.w, CARD.d, (c) => reportFace(c, CARD.w, CARD.d), Math.min(8, gl.capabilities.getMaxAnisotropy())), HEX.paperLit);
    // its own transit light (the one transit light rides the carrier in flight: no other flies now)
    const transit = new MeshBasicMaterial({ color: new Color('#000000') });
    return { front, transit };
  }, [gl]);
  useLayoutEffect(
    () => () => {
      own.front.map?.dispose();
      own.front.dispose();
      own.transit.dispose();
    },
    [own],
  );
  return { body: m.paperLit, front: own.front, back: own.front, transit: own.transit };
}
/** The report card #0405: standing in the work slit, pushed up out of it; in flight turning to the mouth's tilt under its transit light; docked; taken in under the deck. */
function Report({ r }: { r: ReportPose }) {
  const faces = useReportFaces();
  const t = r.transit;
  useLayoutEffect(() => {
    faces.transit.color.set(LIGHT_HEX.work).multiplyScalar(EMIT.transit * t);
  }, [faces, t]);
  // (reportAt's squash is the 3% itself)
  const sq = r.squash;
  const arc = r.s ?? 0;
  return (
    <group position={r.p} rotation={[r.tilt, -0.1 * Math.sin(Math.PI * arc), 0.04 * Math.sin(Math.PI * arc)]} scale={[1 + sq, 1 - sq, 1]}>
      <CardHalves fold={0} light={t > 0} faces={faces} />
    </group>
  );
}

/** Still (d)'s cap (objects/Trace.tsx): an enamel slab over the work slot's slit, z 30-34. */
const SLOT = BAYS.bug.slot;
const CAP_BOX = { x0: SLOT.x0 + 3, x1: SLOT.x1 - 3, y0: rectC(SLOT)[1] - 11, y1: rectC(SLOT)[1] + 11 } as const;
/** It hinges along its north edge, on the slot block's top. */
const HINGE: P3 = [0, CAP_BOX.y1, 30];
/** How deep in its slot it waits, standing (u under the hinge). */
const CAP_DEPTH = 26;

function useCapGeometry() {
  const g = useMemo(() => ({ rest: slab(CAP_BOX, 30, 34, 2, 1), hinged: slab({ x0: CAP_BOX.x0, x1: CAP_BOX.x1, y0: CAP_BOX.y0 - CAP_BOX.y1, y1: 0 }, 0, 4, 2, 1) }), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** The cap: risen standing on its hinge out of the slot, swung shut over the slit (falling); landed, exactly Trace.tsx's slab. Drawn with its bay's set. */
function Cap({ c }: { c: CapPose }) {
  const m = useDeskMats();
  const g = useCapGeometry();
  if (capLanded(c)) return <mesh geometry={g.rest} material={m.enamelShade} />;
  return (
    <group position={[HINGE[0], HINGE[1], HINGE[2] - CAP_DEPTH * (1 - c.rise)]} rotation={[-(Math.PI / 2) * (1 - c.swing), 0, 0]}>
      <mesh geometry={g.hinged} material={m.enamelShade} />
    </group>
  );
}
/**
 * The capped slot's glass: once its light starts to die it falls to still (d)'s capped dark (Trace.tsx's #2A2D2C, never
 * darker than the floor tone) instead of the idle slot's, geometric per channel as objects/Bay.tsx slotColour, written
 * every frame after BugBay's.
 */
const CAPPED_DARK = '#2A2D2C';
function CapSlot({ s }: { s: DeskState }) {
  const sets = useDeskSets();
  const on = s.f >= CAP_10.lightFrom;
  const light = s.bugLight;
  useLayoutEffect(() => {
    if (!on) return;
    const idle = new Color(CAPPED_DARK);
    const lit = new Color(LIGHT_HEX.work).multiplyScalar(EMIT.slot);
    for (const set of [sets.full, sets.stepped]) {
      if (light <= 0) set.slotBug.color.copy(idle);
      else set.slotBug.color.setRGB(idle.r * (lit.r / idle.r) ** light, idle.g * (lit.g / idle.g) ** light, idle.b * (lit.b / idle.b) ** light);
    }
  });
  return null;
}

/** The reply #0405 on its way down the chute (its sides curled up the trough's walls), opening flat into your in-tray; at rest from `replyLands`, still (d)'s. */
function Reply0405({ e }: { e: Beat10State }) {
  const r = e.reply!;
  const landed = r.arc >= 1;
  if (landed) return <SignedReply printFamily={PRINT_CSS} />;
  const p = pose0405(r);
  return <SignedReply printFamily={PRINT_CSS} pose={p} curl={p.curl} />;
}

export function Beat10Text(_props: { f: number; pose: CamPose }) {
  return null;
}
