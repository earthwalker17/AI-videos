import { describe, expect, it } from 'vitest';
import { availableMB, parseVmStat } from './memory.ts';

// the layout of macOS 14 `vm_stat` (Apple silicon, 16 KiB pages); the numbers are made up
const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                5000.
Pages active:                            200000.
Pages inactive:                           60000.
Pages speculative:                         3000.
Pages throttled:                              0.
Pages wired down:                         90000.
Pages purgeable:                           2000.
"Translation faults":                 812345678.
Pages copy-on-write:                   23456789.
Pages zero filled:                    345678901.
Pages reactivated:                      1234567.
Pages purged:                            234567.
File-backed pages:                        70000.
Anonymous pages:                         193000.
Pages stored in compressor:              150000.
Pages occupied by compressor:             50000.
Decompressions:                         3456789.
Compressions:                           4567890.
Pageins:                               12345678.
Pageouts:                                 12345.
Swapins:                                      0.
Swapouts:                                     0.
`;

describe('memory', () => {
  it('reads macOS available memory from vm_stat: free + inactive + speculative + purgeable', () => {
    // (5000 + 60000 + 3000 + 2000) pages × 16 KiB = 1093.75 MiB; free pages alone would be 78 MiB
    expect(parseVmStat(VM_STAT)).toBe(1094);
    expect(parseVmStat(VM_STAT.replace('16384', '4096'))).toBe(273);
    expect(parseVmStat('Pages free: 12.')).toBeNull();
    expect(parseVmStat('Mach Virtual Memory Statistics: (page size of 4096 bytes)\nPages active: 1.')).toBeNull();
  });

  it('measures available memory on this host', async () => {
    const mb = await availableMB();
    expect(mb).toBeGreaterThan(0);
  });
});
