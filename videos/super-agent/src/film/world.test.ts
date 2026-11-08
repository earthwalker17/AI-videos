import { describe, expect, it } from 'vitest';
import { worldToScreen, type Camera, type Pt } from '../kit/camera.tsx';
import { DIAGRAM_BAND, SAFE, STROKE } from '../look/tokens.ts';
import { detailOpacity } from './style.ts';
import {
  BRANCHES,
  BRIDGE,
  CROSSING,
  DEPOT,
  DEPOT_TETHER,
  FLYOVER,
  FRAMINGS,
  HUB,
  MACHINE,
  MACHINES,
  MEMORY,
  PANEL,
  PILL,
  PLATFORM,
  QUESTION,
  REPLY,
  REQUEST_HOME,
  REQUEST_OUT,
  ROUTER,
  ROUTER_PORTS,
  ROUTER_R,
  SIDING,
  SPRING,
  STAMP_STUB,
  TETHERS,
  TILES,
  TRUNK,
  TRUNK_Y,
  TURN,
  WORKER_DOORS,
  WORKER_TASKS,
  WORLD,
  YOU,
  YOU_R,
  memorySlots,
  memoryTicks,
  platformBox,
  springPile,
  tileBox,
  taskAt,
  workerDone,
  workerState,
  workerStep,
} from './world.ts';

const ROUTES: Record<string, readonly Pt[]> = {
  trunk: TRUNK,
  siding: SIDING,
  reply: REPLY,
  stub: STAMP_STUB,
  flyover: FLYOVER,
  depot: DEPOT_TETHER,
  route: REQUEST_OUT,
  ...Object.fromEntries(BRANCHES.map((b, i) => [`branch${i}`, b])),
  ...Object.fromEntries(TETHERS.map((b, i) => [`tether${i}`, b])),
};

/** The direction of a run, in degrees (0 = east, clockwise on screen). */
const heading = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

