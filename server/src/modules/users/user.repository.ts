import { query, queryOne } from '../../db/pool.js';
import type { UserRole } from '../shared/schemas.js';
import type { AuthUserRow, UserRow } from './user.dto.js';

const USER_COLUMNS = 'id, email, full_name, password_hash, role, created_at, updated_at';

/**
 * Repository `users` : seul module autorisé à écrire du SQL sur cette table.
 * Toutes les requêtes sont paramétrées, aucune valeur n'est concaténée.
 */

/** Utilisateur par identifiant, pour le middleware d'authentification. */
export async function findAuthUserById(id: string): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
}

/** Utilisateur par email (insensible à la casse), pour la connexion. */
export async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
}

/**
 * Liste des agents, source unique du sélecteur d'assignation côté frontend.
 * Ne renvoie que les colonnes nécessaires : pas de password_hash.
 */
export async function listAssignableUsers(role?: UserRole): Promise<UserRow[]> {
  if (role) {
    return query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE role = $1 ORDER BY full_name ASC`,
      [role],
    );
  }

  return query<UserRow>(`SELECT ${USER_COLUMNS} FROM users ORDER BY full_name ASC`);
}

/** Contrôle l'existence d'un agent : utilisé par l'assignation de ticket. */
export async function isUserWithRole(id: string, role: UserRole): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    'SELECT TRUE AS exists FROM users WHERE id = $1 AND role = $2',
    [id, role],
  );
  return row !== null;
}
