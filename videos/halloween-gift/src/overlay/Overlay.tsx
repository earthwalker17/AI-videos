/**
 * The words of the film as DOM over the 3D frame: storybook captions (EN above zh-Hans), the
 * email's face once the letter's slats have flipped (crossfaded in over 4 frames so the type,
 * the paper white and the seal red are exact), and the end card. Storybook words are IM Fell
 * English and Noto Serif SC; the email and the notice are the plain Inter.
 */
import { progress } from '@aiv/core';
import type { FilmFonts } from '../look/fonts.ts';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { at, cues, WORDS } from '../cues.ts';
import { FLOOR, twos } from '../film/timeline.ts';
import { LETTER_AT } from '../world/DoorSet.tsx';
import { FACE_B, LETTER_H, LETTER_W } from '../world/Letter.tsx';
import { screenBox } from './project.ts';

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

/** The letter's face B: where the 3D letter stands (projected), in crisp type. */
function Email({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const font = fonts.sans;
  const { width: W, height: H } = useVideoConfig();
  // in once the last slat has flipped (at(25, 2) + 18); out, onto the sealed 3D face, just before
  // the letter sinks back into the page (at(29)): the camera holds still through both hand-overs
  const flipped = at(25, 2) + 18;
  const o = Math.min(progress(f, flipped, flipped + 4), 1 - progress(f, at(29) - 6, at(29) - 2));
  const L = FACE_B;
  if (o <= 0) return null;
  const x0 = LETTER_AT[0] - LETTER_W / 2;
  const y0 = FLOOR + LETTER_AT[1];
  const z = LETTER_AT[2];
  const box = screenBox(f, [[x0, y0, z], [x0 + LETTER_W, y0, z], [x0, y0 + LETTER_H, z], [x0 + LETTER_W, y0 + LETTER_H, z]], W, H);
  const h = box.height;
  const w = box.width;
  // the 封号 seal thunks down on bar 26: drops from 1.5x in 4 frames (on twos), then a 2-frame shake
  const sealT = twos(f) - at(26);
  const sealIn = sealT >= 0;
  const sealScale = sealT < 4 ? 1.5 - 0.5 * (sealT / 4) : 1;
  const shake = sealT >= 4 && sealT < 8 ? (sealT % 4 < 2 ? 1 : -1) * h * 0.006 : 0;
  // a paper bat snatches the Appeal tab on bar 27 beat 3 and carries it off to the upper right
  const grab = at(27, 3);
  const away = progress(twos(f), grab, grab + 30, 'inCubic');
  // down and out to the lower left: the bat never crosses the words being read
  const tabX = w * 0.05 - away * (box.left + w * 0.4);
  const tabY = h * L.tabTop + away * (H - box.top);
  return (
    <div style={{ position: 'absolute', left: box.left, top: box.top + shake, width: w, height: h, opacity: o, background: '#EAF3F4', fontFamily: font, color: '#1a2228', boxShadow: `0 ${h * 0.02}px ${h * 0.06}px rgba(0,0,0,0.35)` }}>
      {/* an envelope glyph and greeked header lines: mail, without saying who from */}
      <svg style={{ position: 'absolute', left: w * 0.05, top: h * 0.06 }} width={w * 0.06} height={h * 0.07} viewBox="0 0 60 40">
        <rect x="2" y="2" width="56" height="36" fill="none" stroke="#5b6b72" strokeWidth="4" />
        <polyline points="2,2 30,24 58,2" fill="none" stroke="#5b6b72" strokeWidth="4" />
      </svg>
      <div style={{ position: 'absolute', left: w * 0.14, top: h * 0.07, width: w * 0.3, height: h * 0.018, background: '#c3cfd3' }} />
      <div style={{ position: 'absolute', left: w * 0.14, top: h * 0.11, width: w * 0.2, height: h * 0.018, background: '#c3cfd3' }} />
      <div style={{ position: 'absolute', left: w * 0.05, top: h * L.headTop, fontSize: h * L.head, fontWeight: 800, lineHeight: 1.07, letterSpacing: '-0.01em' }}>
        ACCOUNT
        <br />
        SUSPENDED
      </div>
      <div style={{ position: 'absolute', left: w * 0.05, top: h * L.bodyTop, fontSize: h * L.body, lineHeight: 1.4 }}>
        Suspicious signals detected.
        <br />
        Happy Halloween!
      </div>
      {/* the Appeal tab, cobwebbed; a bat makes off with it */}
      <div style={{ position: 'absolute', left: tabX, top: tabY, padding: `${h * 0.012}px ${h * 0.03}px`, border: `${Math.max(1, h * 0.004)}px solid #5b6b72`, borderRadius: h * 0.012, fontSize: h * L.tab, color: '#3d4a50', background: '#EAF3F4' }}>
        Appeal · <span style={{ fontFamily: fonts.cjk }}>申诉</span>
      </div>
      {f >= grab - 12 && f < grab + 30 && <Bat x={tabX - h * 0.02 - (1 - progress(f, grab - 12, grab, 'outCubic')) * h * 0.9} y={tabY + h * 0.035 + (1 - progress(f, grab - 12, grab, 'outCubic')) * h * 0.35} size={h * 0.42} f={f} />}
      {sealIn && (
        <div style={{ position: 'absolute', right: w * L.sealRight, bottom: h * L.sealBottom, width: h * L.seal, height: h * L.seal, background: '#C8322A', color: '#fff7f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `rotate(-7deg) scale(${sealScale})`, fontFamily: fonts.cjk, fontSize: h * L.seal * 0.4, fontWeight: 900, lineHeight: 1.05, boxShadow: `0 ${h * 0.01}px ${h * 0.02}px rgba(60,0,0,0.35)`, borderRadius: h * 0.012 }}>
          <span>封</span>
          <span>号</span>
        </div>
      )}
    </div>
  );
}

/** A paper bat: two wing poses, flapping on twos. */
function Bat({ x, y, size, f }: { x: number; y: number; size: number; f: number }) {
  const up = Math.floor(f / 4) % 2 === 0;
  return (
    <svg style={{ position: 'absolute', left: x, top: y }} width={size} height={size * 0.6} viewBox="0 0 100 60">
      <path fill="#141016" d={up ? 'M50 34 L36 6 L28 22 L14 4 L10 26 L0 20 L22 40 L40 36 L50 46 L60 36 L78 40 L100 20 L90 26 L86 4 L72 22 L64 6 Z' : 'M50 30 L34 40 L24 56 L18 40 L4 52 L8 34 L0 32 L22 26 L40 26 L50 22 L60 26 L78 26 L100 32 L92 34 L96 52 L82 40 L76 56 L66 40 Z'} />
      <circle cx="45" cy="30" r="2.5" fill="#57CEE2" />
      <circle cx="55" cy="30" r="2.5" fill="#57CEE2" />
    </svg>
  );
}

function EndNotice({ f, fonts }: { f: number; fonts: FilmFonts }) {
  const font = fonts.sans;
  const { height: h } = useVideoConfig();
  const o = fade(f, span('end'), 8, 2);
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: h * 0.07, opacity: o, color: '#DCE6B7', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: h * 0.03, marginBottom: h * 0.03 }}>
        <div style={{ fontFamily: fonts.serif, fontSize: h * 0.08, letterSpacing: '0.02em' }}>The End</div>
        {twos(f) >= at(36) && (
          <div style={{ width: h * 0.1, height: h * 0.1, background: '#C8322A', color: '#fff7f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.cjk, fontSize: h * 0.07, fontWeight: 900, borderRadius: h * 0.008, transform: `rotate(-6deg) scale(${twos(f) - at(36) < 4 ? 1.5 - (twos(f) - at(36)) / 8 : 1})` }}>
            完
          </div>
        )}
      </div>
      <div style={{ fontFamily: font, fontSize: h * 0.048 }}>Fan parody. Not affiliated with Anthropic. Fictional email.</div>
      <div style={{ fontFamily: fonts.cjk, fontSize: h * 0.042 }}>粉丝恶搞，与 Anthropic 无关，邮件纯属虚构。</div>
    </AbsoluteFill>
  );
}

export function Overlay({ f, fonts }: { f: number; fonts: FilmFonts }) {
  return (
    <AbsoluteFill>
      <Caption f={f} id="caption-1" words={WORDS.caption1} fonts={fonts} />
      <Caption f={f} id="caption-2" words={WORDS.caption2} fonts={fonts} />
      <Email f={f} fonts={fonts} />
      <EndNotice f={f} fonts={fonts} />
    </AbsoluteFill>
  );
}
