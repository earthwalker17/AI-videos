/**
 * Beat 10.2's counterfactual cards (desk/beat10.ts cards10; STORYBOARD 10.2: "C7's choice, back"): Fix A and Fix B in
 * grey stock, the two easy fixes of beat 3 (desk/beat3.ts) as miniatures on beat 4's cards (objects/Counterfactual.tsx),
 * up either side of the Register for one beat as N9 says sharding brings the trade-off back. Never struck: they slide
 * away. Face units: the card's centre at the origin, +y north (its top edge), 300 x 184.
 * - Fix A (one session for everything): four feeders down the card's west side, each dropping onto one long tape that runs
 *   south past them and turns east into one fat folder, its stack piled askew; the queue on the tape nose to tail, the
 *   grey copy of the request among them (1.3x a slip, its beetle cut through); on the beat the queue moves one station.
 * - Fix B (a session per event): eight trays scattered, none alike, each holding its own event (a chat slip, a punched
 *   card, an envelope, a calendar leaf) beside its own small dossier; a follow-up of tray 2's task lies in tray 6, and
 *   tray 2 keeps the torn stub where it should have joined.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Shape, type BufferGeometry } from 'three';
import { extrude, merge } from '../geom.ts';
import type { P2 } from '../layout.ts';
import { RELIEF, circle, jitter, polyShape, rect, solid, useReliefMats } from './Counterfactual.tsx';

/** A chat slip in plan (its east end notched), `l` × `w` about its centre, turned `a`. */
function slipShape(cx: number, cy: number, l: number, w: number, a = 0, beetle = false): Shape {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (x: number, y: number): P2 => [cx + x * c - y * s, cy + x * s + y * c];
  const sh = polyShape([at(-l / 2, -w / 2), at(l / 2, -w / 2), at(l / 2 - 5, 0), at(l / 2, w / 2), at(-l / 2, w / 2)]);
  if (beetle) {
    const h = circle(cx - l * 0.22 * c, cy - l * 0.22 * s, w * 0.2);
    sh.holes.push(h);
  }
  return sh;
}
/** A punched card in plan (its north-west corner clipped). */
const cardShape = (cx: number, cy: number, w: number, h: number): Shape =>
  polyShape([
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2 + 5, cy + h / 2],
    [cx - w / 2, cy + h / 2 - 5],
  ]);
/** An envelope in plan (its flap's V as two thin strips). */
function envelope(cx: number, cy: number, w: number, h: number): { body: Shape; flap: Shape[] } {
  const body = rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, 0.8);
  const strip = (x0: number, y0: number, x1: number, y1: number): Shape => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * 0.8;
    const ny = (dx / l) * 0.8;
    return polyShape([
      [x0 - nx, y0 - ny],
      [x1 - nx, y1 - ny],
      [x1 + nx, y1 + ny],
      [x0 + nx, y0 + ny],
    ]);
  };
  return { body, flap: [strip(cx - w / 2 + 1, cy + h / 2 - 1, cx, cy), strip(cx, cy, cx + w / 2 - 1, cy + h / 2 - 1)] };
}

// ------------------------------------------------------------------------------------------------
// Fix A

/** The feeders down the west side (their mouths facing east), the tape's run (west column south, then east along the foot), the folder. */
const A = {
  feeders: [62, 30, -2, -34] as const,
  feederX: -128,
  tapeX: -100,
  tapeY: -62,
  folder: [92, -50, 74, 58] as const,
  pitch: 22,
  slips: 9,
} as const;
/** A station on the tape: 0 at the top of its west run, counting south, then east along its foot (u along the tape). */
function onTape(u: number): { p: P2; a: number } {
  const down = 70 - A.tapeY;
  if (u <= down) return { p: [A.tapeX, 70 - u], a: -Math.PI / 2 };
  return { p: [A.tapeX + (u - down), A.tapeY], a: 0 };
}

