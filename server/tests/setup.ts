import { afterAll, beforeAll } from 'vitest';
import { prepareTestDatabase } from './dbSetup.js';
import { closePool } from '../src/db/pool.js';

/**
 * Préparation unique de la base de test.
 * `fileParallelism: false` dans vitest.config.ts garantit qu'aucun fichier de
 * test ne concurrence cette étape.
 */
beforeAll(async () => {
  await prepareTestDatabase();
});

afterAll(async () => {
  await closePool();
});
