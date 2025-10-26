/** @typedef {import('../types.js').CommandModule} CommandModule */

import { leaderboardCommand } from './leaderboard.js';
import { xpCommand } from './xp.js';

/** @type {CommandModule[]} */
export const sfwCommands = [leaderboardCommand, xpCommand];
