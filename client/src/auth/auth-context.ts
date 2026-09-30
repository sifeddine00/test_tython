import { createContext } from 'react';
import type { PublicUser } from '@/api/types';

/**
 * Contexte d'authentification.
 *
 * Déclaré dans son propre fichier : le hook `useAuth` doit pouvoir être importé
 * par les composants sans tirer le composant `AuthProvider` avec lui.
 */

export type AuthContextValue = {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);