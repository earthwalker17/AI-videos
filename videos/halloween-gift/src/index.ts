// The Remotion entry (video.json `entry`): registers the compositions. The engine bundles this
// file with Remotion's bundler and renders the composition video.json names ('Main').
import { registerRoot } from 'remotion';
import { Root } from './Root.tsx';

registerRoot(Root);
