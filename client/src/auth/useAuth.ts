import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';

/**
 * Accès au contexte de session.
 *
 * Lève une erreur explicite si le hook est utilisé hors `AuthProvider` : une
 * session silencieusement absente produirait une interface figée, difficile à
 * diagnostiquer.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.');
  }

  return context;
}