/**
 * The Register Desk's materials and printed textures, made once per page (after the fonts are in)
 * and shared through React context: every object draws with these instances, so the whole world
 * compiles to a handful of programs (gl/materials.ts).
 *
 * Two sets share one texture set: `full`, and `stepped` for what a beat's focus steps down (55%
 * contrast, 30% chroma; state.ts FOCUS_BEATS). The two use the same programs; only a shared step
 * uniform differs. Wrap an object in `<Step on>` to draw it with the stepped set.
 */
import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { PMREMGenerator, type Material, type MeshBasicMaterial, type MeshStandardMaterial, type Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { WorkerId } from './layout.ts';
import { HEX, STEP, STEP_LATE, emitter, enamel, graphite, matte, paper, stepColour, vellum, whiteTexture } from './gl/materials.ts';
import { makePrintTextures, type PrintTextures } from './gl/text.ts';
import { LIGHT_HEX } from './pools.ts';

export interface DeskMats {
  graphite: MeshStandardMaterial;
  graphiteDark: MeshStandardMaterial;
  graphiteDeck: MeshStandardMaterial;
  /** the bays' floors: matte, so the deck's shadow reads on them */
  floor: MeshStandardMaterial;
  steel: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  enamel: MeshStandardMaterial;
  enamelShade: MeshStandardMaterial;
  paper: MeshStandardMaterial;
  paperLit: MeshStandardMaterial;
  paperShade: MeshStandardMaterial;
  vermilionPaper: MeshStandardMaterial;
  vermilionShade: MeshStandardMaterial;
  cordVermilion: MeshStandardMaterial;
  screen: MeshStandardMaterial;
  printed: {
    tape: MeshStandardMaterial;
    tapeBefore: MeshStandardMaterial;
    reelTop: MeshStandardMaterial;
    nameplate: Record<WorkerId, MeshStandardMaterial>;
    dossier: Record<WorkerId, MeshStandardMaterial>;
    policy: MeshStandardMaterial;
    lens: MeshStandardMaterial;
    fanfold: MeshStandardMaterial;
    fanfoldSide: MeshStandardMaterial;
    report: MeshStandardMaterial;
    galley: MeshStandardMaterial;
    reply: MeshStandardMaterial;
    inTray: MeshStandardMaterial[];
    chat: MeshStandardMaterial;
    ciCard: MeshStandardMaterial;
    request: MeshStandardMaterial;
    folder: MeshStandardMaterial;
    gauge: MeshStandardMaterial;
    lockFace: MeshStandardMaterial;
    trait: MeshStandardMaterial;
    /** MT1's next dispatch (gl/text.ts) */
    tape2: MeshStandardMaterial;
    chatNext: MeshStandardMaterial;
    folderFresh: MeshStandardMaterial;
    /** still (c): the bare tape, the report card's face and the tab's face (the window's cards draw with their own materials) */
    tapeBlank: MeshStandardMaterial;
    cardC: MeshStandardMaterial;
    cardCBack: MeshStandardMaterial;
    /** the close shot's fine print, laid over the micro-print and cross-faded in (objects/Dispatch.tsx DeskUniforms sets the opacity) */
    fanfoldFine: MeshStandardMaterial;
    galleyFine: MeshStandardMaterial;
    dossierFine: Record<WorkerId, MeshStandardMaterial>;
  };
  /** the fresh bay's work slot (computing: blooms) */
  slotFresh: MeshBasicMaterial;
  vellumMail: MeshBasicMaterial;
  vellumCalendar: MeshBasicMaterial;
  /** the bug bay's work slot (computing: blooms) */
  slotBug: MeshBasicMaterial;
  /** the test tower's work slot (dimming) */
  slotTests: MeshBasicMaterial;
  /** the docs galley's work slot (clamped: no bloom) */
  slotDocs: MeshBasicMaterial;
  /** the one transit light (on the carrier in flight) */
  transit: MeshBasicMaterial;
  /** your lamp's bulb (the only warm light; below the threshold in this frame) */
  bulb: MeshBasicMaterial;
  /** the Register's pilot jewel: lit, never blooming */
  jewel: MeshBasicMaterial;
  /** the dark inside of a slot or a hood */
  hollow: MeshBasicMaterial;
}

interface DeskSets {
  full: DeskMats;
  stepped: DeskMats;
  /** a part that steps down on its own ramp (the test tower once it has reported) */
  late: DeskMats;
  /** parts on their own focus ramp inside a beat (state.ts `step.own`: the intake and the Slow Path in MT1) */
  own: DeskMats;
  /** the printed textures (objects that make their own materials, e.g. the window's cards in still (c)) */
  textures: PrintTextures;
}

const DeskContext = createContext<DeskSets | null>(null);
const StepContext = createContext<boolean | 'late' | 'own'>(false);

/** The materials for the object being drawn (the stepped set inside `<Step on>`). */
export function useDeskMats(): DeskMats {
  const sets = useContext(DeskContext);
  const stepped = useContext(StepContext);
  if (!sets) throw new Error('desk: an object was drawn outside <DeskKit>');
  return stepped === 'late' ? sets.late : stepped === 'own' ? sets.own : stepped ? sets.stepped : sets.full;
}

/** Both sets (an object stepped down as a whole may keep one live part at full: the bug bay's slot and request). */
export function useDeskSets(): DeskSets {
  const sets = useContext(DeskContext);
  if (!sets) throw new Error('desk: an object was drawn outside <DeskKit>');
  return sets;
}

/** Render with the materials of the enclosing set (inside `<Step>`, the stepped set). */
export function WithMats({ children }: { children: (m: DeskMats) => ReactNode }) {
  return <>{children(useDeskMats())}</>;
}

/** Whether a focus id is stepped down at this state ('own': on its own ramp, the `own` set). */
export const isStepped = (step: { amount: number; ids: readonly string[]; own?: { amount: number; ids: readonly string[] } }, id: string): boolean | 'own' =>
  step.own?.ids.includes(id) ? (step.own.amount > 0 ? 'own' : false) : step.amount > 0 && step.ids.includes(id);

/** Draw the children with the stepped-down set when `on` (a beat's focus leaves them out). */
export function Step({ on, children }: { on: boolean | 'late' | 'own'; children: ReactNode }) {
  return <StepContext.Provider value={on}>{children}</StepContext.Provider>;
}

/** The emitters' levels (HDR: above 1.0 blooms). */
export const EMIT = { slot: 9, slotDocs: 0.9, transit: 7, bulbMax: 1.1, jewel: 0.85 } as const;

/** The enamel's room light, prefiltered once (not scene.environment: only enamel reflects it). */
function useEnamelEnv(): Texture {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const t = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    return t;
  }, [gl]);
  useLayoutEffect(() => () => env.dispose(), [env]);
  return env;
}

