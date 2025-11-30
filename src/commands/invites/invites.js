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

  const desc = [
    `**${targetUser.id === viewerId ? 'Your' : `${targetUser.displayName}'s`} Invites:** ${stats.totalInvites}`,
  ];

  if (isInTop) {
    desc.push(`**Rank:** #${userRank}`);
  }

  desc.push('');

  if (topInviters.length > 0) {
    desc.push('**Top Inviters**');
    topInviters.slice(0, 10).forEach((entry, idx) => {
      const rank = idx + 1;
      const mention = `<@${entry.inviterId}>`;
      const isTarget = entry.inviterId === inviterId;
      const line = `${rank}. ${mention} • ${entry.totalInvites} invite${entry.totalInvites === 1 ? '' : 's'}`;
      desc.push(isTarget ? `**${line}**` : line);
    });
  } else {
    desc.push('No invites tracked yet.');
  }

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Invite Statistics')
    .setDescription(desc.join('\n'))
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));
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

