/**
 * The messages of the map, each a 64 x 28 capsule centred on 0,0 (place it with a transform or a
 * kit Token): a message pill (fill and sketch-tone outline, with seeded dashes for its words), the
 * request (vermilion, the beetle in the ground colour), a follow-up (hollow vermilion), a reply
 * (hollow ink) and a signed reply (filled sign-off green with a tick). Strokes are non-scaling.
 */
import { useCamera } from '../kit/camera.tsx';
import { Pill } from '../kit/diagram.tsx';
import { C, STROKE } from '../look/tokens.ts';
import { Beetle, Tick } from './glyphs.tsx';
import { SEED, detailOpacity } from './style.ts';
import { PILL } from './world.ts';

/** The outline of every pill that has one, screen px. */
export const PILL_STROKE = 2;
/** The hollow pills' outline: a reply and a follow-up read at 0.5x. */
export const HOLLOW_STROKE = 2.5;

/** A message: pill-tone fill, sketch-tone outline and 2-3 seeded dashes. */
export function MessagePill({ id, opacity }: { id: string | number; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <Pill w={PILL.w} h={PILL.h} fill={C.pill} stroke={C.sketch} strokeWidth={PILL_STROKE} dashes={{ seed: SEED, id, color: C.sketch, width: 2.5 }} />
    </g>
  );
}

/**
 * The request: the one vermilion thing, with a ground-colour beetle. The pill and the beetle's body
 * show at every zoom; its legs and antennae fade out with the small glyphs when the camera is far
 * out (style.ts detailOpacity). Draw it under a CameraProvider.
 */
export function RequestPill() {
  const { cam } = useCamera();
  return (
    <g>
      <Pill w={PILL.w} h={PILL.h} fill={C.vermilion} />
      <Beetle color={C.ground} detail={detailOpacity(cam.scale)} />
    </g>
  );
}

/** A follow-up in the request's thread: hollow vermilion. */
export function FollowUpPill() {
  return <Pill w={PILL.w} h={PILL.h} fill={C.ground} stroke={C.vermilion} strokeWidth={HOLLOW_STROKE} />;
}

/** A reply on its way to you: hollow ink (it rides a cased line). */
export function ReplyPill() {
  return <Pill w={PILL.w} h={PILL.h} fill={C.ground} stroke={C.ink} strokeWidth={HOLLOW_STROKE} />;
}

/** A reply you signed off: filled sign-off green with a ground-colour tick. */
export function SignedReply() {
  return (
    <g>
      <Pill w={PILL.w} h={PILL.h} fill={C.green} />
      <Tick color={C.ground} width={STROKE.hairline + 1} />
    </g>
  );
}

/** A status dot climbing a branch to the Router: an ink dot. */
export function StatusDot({ r = 8 }: { r?: number }) {
  return <circle r={r} fill={C.ink} />;
}

