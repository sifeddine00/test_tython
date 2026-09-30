import { Client } from 'pg';

/**
 * Création des bases `helpdeskpro` et `helpdeskpro_test`.
 * Idempotent : la présence d'une base est traitée comme un succès.
 */

const MAINTENANCE_DB = 'postgres';

type Target = { name: string; url: string };

async function createDatabaseIfMissing(target: Target): Promise<boolean> {
  // Connexion à la base de maintenance : `CREATE DATABASE` ne peut pas être
  // exécuté depuis la base à créer.
  const adminUrl = new URL(target.url);
  adminUrl.pathname = `/${MAINTENANCE_DB}`;

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      target.name,
    ]);

    if (existing.rowCount && existing.rowCount > 0) {
      console.info(`[db] Base "${target.name}" déjà présente.`);
      return false;
    }

    // Identifiant d'un nom de base non parameterisable : l'identifiant est
    // une constante de ce script, jamais une entrée utilisateur.
    await client.query(`CREATE DATABASE "${target.name}"`);
    console.info(`[db] Base "${target.name}" créée.`);
    return true;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const { env } = await import('../src/config/env.js');

  const targets: Target[] = [
    { name: 'helpdeskpro', url: env.DATABASE_URL },
    { name: 'helpdeskpro_test', url: env.TEST_DATABASE_URL },
  ];

  let created = 0;
  for (const target of targets) {
    if (await createDatabaseIfMissing(target)) {
      created += 1;
    }
  }

  console.info(`[db] ${created} base(s) créée(s). Prêt pour \`npm run db:migrate\`.`);
}

main().catch((error: unknown) => {
  console.error('[db] Échec de la création des bases :', error);
  process.exit(1);
});
