/**
 * Intake (synthesis §2, element sheet): where messages enter, west of the Register.
 * - Feeders: the chat ticker spout and the CI card feeder in enamel (built); the mail slot and the
 *   calendar pad are vellum drawings lying on the desk (generic, FACTS l.115). The conversation
 *   spool beside the chat spout is where the Thread cords start.
 * - The Fast Path: a steel gate of fingers across the intake (code, not the Router) and the spike
 *   where dropped noise is impaled; survivors ride the belt up into the Register's throat.
 */
import { useMemo } from 'react';
import { Shape } from 'three';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, slab, sweep, tube } from '../geom.ts';
import { useDeskMats } from '../kit.tsx';
import { BELT, FEEDERS, FEEDER_H, GATE, SPIKE, SPOOL, rectC, type P2, type P3, type Rect } from '../layout.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

function useIntakeGeometry() {
  return useMemo(() => {
    // the chat ticker: a housing with a top plate, a mouth on its east face, a slip coming out
    const C = FEEDERS.chat;
    const chatBody = slab(C, 0, FEEDER_H.chat, 12, 3);
    const chatTop = slab(inset(C, 8), FEEDER_H.chat, FEEDER_H.chat + 4, 8, 1.2);
    const chatSlot = planeOn({ x0: C.x0 + 22, x1: C.x1 - 22, y0: rectC(C)[1] - 3, y1: rectC(C)[1] + 3 }, FEEDER_H.chat + 4.3);
    const mouth = (() => {
      // a short spout trough from the east face, sloping down to the desk
      const y = rectC(C)[1];
      return sweep(
        [
          [C.x1 - 4, y, 36],
          [C.x1 + 22, y, 30],
          [C.x1 + 46, y - 4, 18],
        ],
        // clockwise in (across, up): the faces' normals point out of the trough's wall
        [
          [-24, 10],
          [-21, 10],
          [-21, 3],
          [21, 3],
          [21, 10],
          [24, 10],
          [24, 0],
          [-24, 0],
          [-24, 10],
        ],
        12,
      );
    })();
    const ticker = (() => {
      const g = plane(80, 40, 0, 0, 0);
      g.rotateZ(-0.05);
      g.translate(C.x1 + 64, rectC(C)[1] - 8, 1.2);
      return g;
    })();
    // the conversation spool on its post: two flanges, the wound cords (vermilion, graphite)
    const spoolPost = merge([cylinderZ(6, 0, SPOOL.z[0], SPOOL.x, SPOOL.y, 16), disc(18, 0, 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1 })]);
    const flanges = merge([disc(SPOOL.r, SPOOL.z[0], SPOOL.z[0] + 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2 }), disc(SPOOL.r, SPOOL.z[1] - 4, SPOOL.z[1], { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2 })]);
    const barrel = cylinderZ(12, SPOOL.z[0] + 4, SPOOL.z[1] - 4, SPOOL.x, SPOOL.y, 24);
    const woundV = cylinderZ(21, SPOOL.z[0] + 6, SPOOL.z[0] + 24, SPOOL.x, SPOOL.y, 40);
    const woundG = cylinderZ(20, SPOOL.z[0] + 25, SPOOL.z[1] - 6, SPOOL.x, SPOOL.y, 40);
    const spoolCap = dome(6, SPOOL.x, SPOOL.y, SPOOL.z[1]);

    // the CI card feeder: an enamel hopper with a stack of punched cards
    const F = FEEDERS.ci;
    const ciBody = merge([slab(F, 0, FEEDER_H.ci - 10, 10, 3), frame(F, 9, FEEDER_H.ci - 10, FEEDER_H.ci, 10, 1.5)]);
    const cards = slab(inset(F, 14), FEEDER_H.ci - 10, FEEDER_H.ci - 4, 2, 0.5);
    const cardTop = (() => {
      const g = plane(84, 50, rectC(F)[0], rectC(F)[1], FEEDER_H.ci - 3.7);
      return g;
    })();
    const ciChute = slab({ x0: F.x1 - 4, x1: F.x1 + 30, y0: rectC(F)[1] - 26, y1: rectC(F)[1] + 26 }, 2, 12, 3, 1.2);

    // vellum drawings: the mail slot and the calendar pad (proposed as feeders after the turn)
    const mail = planeOn(FEEDERS.mail, 0.4);
    const calendar = planeOn(FEEDERS.calendar, 0.4);

    // the gate: a steel bar with fingers reaching west over the intake
    const G = GATE.bar;
    const gateBar = slab(G, 0, GATE.h, 3, 1.5);
    const gateCap = slab(inset(G, 2), GATE.h, GATE.h + 3, 2, 0.8);
    const fingers = merge(
      Array.from({ length: GATE.fingers }, (_, i) => {
        const y = G.y0 + 10 + ((G.y1 - G.y0 - 20) * i) / (GATE.fingers - 1);
        return merge([
          tube(
            [
              [G.x0 + 2, y, GATE.h - 10],
              [G.x0 - GATE.fingerL * 0.6, y, GATE.h - 12],
              [G.x0 - GATE.fingerL, y, GATE.h - 18],
            ],
            2.6,
            10,
            8,
          ),
          dome(3, G.x0 - GATE.fingerL, y, GATE.h - 20),
        ]);
      }),
    );
    // the spike: a base, a tapered pin, the dropped slips impaled on it
    const spikeBase = disc(SPIKE.baseR, 0, 6, { cx: SPIKE.x, cy: SPIKE.y, bevel: 2 });
    const spikePin = cylinderZ(3.2, 6, SPIKE.h, SPIKE.x, SPIKE.y, 14, 0.4);
    const slips = Array.from({ length: 6 }, (_, i) => {
      const g = plane(56, 64, 0, 0, 0);
      // impaled through the hole near its foot (texture: 20, 44 from the top left of 56 x 64)
      g.translate(28 - 20, 32 - 44, 0);
      g.rotateZ(0.9 * i + 0.35);
      g.translate(SPIKE.x, SPIKE.y, 8 + i * 4.2);
      return g;
    });
    // the belt from the gate up into the throat: a ribbed band between enamel rails
    const beltPath: P3[] = [BELT.from, [(BELT.from[0] + BELT.to[0]) / 2, (BELT.from[1] + BELT.to[1]) / 2, (BELT.from[2] + BELT.to[2]) / 2 + 2], BELT.to];
    const w = BELT.w / 2;
    const belt = sweep(
      beltPath,
      [
        [-w, 0],
        [w, 0],
        [w, -4],
        [-w, -4],
        [-w, 0],
      ],
      20,
    );
    const railsG = merge(
      [-1, 1].map((k) => {
        const d = [BELT.to[0] - BELT.from[0], BELT.to[1] - BELT.from[1]];
        const l = Math.hypot(d[0], d[1]);
        const side: P2 = [(-d[1] / l) * (w + 3) * k, (d[0] / l) * (w + 3) * k];
        return tube(
          beltPath.map((p) => [p[0] + side[0], p[1] + side[1], p[2] + 5] as P3),
          3,
          20,
          8,
        );
      }),
    );
    const ribs = merge(
      Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.5) / 9;
        const p: P3 = [BELT.from[0] + (BELT.to[0] - BELT.from[0]) * t, BELT.from[1] + (BELT.to[1] - BELT.from[1]) * t, BELT.from[2] + (BELT.to[2] - BELT.from[2]) * t];
        const ang = Math.atan2(BELT.to[1] - BELT.from[1], BELT.to[0] - BELT.from[0]);
        const s = new Shape();
        s.moveTo(-2, -w + 3);
        s.lineTo(2, -w + 3);
        s.lineTo(2, w - 3);
        s.lineTo(-2, w - 3);
        s.closePath();
        const g = extrude(s, 0, 2.2, 0.4);
        g.rotateZ(ang);
        g.translate(p[0], p[1], p[2] + 0.6);
        return g;
      }),
    );
    const beltLegs = merge(
      [0.25, 0.7].map((t) => {
        const p: P3 = [BELT.from[0] + (BELT.to[0] - BELT.from[0]) * t, BELT.from[1] + (BELT.to[1] - BELT.from[1]) * t, BELT.from[2] + (BELT.to[2] - BELT.from[2]) * t];
        return merge([cylinderZ(4, 0, p[2] - 4, p[0], p[1], 12), disc(10, 0, 3, { cx: p[0], cy: p[1], bevel: 0.8 })]);
      }),
    );
    // a chat slip just landed before the gate
    const arriving = (() => {
      const g = plane(80, 40, 0, 0, 0);
      g.rotateZ(0.18);
      g.translate(G.x0 - GATE.fingerL - 64, rectC(G)[1] - 14, 1.0);
      return g;
    })();
    return {
      chatBody,
      chatTop,
      chatSlot,
      mouth,
      ticker,
      spoolPost,
      flanges,
      barrel,
      woundV,
      woundG,
      spoolCap,
      ciBody,
      cards,
      cardTop,
      ciChute,
      mail,
      calendar,
      gateBar,
      gateCap,
      fingers,
      spikeBase,
      spikePin,
      slips,
      belt,
      railsG,
      ribs,
      beltLegs,
      arriving,
    };
  }, []);
}

