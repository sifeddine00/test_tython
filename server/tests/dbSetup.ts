import { Client } from 'pg';
import { env } from '../src/config/env.js';
import { applyMigrations, dropPublicSchema } from '../scripts/migrator.js';

/**
 * Prépare la base de test avant la suite.
 *
 * Les tests s'exécutent sur `helpdeskpro_test`, jamais sur la base de
 * développement. Le schéma est remis à zéro puis les migrations sont rejouées
 * afin que chaque exécution de `npm test` démarre d'un état identique.
 *
 * Tout se passe dans ce processus, via une connexion dédiée : pas de
 * sous-processus `npx`, qui est cassé sous Windows et lent à démarrer.
 */

export async function prepareTestDatabase(): Promise<void> {
  const client = new Client({ connectionString: env.TEST_DATABASE_URL });

  await client.connect();

  try {
    await dropPublicSchema(client);
    const { applied } = await applyMigrations(client);
    console.info(`[test-setup] Schéma de test réinitialisé (${applied.length} migration(s)).`);
  } finally {
    await client.end();
  }
}