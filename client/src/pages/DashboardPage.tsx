import { Link } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useTickets';
import { ErrorState, InlineLoader } from '@/components/Feedback';

/**
 * Tableau de bord — section 4.4 du CDC.
 *
 * Quatre éléments : total des tickets, tickets ouverts, tickets en cours et
 * classement des cinq agents ayant le plus résolu.
 */
export function DashboardPage() {
  const { data: stats, isPending, isError, error, refetch } = useDashboardStats();

  if (isPending) {
    return <InlineLoader label="Chargement des statistiques…" />;
  }

  if (isError || stats === undefined) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const cards = [
    { label: 'Tickets au total', value: stats.totalTickets, tone: 'text-slate-900' },
    { label: 'Tickets ouverts', value: stats.byStatus.open, tone: 'text-blue-700' },
    { label: 'Tickets en cours', value: stats.byStatus.in_progress, tone: 'text-amber-700' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vue d'ensemble de l'activité du support.
          </p>
        </div>
        <Link
          to="/tickets"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Voir les tickets
        </Link>
      </div>

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="top-agents-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="top-agents-heading" className="text-sm font-semibold text-slate-900">
            Top 5 agents par tickets résolus
          </h2>
        </div>

        {stats.topAgents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Aucun ticket résolu pour le moment.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Rang
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Agent
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  E-mail
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Résolus
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.topAgents.map((agent, index) => (
                <tr key={agent.userId}>
                  <td className="px-5 py-3 text-slate-500 tabular-nums">{index + 1}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{agent.fullName}</td>
                  <td className="px-5 py-3 text-slate-600">{agent.email}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {agent.resolvedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}