/** @typedef {import('../types.js').CommandModule} CommandModule */

import { leaderboardCommand } from './leaderboard.js';

/** @type {CommandModule[]} */
export const sfwCommands = [leaderboardCommand];
