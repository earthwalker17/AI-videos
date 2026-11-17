# Script: Who Routes the Agents?

The film has no narration: every word is on screen, in English. The words, their timing and their
reading holds live in one place, the cue sheet [`src/cues.ts`](src/cues.ts); the picture, the
score, the captions and the hold tests all read it. This table is printed from it (one row per
block of type that is on screen together), so it cannot drift from the film. Each claim's source
is in [FACTS.md](FACTS.md), section 11.

Times are from the film's first frame (the review cut adds a half-second test card before it).
Text in `code type` is a mono stamp or a label on a mark; a slash is a line break.

## en

| Beat | Time | Narration | On screen |
|---|---|---|---|
| flat · q | 0:00.5–0:03.6 | — | WHO ROUTES / THE AGENTS? |
| flat · sess | 0:04.0–0:06.0 | — | `SESSION` |
| flat · few | 0:08.5–0:12.5 | — | One team finds a person can usually follow 3 to 5 sessions. |
| flat · youdo | 0:14.0–0:16.0 | — | YOU DO. |
| lift · title | 0:18.0–0:24.0 | — | THE SUPER-AGENT DESIGN<br>from DeepSeek's Harness team<br>`TWO LEVELS · A DESIGN, NOT A PRODUCT` |
| levels · router | 0:26.0–0:29.6 | — | ONE LONG-LIVED / ROUTER<br>`CHAT`<br>`CODE REVIEW`<br>`EMAIL` |
| levels · routes | 0:30.0–0:34.0 | — | IT ROUTES. / IT NEVER EXECUTES.<br>Whole tasks go down, unsplit. |
| levels · proto1 | 0:34.5–0:38.3 | — | `PROTOTYPE ROUTER: KEEPS A SHELL, NO WRITE TOOLS` |
| levels · worker | 0:40.0–0:43.5 | — | A WORKER: / ITS OWN CONTEXT<br>One task. Full tools. |
| levels · answers | 0:44.3–0:47.3 | — | By design, only the Router answers you. |
| spine · spine | 0:48.0–0:51.0 | — | ONE ROUTER / FOR ALL THIS? |
| gates · events | 0:52.0–0:54.5 | — | EVENTS, NOT JUST PROMPTS |
| gates · gate1 | 0:55.0–0:58.1 | — | GATE ONE: PLAIN CODE<br>No model runs. |
| gates · gate2 | 0:58.5–1:00.6 | — | THEN A MODEL JUDGES. |
| gates · proto2 | 1:01.0–1:04.5 | — | `PROTOTYPE DEFAULT: UNASKED WORK IS ONLY RECORDED` |
| gates · v1 | 1:05.0–1:07.0 | — | 1.  FEW REACH THE ROUTER. |
| threads · follow | 1:08.0–1:12.0 | — | FOLLOW-UPS GO STRAIGHT IN<br>Seen by the Router. Not decided. |
| threads · cheaper | 1:12.5–1:17.1 | — | CHEAPER, NOT FASTER<br>~27%<br>fewer tokens than without it<br>`AUTHORS' TEST` |
| threads · v2 | 1:17.5–1:20.0 | — | 2.  FOLLOW-UPS SKIP ITS DECISION. |
| batch · wait | 1:23.0–1:25.6 | — | ARRIVALS WAIT, / THEN ENTER TOGETHER |
| batch · cost | 1:26.0–1:32.6 | — | 6.4 s → 1.6 s<br>model time per decision, at ~40× the load<br>`AUTHORS' STRESS TEST · MOCK WORKERS` |
| batch · limit | 1:33.0–1:35.1 | — | UP TO A LIMIT PER CALL. |
| batch · v3 | 1:35.5–1:38.0 | — | 3.  THE REST ARRIVE TOGETHER. |
| cache · cache | 1:39.0–1:42.6 | — | ITS CONTEXT IS A CACHE<br>What it needs soon stays in view. |
| cache · recall | 1:43.0–1:46.6 | — | BY DESIGN: RECALL BY ID<br>It loses less. Not nothing. |
| cache · v4 | 1:47.0–1:49.5 | — | 4.  DETAILS WAIT BEHIND IDS. |
| evidence · test | 1:50.0–1:58.6 | — | THE AUTHORS' TEST<br>Synthetic. 5 runs. Indicative only.<br>`SUPER-AGENT`<br>`ONE SESSION + SUBAGENT TOOL`<br>told to delegate first |
| evidence · slow | 1:59.0–2:02.6 | — | SLOWEST TASKS: / ABOUT HALF THE TIME<br>`P95 · RE-PLOTTED` |
| evidence · typ | 2:03.0–2:05.6 | — | TYPICAL TASKS: / ABOUT 10% FASTER<br>`P50` |
| evidence · price | 2:06.0–2:10.1 | — | THE PRICE: / 2–4× THE TOKENS<br>told to delegate first (at its band)<br>left to choose |
| status · proposed | 2:10.5–2:14.6 | — | PROPOSED<br>Running in the cloud. A check for stuck Workers. |
| status · open | 2:15.0–2:19.5 | — | OPEN<br>Long memory. Security. Stepping in mid-task. More Routers. |
| close · q2 | 2:20.0–2:22.6 | — | WHO ROUTES / THE AGENTS? |
| close · notyou | 2:23.0–2:29.0 | — | NOT YOU.<br>`BY DESIGN` |
| close · decide | 2:26.0–2:29.0 | — | YOU DECIDE. / YOU SIGN OFF. |
| close · recap | 2:30.0–2:37.0 | — | 1.  FEW REACH THE ROUTER.<br>2.  FOLLOW-UPS SKIP ITS DECISION.<br>3.  THE REST ARRIVE TOGETHER.<br>4.  DETAILS WAIT BEHIND IDS. |
| close · end | 2:38.0–2:48.0 | — | WHO ROUTES THE AGENTS?<br>After “Exploring Super-agent Design”<br>by the DeepSeek Harness team, 2026<br>An independent explainer. Not affiliated with DeepSeek. |

Standing names on marks, drawn for as long as their mark is: `YOU`, `ROUTER`, `WORKERS`, `EVENTS`
(the stack), `CODE`, `MODEL`, `RECORDED` (the gates), `ID` (the cache), `SUPER-AGENT`,
`ONE SESSION + SUBAGENT TOOL` (the re-plot's rows). The opening counts the sessions 1 to 7.
