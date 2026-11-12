/**
 * The end card and the end key (STORYBOARD 13.2-13.3; cues.ts END, the 'end' card cue and 'end-key'), pure: where they
 * lie at the bookend's framing (camera.ts FRAMING_BOOKEND, held from bar 77), how they come and go, and their shadows.
 * objects/End.tsx draws them (over the dissolve's veil in the summary's world, then in the end's own world:
 * desk/EndFrame.tsx).
 *
 * - The card is the title card's bone index card (objects/TitleCard.tsx: its stock, its punch hole and its "№"), large
 *   enough for the end card's six EN lines and five zh lines (the source's title, its first two EN lines and its first zh
 *   line, set a tier up: `END_TYPE`; the rest at the film's end-card type, look/tokens.ts TYPE.endEn 40 px, TYPE.endZh
 *   38 px), lying flat on the bare desk in the frame's lower left, wholly inside title-safe. It is posted in from beyond
 *   the frame's south edge over the dissolve's last frames, as part of the incoming layer (gl/veil.ts: it dissolves in
 *   with the bare desk it is posted onto), on a low arc that comes to rest over its place with no vertical speed, lifts a
 *   little (its anticipation) and drops onto its place on `END.card.land`, its contact shadow tightening over the drop
 *   (the title card's settle, TitleCard.tsx cardAt); its lettering wipes in from the landing. On `END.card.leave` it lifts
 *   off (its contact going over its first frames) and slides out south at the film's object speed cap, wholly off the
 *   frame on its last frame. The end's one soft pool (`endPools`: your lamp's warm light, from beyond the frame's upper
 *   left) lifts the card's upper left and falls off across it, and goes with the card.
 * - The key: beat 11's map key (lane D's legend plate with its three material samples: enamel, vellum, pencil;
 *   objects/Beat11.tsx KeyLegend), scaled for the 1.6x framing and set in the frame's upper right (still (d)'s map key
 *   sat there too). The bare plate slides in from beyond the frame's top edge once the card has landed and is dead still
 *   2 f before `END.key`, when its words wipe in beside its samples (objects/End.tsx EndText); after their fade it slides
 *   back out 2 f behind the card's leave, at the speed cap, gone before the card.
 */
import { clamp, easings } from '@aiv/core';
import { END, WORDS } from '../cues.ts';
import { FRAMING_BOOKEND, deskCamera, project, screenToDesk } from './camera.ts';
import { KEY_BOX, KEY_PLATE, KEY_SAMPLES } from './beat11.ts';
import { LIGHT_HEX, rectFp, type Footprint } from './fpKit.ts';
import type { P3, Pool, Rect } from './layout.ts';
import { SAFE, TYPE } from '../look/tokens.ts';
import { CARD_HEX, CARD_T, cardAt, cardContactFootprint, cardFootprint, type CardLine, type CardSpec, type CardState } from './objects/TitleCard.tsx';

const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;

/** The bookend's camera, held from bar 77 to the end (camera.ts TO_BOOKEND's last framing). */
export const POSE_END = deskCamera(FRAMING_BOOKEND, 15);

/**
 * The card's lettering, in card units (u: the card lies flat, so 1 u is 1.6 px across and about 1.55 px down the frame at
 * the bookend's 1.6x): EN at 25 u (40 px across), zh at 23.75 u (38 px across), on 30 u and 29.5 u lines (about 46 px);
 * the source's title a tier up (its two EN lines at 27.5 u, 44 px, semibold, on 33 u lines; its zh line at 26.25 u,
 * 42 px, medium, on a 32 u line), the zh block a little apart under the EN; all flush left on the card's margin.
 */
