/**
 * The objects of beat 11 (desk/beat11.ts), drawn in the summary's world only (FilmFrame.tsx SummaryFrame), and its DOM text
 * over the world (`Beat11Text`, in the frame's overlay slot: desk/DeskFrame.tsx `overlay`, posed by the same camera):
 * - the trait plates once they leave act two's bodies: the worded Proactive and Productive plates turning over in flight
 *   into still (d)'s pictogram plates (the seam's settling), then retiring with Continuous into your chore tray (11.1);
 * - the map key's legend plate and its three samples (11.2), its words in the DOM beside them;
 * - the act-one grey-stock card (11.3): one lamp, eight folders, the request among the noise, at card scale;
 * - the neck-collar gauge from its lift off the throat, riding your lamp's neck (11.3);
 * - the next replies (11.4): unstamped slips coming down the chute and waiting queued in it.
 * Built from the kit's materials and programs (the plates' faces as Trace drew them in still (d); vellum and pencil as
 * objects/Proposed.tsx draws them), so nothing here is a new program.
 */
import type { CamPose } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Shape, type BufferGeometry, type MeshPhysicalMaterial, type MeshStandardMaterial, type Texture } from 'three';
import { WORDS } from '../../cues.ts';
import { GREY_TEXT, Label } from '../../kit/text.tsx';
import { useFilmFonts } from '../../look/fonts.ts';
import { cardPose, cardSize, cardIn } from '../beat4.ts';
import { youPoseAt } from '../actOne.ts';
import { CARD_SPOT_11, KEY_BOX, KEY_MOVE, KEY_PLATE, KEY_SAMPLES, KEY_SCREEN, KEY_WORDS, MINI, WORDED, collarAt, keyWordsAt, type CollarPose, type PlateId, type PlatePose } from '../beat11.ts';
import { disc, dome, extrude, merge, plane, planeOn, slab } from '../geom.ts';
import { HEX, enamel, graphite, matte, vellum } from '../gl/materials.ts';
import { PRODUCTIVE_FACE, SANS_CSS } from '../gl/print7.ts';
import { plateTexture } from '../gl/plate.ts';
import { INK, texture } from '../gl/text.ts';
import { Step, WithMats, isStepped, useDeskMats, useStepMode, type DeskMats } from '../kit.tsx';
import { SLIP, TRAIT_PLATE, rectC, type P2, type Rect } from '../layout.ts';
import { cueReveal } from '../onScreen.ts';
import { TEXT_HEX } from '../Overlay.tsx';
import { replyPose, type DeskState, type ReplyState } from '../state.ts';
import { Counterfactual, RELIEF, circle, polyShape, rect, solid, useReliefMats } from './Counterfactual.tsx';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });
/** A box moved to the origin (its centre). */
const centred = (r: Rect): Rect => {
  const [cx, cy] = rectC(r);
  return { x0: r.x0 - cx, x1: r.x1 - cx, y0: r.y0 - cy, y1: r.y1 - cy };
};

