import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardStats, useTicket, useTickets } from './useTickets';
import { errorResponse, jsonResponse } from '@/test/setup';

const TICKET = {
  id: '7a3c1d2e-0000-4000-8000-000000000001',
  title: 'Imprimante du bureau 3 ne répond plus',
  description: 'Elle reste hors ligne depuis ce matin.',
  status: 'open' as const,
  priority: 'high' as const,
  assignedTo: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>;
}

/**
 * Rendu dans un composant qui écrit le résultat dans le DOM.
 *
 * Tester un hook React Query suppose d'observer un état asynchrone : passer par
 * `render` permet d'attendre la résolution avec `findBy*`, ce qui évite à la fois
 * les assertions prématurées et les avertissements `act()`.
 */
function ProbeTickets() {
  const { data, isPending, isError, error } = useTickets({});

  if (isPending) return <p>Chargement…</p>;
  if (isError) return <p role="alert">Erreur : {String((error as Error).message)}</p>;

  return (
    <ul>
      {data?.data.map((ticket) => (
        <li key={ticket.id}>{ticket.title}</li>
      ))}
    </ul>
  );
}

function ProbeTicket({ id }: { id: string | undefined }) {
  const { data, isPending, isError, error } = useTicket(id);

  if (isPending) return <p>Chargement…</p>;
  if (isError) return <p role="alert">Erreur : {String((error as Error).message)}</p>;

  return <p>{data?.title}</p>;
}

function ProbeStats() {
  const { data, isPending } = useDashboardStats();
  if (isPending) return <p>Chargement…</p>;
  return <p>Total {data?.totalTickets}</p>;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTickets', () => {
  it('expose la liste et ses métadonnées de pagination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [TICKET],
          meta: { total: 10, page: 1, limit: 20, totalPages: 1 },
        }),
      ),
    );

    render(<ProbeTickets />, { wrapper: Wrapper });

    expect(await screen.findByText(TICKET.title)).toBeInTheDocument();
  });

  it('construit la requête à partir des filtres', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    function Probe() {
      const { isPending } = useTickets({ status: 'open', priority: 'high', search: 'imprimante' });
      return <p>{isPending ? 'Chargement…' : 'Prêt'}</p>;
    }

    render(<Probe />, { wrapper: Wrapper });

    expect(await screen.findByText('Prêt')).toBeInTheDocument();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('status=open');
    expect(url).toContain('priority=high');
    expect(url).toContain('search=imprimante');
  });

  it('affiche l\'erreur renvoyée par le serveur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse(403, 'FORBIDDEN', 'Accès refusé.')),
    );

    render(<ProbeTickets />, { wrapper: Wrapper });

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé.');
  });

  it('reste en attente quand l\'identifiant est absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ProbeTicket id={undefined} />, { wrapper: Wrapper });

    expect(await screen.findByText('Chargement…')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useTicket', () => {
  it('charge le détail demandé', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: TICKET })));

    render(<ProbeTicket id={TICKET.id} />, { wrapper: Wrapper });

    expect(await screen.findByText(TICKET.title)).toBeInTheDocument();
  });
});

describe('useDashboardStats', () => {
  it('lit le total sous la clé totalTickets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            totalTickets: 10,
            byStatus: { open: 3, in_progress: 2, resolved: 3, closed: 2 },
            topAgents: [],
          },
        }),
      ),
    );

    render(<ProbeStats />, { wrapper: Wrapper });

    expect(await screen.findByText('Total 10')).toBeInTheDocument();
  });
});