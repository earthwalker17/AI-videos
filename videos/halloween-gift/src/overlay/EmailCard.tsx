/**
 * The gift's face B: a parody of the account-suspension email people receive, made to be
 * recognised by its format — a warm off-white page, a rounded white card, a mark and a name at
 * the top, "Hello,", one paragraph with underlined links, "Regards" and a team sign-off — while
 * every element is our own (references/brand-parody.md): the mark is a Halloween starburst of
 * candy-corn rays round a tiny jack-o'-lantern (no Anthropic logo, hue shifted from #d97757),
 * the name is Clawd in the storybook serif, the wording is rewritten, the links lead nowhere.
 *
 * One layout table drives both renderings: the DOM card (crisp, over the frame) and the canvas
 * face printed on the 3D letter's slats, with the same explicit line breaks, so the crossfade
 * from the 3D letter to the DOM card lands on the same pixels.
 */
import type { CSSProperties } from 'react';

/** Card proportions (width / height) and the layout in fractions of the card height. */
export const EMAIL = {
  aspect: 1.28,
  pad: 0.075,
  page: '#f2eee4',
  card: '#fffdf8',
  border: '#e4ded1',
  ink: '#2c2925',
  body: '#3a3631',
  link: '#3a3631',
  mark: { top: 0.06, size: 0.12 },
  name: { size: 0.078 },
  hello: { top: 0.215, size: 0.05 },
  para: { top: 0.3, size: 0.05, lead: 1.42 },
  regards: { size: 0.05 },
  tab: { size: 0.045 },
  seal: { size: 0.26, right: 0.07, top: 0.05 },
} as const;

/** The paragraph's lines, broken by hand (DOM and canvas share them). `b` marks bold, `u` underlined. */
export type Run = { t: string; b?: boolean; u?: boolean };
export const PARAGRAPH: Run[][] = [
  [{ t: 'Our spirits have sensed suspicious signals' }],
  [{ t: 'haunting your account, against our ' }, { t: 'Trick-or-', u: true }],
  [{ t: 'Treat Policy', u: true }, { t: '. ' }, { t: 'Your Claude access is revoked.', b: true }],
  [],
  [{ t: 'To appeal, ' }, { t: 'knock three times', u: true }, { t: ' at midnight.' }],
  [{ t: 'Happy Halloween!', b: true }],
];
export const SIGN_OFF = ['Regards', 'The Safeguards Ghouls'];
/** The read path the cue sheet's hold measures (src/cues.ts WORDS.email): bold, big enough, short. */
export const READ_PATH = 'Hello, Your Claude access is revoked. Happy Halloween! Appeal';

// ---- the mark ---------------------------------------------------------------------------------

const CORN = ['#fff4d6', '#f19a2a', '#f7c548'] as const;

/** Our own Halloween mark as SVG markup data: eight candy-corn rays round a jack-o'-lantern. */
export function markPaths(): { rays: { d: string; fill: string }[]; face: { d: string; fill: string }[] } {
  const rays: { d: string; fill: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (i % 2 ? 0.12 : -0.05);
    const len = i % 2 ? 44 : 48;
    // a candy corn: three bands from the tip (white) through orange to the yellow base
    const band = (r0: number, r1: number, w0: number, w1: number) => {
      const p = (r: number, w: number) => [50 + Math.cos(a) * r - Math.sin(a) * w, 50 + Math.sin(a) * r + Math.cos(a) * w];
      const [a1, a2, b2, b1] = [p(r0, -w0), p(r0, w0), p(r1, w1), p(r1, -w1)];
      return `M${a1[0].toFixed(1)} ${a1[1].toFixed(1)}L${a2[0].toFixed(1)} ${a2[1].toFixed(1)}L${b2[0].toFixed(1)} ${b2[1].toFixed(1)}L${b1[0].toFixed(1)} ${b1[1].toFixed(1)}Z`;
    };
    const r0 = 22;
    const r3 = len;
    const r1 = r0 + (r3 - r0) * 0.38;
    const r2 = r0 + (r3 - r0) * 0.72;
    rays.push({ d: band(r0, r1, 8.6, 6.6), fill: CORN[2] });
    rays.push({ d: band(r1, r2, 6.6, 3.9), fill: CORN[1] });
    rays.push({ d: band(r2, r3, 3.9, 0.6), fill: CORN[0] });
  }
  const face = [
    { d: 'M50 30 C63 30 72 39 72 51 C72 63 63 71 50 71 C37 71 28 63 28 51 C28 39 37 30 50 30Z', fill: '#e8862e' },
    { d: 'M48 30 C48 25 51 22 55 21 L56 24 C53 25 52 27 52 30Z', fill: '#4a5a2a' },
    { d: 'M37 46 L44 42 L44 50Z M63 46 L56 42 L56 50Z', fill: '#2c1a10' },
    { d: 'M36 56 L41 59 L45 56 L50 60 L55 56 L59 59 L64 56 C61 64 56 67 50 67 C44 67 39 64 36 56Z', fill: '#2c1a10' },
  ];
  return { rays, face };
}

