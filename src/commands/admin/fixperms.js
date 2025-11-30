import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

const BTN_PREFIX = 'fixperms';
const TIMEOUT_MS = 2 * 60 * 1000;

function buildComponents(sessionId, disabled = false) {
  const runBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:run`)
    .setLabel('Run Again')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  return [new ActionRowBuilder().addComponents(runBtn)];
}

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ViewAuditLog,
];

async function runPermsFix(guild, executorId, botMember, fixRoles, fixChannels) {
  const executorMember = await guild.members.fetch(executorId);
  const executorHighestRole = executorMember.roles.highest;

  let rolesFixed = 0;
  let channelsFixed = 0;
  const roleIssues = [];
  const channelIssues = [];

  if (fixRoles) {
    const roles = await guild.roles.fetch();
    const botHighestRole = botMember.roles.highest;

    for (const role of roles.values()) {
      if (role.id === guild.id) continue;
      if (role.managed) continue;
      if (role.comparePositionTo(botHighestRole) >= 0) continue;
      if (role.comparePositionTo(executorHighestRole) >= 0 && guild.ownerId !== executorId) continue;

      const dangerousPerms = role.permissions.toArray().filter((p) => DANGEROUS_PERMISSIONS.includes(p));
      if (dangerousPerms.length === 0) continue;

      try {
        const newPerms = role.permissions.remove(dangerousPerms);
        await role.setPermissions(newPerms, 'Security fix: removed dangerous permissions');
        rolesFixed++;
        roleIssues.push({ role: role.name, removed: dangerousPerms });
      } catch (err) {
        console.error(`[FixPerms] Failed to fix role ${role.id}:`, err);
      }
    }
  }

  if (fixChannels) {
    const channels = guild.channels.cache.values();

    for (const channel of channels) {
      if (!channel.permissionOverwrites) continue;

      const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.id);
      if (!everyoneOverwrite) continue;

      const currentAllow = everyoneOverwrite.allow;
      const currentDeny = everyoneOverwrite.deny;

      const needsDeny = currentAllow.has(PermissionFlagsBits.MentionEveryone);
      const needsAllow = currentDeny.has(PermissionFlagsBits.MentionEveryone);

      if (!needsDeny && !needsAllow) continue;

      try {
        const newAllow = needsDeny ? currentAllow.remove(PermissionFlagsBits.MentionEveryone) : currentAllow;
        const newDeny = needsDeny ? currentDeny : currentDeny.add(PermissionFlagsBits.MentionEveryone);

        await channel.permissionOverwrites.edit(guild.id, {
          allow: newAllow,
          deny: newDeny,
          reason: 'Security fix: prevent @everyone from pinging everyone',
        });

        channelsFixed++;
        channelIssues.push({ channel: channel.name || channel.id, type: channel.type });
      } catch (err) {
        console.error(`[FixPerms] Failed to fix channel ${channel.id}:`, err);
      }
    }
  }

  return { rolesFixed, channelsFixed, roleIssues, channelIssues };
}

function buildResultEmbed(result, fixRoles, fixChannels) {
  const { rolesFixed, channelsFixed, roleIssues, channelIssues } = result;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Permission Fix Complete')
    .setTimestamp();

  const descParts = [];

  if (fixRoles) {
    descParts.push(`**Roles Fixed:** ${rolesFixed}`);
    if (roleIssues.length > 0) {
      const list = roleIssues
        .slice(0, 10)
        .map((i) => `• ${i.role}: removed ${i.removed.length} permission${i.removed.length === 1 ? '' : 's'}`)
        .join('\n');
      embed.addFields({
        name: 'Role Changes',
        value: list + (roleIssues.length > 10 ? `\n... and ${roleIssues.length - 10} more` : ''),
      });
    }
  }

  if (fixChannels) {
    descParts.push(`**Channels Fixed:** ${channelsFixed}`);
    if (channelIssues.length > 0) {
      const list = channelIssues
        .slice(0, 10)
        .map((i) => `• ${i.channel} (${i.type})`)
        .join('\n');
      embed.addFields({
        name: 'Channel Changes',
        value: list + (channelIssues.length > 10 ? `\n... and ${channelIssues.length - 10} more` : ''),
      });
    }
  }

  embed.setDescription(descParts.join('\n') || 'No issues found.');

  if (rolesFixed === 0 && channelsFixed === 0) {
    embed.setColor(0x57f287);
    embed.setDescription('No permission issues found. Everything is secure!');
  }

  return embed;
}

export const fixPermsCommand = {
  data: new SlashCommandBuilder()
    .setName('fixperms')
    .setDescription('Fix role and channel permissions to prevent security issues.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('fix_roles')
        .setDescription('Fix role permissions (remove dangerous perms from non-admin roles).')
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('fix_channels')
        .setDescription('Prevent @everyone from pinging everyone in channels.')
        .setRequired(false),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'You need Administrator permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'I need Administrator permission to fix permissions.',
        ephemeral: true,
      });
      return;
    }

    const fixRoles = interaction.options.getBoolean('fix_roles') ?? true;
    const fixChannels = interaction.options.getBoolean('fix_channels') ?? true;

    if (!fixRoles && !fixChannels) {
      await interaction.reply({
        content: 'At least one option must be enabled (fix_roles or fix_channels).',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const sessionId = interaction.id;

    let result = await runPermsFix(guild, interaction.user.id, botMember, fixRoles, fixChannels);
    const embed = buildResultEmbed(result, fixRoles, fixChannels);

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

      if (parts[2] === 'run') {
        await btn.deferUpdate();
        result = await runPermsFix(guild, interaction.user.id, botMember, fixRoles, fixChannels);
        const newEmbed = buildResultEmbed(result, fixRoles, fixChannels);
        await msg.edit({ embeds: [newEmbed], components: buildComponents(sessionId) });
      }
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: buildComponents(sessionId, true) });
      } catch {}
    });
  },
};

