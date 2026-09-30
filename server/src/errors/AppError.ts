/**
 * Taxonomie d'erreurs applicatives.
 *
 * Chaque erreur métier porte un code HTTP et un code stable (utilisé par le
 * frontend et les tests). Le middleware `errorHandler` se contente de les
 * sérialiser : aucune logique de décision n'est dupliquée ailleurs.
 */

export type ErrorDetail = {
  path: string;
  message: string;
};

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: ErrorDetail[];
  readonly isOperational: boolean;

  constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.isOperational = true;

    if (details && details.length > 0) {
      this.details = details;
    }

    Error.captureStackTrace(this, new.target);
  }
}

/** 400 - Données d'entrée invalides (validation Zod ou règle métier). */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code: string;

  constructor(message: string, code = 'VALIDATION_ERROR', details?: ErrorDetail[]) {
    super(message, details);
    this.code = code;
  }
}

/** 401 - Authentification absente ou invalide. */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code: string;

  constructor(message = 'Authentification requise.', code = 'UNAUTHORIZED') {
    super(message);
    this.code = code;
  }
}

/** 403 - Authentifié mais droits insuffisants. */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'Vous n\'avez pas les droits nécessaires pour cette action.') {
    super(message);
  }
}

/** 404 - Ressource inexistante. */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code: string;

  constructor(resource = 'Ressource', id?: string) {
    super(id ? `${resource} introuvable : ${id}` : `${resource} introuvable.`);
    this.code = 'NOT_FOUND';
  }
}

/** 409 - Conflit d'état ou d'unicité. */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code: string;

  constructor(message: string, code = 'CONFLICT') {
    super(message);
    this.code = code;
  }
}

/** 500 - Erreur interne non anticipée. */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_SERVER_ERROR';

  constructor(message = 'Une erreur interne est survenue.') {
    super(message);
  }
}

// --- Codes de règles métier (cahier des charges 4.2 et 4.3) ------------------

export const ERROR_CODES = {
  INVALID_STATUS_TRANSITION: 'TICKET_INVALID_STATUS_TRANSITION',
  COMMENT_ON_CLOSED_TICKET: 'COMMENT_ON_CLOSED_TICKET',
  ASSIGNEE_MUST_BE_AGENT: 'ASSIGNEE_MUST_BE_AGENT',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;
