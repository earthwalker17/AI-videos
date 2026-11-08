/**
 * Lookdev round 2 (session 3, "The Register Desk"): the film frames its stills and motion tests
 * show, on the 84-bar cue sheet. Round 1's frames stay in `film/world.ts` STILL_FRAMES with the
 * retired dark-ink-map stills (`StillScenes.tsx`).
 */
export const ROUND2 = {
  /** (a) act one, "You’ve quietly become their router": C4 alone, the hub just closed */
  stillA: 915,
  /**
   * (b) two levels, "Workers report up. Only the Router talks to you.": C12 alone, the built tag gone;
   * the report card has docked in the Register's mouth with its cell lit, the index arm has turned
   * west and the reply that cites it is about 30% down the chute; the card's body has folded into
   * the spill drawer (desk/state.ts EVENTS_B)
   */
  stillB: 2225,
  /** the built tag beside C11 */
  tag: 2050,
  /** (c) context as a cache at the Register's window: N5, with the cache tag */
  stillC: 3150,
  /** the evidence sheet: C21 with the chart's tags */
  chart: 4200,
  /** (d) the 0.5× summary at the sign-off rest: no narration, no tag */
  stillD: 5520,
  /** the step-down under C27 */
  stepDown: 5940,
} as const;

/** Motion tests: [from, to) film frames (TREATMENT.md, revision 2; synthesis §5). */
export const MOTION_TESTS = {
  /** MT1: report up, the reply down the chute, the next dispatch */
  mt1: [2140, 2340],
  /** MT2: the turn, the routing job lifting off your desk, to the Continuous plate landing (f1640) */
  mt2: [1400, 1660],
} as const satisfies Record<string, readonly [number, number]>;
