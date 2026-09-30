import { query, queryOne } from '../../db/pool.js';
import type { CommentRow } from '../tickets/ticket.dto.js';

/**
 * Repository `ticket_comments` : seul module écrivant du SQL sur cette table.
 */

/** Statut du ticket parent, nécessaire à la règle métier 4.3. */
export async function findTicketStatus(ticketId: string): Promise<{ status: string } | null> {
  return queryOne<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [ticketId]);
}

export async function insertComment(input: {
  ticketId: string;
  authorId: string;
  message: string;
}): Promise<CommentRow> {
  const created = await queryOne<{ id: string }>(
    `INSERT INTO ticket_comments (ticket_id, author_id, message)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [input.ticketId, input.authorId, input.message],
  );

  if (!created) {
    throw new Error('Insertion du commentaire échouée.');
  }

  const row = await findCommentById(created.id);
  if (!row) {
    throw new Error('Commentaire introuvable juste après insertion.');
  }
  return row;
}

export async function findCommentById(id: string): Promise<CommentRow | null> {
  return queryOne<CommentRow>(
    `SELECT
        c.id,
        c.ticket_id,
        c.message,
        c.created_at,
        c.author_id,
        a.full_name AS author_full_name,
        a.email     AS author_email,
        a.role      AS author_role
     FROM ticket_comments c
     INNER JOIN users a ON a.id = c.author_id
     WHERE c.id = $1`,
    [id],
  );
}

/** Historique chronologique des commentaires d'un ticket. */
export async function listCommentsByTicket(ticketId: string): Promise<CommentRow[]> {
  return query<CommentRow>(
    `SELECT
        c.id,
        c.ticket_id,
        c.message,
        c.created_at,
        c.author_id,
        a.full_name AS author_full_name,
        a.email     AS author_email,
        a.role      AS author_role
     FROM ticket_comments c
     INNER JOIN users a ON a.id = c.author_id
     WHERE c.ticket_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
[ticketId],
   );
}
