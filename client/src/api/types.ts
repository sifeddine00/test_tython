/**
 * Types partagés avec l'API.
 *
 * Ils reflètent exactement les DTO renvoyés par le backend : toute divergence
 * ici est un bug d'intégration, et le compilateur la signalera dès qu'un champ
 * sera utilisé.
 */

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
export type UserRole = 'admin' | 'agent';

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: PublicUser;
  assignedTo: PublicUser | null;
  resolvedBy: PublicUser | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  ticketId: string;
  message: string;
  author: PublicUser;
  createdAt: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type DashboardStats = {
  totalTickets: number;
  byStatus: Record<TicketStatus, number>;
  topAgents: Array<{
    userId: string;
    fullName: string;
    email: string;
    resolvedCount: number;
  }>;
};

export type LoginPayload = {
  token: string;
  user: PublicUser;
};

export type ListTicketsFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
};