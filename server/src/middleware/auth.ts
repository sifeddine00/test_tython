import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import { extractBearerToken, verifyToken } from '../utils/jwt.js';
import { findAuthUserById } from '../modules/users/user.repository.js';
import { toPublicUser, type PublicUser } from '../modules/users/user.dto.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

/**
 * Authentification par JWT Bearer.
 * Le rôle est relu en base à chaque requête : un changement de rôle ou une
 * suppression de compte prend effet immédiatement, sans attendre l'expiration
 * du jeton.
 */
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError('Jeton d\'authentification manquant.');
    }

    const payload = verifyToken(token);
    const user = await findAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedError('Compte utilisateur introuvable ou désactivé.');
    }

    req.user = toPublicUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

/** Restreint l'accès à certains rôles. Utilisé après `authenticate`. */
export function requireRole(...roles: ReadonlyArray<'admin' | 'agent'>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Cette action est réservée aux administrateurs.'));
      return;
    }

    next();
  };
}
