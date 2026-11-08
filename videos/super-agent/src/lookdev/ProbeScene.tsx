/**
 * The 2D determinism probe (README.md, session 2): one scene that puts every risk of the dark ink
 * map in front of the renderer before any film code exists. 300 frames, shown as film frames
 * 0-299 of Main and as the lookdev composition 'Probe' (lookdev/probe.tsx).
 * - Large DOM text: a MAX_TEXT_PX (136 px) English line in Plex and a 160 px zh line in Noto Sans SC.
 *   A 200 px Plex line was not bit-exact across pages at 1080p (look/tokens.ts, MAX_TEXT_PX).
 * - The notes block revealing two EN + zh pairs: a wipe at film frame 150, a fade at frame 100.
 *   Faint guides mark the two baselines (y 938 and 992) the lines must sit on.
 * - The world under the camera, which eases from 1.0x to 1.6x about the Router (film frames
 *   80-160) and back (200-280): the dot grid, the trunk and a branch drawing on at the ink speed,
 *   the request riding them, the Router with its thinking arc filling once a bar, a Worker box, a
 *   dashed proposed tether and machine, a hatched box, message pills, a sketch stroke drawing on
 *   and a 12% sketch ghost; labels in screen space that stay 40 px at every zoom, and the stress
 *   plate's numbers as DOM text (TextReveal) at a world anchor.
 * - Banding: the ground lifts about 2% luma towards the centre (#202226 to #25272B); the right
 *   half of the frame has the dither tile over it, the left half not.
 */
import { getLength } from '@remotion/paths';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FPS, WORDS } from '../cues.ts';
import { AnchoredLabel, CameraProvider, DotGrid, ScreenLayer, useCamera, WorldLayer, worldToScreen, zoomAbout, type Camera, type Pt } from '../kit/camera.tsx';
import { Edge, Emphasis, Hatch, Pill, PlatformBox, Ring, Token, penLength, roundedRectPath, routePath } from '../kit/diagram.tsx';
import { sketchPasses } from '../kit/sketch.ts';
import { NotesBlock, TextReveal, ZH_BREAKS, type TextLook } from '../kit/text.tsx';
import { EASE, prog, win } from '../kit/timeline.ts';
import { useFilmFonts, type FilmFonts } from '../look/fonts.ts';
import { Ground } from '../look/Ground.tsx';
import { C, DOT_GRID, GHOST_OPACITY, MAX_TEXT_PX, MOTION, NOTES, STROKE, TYPE, WORLD } from '../look/tokens.ts';
import { PROBE_BIG_EN, PROBE_BIG_ZH, PROBE_YOU } from './probeWords.ts';

export const PROBE_FRAMES = 300;

// --- the camera: 1.0x on the world's centre, easing to 1.6x about the Router and back
const BASE: Camera = { x: WORLD.width / 2, y: WORLD.height / 2, scale: 1 };
const ROUTER: Pt = [2000, 1230];
const ZOOM_IN = win(80, 80, EASE.cubicInOut);
const ZOOM_OUT = win(200, 80, EASE.cubicInOut);
const ZOOM_TO = 1.6;

export function probeCamera(f: number): Camera {
  const e = prog(f, ZOOM_IN) - prog(f, ZOOM_OUT);
  return zoomAbout(BASE, ROUTER, ZOOM_TO ** e);
}

// --- the world (world units; at 1.0x a world point shows at itself minus (960, 540))
const YOU: Pt = [1160, 1150];
const TRUNK = routePath([[1180, 1150], [1640, 1150], [1720, 1230], [1920, 1230]], STROKE.trunkRadius);
const BRANCH = routePath([[2080, 1230], [2180, 1230], [2280, 1330], [2480, 1330]], STROKE.trunkRadius);
const ROUTE = routePath([[1180, 1150], [1640, 1150], [1720, 1230], [2180, 1230], [2280, 1330], [2480, 1330]], STROKE.trunkRadius);
const WORKER = { x: 2480, y: 1286, w: 220, h: 88 };
const TETHER = routePath([[2590, 1286], [2590, 1150]], 0);
const MACHINE = roundedRectPath(2554, 1078, 72, 72, 6);
const RISK = { x: 1300, y: 1290, w: 220, h: 88 };
const PILLS: Pt[] = [
  [1220, 1050],
  [1300, 1050],
  [1380, 1050],
];
const SKETCH: Pt[] = [
  [2200, 1112],
  [2262, 1046],
  [2318, 1104],
  [2356, 1062],
  [2420, 1036],
  [2462, 1108],
  [2530, 1064],
];
const GHOST: Pt[] = [
  [1560, 1020],
  [1660, 1060],
  [1760, 1030],
  [1860, 1080],
];

