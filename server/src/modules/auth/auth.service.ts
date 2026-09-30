import { UnauthorizedError, ERROR_CODES } from '../../errors/AppError.js';
import { verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';
import { findUserByEmail } from '../users/user.repository.js';
import { toPublicUser, type PublicUser } from '../users/user.dto.js';
import type { LoginInput } from './auth.schema.js';

export type LoginResult = {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
};

/**
 * Service d'authentification.
 * Ne dépend ni d'Express ni de la couche HTTP : testable directement.
 */
export async function login({ email, password }: LoginInput): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  // Message volontairement identique pour un email inconnu et un mot de
  // passe erroné : ne pas révéler quelles adresses existent dans la base.
  const invalidCredentials = new UnauthorizedError(
    'Email ou mot de passe incorrect.',
    ERROR_CODES.INVALID_CREDENTIALS,
  );

  if (!user) {
    // Comparaison factice pour éviter une réponse plus rapide sur email inconnu.
    await verifyPassword(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalidCredentials;
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    throw invalidCredentials;
  }

  const publicUser = toPublicUser(user);

  return {
    token: signToken({ sub: user.id, role: user.role }),
    tokenType: 'Bearer',
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '8h',
    user: publicUser,
  };
}

/** Retourne l'utilisateur associé au jeton courant (utilisé par /api/auth/me). */
export function currentUser(user: PublicUser): PublicUser {
  return user;
}
