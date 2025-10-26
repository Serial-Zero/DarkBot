/**
 * @typedef {Object} AfkStatus
 * @property {string} guildId
 * @property {string} userId
 * @property {string | null} message
 * @property {number} since
 */

const afkStatuses = new Map();

/**
 * @param {string} guildId
 * @param {string} userId
 * @returns {string}
 */
function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @param {string | undefined | null} message
 * @returns {AfkStatus}
 */
export function setAfkStatus(guildId, userId, message) {
  const status = {
    guildId,
    userId,
    message: message?.trim() ? message.trim() : null,
    since: Date.now(),
  };

  afkStatuses.set(makeKey(guildId, userId), status);
  return status;
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @returns {AfkStatus | null}
 */
export function clearAfkStatus(guildId, userId) {
  const key = makeKey(guildId, userId);
  const status = afkStatuses.get(key) ?? null;

  if (status) {
    afkStatuses.delete(key);
  }

  return status;
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @returns {AfkStatus | null}
 */
export function getAfkStatus(guildId, userId) {
  return afkStatuses.get(makeKey(guildId, userId)) ?? null;
}

