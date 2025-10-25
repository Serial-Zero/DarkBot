import { SlashCommandBuilder } from 'discord.js';
/**
 * @typedef {import('discord.js').ChatInputCommandInteraction} ChatInputCommandInteraction
 * @typedef {import('../types.js').CommandModule} CommandModule
 */

/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
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

/** @type {CommandModule} */
export const nsfwExampleCommand = {
  data: new SlashCommandBuilder()
    .setName('nsfw-example')
    .setDescription('Demonstration command restricted to NSFW channels.')
    .setNSFW(true),
  requiresNSFW: true,
  execute,
};
