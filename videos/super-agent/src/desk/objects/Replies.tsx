/**
 * Part 2's replies to you (state.ts DeskState.replies, after MT1's #0408, which objects/Handshake.tsx draws as it always
 * did): each rides the chute into your in-tray on state.ts replyRideAt and lies at its own rest (replyPose).
 * - 7.4's chat reply (desk/beat7.ts replies7, id '7-chat'): a short slip (layout.ts SLIP, MT1's family) with its print
 *   (a bubble and two short faint lines) and an enamel stop tab clipped over its trailing end, "≤ 100" on it in the film's
 *   sans (WORDS.tag100's limit; gl/print7.ts), standing proud of the slip. Light: it carries no transit light.
 * - The request's reply #0405 (`SignedReply`): the slip your stamp signs off at the summary, its ID along the top in the
 *   print face (objects/Trace.tsx draws it at rest in your in-tray from the seam; desk/beat10.ts rides it down the chute
 *   in bar 68 before it, landing exactly there). Light: it carries no transit light.
 */
import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { BoxGeometry, MeshPhysicalMaterial, PlaneGeometry, type BufferAttribute, type BufferGeometry } from 'three';
import { STOP_TAB } from '../beat7.ts';
import { REPLY_0405 } from '../beat10.ts';
import { plane, slab } from '../geom.ts';
import { HEX, enamel, matte, paper } from '../gl/materials.ts';
import { SANS_CSS, chatReplyTextures } from '../gl/print7.ts';
import { ID_EM, INK, print, texture } from '../gl/text.ts';
import { useDeskMats, useStepMode } from '../kit.tsx';
import { SLIP, type P3 } from '../layout.ts';
import { replyPose, type ReplyState } from '../state.ts';

/**
 * The request's reply #0405 as still (d) lays it in your in-tray (desk/beat10.ts REPLY_0405, where its ride lands): on top of
 * the others, 7.4's chat reply's stop tab under it too; its ID (the teaching chain's, as a mark at 0.5×), its size (its ID
 * along the top, the green stamp below it, never over the ID), its centre, height and turn.
 */
export const SIGNED_REPLY = { id: '#0405', l: REPLY_0405.size[0], w: REPLY_0405.size[1], at: REPLY_0405.rest, turn: REPLY_0405.turn } as const;
/** The lamp-lit slip's albedo: under your lamp's warm white it lands on lit paper (#E4DFD3), never amber. */
const SIGNED_HEX = '#9FA1A0';

/**
 * The reply wider than the chute's trough (72 u in a 54 u bed between walls 12 u high): riding it, its long sides curl up
 * against the walls (a bed 55 u wide, each side 8.5 u standing; under the deck's plate its sides stay under the plate's
 * top), and they open flat again as it hops off the lip into the tray (desk/beat10.ts).
 */
export const REPLY_CURL = { bed: 27.5, segs: 18 } as const;
/** The reply's plane with its long sides turned up `curl` of a right angle about the bed's edges (its print follows the paper). */
function curledPlane(l: number, w: number, curl: number): BufferGeometry {
  const g = new PlaneGeometry(l, w, 1, REPLY_CURL.segs);
  const pos = g.getAttribute('position') as BufferAttribute;
  const a = (Math.PI / 2) * curl;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const out = Math.abs(y) - REPLY_CURL.bed;
    if (out <= 0) continue;
    pos.setY(i, Math.sign(y) * (REPLY_CURL.bed + out * Math.cos(a)));
    pos.setZ(i, out * Math.sin(a));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * The reply #0405: at rest in your in-tray (no `pose`: still (d)'s plane, as objects/Trace.tsx draws it), or at a pose on
 * its way there (its centre, heading and slope, its sides curled `curl` up the chute's walls: desk/beat10.ts).
 * `printFamily`: the print face (FilmFrame.tsx PRINT_CSS).
 */
export function SignedReply({ printFamily, pose, curl = 0 }: { printFamily: string; pose?: { p: P3; heading: number; slope: number }; curl?: number }) {
  const gl = useThree((st) => st.gl);
  const R = SIGNED_REPLY;
  const g = useMemo(() => ({ rest: plane(R.l, R.w, R.at[0], R.at[1], R.at[2], R.turn), free: plane(R.l, R.w, 0, 0, 0) }), [R]);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const mat = useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const x = matte('#FFFFFF', 0.9);
    x.map = texture(R.l, R.w, (c) => print(c, printFamily, R.id, 7, 32, ID_EM, 700, INK), an);
    x.color.set(SIGNED_HEX);
    return x;
  }, [gl, printFamily, R]);
  useLayoutEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
    },
    [mat],
  );
  const k = Math.round(curl * 1000) / 1000;
  const curled = useMemo(() => (pose && k > 0 ? curledPlane(R.l, R.w, k) : null), [pose !== undefined, k, R]);
  useLayoutEffect(() => () => curled?.dispose(), [curled]);
  if (!pose) return <mesh geometry={g.rest} material={mat} />;
  return <mesh geometry={curled ?? g.free} material={mat} position={pose.p} rotation={[0, pose.slope, pose.heading, 'ZYX']} />;
}

function useChatReplyGeometry() {
  const g = useMemo(() => {
    const slip = new BoxGeometry(SLIP.l, SLIP.w, 1.2);
    const face = plane(SLIP.l, SLIP.w, 0, 0, 0.9);
    // the stop tab over the slip's trailing end, out past it by STOP_TAB.over, and its face
    const x1 = SLIP.l / 2 + STOP_TAB.over;
    const x0 = x1 - STOP_TAB.w;
    const tab = slab({ x0, x1, y0: -STOP_TAB.h / 2, y1: STOP_TAB.h / 2 }, -0.6, 2.4, 2, 0.6);
    const tabFace = plane(STOP_TAB.w - 2, STOP_TAB.h - 2, (x0 + x1) / 2, 0, 2.45);
    return { slip, face, tab, tabFace };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** 7.4's chat reply with its "≤ 100" stop tab, at its ride's pose. */
export function ChatReply({ r }: { r: ReplyState }) {
  const m = useDeskMats();
  // its own print and tab step with the set it rides (lying in your in-tray, your desk's: objects/Links.tsx Cargo)
  const mode = useStepMode();
  const g = useChatReplyGeometry();
  const gl = useThree((st) => st.gl);
  const tex = useMemo(() => chatReplyTextures(SANS_CSS, Math.min(8, gl.capabilities.getMaxAnisotropy())), [gl]);
  useLayoutEffect(() => () => Object.values(tex).forEach((x) => x.dispose()), [tex]);
  const mats = useMemo(() => ({ face: paper(tex.reply, HEX.paperLit, { stepped: mode }), tab: enamel(tex.tab, (m.enamel as MeshPhysicalMaterial).envMap!, HEX.enamel, { stepped: mode }) }), [tex, m, mode]);
  useLayoutEffect(() => () => Object.values(mats).forEach((x) => x.dispose()), [mats]);
  const pose = replyPose(r.ride, r.rest);
  const squash = 1 - 0.03 * r.ride.squash;
  return (
    <group position={[pose.p[0], pose.p[1], pose.p[2] - 0.4 * r.ride.squash]} rotation={[0, pose.slope, pose.heading, 'ZYX']} scale={[1, 1, squash]}>
      <mesh geometry={g.slip} material={m.paperLit} />
      <mesh geometry={g.face} material={mats.face} />
      <mesh geometry={g.tab} material={m.enamelShade} />
      <mesh geometry={g.tabFace} material={mats.tab} />
    </group>
  );
}
