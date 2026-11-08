/**
 * Intake (synthesis §2, element sheet): where messages enter, west of the Register.
 * - Feeders: the chat ticker, an enamel drum with a spout and its slip coming out whole; the CI
 *   feeder, an enamel hopper with a punched card in its mouth (two silhouette families); the mail
 *   slot and the calendar pad are vellum plan drawings of the same box-and-mouth feeders (proposed:
 *   generic in act one, FACTS l.115). The conversation spool beside the chat drum starts the Thread cord.
 * - The Fast Path: a steel gate of fingers across the intake (code, not the Router); survivors ride
 *   the belt up into the Register's throat. (The spike for dropped noise enters at 5.2, f2470.)
 * In C12 all of it steps down (state.ts FOCUS_BEATS).
 */
import { useMemo } from 'react';
import { Shape } from 'three';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, slab, sweep, tube } from '../geom.ts';
import { Step, WithMats, isStepped } from '../kit.tsx';
import { BELT, FEEDERS, FEEDER_H, GATE, SPOOL, rectC, type P2, type P3, type Rect } from '../layout.ts';
import type { DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

function useFeederGeometry() {
  return useMemo(() => {
    // the chat ticker: an enamel drum, a graphite lid with its slot, a spout off its east side and the slip in it
    const C = FEEDERS.chat;
    const [cx, cy] = rectC(C);
    const r = (C.y1 - C.y0) / 2;
    const drum = merge([cylinderZ(r, 0, FEEDER_H.chat - 4, cx, cy, 56), disc(r + 2, FEEDER_H.chat - 6, FEEDER_H.chat, { cx, cy, bevel: 1.6 })]);
    const lid = disc(r - 10, FEEDER_H.chat, FEEDER_H.chat + 3, { cx, cy, bevel: 1 });
    const lidSlot = planeOn({ x0: cx - 26, x1: cx + 26, y0: cy - 3, y1: cy + 3 }, FEEDER_H.chat + 3.3);
    const spoutY = cy - 4;
    const spout = sweep(
      [
        [cx + r - 8, spoutY, 30],
        [cx + r + 18, spoutY, 24],
        [cx + r + 40, spoutY, 14],
      ],
      [
        [-26, 10],
        [-23, 10],
        [-23, 3],
        [23, 3],
        [23, 10],
        [26, 10],
        [26, 0],
        [-26, 0],
        [-26, 10],
      ],
      12,
    );
    // the slip: its west end still in the spout, the rest lying out on the desk in front of it, whole
    const slip = (() => {
      const g = plane(96, 40, 0, 0, 0);
      g.translate(cx + r + 72, spoutY, 0.8);
      return g;
    })();
    const spoolPost = merge([cylinderZ(6, 0, SPOOL.z[0], SPOOL.x, SPOOL.y, 16), disc(18, 0, 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1 })]);
    const flanges = merge([disc(SPOOL.r, SPOOL.z[0], SPOOL.z[0] + 4, { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2 }), disc(SPOOL.r, SPOOL.z[1] - 4, SPOOL.z[1], { cx: SPOOL.x, cy: SPOOL.y, bevel: 1.2 })]);
    const barrel = cylinderZ(12, SPOOL.z[0] + 4, SPOOL.z[1] - 4, SPOOL.x, SPOOL.y, 24);
    const wound = cylinderZ(21, SPOOL.z[0] + 6, SPOOL.z[1] - 6, SPOOL.x, SPOOL.y, 40);
    const spoolCap = dome(6, SPOOL.x, SPOOL.y, SPOOL.z[1]);

    // the CI feeder: a rectangular enamel hopper, a card stack inside, the punched card in its east mouth
    const F = FEEDERS.ci;
    const ciBody = merge([slab(F, 0, FEEDER_H.ci - 8, 6, 3), frame(F, 9, FEEDER_H.ci - 8, FEEDER_H.ci, 6, 1.5)]);
    const cards = slab(inset(F, 14), FEEDER_H.ci - 10, FEEDER_H.ci - 5, 2, 0.5);
    const topCard = planeOn(inset(F, 14), FEEDER_H.ci - 4.7);
    const ciMouth = merge([slab({ x0: F.x1 - 4, x1: F.x1 + 22, y0: rectC(F)[1] - 32, y1: rectC(F)[1] + 32 }, 0, 8, 2, 1), slab({ x0: F.x1 - 4, x1: F.x1 + 22, y0: rectC(F)[1] + 26, y1: rectC(F)[1] + 32 }, 8, 18, 1, 0.6)]);
    const ciCard = (() => {
      const g = plane(84, 50, 0, 0, 0);
      g.translate(F.x1 + 30, rectC(F)[1] - 2, 8.6);
      return g;
    })();

    // vellum drawings: the mail and calendar feeders, proposed
    const mail = planeOn(FEEDERS.mail, 0.4);
    const calendar = planeOn(FEEDERS.calendar, 0.4);
    return { drum, lid, lidSlot, spout, slip, spoolPost, flanges, barrel, wound, spoolCap, ciBody, cards, topCard, ciMouth, ciCard, mail, calendar };
  }, []);
}

