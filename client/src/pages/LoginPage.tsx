import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { InlineError, Spinner } from '@/components/Feedback';

/**
 * Page de connexion.
 *
 * Le message d'erreur vient du backend : il est volontairement identique pour
 * un email inconnu et un mot de passe erroné, afin de ne pas révéler quelles
 * adresses existent.
 */
export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">HelpDeskPro</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez-vous pour accéder aux tickets.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Adresse e-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <InlineError error={error} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Spinner className="h-4 w-4 text-white" />}
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Comptes de démonstration</p>
          <ul className="mt-2 space-y-1">
            <li>Administrateur : admin@helpdeskpro.com</li>
            <li>Agents : karim.benali@helpdeskpro.com, sofia.marchand@helpdeskpro.com</li>
            <li className="pt-1">Mot de passe commun : Password123!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}