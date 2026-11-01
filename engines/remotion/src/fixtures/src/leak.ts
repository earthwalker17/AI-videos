// Fixture entry that pulls in a file outside the input roots (the engine's package.json): the
// bundle check must refuse it, naming the file.
import { registerRoot } from 'remotion';
import pkg from '../../../package.json';
import { FixtureRoot } from './Root.tsx';

if (!pkg.name) throw new Error('unreachable');
registerRoot(FixtureRoot);