export function Mark({ size }: { size: number }) {
  const { rays, face } = markPaths();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      {rays.map((r, i) => (
        <path key={`r${i}`} d={r.d} fill={r.fill} />
      ))}
      {face.map((r, i) => (
        <path key={`f${i}`} d={r.d} fill={r.fill} />
      ))}
    </svg>
  );
}

// ---- the canvas card (face B of the 3D letter) ------------------------------------------------

export interface EmailDraw {
  /** the Appeal tab's offset in px of this canvas; null hides it */
  tab?: { dx: number; dy: number } | null;
  seal?: { scale: number; shake: number } | null;
}

/** A rounded rectangle path. */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * The alphabetic baseline of a line whose box starts at `top` and is `box` tall, in the current
 * font: CSS centres the font's content area (ascent + descent) in the line box. In canvas pixels
 * from the card's padding box (call it with the context translated by the border).
 */
function baseline(g: CanvasRenderingContext2D, top: number, box: number): number {
  const m = g.measureText('Hg');
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  // Chrome's layout snaps a line's baseline to a whole pixel
  return Math.round(top + (box - (asc + desc)) / 2 + asc);
}

/**
 * The same card drawn on a canvas of W × H (H = the card height, W = H × EMAIL.aspect), line for
 * line as the DOM card lays it out (the CSS line-box model on the alphabetic baseline), so the
 * crossfade from the 3D letter's face to the DOM card lands on the same pixels.
 */
