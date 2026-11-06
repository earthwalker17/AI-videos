# Script: A Halloween Gift

No narration: the film is told in pictures, sound and a few printed words. Every printed
string of the story is listed here per language, with its cue in `src/cues.ts` and its hold
(set dressing such as the small stones' epitaphs is listed in its own row). On screen, English
and Simplified Chinese appear together (the user's choice); the subtitle files
(`publish/captions/en.srt`, `zh-Hans.srt`) carry the words per language and translate what is
printed in one language only.

The Chinese strings are checked by the user (a fluent reader) before the review approval
(series rule, `series/festivals/SERIES.md`).

## en

| Beat | Time | Narration | On screen |
|---|---|---|---|
| Title | 0:00–0:04.5 | none | *A Halloween Gift* (the book's cover, foil) |
| Valley | 0:06.5–0:11.5 | none | Caption (two lines): *On Halloween night, / Clawd set out with a gift.* |
| Graveyard | 0:12–0:18 | none | The big stone: *RIP / IN PEACE*; smaller stones carry short invented epitaphs (set dressing: `src/world/Graveyard.tsx` EPITAPHS) |
| Lane | 0:20–0:23.5 | none | Caption: *The last house was still awake.* |
| Door | 0:24–0:30 | none | (the couplets and 福 are in Chinese only, see zh-Hans) |
| Gift | 0:33.5–0:36 | none | The pop-up card, face A: *A GIFT FOR YOU* |
| Email | 0:37–0:42 | none | Face B, under our own mark and the name *Clawd*: *Hello,* · *Our spirits sensed suspicious signals haunting your account, against our Trick-or-Treat Policy.* · **Your Claude account has been buried.** · *To appeal, knock three times at midnight.* · **Happy Halloween!** · *Regards* · *The Graveyard Shift*; a button *Appeal · 申诉*; the seal *封号*. The read path (`WORDS.email`): *Hello, Your Claude account has been buried. Happy Halloween! Appeal* |
| End | 0:51.5–1:00 | none | *A Halloween Gift* · *The End* · *Fan parody. Not affiliated with Anthropic. Fictional email.* |

## zh-Hans

| Beat | Time | Narration | On screen |
|---|---|---|---|
| Title | 0:00–0:04.5 | 无 | 万圣节礼物 |
| Valley | 0:06.5–0:11.5 | 无 | 万圣节之夜，Clawd 带着礼物出门了。 |
| Lane | 0:20–0:23.5 | 无 | 最后一户人家，还没睡。 |
| Door | 0:24–0:30 | 无 | 门上：福（正贴）；横批 一路绿灯（自左向右），故上联（左）代码千行一次过，下联（右）账号百年永不封；金字红纸 |
| Email | 0:37–0:42 | 无 | 印章：封号；按钮：申诉 |
| End | 0:51.5–1:00 | 无 | 万圣节礼物 · 完 · 粉丝恶搞，与 Anthropic 无关，邮件纯属虚构。 |

## Notes on the words
- Subtitle-only translations: the couplet in `en.srt` ("A thousand lines of code: / passed
  on the first try." · "Never banned in a hundred years. / Green lights all the way."); the gift
  card and the email's read path in `zh-Hans.srt` (送给你的礼物; 你的 Claude 账号已被埋葬 /
  万圣节快乐！).
- The email parodies the kind of account-suspension notice users report, in our own words
  (chosen with the user at the lookdev checkpoint, 2026-11-06): its layout and the generic
  phrase "suspicious signals" evoke it, but no sentence is reordered from a real email, the
  mark is our own pumpkin starburst, the sender is a fictional "Graveyard Shift", and there is
  no logo, wordmark, address or real link. "Claude" appears only as the product's name, in
  plain text.
- 封号 is the word Chinese users use for an account ban; on the letter it is a seal, the way
  a document is stamped. 完 on the end card means "the end" (and, read as 完了, "done for").
- The couplet is a programmer's "flag" joke (立flag): wishing "the code passes on the first
  try / the account is never banned in a hundred years" is exactly the kind of wish that
  tempts fate. The 福 hangs upright, as on a main door. The 横批 reads left to right, so the
  上联 hangs on the left (the traditional right-to-left 横批 would put it on the right); the
  characters are gold on red paper so they read at night.
