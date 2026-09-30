/**
 * Résout la base cible selon le paramètre `--target dev|test`.
 *
 * Partagé par les scripts migrate / reset / seed afin qu'aucun script ne
 * duplique la logique de sélection de la base.
 */
export type Target = 'dev' | 'test';

export function resolveTarget(): Target {
  const flagIndex = process.argv.indexOf('--target');
  const value = flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;

  if (value === 'test') {
    return 'test';
  }
  if (value === 'dev' || value === undefined) {
    return 'dev';
  }

  throw new Error(`Cible inconnue : "${value}". Utilisez "dev" ou "test".`);
}

export async function resolveConnectionString(target: Target): Promise<string> {
  const { env } = await import('../src/config/env.js');
  return target === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;
}
