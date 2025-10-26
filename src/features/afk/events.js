import { Events } from 'discord.js';
import { clearAfkStatus, getAfkStatus } from './statusStore.js';

export const afkEvents = [
  {
    event: Events.MessageCreate,
    once: false,
    /**
     * @param {import('discord.js').Message<boolean>} message
     * @returns {Promise<void>}
     */
    async execute(message) {
      if (!message.inGuild()) {
        return;
      }

      if (message.author.bot || message.system) {
        return;
      }

      const { guildId } = message;
      const previousStatus = clearAfkStatus(guildId, message.author.id);

      if (previousStatus) {
        try {
          await message.reply({
            content: 'Welcome back! I removed your AFK status.',
            allowedMentions: { parse: [] },
          });
        } catch (error) {
          console.error(
            `[AFK] Failed to notify ${message.author.id} about clearing their AFK status.`,
            error,
          );
        }
      }

      if (message.mentions.users.size === 0) {
        return;
      }

      /** @type {string[]} */
      const lines = [];
      const notifiedUserIds = new Set();

      for (const [, user] of message.mentions.users) {
        if (user.bot || notifiedUserIds.has(user.id)) {
          continue;
        }

        const status = getAfkStatus(guildId, user.id);

        if (!status) {
          continue;
        }

        const sinceSeconds = Math.floor(status.since / 1000);
        const reason = status.message ? `: ${status.message}` : '';

        lines.push(
          `🔕 <@${user.id}> is AFK${reason} (set <t:${sinceSeconds}:R>).`,
        );
        notifiedUserIds.add(user.id);
      }

      if (lines.length === 0) {
        return;
      }

      try {
        await message.reply({
          content: lines.join('\n'),
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        console.error('[AFK] Failed to notify about AFK mention.', error);
      }
    },
  },
];
