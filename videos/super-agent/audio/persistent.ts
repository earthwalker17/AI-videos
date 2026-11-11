/**
 * Bars 58-62 (f4560-4959): beat 9, keeping it running handed over (proposed; STORYBOARD 9.1-9.2, Sound column), on
 * BEAT_9's contact frames. continuity.ts drops the bass and moves the pad to B minor; its ticks on 2 and 4 carry on.
 *
 *   9.1  your laptop's lid shuts for the night (a soft latch); each vellum part laid down flat is a breath of airy
 *        filtered noise, at its place as the camera eases out; the lid strut docks on the vellum loop with the
 *        chore's own sound handed over (act one's low hum, short and soft, as the key docked as its woodblock and
 *        the sand-glass as its trickle), then the Persistent plate settles, in vellum (a papery tap, not enamel); a
 *        machine's lamp comes on (a small click) and a queued slip drops into it (a wood tick: a message)
 *   9.2  the Watchdog is laid (vellum air); its sightline sweeps on bars 61 and 62's downbeats (its scope's index
 *        knocks and a soft inspector's bell rings: not a whoosh) over the stuck bay's damped two-note loop (B4 on each beat of `stuck`, A4 an eighth
 *        later: its card drum steps out and back); the sightline pins a pencil flag on it (a short pencil stroke)
 */
import { BEAT_9 } from '../src/cues.ts';
import { LV, M, type Desk } from './common.ts';
import { inkClick, lidClick, sketchScratch, vellumLay, vellumTap, woodblockHop } from './foley.ts';
import { hum, loupeBell, marimba, woodTick } from './instruments.ts';
import { X, panAt } from './places.ts';

const { D2, A4, B4 } = M;

/** What each vellum lay puts down, in order: the plan of the deck, the state cabinet, the loop's sheet, the tethers. */
const LAID: readonly number[] = [X.plan, X.cabinet, X.loop, X.tethers];
/** The machine whose lamp comes on (the workstation, the middle one). */
const LIT = X.machines[1];

/** The ticks this part marks (continuity.ts leaves those beats to it): the strut's dock, the machine's lamp, the Watchdog laid, the flag. */
export const persistentBeats = (d: Desk): number[] => [d.f(BEAT_9.strut.dock), d.f(BEAT_9.machineLamp), d.f(BEAT_9.watchdog), d.f(BEAT_9.flag)];

/** The stuck bay's loop: [frame, midi] for each beat of `stuck` (out on the beat, back an eighth later). */
export const stuckLoop = (): [number, number][] => {
  const out: [number, number][] = [];
  for (let f = BEAT_9.stuck.from; f <= BEAT_9.stuck.to; f += 20) out.push([f, B4], [f + 10, A4]);
  return out;
};

export function persistent(d: Desk): void {
  const { T, seed, music, foley } = d;
  const B = BEAT_9;
  const fps = T.ctx.fps;

  // ===== 9.1: the lid, the vellum laid down, the strut handed over, a machine's lamp and slip ==================
  foley(d.f(B.lidClick), lidClick(seed, 0), { part: 'lid', db: LV.lid, pan: panAt(X.laptop, B.lidClick), sends: { hall: 0.12 } });
  // the first lay comes while the B minor pad is still swelling in, so it sits a little lower (12 dB under the bed)
  B.lays.forEach((f, i) => foley(d.f(f), vellumLay(seed, { len: 12 / fps, k: i }), { part: 'vellum', db: LV.vellum - (i === 0 ? 2.5 : 0), pan: panAt(LAID[i], f + 6), sends: { hall: 0.2 } }));
  music(d.f(B.strut.dock), hum(D2, { len: 2.0, attack: 0.3, release: 0.9, vel: 0.7 }), { part: 'strut-hum', db: LV.strutHum, pan: panAt(X.loop, B.strut.dock) });
  foley(d.f(B.strut.plateDock), vellumTap(seed, 0), { part: 'vellum-tap', db: LV.vellumTap, pan: panAt(X.loop, B.strut.plateDock), sends: { hall: 0.15 } });
  foley(d.f(B.machineLamp), inkClick(seed, 21), { part: 'lamp-on', db: LV.lampOn, pan: panAt(LIT, B.machineLamp) });
  music(d.f(B.slipDrop), woodTick(1400, { seed, k: 720, vel: 0.65 }), { part: 'slip-drop', db: LV.slipDrop, pan: panAt(LIT, B.slipDrop), sends: { hall: 0.15 } });

  // ===== 9.2: the Watchdog, its sweeps over the stuck bay's loop, the flag ======================================
  foley(d.f(B.watchdog), vellumLay(seed, { len: 12 / fps, k: 4 }), { part: 'vellum', db: LV.vellum, pan: panAt(X.watchdog, B.watchdog + 6), sends: { hall: 0.2 } });
  B.sweeps.forEach((f, i) => {
    const pan = panAt((X.watchdog + X.flag) / 2, f);
    // the scope's index knocks as the sightline starts (the hit's contact: a woodblock fills QA's first 5 ms block without a sharp peak), and its bell rings over the sweep
    foley(d.f(f), woodblockHop(seed, 960 + i, 1100), { part: 'sweep', db: LV.contact - 3, pan });
    music(d.f(f), loupeBell(B4, { vel: 0.6, tau: 0.9 }), { part: 'sweep', db: LV.sweep, pan, sends: { hall: 0.3, echo: 0.1 } });
  });
  stuckLoop().forEach(([f, midi], k) => {
    music(d.f(f), marimba(midi, { seed, k: 7600 + k, vel: k % 2 ? 0.45 : 0.55, bright: 0.3, tau: 0.12 }), { part: 'stuck', db: LV.stuck - (k % 2 ? 2 : 0), pan: panAt(X.stuckBay, f), sends: { hall: 0.12 } });
  });
  foley(d.f(B.flag), sketchScratch(seed, { len: 0.16, k: 8 }), { part: 'pencil', db: LV.pencil, pan: panAt(X.flag, B.flag), sends: { hall: 0.1 } });
}
