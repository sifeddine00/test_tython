import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { dashboardApi, ticketsApi, usersApi } from '@/api';
import type { DashboardStats, ListTicketsFilters, Paginated, PublicUser, Ticket } from '@/api/types';

/**
 * Hooks de données.
 *
 * Les clés de cache sont construites par des fonctions : la liste est
 * invalidée en bloc par famille (`['tickets']`) sans énumérer à la main chaque
 * combinaison de filtres.
 */

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: ListTicketsFilters) => ['tickets', 'list', filters] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
};

export function useTickets(filters: ListTicketsFilters): UseQueryResult<Paginated<Ticket>> {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: ({ signal }) => ticketsApi.list(filters, signal),
    staleTime: 10_000,
  });
}

export function useTicket(id: string | undefined): UseQueryResult<Ticket> {
  return useQuery({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => ticketsApi.getById(id as string),
    enabled: id !== undefined,
  });
}

export function useAssignableUsers(): UseQueryResult<PublicUser[]> {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    staleTime: 5 * 60_000,
  });
}

export function useDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 30_000,
  });
}

/**
 * Mutations de ticket.
 *
 * Toutes réinvalident le détail du ticket concerné, sa liste et le tableau de
 * bord : un changement de statut modifie les trois, les oublier produirait un
 * état incohérent à l'écran.
 */
export function useTicketMutations(id?: string) {
  const queryClient = useQueryClient();

  const invalidate = async (ticketId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ...(ticketId !== undefined
        ? [queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) })]
        : []),
    ]);
  };

  const createTicket = useMutation({
    mutationFn: ticketsApi.create,
    onSuccess: () => invalidate(),
  });

  const updateTicket = useMutation({
    mutationFn: ({
      ticketId,
      input,
    }: {
      ticketId: string;
      input: { title?: string; description?: string; priority?: 'low' | 'medium' | 'high' };
    }) => ticketsApi.update(ticketId, input),
    onSuccess: (ticket) => invalidate(ticket.id),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: 'open' | 'in_progress' | 'resolved' | 'closed';
    }) => ticketsApi.updateStatus(ticketId, status),
    onSuccess: (ticket) => invalidate(ticket.id),
  });

  const assignTicket = useMutation({
    mutationFn: ({
      ticketId,
      assignedTo,
    }: {
      ticketId: string;
      assignedTo: string | null;
    }) => ticketsApi.assign(ticketId, assignedTo),
    onSuccess: (ticket) => invalidate(ticket.id),
  });

  return { createTicket, updateTicket, updateStatus, assignTicket, invalidate, ticketId: id };
}