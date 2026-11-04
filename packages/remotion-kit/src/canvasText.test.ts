/**
 * The canvas-text helpers against a stand-in document (no browser): which context settings they
 * ask for, and that fillTextChecked refuses a face that is not loaded. Pixels are checked by
 * rendering (README.md, Canvas text).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillTextChecked, TEXT_CONTEXT, textCanvas, textContext } from './canvasText.ts';

interface FakeContext {
  font: string;
  drawn: unknown[][];
  fillText: (...a: unknown[]) => void;
  getContextAttributes: () => CanvasRenderingContext2DSettings;
}

/** A canvas that, like a real one, keeps the settings of its first getContext. */
function fakeCanvas() {
  let ctx: FakeContext | null = null;
  const asked: unknown[][] = [];
  return {
    width: 300,
    height: 150,
    asked,
    getContext(type: string, settings?: CanvasRenderingContext2DSettings) {
      asked.push([type, settings]);
      if (type !== '2d') return null;
      if (!ctx) {
        const drawn: unknown[][] = [];
        const willReadFrequently = settings?.willReadFrequently ?? false;
        ctx = { font: '10px sans-serif', drawn, fillText: (...a: unknown[]) => void drawn.push(a), getContextAttributes: () => ({ willReadFrequently }) };
      }
      return ctx;
    },
  };
}

function stubDocument(check: (font: string, text: string) => boolean) {
  const made: ReturnType<typeof fakeCanvas>[] = [];
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      expect(tag).toBe('canvas');
      const c = fakeCanvas();
      made.push(c);
      return c;
    },
    fonts: { check: vi.fn(check) },
  });
  return made;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('textCanvas', () => {
  it('sizes a new canvas and opens it as a CPU 2D canvas', () => {
    const made = stubDocument(() => true);
    const { c, g } = textCanvas(512, 220);
    expect(made).toHaveLength(1);
    expect(c).toBe(made[0]);
    expect([c.width, c.height]).toEqual([512, 220]);
    expect(made[0].asked).toEqual([['2d', { willReadFrequently: true }]]);
    expect(g.getContextAttributes().willReadFrequently).toBe(true);
    expect(TEXT_CONTEXT).toEqual({ willReadFrequently: true });
  });
});

describe('textContext', () => {
  it('opens an existing canvas as a CPU canvas', () => {
    const c = fakeCanvas();
    const g = textContext(c as unknown as HTMLCanvasElement);
    expect(c.asked).toEqual([['2d', { willReadFrequently: true }]]);
    expect(g.getContextAttributes().willReadFrequently).toBe(true);
  });

  it('refuses a canvas already opened as a GPU canvas', () => {
    const c = fakeCanvas();
    c.getContext('2d');
    expect(() => textContext(c as unknown as HTMLCanvasElement)).toThrow(/GPU 2D context/);
  });

  it('refuses a canvas that holds another kind of context', () => {
    const c = { getContext: () => null };
    expect(() => textContext(c as unknown as HTMLCanvasElement)).toThrow(/another kind/);
  });
});

describe('fillTextChecked', () => {
  it('draws when every face the font needs for the text is loaded', () => {
    stubDocument(() => true);
    const { g } = textCanvas(64, 64);
    g.font = '700 136px "AIV Noto Serif SC"';
    fillTextChecked(g, '代', 32, 40);
    fillTextChecked(g, '码', 32, 50, 60);
    expect(document.fonts.check).toHaveBeenNthCalledWith(1, '700 136px "AIV Noto Serif SC"', '代');
    expect((g as unknown as FakeContext).drawn).toEqual([
      ['代', 32, 40],
      ['码', 32, 50, 60],
    ]);
  });

  it('throws, without drawing, while a face is not loaded', () => {
    stubDocument((_font, text) => text !== '福');
    const { g } = textCanvas(64, 64);
    g.font = '900 287px "AIV Noto Serif SC"';
    expect(() => fillTextChecked(g, '福', 0, 0)).toThrow(/"福" in 900 287px "AIV Noto Serif SC": a face it needs is not loaded/);
    expect((g as unknown as FakeContext).drawn).toEqual([]);
  });
});
