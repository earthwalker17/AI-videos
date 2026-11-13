import { describe, expect, it } from 'vitest';
import { BEAT_8, WORDS, at, cue, textWindow } from '../cues.ts';
import { cameraAt, project } from './camera.ts';
import {
  PROACTIVE_MARK,
  proactiveMarkAt,
  BAND,
  BRACKET,
  CARRIAGE_PARK,
  CAVEAT,
  CLAMP,
  DIE,
  DIE_REST,
  ONE_PASS,
  E8,
  FOCUS_8,
  HOLE_R,
  K,
  LANE_EM,
  LANES8,
  LEGEND,
  LONG_RUN,
  NAME_U,
  NOTCH,
  ORIGIN_U,
  RAIL,
  SECTION_RULE,
  SHEET8,
  SHEET_H,
  SHEET_W,
  STACKS8,
  STAMPS8,
  TAGS_8,
  TICKS,
  TOKENS,
  bandFed,
  beat8At,
  carriageAt,
  chadsAt,
  dieAt,
  footprints8,
  holeAt,
  inkStage,
  notchU,
  notchesPunched,
  onSheet,
  sheetDx,
  stackFront,
  stackSheetReach,
  stampAt,
  stampStepAt,
  stripFed,
  stripLength,
  tickFrac,
  tickFrame,
  tickU,
  ticksPrinted,
} from './beat8.ts';
import { deskStateAt, stepAt } from './state.ts';
import { PROACTIVE_PLATE, rectC } from './layout.ts';
import { SAFE } from '../look/tokens.ts';
import { hasHan } from '../look/zhInPicture.ts';
import { SHEET_TEXT } from './gl/print8.ts';
import { INK } from './gl/text.ts';
import { TAG_MID, TEXT_HEX, leaderOnPaper, tagLayout } from './Overlay.tsx';

const L = BEAT_8.lanes;
const sheet = cameraAt(at(52), 15);
/** Pixels a unit east-west (or north-south) at a sheet point, through the sheet's framing (a word's em on screen). */
const pxPerU = (u: number, v: number, dir: 'h' | 'v' = 'h'): number => {
  const [x, y] = onSheet(u, v);
  const a = project(sheet, [x, y, SHEET8.z]);
  const b = project(sheet, dir === 'h' ? [x + 100, y, SHEET8.z] : [x, y - 100, SHEET8.z]);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100;
};
const screen = (u: number, v: number, f = at(52)) => {
  const [x, y] = onSheet(u, v, f === at(52) ? 0 : sheetDx(f));
  return project(cameraAt(f, 15), [x, y, SHEET8.z]);
};

describe('beat 8: the load line', () => {
  it('prints exactly 300 ticks, 20 of them inked, in two rows each at a pitch of 4 u or more', () => {
    expect(BEAT_8.ticks.n).toBe(300);
    expect(new Set(BEAT_8.ticks.inked).size).toBe(20);
    for (const i of BEAT_8.ticks.inked) expect(i >= 0 && i < 300).toBe(true);
    expect(2 * TICKS.pitch).toBeGreaterThanOrEqual(4);
    expect(tickU(299)).toBeLessThan(SHEET_W - 40);
    // the inked ones are 3 px or more wide on screen; the faint ones each their own length (a rain, never a ruler's graduations)
    expect(TICKS.inkedW * pxPerU(tickU(150), TICKS.inked[0])).toBeGreaterThanOrEqual(2.9);
    const fracs = Array.from({ length: 300 }, (_, i) => tickFrac(i));
    expect(Math.min(...fracs)).toBeGreaterThanOrEqual(0.45);
    expect(Math.max(...fracs)).toBeLessThanOrEqual(1);
    expect(new Set(fracs.map((x) => x.toFixed(2))).size).toBeGreaterThan(30);
  });
  it('lands every tick on its frame of the score’s rain, the last by ticks.to, the carriage’s head over each as it prints', () => {
    const { from, to, n } = BEAT_8.ticks;
    expect(ticksPrinted(from - 1)).toBe(0);
    expect(ticksPrinted(from)).toBe(1);
    expect(ticksPrinted(to)).toBe(n);
    for (let i = 0; i < n; i++) {
      const f = tickFrame(i);
      expect(f >= from + ((to - from) * i) / n - 1e-9 && f < from + ((to - from) * i) / n + 1).toBe(true);
      expect(ticksPrinted(f), `tick ${i}`).toBeGreaterThan(i);
      expect(ticksPrinted(f - 1), `tick ${i}`).toBeLessThanOrEqual(i);
      expect(Math.abs(carriageAt(from + ((to - from) * i) / n) - tickU(i)), `tick ${i}`).toBeLessThan(1e-6);
    }
  });
  it('moves the carriage continuously: at rest, gathering speed, the row’s pace, slowing, parked (never faster than the pace)', () => {
    const pace = (TICKS.pitch * BEAT_8.ticks.n) / (BEAT_8.ticks.to - BEAT_8.ticks.from);
    for (let f = E8.from; f < E8.until; f++) expect(Math.abs(carriageAt(f + 1) - carriageAt(f)), `f${f}`).toBeLessThanOrEqual(pace + 1e-9);
    expect(carriageAt(E8.from)).toBe(carriageAt(BEAT_8.ticks.from - E8.rampIn));
    expect(carriageAt(BEAT_8.ticks.to + E8.rampOut + 1)).toBeCloseTo(CARRIAGE_PARK, 9);
    expect(CARRIAGE_PARK + 22).toBeLessThan(RAIL.posts[1][0]);
  });
});