/** the ink's pen speed in world units per frame at 1.0x */
const INK = MOTION.inkSpeed / FPS;
const LENGTH = new Map([TRUNK, BRANCH, ROUTE, TETHER, MACHINE].map((d) => [d, getLength(d)]));
const lengthOf = (d: string): number => LENGTH.get(d)!;
const pen = (f: number, start: number, d: string) => penLength(f, start, lengthOf(d), INK, MOTION.inkEaseIn, MOTION.inkEaseOut);

// --- the notes: two pairs (spans in film frames; each wipes in over the 6 frames before its span)
const NOTE_1 = { words: WORDS.c12, span: { frame: 26, end: 97 } };
const NOTE_2 = { words: WORDS.c4, span: { frame: 153, end: 290 } };
// --- the stress-plate numbers as DOM text: wiped in and faded by TextReveal, riding the camera
const PLATE_AT: Pt = [1800, 1345];
const PLATE_SPAN = { frame: 46, end: 250 };

function notesLook(fonts: FilmFonts): { en: TextLook; zh: TextLook; tick: string } {
  return {
    en: { family: fonts.sans, weight: TYPE.notesEn.weight, size: TYPE.notesEn.size, color: C.ink, numeric: 'tabular-nums' },
    zh: { family: fonts.sans, weight: TYPE.notesZh.weight, size: TYPE.notesZh.size, color: C.zh },
    tick: C.ink,
  };
}

function World({ f }: { f: number }) {
  const routeLen = lengthOf(ROUTE);
  // the request stops short of the Worker box, at its door
  const ride = (routeLen - 40) * prog(f, win(90, 80));
  const sketchTo = prog(f, win(10, 60, EASE.sineInOut));
  const [sketchMain, sketchScribble] = sketchPasses(SKETCH, { width: 6, seed: 11, id: 'probe-sketch', pressure: 0.55, wobble: 1.8, to: sketchTo });
  const [ghostMain, ghostScribble] = sketchPasses(GHOST, { width: 5, seed: 11, id: 'probe-ghost' });
  return (
    <>
      <DotGrid pitch={DOT_GRID.pitch} diameter={DOT_GRID.diameter} color={C.dot} bounds={WORLD} fadeBelow={DOT_GRID.fadeBelow} />
      {/* the act-one ghost: an erased sketch line at 12% */}
      <g fill={C.sketch} opacity={GHOST_OPACITY}>
        <path d={ghostMain} />
        <path d={ghostScribble} />
      </g>
      {/* risk: a hatched box */}
      <Hatch shape={roundedRectPath(RISK.x, RISK.y, RISK.w, RISK.h, 12)} box={{ x0: RISK.x, y0: RISK.y, x1: RISK.x + RISK.w, y1: RISK.y + RISK.h }} pitch={STROKE.hatchPitch} width={STROKE.hatch} color={C.ink} />
      <PlatformBox {...RISK} color={C.ink} width={STROKE.branch} />
      {/* message pills */}
      {PILLS.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Pill fill={C.pill} stroke={C.sketch} dashes={{ seed: 5, id: i, color: C.sketch }} />
        </g>
      ))}
      {/* you, the trunk, the Router, a branch, a Worker */}
      <Ring cx={YOU[0]} cy={YOU[1]} r={STROKE.youRadius} color={C.ink} width={STROKE.you} />
      <Edge d={TRUNK} drawn={pen(f, 6, TRUNK)} color={C.ink} width={STROKE.trunk} />
      <Ring cx={ROUTER[0]} cy={ROUTER[1]} r={STROKE.routerRadius} color={C.ink} width={STROKE.router} arc={{ p: (f % 80) / 80, r: STROKE.routerRadius + 14, width: STROKE.thinkingArc, color: C.ink }} />
      <Edge d={BRANCH} drawn={pen(f, 36, BRANCH)} color={C.ink} width={STROKE.branch} />
      <PlatformBox {...WORKER} color={C.ink} width={STROKE.branch} />
      {/* proposed: a dashed tether to a dashed machine square */}
      <Edge d={TETHER} drawn={pen(f, 60, TETHER)} color={C.ink} width={STROKE.proposed} dash={STROKE.proposedDash} cap="butt" />
      <Edge d={MACHINE} drawn={pen(f, 66, MACHINE)} color={C.ink} width={STROKE.proposed} dash={STROKE.proposedDash} cap="butt" />
      {/* a sketch line drawing on, with its scribble pass */}
      <g fill={C.sketch}>
        <path d={sketchMain} />
        <path d={sketchScribble} />
      </g>
      {/* the request rides the route through the Router to the Worker, then a ring marks it */}
      {f >= 90 && (
        <Token d={ROUTE} at={ride}>
          <Pill fill={C.vermilion} />
        </Token>
      )}
      <Emphasis cx={2480} cy={1330} r={24} f={f} start={170} color={C.ink} width={STROKE.hairline} />
    </>
  );
}

