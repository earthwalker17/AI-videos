/**
 * Beat 6.4, recall by ID across channels (STORYBOARD 6.4; desk/beat6.ts): the moving parts that are not the window's
 * (objects/Cache.tsx draws the new row and the request's Thread's row, objects/Register.tsx the reel's rewind and the
 * head's stamp).
 * - The review comment: the card feeder's punched card (84 x 50, its clipped corner), posted over the gate, up the belt
 *   into the throat on `review-card`, fed into the head and gone under it as it is stamped in on `review-in`.
 * - The reading thread: 2 px of graphite thread (about 1 u at the close) laid hop by hop, an arc each, from the new row
 *   to the request's stub, its Thread's row and down to its bay's last report; never a line of light.
 * - The "№" tabs: each hop's landing flips one up off the body it lands on (spring-dock), a paper index tab.
 * - The answer: two punched cells out of the head's slot, torn off on `recall-answer` and flown back west under the one
 *   transit light into the card feeder's mouth.
 */
import { useLayoutEffect, useMemo } from 'react';
import { CircleGeometry, PlaneGeometry, Shape, type BufferGeometry } from 'three';
import { DECODE, REVIEW, hopTargets } from '../beat6.ts';
import { extrude, tube } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import type { P3 } from '../layout.ts';
import type { DeskState } from '../state.ts';
import { PrintedSlip, usePunchedMats } from './Batch.tsx';

/** The card feeder's punched card (Dispatch.tsx ciGeometry's form): its clipped corner at its north-west, print UVs from its outline. */
function reviewGeometry(): BufferGeometry {
  const hl = REVIEW.l / 2;
  const hw = REVIEW.w / 2;
  const s = new Shape();
  s.moveTo(-hl + 9, hw);
  s.lineTo(hl, hw);
  s.lineTo(hl, -hw);
  s.lineTo(-hl, -hw);
  s.lineTo(-hl, hw - 9);
  s.closePath();
  const g = extrude(s, -0.4, 0.4, 0);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / REVIEW.l + 0.5, pos.getY(i) / REVIEW.w + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** A "№" tab (24 x 22 u): hinged on its south edge, flat on the body until its hop lands, then up to lean back at TAB_UP. */
const TAB = { w: 24, d: 22, up: 1.05 } as const;
/** The thread's radius (u): about 2 px at the close. */
const THREAD_R = 0.55;

function useRecallGeometry() {
  const g = useMemo(() => {
    const card = reviewGeometry();
    const tab = new PlaneGeometry(TAB.w, TAB.d).translate(0, TAB.d / 2, 0);
    const light = new CircleGeometry(3.4, 20);
    const answer = new PlaneGeometry(1, 1).translate(0, -0.5, 0);
    return { card, tab, light, answer };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of Object.values(g)) x.dispose();
    },
    [g],
  );
  return g;
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
  const tabMat = useMemo(() => paper(textures.b6.numberTab, HEX.paperLit), [textures]);
  useLayoutEffect(
    () => () => {
      cardMat.dispose();
      tabMat.dispose();
    },
    [cardMat, tabMat],
  );
  const answerMats = usePunchedMats('answer');
  const e = s.e6;
  const r = e.review;
  const T = hopTargets();
  return (
    <>
      {r && (
        <group position={r.p} rotation={[0, -r.slope, r.heading, 'ZYX']} scale={[1 + 0.015 * r.squash, 1, 1 - 0.03 * r.squash]}>
          <mesh geometry={g.card} material={cardMat} />
        </group>
      )}
      {e.thread && <Thread pts={e.thread.pts} />}
      {e.thread &&
        e.thread.tabs.map((k, i) =>
          k > 0 ? (
            // on the body the hop landed on: a hair to its south, flipping up about its south edge
            <group key={i} position={[T[i + 1][0], T[i + 1][1] - 4, T[i + 1][2] + 0.3]} rotation={[TAB.up * k, 0, 0]}>
              <mesh geometry={g.tab} material={tabMat} />
            </group>
          ) : null,
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
