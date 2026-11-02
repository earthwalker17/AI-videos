# Brief: A Halloween Gift

## Audience
Developers and AI users who follow Claude and Claude Code, in English and in Chinese. They
know the Claude Code mascot (Clawd, the orange pixel creature on the CLI welcome screen) and
the running joke among Chinese users that the "gift" Claude sends them is an account ban (封号).
They will see it on YouTube and in shares around Halloween, mostly on phones and laptops,
often without sound at first.

## Promise
In one minute, a moonlit storybook Halloween in which Claude's mascot delivers the year's
most dreaded "gift", and the viewer laughs at the ban-email meme without anyone being mocked.

## Shape
- About 60 s: 40 bars of 3/4 at 120 bpm, 1440 frames at 24 fps (stop-motion feel: actors on
  twos, camera on ones). The review cut adds a 12-frame test-card leader.
- 16:9, 1920×1080. A 9:16 Short is a possible later deliverable, not part of this cut.
- Bilingual on screen: storybook captions, title and end card carry English and Simplified
  Chinese together; the email headline is English with a Chinese seal. No voice-over.
- Deadline: Halloween 2026 has passed (production starts 2026-11-03) while the meme is
  current. Publish as soon as the final is approved, as a "once upon a Halloween" tale. The
  film is not tied to any policy date.

## References
- **The user's reference painting** (kept locally in `.cache/reference/`, rights unknown,
  never committed or used as a plate): the palette (a teal moonlit world, cyan practicals,
  warm light only from jack-o'-lanterns, maroon shadows near the camera), the composition
  (a giant pumpkin lower left, crooked gates, a castle on a floating rock under the moon,
  hanging ghost sheets, a gothic house, a path that leads the eye to the door).
- **The Nightmare Before Christmas** (Selick, 1993; Kozachik's ASC account): principles only:
  hard expressionist light, practicals as pools of light, angular leaning forms, a grayed
  palette with saturated accents, card-layered mist. Nothing copied: no characters, no
  spiral hill, no gate arch, no lettering, no melodies.
- **Corpse Bride / Coraline**: the warm-to-cold palette swap as a story device.
- **Arthur Rackham** silhouettes and gnarled trees; **Edward Gorey**'s deadpan.
- **lemo-opuscar** styles `paper-lantern`, `hd-2d`, `rubber-hose` (MIT, pinned in
  [references/lemo-opuscar.md](../../references/lemo-opuscar.md)): layered backlit paper,
  night lighting rules, animating on twos.
- **Clawd's model sheet** as drawn in the Claude Code CLI: proportions and poses.

## Risks
- **Facts.** The meme itself has no single traceable source; the film presents it as a
  joke, never as a claim. The real context (Anthropic's regional restrictions, ban waves)
  is recorded in `FACTS.md` under "Not claimed".
- **Rights.** Clawd is Anthropic's character: a fan parody with no logos or wordmarks, a
  non-affiliation notice on the end card, in the README and the description, and
  `license.film: none`. The costume differs from the official blue-hat wizard plushie. The
  email is fictional and copies no real wording or address. Public-domain musical quotes
  stay under 3 s.
- **Respect.** No nationality is the butt of the joke. The user is a faceless neighbour in
  a bedsheet-ghost costume who keeps their dignity; the home's Chinese details are used in
  their proper sense; every Chinese string is checked by the user.
- **Technical.** The repository had no way to build audio from code: this film adds the
  audio stage. Display and CJK fonts are new. Render time on the reference laptop's iGPU,
  the legibility of the letter through the post chain, and whether the synthesised score
  sounds good (an agent cannot listen: the user does) are the open questions.
