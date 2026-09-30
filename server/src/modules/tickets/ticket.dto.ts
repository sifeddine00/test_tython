import type { TicketPriority, TicketStatus } from '../shared/schemas.js';

/** Référence compacte vers un utilisateur, imbriquée dans les réponses ticket. */
export type UserRef = {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'agent';
};

/** Ligne SQL de `tickets`, enrichie des jointures users. */
export type TicketRow = {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  created_by: string;
  created_by_full_name: string;
  created_by_email: string;
  created_by_role: 'admin' | 'agent';
  assigned_to: string | null;
  assigned_to_full_name: string | null;
  assigned_to_email: string | null;
  assigned_to_role: 'admin' | 'agent' | null;
  resolved_by: string | null;
  resolved_by_full_name: string | null;
  resolved_by_email: string | null;
  resolved_by_role: 'admin' | 'agent' | null;
};

export type CommentRow = {
  id: string;
  ticket_id: string;
  message: string;
  created_at: Date;
  author_id: string;
  author_full_name: string;
  author_email: string;
  author_role: 'admin' | 'agent';
};

/** Ticket tel qu'exposé par l'API. */
export type TicketDto = {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  createdBy: UserRef;
  assignedTo: UserRef | null;
  resolvedBy: UserRef | null;
};

export type CommentDto = {
  id: string;
  ticketId: string;
  message: string;
  createdAt: string;
  author: UserRef;
};

function toUserRef(
  id: string,
  fullName: string,
  email: string,
  role: 'admin' | 'agent',
): UserRef {
  return { id, fullName, email, role };
}

export function toTicketDto(row: TicketRow): TicketDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    createdBy: toUserRef(
      row.created_by,
      row.created_by_full_name,
      row.created_by_email,
      row.created_by_role,
    ),
    assignedTo:
      row.assigned_to && row.assigned_to_full_name && row.assigned_to_email && row.assigned_to_role
        ? toUserRef(
            row.assigned_to,
            row.assigned_to_full_name,
            row.assigned_to_email,
            row.assigned_to_role,
          )
        : null,
    resolvedBy:
      row.resolved_by && row.resolved_by_full_name && row.resolved_by_email && row.resolved_by_role
        ? toUserRef(
            row.resolved_by,
            row.resolved_by_full_name,
            row.resolved_by_email,
            row.resolved_by_role,
          )
        : null,
  };
}

export function toCommentDto(row: CommentRow): CommentDto {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    message: row.message,
    createdAt: row.created_at.toISOString(),
    author: toUserRef(
      row.author_id,
      row.author_full_name,
      row.author_email,
      row.author_role,
    ),
  };
}
