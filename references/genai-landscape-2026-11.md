# Generative AI for video assets — landscape, rights, provenance (2026-11)

| | |
|---|---|
| Upstream | https://developers.openai.com/api/docs/deprecations · https://ai.google.dev/gemini-api/docs/deprecations · https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/terms · https://suno.com/terms · https://elevenlabs.io/music-terms · model licences linked inline · https://cv.iptc.org/newscodes/digitalsourcetype/ · https://github.com/contentauth/c2pa-python |
| Pin | Dated snapshots of 2026-11-01 (Gemini pricing page last updated 2026-10-30; Gemini Additional Terms effective 2026-03-23; Suno revised 2026-08-10, effective 2026-09-03; ElevenLabs Music Terms 2026-10-09; c2pa-python v0.38.3) |
| Licence | Google developer docs CC BY 4.0 (code Apache-2.0); OpenAI, Suno, ElevenLabs, Google terms pages proprietary (facts only, short quotes); model licences as stated per model |
| Accessed | 2026-11-01 |
| Stale after | **2026-12-01**. Several dates below fall inside a month (Gemini TTS previews end 2026-11-17; GPT Image 1.5 removed 2026-12-01). Re-check every provider page before any paid run. |
| Status here | Plan: gen-AI outputs are immutable, content-addressed inputs with a sidecar and a rights class; the tool is deferred to the first hybrid video. Spending money needs the maintainer's approval or a preset budget. |

## What it is
The state of hosted and open-weight generators for video, image, voice and music, the
terms that decide whether their output can appear in a monetised, worldwide YouTube video
and in a public repo, and the provenance practice that keeps such assets reproducible.

## Why it matters here
Hosted models are retired faster than a 50–100 video series is made, and output rights
differ by plan tier. A video must never depend on calling an API again to rebuild.

## Key facts — model churn
- OpenAI [V]: Sora 2 and the Videos API removed 2026-09-24 (announced 2026-03-24; no replacement listed). `gpt-image-1` shut down 2026-10-23. `gpt-image-1.5`, `gpt-image-1-mini`, `chatgpt-image-latest` removed **2026-12-01** (successors `gpt-image-2.5-sunburst` / `-flare`). `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` removed 2027-01-06 (successor `gpt-realtime-2.1-mini`).
- Google Gemini API [V]: every Veo model shut down by 2026-10-22 (successor `gemini-omni-1.1-flash`); Imagen 4.0 shut down 2026-08-17 (successor `gemini-nano-banana-2.1`); `gemini-2.5-flash-preview-tts` and `gemini-3.1-flash-tts-preview` end **2026-11-17** (successor `gemini-3.8-flash-tts`); `lyria-3.5` (2026-09-03) has no shutdown date.
- Gemini pricing snapshot [V]: Omni Flash video output ~$0.10/s at 720p (paid tier only); `gemini-3.1-flash-image` ~$0.067 / $0.101 / $0.151 per image at 1K / 2K / 4K; `gemini-3.8-flash-tts` $0.50 per 1M input and $9 per 1M audio-output tokens until 2026-12-31, doubling from 2027-01-01; Lyria 3.5 $0.08 per song. Free tiers are used to improve Google's products.
- Leaderboard snapshot [S, approximate ranks via a summariser]: Artificial Analysis text-to-video with audio, 2026-11-01: Wan 3.0, Utopai X, MiniMax H3, Seedance 2.5, FLUX 3 Max, HeyGen Video 1, … Gemini Omni Flash 1.1 at #10. Leaders change every few months; model choice belongs in config.
- Reference host class (Intel iGPU, ~8 GB RAM) cannot run video/image diffusion locally; Kokoro-82M runs on CPU [V].

