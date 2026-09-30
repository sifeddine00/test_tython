import { query, queryOne } from '../../db/pool.js';

/** Repository `dashboard` : requêtes d'agrégation, aucune logique métier. */

export type StatusCountRow = {
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  count: string;
};

export type TopAgentRow = {
  user_id: string;
  full_name: string;
  email: string;
  resolved_count: string;
};

/** Compte total des tickets. */
export async function countAllTickets(): Promise<number> {
  const row = await queryOne<{ count: string }>('SELECT count(*)::text AS count FROM tickets');
  return row ? Number.parseInt(row.count, 10) : 0;
}

/** Compte des tickets par statut, en une seule requête. */
export async function countTicketsByStatus(): Promise<StatusCountRow[]> {
  return query<StatusCountRow>(
    'SELECT status, count(*)::text AS count FROM tickets GROUP BY status',
  );
}

/**
 * Top 5 des agents ayant résolu le plus de tickets.
 *
 * L'attribution s'appuie sur `resolved_by`, renseigné à la première transition
 * vers `resolved`. Compter sur `assigned_to` confondrait l'agent en charge avec
 * l'agent ayant réellement résolu.
 *
 * Les tickets en `resolved` comme en `closed` sont comptabilisés : fermer un
 * ticket ne doit pas faire disparaître la résolution de l'historique.
 */
export async function findTopResolvingAgents(limit: number): Promise<TopAgentRow[]> {
  return query<TopAgentRow>(
    `SELECT
        u.id         AS user_id,
        u.full_name  AS full_name,
        u.email      AS email,
        count(t.id)::text AS resolved_count
     FROM tickets t
     INNER JOIN users u ON u.id = t.resolved_by
     WHERE t.status IN ('resolved', 'closed')
     GROUP BY u.id, u.full_name, u.email
     ORDER BY count(t.id) DESC, u.full_name ASC
     LIMIT $1`,
    [limit],
  );
}
