import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/AppError.js';

const ISSUER = 'helpdeskpro-api';
const AUDIENCE = 'helpdeskpro-client';

export type JwtPayload = {
  /** Identifiant utilisateur (UUID). */
  sub: string;
  role: 'admin' | 'agent';
};

const signOptions = {
  algorithm: 'HS256' as const,
  expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] & string,
  issuer: ISSUER,
  audience: AUDIENCE,
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    ...signOptions,
    subject: payload.sub,
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Jeton invalide.');
    }

    const role = (decoded as jwt.JwtPayload & { role?: unknown }).role;
    if (role !== 'admin' && role !== 'agent') {
      throw new UnauthorizedError('Jeton invalide : rôle manquant.');
    }

    return { sub: decoded.sub, role };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Jeton expiré, veuillez vous reconnecter.');
    }
    throw new UnauthorizedError('Jeton invalide.');
  }
}

/** Extrait le token du header `Authorization: Bearer <token>`. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}