export const END_TYPE = {
  en: 25,
  zh: 23.75,
  enPitch: 30,
  zhPitch: 29.5,
  title: { en: 27.5, zh: 26.25, enPitch: 33, zhPitch: 32, enWeight: 600, zhWeight: 500, enLines: 2, zhLines: 1 },
  gap: 8,
  margin: 24,
  top: 44,
  bottom: 18,
} as const;
const EN_LINES = WORDS.end.en.split('\n');
const ZH_LINES = WORDS.end['zh-Hans'].split('\n');
/** Each line's baseline (u down from the card's north edge): the EN lines, then the zh lines, each line's pitch its tier's. */
const BASELINES = (() => {
  const T = END_TYPE;
  const en: number[] = [];
  let y = T.top;
  EN_LINES.forEach((_, i) => {
    en.push(y);
    y += i < T.title.enLines ? T.title.enPitch : T.enPitch;
  });
  const zh: number[] = [];
  y += T.gap + (T.title.zh - T.zh);
  ZH_LINES.forEach((_, i) => {
    zh.push(y);
    y += i < T.title.zhLines ? T.title.zhPitch : T.zhPitch;
  });
  return { en, zh, last: zh[zh.length - 1]! };
})();
/** The card's size (u): the longest line (the EN dates line, about 1115 px at 40 px: measured on the render) inside its margins, every line inside its depth. */
export const END_CARD_SIZE = { w: 752, d: Math.ceil(BASELINES.last + 6 + END_TYPE.bottom) } as const;
/** Where the card's top face's south-west corner sits on screen at rest (px): on title-safe's left edge, its foot (its south face's edge, 2 px lower) 1 px inside title-safe's bottom. */
export const END_CARD_SW: readonly [number, number] = [SAFE.x + 4, SAFE.bottom - 3];

const lines = (): CardLine[] => {
  const out: CardLine[] = [];
  const T = END_TYPE;
  EN_LINES.forEach((text, i) => {
    const title = i < T.title.enLines;
    out.push({ text, size: title ? T.title.en : T.en, weight: title ? T.title.enWeight : TYPE.endEn.weight, color: CARD_HEX.ink, x: T.margin, y: BASELINES.en[i]!, cue: 'end' });
  });
  ZH_LINES.forEach((text, i) => {
    const title = i < T.title.zhLines;
    const weight = title ? T.title.zhWeight : TYPE.endZh.weight;
    out.push({ text, size: title ? T.title.zh : T.zh, weight, cjkWeight: weight, color: CARD_HEX.zh, x: T.margin, y: BASELINES.zh[i]!, cue: 'end' });
  });
  return out;
};

/**
 * The card's post (TitleCard.tsx CARD_POST's fields): from beyond the frame's south edge (its north edge under the frame's
 * foot, lifted 60 u, a little west), a `arc` f arc that slows to a stop over its place (its in-frame face never over
 * 2410 px/s: end.test); the title card's hover, lift and drop. Its leave is its own (`endCardAt`): a 1 f lift, then out
 * south at the speed cap.
 */
export const END_POST = { from: [-60, -440, 60] as P3, hump: 60, hover: 18, lift: 4, liftFrames: 3, dropFrames: 4, arc: 20 } as const;

/**
 * The leave (END.card.leave is its first frame): a 1 f lift off its place (up a hair: its anticipation; its contact going
 * over that frame and the next), then out south at its lift's height, its north edge moving `steps` px down the screen on
 * its next two frames and a held `px` a frame after them (2160 px/s: the face nearer the camera, at the frame's foot,
 * moves about 10% further a frame, 2370 px/s, under the 2410 px/s cap), wholly off the frame on its last frame, the
 * `frames`th from the leave (gone from the next).
 */
export const LEAVE = { frames: 11, antic: [0, 0, 3] as P3, steps: [40, 70] as const, px: 72, contact: 2 } as const;

