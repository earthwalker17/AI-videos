/**
 * Small glyphs of the map, each centred on 0,0 in world units (place it with a transform): the
 * request's beetle, your laptop, the Workers' generic tools, the sign-off tick, the CI square and
 * the envelope among the message pills, and the sketch "?". Outlines are non-scaling ink strokes
 * (2 px and up on screen at every zoom); the beetle is a filled silhouette that scales with its pill.
 */
import { rand } from '@aiv/core';
import { NON_SCALING } from '../kit/camera.tsx';
import { sketchPasses, type Pt } from '../kit/sketch.ts';
import { CI, ENVELOPE } from './world.ts';
import { PEN, SEED } from './style.ts';

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', ...NON_SCALING } as const;

/**
 * The request's beetle (a bug report), facing its direction of travel (east), in `color`. Its legs
 * and antennae are fine scaling strokes (2.2 and 1.8 units, under 2 px below 0.9x): `detail` is
 * their opacity, so they fade out with the other small glyphs when the camera is far out
 * (style.ts detailOpacity), and the body alone stays.
 */
export function Beetle({ color, scale = 1, detail = 1 }: { color: string; scale?: number; detail?: number }) {
  // legs: three a side, from the body's edge, swept back like a running beetle's
  const legs: [Pt, Pt][] = [-4.5, 0, 4.5].flatMap((x, i) => {
    const sweep = (i - 1) * 1.6;
    return [
      [[x, -5], [x - 2 + sweep, -10]],
      [[x, 5], [x - 2 + sweep, 10]],
    ] as [Pt, Pt][];
  });
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`} fill={color} stroke={color}>
      {detail > 0 && (
        <g opacity={detail < 1 ? detail : undefined}>
          {legs.map(([a, b], i) => (
            <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={2.2} strokeLinecap="round" />
          ))}
          {/* antennae */}
          <path d="M 10 -1.6 Q 12.5 -3 13.4 -6 M 10 1.6 Q 12.5 3 13.4 6" fill="none" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      <ellipse cx={-1} cy={0} rx={8.6} ry={6.6} stroke="none" />
      <circle cx={8.6} cy={0} r={3.4} stroke="none" />
    </g>
  );
}

/** Your laptop: open (a screen over its base) or shut (the lid down on the base). */
export function Laptop({ open, color, width = 2 }: { open: boolean; color: string; width?: number }) {
  return (
    <g stroke={color} strokeWidth={width} {...LINE}>
      {open ? (
        <>
          <rect x={-13} y={-19} width={26} height={16} rx={2.5} {...NON_SCALING} />
          <line x1={-17} y1={0} x2={17} y2={0} {...NON_SCALING} />
        </>
      ) : (
        <>
          <rect x={-15} y={-7} width={30} height={5} rx={2} fill={color} stroke="none" />
          <line x1={-17} y1={0} x2={17} y2={0} {...NON_SCALING} />
        </>
      )}
    </g>
  );
}

/** The generic tools of a Worker (no product UIs): a prompt chevron, a magnifier, a wrench. */
export type ToolKind = 'prompt' | 'search' | 'fix';
export const TOOLS: readonly ToolKind[] = ['prompt', 'search', 'fix'];

export function Tool({ kind, color, width = 2 }: { kind: ToolKind; color: string; width?: number }) {
  const p = { stroke: color, strokeWidth: width, ...LINE };
  if (kind === 'prompt') return <path d="M -7 -6 L -1 0 L -7 6 M 1 6.5 L 8 6.5" {...p} />;
  if (kind === 'search')
    return (
      <g {...p}>
        <circle cx={-1.5} cy={-1.5} r={5.5} {...NON_SCALING} />
        <line x1={2.6} y1={2.6} x2={7.5} y2={7.5} {...NON_SCALING} />
      </g>
    );
  // an open-ended wrench: the head a ring open to the north-east, the handle to the south-west
  const c: Pt = [2.5, -2.5];
  const r = 5;
  const a0 = (-5 * Math.PI) / 180;
  const a1 = (275 * Math.PI) / 180;
  const s: Pt = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)];
  const e: Pt = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
  const f = (v: number) => Math.round(v * 1000) / 1000;
  return <path d={`M ${f(s[0])} ${f(s[1])} A ${r} ${r} 0 1 1 ${f(e[0])} ${f(e[1])} M -1.1 1.1 L -7.5 7.5`} {...p} />;
}

/** The sign-off tick, in `color` (the ground colour, on the green pill). */
export function Tick({ color, width = 3 }: { color: string; width?: number }) {
  return <path d="M -9 0 L -3 6 L 9 -6" stroke={color} strokeWidth={width} {...LINE} />;
}

/** A CI event among the message pills: a square with a status lamp. */
export function CiSquare({ fill, stroke, width = 2 }: { fill: string; stroke: string; width?: number }) {
  const h = CI.size / 2;
  return (
    <g>
      <rect x={-h} y={-h} width={CI.size} height={CI.size} rx={CI.r} fill={fill} stroke={stroke} strokeWidth={width} {...NON_SCALING} />
      <circle cx={0} cy={0} r={4.5} fill="none" stroke={stroke} strokeWidth={width} {...NON_SCALING} />
    </g>
  );
}

/** A mail event among the message pills: an envelope outline. */
export function Envelope({ fill, stroke, width = 2 }: { fill: string; stroke: string; width?: number }) {
  const w = ENVELOPE.w / 2;
  const h = ENVELOPE.h / 2;
  return (
    <g>
      <rect x={-w} y={-h} width={ENVELOPE.w} height={ENVELOPE.h} rx={ENVELOPE.r} fill={fill} stroke={stroke} strokeWidth={width} {...NON_SCALING} />
      <path d={`M ${-w + 4} ${-h + 4} L 0 2 L ${w - 4} ${-h + 4}`} stroke={stroke} strokeWidth={width} {...LINE} />
    </g>
  );
}

/** The hook of the sketch "?", about 76 x 136 world units, centred on 0,0 (its dot below). */
const QUESTION_HOOK: readonly Pt[] = [
  [-30, -30],
  [-26, -50],
  [-8, -64],
  [14, -62],
  [30, -46],
  [30, -24],
  [16, -8],
  [4, 6],
  [2, 24],
];

/**
 * The open "?", in `color` (the sketch tone): drawn as the trail is, by hand. The hook is two
 * passes of the pen (the second thinner, a few units off the first and lifting sooner, as a hand
 * going back over a line does), each with its scribble, and the dot is a short dab. It stays for
 * the rest of the film.
 */
export function QuestionMark({ color, scale = 1 }: { color: string; scale?: number }) {
  const again: Pt[] = QUESTION_HOOK.map(([x, y], i) => [x + (rand(SEED, 'question-again', 2 * i) - 0.5) * 8, y + (rand(SEED, 'question-again', 2 * i + 1) - 0.5) * 8]);
  const passes = [
    ...sketchPasses(QUESTION_HOOK, { ...PEN.question, seed: SEED, id: 'question' }),
    ...sketchPasses(again, { ...PEN.question, width: PEN.question.width * 0.6, from: 0.05, to: 0.9, seed: SEED, id: 'question-again' }),
  ];
  const [dot] = sketchPasses(
    [
      [-2, 51],
      [2, 54],
      [5, 59],
    ],
    { ...PEN.question, width: 13, taper: 0.45, scribble: 0, seed: SEED, id: 'question-dot' },
  );
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`} fill={color}>
      {passes.filter(Boolean).map((d, i) => (
        <path key={i} d={d} />
      ))}
      <path d={dot} />
    </g>
  );
}
