# @aiv/web-kit

Deterministic building blocks for web-engine pages ([engines/web/ENGINE.md](../../engines/web/ENGINE.md)):
one WebGL2 stage, a CPU-canvas glyph atlas, a perspective camera in reference pixels, frame-grid
timing, colour helpers, a residency-capped loader for real UI captures, the test card and a
FontFace loader. All of it is frame code: the determinism lint applies.

Promoted from *Who Routes the Agents?* (`videos/super-agent/src/kit`, tag `video/super-agent/v2`)
when video #5 became its second user. The frozen film keeps its own copies. With no image on
screen, the stage computes what the film's stage did, to the byte: an image-free scene (shapes,
halos past the bloom threshold, ribbons, glyphs; one and three sub-frames, a fade, bloom and grain
overrides) hashed the same through the film's stage and this one (2026-11-24, ANGLE D3D11, Intel
UHD). The finish, the style table and the palette are now parameters. The kit has no default
look: every `Stage` is given its film's `Finish`.

## Modules

| File | What |
|---|---|
| `stage.ts` | `Stage(canvas, w, h, { atlas?, finish })`: shapes, ribbons, glyphs and images in call order into a linear half-float target, sub-frames averaged, then bloom, tone shoulder, vignette, dither and grain (`Finish`, required). |
| `images.ts` | `ImageBank` (fetch in setup), `Textures` (at most 4 resident, `need` per frame), `planResidency`. |
| `type.ts` | `Type<S>(styles, u)`: the atlas and `layout`; `packShelves`, `layoutText`, `fontSpecs`, `CHARS`. |
| `draw.ts` | `Draw<S, P extends { ink }>`: dots, halos, planes, lines, type, `pane` (world) and `screenPane`. |
| `camera.ts` | `Camera`, `mixPose`, `REF_W`/`REF_H` (1920x1080 reference px). |
| `batch.ts` | The stage's command list and its merge rule (`canMerge`). |
| `time.ts`, `color.ts`, `card.ts`, `fonts.ts` | `prog`, `gate`, `bump`, `settle`, `subframes`; `hex`, `mix`, `scale`; `drawTestCard`; `loadFaces`. |

## Images: real UI captures as panes

```ts
const bank = await ImageBank.load({ web: webUrl });            // in setup: fetch every file
const textures = new Textures(stage, bank, { cap: 4 });
// per frame
await textures.need(['web']);                                  // names this frame's images
stage.beginFrame();
stage.beginSub(cam);
draw.pane([0, 0, 0], [640, 400], textures.get('web'), { yaw: 7, radius: 14, crop, shadow, lodBias });
```

- **A mark like a shape.** It has a centre, unit U and V axes and a half-size, in world space (posed by
  the camera) or screen space. `crop` is in image pixels, so a push-in narrows the crop instead of
  scaling the pane. It also takes `opacity`, `gain`, a rounded-box clip with a soft edge, a Gaussian drop
  shadow (drawn just before the pane, never display-referred) and `lodBias` (a soft background pane).
- **Sampling.** Textures are SRGB8_ALPHA8 with a full mip chain. A magnified or 1:1 pixel takes one
  trilinear tap; 1:1 lands on texel centres. A minified pixel takes four rotated-grid taps, each one
  mip level sharper than a single tap would be.
- **Display-referred.** The scene target's alpha is a coverage mask. A display pane composites its
  coverage into it, and every other mark only occludes it (a separate alpha blend function). The final
  pass mixes the stage path (vignette, shoulder, grain) with a display path (clamped, no vignette, no
  shoulder, `displayGrain` of the grain) by that mask. A capture shown 1:1 comes out with its file's own
  8-bit values. The bloom's first pass weights each pixel by one minus the mask, so a pane never blooms,
  whatever the threshold or its `gain`; a stage glow still blooms over a pane.
- **Residency.** A frame names its images with `need`. Missing textures are decoded
  (`createImageBitmap`, `colorSpaceConversion: 'none'`, `premultiplyAlpha: 'none'`) and uploaded after
  evicting the least recently needed textures this frame does not use. A texture is a pure function of
  its file, so residency changes timing, never pixels. `need` names images for one frame (the one about
  to begin, or the one drawing), and `get` refuses an image the drawing frame did not name, even one an
  earlier frame named. A handle dies when its texture is evicted (`live` false) and the stage refuses to
  draw it. A page should set `warmupFrames` so the engine's purity probe crosses a change of capture
  (see `videos/minidsh-launch/src/lookdev/page.ts`).
- **Memory.** A texture takes width x height x 4 x 4/3 bytes: 21.8 MB for a 2560x1600 capture, 49.2 MB
  for a 3840x2400 one. An upload with its mips takes about 0.13-0.15 s for a 2560x1600 capture on the
  reference host.