/** The end card (the post's first frame, the landing, the leave and the frame it is gone on: cues.ts END.card). */
export const END_CARD: CardSpec = (() => {
  const { w, d } = END_CARD_SIZE;
  const sw = screenToDesk(POSE_END, END_CARD_SW, CARD_T);
  const land = END.card.land;
  return {
    place: { x0: Math.round(sw[0]), y1: Math.round(sw[1] + d), w, d, z: 0 },
    frames: { enter: land - END_POST.dropFrames - END_POST.liftFrames - END_POST.arc, land, leave: END.card.leave, gone: END.card.leave + LEAVE.frames },
    mark: '№',
    // top right, over the card's own margin, clear of the lettering (the first line ends well short of it); the board is
    // larger than the title card's, so its hole and its mark are too (the mark about 20 px tall at 1.6x)
    hole: { x: w - 22, y: 22, r: 8 },
    markEm: 20,
    lines: lines(),
    post: { from: END_POST.from, hump: END_POST.hump, hover: END_POST.hover, lift: END_POST.lift, liftFrames: END_POST.liftFrames, dropFrames: END_POST.dropFrames },
  };
})();


/** The end card at f (TitleCard.tsx CardState): the title card's post and rest, its own leave. */
export function endCardAt(f: number): CardState {
  const c = END_CARD;
  const leave = c.frames.leave;
  if (f < leave) return cardAt(c, f);
  if (f >= c.frames.gone) return { present: false, off: [0, 0, 0], contact: 0 };
  const L = LEAVE;
  const k = f - leave + 1;
  const contact = 0.8 * clamp(1 - k / L.contact);
  if (k <= 1) return { present: true, off: [L.antic[0] * k, L.antic[1] * k, L.antic[2] * k], contact };
  // out south: the north edge's screen point moves down the frame, gathering speed over two frames to the held pace
  const top = c.place.z + CARD_T + L.antic[2];
  const nw = project(POSE_END, [c.place.x0, c.place.y1 + L.antic[1], top]);
  const down = k === 2 ? L.steps[0] : L.steps[0] + L.steps[1] + L.px * (k - 3);
  const to = screenToDesk(POSE_END, [nw[0], nw[1] + down], top);
  return { present: true, off: [L.antic[0], to[1] - c.place.y1, L.antic[2]], contact };
}

/**
 * The end's one soft pool (gl/light.ts pools: linear light relative to the albedo): your lamp's warm light from beyond the
 * frame's upper left, centred over the card's north-west quarter, so the card's upper left is lifted about 10 codes and
 * the light falls off across it (its south-east corner about 1 code); on the slate it is a faint 2-code glow. It is the
 * end world's (and the veil's) from the dissolve, and it goes with the card: it fades over the card's leave, so the bare
 * desk at the end has no pool.
 */
export const END_POOL = { at: [0.22, 0.2] as const, sigma: [0.46, 0.56] as const, amount: 0.13, z: [-1, 40] as const } as const;
export function endPools(f: number): Pool[] {
  const c = END_CARD;
  const P = END_POOL;
  const k = 1 - sine((f - c.frames.leave) / (c.frames.gone - c.frames.leave));
  if (k <= 0) return [];
  const hex = LIGHT_HEX.yours;
  const lin = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
  const a = (P.amount * k) / lin[0]!;
  return [{ c: [c.place.x0 + P.at[0] * c.place.w, c.place.y1 - P.at[1] * c.place.d], z: P.z, sigma: [P.sigma[0] * c.place.w, P.sigma[1] * c.place.d], rgb: [lin[0]! * a, lin[1]! * a, lin[2]! * a] }];
}

/** The card's shadows at f: its footprint and the contact under it (TitleCard.tsx). */
export function endCardFootprints(f: number): Footprint[] {
  const s = endCardAt(f);
  return [cardFootprint(END_CARD, s), cardContactFootprint(END_CARD, s)].filter((x): x is Footprint => x !== null);
}

// ------------------------------------------------------------------------------------------------
// The end key

/**
 * Where the key's samples sit on screen at the bookend's framing (their column's x, each row's y) and its words' columns
 * (left aligned; the zh column ends inside title-safe): still (d)'s map key's layout (beat11.ts KEY_SCREEN), its rows 68 px
 * apart at 1.6x.
 */
