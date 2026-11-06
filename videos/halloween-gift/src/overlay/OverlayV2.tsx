/**
 * The V2 film's words as DOM over the 3D frame, everything on ones: the storybook captions (EN
 * above zh-Hans), the email card (overlay/EmailCard.tsx: our own parody of the suspension email)
 * laid exactly on the 3D letter's face B through the journey's camera once its slats have
 * flipped, with the 封号 seal thunking down and a bat (overlay/BatSvg.tsx, the 3D bats' own
 * planform) making off with the Appeal button; and the end card with its notice.
 */
import { progress } from '@aiv/core';
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { at, cues, FPS, WORDS } from '../cues.ts';
import { APPEAL_SNATCH } from '../film/beats.ts';
import { journeyAt } from '../film/journey.ts';
import type { FilmFonts } from '../look/fonts.ts';
import { letter2Corners } from '../world/Letter2.tsx';
import { BatSvg } from './BatSvg.tsx';
import { EmailCard, emailLayout, TAB_W } from './EmailCard.tsx';
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
/**
 * the bat takes the Appeal button on bar 27 beat 3 (film/beats.ts APPEAL_SNATCH): it swoops in
 * from the card's blank lower right, grips the tab's top edge (its claws over it, its wings over
 * the blank card round the tab, never across the words) and carries it off up and away to the
 * right, between the seal and Clawd's hat, the tab swinging from its claws with the wingbeat
 */
const GRAB = APPEAL_SNATCH;

/** a hash of a cell and a frame to 0..1 (the card's grain; deterministic, cheap enough for every cell) */
function grainHash(x: number, y: number, f: number): number {
  let n = (x * 374761393 + y * 668265263 + f * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/**
 * The film's grain over the DOM card (the post's grain is under it, in the 3D frame): a fresh
 * cell of noise every frame, 1.5 px cells as the post's (look/NightPost), soft-light, about as
 * strong on the card's paper as the post's on the world round it, so card and world share one texture.
 */
function CardGrain({ f, left, top, w, h, opacity }: { f: number; left: number; top: number; w: number; h: number; opacity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.max(1, Math.ceil(w / 1.5));
  const ch = Math.max(1, Math.ceil(h / 1.5));
  useLayoutEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const img = g.createImageData(cw, ch);
    const d = img.data;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const v = Math.round(128 + 16 * (grainHash(x, y, f) - 0.5));
        const k = (y * cw + x) * 4;
        d[k] = v;
        d[k + 1] = v;
        d[k + 2] = v;
        d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, [f, cw, ch]);
  return <canvas ref={ref} width={cw} height={ch} style={{ position: 'absolute', left, top, width: cw * 1.5, height: ch * 1.5, imageRendering: 'pixelated', mixBlendMode: 'soft-light', opacity, pointerEvents: 'none' }} />;
}

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
  // the Appeal button's home (EmailCard emailLayout: right-aligned under the paragraph): its top
  // edge's middle, where the bat grips it
  const lay = emailLayout(h);
  const homeX = box.left + w - lay.tab.right - (h * TAB_W) / 2;
  const homeY = box.top + lay.tab.top;
  // its way off: out to the right past the words' right edge first, then climbing away (clear of
  // the seal above, over Clawd's hat)
  const away = progress(f, GRAB, GRAB + 30, 'inCubic');
  const run = W - homeX + h * 0.4;
  const dx = away * run;
  const dy = -(away ** 2.5) * run * 0.58;
  // the bat swoops in from the lower right over twelve frames, grips, and flies off with it
  const swoop = 1 - progress(f, GRAB - 12, GRAB, 'outCubic');
  const phase = (f / FPS) * 3.5;
  const batSize = h * 0.32;
  const reach = 0.2;
  // its body over the tab's top edge toward its right end (its wings over the blank card right of
  // the words, the near wing low), its claws closing just over the edge (BatSvg `reach`)
  const gripX = homeX + h * 0.11 + dx;
  const gripY = homeY + dy - reach * batSize + h * 0.014;
  const bx = gripX + swoop * h * 0.75;
  const by = gripY + swoop * h * 0.3;
  // lifted, the tab swings with the wingbeat (a little each way about its top edge) and casts its shadow
  const lift = progress(f, GRAB, GRAB + 4);
  const rot = lift * 10 * Math.sin(2 * Math.PI * phase + 0.8);
  return (
    <>
      {/* toned to face B's paper on the 3D letter (drawn at 0.88 of white, under the bloom), so the crossfade lands on the same pixels */}
      <EmailCard width={w} height={h} fonts={fonts} tab={{ dx, dy, rot, lift }} seal={seal} style={{ left: box.left, top: box.top, opacity: o, filter: 'brightness(0.88)' }} />
      {f >= GRAB - 12 && f < GRAB + 30 && (
        <BatSvg phase={phase} size={batSize} reach={reach} roll={16} style={{ position: 'absolute', left: bx - batSize * 0.57, top: by - batSize * 0.355, opacity: o }} />
      )}
      <CardGrain f={f} left={box.left} top={box.top} w={w} h={h} opacity={o} />
    </>
  );
}

function EndNotice({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const { height: h } = useVideoConfig();
  // in over 8 frames, then held to the film's last frame (a fade-out of the last two frames left
  // the final frame half-faded: a one-frame pop, the score's silent tail ends the film instead)
  const o = progress(f, span('end')[0], span('end')[0] + 8);
  if (o <= 0) return null;
  const t = f - at(36);
  // a soft dusk scrim under the words (the caption plate's plum), so they hold at least 4.5:1
  // over whatever of the book lies behind them: its lit page edges, the cover's gilt, the ribbon
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: h * 0.07, opacity: o, color: '#DCE6B7', textAlign: 'center', textShadow: `0 0 ${h * 0.012}px rgba(20, 10, 24, 0.9)` }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.46, background: 'linear-gradient(to bottom, rgba(30, 16, 34, 0) 0%, rgba(30, 16, 34, 0.62) 38%, rgba(30, 16, 34, 0.8) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: h * 0.03, marginBottom: h * 0.03 }}>
        <div style={{ fontFamily: fonts.serif, fontSize: h * 0.08, letterSpacing: '0.02em' }}>The End</div>
        {t >= 0 && (
          <div style={{ width: h * 0.1, height: h * 0.1, background: '#C8322A', color: '#fff7f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.cjk, fontSize: h * 0.07, fontWeight: 900, borderRadius: h * 0.008, transform: `rotate(-6deg) scale(${1.5 - 0.5 * progress(t, 0, 4, 'outCubic')})` }}>
            完
          </div>
        )}
      </div>
      <div style={{ position: 'relative', fontFamily: fonts.sans, fontSize: h * 0.048 }}>Fan parody. Not affiliated with Anthropic. Fictional email.</div>
      <div style={{ position: 'relative', fontFamily: fonts.cjk, fontSize: h * 0.042 }}>
        粉丝恶搞，与 <span style={{ fontFamily: fonts.sans }}>Anthropic</span> 无关，邮件纯属虚构。
      </div>
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