export function Intake() {
  const m = useDeskMats();
  const g = useIntakeGeometry();
  return (
    <group>
      <mesh geometry={g.chatBody} material={m.enamel} />
      <mesh geometry={g.chatTop} material={m.graphite} />
      <mesh geometry={g.chatSlot} material={m.hollow} />
      <mesh geometry={g.mouth} material={m.enamelShade} />
      <mesh geometry={g.ticker} material={m.printed.chat} />
      <mesh geometry={g.spoolPost} material={m.graphite} />
      <mesh geometry={g.flanges} material={m.enamel} />
      <mesh geometry={g.barrel} material={m.graphiteDark} />
      <mesh geometry={g.woundV} material={m.cordVermilion} />
      <mesh geometry={g.woundG} material={m.cordGraphite} />
      <mesh geometry={g.spoolCap} material={m.steel} />
      <mesh geometry={g.ciBody} material={m.enamel} />
      <mesh geometry={g.cards} material={m.paper} />
      <mesh geometry={g.cardTop} material={m.printed.card} />
      <mesh geometry={g.ciChute} material={m.enamelShade} />
      <mesh geometry={g.mail} material={m.vellumMail} />
      <mesh geometry={g.calendar} material={m.vellumCalendar} />
      <mesh geometry={g.gateBar} material={m.graphite} />
      <mesh geometry={g.gateCap} material={m.enamelShade} />
      <mesh geometry={g.fingers} material={m.steel} />
      <mesh geometry={g.spikeBase} material={m.enamelShade} />
      <mesh geometry={g.spikePin} material={m.steel} />
      {g.slips.map((geo, i) => (
        <mesh key={i} geometry={geo} material={m.printed.spike[i]} />
      ))}
      <mesh geometry={g.belt} material={m.graphiteDark} />
      <mesh geometry={g.railsG} material={m.enamelShade} />
      <mesh geometry={g.ribs} material={m.graphite} />
      <mesh geometry={g.beltLegs} material={m.graphite} />
      <mesh geometry={g.arriving} material={m.printed.chat} />
    </group>
  );
}
