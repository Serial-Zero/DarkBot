import { createPool } from 'mysql2/promise';

let pool = null;
let configurationWarningLogged = false;

function logMissingConfiguration() {
  if (configurationWarningLogged) {
    return;
  }

  configurationWarningLogged = true;
  console.warn(
    '[Leaderboard] Database configuration missing. ' +
      'Set DB_HOST, DB_USER, DB_NAME, and DB_PASSWORD in your environment to enable the leaderboard.',
  );
}

/**
 * @returns {import('mysql2/promise').Pool | null}
 */
export function getLeaderboardPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number.parseInt(process.env.DB_PORT ?? '3306', 10);

  if (!host || !user || !database) {
    logMissingConfiguration();
    return null;
  }

  pool = createPool({
    host,
    user,
    password,
    database,
    port: Number.isNaN(port) ? 3306 : port,
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: false,
  });

  return pool;
}
