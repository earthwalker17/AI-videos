/**
 * Part 2's replies to you (state.ts DeskState.replies, after MT1's #0408, which objects/Handshake.tsx draws as it always
 * did): each rides the chute into your in-tray on state.ts replyRideAt and lies at its own rest (replyPose).
 * - 7.4's chat reply (desk/beat7.ts replies7, id '7-chat'): a short slip (layout.ts SLIP, MT1's family) with its print
 *   (a bubble and two short faint lines) and an enamel stop tab clipped over its trailing end, "≤ 100" on it in the film's
 *   sans (WORDS.tag100's limit; gl/print7.ts), standing proud of the slip. Light: it carries no transit light.
 * (Lane C adds #0405's in wave 2.)
 */
import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { BoxGeometry, MeshPhysicalMaterial } from 'three';
import { STOP_TAB } from '../beat7.ts';
import { plane, slab } from '../geom.ts';
import { HEX, enamel, paper } from '../gl/materials.ts';
import { SANS_CSS, chatReplyTextures } from '../gl/print7.ts';
import { useDeskMats } from '../kit.tsx';
import { SLIP } from '../layout.ts';
import { replyPose, type ReplyState } from '../state.ts';

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
  const g = useChatReplyGeometry();
  const gl = useThree((st) => st.gl);
  const tex = useMemo(() => chatReplyTextures(SANS_CSS, Math.min(8, gl.capabilities.getMaxAnisotropy())), [gl]);
  const mats = useMemo(() => ({ face: paper(tex.reply, HEX.paperLit), tab: enamel(tex.tab, (m.enamel as MeshPhysicalMaterial).envMap!, HEX.enamel) }), [tex, m]);
  useLayoutEffect(() => () => [...Object.values(mats), ...Object.values(tex)].forEach((x) => x.dispose()), [mats, tex]);
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