function fixAGeometry(): { body: BufferGeometry; ink: BufferGeometry; slip: BufferGeometry; request: BufferGeometry } {
  const feeders = A.feeders.map((y) => rect(A.feederX - 14, y - 9, A.feederX + 12, y + 9, 2));
  const chutes = A.feeders.map((y) => rect(A.feederX + 12, y - 3, A.tapeX - 5, y + 3, 0.6));
  // the tape: its west run and its foot into the folder (raised clear of the card), sprocket ticks along it
  const tape = [rect(A.tapeX - 6, A.tapeY - 6, A.tapeX + 6, 74, 1), rect(A.tapeX - 6, A.tapeY - 6, A.folder[0] - A.folder[2] / 2 + 6, A.tapeY + 6, 1)];
  const [fx, fy, fw, fh] = A.folder;
  const folder = rect(fx - fw / 2, fy - fh / 2, fx + fw / 2, fy + fh / 2, 3);
  const body = merge([solid([...feeders, folder], 0, RELIEF * 1.6), solid(tape, 0, RELIEF * 0.8), solid(chutes, 0, RELIEF * 1.1)]);
  // the folder's stack: sheets piled askew on it, each a step up
  const pile = Array.from({ length: 6 }, (_, i) => {
    const a = jitter(i, 3) * 0.12;
    const s = slipShape(fx + jitter(i, 7) * 4, fy + jitter(i, 9) * 4, fw - 18, fh - 20, a);
    return extrude(s, RELIEF * 1.6 + i * 0.7, RELIEF * 1.6 + i * 0.7 + 0.6, 0.2, 1);
  });
  const ticks = solid(
    Array.from({ length: 11 }, (_, i) => {
      const { p } = onTape(6 + i * A.pitch);
      return circle(p[0] + (p[1] > A.tapeY + 1 ? -4.2 : 0), p[1] + (p[1] > A.tapeY + 1 ? 0 : -4.2), 0.9);
    }),
    RELIEF * 0.8,
    RELIEF * 0.8 + 0.5,
  );
  return {
    body,
    ink: merge([...pile, ticks]),
    slip: extrude(slipShape(0, 0, 19, 10), 0, 0.9, 0.2, 1),
    request: extrude(slipShape(0, 0, 25, 13, 0, true), 0, 0.9, 0.2, 1),
  };
}

/** Fix A's play: the queue on its one tape, moving one station on the beat after the card settles (6 f, eased), the request waiting among them. */
export function FixAPlay({ play }: { play: number }) {
  const m = useReliefMats();
  const g = useMemo(() => fixAGeometry(), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const t = Math.min(1, Math.max(0, (play - 2) / 6));
  const step = A.pitch * (t * t * (3 - 2 * t));
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.body} material={m.dark} />
      <mesh geometry={g.ink} material={m.light} />
      {Array.from({ length: A.slips }, (_, i) => {
        const { p, a } = onTape(10 + i * A.pitch + step);
        const request = i === 3;
        return <mesh key={i} geometry={request ? g.request : g.slip} material={m.light} position={[p[0], p[1], RELIEF * 0.8 + 0.4]} rotation={[0, 0, a + jitter(i, 2) * 0.06]} />;
      })}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Fix B

/** The eight trays: centre, size, turn (scattered, none alike), and what each holds. */
const TRAYS: readonly { c: P2; w: number; h: number; a: number; event: 'chat' | 'card' | 'mail' | 'leaf' }[] = [
  { c: [-104, 46], w: 58, h: 40, a: 0.06, event: 'chat' },
  { c: [-36, 52], w: 52, h: 38, a: -0.05, event: 'card' },
  { c: [34, 44], w: 60, h: 36, a: 0.04, event: 'mail' },
  { c: [104, 50], w: 50, h: 42, a: -0.08, event: 'chat' },
  { c: [-96, -30], w: 54, h: 42, a: -0.04, event: 'leaf' },
  { c: [-26, -40], w: 62, h: 38, a: 0.07, event: 'chat' },
  { c: [44, -32], w: 50, h: 40, a: -0.03, event: 'card' },
  { c: [110, -38], w: 56, h: 36, a: 0.05, event: 'mail' },
];
/** A tray's frame: a rim round its floor (a rect with a rect hole), turned `a` about its centre. */
function trayRim(c: P2, w: number, h: number, a: number): Shape {
  const co = Math.cos(a);
  const si = Math.sin(a);
  const at = (x: number, y: number): P2 => [c[0] + x * co - y * si, c[1] + x * si + y * co];
  const outer = polyShape([at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)]);
  const inner = polyShape([at(-w / 2 + 3, h / 2 - 3), at(w / 2 - 3, h / 2 - 3), at(w / 2 - 3, -h / 2 + 3), at(-w / 2 + 3, -h / 2 + 3)]);
  outer.holes.push(inner);
  return outer;
}

