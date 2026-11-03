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
