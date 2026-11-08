/**
 * The lookdev stills (TREATMENT.md, Lookdev stills), each the film's world at one film frame under
 * its framing (film/world.ts FRAMINGS), built from the film's components. Until the scenes are
 * built (session 3) the state at each frame is set here by hand from the storyboard; the text on
 * screen comes from the cue sheet (film/onScreen.ts), every string from WORDS.
 * - Still1, f750: the switchboard, sketch world;
 * - Still2, f1880: the inked two-level map;
 * - Still3, f4130: the rest, the summary map at 0.6x (the request's whole route at full colour
 *   and the map round it; no timetable panel);
 * - StepDownCheck, f4400: C27, the same frame stepped down to 70% but for your ring and its stamps;
 * - Chart, f3500: a check of the timetable panel's words (the treatment's optional fourth still);
 * - TagCheck, f1750: a check of the built tag's type on the map (it has gone by Still 2).
 *
 * The static dither lies over the whole frame, on top: every ground-colour fill (the Router's and
 * your ring's insides, hollow pills, the cased line's gap, label knockouts) gets the same 0-2 code
 * noise as the open ground, so none of them shows as a flat disc against it.
 */
import { getLength } from '@remotion/paths';
import type { ReactNode } from 'react';
import { AbsoluteFill, staticFile } from 'remotion';
import { WORDS, cue } from '../cues.ts';
import { AnchoredLabel, CameraProvider, DotGrid, ScreenLayer, WorldLayer, screenToWorld, type Camera, type Pt } from '../kit/camera.tsx';
import { Token, routePath } from '../kit/diagram.tsx';
import { DitherLayer } from '../kit/dither.tsx';
import { NotesBlock, lineWidth } from '../kit/text.tsx';
import { useFilmFonts, type FilmFonts } from '../look/fonts.ts';
import { DITHER_TILE, Ground } from '../look/Ground.tsx';
import { C, DOT_GRID, FRAME, NOTES, STEP_DOWN, STROKE, TYPE, WORLD } from '../look/tokens.ts';
import { BraidGhost, ChannelSpring, HubGhost, HubTiles, InterchangeRing, SwitchingTrail, YouRing, type ClearBox } from '../film/act1.tsx';
import { QuestionMark } from '../film/glyphs.tsx';
import { Branch, CasedLine, Depot, Flyover, Gate, Line, Machine, ParallelRoute, Points, RouterRing, Tether, Trunk, WorkerPlatform } from '../film/map.tsx';
import { cueShown, narrationAt } from '../film/onScreen.ts';
import { MessagePill, ReplyPill, SignedReply, StatusDot } from '../film/pills.tsx';
import { labelLook, notesLook } from '../film/style.ts';
import { Tag } from '../film/Tag.tsx';
import { TimetableLabels, TimetablePanel } from '../film/TimetablePanel.tsx';
import {
  BRANCHES,
  CORNER,
  FLYOVER,
  FRAMINGS,
  HUB,
  MACHINES,
  MEMORY,
  PARALLEL,
  QUESTION,
  REPLY,
  REQUEST_BACK_BRANCH,
  REQUEST_OUT,
  ROUTER,
  ROUTER_R,
  STAMPED,
  STAMP_STUB,
  STILL_FRAMES,
  TETHERS,
  TRUNK,
  TRUNK_Y,
  WORKER_DOORS,
  WORKER_TASKS,
  YOU,
  YOU_R,
  memoryTicks,
  platformBox,
  workerState,
} from '../film/world.ts';

/** The frame every still shares: the flat ground, the camera, the world, labels, the notes, and the dither over all of it. */
function StillFrame({ f, cam, world, labels }: { f: number; cam: Camera; world: (fonts: FilmFonts) => ReactNode; labels: (fonts: FilmFonts) => ReactNode }) {
  const { fonts, ready } = useFilmFonts();
  const look = notesLook(fonts);
  return (
    <AbsoluteFill>
      <Ground />
      {ready && (
        <CameraProvider cam={cam}>
          <WorldLayer>
            <DotGrid pitch={DOT_GRID.pitch} diameter={DOT_GRID.diameter} color={C.dot} bounds={WORLD} fadeBelow={DOT_GRID.fadeBelow} />
            {world(fonts)}
          </WorldLayer>
          <ScreenLayer>{labels(fonts)}</ScreenLayer>
          {narrationAt(f).map((id) => {
            const w = WORDS[id] as { en: string; 'zh-Hans': string };
            return <NotesBlock key={id} f={f} span={cue(id)} en={w.en} zh={w['zh-Hans']} layout={NOTES} look={look} ready={ready} />;
          })}
        </CameraProvider>
      )}
      <DitherLayer src={staticFile(DITHER_TILE.file)} tile={DITHER_TILE.size} x={0} y={0} width={FRAME.width} height={FRAME.height} />
    </AbsoluteFill>
  );
}