export function Beat11({ s }: { s: DeskState }) {
  const e = s.e11;
  if (!e) return null;
  // the collar rides your lamp as YourDesk draws it (actOne.ts youPoseAt: the desk's pose with every beat's refinements)
  const collar = e.collar ? collarAt(s.f, youPoseAt(s.f)) : null;
  return (
    <>
      <Plates s={s} plates={e.plates} />
      {collar && <Collar s={s} c={collar} />}
      {e.key && <KeyLegend dy={e.key.dy} />}
      {e.card && <ActOneCard card={e.card} />}
      {s.replies
        .filter((r) => r.id.startsWith('b11-next'))
        .map((r) => (
          <NextReply key={r.id} r={r} />
        ))}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// The trait plates

/** The pictogram faces (still (d)'s: each engraves its chore's outline, no word at this distance): the key, the sand-glass, the tape on its reel. */
function pictogram(kind: PlateId, aniso: number): Texture {
  return texture(
    92,
    26,
    (c) => {
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      if (kind === 'proactive') {
        c.arc(30, 13, 6.5, 0, Math.PI * 2);
        c.moveTo(36.5, 13);
        c.lineTo(66, 13);
        c.lineTo(66, 19);
        c.moveTo(58, 13);
        c.lineTo(58, 18);
      } else if (kind === 'productive') {
        c.moveTo(34, 6);
        c.lineTo(58, 6);
        c.lineTo(46, 13);
        c.lineTo(58, 20);
        c.lineTo(34, 20);
        c.lineTo(46, 13);
        c.closePath();
      } else {
        // the reel and the tape running off it in cells (the Register's log: what the chore became)
        c.arc(26, 13, 9, 0, Math.PI * 2);
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
          c.moveTo(26, 13);
          c.lineTo(26 + 8 * Math.cos(a), 13 + 8 * Math.sin(a));
        }
        c.moveTo(26, 4);
        c.lineTo(72, 4);
        c.lineTo(72, 13);
        c.lineTo(35, 13);
        for (const x of [47, 59]) {
          c.moveTo(x, 4);
          c.lineTo(x, 13);
        }
      }
      c.stroke();
    },
    aniso,
  );
}

function usePlateParts() {
  const gl = useThree((st) => st.gl);
  const m = useDeskMats();
  const geo = useMemo(() => {
    const worded = (b: Rect, t: number, backT: number) => {
      const B = centred(b);
      const z0 = -t / 2;
      const z1 = t / 2;
      return { back: slab(B, z0, z0 + backT, 4, 0.8), body: slab(inset(B, 3), z0 + backT, z1, 3, 1), face: planeOn(inset(B, 5), z1 + 0.2) };
    };
    const T = TRAIT_PLATE.box;
    const tc = rectC(T);
    const cont = worded(T, WORDED.continuous.t, 2);
    return {
      proactive: worded(WORDED.proactive.box, WORDED.proactive.t, 1.6),
      productive: worded(WORDED.productive.box, WORDED.productive.t, 1.6),
      continuous: { ...cont, bolts: merge(TRAIT_PLATE.brackets.map((x) => dome(2.6, x - tc[0], T.y0 + 6 - tc[1], WORDED.continuous.t / 2))) },
      mini: { body: slab({ x0: -MINI.l / 2, x1: MINI.l / 2, y0: -MINI.w / 2, y1: MINI.w / 2 }, -MINI.t / 2, MINI.t / 2, 3, 1.4), face: plane(92, 26, 0, 0, MINI.t / 2 + 0.1) },
    };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const g of [geo.proactive, geo.productive, geo.continuous, geo.mini]) for (const x of Object.values(g)) (x as BufferGeometry).dispose();
    },
    [geo],
  );
  const tex = useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return { proactive: pictogram('proactive', an), productive: pictogram('productive', an), continuous: pictogram('continuous', an), productiveWords: plateTexture(SANS_CSS, WORDS.traitProductive, PRODUCTIVE_FACE, an) };
  }, [gl]);
  // the pictogram faces as Trace made them for still (d) (a matte enamel with the engraving for a map), full and stepped
  const faces = useMemo(() => {
    const face = (t: Texture, stepped: boolean | 'late' | 'own') => {
      const f = matte('#FFFFFF', 0.4, 0, stepped);
      f.map = t;
      f.color.set(HEX.enamel);
      return f;
    };
    const set = (stepped: boolean | 'late' | 'own') => ({ proactive: face(tex.proactive, stepped), productive: face(tex.productive, stepped), continuous: face(tex.continuous, stepped) });
    return { full: set(false), stepped: set(true), late: set('late'), own: set('own') };
  }, [tex]);
  // the Productive plate's worded face, as objects/Jobs.tsx makes it (the kit's enamel with its words, full set)
  const productiveWords = useMemo(() => enamel(tex.productiveWords, (m.enamel as MeshPhysicalMaterial).envMap!, HEX.enamel), [tex, m]);
  useLayoutEffect(
    () => () => {
      for (const t of Object.values(tex)) t.dispose();
      for (const set of Object.values(faces)) for (const x of Object.values(set)) x.dispose();
      productiveWords.dispose();
    },
    [tex, faces, productiveWords],
  );
  return { geo, faces, productiveWords };
}

