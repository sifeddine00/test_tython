import { Link } from 'react-router-dom';

/** Page 404 : aucune route du CDC n'y mène, mais une URL saisie à la main si. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Erreur 404</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Page introuvable</h1>
      <p className="max-w-md text-sm text-slate-600">
        L'adresse demandée n'existe pas. Utilisez la navigation pour revenir à une page existante.
      </p>
      <Link
        to="/"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}