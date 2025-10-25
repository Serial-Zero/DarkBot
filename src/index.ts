import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { handleNSFWCommand } from './handlers/nsfwHandler';
import { refreshCommands } from './handlers/commandRefreshHandler';
import { commandMap } from './commands';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_BOT_TOKEN environment variable.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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
