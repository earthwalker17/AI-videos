/**
 * The overlay's bat (the one that snatches the email's Appeal tab, bar 27): an SVG drawn from the
 * same outline spec and flap cycle as the 3D bats (kit/bat.ts batOutline), seen from the front
 * and a little below, so the scallops between the finger tips and the stroke both read. Not a
 * flat sticker: its far wing lags the near one in the flap, it banks into the grab (a roll, its
 * near wing low), the membranes shade from the dark body out to thinner, lighter tips, a cool rim
 * catches its upper edges, its legs hang with hooked claws to grip what it takes, and it casts a
 * soft shadow on the card under it. Dark, tiny glints in the eyes. A pure function of the phase:
 * the caller passes it from the frame (on ones), positions it with `style` (its box's centre is
 * the body).
 */
import type { CSSProperties } from 'react';
import { batOutline, BAT_SPEC, flapPose } from '../kit/bat.ts';

export interface BatSvgProps {
  /** flap phase (period 1; 0 the top of the stroke) */
  phase: number;
  /** wingspan in px (the box is size × size·0.62) */
  size: number;
  /** 0 straight below .. π/2 head-on (default a three-quarter view from below) */
  view?: number;
  /** mirror (flying the other way) */
  flip?: boolean;
  /** the bank, degrees clockwise on screen (default 13: the left wing low, clear of the words above the tab) */
  roll?: number;
  /** how far the right wing lags the left in the flap, a fraction of the cycle */
  lag?: number;
  /** a soft shadow on what lies under it (default on) */
  shadow?: boolean;
  /** how far below the body's centre its claws close, in wingspans (default 0.18: OverlayV2 holds the bat's body 0.06 of the card's height, 0.18 of its wingspan, over the Appeal tab's top) */
  reach?: number;
  style?: CSSProperties;
}

const BODY = '#120b10';
const MEMBRANE_IN = '#1c1118';
const MEMBRANE_OUT = '#3f2834';
const BONE = '#0e080c';
const RIM = '#8fbccb';
const GLINT = '#e8f7ff';

const d = (pts: readonly (readonly [number, number])[], close = true) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(4)} ${p[1].toFixed(4)}`).join('') + (close ? 'Z' : '');

/** The bat's paths at a phase (viewBox units: wingspan 1, the body's centre at 0, 0); the right wing `lag` of a cycle behind. */
export function batSvgPaths(phase: number, view = 0.55, lag = 0, reach = 0.18): { wings: string[]; bones: string[]; body: string[]; leading: string[]; eyes: [number, number][]; rightDy: number; legs: string[] } {
  const pl = flapPose(phase);
  const pr = flapPose(phase + lag);
  const ol = batOutline(pl, view);
  const or = lag === 0 ? ol : batOutline(pr, view);
  // per side: wings [right, left], bones [right × n, left × n], leading [right, left]
  const nb = ol.bones.length / 2;
  const wings = [d(or.wings[0]), d(ol.wings[1])];
  const bones = [...or.bones.slice(0, nb).map((b) => d(b, false)), ...ol.bones.slice(nb).map((b) => d(b, false))];
  const leading = [d(or.leading[0], false), d(ol.leading[1], false)];
  // the right wing hangs from the body as the left pose bobs it
  const rightDy = (pr.bob - pl.bob) * Math.sin(view);
  // the legs from the membrane's foot points, hanging, each ending in a hooked claw
  const fy = -BAT_SPEC.foot[1] * Math.cos(view) - pl.bob * Math.sin(view);
  const legs: string[] = [];
  for (const s of [1, -1]) {
    const x0 = s * BAT_SPEC.foot[0] * 0.85;
    const x1 = s * 0.036;
    const y1 = Math.max(fy + 0.02, reach - 0.012);
    legs.push(`M${x0.toFixed(4)} ${(fy - 0.006).toFixed(4)}Q${(x0 + s * 0.006).toFixed(4)} ${(fy + 0.04).toFixed(4)} ${x1.toFixed(4)} ${y1.toFixed(4)}`);
    // three toes hooked forward over the edge it grips
    for (const k of [-1, 0, 1]) legs.push(`M${x1.toFixed(4)} ${y1.toFixed(4)}q${(k * 0.006).toFixed(4)} 0.008 ${(k * 0.004 + 0.002 * s).toFixed(4)} 0.014q-0.001 0.004 -0.005 0.003`);
  }
  return { wings, bones, body: ol.body.map((b) => d(b)), leading, eyes: ol.eyes, rightDy, legs };
}

export function BatSvg({ phase, size, view = 0.55, flip = false, roll = 13, lag = 0.07, shadow = true, reach = 0.18, style }: BatSvgProps) {
  const p = batSvgPaths(phase, view, lag, reach);
  const W = 1.14;
  const H = W * 0.62;
  // the rim: the silhouette again in a cool tone, nudged up and to the moon's side, under the dark fill
  const rimOff = 0.005;
  const sw = 1 / size;
  const right = (k: number) => (k === 0 ? `translate(0 ${p.rightDy.toFixed(4)})` : undefined);
  const nb = p.bones.length / 2;
  return (
    <svg width={size * W} height={size * H} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} style={{ overflow: 'visible', ...style }}>
      <defs>
        <radialGradient id="aiv-bat-membrane" gradientUnits="userSpaceOnUse" cx={0} cy={0.01} r={0.52}>
          <stop offset={0.12} stopColor={MEMBRANE_IN} />
          <stop offset={1} stopColor={MEMBRANE_OUT} />
        </radialGradient>
        <filter id="aiv-bat-shadow" filterUnits="userSpaceOnUse" x={-0.8} y={-0.6} width={1.6} height={1.3}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={0.012} />
          <feOffset dx={0.022} dy={0.04} result="b" />
          <feComponentTransfer>
            <feFuncA type="linear" slope={0.3} />
          </feComponentTransfer>
        </filter>
      </defs>
      <g transform={`${flip ? 'scale(-1 1) ' : ''}rotate(${roll})`}>
        {shadow && (
          <g filter="url(#aiv-bat-shadow)">
            {p.wings.map((s, i) => (
              <path key={`sw${i}`} d={s} transform={right(i)} fill="#000" />
            ))}
            {p.body.map((s, i) => (
              <path key={`sb${i}`} d={s} fill="#000" />
            ))}
          </g>
        )}
        <g transform={`translate(${rimOff} ${-rimOff})`} fill={RIM} opacity={0.42}>
          {p.wings.map((s, i) => (
            <path key={i} d={s} transform={right(i)} />
          ))}
          {p.body.map((s, i) => (
            <path key={`r${i}`} d={s} />
          ))}
        </g>
        {p.legs.map((s, i) => (
          <path key={`g${i}`} d={s} fill="none" stroke={BODY} strokeWidth={sw * (i % 4 === 0 ? 2.6 : 1.6)} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {p.wings.map((s, i) => (
          <path key={`w${i}`} d={s} transform={right(i)} fill="url(#aiv-bat-membrane)" stroke={MEMBRANE_IN} strokeWidth={sw * 0.6} strokeLinejoin="round" />
        ))}
        {p.bones.map((s, i) => (
          <path key={`b${i}`} d={s} transform={i < nb ? right(0) : undefined} fill="none" stroke={BONE} strokeWidth={i % nb === 0 ? sw * 3.2 : sw * 2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {p.leading.map((s, i) => (
          <path key={`l${i}`} d={s} transform={right(i)} fill="none" stroke={BODY} strokeWidth={sw * 2.6} strokeLinecap="round" strokeLinejoin="round" />
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
