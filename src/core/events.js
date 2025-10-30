import { afkEvents } from '../features/afk/events.js';
import { inviteEvents } from '../features/invites/events.js';
import { leaderboardEvents } from '../features/leaderboard/events.js';
import { memberRoleEvents } from '../features/memberRole/events.js';

const eventGroups = [afkEvents, inviteEvents, leaderboardEvents, memberRoleEvents];

export const eventModules = eventGroups.flat();

/**
 * @param {import('discord.js').Client} client
 */
export function registerEvents(client) {
  for (const eventModule of eventModules) {
    const handler = async (...args) => {
      try {
        await eventModule.execute(...args);
      } catch (error) {
        console.error(
          `[Events] Handler for ${String(eventModule.event)} failed.`,
          error,
        );
      }
    };

    if (eventModule.once) {
      client.once(eventModule.event, handler);
    } else {
      client.on(eventModule.event, handler);
    }
  }
}

