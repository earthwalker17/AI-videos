# Parodying a company's notice — trademark guidelines, fair use, YouTube policy (2026-11)

| | |
|---|---|
| Upstream | https://www.anthropic.com/legal/trademark-guidelines · https://www.copyright.gov/fair-use/ · https://www.inta.org/fact-sheets/fair-use-of-trademarks-intended-for-a-non-legal-audience/ · https://support.google.com/youtube/answer/2801947 · https://support.google.com/youtube/answer/2801973 · https://support.google.com/youtube/answer/9783148 · https://www.rfc-editor.org/rfc/rfc2606 · https://raw.githubusercontent.com/anthropics/skills/main/skills/brand-guidelines/SKILL.md |
| Pin | Anthropic Trademark Guidelines effective 2024-08-01; pages as accessed |
| Licence | Proprietary terms and help pages: facts paraphrased only; RFC 2606: IETF trust (facts) |
| Accessed | 2026-11-04 |
| Stale after | 2027-05-01, or before any upload whose gag uses another company's brand |

## What it is
What decides how closely a fan parody may imitate a real company's notice (here: the
account-suspension email users receive from Anthropic), from the company's own trademark
guidelines, US fair-use and trademark doctrine as explained by the US Copyright Office and
INTA, and YouTube's impersonation and spam policies. Not legal advice.

## Why it matters here
*A Halloween Gift*'s punchline is a parody of that email. The film is monetised and public;
the repo's rule (`docs/LICENSING.md`) already bans logos, wordmarks and verbatim notices. This
note records why, and what may be evoked instead.

## Key facts
**Anthropic's trademark guidelines** [S: read by a research agent at the primary source]
- They cover names, logos and other brand elements, allow use only as Anthropic specifically
  permits (approved in advance, revocable), forbid altering the marks (colour, font,
  proportion) and any implied sponsorship or affiliation.
- They do not mention parody, commentary or fan works: they grant no parody licence. A
  parody relies on legal defences, so it should leave the mark out entirely rather than use a
  modified version.
- Anthropic's published brand skill lists its palette (orange #d97757, dark #141413, light
  #faf9f5 and others). Clawd's own body colour (#D77757) is the mascot's, used as parody.

**Fair use and trademark** [S]
- Copyright fair use favours transformative uses that add something new and do not
  substitute for the original; a disclaimer alone does not create fair use.
- Nominative fair use allows naming a product in text ("your access to Claude") when needed,
  using no more than necessary (the word, not the logo) and implying no sponsorship.
- A parody must say at once that it is the original and that it is not; it loses its special
  protection when used as a source identifier for one's own goods (*Jack Daniel's v. VIP*, 2023):
  keep the company's marks out of channel names, merchandise and thumbnail branding.

**YouTube** [S]
- The impersonation policy forbids deceptively copying a company's branding (including near
  colour schemes); parody is weighed, and fan channels must identify themselves.
- The spam policy treats a video pretending to be a real company as a scam; misleading titles
  and thumbnails are banned.
- AI-use disclosure is not required for clearly non-realistic animation.

**What makes it read as parody, and what raises risk** [S]
- Lower risk: an on-screen and description notice ("Fan parody. Not affiliated with
  Anthropic."), rewritten wording with absurd details, fake addresses on reserved domains
  (`.example`, `.invalid`, RFC 2606), a stylised (non-photoreal) rendering.
- Higher risk: the exact logo or wordmark, the exact palette, verbatim or lightly reordered
  sentences, real sender addresses or URLs, a crop that could pass as a real screenshot.

## What we adopted / adapted
- The email evokes the format (warm off-white page, rounded white card, a sans body, underlined
  links, a sign-off) with **our own mark** (a Halloween starburst, hue shifted from #d97757) and
  the name "Clawd" in the film's storybook serif; rewritten Halloween wording; no real URL or
  address; it lives inside a painted 3D letter, never as a bare screenshot; the non-affiliation
  notice stays on the end card, in the README and the description.

## What we deliberately did NOT adopt, and why
- The Claude logo or wordmark, Anthropic's exact palette, and the email's sentences, even
  reordered: the guidelines forbid altered marks, and closeness raises impersonation risk.

## Gotchas
- A parody that looks like a screenshot can be cropped and shared as genuine: keep it visibly
  part of the storybook world.

## Not read
- The guidelines PDF in full by a person; any jurisdiction other than the US and the EU summary.