function Plates({ s, plates }: { s: DeskState; plates: Record<PlateId, PlatePose | null> }) {
  const parts = usePlateParts();
  return (
    <>
      {(Object.keys(plates) as PlateId[]).map((id) => {
        const p = plates[id];
        if (!p) return null;
        // Continuous steps up from the Register's step as it flies to your desk (summary.ts summaryStep: 'plate' on its own ramp); the others fly unstepped
        const on = id === 'continuous' ? isStepped(s.step, 'plate') : false;
        return (
          <Step key={id} on={on}>
            <Plate id={id} p={p} parts={parts} />
          </Step>
        );
      })}
    </>
  );
}

function Plate({ id, p, parts }: { id: PlateId; p: PlatePose; parts: ReturnType<typeof usePlateParts> }) {
  const m = useDeskMats();
  const mode = useStepMode();
  const { geo, faces } = parts;
  // its turn about its long axis (the worded body's top tipping north, away from the camera), then about z (north-south into its recess)
  const face = (mode === 'late' ? faces.late : mode === 'own' ? faces.own : mode ? faces.stepped : faces.full)[id];
  return (
    <group position={p.c} rotation={[-p.roll, 0, p.yaw, 'ZXY']} scale={[p.sx, p.sy, 1 - p.squash]}>
      {p.body === 'mini' ? (
        <>
          <mesh geometry={geo.mini.body} material={m.enamelShade} />
          <mesh geometry={geo.mini.face} material={face} />
        </>
      ) : (
        <Worded id={id} m={m} parts={parts} />
      )}
    </group>
  );
}

