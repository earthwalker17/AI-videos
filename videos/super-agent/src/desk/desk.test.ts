import { describe, expect, it } from 'vitest';
import { PRINT_STRINGS } from '../print.ts';
import { D1, FRAMING_B, deskCamera, project, projectBox } from './camera.ts';
import { footprintsAt, KIND, MAX_FOOTPRINTS, cullRadius, packFootprints, staticFootprints, type Footprint } from './footprints.ts';
import { neutral, preToe } from './gl/post.ts';
import { BAYS, CELLS_X, CORDS, DECK, KEY, REEL, SHADOW_DIR, SHADOW_K, TAPE, WINDOW, penumbra, rectC, shadowOffset, type BayId } from './layout.ts';
import { MAX_POOLS, linearOf, packPools, poolsAt } from './pools.ts';
import { cardArc, deskStateAt, DETENT, EVENTS_B, LAMP_STEPS } from './state.ts';

const B = deskStateAt(2200);

/** OKLCH chroma of a linear sRGB colour (Björn Ottosson's OKLab matrices). */
function oklchChroma([r, g, b]: [number, number, number]): number {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(A, B2);
}

describe('desk camera', () => {
  it('puts one world unit on one pixel of the desk at zoom 1 (fov 20)', () => {
    expect(D1).toBeCloseTo(540 / Math.tan((10 * Math.PI) / 180), 6);
    const plan = deskCamera({ x: 0, y: 0, zoom: 1 }, 0);
    const [x0, y0] = project(plan, [0, 0, 0]);
    const [x1, y1] = project(plan, [100, 100, 0]);
    expect(x0).toBeCloseTo(960, 6);
    expect(y0).toBeCloseTo(540, 6);
    expect(x1 - x0).toBeCloseTo(100, 4);
    // north is up on screen
    expect(y1 - y0).toBeCloseTo(-100, 4);
  });
  it('scales by the framing zoom and keeps the aim point centred at either pitch', () => {
    for (const angle of [0, 15] as const) {
      const pose = deskCamera(FRAMING_B, angle);
      const [x, y] = project(pose, [FRAMING_B.x, FRAMING_B.y, 0]);
      expect(x).toBeCloseTo(960, 6);
      expect(y).toBeCloseTo(540, 6);
      const [xr] = project(pose, [100, 0, 0]);
      expect(xr - 960).toBeCloseTo(85, 3);
    }
  });
  it('at 15° raises what is high and shows north foreshortened', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const [, yLow] = project(pose, [0, 200, 0]);
    const [, yHigh] = project(pose, [0, 200, 120]);
    expect(yLow - yHigh).toBeGreaterThan(20);
    expect(540 - yLow).toBeLessThan(0.85 * 200);
    expect(540 - yLow).toBeGreaterThan(0.85 * 200 * 0.9);
  });
  it('keeps the frame (b) diagram inside the band y 72..868 and the deck where the spec draws it', () => {
    for (const angle of [0, 15] as const) {
      const pose = deskCamera(FRAMING_B, angle);
      const deck = projectBox(pose, [
        [DECK.x0, DECK.y0, 0],
        [DECK.x1, DECK.y1, DECK.top],
      ]);
      expect(deck.x0).toBeGreaterThan(620);
      expect(deck.x1).toBeLessThan(1220);
      expect(deck.y0).toBeGreaterThan(72);
      for (const b of Object.values(BAYS)) {
        const box = projectBox(pose, [
          [b.box.x0, b.box.y0, 0],
          [b.box.x1, b.box.y1, b.wallH],
        ]);
        expect(box.y1).toBeLessThan(868);
        expect(box.y0).toBeGreaterThan(deck.y0);
      }
      for (const p of [...CORDS.vermilion, ...CORDS.graphite]) expect(project(pose, p)[1]).toBeGreaterThan(72);
    }
  });
});

