import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getInviteStats, getTopInviters } from '../../features/invites/repository.js';

const BTN_PREFIX = 'invites';
const TIMEOUT_MS = 2 * 60 * 1000;

function buildComponents(sessionId, disabled = false) {
  const refreshBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:refresh`)
    .setLabel('Refresh')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  return [new ActionRowBuilder().addComponents(refreshBtn)];
}

function buildInviteEmbed(targetUser, stats, topInviters, inviterId, viewerId) {
  const userRank = topInviters.findIndex((e) => e.inviterId === inviterId) + 1;
  const isInTop = userRank > 0;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Invite Statistics')
    .setDescription(
      `**${targetUser.id === viewerId ? 'Your' : `${targetUser.displayName}'s`} Invites:** ${stats.totalInvites}`,
    )
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  if (isInTop) {
    embed.addFields({ name: 'Rank', value: `#${userRank}`, inline: true });
  }

  if (topInviters.length > 0) {
    const topList = topInviters
      .slice(0, 10)
      .map((entry, idx) => {
        const rank = idx + 1;
        const mention = `<@${entry.inviterId}>`;
        const isTarget = entry.inviterId === inviterId;
        const line = `${rank}. ${mention} • ${entry.totalInvites} invite${entry.totalInvites === 1 ? '' : 's'}`;
        return isTarget ? `**${line}**` : line;
      })
      .join('\n');

    embed.addFields({ name: 'Top Inviters', value: topList || 'No invites yet.' });
  } else {
    embed.addFields({ name: 'Top Inviters', value: 'No invites tracked yet.' });
  }

  return embed;
}

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
    const guildId = interaction.guildId;
    const sessionId = interaction.id;

    const fetchData = async () => {
      const stats = await getInviteStats(guildId, inviterId);
      const topInviters = await getTopInviters(guildId, 10);
      return { stats, topInviters };
    };

    let { stats, topInviters } = await fetchData();

    if (stats === null || topInviters === null) {
      await interaction.editReply(
        'Invite tracking is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    const embed = buildInviteEmbed(targetUser, stats, topInviters, inviterId, interaction.user.id);

    const msg = await interaction.editReply({
      embeds: [embed],
      components: buildComponents(sessionId),
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: TIMEOUT_MS,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: 'Only the command user can use these buttons.', ephemeral: true });
        return;
      }

      const parts = btn.customId.split(':');
      if (parts.length !== 3 || parts[0] !== BTN_PREFIX || parts[1] !== sessionId) {
        await btn.deferUpdate();
        return;
      }

      if (parts[2] === 'refresh') {
        const data = await fetchData();
        if (data.stats === null || data.topInviters === null) {
          await btn.reply({ content: 'Failed to refresh data.', ephemeral: true });
          return;
        }
        stats = data.stats;
        topInviters = data.topInviters;
        const newEmbed = buildInviteEmbed(targetUser, stats, topInviters, inviterId, interaction.user.id);
        await btn.update({ embeds: [newEmbed], components: buildComponents(sessionId) });
      }
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: buildComponents(sessionId, true) });
      } catch {}
    });
  },
};