describe('the world', () => {
  it('runs every line at 0, 45 or 90 degrees', () => {
    for (const [name, pts] of Object.entries(ROUTES)) {
      for (let i = 1; i < pts.length; i++) {
        const h = heading(pts[i - 1], pts[i]);
        expect(Math.abs(h % 45), `${name} run ${i}: ${h} degrees`).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps everything inside the world', () => {
    const inside = ([x, y]: Pt) => x >= 0 && y >= 0 && x <= WORLD.width && y <= WORLD.height;
    for (const pts of Object.values(ROUTES)) for (const p of pts) expect(inside(p)).toBe(true);
    expect(PANEL.x + PANEL.w).toBeLessThanOrEqual(WORLD.width);
    expect(PANEL.y + PANEL.h).toBeLessThanOrEqual(WORLD.height);
  });

  it('follows the treatment layout: channels and you west, the hub, the points, the Router, the Workers, the machines', () => {
    expect(SPRING.x).toBeLessThan(640);
    expect(YOU[0] + YOU_R).toBeLessThanOrEqual(644);
    for (const t of TILES) {
      const b = tileBox(t);
      expect(b.x).toBeGreaterThan(560);
      expect(b.x + b.w).toBeLessThan(1300);
    }
    expect(SIDING[1][0]).toBeGreaterThanOrEqual(900);
    expect(ROUTER).toEqual([1920, 720]);
    // the machines east of the Workers, past the flyover's drop: on short tethers, close to the Workers they would host
    for (const [x] of MACHINES) {
      expect(x - MACHINE.size / 2).toBeGreaterThan(FLYOVER[3][0]);
      expect(x).toBeLessThan(3000);
    }
    expect(PANEL.y).toBeGreaterThanOrEqual(1450);
  });

  it('places the hub tiles by hand: no grid, each clear of the interchange ring and of the others', () => {
    expect(TILES).toHaveLength(8);
    const boxes = TILES.map(tileBox);
    // no two tiles share a row or a column line: the hub is improvised
    expect(new Set(TILES.map((t) => t.at[0])).size).toBe(8);
    expect(new Set(TILES.map((t) => t.at[1])).size).toBe(8);
    for (const t of TILES) {
      expect(t.w / 120).toBeGreaterThanOrEqual(0.85);
      expect(t.w / 120).toBeLessThanOrEqual(1.15);
      const dx = Math.abs(t.at[0] - HUB[0]) - t.w / 2;
      const dy = Math.abs(t.at[1] - HUB[1]) - t.h / 2;
      // the nearest point of the tile is outside the interchange ring (and its stroke)
      expect(Math.hypot(Math.max(0, dx), Math.max(0, dy))).toBeGreaterThan(ROUTER_R + 8);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i], boxes[j]];
        const apart = p.x + p.w + 40 <= q.x || q.x + q.w + 40 <= p.x || p.y + p.h + 40 <= q.y || q.y + q.h + 40 <= p.y;
        expect(apart, `tiles ${i} and ${j}`).toBe(true);
      }
  });

  it('keeps the old hub clear of the trunk and the siding: at least 32 px at 0.5x', () => {
    // each tile's top edge, and the tally notches cut 9 units over it
    for (const t of TILES) expect(tileBox(t).y - 9 - TRUNK_Y).toBeGreaterThanOrEqual(64);
    // the siding climbs away from the hub, north of the trunk
    for (const [, y] of SIDING) expect(y).toBeLessThanOrEqual(TRUNK_Y);
  });

  it("feeds the trunk from the spring: it rises out of the pile, and the request's route starts where it lay", () => {
    const top = Math.min(...springPile().map((it) => it.y));
    expect(TRUNK[0][1]).toBeLessThan(top - PILL.h / 2);
    expect(TRUNK[0][0]).toBe(SPRING.x);
    expect(REQUEST_OUT[0]).toEqual([SPRING.x, REQUEST_HOME[1]]);
    expect(REQUEST_OUT.at(-1)).toEqual(WORKER_DOORS[0]);
  });

  it('puts the Workers literally below the Router: one stem down from the ring, every platform under it', () => {
    const scale = FRAMINGS.still2.scale;
    // 40 px or more under the ring at the map's framing
    for (const door of WORKER_DOORS) expect((platformBox(door).y - (ROUTER[1] + ROUTER_R)) * scale).toBeGreaterThanOrEqual(40);
    // the stem: every branch leaves the Router straight down, then turns east at its Worker's level
    for (const b of BRANCHES) {
      expect(b[1][0]).toBe(ROUTER[0]);
      expect(b[1][1]).toBeGreaterThan(ROUTER[1]);
      expect(b[2][1]).toBe(b[1][1]);
    }
  });

  it('carries the flyover over the trunk on its bridge, north of the Router, into the first platform from above', () => {
    // the crossing lies on the trunk's 45 degree run into the Router, inside the bridge
    const [a, r] = [TRUNK[2], ROUTER];
    expect(CROSSING[0] - a[0]).toBeCloseTo(CROSSING[1] - a[1], 9);
    expect(CROSSING[0]).toBeGreaterThan(a[0]);
    expect(CROSSING[0]).toBeLessThan(r[0]);
    expect(BRIDGE[0][0]).toBeLessThan(CROSSING[0]);
    expect(BRIDGE[1][0]).toBeGreaterThan(CROSSING[0]);
    // clear of the memory track on the way past
    expect(ROUTER[1] - MEMORY.outer - FLYOVER[2][1]).toBeGreaterThanOrEqual(48);
    const landing = FLYOVER[FLYOVER.length - 1];
    const b = platformBox(WORKER_DOORS[0]);
    expect(landing[1]).toBe(b.y);
    expect(landing[0]).toBeGreaterThan(b.x);
    expect(landing[0]).toBeLessThan(b.x + b.w);
  });

  it('keeps the depot clear of the memory track and the flyover, and off its tether level (px at the rest)', () => {
    const s = FRAMINGS.still3.scale;
    expect((DEPOT.x - (ROUTER[0] + MEMORY.outer)) * s).toBeGreaterThanOrEqual(24);
    expect((FLYOVER[2][0] - (DEPOT.x + Math.max(...DEPOT.w))) * s).toBeGreaterThanOrEqual(24);
    // the tether ends short of the rules and points into a gap between two of them: level with a rule, the two would read as one dashed line
    const tetherY = DEPOT_TETHER[0][1];
    expect(DEPOT_TETHER.at(-1)![0]).toBeLessThan(DEPOT.x);
    const rules = Array.from({ length: DEPOT.rules }, (_, i) => DEPOT.y + i * DEPOT.pitch);
    for (const y of rules) expect(Math.abs(y - tetherY) * s).toBeGreaterThanOrEqual(6);
    // a store, not a falling bar chart: the rules are all one length
    expect(new Set(DEPOT.w).size).toBe(1);
    expect(DEPOT.w).toHaveLength(DEPOT.rules);
    expect(tetherY).toBeGreaterThan(rules[0]);
    expect(tetherY).toBeLessThan(rules.at(-1)!);
  });

  it('puts the "?" beside the machines: just east of their column, level with the middle one (px at the rest)', () => {
    const s = FRAMINGS.still3.scale;
    // the glyph's hook reaches 30 units west of its point
    const gap = (QUESTION[0] - 30 - (MACHINES[1][0] + MACHINE.size / 2)) * s;
    expect(gap).toBeGreaterThanOrEqual(16);
    expect(gap).toBeLessThanOrEqual(48);
    expect(QUESTION[1]).toBe(MACHINES[1][1]);
  });

  it('starts the branches and the reply at the Router and ends them at the platforms and your ring', () => {
    BRANCHES.forEach((b, i) => {
      expect(b[0]).toEqual(ROUTER);
      expect(b[b.length - 1]).toEqual(WORKER_DOORS[i]);
    });
    expect(REPLY[0]).toEqual(ROUTER);
    expect(REPLY[REPLY.length - 1]).toEqual(YOU);
    expect(TRUNK[TRUNK.length - 1]).toEqual(ROUTER);
  });

  it('keeps the platforms apart and the tethers running east from them to the machines', () => {
    const boxes = WORKER_DOORS.map(platformBox);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + PLATFORM.h + 24);
    TETHERS.forEach((t, i) => {
      expect(t[0][0]).toBeGreaterThan(boxes[i].x + PLATFORM.w + 16);
      expect(t[1][0]).toBeLessThan(MACHINES[i][0]);
    });
  });
});