describe('desk layout', () => {
  it('casts shadows away from the key, 0.84 per unit of height, with a penumbra of 4 + 0.35 h', () => {
    expect(Math.hypot(...SHADOW_DIR)).toBeCloseTo(1, 9);
    expect(SHADOW_DIR[0]).toBeGreaterThan(0);
    expect(SHADOW_DIR[1]).toBeLessThan(0);
    expect(SHADOW_DIR[0] * KEY[0] + SHADOW_DIR[1] * KEY[1]).toBeLessThan(0);
    expect(Math.hypot(...shadowOffset(120))).toBeCloseTo(SHADOW_K * 120, 9);
    expect(penumbra(0)).toBe(4);
    expect(penumbra(100)).toBeCloseTo(39, 9);
  });
  it('lays the five inline cells inside the window, over the tape, oldest west', () => {
    expect(CELLS_X).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(CELLS_X[i][0]).toBeGreaterThan(WINDOW.frame.x0 + WINDOW.bar - 1);
      expect(CELLS_X[i][1]).toBeLessThan(WINDOW.frame.x1 - WINDOW.bar + 1);
      if (i > 0) expect(CELLS_X[i][0]).toBeGreaterThan(CELLS_X[i - 1][1]);
    }
    expect(TAPE.y0).toBeGreaterThan(WINDOW.frame.y0);
    expect(TAPE.y1).toBeLessThan(WINDOW.frame.y1);
    // the tape runs onto the reel's pack at its south side
    expect(REEL.y - REEL.packR).toBeGreaterThan(TAPE.y0);
    expect(REEL.y - REEL.packR).toBeLessThan(TAPE.y1);
  });
  it('gives each bay its own ground: no two bays overlap, every bay is below the deck', () => {
    const ids = Object.keys(BAYS) as BayId[];
    for (const a of ids) {
      expect(BAYS[a].box.y1).toBeLessThan(DECK.y0);
      for (const b of ids) {
        if (a >= b) continue;
        const A = BAYS[a].box;
        const C = BAYS[b].box;
        const overlap = A.x0 < C.x1 && C.x0 < A.x1 && A.y0 < C.y1 && C.y0 < A.y1;
        expect(overlap).toBe(false);
      }
      const d = BAYS[a].door;
      expect(d[0]).toBeGreaterThan(BAYS[a].box.x0);
      expect(d[1]).toBeLessThan(BAYS[a].box.x1);
    }
  });
});