describe('beat 8: the lanes', () => {
  it('slides each strip for exactly stripFrames x its p95 frames at one pace, so its length is its slowest run on one scale', () => {
    L.forEach((l, i) => {
      const end = l.slide + l.p95 * BEAT_8.stripFrames;
      expect(stripFed(i, l.slide)).toBe(0);
      expect(stripFed(i, l.slide + 1)).toBeCloseTo(K / BEAT_8.stripFrames, 9);
      expect(stripFed(i, Math.ceil(end) - 1)).toBeLessThan(stripLength(i));
      expect(stripFed(i, Math.ceil(end))).toBeCloseTo(stripLength(i), 9);
      expect(stripLength(i)).toBeCloseTo(K * l.p95, 9);
      expect(holeAt(i)).toBeCloseTo(K * l.p50, 9);
    });
    // every cut is out before "~½" inks
    for (let i = 0; i < 3; i++) expect(stripFed(i, stampAt('half') - 1)).toBeCloseTo(stripLength(i), 9);
  });
  it('keeps the article’s ratios (FACTS.md): the tail halves, the typical run ~10% against the stronger baseline, 2-4x the tokens', () => {
    expect(L[2].p95 / L[0].p95).toBeCloseTo(0.53, 2);
    expect(L[2].p95 / L[1].p95).toBeCloseTo(0.54, 2);
    expect((L[1].p50 - L[2].p50) / L[1].p50).toBeCloseTo(0.1, 2);
    expect(L[2].tokens / L[1].tokens).toBeCloseTo(2.1, 1);
    expect(L[2].tokens / L[0].tokens).toBeCloseTo(3.8, 1);
    STACKS8.forEach((s, i) => expect(s.extent / STACKS8[2]!.extent).toBeCloseTo(L[i]!.tokens / L[2]!.tokens, 9));
  });
  it('sets each name on its own strip, clear of the strip above, and indented off the clamp', () => {
    LANES8.forEach((l, i) => {
      const last = l.names[l.names.length - 1]!.v;
      const first = l.names[0]!.v;
      if (i === 2) {
        // "two levels" under its strip (its holes face the bracket over it): its cap top within 20 u of the strip's edge
        expect(first - 0.72 * LANE_EM - l.strip[1]).toBeLessThanOrEqual(20);
      } else {
        // its last line's foot within 14 u of its own strip (the told-to-delegate strip's: of the band that slides out north of it)
        const own = i === 1 ? BAND.v0 : l.strip[0];
        expect(own - (last + 0.15 * LANE_EM)).toBeGreaterThanOrEqual(0);
        expect(own - (last + 0.15 * LANE_EM)).toBeLessThanOrEqual(14);
      }
      if (i > 0 && i < 2) expect(first - 0.72 * LANE_EM - LANES8[i - 1]!.strip[1], `lane ${i}`).toBeGreaterThanOrEqual(44);
    });
    expect(NAME_U - CLAMP.u1).toBeGreaterThanOrEqual(26);
  });
  it('prints its words in EN alone (the zh policy) and leaves no hole where a zh line was: each line boxed tight, the air shared out', () => {
    for (const t of SHEET_TEXT) expect(hasHan(t), t).toBe(false);
    expect(SHEET_TEXT).toEqual([WORDS.tagChart.en, WORDS.laneOne.en, WORDS.laneTold.en, WORDS.laneTwo.en, WORDS.legendTypical.en, WORDS.legendSlowest.en, WORDS.tokenHead.en]);
    LANES8.forEach((l) => expect(l.names).toHaveLength(1));
    // the caveat stamp's box round its one line: the same air over its caps (0.7 em) as under its descenders (0.22 em)
    const over = CAVEAT.en - 0.7 * CAVEAT.em - CAVEAT.v0;
    const under = CAVEAT.v1 - (CAVEAT.en + 0.22 * CAVEAT.em);
    expect(Math.abs(over - under)).toBeLessThanOrEqual(4);
    // the gaps down the head of the sheet (the load line, the caveat, the legend, the first lane's name) grow evenly: none
    // twice another, and none is a hole of a line (an em) or more
    const gaps = [CAVEAT.v0 - TICKS.inked[1], LEGEND.v - 0.72 * LEGEND.em - CAVEAT.v1, LANES8[0].names[0]!.v - 0.72 * LANE_EM - (LEGEND.v + 0.22 * LEGEND.em)];
    for (const g of gaps) expect(g).toBeLessThan(LANE_EM);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThanOrEqual(2);
    // the token header midway between the section rule and its stacks (within 6 u)
    const above = TOKENS.head.v - 0.72 * TOKENS.head.em - SECTION_RULE.v;
    const below = TOKENS.clamp.v0 - (TOKENS.head.v + 0.22 * TOKENS.head.em);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(6);
  });
});

