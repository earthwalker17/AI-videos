# Treatment: MiniDSH 2.0: One Runtime, Every Surface

Three candidates were written and weighed in plan mode on 2026-11-24. The creator chose **A**, which
a creative review then sharpened into **A′** (same arc, same acts), below.

## Candidate A: One session, three surfaces (chosen, built as A′)
**Arc.** One real task, filmed where it happens:
1. The terminal runs the tools and refuses an edit to a file the model has not read.
2. The same session opens in the browser, where the edit's record and an approval for a wider
   write are shown.
3. The desktop app is quit mid-turn and keeps the session.
4. A pull-back shows the one runtime behind all three.

**Image system.**
- **The receipt.** The product's own record chip lifts out of the UI, and is echoed by paper
  strips of real module names in the climax.
- **Push-in continuation.** The element that ends one shot opens the next.
- **The teal dot from the mark**, used at four moments only.

**Sound.** Half-time until the terminal's pass, a pulse from the hand-off, a build through the
runtime callbacks, a resolve on the mark.

**What could go wrong.**
- The desktop act could repeat the web act.
- "One session" could be implied where it is not true.
- The runtime graphic could become a generic stack.

## Candidate B: Three ways in
**Arc.** A title, then three chapters, one per surface, each restarting the same task and stating
that surface's strength. Then the three panes converge on the runtime, and a logo.

**Image system.** Chapter cards, one colour per surface.

**Sound.** Three loops, one per chapter, merging at the convergence.

**What could go wrong.** It is the slideshow of interfaces the brief warns against: the same task
three times, with no story between them.

## Candidate C: Inside out
**Arc.** It opens inside the runtime: a log line writes itself, receipts stack into a spine, and
the four layers are named. Then it pulls out to reveal the surfaces plugged into it, with brief
real demos, and a logo.

**Image system.** The log as a living spine.

**Sound.** Starts from a single tick per event and grows into a groove.

**What could go wrong.** An abstract hook for a launch audience, and the product appears late.

## Choice: A′
A follows one real task, so every surface is shown doing something only it does, and the runtime
graphic explains what the viewer has already seen. The creator picked it ("A: One session, three
surfaces (Recommended)") on 2026-11-24, together with:
- WSL for the terminal and browser, Windows for the desktop;
- the official installer;
- the font-size reading of the text bar.

A review the same day made it **A′**:
- **The hook.** Frame 0 is the poster and the product at once.
- **The desktop.** Its act is the one thing a browser cannot do: quit mid-turn, the session kept.
- **The climax.** It is built from real code paths, not a stack of layers.
- **Honesty.** "Same session" is claimed only for the terminal-to-browser hand-off, which is true.

### A′ beat map (120 bpm, a bar is 2 s; 42 bars ≈ 84 s, plus a 0.5 s leader removed for the final)
| Bars | Act | What happens |
|---|---|---|
| 1–2 | Hook | The poster: the terminal with the task typed, the mark and one line; the dot drops into the caret. |
| 3–9 | Terminal | Real paints: the failing test, the refused edit (if the take has it), the read, the edit, the pass; the table's numbers move right. |
| 10–11 | Hand-off | The same reply sentence, in the terminal's mono then the browser's sans; our generic browser frame on `127.0.0.1`. |
| 12–14 | Web: the record | "Session resumed", the edit's diff, the runtime's receipt. |
| 15–20 | Web: permission | The follow-up, the sandbox stopping the write, the approval card, **Allow once** on a downbeat, a half-bar rest. |
| 21–26 | Desktop | The native frame replaces the browser's; Welcome; a different task; quit mid-turn; "Stopping…"; it reopens with the session kept. |
| 27–34 | One runtime | Paper strips `app/ capabilities/ core/ kernel/`; the four ways in; callbacks light the modules that did each moment; "One runtime." |
| 35–42 | Close | The dot lands in the mark: name, positioning, install line, URL, the non-affiliation line, rest. |

### Look: "paper on ink"
MiniDSH's own dark ink, lit, as the stage. The terminal pane is dark; the web and desktop panes are
light-theme captures, so the product is the brightest thing on screen. The type is IBM Plex Sans 600
for titles, in an upper-left title zone, and Plex Mono for commands and receipts. Teal and amber
are rationed.

**Do not copy**
- **The DSH film:** typed titles with a caret; blue accent words; white title cards; Montserrat;
  navy smoke; its whale or wordmark; "Introducing"; the question montage; the widget collage; the
  light-streak wipe.
- **Film #4:** phosphor and coral; Big Shoulders; rails, dots on lines, glow; horizontal strata.

### How it is built
- **Engine.** The web engine. The WebGL2 kit of film #4 is promoted to `packages/web-kit` (its
  second user), with a new image mark for real captures and a terminal pane drawn from the TUI's
  recorded output.
- **Capture.** Tools in [`capture/`](capture/).
- **Approvals.** The pilot look check (not a gate) is on the permission beat. The gates are the
  review cut and the final.
