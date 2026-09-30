import type { ReactNode } from 'react';
import { toErrorMessage } from '@/lib/errors';

/**
 * États d'interface partagés : chargement, erreur, vide.
 *
 * Les extraire évite d'inventer trois variantes de spinner par page et garantit
 * qu'un message d'erreur du backend est toujours rendu de la même façon.
 */

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-indigo-600 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export function FullPageLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Spinner className="h-8 w-8" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function InlineLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Impossible de charger les données',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{toErrorMessage(error)}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Bandeau d'erreur en ligne, pour les formulaires et les mutations. */
export function InlineError({ error }: { error: unknown }) {
  if (error === null || error === undefined) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
    >
      {toErrorMessage(error)}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description !== undefined && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action !== undefined && <div className="mt-3">{action}</div>}
    </div>
  );
}