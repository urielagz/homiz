import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

/* NUMERIC llega como texto desde pg; lo convertimos a número para montos (NUMERIC(12,2)). */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => logger.error({ err: err.message }, 'Error inesperado en la conexión a PostgreSQL'));

/** Consulta parametrizada: nunca concatenar valores en el SQL. */
export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

/** Verifica que la base responde (para /health). */
export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
