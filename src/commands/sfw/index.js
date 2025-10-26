/** @typedef {import('../types.js').CommandModule} CommandModule */

import { afkCommand } from './afk.js';
import { leaderboardCommand } from './leaderboard.js';
import { xpCommand } from './xp.js';

/** @type {CommandModule[]} */
export const sfwCommands = [afkCommand, leaderboardCommand, xpCommand];