function Worded({ id, m, parts }: { id: PlateId; m: DeskMats; parts: ReturnType<typeof usePlateParts> }) {
  const g = parts.geo[id];
  const face = id === 'proactive' ? m.printed.proactive : id === 'continuous' ? m.printed.trait : parts.productiveWords;
  return (
    <>
      <mesh geometry={g.back} material={m.graphiteDark} />
      <mesh geometry={g.body} material={m.enamel} />
      <mesh geometry={g.face} material={face} />
      {id === 'continuous' && <mesh geometry={parts.geo.continuous.bolts} material={m.steel} />}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// The neck-collar gauge (objects/Register.tsx's, built about its centre)

function useGaugeGeometry() {
  const g = useMemo(() => {
    // as the Register builds it: a disc (top - 2 .. top + 3), its round face, a needle pointing +x, a hub; centred on the disc's mid-height
    const body = disc(28, -2.5, 2.5, { bevel: 1.2 });
    const face = new CircleGeometry(24, 48).translate(0, 0, 2.7);
    const sh = new Shape();
    sh.moveTo(0, -1.8);
    sh.lineTo(22, 0);
    sh.lineTo(0, 1.8);
    sh.closePath();
    const needle = extrude(sh, 3, 4.3, 0);
    const hub = dome(3.4, 0, 0, 4.1);
    return { body, face, needle, hub };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

function Collar({ s, c }: { s: DeskState; c: CollarPose }) {
  const g = useGaugeGeometry();
  // its needle: beat 4's low reading (and beat 6's), swinging high once it rides your lamp
  const needle = s.b4.gauge.needle + s.e6.needle + c.needle;
  return (
    <Step on={c.flying ? isStepped(s.step, 'gauge') : false}>
      <WithMats>
        {(n) => (
          <group position={c.c} rotation={[c.tilt, 0, c.yaw, 'ZXY']} scale={[c.scale * (1 + c.squash / 2), c.scale * (1 + c.squash / 2), c.scale * (1 - c.squash)]}>
            <mesh geometry={g.body} material={n.graphite} />
            <mesh geometry={g.face} material={n.printed.gauge} />
            <mesh geometry={g.needle} material={n.rubber} rotation={[0, 0, needle]} />
            <mesh geometry={g.hub} material={n.steel} />
          </group>
        )}
      </WithMats>
    </Step>
  );
}


// ------------------------------------------------------------------------------------------------
// The map key's legend plate and its samples (11.2)

/** A sample's size on the plate (u): about 40 x 26 px at 0.64x (the vellum swatch a little larger, for its dashed edge). */
const SAMPLE = { w: 62, d: 40 } as const;
const SWATCH = { w: 76, d: 50 } as const;

/**
 * The samples are the world's own materials, drawn as objects/Proposed.tsx draws them on the desk (its constants): vellum a
 * 14% fill under a 75% dashed edge (22/16 u dashes, 4 u wide), pencil graphite at 80% in two passes, grained; their alphas
 * set against the desk's display value, so on the dark legend plate (your desk's own graphite) they read as on the desk.
 */
const DESK_DSP = 35;
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const over = (v: number, t: number): number => (lin(DESK_DSP + t * (v - DESK_DSP)) - lin(DESK_DSP)) / (lin(v) - lin(DESK_DSP));
const rgba = (rgb: readonly [number, number, number], t: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${over(rgb[1], t).toFixed(3)})`;
const VELLUM = { fill: rgba([217, 219, 213], 0.14), line: rgba([226, 224, 217], 0.75), dash: [22, 16] as number[], w: 4 } as const;
const PENCIL: readonly [number, number, number] = [140, 138, 133];
/** A seeded hash of an index to 0..1 (integer mixing: deterministic, no randomness), as objects/Proposed.tsx's. */
function hash01(i: number, seed: number): number {
  let h = Math.imul(i ^ Math.imul(seed, 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
type G = CanvasRenderingContext2D;
/** Pencil grain: seeded specks of the lead lifted off what is drawn (the paper's tooth showing through). */
function grain(g: G, w: number, h: number, seed: number): void {
  g.save();
  g.setLineDash([]);
  g.globalCompositeOperation = 'destination-out';
  const n = Math.round(w * h * 0.09);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${(0.3 + 0.55 * hash01(i, seed + 1)).toFixed(2)})`;
    g.fillRect(hash01(i, seed) * w, hash01(i + 7919, seed) * h, 2.4, 2.4);
  }
  g.restore();
}
/** A pencil line through points: two slightly offset passes, round caps (graphite at 80% over the desk). */
function lead(g: G, pts: readonly P2[], width: number): void {
  g.setLineDash([]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [dx, dy, k] of [
    [0, 0, 1],
    [0.9, -0.6, 0.55],
  ] as const) {
    g.strokeStyle = k === 1 ? rgba(PENCIL, 0.8) : rgba(PENCIL, 0.4);
    g.lineWidth = width * (k === 1 ? 1 : 0.7);
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)));
    g.stroke();
  }
}
/** The pencil "?" (objects/Proposed.tsx's hook and point at size `q`, grained). */
function pencilQuery(g: G, q: number, seed: number): void {
  const hook: P2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = Math.PI * (1.05 + 1.25 * Math.min(1, t / 0.7));
    hook.push(t <= 0.7 ? [q * 0.5 + Math.cos(a) * q * 0.21, q * 0.3 + Math.sin(a) * q * 0.21] : [q * 0.5, q * 0.47 + (t - 0.7) * q * 0.55]);
  }
  lead(g, hook, q * 0.052);
  lead(
    g,
    [
      [q * 0.5, q * 0.83],
      [q * 0.51, q * 0.86],
    ],
    q * 0.085,
  );
  grain(g, q, q, seed);
}

