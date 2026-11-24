/**
 * Lookdev probe: real UI captures as panes on the lit-ink stage (@aiv/web-kit image marks). The
 * frame index chooses one state; each is a question the film's look depends on:
 *
 *   0  the web capture flat on the screen at 0.6x of its pixels (a 2x capture: 1.2x CSS px)
 *   1  the same capture as a pane in the world, turned 7 degrees, under a Plex Sans 600 headline
 *   2  a close-up: a crop at 1.3x of capture pixels, so the UI's 14-CSS-px text reads at about 36 px
 *   3  the approval capture flat at 0.6x: a second texture (residency)
 *   4  both captures in one frame, two textures back to back (the batcher must not merge them); the
 *      back pane softened by a mip bias (cheap depth of field)
 *   5  the web capture at exactly 1:1, covering the frame: display-referred pixels must come out
 *      with the file's own 8-bit values (no shoulder, no vignette, no grain)
 *
 * Rendered with `aiv still --entry src/lookdev/probe.html`, never by aiv render. Variants on the
 * same frames: evict.html keeps one texture resident, so frames that change capture evict and
 * re-upload; bloom.html lowers the bloom threshold to 0.8, under the panes' whites, so frames 0
 * and 2-5 must hash as probe.html's (a pane never feeds the bloom) and only frame 1 differs (its
 * headline, stage light, does bloom).
 */
import { installCapture, pageParams } from '@aiv/engine-web/page';
import plexUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
import { CHARS, Camera, Draw, ImageBank, Stage, Textures, Type, fontSpecs, hex, loadFaces, type Finish, type GroundOptions, type ImageShadow, type Pose, type StageTexture, type StyleTable } from '@aiv/web-kit';
import approvalUrl from '../../assets/probe/approval-2x.png?url';
import webUrl from '../../assets/probe/web-light-2x.png?url';

const PLEX = 'AIV Plex';
const STYLES = {
  headline: { family: PLEX, weight: 600, px: 104, tracking: -0.012, leading: 1.08, chars: CHARS.ascii },
} satisfies StyleTable<'headline'>;
type StyleId = keyof typeof STYLES;

const FILES = { web: webUrl, approval: approvalUrl } as const;
type Capture = keyof typeof FILES;

const PAL = { ink: hex('#eef0f4') };
const GROUND: GroundOptions = { colours: [hex('#07080b'), hex('#1c2029')], centre: [960, 520], radius: [1150, 720] };
/** looking straight at the planes' origin: one world unit is one reference px at z = 0 */
const POSE: Pose = { target: [0, 0, 0], tilt: 0, yaw: 0, dist: 1 };
const SHADOW: ImageShadow = { offset: [0, 26], blur: 34, alpha: 0.7, spread: -6 };
/**
 * The probe's finish: *Who Routes the Agents?* V2's numbers (its look.ts FINISH), stated here as
 * the starting point the panes are judged under. Not this film's finish: that is chosen in its
 * own lookdev.
 */
const FINISH: Finish = { bloomThreshold: 1.0, bloomStrength: 0.46, shoulder: 0.78, vignette: 0.42, grain: 1.6 };

interface State {
  need: readonly Capture[];
  draw(d: Draw<StyleId>, tex: (k: Capture) => StageTexture): void;
}

/** the close-up: a 1760x960 pane showing capture pixels at 1.3x, centred on the diff */
const CLOSE = 1.3;
const CLOSE_HALF: [number, number] = [880, 480];
const CLOSE_CROP = [1574 - CLOSE_HALF[0] / CLOSE, 640 - CLOSE_HALF[1] / CLOSE, (2 * CLOSE_HALF[0]) / CLOSE, (2 * CLOSE_HALF[1]) / CLOSE] as const;

const STATES: readonly State[] = [
  {
    need: ['web'],
    draw: (d, t) => d.screenPane([960, 540], [768, 480], t('web'), { radius: 14, shadow: SHADOW }),
  },
  {
    need: ['web'],
    draw: (d, t) => {
      d.pane([0, -86, 0], [640, 400], t('web'), { yaw: 7, pitch: 1.5, radius: 14, shadow: SHADOW });
      d.text('headline', 'One runtime. Every surface.', 960, 152, { align: 'centre' });
    },
  },
  {
    need: ['web'],
    draw: (d, t) => d.screenPane([960, 540], CLOSE_HALF, t('web'), { crop: CLOSE_CROP, radius: 18, shadow: SHADOW }),
  },
  {
    need: ['approval'],
    draw: (d, t) => d.screenPane([960, 540], [768, 480], t('approval'), { radius: 14, shadow: SHADOW }),
  },
  {
    need: ['web', 'approval'],
    draw: (d, t) => {
      d.pane([-380, 60, -420], [600, 375], t('web'), { yaw: 12, radius: 14, lodBias: 1.6, gain: 0.82, shadow: SHADOW });
      d.pane([270, -40, 60], [600, 375], t('approval'), { yaw: -8, radius: 14, shadow: SHADOW });
    },
  },
  {
    need: ['web'],
    // frame pixel (x, y) shows capture pixel (600 + x, 60 + y)
    draw: (d, t) => d.screenPane([960, 540], [1000, 600], t('web'), { crop: [560, 0, 2000, 1200] }),
  },
];

export interface ProbeOptions {
  /** GPU textures kept at once */
  cap: number;
  /** numbers that replace the probe's FINISH (a variant page) */
  finish?: Partial<Finish>;
}

/**
 * Warm-up, then the engine's purity probe (it re-renders the last warm-up frame after the middle
 * one). Ending on frame 3, the approval capture, after frame 2 (web) makes that check cross a
 * change of capture at every boot: with one resident texture, approval is evicted, web uploaded,
 * approval uploaded again. Frame 4 needs two textures, which evict.html refuses, so it is left out.
 */
const WARMUP = [2, 5, 0, 3];

export function bootProbe(options: ProbeOptions): void {
  const { width, height, fps } = pageParams({ width: 1920, height: 1080, fps: 30 });
  const out = document.querySelector<HTMLCanvasElement>('#frame')!;
  out.width = width;
  out.height = height;
  // a CPU-backed 2D canvas: the engine reads it with getImageData on every frame
  const ctx = out.getContext('2d', { alpha: false, willReadFrequently: true, colorSpace: 'srgb' })!;
  const glCanvas = document.createElement('canvas');

  let stage: Stage;
  let type: Type<StyleId>;
  let textures: Textures;
  // fonts and every capture's bytes are fetched here, before ready: nothing is fetched while rendering
  const setup = Promise.all([loadFaces([{ family: PLEX, url: plexUrl, weight: '100 700' }]), ImageBank.load(FILES)]).then(([, bank]) => {
    type = new Type(STYLES, height / 1080);
    stage = new Stage(glCanvas, width, height, { atlas: type.image, finish: { ...FINISH, ...options.finish } });
    textures = new Textures(stage, bank, { cap: options.cap });
  });

  installCapture({
    fps,
    durationFrames: STATES.length,
    width,
    height,
    canvas: out,
    setup,
    fonts: fontSpecs(STYLES),
    gpu: 'webgl',
    warmupFrames: WARMUP,
    async renderFrame(i) {
      const s = STATES[i]!;
      await textures.need(s.need);
      const cam = new Camera(POSE);
      stage.beginFrame();
      stage.beginSub(cam);
      s.draw(new Draw(stage, type, cam, PAL, i), (k) => textures.get(k));
      stage.endSub(GROUND, 1);
      stage.present();
      ctx.drawImage(glCanvas, 0, 0);
    },
  });
}
