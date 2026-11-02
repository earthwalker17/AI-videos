/**
 * Intent checks on a cue sheet: rules of craft a person would otherwise catch only by watching
 * (cuts that miss the bar line, words that leave before they can be read, a card that flashes
 * by). Pure functions of the sheet; `aiv audio` writes them into audio.json and fails (exit 1,
 * after writing the tracks) when one does not pass.
 */
import type { CueEvent, CueSheet } from '@aiv/core';

export interface IntentCheck {
  id: string;
  passed: boolean;
  /** informational: nothing to check (no grid, no text) */
  info?: boolean;
  detail: string;
}

/** Text must stay up at least this long, however short (s). */
export const MIN_TEXT_S = 1.8;
/** Seconds added to the reading time: the eye has to find the text first. */
export const FIND_TEXT_S = 0.6;
/** A title or end card stays up at least this long (s). */
export const MIN_CARD_S = 4;
/** Reading speeds: CJK characters and other (Latin…) characters per second. */
export const CJK_PER_S = 4.5;
export const OTHER_PER_S = 15;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const EPS = 1e-9;

/** Seconds to read `text`: CJK code points / 4.5 + other non-space characters / 15. */
export function readingSeconds(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk++;
    else if (!/\s/u.test(ch)) other++;
  }
  return cjk / CJK_PER_S + other / OTHER_PER_S;
}

/** How long a text must be held: max(1.8 s, reading time + 0.6 s). */
export const requiredHoldS = (text: string): number => Math.max(MIN_TEXT_S, readingSeconds(text) + FIND_TEXT_S);

const spanS = (e: CueEvent, fps: number) => ((e.end ?? e.frame) - e.frame) / fps;

/** With a grid, every cut lands on a bar line: (frame - offsetFrames) is a whole number of bars. */
export function cutsOnBars(sheet: CueSheet): IntentCheck {
  const id = 'cuts.bars';
  if (!sheet.grid) return { id, passed: true, info: true, detail: 'no musical grid: cuts are not checked against bar lines' };
  const { bpm, beatsPerBar, offsetFrames = 0 } = sheet.grid;
  const bar = (sheet.fps * 60 * beatsPerBar) / bpm;
  if (Math.abs(bar - Math.round(bar)) > EPS)
    return { id, passed: false, detail: `a bar of ${beatsPerBar} beats at ${bpm} bpm is ${bar.toFixed(3)} frames at ${sheet.fps} fps: choose a tempo whose bar is a whole number of frames` };
  const b = Math.round(bar);
  const cuts = sheet.events.filter((e) => e.kind === 'cut');
  const off = cuts.filter((e) => (((e.frame - offsetFrames) % b) + b) % b !== 0);
  if (off.length)
    return {
      id,
      passed: false,
      detail: `off the bar line (a bar is ${b} frames from frame ${offsetFrames}): ${off.map((e) => `${e.id} @${e.frame} (+${(((e.frame - offsetFrames) % b) + b) % b})`).join(', ')}`,
    };
  return { id, passed: true, detail: cuts.length ? `${cuts.length} cut(s) on bar lines (${b} frames a bar)` : 'no cuts' };
}

/** Every text and card cue holds each of its languages for max(1.8, reading + 0.6) s. */
export function textHeld(sheet: CueSheet): IntentCheck {
  const id = 'text.hold';
  const cues = sheet.events.filter((e) => (e.kind === 'text' || e.kind === 'card') && e.text && Object.keys(e.text).length);
  if (!cues.length) return { id, passed: true, info: true, detail: 'no text or card cue with text' };
  const short: string[] = [];
  for (const e of cues)
    for (const [lang, s] of Object.entries(e.text!)) {
      const have = spanS(e, sheet.fps);
      const need = requiredHoldS(s);
      if (have + EPS < need) short.push(`${e.id} [${lang}] held ${have.toFixed(2)} s < ${need.toFixed(2)} s`);
    }
  return short.length ? { id, passed: false, detail: `too short to read: ${short.join('; ')}` } : { id, passed: true, detail: `${cues.length} text cue(s) held long enough in every language` };
}

/** Every card stays up at least 4 s. */
export function cardsLongEnough(sheet: CueSheet): IntentCheck {
  const id = 'card.length';
  const cards = sheet.events.filter((e) => e.kind === 'card');
  if (!cards.length) return { id, passed: true, info: true, detail: 'no cards' };
  const short = cards.filter((e) => spanS(e, sheet.fps) + EPS < MIN_CARD_S);
  return short.length
    ? { id, passed: false, detail: `shorter than ${MIN_CARD_S} s: ${short.map((e) => `${e.id} (${spanS(e, sheet.fps).toFixed(2)} s)`).join(', ')}` }
    : { id, passed: true, detail: `${cards.length} card(s) of ${MIN_CARD_S} s or more` };
}

export const intentChecks = (sheet: CueSheet): IntentCheck[] => [cutsOnBars(sheet), textHeld(sheet), cardsLongEnough(sheet)];

/** Checks that fail the stage (informational ones never do). */
export const failedChecks = (checks: readonly IntentCheck[]): IntentCheck[] => checks.filter((c) => !c.passed && !c.info);
