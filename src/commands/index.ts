import type { CommandModule } from './types';
import { adminCommands } from './admin';
import { nsfwCommands } from './nsfw';
import { sfwCommands } from './sfw';

export const commandModules: CommandModule[] = [
  ...nsfwCommands,
  ...adminCommands,
  ...sfwCommands,
];

export const commandMap: Map<string, CommandModule> = new Map(
  commandModules.map((command) => [command.data.name, command])
);
