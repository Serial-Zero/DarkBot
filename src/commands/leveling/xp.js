import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
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

function buildButtonRow(sessionId, disabled = false) {
  const refreshBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:refresh`)
    .setLabel('Refresh')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const lbBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:leaderboard`)
    .setLabel('Leaderboard')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(refreshBtn, lbBtn);
}

function buildXpComponents(targetUser, standing) {
  const totalXp = standing?.score ?? 0;
  const progress = getLevelProgress(totalXp);
  const percent = Math.round(progress.progress * 100);
  const xpRemaining = Math.max(progress.xpForNextLevel - progress.pointsIntoLevel, 0);

  const lines = [`## ${targetUser.username}'s XP`, ''];

  if (!standing) {
    lines.push(`${targetUser} has not earned any XP on this server yet. Start chatting to gain levels!`);
    lines.push('');
  }

  lines.push(
    `**Level:** ${formatNumber(progress.level)}`,
    `**Total XP:** ${formatNumber(progress.totalXp)}`,
    `**Rank:** ${standing ? `#${formatNumber(standing.rank)}` : 'Unranked'}`,
    `**Progress:** ${formatNumber(progress.pointsIntoLevel)}/${formatNumber(progress.xpForNextLevel)} XP (${percent}%)`,
    `**XP To Level Up:** ${xpRemaining === 0 ? 'Level up achieved!' : `${formatNumber(xpRemaining)} XP remaining`}`,
  );

  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );
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
    const container = buildXpComponents(targetUser, standing);

    const msg = await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container, buildButtonRow(sessionId)],
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
        const newContainer = buildXpComponents(targetUser, standing);
        await btn.update({ components: [newContainer, buildButtonRow(sessionId)] });
      } else if (parts[2] === 'leaderboard') {
        await btn.reply({ content: 'Use `/leaderboard` to view the full server leaderboard!', ephemeral: true });
      }
    });

    collector.on('end', async () => {
      const finalContainer = buildXpComponents(targetUser, standing);
      try {
        await msg.edit({ components: [finalContainer, buildButtonRow(sessionId, true)] });
      } catch {}
    });
  },
};