describe('the chat spring', () => {
  const pile = springPile();
  it('holds the request half buried near the top, under a newer pill', () => {
    const i = pile.findIndex((it) => it.kind === 'request');
    const req = pile[i];
    expect(req.y).toBeLessThan(SPRING.top + 2 * SPRING.pitch);
    const over = pile.find((it) => it.id === 'spring-over')!;
    // drawn after it, and covering a part of it
    expect(pile.indexOf(over)).toBeGreaterThan(i);
    expect(Math.abs(over.x - req.x)).toBeLessThan(PILL.w);
    expect(Math.abs(over.y - req.y)).toBeLessThan(PILL.h);
  });
  it('mixes in CI squares and envelopes, inside the channels', () => {
    expect(pile.some((it) => it.kind === 'ci')).toBe(true);
    expect(pile.some((it) => it.kind === 'mail')).toBe(true);
    for (const it of pile) {
      expect(it.x + PILL.w / 2).toBeLessThan(640);
      expect(it.y).toBeGreaterThanOrEqual(SPRING.top);
      expect(it.y).toBeLessThanOrEqual(SPRING.bottom);
    }
  });
});

describe('the Router memory track', () => {
  const slots = memorySlots();
  /** the distance between two turns round the ring */
  const apart = (a: number, b: number) => Math.min(Math.abs(a - b) % 1, 1 - (Math.abs(a - b) % 1));

  it('is a tally: groups of four parallel ticks a pitch apart, a wider gap between groups, clockwise from 12 o\'clock', () => {
    expect(slots.length % MEMORY.group).toBe(0);
    expect(slots[0].at).toBe(0);
    for (let g = 0; g < slots.length / MEMORY.group; g++) {
      const group = slots.slice(g * MEMORY.group, (g + 1) * MEMORY.group);
      // in a group: a pitch apart, every tick along the group's middle
      for (let k = 1; k < group.length; k++) expect(group[k].at - group[k - 1].at).toBeCloseTo(MEMORY.pitch, 12);
      for (const s of group) expect(s.dir).toBeCloseTo((group[0].at + group.at(-1)!.at) / 2, 12);
      // to the next group (round to the first): at least the gap
      const next = slots[((g + 1) * MEMORY.group) % slots.length].at + (g + 1 === slots.length / MEMORY.group ? 1 : 0);
      expect(next - group.at(-1)!.at).toBeGreaterThanOrEqual(MEMORY.gap * MEMORY.pitch - 1e-9);
    }
    // the gap reads as a gap: well over a pitch
    expect(MEMORY.gap).toBeGreaterThanOrEqual(2);
  });

  it('leaves the ports and the label side clear, and never clears', () => {
    // no tick within a port's clearance: 3 o'clock (the depot), 6 o'clock (the stem), 7:30 (the reply), 10:30 (the trunk), and the label west
    for (const p of ROUTER_PORTS) for (const s of slots) expect(apart(s.at, p.at)).toBeGreaterThanOrEqual(p.clear - 1e-9);
    for (const port of [0.25, 0.5, 0.625, 0.875]) expect(ROUTER_PORTS.some((p) => p.at === port)).toBe(true);
    expect(memoryTicks(TURN - 1)).toBe(0);
    expect(memoryTicks(TURN)).toBe(1);
    let last = 0;
    for (let f = TURN; f < 5280; f += 7) {
      const n = memoryTicks(f);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(last).toBeLessThanOrEqual(slots.length);
    // at the rest the tally holds several whole groups, never a full ring of teeth (at the end of beat 8 a group is still to fill)
    expect(memoryTicks(4130)).toBeGreaterThanOrEqual(4 * MEMORY.group);
    expect(memoryTicks(4479)).toBeLessThanOrEqual(slots.length - MEMORY.group);
  });
});

describe('the Workers', () => {
  it('step on the beat, from the first stop to the last once done', () => {
    const task = WORKER_TASKS[0][0];
    expect(workerStep(task.start, task)).toBe(0);
    expect(workerStep(task.end, task)).toBe(PLATFORM.steps - 1);
    expect(workerDone(task.end - 1, task)).toBe(false);
    expect(workerDone(task.end, task)).toBe(true);
    // the marker moves only on a beat: inside a beat it holds
    for (let f = task.start; f < task.end; f += 20) {
      const s = workerStep(f, task);
      for (let k = 1; k < 20; k++) expect(workerStep(f + k, task)).toBe(s);
    }
  });
  it('have the request done by the rest (f4130) and still working at f1880, the other two busy at both', () => {
    expect(workerState(4130, WORKER_TASKS[0])).toMatchObject({ done: true, step: PLATFORM.steps - 1 });
    expect(workerState(1880, WORKER_TASKS[0])).toMatchObject({ done: false, busy: true });
    for (const f of [1880, 4130]) for (const w of [1, 2]) expect(workerState(f, WORKER_TASKS[w]).busy).toBe(true);
    // the busy ones show progress, not a marker parked at the start
    expect(workerState(1880, WORKER_TASKS[1]).step).toBeGreaterThan(0);
    expect(workerState(1880, WORKER_TASKS[2]).step).toBeGreaterThan(0);
  });
  it('take their tasks one after another', () => {
    for (const tasks of WORKER_TASKS) for (let i = 1; i < tasks.length; i++) expect(tasks[i].start).toBeGreaterThan(tasks[i - 1].end);
    expect(taskAt(0, WORKER_TASKS[1])).toBeNull();
    expect(taskAt(WORKER_TASKS[1][1].start, WORKER_TASKS[1])).toBe(WORKER_TASKS[1][1]);
  });
});

describe('the lookdev framings', () => {
  const on = (cam: Camera, p: Pt) => worldToScreen(cam, p);
  it('still 1 balances the spring and the hub across the frame, inside the diagram band', () => {
    const cam = FRAMINGS.still1;
    const [hx, hy] = on(cam, HUB);
    // the spring at left, the hub right of centre: together they are centred, no empty third at either side
    const left = Math.min(...springPile().map((it) => on(cam, [it.x - PILL.w / 2, it.y])[0]));
    // the tiles' notches stand 9 units off an edge
    const right = Math.max(...TILES.map((t) => on(cam, [tileBox(t).x + tileBox(t).w + 9, t.at[1]])[0]));
    expect(Math.abs(left - (1920 - right))).toBeLessThan(48);
    expect(hx).toBeGreaterThan(960);
    expect(hx).toBeLessThan(1280);
    for (const t of TILES) {
      const b = tileBox(t);
      // the notches stand 9 units over or under an edge
      const [, top] = on(cam, [b.x, b.y - 9]);
      const [, bottom] = on(cam, [b.x, b.y + b.h + 9]);
      expect(top).toBeGreaterThanOrEqual(DIAGRAM_BAND.top);
      expect(bottom).toBeLessThanOrEqual(DIAGRAM_BAND.bottom);
    }
    for (const it of springPile()) {
      const [sx, sy] = on(cam, [it.x, it.y]);
      expect(sx).toBeGreaterThan(SAFE.x);
      expect(sy).toBeGreaterThanOrEqual(DIAGRAM_BAND.top);
      expect(sy).toBeLessThanOrEqual(DIAGRAM_BAND.bottom);
    }
    expect(hy).toBeGreaterThan(DIAGRAM_BAND.top);
  });
  it('still 2 shows the spring and your ring at the west edge and every platform, inside the band', () => {
    const cam = FRAMINGS.still2;
    const [yx, yy] = on(cam, YOU);
    expect(yx).toBeGreaterThan(SAFE.x);
    expect(yx).toBeLessThan(320);
    // the whole spring, pills and all, inside title-safe, and as far in from the west edge as the platforms are from the east
    const left = Math.min(...springPile().map((it) => on(cam, [it.x - PILL.w / 2, it.y])[0]));
    const right = Math.max(...WORKER_DOORS.map((door) => on(cam, [platformBox(door).x + PLATFORM.w, door[1]])[0]));
    expect(left).toBeGreaterThanOrEqual(SAFE.x);
    expect(Math.abs(left - (1920 - right))).toBeLessThan(16);
    expect(yy).toBeLessThan(DIAGRAM_BAND.bottom);
    for (const door of WORKER_DOORS) {
      const b = platformBox(door);
      const [x1, y1] = on(cam, [b.x + b.w, b.y + b.h]);
      expect(x1).toBeLessThanOrEqual(SAFE.right);
      expect(y1).toBeLessThanOrEqual(DIAGRAM_BAND.bottom);
    }
    // the timetable panel's top stays down in the notes band (it is not drawn yet at f1880 anyway)
    expect(on(cam, [PANEL.x, PANEL.y])[1]).toBeGreaterThan(DIAGRAM_BAND.bottom);
  });
  it('still 3 frames the summary map at 0.6x, centred, inside title-safe and above the notes (the timetable panel is not part of it)', () => {
    const cam = FRAMINGS.still3;
    // close enough for the Workers' tool rows and step markers
    expect(detailOpacity(cam.scale)).toBe(1);
    const pts: Pt[] = [
      STAMP_STUB[1],
      ...springPile().flatMap((it): Pt[] => [
        [it.x - PILL.w / 2, it.y - PILL.h / 2],
        [it.x + PILL.w / 2, it.y + PILL.h / 2],
      ]),
      // the parked pill at the siding's terminus
      [SIDING.at(-1)![0], SIDING.at(-1)![1] - PILL.h / 2],
      ...WORKER_DOORS.flatMap((door): Pt[] => {
        const b = platformBox(door);
        return [
          [b.x, b.y],
          [b.x + b.w, b.y + b.h],
        ];
      }),
      ...MACHINES.map(([x, y]): Pt => [x + MACHINE.size / 2, y + MACHINE.size / 2]),
      // the "?": its hook's east side and top, its dot
      [QUESTION[0] + 30, QUESTION[1] - 64],
      [QUESTION[0], QUESTION[1] + 62],
    ];
    const xs = pts.map((p) => on(cam, p)[0]);
    const ys = pts.map((p) => on(cam, p)[1]);
    // the Worker label's baseline stands 50 px under the last platform
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys) + 50];
    expect(x0).toBeGreaterThanOrEqual(SAFE.x);
    expect(x1).toBeLessThanOrEqual(SAFE.right);
    expect(y0).toBeGreaterThanOrEqual(SAFE.y);
    // the frame holds through C26 and C27: the map stays in the diagram band, clear of the notes
    expect(y0).toBeGreaterThanOrEqual(DIAGRAM_BAND.top);
    expect(y1).toBeLessThanOrEqual(DIAGRAM_BAND.bottom);
    // centred: no heavy side, no empty band at the top
    expect(Math.abs(x0 - (1920 - x1))).toBeLessThan(16);
    expect(Math.abs(y0 - (1080 - y1))).toBeLessThan(16);
    // and filling the frame: under 200 px of ground either side
    expect(x0).toBeLessThan(200);
  });
  it('gives the strokes their hierarchy: the Router over the trunk over the branches over the platforms and the cased rails', () => {
    expect(STROKE.router).toBeGreaterThan(STROKE.trunk);
    expect(STROKE.trunk).toBeGreaterThan(STROKE.branch);
    expect(STROKE.branch).toBeGreaterThan(STROKE.platform);
    expect(STROKE.platform).toBeGreaterThanOrEqual(STROKE.casedRail);
    // the cased line's rails pass the 3 px test, and their ink together is no more than the trunk's
    expect(STROKE.casedRail).toBeGreaterThanOrEqual(STROKE.branchMin);
    expect(2 * STROKE.casedRail).toBeLessThanOrEqual(STROKE.trunk);
  });
});
