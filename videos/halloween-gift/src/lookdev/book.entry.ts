// Lookdev entry for the book family (the storybook, the desk, the room's light):
// pnpm aiv still halloween-gift --entry src/lookdev/book.entry.ts --composition BookDesk --frames 0
import { registerRoot } from 'remotion';
import { BookRoot } from './Book.tsx';

registerRoot(BookRoot);
