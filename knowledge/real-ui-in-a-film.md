# Film real product UI live, as stills at three times the density, and magnify one element at a time

A launch film has to show the real product, and a desktop or web UI set in 14 px text cannot
be read at 1080p. Record the product live with scripts driving it, capture each awaited state
as a still at three times the pixel density, and stage the stills in the film: crop to one
element, magnify it until its text reaches the film's reading size, and move between crops
like a camera. Redraw a terminal from its recorded output instead of filming it.

## Method
1. **Record live, from what users get.** Install the published package and installer, give the
   product a real task on a neutral project and neutral paths (no user name, home path or key
   can appear), and let scripts type, click and quit. Keep each take's log, and scan it and every
   still for keys, names and paths before anything is committed.
2. **Stills, not screen video.** Drive the browser or the app over the DevTools protocol at
   deviceScaleFactor 3 and capture at awaited states only (a card armed, a diff open, after a
   click). Record each click target's box, so the film's pointer can land on it. Native window
   chrome and dialogs need an OS capture (Windows: PrintWindow), and only in wide shots.
3. **Reading size sets the magnification.** With a 36 px bar for text a viewer must read, a 14 px
   UI needs at least ×2.6. So a readable shot shows one element (a card, a chip, a row of
   buttons), not a window. Crop between UI elements with at least 48 px of margin, or bleed the
   element off the frame's edge; never let a pane's edge cut words inside the frame. Whole
   windows appear only as pictures (texture), in wide shots.
4. **Move like a camera.** A zoom from one crop to the next is a geometric scale whose on-screen
   size changes linearly. A cut is declared as a hard cut on a bar, so motion blur never blends
   two shots.
5. **Give every click a cause.** A pressed state on the button (or the OS's red on a close
   button) lands on the frame of the click sound.
6. **Titles rise as whole lines.** A per-glyph rise under motion blur reads as typing with a
   caret.
7. **A terminal is redrawn, not filmed.** Record the program's output bytes from a pseudo-terminal
   and replay them through a small VT applier into a grid of styled cells. The film then draws
   the cells in its own type and colours, sharp at any magnification. MiniDSH 2.0 writes diffs
   inside DEC 2026 synchronized-update blocks and paints no background.

## Evidence
*MiniDSH 2.0: One Runtime, Every Surface* (#5, published 2026-11-24, release
`video/minidsh-launch/v1`), recorded from `minidsh@2.0.0` and its official Windows installer,
1080p60, on the reference host (8 GB, Intel iGPU). Two frame-critic rounds found the faults that
steps 3 to 6 prevent: words cut by pane edges, zooms that slid instead of scaling, motion blur
across a cut, a click with no visible cause, and glyph-by-glyph titles that read as typed. The
final passed `aiv qa` with every cut on a bar. Not verified: other products' UIs, or screen video
instead of stills.

## In this repo
- `videos/minidsh-launch/capture/`: the take scripts (terminal through a Python pty, web over
  CDP, desktop through MiniDSH's own test driver) and the VT applier `tui_paints.ts`.
- `@aiv/web-kit`: the image mark (`Stage`, `ImageMark`, `ImageBank` residency) that draws a
  capture as a pane with rounded corners and a shadow, and `Draw.text(…, { by: 'line' })` for
  whole-line titles.
- `videos/minidsh-launch/src/tui.ts`: the terminal pane, drawn from the recorded cells on a CPU
  canvas.

## Pitfalls
- An OS capture of a window cannot see an open native menu.
- On a native confirm box, Enter may answer the default button (Cancel), not the action you want:
  click it through UI Automation.
- A live take varies: the refusal or the approval the film is built around may not happen again,
  so write fallback copy and keep the take that has it.
- A model asked to make a thumbnail from these stills redraws the UI and the logo. Check both, and
  composite the real mark over its drawing (#5's thumbnail did).
