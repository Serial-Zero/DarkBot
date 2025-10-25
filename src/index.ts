import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { InteractionReplyOptions } from 'discord.js';
import { handleNSFWCommand } from './handlers/nsfwHandler';
import { refreshCommands } from './handlers/commandRefreshHandler';

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
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === 'nsfw-example') {
    await handleNSFWCommand(interaction, async () => {
      const response: InteractionReplyOptions = {
        content: 'This is an NSFW-only command.',
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    });
  }
});

client.login(token);
