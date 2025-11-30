/** @typedef {import('../types.js').CommandModule} CommandModule */

import { banCommand } from './ban.js';
import { fixPermsCommand } from './fixperms.js';

export const adminCommands = [banCommand, fixPermsCommand];
