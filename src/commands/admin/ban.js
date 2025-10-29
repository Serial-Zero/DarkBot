import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member to ban.')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the ban.')
        .setRequired(true)
        .setMaxLength(512),
    )
    .addBooleanOption((option) =>
      option
        .setName('ping_everyone')
        .setDescription('Ping everyone in the confirmation message.'),
    ),
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        content:
          "You don't have permission to ban members. Ask a moderator to adjust your roles.",
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user', true);
    const rawReason = interaction.options.getString('reason', true);
    const reason = rawReason.trim();
    const pingEveryone = interaction.options.getBoolean('ping_everyone') ?? false;

    if (!reason.length) {
      await interaction.reply({
        content: 'Please provide a non-empty reason for the ban.',
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: "You can't ban yourself.",
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.client.user?.id) {
      await interaction.reply({
        content: "I can't ban myself.",
        ephemeral: true,
      });
      return;
    }

    const botMember = guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        content: "I don't have permission to ban members. Grant me the Ban Members permission.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    let executingMember;
    try {
      executingMember = await guild.members.fetch(interaction.user.id);
    } catch {
      executingMember = null;
    }

    if (!executingMember) {
      await interaction.editReply({
        content: "I couldn't verify your member record. Try again in a moment.",
        allowedMentions: { parse: [] },
      });
      return;
    }

    let targetMember = null;
    try {
      targetMember = await guild.members.fetch(targetUser.id);
    } catch {
      targetMember = null;
    }

    if (targetMember) {
      if (!targetMember.bannable) {
        await interaction.editReply({
          content: "I can't ban that member. They may have a higher role than me or I lack permissions.",
          allowedMentions: { parse: [] },
        });
        return;
      }

      const roleComparison =
        executingMember.roles.highest.comparePositionTo(targetMember.roles.highest);

      if (roleComparison <= 0 && guild.ownerId !== executingMember.id) {
        await interaction.editReply({
          content: "You can't ban someone with an equal or higher role.",
          allowedMentions: { parse: [] },
        });
        return;
      }
    }

    try {
      if (!targetUser.bot) {
        await targetUser
          .send(
            `You have been banned from ${guild.name} for the following reason: ${reason}`,
          )
          .catch(() => {});
      }
    } catch {
      // Ignore DM errors (user closed DMs or has privacy settings).
    }

    try {
      await guild.members.ban(targetUser, { reason });
    } catch (error) {
      await interaction.editReply({
        content: 'I could not ban that member. They may already be banned or an unexpected error occurred.',
        allowedMentions: { parse: [] },
      });
      console.error('[Commands] Failed to ban member.', error);
      return;
    }

    const lines = [
      pingEveryone ? '@everyone' : null,
      `Banned <@${targetUser.id}>`,
      `Reason: ${reason}`,
      `Moderator: <@${interaction.user.id}>`,
    ];

    await interaction.editReply({
      content: lines.filter(Boolean).join('\n'),
      allowedMentions: pingEveryone ? { parse: ['everyone'] } : { parse: [] },
    });
  },
};
