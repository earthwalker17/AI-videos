# 比特新语 and the "Vibe知识" genre: a style study for code-made explainers (2026-11)

| | |
|---|---|
| Upstream | Channel https://space.bilibili.com/3494362707135250 · video pages https://www.bilibili.com/video/BV1ot4z66EvR/ · https://www.bilibili.com/video/BV12DHQ61EhT/ · https://www.bilibili.com/video/BV1Fbpt6qEPq/ · https://www.bilibili.com/video/BV1vXHr6eEoN/ · https://www.bilibili.com/video/BV1WkJk6VEqA/ · https://www.bilibili.com/video/BV1FP4b67ENN/ · https://www.bilibili.com/video/BV1X8a16wEGh/ · https://www.bilibili.com/video/BV1q94h6DEH2/ · https://www.bilibili.com/video/BV1NDnR6JEAX/ · press https://eu.36kr.com/zh/p/4033742259672962 (same article: https://m.21jingji.com/article/20261022/herald/fd33d9fcf3cef29800ddd927d2ad46ef.html) · tutorial https://www.jxxy.net/ai/articles/vibe-knowledge-showcase-guide/ · genre spec https://github.com/MiyanoX/vibe-knowledge-video |
| Pin | Upload list as shown on 2026-11-08 (26 videos, newest 《压缩即理解》 of 2026-11-06; unchanged when pass 3 looked again that night) · video data of the three pass-3 films re-checked 2026-11-09 · press article 2026-10-20 (36氪), copy 2026-10-22 (21财经) · tutorial updated 2026-10-26 · MiyanoX/vibe-knowledge-video `78cbecce056407402d33eab18de6ce3f584e60ca` (2026-10-13) |
| Licence | Films, covers, music and descriptions: their owners' (facts and our own descriptions only; no frame, sprite, cover, audio or copy in this repo) · press and tutorial: proprietary (paraphrase) · MiyanoX repo: MIT per its LICENSE file (GitHub's API reports NOASSERTION) |
| Accessed | 2026-11-08 (passes 1–3) · 2026-11-09 (length, upload date, uploader and master size of the three pass-3 films) |
| Stale after | 2026-12-08 for the catalogue, counts and press (a fast-moving channel and genre); the style analysis and do-not-copy list hold until #4 is released |

## What it is
A style study of the Bilibili creator 比特新语 and of the 2026 "Vibe知识" wave the press groups
it with: short knowledge films, apparently without voiceover, whose animation is reportedly
written as code by an AI model. Three passes on 2026-11-08: a sprite and cover study of 9 films,
checked by an adversarial verifier whose corrections are applied here; a 360p frame study of 6
films in the user's own browser; and a 1080p frame study of 3 of them, logged in, which
found that the finish, not the geometry, carries the look.

## Why it matters here
Video #4 (`videos/super-agent`), the science explainers series' first film and first short
form, is a 2–3 minute, text-led, code-made explainer. The genre is its nearest precedent for
pacing and text load, and its sameness is the main risk, because #4 is also coded with Claude.
The genre's reported technique (a frame as a pure function of time, headless capture, keyframes
checked before the full render) is what this repo already does (the determinism rule, a stricter
`draw(t)` in `engines/web/ENGINE.md`, stills and draft contact sheets), so distinctness must
come from art direction, not tooling.

## Method: how the evidence was gathered
- **Pass 1, sprites and covers** (a research agent, then a verifier): public video pages read
  through a summarising fetch tool (descriptions, collection lists, counts, labels); the
  seek-preview sprite sheets the web player loads for its progress bar (one 10×10 sheet of
  480×270 thumbnails per film, one request per film, a thumbnail every 5–12 s); 8 covers from
  one public related-videos response. No cookies, signatures, logins or video downloads; the
  images stayed in the session's private cache, outside the repo.
