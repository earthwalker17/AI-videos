/**
 * Lookdev of the email card (face B of the gift) at the size the snap-in will show it, over a
 * dark stand-in for the door spread, with the seal landed and the Appeal tab in place.
 */
import { AbsoluteFill, Composition } from 'remotion';
import { FPS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { EMAIL, EmailCard } from '../overlay/EmailCard.tsx';

function EmailLook() {
  const { fonts } = useFilmFonts();
  const h = 700;
  const w = h * EMAIL.aspect;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #1d3a4a 0%, #0b141c 70%)' }}>
      <div style={{ position: 'absolute', left: (1920 - w) / 2, top: (1080 - h) / 2 + 30 }}>
        <EmailCard width={w} height={h} fonts={fonts} seal={{ scale: 1, shake: 0 }} />
      </div>
    </AbsoluteFill>
  );
}

export function EmailRoot() {
  return <Composition id="Email" component={EmailLook} width={1920} height={1080} fps={FPS} durationInFrames={1} />;
}
