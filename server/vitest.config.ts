import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Imposé explicitement plutôt que laissé au défaut : `src/db/pool.ts` en
    // dépend pour router les tests vers `helpdeskpro_test`.
    // BCRYPT_ROUNDS est ramené au minimum : le hachage est le poste dominant du
    // temps d'exécution de la suite, et le coût réel reste couvert par les tests.
    env: { NODE_ENV: 'test', BCRYPT_ROUNDS: '10' },
    // Une seule connexion PostgreSQL à la fois : les tests partagent une base.
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
});
