import { apiRequest, apiRequestData } from './client';
import type {
  Comment,
  DashboardStats,
  ListTicketsFilters,
  LoginPayload,
  Paginated,
  PublicUser,
  Ticket,
  TicketPriority,
  TicketStatus,
} from './types';

/**
 * Surface d'appel de l'API, groupée par ressource.
 *
 * Aucun composant n'appelle `fetch` directement : passer par ces fonctions
 * garantit que les routes et les charges utiles restent alignées sur le CDC.
 */

type DataEnvelope<T> = { data: T };
type ListEnvelope<T> = { data: T[]; meta: Paginated<T>['meta'] };

// ---------------------------------------------------------------- Authentification

export const authApi = {
  login: (email: string, password: string) =>
    apiRequestData<LoginPayload>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  me: () => apiRequestData<PublicUser>('/auth/me'),
};

// ---------------------------------------------------------------------------- Users

export const usersApi = {
  list: () => apiRequestData<PublicUser[]>('/users'),
};

// --------------------------------------------------------------------------- Tickets

export function buildTicketsQuery(filters: ListTicketsFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

export const ticketsApi = {
  list: (filters: ListTicketsFilters = {}, signal?: AbortSignal) =>
    apiRequest<ListEnvelope<Ticket>>(`/tickets${buildTicketsQuery(filters)}`, {
      ...(signal ? { signal } : {}),
    }),

  getById: (id: string) => apiRequestData<Ticket>(`/tickets/${id}`),

  create: (input: { title: string; description: string; priority?: TicketPriority }) =>
    apiRequestData<Ticket>('/tickets', { method: 'POST', body: input }),

  update: (
    id: string,
    input: { title?: string; description?: string; priority?: TicketPriority },
  ) => apiRequestData<Ticket>(`/tickets/${id}`, { method: 'PUT', body: input }),

  updateStatus: (id: string, status: TicketStatus) =>
    apiRequestData<Ticket>(`/tickets/${id}/status`, { method: 'PATCH', body: { status } }),

  assign: (id: string, assignedTo: string | null) =>
    apiRequestData<Ticket>(`/tickets/${id}/assign`, { method: 'PATCH', body: { assignedTo } }),
};

// ------------------------------------------------------------------------- Commentaires

export const commentsApi = {
  listByTicket: (ticketId: string) =>
    apiRequest<ListEnvelope<Comment>>(`/tickets/${ticketId}/comments`).then(
      (response) => response.data,
    ),

  create: (ticketId: string, message: string) =>
    apiRequest<DataEnvelope<Comment>>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: { message },
    }).then((response) => response.data),
};

// --------------------------------------------------------------------------- Dashboard

export const dashboardApi = {
  stats: () => apiRequestData<DashboardStats>('/dashboard/stats'),
};