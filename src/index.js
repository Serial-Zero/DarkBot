import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { handleNSFWCommand } from './handlers/nsfwHandler.js';
import { refreshCommands } from './handlers/commandRefreshHandler.js';
import { commandMap } from './commands/index.js';
import { registerEvents } from './Events/index.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');
const envCandidates = [
  join(projectRoot, '.env'),
  join(process.cwd(), '.env'),
];

let envLoadedFrom;

for (const candidate of envCandidates) {
  if (!existsSync(candidate)) {
    continue;
  }

  const result = loadEnv({ path: candidate, override: false });

  if (!result.error && process.env.DISCORD_BOT_TOKEN) {
    envLoadedFrom = candidate;
    break;
  }
}

if (!envLoadedFrom) {
  loadEnv(); // fallback to default lookup
}

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  const searchedPaths = envCandidates.join(', ');
  throw new Error(
    `Missing DISCORD_BOT_TOKEN environment variable. Looked for .env in: ${searchedPaths}. Ensure the variable is set via your hosting provider or present in one of those files.`,
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

registerEvents(client);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await refreshCommands();
  } catch (error) {
    console.error('Command refresh failed during startup.', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const command = commandMap.get(interaction.commandName);

      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);

    if (!command) {
      return;
    }

    const execute = async () => {
      await command.execute(interaction);
    };

    if (command.requiresNSFW) {
      await handleNSFWCommand(interaction, execute);
    } else {
      await execute();
    }
  } catch (error) {
    console.error('Interaction handling failed.', error);

    if (interaction.isRepliable() && !interaction.replied) {
      if (interaction.deferred) {
        await interaction.editReply('Something went wrong while handling that interaction.');
      } else {
        await interaction.reply({
          content: 'Something went wrong while handling that interaction.',
          ephemeral: true,
        });
      }
    }
  }
});

client.login(token);
