/**
 * Mise en place des tests d'interface.
 *
 * `fetch` est remplacé par un mock global plutôt que par MSW : le client HTTP
 * n'a qu'un seul point de contact (`api/client.ts`), donc un mock unique suffit
 * et évite une dépendance de plus.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/**
 * Construit une `Response` JSON minimale, suffisante pour le client HTTP.
 *
 * `text()` est définie explicitement : `apiRequest` lit le corps via `text()`
 * puis `JSON.parse`, jamais via `json()`.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

/** Enveloppe d'erreur du backend. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/**
 * Programme une réponse unique pour n'importe quelle URL.
 *
 * Un seul `mockResolvedValue` couvre toutes les requêtes : les tests qui
 * discriminent une URL le font via un `mockImplementation` explicite.
 */
export function mockFetchOnce(payload: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload, status)));
}