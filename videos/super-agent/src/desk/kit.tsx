/**
 * The Register Desk's materials and printed textures, made once per page (after the fonts are in)
 * and shared through a React context: every object draws with these instances, so the whole world
 * compiles to a handful of programs (gl/materials.ts).
 */
import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { PMREMGenerator, type Material, type MeshBasicMaterial, type MeshStandardMaterial, type Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BayId } from './layout.ts';
import { HEX, emitter, enamel, graphite, matte, paper, vellum, whiteTexture } from './gl/materials.ts';
import { makePrintTextures, type PrintTextures } from './gl/text.ts';
import { LIGHT_HEX } from './pools.ts';

export interface DeskMats {
  graphite: MeshStandardMaterial;
  graphiteDark: MeshStandardMaterial;
  graphiteDeck: MeshStandardMaterial;
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
  cordGraphite: MeshStandardMaterial;
  printed: {
    tape: MeshStandardMaterial;
    reelTop: MeshStandardMaterial;
    nameplate: Record<BayId, MeshStandardMaterial>;
    dossier: Record<BayId, MeshStandardMaterial>;
    policy: MeshStandardMaterial;
    lens: MeshStandardMaterial;
    fanfold: MeshStandardMaterial;
    fanfoldSide: MeshStandardMaterial;
    report: MeshStandardMaterial;
    galley: MeshStandardMaterial;
    spike: MeshStandardMaterial[];
    laptop: MeshStandardMaterial;
    reply: MeshStandardMaterial;
    inTray: MeshStandardMaterial[];
    chat: MeshStandardMaterial;
    card: MeshStandardMaterial;
    request: MeshStandardMaterial;
    folder: MeshStandardMaterial;
    gauge: MeshStandardMaterial;
    lockFace: MeshStandardMaterial;
    trait: MeshStandardMaterial;
  };
  vellumMail: MeshBasicMaterial;
  vellumCalendar: MeshBasicMaterial;
  /** the bug bay's work slot (computing: blooms) */
  slotBug: MeshBasicMaterial;
  /** the test tower's work slot (dimming) */
  slotTests: MeshBasicMaterial;
  /** the docs galley's work slot and lamp (clamped: no bloom) */
  slotDocs: MeshBasicMaterial;
  /** the one transit light (on the report card in flight) */
  transit: MeshBasicMaterial;
  /** your lamp's bulb (the only warm light; below the threshold in this frame) */
  bulb: MeshBasicMaterial;
  /** the Register's pilot jewel: lit, never blooming */
  jewel: MeshBasicMaterial;
  /** the dark inside of a slot or a hood */
  hollow: MeshBasicMaterial;
}

const DeskContext = createContext<DeskMats | null>(null);

export function useDeskMats(): DeskMats {
  const m = useContext(DeskContext);
  if (!m) throw new Error('desk: an object was drawn outside <DeskKit>');
  return m;
}

/** The emitters' levels (HDR: above 1.0 blooms). */
export const EMIT = { slot: 3.2, slotDocs: 0.9, transit: 4.0, bulbMax: 1.15, jewel: 0.85 } as const;

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

export function DeskKit({ printFamily, sansFamily, children }: { printFamily: string; sansFamily: string; children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const env = useEnamelEnv();
  const mats = useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const t: PrintTextures = makePrintTextures(printFamily, sansFamily, aniso);
    const white = whiteTexture();
    const P = (map: Texture, hex: string = HEX.paper, roughness = 0.9) => paper(map, hex, { roughness });
    const m: DeskMats = {
      // metals show (1 - metalness) of their albedo as diffuse: the albedos are lifted so the lit tops land on the palette's graphite
      graphite: graphite('#626764'),
      graphiteDark: graphite('#4A4E4C', { roughness: 0.5 }),
      graphiteDeck: graphite('#555957', { roughness: 0.46 }),
      steel: graphite('#A3A8A5', { metalness: 0.75, roughness: 0.3, brush: 0.03 }),
      rubber: matte('#262827', 0.75),
      enamel: enamel(white, env),
      enamelShade: enamel(white, env, HEX.enamelShade),
      paper: P(white),
      paperLit: P(white, HEX.paperLit),
      paperShade: P(white, HEX.paperShade),
      vermilionPaper: P(white, HEX.vermilion, 0.82),
      vermilionShade: P(white, HEX.vermilionShade, 0.85),
      cordVermilion: matte(HEX.vermilion, 0.55),
      cordGraphite: matte('#4A4E4C', 0.5, 0.3),
      printed: {
        tape: P(t.tape, HEX.paper),
        reelTop: P(t.reelTop, '#FFFFFF'),
        nameplate: { bug: enamel(t.nameplate.bug, env), tests: enamel(t.nameplate.tests, env), docs: enamel(t.nameplate.docs, env) },
        dossier: { bug: P(t.dossier.bug), tests: P(t.dossier.tests), docs: P(t.dossier.docs) },
        policy: P(t.policy, HEX.paper),
        lens: P(t.policy, HEX.paperLit, 0.35),
        fanfold: P(t.fanfold, HEX.paperShade),
        fanfoldSide: P(t.fanfoldSide, HEX.paperShade),
        report: P(t.report, HEX.paperLit),
        galley: P(t.galley, '#FFFFFF', 0.55),
        spike: t.spike.map((x) => P(x, HEX.paper)),
        laptop: P(t.laptop, '#FFFFFF', 0.3),
        reply: P(t.reply, HEX.paperLit),
        inTray: t.inTray.map((x) => P(x, HEX.paper)),
        chat: P(t.chat, HEX.paper),
        card: P(t.card, HEX.paper),
        request: P(t.request, HEX.vermilion, 0.82),
        folder: P(t.folder, HEX.vermilionShade, 0.85),
        gauge: enamel(t.gauge, env),
        lockFace: enamel(t.lockFace, env),
        trait: enamel(t.trait, env),
      },
      vellumMail: vellum(t.vellumMail),
      vellumCalendar: vellum(t.vellumCalendar),
      slotBug: emitter(LIGHT_HEX.work, EMIT.slot),
      slotTests: emitter(LIGHT_HEX.work, EMIT.slot),
      slotDocs: emitter(LIGHT_HEX.work, EMIT.slotDocs),
      transit: emitter(LIGHT_HEX.work, EMIT.transit),
      bulb: emitter(LIGHT_HEX.yours, EMIT.bulbMax),
      jewel: emitter('#F2EFE6', EMIT.jewel),
      hollow: emitter('#141615', 1),
    };
    return m;
  }, [gl, env, printFamily, sansFamily]);
  useLayoutEffect(
    () => () => {
      const seen = new Set<Material>();
      const walk = (v: unknown): void => {
        if (v && typeof v === 'object') {
          if ('isMaterial' in v) {
            const mat = v as Material & { map?: Texture | null };
            if (!seen.has(mat)) {
              seen.add(mat);
              mat.map?.dispose();
              mat.dispose();
            }
          } else for (const x of Object.values(v)) walk(x);
        }
      };
      walk(mats);
    },
    [mats],
  );
  return <DeskContext.Provider value={mats}>{children}</DeskContext.Provider>;
}
