# Title and description (proposed; the creator sets the final wording at upload)

**Title:** Who Routes the Agents? The Super-agent Design in 3 Minutes

**Alternatives:** One Router, Many Workers: The DeepSeek Harness Team's Super-agent Design, Explained · Who Routes the Agents? (A code-made explainer)

Each paragraph below is one line, as YouTube shows it. One sentence depends on the order of release and has two versions: see the note at the end.

When you run many AI agent sessions at once, someone has to decide which one gets what, and remember what each of them holds. Today that someone is you.

This film explains "Exploring Super-agent Design: Towards a More Autonomous Agent System", an article from the DeepSeek Harness team (its English version, a machine translation of a Chinese original). Its design puts one long-lived Router above isolated Workers: the Router routes and never executes, a Worker gets one whole task and its own context, and only the Router answers you.

Can one Router take all that? The film draws four answers from the article:
1. Few events reach it: plain code filters first, then a model judges.
2. Follow-ups go straight to the Worker that is on the task. The Router sees them, but does not decide again.
3. What does arrive waits and enters together, up to a limit per call.
4. Its context works like a cache: summaries stay in view, details wait behind IDs.

It also shows what the authors measured and how thin that evidence is (a synthetic test, five runs per design, indicative only). Against one session with a subagent tool that was told to delegate first, the slowest tasks took about half the time and typical ones were about 10% faster. The price was 2 to 4 times the cache-read tokens of that one session: about 2 times when it was told to delegate first, about 4 times when it was left to choose.

Running in the cloud and a check for stuck Workers are proposed, and neither is in the public prototype. Long memory, security, stepping in mid-task and more than one Router are open questions.

The article describes a design, not a product. A public research prototype builds part of it, and the film marks two places where the prototype differs.

Source (an X article of about 6,900 words; X may ask you to log in): https://x.com/i/article/2116829218935857152
The authors' prototype (the film read it at commit 8c32a9d): https://github.com/deepseek-ai/dsh-superagent-prototype

How it was made: no camera, no editor, no voice. Every frame is drawn by code on one WebGL canvas, and the music is synthesised by code, both written with Claude Code (Claude Fable 5.2) under my direction. There is no generative image, video, music or voice model in it. The tooling is public, and this film's source and its facts file with every claim's reference follow with the release: https://github.com/earthwalker17/AI-videos

An independent explainer. Not affiliated with, sponsored by or endorsed by DeepSeek. Any mistake in it is mine, not the authors'.

0:00 Who routes the agents?
0:16 The Super-agent design: one Router, many Workers
0:48 One Router for all this? 1. Two gates
1:07 2. Follow-ups skip its decision
1:20 3. Arrivals enter together
1:38 4. Details wait behind IDs
1:50 The authors' test
2:10 Proposed and open
2:20 You decide, you sign off

#aiagents #agents #deepseek #llm #creativecoding #webgl #claudecode

---

**Note on the release order.** The sentence "The tooling is public, and this film's source and its facts file ... follow with the release" is true if the film is uploaded before this repository's main branch is pushed (the order used for the last film). If main is pushed first, use instead: "The source, the facts file with every claim's reference, and the tooling are public: https://github.com/earthwalker17/AI-videos". The text above this rule is the description; this note is not part of it.
