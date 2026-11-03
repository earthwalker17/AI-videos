// The lookdev entry: compositions for the V2 picture's lookdev (the probe, asset turntables).
// Rendered with `pnpm aiv still halloween-gift --entry src/lookdev/index.ts --composition <id>`;
// never the film's entry (video.json `entry` stays src/index.ts).
import { registerRoot } from 'remotion';
import { LookdevRoot } from './LookdevRoot.tsx';

registerRoot(LookdevRoot);
