/**
 * You (synthesis §2, element sheet): the pose of your desk at a frame, and its chore tray. Pure.
 *
 * Your desk is one object for the whole film: in act one it stands further north and east, its
 * lamp reaching up to the folder it attends, the lid strut propping the laptop open; at the turn it
 * slides south-west (MT2) to the place layout.ts gives it (`YOU`, `LAMP`), where it stays. A pose
 * says where it stands (`shift`, added to every layout point of the desk), how the lamp is bent and
 * aimed (desk coordinates, as `LAMP`), how hard the bulb burns and where the lid strut is.
 *
 * The chore tray is a shadow board: one recess cut to the outline of each chore that can rest in it
 * (the starter key, the sand-glass, the lid strut), at unequal widths with no dividers, so an empty
 * recess still says what is missing from it.
 */
import { LAMP, YOU, rectC, type P2, type P3 } from './layout.ts';

/** The lamp's joints in desk coordinates (as `LAMP`): its base, elbow and head, and the point the hood aims at. */
export interface LampPose {
  base: P3;
  elbow: P3;
  head: P3;
  aim: P3;
}

export interface YouPose {
  /** the desk's offset (world units) from its place after the turn */
  shift: P2;
  lamp: LampPose;
  /** the bulb's emission (above 1.0 it blooms), or null for the act-two rule (state.ts `lamp`) */
  bulb: number | null;
  /** how far the bulb stands out of the hood's mouth: wide in act one, back inside after the turn ("the lamp narrows") */
  bulbOut: number;
  /** where the lid strut is: propping the laptop's lid, or resting in its recess */
  strut: 'lid' | 'tray';
  /** each chore that rests on the desk: 0 not there yet … 1 in its place (it drops in as it lands) */
  held: { key: number; glass: number; strut: number };
  /** the in-tray stands on the desk (it comes with the Router's replies, after the turn) */
  inTray: boolean;
  /** the earlier reply lies in it (default: yes; the turn's in-tray holds only Fix B's replies, which it draws itself) */
  inTraySlip?: boolean;
}

/** Your desk after the turn (the act-two pose every style frame from (b) on draws). */
export const YOU_POSE_B: YouPose = {
  shift: [0, 0],
  lamp: { base: LAMP.base, elbow: LAMP.elbow, head: LAMP.head, aim: LAMP.aim },
  bulb: null,
  bulbOut: 0,
  strut: 'tray',
  held: { key: 1, glass: 1, strut: 1 },
  inTray: true,
};

/** The lamp's arm lengths (from the base's swivel to the elbow, the elbow to the head), kept by every pose. */
export const LAMP_FOOT_Z = 16;
const dist = (a: P3, b: P3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const footOf = (base: P3): P3 => [base[0], base[1], base[2] + LAMP_FOOT_Z];
export const LAMP_ARMS = { lower: dist(footOf(LAMP.base), LAMP.elbow), upper: dist(LAMP.elbow, LAMP.head) } as const;

/**
 * The elbow of a two-bone arm from the base's swivel to the head, bent toward `pole` (a direction):
 * the arms keep their lengths, so one lamp reaches every pose. A head out of reach is pulled in.
 */
export function lampElbow(base: P3, head: P3, pole: P3): P3 {
  const f = footOf(base);
  const d0 = dist(f, head);
  const { lower: l1, upper: l2 } = LAMP_ARMS;
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 1), l1 + l2 - 1);
  const u: P3 = [(head[0] - f[0]) / d0, (head[1] - f[1]) / d0, (head[2] - f[2]) / d0];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const r = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const pu = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  const v0: P3 = [pole[0] - pu * u[0], pole[1] - pu * u[1], pole[2] - pu * u[2]];
  const vl = Math.hypot(...v0);
  const v: P3 = [v0[0] / vl, v0[1] / vl, v0[2] / vl];
  return [f[0] + a * u[0] + r * v[0], f[1] + a * u[1] + r * v[1], f[2] + a * u[2] + r * v[2]];
}

// ------------------------------------------------------------------------------------------------
// The chore tray, a shadow board (desk coordinates; the tray is `YOU.tray`)

const TRAY_C = rectC(YOU.tray);
/** The plate's top over the tray's floor: a recess is this deep. */
export const TRAY_Z = { floor: YOU.top + 3, plate: YOU.top + 7 } as const;
/**
 * Where each chore rests in the tray, lying north-south (desk coordinates of its centre), and the
 * outline its recess is cut to (half sizes, from the centre). The starter key's bow is north, its bit south-east.
 */
export const CHORES = {
  key: { c: [YOU.tray.x0 + 40, TRAY_C[1] - 3] as P2, bowY: 24, bowR: 14, shank: [-32, 10] as const, bit: { x: [3, 17] as const, y: [-32, -15] as const } },
  glass: { c: [YOU.tray.x0 + 102, TRAY_C[1]] as P2, half: [14, 30] as const },
  strut: { c: [YOU.tray.x0 + 152, TRAY_C[1]] as P2, half: [7, 38] as const },
} as const;
/** A recess is cut this much wider than its chore. */
export const RECESS_GAP = 3;

/** The lid strut propping the laptop's lid (desk coordinates): from a clip on the base's east edge to one near the lid's top. */
export function strutOnLid(): { a: P3; b: P3 } {
  const L = YOU.laptop;
  const t = 0.78;
  return {
    a: [L.x1 + 3, L.y0 + 34, YOU.top + 6],
    b: [L.x1 + 3, L.y1 + YOU.lidH * t * Math.sin(YOU.lidLean), YOU.top + 8 + YOU.lidH * t * Math.cos(YOU.lidLean)],
  };
}
