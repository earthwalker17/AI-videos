/**
 * Lookdev of the email card (face B of the gift) at the size the door spread's hold shows it
 * (about 765 px tall), over a dark stand-in for the door spread, with the seal landed and the
 * Appeal tab in place: Email the DOM card, EmailCanvas the same face drawn on a canvas (face B of
 * the 3D letter) where the DOM card stands, to diff the two.
 */
import { textContext } from '@aiv/remotion-kit';
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition } from 'remotion';
import { FPS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { drawEmailCard, EMAIL, EmailCard } from '../overlay/EmailCard.tsx';

const H = 766;
const W = Math.round(H * EMAIL.aspect);
const BG = 'radial-gradient(ellipse at 50% 40%, #1d3a4a 0%, #0b141c 70%)';
const AT = { left: Math.round((1920 - W) / 2), top: Math.round((1080 - H) / 2) };

function EmailLook() {
  const { fonts } = useFilmFonts();
  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: 'absolute', ...AT }}>
        <EmailCard width={W} height={H} fonts={fonts} seal={{ scale: 1, shake: 0 }} />
      </div>
    </AbsoluteFill>
  );
}

/**
 * The same card drawn on a canvas (face B of the 3D letter), where the DOM card stands: diff the
 * two. Drawn once, in the commit in which the fonts are ready, on a CPU canvas (as the letter's).
 */
function EmailCanvasLook() {
  const { fonts, ready } = useFilmFonts();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    drawEmailCard(textContext(ref.current), W, H, fonts, { tab: { dx: 0, dy: 0 }, seal: { scale: 1, shake: 0 } });
  }, [fonts, ready]);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', ...AT, width: W, height: H }} />
    </AbsoluteFill>
  );
}

export function EmailRoot() {
  return (
    <>
      <Composition id="Email" component={EmailLook} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="EmailCanvas" component={EmailCanvasLook} width={1920} height={1080} fps={FPS} durationInFrames={1} />
    </>
  );
}