function useKeyParts() {
  const gl = useThree((st) => st.gl);
  const geo = useMemo(() => {
    const B = KEY_BOX;
    const top = KEY_PLATE.top;
    const s0 = KEY_SAMPLES[0]!;
    const s1 = KEY_SAMPLES[1]!;
    const s2 = KEY_SAMPLES[2]!;
    const half = { x0: -SAMPLE.w / 2, x1: SAMPLE.w / 2, y0: -SAMPLE.d / 2, y1: SAMPLE.d / 2 };
    const at = (p: readonly number[], r: Rect): Rect => ({ x0: p[0]! + r.x0, x1: p[0]! + r.x1, y0: p[1]! + r.y0, y1: p[1]! + r.y1 });
    const Q = SAMPLE.d + 22;
    return {
      // a low legend board of your desk's own dark graphite, an enamel rim along its edge
      plate: slab(B, 0, top, 5, 1.6),
      rim: slab(inset(B, -1.5), 0, 1.2, 6, 0.6),
      // built: an enamel block standing on the plate
      block: slab(at(s0, half), top, top + 7, 3, 1.4),
      // proposed: a vellum swatch laid flat, its dashed edge
      swatch: plane(SWATCH.w, SWATCH.d, s1[0]!, s1[1]!, top + 0.3),
      // open: a pencil "?" drawn on the plate
      query: plane(Q, Q, s2[0]!, s2[1]!, top + 0.25),
    };
  }, []);
  useLayoutEffect(() => () => Object.values(geo).forEach((x) => x.dispose()), [geo]);
  const tex = useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const W = SWATCH.w;
    const D = SWATCH.d;
    const swatch = texture(
      W,
      D,
      (c) => {
        c.fillStyle = VELLUM.fill;
        c.fillRect(2, 2, W - 4, D - 4);
        c.strokeStyle = VELLUM.line;
        c.lineWidth = VELLUM.w;
        c.setLineDash(VELLUM.dash);
        c.strokeRect(VELLUM.w / 2 + 1, VELLUM.w / 2 + 1, W - VELLUM.w - 2, D - VELLUM.w - 2);
      },
      an,
      'transparent',
    );
    const Q = SAMPLE.d + 22;
    const query = texture(Q, Q, (c) => pencilQuery(c, Q, 11), an, 'transparent');
    return { swatch, query };
  }, [gl]);
  // your desk's own top for the board (objects/YourDesk.tsx's slab graphite), so the samples sit on the desk's value
  const mats = useMemo(() => ({ swatch: vellum(tex.swatch), query: vellum(tex.query), board: graphite('#2C2F2E', { roughness: 0.62, metalness: 0.35, brush: 0.07 }) }), [tex]);
  useLayoutEffect(
    () => () => {
      for (const t of Object.values(tex)) t.dispose();
      for (const x of Object.values(mats)) x.dispose();
    },
    [tex, mats],
  );
  return { geo, mats };
}

