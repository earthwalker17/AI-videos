/**
 * Test compositions for adapter.test.ts. Each frame's top and bottom halves get colours computed
 * from the frame index, so a test can decode the mezzanine and check values AND orientation.
 */
export const FIXTURE_FRAMES = 12;
export const FIXTURE_FPS = 10;
export const W = 64;
export const H = 36;

export const topColor = (i: number): [number, number, number] => [i * 20, 100, 50];
export const bottomColor = (i: number): [number, number, number] => [10, 200 - i * 10, 250];
/** the GL fixture's clear colour (sRGB code values) */
export const glColor = (i: number): [number, number, number] => [40 + i * 15, 180 - i * 8, 90];

export const css = ([r, g, b]: readonly number[]) => `rgb(${r}, ${g}, ${b})`;
export const hex = ([r, g, b]: readonly number[]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
