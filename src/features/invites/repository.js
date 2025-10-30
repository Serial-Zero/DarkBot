import { getInvitePool } from './db/client.js';

let ensureTablePromise = null;

function logDatabaseError(error) {
  console.error('[Invites] Database operation failed.', error);
}

export async function ensureInviteTable() {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  const pool = getInvitePool();

  if (!pool) {
    return false;
  }

  ensureTablePromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_tracking (
          guild_id VARCHAR(32) NOT NULL,
          inviter_id VARCHAR(32) NOT NULL,
          joined_user_id VARCHAR(32) NOT NULL,
          joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (guild_id, joined_user_id),
          INDEX idx_inviter (guild_id, inviter_id)
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

export async function recordInviteJoin(guildId, inviterId, joinedUserId) {
  if (!guildId || !inviterId || !joinedUserId) {
    return false;
  }

  const pool = getInvitePool();

  if (!pool) {
    return false;
  }

  const ensured = await ensureInviteTable();

  if (!ensured) {
    return false;
  }

  try {
    await pool.execute(
      `
        INSERT INTO invite_tracking (guild_id, inviter_id, joined_user_id, joined_at)
        VALUES (?, ?, ?, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          inviter_id = VALUES(inviter_id),
          joined_at = VALUES(joined_at);
      `,
      [guildId, inviterId, joinedUserId],
    );
    return true;
  } catch (error) {
    logDatabaseError(error);
    return false;
  }
}

export async function getInviteStats(guildId, inviterId) {
  if (!guildId || !inviterId) {
    return null;
  }

  const pool = getInvitePool();

  if (!pool) {
    return null;
  }

  const ensured = await ensureInviteTable();

  if (!ensured) {
    return null;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT COUNT(*) AS total_invites
        FROM invite_tracking
        WHERE guild_id = ? AND inviter_id = ?;
      `,
      [guildId, inviterId],
    );

    return {
      totalInvites: Number(rows[0]?.total_invites ?? 0),
    };
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}

export async function getTopInviters(guildId, limit = 10) {
  if (!guildId) {
    return [];
  }

  const pool = getInvitePool();

  if (!pool) {
    return null;
  }

  const ensured = await ensureInviteTable();

  if (!ensured) {
    return null;
  }

  if (typeof limit !== 'number' || limit <= 0) {
    return [];
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT inviter_id, COUNT(*) AS total_invites
        FROM invite_tracking
        WHERE guild_id = ?
        GROUP BY inviter_id
        ORDER BY total_invites DESC
        LIMIT ?;
      `,
      [guildId, limit],
    );

    return rows.map((row) => ({
      inviterId: row.inviter_id,
      totalInvites: Number(row.total_invites ?? 0),
    }));
  } catch (error) {
    logDatabaseError(error);
    return null;
  }
}

