/**
 * Patch a built-in three material's shaders with GLSL of your own (`onBeforeCompile`), keyed so
 * that three never draws one patch with another's program.
 *
 * The pattern is *A Halloween Gift*'s storybook materials (`videos/halloween-gift/src/look/
 * materials.ts` at its release tag `video/halloween-gift/v1`), promoted for its second use
 * (video #4, docs/ARCHITECTURE.md decision 30). Only the pattern: the storybook look stays in
 * that film. The film keeps its own code.
 *
 * Why the cache key. three's WebGLRenderer shares one compiled GPU program between every material
 * whose program cache key is equal (r186 `WebGLPrograms.acquireProgram`). The key covers the
 * material's type, its `defines`, its render parameters and `customProgramCacheKey()`, whose
 * default is `onBeforeCompile.toString()`. A material's `onBeforeCompile` still runs, but its
 * edited source is thrown away when a program with that key exists. So two materials patched by
 * closures of one function, with different GLSL, get one key, and the second silently draws with
 * the first's shader: which one wins depends on which compiled first. `patchMaterial` keys each
 * patch by its name plus a hash of the GLSL it injects, so equal patches share one program and
 * different ones never do; three adds the `defines` itself, so variants switched by defines (the
 * film's paint kinds, its bump, wind and mask) get a program each.
 *
 * Why one module-level function. Every patched material gets the same `onBeforeCompile` (it
 * looks its patch up by material), never a closure of its own. It runs on every compile of the
 * material, the first and every recompile (a define changed, the lights changed), and assigns
 * the patch's uniform objects each time, so a recompile never strands a uniform: set `.value` on
 * the objects you passed in. A shared object (one module-scope uniform in many materials' patches)
 * is set once per frame and reaches every program.
 *
 * Determinism: the key is a pure function of the patch's text. `material.clone()` does not carry
 * the patch (three does not copy `onBeforeCompile`): patch the clone again.
 */
import { Material, type IUniform, type WebGLProgramParametersWithUniforms } from 'three';

/** One shader stage's edits. */
export interface ShaderPatch {
  /**
   * GLSL put before the whole shader: uniforms, varyings, attributes and functions. It comes
   * before three's own `#include <common>`, so it cannot use what that defines.
   */
  head?: string;
  /**
   * Chunk name (`'begin_vertex'`, `'color_fragment'`, …) to the GLSL that replaces its
   * `#include <name>` line, at its first occurrence. To keep the chunk, include it in your text
   * (`'#include <begin_vertex>\n…'`). A chunk the shader does not have throws at compile.
   */
  replace?: Readonly<Record<string, string>>;
}

export interface MaterialPatch {
  /** a readable name for the patch, the first part of its program cache key (`'sb:3'`) */
  key: string;
  /** uniform objects added to the program on every compile (shared objects stay shared) */
  uniforms?: Readonly<Record<string, IUniform>>;
  vertex?: ShaderPatch;
  fragment?: ShaderPatch;
}

const PATCHES = new WeakMap<Material, { patch: MaterialPatch; cacheKey: string }>();

/** FNV-1a (32 bit) of a string, as 8 hex digits: a pure function of its text. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The text a stage patch injects, in the order it is applied (the replacements' own order). */
function stageText(p: ShaderPatch | undefined): string {
  if (!p) return '';
  const rep = Object.entries(p.replace ?? {}).map(([name, text]) => `<${name}>${text}`);
  return [p.head ?? '', ...rep].join('\u0000');
}

/** The program cache key of a patch: its name, the injected text's length and its FNV-1a hash. */
export function materialPatchKey(patch: MaterialPatch): string {
  const text = `${stageText(patch.vertex)}\u0001${stageText(patch.fragment)}`;
  return `${patch.key}:${text.length.toString(36)}:${fnv1a(text)}`;
}

function applyStage(source: string, p: ShaderPatch | undefined, stage: string, key: string): string {
  if (!p) return source;
  let out = source;
  for (const [name, text] of Object.entries(p.replace ?? {})) {
    const include = `#include <${name}>`;
    if (!out.includes(include)) throw new Error(`patchMaterial '${key}': the ${stage} shader has no ${include}`);
    out = out.replace(include, () => text);
  }
  return (p.head ?? '') + out;
}

/** The one `onBeforeCompile` of every patched material (its patch is looked up by material). */
function inject(this: Material, shader: WebGLProgramParametersWithUniforms): void {
  const entry = PATCHES.get(this);
  if (!entry) return;
  const { patch } = entry;
  Object.assign(shader.uniforms, patch.uniforms ?? {});
  shader.vertexShader = applyStage(shader.vertexShader, patch.vertex, 'vertex', patch.key);
  shader.fragmentShader = applyStage(shader.fragmentShader, patch.fragment, 'fragment', patch.key);
}

/** The one `customProgramCacheKey` of every patched material. */
function cacheKey(this: Material): string {
  return PATCHES.get(this)?.cacheKey ?? Material.prototype.customProgramCacheKey.call(this);
}

/**
 * Patch `material`'s shaders (see the file comment for the program cache rules). Returns the
 * material. Patching it again replaces its patch (and its program, at its next compile: set
 * `needsUpdate` if it has drawn). Throws for a material with an `onBeforeCompile` of its own.
 */
export function patchMaterial<M extends Material>(material: M, patch: MaterialPatch): M {
  if (material.onBeforeCompile !== Material.prototype.onBeforeCompile && material.onBeforeCompile !== inject) throw new Error(`patchMaterial '${patch.key}': the material already has an onBeforeCompile of its own`);
  PATCHES.set(material, { patch, cacheKey: materialPatchKey(patch) });
  material.onBeforeCompile = inject;
  material.customProgramCacheKey = cacheKey;
  return material;
}
