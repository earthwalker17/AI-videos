/**
 * Lookdev entry, at the film's exact format:
 * - 'Probe': the 2D determinism probe (lookdev/ProbeScene.tsx), also film frames 0-299 of Main
 *   until the film replaces it;
 *     pnpm aiv still super-agent --entry src/lookdev/probe.tsx --composition Probe --frames 0,100,200
 * - 'Notes': every narration line in the notes block with its measured width (lookdev/NotesSheet.tsx).
 */
import { Composition, registerRoot } from 'remotion';
import { FPS } from '../cues.ts';
import { NOTES_SHEET_FRAMES, NotesSheet } from './NotesSheet.tsx';
import { PROBE_FRAMES, ProbeScene } from './ProbeScene.tsx';

export function ProbeRoot() {
  return (
    <>
      <Composition id="Probe" component={ProbeScene} width={1920} height={1080} fps={FPS} durationInFrames={PROBE_FRAMES} />
      <Composition id="Notes" component={NotesSheet} width={1920} height={1080} fps={FPS} durationInFrames={NOTES_SHEET_FRAMES} />
    </>
  );
}

registerRoot(ProbeRoot);
