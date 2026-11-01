/**
 * Doctor sections: each checks one area of the environment and says how to fix what is wrong.
 * Engines add their own section (browser, GPU path) in doctor/index.ts.
 */
export type DoctorStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface DoctorItem {
  status: DoctorStatus;
  label: string;
  detail: string;
  /** the command or step that repairs it */
  fix?: string;
}

export interface DoctorContext {
  root: string;
  /** --fix: repair what can be repaired in place (e.g. install the pinned browser) */
  fix?: boolean;
}

export interface DoctorSection {
  title: string;
  run(ctx: DoctorContext): Promise<DoctorItem[]>;
}

/** a ≥ b for dotted numeric versions ("0.12.3" vs "0.13"). */
export function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}
