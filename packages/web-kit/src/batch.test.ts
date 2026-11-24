// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { GLYPH, IMAGE, SHAPE, canMerge, pushCommand, type Command } from './batch.ts';

const cmd = (kind: Command['kind'], start: number, over: Partial<Command<string>> = {}): Command<string> => ({ kind, world: true, start, count: 1, tex: null, display: false, shadow: false, ...over });

describe('the command batcher', () => {
  it('merges consecutive marks of one kind and space', () => {
    const list: Array<Command<string>> = [];
    pushCommand(list, cmd(SHAPE, 0));
    pushCommand(list, cmd(SHAPE, 1));
    pushCommand(list, cmd(SHAPE, 2));
    expect(list).toHaveLength(1);
    expect(list[0]!.count).toBe(3);
  });

  it('keeps call order: a different kind or space in between starts a new call', () => {
    const list: Array<Command<string>> = [];
    pushCommand(list, cmd(SHAPE, 0));
    pushCommand(list, cmd(GLYPH, 0, { world: false }));
    pushCommand(list, cmd(SHAPE, 1));
    pushCommand(list, cmd(SHAPE, 2, { world: false }));
    expect(list.map((c) => [c.kind, c.start, c.count, c.world])).toEqual([
      [SHAPE, 0, 1, true],
      [GLYPH, 0, 1, false],
      [SHAPE, 1, 1, true],
      [SHAPE, 2, 1, false],
    ]);
  });

  it('never merges image marks that sample different textures', () => {
    const a = cmd(IMAGE, 0, { tex: 'web', display: true });
    const b = cmd(IMAGE, 1, { tex: 'approval', display: true });
    expect(canMerge(a, b)).toBe(false);
    const list: Array<Command<string>> = [];
    pushCommand(list, a);
    pushCommand(list, b);
    pushCommand(list, cmd(IMAGE, 2, { tex: 'approval', display: true }));
    expect(list.map((c) => [c.tex, c.start, c.count])).toEqual([
      ['web', 0, 1],
      ['approval', 1, 2],
    ]);
  });

  it('never merges across the display flag or a drop shadow', () => {
    expect(canMerge(cmd(IMAGE, 0, { tex: 't', display: true }), cmd(IMAGE, 1, { tex: 't', display: false }))).toBe(false);
    expect(canMerge(cmd(IMAGE, 0, { tex: 't', display: true, shadow: true }), cmd(IMAGE, 1, { tex: 't', display: true }))).toBe(false);
    expect(canMerge(cmd(IMAGE, 0, { tex: 't', display: true }), cmd(IMAGE, 1, { tex: 't', display: true, shadow: true }))).toBe(false);
    expect(canMerge(cmd(IMAGE, 0, { tex: 't', display: true }), cmd(IMAGE, 1, { tex: 't', display: true }))).toBe(true);
  });

  it('merges only contiguous ranges', () => {
    expect(canMerge(cmd(SHAPE, 0), cmd(SHAPE, 2))).toBe(false);
  });

  it('does not alias the pushed command', () => {
    const list: Array<Command<string>> = [];
    const first = cmd(SHAPE, 0);
    pushCommand(list, first);
    pushCommand(list, cmd(SHAPE, 1));
    expect(first.count).toBe(1);
  });
});
