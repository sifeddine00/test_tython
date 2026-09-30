import type { PaginationMeta } from '@/api/types';

/**
 * Pagination.
 *
 * Le CDC ne définit pas de endpoint de pagination ; `limit` est plafonné à 100
 * par le backend, et les métadonnées sont fournies par la réponse paginée.
 */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  const canGoBack = meta.page > 1;
  const canGoForward = meta.page < meta.totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4"
    >
      <p className="text-sm text-slate-600">
        Page <span className="font-semibold">{meta.page}</span> sur {meta.totalPages} —{' '}
        {meta.total} ticket{meta.total > 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onPageChange(meta.page - 1)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onPageChange(meta.page + 1)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </nav>
  );
}