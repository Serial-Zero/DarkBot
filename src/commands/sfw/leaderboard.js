import { SlashCommandBuilder } from 'discord.js';
import { fetchTopLeaderboardEntries } from '../../Events/Leaderbored/leaderboardRepository.js';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the message leaderboard for this server.')
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of members to include (default 10, max 25).')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25),
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

    const requestedLimit = interaction.options.getInteger('limit');
    const limit = Math.min(requestedLimit ?? 10, 25);

    await interaction.deferReply();

    const entries = await fetchTopLeaderboardEntries(interaction.guildId, limit);

    if (entries === null) {
      await interaction.editReply(
        'The leaderboard is not available right now. Ensure the database credentials are configured correctly.',
      );
      return;
    }

    if (entries.length === 0) {
      await interaction.editReply('No leaderboard data yet. Start chatting to climb the ranks!');
      return;
    }

    const lines = entries.map((entry, index) => {
      const position = index + 1;
      const mention = `<@${entry.user_id}>`;
      const score = entry.score;
      return `**${position}.** ${mention} — ${score} messages`;
    });

    await interaction.editReply({
      content: [
        `Top ${entries.length} members by message count:`,
        '',
        ...lines,
      ].join('\n'),
    });
  },
};
