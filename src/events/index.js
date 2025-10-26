import { leaderboardEvents } from '../features/leaderboard/events.js';

const eventGroups = [leaderboardEvents];

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
