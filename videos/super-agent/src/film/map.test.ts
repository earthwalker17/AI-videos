import { describe, expect, it } from 'vitest';
import { STROKE, ZOOM } from '../look/tokens.ts';
import { lampFill, platformParts } from './map.tsx';
import { GATE_SIZE, PILL, PLATFORM, WORKER_DOORS } from './world.ts';

describe('a Worker platform’s parts', () => {
  const glyph = 8; // a tool glyph reaches about 8 units from its centre (film/glyphs.tsx)
  for (const door of WORKER_DOORS) {
    const p = platformParts(door);
    const { box } = p;
    it(`fit inside the box at its door ${door.join(',')}: the task's berth west, the tool row over the step track east`, () => {
      expect(box.x).toBe(door[0]);
      expect(box.y + box.h / 2).toBe(door[1]);
      expect([box.w, box.h]).toEqual([PLATFORM.w, PLATFORM.h]);
      // the berth holds a whole pill inside the box, clear of the tools and the track
      expect(p.berth[0] - PILL.w / 2).toBeGreaterThanOrEqual(box.x + 16);
      expect(p.berth[0] + PILL.w / 2).toBeLessThan(Math.min(p.track.x0, p.tools[0][0] - glyph));
      // the tools: evenly spaced in one row inside the box, above the track
      const gaps = p.tools.slice(1).map((t, i) => t[0] - p.tools[i][0]);
      for (const g of gaps) expect(g).toBe(gaps[0]);
      for (const [x, y] of p.tools) {
        expect(y).toBe(p.tools[0][1]);
        expect(x + glyph).toBeLessThan(box.x + box.w - 8);
        expect(y - glyph).toBeGreaterThan(box.y);
        expect(y + glyph).toBeLessThan(p.track.y - 4);
      }
      // the step track (its stop ticks reach 4 units, the marker 6) inside the box
      expect(p.track.x0).toBeGreaterThan(box.x);
      expect(p.track.x1).toBeLessThan(box.x + box.w - 8);
      expect(p.track.y + 6).toBeLessThan(box.y + box.h - 8);
      // the done cap is the box's own east side, between its corners
      expect(p.cap.x).toBe(box.x + box.w);
      expect(p.cap.y0).toBe(box.y + PLATFORM.r);
      expect(p.cap.y1).toBe(box.y + box.h - PLATFORM.r);
    });
  }
});

describe('the gate lamp’s fill', () => {
  it('covers the disc from the centre to the inner edge of the lamp’s outline at every zoom', () => {
    for (let s = ZOOM.min; s <= ZOOM.max + 1e-9; s += 0.05) {
      const { r, width } = lampFill(s);
      // an arc of radius r with a scaling stroke 2r wide: from the centre ...
      expect(r - width / 2).toBeCloseTo(0, 12);
      // ... to the outline's inner edge (the outline is a non-scaling STROKE.platform px ring)
      expect(r + width / 2).toBeCloseTo(GATE_SIZE.lamp - STROKE.platform / 2 / s, 12);
      expect(width).toBeGreaterThan(0);
    }
  });
});
