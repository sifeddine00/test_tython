import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';

/**
 * Application des migrations SQL, réutilisable par la CLI et par les tests.
 *
 * La logique vit ici pour que `scripts/migrate.ts` reste un simple point
 * d'entrée et que le harnais de tests puisse rejouer le schéma sans passer par
 * un sous-processus.
 */

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(currentDir, '../migrations');

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

type AppliedRow = { version: string };

/** Supprime et recrée le schéma `public` : utilisé pour repartir de zéro. */
export async function dropPublicSchema(client: Client): Promise<void> {
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
}

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

/**
 * Applique chaque migration manquante, dans l'ordre lexicographique, une
 * seule fois. Une migration en échec avorte la transaction qui la contient :
 * `schema_migrations` n'est jamais désynchronisé du schéma réel.
 */
export async function applyMigrations(client: Client): Promise<MigrationResult> {
  await client.query(CREATE_MIGRATIONS_TABLE);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const applied = await client.query<AppliedRow>('SELECT version FROM schema_migrations');
  const alreadyApplied = new Set(applied.rows.map((row) => row.version));

  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      result.skipped.push(file);
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      result.applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Échec de la migration ${file} :`, { cause: error });
    }
  }

  return result;
}