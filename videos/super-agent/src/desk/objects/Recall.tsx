/**
 * Beat 6.4, recall by ID across channels (STORYBOARD 6.4; desk/beat6.ts): the moving parts that are not the window's
 * (objects/Cache.tsx draws the new row and the request's Thread's row, objects/Register.tsx the reel's rewind and the
 * head's stamp).
 * - The review comment: the card feeder's punched card (84 x 50, its clipped corner), posted over the gate, up the belt
 *   and hopping into the throat on `review-card`, fed under the head before it is stamped in on `review-in`.
 * - The reading thread: a graphite cord (about 4 px at the close) laid hop by hop, an arc each, from the new row to the
 *   request's stub, its Thread's row and, along the record's pointer, down to its bay's last report; a steel shuttle at
 *   its head while it hops; never a line of light.
 * - The "№" tabs: each hop's landing flips one up off the body it lands on (spring-dock), a paper index tab.
 * - The answer: two punched cells out of the head's slot, torn off on `recall-answer` and flown back west under the one
 *   transit light into the card feeder's mouth.
 */
import { useLayoutEffect, useMemo } from 'react';
import { CircleGeometry, PlaneGeometry, SphereGeometry } from 'three';
import { DECODE, tabSeats } from '../beat6.ts';
import { tube } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { Step, isStepped, useDeskMats, useDeskSets, useStepMode } from '../kit.tsx';
import type { P3 } from '../layout.ts';
import { CORD_FROM, type DeskState } from '../state.ts';
import { PrintedSlip, ciCardGeometry, usePunchedMats } from './Batch.tsx';

/** A "№" tab (24 x 22 u): hinged on its south edge, flat on the body until its hop lands, then up to lean back at TAB_UP. */
const TAB = { w: 24, d: 22, up: 1.05 } as const;
/** The thread's radius (u): a cord about 4 px across at the close (2.64 px/u), so it reads over the dark deck too; its shuttle's. */
const THREAD_R = 0.8;
const SHUTTLE_R = 1.9;

function useRecallGeometry() {
  const g = useMemo(() => {
    const card = ciCardGeometry();
    const shuttle = new SphereGeometry(SHUTTLE_R, 16, 10);
    const tab = new PlaneGeometry(TAB.w, TAB.d).translate(0, TAB.d / 2, 0);
    const light = new CircleGeometry(3.4, 20);
    const answer = new PlaneGeometry(1, 1).translate(0, -0.5, 0);
    return { card, tab, light, answer, shuttle };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of Object.values(g)) x.dispose();
    },
    [g],
  );
  return g;
}

/** The reading thread, its shuttle and its "№" tabs (their paper in the set they ride: kit.tsx useStepMode). */
function ReadingThread({ thread, g }: { thread: NonNullable<DeskState['e6']['thread']>; g: ReturnType<typeof useRecallGeometry> }) {
  const m = useDeskMats();
  const mode = useStepMode();
  const { textures } = useDeskSets();
  const tabMat = useMemo(() => paper(textures.b6.numberTab, HEX.paperLit, { stepped: mode }), [textures, mode]);
  useLayoutEffect(() => () => tabMat.dispose(), [tabMat]);
  const T = tabSeats();
  return (
    <>
      <Thread pts={thread.pts} />
      {thread.shuttle && <mesh geometry={g.shuttle} material={m.steel} position={thread.shuttle} />}
      {thread.tabs.map((k, i) =>
        k > 0 ? (
          // on the body the hop landed on (beat6.ts tabSeats), flipping up about its south edge
          <group key={i} position={T[i]} rotation={[TAB.up * k, 0, 0]}>
            <mesh geometry={g.tab} material={tabMat} />
          </group>
        ) : null,
      )}
    </>
  );
}

/** The thread's tube along the points it has reached (rebuilt only when they change). */
function Thread({ pts }: { pts: readonly P3[] }) {
  const m = useDeskMats();
  const key = pts.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(';');
  const geometry = useMemo(() => {
    void key;
    return pts.length >= 2 ? tube(pts, THREAD_R, Math.max(8, pts.length * 4), 6) : null;
  }, [key, pts]);
  useLayoutEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={m.graphite} />;
}

export function Recall({ s }: { s: DeskState }) {
  const g = useRecallGeometry();
  const m = useDeskMats();
  const { textures } = useDeskSets();
  const cardMat = useMemo(() => paper(textures.ciCard, HEX.paper), [textures]);
  useLayoutEffect(() => () => cardMat.dispose(), [cardMat]);
  const answerMats = usePunchedMats('answer');
  const e = s.e6;
  const r = e.review;
  return (
    <>
      {r && (
        <group position={r.p} rotation={[0, -r.slope, r.heading, 'ZYX']} scale={[1 + 0.015 * r.squash, 1, 1 - 0.03 * r.squash]}>
          <mesh geometry={g.card} material={cardMat} />
        </group>
      )}
      {e.thread && (
        // from part 2 the reading thread, its shuttle and its "№" tabs step with the Register's deck they lie on (its id
        // 'deck', on whichever set it rides); part 1 (signed off) drew them whole
        <Step on={s.f >= CORD_FROM ? isStepped(s.step, 'deck') : false}>
          <ReadingThread thread={e.thread} g={g} />
        </Step>
      )}
      {e.answer && (
        <>
          <PrintedSlip x={e.answer} mats={answerMats} geometry={g.answer} />
          {e.answer.free && e.transit > 0 && (
            <group position={e.answer.p} rotation={[-e.answer.pitch, 0, e.answer.yaw, 'ZXY']}>
              <mesh geometry={g.light} material={m.transit} position={[0, -DECODE.cell, 0.3]} />
            </group>
          )}
        </>
      )}
    </>
  );
}
