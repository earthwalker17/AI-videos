/**
 * The render scale: output pixels per CSS pixel. A composition is laid out at its own size
 * (1920x1080 CSS px); the engine renders it at the profile's size with Remotion's `scale`, which
 * becomes the page's device scale factor (0.5 for the draft profile). Anything that must land
 * on exact output pixels (the swatch strip QA measures, the 3D canvas resolution) reads it here.
 * In Studio and the Player it is 1: the preview is laid out at the composition size.
 */
import { useRemotionEnvironment, useVideoConfig } from 'remotion';

export function useRenderScale(): number {
  const { isRendering } = useRemotionEnvironment();
  return isRendering && typeof window !== 'undefined' ? window.devicePixelRatio : 1;
}

/** The output frame size (what QA decodes) and the scale it was rendered at. */
export function useRenderSize(): { width: number; height: number; scale: number } {
  const { width, height } = useVideoConfig();
  const scale = useRenderScale();
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
