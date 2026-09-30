import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DatabaseError } from 'pg';
import { AppError, ConflictError, InternalServerError, ValidationError } from '../errors/AppError.js';
import { env, isProduction } from '../config/env.js';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
};

/**
 * Traduit une erreur PostgreSQL en erreur applicative.
 * Evite de renvoyer un 500 pour une simple violation de contrainte.
 */
function fromDatabaseError(error: DatabaseError): AppError {
  switch (error.code) {
    case '23505': // unique_violation
      return new ConflictError('Ressource déjà existante.');
    case '23503': // foreign_key_violation
      return new ValidationError(
        'Référence invalide vers une ressource inexistante.',
        'INVALID_REFERENCE',
      );
    case '23514': // check_violation
      return new ValidationError(
        'Valeur refusée par une contrainte de la base.',
        'CONSTRAINT_VIOLATION',
      );
    case '22P02': // invalid_text_representation (UUID malformé)
      return new ValidationError('Identifiant invalide.', 'INVALID_ID');
    default:
      return new InternalServerError();
  }
}

function isAppErrorWithStatus(error: unknown): error is AppError & { statusCode: number } {
  return error instanceof AppError && typeof (error as { statusCode?: unknown }).statusCode === 'number';
}

/**
 * Middleware d'erreurs. Doit être monté en dernier : Express n'identifie un
 * middleware d'erreur qu'à sa signature à 4 arguments.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Une erreur interne est survenue.';
  let details: { path: string; message: string }[] | undefined;

  if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const first = error.issues[0];
    message = first
      ? `Données invalides : ${first.path.join('.') || '(racine)'} - ${first.message}`
      : 'Données invalides.';
    details = error.issues.map((issue) => ({
      path: issue.path.join('.') || '(racine)',
      message: issue.message,
    }));
  } else if (isAppErrorWithStatus(error)) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof DatabaseError) {
    const mapped = fromDatabaseError(error);
    statusCode = mapped.statusCode;
    code = mapped.code;
    message = mapped.message;
  } else if (error instanceof SyntaxError && 'body' in error) {
    // JSON malformé rejeté par express.json()
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Le corps de la requête n\'est pas un JSON valide.';
  } else if (error instanceof Error) {
    message = isProduction ? message : error.message;
  }

  if (statusCode >= 500) {
    console.error('[error] Erreur non gérée :', error);
  } else if (env.LOG_LEVEL === 'debug') {
    console.warn(`[error] ${statusCode} ${code} : ${message}`);
  }

  const body: ErrorBody = { error: { code, message } };
  if (details && details.length > 0) {
    body.error.details = details;
  }

  if (!isProduction && error instanceof Error && error.stack && statusCode >= 500) {
    body.error.message = `${message}\n${error.stack}`;
  }

  res.status(statusCode).json(body);
}
