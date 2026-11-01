/**
 * Inter, from the pinned @fontsource-variable/inter package (SIL OFL 1.1), registered with
 * FontFace under a family name no system font has: if it failed to load, a fallback could not
 * pass for it. useInter() holds the frame (delayRender) until the face is loaded and in
 * document.fonts, so no frame is ever captured with a fallback face.
 */
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
import { useLayoutEffect, useState } from 'react';
import { useDelayRender } from 'remotion';

export const INTER_FAMILY = 'AIV Inter';

/** CSS font-family value for Inter. */
export const INTER = `"${INTER_FAMILY}", sans-serif`;

let loading: Promise<void> | null = null;
let ready = false;

/** Load and register Inter once per page (every caller shares the promise). */
export function loadInter(): Promise<void> {
  loading ??= new FontFace(INTER_FAMILY, `url(${interUrl})`, { weight: '100 900', style: 'normal' })
    .load()
    .then((face) => {
      document.fonts.add(face);
      if (!document.fonts.check(`400 32px "${INTER_FAMILY}"`)) throw new Error(`${INTER_FAMILY} loaded but is not usable`);
      ready = true;
    });
  return loading;
}

/** Hold the current frame until Inter is ready; returns the font-family value. */
export function useInter(): string {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => (ready ? null : delayRender(`Loading ${INTER_FAMILY}`)));
  useLayoutEffect(() => {
    if (handle === null) return;
    loadInter().then(
      () => continueRender(handle),
      (e: unknown) => cancelRender(e instanceof Error ? e : new Error(String(e))),
    );
  }, [handle, continueRender, cancelRender]);
  return INTER;
}
