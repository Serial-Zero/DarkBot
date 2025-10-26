import { Events } from 'discord.js';
import {
  ensureLeaderboardTable,
  incrementLeaderboardScore,
} from './leaderboardRepository.js';

let readinessLogged = false;

function logReadinessDisabled() {
  if (readinessLogged) {
    return;
  }

  readinessLogged = true;
  console.warn(
    '[Leaderboard] Skipping leaderboard setup. Configure DB_* environment variables to enable it.',
  );
}

export const leaderboardEvents = [
  {
    event: Events.ClientReady,
    once: true,
    /**
     * @returns {Promise<void>}
     */
    async execute() {
      const ready = await ensureLeaderboardTable();

      if (ready) {
        console.log('[Leaderboard] Leaderboard table is ready.');
      } else {
        logReadinessDisabled();
      }
    },
  },
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

      const success = await incrementLeaderboardScore(
        message.guild.id,
        message.author.id,
      );

      if (!success) {
        logReadinessDisabled();
      }
    },
  },
];
