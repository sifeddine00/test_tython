import { ForbiddenError, NotFoundError, ValidationError, ERROR_CODES } from '../../errors/AppError.js';
import type { TicketStatus } from '../shared/schemas.js';
import type { PublicUser } from '../users/user.dto.js';
import { isUserWithRole } from '../users/user.repository.js';
import { buildMeta, type PaginationMeta } from '../../utils/pagination.js';
import {
  findTicketById,
  insertTicket,
  listTickets,
  updateTicketAssignee,
  updateTicketFields,
  updateTicketStatus,
} from './ticket.repository.js';
import { toTicketDto, type TicketDto } from './ticket.dto.js';
import type {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
  UpdateStatusInput,
} from './ticket.schema.js';

/**
 * Service tickets : concentration exclusive des règles métier.
 * Ne dépend ni d'Express, ni du SQL, ni des codecs HTTP.
 */

/**
 * Règle 4.2 : un ticket ne peut passer à `closed` que s'il est déjà `resolved`.
 * Unique source de vérité de cette contrainte côté application.
 */
function assertStatusTransitionIsAllowed(
  currentStatus: TicketStatus,
  nextStatus: TicketStatus,
): void {
  if (nextStatus === 'closed' && currentStatus !== 'resolved') {
    throw new ValidationError(
      `Transition interdite : un ticket ne peut être fermé que s'il est déjà résolu (statut actuel : ${currentStatus}).`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }
}

/**
 * Un agent ne modifie que les tickets dont il est l'auteur ou l'assigné.
 * L'administrateur n'est pas restreint.
 */
function assertCanModifyTicket(ticket: TicketDto, user: PublicUser): void {
  if (user.role === 'admin') {
    return;
  }

  const isAuthor = ticket.createdBy.id === user.id;
  const isAssignee = ticket.assignedTo?.id === user.id;

  if (!isAuthor && !isAssignee) {
    throw new ForbiddenError(
      'Vous ne pouvez modifier que les tickets que vous avez créés ou qui vous sont assignés.',
    );
  }
}

export async function createTicket(
  input: CreateTicketInput,
  author: PublicUser,
): Promise<TicketDto> {
  const row = await insertTicket({
    title: input.title,
    description: input.description,
    priority: input.priority,
    createdBy: author.id,
  });
  return toTicketDto(row);
}

export async function getTicketById(id: string): Promise<TicketDto> {
  const row = await findTicketById(id);

  if (!row) {
    throw new NotFoundError('Ticket', id);
  }

  return toTicketDto(row);
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  user: PublicUser,
): Promise<TicketDto> {
  const existing = await getTicketById(id);
  assertCanModifyTicket(existing, user);

  const row = await updateTicketFields(id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
  });

  if (!row) {
    throw new NotFoundError('Ticket', id);
  }

  return toTicketDto(row);
}

export async function changeTicketStatus(
  id: string,
  input: UpdateStatusInput,
  user: PublicUser,
): Promise<TicketDto> {
  const existing = await getTicketById(id);
  assertCanModifyTicket(existing, user);
  assertStatusTransitionIsAllowed(existing.status, input.status);

  // Horodatage et auteur de résolution : posés à la première transition vers
  // `resolved`, effacés si le ticket est rouvert. La contrainte CHECK
  // `tickets_resolution_consistency` garantit la cohérence en base.
  const becomesResolved = input.status === 'resolved' || input.status === 'closed';

  const resolvedAt = becomesResolved
    ? (existing.resolvedAt ? new Date(existing.resolvedAt) : new Date())
    : null;
  const resolvedBy = becomesResolved ? (existing.resolvedBy?.id ?? user.id) : null;

  const row = await updateTicketStatus(id, {
    status: input.status,
    resolvedAt,
    resolvedBy,
  });

  if (!row) {
    throw new NotFoundError('Ticket', id);
  }

  return toTicketDto(row);
}

export async function assignTicket(
  id: string,
  input: AssignTicketInput,
): Promise<TicketDto> {
  const existing = await getTicketById(id);

  if (input.assignedTo === null) {
    const row = await updateTicketAssignee(id, null);
    if (!row) {
      throw new NotFoundError('Ticket', id);
    }
    return toTicketDto(row);
  }

  // Seuls les comptes de rôle `agent` peuvent recevoir un ticket.
  const targetIsAgent = await isUserWithRole(input.assignedTo, 'agent');
  if (!targetIsAgent) {
    throw new ValidationError(
      'Un ticket ne peut être assigné qu\'à un utilisateur de rôle "agent".',
      ERROR_CODES.ASSIGNEE_MUST_BE_AGENT,
    );
  }

  if (existing.assignedTo?.id === input.assignedTo) {
    return existing;
  }

  const row = await updateTicketAssignee(id, input.assignedTo);
  if (!row) {
    throw new NotFoundError('Ticket', id);
  }

  return toTicketDto(row);
}

export async function getTickets(
  query: ListTicketsQuery,
): Promise<{ tickets: TicketDto[]; meta: PaginationMeta }> {
  const { rows, total } = await listTickets(
    {
      status: query.status,
      priority: query.priority,
      assignedTo: query.assignedTo,
      search: query.search,
    },
    query.page,
    query.limit,
  );

  return {
    tickets: rows.map(toTicketDto),
    meta: buildMeta({ page: query.page, limit: query.limit }, total),
  };
}
