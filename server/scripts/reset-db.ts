import { Client } from 'pg';
import { resolveConnectionString, resolveTarget } from './target.js';

/**
 * Réinitialise le schéma public de la base cible.
 *
 * Usage :
 *   npm run db:reset                        -> base de développement
 *   npm run db:reset -- --target test       -> base de test
 *
 * Combine DROP SCHEMA + CREATE SCHEMA pour que le premier `db:migrate` qui
 * suit reparte d'un schéma vide, comme le ferait une base toute neuve.
 */
async function main(): Promise<void> {
  const target = resolveTarget();
  const connectionString = await resolveConnectionString(target);
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    console.info(`[reset] Schéma public (${target}) réinitialisé. Lancez les migrations.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[reset] Échec :', error);
  process.exit(1);
});
