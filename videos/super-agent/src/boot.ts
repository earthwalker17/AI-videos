/**
 * Boot: the output canvas, the fonts, the type atlas, the stage and the capture contract. The
 * finished frame is drawn on a WebGL canvas and copied to a CPU 2D canvas, which the engine reads
 * (the web template's proven path); the test card is drawn on that 2D canvas directly.
 */
import { installCapture, pageParams } from '@aiv/engine-web/page';
import shouldersUrl from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url';
import plexUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
import monoUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import { drawTestCard, type Frame } from './card.ts';
import { FILM_FRAMES, FPS, LEADER } from './cues.ts';
import { Film, checkCopy, copyWidths } from './film.ts';
import { FONT, type PaletteName } from './kit/look.ts';
import { Stage } from './kit/stage.ts';
import { Type, fontSpecs } from './kit/type.ts';

export interface BootOptions {
  palette: PaletteName;
  /** render only the film (no test-card leader): for lookdev entries */
  leader?: boolean;
}

export function boot(options: BootOptions): void {
  const { width, height, fps } = pageParams({ width: 1920, height: 1080, fps: FPS });
  if (fps !== FPS) throw new Error(`page: the film is cut at ${FPS} fps, not ${fps}`);
  const leader = options.leader === false ? 0 : LEADER;
  const durationFrames = leader + FILM_FRAMES;
  const frame: Frame = { width, height, fps, durationFrames };

  const out = document.querySelector<HTMLCanvasElement>('#frame')!;
  out.width = width;
  out.height = height;
  // a CPU-backed 2D canvas: the engine reads it with getImageData on every frame
  const ctx = out.getContext('2d', { alpha: false, willReadFrequently: true, colorSpace: 'srgb' })!;
  const glCanvas = document.createElement('canvas');

  // font files come from pinned packages, through Vite (?url), under names no system font has
  const faces = [
    new FontFace(FONT.display, `url(${shouldersUrl})`, { weight: '100 900' }),
    new FontFace(FONT.text, `url(${plexUrl})`, { weight: '100 700' }),
    new FontFace(FONT.mono, `url(${monoUrl})`, { weight: '500' }),
  ];
  let film: Film | null = null;
  const setup = Promise.all(faces.map((f) => f.load())).then((loaded) => {
    for (const f of loaded) document.fonts.add(f);
    const type = new Type(height / 1080);
    checkCopy(type);
    (window as unknown as { __copy?: unknown }).__copy = copyWidths(type);
    const stage = new Stage(glCanvas, width, height, type.image);
    // more sub-frames at full size: motion blur is part of the finish, not of the draft
    film = new Film(stage, type, { palette: options.palette, subframes: height >= 1000 ? 6 : 3 });
  });

  installCapture({
    fps,
    durationFrames,
    width,
    height,
    canvas: out,
    setup,
    fonts: [...fontSpecs(), `650 72px "${FONT.text}"`, `400 34px "${FONT.text}"`],
    gpu: 'webgl',
    ...(leader > 0 ? { swatchFrames: [0, leader] as const } : {}),
    renderFrame(i) {
      if (i < leader) {
        drawTestCard(ctx, i, frame);
        return;
      }
      film!.render(i - leader);
      ctx.drawImage(glCanvas, 0, 0);
    },
  });
}
