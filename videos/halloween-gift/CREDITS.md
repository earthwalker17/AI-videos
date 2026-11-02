# Credits: A Halloween Gift

Everything in the picture is drawn by code in `src/` (paper silhouettes, the sky, the
puppets, the props): there are no image, texture or model files. The score and sound effects
are composed and synthesised by code in `audio/`.

| Asset | Source | Licence or rights class | Changes | Used as |
|---|---|---|---|---|
| Clawd (the character) | Anthropic's Claude Code mascot, recreated from the CLI's own pixel model sheet | Anthropic's; used as parody under the [parody rule](../../docs/LICENSING.md#third-party-characters-brands-and-parody), no logos or wordmarks | Rebuilt as a papercraft puppet; our own witch costume, wand and pumpkin pail | The hero |
| IM Fell English | `@fontsource/im-fell-english` 5.3.0 (the Fell Types, digitised by Igino Marini) | OFL-1.1 | none (used unmodified, not redistributed) | Storybook type: the cover, the gift card, "The End" |
| Noto Serif SC | `@fontsource-variable/noto-serif-sc` 5.3.1 | OFL-1.1 | none (only the unicode-range files the film's characters need are loaded) | All Chinese text |
| Inter | `@fontsource-variable/inter` 5.3.0 | OFL-1.1 | none | The email's plain sans; the captions' English |
| VSCO 2 Community Edition samples | Versilian Studios, `sgossner/VSCO-2-CE` at the commit pinned in `audio/library.json` | CC0-1.0 (credit as a courtesy) | Played by the film's own sampler; never committed | Pizzicato strings, tuba, timpani, bells, percussion in the score |
| Funeral march (quotation, two bars) | Frédéric Chopin, Piano Sonata No. 2, Op. 35 (1840) | Public domain | Newly arranged and rendered for this film | The sting on the seal |
| "Shave and a haircut" | Traditional | Public domain | The rhythm only | The knock |
| Reference painting | Supplied by the user as visual reference | Unknown rights: reference only | Not used in the film, not committed | Palette and composition study |

## Tools
Remotion 4.0.539 (Remotion License), three.js 0.186.1 (MIT), React Three Fiber 9.8.2 (MIT),
postprocessing 6.39.5 (Zlib), FFmpeg 8 (LGPL/GPL build, used as a tool), Node 24 and the
repository's own pipeline (render, audio, post, QA). Made with Claude
Code. No generative image, video, music or voice models were used.
