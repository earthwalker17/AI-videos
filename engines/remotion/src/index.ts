// @aiv/engine-remotion — Node side: bundles a video's Remotion entry and renders its composition
// through the shared chunk runner (streaming PNG frames). Compositions import @aiv/remotion-kit,
// never this package (see ENGINE.md).
export { remotionAdapter, ADAPTER_VERSION, ENGINE_VERSION, ENGINE_INPUTS, type RemotionAdapterOptions } from './harness/adapter.ts';
export { headlessShell, installHeadlessShell, shellMissing, defaultGl, openRemotionBrowser, probeGpu, probeWebGl, driverVersion, REMOTION_VERSION, type GlChoice, type HeadlessShell, type ProbeResult, type WebGlInfo } from './harness/browser.ts';
export { bundleTarget, bundleKey, bundlesDir, readBundleManifest, moduleFiles, duplicatePackages, packageRoot, assertBundleFiles, SINGLE_INSTANCE, type BundleResult, type BundleManifest, type ModuleLike } from './harness/bundle.ts';
export { checkComposition, checkSwatchFrames, DEFAULT_COMPOSITION, type CompositionInfo } from './harness/composition.ts';
export { decodePng, firstTransparent, type DecodedPng } from './harness/png.ts';
