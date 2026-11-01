/**
 * The web template: 5 s at the page's fps. Frames [0, 0.5 s) are a test card with the colour
 * swatch strip, declared to the harness as swatchFrames (it refuses to render when video.json
 * qa.swatchFrames, what QA measures, says otherwise, e.g. after an fps change). The rest is a
 * three.js scene composited onto the 2D output canvas with a title in Inter. Everything is sized
 * from the frame size the harness passes in the URL, and every frame is a pure function of its
 * index.
 */
import { installCapture, pageParams } from '@aiv/engine-web/page';
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import { drawOverlay, drawTestCard, FONT_FAMILY, type Frame } from './card.ts';
import { createScene } from './scene.ts';

const { width, height, fps } = pageParams({ width: 1920, height: 1080, fps: 30 });
const durationFrames = Math.round(5 * fps);
const cardFrames = Math.round(0.5 * fps);
const frame: Frame = { width, height, fps, durationFrames };

const canvas = document.querySelector<HTMLCanvasElement>('#frame')!;
canvas.width = width;
canvas.height = height;
// a CPU-backed 2D canvas: getImageData every frame, and text rasterised the same way every time
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true, colorSpace: 'srgb' })!;

// the font file comes from the pinned @fontsource-variable/inter package, through Vite (?url)
const inter = new FontFace(FONT_FAMILY, `url(${interUrl})`, { weight: '100 900' });
const setup = inter.load().then((face) => {
  document.fonts.add(face);
});

const scene = createScene(width, height, fps, cardFrames, durationFrames);

installCapture({
  fps,
  durationFrames,
  width,
  height,
  canvas,
  setup,
  fonts: [`650 72px "${FONT_FAMILY}"`, `400 34px "${FONT_FAMILY}"`],
  gpu: 'webgl',
  swatchFrames: [0, cardFrames],
  renderFrame(i) {
    if (i < cardFrames) {
      drawTestCard(ctx, i, frame);
      return;
    }
    scene.render(i);
    ctx.drawImage(scene.canvas, 0, 0);
    drawOverlay(ctx, i, frame, cardFrames);
  },
});
