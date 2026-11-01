// Fixture OUTSIDE the input roots, imported lazily by src/lazy.ts. With its helper it becomes a
// concatenated module in Remotion's production bundle: webpack drops this file's own module
// from the compilation's module list, so a check that reads only that list never sees it.
import { AbsoluteFill } from 'remotion';
import { tint } from './tint.ts';

export default function Lazy() {
  return <AbsoluteFill style={{ background: tint }} />;
}
