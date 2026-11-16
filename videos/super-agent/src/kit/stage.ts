/**
 * The stage: a small WebGL2 renderer for this film. It draws three kinds of mark in the order a
 * scene asks for them (signed-distance shapes, ribbons for lines, glyph quads from a type atlas)
 * into a linear half-float target, averages sub-frames for motion blur, then runs one post chain:
 * bloom on what is brighter than white, a tone curve, a vignette, dither and static grain.
 *
 * Nothing here reads a clock or keeps state between frames: a frame is a pure function of the
 * draw calls made for it.
 */
import { REF_H, REF_W, type Camera } from './camera.ts';
import { FINISH, type Rgb } from './look.ts';

const SHAPE_FLOATS = 26;
const GLYPH_FLOATS = 18;
const RIBBON_FLOATS = 17;

type Kind = 0 | 1 | 2; // shape, ribbon, glyph
interface Command {
  kind: Kind;
  world: boolean;
  start: number;
  count: number;
}

const VS_FULL = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const VS_SHAPE = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aO;
layout(location = 2) in vec3 aU;
layout(location = 3) in vec3 aV;
layout(location = 4) in vec2 aSize;
layout(location = 5) in vec4 aStyle;   // radius, stroke, feather, glow
layout(location = 6) in vec4 aColor;
layout(location = 7) in vec4 aMore;    // add, arc centre, arc half-width, pad
layout(location = 8) in vec3 aDash;    // period (radians), duty, phase
uniform mat4 uProj;
out vec2 vP;
flat out vec2 vSize;
flat out vec4 vStyle;
flat out vec4 vColor;
flat out vec4 vMore;
flat out vec3 vDash;
void main() {
  vec2 p = aCorner * (aSize + aMore.w);
  vP = p;
  vSize = aSize; vStyle = aStyle; vColor = aColor; vMore = aMore; vDash = aDash;
  gl_Position = uProj * vec4(aO + aU * p.x + aV * p.y, 1.0);
}`;

const FS_SHAPE = `#version 300 es
precision highp float;
in vec2 vP;
flat in vec2 vSize;
flat in vec4 vStyle;
flat in vec4 vColor;
flat in vec4 vMore;
flat in vec3 vDash;
out vec4 o;
const float PI = 3.14159265358979;
void main() {
  float r = min(vStyle.x, min(vSize.x, vSize.y));
  vec2 q = abs(vP) - (vSize - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  // the shape's own scale: local units per pixel
  float w = max(length(vec2(dFdx(d), dFdy(d))), 1e-5);
  if (vStyle.y > 0.0) d = abs(d + vStyle.y * 0.5) - vStyle.y * 0.5;
  float cov;
  if (vStyle.w > 0.0) {
    cov = exp(-max(d, 0.0) / vStyle.w);
  } else {
    float e = max(0.6 * w, vStyle.z);
    cov = 1.0 - smoothstep(-e, e, d);
  }
  if (vMore.z < 3.14) {
    float ang = atan(vP.y, vP.x);
    float da = abs(mod(ang - vMore.y + PI, 2.0 * PI) - PI);
    float aw = w / max(length(vP), 1e-3);
    cov *= 1.0 - smoothstep(vMore.z - aw, vMore.z + aw, da);
  }
  if (vDash.x > 0.0) {
    float ang = atan(vP.y, vP.x);
    float s = fract((ang + vDash.z) / vDash.x);
    float aw = w / max(length(vP), 1e-3) / vDash.x;
    cov *= smoothstep(0.0, aw, s) * (1.0 - smoothstep(vDash.y - aw, vDash.y, s));
  }
  float a = cov * vColor.a;
  o = vec4(vColor.rgb * a, a * (1.0 - vMore.x));
}`;

const VS_RIBBON = `#version 300 es
layout(location = 0) in vec4 aPos;     // x, y (reference px), across, along
layout(location = 1) in vec4 aGeom;    // half width, total length, feather, add
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec2 aTrim;
layout(location = 4) in vec3 aDash;    // period, duty, phase (px)
uniform mat4 uProj;
out vec2 vAl;
flat out vec4 vGeom;
flat out vec4 vColor;
flat out vec2 vTrim;
flat out vec3 vDash;
void main() {
  vAl = aPos.zw;
  vGeom = aGeom; vColor = aColor; vTrim = aTrim; vDash = aDash;
  gl_Position = uProj * vec4(aPos.xy, 0.0, 1.0);
}`;

const FS_RIBBON = `#version 300 es
precision highp float;
in vec2 vAl;
flat in vec4 vGeom;
flat in vec4 vColor;
flat in vec2 vTrim;
flat in vec3 vDash;
uniform float uPx;   // reference px per device pixel
out vec4 o;
void main() {
  float across = vAl.x;
  float along = vAl.y;
  float d;
  if (along < vTrim.x) d = length(vec2(along - vTrim.x, across));
  else if (along > vTrim.y) d = length(vec2(along - vTrim.y, across));
  else d = abs(across);
  d -= vGeom.x;
  float e = max(0.6 * uPx, vGeom.z);
  float cov = 1.0 - smoothstep(-e, e, d);
  if (vDash.x > 0.0) {
    float s = fract((along + vDash.z) / vDash.x);
    float aw = uPx / vDash.x;
    cov *= smoothstep(0.0, aw, s) * (1.0 - smoothstep(vDash.y - aw, vDash.y, s));
  }
  float a = cov * vColor.a;
  o = vec4(vColor.rgb * a, a * (1.0 - vGeom.w));
}`;

const VS_GLYPH = `#version 300 es
layout(location = 0) in vec2 aCorner;  // 0..1
layout(location = 1) in vec4 aRect;    // x, y, w, h in reference px
layout(location = 2) in vec4 aUv;      // u0, v0, u1, v1
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aClip;    // the part of the quad that is drawn, 0..1
layout(location = 5) in vec2 aMore;    // add, clip softness
uniform mat4 uProj;
out vec2 vUv;
out vec2 vQ;
flat out vec4 vColor;
flat out vec4 vClip;
flat out vec2 vMore;
void main() {
  vQ = aCorner;
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  vColor = aColor; vClip = aClip; vMore = aMore;
  gl_Position = uProj * vec4(aRect.xy + aRect.zw * aCorner, 0.0, 1.0);
}`;

const FS_GLYPH = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vQ;
flat in vec4 vColor;
flat in vec4 vClip;
flat in vec2 vMore;
uniform sampler2D uAtlas;
out vec4 o;
void main() {
  float a = texture(uAtlas, vUv).r;
  float s = max(vMore.y, 1e-4);
  vec2 lo = smoothstep(vClip.xy - s, vClip.xy + s, vQ);
  vec2 hi = 1.0 - smoothstep(vClip.zw - s, vClip.zw + s, vQ);
  a *= lo.x * lo.y * hi.x * hi.y * vColor.a;
  o = vec4(vColor.rgb * a, a * (1.0 - vMore.x));
}`;

const FS_GROUND = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uG0;
uniform vec3 uG1;
uniform vec4 uLift;   // centre x, y (0..1, top-left origin), radius x, radius y
uniform float uGain;
out vec4 o;
void main() {
  vec2 p = (vec2(vUv.x, 1.0 - vUv.y) - uLift.xy) / uLift.zw;
  float t = exp(-dot(p, p));
  o = vec4(mix(uG0, uG1, t) * uGain, 1.0);
}`;

const FS_COPY = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uWeight;
out vec4 o;
void main() { o = vec4(texture(uTex, vUv).rgb * uWeight, 1.0); }`;

// 13-tap downsample; the first pass keeps only what is brighter than the threshold
const FS_DOWN = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 o;
vec3 pick(vec2 uv) {
  vec3 c = texture(uTex, uv).rgb;
  if (uThreshold > 0.0) {
    float l = max(c.r, max(c.g, c.b));
    c *= max(l - uThreshold, 0.0) / max(l, 1e-4);
  }
  return c;
}
void main() {
  vec2 t = uTexel;
  vec3 a = pick(vUv + t * vec2(-2.0, -2.0));
  vec3 b = pick(vUv + t * vec2(0.0, -2.0));
  vec3 c = pick(vUv + t * vec2(2.0, -2.0));
  vec3 d = pick(vUv + t * vec2(-2.0, 0.0));
  vec3 e = pick(vUv);
  vec3 f = pick(vUv + t * vec2(2.0, 0.0));
  vec3 g = pick(vUv + t * vec2(-2.0, 2.0));
  vec3 h = pick(vUv + t * vec2(0.0, 2.0));
  vec3 i = pick(vUv + t * vec2(2.0, 2.0));
  vec3 j = pick(vUv + t * vec2(-1.0, -1.0));
  vec3 k = pick(vUv + t * vec2(1.0, -1.0));
  vec3 l = pick(vUv + t * vec2(-1.0, 1.0));
  vec3 m = pick(vUv + t * vec2(1.0, 1.0));
  vec3 s = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o = vec4(s, 1.0);
}`;

// 3x3 tent upsample, added to the level above
const FS_UP = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 o;
void main() {
  vec2 t = uTexel;
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += (texture(uTex, vUv + vec2(-t.x, 0.0)).rgb + texture(uTex, vUv + vec2(t.x, 0.0)).rgb + texture(uTex, vUv + vec2(0.0, -t.y)).rgb + texture(uTex, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  s += texture(uTex, vUv + vec2(-t.x, -t.y)).rgb + texture(uTex, vUv + vec2(t.x, -t.y)).rgb + texture(uTex, vUv + vec2(-t.x, t.y)).rgb + texture(uTex, vUv + vec2(t.x, t.y)).rgb;
  o = vec4(s / 16.0, 1.0);
}`;

const FS_FINAL = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomK;
uniform float uShoulder;
uniform float uVignette;
uniform float uGrain;
uniform float uFade;
out vec4 o;
uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16;
  return x;
}
float rnd(uvec2 p, uint k) { return float(hash(p.x + hash(p.y + hash(k))) >> 8) / 16777216.0; }
vec3 shoulder(vec3 c) {
  // identity below the shoulder, a smooth roll-off to 1 above it
  vec3 hi = uShoulder + (1.0 - uShoulder) * tanh((c - uShoulder) / (1.0 - uShoulder));
  return mix(c, hi, step(uShoulder, c));
}
vec3 encode(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomK;
  vec2 v = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(v, v) * 2.2);
  c = encode(shoulder(c * uFade));
  // static grain and dither: a triangular distribution, the same on every frame
  uvec2 px = uvec2(gl_FragCoord.xy);
  float n = rnd(px, 1u) + rnd(px, 2u) - 1.0;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += n * (0.6 + uGrain * (0.35 + 0.65 * (1.0 - lum))) / 255.0;
  o = vec4(c, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string, name: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`stage: ${name} shader: ${gl.getShaderInfoLog(s) ?? 'compile failed'}`);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`stage: ${name} program: ${gl.getProgramInfoLog(p) ?? 'link failed'}`);
  return p;
}

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export interface AtlasImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface GroundOptions {
  /** the corner and the centre of the lit ground, linear */
  colours: readonly [Rgb, Rgb];
  /** centre of the lift in reference px, and its radii */
  centre: readonly [number, number];
  radius: readonly [number, number];
  gain?: number;
}