## Key facts — terms and licences
- Google Gemini API Additional Terms [V]: Google does not claim ownership of generated content but may generate similar content for others; unpaid tiers use prompts/responses to improve products with human review; 18+; no building competing models. Veo results were stored server-side for only 2 days; Gemini image, Omni and Veo outputs carry SynthID.
- OpenAI [S]: users own output (Terms of Use effective 2026-01-01; the page returned 403 on 2026-11-01). The TTS guide requires telling listeners the voice is AI-generated [V].
- Suno [V]: Free/Basic output is for lawful, personal, non-commercial use only; Pro/Premier get an assignment, but commercial use is limited to output downloaded through approved channels within its conditions of access; users may not remove fingerprints, watermarks or metadata; no warranty that copyright vests in output.
- ElevenLabs Music [V]: standard media rights exclude film, TV, radio and Studio Games; Free has no downloads and requires attribution; Free and Starter may not distribute to streaming platforms; "music libraries" and model resale prohibited on self-serve plans; prompts may not name artists, songs, labels or substantial lyrics. General help: Free is non-commercial with an `elevenlabs.io`/`11.ai` credit in the title; beta-service output is non-commercial.
- FLUX [dev] Non-Commercial License v2.0 [V]:
  > Quoted from https://raw.githubusercontent.com/black-forest-labs/flux2/HEAD/model_licenses/LICENSE-FLUX-DEV (accessed 2026-11-01): outputs may be used "for any purpose (including for commercial purposes)"
  while the model itself is licensed only for non-commercial, non-production use, with content filtering or human review and AI disclosure duties. Whether hosted FLUX-dev endpoints carry commercial model-use rights is [U].
- Tencent Hunyuan Community License (HunyuanVideo-1.5) [V]:
  > Quoted from https://raw.githubusercontent.com/Tencent-Hunyuan/HunyuanVideo-1.5/HEAD/LICENSE (accessed 2026-11-01): "DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"
  and output may not be displayed outside the licensed territory, which a worldwide YouTube video cannot satisfy.
- Open-weight licence matrix (Hugging Face tags and LICENSE files) [V]:
  - Apache-2.0: Wan2.2 (T2V-A14B, TI2V-5B, Animate), Qwen-Image / Qwen-Image-2512, FLUX.1-schnell, FLUX.2-klein-4B, Kokoro-82M, CosyVoice2-0.5B, Fun-CosyVoice3-0.5B-2512, ACE-Step v1. MIT: ACE-Step 1.5.
  - Non-commercial weights: F5-TTS (code MIT, weights CC-BY-NC-4.0), MusicGen (CC-BY-NC-4.0), FLUX.2-dev and FLUX.2-klein-9B (FLUX [dev] NC v2.0).
  - Thresholds: LTX-2.x Community License (2026-08-11) needs a paid licence at ≥ $10M annual revenue; IndexTTS-2 (bilibili Model Use License) above 100M MAU or RMB 1B revenue. Stable Audio Open: Stability community licence. MiniMax-H3: custom.
- edge-tts [V]: an unofficial client for Microsoft Edge's online read-aloud service; its README notes Microsoft restricts custom SSML; GitHub reports the licence as NOASSERTION while one report read LGPLv3 in its LICENSE file; nothing grants rights to the audio. lemo-opuscar excludes its Edge-TTS tracks from CC BY. Scratch narration only.
- Two "kokoro" packages [V]: hexgrad `kokoro` 0.9.4 (PyTorch, Python < 3.13) vs `kokoro-onnx` 0.6.1 (Python < 3.14, Windows-native via `espeakng-loader` 0.2.4 win wheel). espeak-ng itself is GPL-3.0.
- US copyright [S]: the Supreme Court denied certiorari in Thaler v. Perlmutter (2026-03-02), leaving the human-authorship requirement; a blanket CC BY over purely AI-generated media claims rights that probably do not exist.
- EU AI Act Art. 50 [S, secondary sources only]: deepfake disclosure by deployers applies since 2026-08-02 (lighter for artistic or fictional works); the machine-readable marking deadline for systems already on the market was reportedly moved to 2026-12-02.
- YouTube disclosure and monetisation rules: see `youtube-publishing.md`.

