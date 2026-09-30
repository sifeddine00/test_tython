import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { router } from '@/router';

/**
 * Racine de l'application.
 *
 * `AuthProvider` entoure le routeur : `ProtectedRoute` et `Layout` ont besoin
 * de la session, y compris pour le rendu initial.
 */
export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}