const YOU_LABEL = `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`;

/**
 * The one rule for your label in every still: it hangs under the ring that marks you, flush with
 * that ring's left edge (as a transit map sets a station's name). Screen px from the ring's centre
 * to the label's start, for a ring of world radius `r` with a `stroke` px outline.
 */
const flushLeft = (cam: Camera, r: number, stroke: number) => -(r * cam.scale + stroke / 2);

// ---------------------------------------------------------------------------------------------
// Still 1, f750: the switchboard, sketch world

/** Screen px from the hub to the baseline of your label under the interchange ring that has closed round you (clear of the trail's south cord). */
const HUB_LABEL_DY = 162;
/** Screen px of trail-free ground kept round your label. */
const LABEL_CLEAR = 8;

/** The box (world units) round a label that starts at `at` + (`dx`, `dy`) px, `pad` px clear on every side. */
function labelClearBox(fonts: FilmFonts, cam: Camera, at: Pt, dx: number, dy: number, text: string, pad: number): ClearBox {
  const w = lineWidth(text, { family: fonts.sans, weight: TYPE.label.weight, size: TYPE.label.size });
  // the label's ink: Han glyphs reach about 0.9 em over the baseline, the "y" descender about 0.25 em under it; plus the knockout
  const up = 0.9 * TYPE.label.size + STROKE.knockout + pad;
  const down = 0.25 * TYPE.label.size + STROKE.knockout + pad;
  const side = STROKE.knockout + pad;
  return { x: at[0] + (dx - side) / cam.scale, y: at[1] + (dy - up) / cam.scale, w: (w + 2 * side) / cam.scale, h: (up + down) / cam.scale };
}

