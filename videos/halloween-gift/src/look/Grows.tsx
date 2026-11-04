/**
 * Opts a subtree into the world's grow out of the page (look/materials.ts setGrow, film/beats.ts
 * GROW): every storybook material inside rises from the page plane on the pop sweep, the page's
 * own ground (`page`) flattens onto it but stays. Anything else inside fades in with `fade`
 * instead (the mist and smoke cards, the halos), or, opaque or with its own shader (the cottage's
 * room behind its door, the fireflies), appears once the page has grown (the material's own
 * `visible`, so no component's object visibility is touched). While it grows nothing in it casts
 * a shadow (the shadow pass does not see the grow). Outside a Grows nothing grows: the book,
 * the desk and the actors keep their shape. The opt-in is set on the materials each frame, so a
 * piece built later is caught too.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Group, Material, Mesh, ShaderMaterial } from 'three';
import { setGrow, type GrowSchedule } from './materials.ts';

interface SbMaterial extends Material {
  userData: { sb?: { uSbGrowOn?: { value: number } }; baseOpacity?: number };
}

/** Sets the grow's frame for the storybook materials (inside the 3D tree, so it lands before the frame is drawn). */
export function GrowClock({ f, schedule }: { f: number; schedule: GrowSchedule }) {
  useLayoutEffect(() => setGrow(f, schedule), [f, schedule]);
  return null;
}

export function Grows({ page = false, fade = 1, children }: { page?: boolean; fade?: number; children: ReactNode }) {
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
        else if (!m.transparent || (m as ShaderMaterial).isShaderMaterial) m.visible = fade >= 0.999;
        else {
          m.userData.baseOpacity ??= m.opacity;
          m.opacity = m.userData.baseOpacity * fade;
        }
      }
    });
  });
  return <group ref={ref}>{children}</group>;
}
