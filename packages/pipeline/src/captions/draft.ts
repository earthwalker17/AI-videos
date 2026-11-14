/**
 * Draft captions from a cue sheet: the on-screen words of chosen `text` and `card` cues, one
 * language, timed by each cue's span [frame, end) on the delivery (the sheet's leader included).
 * A draft, because a person still reads it before it is published: the text is the picture's,
 * so it is never reworded here.
 *
 * - Lines: each cue's text wrapped to the language's profile (wrap.ts); its '\n' breaks are kept.
 *   A cue with more lines than a caption holds is shown as consecutive pages, its span shared
 *   among them in proportion to their characters (as reading speed counts them).
 * - Overlaps: the chosen cues' starts and ends (and their pages') cut the timeline into pieces. A
 *   piece shows the lines of every cue on screen in it, the earliest started cue first (by the
 *   cue's own start, not its page's; on a tie, the earlier in the sheet). When they do not fit,
 *   the earliest started cue leaves the caption until they do (the newest text wins), and returns
 *   when the newer one ends. Equal neighbouring pieces are one caption. So no two captions ever
 *   overlap and none has more lines than the profile allows. A chosen cue (or one of its pages)
 *   that newer cues cover the whole time is never shown: that is an error, not a silent loss.
 *   Stacking splits a cue's caption into pieces, and the linter judges each piece's reading
 *   speed on its own: choose cues that do not overlap where that matters.
 * - Times: frame f starts at round(f × 1000 / fps) ms. Every start and end goes through that one
 *   non-decreasing map, so a caption that ends on the frame where the next begins never overlaps it.
 */
import type { CueEvent, CueKind, CueSheet } from '@aiv/core';
import { deliveryFrame } from '../qa/audio.ts';
import { speedChars, subtitleProfile, SUBTITLE_PROFILES, type SubtitleProfile } from './profiles.ts';
import type { Caption } from './srt.ts';
import { paginate, wrapText } from './wrap.ts';

export const CAPTION_KINDS: readonly CueKind[] = ['text', 'card'];

export interface CueSelection {
  /** the kinds to choose from (default text and card) */
  kinds?: readonly CueKind[];
  /** cue ids or globs (`*` any characters, `?` one); default every cue of those kinds */
  ids?: readonly string[];
}

export interface SelectedCues {
  /** in sheet order */
  cues: CueEvent[];
  /** the ids and globs that chose no cue of those kinds (a typo, or a cue of another kind) */
  unmatched: string[];
}

const globRe = (g: string) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);

/** The sheet's cues of the chosen kinds whose id matches the selection. */
export function selectCues(sheet: CueSheet, sel: CueSelection = {}): SelectedCues {
  const kinds = new Set(sel.kinds ?? CAPTION_KINDS);
  const pool = sheet.events.filter((e) => kinds.has(e.kind));
  if (!sel.ids) return { cues: pool, unmatched: [] };
  const pats = sel.ids.map((g) => ({ g, re: globRe(g) }));
  return { cues: pool.filter((e) => pats.some((p) => p.re.test(e.id))), unmatched: pats.filter((p) => !pool.some((e) => p.re.test(e.id))).map((p) => p.g) };
}

export interface DraftCaption extends Caption {
  /** the cues whose words it shows, in its line order */
  cues: string[];
  /** its film frames, [start, end) */
  frames: [number, number];
}

interface Item {
  id: string;
  order: number;
  /** the cue's own start: which of two overlapping cues is newer */
  cueStart: number;
  /** 1-based, of `pages` */
  page: number;
  pages: number;
  start: number;
  end: number;
  lines: string[];
}

