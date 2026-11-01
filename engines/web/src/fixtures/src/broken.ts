// A page whose frame 7 throws: the run must fail fast with the page's own message.
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
  renderFrame(i) {
    if (i === 7) throw new Error('fixture: frame 7 is broken');
    ctx.fillStyle = '#336699';
    ctx.fillRect(0, 0, width, height);
  },
});
