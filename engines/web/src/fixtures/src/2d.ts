// A Canvas 2D page: readback through getImageData.
import { installCapture, pageParams } from '../../page/index.ts';
import { bottomColor, FIXTURE_FRAMES, topColor } from './fixtures.ts';

const { width, height, fps } = pageParams({ width: 64, height: 36, fps: 10 });
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
document.body.append(canvas);
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
const css = (c: number[]) => `rgb(${c.join(', ')})`;

installCapture({
  fps,
  durationFrames: FIXTURE_FRAMES,
  width,
  height,
  canvas,
  gpu: 'none',
  renderFrame(i) {
    ctx.fillStyle = css(topColor(i));
    ctx.fillRect(0, 0, width, height / 2);
    ctx.fillStyle = css(bottomColor(i));
    ctx.fillRect(0, height / 2, width, height / 2);
  },
});
