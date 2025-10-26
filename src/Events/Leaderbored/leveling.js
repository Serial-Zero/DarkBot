export const BASE_LEVEL_XP = 100;
export const LEVEL_XP_GROWTH = 25;

/**
 * Returns the XP required to advance from the provided level to the next.
 * @param {number} level
 * @returns {number}
 */
export function xpToLevelUp(level) {
  if (!Number.isFinite(level) || level < 1) {
    return BASE_LEVEL_XP;
  }

  return BASE_LEVEL_XP + LEVEL_XP_GROWTH * (Math.trunc(level) - 1);
}

/**
 * Calculates level and progress details for a given experience total.
 * @param {number} score
 * @returns {{
 *  level: number;
 *  progress: number;
 *  xpForNextLevel: number;
 *  pointsIntoLevel: number;
 *  totalXp: number;
 * }}
 */
export function getLevelProgress(score) {
  let remainingXp = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  let level = 1;
  let nextThreshold = xpToLevelUp(level);

  while (remainingXp >= nextThreshold) {
    remainingXp -= nextThreshold;
    level += 1;
    nextThreshold = xpToLevelUp(level);
  }

  const progress =
    nextThreshold <= 0 ? 1 : Math.min(1, remainingXp / nextThreshold);

  return {
    level,
    progress,
    xpForNextLevel: nextThreshold,
    pointsIntoLevel: remainingXp,
    totalXp: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
  };
}

/**
 * Convenience wrapper that returns only the level.
 * @param {number} score
 * @returns {number}
 */
export function calculateLevel(score) {
  return getLevelProgress(score).level;
}
