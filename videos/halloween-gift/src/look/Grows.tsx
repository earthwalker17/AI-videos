/**
 * Opts a subtree into the world's grow out of the page (look/materials.ts setGrow, film/beats.ts
 * GROW): every storybook material inside rises from the page plane on the pop sweep, the page's
 * own ground (`page`) flattens onto it but stays. Anything else inside fades in with `fade`
 * instead (the mist and smoke cards, the halos), or, opaque or with its own shader (the cottage's
 * room behind its door, the fireflies), appears once the page has grown (the material's own
 * `visible`, so no component's object visibility is touched). While it grows nothing in it casts
 * a shadow (the shadow pass does not see the grow). Outside a Grows nothing grows: the book,
 * the desk and the actors keep their shape. The opt-in is set on the materials each frame, so a
 * piece built later is caught too. `hide` (0..1) takes those other pieces away again as the cover
 * closes (FoldClock folds only the storybook materials), without touching the shadows.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Group, Material, Mesh, ShaderMaterial } from 'three';
import { setFold, setGrow, type GrowSchedule } from './materials.ts';

interface SbMaterial extends Material {
  userData: { sb?: { uSbGrowOn?: { value: number } }; baseOpacity?: number };
}

/** Sets the grow's frame for the storybook materials (inside the 3D tree, so it lands before the frame is drawn). */
export function GrowClock({ f, schedule }: { f: number; schedule: GrowSchedule }) {
  useLayoutEffect(() => setGrow(f, schedule), [f, schedule]);
  return null;
}

/**
 * Sets the world's fold under the closing cover for the frame (film/beats.ts foldAt: tan of the
 * cover's angle, Infinity while it stands): the grown world squashes flat about the page, nearest
 * the hinge first, so nothing pokes through the cover as it comes down.
 */
export function FoldClock({ tan, hingeZ, floor, tallest }: { tan: number; hingeZ: number; floor: number; tallest: number }) {
  useLayoutEffect(() => setFold(tan, hingeZ, floor, tallest), [tan, hingeZ, floor, tallest]);
  return null;
}

export function Grows({ page = false, fade = 1, hide = 0, children }: { page?: boolean; fade?: number; hide?: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      const mat = (o as Mesh).material as SbMaterial | SbMaterial[] | undefined;
      if (!mat) return;
      o.userData.growCast ??= o.castShadow;
      o.castShadow = fade >= 0.999 ? (o.userData.growCast as boolean) : false;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        const on = m.userData.sb?.uSbGrowOn;
        if (on) on.value = page ? 2 : 1;
        else if (!m.transparent || (m as ShaderMaterial).isShaderMaterial) m.visible = fade >= 0.999 && hide <= 0.001;
        else {
          m.userData.baseOpacity ??= m.opacity;
          m.opacity = m.userData.baseOpacity * fade * (1 - hide);
        }
      }
    });
  });
  return <group ref={ref}>{children}</group>;
}
