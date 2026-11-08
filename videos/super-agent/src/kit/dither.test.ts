import { describe, expect, it } from 'vitest';
import { tilesFor } from './dither.tsx';

describe('tilesFor', () => {
  it('covers a region edge to edge, the last row and column cut by the region', () => {
    // 1080p: 256 composition px per tile
    const t = tilesFor(960, 1080, 256);
    expect(t.length).toBe(4 * 5);
    expect(t[0]).toEqual({ left: 0, top: 0 });
    expect(t[t.length - 1]).toEqual({ left: 768, top: 1024 });
    // draft (scale 0.5): a 256 px tile spans 512 composition px
    expect(tilesFor(960, 1080, 512)).toEqual([
      { left: 0, top: 0 },
      { left: 512, top: 0 },
      { left: 0, top: 512 },
      { left: 512, top: 512 },
      { left: 0, top: 1024 },
      { left: 512, top: 1024 },
    ]);
    expect(tilesFor(0, 100, 256)).toEqual([]);
  });
});
