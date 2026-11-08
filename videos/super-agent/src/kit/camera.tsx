/**
 * A 2D camera over a world plane larger than the frame (the film's is 3840 x 2160 world units in a
 * 1920 x 1080 frame). It only translates and scales: `{ x, y, scale }` is the world point at the
 * centre of the view and the screen px per world unit. The world is drawn in one SVG under the
 * camera's transform; strokes there use `vector-effect: non-scaling-stroke`, so a 6 px line is
 * 6 px at every zoom. Labels are not scaled: they are set in a screen layer at the projection of
 * a world anchor, so a 40 px label stays 40 px.
 *
 * The maths is pure (tested in camera.test.ts); the layers read the camera from context.
 */
import { lerp, smoothstep } from '@aiv/core';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { GREY_TEXT, Label, type LabelProps } from './text.tsx';

export type Pt = readonly [number, number];

/** The world point at the centre of the view, and screen px per world unit. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface View {
  width: number;
  height: number;
}

export const VIEW_1080: View = { width: 1920, height: 1080 };

export const worldToScreen = (c: Camera, [wx, wy]: Pt, v: View = VIEW_1080): Pt => [(wx - c.x) * c.scale + v.width / 2, (wy - c.y) * c.scale + v.height / 2];

export const screenToWorld = (c: Camera, [sx, sy]: Pt, v: View = VIEW_1080): Pt => [(sx - v.width / 2) / c.scale + c.x, (sy - v.height / 2) / c.scale + c.y];

/** The SVG transform that maps world units to screen px. */
export const cameraTransform = (c: Camera, v: View = VIEW_1080): string => `translate(${v.width / 2} ${v.height / 2}) scale(${c.scale}) translate(${-c.x} ${-c.y})`;

/** The camera at `scale` that keeps the world point `anchor` where `c` shows it on screen. */
export function zoomAbout(c: Camera, anchor: Pt, scale: number, v: View = VIEW_1080): Camera {
  const [sx, sy] = worldToScreen(c, anchor, v);
  return { x: anchor[0] - (sx - v.width / 2) / scale, y: anchor[1] - (sy - v.height / 2) / scale, scale };
}

/** Between two framings: the centre moves linearly, the scale geometrically (an even zoom). */
export const lerpCamera = (a: Camera, b: Camera, t: number): Camera => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: a.scale * (b.scale / a.scale) ** t });

/** The world rectangle the camera shows. */
export function visibleWorld(c: Camera, v: View = VIEW_1080): { x0: number; y0: number; x1: number; y1: number } {
  const [x0, y0] = screenToWorld(c, [0, 0], v);
  const [x1, y1] = screenToWorld(c, [v.width, v.height], v);
  return { x0, y0, x1, y1 };
}

/** Props for a world-space stroke that keeps its screen width at every zoom. */
export const NON_SCALING = { vectorEffect: 'non-scaling-stroke' } as const;

interface CameraState {
  cam: Camera;
  view: View;
}

const CameraContext = createContext<CameraState | null>(null);

/** The camera of the enclosing CameraProvider. */
export function useCamera(): CameraState {
  const s = useContext(CameraContext);
  if (!s) throw new Error('useCamera: no CameraProvider above this component');
  return s;
}

export function CameraProvider({ cam, view = VIEW_1080, children }: { cam: Camera; view?: View; children: ReactNode }) {
  return <CameraContext.Provider value={{ cam, view }}>{children}</CameraContext.Provider>;
}

const layer = (v: View): CSSProperties => ({ position: 'absolute', left: 0, top: 0, width: v.width, height: v.height, overflow: 'hidden' });

/** The world: an SVG the size of the view, its children in world units under the camera. */
export function WorldLayer({ children }: { children: ReactNode }) {
  const { cam, view } = useCamera();
  return (
    <svg width={view.width} height={view.height} viewBox={`0 0 ${view.width} ${view.height}`} style={layer(view)}>
      <g transform={cameraTransform(cam, view)}>{children}</g>
    </svg>
  );
}

/** A screen layer: an SVG the size of the view, its children in screen px (labels, plates), text antialiased in grey. */
export function ScreenLayer({ children }: { children: ReactNode }) {
  const { view } = useCamera();
  return (
    <svg width={view.width} height={view.height} viewBox={`0 0 ${view.width} ${view.height}`} style={{ ...layer(view), ...GREY_TEXT }}>
      {children}
    </svg>
  );
}

export interface AnchoredLabelProps extends Omit<LabelProps, 'x' | 'y'> {
  /** the world point the label belongs to */
  at: Pt;
  /** screen px from the anchor's projection to the label's baseline origin */
  dx?: number;
  dy?: number;
}

/** A label in a ScreenLayer, at the projection of its world anchor: its size never zooms. */
export function AnchoredLabel({ at, dx = 0, dy = 0, ...label }: AnchoredLabelProps) {
  const { cam, view } = useCamera();
  const [x, y] = worldToScreen(cam, at, view);
  return <Label x={x + dx} y={y + dy} {...label} />;
}

/** The lattice points of a dot grid that fall inside a world rectangle (plus a margin). */
export function gridPoints(pitch: number, r: { x0: number; y0: number; x1: number; y1: number }, bounds: { width: number; height: number }, margin = 0): Pt[] {
  const pts: Pt[] = [];
  const i0 = Math.max(0, Math.ceil((r.x0 - margin) / pitch));
  const i1 = Math.min(Math.floor(bounds.width / pitch), Math.floor((r.x1 + margin) / pitch));
  const j0 = Math.max(0, Math.ceil((r.y0 - margin) / pitch));
  const j1 = Math.min(Math.floor(bounds.height / pitch), Math.floor((r.y1 + margin) / pitch));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) pts.push([i * pitch, j * pitch]);
  return pts;
}

export interface DotGridProps {
  /** world units between dots */
  pitch: number;
  /** dot diameter in screen px (constant at every zoom) */
  diameter: number;
  color: string;
  /** the world's size: no dots beyond it */
  bounds: { width: number; height: number };
  /** below this scale the grid fades out (it would crowd into moiré), over `fadeRange` */
  fadeBelow?: number;
  fadeRange?: number;
}

/** The dot grid, inside a WorldLayer: only the dots in view, each the same size on screen. */
export function DotGrid({ pitch, diameter, color, bounds, fadeBelow = 0, fadeRange = 0.1 }: DotGridProps) {
  const { cam, view } = useCamera();
  const opacity = fadeBelow > 0 ? smoothstep(fadeBelow - fadeRange, fadeBelow, cam.scale) : 1;
  if (opacity <= 0) return null;
  const r = diameter / 2 / cam.scale;
  return (
    <g fill={color} opacity={opacity}>
      {gridPoints(pitch, visibleWorld(cam, view), bounds, r).map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}