export class Stage {
  readonly gl: WebGL2RenderingContext;
  /** device pixels per reference pixel */
  readonly u: number;
  private readonly progs: Record<'shape' | 'ribbon' | 'glyph' | 'ground' | 'copy' | 'down' | 'up' | 'final', WebGLProgram>;
  private readonly uni = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private readonly scene: Target;
  private readonly accum: Target;
  private readonly mips: Target[] = [];
  private readonly ups: Target[] = [];
  private readonly atlas: WebGLTexture;
  private readonly vaoFull: WebGLVertexArrayObject;
  private readonly vaoShape: WebGLVertexArrayObject;
  private readonly vaoRibbon: WebGLVertexArrayObject;
  private readonly vaoGlyph: WebGLVertexArrayObject;
  private readonly bufShape: WebGLBuffer;
  private readonly bufRibbon: WebGLBuffer;
  private readonly bufGlyph: WebGLBuffer;
  private shapes = new Float32Array(SHAPE_FLOATS * 2048);
  private ribbons = new Float32Array(RIBBON_FLOATS * 6 * 4096);
  private glyphs = new Float32Array(GLYPH_FLOATS * 2048);
  private nShape = 0;
  private nRibbon = 0;
  private nGlyph = 0;
  private commands: Command[] = [];
  private world = true;
  private camera: Camera | null = null;
  private readonly ortho: Float32Array;
  private subs = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly width: number,
    readonly height: number,
    atlas: AtlasImage,
  ) {
    canvas.width = width;
    canvas.height = height;
    // preserveDrawingBuffer: the page's 2D output canvas reads this one after present() returns
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('stage: WebGL2 is not available');
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('stage: half-float render targets are not available');
    this.gl = gl;
    this.u = height / REF_H;

    this.progs = {
      shape: compile(gl, VS_SHAPE, FS_SHAPE, 'shape'),
      ribbon: compile(gl, VS_RIBBON, FS_RIBBON, 'ribbon'),
      glyph: compile(gl, VS_GLYPH, FS_GLYPH, 'glyph'),
      ground: compile(gl, VS_FULL, FS_GROUND, 'ground'),
      copy: compile(gl, VS_FULL, FS_COPY, 'copy'),
      down: compile(gl, VS_FULL, FS_DOWN, 'down'),
      up: compile(gl, VS_FULL, FS_UP, 'up'),
      final: compile(gl, VS_FULL, FS_FINAL, 'final'),
    };

    this.scene = this.target(width, height);
    this.accum = this.target(width, height);
    let w = width;
    let h = height;
    for (let k = 0; k < 6; k++) {
      w = Math.max(2, Math.round(w / 2));
      h = Math.max(2, Math.round(h / 2));
      this.mips.push(this.target(w, h));
      this.ups.push(this.target(w, h));
    }

    // screen space: reference px, origin top left
    this.ortho = new Float32Array([2 / REF_W, 0, 0, 0, 0, -2 / REF_H, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);

    this.atlas = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlas.width, atlas.height, 0, gl.RED, gl.UNSIGNED_BYTE, atlas.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.vaoFull = gl.createVertexArray()!;

    const corners = (unit: boolean) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unit ? [0, 0, 1, 0, 0, 1, 1, 1] : [-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    };

    this.vaoShape = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoShape);
    corners(false);
    this.bufShape = gl.createBuffer()!;
    this.vaoRibbon = gl.createVertexArray()!;
    this.bufRibbon = gl.createBuffer()!;
    this.vaoGlyph = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoGlyph);
    corners(true);
    this.bufGlyph = gl.createBuffer()!;
    gl.bindVertexArray(null);
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('stage: a half-float framebuffer is incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, w, h };
  }

  private loc(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uni.get(p);
    if (!m) this.uni.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  // ── a frame ────────────────────────────────────────────────────────────────────────────────

  /** Start an output frame: the sub-frames that follow are averaged. */
  beginFrame(): void {
    const gl = this.gl;
    this.subs = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Start one sub-frame's draw list. Marks are drawn in call order. */
  beginSub(camera: Camera): void {
    this.camera = camera;
    this.nShape = this.nRibbon = this.nGlyph = 0;
    this.commands = [];
    this.world = true;
  }

  /** Marks that follow are in world space (the default) or in screen space (reference px). */
  space(world: boolean): void {
    this.world = world;
  }

  private cmd(kind: Kind, world: boolean, start: number, count: number): void {
    const last = this.commands[this.commands.length - 1];
    if (last && last.kind === kind && last.world === world && last.start + last.count === start) last.count += count;
    else this.commands.push({ kind, world, start, count });
  }

  /**
   * A signed-distance shape: a rounded box of half-size `size` around `o`, spanned by the unit
   * vectors `ux`, `vy` (world units, or reference px in screen space). `radius` rounds it into a
   * capsule or a disc, `stroke` > 0 draws its outline only, `feather` softens its edge, `glow` > 0
   * turns it into a halo that falls off outside the shape.
   */
  shape(o: readonly [number, number, number], ux: readonly [number, number, number], vy: readonly [number, number, number], size: readonly [number, number], radius: number, stroke: number, feather: number, glow: number, rgb: Rgb, alpha: number, add: number, arc: readonly [number, number] = [0, 4], dash: readonly [number, number, number] = [0, 0, 0]): void {
    if (alpha <= 0) return;
    if ((this.nShape + 1) * SHAPE_FLOATS > this.shapes.length) {
      const next = new Float32Array(this.shapes.length * 2);
      next.set(this.shapes);
      this.shapes = next;
    }
    const a = this.shapes;
    let k = this.nShape * SHAPE_FLOATS;
    a[k++] = o[0]; a[k++] = o[1]; a[k++] = o[2];
    a[k++] = ux[0]; a[k++] = ux[1]; a[k++] = ux[2];
    a[k++] = vy[0]; a[k++] = vy[1]; a[k++] = vy[2];
    a[k++] = size[0]; a[k++] = size[1];
    a[k++] = radius; a[k++] = stroke; a[k++] = feather; a[k++] = glow;
    a[k++] = rgb[0]; a[k++] = rgb[1]; a[k++] = rgb[2]; a[k++] = alpha;
    a[k++] = add; a[k++] = arc[0]; a[k++] = arc[1];
    // room around the shape for its soft edge or its halo
    a[k++] = glow > 0 ? glow * 6 : feather * 1.5 + 2 / Math.max(this.u, 0.25);
    a[k++] = dash[0]; a[k++] = dash[1]; a[k] = dash[2];
    this.cmd(0, this.world, this.nShape, 1);
    this.nShape++;
  }

  /**
   * A line through `pts` (reference px), `width` wide, with round ends. `trim` draws only the part
   * between two distances along it (for a line that draws on), `dash` = [period, duty, phase] px.
   */
  ribbon(pts: ReadonlyArray<readonly [number, number]>, width: number, feather: number, rgb: Rgb, alpha: number, add: number, trim?: readonly [number, number], dash: readonly [number, number, number] = [0, 0, 0]): void {
    const n = pts.length;
    if (n < 2 || alpha <= 0 || width <= 0) return;
    const hw = width / 2;
    const pad = hw + feather * 1.5 + 2 / Math.max(this.u, 0.25);
    // cumulative length
    const len = new Float64Array(n);
    for (let i = 1; i < n; i++) len[i] = len[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    const total = len[n - 1]!;
    if (total <= 0) return;
    const t0 = trim ? Math.max(0, trim[0]) : 0;
    const t1 = trim ? Math.min(total, trim[1]) : total;
    if (t1 <= t0) return;
    const need = (this.nRibbon + (n + 1) * 6) * RIBBON_FLOATS;
    if (need > this.ribbons.length) {
      const next = new Float32Array(Math.max(this.ribbons.length * 2, need));
      next.set(this.ribbons);
      this.ribbons = next;
    }
    // per point: the mitred offset direction and its length factor
    const ox = new Float64Array(n);
    const oy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(i - 1, 0)]!;
      const b = pts[i]!;
      const c = pts[Math.min(i + 1, n - 1)]!;
      let d0x = b[0] - a[0];
      let d0y = b[1] - a[1];
      let d1x = c[0] - b[0];
      let d1y = c[1] - b[1];
      const l0 = Math.hypot(d0x, d0y);
      const l1 = Math.hypot(d1x, d1y);
      if (l0 > 0) { d0x /= l0; d0y /= l0; }
      if (l1 > 0) { d1x /= l1; d1y /= l1; }
      if (l0 === 0) { d0x = d1x; d0y = d1y; }
      if (l1 === 0) { d1x = d0x; d1y = d0y; }
      let tx = d0x + d1x;
      let ty = d0y + d1y;
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-6) { tx = d0x; ty = d0y; } else { tx /= tl; ty /= tl; }
      // normal of the average tangent, lengthened so the ribbon keeps its width through the bend
      const cos = Math.max(tx * d0x + ty * d0y, 0.35);
      ox[i] = -ty / cos;
      oy[i] = tx / cos;
    }
    const a = this.ribbons;
    let k = this.nRibbon * RIBBON_FLOATS;
    const start = this.nRibbon;
    const vert = (x: number, y: number, across: number, along: number) => {
      a[k++] = x; a[k++] = y; a[k++] = across; a[k++] = along;
      a[k++] = hw; a[k++] = total; a[k++] = feather; a[k++] = add;
      a[k++] = rgb[0]; a[k++] = rgb[1]; a[k++] = rgb[2]; a[k++] = alpha;
      a[k++] = t0; a[k++] = t1;
      a[k++] = dash[0]; a[k++] = dash[1]; a[k++] = dash[2];
      this.nRibbon++;
    };
    const quad = (ax: number, ay: number, aox: number, aoy: number, al: number, bx: number, by: number, box: number, boy: number, bl: number) => {
      vert(ax + aox * pad, ay + aoy * pad, pad, al);
      vert(ax - aox * pad, ay - aoy * pad, -pad, al);
      vert(bx + box * pad, by + boy * pad, pad, bl);
      vert(bx + box * pad, by + boy * pad, pad, bl);
      vert(ax - aox * pad, ay - aoy * pad, -pad, al);
      vert(bx - box * pad, by - boy * pad, -pad, bl);
    };
    // a cap's worth of ribbon before the first point and after the last
    const f = pts[0]!;
    const g = pts[1]!;
    const fl = Math.hypot(g[0] - f[0], g[1] - f[1]) || 1;
    const fx = (g[0] - f[0]) / fl;
    const fy = (g[1] - f[1]) / fl;
    quad(f[0] - fx * pad, f[1] - fy * pad, -fy, fx, -pad, f[0], f[1], -fy, fx, 0);
    for (let i = 0; i + 1 < n; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      // the first and last points use their own segment's normal, so caps stay square to the line
      const pox = i === 0 ? -fy : ox[i]!;
      const poy = i === 0 ? fx : oy[i]!;
      let qox = ox[i + 1]!;
      let qoy = oy[i + 1]!;
      if (i + 1 === n - 1) {
        const ll = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        qox = -(q[1] - p[1]) / ll;
        qoy = (q[0] - p[0]) / ll;
      }
      quad(p[0], p[1], pox, poy, len[i]!, q[0], q[1], qox, qoy, len[i + 1]!);
    }
    const y = pts[n - 2]!;
    const z = pts[n - 1]!;
    const zl = Math.hypot(z[0] - y[0], z[1] - y[1]) || 1;
    const zx = (z[0] - y[0]) / zl;
    const zy = (z[1] - y[1]) / zl;
    quad(z[0], z[1], -zy, zx, total, z[0] + zx * pad, z[1] + zy * pad, -zy, zx, total + pad);
    this.cmd(1, false, start, this.nRibbon - start);
  }

  /** One glyph quad from the atlas, in reference px. `clip` is the part of the quad that shows. */
  glyph(x: number, y: number, w: number, h: number, uv: readonly [number, number, number, number], rgb: Rgb, alpha: number, add = 0, clip: readonly [number, number, number, number] = [-1, -1, 2, 2], soft = 0): void {
    if (alpha <= 0) return;
    if ((this.nGlyph + 1) * GLYPH_FLOATS > this.glyphs.length) {
      const next = new Float32Array(this.glyphs.length * 2);
      next.set(this.glyphs);
      this.glyphs = next;
    }
    const a = this.glyphs;
    let k = this.nGlyph * GLYPH_FLOATS;
    a[k++] = x; a[k++] = y; a[k++] = w; a[k++] = h;
    a[k++] = uv[0]; a[k++] = uv[1]; a[k++] = uv[2]; a[k++] = uv[3];
    a[k++] = rgb[0]; a[k++] = rgb[1]; a[k++] = rgb[2]; a[k++] = alpha;
    a[k++] = clip[0]; a[k++] = clip[1]; a[k++] = clip[2]; a[k++] = clip[3];
    a[k++] = add; a[k] = soft;
    this.cmd(2, false, this.nGlyph, 1);
    this.nGlyph++;
  }

  /** Draw the sub-frame's list over the ground and add it to the frame with `weight`. */
  endSub(ground: GroundOptions, weight: number): void {
    const gl = this.gl;
    const cam = this.camera;
    if (!cam) throw new Error('stage: endSub without beginSub');
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);

    // the ground
    let p = this.progs.ground;
    gl.useProgram(p);
    gl.uniform3fv(this.loc(p, 'uG0'), ground.colours[0] as unknown as number[]);
    gl.uniform3fv(this.loc(p, 'uG1'), ground.colours[1] as unknown as number[]);
    gl.uniform4f(this.loc(p, 'uLift'), ground.centre[0] / REF_W, ground.centre[1] / REF_H, ground.radius[0] / REF_W, ground.radius[1] / REF_H);
    gl.uniform1f(this.loc(p, 'uGain'), ground.gain ?? 1);
    gl.bindVertexArray(this.vaoFull);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the marks, in call order, premultiplied (alpha 0 with colour adds light)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const F = Float32Array.BYTES_PER_ELEMENT;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufShape);
    gl.bufferData(gl.ARRAY_BUFFER, this.shapes.subarray(0, this.nShape * SHAPE_FLOATS), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufRibbon);
    gl.bufferData(gl.ARRAY_BUFFER, this.ribbons.subarray(0, this.nRibbon * RIBBON_FLOATS), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlyph);
    gl.bufferData(gl.ARRAY_BUFFER, this.glyphs.subarray(0, this.nGlyph * GLYPH_FLOATS), gl.DYNAMIC_DRAW);

    const attr = (location: number, size: number, stride: number, offset: number, instanced: boolean) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * F, offset * F);
      gl.vertexAttribDivisor(location, instanced ? 1 : 0);
    };

    for (const c of this.commands) {
      if (c.kind === 0) {
        p = this.progs.shape;
        gl.useProgram(p);
        gl.uniformMatrix4fv(this.loc(p, 'uProj'), false, c.world ? cam.viewProj : this.ortho);
        gl.bindVertexArray(this.vaoShape);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufShape);
        const o = c.start * SHAPE_FLOATS;
        attr(1, 3, SHAPE_FLOATS, o, true);
        attr(2, 3, SHAPE_FLOATS, o + 3, true);
        attr(3, 3, SHAPE_FLOATS, o + 6, true);
        attr(4, 2, SHAPE_FLOATS, o + 9, true);
        attr(5, 4, SHAPE_FLOATS, o + 11, true);
        attr(6, 4, SHAPE_FLOATS, o + 15, true);
        attr(7, 4, SHAPE_FLOATS, o + 19, true);
        attr(8, 3, SHAPE_FLOATS, o + 23, true);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c.count);
      } else if (c.kind === 1) {
        p = this.progs.ribbon;
        gl.useProgram(p);
        gl.uniformMatrix4fv(this.loc(p, 'uProj'), false, this.ortho);
        gl.uniform1f(this.loc(p, 'uPx'), 1 / this.u);
        gl.bindVertexArray(this.vaoRibbon);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufRibbon);
        attr(0, 4, RIBBON_FLOATS, 0, false);
        attr(1, 4, RIBBON_FLOATS, 4, false);
        attr(2, 4, RIBBON_FLOATS, 8, false);
        attr(3, 2, RIBBON_FLOATS, 12, false);
        attr(4, 3, RIBBON_FLOATS, 14, false);
        gl.drawArrays(gl.TRIANGLES, c.start, c.count);
      } else {
        p = this.progs.glyph;
        gl.useProgram(p);
        gl.uniformMatrix4fv(this.loc(p, 'uProj'), false, this.ortho);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlas);
        gl.uniform1i(this.loc(p, 'uAtlas'), 0);
        gl.bindVertexArray(this.vaoGlyph);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlyph);
        const o = c.start * GLYPH_FLOATS;
        attr(1, 4, GLYPH_FLOATS, o, true);
        attr(2, 4, GLYPH_FLOATS, o + 4, true);
        attr(3, 4, GLYPH_FLOATS, o + 8, true);
        attr(4, 4, GLYPH_FLOATS, o + 12, true);
        attr(5, 2, GLYPH_FLOATS, o + 16, true);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c.count);
      }
    }
    gl.bindVertexArray(null);

    // add this sub-frame to the frame
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fbo);
    gl.blendFunc(gl.ONE, gl.ONE);
    p = this.progs.copy;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this.loc(p, 'uTex'), 0);
    gl.uniform1f(this.loc(p, 'uWeight'), weight);
    gl.bindVertexArray(this.vaoFull);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    this.subs++;
  }

  /** Bloom, tone, vignette and grain: the finished frame on the canvas. `fade` scales the light. */
  present(fade = 1, finish: { bloom?: number; grain?: number } = {}): void {
    const gl = this.gl;
    if (this.subs === 0) throw new Error('stage: present without a sub-frame');
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vaoFull);
    gl.activeTexture(gl.TEXTURE0);

    let p = this.progs.down;
    gl.useProgram(p);
    gl.uniform1i(this.loc(p, 'uTex'), 0);
    let src: Target = this.accum;
    for (let k = 0; k < this.mips.length; k++) {
      const dst = this.mips[k]!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(this.loc(p, 'uTexel'), 1 / src.w, 1 / src.h);
      gl.uniform1f(this.loc(p, 'uThreshold'), k === 0 ? FINISH.bloomThreshold : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    // back up the chain: each level is its own mip plus the blurred level below
    p = this.progs.up;
    gl.useProgram(p);
    gl.uniform1i(this.loc(p, 'uTex'), 0);
    let below: Target = this.mips[this.mips.length - 1]!;
    for (let k = this.mips.length - 2; k >= 0; k--) {
      const dst = this.ups[k]!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.disable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, below.tex);
      gl.uniform2f(this.loc(p, 'uTexel'), 1 / below.w, 1 / below.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // add this level's own mip
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const c = this.progs.copy;
      gl.useProgram(c);
      gl.bindTexture(gl.TEXTURE_2D, this.mips[k]!.tex);
      gl.uniform1i(this.loc(c, 'uTex'), 0);
      gl.uniform1f(this.loc(c, 'uWeight'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      gl.useProgram(p);
      below = dst;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    p = this.progs.final;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.accum.tex);
    gl.uniform1i(this.loc(p, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, below.tex);
    gl.uniform1i(this.loc(p, 'uBloom'), 1);
    // the chain sums six levels: bring it back to the strength of one
    gl.uniform1f(this.loc(p, 'uBloomK'), (finish.bloom ?? FINISH.bloomStrength) / this.mips.length);
    gl.uniform1f(this.loc(p, 'uShoulder'), FINISH.shoulder);
    gl.uniform1f(this.loc(p, 'uVignette'), FINISH.vignette);
    gl.uniform1f(this.loc(p, 'uGrain'), finish.grain ?? FINISH.grain);
    gl.uniform1f(this.loc(p, 'uFade'), fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
    // the 2D compositor reads the canvas next: make sure the frame is there
    gl.flush();
  }
}