/** A print laid over another and cross-faded in: transparent, its opacity set per frame. */
function fine<M extends MeshStandardMaterial>(m: M): M {
  m.transparent = true;
  m.opacity = 0;
  return m;
}

function buildSet(t: PrintTextures, env: Texture, white: Texture, stepped: boolean | 'late' | 'own'): DeskMats {
  const P = (map: Texture, hex: string = HEX.paper, roughness = 0.9) => paper(map, hex, { roughness, stepped });
  const E = (map: Texture, hex?: string) => enamel(map, env, hex, { stepped });
  const G = (hex: string, o: { roughness?: number; metalness?: number; brush?: number } = {}) => graphite(hex, { ...o, stepped });
  const em = (hex: string, k: number) => {
    const m = emitter(hex, k);
    if (stepped) m.color.copy(stepColour(m.color, 1));
    return m;
  };
  return {
    // metals show (1 - metalness) of their albedo as diffuse: the albedos are lifted so the lit tops land on the palette's graphite
    graphite: G('#626764'),
    graphiteDark: G('#4A4E4C', { roughness: 0.5 }),
    graphiteDeck: G('#555957', { roughness: 0.46 }),
    floor: matte('#3F4241', 0.8, 0, stepped),
    steel: G('#A3A8A5', { metalness: 0.75, roughness: 0.3, brush: 0.03 }),
    rubber: matte('#262827', 0.75, 0, stepped),
    enamel: E(white),
    enamelShade: E(white, HEX.enamelShade),
    paper: P(white),
    paperLit: P(white, HEX.paperLit),
    paperShade: P(white, HEX.paperShade),
    vermilionPaper: P(white, HEX.vermilion, 0.82),
    vermilionShade: P(white, HEX.vermilionShade, 0.85),
    cordVermilion: matte(HEX.vermilion, 0.55, 0, stepped),
    screen: matte('#202423', 0.25, 0, stepped),
    printed: {
      tape: P(t.tape, HEX.paper),
      tapeBefore: P(t.tapeBefore, HEX.paper),
      reelTop: P(t.reelTop, '#FFFFFF'),
      nameplate: { bug: E(t.nameplate.bug), tests: E(t.nameplate.tests), docs: E(t.nameplate.docs), fresh: E(t.nameplate.fresh) },
      dossier: { bug: P(t.dossier.bug), tests: P(t.dossier.tests), docs: P(t.dossier.docs), fresh: P(t.dossier.fresh) },
      policy: P(t.policy, HEX.paper),
      lens: P(t.policy, HEX.paperLit, 0.35),
      fanfold: P(t.fanfold, HEX.paper),
      fanfoldSide: P(t.fanfoldSide, HEX.paperShade),
      report: P(t.report, HEX.paperLit),
      galley: P(t.galley, HEX.paperLit),
      reply: P(t.reply, HEX.paperLit),
      inTray: t.inTray.map((x) => P(x, HEX.paper)),
      chat: P(t.chat, HEX.paper),
      ciCard: P(t.ciCard, HEX.paper),
      request: P(t.request, HEX.vermilion, 0.82),
      folder: P(t.folder, HEX.vermilionShade, 0.85),
      gauge: E(t.gauge),
      lockFace: E(t.lockFace),
      trait: E(t.trait),
      tape2: P(t.tape2, HEX.paper),
      chatNext: P(t.chatNext, HEX.paper),
      folderFresh: P(t.folderFresh, HEX.paper),
      tapeBlank: P(t.tapeBlank, HEX.paper),
      cardC: P(t.cardC, HEX.paperLit),
      cardCBack: P(t.cardCBack, HEX.paperLit),
      fanfoldFine: fine(P(t.fanfoldFine, HEX.paper)),
      galleyFine: fine(P(t.galleyFine, HEX.paperLit)),
      dossierFine: { bug: fine(P(t.dossierFine.bug)), tests: fine(P(t.dossierFine.tests)), docs: fine(P(t.dossierFine.docs)), fresh: fine(P(t.dossierFine.fresh)) },
    },
    slotFresh: em(LIGHT_HEX.work, EMIT.slot),
    vellumMail: vellum(t.vellumMail, stepped ? 0.6 : 1),
    vellumCalendar: vellum(t.vellumCalendar, stepped ? 0.6 : 1),
    slotBug: em(LIGHT_HEX.work, EMIT.slot),
    slotTests: em(LIGHT_HEX.work, EMIT.slot),
    slotDocs: em(LIGHT_HEX.work, EMIT.slotDocs),
    transit: em(LIGHT_HEX.work, EMIT.transit),
    bulb: em(LIGHT_HEX.yours, EMIT.bulbMax),
    jewel: em('#F2EFE6', EMIT.jewel),
    hollow: em('#141615', 1),
  };
}

