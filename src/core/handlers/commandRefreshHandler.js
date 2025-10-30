import { REST, Routes } from 'discord.js';
import { commandModules } from '../../commands/index.js';

/** @type {import('discord.js').RESTPostAPIChatInputApplicationCommandsJSONBody[]} */
const commands = commandModules.map((command) => command.data.toJSON());

export async function refreshCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token) {
    throw new Error('Missing DISCORD_BOT_TOKEN environment variable.');
  }

  if (!clientId) {
    throw new Error('Missing DISCORD_CLIENT_ID environment variable.');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('Successfully refreshed guild application commands.');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Successfully refreshed global application commands.');
    }
  } catch (error) {
    console.error('Failed to refresh application commands.', error);
    throw error;
  }
}

export { commands };

