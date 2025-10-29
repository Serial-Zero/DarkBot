import { SlashCommandBuilder } from 'discord.js';
import { clearAfkStatus, setAfkStatus } from '../../features/afk/statusStore.js';

export const afkCommand = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Manage your AFK status.')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Mark yourself as away and optionally include a message.')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Optional note to show when people mention you.')
            .setMaxLength(190),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Remove your AFK status.'),
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

    const subcommand = interaction.options.getSubcommand(true);
    const { guildId, user } = interaction;

    if (subcommand === 'set') {
      const message = interaction.options.getString('message');
      const status = setAfkStatus(guildId, user.id, message);

      await interaction.reply({
        content: status.message
          ? `\u{1F515} <@${user.id}> is now AFK: ${status.message}`
          : `\u{1F515} <@${user.id}> is now AFK.`,
        allowedMentions: { users: [user.id] },
      });
      return;
    }

    if (subcommand === 'clear') {
      const previous = clearAfkStatus(guildId, user.id);

      await interaction.reply({
        content: previous
          ? "Welcome back! I've cleared your AFK status."
          : "You weren't marked as AFK.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: 'That subcommand is not supported.',
      ephemeral: true,
    });
  },
};

