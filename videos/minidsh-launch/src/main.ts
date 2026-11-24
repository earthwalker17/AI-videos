/**
 * The page the web engine captures: "MiniDSH 2.0: One Runtime, Every Surface". One WebGL2 stage
 * (@aiv/web-kit) draws the lit ink, the real product captures as panes, the type and the cursor;
 * the frame is copied to a CPU 2D canvas the engine reads. Frames [0, LEADER) are the test card
 * with the colour swatches (video.json qa.swatchFrames). Every frame is a pure function of its
 * index: fonts and every capture's bytes are loaded in setup, before frame 0.
 */
import { installCapture, pageParams } from '@aiv/engine-web/page';
import monoUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import mono600Url from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url';
import sansUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
import { Camera, Draw, ImageBank, Stage, Textures, Type, drawTestCard, fontSpecs, loadFaces, subframes } from '@aiv/web-kit';
import { CanvasTextures, canvasTexture, drawCursor, type CanvasTexture } from './canvasTex.ts';
import { drawMark } from './mark.ts';
import { drawPaint } from './tui.ts';
import { URLS, type CaptureKey } from './captures.ts';
import { FILM_FRAMES, FPS, LEADER, at } from './cues.ts';
import { draw, needs, sameShot } from './film.ts';
import { FINISH, GROUND, MONO, PAL, POSE, SANS, STYLES, type StyleId } from './look.ts';

const { width, height, fps } = pageParams({ width: 1920, height: 1080, fps: FPS });
if (fps !== FPS) throw new Error(`the film is timed at ${FPS} fps, not ${fps}`);
const durationFrames = LEADER + FILM_FRAMES;

const out = document.querySelector<HTMLCanvasElement>('#frame')!;
out.width = width;
out.height = height;
// a CPU-backed 2D canvas: the engine reads it with getImageData on every frame
const ctx = out.getContext('2d', { alpha: false, willReadFrequently: true, colorSpace: 'srgb' })!;
const glCanvas = document.createElement('canvas');
/** motion blur: sub-frames averaged per frame (fewer at draft size) */
const SUBS = height >= 1000 ? 6 : 3;
const SHUTTER = 0.5;

let stage: Stage;
let type: Type<StyleId>;
let textures: Textures;
let cursor: CanvasTexture;
let mark: CanvasTexture;
/** the terminal pane per paint index: a pure function of the index */
let term: CanvasTextures<number>;

const setup = Promise.all([
  loadFaces([
    { family: SANS, url: sansUrl, weight: '100 700' },
    { family: MONO, url: monoUrl, weight: '500' },
    { family: MONO, url: mono600Url, weight: '600' },
  ]),
  ImageBank.load(URLS),
]).then(([, bank]) => {
  type = new Type(STYLES, height / 1080);
  stage = new Stage(glCanvas, width, height, { atlas: type.image, finish: FINISH });
  textures = new Textures(stage, bank, { cap: 4 });
  cursor = canvasTexture(stage.gl, drawCursor(4));
  mark = canvasTexture(stage.gl, drawMark(512));
  term = new CanvasTextures(stage.gl, (k) => drawPaint(k, { left: 'minidsh chat', right: 'recorded live · deepseek-flash' }), 3);
});

installCapture({
  fps,
  durationFrames,
  width,
  height,
  canvas: out,
  setup,
  // the atlas styles, and the faces the terminal pane draws with on its own canvas
  fonts: [...fontSpecs(STYLES), `500 40px "${MONO}"`, `600 40px "${MONO}"`, `500 30px "${MONO}"`],
  gpu: 'webgl',
  swatchFrames: [0, LEADER],
  // the engine re-renders the last warm-up frame as its purity probe: ending on the receipt after
  // the approval card makes that check cross a change of capture (and of texture residency)
  warmupFrames: [LEADER + at(16, 2), LEADER + at(18, 2), LEADER + at(15, 1), LEADER + at(19, 3)],
  async renderFrame(i) {
    if (i < LEADER) {
      drawTestCard(ctx, i, { width, height, fps, durationFrames }, { family: SANS, title: 'MiniDSH 2.0: One Runtime, Every Surface' });
      return;
    }
    const f = i - LEADER;
    // motion blur, but never across a hard cut
    const subs = subframes(f, SUBS, SHUTTER).map((s) => sameShot(f, s));
    const need = [...new Set(subs.flatMap((s) => needs(s)))] as CaptureKey[];
    await textures.need(need);
    stage.beginFrame();
    for (const s of subs) {
      const cam = new Camera(POSE);
      stage.beginSub(cam);
      draw(s, { d: new Draw(stage, type, cam, PAL, s), tex: (k) => textures.get(k), cursor, mark, term: (k) => term.get(k) });
      stage.endSub(GROUND, 1 / subs.length);
    }
    stage.present();
    ctx.drawImage(glCanvas, 0, 0);
  },
});
