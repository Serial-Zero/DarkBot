import { getLeaderboardPool } from './db/client.js';

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
 * @returns {Promise<{ currentScore: number; previousScore: number; increment: number } | null>}
 */
export async function incrementLeaderboardScore(guildId, userId, increment = 1) {
  if (!guildId || !userId) {
    return null;
  }

  const pool = getLeaderboardPool();

  if (!pool) {
    return null;
  }

  const ensured = await ensureLeaderboardTable();

  if (!ensured) {
    return null;
  }

  const normalizedIncrement = Number.isFinite(increment) ? Math.max(1, Math.trunc(increment)) : 1;

  try {
    await pool.execute(
      `
        INSERT INTO leaderboard_entries (guild_id, user_id, score, last_message_at)
        VALUES (?, ?, ?, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          score = score + VALUES(score),
          last_message_at = VALUES(last_message_at);
      `,
      [guildId, userId, normalizedIncrement],
    );

    const [[row]] = await pool.execute(
      `
        SELECT score
        FROM leaderboard_entries
        WHERE guild_id = ? AND user_id = ?;
      `,
      [guildId, userId],
    );

    const currentScore = Number(row?.score ?? normalizedIncrement);

    if (Number.isNaN(currentScore)) {
      return null;
    }

    const previousScore = Math.max(0, currentScore - normalizedIncrement);

    return {
      currentScore,
      previousScore,
      increment: normalizedIncrement,
    };
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}

/**
 * Retrieves the top members for a guild leaderboard.
 * @param {string | null} guildId
 * @param {number} limit
 * @returns {Promise<Array<{ user_id: string; score: number }> | null>}
 */
export async function fetchLeaderboardEntries(guildId, limit, offset = 0) {
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

  if (typeof limit !== 'number' || limit <= 0) {
    return [];
  }

  if (typeof offset !== 'number' || offset < 0) {
    offset = 0;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT user_id, score
        FROM leaderboard_entries
        WHERE guild_id = ?
        ORDER BY score DESC, last_message_at DESC
        LIMIT ?
        OFFSET ?;
      `,
      [guildId, limit, offset],
    );

    return /** @type {Array<{ user_id: string; score: number }>} */ (rows);
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}

/**
 * Retrieves the rank and score for a specific member.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<{ user_id: string; score: number; rank: number } | null>}
 */
export async function fetchLeaderboardStanding(guildId, userId) {
  if (!guildId || !userId) {
    return null;
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
    const [[entry]] = await pool.execute(
      `
        SELECT score, last_message_at
        FROM leaderboard_entries
        WHERE guild_id = ? AND user_id = ?;
      `,
      [guildId, userId],
    );

    if (!entry) {
      return null;
    }

    const lastMessageAt =
      entry.last_message_at instanceof Date
        ? entry.last_message_at
        : new Date(entry.last_message_at);

    const [[rankRow]] = await pool.execute(
      `
        SELECT 1 + COUNT(*) AS rank
        FROM leaderboard_entries
        WHERE guild_id = ?
          AND (
            score > ?
            OR (score = ? AND last_message_at > ?)
          );
      `,
      [guildId, entry.score, entry.score, lastMessageAt],
    );

    const rank = Number(rankRow?.rank ?? 1);

    return {
      user_id: userId,
      score: Number(entry.score ?? 0),
      rank: Number.isNaN(rank) ? 1 : rank,
    };
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}

/**
 * Counts leaderboard entries for a guild.
 * @param {string} guildId
 * @returns {Promise<number | null>}
 */
export async function countLeaderboardEntries(guildId) {
  if (!guildId) {
    return 0;
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
    const [[row]] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM leaderboard_entries
        WHERE guild_id = ?;
      `,
      [guildId],
    );

    return Number(row?.total ?? 0);
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}
