/**
 * @typedef {import('discord.js').ChatInputCommandInteraction} ChatInputCommandInteraction
 * @typedef {import('discord.js').GuildTextBasedChannel} GuildTextBasedChannel
 */

/**
 * @callback NSFWExecutable
 * @param {ChatInputCommandInteraction} interaction
 * @returns {Promise<void> | void}
 */

/**
 * @param {ChatInputCommandInteraction} interaction
 * @returns {(GuildTextBasedChannel & { nsfw: boolean }) | null}
 */
function resolveGuildTextChannel(interaction) {
  const { channel } = interaction;

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return null;
  }

  if ('nsfw' in channel && typeof channel.nsfw === 'boolean') {
    return /** @type {GuildTextBasedChannel & { nsfw: boolean }} */ (channel);
  }

  return null;
}

/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {NSFWExecutable} execute
 */
export async function handleNSFWCommand(interaction, execute) {
  const guildChannel = resolveGuildTextChannel(interaction);

  if (!guildChannel || !guildChannel.nsfw) {
    const replyContent = {
      content: 'This command can only be used in an NSFW channel.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyContent);
    } else {
      await interaction.reply(replyContent);
    }

    return;
  }

  await execute(interaction);
}

