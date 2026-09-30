import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { FullPageLoader } from '@/components/Feedback';

/**
 * Garde de route : redirige vers /login si aucune session valide n'existe.
 * La route demandée est mémorisée pour revenir dessus après connexion.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader label="Vérification de la session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}