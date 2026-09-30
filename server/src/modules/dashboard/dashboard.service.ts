import type { TicketStatus } from '../shared/schemas.js';
import {
  countAllTickets,
  countTicketsByStatus,
  findTopResolvingAgents,
} from './dashboard.repository.js';

const TOP_AGENTS_LIMIT = 5;

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

function emptyStatusCounts(): Record<TicketStatus, number> {
  return { open: 0, in_progress: 0, resolved: 0, closed: 0 };
}

/**
 * Service dashboard (section 4.4 du CDC) : total, open, in_progress, top 5 agents.
 * Les compteurs sont initialisés à 0 pour tous les statuts, y compris ceux
 * qui n'ont aucun ticket : le frontend n'a pas à gérer des clés absentes.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [total, statusRows, topAgentRows] = await Promise.all([
    countAllTickets(),
    countTicketsByStatus(),
    findTopResolvingAgents(TOP_AGENTS_LIMIT),
  ]);

  const byStatus = emptyStatusCounts();
  for (const row of statusRows) {
    byStatus[row.status] = Number.parseInt(row.count, 10);
  }

  return {
    totalTickets: total,
    byStatus,
    topAgents: topAgentRows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      resolvedCount: Number.parseInt(row.resolved_count, 10),
    })),
  };
}
