import { describe, expect, it } from 'vitest';
import { parseAstatsPeak, parseBlack, parseEbur128, parseFreeze, parseSilence, unexpected } from './detect.ts';
import { parseFramehash } from './frames.ts';
import { loudnessChecks } from './qa.ts';

// trimmed from real ffmpeg 8.0.1 output
const STDERR = `
[blackdetect @ 0000] black_start:0 black_end:1 black_duration:1
[freezedetect @ 0001] lavfi.freezedetect.freeze_start: 2
[silencedetect @ 0002] silence_start: 0.5
[silencedetect @ 0002] silence_end: 3 | silence_duration: 2.5
[Parsed_ebur128_0 @ 0003] Summary:

  Integrated loudness:
    I:         -21.8 LUFS
    Threshold: -31.8 LUFS

  Loudness range:
    LRA:         0.0 LU
    Threshold: -41.8 LUFS

  True peak:
    Peak:      -16.1 dBFS
`;

describe('detector parsers', () => {
  it('reads ebur128, black, freeze (open at EOF) and silence', () => {
    expect(parseEbur128(STDERR)).toEqual({ i: -21.8, lra: 0, tp: -16.1 });
    expect(parseBlack(STDERR)).toEqual([{ start: 0, end: 1 }]);
    expect(parseFreeze(STDERR, 5)).toEqual([{ start: 2, end: 5 }]);
    expect(parseSilence(STDERR, 5)).toEqual([{ start: 0.5, end: 3 }]);
    expect(parseEbur128('no summary')).toBeNull();
  });

  it('loudness fails closed: a target without a measurable summary is a failed check', () => {
    const target = { integrated: -14, tolerance: 1, truePeakMax: -1 };
    // per-frame lines only (framelog=verbose, a cut-off run): no "Summary:" block
    const noSummary = '[Parsed_ebur128_0 @ 0003] t: 1.0 TARGET:-23 LUFS M: -21.0 S:-120.7 I: -21.8 LUFS LRA: 0.0 LU\n';
    const missing = loudnessChecks(parseEbur128(noSummary), target);
    expect(missing).toEqual([expect.objectContaining({ id: 'loudness.integrated', passed: false })]);
    expect(missing[0].info).toBeUndefined();
    // measured, but off target / over the ceiling / silent
    expect(loudnessChecks(parseEbur128(STDERR), target).map((c) => c.passed)).toEqual([false, true]);
    expect(loudnessChecks({ i: -Infinity, lra: 0, tp: -Infinity }, target)[0].passed).toBe(false);
    expect(loudnessChecks({ i: -14.2, lra: 3, tp: -0.5 }, target).map((c) => c.passed)).toEqual([true, false]);
    // without a target it is information, never a verdict
    expect(loudnessChecks(null, null)).toEqual([expect.objectContaining({ id: 'loudness', info: true })]);
  });

  it('reads the overall sample peak from astats (measure_overall=Peak_level only)', () => {
    // trimmed from real ffmpeg 8.0.1 output: the analysis pass's last lines
    const astats = `${STDERR}[Parsed_astats_2 @ 000002875b408680] Overall\n[Parsed_astats_2 @ 000002875b408680] Peak level dB: -18.979070\n[out#0/null @ 000002875b37dc80] video:0KiB audio:188KiB\n`;
    expect(parseAstatsPeak(astats)).toBeCloseTo(-18.97907, 6);
    expect(parseAstatsPeak('[Parsed_astats_0 @ 0001] Overall\n[Parsed_astats_0 @ 0001] Peak level dB: -inf\n')).toBe(-Infinity);
    // a float over (decoded AAC can exceed full scale)
    expect(parseAstatsPeak('[Parsed_astats_0 @ 0001] Overall\n[Parsed_astats_0 @ 0001] Peak level dB: 0.512000\n')).toBeCloseTo(0.512, 6);
    expect(parseAstatsPeak(STDERR)).toBeNull();
  });

  it('keeps only segments outside the allowed spans', () => {
    const segs = [
      { start: 0, end: 1 },
      { start: 4, end: 6 },
    ];
    expect(unexpected(segs, [{ start: 0, end: 1 }])).toEqual([{ start: 4, end: 6 }]);
    expect(unexpected(segs, [{ start: 0, end: 0.99 }], 0.02)).toEqual([{ start: 4, end: 6 }]);
    expect(unexpected(segs, [])).toHaveLength(2);
  });

  it('reads framehash lines', () => {
    expect(parseFramehash('#format: frame checksums\n#hash: SHA256\n0,          0,          0,        1,   172800, abc\n0,          1,          1,        1,   172800, def\n')).toEqual(['abc', 'def']);
  });
});
