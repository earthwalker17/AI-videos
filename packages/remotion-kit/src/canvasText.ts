/**
 * Text drawn into a 2D canvas (a CanvasTexture, a DOM canvas) that rasters the same in every render.
 * Two things made such text vary from render to render on the same inputs (measured in
 * chrome-headless-shell 157.0.8080.0, ANGLE D3D11, under Remotion 4.0.539; README.md, Canvas text):
 *
 *  - **A face that is still loading.** A character whose face (a unicode-range subset file) has not
 *    loaded yet is drawn in a fallback font, and which files are in at the first draw differs from
 *    run to run. Draw only once useFont's `ready` is true. Under a Stage3D a redraw on `ready` never
 *    reaches the frame (R3F draws when the frame changes, not when state does), so the Stage3D is
 *    mounted only once the fonts are ready. fillTextChecked throws instead of drawing a fallback.
 *  - **A GPU canvas.** Chrome's default 2D canvas is GPU-accelerated, and it rasters large glyphs
 *    (from about 166 px; every font and weight from 200 px) a level or two differently from page to
 *    page. A CPU canvas (`willReadFrequently: true`) never varied: textCanvas and textContext give one.
 */

/** The 2D context settings for a canvas that gets text: a CPU canvas (Chrome rasters it in software). */
export const TEXT_CONTEXT: Readonly<CanvasRenderingContext2DSettings> = Object.freeze({ willReadFrequently: true });

/**
 * The CPU 2D context of a canvas that gets text (a DOM canvas, or one made by hand). A canvas keeps
 * the settings of its first getContext, so this throws for one already opened as a GPU canvas.
 */
export function textContext(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', TEXT_CONTEXT);
  if (!g) throw new Error('textContext: the canvas already holds another kind of context');
  if (g.getContextAttributes?.().willReadFrequently === false) {
    throw new Error('textContext: the canvas already has a GPU 2D context (getContext without willReadFrequently); give the text a canvas of its own, or open it with textContext first');
  }
  return g;
}

/** A new canvas of w × h with a CPU 2D context, for text (paper.ts-style `{ c, g }`). */
export function textCanvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: textContext(c) };
}

/**
 * g.fillText, after checking that every face `g.font` needs for `text` is loaded
 * (document.fonts.check): a face still loading would be drawn in a fallback font, so this throws
 * instead. Set `g.font` with the kit's family (useFont's `family`, INTER) before calling it. The
 * check passes a family with no registered face (a system font), so it guards the gate (draw only
 * once `ready`), it does not replace it.
 */
export function fillTextChecked(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number): void {
  if (!document.fonts.check(g.font, text)) {
    throw new Error(`canvas text ${JSON.stringify(text)} in ${g.font}: a face it needs is not loaded yet; draw text only once useFont's ready is true`);
  }
  if (maxWidth === undefined) g.fillText(text, x, y);
  else g.fillText(text, x, y, maxWidth);
}
