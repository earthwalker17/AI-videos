import { describe, expect, it } from 'vitest';
import { cameraTransform, gridPoints, lerpCamera, screenToWorld, visibleWorld, worldToScreen, zoomAbout, type Camera } from './camera.tsx';

const C1: Camera = { x: 1920, y: 1080, scale: 1 };

describe('camera', () => {
  it('maps the camera point to the view centre and back', () => {
    expect(worldToScreen(C1, [1920, 1080])).toEqual([960, 540]);
    expect(worldToScreen(C1, [2000, 1230])).toEqual([1040, 690]);
    const c = { x: 1500, y: 900, scale: 1.6 };
    const p = worldToScreen(c, [1234, 567]);
    const back = screenToWorld(c, p);
    expect(back[0]).toBeCloseTo(1234, 9);
    expect(back[1]).toBeCloseTo(567, 9);
  });
  it('writes the SVG transform', () => {
    expect(cameraTransform({ x: 100, y: 50, scale: 2 })).toBe('translate(960 540) scale(2) translate(-100 -50)');
  });
  it('zooms about an anchor that stays put on screen', () => {
    const z = zoomAbout(C1, [2000, 1230], 1.6);
    expect(z.scale).toBe(1.6);
    const [sx, sy] = worldToScreen(z, [2000, 1230]);
    expect(sx).toBeCloseTo(1040, 9);
    expect(sy).toBeCloseTo(690, 9);
  });
  it('interpolates the scale geometrically', () => {
    const a = { x: 0, y: 0, scale: 0.5 };
    const b = { x: 100, y: 0, scale: 2 };
    expect(lerpCamera(a, b, 0)).toEqual(a);
    expect(lerpCamera(a, b, 1)).toEqual(b);
    expect(lerpCamera(a, b, 0.5).scale).toBeCloseTo(1, 12);
    expect(lerpCamera(a, b, 0.5).x).toBe(50);
  });
  it('knows what it shows', () => {
    expect(visibleWorld(C1)).toEqual({ x0: 960, y0: 540, x1: 2880, y1: 1620 });
    const v = visibleWorld({ x: 1920, y: 1080, scale: 0.5 });
    expect(v).toEqual({ x0: 0, y0: 0, x1: 3840, y1: 2160 });
  });
});

describe('gridPoints', () => {
  it('lists the lattice points in view, inside the world', () => {
    const pts = gridPoints(96, { x0: 0, y0: 0, x1: 200, y1: 100 }, { width: 3840, height: 2160 });
    expect(pts).toEqual([
      [0, 0],
      [96, 0],
      [192, 0],
      [0, 96],
      [96, 96],
      [192, 96],
    ]);
    expect(gridPoints(96, { x0: -500, y0: -500, x1: -10, y1: -10 }, { width: 3840, height: 2160 })).toEqual([]);
    // the whole world at 0.5x: 41 x 23 points
    expect(gridPoints(96, visibleWorld({ x: 1920, y: 1080, scale: 0.5 }), { width: 3840, height: 2160 }).length).toBe(41 * 23);
  });
});
