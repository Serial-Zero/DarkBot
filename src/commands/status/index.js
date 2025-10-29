/** @typedef {import('../types.js').CommandModule} CommandModule */

import { afkCommand } from './afk.js';

/** @type {CommandModule[]} */
export const statusCommands = [afkCommand];

