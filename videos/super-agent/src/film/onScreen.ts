// The retired round-1 renderers (src/film, src/lookdev/StillScenes.tsx) still read the cue sheet's reveals from here;
// the module itself lives with the Register Desk (desk/onScreen.ts) since session 4.
export { cueReveal, cueShown, narrationAt } from '../desk/onScreen.ts';
