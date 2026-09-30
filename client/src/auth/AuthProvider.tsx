import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/api';
import { ApiError, clearStoredToken, getStoredToken, storeToken } from '@/api/client';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import type { PublicUser } from '@/api/types';

/**
 * Session utilisateur.
 *
 * Le jeton vit dans `localStorage`, le profil en état React. Au démarrage, si
 * un jeton existe, `/auth/me` est appelé pour le valider : un jeton expiré est
 * alors effacé au lieu de laisser l'interface afficher une session fantôme.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(getStoredToken() !== null);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setIsLoading(false);
  }, []);

  // Restauration de session au chargement.
  useEffect(() => {
    if (getStoredToken() === null) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void authApi
      .me()
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        clearStoredToken();
        setUser(null);

        if (!(error instanceof ApiError)) {
          console.error('[auth] Erreur inattendue lors de la restauration de session.', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    storeToken(result.token);
    setUser(result.user);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}