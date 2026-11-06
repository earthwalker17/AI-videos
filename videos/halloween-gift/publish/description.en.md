# Title and description as uploaded (YouTube, 2026-11-06)

**Title:** I Made a Halloween 3D Film with Opus 5.5 🎃

A little Halloween story, built entirely with Opus 5.5 in Claude Code.

Meet Clawd, a tiny witch delivering an unexpected Halloween gift: an account suspension email.

But this project was actually an experiment in how far AI-assisted, code-driven animation can go.

The entire 1-min film was built through Remotion 4, React Three Fiber, and Three.js.
The storybook, terrain, twisted trees, graveyard, iron gates, castle, characters, lighting, and camera animation were all created in code.
The soundtrack is also code-generated: an original D-minor waltz with synthesized sound effects, built in TypeScript using a sampler and orchestral samples.

The first version was technically complete, but the visuals were disappointing. The models were primitive, the environment felt flat, and the animation lacked the atmosphere I wanted.

So I did a full visual polish pass.
We rebuilt the environment around a stronger reference, added richer geometry and materials, redesigned the camera movement into one continuous journey, and introduced painterly post-processing.

The biggest improvement came from repeatedly reviewing actual rendered frames rather than trusting the code is correct.
We also ran multiple rounds of adversarial visual critique, checked frame consistency across render chunks, and validated the final video through automated QA.

This was the first real video produced through my new AI Videos project.

Rather than building a separate system for every film, I'm gradually developing shared infrastructure for rendering, audio production, QA, and reproducible releases.
It's still an early experiment, but I hope the code and workflows can be useful to others working with AI and creative coding.

GitHub: https://github.com/earthwalker17/AI-videos

This is an unofficial fan parody. Claude, Claude Code, and Clawd belong to Anthropic. The fictional suspension email does not refer to any real account or person. Not affiliated with or endorsed by Anthropic.

#claudecode #halloween #creativecoding #threejs #remotion #aianimation