describe('beat 8: the notches, the die and the long run', () => {
  it('punches the told-to-delegate strip’s notches on their eighths, never the fourth run’s', () => {
    expect(BEAT_8.notches.filter((n) => n.punched)).toHaveLength(4);
    expect(BEAT_8.notches[3]).toEqual({ f: 4320, punched: false });
    expect(LONG_RUN).toBe(3);
    expect(notchesPunched(4289)).toBe(0);
    expect([4290, 4300, 4310, 4320, 4330].map(notchesPunched)).toEqual([1, 2, 3, 3, 4]);
    // meso: about 27 x 18 px on screen
    const v = LANES8[1].strip[0];
    expect(NOTCH.w * pxPerU(notchU(0), v)).toBeGreaterThanOrEqual(26);
    expect(NOTCH.d * pxPerU(notchU(0), v, 'v')).toBeGreaterThanOrEqual(17.5);
    // every notch place clear of its neighbours, and the told-to-delegate strip's clear of its hole
    for (let k = 1; k < 5; k++) expect(NOTCH.s[k]! - NOTCH.s[k - 1]! - NOTCH.w).toBeGreaterThanOrEqual(4);
    // where its last place and its hole share u, the hole (in its south half) clears the notch’s floor by 4 u or more
    if (NOTCH.s[4] + NOTCH.w / 2 > holeAt(1) - HOLE_R - 4) expect(LANES8[1].hole - HOLE_R - 3.7 - NOTCH.d).toBeGreaterThanOrEqual(4);
    // the two-level strip's notches (on its south edge) clear of its hole (in its north half) and of its cut
    expect(LANES8[2].hole + HOLE_R + 3.7).toBeLessThan(64 - NOTCH.d - 3);
    expect(NOTCH.s[4] + NOTCH.w / 2).toBeLessThan(stripLength(2) - 10);
  });
  it('presses the die onto each punched place on its contact frame (the notch cut under its face) and never brings it down on the fourth run', () => {
    const first = BEAT_8.notches[0].f;
    expect(dieAt(first - 13)).toEqual({ u: DIE.home.u, v: DIE.v, z: DIE.home.z });
    BEAT_8.notches.forEach((n, k) => {
      const d = dieAt(n.f);
      expect(Math.abs(d.u - notchU(k)), `notch ${k}`).toBeLessThan(1e-9);
      if (n.punched) {
        expect(d.z).toBeCloseTo(DIE.contact, 9);
        // a 2 f press: hovering 2 f before, on the strip on the contact frame, held a frame, up by +3
        expect(dieAt(n.f - 2).z).toBeCloseTo(DIE.hover, 9);
        expect(dieAt(n.f + 1).z).toBeCloseTo(DIE.contact, 9);
        expect(dieAt(n.f + 3).z).toBeCloseTo(DIE.hover, 9);
        // its face covers the notch (the swap is never seen)
        expect(DIE.w).toBeGreaterThan(NOTCH.w + 6);
        expect(DIE.v - DIE.d / 2).toBeLessThan(LANES8[1].strip[0] - 4);
        expect(DIE.v + DIE.d / 2).toBeGreaterThan(LANES8[1].strip[0] + NOTCH.d + 4);
      } else for (let f = n.f - 2; f <= n.f + 3; f++) expect(dieAt(f).z, `f${f}`).toBeGreaterThanOrEqual(DIE.hover - 1e-9);
    });
    // at rest on the clamp bar at the single session's row once its pass is done
    expect(dieAt(DIE_REST)).toEqual({ u: DIE.home.u, v: ONE_PASS.v, z: DIE.home.z });
    expect(dieAt(BEAT_8.away)).toEqual(dieAt(DIE_REST));
    // it moves continuously, from leaving the clamp to its rest
    for (let f = first - 14; f < DIE_REST + 2; f++) {
      const [a, b] = [dieAt(f), dieAt(f + 1)];
      expect(Math.hypot(b.u - a.u, b.v - a.v), `f${f}`).toBeLessThan(32);
      expect(Math.abs(b.z - a.z), `f${f}`).toBeLessThan(8);
    }
  });
  it('then walks the die over the single session’s five run places on the eighths under C22, coming down short of the strip on each', () => {
    const last = BEAT_8.notches[4].f;
    const [c22from, c22to] = [at(54, 3), at(56, 1.5)];
    // five places, west to east, 10 f apart on the eighths, after the told-to-delegate run and inside C22 (lifted off the last before C22 ends)
    expect(ONE_PASS.at.map((x) => x.k)).toEqual([0, 1, 2, 3, 4]);
    ONE_PASS.at.forEach((x, i) => {
      if (i > 0) expect(x.f - ONE_PASS.at[i - 1]!.f).toBe(10);
      expect(x.f % 10).toBe(0);
      const d = dieAt(x.f);
      expect(Math.abs(d.u - notchU(x.k)), `place ${x.k}`).toBeLessThan(1e-9);
      expect(d.v).toBe(ONE_PASS.v);
      // its dip on the eighth, short of the strip; over it at its walking height 2 f before and 3 f after
      expect(d.z).toBeCloseTo(ONE_PASS.miss, 9);
      expect(dieAt(x.f - 2).z).toBeCloseTo(ONE_PASS.hover, 9);
      expect(dieAt(x.f + 3).z).toBeCloseTo(ONE_PASS.hover, 9);
    });
    expect(ONE_PASS.at[0]!.f).toBeGreaterThanOrEqual(last + 20);
    expect(ONE_PASS.at[0]!.f).toBeGreaterThan(c22from);
    expect(ONE_PASS.at[4]!.f + 3).toBeLessThanOrEqual(c22to);
    // a legible miss: a fall of 10 u or more that stops 2-3 u over the strip's face (its shadow all but closed; its contact
    // shade, which a footprint within 2 u of a receiver casts, never switches on)
    expect(ONE_PASS.hover - ONE_PASS.miss).toBeGreaterThanOrEqual(10);
    expect(ONE_PASS.miss - DIE.contact).toBeGreaterThan(2);
    expect(ONE_PASS.miss - DIE.contact).toBeLessThanOrEqual(3);
    // never down on the strip: nothing is cut (the single session's strip has no notch place)
    for (let f = last + 3; f <= DIE_REST; f++) expect(dieAt(f).z, `f${f}`).toBeGreaterThan(DIE.contact + 2);
    expect(LANES8[0].notches).toBe('none');
    // over the strip's south edge: its face over the strip and clear of the lane's name (north of it) and of the next lane's name
    expect(ONE_PASS.v - DIE.d / 2).toBeGreaterThan(LANES8[0].names[0]!.v + 20);
    expect(ONE_PASS.v + DIE.d / 2).toBeLessThan(LANES8[1].names[0]!.v - 0.75 * LANE_EM);
    // it never passes over the told-to-delegate lane's name (between the strips it keeps to the clamp bar, west of the names)
    const names = { v0: LANES8[1].names[0]!.v - 0.75 * LANE_EM, v1: LANES8[1].names[LANES8[1].names.length - 1]!.v + 0.25 * LANE_EM };
    for (let f = BEAT_8.notches[0].f - 14; f <= DIE_REST; f++) {
      const d = dieAt(f);
      if (d.v + DIE.d / 2 > names.v0 && d.v - DIE.d / 2 < names.v1) expect(d.u + DIE.w / 2, `f${f}`).toBeLessThan(NAME_U);
    }
    // nor over the long run's band while it slides out
    for (let f = BEAT_8.longRun.from; f <= BEAT_8.longRun.from + BEAT_8.longRun.frames; f++) {
      const d = dieAt(f);
      if (d.v + DIE.d / 2 > BAND.v0 && d.v - DIE.d / 2 < BAND.v1) expect(d.u + DIE.w / 2, `f${f}`).toBeLessThan(BAND.u0);
    }
    // its places clear of the strip's hole
    for (const x of ONE_PASS.at) expect(Math.abs(notchU(x.k) - (ORIGIN_U + holeAt(0))), `place ${x.k}`).toBeGreaterThan(DIE.w / 2 + HOLE_R);
  });
  it('slides each punched chad out from under the die’s face from the frame after its contact', () => {
    BEAT_8.notches.forEach((n, k) => {
      const before = chadsAt(n.f).length;
      const after = chadsAt(n.f + 1).length;
      expect(after - before, `notch ${k}`).toBe(n.punched ? 1 : 0);
    });
    const c = chadsAt(4291)[0]!;
    expect(Math.abs(c.u - dieAt(4291).u)).toBeLessThan(DIE.w / 2);
    expect(chadsAt(4400)).toHaveLength(4);
    for (const x of chadsAt(4400)) {
      expect(x.v + 13).toBeLessThan(BAND.v1);
      expect(x.v - 13).toBeGreaterThan(LANES8[1].names[LANES8[1].names.length - 1]!.v + 6);
    }
  });
  it('slides the long run’s band out of its uncut place over longRun.frames, at least 18 px thick, ending flush with the strip’s cut', () => {
    expect(BAND.u0).toBeCloseTo(notchU(LONG_RUN) - NOTCH.w / 2, 9);
    expect(BAND.u1).toBeCloseTo(ORIGIN_U + stripLength(1), 9);
    expect((LANES8[1].strip[0] - BAND.v0) * pxPerU(BAND.u0, BAND.v0, 'v')).toBeGreaterThanOrEqual(18);
    expect(bandFed(BEAT_8.longRun.from)).toBe(0);
    expect(bandFed(BEAT_8.longRun.from + BEAT_8.longRun.frames - 1)).toBeLessThan(BAND.u1 - BAND.u0);
    expect(bandFed(BEAT_8.longRun.from + BEAT_8.longRun.frames)).toBe(BAND.u1 - BAND.u0);
  });
});

