import type { UserRole } from '../shared/schemas.js';

/** Ligne SQL de la table `users`. Ne quitte jamais la couche repository. */
export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
};

/** Ligne utilisée par l'authentification : jamais exposée à l'API. */
export type AuthUserRow = UserRow;

/**
 * Représentation publique d'un utilisateur.
 * `password_hash` n'a pas de champ ici : il est structurellement
 * impossible de le sérialiser dans une réponse HTTP.
 */
export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
};

export function toPublicUser(row: UserRow | AuthUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}
