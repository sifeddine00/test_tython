import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, apiRequestData, getStoredToken, storeToken } from './client';
import { authApi } from './index';
import { errorResponse, jsonResponse } from '@/test/setup';

/**
 * Tests du client HTTP.
 *
 * C'est le point de contact unique avec le réseau : une régression ici casse
 * toute l'application silencieusement, alors qu'elle compile et se construit.
 */

const AGENT = {
  id: 'c629c527-569e-4589-8f76-fbb303e3be0f',
  email: 'karim.benali@helpdeskpro.com',
  fullName: 'Karim Benali',
  role: 'agent' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('apiRequest', () => {
  it('compose l\'URL sur /api et envoie le jeton stocké', async () => {
    storeToken('jeton-valide');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: AGENT }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/me');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-valide');
  });

  it('n\'envoie aucun en-tête Authorization quand auth est false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/login', { method: 'POST', body: {}, auth: false });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('sérialise le corps et pose Content-Type uniquement s\'il existe', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/tickets', { method: 'POST', body: { title: 'Bonjour' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"title":"Bonjour"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('convertit une enveloppe d\'erreur en ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse(401, 'UNAUTHORIZED', 'Authentification requise.')),
    );

    const error = await apiRequest('/auth/me').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect((error as ApiError).isUnauthorized).toBe(true);
  });

  it('retombe sur UNKNOWN_ERROR quand le corps d\'erreur est illisible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'pas du json',
      } as Response),
    );

    const error = await apiRequest('/tickets').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UNKNOWN_ERROR');
  });

  it('traduit une panne réseau en ApiError de statut 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await apiRequest('/tickets').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('renvoie undefined sur une réponse 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' } as Response),
    );

    await expect(apiRequest('/tickets/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});

describe('apiRequestData', () => {
  it('extrait le champ data de l\'enveloppe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: AGENT })));

    await expect(apiRequestData<typeof AGENT>('/auth/me')).resolves.toEqual(AGENT);
  });
});

describe('authApi.me — forme de la réponse', () => {
  /**
   * Régression : le backend renvoyait `{ data: { user } }` alors que le client
   * attend `{ data: user }`. Résultat, `profile.fullName` valait undefined après
   * restauration de session : l'interface affichait un profil vide sans
   * qu'aucune erreur ne soit levée. Ce test échoue si la forme change.
   */
  it('lit le profil directement dans data, sans niveau user intermédiaire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: AGENT })));

    const profile = await authApi.me();

    expect(profile.fullName).toBe('Karim Benali');
    expect(profile.email).toBe('karim.benali@helpdeskpro.com');
    expect('user' in profile).toBe(false);
  });
});

describe('persistance du jeton', () => {
  it('fait aller-retour dans localStorage', () => {
    expect(getStoredToken()).toBeNull();

    storeToken('jeton-1');
    expect(getStoredToken()).toBe('jeton-1');
  });

  it('renvoie null au lieu de lever quand le stockage est refusé', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage refusé');
    });

    expect(getStoredToken()).toBeNull();
    getItem.mockRestore();
  });
});