describe('beat 8: the bracket and the stacks', () => {
  it('springs the bracket between the told-to-delegate and the two-level holes on its frame, its serifs 24 px or more', () => {
    expect(BRACKET.a[0]).toBeCloseTo(ORIGIN_U + holeAt(1), 9);
    expect(BRACKET.b[0]).toBeCloseTo(ORIGIN_U + holeAt(2), 9);
    expect(BRACKET.bar > LANES8[1].strip[1] && BRACKET.bar < LANES8[2].strip[0]).toBe(true);
    expect((BRACKET.serif + BRACKET.over) * pxPerU(BRACKET.a[0], BRACKET.bar, 'v')).toBeGreaterThanOrEqual(18);
    // each serif reaches past the bar by a hair only, on the far side from its hole (a jog, never the symmetric H)
    expect(BRACKET.over).toBeLessThan(BRACKET.serif / 2);
    expect(beat8At(BEAT_8.bracket)!.bracketSpring).toBe(0);
    expect(beat8At(BEAT_8.bracket + 2)!.bracketSpring).toBeGreaterThan(0.3);
    // it opens over about 9 f (session 6's critics: on the dock spring it snapped open in 3 f and read as a letter H): never
    // more than 0.3 of the way in a frame, not 90% open before +5, a hair over and settled from +6
    const s = Array.from({ length: 16 }, (_, k) => beat8At(BEAT_8.bracket + k)!.bracketSpring);
    for (let k = 1; k < 16; k++) expect(s[k]! - s[k - 1]!, `+${k}`).toBeLessThan(0.3);
    expect(s[4]!).toBeLessThan(0.9);
    expect(Math.max(...s)).toBeGreaterThan(1.005);
    for (let k = 6; k < 16; k++) expect(Math.abs(s[k]! - 1)).toBeLessThan(0.02);
    // its arrows outside the serifs: the whole mark (arrows, serifs and bar) 24 px or more across, so it reads as a dimension
    const across = Math.abs(BRACKET.a[0] - BRACKET.b[0]) + 2 * (BRACKET.arrow.head + BRACKET.arrow.shaft);
    expect(across * pxPerU(BRACKET.a[0], BRACKET.bar)).toBeGreaterThanOrEqual(24);
    // the rings' leaders still reach the serifs' ends (print8.ts: from each ring to its serif's far end)
    expect(BRACKET.a[1] + 14.1).toBeLessThan(BRACKET.bar - BRACKET.serif);
    expect(BRACKET.b[1] - 14.1).toBeGreaterThan(BRACKET.bar + BRACKET.serif);
  });
  it('feeds each stack out of the token clamp, its sheets peeling off the pack (never a jump), its last landing on its done', () => {
    BEAT_8.stacks.forEach((st, i) => {
      const { n, extent } = STACKS8[i]!;
      expect(stackFront(i, st.from)).toBe(-4);
      expect(stackFront(i, st.done)).toBeCloseTo(extent, 9);
      expect(stackFront(i, st.done - 1)).toBeLessThan(extent);
      expect(stackSheetReach(i, n - 1)).toBeCloseTo(extent, 9);
      const pace = (extent + 4) / (st.done - st.from);
      for (let f = st.from; f < st.done + 2; f++)
        for (let k = 0; k < n; k++) {
          const r0 = Math.min(stackSheetReach(i, k), stackFront(i, f));
          const r1 = Math.min(stackSheetReach(i, k), stackFront(i, f + 1));
          expect(r1 - r0, `stack ${i} sheet ${k} f${f}`).toBeLessThanOrEqual(pace + 1e-9);
          expect(r1 - r0).toBeGreaterThanOrEqual(0);
        }
    });
    expect(STACKS8.map((s) => s.n)).toEqual([6, 11, 23]);
    // a sheet 40 px or more wide on screen
    expect(TOKENS.sheetW * pxPerU(ORIGIN_U, TOKENS.rows[0][0])).toBeGreaterThanOrEqual(39.5);
  });
});

