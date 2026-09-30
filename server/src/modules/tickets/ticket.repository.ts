import { query, queryOne } from '../../db/pool.js';
import type { TicketPriority, TicketStatus } from '../shared/schemas.js';
import type { TicketRow } from './ticket.dto.js';

/**
 * Repository `tickets` : seul module écrivant du SQL sur cette table.
 * Toutes les valeurs passent par des paramètres $1..$n.
 */

/** Projection commune : évite de dupliquer la liste des colonnes. */
const TICKET_SELECT = `
    SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        t.created_by,
        creator.full_name  AS created_by_full_name,
        creator.email      AS created_by_email,
        creator.role       AS created_by_role,
        t.assigned_to,
        assignee.full_name AS assigned_to_full_name,
        assignee.email     AS assigned_to_email,
        assignee.role      AS assigned_to_role,
        t.resolved_by,
        resolver.full_name AS resolved_by_full_name,
        resolver.email     AS resolved_by_email,
        resolver.role      AS resolved_by_role
    FROM tickets t
    INNER JOIN users creator  ON creator.id = t.created_by
    LEFT  JOIN users assignee ON assignee.id = t.assigned_to
    LEFT  JOIN users resolver ON resolver.id = t.resolved_by
`;

export type TicketFilters = {
  status?: TicketStatus | undefined;
  priority?: TicketPriority | undefined;
  assignedTo?: string | undefined;
  /** Recherche insensible à la casse sur le titre OU la description. */
  search?: string | undefined;
};

type FilterClause = { sql: string; params: unknown[] };

/**
 * Construit dynamiquement la clause WHERE à partir des filtres.
 * Les valeurs sont toujours paramétrées ; seul le nombre de paramètres
 * varie, jamais leur contenu.
 */
function buildWhere(filters: TicketFilters): FilterClause {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`t.priority = $${params.length}`);
  }

  if (filters.assignedTo === 'unassigned') {
    conditions.push('t.assigned_to IS NULL');
  } else if (filters.assignedTo) {
    params.push(filters.assignedTo);
    conditions.push(`t.assigned_to = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const placeholder = `$${params.length}`;
    conditions.push(`(lower(t.title) LIKE ${placeholder} OR lower(t.description) LIKE ${placeholder})`);
  }

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/** Insère un ticket et renvoie la ligne complète avec ses jointures. */
export async function insertTicket(input: {
  title: string;
  description: string;
  priority: TicketPriority;
  createdBy: string;
}): Promise<TicketRow> {
  const created = await queryOne<{ id: string }>(
    `INSERT INTO tickets (title, description, priority, status, created_by)
     VALUES ($1, $2, $3, 'open', $4)
     RETURNING id`,
    [input.title, input.description, input.priority, input.createdBy],
  );

  if (!created) {
    throw new Error('Insertion du ticket échouée.');
  }

  const row = await findTicketById(created.id);
  if (!row) {
    throw new Error('Ticket introuvable juste après insertion.');
  }
  return row;
}

export async function findTicketById(id: string): Promise<TicketRow | null> {
  return queryOne<TicketRow>(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
}

export async function updateTicketFields(
  id: string,
  fields: { title?: string; description?: string; priority?: TicketPriority },
): Promise<TicketRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (fields.title !== undefined) {
    params.push(fields.title);
    assignments.push(`title = $${params.length}`);
  }
  if (fields.description !== undefined) {
    params.push(fields.description);
    assignments.push(`description = $${params.length}`);
  }
  if (fields.priority !== undefined) {
    params.push(fields.priority);
    assignments.push(`priority = $${params.length}`);
  }

  params.push(id);
  await query(
    `UPDATE tickets SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );

  return findTicketById(id);
}

export type StatusUpdatePayload = {
  status: TicketStatus;
  resolvedAt: Date | null;
  resolvedBy: string | null;
};

export async function updateTicketStatus(
  id: string,
  payload: StatusUpdatePayload,
): Promise<TicketRow | null> {
  await query(
    `UPDATE tickets
     SET status = $1, resolved_at = $2, resolved_by = $3
     WHERE id = $4`,
    [payload.status, payload.resolvedAt, payload.resolvedBy, id],
  );

  return findTicketById(id);
}

export async function updateTicketAssignee(
  id: string,
  assignedTo: string | null,
): Promise<TicketRow | null> {
  await query('UPDATE tickets SET assigned_to = $1 WHERE id = $2', [assignedTo, id]);
  return findTicketById(id);
}

/** Liste paginée + total, pour alimenter `meta`. */
export async function listTickets(
  filters: TicketFilters,
  page: number,
  limit: number,
): Promise<{ rows: TicketRow[]; total: number }> {
  const { sql: whereSql, params: whereParams } = buildWhere(filters);

  const countRow = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM tickets t${whereSql}`,
    whereParams,
  );
  const total = countRow ? Number.parseInt(countRow.count, 10) : 0;

  const offset = (page - 1) * limit;
  const rows = await query<TicketRow>(
    `${TICKET_SELECT}${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
    [...whereParams, limit, offset],
  );

  return { rows, total };
}
