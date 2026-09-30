import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { useAuth } from '@/auth/useAuth';

vi.mock('@/auth/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function renderPage(initialPath = '/login', state: unknown = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Tableau de bord</p>} />
        <Route path="/tickets" element={<p>Liste des tickets</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  const login = vi.fn().mockResolvedValue(undefined);
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login,
    logout: vi.fn(),
    ...overrides,
  });
  return login;
}

afterEach(() => {
  mockedUseAuth.mockReset();
});

describe('LoginPage', () => {
  it('transmet les identifiants saisis', async () => {
    const login = stubAuth();
    renderPage();

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'karim.benali@helpdeskpro.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('karim.benali@helpdeskpro.com', 'Password123!'),
    );
  });

  it('retourne sur la route initialement demandée après connexion', async () => {
    stubAuth();
    renderPage('/login', { from: '/tickets' });

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'a@b.c');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(screen.getByText('Liste des tickets')).toBeInTheDocument());
  });

  it('affiche le message renvoyé par le serveur en cas d\'échec', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Identifiants invalides.'), { status: 401, name: 'ApiError' }),
      );
    stubAuth({ login });
    renderPage();

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'karim.benali@helpdeskpro.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides.');
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
  });

  it('ne propose plus le formulaire si une session est déjà active', () => {
    stubAuth({
      isAuthenticated: true,
      user: {
        id: 'c629c527-569e-4589-8f76-fbb303e3be0f',
        email: 'karim.benali@helpdeskpro.com',
        fullName: 'Karim Benali',
        role: 'agent',
      },
    });

    renderPage();

    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
  });
});