/**
 * Every narration line (c1-c28 in src/cues.ts) in the notes block, one per frame, in final type, with
 * the measured width of each line beside it: the notes block fails a render whose line is wider
 * than 1560 px, so this sheet finds such a line in one still call instead of in the film.
 *   pnpm aiv still super-agent --entry src/lookdev/probe.tsx --composition Notes --frames 0-27 --span --profile draft
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { NARRATION, WORDS } from '../cues.ts';
import { Label, lineWidth, NotesBlock } from '../kit/text.tsx';
import { useFilmFonts } from '../look/fonts.ts';
import { Ground } from '../look/Ground.tsx';
import { C, NOTES, TYPE } from '../look/tokens.ts';

export const NOTES_SHEET_FRAMES = NARRATION.length;

export function NotesSheet() {
  const f = useCurrentFrame();
  const { fonts, ready } = useFilmFonts();
  const id = NARRATION[f];
  const w = WORDS[id] as { en: string; 'zh-Hans': string };
  const en = { family: fonts.sans, weight: TYPE.notesEn.weight, size: TYPE.notesEn.size, color: C.ink, numeric: 'tabular-nums' };
  const zh = { family: fonts.sans, weight: TYPE.notesZh.weight, size: TYPE.notesZh.size, color: C.zh };
  const wEn = ready ? Math.ceil(lineWidth(w.en, en)) : 0;
  const wZh = ready ? Math.ceil(lineWidth(w['zh-Hans'], zh)) : 0;
  const fits = Math.max(wEn, wZh) <= NOTES.maxWidth;
  return (
    <AbsoluteFill>
      <Ground />
      {ready && (
        <>
          <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }}>
            <rect x={NOTES.x + NOTES.maxWidth} y={860} width={2} height={160} fill={fits ? C.sketch : C.vermilion} />
            <Label x={NOTES.x} y={200} text={`${id} · ${wEn} / ${wZh} px`} family={fonts.mono} size={TYPE.numbers.size} weight={TYPE.numbers.weight} color={C.ink} />
          </svg>
          {fits && <NotesBlock f={f} span={{ frame: f, end: f }} en={w.en} zh={w['zh-Hans']} layout={NOTES} look={{ en, zh, tick: C.ink }} ready={ready} />}
        </>
      )}
    </AbsoluteFill>
  );
}