function fixBGeometry(): { body: BufferGeometry; ink: BufferGeometry; light: BufferGeometry } {
  const rims = TRAYS.map((t) => trayRim(t.c, t.w, t.h, t.a));
  const floors = TRAYS.map((t) => rect(t.c[0] - t.w / 2 + 3, t.c[1] - t.h / 2 + 3, t.c[0] + t.w / 2 - 3, t.c[1] + t.h / 2 - 3, 0.6));
  const events: Shape[] = [];
  const dossiers: Shape[] = [];
  const ink: Shape[] = [];
  TRAYS.forEach((t, i) => {
    const [x, y] = [t.c[0] - t.w * 0.14, t.c[1]];
    if (t.event === 'chat') events.push(slipShape(x, y, 24, 11, t.a));
    else if (t.event === 'card') events.push(cardShape(x, y, 24, 15));
    else if (t.event === 'mail') {
      const e = envelope(x, y, 24, 15);
      events.push(e.body);
      ink.push(...e.flap);
    } else events.push(rect(x - 10, y - 9, x + 10, y + 9, 0.8));
    // its own small dossier, east in the tray
    dossiers.push(rect(t.c[0] + t.w * 0.2 - 7, t.c[1] - 9 + jitter(i, 4), t.c[0] + t.w * 0.2 + 7, t.c[1] + 9 + jitter(i, 4), 0.6));
  });
  // tray 2's torn stub where the follow-up should have joined, and the follow-up lying in tray 6 instead (a smaller slip, a break mark over it)
  const stub = polyShape([
    [TRAYS[1]!.c[0] + 4, TRAYS[1]!.c[1] - 14],
    [TRAYS[1]!.c[0] + 13, TRAYS[1]!.c[1] - 14],
    [TRAYS[1]!.c[0] + 11, TRAYS[1]!.c[1] - 11],
    [TRAYS[1]!.c[0] + 13, TRAYS[1]!.c[1] - 8],
    [TRAYS[1]!.c[0] + 4, TRAYS[1]!.c[1] - 8],
  ]);
  const t6 = TRAYS[5]!;
  const stray = slipShape(t6.c[0] + 4, t6.c[1] + 11, 16, 8, -0.2);
  const brk = [rect(t6.c[0] + 13, t6.c[1] + 6, t6.c[0] + 15, t6.c[1] + 17, 0.3), rect(t6.c[0] + 17, t6.c[1] + 6, t6.c[0] + 19, t6.c[1] + 17, 0.3)];
  return {
    body: merge([solid(rims, 0, RELIEF * 1.4), solid(floors, 0, RELIEF * 0.5), solid(dossiers, RELIEF * 0.5, RELIEF * 1.2)]),
    ink: merge([solid(ink, RELIEF * 0.5 + 0.7, RELIEF * 0.5 + 1.2), solid(brk, RELIEF * 0.5 + 0.7, RELIEF * 0.5 + 1.6)]),
    light: merge([solid(events, RELIEF * 0.5, RELIEF * 0.5 + 0.7), solid([stub], RELIEF * 0.5, RELIEF * 0.5 + 0.7), solid([stray], RELIEF * 0.5 + 0.8, RELIEF * 0.5 + 1.5)]),
  };
}

/** Fix B's play: the eight trays, each with its event and dossier, the follow-up in the wrong tray. */
export function FixBPlay(_props: { play: number }) {
  const m = useReliefMats();
  const g = useMemo(() => fixBGeometry(), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group position={[0, 0, 0.05]}>
      <mesh geometry={g.body} material={m.dark} />
      <mesh geometry={g.light} material={m.light} />
      <mesh geometry={g.ink} material={m.ink} />
    </group>
  );
}
