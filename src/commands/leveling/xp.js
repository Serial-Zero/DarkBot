import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { fetchLeaderboardStanding } from '../../features/leaderboard/repository.js';
import {
  BASE_LEVEL_XP,
  LEVEL_XP_GROWTH,
  getLevelProgress,
} from '../../features/leaderboard/leveling.js';

const BTN_PREFIX = 'xp';
const TIMEOUT_MS = 2 * 60 * 1000;

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function buildComponents(sessionId, disabled = false) {
  const refreshBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:refresh`)
    .setLabel('Refresh')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const lbBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:leaderboard`)
    .setLabel('Leaderboard')
    .setEmoji('🏆')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  return [new ActionRowBuilder().addComponents(refreshBtn, lbBtn)];
}

function buildXpEmbed(targetUser, standing) {
  const totalXp = standing?.score ?? 0;
  const progress = getLevelProgress(totalXp);
  const percent = Math.round(progress.progress * 100);
  const xpRemaining = Math.max(progress.xpForNextLevel - progress.pointsIntoLevel, 0);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${targetUser.username}'s XP`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Level', value: formatNumber(progress.level), inline: true },
      { name: 'Total XP', value: formatNumber(progress.totalXp), inline: true },
      { name: 'Rank', value: standing ? `#${formatNumber(standing.rank)}` : 'Unranked', inline: true },
      { name: 'Progress', value: `${formatNumber(progress.pointsIntoLevel)}/${formatNumber(progress.xpForNextLevel)} XP (${percent}%)` },
      { name: 'XP To Level Up', value: xpRemaining === 0 ? 'Level up achieved!' : `${formatNumber(xpRemaining)} XP remaining` },
    )
    .setFooter({ text: `XP required grows by ${LEVEL_XP_GROWTH} each level (base ${BASE_LEVEL_XP}).` });

  if (!standing) {
    embed.setDescription(`${targetUser} has not earned any XP on this server yet. Start chatting to gain levels!`);
  }

  return embed;
}

export const xpCommand = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Check the XP and level progress for yourself or another member.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member to inspect (defaults to yourself).')
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

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const guildId = interaction.guildId;
    const sessionId = interaction.id;

    await interaction.deferReply({ ephemeral: false });

    let standing = await fetchLeaderboardStanding(guildId, targetUser.id);
    const embed = buildXpEmbed(targetUser, standing);

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
        standing = await fetchLeaderboardStanding(guildId, targetUser.id);
        const newEmbed = buildXpEmbed(targetUser, standing);
        await btn.update({ embeds: [newEmbed], components: buildComponents(sessionId) });
      } else if (parts[2] === 'leaderboard') {
        await btn.reply({ content: 'Use `/leaderboard` to view the full server leaderboard!', ephemeral: true });
      }
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: buildComponents(sessionId, true) });
      } catch {}
    });
  },
};
