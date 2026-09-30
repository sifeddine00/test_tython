import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { getStoredToken, storeToken } from '@/api/client';
import { errorResponse, jsonResponse } from '@/test/setup';

const AGENT = {
  id: 'c629c527-569e-4589-8f76-fbb303e3be0f',
  email: 'karim.benali@helpdeskpro.com',
  fullName: 'Karim Benali',
  role: 'agent' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Expose l'état du contexte pour pouvoir l'observer depuis le DOM. */
function Probe() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="fullName">{user?.fullName ?? 'aucun'}</span>
      <button
        type="button"
        onClick={() => {
          void login('karim.benali@helpdeskpro.com', 'Password123!').catch(() => undefined);
        }}
      >
        Se connecter
      </button>
      <button type="button" onClick={logout}>
        Se déconnecter
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('AuthProvider — sans jeton stocké', () => {
  it('démarre sans session et sans appel réseau', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderProbe();

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('fullName')).toHaveTextContent('aucun');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AuthProvider — connexion', () => {
  it('expose le profil et persiste le jeton', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { token: 'jeton-1', tokenType: 'Bearer', expiresIn: 3600, user: AGENT },
        }),
      ),
    );

    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Karim Benali')).toBeInTheDocument();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(getStoredToken()).toBe('jeton-1');
  });

  it('ne persiste aucun jeton si la connexion est refusée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(401, 'INVALID_CREDENTIALS', 'Identifiants invalides.'),
      ),
    );

    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(getStoredToken()).toBeNull();
  });

  it('déconnecte et efface le jeton', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { token: 'jeton-1', tokenType: 'Bearer', expiresIn: 3600, user: AGENT },
        }),
      ),
    );

    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Karim Benali')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(screen.getByTestId('fullName')).toHaveTextContent('aucun');
    expect(getStoredToken()).toBeNull();
  });
});

describe('AuthProvider — restauration de session', () => {
  it('valide le jeton stocké auprès du serveur', async () => {
    storeToken('jeton-stale');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: AGENT }));
    vi.stubGlobal('fetch', fetchMock);

    renderProbe();

    // Tant que /auth/me n'a pas répondu, l'interface reste en attente.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(await screen.findByText('Karim Benali')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.anything());
  });

  it('purge un jeton expiré au lieu d\'afficher une session fantôme', async () => {
    storeToken('jeton-expire');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse(401, 'UNAUTHORIZED', 'Jeton invalide.')),
    );

    renderProbe();

    await waitFor(() => expect(getStoredToken()).toBeNull());
    expect(screen.getByTestId('fullName')).toHaveTextContent('aucun');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('efface aussi le jeton quand le serveur est injoignable', async () => {
    storeToken('jeton-orphelin');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderProbe();

    await waitFor(() => expect(getStoredToken()).toBeNull());
    expect(screen.getByTestId('fullName')).toHaveTextContent('aucun');
  });
});