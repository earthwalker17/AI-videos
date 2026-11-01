// A page that imports a file outside the input hash (the engine's package.json): the open must fail.
import pkg from '../../../package.json';
import { installCapture, pageParams } from '../../page/index.ts';
import { FIXTURE_FRAMES } from './fixtures.ts';

const { width, height, fps } = pageParams({ width: 64, height: 36, fps: 10 });
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;

installCapture({
  fps,
  durationFrames: FIXTURE_FRAMES,
  width,
  height,
  canvas,
  gpu: 'none',
  renderFrame() {
    // the unhashed file decides the pixels: exactly what the check exists for
    ctx.fillStyle = pkg.version.startsWith('0') ? '#336699' : '#993366';
    ctx.fillRect(0, 0, width, height);
  },
});
