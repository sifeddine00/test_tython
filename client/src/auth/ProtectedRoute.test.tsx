import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './useAuth';

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>Tableau de bord</p>} />
          <Route path="/tickets" element={<p>Liste des tickets</p>} />
        </Route>
        <Route path="/login" element={<p>Page de connexion</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  mockedUseAuth.mockReset();
});

describe('ProtectedRoute', () => {
  it('affiche un chargement tant que la session est vérifiée', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/');

    expect(screen.getByText('Vérification de la session…')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
  });

  it('redirige vers /login sans session', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/tickets');

    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
    expect(screen.queryByText('Liste des tickets')).not.toBeInTheDocument();
  });

  it('laisse passer une route imbriquée avec une session valide', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'c629c527-569e-4589-8f76-fbb303e3be0f',
        email: 'karim.benali@helpdeskpro.com',
        fullName: 'Karim Benali',
        role: 'agent',
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/tickets');

    expect(screen.getByText('Liste des tickets')).toBeInTheDocument();
  });
});