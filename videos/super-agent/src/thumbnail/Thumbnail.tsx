/**
 * The YouTube thumbnail (session 7): one detail of the film's own world, the request handed over whole. Act two at f1830
 * (61.0 s, the film's close on the bug bay): the vermilion request just docked in its own walled Worker bay, W-07, under
 * its lit work slot. It is a Register Desk frame posed by the film's camera function (desk/camera.ts deskCamera, 15°,
 * bloom as the film) at a framing of its own, world only (no notes, labels or tags: the film's DOM layer stays out),
 * beside the title "Who Routes the Agents?" in IBM Plex Sans, set large on clear desk ground.
 *
 * Chosen from three candidates (the problem at f915, the answer at f2225, this detail) by a frame critic and a
 * context-free viewer: at YouTube's small sizes (320x180, 168x94) it is the one with a single focal point.
 *
 * What the thumbnail changes against the film's frame, each in the film's own terms:
 * - focus: everything but the bug bay is on the film's focus step-down at a counterfactual card's depth (state.ts
 *   CARD_DEPTH, 1.5), so the request and its bay are the lightest forms beside the title (a shut bay's lid lies on the
 *   slate and never steps, objects/Dispatch.tsx Hatches: the 2.2x framing leaves only a strip of the docs bay's at the
 *   west edge);
 * - marks: act one's pressed-folder imprints are off (DeskMarks), so no stray edge sits on the clear ground;
 * - print: W-07's nameplate is printed in full ink, as a teaching ID is, and its dossier's top sheet is bare paper
 *   (marks.ts PrintMode), so neither reads as faded print on the hero.
 *
 * The title is drawn on a CPU 2D canvas (the kit's textContext and fillTextChecked) once every face is in: DOM text
 * this large rasters a level or two differently from page to page on the GPU (look/tokens.ts MAX_TEXT_PX; the kit's
 * README, Canvas text), a CPU canvas never did.
 */
import { Stage3D, fillTextChecked, textContext, useFont, useRenderScale } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { WORDS } from '../cues.ts';
import { deskCamera, FAR, FOV, NEAR, type Framing } from '../desk/camera.ts';
import { DeskWorld } from '../desk/DeskWorld.tsx';
import { ANGLE, BLOOM } from '../desk/FilmFrame.tsx';
import { keepFilm, segmentAt } from '../desk/film.ts';
import { DESK_HEX } from '../desk/gl/desk.ts';
import { PRINT_FONT } from '../desk/gl/text.ts';
import type { PrintMode } from '../desk/marks.ts';
import { World } from '../desk/objects/World.tsx';
import { TEXT_HEX } from '../desk/Overlay.tsx';
import { deskStateAt, type DeskState, type FocusId } from '../desk/state.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { DOSSIER, NAMEPLATE } from '../print.ts';

/** Where the title is set: its lines, the first baseline, the leading, the size and weight, and the edge the lines align to (CSS px). */
export interface TitleSpec {
  lines: readonly string[];
  /** the aligned edge's x (left edge for 'left', right edge for 'right') */
  x: number;
  /** the first line's baseline */
  y: number;
  /** baseline to baseline */
  lead: number;
  size: number;
  weight: number;
  align: 'left' | 'right';
  /** tracking, px (negative: tighter, as display type is set) */
  tracking: number;
}

/** The title's words: the film's own (cues.ts WORDS.title), broken before "the". */
const TITLE_LINES: readonly string[] = (() => {
  const t = WORDS.title.en;
  const i = t.indexOf(' the ');
  return [t.slice(0, i), t.slice(i + 1)];
})();

/**
 * The thumbnail: the film frame whose desk state is drawn, the framing (2.2x on the bug bay, the top of the film's
 * close range: its walls clear of the frame's edges and 90 px or more west of the title, the shut bays and the Register
 * mostly past the edges), and the title, right-aligned 96 px in, its two lines' gap level with the request's centre
 * (about y 490). The bottom-right corner, where YouTube draws the duration, stays empty.
 */
export const THUMB = {
  f: 1830,
  framing: { x: 545, y: -40, zoom: 2.2 } as Framing,
  title: { lines: TITLE_LINES, x: 1824, y: 470, lead: 166, size: 172, weight: 600, align: 'right', tracking: -3 } as TitleSpec,
} as const;

if (segmentAt(THUMB.f) !== 'act2') throw new Error(`thumbnail: f${THUMB.f} (${segmentAt(THUMB.f)}) is not an act two frame, which is all this entry draws`);

/** How far the context steps down: as far as the film steps the rest for a counterfactual card (state.ts CARD_DEPTH). */
const CONTEXT_DEPTH = 1.5;
/** Everything of act two's world but the bug bay (its request, folder and work slot): the context the focus steps down. */
const CONTEXT: readonly FocusId[] = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'testsBay', 'freshBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'you', 'deck', 'chute'];

/** What the thumbnail prints: the film's act-two print, but W-07's nameplate in full ink and its dossier sheet bare. */
const DOSSIER_BUG: readonly string[] = DOSSIER.bug;
const keepThumb = (text: string): PrintMode => (text === NAMEPLATE.bug ? true : DOSSIER_BUG.includes(text) ? false : keepFilm(text));

/** Act two's world at the film frame, the context stepped down: every object (objects/World.tsx). */
function ThumbWorld({ pose, print, sans }: { pose: ReturnType<typeof deskCamera>; print: string; sans: string }) {
  const s = useMemo((): DeskState => ({ ...deskStateAt(THUMB.f), step: { amount: CONTEXT_DEPTH, ids: CONTEXT } }), []);
  return (
    <DeskWorld s={s} pose={pose} bloom={BLOOM} printFamily={print} sansFamily={sans} printKeep={keepThumb} marks={{ grooves: true, imprints: false }}>
      <World s={s} />
    </DeskWorld>
  );
}

/** The title on a CPU canvas over the world, drawn once the faces are in. */
function Title({ spec, family, ready }: { spec: TitleSpec; family: string; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = useRenderScale();
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !ready) return;
    const g = textContext(c);
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, 1920, 1080);
    g.font = `${spec.weight} ${spec.size}px ${family}`;
    g.letterSpacing = `${spec.tracking}px`;
    g.fillStyle = TEXT_HEX.en;
    g.textBaseline = 'alphabetic';
    g.textAlign = spec.align;
    spec.lines.forEach((t, i) => fillTextChecked(g, t, spec.x, spec.y + i * spec.lead));
  }, [spec, family, ready, scale]);
  return <canvas ref={ref} width={Math.round(1920 * scale)} height={Math.round(1080 * scale)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />;
}

/** The thumbnail (composition frame 0, index.tsx). */
export function Thumbnail() {
  const { fonts, ready } = useFilmFonts();
  const print = useFont(PRINT_FONT);
  const all = ready && print.ready;
  const pose = useMemo(() => deskCamera(THUMB.framing, ANGLE), []);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <ThumbWorld pose={pose} print={print.family} sans={fonts.sans} />
        </Stage3D>
      )}
      <Title spec={THUMB.title} family={fonts.sans} ready={all} />
    </AbsoluteFill>
  );
}