export function DeskKit({ printFamily, sansFamily, step, stepLate = 0, children }: { printFamily: string; sansFamily: string; step: number; stepLate?: number; children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const env = useEnamelEnv();
  const sets = useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const t = makePrintTextures(printFamily, sansFamily, aniso);
    const white = whiteTexture();
    return { full: buildSet(t, env, white, false), stepped: buildSet(t, env, white, true), late: buildSet(t, env, white, 'late'), own: buildSet(t, env, white, 'own'), textures: t };
  }, [gl, env, printFamily, sansFamily]);
  // the stepped set's shared step amount, set before the frame is drawn
  useLayoutEffect(() => {
    STEP.stepped.value = step;
    STEP_LATE.value = stepLate;
  }, [step, stepLate]);
  useLayoutEffect(
    () => () => {
      const seen = new Set<unknown>();
      const walk = (v: unknown): void => {
        if (!v || typeof v !== 'object' || seen.has(v)) return;
        seen.add(v);
        if ('isTexture' in v) (v as Texture).dispose();
        else if ('isMaterial' in v) {
          const mat = v as Material & { map?: Texture | null };
          mat.map?.dispose();
          mat.dispose();
        } else for (const x of Object.values(v)) walk(x);
      };
      walk(sets);
    },
    [sets],
  );
  return <DeskContext.Provider value={sets}>{children}</DeskContext.Provider>;
}