function KeyLegend({ dy }: { dy: number }) {
  const { geo, mats } = useKeyParts();
  const m = useDeskMats();
  return (
    <group position={[0, dy, 0]}>
      <mesh geometry={geo.rim} material={m.enamelShade} />
      <mesh geometry={geo.plate} material={mats.board as MeshStandardMaterial} />
      <mesh geometry={geo.block} material={m.enamel} />
      <mesh geometry={geo.swatch} material={mats.swatch} renderOrder={3} />
      <mesh geometry={geo.query} material={mats.query} renderOrder={3} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The next replies (11.4): unstamped slips (MT1's reply's form: a slip with its enamel stop tab), on the replies' path

function useNextReplyGeometry() {
  const g = useMemo(() => ({ slip: new BoxGeometry(SLIP.l, SLIP.w, 1.2), tab: slab({ x0: SLIP.l / 2 - 4, x1: SLIP.l / 2 + 8, y0: -9, y1: 9 }, -0.6, 2.2, 2, 0.6) }), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** A next reply on its ride (state.ts replyPose: out from under the deck, down the chute's trough), waiting where it stops. */
function NextReply({ r }: { r: ReplyState }) {
  const m = useDeskMats();
  const g = useNextReplyGeometry();
  const pose = replyPose(r.ride, r.rest);
  return (
    <group position={pose.p} rotation={[0, pose.slope, pose.heading, 'ZYX']}>
      <mesh geometry={g.slip} material={m.paperLit} />
      <mesh geometry={g.tab} material={m.enamel} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The act-one card (11.3)

/** Act one at card scale (the card's face, 300 x 184, x east, y north): your lamp over the request among the noise, and the eight folders. */
function useActOnePlay() {
  return useMemo(() => {
    const R = RELIEF;
    // your desk's lamp: its base, its two arms, its hood over the noise
    const base = circle(-112, -52, 11);
    const arm = (a: P2, b: P2, w: number) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const nx = (-dy / l) * (w / 2);
      const ny = (dx / l) * (w / 2);
      return polyShape([
        [a[0] + nx, a[1] + ny],
        [b[0] + nx, b[1] + ny],
        [b[0] - nx, b[1] - ny],
        [a[0] - nx, a[1] - ny],
      ]);
    };
    const lamp = solid([base, arm([-112, -52], [-96, 4], 6), arm([-96, 4], [-64, 30], 5.5), circle(-60, 32, 12)], 0, R * 1.6);
    // the eight folders the noise was sorted into, two rows of four along the card's foot, each with its tab
    const folders: Shape[] = [];
    for (let i = 0; i < 8; i++) {
      const x = -30 + (i % 4) * 44;
      const y = i < 4 ? -50 : -78;
      folders.push(rect(x - 18, y - 10, x + 18, y + 10, 1.5), rect(x - 18, y + 9, x - 4, y + 14, 1));
    }
    // the noise: slips scattered under the lamp and round it, and the request among them (the lighter stock)
    const slip = (x: number, y: number, a: number): Shape => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const p = (u: number, v: number): P2 => [x + u * c - v * s, y + u * s + v * c];
      return polyShape([p(-11, -5), p(11, -5), p(11, 5), p(-11, 5)]);
    };
    const noise = [
      [-30, 52, 0.4],
      [-8, 30, -0.3],
      [18, 58, 0.9],
      [40, 34, 0.15],
      [64, 62, -0.6],
      [88, 40, 0.5],
      [112, 64, -0.2],
      [-44, 22, 1.2],
      [128, 30, 0.8],
      [2, 70, -1.1],
    ].map(([x, y, a]) => slip(x!, y!, a!));
    return {
      lamp,
      folders: solid(folders, 0, R),
      noise: solid(noise, 0, R * 0.8),
      request: solid([slip(52, 44, -0.25)], 0, R * 1.2),
    };
  }, []);
}

function ActOneCard({ card }: { card: NonNullable<DeskState['e11']>['card'] & object }) {
  const play = useActOnePlay();
  const rm = useReliefMats();
  useLayoutEffect(() => () => Object.values(play).forEach((x) => x.dispose()), [play]);
  const { w, h } = cardSize(CARD_SPOT_11);
  return (
    <Counterfactual pose={cardPose(card, CARD_SPOT_11)} w={w} h={h} strike={0} inFrame={cardIn(card)}>
      {/* (the play is laid out on a 300 x 184 face: scaled to the card in plan, its relief kept) */}
      <group scale={[w / 300, h / 184, 1]}>
        <mesh geometry={play.folders} material={rm.dark} />
        <mesh geometry={play.noise} material={rm.dark} />
        <mesh geometry={play.request} material={rm.light} />
        <mesh geometry={play.lamp} material={rm.ink} />
      </group>
    </Counterfactual>
  );
}

// ------------------------------------------------------------------------------------------------
// The DOM text: the map key's words (11.2), beside their samples, dead still while they are read

/** The key's words: 36 px (a legend, quieter than the labels), EN in one column and zh in the next, each row on its sample. */
const KEY_TYPE = { size: 36, weight: 500, cjkWeight: 500 } as const;

/**
 * The key's words: they wipe in on the key-map cue (the plate settled under them since the cue's frame: beat11.ts
 * KEY_MOVE), never move, and fade out over 6 f before the bare plate slides back out (beat11.ts keyWordsAt).
 */
export function Beat11Text({ f }: { f: number; pose: CamPose }) {
  const { fonts, ready } = useFilmFonts();
  const r = cueReveal('key-map', f);
  const opacity = Math.min(r.opacity, keyWordsAt(f));
  if (!ready || !r.visible || opacity <= 0 || f >= KEY_MOVE.out) return null;
  const x0 = KEY_SCREEN.en - 8;
  const w = 1824 - x0 + 12;
  return (
    <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity }}>
      <defs>
        <clipPath id="wipe-key-map">
          <rect x={x0} y={0} width={w * r.wipe} height={1080} />
        </clipPath>
      </defs>
      <g clipPath="url(#wipe-key-map)">
        {KEY_WORDS.map((wd, i) => {
          const y = KEY_SCREEN.ys[i]! + 13;
          return (
            <g key={i}>
              <Label x={KEY_SCREEN.en} y={y} text={wd.en} family={fonts.sans} size={KEY_TYPE.size} weight={KEY_TYPE.weight} cjkWeight={KEY_TYPE.cjkWeight} color={TEXT_HEX.en} />
              <Label x={KEY_SCREEN.zh} y={y} text={wd['zh-Hans']} family={fonts.sans} size={KEY_TYPE.size} weight={KEY_TYPE.cjkWeight} cjkWeight={KEY_TYPE.cjkWeight} color={TEXT_HEX.zh} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
