// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2); its second user is video #5.
/**
 * @aiv/web-kit: deterministic building blocks for web-engine pages. One WebGL2 stage (shapes,
 * ribbons, glyphs and images, composited in linear light, one post chain), a CPU-canvas glyph
 * atlas with its own layout, a perspective camera rig in reference pixels, frame-grid timing,
 * colour helpers, a residency-capped image loader for real UI captures, the test card and a
 * FontFace loader. Frame code: the determinism lint applies to all of it.
 */
export { CHARS, Type, fontSpecs, layoutText, packShelves, type Cell, type Glyph, type Layout, type Placed, type StyleTable, type TypeStyle } from './type.ts';
export { Camera, REF_H, REF_W, mixPose, type Pose, type Projected, type Vec2, type Vec3 } from './camera.ts';
export { Stage, type AtlasImage, type Finish, type GroundOptions, type ImageMark, type ImageShadow, type StageOptions, type StageTexture } from './stage.ts';
export { GLYPH, IMAGE, RIBBON, SHAPE, canMerge, pushCommand, type Command, type Kind } from './batch.ts';
export { DECODE, ImageBank, MAX_RESIDENT, Textures, mipLevels, planResidency, textureBytes, type FrameClock, type ResidencyPlan, type ResidentTexture, type TexturesOptions } from './images.ts';
export { Draw, paneAxes, type Align, type LineOptions, type MarkOptions, type PaneOptions, type Roles, type TextOptions } from './draw.ts';
export { bump, gate, prog, settle, subframes } from './time.ts';
export { hex, linearToSrgb, mix, scale, srgbToLinear, type Rgb } from './color.ts';
export { cardFonts, drawTestCard, type CardOptions, type Frame } from './card.ts';
export { loadFaces, type FaceSpec } from './fonts.ts';
