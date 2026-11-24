/**
 * The film's real product captures (assets/ui, provenance in CREDITS.md) and how to show part of
 * one. Every capture is a still of MiniDSH 2.0.0 taken during the live takes on 2026-11-24.
 *
 * A capture is addressed in the UI's own CSS pixels: web stills are 1280x800 CSS px at 3x
 * (3840x2400), the desktop's content 1264x695 at 3x, its window (frame and menus) 1x. A `View`
 * shows a CSS rectangle of a capture at a screen centre and scale, so a push-in is a smaller
 * rectangle at a larger scale, and two stills of the same page at different scroll positions can
 * be lined up by their `scroll` offsets (the real UI scrolled between them).
 */
import type { Draw, ImageShadow, StageTexture, Vec2 } from '@aiv/web-kit';
import { THEME } from './look.ts';
import webStart from '../assets/ui/web-start-light.png?url';
import webTranscript from '../assets/ui/web-transcript-light.png?url';
import webDiff from '../assets/ui/web-diff-light.png?url';
import webDiffDark from '../assets/ui/web-diff-dark.png?url';
import webType1 from '../assets/ui/web-type-1-light.png?url';
import webType2 from '../assets/ui/web-type-2-light.png?url';
import webType3 from '../assets/ui/web-type-3-light.png?url';
import webType4 from '../assets/ui/web-type-4-light.png?url';
import webType4Dark from '../assets/ui/web-type-4-dark.png?url';
import webRun1 from '../assets/ui/web-run-01-light.png?url';
import webRun6 from '../assets/ui/web-run-06-light.png?url';
import webApproval from '../assets/ui/web-approval-1-light.png?url';
import webApprovalDark from '../assets/ui/web-approval-1-dark.png?url';
import webAllowed from '../assets/ui/web-allowed-1-light.png?url';
import webReceipt from '../assets/ui/web-receipt-light.png?url';
import webReceiptDark from '../assets/ui/web-receipt-dark.png?url';
import webFinal from '../assets/ui/web-final-light.png?url';
import deskReadyWindow from '../assets/ui/desk-ready-window.png?url';
import deskReady from '../assets/ui/desk-ready.png?url';
import deskModels from '../assets/ui/desk-models.png?url';
import deskRun from '../assets/ui/desk-run-01.png?url';
import deskBeforeQuitWindow from '../assets/ui/desk-before-quit-window.png?url';
import deskReopenedWindow from '../assets/ui/desk-reopened-window.png?url';
import deskSession from '../assets/ui/desk-session.png?url';
import deskSessionWindow from '../assets/ui/desk-session-window.png?url';

export interface Capture {
  url: string;
  /** capture pixels per CSS px */
  scale: number;
  /** the page's scroll offset, CSS px, relative to the take's other stills (aligns successive states) */
  scroll?: number;
}

/** Scroll offsets are measured from the transcript's diff block, recorded by the web take. */
export const CAPTURES = {
  webStart: { url: webStart, scale: 3 },
  webTranscript: { url: webTranscript, scale: 3 },
  webDiff: { url: webDiff, scale: 3, scroll: 0 },
  webDiffDark: { url: webDiffDark, scale: 3, scroll: 0 },
  webType1: { url: webType1, scale: 3, scroll: 0 },
  webType2: { url: webType2, scale: 3, scroll: 0 },
  webType3: { url: webType3, scale: 3, scroll: 0 },
  webType4: { url: webType4, scale: 3, scroll: 0 },
  webType4Dark: { url: webType4Dark, scale: 3, scroll: 0 },
  webRun1: { url: webRun1, scale: 3, scroll: 414 },
  webRun6: { url: webRun6, scale: 3, scroll: 716 },
  webApproval: { url: webApproval, scale: 3, scroll: 1011 },
  webApprovalDark: { url: webApprovalDark, scale: 3, scroll: 1011 },
  webAllowed: { url: webAllowed, scale: 3, scroll: 899 },
  webReceipt: { url: webReceipt, scale: 3, scroll: 1101 },
  webReceiptDark: { url: webReceiptDark, scale: 3, scroll: 1101 },
  webFinal: { url: webFinal, scale: 3 },
  deskReadyWindow: { url: deskReadyWindow, scale: 1 },
  deskReady: { url: deskReady, scale: 3 },
  deskModels: { url: deskModels, scale: 3 },
  deskRun: { url: deskRun, scale: 3 },
  deskBeforeQuitWindow: { url: deskBeforeQuitWindow, scale: 1 },
  deskReopenedWindow: { url: deskReopenedWindow, scale: 1 },
  deskSession: { url: deskSession, scale: 3 },
  deskSessionWindow: { url: deskSessionWindow, scale: 1 },
} as const satisfies Record<string, Capture>;
export type CaptureKey = keyof typeof CAPTURES;

