/**
 * Text in Inter. Sizes are in composition pixels at 1080p (`size` 96 is 96 px tall on a 1080
 * frame, 48 on a 540-high composition); the frame is held until the font is loaded (useInter),
 * so no frame shows a fallback face. Position and animate it from useCurrentFrame() like any
 * other element.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { useInter } from './fonts.ts';

export interface TitleProps {
  children: ReactNode;
  /** font size in px at 1080p */
  size?: number;
  weight?: number;
  color?: string;
  /** letter spacing in em */
  tracking?: number;
  style?: CSSProperties;
}

export function Title({ children, size = 96, weight = 700, color = '#f6f1e7', tracking = -0.02, style }: TitleProps) {
  const font = useInter();
  const { height } = useVideoConfig();
  const u = height / 1080;
  return <div style={{ fontFamily: font, fontSize: size * u, fontWeight: weight, color, letterSpacing: `${tracking}em`, lineHeight: 1.08, whiteSpace: 'pre', ...style }}>{children}</div>;
}
