import type { CommandModule } from '../types';
import { nsfwExampleCommand } from './nsfwExample';
import { rule34Command } from './rule34';

export const nsfwCommands: CommandModule[] = [nsfwExampleCommand, rule34Command];
