/** @typedef {import('./types.js').CommandModule} CommandModule */

import { adminCommands } from './admin/index.js';
import { imageCommands } from './images/index.js';
import { inviteCommands } from './invites/index.js';
import { leaderboardCommands } from './leaderboard/index.js';
import { levelingCommands } from './leveling/index.js';
import { statusCommands } from './status/index.js';

/** @type {CommandModule[]} */
export const commandModules = [
  ...imageCommands,
  ...adminCommands,
  ...inviteCommands,
  ...leaderboardCommands,
  ...levelingCommands,
  ...statusCommands,
];

/** @type {Map<string, CommandModule>} */
export const commandMap = new Map(
  commandModules.map((command) => [command.data.name, command]),
);
