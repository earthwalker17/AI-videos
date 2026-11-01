/**
 * Test pages for adapter.test.ts. Each frame's top and bottom halves get colours computed from
 * the frame index, so a test can decode the mezzanine and check values AND orientation.
 */
export const FIXTURE_FRAMES = 12;

export const topColor = (i: number): [number, number, number] => [i * 20, 100, 50];
export const bottomColor = (i: number): [number, number, number] => [10, 200 - i * 10, 250];