describe('beat 8: the print and its contact frames', () => {
  it('inks the form staggered: the caveat with C20, each name 2 f before its strip, the tag, then the legend before "~½"', () => {
    expect(E8.form).toBe(textWindow(cue('tag-chart'))[0]);
    expect(E8.form).toBe(textWindow(cue('chart-lanes'))[0]);
    expect(E8.names).toEqual(L.map((l) => l.slide - 2));
    expect(E8.names[0]).toBeGreaterThan(E8.form);
    expect(TAGS_8[0]!.from).toBe(E8.tag);
    expect(E8.tag).toBeGreaterThan(E8.names[2]! - 1);
    expect(E8.legend).toBeGreaterThan(L[2].slide + L[2].p95);
    expect(E8.legend + 3).toBeLessThan(stampAt('half'));
    expect(E8.head).toBe(textWindow(cue('chart-tokens'))[0]);
    expect([stampAt('half'), stampAt('ten'), stampAt('tokens')]).toEqual([at(51, 3), at(53), at(57)]);
    // the stacks are done on beats after the header (critic P1-2); "2–4×" lands on the tallest's completion
    expect(stampAt('tokens')).toBe(BEAT_8.stacks[2].done);
    expect([inkStage(99, 100), inkStage(100, 100), inkStage(101, 100), inkStage(102, 100), inkStage(500, 100)]).toEqual([-1, 0, 1, 2, 2]);
    // nothing of the form's print while the camera moves (8.1: no text under the move)
    const e = beat8At(at(51) - 1)!;
    expect([e.ink.form, ...e.ink.names, e.ink.legend, e.ink.bracket, e.ink.head, e.ink.half, e.ink.ten, e.ink.tokens].every((x) => x === -1)).toBe(true);
  });
  it('steps each hero stamp to the light print over 6 f as the next one lands (the claim being read is the dark one)', () => {
    expect(stampStepAt('half', stampAt('ten'))).toBe(0);
    expect(stampStepAt('half', stampAt('ten') + 6)).toBe(1);
    expect(stampStepAt('ten', stampAt('tokens') - 1)).toBe(0);
    expect(stampStepAt('ten', stampAt('tokens') + 6)).toBe(1);
    expect(stampStepAt('tokens', 4559)).toBe(0);
    for (let f = stampAt('ten'); f < stampAt('ten') + 7; f++) expect(stampStepAt('half', f + 1) - stampStepAt('half', f)).toBeLessThanOrEqual(0.27);
  });
  it('sets every word at 36 px or more and every hero stamp at 160-220 px on screen at the sheet’s framing', () => {
    const words: [string, number, number, number][] = [
      ['caveat', CAVEAT.u0, CAVEAT.en, CAVEAT.em],
      ...LANES8.flatMap((l, i) => l.names.map((n) => [`lane ${i}`, NAME_U, n.v, LANE_EM] as [string, number, number, number])),
      ['legend', LEGEND.u, LEGEND.v, LEGEND.em],
      ['token head', TOKENS.head.u, TOKENS.head.v, TOKENS.head.em],
    ];
    for (const [id, u, v, em] of words) expect(em * pxPerU(u, v - em), id).toBeGreaterThanOrEqual(36);
    for (const [id, s] of Object.entries(STAMPS8)) {
      const px = s.em * pxPerU(s.u, s.v - s.em);
      expect(px, id).toBeGreaterThanOrEqual(160);
      expect(px, id).toBeLessThanOrEqual(220);
    }
  });
  it('lays the sheet inside the diagram band (y 72-868), its words inside title-safe, the stamps clear of the strips and stacks', () => {
    const corners = [onSheet(0, 0), onSheet(SHEET_W, 0), onSheet(0, SHEET_H), onSheet(SHEET_W, SHEET_H)].map(([x, y]) => project(sheet, [x, y, 0]));
    for (const [, y] of corners) expect(y >= 72 && y <= 868).toBe(true);
    expect(SHEET8.x0).toBeGreaterThan(700);
    for (const [u, v] of [
      [CAVEAT.u1, CAVEAT.en],
      [NAME_U + 760, LANES8[1].names[0].v],
      ...Object.values(STAMPS8).map((s) => [s.u + s.adv * s.em, s.v] as const),
    ] as const) {
      const p = screen(u, v);
      expect(p[0]).toBeLessThanOrEqual(SAFE.right);
      expect(p[1]).toBeLessThanOrEqual(868);
    }
    // the stamps' column: "~10%" east of the told-to-delegate strip's cut and the band's end, "2–4×" east of the longest stack
    expect(STAMPS8.ten.u - 10 - (ORIGIN_U + stripLength(1))).toBeGreaterThanOrEqual(18);
    expect(STAMPS8.tokens.u - 10 - (ORIGIN_U + STACKS8[2]!.extent)).toBeGreaterThanOrEqual(18);
    // "~½" east of every lane name's box but the told-to-delegate lane's (its ink there is the tilde, high above that name)
    expect(STAMPS8.half.u).toBeGreaterThan(NAME_U + 700);
  });
  it('sets the load tag on the clear desk west of the sheet, inside title-safe, its leader’s foot on the load line', () => {
    const [t] = TAGS_8;
    expect(t!.cue).toBe('tag-load');
    expect(t!.words).toBe(WORDS.tagLoad);
    // (about 20 px a character at 40 px, as film.test.ts measures tags: its 42 characters measure 824 px on the render)
    expect(t!.at[0] - 20 * WORDS.tagLoad.en.length).toBeGreaterThanOrEqual(SAFE.x);
    expect(t!.at[1] - 32).toBeGreaterThanOrEqual(SAFE.y);
    const foot = project(sheet, t!.foot);
    expect(foot[0]).toBeGreaterThan(t!.at[0]);
    expect(foot[0]).toBeLessThan(t!.at[0] + 120);
  });
  it('drops the load tag’s leader at a plain angle from its line onto the load line, its run on the sheet and its dot in ink (T-rv-01: level with its one line it read as a dash)', () => {
    const [t] = TAGS_8;
    expect(t!.paperEdge).toEqual([
      [SHEET8.x0, SHEET8.y0, SHEET8.z],
      [SHEET8.x0, SHEET8.y1, SHEET8.z],
    ]);
    // every frame of its window the sheet lies still (its slide is before the tag's wipe and after its fade)
    const [w0, w1] = textWindow(cue('tag-load'));
    for (let f = Math.max(w0, t!.from!); f <= w1; f += 5) expect(sheetDx(f), `f${f}`).toBe(0);
    const foot = project(sheet, t!.foot);
    // (about 19.6 px a character at 40 px, as measured on the render)
    const L = tagLayout(t!, foot, (x) => 19.6 * x.length);
    const [lx, ly] = L.l;
    // the leader leaves the line's side at its middle and drops to the foot at 18 degrees or more, never level with the text
    expect(lx).toBeGreaterThan(t!.at[0]);
    expect(ly).toBe(t!.at[1] - TAG_MID);
    expect((Math.atan2(foot[1] - ly, foot[0] - lx) * 180) / Math.PI).toBeGreaterThanOrEqual(18);
    // the foot on the paper, east of its edge, and a run of 60 px or more of the leader over the dark desk before the edge
    const e0 = project(sheet, t!.paperEdge![0]);
    const e1 = project(sheet, t!.paperEdge![1]);
    const k = leaderOnPaper(foot, [lx, ly], e0, e1);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);
    expect(foot[0]).toBeGreaterThan(Math.max(e0[0], e1[0]));
    expect((1 - k) * Math.hypot(lx - foot[0], ly - foot[1])).toBeGreaterThanOrEqual(60);
    // the crossing on the sheet's west edge, under its north-west corner
    const cross = [foot[0] + (lx - foot[0]) * k, foot[1] + (ly - foot[1]) * k];
    expect(cross[1]).toBeGreaterThan(project(sheet, [SHEET8.x0, SHEET8.y1, SHEET8.z])[1]);
    expect(Math.abs(cross[0] - project(sheet, [SHEET8.x0, SHEET8.y1, SHEET8.z])[0])).toBeLessThan(3);
    expect(TEXT_HEX.ink).toBe(INK);
  });
});