export const END_KEY_SCREEN = { x: 1150, ys: [118, 186, 254] as const, en: 1198, zh: 1525 } as const;
/** Lane D's legend plate (built round beat11.ts KEY_SAMPLES at still (d)) scaled about its samples' centre and set so its samples land on END_KEY_SCREEN. */
export const END_KEY = (() => {
  const src = KEY_SAMPLES;
  const pitch = Math.hypot(src[2]![0] - src[0]![0], src[2]![1] - src[0]![1]);
  const a = screenToDesk(POSE_END, [END_KEY_SCREEN.x, END_KEY_SCREEN.ys[0]], 0);
  const b = screenToDesk(POSE_END, [END_KEY_SCREEN.x, END_KEY_SCREEN.ys[2]], 0);
  const scale = Math.hypot(b[0] - a[0], b[1] - a[1]) / pitch;
  // the samples' centre (desk plane) moves to the target's centre; the plate's top sits at KEY_PLATE.top x scale
  const c: P3 = [(src[0]![0] + src[2]![0]) / 2, (src[0]![1] + src[2]![1]) / 2, 0];
  const at = screenToDesk(POSE_END, [END_KEY_SCREEN.x, (END_KEY_SCREEN.ys[0] + END_KEY_SCREEN.ys[2]) / 2], KEY_PLATE.top * scale);
  const to: P3 = [at[0], at[1], 0];
  /** the plate's box at rest (desk plan) */
  const box: Rect = { x0: to[0] + (KEY_BOX.x0 - c[0]) * scale, x1: to[0] + (KEY_BOX.x1 - c[0]) * scale, y0: to[1] + (KEY_BOX.y0 - c[1]) * scale, y1: to[1] + (KEY_BOX.y1 - c[1]) * scale };
  return { scale, from: c, to, box };
})();
/** How far north of its place the plate starts and ends (u: its south edge and its shadow beyond the frame's top edge). */
export const END_KEY_OFF = 300;
/**
 * Its slide in (sine, from `in`), dead still from `settle` (2 f before END.key, so its words trail it); its slide out from
 * `out` (2 f behind the card's leave), gathering speed over `outSteps` and then held at `outU` u a frame (about 70 px at
 * the frame's top), beyond the top edge on its last drawn frame (`outFrames` from `out`, both counted).
 */
export const END_KEY_MOVE = { in: END.key - 20, settle: END.key - 2, out: END.card.leave + 2, outSteps: [16, 36] as const, outU: 48, outFrames: 7 } as const;
/** The plate's offset north of its place (u) at f; null where it is not drawn. */
export function endKeyAt(f: number): { dy: number } | null {
  const M = END_KEY_MOVE;
  if (f <= M.in || f >= M.out + M.outFrames) return null;
  if (f < M.out) return { dy: END_KEY_OFF * (1 - sine((f - M.in) / (M.settle - M.in))) };
  const k = f - M.out + 1;
  const d = k === 1 ? M.outSteps[0] : M.outSteps[0] + M.outSteps[1] + M.outU * (k - 2);
  return { dy: d };
}
/** The plate's shadow at f (lane D's: its box at its top, a contact). */
export function endKeyFootprints(f: number): Footprint[] {
  const k = endKeyAt(f);
  if (!k) return [];
  const B = END_KEY.box;
  return [rectFp({ ...B, y0: B.y0 + k.dy, y1: B.y1 + k.dy }, 0, KEY_PLATE.top * END_KEY.scale, 0.8, 4)];
}

/** Everything the end's own world casts at f: the card and the key's plate. */
export const endWorldFootprints = (f: number): Footprint[] => [...endCardFootprints(f), ...endKeyFootprints(f)];

/** A world point's screen point at the bookend's framing (tests, layout). */
export const onEnd = (p: P3): [number, number] => project(POSE_END, p);
