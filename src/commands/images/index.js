/** @typedef {import('../types.js').CommandModule} CommandModule */

import { nsfwImageCommands } from './nsfw/index.js';
import { sfwImageCommands } from './sfw/index.js';

/** @type {CommandModule[]} */
export const imageCommands = [
  ...nsfwImageCommands,
  ...sfwImageCommands,
];