describe('desk footprints', () => {
  it('fits the shaders at every frame of the lookdev span', () => {
    for (const f of [2100, 2190, 2200, 2210, 2340]) expect(footprintsAt(deskStateAt(f)).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
  it('adds the card and the slip only while they move', () => {
    const base = staticFootprints().length;
    expect(footprintsAt(B).length).toBe(base + 2);
    expect(footprintsAt(deskStateAt(2240)).length).toBe(base);
  });
  it('culls no farther than the shadow and contact reach', () => {
    const fp: Footprint = { kind: 'rect', c: [0, 0], h: [50, 20], r: 3, rot: 0, z0: 0, z1: 120, contact: 1 };
    const reach = Math.hypot(50, 20) + (SHADOW_K * 120) / 2 + penumbra(120) / 2;
    expect(cullRadius(fp)).toBeGreaterThanOrEqual(reach + 28);
    const seg: Footprint = { kind: 'seg', a: [0, 0], b: [200, 0], ha: 200, hb: 60, r: 4 };
    expect(cullRadius(seg)).toBeGreaterThanOrEqual(100 + 4 + (SHADOW_K * 140) / 2 + penumbra(200) / 2);
  });
  it('packs three vec4 per footprint with its kind code', () => {
    const fps: Footprint[] = [
      { kind: 'rect', c: [1, 2], h: [3, 4], r: 1, rot: Math.PI / 2, z0: 0, z1: 9, contact: 0.5 },
      { kind: 'circle', c: [5, 6], r: 7, z0: 1, z1: 2, contact: 1 },
      { kind: 'seg', a: [0, 1], b: [2, 3], ha: 10, hb: 20, r: 4 },
      { kind: 'canopy', c: [0, 0], h: [10, 10], z: 100, strength: 0.6 },
    ];
    const out = packFootprints(fps);
    expect(out.length).toBe(MAX_FOOTPRINTS * 12);
    expect([...out.slice(0, 8)]).toEqual([1, 2, 3, 4, 1, 0, 9, KIND.rect]);
    expect(out[8]).toBeCloseTo(0, 9);
    expect(out[9]).toBeCloseTo(1, 9);
    expect(out[11]).toBe(0.5);
    expect(out[12 + 7]).toBe(KIND.circle);
    expect([...out.slice(24, 32)]).toEqual([0, 1, 2, 3, 4, 10, 20, KIND.seg]);
    expect(out[36 + 7]).toBe(KIND.canopy);
    expect(out[36 + 11]).toBeCloseTo(0.6, 6);
    expect(out[48]).toBe(0);
  });
});

describe('desk pools and post', () => {
  it('keeps the pools within the shader array and lights with near-neutral colours (never amber)', () => {
    const pools = poolsAt(B);
    expect(pools.length).toBeLessThanOrEqual(MAX_POOLS);
    for (const p of pools) {
      const m = Math.max(...p.rgb);
      if (m === 0) continue;
      // OKLCH chroma of the light's colour at full brightness (synthesis: all light chroma <= 0.03)
      expect(oklchChroma(p.rgb.map((v) => v / m) as [number, number, number])).toBeLessThanOrEqual(0.03);
    }
    expect(packPools(pools).length).toBe(MAX_POOLS * 12);
  });
  it('converts sRGB hex to linear light', () => {
    const [r, g, b] = linearOf('#212322');
    expect(r).toBeCloseTo(0.0152, 3);
    expect(g).toBeCloseTo(0.0168, 3);
    expect(b).toBeCloseTo(0.016, 3);
    expect(linearOf('#FFFFFF')).toEqual([1, 1, 1]);
  });
  it('makes PreToe then NEUTRAL the identity under the shoulder, so the palette lands on its hex values', () => {
    for (const hex of ['#212322', '#1C1E1D', '#2B2D2B', '#3A3D3C', '#6A6F6C', '#A8A296', '#D9D5CA', '#B4452C', '#8FD3A8']) {
      const c = linearOf(hex);
      const out = neutral(preToe(c));
      for (let k = 0; k < 3; k++) expect(out[k]).toBeCloseTo(c[k], 9);
    }
    // the vermilion's red channel (0.81) is just past the shoulder's start: rolled off by under 1%
    const v = linearOf('#E8603F');
    const vo = neutral(preToe(v));
    expect(Math.abs(vo[0] - v[0]) / v[0]).toBeLessThan(0.01);
    // above the shoulder NEUTRAL still rolls emitters off below 1
    const hot = neutral(preToe([4, 4, 3.9]));
    expect(Math.max(...hot)).toBeLessThan(1);
    expect(Math.max(...hot)).toBeGreaterThan(0.9);
  });
});

describe('desk state at f2200 (style frame b)', () => {
  it('has the index arm at its west detent, facing you', () => {
    expect(B.arm).toBeCloseTo(DETENT.you, 2);
    expect(deskStateAt(EVENTS_B.armTurn).arm).toBeCloseTo(DETENT.bug, 6);
  });
  it('has the reply slip 70% down the chute and your lamp still one step dimmer', () => {
    expect(B.slip?.s).toBeCloseTo(0.7, 1);
    expect(B.lamp).toBeCloseTo(LAMP_STEPS.dim, 6);
    expect(deskStateAt(2230).lamp).toBeCloseTo(LAMP_STEPS.up, 2);
  });
  it('has the report card about 60% along its arc with its transit light on, the tower dimming', () => {
    expect(B.card).not.toBeNull();
    expect(B.card!.s).toBeGreaterThan(0.55);
    expect(B.card!.s).toBeLessThan(0.65);
    expect(B.card!.light).toBe(1);
    expect(B.testsLight).toBeLessThan(0.5);
    expect(B.testsLight).toBeGreaterThan(0);
    // the arc rises above its chord
    const mid = cardArc(0.5).pos;
    expect(mid[2]).toBeGreaterThan(cardArc(0).pos[2] + 40);
    expect(deskStateAt(EVENTS_B.cardEject + EVENTS_B.cardFly).card).toBeNull();
  });
  it('keeps the slip and the card once they land: the slip in your in-tray, the card in the hopper', () => {
    const later = deskStateAt(2230);
    expect(later.slip?.s).toBe(1);
    expect(later.card).toBeNull();
    expect(later.cardDocked).toBe(true);
    expect(B.cardDocked).toBe(false);
  });
  it('is a pure function of the frame', () => {
    expect(deskStateAt(2200)).toEqual(B);
    expect(deskStateAt(2217)).toEqual(deskStateAt(2217));
  });
});

describe('micro-print', () => {
  it('is Latin, digits and ASCII punctuation only (the print face loads its latin file)', () => {
    for (const s of PRINT_STRINGS) expect(s).toMatch(/^[\x20-\x7E]+$/);
  });
  it('keeps the bays apart from the request: only the bug bay holds #0405 work', () => {
    expect(rectC(BAYS.bug.box)[0]).toBeLessThan(rectC(BAYS.tests.box)[0]);
  });
});