/** The still to show for a key in the render's theme: its dark twin when the theme is dark and one exists. */
export function themed(k: CaptureKey): CaptureKey {
  if (THEME !== 'dark') return k;
  const dark = `${k}Dark` as CaptureKey;
  return dark in CAPTURES ? dark : k;
}

export const URLS = Object.fromEntries(Object.entries(CAPTURES).map(([k, c]) => [k, c.url])) as Record<CaptureKey, string>;

/** The web UI's own boxes (CSS px, viewport) recorded by the web take. */
export const BOX = {
  approvalCard: [437, 451, 677, 336],
  allowOnce: [999, 735, 98, 36],
  prompt: [437, 672, 677, 44],
  diff: [494, 197, 604, 318],
} as const;

/** A CSS rectangle [x, y, w, h] of a capture shown at a screen centre, `k` screen px per CSS px. */
export interface View {
  key: CaptureKey;
  rect: readonly [number, number, number, number];
  centre: Vec2;
  k: number;
}

/** Linear blend of two views (same capture geometry assumed): a camera move. */
export function mixView(a: View, b: View, t: number, key: CaptureKey = t < 0.5 ? a.key : b.key): View {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    key,
    rect: [m(a.rect[0], b.rect[0]), m(a.rect[1], b.rect[1]), m(a.rect[2], b.rect[2]), m(a.rect[3], b.rect[3])],
    centre: [m(a.centre[0], b.centre[0]), m(a.centre[1], b.centre[1])],
    k: m(a.k, b.k),
  };
}

/** The screen point of a CSS point of a view (for the cursor and for marks pinned to the UI). */
export function screenOf(v: View, x: number, y: number, scroll = 0): Vec2 {
  const cx = v.rect[0] + v.rect[2] / 2;
  const cy = v.rect[1] + v.rect[3] / 2;
  return [v.centre[0] + (x - cx) * v.k, v.centre[1] + (y - scroll - cy) * v.k];
}

export interface ShowOptions {
  /** another still to draw through this view's rectangle (default: the view's own) */
  key?: CaptureKey;
  opacity?: number;
  radius?: number;
  shadow?: ImageShadow | null;
  lodBias?: number;
  gain?: number;
  /** moves the rectangle down the still by this many CSS px (scrolling) */
  dy?: number;
}

const scrollOf = (k: CaptureKey): number => (CAPTURES[k] as Capture).scroll ?? 0;

/** Draws the view (a CSS rectangle of a still at a screen centre and scale). */
export function show(d: Draw<string>, tex: (k: CaptureKey) => StageTexture, v: View, o: ShowOptions = {}): void {
  const key = themed(o.key ?? v.key);
  const s = CAPTURES[key].scale;
  const crop = [v.rect[0] * s, (v.rect[1] + (o.dy ?? 0)) * s, v.rect[2] * s, v.rect[3] * s] as const;
  d.screenPane(v.centre, [(v.rect[2] * v.k) / 2, (v.rect[3] * v.k) / 2], tex(key), {
    crop,
    radius: o.radius ?? 0,
    opacity: o.opacity,
    shadow: o.shadow ?? null,
    lodBias: o.lodBias,
    gain: o.gain,
  });
}

/**
 * Two stills of the same page taken at different scroll positions, shown as the page scrolling
 * from the first to the second: at p the view looks at the document `p` of the way between their
 * scroll offsets, the first still fades out and the second in, both aligned on the document.
 * `v.rect` is in the SECOND still's coordinates (where the move ends).
 */
export function scrollBlend(d: Draw<string>, tex: (k: CaptureKey) => StageTexture, v: View, from: CaptureKey, to: CaptureKey, p: number, fade: number, o: ShowOptions = {}): void {
  const delta = scrollOf(to) - scrollOf(from);
  const a = Math.min(1, Math.max(0, fade));
  if (a < 1) show(d, tex, v, { ...o, key: from, dy: delta * p, opacity: o.opacity ?? 1 });
  if (a > 0) show(d, tex, v, { ...o, key: to, dy: -delta * (1 - p), opacity: (o.opacity ?? 1) * a, shadow: a < 1 ? null : o.shadow });
}
