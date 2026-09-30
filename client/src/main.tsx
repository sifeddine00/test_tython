import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { App } from '@/App';
import '@/index.css';

/**
 * Point d'entrée.
 *
 * Les valeurs par défaut de `QueryClient` sont volontairement sobres : un seul
 * retry sur erreur réseau, aucun sur une erreur 4xx — une requête rejetée par
 * la validation ne deviendra pas valide en la répétant.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Élément racine #root introuvable dans index.html.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);