// Fixture entry that lazily imports a component outside the input roots (../outside): the bundle
// check must name it although webpack folds it into a concatenated module with no resource.
import { registerRoot } from 'remotion';
import { FixtureRoot } from './Root.tsx';

export const later = () => import('../outside/Lazy.tsx');
registerRoot(FixtureRoot);