export function drawEmailCard(g: CanvasRenderingContext2D, W: number, H: number, fonts: EmailFonts, o: EmailDraw = {}): void {
  const L = EMAIL;
  const px = (f: number) => f * H;
  const border = Math.max(1, px(0.003));
  // CSS places absolute children from the padding box, inside the border
  const left = border + px(L.pad);
  const lineH = px(L.para.size) * L.para.lead;
  const paraBottom = px(L.para.top) + PARAGRAPH.length * lineH;
  g.save();
  g.clearRect(0, 0, W, H);
  roundRect(g, border / 2, border / 2, W - border, H - border, px(0.035) - border / 2);
  g.fillStyle = L.card;
  g.fill();
  g.lineWidth = border;
  g.strokeStyle = L.border;
  g.stroke();
  g.translate(0, border);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  // the mark, then the name centred on it (the DOM's flex row: align-items centre, a gap)
  const ms = px(L.mark.size);
  const { rays, face } = markPaths();
  g.save();
  g.translate(left, px(L.mark.top));
  g.scale(ms / 100, ms / 100);
  for (const r of [...rays, ...face]) {
    g.fillStyle = r.fill;
    g.fill(new Path2D(r.d));
  }
  g.restore();
  const ns = px(L.name.size);
  g.fillStyle = L.ink;
  g.font = `400 ${ns}px ${fonts.serif}`;
  g.fillText('Clawd', left + ms + px(0.018), baseline(g, px(L.mark.top) + (ms - ns) / 2, ns));
  // a line of text: a div at `top` with lineHeight 1.2 of `size`
  g.fillStyle = L.body;
  const hs = px(L.hello.size);
  g.font = `400 ${hs}px ${fonts.sans}`;
  g.fillText('Hello,', left, baseline(g, px(L.hello.top), hs * 1.2));
  const ps = px(L.para.size);
  PARAGRAPH.forEach((runs, i) => {
    g.font = `400 ${ps}px ${fonts.sans}`;
    const y = baseline(g, px(L.para.top) + i * lineH, ps * 1.2);
    // runs in the same face are shaped as one text in the DOM (kerning across a span's edge, as
    // "y" + "."): a run starts where the shaped prefix up to its end, minus its own width, ends
    let x = left;
    let groupX = left;
    let prefix = '';
    let face: boolean | null = null;
    for (const r of runs) {
      const b = !!r.b;
      if (b !== face) {
        groupX = x;
        prefix = '';
        face = b;
      }
      g.font = `${b ? 700 : 400} ${ps}px ${fonts.sans}`;
      g.fillStyle = b ? L.ink : L.body;
      const w = g.measureText(r.t).width;
      const end = groupX + g.measureText(prefix + r.t).width;
      const x0 = end - w;
      g.fillText(r.t, x0, y);
      // text-underline-offset is measured from the alphabetic baseline
      if (r.u) g.fillRect(x0, y + px(0.008), w, Math.max(1, px(0.003)));
      prefix += r.t;
      x = end;
    }
  });
  g.fillStyle = L.body;
  const rs = px(L.regards.size);
  g.font = `400 ${rs}px ${fonts.sans}`;
  SIGN_OFF.forEach((t, i) => g.fillText(t, left, baseline(g, paraBottom + px(0.02) + i * lineH, rs * 1.2)));
  if (o.tab) {
    const fs = px(L.tab.size);
    g.font = `400 ${fs}px ${fonts.sans}`;
    const a = 'Appeal · ';
    const wa = g.measureText(a).width;
    const pw = px(0.032);
    const ph = px(0.014);
    const by = paraBottom + px(0.02) + o.tab.dy;
    const ty = baseline(g, by + ph, fs * 1.1);
    g.font = `400 ${fs}px ${fonts.cjk}`;
    const wb = g.measureText('申诉').width;
    const bw = wa + wb + 2 * pw;
    const bh = fs * 1.1 + 2 * ph;
    const bx = W - border - px(L.pad) + o.tab.dx - bw;
    roundRect(g, bx, by, bw, bh, px(0.016));
    g.fillStyle = '#2c2925';
    g.fill();
    g.fillStyle = '#fffdf8';
    g.font = `400 ${fs}px ${fonts.sans}`;
    g.fillText(a, bx + pw, ty);
    g.font = `400 ${fs}px ${fonts.cjk}`;
    g.fillText('申诉', bx + pw + wa, ty);
  }
  if (o.seal) {
    const sz = px(L.seal.size);
    const cx = W - border - px(L.seal.right) - sz / 2;
    const cy = px(L.seal.top) + o.seal.shake + sz / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate((8 * Math.PI) / 180);
    g.scale(o.seal.scale, o.seal.scale);
    g.globalCompositeOperation = 'multiply';
    roundRect(g, -sz / 2, -sz / 2, sz, sz, px(0.014));
    g.fillStyle = '#C8322A';
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff7f0';
    g.textAlign = 'center';
    const fs = sz * 0.4;
    g.font = `900 ${fs}px ${fonts.cjk}`;
    // a centred column of two rows, each lineHeight 1.05
    const rh = fs * 1.05;
    g.fillText('封', 0, baseline(g, -rh, rh));
    g.fillText('号', 0, baseline(g, 0, rh));
    g.restore();
  }
  g.restore();
}

// ---- the DOM card -----------------------------------------------------------------------------

