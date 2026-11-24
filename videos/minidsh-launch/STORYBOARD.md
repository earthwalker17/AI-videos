# Storyboard: MiniDSH 2.0: One Runtime, Every Surface

42 bars at 120 bpm, 60 fps (a bar is 2 s, 120 frames), plus a 30-frame test-card leader for drafts
and the review cut. The timeline is `src/cues.ts`; each act is a module in `src/acts/`.

## Shots
| Bars | Act (module) | Picture | Motion | Words | Sound |
|---|---|---|---|---|---|
| 1-2 | hook | Poster on frame 0: the mark, "MiniDSH", the line; the real terminal at a 3/4 angle with the task typed | slow drift; the pane swings flat; the mark's teal dot falls into the caret | t-hook | the dot's bell; Enter on bar 3 |
| 3-9 | terminal | The live terminal turn, retimed: wide; the refused edit; its error; the read and the edit; the reply; the test's table | locked; a push onto the refusal (bar 5), a pan to the error, a cut on bar 6, a push to the reply; the table's numbers slide right on bar 9 | t-read | half-time; a denial accent and a dropped beat on the refusal; the pass chord |
| 10-11 | handoff | Match cut on "Both tests pass." from the terminal to the web UI; pull back to the page in our browser frame | the sentence holds its place across the cut; the pointer appears | t-session | whoosh; the pulse enters |
| 12-14 | record | The edit card: read, edit (+7 −1), the Record, the diff; the receipt lifts out | push in; the receipt lifts on its hit; the camera moves down the same page to the composer | t-record | receipt tick |
| 15-20 | permission | The follow-up typed (4 real states), the page scrolling as the sandbox refuses, the approval card, Allow once, the receipt | scroll-matched crossfades; a flat push until the card reads; the pointer presses on the bar-19 downbeat; a hard cut to the receipt; a rest | t-perm | uneasy swell; two-note bell; click and resolve; rest |
| 21-26 | desktop | The app's own window and line; mid-turn on Windows; the quit; the dot; the reopened session ("Stopped") | arrives on the cut; a crop narrows onto its line; the pointer closes the window; it collapses into the teal dot, rests, reopens from it | t-window, t-kept | UI clicks; a low-pass under the quit; the pip; the bell returns |
| 27-34 | runtime | The three surfaces together, then four paper strips app/ capabilities/ core/ kernel/ with real module names; callbacks light the modules that did each moment | pull back, then a lateral truck; stamps accelerate (1 → ½ → ¼ bar); all lit on bar 33 | t-ways, t-providers, t-runtime | the build; stamp hits; the peak on bar 33 |
| 35-42 | close | The strips contract into the dot; the dot lands in the mark; the end card | still once read | c-* | resolve; the bell on the mark; rest |

## Frame system (numbers)
- **Frame.** 1920×1080 reference px.
  - Title zone: upper left (x 128, baseline 190; two lines 100 px apart).
  - Panes: biased right and low, top edge at or below y 330 when a title shows.
- **Type.**
  - Titles: IBM Plex Sans 600, 88 px, tracking −1.8%.
  - Line: 46 px. End card name: 128 px.
  - Mono (Plex Mono 500): 40 px for commands, 66 px for the payoff table.
  - Small print: 36 px. Texture (strip micro-print, the browser address): 26 px.
- **Readable text.** At least 36 px (font size; the creator's choice, 2026-11-24).
- **UI magnification** (target px ÷ product px):
  - web UI body (14 px) ×2.25–2.7 in close-ups;
  - terminal canvas (40 px glyphs) ×0.9 in close-ups, ×0.5 wide (texture);
  - desktop content (3x captures) ×2.0.
- **Motion.**
  - Titles rise through their baseline, 12 frames in, 8 out.
  - Camera moves ease in and out (cubic). One hero move per shot. Hard cuts on bars.
  - Motion blur: 6 sub-frames over a 180° shutter, never across a cut.
- **Colour.** Lit ink ground (#0b0d10 → #272c35). Light-theme panes (the look check's choice). Teal at four moments (the dot); amber only in the permission beat.

## Reuse record (what the film shows and how it was made)
| Act | Product material | How it is shown |
|---|---|---|
| hook, terminal | MiniDSH 2.0.0 terminal UI, live take (assets/tui/paints.json) | each recorded paint redrawn cell by cell on a CPU canvas, the theme (background) ours since the UI paints none; symbols the font lacks drawn as vectors |
| handoff, record, permission | MiniDSH 2.0.0 web UI, live take (assets/ui/web-*.png, 3x) | real stills as panes; scroll-matched crossfades between real states; our own pointer and browser frame |
| desktop | MiniDSH 2.0.0 desktop app, official installer, live take (assets/ui/desk-*.png: window 1x, content 3x) | real stills as panes; 3x content laid over the 1x window when magnified; the collapse and the dot are the film's |
| runtime, close | MiniDSH 2.0.0 module names (src/ folders at the tag), the mark's geometry | drawn by the film; inserts are crops of the same real stills |

## Never (the BANNED line)
- **From the DSH reference:** typed titles with a caret, blue accent words, white title cards,
  Montserrat, navy smoke, the whale or wordmark, "Introducing", the question montage, the widget
  collage, the light-streak wipe.
- **From our film #4:** phosphor and coral, Big Shoulders, rails, dots on lines, glow, horizontal strata.
- **The genre's defaults:** decorative particles, neon, generic icons, three cards in a row, a title over a dimmed screenshot, text that moves while read.
