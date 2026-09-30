/**
 * Client HTTP unique de l'application.
 *
 * Toutes les requêtes passent par ici : le jeton JWT y est injecté une seule
 * fois, et le format d'erreur du backend y est converti en `ApiError` afin que
 * les composants n'aient jamais à lire une enveloppe `error` au hasard.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Un 401 signifie « session invalide » : le token a expiré ou a été révoqué.
   * L'AuthProvider s'en sert pour purger le stockage, mais seulement après une
   * vérification auprès du serveur — une valeur falsifiable isolée ne doit pas
   * suffire à effacer une session valide.
   */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

const TOKEN_STORAGE_KEY = 'helpdeskpro.token';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Navigation privée ou stockage refusé : la session ne sera pas persistée.
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Sans stockage, la session reste valable jusqu'au rechargement de l'onglet.
  }
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Rien à faire : la clé est peut-être déjà absente.
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
};

const BASE_URL = '/api';

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = payload as ApiErrorBody | null;
    const error = envelope?.error;

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `La requête a échoué (${response.status}).`,
      error?.details,
    );
  }

  return payload as T;
}

/** Extrait le champ `data` de l'enveloppe succès `{ data, meta }`. */
export async function apiRequestData<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const payload = await apiRequest<{ data: T }>(path, options);
  return payload.data;
}