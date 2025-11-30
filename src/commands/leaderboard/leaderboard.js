import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {
  countLeaderboardEntries,
  fetchLeaderboardEntries,
  fetchLeaderboardStanding,
} from '../../features/leaderboard/repository.js';
import {
  BASE_LEVEL_XP,
  LEVEL_XP_GROWTH,
  calculateLevel,
  getLevelProgress,
} from '../../features/leaderboard/leveling.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;
const BUTTON_PREFIX = 'leaderboard';
const INTERACTION_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Builds the pagination controls for the leaderboard message.
 * @param {number} page
 * @param {number} totalPages
 * @param {string} sessionId
 * @param {boolean} [disableAll=false]
 * @returns {import('discord.js').ActionRowBuilder<import('discord.js').ButtonBuilder>[]}
 */
function buildNavigationComponents(page, totalPages, sessionId, disableAll = false) {
  if (totalPages <= 1) {
    return [];
  }

  const backButton = new ButtonBuilder()
    .setCustomId(`${BUTTON_PREFIX}:${sessionId}:prev`)
    .setEmoji('◀️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disableAll || page <= 1);

  const forwardButton = new ButtonBuilder()
    .setCustomId(`${BUTTON_PREFIX}:${sessionId}:next`)
    .setEmoji('▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disableAll || page >= totalPages);

  return [new ActionRowBuilder().addComponents(backButton, forwardButton)];
}

/**
 * Builds the leaderboard message body.
 * @param {Array<{ user_id: string; score: number }>} entries
 * @param {number} page
 * @param {number} totalPages
 * @param {{ user_id: string; score: number; rank: number } | null} userStanding
 * @param {number} totalMembers
 * @param {string} viewerId
 * @param {number} pageSize
 * @returns {import('discord.js').EmbedBuilder}
 */
function buildLeaderboardEmbed(entries, page, totalPages, userStanding, totalMembers, viewerId, pageSize) {
  const startRank = (page - 1) * pageSize;

  const lines = entries.map((entry, index) => {
    const rank = startRank + index + 1;
    const mention = `<@${entry.user_id}>`;
    const level = calculateLevel(entry.score);
    const highlighted = entry.user_id === viewerId;
    const line = `${rank}. ${mention} • Level ${level} • ${entry.score} XP`;
    return highlighted ? `**${line}**` : line;
  });

  let userLine =
    'You have not placed on the leaderboard yet. Keep chatting to earn points!';

  if (userStanding) {
    const { score, rank } = userStanding;
    const { level, pointsIntoLevel, xpForNextLevel } = getLevelProgress(score);
    userLine = `Your rank: #${rank} • Level ${level} (${pointsIntoLevel}/${xpForNextLevel} XP this level) • ${score} XP total`;
  }

  const desc = [
    userLine,
    '',
    ...lines,
    '',
    `Page ${page}/${totalPages} • Tracking ${totalMembers} member${totalMembers === 1 ? '' : 's'}`,
  ];

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Server Leaderboard')
    .setDescription(desc.join('\n'));
}

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the message leaderboard for this server.')
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('How many members to show per page (default 10, max 25).')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_PAGE_SIZE),
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

    await interaction.deferReply();

    const requestedPageSize = interaction.options.getInteger('limit');
    const pageSize = Math.min(
      Math.max(requestedPageSize ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    const totalMembers = await countLeaderboardEntries(interaction.guildId);

    if (totalMembers === null) {
      await interaction.editReply(
        'The leaderboard is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    if (totalMembers === 0) {
      await interaction.editReply('No leaderboard data yet. Start chatting to climb the ranks!');
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
    const userStanding = await fetchLeaderboardStanding(interaction.guildId, interaction.user.id);

    let currentPage = userStanding ? Math.ceil(userStanding.rank / pageSize) : 1;

    if (!Number.isFinite(currentPage) || currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const loadPage = async (page) =>
      fetchLeaderboardEntries(interaction.guildId ?? '', pageSize, (page - 1) * pageSize);

    let entries = await loadPage(currentPage);

    if (entries === null) {
      await interaction.editReply(
        'The leaderboard is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    const sessionId = interaction.id;

    const embed = buildLeaderboardEmbed(
      entries,
      currentPage,
      totalPages,
      userStanding,
      totalMembers,
      interaction.user.id,
      pageSize,
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: buildNavigationComponents(currentPage, totalPages, sessionId),
    });

    const refreshMessage = async () => {
      const nextEmbed = buildLeaderboardEmbed(
        entries,
        currentPage,
        totalPages,
        userStanding,
        totalMembers,
        interaction.user.id,
        pageSize,
      );

      return {
        embeds: [nextEmbed],
        components: buildNavigationComponents(currentPage, totalPages, sessionId),
      };
    };

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: INTERACTION_TIMEOUT_MS,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'Only the user who ran this command can change pages.',
          ephemeral: true,
        });
        return;
      }

      const parts = buttonInteraction.customId.split(':');

      if (parts.length !== 3 || parts[0] !== BUTTON_PREFIX) {
        await buttonInteraction.deferUpdate();
        return;
      }

      const [, session, action] = parts;

      if (session !== sessionId) {
        await buttonInteraction.reply({
          content: 'This pagination session is no longer active.',
          ephemeral: true,
        });
        return;
      }

      if (action === 'prev' && currentPage > 1) {
        currentPage -= 1;
      } else if (action === 'next' && currentPage < totalPages) {
        currentPage += 1;
      } else {
        await buttonInteraction.deferUpdate();
        return;
      }

      entries = await loadPage(currentPage);

      if (entries === null) {
        collector.stop('db_error');
        await buttonInteraction.update({
          content:
            'The leaderboard is not available right now. Ensure the database credentials are configured correctly.',
          embeds: [],
          components: [],
        });
        return;
      }

      await buttonInteraction.update(await refreshMessage());
    });

    collector.on('end', async () => {
      try {
        await message.edit({
          components: buildNavigationComponents(currentPage, totalPages, sessionId, true),
        });
      } catch {
        // Message was deleted or already edited elsewhere.
      }
    });
  },
};

