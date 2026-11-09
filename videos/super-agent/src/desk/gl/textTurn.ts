/**
 * The turn's own print (MT2, desk/turn.ts): the tape's first row as the print head stamps it, its ink
 * spreading over 3 f (gl/text.ts inkSpread: the strokes' cores first, then their full width, never an
 * alpha fade). The row is a mark (design D2: one ID chain, and this slip is not in it): the newest cell's
 * frame and the accepted chat slip's mark, as gl/text.ts prints the cell (its `tapeFirst`).
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import type { MeshStandardMaterial } from 'three';
import { CELLS_X, TAPE } from '../layout.ts';
import { HEX, paper } from './materials.ts';
import { INK, PRINT_SIZE, cargoMark, inkSpread, tooth, type Draw } from './text.ts';

/** The tape's paper under the ink: its tooth and its sprocket ticks (as the bare tape's). */
const tapePaper: Draw = (g) => {
  const [w, h] = PRINT_SIZE.tape;
  tooth(g, w, h);
  for (let x = 4; x < w; x += 9) {
    g.fillStyle = '#C9C4B8';
    g.fillRect(x, 1, 3, 1.6);
    g.fillRect(x, h - 2.6, 3, 1.6);
  }
};
/** The first row's ink: the newest cell's frame and the chat slip's mark, larger (as gl/text.ts tapeOf prints a mark-only cell). */
const firstRow: Draw = (g) => {
  const h = PRINT_SIZE.tape[1];
  const x = CELLS_X[0][0] - TAPE.x0;
  const w = CELLS_X[0][1] - CELLS_X[0][0];
  g.strokeStyle = INK;
  g.lineWidth = 2.2;
  g.strokeRect(x + 2, 4, w - 4, h - 8);
  g.save();
  g.translate(x + 14, 12);
  g.scale(1.6, 1.6);
  cargoMark(g, 'chat', 0, 0, INK);
  g.restore();
};

/** The tape's run during the turn once the row prints: its three ink stages, then printed (index by RegisterTape.ink). */
export function useTurnTape(printFamily: string): readonly MeshStandardMaterial[] {
  const gl = useThree((s) => s.gl);
  const mats = useMemo(() => {
    void printFamily;
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const stages = inkSpread(PRINT_SIZE.tape, aniso, tapePaper, firstRow);
    return [...stages, stages[2]].map((t) => paper(t, HEX.paper));
  }, [gl, printFamily]);
  useLayoutEffect(
    () => () => {
      for (const t of new Set(mats.map((m) => m.map))) t?.dispose();
      for (const m of mats) m.dispose();
    },
    [mats],
  );
  return mats;
}