/** A cue's pages over its span, each page a whole number of frames, at least one. */
function pages(e: CueEvent, order: number, text: string, profile: SubtitleProfile): Item[] {
  if (e.end === undefined) throw new Error(`cue '${e.id}' is a point (${e.kind}): only a span can be captioned`);
  const ps = paginate(wrapText(text, profile), profile.maxLines);
  if (!ps.length) throw new Error(`cue '${e.id}' has no words in '${profile.lang}'`);
  const frames = e.end - e.frame;
  if (frames < ps.length) throw new Error(`cue '${e.id}' needs ${ps.length} captions but lasts ${frames} frame(s)`);
  const weight = ps.map((p) => Math.max(1, speedChars(p, profile)));
  const total = weight.reduce((a, b) => a + b, 0);
  const cuts = [e.frame];
  let cum = 0;
  for (let k = 1; k < ps.length; k++) {
    cum += weight[k - 1];
    const want = e.frame + Math.round((frames * cum) / total);
    cuts.push(Math.min(Math.max(want, cuts[k - 1] + 1), e.end - (ps.length - k)));
  }
  cuts.push(e.end);
  return ps.map((lines, k) => ({ id: e.id, order, cueStart: e.frame, page: k + 1, pages: ps.length, start: cuts[k], end: cuts[k + 1], lines }));
}

/**
 * Draft captions of `cues` (from selectCues) in `lang`. Throws when a cue has no words in that
 * language or no span, when the language has no subtitle profile, or when a chosen cue would never
 * be shown (newer cues cover it the whole time and their lines do not fit beside it).
 */
export function draftCaptions(sheet: CueSheet, cues: readonly CueEvent[], lang: string): DraftCaption[] {
  const profile = subtitleProfile(lang);
  if (!profile) throw new Error(`no subtitle profile for '${lang}' (there are: ${Object.keys(SUBTITLE_PROFILES).join(', ')})`);
  const order = new Map(sheet.events.map((e, i) => [e.id, i]));
  const items = cues.flatMap((e) => {
    const text = e.text?.[lang];
    if (!text?.trim()) throw new Error(`cue '${e.id}' has no '${lang}' text${e.text ? ` (it has: ${Object.keys(e.text).join(', ') || 'none'})` : ''}`);
    return pages(e, order.get(e.id) ?? sheet.events.length, text, profile);
  });

  const cuts = [...new Set(items.flatMap((i) => [i.start, i.end]))].sort((a, b) => a - b);
  const out: DraftCaption[] = [];
  const ms = (f: number) => Math.round((deliveryFrame(sheet, f) * 1000) / sheet.fps);
  const shown = new Set<Item>();
  const coveredBy = new Map<Item, Set<string>>();
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [a, b] = [cuts[k], cuts[k + 1]];
    const on = items.filter((i) => i.start <= a && i.end >= b).sort((x, y) => x.cueStart - y.cueStart || x.order - y.order);
    const left: Item[] = [];
    while (on.length > 1 && on.reduce((n, i) => n + i.lines.length, 0) > profile.maxLines) left.push(on.shift()!);
    for (const l of left) for (const i of on) (coveredBy.get(l) ?? coveredBy.set(l, new Set()).get(l)!).add(i.id);
    for (const i of on) shown.add(i);
    if (!on.length) continue;
    const lines = on.flatMap((i) => i.lines);
    const prev = out.at(-1);
    if (prev && prev.frames[1] === a && prev.lines.join('\n') === lines.join('\n')) {
      prev.frames[1] = b;
      prev.end = ms(b);
      for (const i of on) if (!prev.cues.includes(i.id)) prev.cues.push(i.id);
      continue;
    }
    out.push({ start: ms(a), end: ms(b), lines, cues: [...new Set(on.map((i) => i.id))], frames: [a, b] });
  }
  const hidden = items.filter((i) => !shown.has(i));
  if (hidden.length) {
    const what = (h: Item) => `cue '${h.id}'${h.pages > 1 ? ` (page ${h.page} of ${h.pages})` : ''} on frames [${h.start}, ${h.end}) under ${[...(coveredBy.get(h) ?? [])].map((c) => `'${c}'`).join(', ')}`;
    const head = `${hidden.length} chosen cue(s) or page(s) would never be shown: newer cues cover them the whole time and their lines do not fit beside them (${profile.lang}: ${profile.maxLines} lines). Leave one of each out of the selection:`;
    throw new Error([head, ...hidden.map((h) => `  ${what(h)}`)].join('\n'));
  }
  return out;
}
