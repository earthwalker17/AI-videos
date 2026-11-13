/**
 * The objects of beats 12 and 13 (desk/end.ts, desk/endCard.ts), and the end's DOM text (`EndText`, the end key's words):
 * - in the summary's world (FilmFrame.tsx SummaryFrame, from bar 76): the bookend slip, which is the chat drum's spout
 *   slip (objects/Intake.tsx draws it until then; this draws the same piece in the same place, with the intake's step,
 *   from f6000), turning vermilion and riding out into the Register; the next slip the ticker feeds out of the spout;
 *   the dissolve's veil (gl/veil.ts) and the end card posted in with it (the incoming layer: the bare desk laid over the
 *   world at the dissolve's alpha, the card opaque over both, END_CARD_OVER);
 * - in the end's own world (desk/EndFrame.tsx, from the card's landing): the card and the end key's plate.
 * Built from the kit's materials and programs; the veil's program is the one new one (gl/veil.ts).
 */
import type { CamPose } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { Color, PlaneGeometry, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { GREY_TEXT, Label } from '../../kit/text.tsx';
import { useFilmFonts } from '../../look/fonts.ts';
import { E_END, SPOUT_SLIP, type EndState, type SlipPose } from '../end.ts';
import { END_CARD, END_KEY, END_KEY_SCREEN, endCardAt, endCardFootprints, endKeyAt, endPools } from '../endCard.ts';
import { project } from '../camera.ts';
import { piece } from '../geom.ts';
import { HEX, paper, whiteTexture } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { END_LIGHT, VEIL_PASS, makeDepthReset, makeVeilMaterial, setEndLight, veilAlpha, veilBlend } from '../gl/veil.ts';
import { isStepped } from '../kit.tsx';
import { KEY_WORDS } from '../beat11.ts';
import { cueReveal } from '../onScreen.ts';
import { TEXT_HEX } from '../Overlay.tsx';
import { TEXT_OUT } from '../../cues.ts';
import type { DeskState } from '../state.ts';
import { KEY_TYPE, KeyLegend } from './Beat11.tsx';
import { chatSlipPrint } from './Intake.tsx';
import { CARD_HEX, CARD_T, cardCentre, cardGeometry, useCardTexture, type CardState } from './TitleCard.tsx';

/** The end card's blend over the dissolve (EndCardBody `over`): opaque, a card laid on the desk as it dissolves. */
export const END_CARD_OVER = 1;
/** The summary's world from bar 76: the bookend slip and the next one, the dissolve's veil, the end card posted in with it. */
export function End({ s, printFamily }: { s: DeskState; printFamily: string }) {
  const e = s.end;
  if (!e) return null;
  const card = endCardAt(s.f);
  const alpha = veilAlpha(e.veil);
  return (
    <>
      <Slips s={s} e={e} />
      {e.veil > 0 && <Veil alpha={alpha} />}
      <EndLight f={s.f} />
      {/* the card is posted in opaque over the dissolve (session 6's stranger read it, blended in at the dissolve's alpha, as
          a compositing error: the lamp and the in-tray showed through it); it still takes the end's light and the veil's pass */}
      {card.present && e.veil > 0 && <EndCardBody f={s.f} printFamily={printFamily} over={END_CARD_OVER} />}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// The bookend slip and the next one

/** The spout's slip as objects/Intake.tsx builds it: its print (its seed), its piece, at its place (the same vertices). */
function useSlipParts() {
  const g = useMemo(() => {
    const atRest = piece('chat', 96, 40, 0.8);
    atRest.translate(SPOUT_SLIP[0], SPOUT_SLIP[1], 0);
    const centred = piece('chat', 96, 40, 0.8);
    centred.translate(0, 0, -0.4);
    return { atRest, centred };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const tex = useMemo(() => texture(96, 40, (c) => chatSlipPrint(c, 96, 40, 11), 4), []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  // each slip's own materials in every mode the kit steps (Intake.tsx's: they step with the intake while they lie in the spout)
  const make = () => {
    const m = (stepped: boolean | 'own' | 'late') => paper(tex, undefined, { stepped });
    return { full: m(false), stepped: m(true), own: m('own'), late: m('late') };
  };
  const mats = useMemo(() => ({ bookend: make(), next: make() }), [tex]);
  useLayoutEffect(() => () => Object.values(mats).forEach((set) => Object.values(set).forEach((x) => x.dispose())), [mats]);
  return { g, mats };
}
const PAPER_C = new Color(HEX.paper);
const VERMILION_C = new Color(HEX.vermilion);

function Slips({ s, e }: { s: DeskState; e: EndState }) {
  const { g, mats } = useSlipParts();
  // the intake's step mode, as objects/Intake.tsx picks its own sets
  const on = isStepped(s.step, 'intake');
  const pick = (set: Record<'full' | 'stepped' | 'own' | 'late', MeshStandardMaterial>) => (on === 'own' ? set.own : on === 'late' ? set.late : on ? set.stepped : set.full);
  // the request motif: the slip's paper turns vermilion (the kit's vermilion paper), its print kept
  useLayoutEffect(() => {
    for (const m of Object.values(mats.bookend)) m.color.copy(PAPER_C).lerp(VERMILION_C, e.ink);
  }, [mats, e.ink]);
  return (
    <>
      {e.slip && <BookendSlip pose={e.slip} at={g.atRest} centred={g.centred} mat={e.slip.lying ? pick(mats.bookend) : mats.bookend.full} />}
      {e.next > 0 && (
        // fed out of the spout's mouth from inside the drum (its hidden part inside the spout and the drum), a third a tick
        <group position={[e.next - 96, 0, 0]}>
          <mesh geometry={g.atRest} material={pick(mats.next)} />
        </group>
      )}
    </>
  );
}

function BookendSlip({ pose, at, centred, mat }: { pose: SlipPose; at: BufferGeometry; centred: BufferGeometry; mat: MeshStandardMaterial }) {
  // lying in the spout: the very piece Intake.tsx drew there
  if (pose.lying) return <mesh geometry={at} material={mat} />;
  const sq = pose.squash;
  return (
    <group position={pose.p} rotation={[pose.roll, -pose.slope, pose.heading, 'ZYX']} scale={[1 + 0.015 * sq, 1, 1 - 0.03 * sq]}>
      <mesh geometry={centred} material={mat} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The dissolve (13.1) and the end's own light

/**
 * The veil: the bare desk over everything at the dissolve's alpha (gl/veil.ts): the depth reset first (the desk plane's
 * depth, no colour), then (after the card, if it is posted yet) the bare desk wherever the plane is the nearest. Both on
 * one geometry, so their depths are the same.
 */
function Veil({ alpha }: { alpha: number }) {
  const geometry = useMemo(() => new PlaneGeometry(9000, 7000), []);
  const material = useMemo(() => ({ reset: makeDepthReset(), veil: makeVeilMaterial() }), []);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.reset.dispose();
      material.veil.dispose();
    },
    [geometry, material],
  );
  useLayoutEffect(() => {
    material.veil.blendAlpha = alpha;
  }, [material, alpha]);
  return (
    <>
      <mesh geometry={geometry} material={material.reset} renderOrder={VEIL_PASS.depth} frustumCulled={false} />
      <mesh geometry={geometry} material={material.veil} renderOrder={VEIL_PASS.desk} frustumCulled={false} />
    </>
  );
}

/** The end's own light over the dissolve: the card's shadows and the end's pool (gl/veil.ts END_LIGHT; the veil and the card take it). */
function EndLight({ f }: { f: number }) {
  useLayoutEffect(() => {
    setEndLight(endCardFootprints(f), endPools(f));
  }, [f]);
  return null;
}

// ------------------------------------------------------------------------------------------------
// The end card and the key's plate

/**
 * The end card's body (objects/TitleCard.tsx's board, its stock and its print): in the summary's world (`over`: the
 * dissolve's alpha) it is part of the incoming layer, lit by END_LIGHT and blended over the world at that alpha between the
 * veil's depth reset and its bare desk (gl/veil.ts); in the end's own world, an ordinary body on the bare desk.
 */
export function EndCardBody({ f, printFamily, over }: { f: number; printFamily: string; over?: number }) {
  const s = endCardAt(f);
  const tex = useCardTexture(END_CARD, printFamily);
  const layer = over !== undefined;
  const mat = useMemo(() => {
    const light = layer ? END_LIGHT : undefined;
    const face = paper(tex, CARD_HEX.paper, { roughness: 0.86, light });
    const edge = paper(whiteTexture(), CARD_HEX.edge, { roughness: 0.9, light });
    if (layer) for (const m of [face, edge]) veilBlend(m);
    return [face, edge];
  }, [tex, layer]);
  useLayoutEffect(() => () => mat.forEach((m) => m.dispose()), [mat]);
  useLayoutEffect(() => {
    if (over !== undefined) for (const m of mat) m.blendAlpha = over;
  }, [mat, over]);
  const geo = useMemo(() => cardGeometry(END_CARD), []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  if (!s.present) return null;
  const c = cardCentre(END_CARD);
  return <mesh geometry={geo} material={mat} position={[c[0] + s.off[0], c[1] + s.off[1], s.off[2]]} renderOrder={layer ? VEIL_PASS.card : 0} />;
}

/** The end key's plate: beat 11's legend plate and its samples (objects/Beat11.tsx KeyLegend), scaled and set for the bookend's framing (endCard.ts END_KEY). */
export function EndKey({ f }: { f: number }) {
  const k = endKeyAt(f);
  if (!k) return null;
  const { scale, from, to } = END_KEY;
  return (
    <group position={[to[0] - from[0] * scale, to[1] - from[1] * scale + k.dy, 0]} scale={[scale, scale, scale]}>
      <KeyLegend dy={0} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The DOM text: the card's lettering (13.2)

/**
 * The end card's lettering (the 'end' card cue: a 6 f wipe in from the landing, left to right; its print stays on the card
 * as it leaves, never faded off it first: session 6's stranger saw a blank cream card leave), set on the card through the
 * camera line by line: each line starts where its baseline's start point on the card's top face is
 * seen and takes the card's own scale there across and down the frame (about 1.59 and 1.53 px a unit), its glyphs upright.
 * (TitleCard.tsx CardText fits one affine to the card's corners: on this card, which spans most of the frame's width, the
 * frame's perspective leans its west edge about 42 px over its depth, and that fit set the lettering in a false italic.)
 */
export function EndCardText({ f, family, pose, state }: { f: number; family: string; pose: CamPose; state: CardState }) {
  const c = END_CARD;
  if (!state.present || f < c.frames.land) return null;
  const top = c.place.z + CARD_T + state.off[2];
  const at = (x: number, y: number): [number, number] => project(pose, [c.place.x0 + x + state.off[0], c.place.y1 - y + state.off[1], top]);
  return (
    <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {c.lines.map((l, i) => {
        const cr = cueReveal(l.cue, f);
        // from the cue's fade on the print is whole: it leaves with the card (endCardAt's offset carries it)
        const r = f >= c.frames.leave - TEXT_OUT ? { visible: true, wipe: 1, opacity: 1 } : cr;
        if (!r.visible) return null;
        const a = at(l.x, l.y);
        const sx = (at(l.x + 100, l.y)[0] - a[0]) / 100;
        const sy = (a[1] - at(l.x, l.y - 10)[1]) / 10;
        const id = `end-card-wipe-${i}`;
        return (
          <g key={i} opacity={r.opacity} transform={`translate(${a[0].toFixed(3)} ${a[1].toFixed(3)}) scale(${sx.toFixed(5)} ${sy.toFixed(5)})`}>
            <defs>
              <clipPath id={id}>
                <rect x={-4} y={-l.size * 1.2} width={(c.place.w - l.x + 8) * r.wipe} height={l.size * 1.6} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${id})`}>
              <Label x={0} y={0} text={l.text} family={family} size={l.size} weight={l.weight} cjkWeight={l.cjkWeight ?? l.weight} color={l.color} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------------------------------------
// The DOM text: the end key's words (13.2), beside their samples, dead still while they are read

/** The key's words (the map key's look: beat 11's KEY_TYPE, EN in one column and zh in the next, each row on its sample): they wipe in on the end-key cue, the plate settled under them, and fade before it leaves. */
export function EndText({ f }: { f: number }) {
  const { fonts, ready } = useFilmFonts();
  const r = cueReveal('end-key', f);
  if (!ready || !r.visible || f < E_END.from) return null;
  const K = END_KEY_SCREEN;
  const x0 = K.en - 8;
  const w = 1824 - x0 + 12;
  return (
    <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: r.opacity }}>
      <defs>
        <clipPath id="wipe-end-key">
          <rect x={x0} y={0} width={w * r.wipe} height={1080} />
        </clipPath>
      </defs>
      <g clipPath="url(#wipe-end-key)">
        {KEY_WORDS.map((wd, i) => {
          const y = K.ys[i]! + 13;
          return (
            <g key={i}>
              <Label x={K.en} y={y} text={wd.en} family={fonts.sans} size={KEY_TYPE.size} weight={KEY_TYPE.weight} cjkWeight={KEY_TYPE.cjkWeight} color={TEXT_HEX.en} />
              <Label x={K.zh} y={y} text={wd['zh-Hans']} family={fonts.sans} size={KEY_TYPE.size} weight={KEY_TYPE.cjkWeight} cjkWeight={KEY_TYPE.cjkWeight} color={TEXT_HEX.zh} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
