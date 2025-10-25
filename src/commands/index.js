/** @typedef {import('./types.js').CommandModule} CommandModule */

import { adminCommands } from './admin/index.js';
import { nsfwCommands } from './nsfw/index.js';
import { sfwCommands } from './sfw/index.js';

/** @type {CommandModule[]} */
export const commandModules = [
  ...nsfwCommands,
  ...adminCommands,
  ...sfwCommands,
];

/** @type {Map<string, CommandModule>} */
export const commandMap = new Map(
  commandModules.map((command) => [command.data.name, command])
);