export function Still1() {
  const cam = FRAMINGS.still1;
  const dx = flushLeft(cam, ROUTER_R, STROKE.router);
  return (
    <StillFrame
      f={STILL_FRAMES.still1}
      cam={cam}
      world={(fonts) => (
        <>
          <ChannelSpring />
          <SwitchingTrail clear={[labelClearBox(fonts, cam, HUB, dx, HUB_LABEL_DY, YOU_LABEL, LABEL_CLEAR)]} />
          <HubTiles />
          <InterchangeRing at={HUB} />
          <YouRing at={HUB} />
        </>
      )}
      labels={(fonts) => <AnchoredLabel at={HUB} dx={dx} dy={HUB_LABEL_DY} anchor="start" text={YOU_LABEL} {...labelLook(fonts)} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// The map after the turn, as far as it is built at a frame

/** What the map holds at a frame, beyond what it holds from the turn on. */
interface MapState {
  f: number;
  /** beat 4, C13 on: the Workers stepped down to the receded tone */
  receded: boolean;
  /** beat 5 on: the points, the gate and the flyover */
  keepingUp: boolean;
  /** beat 7 on: the dashed tethers, machines and depot, and the "?" */
  proposed: boolean;
  /** the rest (bar 51 on): the request's whole route traced, the replies you signed; the request's task has left its platform (done and signed) */
  signedOff: boolean;
  /** the rest's step-down: everything but your ring and its stamped replies at STEP_DOWN (the ghosts stay ghosts) */
  steppedDown?: boolean;
  /** your laptop, open until C24 */
  laptopOpen: boolean;
  /** extra world drawn over the lines (tokens, dots), under the stations */
  children?: ReactNode;
}

function AfterTurn({ f, receded, keepingUp, proposed, signedOff, steppedDown = false, laptopOpen, children }: MapState) {
  const worker = receded ? C.receded : C.ink;
  return (
    <>
      <HubGhost />
      <BraidGhost />
      <g opacity={steppedDown ? STEP_DOWN : undefined}>
        {proposed && (
          <>
            {/* proposed parts are dashed ink, never the Workers' receded tone (film/map.tsx) */}
            {TETHERS.map((t, i) => (
              <Tether key={i} points={t} />
            ))}
            {MACHINES.map((m, i) => (
              <Machine key={i} at={m} />
            ))}
            <Depot />
            <g transform={`translate(${QUESTION[0]} ${QUESTION[1]})`}>
              <QuestionMark color={C.sketch} />
            </g>
          </>
        )}
        {[...BRANCHES].reverse().map((b, i) => (
          <Branch key={i} points={b} color={worker} />
        ))}
        <Trunk points={TRUNK} />
        {keepingUp && (
          <>
            <Points />
            <Gate />
          </>
        )}
        {signedOff ? (
          <>
            {/* the request's whole route on the lines themselves: vermilion out along the trunk, down the stem and the first branch; cased green back beside the branch, then the reply line */}
            <Line points={REQUEST_OUT.slice(0, TRUNK.length)} width={STROKE.trunk} color={C.vermilion} />
            <Line points={REQUEST_OUT.slice(TRUNK.length - 1)} width={STROKE.branch} color={C.vermilion} />
            <ParallelRoute points={REQUEST_BACK_BRANCH} offset={PARALLEL} color={C.green} width={STROKE.branch} cased />
            <CasedLine points={REPLY} color={C.green} />
          </>
        ) : (
          <CasedLine points={REPLY} color={C.ink} />
        )}
        {/* the spring over the route's start: the request's route runs out from its place in the pile */}
        <ChannelSpring request={false} />
        {keepingUp && <Flyover points={FLYOVER} />}
        {children}
        <RouterRing ticks={memoryTicks(f)} />
        {WORKER_DOORS.map((door, i) => {
          const s = workerState(f, WORKER_TASKS[i]);
          // the first Worker holds the request until it is done and signed; then only its cap is left
          const task = i === 0 ? (signedOff ? undefined : 'request') : 'message';
          return <WorkerPlatform key={i} id={i} door={door} task={task} step={s.step} done={s.done} color={worker} />;
        })}
      </g>
      {signedOff && (
        <>
          {/* you: one short stroke to the replies you signed */}
          <Line points={STAMP_STUB} width={STROKE.you} />
          {STAMPED.map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <SignedReply />
            </g>
          ))}
        </>
      )}
      <YouRing at={YOU} laptop={{ open: laptopOpen }} />
    </>
  );
}

/**
 * The map's persistent labels: Router west of its ring (between the trunk's run in and the reply
 * line, the one side no line leaves from), Worker under the platforms, you under your ring (flush
 * with its left edge, the one rule for your label).
 */
function MapLabels({ fonts, cam, steppedDown = false }: { fonts: FilmFonts; cam: Camera; steppedDown?: boolean }) {
  const look = labelLook(fonts);
  const w3 = platformBox(WORKER_DOORS[2]);
  // at the rest the map's labels step down with the map; yours stays at full ink
  const opacity = steppedDown ? STEP_DOWN : undefined;
  return (
    <>
      <AnchoredLabel at={[ROUTER[0] - MEMORY.outer, ROUTER[1]]} dx={-18} dy={-12} anchor="end" text={WORDS.router.en} {...look} opacity={opacity} />
      <AnchoredLabel at={[w3.x + w3.w / 2, w3.y + w3.h]} dy={50} anchor="middle" text={WORDS.worker.en} {...look} opacity={opacity} />
      <AnchoredLabel at={YOU} dx={flushLeft(cam, YOU_R, STROKE.you)} dy={YOU_R * cam.scale + 46} anchor="start" text={YOU_LABEL} {...look} />
    </>
  );
}

/** The reply line's path, cornered as CasedLine draws it, for the reply token to ride. */
const REPLY_PATH = routePath(REPLY, CORNER);

/** The busy Workers reporting up: status dots climbing the stem. */
function StatusDots() {
  return (
    <>
      {[976, 1128].map((y) => (
        <g key={y} transform={`translate(${ROUTER[0]} ${y})`}>
          <StatusDot />
        </g>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Still 2, f1880: the inked two-level map

export function Still2() {
  const f = STILL_FRAMES.still2;
  return (
    <StillFrame
      f={f}
      cam={FRAMINGS.still2}
      world={() => (
        <AfterTurn f={f} receded={false} keepingUp={false} proposed={false} signedOff={false} laptopOpen>
          {/* traffic on the trunk */}
          {[1056, 1440].map((x, i) => (
            <g key={i} transform={`translate(${x} ${TRUNK_Y})`}>
              <MessagePill id={`trunk-${i}`} />
            </g>
          ))}
          <StatusDots />
          {/* the one reply, arriving at you on the cased line */}
          <Token d={REPLY_PATH} at={getLength(REPLY_PATH) - 150} orient={false}>
            <ReplyPill />
          </Token>
        </AfterTurn>
      )}
      labels={(fonts) => (
        <>
          <MapLabels fonts={fonts} cam={FRAMINGS.still2} />
          {/* the built tag only while the cue sheet shows it (it has gone before C12) */}
          {cueShown('tag-built', f) && <BuiltTag fonts={fonts} cam={FRAMINGS.still2} />}
        </>
      )}
    />
  );
}

/**
 * The built tag (f1680-1810), beside the two levels: under the trunk, set flush right a little
 * short of the trunk's run down into the Router, so it reads towards the structure it qualifies
 * and crosses no line (screen px: the right end of both lines, and the zh baseline).
 */
const BUILT_TAG_AT: Pt = [1201, 244];

function BuiltTag({ fonts, cam }: { fonts: FilmFonts; cam: Camera }) {
  return <Tag fonts={fonts} at={screenToWorld(cam, [BUILT_TAG_AT[0], BUILT_TAG_AT[1] + 16])} words={WORDS.tagBuilt} anchor="end" />;
}

// ---------------------------------------------------------------------------------------------
// TagCheck, f1750: the built tag's type on the map (it has gone by Still 2's frame)

export function TagCheck() {
  const f = STILL_FRAMES.tag;
  const cam = FRAMINGS.tag;
  return (
    <StillFrame
      f={f}
      cam={cam}
      world={() => (
        <AfterTurn f={f} receded={false} keepingUp={false} proposed={false} signedOff={false} laptopOpen>
          {[1248].map((x, i) => (
            <g key={i} transform={`translate(${x} ${TRUNK_Y})`}>
              <MessagePill id={`trunk-${i}`} />
            </g>
          ))}
        </AfterTurn>
      )}
      labels={(fonts) => (
        <>
          <MapLabels fonts={fonts} cam={cam} />
          {cueShown('tag-built', f) && <BuiltTag fonts={fonts} cam={cam} />}
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Still 3, f4130: the rest, the summary map at 0.6x

/**
 * The summary is the route: the map is framed without the timetable panel, whose bars may never
 * stand without their caveat tag (gone since f3600). The request's route at full vermilion and
 * green, the Router in ink, the Workers in their receded tone (STORYBOARD.md 8.2): nothing steps
 * down before C27.
 */
export function Still3() {
  const f = STILL_FRAMES.still3;
  return (
    <StillFrame
      f={f}
      cam={FRAMINGS.still3}
      world={() => <AfterTurn f={f} receded keepingUp proposed signedOff laptopOpen={false} />}
      labels={(fonts) => <MapLabels fonts={fonts} cam={FRAMINGS.still3} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// StepDownCheck, f4400: C27, the rest's frame stepped down (a check beside the three stills)

/** Everything steps down to 70% but your ring and the replies you stamped (STORYBOARD.md 8.4); C27 in the notes. */
export function StepDownCheck() {
  const f = STILL_FRAMES.stepDown;
  return (
    <StillFrame
      f={f}
      cam={FRAMINGS.still3}
      world={() => <AfterTurn f={f} receded keepingUp proposed signedOff steppedDown laptopOpen={false} />}
      labels={(fonts) => <MapLabels fonts={fonts} cam={FRAMINGS.still3} steppedDown />}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Chart, f3500: the timetable panel with every word the cue sheet shows then (a check, not for sign-off)

export function ChartCheck() {
  const f = STILL_FRAMES.chart;
  return (
    <StillFrame
      f={f}
      cam={FRAMINGS.chart}
      world={() => (
        <>
          <TimetablePanel />
          <AfterTurn f={f} receded keepingUp proposed={false} signedOff={false} laptopOpen />
        </>
      )}
      labels={(fonts) => <TimetableLabels fonts={fonts} show={{ header: cueShown('tag-chart', f), lanes: cueShown('chart-lanes', f), tokens: cueShown('chart-tokens', f) }} />}
    />
  );
}
