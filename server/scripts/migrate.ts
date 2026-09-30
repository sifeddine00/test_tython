import { Client } from 'pg';
import { resolveConnectionString, resolveTarget } from './target.js';
import { applyMigrations } from './migrator.js';

/**
 * Runner de migrations.
 *
 * Chaque fichier `migrations/NNN_nom.sql` est appliqué une seule fois, dans
 * l'ordre lexicographique, à l'intérieur d'une transaction. Les versions déjà
 * appliquées sont enregistrées dans `schema_migrations`.
 *
 * Choix d'architecture : pas d'ORM ni de framework de migration. Le SQL reste
 * lisible et auditable, ce qui est explicitement demandé par le cahier des
 * charges (section 5).
 *
 * Usage :
 *   npm run db:migrate              -> base de développement
 *   npm run db:migrate -- --target test
 */

async function main(): Promise<void> {
  const target = resolveTarget();
  const connectionString = await resolveConnectionString(target);
  const client = new Client({ connectionString });

  await client.connect();

  try {
    const { applied, skipped } = await applyMigrations(client);

    for (const file of skipped) {
      console.info(`[migrate] Ignorée (déjà appliquée) : ${file}`);
    }
    for (const file of applied) {
      console.info(`[migrate] Appliquée (${target}) : ${file}`);
    }

    if (applied.length === 0 && skipped.length === 0) {
      console.info('[migrate] Aucune migration trouvée.');
      return;
    }

    console.info(
      `[migrate] ${applied.length} migration(s) appliquée(s), ${skipped.length} déjà à jour.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate] Échec :', error);
  process.exit(1);
});