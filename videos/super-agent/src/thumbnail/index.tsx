/**
 * The thumbnail's Remotion entry (its own registerRoot, as src/lookdev/round2.tsx): composition 'Thumbnail' at the
 * video's exact format, one frame, the thumbnail (Thumbnail.tsx). Rebuild publish/thumbnail.jpg from the repo root:
 *   pnpm aiv still super-agent --entry src/thumbnail/index.tsx --composition Thumbnail --frames 0 --label s7-thumb-final
 *   ffmpeg -y -i out/super-agent/stills/s7-thumb-final/f00000.png -q:v 2 videos/super-agent/publish/thumbnail.jpg
 * The still is deterministic (a second render under another label gives the same sha256); the JPEG is 1920x1080,
 * 4:4:4 (no chroma loss on the vermilion), about 120 KB, under the repository's 2 MiB limit for committed binaries.
 */
import { Composition, registerRoot } from 'remotion';
import { FPS } from '../cues.ts';
import { Thumbnail } from './Thumbnail.tsx';

export function ThumbnailRoot() {
  return <Composition id="Thumbnail" component={Thumbnail} width={1920} height={1080} fps={FPS} durationInFrames={1} />;
}

registerRoot(ThumbnailRoot);
