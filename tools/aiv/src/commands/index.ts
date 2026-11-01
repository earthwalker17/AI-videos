// Every aiv command, in the order `aiv --help` lists them. A new command is one file in this
// folder plus one entry here.
import type { Command } from '../command.ts';
import { doctor } from './doctor.ts';
import { heavy } from './heavy.ts';
import { post } from './post.ts';
import { qa } from './qa.ts';
import { release } from './release.ts';
import { render } from './render.ts';

export const COMMANDS: Command[] = [doctor, render, post, qa, release, heavy];