## Key facts — provenance and cost practice
- Rights classes (adopted in `docs/LICENSING.md`) [U as policy]: **A** openly redistributable (code renders, Apache-weight outputs, paid Google/OpenAI outputs) → CC0 / no rights asserted; **B** redistributable with conditions (attribution, AI disclosure; e.g. FLUX-dev outputs, CC BY third-party content); **C** final video only, bytes kept private, sidecar committed (Suno, ElevenLabs music/voice, stock); **D** blocked for this channel (HunyuanVideo, NC weights, free tiers, beta services).
- Sidecar fields worth recording per asset [U as design]: asset sha256/bytes/media type/dims; provider, surface, model requested **and** model resolved, SDK version, request id, created time, seed and whether the API honours it, params, prompt template ref + hash + rendered text + any provider-revised prompt, input hashes, candidate index, request hash, repo commit + dirty flag; cost with price source and date; terms ref with date, plan tier, commercial flag, attribution, redistribute-in-repo flag, rights class, SPDX; IPTC digital source type, watermarks, whether C2PA was in the original; disclosure flags (realistic, real person, real place/event, AI music); storage location.
- Request hash = sha256 of canonical {provider, resolved model, rendered prompt, params, input hashes, seed}; a cache hit skips the paid call. Seeds do not make hosted APIs reproducible (ignored seeds, server-side prompt rewriting, silent alias changes): reproducibility means a replayable request plus cached bytes [V reasoning from provider behaviour; U per provider].
- Download long-running results immediately (Veo kept them 2 days) [V].
- IPTC `digitalSourceType` vocabulary [V]: `trainedAlgorithmicMedia` (created with generative AI), `compositeWithTrainedAlgorithmicMedia` (edited with generative AI), `compositeSynthetic` (composite including generative elements), `algorithmicMedia`, `digitalCreation`. A three.js render is algorithmic/digital creation; a generated clip is trained-algorithmic; a final mixed video is composite.
- C2PA [V]: c2pa-python v0.38.3 (MIT OR Apache-2.0) Builder intents fill in the `c2pa.created` action with an IPTC source type; c2patool 0.27.22; spec 2.4 per secondary sources. FFmpeg/Remotion re-encodes strip embedded metadata, so the external sidecar is the source of truth. ComfyUI's SaveImage embeds the graph as PNG tEXt (`prompt`, `workflow`), a precedent but GPL code.
- Cost control: an append-only per-video call log (including failures and moderation blocks); "plan" (estimate, no network) vs "run with spend" requiring approval or a preset budget with a hard per-run cap [U as design].
- Secrets: see `licensing-tooling.md` (gitleaks custom rules; Google API keys are not push-protected by GitHub).
- Storage for generated media: see `github-storage-limits.md` (Hugging Face datasets/buckets, Cloudflare R2, Releases; never LFS).
- Prompt guides that may be adapted: Google's video/Omni/image/Lyria/speech guides (CC BY 4.0, change often: dated notes), OpenAI Cookbook prompting notebooks (MIT, @`f5819076643583e2c2a77268e7fe522e927499d0`), Wan2.2 prompt-expansion system prompts (Apache-2.0, `wan/utils/system_prompt.py` @`1ea34ff48f87168174e12956e200b1d908b1c5ff`). Runway, Kling, Seedance and ElevenLabs guides: proprietary, link only [V].
- SDKs drift: on 2026-11-01 an existing install had google-genai 1.60 vs latest 2.34.0, openai 2.11 vs 3.42.0, dashscope 1.16 vs 2.0.3; pin per project and record the SDK version in each sidecar [V].

## What we adopted / adapted
- Gen-AI outputs as immutable, content-addressed inputs with a sidecar and a rights class A–D (tooling deferred to the first hybrid video).
- `prompts/<modality>/` versioned templates, created at first use.
- `LicenseRef-AI-Output` for gen-AI output in the REUSE matrix (later).
- Spending is a human decision (CLAUDE.md rule).
- `.claude/settings.json` denies reading `.env`.

## What we deliberately did NOT adopt, and why
- A `tools/genai` provider framework now: no video needs it yet.
- Committing provider music or voice files (class C) or any class-D output.
- C2PA-signing YouTube uploads by default: a C2PA-triggered AI label cannot be changed.
- DVC or Git LFS for media: too heavy / bandwidth billed to the owner.
- Relying on seeds for reproducibility.

## Gotchas
- An agent retry loop on per-second video billing burns money fast without a request-hash cache and a hard cap.
- Free tiers train on inputs: never send unreleased scripts or others' material.
- Voice cloning of anyone without consent breaks provider policies and YouTube's realistic-person rules; prompts naming real artists are banned by ElevenLabs.
- Do not strip provider watermarks or metadata from source files (Suno forbids it).

## Not read
Kling, Runway, Seedance (BytePlus ModelArk) and MiniMax API terms (JS-rendered or 403; secondary summaries conflict). OpenAI Terms of Use at source. EU AI Act Official Journal text and the "Digital Omnibus" regulation number. Commercial coverage of hosted FLUX-dev. DashScope CosyVoice / Qwen-TTS and Azure Speech commercial terms. China's AI-content labelling rules (relevant only for cross-posting). Exact API key formats for custom secret rules.