export interface EmailFonts {
  serif: string;
  sans: string;
  cjk: string;
}

export interface EmailCardProps {
  /** card size in CSS px */
  width: number;
  height: number;
  fonts: EmailFonts;
  /** the Appeal tab's offset (px) as the bat carries it off; null hides it */
  tab?: { dx: number; dy: number } | null;
  /** the 封号 seal: null before it lands; scale (1.5 → 1 as it thunks), shake (px) */
  seal?: { scale: number; shake: number } | null;
  style?: CSSProperties;
}

export function EmailCard({ width: w, height: h, fonts, tab = { dx: 0, dy: 0 }, seal = null, style }: EmailCardProps) {
  const L = EMAIL;
  const px = (f: number) => f * h;
  const left = px(L.pad);
  const lineH = px(L.para.size) * L.para.lead;
  const paraBottom = px(L.para.top) + PARAGRAPH.length * lineH;
  return (
    <div style={{ position: 'absolute', width: w, height: h, background: L.card, borderRadius: px(0.035), border: `${Math.max(1, px(0.003))}px solid ${L.border}`, boxSizing: 'border-box', fontFamily: fonts.sans, color: L.body, boxShadow: `0 ${px(0.015)}px ${px(0.05)}px rgba(0,0,0,0.35)`, overflow: 'visible', ...style }}>
      <div style={{ position: 'absolute', left, top: px(L.mark.top), display: 'flex', alignItems: 'center', gap: px(0.018) }}>
        <Mark size={px(L.mark.size)} />
        <div style={{ fontFamily: fonts.serif, fontSize: px(L.name.size), color: L.ink, lineHeight: 1, letterSpacing: '0.005em' }}>Clawd</div>
      </div>
      <div style={{ position: 'absolute', left, top: px(L.hello.top), fontSize: px(L.hello.size), lineHeight: 1.2 }}>Hello,</div>
      {PARAGRAPH.map((line, i) => (
        <div key={i} style={{ position: 'absolute', left, top: px(L.para.top) + i * lineH, fontSize: px(L.para.size), lineHeight: 1.2, whiteSpace: 'pre' }}>
          {line.map((r, k) => (
            <span key={k} style={{ fontWeight: r.b ? 700 : 400, color: r.b ? L.ink : L.body, textDecoration: r.u ? 'underline' : 'none', textUnderlineOffset: px(0.008), textDecorationThickness: Math.max(1, px(0.003)) }}>
              {r.t}
            </span>
          ))}
        </div>
      ))}
      {SIGN_OFF.map((t, i) => (
        <div key={t} style={{ position: 'absolute', left, top: paraBottom + px(0.02) + i * lineH, fontSize: px(L.regards.size), lineHeight: 1.2 }}>
          {t}
        </div>
      ))}
      {tab && (
        <div style={{ position: 'absolute', right: px(L.pad) - tab.dx, top: paraBottom + px(0.02) + tab.dy, padding: `${px(0.014)}px ${px(0.032)}px`, borderRadius: px(0.016), background: '#2c2925', color: '#fffdf8', fontSize: px(L.tab.size), lineHeight: 1.1 }}>
          Appeal · <span style={{ fontFamily: fonts.cjk }}>申诉</span>
        </div>
      )}
      {seal && (
        <div style={{ position: 'absolute', right: px(L.seal.right), top: px(L.seal.top) + seal.shake, width: px(L.seal.size), height: px(L.seal.size), background: '#C8322A', color: '#fff7f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `rotate(8deg) scale(${seal.scale})`, fontFamily: fonts.cjk, fontSize: px(L.seal.size) * 0.4, fontWeight: 900, lineHeight: 1.05, borderRadius: px(0.014), boxShadow: `0 ${px(0.008)}px ${px(0.02)}px rgba(60,0,0,0.35)`, mixBlendMode: 'multiply' }}>
          <span>封</span>
          <span>号</span>
        </div>
      )}
    </div>
  );
}
