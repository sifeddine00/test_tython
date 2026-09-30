import { ApiError } from '@/api/client';

/**
 * Traduction des erreurs en messages affichables.
 *
 * Isolé des composants pour que ceux-ci n'exportent que des composants : le
 * lint `react-refresh` interdit de mélanger les deux dans un même fichier.
 */

export function toErrorMessage(
  error: unknown,
  fallback = 'Une erreur inattendue est survenue.',
): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}