describe('beat 8: the sheet’s life', () => {
  it('slides the sheet in from beyond the frame’s east edge on bar 50 and away east on bar 58, off the frame before it leaves the world', () => {
    expect(beat8At(at(50) - 1)).toBeNull();
    const west = (f: number) => project(cameraAt(f, 15), [SHEET8.x0 + sheetDx(f) - 30, SHEET8.y1, 0])[0];
    expect(west(at(50))).toBeGreaterThan(1920);
    expect(sheetDx(E8.from + E8.inFrames)).toBe(0);
    expect(sheetDx(at(51) - 1)).toBe(0);
    expect(sheetDx(at(58))).toBe(0);
    // off the frame (with its shadow's reach) from offFrame while it still exists, on screen the frame before
    for (let f = E8.offFrame; f < E8.until; f++) {
      const c = cameraAt(f, 15);
      const top = project(c, [SHEET8.x0 + sheetDx(f) - 40, SHEET8.y1, 0])[0];
      const bottom = project(c, [SHEET8.x0 + sheetDx(f) - 40, SHEET8.y0, 0])[0];
      expect(Math.min(top, bottom), `f${f}`).toBeGreaterThan(1920);
    }
    expect(project(cameraAt(E8.offFrame - 12, 15), [SHEET8.x0 + sheetDx(E8.offFrame - 12), SHEET8.y1, 0])[0]).toBeLessThan(1920);
    expect(beat8At(E8.until - 1)).not.toBeNull();
    expect(beat8At(E8.until)).toBeNull();
    expect(E8.until).toBe(E8.offFrame + 1);
  });
  it('leaves at a held pace: on screen never more than 30 px a frame, bar 58’s move under it included', () => {
    let worst = 0;
    for (let f = E8.away; f < E8.offFrame; f++)
      for (const v of [0, SHEET_H / 2, SHEET_H])
        for (const u of [0, 300]) {
          const [a, b] = [screen(u, v, f), screen(u, v, f + 1)];
          if (a[0] < 1920) worst = Math.max(worst, Math.hypot(b[0] - a[0], b[1] - a[1]));
        }
    expect(worst).toBeLessThanOrEqual(30);
    for (let f = E8.away; f < E8.until; f++) expect(sheetDx(f + 1) - sheetDx(f)).toBeLessThanOrEqual(E8.outPace + 1e-9);
  });
  it('never jumps: the sheet’s slide, the strips, the band and the stacks change by a bounded amount a frame', () => {
    for (let f = E8.from; f < E8.until - 1; f++) {
      const [a, b] = [beat8At(f)!, beat8At(f + 1)!];
      expect(Math.abs(b.dx - a.dx), `f${f}`).toBeLessThan(60);
      for (let i = 0; i < 3; i++) expect(Math.abs(b.strips[i]! - a.strips[i]!)).toBeLessThanOrEqual(K + 1e-9);
      expect(b.band - a.band).toBeLessThanOrEqual((BAND.u1 - BAND.u0) / BEAT_8.longRun.frames + 1e-9);
    }
  });
  it('steps the desk down from bar 50 to a full step through bar 58, your desk on its own set and up again before the lid shuts', () => {
    expect(FOCUS_8).toHaveLength(1);
    const [e] = FOCUS_8;
    expect(e!.id).toBe('b8-away');
    expect(e!.handFrom).toBeUndefined();
    expect(e!.from).toBe(at(50));
    expect(e!.to).toBeGreaterThanOrEqual(at(58));
    expect(e!.step).not.toContain('you');
    expect(e!.own?.step).toEqual(['you']);
    const s = stepAt(at(58));
    expect(s.amount).toBe(1);
    expect(s.own?.amount ?? 0).toBe(0);
    expect(stepAt(at(58) - 1).own?.amount ?? 0).toBe(0);
    expect(stepAt(at(50) - 1).amount).toBe(0);
  });
  it('casts the sheet’s few footprints only while it is in the world', () => {
    expect(footprints8(deskStateAt(at(50) - 1))).toEqual([]);
    let most = 0;
    for (let f = E8.from; f < E8.until; f += 2) most = Math.max(most, footprints8(deskStateAt(f)).length);
    expect(most).toBeLessThanOrEqual(14);
  });
  it('is a pure function of the frame', () => {
    for (const f of [3930, 4005, 4300, 4345, 4445, 4590]) expect(beat8At(f)).toEqual(beat8At(f));
  });
});

describe('beat 8: the Proactive plate at the sheet’s framing', () => {
  it('shows its words only while their west end is in the frame: its pictogram cross-faded in from bar 50’s truck, back under bar 58’s ease-out', () => {
    const B = PROACTIVE_PLATE.box;
    const west: [number, number, number] = [B.x0 + 8, rectC(B)[1], PROACTIVE_PLATE.z[1]];
    expect(proactiveMarkAt(PROACTIVE_MARK.out)).toBe(0);
    expect(proactiveMarkAt(PROACTIVE_MARK.out + 1)).toBeGreaterThan(0);
    expect(proactiveMarkAt(PROACTIVE_MARK.back + PROACTIVE_MARK.frames)).toBe(0);
    for (let f = 3440; f < 4700; f++) {
      const x = project(cameraAt(f, 15), west)[0];
      if (x < 0) expect(proactiveMarkAt(f), `f${f}`).toBe(1);
      // (and nothing in part 1 or after the ease-out)
      if (f < PROACTIVE_MARK.out || f >= PROACTIVE_MARK.back + PROACTIVE_MARK.frames) expect(proactiveMarkAt(f), `f${f}`).toBe(0);
    }
  });
});
