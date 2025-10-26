import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { fetchLeaderboardStanding } from '../../Events/Leaderbored/leaderboardRepository.js';
import {
  BASE_LEVEL_XP,
  LEVEL_XP_GROWTH,
  getLevelProgress,
} from '../../Events/Leaderbored/leveling.js';

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
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
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user') ?? interaction.user;

    await interaction.deferReply({ ephemeral: false });

    const standing = await fetchLeaderboardStanding(interaction.guildId, targetUser.id);

    const totalXp = standing?.score ?? 0;
    const progress = getLevelProgress(totalXp);
    const percent = Math.round(progress.progress * 100);
    const xpRemaining = Math.max(progress.xpForNextLevel - progress.pointsIntoLevel, 0);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${targetUser.username}'s XP`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .addFields(
        {
          name: 'Level',
          value: formatNumber(progress.level),
          inline: true,
        },
        {
          name: 'Total XP',
          value: formatNumber(progress.totalXp),
          inline: true,
        },
        {
          name: 'Rank',
          value: standing ? `#${formatNumber(standing.rank)}` : 'Unranked',
          inline: true,
        },
        {
          name: 'Progress',
          value: `${formatNumber(progress.pointsIntoLevel)}/${formatNumber(progress.xpForNextLevel)} XP (${percent}%)`,
        },
        {
          name: 'XP To Level Up',
          value: xpRemaining === 0 ? 'Level up achieved!' : `${formatNumber(xpRemaining)} XP remaining`,
        },
      )
      .setFooter({
        text: `XP required grows by ${LEVEL_XP_GROWTH} each level (base ${BASE_LEVEL_XP}).`,
      });

    if (!standing) {
      embed.setDescription(
        `${targetUser} has not earned any XP on this server yet. Start chatting to gain levels!`,
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
