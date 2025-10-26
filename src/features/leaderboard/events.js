import { Events } from 'discord.js';
import {
  ensureLeaderboardTable,
  incrementLeaderboardScore,
} from './repository.js';
import { calculateLevel } from './leveling.js';

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

      const result = await incrementLeaderboardScore(
        message.guild.id,
        message.author.id,
      );

      if (!result) {
        logReadinessDisabled();
        return;
      }

      const { currentScore, previousScore } = result;

      const previousLevel = calculateLevel(previousScore);
      const currentLevel = calculateLevel(currentScore);

      if (currentLevel > previousLevel) {
        const levelsGained = currentLevel - previousLevel;
        const levelLine =
          levelsGained > 1
            ? `reached level ${currentLevel} (+${levelsGained} levels!)`
            : `reached level ${currentLevel}!`;

        try {
          await message.channel.send({
            content: `🎉 <@${message.author.id}> ${levelLine}`,
            allowedMentions: { users: [message.author.id] },
          });
        } catch (error) {
          console.error(
            `[Leaderboard] Failed to announce level up for ${message.author.id}.`,
            error,
          );
        }
      }
    },
  },
];
