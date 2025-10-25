import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { CommandModule } from '../types';

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({
      content: 'This is an NSFW-only command.',
    });
  } else {
    await interaction.reply({
      content: 'This is an NSFW-only command.',
    });
  }
}

export const nsfwExampleCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('nsfw-example')
    .setDescription('Demonstration command restricted to NSFW channels.')
    .setNSFW(true),
  requiresNSFW: true,
  execute,
};
