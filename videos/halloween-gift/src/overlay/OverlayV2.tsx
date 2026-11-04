/**
 * The V2 film's words as DOM over the 3D frame, everything on ones: the storybook captions (EN
 * above zh-Hans), the email card (overlay/EmailCard.tsx: our own parody of the suspension email)
 * laid exactly on the 3D letter's face B through the journey's camera once its slats have
 * flipped, with the 封号 seal thunking down and a bat (overlay/BatSvg.tsx, the 3D bats' own
 * planform) making off with the Appeal button; and the end card with its notice.
 */
import { progress } from '@aiv/core';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { at, cues, FPS, WORDS } from '../cues.ts';
import { journeyAt } from '../film/journey.ts';
import type { FilmFonts } from '../look/fonts.ts';
import { letter2Corners } from '../world/Letter2.tsx';
import { BatSvg } from './BatSvg.tsx';
import { EMAIL, EmailCard, PARAGRAPH } from './EmailCard.tsx';
import { screenBoxAt } from './project.ts';

const span = (id: string) => {
  const e = cues.events.find((x) => x.id === id)!;
  return [e.frame, e.end ?? e.frame] as const;
};

function fade(f: number, [a, b]: readonly [number, number], inF = 6, outF = 6): number {
  return Math.min(progress(f, a, a + inF), 1 - progress(f, b - outF, b));
}

function Caption({ f, id, words, fonts }: { f: number; id: string; words: { en: string; 'zh-Hans': string }; fonts: FilmFonts }) {
  const { height: h } = useVideoConfig();
  const o = fade(f, span(id));
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: h * 0.075, top: h * 0.065, opacity: o }}>
      <div style={{ padding: `${h * 0.014}px ${h * 0.028}px`, background: 'rgba(43, 24, 48, 0.8)', borderRadius: h * 0.006, textAlign: 'left', color: '#DCE6B7', whiteSpace: 'pre-line' }}>
        <div style={{ fontFamily: fonts.serif, fontSize: h * 0.046, lineHeight: 1.2 }}>{words.en}</div>
        <div style={{ fontFamily: fonts.cjk, fontSize: h * 0.038, lineHeight: 1.35, fontWeight: 500 }}>{words['zh-Hans']}</div>
      </div>
    </div>
  );
}

/** in once the last slat has flipped (film/beats.ts letterAt: at(25, 2) + 18), out onto the sealed 3D face before the letter sinks back (at(29)) */
const EMAIL_IN = at(25, 2) + 18;
const EMAIL_OUT = at(29) - 2;
/** the bat takes the Appeal button on bar 27 beat 3 and carries it off down to the lower left (never across the words) */
const GRAB = at(27, 3);

function Email({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const { width: W, height: H } = useVideoConfig();
  const o = Math.min(progress(f, EMAIL_IN, EMAIL_IN + 4), 1 - progress(f, EMAIL_OUT - 4, EMAIL_OUT));
  if (o <= 0) return null;
  const box = screenBoxAt(journeyAt(f), letter2Corners(), W, H);
  const h = box.height;
  const w = box.width;
  // the seal thunks down on bar 26: from 1.5× to 1 over four frames, then a small damped shake
  const st = f - at(26);
  const seal = st < 0 ? null : { scale: st < 4 ? 1.5 - 0.5 * progress(st, 0, 4, 'outCubic') : 1, shake: st >= 4 && st < 12 ? h * 0.006 * Math.sin((st - 4) * 2.4) * (1 - (st - 4) / 8) : 0 };
  // the Appeal button's home (EmailCard: right-aligned under the paragraph) and its way off
  const away = progress(f, GRAB, GRAB + 30, 'inCubic');
  const dx = -away * (box.left + w * 0.7);
  const dy = away * (H - box.top);
  const paraBottom = h * (EMAIL.para.top + PARAGRAPH.length * EMAIL.para.size * EMAIL.para.lead);
  const tabX = box.left + w - h * EMAIL.pad - h * 0.12 + dx;
  const tabY = box.top + paraBottom + h * 0.02 + dy;
  // the bat swoops in from the lower left over twelve frames and flies off holding the button
  const swoop = 1 - progress(f, GRAB - 12, GRAB, 'outCubic');
  const batSize = h * 0.34;
  const bx = tabX - swoop * h * 0.9;
  const by = tabY - h * 0.06 + swoop * h * 0.35;
  return (
    <>
      {/* toned to face B's paper on the 3D letter (drawn at 0.88 of white, under the bloom), so the crossfade lands on the same pixels */}
      <EmailCard width={w} height={h} fonts={fonts} tab={{ dx, dy }} seal={seal} style={{ left: box.left, top: box.top, opacity: o, filter: 'brightness(0.88)' }} />
      {f >= GRAB - 12 && f < GRAB + 30 && (
        <BatSvg phase={(f / FPS) * 3.5} size={batSize} style={{ position: 'absolute', left: bx - batSize * 0.57, top: by - batSize * 0.355, opacity: o }} />
      )}
    </>
  );
}

function EndNotice({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const { height: h } = useVideoConfig();
  const o = fade(f, span('end'), 8, 2);
  if (o <= 0) return null;
  const t = f - at(36);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: h * 0.07, opacity: o, color: '#DCE6B7', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: h * 0.03, marginBottom: h * 0.03 }}>
        <div style={{ fontFamily: fonts.serif, fontSize: h * 0.08, letterSpacing: '0.02em' }}>The End</div>
        {t >= 0 && (
          <div style={{ width: h * 0.1, height: h * 0.1, background: '#C8322A', color: '#fff7f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.cjk, fontSize: h * 0.07, fontWeight: 900, borderRadius: h * 0.008, transform: `rotate(-6deg) scale(${1.5 - 0.5 * progress(t, 0, 4, 'outCubic')})` }}>
            完
          </div>
        )}
      </div>
      <div style={{ fontFamily: fonts.sans, fontSize: h * 0.048 }}>Fan parody. Not affiliated with Anthropic. Fictional email.</div>
      <div style={{ fontFamily: fonts.cjk, fontSize: h * 0.042 }}>粉丝恶搞，与 Anthropic 无关，邮件纯属虚构。</div>
    </AbsoluteFill>
  );
}

export function OverlayV2({ f, fonts }: { f: number; fonts: FilmFonts }) {
  return (
    <AbsoluteFill>
      <Caption f={f} id="caption-1" words={WORDS.caption1} fonts={fonts} />
      <Caption f={f} id="caption-2" words={WORDS.caption2} fonts={fonts} />
      <Email f={f} fonts={fonts} />
      <EndNotice f={f} fonts={fonts} />
    </AbsoluteFill>
  );
}
