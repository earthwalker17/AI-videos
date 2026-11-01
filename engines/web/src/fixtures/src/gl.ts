// A raw WebGL2 page read back with readPixels: rows arrive bottom-up and must be flipped.
// No preserveDrawingBuffer: renderFrame draws synchronously, which the runtime supports.
import { installCapture, pageParams } from '../../page/index.ts';
import { bottomColor, FIXTURE_FRAMES, topColor } from './fixtures.ts';

const { width, height, fps } = pageParams({ width: 64, height: 36, fps: 10 });
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
document.body.append(canvas);
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })!;

function fill(y: number, h: number, c: number[]) {
  gl.scissor(0, y, width, h);
  gl.clearColor(c[0] / 255, c[1] / 255, c[2] / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

installCapture({
  fps,
  durationFrames: FIXTURE_FRAMES,
  width,
  height,
  canvas,
  gpu: 'webgl',
  renderFrame(i) {
    gl.enable(gl.SCISSOR_TEST);
    // GL's y axis points up: the top half of the picture is y ∈ [h/2, h)
    fill(height / 2, height / 2, topColor(i));
    fill(0, height / 2, bottomColor(i));
  },
});
