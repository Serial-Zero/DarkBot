import { getLeaderboardPool } from './dbClient.js';

let ensureTablePromise = null;

function logDatabaseError(error) {
  console.error('[Leaderboard] Database operation failed.', error);
}

/**
 * Ensures the leaderboard table exists.
 * @returns {Promise<boolean>}
 */
export async function ensureLeaderboardTable() {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  const pool = getLeaderboardPool();

  if (!pool) {
    return false;
  }

  ensureTablePromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS leaderboard_entries (
          guild_id VARCHAR(32) NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          score INT UNSIGNED NOT NULL DEFAULT 0,
          last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      return true;
    } catch (error) {
      logDatabaseError(error);
      return false;
    }
  })();

  const result = await ensureTablePromise;

  if (!result) {
    ensureTablePromise = null;
  }

  return result;
}

/**
 * Increments a member's leaderboard score.
 * @param {string} guildId
 * @param {string} userId
 * @param {number} [increment]
 * @returns {Promise<boolean>}
 */
export async function incrementLeaderboardScore(guildId, userId, increment = 1) {
  if (!guildId || !userId) {
    return false;
  }

  const pool = getLeaderboardPool();

  if (!pool) {
    return false;
  }

  const ensured = await ensureLeaderboardTable();

  if (!ensured) {
    return false;
  }

  try {
    await pool.execute(
      `
        INSERT INTO leaderboard_entries (guild_id, user_id, score, last_message_at)
        VALUES (?, ?, ?, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          score = score + VALUES(score),
          last_message_at = VALUES(last_message_at);
      `,
      [guildId, userId, increment],
    );
    return true;
  } catch (error) {
    logDatabaseError(error);
    return false;
  }
}

/**
 * Retrieves the top members for a guild leaderboard.
 * @param {string | null} guildId
 * @param {number} limit
 * @returns {Promise<Array<{ user_id: string; score: number }> | null>}
 */
export async function fetchTopLeaderboardEntries(guildId, limit) {
  if (!guildId) {
    return [];
  }

  const pool = getLeaderboardPool();

  if (!pool) {
    return null;
  }

  const ensured = await ensureLeaderboardTable();

  if (!ensured) {
    return null;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT user_id, score
        FROM leaderboard_entries
        WHERE guild_id = ?
        ORDER BY score DESC, last_message_at DESC
        LIMIT ?;
      `,
      [guildId, limit],
    );

    return /** @type {Array<{ user_id: string; score: number }>} */ (rows);
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}
