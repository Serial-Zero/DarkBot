/** @typedef {import('../types.js').CommandModule} CommandModule */

import { nsfwExampleCommand } from './nsfwExample.js';
import { rule34Command } from './rule34.js';

/** @type {CommandModule[]} */
export const nsfwCommands = [nsfwExampleCommand, rule34Command];
