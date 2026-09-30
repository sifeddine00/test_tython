import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env, isTest } from '../config/env.js';

/**
 * Pool de connexions PostgreSQL unique pour toute l'application.
 * Les paramètres sont centralisés ici : aucun autre module n'instancie un Pool.
 *
 * En environnement `test`, c'est systématiquement la base `helpdeskpro_test`
 * qui est visée. Sans cette bifurcation, `npm test` tronquerait les tables de
 * la base de développement et détruirait le jeu de données du seed.
 */
export const pool = new Pool({
  connectionString: isTest ? env.TEST_DATABASE_URL : env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: isTest ? 'helpdeskpro-tests' : 'helpdeskpro-api',
});

pool.on('error', (error) => {
  // Un client inactif qui tombe en erreur ne doit pas faire tomber le process.
  console.error('[db] Erreur sur un client inactif du pool :', error.message);
});

/** Exécute une requête et renvoie toutes les lignes typées. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result: QueryResult<T> = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

/** Exécute une requête et renvoie la première ligne, ou `null`. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Exécute un ensemble d'opérations dans une transaction.
 * En cas d'exception, la transaction est annulée puis l'erreur est relancée.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Vérifie que la base est joignable. Utilisé par /api/health et les tests. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