function useGateGeometry() {
  return useMemo(() => {
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
    // (the spike enters at 5.2, f2470: it is not in this shot)
    return { gateBar, gateCap, fingers };
  }, []);
}

function useBeltGeometry() {
  return useMemo(() => {
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
    const rails = merge(
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
    const legs = merge(
      [0.25, 0.7].map((t) => {
        const p: P3 = [BELT.from[0] + (BELT.to[0] - BELT.from[0]) * t, BELT.from[1] + (BELT.to[1] - BELT.from[1]) * t, BELT.from[2] + (BELT.to[2] - BELT.from[2]) * t];
        return merge([cylinderZ(4, 0, p[2] - 4, p[0], p[1], 12), disc(10, 0, 3, { cx: p[0], cy: p[1], bevel: 0.8 })]);
      }),
    );
    return { belt, rails, ribs, legs };
  }, []);
}

export function Feeders({ s }: { s: DeskState }) {
  const g = useFeederGeometry();
  return (
    <Step on={isStepped(s.step, 'intake')}>
      <WithMats>
        {(m) => (
          <group>
            <mesh geometry={g.drum} material={m.enamel} />
            <mesh geometry={g.lid} material={m.graphite} />
            <mesh geometry={g.lidSlot} material={m.hollow} />
            <mesh geometry={g.spout} material={m.enamelShade} />
            <mesh geometry={g.slip} material={m.printed.chat} />
            <mesh geometry={g.spoolPost} material={m.graphite} />
            <mesh geometry={g.flanges} material={m.enamel} />
            <mesh geometry={g.barrel} material={m.graphiteDark} />
            <mesh geometry={g.wound} material={m.cordVermilion} />
            <mesh geometry={g.spoolCap} material={m.steel} />
            <mesh geometry={g.ciBody} material={m.enamel} />
            <mesh geometry={g.cards} material={m.paperLit} />
            <mesh geometry={g.topCard} material={m.printed.ciCard} />
            <mesh geometry={g.ciMouth} material={m.enamelShade} />
            <mesh geometry={g.ciCard} material={m.printed.ciCard} />
            <mesh geometry={g.mail} material={m.vellumMail} />
            <mesh geometry={g.calendar} material={m.vellumCalendar} />
          </group>
        )}
      </WithMats>
    </Step>
  );
}

export function Gate({ s }: { s: DeskState }) {
  const g = useGateGeometry();
  const b = useBeltGeometry();
  return (
    <>
      <Step on={isStepped(s.step, 'gate')}>
        <WithMats>
          {(m) => (
            <group>
              <mesh geometry={g.gateBar} material={m.graphite} />
              <mesh geometry={g.gateCap} material={m.enamelShade} />
              <mesh geometry={g.fingers} material={m.steel} />
            </group>
          )}
        </WithMats>
      </Step>
      <Step on={isStepped(s.step, 'belt')}>
        <WithMats>
          {(m) => (
            <group>
              <mesh geometry={b.belt} material={m.graphiteDark} />
              <mesh geometry={b.rails} material={m.enamelShade} />
              <mesh geometry={b.ribs} material={m.graphite} />
              <mesh geometry={b.legs} material={m.graphite} />
            </group>
          )}
        </WithMats>
      </Step>
    </>
  );
}
