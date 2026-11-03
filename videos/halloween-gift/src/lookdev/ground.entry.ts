// Lookdev entry for the ground family (terrain, path, grass, rocks, roots, webs, leaves):
// pnpm aiv still halloween-gift --entry src/lookdev/ground.entry.ts --composition GroundHero --frames 0
import { registerRoot } from 'remotion';
import { GroundRoot } from './Ground.tsx';

registerRoot(GroundRoot);
