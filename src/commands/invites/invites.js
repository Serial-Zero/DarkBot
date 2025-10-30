import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getInviteStats, getTopInviters } from '../../features/invites/repository.js';

export const inviteCommand = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('View invite statistics for yourself or another user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check invites for (defaults to you).')
        .setRequired(false),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const inviterId = targetUser.id;

    const stats = await getInviteStats(interaction.guildId, inviterId);

    if (stats === null) {
      await interaction.editReply(
        'Invite tracking is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    const topInviters = await getTopInviters(interaction.guildId, 10);

    if (topInviters === null) {
      await interaction.editReply(
        'Invite tracking is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    const userRank = topInviters.findIndex((entry) => entry.inviterId === inviterId) + 1;
    const isInTop = userRank > 0;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Invite Statistics')
      .setDescription(
        `**${targetUser.id === interaction.user.id ? 'Your' : `${targetUser.displayName}'s`} Invites:** ${stats.totalInvites}`,
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (isInTop) {
      embed.addFields({
        name: 'Rank',
        value: `#${userRank}`,
        inline: true,
      });
    }

    if (topInviters.length > 0) {
      const topList = topInviters
        .slice(0, 10)
        .map((entry, index) => {
          const rank = index + 1;
          const mention = `<@${entry.inviterId}>`;
          const isTarget = entry.inviterId === inviterId;
          const line = `${rank}. ${mention} • ${entry.totalInvites} invite${entry.totalInvites === 1 ? '' : 's'}`;
          return isTarget ? `**${line}**` : line;
        })
        .join('\n');

      embed.addFields({
        name: 'Top Inviters',
        value: topList || 'No invites yet.',
      });
    } else {
      embed.addFields({
        name: 'Top Inviters',
        value: 'No invites tracked yet.',
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