/** DOM text at a world anchor, on whole pixels (a composited text layer is never resampled). */
function Plate({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const { cam, view } = useCamera();
  const [x, y] = worldToScreen(cam, PLATE_AT, view);
  const style = { position: 'absolute', left: Math.round(x), top: Math.round(y), fontFamily: fonts.mono, fontWeight: TYPE.numbers.weight, fontSize: TYPE.numbers.size, lineHeight: '52px', color: C.ink, whiteSpace: 'pre' } as const;
  return (
    <TextReveal f={f} span={PLATE_SPAN} style={style}>
      {WORDS.plateDecision.en}
    </TextReveal>
  );
}

function Labels({ fonts }: { fonts: FilmFonts }) {
  const label = { family: fonts.sans, size: TYPE.label.size, weight: TYPE.label.weight, cjkWeight: TYPE.label.cjkWeight, color: C.ink, knockout: { color: C.ground, width: STROKE.knockout } };
  return (
    <>
      <AnchoredLabel at={[ROUTER[0], ROUTER[1] - STROKE.routerRadius]} dy={-28} anchor="middle" text={WORDS.router.en} {...label} />
      <AnchoredLabel at={[WORKER.x + 50, WORKER.y]} dy={-18} anchor="end" text={WORDS.worker.en} {...label} />
      <AnchoredLabel at={YOU} dy={68} anchor="middle" text={PROBE_YOU} {...label} />
    </>
  );
}

/** The probe at frame `f` of its own timeline (Main shows it after the leader, inside a Sequence). */
export function ProbeScene() {
  const f = useCurrentFrame();
  const { fonts, ready } = useFilmFonts();
  const look = notesLook(fonts);
  return (
    <AbsoluteFill>
      <Ground lift={{ centre: '#25272B', rx: 1100, ry: 700 }} dither={{ x: 960, y: 0, width: 960, height: 1080 }} />
      {ready && (
        <CameraProvider cam={probeCamera(f)}>
          <WorldLayer>
            <World f={f} />
          </WorldLayer>
          <div style={{ position: 'absolute', left: 120, top: 40, fontFamily: fonts.sans, fontWeight: 600, fontSize: MAX_TEXT_PX, lineHeight: '156px', color: C.ink, whiteSpace: 'pre' }}>{PROBE_BIG_EN}</div>
          <div style={{ position: 'absolute', left: 120, top: 210, fontFamily: fonts.sans, fontWeight: 500, fontSize: 160, lineHeight: '180px', color: C.zh, whiteSpace: 'pre', ...ZH_BREAKS }}>{PROBE_BIG_ZH}</div>
          <ScreenLayer>
            <Labels fonts={fonts} />
            {/* the baselines the notes must sit on */}
            {[NOTES.enBaseline, NOTES.zhBaseline].map((y) => (
              <line key={y} x1={NOTES.tick.x} x2={1820} y1={y + 1} y2={y + 1} stroke={C.sketch} strokeWidth={2} opacity={0.35} />
            ))}
          </ScreenLayer>
          <Plate f={f} fonts={fonts} />
          {[NOTE_1, NOTE_2].map((n, i) => (
            <NotesBlock key={i} f={f} span={n.span} en={n.words.en} zh={n.words['zh-Hans']} layout={NOTES} look={look} ready={ready} />
          ))}
        </CameraProvider>
      )}
    </AbsoluteFill>
  );
}
