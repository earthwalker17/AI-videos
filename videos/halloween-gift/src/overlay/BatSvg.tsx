/**
 * The overlay's bat (the one that snatches the email's Appeal tab, bar 27): an SVG drawn from the
 * same outline spec and flap cycle as the 3D bats (kit/bat.ts batOutline), seen from the front
 * and a little below, so the scallops between the finger tips and the stroke both read. Dark, the
 * membranes a shade lighter than the bones and the body (thin against the light), a subtle cool
 * rim on the upper edges, tiny glints in the eyes. A pure function of the phase: the caller
 * passes it from the frame (on ones), positions it with `style` (its box's centre is the body).
 */
import type { CSSProperties } from 'react';
import { batOutline, flapPose } from '../kit/bat.ts';

export interface BatSvgProps {
  /** flap phase (period 1; 0 the top of the stroke) */
  phase: number;
  /** wingspan in px (the box is size × size·0.62) */
  size: number;
  /** 0 straight below .. π/2 head-on (default a three-quarter view from below) */
  view?: number;
  /** mirror (flying the other way) */
  flip?: boolean;
  style?: CSSProperties;
}

const BODY = '#120b10';
const MEMBRANE = '#2a1a24';
const BONE = '#0e080c';
const RIM = '#7fb3c2';
const GLINT = '#e8f7ff';

const d = (pts: readonly (readonly [number, number])[], close = true) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(4)} ${p[1].toFixed(4)}`).join('') + (close ? 'Z' : '');

/** The bat's paths at a phase (viewBox units: wingspan 1, the body's centre at 0, 0). */
export function batSvgPaths(phase: number, view = 0.55): { wings: string[]; bones: string[]; body: string[]; leading: string[]; eyes: [number, number][] } {
  const o = batOutline(flapPose(phase), view);
  return { wings: o.wings.map((w) => d(w)), bones: o.bones.map((b) => d(b, false)), body: o.body.map((b) => d(b)), leading: o.leading.map((l) => d(l, false)), eyes: o.eyes };
}

export function BatSvg({ phase, size, view = 0.55, flip = false, style }: BatSvgProps) {
  const p = batSvgPaths(phase, view);
  const W = 1.14;
  const H = W * 0.62;
  // the rim: the silhouette again in a cool tone, nudged up and to the moon's side, under the dark fill
  const rimOff = 0.007;
  const sw = 1 / size;
  return (
    <svg width={size * W} height={size * H} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} style={{ overflow: 'visible', ...style }}>
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        <g transform={`translate(${rimOff} ${-rimOff})`} fill={RIM} opacity={0.55}>
          {[...p.wings, ...p.body].map((s, i) => (
            <path key={i} d={s} />
          ))}
        </g>
        {p.wings.map((s, i) => (
          <path key={`w${i}`} d={s} fill={MEMBRANE} stroke={MEMBRANE} strokeWidth={sw * 0.6} strokeLinejoin="round" />
        ))}
        {p.bones.map((s, i) => (
          <path key={`b${i}`} d={s} fill="none" stroke={BONE} strokeWidth={i % 6 === 0 ? sw * 3.2 : sw * 2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {p.leading.map((s, i) => (
          <path key={`l${i}`} d={s} fill="none" stroke={BODY} strokeWidth={sw * 2.6} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {p.body.map((s, i) => (
          <path key={`o${i}`} d={s} fill={BODY} stroke={BODY} strokeWidth={sw * 0.8} strokeLinejoin="round" />
        ))}
        {p.eyes.map(([x, y], i) => (
          <circle key={`e${i}`} cx={x} cy={y} r={0.0055} fill={GLINT} />
        ))}
      </g>
    </svg>
  );
}