- **Pass 2, frames in the user's Chrome** (the user chose "Connect Chrome"):
  - one new tab, not logged in, so playback was 360p; one 1080p frame came from the
    player's guest trial (试看30秒);
  - on each watch page a script kept the video muted and paused, seeked it and drew frames
    into an in-page contact sheet that was screenshotted (no danmaku or controls in them):
    24 frames per film, 4-frame bursts 1/8 s apart at two or three transitions, and a
    half-second frame-difference scan; screenshots viewed in the session only, never saved;
  - the public video data the page uses (description, subtitle list, resolution, AI label)
    requested from inside the tab; for the music question, the lowest-bitrate audio stream of
    five films (压缩即理解 and the four compared below) fetched into page memory and decoded
    silently into loudness curves, never played or written to disk;
  - nothing liked, followed, posted or logged into; the tab was closed afterwards.
- **Limits of passes 1–2:** 360p frames and sprite cells about 200 px wide as displayed (hex
  values are estimates, fonts judged by eye, micro labels and citations unreadable; pass 3
  read them at 1080p for three films); bursts sample about 8 frames a second, so easing is
  approximate, and cut rates come from a frame-difference scan; audio was not heard. On some page loads the player had autoplayed before the mute
  script ran (play head 0.02–1.3 s, once 2.4 s); whether any sound was audible is unknown.
- **Pass 3, 1080p frames in the user's Chrome, logged in** (later on 2026-11-08, with the
  user's consent to use their logged-in session):
  - three films: 《压缩即理解》, 《涌现》— 参数的史诗 and 《剃刀》; the player at its 1080P 高清
    setting, which measured 1920×1080;
  - each video kept muted and paused by a script and seeked by it; a local style hid danmaku
    and the player controls; screenshots viewed in the session only, never saved;
  - view-only: nothing liked, followed, posted or downloaded; the upload list looked at again
    (still 26, 《压缩即理解》 newest);
  - recorded as qualities only: no hex values, sizes or counts were measured in this pass.
- **Re-check on 2026-11-09:** the public video data of the three pass-3 films (length,
  upload date, uploader, master size), one film per request through a summarising fetch
  tool, without cookies or login.
- **Limits of pass 3:** paused stills, so motion and easing were not seen at 1080p; for the
  two 4K masters 1080p is a downscale; three films only; audio not heard.

