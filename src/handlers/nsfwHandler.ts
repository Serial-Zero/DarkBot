import type { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';

export type NSFWExecutable = (interaction: ChatInputCommandInteraction) => Promise<void> | void;

function resolveGuildTextChannel(
  interaction: ChatInputCommandInteraction
): (GuildTextBasedChannel & { nsfw: boolean }) | null {
  const { channel } = interaction;

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return null;
  }

  if ('nsfw' in channel && typeof channel.nsfw === 'boolean') {
    return channel as GuildTextBasedChannel & { nsfw: boolean };
  }

  return null;
}

export async function handleNSFWCommand(
  interaction: ChatInputCommandInteraction,
  execute: NSFWExecutable
): Promise<void> {
  const guildChannel = resolveGuildTextChannel(interaction);

  if (!guildChannel || !guildChannel.nsfw) {
    const replyContent = {
      content: 'This command can only be used in an NSFW channel.',
      ephemeral: true,
    } as const;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyContent);
    } else {
      await interaction.reply(replyContent);
    }

    return;
  }

  await execute(interaction);
}
