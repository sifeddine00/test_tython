import { NotFoundError, ValidationError, ERROR_CODES } from '../../errors/AppError.js';
import type { PublicUser } from '../users/user.dto.js';
import {
  findCommentById,
  findTicketStatus,
  insertComment,
  listCommentsByTicket,
} from './comment.repository.js';
import type { CommentDto } from '../tickets/ticket.dto.js';
import { toCommentDto } from '../tickets/ticket.dto.js';
import type { CreateCommentInput } from './comment.schema.js';

/**
 * Service commentaires.
 * Contient la règle métier 4.3 du CDC : aucun commentaire sur un ticket closed.
 */

export async function addComment(
  ticketId: string,
  author: PublicUser,
  input: CreateCommentInput,
): Promise<CommentDto> {
  const ticket = await findTicketStatus(ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  // Règle métier obligatoire 4.3
  if (ticket.status === 'closed') {
    throw new ValidationError(
      'Impossible d\'ajouter un commentaire : le ticket est fermé.',
      ERROR_CODES.COMMENT_ON_CLOSED_TICKET,
    );
  }

  const row = await insertComment({ ticketId, authorId: author.id, message: input.message });
  return toCommentDto(row);
}

export async function getTicketComments(ticketId: string): Promise<CommentDto[]> {
  const ticket = await findTicketStatus(ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const rows = await listCommentsByTicket(ticketId);
  return rows.map(toCommentDto);
}

/** Lecture d'un commentaire isolé ; `null` s'il n'existe pas. */
export async function getCommentById(id: string): Promise<CommentDto | null> {
  const row = await findCommentById(id);
  return row ? toCommentDto(row) : null;
}
