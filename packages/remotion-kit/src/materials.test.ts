/**
 * patchMaterial's program cache key and injection, without a GL context: the key three would
 * use comes from `customProgramCacheKey()`, and the injection is run on the material's own
 * shader source as three hands it to `onBeforeCompile`.
 */
import { Color, Material, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { NOISE3_GLSL } from './glsl.ts';
import { materialPatchKey, patchMaterial, type MaterialPatch } from './materials.ts';

const SHARED = { uTime: { value: 0 } };
const tintPatch = (glsl: string): MaterialPatch => ({
  key: 'tint',
  uniforms: { ...SHARED, uTint: { value: new Color('#ff8800') } },
  vertex: { head: 'varying vec3 vWorld;\n', replace: { project_vertex: '#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;' } },
  fragment: { head: `uniform vec3 uTint;\nuniform float uTime;\nvarying vec3 vWorld;\n${NOISE3_GLSL}`, replace: { color_fragment: `#include <color_fragment>\n${glsl}` } },
});

const compile = (m: Material) => {
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} } as unknown as WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
};

describe('patchMaterial', () => {
  it('gives equal patches one stable key and one shared onBeforeCompile', () => {
    const glsl = 'diffuseColor.rgb *= uTint * aivFbm3(vWorld);';
    const a = patchMaterial(new MeshStandardMaterial(), tintPatch(glsl));
    const b = patchMaterial(new MeshStandardMaterial({ roughness: 0.3 }), tintPatch(glsl));
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(a.customProgramCacheKey()).toBe(materialPatchKey(tintPatch(glsl)));
    // a pure function of the patch's text: the same in every process (pinned)
    expect(a.customProgramCacheKey()).toMatch(/^tint:[0-9a-z]+:[0-9a-f]{8}$/);
    expect(materialPatchKey({ key: 'k', fragment: { head: 'float x;' } })).toBe('k:9:602d5117');
    expect(a.onBeforeCompile).toBe(b.onBeforeCompile);
    // uniform values are not part of the program
    (a as MeshStandardMaterial).color.set('#123456');
    SHARED.uTime.value = 3;
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
  });

  it('never lets two different patches share a program, even under one name', () => {
    const a = patchMaterial(new MeshStandardMaterial(), tintPatch('diffuseColor.rgb *= uTint;'));
    const b = patchMaterial(new MeshStandardMaterial(), tintPatch('diffuseColor.rgb += uTint;'));
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    // nor a head moved into a replacement, nor a vertex edit moved to the fragment shader
    expect(materialPatchKey({ key: 'k', vertex: { head: 'x' } })).not.toBe(materialPatchKey({ key: 'k', fragment: { head: 'x' } }));
    expect(materialPatchKey({ key: 'k', fragment: { head: 'a', replace: { c: 'b' } } })).not.toBe(materialPatchKey({ key: 'k', fragment: { head: 'ab', replace: { c: '' } } }));
  });

  it('injects the GLSL and the uniform objects on every compile', () => {
    const p = tintPatch('diffuseColor.rgb *= uTint;');
    const m = patchMaterial(new MeshStandardMaterial(), p);
    for (let i = 0; i < 2; i++) {
      const s = compile(m);
      expect(s.vertexShader.startsWith('varying vec3 vWorld;\n')).toBe(true);
      expect(s.vertexShader).toContain('#include <project_vertex>\nvWorld = (modelMatrix');
      expect(s.fragmentShader).toContain('#include <color_fragment>\ndiffuseColor.rgb *= uTint;');
      expect(s.fragmentShader).toContain('float aivFbm3(');
      // the very objects passed in: a value set once reaches every program
      expect(s.uniforms.uTime).toBe(SHARED.uTime);
      expect(s.uniforms.uTint).toBe(p.uniforms!.uTint);
    }
  });

  it('keeps a $ in GLSL literal and throws for a chunk the shader lacks or a foreign onBeforeCompile', () => {
    const m = patchMaterial(new MeshStandardMaterial(), { key: 'dollar', fragment: { replace: { color_fragment: '#include <color_fragment>\n// $& $1' } } });
    expect(compile(m).fragmentShader).toContain('// $& $1');
    const bad = patchMaterial(new MeshBasicMaterial(), { key: 'bad', fragment: { replace: { no_such_chunk: '' } } });
    expect(() => compile(bad)).toThrow(/'bad': the fragment shader has no #include <no_such_chunk>/);
    const own = new MeshStandardMaterial();
    own.onBeforeCompile = () => undefined;
    expect(() => patchMaterial(own, { key: 'x' })).toThrow(/onBeforeCompile of its own/);
    // patching a patched material again replaces its patch
    const again = patchMaterial(patchMaterial(new MeshStandardMaterial(), { key: 'one' }), { key: 'two' });
    expect(again.customProgramCacheKey()).toMatch(/^two:/);
  });

  it('leaves the defaults of unpatched materials alone', () => {
    const plain = new MeshStandardMaterial();
    expect(plain.onBeforeCompile).toBe(Material.prototype.onBeforeCompile);
    expect(plain.customProgramCacheKey()).toBe(Material.prototype.onBeforeCompile.toString());
  });
});
