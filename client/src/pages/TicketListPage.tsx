import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, InlineLoader } from '@/components/Feedback';
import { PRIORITIES, STATUSES, PRIORITY_DESCRIPTORS, STATUS_DESCRIPTORS, formatDateTime } from '@/lib/labels';
import type { ListTicketsFilters, TicketPriority, TicketStatus } from '@/api/types';

/**
 * Liste des tickets.
 *
 * Filtres conformes au CDC : statut, priorité, agent assigné et recherche plein
 * texte. La recherche est débattue sur deux caractères pour éviter une requête
 * par frappe.
 */
export function TicketListPage() {
  const [draftSearch, setDraftSearch] = useState('');
  const [filters, setFilters] = useState<ListTicketsFilters>({ page: 1, limit: 20 });

  const { data, isPending, isError, error, refetch } = useTickets(filters);

  const setFilter = <K extends keyof ListTicketsFilters>(key: K, value: ListTicketsFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value, page: 1 }));
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilter('search', draftSearch.trim() === '' ? undefined : draftSearch.trim());
  };

  const tickets = data?.data ?? [];
  const meta = data?.meta;
  const hasActiveFilters =
    filters.status !== undefined ||
    filters.priority !== undefined ||
    filters.assignedTo !== undefined ||
    filters.search !== undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {meta !== undefined
              ? `${meta.total} ticket${meta.total > 1 ? 's' : ''} correspondant${meta.total > 1 ? 's' : ''} au filtre.`
              : 'Chargement des tickets…'}
          </p>
        </div>
        <Link
          to="/tickets/nouveau"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Nouveau ticket
        </Link>
      </div>

      <section
        aria-label="Filtres"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filter-status" className="block text-xs font-medium text-slate-600">
              Statut
            </label>
            <select
              id="filter-status"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilter('status', (event.target.value || undefined) as TicketStatus | undefined)
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Tous les statuts</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_DESCRIPTORS[status].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-priority" className="block text-xs font-medium text-slate-600">
              Priorité
            </label>
            <select
              id="filter-priority"
              value={filters.priority ?? ''}
              onChange={(event) =>
                setFilter(
                  'priority',
                  (event.target.value || undefined) as TicketPriority | undefined,
                )
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Toutes les priorités</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_DESCRIPTORS[priority].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-assigned" className="block text-xs font-medium text-slate-600">
              Assignation
            </label>
            <select
              id="filter-assigned"
              value={filters.assignedTo ?? ''}
              onChange={(event) =>
                setFilter('assignedTo', event.target.value || undefined)
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Tous</option>
              <option value="unassigned">Non assignés</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="filter-search" className="block text-xs font-medium text-slate-600">
                Recherche
              </label>
              <input
                id="filter-search"
                type="search"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Titre ou description"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ok
            </button>
          </form>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">Un ou plusieurs filtres sont actifs.</p>
            <button
              type="button"
              onClick={() => {
                setDraftSearch('');
                setFilters({ page: 1, limit: 20 });
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </section>

      {isPending ? (
        <InlineLoader label="Chargement des tickets…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="Aucun ticket ne correspond"
          description={
            hasActiveFilters
              ? 'Élargissez ou réinitialisez les filtres pour voir davantage de tickets.'
              : 'Créez le premier ticket pour démarrer le suivi.'
          }
          action={
            hasActiveFilters ? undefined : (
              <Link
                to="/tickets/nouveau"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Créer un ticket
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <caption className="sr-only">Liste des tickets</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ticket
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Statut
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Priorité
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Auteur
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Assigné à
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Créé le
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ticket.createdBy.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.assignedTo?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta !== undefined && (
            <Pagination meta={meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />
          )}
        </div>
      )}
    </div>
  );
}