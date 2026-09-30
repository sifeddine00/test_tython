import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

/**
 * Coquille applicative : navigation latérale, identité et déconnexion.
 *
 * Appliquée à toutes les routes protégées, elle n'est jamais rendue sur la
 * page de connexion.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/tickets', label: 'Tickets', end: false },
  { to: '/tickets/nouveau', label: 'Nouveau ticket', end: false },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent',
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-8">
            <span className="text-lg font-bold tracking-tight text-slate-900">HelpDeskPro</span>

            <nav aria-label="Navigation principale" className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {user !== null && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                <p className="text-xs text-slate-500">
                  {ROLE_LABELS[user.role] ?? user.role} · {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}