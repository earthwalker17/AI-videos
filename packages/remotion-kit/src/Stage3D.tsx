/**
 * Stage3D: @remotion/three's ThreeCanvas set up for deterministic, colour-correct renders.
 *
 *  - Sized to the composition (CSS px), drawing buffer at the render scale: one canvas pixel per
 *    output pixel (draft 960x540, final 1920x1080), never the monitor's devicePixelRatio.
 *  - Linear workflow: three's colour management on, sRGB output; tone mapping by the renderer
 *    (ACES Filmic by default) unless a <PostChain> renders, which tone-maps in its last effect.
 *  - Shadow maps (PCF) on request; an opaque canvas (the mezzanine has no alpha).
 *  - Frame-driven: while rendering, ThreeCanvas runs R3F with frameloop 'never' and advances it
 *    once per Remotion frame, after React committed that frame. So pose everything from
 *    useCurrentFrame() in JSX props or in useLayoutEffect (both land before the advance), never
 *    in useEffect (runs after the frame was drawn: off by one) and never with useFrame or a
 *    clock-driven helper (wall-clock time: ESLint bans them in frame code).
 */
import { ThreeCanvas } from '@remotion/three';
import type { CSSProperties, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { ACESFilmicToneMapping, type ToneMapping } from 'three';
import { useRenderScale } from './scale.ts';

export interface Stage3DProps {
  children: ReactNode;
  /** R3F's default camera (a PerspectiveCamera): fov, near, far, initial position */
  camera?: { fov?: number; near?: number; far?: number; position?: [number, number, number] };
  /** PCF shadow maps (default true) */
  shadows?: boolean;
  /** the renderer's tone mapping when no PostChain renders (default ACES Filmic) */
  toneMapping?: ToneMapping;
  exposure?: number;
  /** MSAA on the canvas itself; turn it off under a PostChain, which multisamples its own buffers */
  antialias?: boolean;
  style?: CSSProperties;
}

export function Stage3D({ children, camera, shadows = true, toneMapping = ACESFilmicToneMapping, exposure = 1, antialias = true, style }: Stage3DProps) {
  const { width, height } = useVideoConfig();
  const dpr = useRenderScale();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      shadows={shadows ? 'percentage' : false}
      camera={camera}
      gl={{ antialias, alpha: false, powerPreference: 'high-performance', toneMapping, toneMappingExposure: exposure }}
      style={{ position: 'absolute', left: 0, top: 0, ...style }}
    >
      {children}
    </ThreeCanvas>
  );
}
