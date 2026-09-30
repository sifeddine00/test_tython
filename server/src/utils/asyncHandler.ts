import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Enveloppe un contrôleur pour que toute promesse rejetée soit transmise
 * au middleware d'erreurs. Évite un try/catch dans chaque handler.
 */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
