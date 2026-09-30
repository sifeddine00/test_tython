import type { ZodError, ZodTypeAny } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { ValidationError, type ErrorDetail } from '../errors/AppError.js';

type RequestPart = 'body' | 'query' | 'params';

function toDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(racine)',
    message: issue.message,
  }));
}

function validatePart(part: RequestPart, schema: ZodTypeAny, data: unknown): unknown {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = toDetails(result.error);
    const first = details[0];
    const message = first
      ? `Données invalides (${part}) : ${first.path} - ${first.message}`
      : `Données invalides (${part}).`;

    throw new ValidationError(message, 'VALIDATION_ERROR', details);
  }

  return result.data;
}

/**
 * Middleware de validation. Les données validées et typées sont récopiées
 * sur `req.body`, `req.query` et `req.params` : les contrôleurs et services
 * ne voient ensuite que des données conformes au schéma.
 */
export function validate(schemas: Partial<Record<RequestPart, ZodTypeAny>>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = validatePart('body', schemas.body, req.body);
      }
      if (schemas.query) {
        // `req.query` est en lecture seule sur Express 5 : on redefinit la propriété.
        const parsedQuery = validatePart('query', schemas.query, req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) {
        req.params = validatePart('params', schemas.params, req.params) as Request['params'];
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