## Key facts
**Channel and catalogue** [V, pages on 2026-11-08, unless tagged]
- About 88.5万 followers. The bio presents an independent story screening room and claims
  Microsoft MVP (the creator's claim, not checked).
- 26 uploads from 2026-10-01 to 2026-11-06. Collections: 脑内宇宙 (20), 有趣一点 (2: the 1:03
  tidal piece and 那一秒), 往事并不如烟 (1: 长安). The other three are Nobel explainers (physics,
  chemistry, physiology or medicine); 光遗传学's page shows a 直击2026诺贝尔奖 collection that
  also lists other uploaders' items.
- Topics: a science, maths or AI idea turned into a life lesson (the 37% rule, tit-for-tat,
  Occam's razor, entropy, scaling laws), Nobel explainers, psychology, one history piece.
- Most played: 《银牌的眼泪》 532.3万, 光遗传学 427.4万, 《剃刀》 266.9万 (rounded display counts).
  Five of the six films opened in pass 2 list 3840×2160 masters; 涌现 lists 1920×1080, and its
  platform watermark reads "幼笙吖", not 比特新语 (unexplained).

**The 2:42 template and the shared bed**
- 18 of 26 uploads run 2:38–2:44 and eleven list exactly 2:42 (162 s) [V].
- The loudness curves of 银牌, 涌现, 光遗传学 and 剃刀 match at zero offset (correlation
  0.56–0.89); all four jump 8–17 dB at about 17.2 s and 93.7 s [V, silent analysis]. They
  very likely share one music bed [U].
- Those are the act breaks: a white flash or light burst and the title at about 17.1 s (in
  银牌 and 涌现 the title condenses out of the white), and a flash or fog wash at about 94 s
  [V, frames].
- Several pages (压缩即理解's among them) show the same "发现《千年之后 (氛围版)》" music label
  (那一秒 shows another track), and one viewer comment says only "this BGM" gets high plays:
  together they suggest films cut to a fixed library track [U].
- Exceptions: 压缩即理解 (3:08) puts its title only at the end; 长安 (4:21) is illustrated.

**Voice, AI statements and labels**
- No CC or AI subtitle tracks in the page data, no voice credit (配音/旁白) in any
  description, and speech-like burned-in captions: most likely captions as narration over
  music, with no voiceover [U; a quiet voice is not ruled out].
- The descriptions of 以牙还牙, 涌现, 银牌 and 光遗传学 say the film was made with Opus (no
  version given) and was not a one-prompt generation; 剃刀 has Opus only in its tags [V].
  > Quoted from https://www.bilibili.com/video/BV12DHQ61EhT/ (accessed 2026-11-08): "本视频使用Opus制作、每个人用AI的方式不同，我这里不是一句话生成。"
- The same text says the films were synced to Bilibili with default settings, declaring neither
  自制 (self-made) nor AI use, and stem from an off-site "vibe知识大赏" where some ranked near
  the top; whether that is a contest or a trend label is not established [V words, U meaning].
- Bilibili's 含AI生成内容 label shows on most pages. Both passes found none on 银牌; 光遗传学
  had none in pass 1 and the label in pass 2, on the same day [V].
- 以牙还牙's description says its data cells come from a real re-run of Axelrod's 1980
  tournament: 15 strategies, 120 matches of 200 rounds, 24,000 rounds [V].

**Press and the wider genre** [S]
- One secondary source, from the account AI价值官, carried by 36氪 and as a self-media copy
  with a disclaimer on 21财经 (not independent). It places 比特新语 in the "Vibe知识" wave set
  off by Claude Opus 5.5 writing HTML/JS animation, so one person can make a film with no
  presenter: the account began in early October, had about 650k followers by 10-20 and gained
  108k on 10-19. It does not say which tool the creator uses.
- It criticises homogenisation: dark backgrounds, glowing lines, particles, similar
  electronic music, beat-synced cuts, recurring topics (prisoner's dilemma, entropy, Murphy's
  law), and a recognisable "模型味" (model flavour).
- A tutorial by 观默 reconstructs a genre pipeline: an HTML canvas page whose `window.draw(t)`
  is a pure function of t, headless browser capture, ffmpeg assembly, a 9-keyframe contact
  sheet before the full render, Python sound effects, music from the CapCut (剪映) library. It
  is the author's own method, not 比特新语's.
- The MiyanoX style guide (at the pin) reverse-engineers other creators' Douyin films (Iwanau,
  Juno, 叁号暗房): backgrounds #050510–#12122a, a 46 px bold Chinese line with a 26 px EB Garamond
  italic English line (Juno's signature), 76–78 BPM synthesised music, no narration [V: file].

**Frame-level style** [V as seen, pass 2 unless noted; hex values and sizes are U estimates]

| Aspect | What the films do |
|---|---|
| Palette | Hue-tinted near-black, never #000: navy #020408–#06080d (压缩), #050306 (银牌), green-black (涌现), #020307 with an indigo haze #110f24 (剃刀). Text #f0f1f4–#f9f9fb, secondary grey-blue about #8090a8. One accent per film (amber #c5a972–#dac362 with cores to #ffe080; cyan #80c0ff in 光遗传学; lime in 涌现); red or pink (#ff4080) only for "wrong" or a limit |
| Background | Radial vignette, centre 2–3× brighter than the corners; grain σ about 1.3/255; atmosphere per film (nebula, spotlight cones, god rays; a faint graph-paper grid in 涌现, pass 1) |
| Type voices | Display: a heavy high-contrast CJK serif (looks like Source Han / Noto Serif SC Heavy), 12–30% of frame height, centred, with bloom. Captions: serif semibold/bold at 5–5.5% of height, one centred line, baseline 88–90% down, one keyword in the glowing accent. Data: monospace, or a bold DIN-like sans for big numbers. Micro labels 1–1.5% of height. English secondary: tiny, all caps, wide tracking. A default, not a rule: 以牙还牙 uses centred or top statement cards, the tidal piece left-aligned text (pass 1) |
| Layout | One centred focal element with 60–70% of the frame empty; left/right splits with a divider; label columns flanking a central object; breadcrumbs top-left, counters top-right |
| Diagram language | 1–2 px glowing strokes and luminous dots; circles as lenses with leader lines to small labels; point clouds and particle swarms; sparse log charts with a highlight band; typeset formulas; interface metaphors (chat bubble, departures board, REC frame, scoreboard digits); glowing outline silhouettes instead of icons |
| Text and diagram | The caption carries the sentence, the diagram one number or one contrast; the key number becomes hero type (快 20 倍, 33%, L ∝ N^-0.076); the caption keyword takes the diagram's accent |
| Motion | Eased-out layout morphs; captions typed or faded on, keyword last; glow ramps, branching growth, rolling counters, stroke-drawn line art; particles assembling and dispersing; camera pushes with depth of field; a fractal zoom. Almost no hard cuts: act breaks are a white flash or fog wash, smaller changes a dissolve through dark of about 0.25 s |
| Pacing | In 银牌's first 80 s a new beat lands every 4–5 s; the second half is slower. Share of half-second steps with no visible change: 涌现 44%, 剃刀 36%, 压缩 29%, 银牌 28%, 光遗传学 14% |
| Narrative (162 s) | 0–17 s cold open on a concrete image · 17.1 s flash and title · concept, history with named people, data · about 94 s flash and the turn · about 145 s the payoff line · 150–162 s end card (title, sometimes a dedication, tiny citations, fade or blur out). The opening image often returns as a bookend |
| End card and covers | Tiny source credits (JPL orbital elements and Toomre & Toomre 1972 in the tidal piece, pass 1), then a letterspaced signature. Covers are louder designed thumbnails (heavy headlines, gradients, HUD banners); 涌现's carries garbled pseudo-labels, possibly image-model output [U] |
| Why it reads as premium [U] | Restraint (one idea per frame, bloom only on the focus), a literary serif against technical mono, thin lines, easing everywhere, structure locked to the music, sources cited, 4K masters. Pass 3 (below) refines this: the restraint is in the focus, the finish around it does the rest |

**Pass 3: the three films** [V: browser 2026-11-08; length, upload date, uploader and master size re-checked 2026-11-09]

| Film | Page | Length | Uploaded | Master |
|---|---|---|---|---|
| 《压缩即理解》 | BV1ot4z66EvR | 3:08 (188 s) | 2026-11-06 | 3840×2160 |
| 《涌现》— 参数的史诗 | BV1vXHr6eEoN | 2:42 (162 s) | 2026-10-04 | 1920×1080 |
| 《剃刀》 | BV1WkJk6VEqA | 2:40 (160 s) | 2026-10-15 | 3840×2160 |

- 涌现's watermark still reads 幼笙吖, while its video data names 比特新语 as the uploader.

**Pass 3: the finish at 1080p** [V as seen on paused 1080p stills; qualities only]

| Channel | What the films do |
|---|---|
| Light | Only the active element is lit: a bright core with a soft halo on the line, node, pen tip or hero numeral that is happening now. Passive structure stays thin and unlit |
| Content density | Real content, nothing placeholder: scrolling mono data tables (rows of date, planet and angle), a real book page with a chapter header, a real chat bubble with a timestamp, citations (author, year, arXiv id), axis ticks with units, breadcrumbs, counters (a step counter, a year counter, an observation count, a zoom factor) |
| Lines and nodes | Smooth curves. Colour changes along a line to encode meaning: in 剃刀's node-link diagram it runs white to warm to red as doubt compounds. Nodes are luminous points, sometimes inside a thin lens ring with a micro citation |
| Life from rules | Motion from rules and simulation: a boids-style murmuration of thousands of points, epicycle traces made of hundreds of observation dots, a fractal zoom labelled as rendered live on the GPU, curves drawn by a glowing pen tip |
| Atmosphere and depth | Nebula haze, star fields, vignette, gradient grounds |
| Type tiers | Four: hero (very large, glowing); caption (serif, one accent keyword); small mono labels and citations; counters in a condensed numeral face |
| Bar charts | A dark track behind each bar, glow on the bar, a dashed outline marking a difference; per category a mini icon (a pixel grid, a waveform), a large CJK label and a small mono EN label |

- **Conclusion** [U, judgement]: the geometry is not complex. What reads as premium is the
  finish: light, content density, micro-type, rule-driven motion and atmosphere. #4's
  round-1 look had none of these channels, which fits the user's verdict that it was too
  simple and crude.
- Pass 2's 360p frames under-read this finish: the micro labels and citations were
  unreadable there, so its premium row leaned on restraint (Gotchas).

## What we adopted / adapted
Principles only, rebuilt in our own grammar. The design round proposed a light, warm "survey
sheet" ground for distance; the user chose "Dark ink map (Recommended)" on 2026-11-08 instead,
so #4 is dark like the genre and differs from it by line grammar and semantic colour.
- One ground for the whole film; colour that means one thing; one focal idea per frame with
  generous empty space; the key number promoted onto the diagram, set in mono.
- Three type voices, text in one fixed place, one persistent world instead of cuts, structure
  on the music's bar grid, a bookend, sources on a plain end card.
- Grounding: results re-plotted from reported numbers, labelled "synthetic · re-plotted · indicative only".
- Disclosure from day one: Bilibili's AI label, and AI use stated in the YouTube description
  (its altered-or-synthetic setting is for realistic content: [youtube-publishing.md](youtube-publishing.md)).

| | Genre | #4 "dark ink map" |
|---|---|---|
| Ground | Near-black about #020408, lifted centre, vignette, grain | Flat #202226 (BT.709 limited Y 45.1), centre may lift, never darker corners, static seeded dither |
| Line | 1–2 px glowing strokes, bloom on the focus | Flat bright ink drawn along its path; solid = built, dashed = proposed, sketch "?" = open; act one in dim tapered sketch lines |
| Colour | One subject accent per film, plus an alarm red | Vermilion only for the one request and its route, green only for sign-off and the return route; risk is hatching, never a new hue; no blue; vermilion never as text |
| Type | Glowing CJK serif titles, a bottom-centre serif caption band | Sans only: IBM Plex Sans (EN), Noto Sans SC (zh), JetBrains Mono (numbers); lower-left notes, one line per language, never below 36 px; a map cartouche for the title |
| Text motion | Typed or faded captions, keyword last | 6-frame wipe in, 6-frame fade out, never a typewriter |
| Transitions | White flash or fog wash at act breaks, dissolves, depth-of-field pushes | One 3840×2160 transit map under a translate/scale camera on downbeats; no cuts, blur or particles; two declared rests instead of flashes |
| Sound | A shared bed (likely a library track) whose jumps mark the act breaks | An original synthesised score, 90 bpm on a 66-bar grid, with a motif and a key change at the turn |

The table records round 1, which the user did not approve on 2026-11-08 ("too simple and
crude"). From pass 3, #4's look rework takes principles only, rebuilt in its own grammar;
the round-2 look itself is set in `videos/super-agent`, not here:
- **Light where it means** (the user's decision): light only where a live process is, never
  a default glow on structure.
- **Real micro-print as texture** at 18 px or more (the user's decision): our own true
  labels, data and citations, never placeholder. Text meant to be read keeps the
  1/30-of-height floor (36 px at 1080p).
- **Curves and material** instead of glowing lines.

## What we deliberately did NOT adopt, and why
Their identity is theirs, and the glow-on-navy package as a whole is what the press calls
模型味. The plan has the `frame-critic` agent review #4's frames against this list.
- **Identity:** the name 比特新语 and its letterspaced signature; the end-card layout (title,
  credit line, signature); the collection names and the end-card phrase 一时兴起; 《X》
  single-concept titles; the bio's phrasing; the dedication line "致/献给每一个…的人".
- **Title lockups:** a glowing heavy CJK serif title of 2–5 characters as opener and end card,
  with a thin rule and a tiny wide-tracked English line; gold-gradient cover headlines;
  half-glowing numerals.
- **Timing marks:** the white-flash title at about 17 s, 2:42 as a target length, and their
  music bed or any track they use.
- **The caption band:** a bottom-centre cream serif line with a glowing accent keyword;
  typewriter captions.
- **The package:** amber or gold on navy with bloom, particles, gold dust, god rays,
  depth-of-field pushes and vignette; giant ghost background words; 涌现's lime-terminal look;
  长安's paper-cut Tang illustration.
- **Compositions and motifs:** spotlit podiums with a ghost fourth place; the "到家了吗?"
  chat-bubble tree and its story clock; the 2n-versus-number-grid gag; the pixel-tile cat
  that becomes 猫; the epicycle elephant; the zebra-crossing bookend; the alga in god rays; the
  departures board; the particle black hole with a formula stream; the 8:17 clock; the runner
  on a checkerboard with a HUD; the rolling parameter counter; grids of coloured squares.
- **Their copy:** taglines, lines and topic narratives.
- **Their pixels and sounds:** no frame, sprite, cover or audio enters the repo, not even as a
  lookdev reference.
- **The third-party spec's look**, including Juno's Chinese-plus-italic-English subtitle
  signature. The figures of the article #4 explains are a separate do-not-copy list
  ([deepseek-superagent-2026-11.md](deepseek-superagent-2026-11.md)).
- **Pass 3 changes none of the above.** #4 still refuses the glow-on-navy package, serif
  lockups, particles, nebula and vignette. The compositions pass 3 saw are theirs too: the
  murmuration of points, the observation-dot epicycle traces, 剃刀's doubt-coloured node
  chain, the fractal zoom labelled as live on the GPU, the scrolling date · planet · angle table.

## Gotchas
- Defaults drift: AI-written 2D scenes tend towards glow, particles and gold on navy unless the
  art direction forbids them in writing [U]; prove the distance on lookdev stills, at thumbnail size.
- `aiv qa` flags any 0.5 s with 98% of pixels below limited Y 37.9 (blackdetect `pix_th=0.10`):
  sparse scenes on a ground as dark as theirs (Y about 19) would trip it; #4's sits at 45.1.
- They master in 4K; #4 renders 1080p, where its thinnest planned strokes are 2 px and ~~a
  dither tile handles banding~~ (2026-11-08: a DOM dither tile only broke up the band edges;
  round 2 dithers once at the output, `motion-graphics-2d-2026-11.md`): check line weight and
  gradients at delivery size.
- A summarising fetch can swap rows: pass 1 put 银牌 at 02:51, the 熵增 entry (银牌 runs 162 s);
  re-read numbers in a browser. A watermark can also differ from the uploader (涌现).
- In a browser study the watch page can autoplay before an injected mute script runs: mute
  the tab or the system output before loading pages.
- Judge the finish at 1080p or more. Logged out, the player gave 360p (plus a 30-second
  1080p trial), where micro labels and citations cannot be read; pass 3 needed the
  user's logged-in session for the 1080P setting.

## Not read
- Any interview or process statement beyond the descriptions; the creator's off-site accounts.
- Motion at full resolution (pass 3 saw paused 1080p stills, not playback), the 4K
  masters, and the sound itself (光遗传学's 17 s break was checked by audio only); 那一秒's formula stream beyond what was legible (F = m d²x/dt², t → −t, a struck-out
  ΔS ≤ 0, a 10^10^82 年 counter), so pass 1's Einstein field equations stay unconfirmed.
- 1080p frames of any film beyond the three of pass 3 (银牌 and 光遗传学 were seen at 360p only);
  frames of 以牙还牙, 那一秒 and the tidal piece beyond their sprites; frames of 37法则 and
  拼尽全力 (covers only); the covers of 压缩即理解 and 光遗传学; a Bilibili post that returned a
  CAPTCHA (not retried); 观默's X post (its jxxy.net mirror was read).
- The films the MiyanoX guide is based on, and its render, music and QA scripts.
- Bilibili's creator rules (AI label, 自制 declaration, covers, collections): planned as
  `references/bilibili-publishing.md` before #4's release; until then, declare AI use
  ourselves, since the label can be missing when an uploader does not.
